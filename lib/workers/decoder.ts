import type { MFXDecodableChunk } from "../decode";
import type { ExtendedVideoFrame } from "../frame";
import { ForwardedStream } from "../worker";

/**
 * @deprecated
 * Use MFXVideoDecoder variant if running the entire pipeline in a worker
 * @group Decode
 */
export class MFXWorkerVideoDecoder extends ForwardedStream<
	MFXDecodableChunk,
	ExtendedVideoFrame
> {
	get identifier() {
		return "MFXWorkerVideoDecoder";
	}

	constructor() {
		const worker = new Worker(
			/* webpackChunkName: "decoder-worker" */ new URL(
				"./decoder.worker.ts",
				import.meta.url,
			),
		);

		worker.postMessage({});

		super("MFXWorkerVideoDecoder", worker);
	}
}
