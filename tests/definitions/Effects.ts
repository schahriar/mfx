import { convolution3x3, Scaler, shaders } from "mfx";
import { MFXWebGLRenderer } from "../../lib/effects/WebGLRenderer";
import type { TestDefinition } from "../types";

export const definitions: TestDefinition[] = [{
  id: "effect_zoom",
  title: "Zoom",
  description: "Zoom at a scale into a video coordinate",
  path: "/zoom",
  input: "AI.mp4",
  process: async () => [
    new MFXWebGLRenderer([{
      shader: shaders.zoom,
      uniforms: {
        zoomFactor: 2,
        position: [0.1, 0.5]
      }
    }])
  ]
}, {
  id: "effect_blur",
  title: "Blur",
  description: "Blur video using fast gaussian and convolution",
  path: "/blur",
  input: "boats.mp4",
  process: async () => [
    new Scaler(0.2),
    new MFXWebGLRenderer([{
      shader: shaders.blur,
    }, {
      shader: shaders.convolution,
      uniforms: {
        kernel: convolution3x3.gaussianBlur
      }
    }, {
      shader: shaders.blur,
    }, , {
      shader: shaders.blur,
    }]),
    new Scaler(5),
  ]
}];
