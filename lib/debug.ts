import { RingBuffer } from "ring-buffer-ts";
import { MFXTransformStream } from "./stream";

export class ConsoleWritableStream<T = any> {
	writable: WritableStream<T>;

	constructor(id: string) {
		let size = 0;
		let length = 0;

		this.writable = new WritableStream({
			write(chunk) {
				console.log("id", chunk);
				length++;
				size +=
					(chunk as ArrayBuffer)?.byteLength ||
					(chunk as any).size ||
					(chunk as string)?.length;
			},
			close() {
				console.log(
					`Stream ${id} closed: Read ${length} chunks at total of ${size} bytes`,
				);
			},
			abort(err) {
				console.error("Stream ${id} aborted:", err);
			},
		});
	}
}

export class MFXFPSDebugger extends MFXTransformStream<VideoFrame, VideoFrame> {
	ringBuffer: RingBuffer<number>;
	lookupWindow: number;
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
		this.ringBuffer = new RingBuffer<number>(lookupWindow);
	}

	getFPS() {
		return (
			1000 /
			(this.ringBuffer.toArray().reduce((a, b) => a + b, 0) /
				this.ringBuffer.getBufferLength())
		);
	}
}
