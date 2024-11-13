import {
  cloneAudioData,
  getCodecFromMimeType,
  getContainerFromMimeType,
  next,
  nextTick,
} from "./utils";
import { type ContainerContext, ExtendedVideoFrame, cloneFrame } from "./frame";
import { MFXBufferCopy, MFXTransformStream } from "./stream";
import { MP4ContainerDecoder } from "./container/mp4/MP4ContainerDecoder";
import {
  ContainerDecoder,
  type MFXDecodableTrackChunk,
} from "./container/ContainerDecoder";
import {
  TrackType,
  type GenericTrack,
  Track,
} from "./container/Track";
import { WebMContainerDecoder } from "./container/webM/WebMContainerDecoder";
import type { GenericData, MFXEncodedChunk } from "./types";
import { WebMContainerProbe } from "./container/webM/WebMContainerProbe";
import { FrameRateAdjuster } from "./keyframes";

/**
 * @group Decode
 */
export interface MFXDecodableChunk<Sample = any> extends MFXEncodedChunk {
  context?: ContainerContext;
  track?: GenericTrack<Sample>;
  video?: MFXEncodedChunk["video"] & {
    config: VideoDecoderConfig;
  };
  audio?: MFXEncodedChunk["audio"] & {
    config: AudioDecoderConfig;
  };
}

/**
 * @group Decode
 * @note Forces a VideoFrame to be copied to Software (CPU)
 */
export const forceCopyFrame = async (
  frame: VideoFrame,
  canvas: HTMLCanvasElement = document.createElement("canvas"),
) => {
  if (!frame) return;

  const ctx = canvas.getContext("2d", {
    willReadFrequently: true,
  });

  const width = frame.displayWidth;
  const height = frame.displayHeight;
  canvas.width = width;
  canvas.height = height;

  ctx.drawImage(frame, 0, 0, width, height);

  const imageBitmap = await createImageBitmap(canvas);

  frame.close();
  return ExtendedVideoFrame.revise(frame, imageBitmap);
};

/**
 * @group Decode
 */
export interface DecodeOptions {
  trim?: {
    // Inclusive number of milliseconds to start cutting from (supports for microsecond fractions)
    start?: number;
    // Exclusive number of milliseconds to cut to (supports for microsecond fractions)
    end?: number;
  };
  // Ensures frames are filled or reduced regardless of the container framerate
  frameRate?: number;
   // Addresses Chromium WebCodecs bug, Set to true for HEVC or if "Can't readback frame textures" is thrown. Has ~10% performance impact.
  forceDecodeToSoftware?: boolean;
};

/**
 * @group Decode
 */
