import { MFXTransformStream } from "./stream";
import * as rawShaders from "./effects/shaders/raw";
import * as shaders from "./effects/shaders";
import { ExtendedVideoFrame } from "./frame";
import { avc } from "./codec/avc";

export * from "./convolution";
export { MFXGLEffect } from "./effects/GLEffect";
export { MFXCutter } from "./effects/Cutter";
export { Scaler } from "./effects/Scaler";
export { PaintToCanvas, PassthroughCanvas } from "./effects/Draw";
export { Compositor } from "./effects/Compositor";
export { MFXFrameSampler } from "./sampler";
export { MFXFPSDebugger, ConsoleWritableStream, MFXDigest } from "./debug";
export * from "./encode";
export * from "./decode";
export { MFXFrameTee, MFXTransformStream } from "./stream";
export { keyframes } from "./keyframes";
export { rawShaders, shaders };

export const codecs = {
	avc
};

export const nextTask = () =>
	new Promise((resolve) => queueMicrotask(resolve as any));
export const nextTick = () =>
	new Promise((resolve) => setTimeout(resolve as any, 1));
export const next = nextTick;

export class MFXVoid extends WritableStream<any> {
	constructor() {
		super({
			write: (chunk) => {
				if (chunk instanceof ExtendedVideoFrame || chunk instanceof VideoFrame) {
					chunk.close();
				}
			},
		});
	}
}

export interface MFXEncodedVideoChunk {
	videoChunk: EncodedVideoChunk;
	videoMetadata: EncodedVideoChunkMetadata;
};

export class MFXVideoEncoder extends MFXTransformStream<
	ExtendedVideoFrame,
	MFXEncodedVideoChunk
> {
	get identifier() {
		return "MFXVideoEncoder";
	}

	constructor(config: VideoEncoderConfig) {
		let backpressure = Promise.resolve();
		const encoder = new VideoEncoder({
			output: async (chunk, metadata) => {
				backpressure = this.queue({
					videoChunk: chunk,
					videoMetadata: metadata,
				});
			},
			error: (e) => {
				this.dispatchError(e);
			},
		});

		encoder.configure(config);

		super({
			transform: async (frame) => {
				// Prevent forward backpressure
				await backpressure;

				// Prevent backwards backpressure
				while (encoder.encodeQueueSize > 10) {
					await nextTick();
				}

				encoder.encode(frame, {
					keyFrame: frame.timestamp % (1e6 * 30) === 0, // Keyframe every 30 seconds for matroska
				});

				frame.close();
			},
			flush: async () => {
				await encoder.flush();
				encoder.close();
			},
		}, new CountQueuingStrategy({
			highWaterMark: 10 // Input chunks (tuned for low memory usage)
		}), new CountQueuingStrategy({
			highWaterMark: 10 // Input chunks (tuned for low memory usage)
		}));
	}
}

const createEncoder = (config: VideoEncoderConfig, fileName: string) => { };

export default {};
