import { MFXVideoEncoder, MFXWebMMuxer, shaders } from "mfx";
import { MFXWebGLRenderer } from "../../lib/effects/WebGLRenderer";
import type { TestDefinition } from "../types";

export const definitions: TestDefinition[] = [{
  title: "WebM Encoding",
  description: "Converts sample mp4 file to WebM encoding",
  path: "/webm",
  input: "bunny4k.mp4",
  output: async () => {
    const config = {
      codec: "vp8",
      width: 640,
      height: 360,
      bitrate: 1e6,
    };

    const output = new MFXWebMMuxer({
      codec: "V_VP8",
      width: 640,
      height: 360,
      frameRate: 30,
    });

    await output.ready;

    return [
      new MFXVideoEncoder(config),
      output
    ];
  }
}];
