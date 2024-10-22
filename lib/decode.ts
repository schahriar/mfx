import { next, nextTask, nextTick } from "./utils";
import MP4Box, { type MP4ArrayBuffer } from "mp4box";
import { type ContainerContext, ExtendedVideoFrame } from "./frame";
import { MFXBufferCopy, MFXTransformStream, MFXWritableStream } from "./stream";
import JsWebm from "jswebm";
import { vp9 } from "./codec/vp9";

/**
 * @group Decode
 */
export interface MFXDecodableChunk {
	context: ContainerContext;
	config: VideoDecoderConfig;
	chunk: EncodedVideoChunk;
}

/**
 * Only use in a worker, alternatively utilize MFXWorkerVideoEncoder in a main thread video pipeline
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
		let containerContext: ContainerContext;
		let configured = false;

		let lastFrame: VideoFrame;

		const processFrame = (
			frame?: VideoFrame,
		): ExtendedVideoFrame | undefined => {
			let newFrame: ExtendedVideoFrame | undefined;
			if (lastFrame) {
				const current = lastFrame;
				newFrame = ExtendedVideoFrame.revise(current, current as any, {
					// Ensure duration is always available after decoding
					duration: frame?.timestamp
						? frame.timestamp - current.timestamp
						: current.timestamp,
				});
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
				transform: async (chunk) => {
					if (!configured) {
						decoder.configure({
							hardwareAcceleration: "prefer-hardware",
							optimizeForLatency: false,
							...config,
							...chunk.config,
						});
						configured = true;
					}

					// Prevent forward backpressure
					await backpressure;

					// Prevent backwards backpressure
					while (decoder.decodeQueueSize > 10) {
						await nextTick();
					}

					containerContext = chunk.context;

					decoder.decode(chunk.chunk);
				},
				flush: async (controller) => {
					await decoder.flush();
					const frame = processFrame();
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

/**
 * @group Decode
 */
export const createContainerDecoder = async (
	stream: ReadableStream<Uint8Array>,
	filename: string,
	codec?: string,
): Promise<ReadableStream<MFXDecodableChunk>> => {
	const ext = filename.slice(filename.lastIndexOf("."));
	let root = stream;
	let decoder: MFXTransformStream<Uint8Array, MFXDecodableChunk>;
	if (ext === ".webm") {
		if (!codec) {
			const probe = new MFXWebMVideoContainerProbe();
			const s1 = new TransformStream();
			const s2 = new TransformStream();
			const copier = new MFXBufferCopy(s1.writable, s2.writable);
			stream.pipeTo(copier);
			s1.readable.pipeTo(probe);
			root = s2.readable;

			codec = await probe.getCodec();
		}

		decoder = new MFXWebMVideoContainerDecoder(codec);
	} else {
		decoder = new MFXMP4VideoContainerDecoder();
	}

	return root.pipeThrough(decoder);
};

/**
 * Probes codec information about a WebM container
 * @group Decode
 */
export class MFXWebMVideoContainerProbe extends MFXWritableStream<Uint8Array> {
	get identifier() {
		return "MFXWebMVideoContainerProbe";
	}

	// Returns codec string after container is fully processed
	async getCodec(): Promise<string> {
		return new Promise((resolve, reject) => {
			this.addEventListener("codec", (ev: CustomEvent) =>
				resolve(ev.detail.codec as string),
			);

			this.addEventListener("error", (ev: CustomEvent) =>
				reject(ev.detail.error as string),
			);
		});
	}

	constructor() {
		const demuxer = new JsWebm();

		super(
			{
				write: async (chunk) => {
					demuxer.queueData(chunk.buffer);
				},
				close: async () => {
					let idx = 0;
					let size = 0;

					while (!demuxer.eof) {
						await demuxer.demux();
						await next(0);

						while (idx < demuxer.videoPackets.length) {
							const packet = demuxer.videoPackets[idx];
							size += packet.data.byteLength;
							idx++;
						}
					}

					this.dispatchEvent(
						new CustomEvent("codec", {
							detail: {
								codec: {
									V_VP9: vp9.autoSelectCodec({
										width: demuxer.videoTrack.width,
										height: demuxer.videoTrack.height,
										bitDepth: 8, // TODO: calculate bit depth
										bitrate: (size * 8) / demuxer?.duration, // Bitrate is assigned after all video tracks are read
									}),
									V_VP8: "vp8",
								}[demuxer.videoTrack.codecID],
								codedHeight: demuxer.videoTrack.height,
								codedWidth: demuxer.videoTrack.width,
							},
						}),
					);
				},
			},
			new CountQueuingStrategy({
				highWaterMark: Infinity,
			}),
		);
	}
}

