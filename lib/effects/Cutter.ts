import { cloneFrame, ExtendedVideoFrame } from "../frame";
import { Sampler } from "../sampler";

/**
 * @group Effects
 */
export class Cutter extends Sampler<ExtendedVideoFrame> {
  get identifier() {
    return "Cutter";
  }

  constructor({
    start,
    end,
  }: {
    // Inclusive number of milliseconds to start cutting from (supports for microsecond fractions)
    start: number;
    // Exclusive number of milliseconds to cut to (supports for microsecond fractions)
    end: number;
  }) {
    super(
      async (frame) => {
        const time = frame.timestamp / 1000;
        return time >= start && time < end;
      },
      {
        transform: (frame) => {
          const clone: VideoFrame = cloneFrame(frame);

          return clone;
        },
        closer: true,
      },
    );
  }
}
