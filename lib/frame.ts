export interface ContainerContext {
	duration: number;
	createdAt?: Date;
	// TODO: Support seek
}

export class ExtendedVideoFrame extends VideoFrame {
	containerContext?: ContainerContext;
	constructor(source: CanvasImageSource, init?: VideoFrameInit) {
		super(source, init);
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
