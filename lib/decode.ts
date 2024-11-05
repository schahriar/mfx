import { getCodecFromMimeType, next, nextTick } from "./utils";
import { type ContainerContext, ExtendedVideoFrame } from "./frame";
import { MFXBufferCopy, MFXTransformStream } from "./stream";
import MIMEType from "whatwg-mimetype";
import { MP4ContainerDecoder } from "./container/mp4/MP4ContainerDecoder";
import {
  ContainerDecoder,
  type MFXDecodableTrackChunk,
  MFXTrackType,
  type MFXTrack,
} from "./container/ContainerDecoder";
import { WebMContainerDecoder } from "./container/webM/WebMContainerDecoder";
import type { MFXEncodedChunk } from "./encode";
import { MFXWebMContainerProbe } from "./container/webM/WebMContainerProbe";

/**
 * @group Decode
 */
export interface MFXDecodableChunk<Sample = any> extends MFXEncodedChunk {
  context?: ContainerContext;
  track?: MFXTrack<Sample>;
  video?: MFXEncodedChunk["video"] & {
    config: VideoDecoderConfig;
  };
  audio?: MFXEncodedChunk["audio"] & {
    config: AudioDecoderConfig;
  };
}

/**
 * @group Decode
 */
export const decode = async (
  input: ReadableStream<Uint8Array>,
  mimeType: string,
) => {
  let videoTracks: MFXVideoDecoder[] = [];
  let audioTracks: MFXAudioDecoder[] = [];
  let root = input;
  const mime = new MIMEType(mimeType);
  let { videoCodec, audioCodec } = getCodecFromMimeType(mimeType);

  let decoder: ContainerDecoder<any>;

  const isWebM = mime.subtype === "webm" || mime.subtype === "x-matroska";

  // Slow path
  if (isWebM && !videoCodec) {
    const measure = "Time-spent on codec probing";
    console.time(measure);
    console.warn(`No video codec provided in mimeType = (${mimeType}): a slow full container decode is required.

Please provided a full mimeType if video/audio codec is known ahead of time.`);
    const probe = new MFXWebMContainerProbe();
    const s1 = new TransformStream();
    const s2 = new TransformStream();
    const copier = new MFXBufferCopy(s1.writable, s2.writable);
    input.pipeTo(copier);
    s1.readable.pipeTo(probe);
    root = s2.readable;

    videoCodec = await probe.getCodec();
    console.timeEnd(measure);
  }

  if (mime.subtype === "mp4") {
    decoder = new MP4ContainerDecoder();
  } else if (isWebM) {
    decoder = new WebMContainerDecoder({ videoCodec, audioCodec });
  }

  if (!decoder) {
    throw new Error(`No decoder was found for mimeType: ${mimeType}`);
  }

  const splitter = new WritableStream<MFXDecodableTrackChunk<any>>({
    write: (chunk) => {
      const track = chunk.track;
      let stream: MFXTransformStream<MFXDecodableChunk, any>;

      if (track.type === MFXTrackType.Video) {
        stream = videoTracks.find((s) => s.track.id === track.id);
      } else {
        stream = audioTracks.find((s) => s.track.id === track.id);
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
        [...videoTracks, ...audioTracks].map((track) => track.writable.close()),
      );
    },
  });

  root.pipeThrough(decoder).pipeTo(splitter);
  const tracks = await decoder.tracks;
  videoTracks = tracks
    .filter((track) => track.type === MFXTrackType.Video)
    .map((track) =>
      new MFXVideoDecoder(track.config as VideoDecoderConfig).setTrack(track),
    );
  audioTracks = tracks
    .filter((track) => track.type === MFXTrackType.Audio)
    .map((track) =>
      new MFXAudioDecoder(track.config as AudioDecoderConfig).setTrack(track),
    );

  return {
    // Convinience properties, first track of each type in container
    video: videoTracks?.[0],
    audio: audioTracks?.[0],

    videoTracks,
    audioTracks,
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
  config: VideoDecoderConfig;
  get identifier() {
    return "MFXVideoDecoder";
  }

  constructor(config: Partial<VideoDecoderConfig> = {}) {
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
        const next = processFrame(frame);
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
          const frame = processFrame(lastFrame);
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
