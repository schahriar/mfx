import { next, nextTask, nextTick } from "./mfx";
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
 * @group Decode
 */
export class MFXVideoDecoder extends MFXTransformStream<
	MFXDecodableChunk,
	ExtendedVideoFrame
> {
	get identifier() {
		return "MFXVideoDecoder";
	}

	constructor() {
		let backpressure = Promise.resolve();
		let configured = false;
		const decoder = new VideoDecoder({
			output: async (frame) => {
				backpressure = this.queue(frame);
			},
			error: (e) => {
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

					decoder.decode(chunk.chunk);
				},
				flush: async () => {
					await decoder.flush();
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
): Promise<ReadableStream<MFXDecodableChunk>> => {
	const ext = filename.slice(filename.lastIndexOf("."));
	let root = stream;
	let decoder: MFXTransformStream<Uint8Array, MFXDecodableChunk>;
	if (ext === ".webm") {
		const probe = new MFXWebMVideoContainerProbe();
		const s1 = new TransformStream();
		const s2 = new TransformStream();
		const copier = new MFXBufferCopy(s1.writable, s2.writable);
		stream.pipeTo(copier);
		s1.readable.pipeTo(probe);
		root = s2.readable;

		const codec = await probe.getCodec();

		decoder = new MFXWebMVideoContainerDecoder(codec);
	} else {
		decoder = new MFXMP4VideoContainerDecoder();
	}

	return root.pipeThrough(decoder);
};

export class MFXWebMVideoContainerProbe extends MFXWritableStream<Uint8Array> {
	get identifier() {
		return "MFXWebMVideoContainerProbe";
	}

	async getCodec(): Promise<string> {
		return new Promise((resolve) => {
			this.addEventListener("codec", (ev: CustomEvent) =>
				resolve(ev.detail.codec as string),
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
					await demuxer.demux();
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

					console.log({
						size,
						bitrate: (size * 8) / demuxer.duration,
						duration: demuxer.duration,
					});
					this.dispatchEvent(
						new CustomEvent("codec", {
							detail: {
								codec: {
									V_VP9: vp9.autoSelectCodec({
										width: demuxer.videoTrack.width,
										height: demuxer.videoTrack.height,
										bitDepth: 8, // TODO: calculate bit depth
										bitrate: (size * 8) / demuxer.duration, // Bitrate is assigned after all video tracks are read
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
				await demuxer.demux();
				let idx = 0;

				const context = {
					duration: demuxer?.duration,
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
