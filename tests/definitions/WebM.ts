import { convolution3x3, MFXVideoEncoder, MFXGLEffect, MFXWebMMuxer, rawShaders, codecs, MFXMP4Muxer } from "mfx";
import type { TestDefinition } from "../types";

export const definitions: TestDefinition[] = [{
  id: "webm_decoding",
  title: "WebM Decoding",
  description: "Decodes WebM file",
  path: "/webm_decode",
  input: "beach.webm",
  process: async () => {
    return []
  },
  output: async () => {
    const config = {
      codec: codecs.avc.generateCodecString("baseline", "5.0"),
      width: 640 * 3,
      height: 360 * 3,
      bitrate: 1e6 * 3,
    };

    return [
      new MFXVideoEncoder(config),
      new MFXMP4Muxer(config)
    ];
  }
}, {
  id: "webm_encoding",
  title: "WebM Encoding",
  description: "Converts sample mp4 file to WebM encoding",
  path: "/webm",
  input: "AI.mp4",
  process: async () => {
    return [
      new MFXGLEffect([{
        shader: rawShaders.convolution,
        uniforms: {
          kernel: convolution3x3.emboss
        }
      }])
    ]
  },
  output: async () => {
    const config = {
      codec: "vp8",
      width: 640,
      height: 360,
      bitrate: 1e6,
    };

    return [
      new MFXVideoEncoder(config),
      new MFXWebMMuxer(config)
    ];
  }
}];
