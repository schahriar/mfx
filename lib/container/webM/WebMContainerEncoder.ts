import type { MFXEncodedChunk } from "../../types";
import { MFXTransformStream } from "../../stream";
import { MFXBlob } from "../../blob";

import {
  Muxer as WebMMuxer,
  StreamTarget as WebMStreamTarget,
} from "webm-muxer";
import type { ContainerEncoderConfig } from "../encoderConfig";

/**
 * @group Encode
 */
export class WebMContainerEncoder extends MFXTransformStream<
  MFXEncodedChunk,
  MFXBlob
> {
  get identifier() {
    return "WebMContainerEncoder";
  }

  ready: Promise<any>;
  constructor(config: ContainerEncoderConfig, chunkSize?: number) {
    const videoCodecMapper = (
      codec: ContainerEncoderConfig["video"]["codec"],
    ) => {
      if (codec.startsWith("vp08") || codec === "vp8") {
        return "V_VP8";
      }

      if (codec.startsWith("vp09") || codec === "vp9") {
        return "V_VP9";
      }

      // TODO: Can we support MPEG encoding? (https://www.matroska.org/technical/codec_specs.html#:~:text=Initialization%3A%20none-,V_MPEG2,-Codec%20ID%3A%20V_MPEG2)
      throw new Error(`Unsupported webM codec ${codec}`);
    };
    const audioCodecMapper = (
      codec: ContainerEncoderConfig["audio"]["codec"],
    ) => {
      if (codec === "opus") {
        return "A_OPUS";
      }

      if (codec === "vorbis") {
        return "A_VORBIS";
      }

      throw new Error(`Unsupported webM audio codec ${codec}`);
    };
    let muxer: WebMMuxer<WebMStreamTarget>;

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

    muxer = new WebMMuxer({
      ...(config.video
        ? {
            video: {
              height: config.video.height,
              width: config.video.width,
              frameRate: config.video.framerate,
              alpha:
                config.video.alpha !== "discard" || Boolean(config.video.alpha),
              codec: videoCodecMapper(config.video.codec),
            },
          }
        : {}),
      ...(config.audio
        ? {
            audio: {
              codec: audioCodecMapper(config.audio.codec), // TODO: Perform mapping
              numberOfChannels: config.audio.numberOfChannels,
              sampleRate: config.audio.sampleRate,
            },
          }
        : {}),
      firstTimestampBehavior: "offset",
      type: "matroska",
      streaming: config.streaming,
      target: new WebMStreamTarget({
        onData: (data, position) => {
          this.queue(
            new MFXBlob([data], {
              type: "video/webm",
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