export const decode = async (
  input: ReadableStream<Uint8Array>,
  mimeType: string,
  opt: DecodeOptions = {},
) => {
  let videoStreams: MFXVideoDecoder[] = [];
  let audioStreams: MFXAudioDecoder[] = [];
  let root = input;
  const containerType = getContainerFromMimeType(mimeType);
  let { videoCodec, audioCodec } = getCodecFromMimeType(mimeType);

  let decoder: ContainerDecoder<any>;

  // Slow path, probe webM containers for a codec by performing a full read
  if (containerType === "webm" && !videoCodec) {
    const measure = "Time-spent on codec probing";
    console.time(measure);
    console.warn(`No video codec provided in mimeType = (${mimeType}): a slow full container decode is required.

Please provided a full mimeType if video/audio codec is known ahead of time.`);
    const probe = new WebMContainerProbe();
    const s1 = new TransformStream();
    const s2 = new TransformStream();
    const copier = new MFXBufferCopy(s1.writable, s2.writable);
    input.pipeTo(copier);
    s1.readable.pipeTo(probe);
    root = s2.readable;

    videoCodec = await probe.getCodec();
    console.timeEnd(measure);
  }

  if (containerType === "mp4") {
    decoder = new MP4ContainerDecoder({
      // Assist on trimming using file seek
      seek: (opt.trim?.start || 0) / 1000
    });
  } else if (containerType === "webm") {
    decoder = new WebMContainerDecoder({ videoCodec, audioCodec });
  }

  if (!decoder) {
    throw new Error(`No decoder was found for mimeType: ${mimeType}`);
  }

  const splitter = new WritableStream<MFXDecodableTrackChunk<any>>({
    write: (chunk) => {
      const track = chunk.track;
      let stream: MFXTransformStream<MFXDecodableChunk, any>;

      if (track.type === TrackType.Video) {
        stream = videoStreams.find((s) => s.track.id === track.id);
      } else {
        stream = audioStreams.find((s) => s.track.id === track.id);
      }

      if (!stream) {
        throw new Error(
          `Unexpected failure, unable to find associted decoder for track ${track.id} of type ${track.type}`,
        );
      }

      const writer =
        stream.writable.getWriter() as WritableStreamDefaultWriter<MFXDecodableChunk>;

      chunk.samples.forEach((sample) => {
        writer.write({
          [track.type]: {
            config: track.config,
            chunk: track.toChunk(sample),
          },
        });
      });
      writer.releaseLock();
    },
    close: async () => {
      await Promise.all(
        [...videoStreams, ...audioStreams].map((track) => track.writable.close()),
      );
    },
  });

  root.pipeThrough(decoder).pipeTo(splitter);
  const tracks = await decoder.tracks;
  // Decode tracks
  videoStreams = tracks
    .filter((track) => track.type === TrackType.Video)
    .map((track) =>
      new MFXVideoDecoder(track.config as VideoDecoderConfig, {
        forceDecodeToSoftware: opt.forceDecodeToSoftware,
      }).setTrack(track),
    );
  audioStreams = tracks
    .filter((track) => track.type === TrackType.Audio)
    .map((track) =>
      new MFXAudioDecoder(track.config as AudioDecoderConfig).setTrack(track),
    );

  const createTrimmer = <T extends GenericData>(trim: DecodeOptions["trim"]) => new TransformStream<T, T>({
    transform: (chunk, controller) => {
      const { start = 0, end = 0 } = trim;
      const time = chunk.timestamp / 1e3;
      const shouldInclude = time >= start && (end > 0 && (time < end));

      if (shouldInclude) {
        if (chunk instanceof AudioData) {
          const data = chunk as AudioData;
          controller.enqueue(cloneAudioData(data, {
            timestamp: data.timestamp - (start * 1e3),
          }) as T);
        } else if (chunk instanceof ExtendedVideoFrame || chunk instanceof VideoFrame) {
          controller.enqueue(cloneFrame(chunk, {
            timestamp: chunk.timestamp - (start * 1e3),
          }) as T);
        }
      }
    }
  });

  // Apply filters
  const videoTracks = videoStreams.map(({ readable, track }) => {
    let stream: ReadableStream<ExtendedVideoFrame> = readable;

    if (Number.isInteger(opt.frameRate) && opt.frameRate > 0) {
      stream = stream.pipeThrough(new FrameRateAdjuster(opt.frameRate));
    }

    if (opt.trim) {
      stream = stream.pipeThrough(createTrimmer<ExtendedVideoFrame>(opt.trim));
    }

    return new Track(track, stream);
  });

  const audioTracks = audioStreams.map(({ readable, track }) => {
    let stream: ReadableStream<AudioData> = readable;

    if (opt.trim) {
      stream = stream.pipeThrough(createTrimmer<AudioData>(opt.trim));
    }

    return new Track(track, stream);
  });

  return {
    // Convinience properties, first track of each type in container
    video: videoTracks?.[0],
    audio: audioTracks?.[0],

    videoTracks: videoTracks,
    audioTracks: audioTracks,
  };
};

/**
 * @group Decode
 */
export class MFXAudioDecoder extends MFXTransformStream<
  MFXDecodableChunk,
  AudioData
> {
  config: AudioDecoderConfig;
  get identifier() {
    return "MFXAudioDecoder";
  }

  constructor(config: Partial<AudioDecoderConfig> = {}) {
    let backpressure = Promise.resolve();
    let configured = false;

    const decoder = new AudioDecoder({
      output: async (data) => {
        backpressure = this.queue(data);
      },
      error: (e) => {
        console.trace(e);
        this.dispatchError(e);
      },
    });

    super(
      {
        transform: async ({ audio }) => {
          if (!configured) {
            decoder.configure({
              ...(audio.config as AudioDecoderConfig),
              ...config,
            });
            configured = true;
          }

          // Prevent forward backpressure
          await backpressure;

          // Prevent backwards backpressure
          while (decoder.decodeQueueSize > 10) {
            await nextTick();
          }

          decoder.decode(audio.chunk);
        },
        flush: async () => {
          await decoder.flush();
          await nextTick();

          decoder.close();
        },
      },
      new CountQueuingStrategy({
        highWaterMark: 10, // Input chunks (tuned for low memory usage)
      }),
      new CountQueuingStrategy({
        highWaterMark: 10, // Output frames (tuned for low memory usage)
      }),
    );
  }
}

