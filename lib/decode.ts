import { next, nextTask, nextTick } from "./utils";
import MP4Box, { type MP4ArrayBuffer } from "mp4box";
import { type ContainerContext, ExtendedVideoFrame } from "./frame";
import { MFXBufferCopy, MFXTransformStream, MFXWritableStream } from "./stream";
import { TrackStream } from "./stream/TrackStream";
import JsWebm from "jswebm";
import { vp9 } from "./codec/vp9";
import MIMEType from "whatwg-mimetype";
import { MP4ContainerDecoder } from "./container/mp4/MP4ContainerDecoder";
import { ContainerDecoder, type MFXDecodableTrackChunk, MFXTrackType, type MFXTrack } from "./container/ContainerDecoder";
import { WebMContainerDecoder } from "./container/webM/WebMContainerDecoder";
import type { MFXEncodedChunk } from "./encode";

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
};

/**
 * @group Decode
 */
export const decode = async (input: ReadableStream<Uint8Array>, mimeType: string) => {
	let streams: TrackStream<MFXDecodableChunk>[] = [];
	const mime = new MIMEType(mimeType);

	let decoder: ContainerDecoder<any>;

	if (mime.subtype === "mp4") {
		decoder = new MP4ContainerDecoder();
	} else if (mime.subtype === "webm" || mime.subtype === "x-matroska") {
		decoder = new WebMContainerDecoder(mimeType)
	}

	if (!decoder) {
		throw new Error(`No decoder was found for mimeType: ${mimeType}`);
	}

	const splitter = new WritableStream<MFXDecodableTrackChunk<any>>({
		write: (chunk) => {
			const track = chunk.track;
			const stream = streams.find((s) => s.track.id === track.id);
			const writer = stream.writable.getWriter();

			chunk.samples.forEach((sample) => {
				if (track.type === MFXTrackType.Video) {
					writer.write({
						[MFXTrackType.Video ? "video" : "audio"]: {
							config: track.config,
							chunk: track.toChunk(sample)
						},
					})
				}

			});
			writer.releaseLock();
		}
	});

	input.pipeThrough(decoder).pipeTo(splitter);
	streams = (await decoder.tracks).map((track) => new TrackStream(track));

	const videoTracks = streams.filter((stream) => stream.track.type === MFXTrackType.Video);
	const audioTracks = streams.filter((stream) => stream.track.type === MFXTrackType.Audio);

	return {
		// Convinience properties, first track of each type in container
		video: videoTracks?.[0],
		audio: audioTracks?.[0],

		videoTracks,
		audioTracks
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
							...audio.config as AudioDecoderConfig,
							...config
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
};

const calculateDuration = (a: VideoFrame, b: VideoFrame) => {
	return b?.timestamp
		? b.timestamp - a.timestamp
		: 0;
}

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
				let duration = isLastFrame ? Math.max((context.duration * 1e3) - last.timestamp, 0) : calculateDuration(last, frame);

				const discard = () => {
					last = frame;
					duration = calculateDuration(frame, frameStack[2]);
					frameStack = [frame, frameStack[2]];
				};
				// TODO: Filter out frames with timecodes outside of container start/end
				const isOutOfBound = frame && (frame.timestamp < 0 || (Number.isInteger(context?.duration) && context.duration > 0 && frame.timestamp > context?.duration * 1e3));

				if (isOutOfBound) {
					console.warn("Discarding out of bound frame, MFX is not currently able to handle out of bound frames", { discarded: frame });
					return null;
				}

				if (duration <= 0) {
					// Last frame is out of order, discard
					console.warn("Discarding out of order frame, MFX is not currently able to handle out of order frames", {
						discarded: lastFrame
					});
					// TODO: Add option to debug by emitting bad frames as an event to be inspected in a Canvas
					discard();
				}

				newFrame = ExtendedVideoFrame.revise(last, last as any, {
					// Ensure duration is always available after decoding
					duration: Math.max(duration, 0),
				});

				frameStack.unshift(newFrame)
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
							context,
							video: {
								chunk: new EncodedVideoChunk({
									type: idx === 0 || packet.isKeyframe ? "key" : "delta",
									timestamp: packet.timestamp * demuxer.segmentInfo.timecodeScale,
									data: packet.data,
									transfer: [packet.data],
								}),
								config
							}
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
 * @deprecated
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

		let setConfig: (config: VideoDecoderConfig) => void = () => { };
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
				...samples.map<MFXDecodableChunk>((sample): MFXDecodableChunk => ({
					context,
					video: {
						config,
						chunk: new EncodedVideoChunk({
							type: sample.is_sync ? "key" : "delta",
							timestamp: (1e6 * sample.cts) / sample.timescale,
							duration: (1e6 * sample.duration) / sample.timescale,
							data: sample.data.buffer,
							transfer: [sample.data.buffer],
						}),
					}
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
