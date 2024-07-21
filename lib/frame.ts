import { nextTick } from "./utils";

export interface ContainerContext {
	duration: number;
	createdAt?: Date;
	// TODO: Support seek
}

export class ExtendedVideoFrame extends VideoFrame {
	containerContext?: ContainerContext;
	constructor(source: CanvasImageSource, init?: VideoFrameInit, container?: ContainerContext) {
		super(source, init);
		this.containerContext = container;
	}

	static cut(frame: ExtendedVideoFrame, duration: number) {
		const clone = frame.clone() as ExtendedVideoFrame;
		clone.containerContext = {
			duration,
			createdAt: new Date(),
		};

		return clone;
	}
}

export class MFXVideoSource extends ReadableStream<ExtendedVideoFrame> {
	constructor(source: HTMLVideoElement, { playbackRate = 3 } = {}) {
		let ended = false;
		let buffer = [];
		let handle = -1;
		const start = new Date();
		const callback = () => {
			buffer.push(new ExtendedVideoFrame(source, {
				timestamp: source.currentTime * 1e6,
				displayHeight: source.videoHeight,
				displayWidth: source.videoWidth,
			}, {
				duration: source.duration,
				createdAt: start
			}));
			handle = source.requestVideoFrameCallback(callback);
		};

		source.addEventListener("ended", () => {
			ended = true;
			source.cancelVideoFrameCallback(handle);
		}, { once: true });

		super({
			start: () => {
				source.playbackRate = playbackRate;
				handle = source.requestVideoFrameCallback(callback);
			},
			pull: async (controller) => {
				while (!ended && !buffer.length) {
					await nextTick(15);
				}

				if (ended) {
					return controller.close();
				}

				const frame = buffer.shift();
				controller.enqueue(frame);
			},
			cancel: () => {
				source.cancelVideoFrameCallback(handle);
			}
		});
	}
}
