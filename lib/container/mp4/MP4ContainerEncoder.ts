import { Muxer as MP4Muxer, StreamTarget as MP4StreamTarget } from "mp4-muxer";
import { MFXBlob, type MFXEncodedChunk, MFXTransformStream } from "../../mfx";

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
	constructor(config: VideoEncoderConfig, chunkSize?: number) {
		const codecMapper = (
			codec: VideoEncoderConfig["codec"],
		): "avc" | "hevc" | "vp9" | "av1" => {
			const targets: ("avc" | "hevc" | "vp9" | "av1")[] = [
				"avc",
				"hevc",
				"vp9",
				"av1",
			];
			for (let i = 0; i < targets.length; i++) {
				if (codec.startsWith(targets[i])) {
					return targets[i];
				}
			}

			throw new Error(`Unsupported MP4 codec ${codec}`);
		};
		let muxer: MP4Muxer<MP4StreamTarget>;

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

		muxer = new MP4Muxer({
			video: {
				height: config.height,
				width: config.width,
				codec: codecMapper(config.codec),
			},
			firstTimestampBehavior: "offset",
			fastStart: "fragmented",
			target: new MP4StreamTarget({
				onData: (data, position) => {
					this.queue(
						new MFXBlob([data], {
							type: "video/mp4",
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
};
