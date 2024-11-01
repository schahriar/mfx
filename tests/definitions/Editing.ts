import { MFXCutter, MFXVideoEncoder, MFXMP4Muxer, codecs, MFXGLEffect, shaders, keyframes } from "mfx";
import { easing } from "ts-easing";
import { MFXFrameFiller } from "../../lib/keyframes";
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

    return [
      new MFXVideoEncoder(config),
      new MFXMP4Muxer(config)
    ];
  }
}, {
  id: "editing_keyframes",
  title: "Keyframes",
  description: "Keyframes animating values",
  path: "/keyframes",
  input: "beach.webm",
  process: async () => [
    new MFXFrameFiller(30),
    new MFXGLEffect([
      shaders.zoom({
        factor: keyframes([{
          time: 0,
          value: 1
        }, {
          time: 5000,
          value: 2
        }, {
          time: 10000,
          value: 1
        }], easing.inOutSine),
        x: 0.5,
        y: keyframes([{
          time: 0,
          value: 0
        }, {
          time: 5000,
          value: 0
        }, {
          time: 15000,
          value: 0.5
        }], easing.inOutSine)
      }),
    ])
  ],
  output: async () => {
    const config = {
      codec: codecs.avc.generateCodecString("baseline", "5.0"),
      width: 640 * 3,
      height: 360 * 3,
      bitrate: 1e6 * 4,
    };

    return [
      new MFXVideoEncoder(config),
      new MFXMP4Muxer(config)
    ];
  }
}];
