import { type MFXEncodedChunk, MFXTransformStream, MFXBlob } from "mfx";
import {
	Muxer as WebMMuxer,
	StreamTarget as WebMStreamTarget,
} from "webm-muxer";

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
	constructor(config: VideoEncoderConfig, chunkSize?: number) {
		const codecMapper = (codec: VideoEncoderConfig["codec"]) => {
			if (codec.startsWith("vp08") || codec === "vp8") {
				return "V_VP8";
			}

			if (codec.startsWith("vp09") || codec === "vp9") {
				return "V_VP9";
			}

			// TODO: Can we support MPEG encoding? (https://www.matroska.org/technical/codec_specs.html#:~:text=Initialization%3A%20none-,V_MPEG2,-Codec%20ID%3A%20V_MPEG2)
			throw new Error(`Unsupported webM codec ${codec}`);
		};
		let muxer: WebMMuxer<WebMStreamTarget>;

		super({
			transform: async (chunk) => {
				// TODO: support raw chunks such as addAudioChunkRaw
				// to allow passthrough tracks
				if (chunk.video) {
					muxer.addVideoChunk(
						chunk.video.chunk,
						chunk.video.metadata,
					);
				}

				if (chunk.audio) {
					muxer.addAudioChunk(
						chunk.audio.chunk,
						chunk.audio.metadata,
					);
				}
			},
			flush: async () => {
				muxer.finalize();
			},
		});

		muxer = new WebMMuxer({
			video: {
				height: config.height,
				width: config.width,
				frameRate: config.framerate,
				alpha: config.alpha !== "discard" || Boolean(config.alpha),
				codec: codecMapper(config.codec),
			},
			firstTimestampBehavior: "offset",
			type: "matroska",
			streaming: true,
			target: new WebMStreamTarget({
				onData: (data, position) => {
					this.queue(
						new MFXBlob([data], {
							type: "video/webm",
							position,
							videoEncodingConfig: config,
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