/**
 * @group Decode
 */
export class MFXWebMVideoContainerDecoder extends MFXTransformStream<
	Uint8Array,
	MFXDecodableChunk
> {
	get identifier() {
		return "MFXWebMVideoContainerDecoder";
	}

	constructor(codec: string) {
		const demuxer = new JsWebm();

		super({
			transform: async (chunk) => {
				demuxer.queueData(chunk.buffer);
			},
			flush: async () => {
				while (!demuxer.videoTrack && !demuxer.eof) {
					await demuxer.demux();
				}
				let idx = 0;

				const context = {
					duration: demuxer?.segmentInfo?.duration,
					createdAt: new Date(0),
				};

				const config = {
					codec,
					codedHeight: demuxer.videoTrack.height,
					codedWidth: demuxer.videoTrack.width,
				};

				while (!demuxer.eof) {
					await demuxer.demux();
					await next(0);

					while (idx < demuxer.videoPackets.length) {
						const packet = demuxer.videoPackets[idx];
						const decodableChunk: MFXDecodableChunk = {
							config,
							context,
							chunk: new EncodedVideoChunk({
								type: idx === 0 || packet.isKeyframe ? "key" : "delta",
								timestamp: packet.timestamp * demuxer.segmentInfo.timecodeScale,
								data: packet.data,
								transfer: [packet.data],
							}),
						};
						this.queue(decodableChunk);
						idx++;
					}
				}
			},
		});
	}
}

/**
 * @group Decode
 */
export class MFXMP4VideoContainerDecoder extends MFXTransformStream<
	Uint8Array,
	MFXDecodableChunk
> {
	get identifier() {
		return "MFXMP4VideoContainerDecoder";
	}

	constructor() {
		const file = MP4Box.createFile();
		let position = 0;
		let context: ContainerContext;

		let setConfig: (config: VideoDecoderConfig) => void = () => {};
		const ready = new Promise<VideoDecoderConfig>((resolve) => {
			setConfig = resolve;
		});

		super({
			transform: async (chunk) => {
				const buffer = chunk.buffer as MP4ArrayBuffer;
				buffer.fileStart = position;
				position += buffer.byteLength;
				file.appendBuffer(buffer);
			},
			flush: async () => {
				await ready;
				file.flush();
			},
		});

		file.onError = (err) => this.dispatchError(new Error(err));
		file.onSamples = async (id, user, samples) => {
			const config = await ready;
			this.queue(
				...samples.map<MFXDecodableChunk>((sample) => ({
					config,
					context,
					chunk: new EncodedVideoChunk({
						type: sample.is_sync ? "key" : "delta",
						timestamp: (1e6 * sample.cts) / sample.timescale,
						duration: (1e6 * sample.duration) / sample.timescale,
						data: sample.data.buffer,
						transfer: [sample.data.buffer],
					}),
				})),
			);
		};
		file.onReady = (info) => {
			this.dispatchEvent(
				new CustomEvent("ready", {
					detail: info,
				}),
			);

			context = {
				duration: info.duration,
				createdAt: info.created,
			};

			// TODO: Support multiple video tracks?
			const videoTrack = info.videoTracks[0];

			const track = file.getTrackById(videoTrack.id);
			let description = new Uint8Array();
			for (const entry of track.mdia.minf.stbl.stsd.entries) {
				const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
				if (box) {
					const stream = new MP4Box.DataStream(
						undefined,
						0,
						MP4Box.DataStream.BIG_ENDIAN,
					);
					box.write(stream);
					description = new Uint8Array(stream.buffer, 8);
				}
			}

			setConfig({
				codec: videoTrack.codec.startsWith("vp08") ? "vp8" : videoTrack.codec,
				codedHeight: videoTrack.video.height,
				codedWidth: videoTrack.video.width,
				description,
			});

			file.setExtractionOptions(videoTrack.id);
			file.start();
		};
	}
}
