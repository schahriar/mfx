import { ForwardedStream } from "../worker";
/**
 * Use MFXVideoEncoder variant if running the entire pipeline in a worker
 * @group Encode
 */
export class MFXWorkerVideoEncoder extends ForwardedStream {
    get identifier() {
        return "MFXWorkerVideoEncoder";
    }
    constructor(config) {
        const worker = new Worker(
        /* webpackChunkName: "encoder-worker" */ new URL("./encoder.worker.ts", import.meta.url));
        worker.postMessage({ config });
        super("MFXWorkerVideoEncoder", worker, {
            transfer: (frame) => [frame],
        });
    }
}