const calculateDuration = (a: VideoFrame, b: VideoFrame) => {
  return b?.timestamp ? b.timestamp - a.timestamp : 0;
};

/**
 * @group Decode
 */
export class MFXVideoDecoder extends MFXTransformStream<
  MFXDecodableChunk,
  ExtendedVideoFrame
> {
  config: VideoDecoderConfig & {
    forceDecodeToSoftware: boolean;
  };
  get identifier() {
    return "MFXVideoDecoder";
  }

  constructor(
    config: Partial<VideoDecoderConfig> = {},
    {
      forceDecodeToSoftware = false,
    }: {
      forceDecodeToSoftware?: boolean;
    } = {},
  ) {
    const canvas = new OffscreenCanvas(config.codedWidth, config.codedHeight);
    const transformer = async (
      frame: ExtendedVideoFrame,
    ): Promise<ExtendedVideoFrame> => {
      if (frame && forceDecodeToSoftware) {
        return await forceCopyFrame(frame, canvas as any);
      }

      return frame;
    };
    let backpressure = Promise.resolve();
    let configured = false;
    let context: ContainerContext | null = null;

    let frameStack: VideoFrame[] = [];
    let lastFrame: VideoFrame;

    const processFrame = (
      frame?: VideoFrame,
    ): ExtendedVideoFrame | undefined => {
      let newFrame: ExtendedVideoFrame | undefined;
      const isLastFrame = !frame;

      /** @note This generic frame duration approach works for any container but can result in inaccuracies */
      // In the future we can utilize container provided durations for each frame if necessary

      if (lastFrame) {
        let last = lastFrame;
        // If we are at the last frame calculate the total duration of the frame from the container duration
        let duration = isLastFrame
          ? Math.max(context.duration * 1e3 - last.timestamp, 0)
          : calculateDuration(last, frame);

        const discard = () => {
          last = frame;
          duration = calculateDuration(frame, frameStack[2]);
          frameStack = [frame, frameStack[2]];
        };
        // TODO: Filter out frames with timecodes outside of container start/end
        const isOutOfBound =
          frame &&
          (frame.timestamp < 0 ||
            (Number.isInteger(context?.duration) &&
              context.duration > 0 &&
              frame.timestamp > context?.duration * 1e3));

        if (isOutOfBound) {
          console.warn(
            "Discarding out of bound frame, MFX is not currently able to handle out of bound frames",
            { discarded: frame },
          );
          return null;
        }

        if (duration <= 0) {
          // Last frame is out of order, discard
          console.warn(
            "Discarding out of order frame, MFX is not currently able to handle out of order frames",
            {
              discarded: lastFrame,
            },
          );
          // TODO: Add option to debug by emitting bad frames as an event to be inspected in a Canvas
          discard();
        }

        newFrame = ExtendedVideoFrame.revise(last, last as any, {
          // Ensure duration is always available after decoding
          duration: Math.max(duration, 0),
        });

        frameStack.unshift(newFrame);
        frameStack = frameStack.slice(0, 3);
      }

      if (frame) {
        lastFrame = frame;
      }

      return newFrame;
    };

    const decoder = new VideoDecoder({
      output: async (frame) => {
        const next = await transformer(processFrame(frame));
        if (next) {
          backpressure = this.queue(next);
        }
      },
      error: (e) => {
        console.trace(e);
        this.dispatchError(e);
      },
    });

    super(
      {
        transform: async ({ video, context: derivedContext }) => {
          if (!configured) {
            decoder.configure({
              hardwareAcceleration: "prefer-hardware",
              optimizeForLatency: false,
              ...config,
              ...video.config,
            });
            configured = true;
          }

          context = derivedContext;

          // Prevent forward backpressure
          await backpressure;

          // Prevent backwards backpressure
          while (decoder.decodeQueueSize > 10) {
            await nextTick();
          }

          decoder.decode(video.chunk);
        },
        flush: async (controller) => {
          await decoder.flush();
          const frame = await transformer(processFrame(lastFrame));
          controller.enqueue(frame);
          await nextTick();

          decoder.close();
        },
      },
      new CountQueuingStrategy({
        highWaterMark: 10, // Input chunks (tuned for low memory usage)
      }),
      new CountQueuingStrategy({
        highWaterMark: 10, // Output frames (tuned for low memory usage)
      }),
    );
  }
}
