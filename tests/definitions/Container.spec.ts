import { codecs } from "mfx";
import { encode } from "../../lib/encode";
import type { TestDefinition } from "../types";

export const definitions: TestDefinition[] = [{
  id: "multimedia_webm",
  title: "MultiMedia WebM Decoding",
  description: "Decodes/encodes WebM audio/video",
  input: "BeachWithAudio.webm",
  codec: "vp09.00.40.08,opus",
  output: async (v, a) => {
    return encode({
      mimeType: `video/webm; codecs="vp09.00.40.08,opus"`,
      streaming: true,
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
}, {
  id: "multimedia_mp4",
  title: "MultiMedia MP4 Decoding",
  description: "Decodes/encodes MP4 audio/video",
  input: "HEVC4KWithAudio.mp4",
  decodeOptions: {
    forceDecodeToSoftware: true
  },
  output: async (v, a, vt) => {
    return encode({
      mimeType: `video/mp4; codecs="${codecs.avc.generateCodecString("baseline", "5.0")},opus"`,
      streaming: true,
      video: {
        stream: v,
        width: 640 * 4,
        height: 360 * 4,
        bitrate: 1e6 * 30,
      },
      audio: {
        stream: a,
        numberOfChannels: 2,
        sampleRate: 48000,
      }
    });
  }
}];
