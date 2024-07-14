import { convolution3x3, MFXVideoEncoder, MFXGLEffect, MFXWebMMuxer, rawShaders } from "mfx";
import type { TestDefinition } from "../types";

export const definitions: TestDefinition[] = [{
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
