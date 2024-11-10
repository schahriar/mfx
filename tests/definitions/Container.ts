import { encode } from "../../lib/encode";
import type { TestDefinition } from "../types";

export const definitions: TestDefinition[] = [{
  id: "multimedia_webm",
  title: "MultiMedia WebM Decoding",
  description: "Decodes/encodes WebM audio/video",
  path: "/mm_webm_decode",
  input: "BeachWithAudio.webm",
  codec: "vp09.00.40.08,opus",
  process: async () => {
    return []
  },
  output: async (v, a) => {
    return encode({
      mimeType: `video/webm; codecs="vp09.00.40.08,opus"`,
      video: {
        stream: v,
        width: 640 * 3,
        height: 360 * 3,
        bitrate: 1e6 * 3,
      },
      ...a ? {
        audio: {
          stream: a,
          codec: "opus",
          numberOfChannels: 2,
          sampleRate: 48000,
        }
      } : {}
    });
  }
}];
