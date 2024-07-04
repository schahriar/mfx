import { MFXTransformStream } from "./stream";

export class MFXFrameSampler extends MFXTransformStream<VideoFrame, VideoFrame> {
  get identifier() {
    return "MFXFrameSampler";
  }

  constructor(filter = (frame: VideoFrame, i: number) => Promise.resolve(true), { closer = true } = {}) {
    let i = 0;
    super({
      transform: async (chunk, controller) => {
        if (await filter(chunk, i)) {
          controller.enqueue(chunk);
        } else if (closer) {
          chunk.close();
        }

        i++;
      }
    })
  }
};
