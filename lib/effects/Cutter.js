import { ExtendedVideoFrame } from "../frame";
import { MFXFrameSampler } from "../sampler";
/**
 * @group Effects
 */
export class MFXCutter extends MFXFrameSampler {
    get identifier() {
        return "MFXCutter";
    }
    constructor({ start, end, }) {
        super(async (frame) => {
            const time = frame.timestamp / 1000;
            return time >= start && time < end;
        }, {
            transform: (frame) => {
                const duration = (end - start) * 1000;
                return ExtendedVideoFrame.cut(frame, duration);
            },
            closer: true,
        });
    }
}
