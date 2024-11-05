import { next } from "./utils";
import { MFXTransformStream, PassThroughStream } from "./stream";
import { ExtendedVideoFrame } from "./frame";
import { vp9 } from "./codec/vp9";

export { MP4ContainerEncoder } from "./container/mp4/MP4ContainerEncoder";
export { WebMContainerEncoder } from "./container/webM/WebMContainerEncoder";

/**
 * @group Encode
 */
export const encode = ({
  mimeType,
  video,
  audio,
}: {
  mimeType: string;
  video?: VideoEncoderConfig & {
    stream: MFXTransformStream<any, VideoFrame> | ReadableStream<VideoFrame>;
  };
  audio?: AudioEncoderConfig & {
    stream: MFXTransformStream<any, AudioData> | ReadableStream<AudioData>;
  };
}) => {
  const stream = new PassThroughStream<MFXBlob>();

  return stream;
};

/** @group Stream */
export class MFXBlob extends Blob {
  position?: number;
  videoEncodingConfig: VideoEncoderConfig;
  constructor(
    parts: BlobPart[],
    opt: BlobPropertyBag & {
      position?: number;
      videoEncodingConfig: VideoEncoderConfig;
    },
  ) {
    super(parts, opt);
    this.position = opt.position;
    this.videoEncodingConfig = opt.videoEncodingConfig;
  }

  getMimeType() {
    return `${this.type}; codecs="${this.videoEncodingConfig.codec}"`;
  }
}

/**
 * @group Encode
 */
export interface MFXEncodedChunk {
  video?: {
    chunk: EncodedVideoChunk;
    metadata?: EncodedVideoChunkMetadata;
  };
  audio?: {
    chunk?: EncodedAudioChunk;
    metadata?: EncodedAudioChunkMetadata;
  };
}

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

  constructor(config: VideoEncoderConfig) {
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

    const matroskaMaxInterval = 1e6 * 30;
    // Force first frame to be keyFrame
    let lastKeyFrameTimestamp = -matroskaMaxInterval;

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

          if (frame.timestamp - lastKeyFrameTimestamp >= matroskaMaxInterval) {
            encoder.encode(frame, { keyFrame: true });
            lastKeyFrameTimestamp = frame.timestamp;
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
