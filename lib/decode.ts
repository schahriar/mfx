import { nextTick } from "./mfx";
import MP4Box, { type MP4ArrayBuffer } from "mp4box";
import { type ContainerContext, ExtendedVideoFrame } from "./frame";
import { MFXTransformStream } from "./stream";

export interface MFXDecodableChunk {
  context: ContainerContext;
  config: VideoDecoderConfig;
  chunk: EncodedVideoChunk;
}

export class MFXVideoDecoder extends MFXTransformStream<
  MFXDecodableChunk,
  ExtendedVideoFrame
> {
  get identifier() {
    return "MFXVideoDecoder";
  }

  constructor() {
    let backpressure = Promise.resolve();
    let configured = false;
    const decoder = new VideoDecoder({
      output: async (frame) => {
        backpressure = this.queue(frame);
      },
      error: (e) => {
        this.dispatchError(e);
      },
    });

    super({
      transform: async (chunk) => {
        if (!configured) {
          decoder.configure({
            hardwareAcceleration: "prefer-hardware",
            optimizeForLatency: false,
            ...chunk.config,
          });
          configured = true;
        }

        // Prevent forward backpressure
        await backpressure;

        // Prevent backwards backpressure
        while (decoder.decodeQueueSize > 10) {
          await nextTick();
        }

        decoder.decode(chunk.chunk);
      },
      flush: async () => {
        await decoder.flush();
        decoder.close();
      },
    }, new CountQueuingStrategy({
      highWaterMark: 10 // Input chunks (tuned for low memory usage)
    }), new CountQueuingStrategy({
      highWaterMark: 10 // Output frames (tuned for low memory usage)
    }));
  }
}

export const createContainerDecoder = (filename: string) => {
  const ext = filename.slice(filename.lastIndexOf("."));
  if (ext === ".webm") {
    throw new Error("Unsupported container format (webM)");
  }

  return new MFXMP4VideoContainerDecoder();
};

export class MFXMP4VideoContainerDecoder extends MFXTransformStream<
  Uint8Array,
  MFXDecodableChunk
> {
  get identifier() {
    return "MFXMP4VideoContainerDecoder";
  }

  constructor() {
    const file = MP4Box.createFile();
    let position = 0;
    let context: ContainerContext;

    let setConfig: (config: VideoDecoderConfig) => void = () => { };
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
      },
    });

    file.onError = (err) => this.dispatchError(new Error(err));
    file.onSamples = async (id, user, samples) => {
      const config = await ready;
      this.queue(
        ...samples.map<MFXDecodableChunk>((sample) => ({
          config,
          context,
          chunk: new EncodedVideoChunk({
            type: sample.is_sync ? "key" : "delta",
            timestamp: (1e6 * sample.cts) / sample.timescale,
            duration: (1e6 * sample.duration) / sample.timescale,
            data: sample.data.buffer,
            transfer: [sample.data.buffer],
          }),
        })),
      );
    };
    file.onReady = (info) => {
      this.dispatchEvent(
        new CustomEvent("ready", {
          detail: info,
        }),
      );

      context = {
        duration: info.duration,
        createdAt: info.created,
      };

      // TODO: Support multiple video tracks?
      const videoTrack = info.videoTracks[0];

      const track = file.getTrackById(videoTrack.id);
      let description = new Uint8Array();
      for (const entry of track.mdia.minf.stbl.stsd.entries) {
        const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
        if (box) {
          const stream = new MP4Box.DataStream(
            undefined,
            0,
            MP4Box.DataStream.BIG_ENDIAN,
          );
          box.write(stream);
          description = new Uint8Array(stream.buffer, 8);
        }
      }

      setConfig({
        codec: videoTrack.codec.startsWith("vp08") ? "vp8" : videoTrack.codec,
        codedHeight: videoTrack.video.height,
        codedWidth: videoTrack.video.width,
        description,
      });

      file.setExtractionOptions(videoTrack.id);
      file.start();
    };
  }
}