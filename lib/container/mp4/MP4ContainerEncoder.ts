import { Muxer as MP4Muxer, StreamTarget as MP4StreamTarget } from "mp4-muxer";
import type { MFXEncodedChunk } from "../../types";
import { MFXTransformStream } from "../../stream";
import { MFXBlob } from "../../blob";
import type { ContainerEncoderConfig } from "../encoderConfig";

/**
 * @group Encode
 */
export class MP4ContainerEncoder extends MFXTransformStream<
  MFXEncodedChunk,
  MFXBlob
> {
  get identifier() {
    return "MP4ContainerEncoder";
  }

  ready: Promise<any>;
  constructor(config: ContainerEncoderConfig, chunkSize?: number) {
    const videoCodecMapper = (
      codec: ContainerEncoderConfig["video"]["codec"],
    ): "avc" | "hevc" | "vp9" | "av1" => {
      const targets: ("avc" | "hevc" | "vp9" | "av1")[] = [
        "avc",
        "hevc",
        "vp9",
        "av1",
      ];

      if (codec.startsWith("hvc")) {
        return "hevc";
      }

      for (let i = 0; i < targets.length; i++) {
        if (codec.startsWith(targets[i])) {
          return targets[i];
        }
      }

      throw new Error(`Unsupported MP4 video codec ${codec}`);
    };
    const audioCodecMapper = (
      codec: ContainerEncoderConfig["audio"]["codec"],
    ) => {
      const targets: ("opus" | "aac")[] = ["opus", "aac"];
      for (let i = 0; i < targets.length; i++) {
        if (codec.startsWith(targets[i])) {
          return targets[i];
        }
      }

      throw new Error(`Unsupported MP4 audio codec ${codec}`);
    };
    let muxer: MP4Muxer<MP4StreamTarget>;

    super({
      transform: async (chunk) => {
        // TODO: support raw chunks such as addAudioChunkRaw
        // to allow passthrough tracks
        if (chunk.video) {
          muxer.addVideoChunk(chunk.video.chunk, chunk.video.metadata);
        }

        if (chunk.audio) {
          muxer.addAudioChunk(chunk.audio.chunk, chunk.audio.metadata);
        }
      },
      flush: async () => {
        muxer.finalize();
      },
    });

    muxer = new MP4Muxer({
      ...(config.video
        ? {
            video: {
              height: config.video.height,
              width: config.video.width,
              codec: videoCodecMapper(config.video.codec),
            },
          }
        : {}),
      ...(config.audio
        ? {
            audio: {
              codec: audioCodecMapper(config.audio.codec),
              numberOfChannels: config.audio.numberOfChannels,
              sampleRate: config.audio.sampleRate,
            },
          }
        : {}),
      firstTimestampBehavior: "offset",
      fastStart: "fragmented",
      target: new MP4StreamTarget({
        onData: (data, position) => {
          this.queue(
            new MFXBlob([data], {
              type: "video/mp4",
              position,
              config,
            }),
          );
        },
        ...(Number.isInteger(chunkSize)
          ? {
              chunked: true,
              chunkSize,
            }
          : {}),
      }),
    });
  }
}
