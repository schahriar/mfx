import MP4Box, { type MP4ArrayBuffer } from "mp4box";
import { ConsoleWritableStream } from "./debug";
import { MFXTransformStream } from "./stream";
import { WebGLRenderer } from "./renderers/WebGLRenderer";

export { Scaler } from "./renderers/Scaler";
export { PaintToCanvas } from "./renderers/Draw";

export const nextTask = () => new Promise((resolve) => queueMicrotask(resolve as any));
export const nextAnimationFrame = () => new Promise((resolve) => requestAnimationFrame(resolve as any));

export class MFXFrameVoid extends WritableStream<VideoFrame> {
  constructor() {
    super({
      write: (frame) => {
        frame.close();
      }
    })
  }
}

export class MFXVideoEncoder extends MFXTransformStream<VideoFrame, EncodedVideoChunk> {
  constructor(config: VideoEncoderConfig) {
    let backpressure = Promise.resolve();
    const encoder = new VideoEncoder({
      output: async (chunk) => {
        backpressure = this.queue(chunk);
      },
      error: (e) => {
        this.dispatchError(e)
      }
    });

    encoder.configure(config);

    super({
      transform: async (frame) => {
        // Prevent forward backpressure
        await backpressure;

        // Prevent backwards backpressure
        if (encoder.encodeQueueSize > 5) {
          await nextAnimationFrame();
        }

        encoder.encode(frame);
      },
      flush: async () => {
        await encoder.flush();
        encoder.close();
      },
    })
  }
}

export class MFXVideoDecoder extends MFXTransformStream<MFXDecodableChunk, VideoFrame> {
  constructor() {
    let backpressure = Promise.resolve();
    let configured = false;
    const decoder = new VideoDecoder({
      output: async (frame) => {
        backpressure = this.queue(frame);
      },
      error: (e) => {
        this.dispatchError(e)
      }
    });

    super({
      transform: async (chunk) => {
        if (!configured) {
          decoder.configure(chunk.config);
          configured = true;
        }

        // Prevent forward backpressure
        await backpressure;

        // Prevent backwards backpressure
        if (decoder.decodeQueueSize > 5) {
          await nextAnimationFrame();
        }

        decoder.decode(chunk.chunk);
      },
      flush: async () => {
        await decoder.flush();
        decoder.close();
      },
    });
  }
}

interface MFXDecodableChunk {
  config: VideoDecoderConfig;
  chunk: EncodedVideoChunk;
}

export class MFXVideoContainerDecoder extends MFXTransformStream<Uint8Array, MFXDecodableChunk> {
  constructor() {
    const file = MP4Box.createFile();
    let position = 0;

    let setConfig: (config: VideoDecoderConfig) => void = () => {};
    const ready = new Promise<VideoDecoderConfig>((resolve) => {
      setConfig = resolve;
    });

    super({
      transform: async (chunk) => {
        const buffer = chunk.buffer as MP4ArrayBuffer;
        buffer.fileStart = position;
        position += buffer.byteLength;
        file.appendBuffer(buffer);
      },
      flush: async () => {
        await ready;
        file.flush();
      }
    });

    file.onError = (err) => this.dispatchError(new Error(err));
    file.onSamples = async (id, user, samples) => {
      const config = await ready;
      this.queue(...samples.map<MFXDecodableChunk>((sample) => ({
        config,
        chunk: new EncodedVideoChunk({
          type: sample.is_sync ? "key" : "delta",
          timestamp: 1e6 * sample.cts / sample.timescale,
          duration: 1e6 * sample.duration / sample.timescale,
          data: sample.data
        }),
      })));
    };
    file.onReady = (info) => {
      this.dispatchEvent(new CustomEvent("ready", {
        detail: info
      }));

      // TODO: Support multiple video tracks?
      const videoTrack = info.videoTracks[0];

      const track = file.getTrackById(videoTrack.id);
      let description = new Uint8Array();
      for (const entry of track.mdia.minf.stbl.stsd.entries) {
        const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
        if (box) {
          const stream = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN);
          box.write(stream);
          description = new Uint8Array(stream.buffer, 8);
        }
      }

      setConfig({
        codec: videoTrack.codec.startsWith('vp08') ? 'vp8' : videoTrack.codec,
        codedHeight: videoTrack.video.height,
        codedWidth: videoTrack.video.width,
        description,
      });

      file.setExtractionOptions(videoTrack.id);
      file.start();
    };
  }
}

export {
  ConsoleWritableStream,
  WebGLRenderer
}

export default {};
