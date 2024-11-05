import { ExtendedVideoFrame } from "./frame";
import { MFXTransformStream } from "./stream";

/**
 * @group Stream
 */
export class FrameSampler extends MFXTransformStream<
  ExtendedVideoFrame,
  ExtendedVideoFrame
> {
  get identifier() {
    return "FrameSampler";
  }

  constructor(
    filter = (frame: ExtendedVideoFrame, i: number) => Promise.resolve(true),
    {
      transform = (frame) => frame,
      closer = true,
    }: {
      transform?: (frame: ExtendedVideoFrame) => ExtendedVideoFrame;
      closer?: boolean;
    } = {},
  ) {
    let i = 0;
    super({
      transform: async (chunk, controller) => {
        if (await filter(chunk, i)) {
          controller.enqueue(transform(chunk));
        } else if (closer) {
          chunk.close();
        }

        i++;
      },
    });
  }
}
