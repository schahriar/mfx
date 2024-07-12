import { MFXCutter, MFXVideoEncoder, MFXMP4Muxer, codecs } from "mfx";
import type { TestDefinition } from "../types";

export const definitions: TestDefinition[] = [{
  id: "editing_cut",
  title: "Cutting",
  description: "Cut videos at specific points",
  path: "/cut",
  input: "boats.mp4",
  process: async () => [
    new MFXCutter({
      start: 1000, // Start at 1 second
      end: 2000, // End at 2 seconds
    })
  ],
  output: async () => {
    const config = {
      codec: codecs.avc.generateCodecString("baseline", "5.0"),
      width: 640,
      height: 360,
      bitrate: 1e6,
    };

    const output = new MFXMP4Muxer(config);

    await output.ready;

    return [
      new MFXVideoEncoder(config),
      output
    ];
  }
}];
