import { ExtendedVideoFrame } from "../frame";
import { MFXTransformStream } from "../stream";

/**
 * @group Visualization
 */
export class PaintToCanvas extends WritableStream<ExtendedVideoFrame> {
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

/**
 * @group Visualization
 */
export class PassthroughCanvas extends MFXTransformStream<
  ExtendedVideoFrame,
  ExtendedVideoFrame
> {
  get identifier() {
    return "PassthroughCanvas";
  }

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");

    super({
      transform: async (frame, controller) => {
        const width = frame.displayWidth;
        const height = frame.displayHeight;
        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(frame, 0, 0, width, height);

        controller.enqueue(frame);
      },
    });
  }
}
