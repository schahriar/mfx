import { MFXTransformStream } from "../stream";

// TODO: Implement x, y position for cropping

// Used for scaling in the same aspect-ratio or to crop
// Note: Faster than MipMaps per frame as in/out is downscaled in the entire pipeline
export class Scaler extends MFXTransformStream<VideoFrame, VideoFrame> {
	constructor(
		ratio: number,
		canvas: HTMLCanvasElement = document.createElement("canvas"),
	) {
		const ctx = canvas.getContext("2d");

		super({
			transform: async (frame, controller) => {
				// TODO: Preserve aspect-ratio instead of flooring
				const width = Math.floor(frame.displayWidth * ratio);
				const height = Math.floor(frame.displayHeight * ratio);
				canvas.width = width;
				canvas.height = height;

				// Results in less artifacts in Chrome
				ctx.imageSmoothingQuality = "medium";
				ctx.drawImage(frame, 0, 0, width, height);

				// Free resource after GPU draw
				frame.close();

				controller.enqueue(
					new VideoFrame(canvas, { timestamp: frame.timestamp }),
				);
			},
		});
	}
}
