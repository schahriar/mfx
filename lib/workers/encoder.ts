import type { MFXEncodedVideoChunk } from "../encode";
import type { ExtendedVideoFrame } from "../frame";
import { ForwardedStream } from "../worker";

/**
 * Use MFXVideoEncoder variant if running the entire pipeline in a worker
 * @group Encode
 */
export class MFXWorkerVideoEncoder extends ForwardedStream<
	ExtendedVideoFrame,
	MFXEncodedVideoChunk
> {
	get identifier() {
		return "MFXWorkerVideoEncoder";
	}

	constructor(config: VideoEncoderConfig) {
		const worker = new Worker(
			/* webpackChunkName: "encoder-worker" */ new URL(
				"./encoder.worker.ts",
				import.meta.url,
			),
		);

		worker.postMessage({ config });

		super("MFXWorkerVideoEncoder", worker, {
			transfer: (frame) => [frame],
		});
	}
}
