import { ExtendedVideoFrame } from "../frame";
import { MFXFrameSampler } from "../sampler";

export class MFXCutter extends MFXFrameSampler {
  get identifier() {
    return "MFXCutter";
  }

  constructor({ start, end }: {
    // Inclusive number of milliseconds to start cutting from (supports for microsecond fractions)
    start: number;
    // Exclusive number of milliseconds to cut to (supports for microsecond fractions)
    end: number;
  }) {
    super(async (frame) => {
      const time = frame.timestamp / 1000;
      return time >= start && time < end;
    }, {
      transform: (frame) => {
        const duration = (end - start) * 1000;
        return ExtendedVideoFrame.cut(frame, duration);
      },
      closer: true
    });
  }
};
