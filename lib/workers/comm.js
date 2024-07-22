export const accept = (target) => {
    return new Promise((resolve, reject) => {
        target.addEventListener("error", reject, { once: true });
        target.addEventListener("message", (ev) => {
            resolve(ev.data);
            target.removeEventListener("error", reject);
        }, { once: true });
    });
};
export class StreamCloser extends WritableStream {
    constructor({ transfarable = false } = {}) {
        super({
            write: (chunk) => {
                self.postMessage(chunk, {
                    transfer: transfarable ? [chunk] : [],
                });
            },
        });
    }
}
export const useStream = () => {
    return new ReadableStream({
        start: () => {
            self.postMessage(["ready"]);
        },
        pull: async (controller) => {
            const [type, chunk] = await accept(self);
            if (type === "transform") {
                controller.enqueue(chunk);
            }
            else if (type === "flush") {
                controller.close();
            }
        },
    });
};
