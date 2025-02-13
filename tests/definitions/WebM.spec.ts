import {
  codecs,
  effect,
  encode,
  visual,
} from "mfx";
import type { TestDefinition } from "../types";

// Note that this is used for bitrate as well but bitrate doesn't scale linearly
// this behavior is ok for tests
const scaleFactor = 3;

export const definitions: TestDefinition[] = [{
  id: "webm_decoding",
  title: "WebM Decoding",
  description: "Decodes WebM file",
  input: "beach.webm",
  codec: "vp09.02.41.08",
  output: async (s) => {
    return encode({
      mimeType: `video/mp4; codecs="${codecs.avc.generateCodecString("baseline", "5.0")}"`,
      streaming: true,
      video: {
        stream: s,
        width: 640 * scaleFactor,
        height: 360 * scaleFactor,
        bitrate: 1e6 * scaleFactor,
      }
    });
  }
}, {
  id: "webm_codec",
  title: "WebM Codec",
  description: "Coding / Decoding WebM file",
  input: "beach.webm",
  output: async (s) => {
    return encode({
      mimeType: `video/webm; codecs="vp9"`,
      streaming: true,
      video: {
        stream: s,
        width: 640 * scaleFactor,
        height: 360 * scaleFactor,
        bitrate: 1e6 * scaleFactor,
      }
    });
  }
},  {
  id: "webm_codec_ooo",
  title: "WebM Codec Out of Order frames",
  description: "Coding / Decoding WebM file with out of order frames",
  input: "BeachWithAudio.webm",
  output: async (s) => {
    return encode({
      streaming: true,
      mimeType: `video/webm; codecs="vp9"`,
      video: {
        stream: s,
        width: 640 * scaleFactor,
        height: 360 * scaleFactor,
        bitrate: 1e6 * scaleFactor,
      }
    });
  }
}, {
  id: "webm_codec_10bit",
  title: "WebM Codec 10Bit",
  description: "Coding / Decoding 10Bit WebM file",
  input: "beach10bit.webm",
  expect: async () => {
    return true;
  },
  output: async (s) => {
    return encode({
      streaming: true,
      mimeType: `video/webm; codecs="vp9"`,
      video: {
        stream: s,
        width: 640 * scaleFactor,
        height: 360 * scaleFactor,
        bitrate: 1e6 * scaleFactor,
      }
    });
  }
}, {
  id: "webm_encoding",
  title: "WebM Encoding",
  description: "Converts sample mp4 file to WebM encoding",
  input: "AI.mp4",
  process: (stream) => effect(stream, [
    visual.emboss()
  ]),
  output: async (s) => {
    return encode({
      streaming: true,
      mimeType: `video/webm; codecs="vp8"`,
      video: {
        stream: s,
        width: 640,
        height: 360,
        bitrate: 1e6,
      }
    });
  }
}];
