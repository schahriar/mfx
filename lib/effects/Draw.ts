export class PaintToCanvas extends WritableStream<VideoFrame> {
	constructor(canvas: HTMLCanvasElement) {
		const ctx = canvas.getContext("2d");

		super({
			write: async (frame) => {
				const width = frame.displayWidth;
				const height = frame.displayHeight;
				canvas.width = width;
				canvas.height = height;

				ctx.drawImage(frame, 0, 0, width, height);

				// Free resource after paint
				frame.close();
			},
		});
	}
}
