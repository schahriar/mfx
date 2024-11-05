import type { MFXEncodedChunk } from "../encode";
import type { ExtendedVideoFrame } from "../frame";
import { ForwardedStream } from "../worker";

/**
 * @example
 */
export class MFXWorkerVideoEncoder extends ForwardedStream<
  ExtendedVideoFrame,
  MFXEncodedChunk
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
