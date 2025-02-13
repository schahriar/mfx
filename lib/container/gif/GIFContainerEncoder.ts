import { Encoder } from "modern-gif";
import { MFXTransformStream } from "../../stream";
import { MFXBlob } from "../../blob";
import type { ContainerEncoderConfig } from "../encoderConfig";
import { ExtendedVideoFrame } from "../../frame";
import { FrameRateAdjuster } from "../../keyframes";

class GIFContainerEncoderStream extends MFXTransformStream<
  ExtendedVideoFrame,
  MFXBlob
> {
  get identifier() {
    return "GIFContainerEncoderStream";
  }

  buffer: ExtendedVideoFrame[] = [];

  constructor(config: ContainerEncoderConfig) {
    const width = config.video.width;
    const height = config.video.height;
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d", {
      willReadFrequently: true
    }) as any as CanvasRenderingContext2D;
    const encoder = new Encoder({ width, height });

    super({
      transform: async (chunk) => {
        ctx.drawImage(
          chunk,
          0,
          0,
          width,
          height
        );

        chunk.close();

        await encoder.encode(ctx.getImageData(0, 0, width, height));
      },
      flush: async (controller) => {
        const blobPart = await encoder.flush("blob");
        const blob = new MFXBlob([blobPart], {
          type: "image/gif",
          config,
        });

        controller.enqueue(blob);
      },
    });
  }
}

/**
 * @group Encode
 */
export class GIFContainerEncoder extends MFXTransformStream<
  ExtendedVideoFrame,
  MFXBlob
> {
  get identifier() {
    return "GIFContainerEncoder";
  }

  _readable: any;

  constructor(config: ContainerEncoderConfig) {
    const stream = new FrameRateAdjuster(config.video.framerate || 1);
    const readable = stream.readable.pipeThrough(new GIFContainerEncoderStream(config));

    const writer = stream.writable.getWriter();

    super({
      transform: async (chunk) => {
        writer.write(chunk);
      },
      flush: async () => {
        await writer.close();
        writer.releaseLock();
      },
    });

    this._readable = readable;
  }

  get readable() {
    return this._readable;
  }
}
