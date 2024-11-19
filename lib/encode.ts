import { getCodecFromMimeType, getContainerFromMimeType, next } from "./utils";
import { MFXTransformStream } from "./stream";
import { ExtendedVideoFrame } from "./frame";
import { vp9 } from "./codec/vp9";
import { MP4ContainerEncoder } from "./container/mp4/MP4ContainerEncoder";
import { WebMContainerEncoder } from "./container/webM/WebMContainerEncoder";
import type { MFXEncodedChunk } from "./types";
import type { ContainerEncoderConfig } from "./container/encoderConfig";

export { MP4ContainerEncoder, WebMContainerEncoder };

/**
 * @group Encode
 */
export interface MFXVideoEncoderConfig extends VideoEncoderConfig {
  /**
   * Encodes a frame as keyframe every nth second (in seconds)
   * Set to `Infinity` to disable periodic keyframes
   * @default 30 */
  keyframeEveryNthSecond?: number;
}

/**
 * @group Encode
 */
export const encode = ({
  mimeType,
  video,
  audio,
  ...config
}: {
  mimeType: string;
  video?: Omit<MFXVideoEncoderConfig, "codec"> & {
    stream: MFXTransformStream<any, VideoFrame> | ReadableStream<VideoFrame>;
    codec?: string;
  };
  audio?: Omit<AudioEncoderConfig, "codec"> & {
    stream: MFXTransformStream<any, AudioData> | ReadableStream<AudioData>;
    codec?: string;
  };
} & Omit<ContainerEncoderConfig, "video" | "audio">) => {
  const containerType = getContainerFromMimeType(mimeType);
  const { videoCodec, audioCodec } = getCodecFromMimeType(mimeType);

  if (!["mp4", "webm"].includes(containerType)) {
    throw new Error(`Unsupported container type ${containerType}`);
  }

  const { stream: videoStream, ...videoConfigRaw } = video || {};
  const { stream: audioStream, ...audioConfigRaw } = audio || {};
  const videoConfig = {
    codec: videoCodec,
    ...videoConfigRaw,
  } as VideoEncoderConfig;
  const audioConfig = {
    codec: audioCodec,
    ...audioConfigRaw,
  } as AudioEncoderConfig;
  const containerConfig: ContainerEncoderConfig = {
    ...config,
    ...(video
      ? {
          video: videoConfig,
        }
      : {}),
    ...(audio
      ? {
          audio: audioConfig,
        }
      : {}),
  };

  const container =
    containerType === "mp4"
      ? new MP4ContainerEncoder(containerConfig)
      : new WebMContainerEncoder(containerConfig);
  let streams: ReadableStream<any>[] = [];

  if (video) {
    const videoOutput = ((videoStream as TransformStream).readable ||
      videoStream) as ReadableStream<VideoFrame>;
    streams.push(videoOutput.pipeThrough(new MFXVideoEncoder(videoConfig)));
  }

  if (audio) {
    const audioOutput = ((audioStream as TransformStream).readable ||
      audioStream) as ReadableStream<AudioData>;
    streams.push(audioOutput.pipeThrough(new MFXAudioEncoder(audioConfig)));
  }

  const writer = container.writable.getWriter();

  (async () => {
    let promises = [];
    for (let stream of streams) {
      promises.push(
        (async () => {
          for await (const chunk of stream as any) {
            writer.write(chunk);
          }
        })(),
      );
    }

    await Promise.all(promises);
    writer.close();
  })();

  return container.readable;
};

/**
 * @group Encode
 */
export class MFXVideoEncoder extends MFXTransformStream<
  ExtendedVideoFrame,
  MFXEncodedChunk
> {
  get identifier() {
    return "MFXVideoEncoder";
  }

  constructor(config: MFXVideoEncoderConfig) {
    let backpressure = Promise.resolve();
    const encoder = new VideoEncoder({
      output: async (chunk, metadata) => {
        backpressure = this.queue({
          video: {
            chunk,
            metadata,
          },
        });
      },
      error: (e) => {
        console.trace(e);
        this.dispatchError(e);
      },
    });

    encoder.configure({
      ...config,
      ...(config.codec === "vp9"
        ? {
            codec: vp9.autoSelectCodec({
              width: config.width,
              height: config.height,
              bitrate: config.bitrate,
              bitDepth: 8,
            }),
          }
        : {}),
    });

    const maxKFInterval = 1e6 * (config.keyframeEveryNthSecond || 30);
    // Force first frame to be keyFrame
    let lastKFTimestamp = -maxKFInterval;

    super(
      {
        transform: async (frame) => {
          // Prevent forward backpressure
          await backpressure;

          // Prevent backwards backpressure
          while (encoder.encodeQueueSize > 10) {
            await next();
          }

          if (encoder.state !== "configured") {
            throw new Error(
              `VideoEncoder is in invalid state ${encoder.state}`,
            );
          }

          if (
            !(
              frame instanceof VideoFrame ||
              (frame as any) instanceof ExtendedVideoFrame
            )
          ) {
            throw new Error(
              `VideoEncoder received invalid type, check that your pipeline correctly decodes videos`,
            );
          }

          if (frame.duration <= 0) {
            frame.close();
            return;
          }

          if (
            frame.keyFrame ||
            frame.timestamp - lastKFTimestamp >= maxKFInterval
          ) {
            encoder.encode(frame, { keyFrame: true });
            lastKFTimestamp = frame.timestamp;
          } else {
            encoder.encode(frame, { keyFrame: false });
          }

          frame.close();
        },
        flush: async () => {
          await encoder.flush();
          encoder.close();
        },
      },
      new CountQueuingStrategy({
        highWaterMark: 10, // Input chunks (tuned for low memory usage)
      }),
      new CountQueuingStrategy({
        highWaterMark: 10, // Input chunks (tuned for low memory usage)
      }),
    );
  }
}

/**
 * @group Encode
 */
export class MFXAudioEncoder extends MFXTransformStream<
  AudioData,
  MFXEncodedChunk
> {
  get identifier() {
    return "MFXAudioEncoder";
  }

  constructor(config: AudioEncoderConfig) {
    let backpressure = Promise.resolve();
    const encoder = new AudioEncoder({
      output: async (chunk, metadata) => {
        backpressure = this.queue({
          audio: {
            chunk,
            metadata,
          },
        });
      },
      error: (e) => {
        console.trace(e);
        this.dispatchError(e);
      },
    });

    encoder.configure(config);

    super(
      {
        transform: async (frame) => {
          // Prevent forward backpressure
          await backpressure;

          // Prevent backwards backpressure
          while (encoder.encodeQueueSize > 10) {
            await next();
          }

          if (encoder.state !== "configured") {
            throw new Error(
              `AudioEncoder is in invalid state ${encoder.state}`,
            );
          }

          if (!(frame instanceof AudioData)) {
            throw new Error(
              `AudioEncoder received invalid type, check that your pipeline correctly decodes audio`,
            );
          }

          encoder.encode(frame);

          frame.close();
        },
        flush: async () => {
          await encoder.flush();
          encoder.close();
        },
      },
      new CountQueuingStrategy({
        highWaterMark: 10, // Input chunks (tuned for low memory usage)
      }),
      new CountQueuingStrategy({
        highWaterMark: 10, // Input chunks (tuned for low memory usage)
      }),
    );
  }
}
