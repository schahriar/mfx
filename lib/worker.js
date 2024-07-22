import { MFXTransformStream } from "./stream";
const accept = (target) => {
    return new Promise((resolve, reject) => {
        target.addEventListener("error", reject, { once: true });
        target.addEventListener("message", (ev) => {
            resolve(ev.data);
            target.removeEventListener("error", reject);
        }, { once: true });
    });
};
export class ForwardedStream extends MFXTransformStream {
    name;
    get identifier() {
        return `ForwardedStream(${this.name})`;
    }
    constructor(name, worker, { transfer = () => [], } = {}) {
        let resolver;
        let ready = new Promise((resolve) => {
            resolver = resolve;
        });
        super({
            start: async () => {
                const [type] = await accept(worker);
                if (type === "ready") {
                    resolver();
                }
            },
            transform: async (chunk, controller) => {
                // Wait until worker is listening
                await ready;
                worker.postMessage(["transform", chunk], transfer
                    ? {
                        transfer: transfer(chunk),
                    }
                    : {});
                const transformed = await accept(worker);
                controller.enqueue(transformed);
            },
            flush: async () => {
                worker.postMessage(["flush"]);
            },
        });
        this.name = name;
    }
}
