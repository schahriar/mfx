import { RingBuffer } from "ring-buffer-ts";
import { MFXTransformStream } from "./stream";
import { ExtendedVideoFrame } from "./frame";
/**
 * @group Debug
 */
export class ConsoleWritableStream {
    writable;
    constructor(id) {
        let size = 0;
        let length = 0;
        this.writable = new WritableStream({
            write(chunk) {
                console.log("id", chunk);
                length++;
                size +=
                    chunk?.byteLength ||
                        chunk.size ||
                        chunk?.length;
            },
            close() {
                console.log(`Stream ${id} closed: Read ${length} chunks at total of ${size} bytes`);
            },
            abort(err) {
                console.error("Stream ${id} aborted:", err);
            },
        });
    }
}
// Expensive function, sample frames before piping for digest
/**
 * @group Debug
 */
export class MFXDigest extends MFXTransformStream {
    get identifier() {
        return "MFXDigest";
    }
    globalChecksum = "";
    constructor(cb, final = () => {
        /** noop */
    }) {
        const calculateChecksum = async (buffer) => {
            const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
            return Array.from(new Uint8Array(hashBuffer))
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");
        };
        let value = "";
        super({
            transform: async (chunk, controller) => {
                let buffer;
                if (Array.isArray(chunk) && chunk[0] instanceof Uint8Array) {
                    buffer = chunk[0];
                }
                else if (chunk instanceof ExtendedVideoFrame ||
                    chunk instanceof VideoFrame) {
                    buffer = new Uint8Array(chunk.allocationSize());
                    await chunk.copyTo(buffer);
                }
                else if (chunk instanceof Blob) {
                    buffer = new Uint8Array(await chunk.arrayBuffer());
                }
                else {
                    buffer = new Uint8Array(chunk.videoChunk.byteLength);
                    await chunk.videoChunk.copyTo(buffer);
                }
                const checksum = await calculateChecksum(buffer);
                const combinedSum = new TextEncoder().encode(`${value}_${checksum}`);
                value = await calculateChecksum(combinedSum);
                if (typeof cb === "function") {
                    cb(value);
                }
                this.globalChecksum = value;
                controller.enqueue(chunk);
            },
            flush: () => {
                final(value);
            },
        });
    }
}
/**
 * @group Debug
 */
export class MFXFPSDebugger extends MFXTransformStream {
    get identifier() {
        return "MFXFPSDebugger";
    }
    ringBuffer;
    lookupWindow;
    lastRecordedTime = performance.now();
    constructor(lookupWindow = 30) {
        super({
            transform: async (frame, controller) => {
                this.ringBuffer.add(performance.now() - this.lastRecordedTime);
                this.lastRecordedTime = performance.now();
                controller.enqueue(frame);
            },
        });
        this.lookupWindow = lookupWindow;
        this.ringBuffer = new RingBuffer(lookupWindow);
    }
    getFPS() {
        return (1000 /
            (this.ringBuffer.toArray().reduce((a, b) => a + b, 0) /
                this.ringBuffer.getBufferLength()));
    }
}
