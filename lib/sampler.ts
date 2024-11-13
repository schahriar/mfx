import { ExtendedVideoFrame } from "./frame";
import { MFXTransformStream } from "./stream";

/**
 * @group Stream
 */
export class Sampler<
  T = ExtendedVideoFrame | AudioData,
> extends MFXTransformStream<T, T> {
  get identifier() {
    return "Sampler";
  }

  constructor(
    filter = (_: T, _n: number) => Promise.resolve(true),
    {
      transform = (frame) => frame,
      closer = true,
    }: {
      transform?: (frame: T) => T;
      closer?: boolean;
    } = {},
  ) {
    let i = 0;
    super({
      transform: async (chunk, controller) => {
        if (await filter(chunk, i)) {
          controller.enqueue(transform(chunk));
        } else if (closer) {
          (chunk as AudioData | ExtendedVideoFrame)?.close();
        }

        i++;
      },
    });
  }
}
