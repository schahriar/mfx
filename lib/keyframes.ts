import { type UniformProducer } from "./effects/shaders";
import { ExtendedVideoFrame } from "./frame";
import { MFXTransformStream } from "./stream";
import { easing as tsEasing } from "ts-easing";
import parseTime from 'parse-duration';

export class FrameRateAdjuster extends MFXTransformStream<
  ExtendedVideoFrame,
  ExtendedVideoFrame
> {
  get identifier() {
    return "FrameRateAdjuster";
  }

  constructor(fps: number) {
    // Limit to 500fps to prevent bugs
    const maxDuration = (1 / Math.min(fps, 500)) * 1e6;
    let borrowedDuration = 0;

    super({
      transform: (frame, controller) => {
        const duration = frame.duration;
        const idealFrameCount = Math.floor(duration / maxDuration);

        // Simple path, no need for a fill
        if (idealFrameCount == 1) {
          controller.enqueue(frame);
          return;
        }

        if (idealFrameCount < 1) {
          // Skip this frame and store the duration
          borrowedDuration += frame.duration;
          return;
        }

        // Calculate the durations ensuring no fractional durations
        const baseDuration = Math.floor(duration / idealFrameCount);
        const remainingDuration = duration % idealFrameCount;
        const timestamp = frame.timestamp;

        let accumulatedDuration = 0;
        for (let i = 0; i < idealFrameCount; i++) {
          const frameDuration =
            i === idealFrameCount - 1
              ? baseDuration + remainingDuration
              : baseDuration;

          const clone = ExtendedVideoFrame.revise(frame, frame.clone() as any, {
            timestamp: timestamp + accumulatedDuration,
            duration: baseDuration + borrowedDuration,
          });

          // Reset borrowedDuration as it is consumed in the new frame's duration
          borrowedDuration = 0;

          accumulatedDuration += frameDuration;

          controller.enqueue(clone);
        }

        frame.close();
      },
    });
  }
}

/**
 * 
 * @group Advanced
 * @example animate("0s 100, 0.5s 200", "elastic");
 */
export const animate = (value: string, easing: string | ((number) => (number)) = (v) => v) => {
  const steps = value.split(",");

  const parsedSteps = steps.map((step) => {
    const [time, value] = step.trim().split(" ");

    return {
      time: parseTime(time),
      value: JSON.parse(value.trim()),
    };
  });

  return keyframes(parsedSteps, typeof easing === "function" ? easing : tsEasing[easing]);
};

/**
 * @group Advanced
 */
export const keyframes = <T>(
  defs: {
    time: number;
    easing?: (number) => number;
    value: T;
  }[],
  easing: (number) => number = (v) => v,
): UniformProducer<T> => {
  return async (frame) => {
    const ts = frame.timestamp / 1000;
    const idx = defs.findIndex((_, i) => {
      const nextTime = defs[i + 1]?.time || Infinity;
      return ts < nextTime;
    });

    const windowStart = defs[idx];
    const windowEnd = defs[idx + 1] || windowStart;

    // Fractional / relative value
    if (typeof windowStart.value === "number") {
      const pos = ts - windowStart.time;
      const duration = windowEnd.time - windowStart.time;
      const ease = windowStart.easing || easing || ((v) => v);

      if (duration <= 0) {
        return windowEnd.value;
      }

      const delta = ease(pos / duration);
      const diff = (windowEnd.value as number) - (windowStart.value as number);
      const value = ((windowStart.value as number) + diff * delta) as T;

      return value;
    }

    // Absolute value
    return windowStart.value;
  };
};
