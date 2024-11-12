import { Cutter, codecs, GLEffect, shaders, keyframes, encode } from "mfx";
import { easing } from "ts-easing";
import type { TestDefinition } from "../types";

const scaleFactor = 3;

export const definitions: TestDefinition[] = [{
  id: "editing_cut",
  title: "Cutting",
  description: "Cut videos at specific points",
  path: "/cut",
  input: "boats.mp4",
  process: async () => [
    new Cutter({
      start: 1000, // Start at 1 second
      end: 2000, // End at 2 seconds
    })
  ],
  output: async (s) => {
    return encode({
      mimeType: `video/mp4; codecs="${codecs.avc.generateCodecString("baseline", "5.0")}"`,
      video: {
        stream: s,
        width: 640 * scaleFactor,
        height: 360 * scaleFactor,
        bitrate: 1e6 * scaleFactor,
      }
    });
  }
}, {
  id: "editing_keyframes",
  title: "Keyframes",
  description: "Keyframes animating values",
  path: "/keyframes",
  input: "beach.webm",
  decodeOptions: {
    frameRate: 30
  },
  process: async () => [
    new GLEffect([
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
  output: async (s) => {
    return encode({
      mimeType: `video/mp4; codecs="${codecs.avc.generateCodecString("baseline", "5.0")}"`,
      video: {
        stream: s,
        width: 640 * scaleFactor,
        height: 360 * scaleFactor,
        bitrate: 1e6 * scaleFactor,
      }
    });
  }
}];
