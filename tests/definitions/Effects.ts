import { shaders } from "mfx";
import { MFXWebGLRenderer } from "../../lib/effects/WebGLRenderer";
import type { TestDefinition } from "../types";

export const definitions: TestDefinition[] = [{
  title: "Zoom",
  description: "Zoom at a scale into a video coordinate",
  path: "/zoom",
  input: "AI.mp4",
  process: async () => [
    new MFXWebGLRenderer([{
      shader: shaders.zoom,
      uniforms: {
        zoomFactor: 3
      }
    }])
  ]
}];
