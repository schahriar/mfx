import { MFXTransformStream } from "./stream";
/**
 * @group Stream
 */
export class MFXFrameSampler extends MFXTransformStream {
    get identifier() {
        return "MFXFrameSampler";
    }
    constructor(filter = (frame, i) => Promise.resolve(true), { transform = (frame) => frame, closer = true, } = {}) {
        let i = 0;
        super({
            transform: async (chunk, controller) => {
                if (await filter(chunk, i)) {
                    controller.enqueue(transform(chunk));
                }
                else if (closer) {
                    chunk.close();
                }
                i++;
            },
        });
    }
}
