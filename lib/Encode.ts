import { Muxer as WebMMuxer, StreamTarget as WebMStreamTarget } from "webm-muxer";
import { type MFXEncodedVideoChunk } from "./mfx";
import { Muxer as MP4Muxer, StreamTarget as MP4StreamTarget } from 'mp4-muxer';
import { MFXTransformStream } from "./stream";

/**
 * @group Encode
 */
export class MFXMediaSourceStream extends WritableStream<MFXBlob> {
	mediaSource: MediaSource;
	sourcePromise: Promise<void>;

	constructor() {
		const mediaSource = new MediaSource();
		const source = new Promise<void>((resolve) => {
			mediaSource.addEventListener("sourceopen", () => resolve());
		});
		let sourceBuffer: SourceBuffer;

		super({
			write: async (chunk) => {
				await source;
				if (typeof chunk.getMimeType !== "function") {
					throw new Error("Invalid stream piped to MFXMediaSourceStream, expected MFXBlob as chunks");
				}

				if (!sourceBuffer) {
					if (!MediaSource.isTypeSupported(chunk.getMimeType())) {
						throw new Error(`Unsupported mime type piped to MFXMediaSourceStream ${chunk.getMimeType()}`);
					}
					sourceBuffer = mediaSource.addSourceBuffer(chunk.getMimeType());
				}

				const arrayBuffer = await chunk.arrayBuffer();
				sourceBuffer.appendBuffer(arrayBuffer);

				await new Promise(resolve => sourceBuffer.addEventListener("updateend", resolve, { once: true }));
			},
			close: () => {
				mediaSource.endOfStream();
			},
		});

		this.mediaSource = mediaSource;
		this.sourcePromise = source;
	}

	getSource() {
		console.log("get source", (this.mediaSource))
		return URL.createObjectURL(this.mediaSource);
	}
};

/**
 * @group Encode
 */
export class MFXFileWriter extends WritableStream<MFXBlob> {
	writer: Promise<FileSystemWritableFileStream>;
	constructor(fileName: string, description = "Video File") {
		super({
			write: async (blob) => {
				const writer = await this.writer;
				if (Number.isInteger(blob.position)) {
					await writer.seek(blob.position);
				}

				await writer.write(blob);
			}
		});

		// TODO: Read one chunk to determine type before initializing saver
		this.writer = (async () => {
			const fileHandle = await window.showSaveFilePicker({
				suggestedName: fileName,
				startIn: "videos",
				types: [
					{
						description,
						accept: { "video/webm": [".webm"] },
					},
				],
			});

			return await fileHandle.createWritable();
		})();
	}
};

/** @group Stream */
export class MFXBlob extends Blob {
	position?: number;
	videoEncodingConfig: VideoEncoderConfig;
	constructor(parts: BlobPart[], opt: BlobPropertyBag & {
		position?: number;
		videoEncodingConfig: VideoEncoderConfig;
	}) {
		super(parts, opt);
		this.position = opt.position;
		this.videoEncodingConfig = opt.videoEncodingConfig;
	}

	getMimeType() {
		return `${this.type}; codecs="${this.videoEncodingConfig.codec}"`;
	}
};

/**
 * @group Encode
 */
export class MFXMP4Muxer extends MFXTransformStream<MFXEncodedVideoChunk, MFXBlob> {
	get identifier() {
		return "MFXMP4Muxer";
	}

	ready: Promise<any>;
	constructor(
		config: VideoEncoderConfig,
		chunkSize?: number,
	) {
		const codecMapper = (codec: VideoEncoderConfig["codec"]): ("avc" | "hevc" | "vp9" | "av1") => {
			const targets: ("avc" | "hevc" | "vp9" | "av1")[] = ["avc", "hevc", "vp9", "av1"];
			for (let i = 0; i < targets.length; i++) {
				if (codec.startsWith(targets[i])) {
					return targets[i];
				}
			}

			throw new Error(`Unsupported MP4 codec ${codec}`);
		};
		let muxer: MP4Muxer<MP4StreamTarget>;

		super({
			transform: async (encodedVideoChunk) => {
				muxer.addVideoChunk(
					encodedVideoChunk.videoChunk,
					encodedVideoChunk.videoMetadata,
				);
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
					this.queue(new MFXBlob([data], {
						type: "video/mp4",
						position,
						videoEncodingConfig: config
					}));
				},
				...Number.isInteger(chunkSize) ? {
					chunked: true,
					chunkSize
				} : {},
			}),
		})
	}
}

/**
 * @group Encode
 */
export class MFXWebMMuxer extends MFXTransformStream<MFXEncodedVideoChunk, MFXBlob> {
	get identifier() {
		return "MFXWebMMuxer";
	}

	ready: Promise<any>;
	constructor(
		config: VideoEncoderConfig,
		chunkSize?: number,
	) {
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
			transform: async (encodedVideoChunk) => {
				muxer.addVideoChunk(
					encodedVideoChunk.videoChunk,
					encodedVideoChunk.videoMetadata,
				);
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
				codec: codecMapper(config.codec)
			},
			firstTimestampBehavior: "offset",
			type: "matroska",
			streaming: true,
			target: new WebMStreamTarget({
				onData: (data, position) => {
					this.queue(new MFXBlob([data], {
						type: "video/webm",
						position,
						videoEncodingConfig: config
					}));
				},
				...Number.isInteger(chunkSize) ? {
					chunked: true,
					chunkSize
				} : {},
			}),
		});
	}
}
