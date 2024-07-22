import { ExtendedVideoFrame } from "./frame";
import { next } from "./utils";
/**
 * @group Stream
 */
export class MFXWritableStream extends WritableStream {
    _eventTarget;
    constructor(underlyingSink, strategy = new CountQueuingStrategy({
        highWaterMark: 60,
    })) {
        super(underlyingSink, strategy);
        setTimeout(() => {
            console.info(`<defined:${this.identifier}>`);
        }, 0);
        this._eventTarget = new EventTarget();
    }
    dispatchEvent(event) {
        this._eventTarget.dispatchEvent(event);
    }
    dispatchError(error) {
        console.error(error);
        this._eventTarget.dispatchEvent(new CustomEvent("error", { detail: { error } }));
    }
    addEventListener(type, callback, options) {
        this._eventTarget.addEventListener(type, callback, options);
    }
    removeEventListener(type, callback, options) {
        this._eventTarget.removeEventListener(type, callback, options);
    }
}
/**
 * @group Stream
 */
export class MFXTransformStream extends TransformStream {
    _buffer;
    _eventTarget;
    _controller;
    constructor(transformer = {}, writableStrategy = new CountQueuingStrategy({
        highWaterMark: 60,
    }), readableStrategy = new CountQueuingStrategy({
        highWaterMark: 60,
    })) {
        let lastMetDesiredSize = Date.now();
        const streamMonitor = setInterval(() => {
            if (!this._controller)
                return;
            if (this._controller.desiredSize === 0) {
                if (lastMetDesiredSize < Date.now() - 10000) {
                    console.warn(`Stream clogged on pipe ${this.identifier}\n you might be missing .pipeTo(new MFXVoid()) at the end of your stream`);
                    lastMetDesiredSize = Date.now() + 30 * 60 * 1000; // Already reported, check in 30 seconds
                }
                return;
            }
            lastMetDesiredSize = Date.now();
        }, 1000);
        super({
            ...transformer,
            transform: async (chunk, controller) => {
                while (!controller?.desiredSize) {
                    await next();
                }
                await transformer.transform(chunk, controller);
                this._controller = controller;
                if (this._buffer.length) {
                    this._copy_buffer(controller);
                }
            },
            flush: async (controller) => {
                console.info(`<flushed:${this.identifier}>`);
                clearInterval(streamMonitor);
                this._controller = controller;
                if (this._buffer.length) {
                    this._copy_buffer(controller);
                }
                if (typeof transformer.flush === "function") {
                    await transformer.flush(controller);
                }
            },
        }, writableStrategy, readableStrategy);
        setTimeout(() => {
            console.info(`<defined:${this.identifier}>`);
        }, 0);
        this._buffer = [];
        this._eventTarget = new EventTarget();
    }
    _copy_buffer(controller) {
        while (this._buffer.length) {
            controller.enqueue(this._buffer.shift());
        }
    }
    queue(...items) {
        if (this._controller) {
            items.forEach((item) => this._controller.enqueue(item));
        }
        else {
            this._buffer.push(...items);
            this.dispatchEvent(new CustomEvent("queue"));
        }
        return new Promise(async (resolve) => {
            while (this._controller?.desiredSize <= 0) {
                await next();
            }
            resolve();
        });
    }
    dispatchEvent(event) {
        this._eventTarget.dispatchEvent(event);
    }
    dispatchError(error) {
        console.error(error);
        this._eventTarget.dispatchEvent(new CustomEvent("error", { detail: { error } }));
    }
    addEventListener(type, callback, options) {
        this._eventTarget.addEventListener(type, callback, options);
    }
    removeEventListener(type, callback, options) {
        this._eventTarget.removeEventListener(type, callback, options);
    }
}
/**
 * @group Stream
 */
export class MFXBufferCopy extends MFXWritableStream {
    get identifier() {
        return "MFXBufferCopy";
    }
    constructor(a, b) {
        super({
            write: async (chunk) => {
                const aw = a.getWriter();
                const bw = b.getWriter();
                aw.write(chunk);
                aw.releaseLock();
                bw.write(chunk);
                bw.releaseLock();
            },
            close: () => {
                a.close();
                b.close();
            },
        });
    }
}
/**
 * @group Stream
 */
export class MFXFrameTee extends MFXTransformStream {
    get identifier() {
        return "MFXFrameTee";
    }
    constructor(ctx) {
        const stream = new TransformStream();
        super({
            transform: async (chunk, controller) => {
                const clone = chunk.clone();
                const writer = stream.writable.getWriter();
                await writer.write(clone);
                writer.releaseLock();
                controller.enqueue(chunk);
            },
            flush: async () => {
                await stream.writable.close();
            },
        });
        ctx(stream.readable);
    }
}
/** @group Stream */
export class MFXVoid extends WritableStream {
    constructor() {
        super({
            write: (chunk) => {
                if (chunk instanceof ExtendedVideoFrame ||
                    chunk instanceof VideoFrame) {
                    chunk.close();
                }
            },
        });
    }
}
