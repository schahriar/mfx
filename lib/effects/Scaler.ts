import { ExtendedVideoFrame } from "../frame";
import { MFXTransformStream } from "../stream";

/**
 * @group Effects
 * @note Use visual.scale and visual.crop in effect pipelines for most cases, this is intended for downsampling on CPU
 */
export class Scaler extends MFXTransformStream<
  ExtendedVideoFrame,
  ExtendedVideoFrame
> {
  get identifier() {
    return "Scaler";
  }

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
          new VideoFrame(canvas, {
            displayHeight: height,
            displayWidth: width,
            timestamp: frame.timestamp,
            duration: frame.duration,
          }),
        );
      },
    });
  }
}
