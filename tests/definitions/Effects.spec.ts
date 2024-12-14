import { codecs, effect, encode, keyframes, visual } from "mfx";
import { easing } from "ts-easing";
import type { TestDefinition } from "../types";

const step = (v: number[], size = 2500) => v.map((s, i) => ({
  time: i * size,
  value: s
}))

const cornerXKeyframes = keyframes(step([
  0, 0, 1, 1, 0, 0, 1, 1
]), easing.inOutSine);

const cornerYKeyframes = keyframes(step([
  0, 0, 0, 0, 1, 1, 1, 1
]), easing.inOutSine);

export const definitions: TestDefinition[] = [{
  id: "effect_zoom",
  title: "Zoom",
  description: "Zoom at a scale into a video coordinate",
  input: "AI.mp4",
  process: (stream) => (
    effect(stream, [
      visual.zoom({ factor: 2, x: 0.5, y: 0.5 })
    ])
  )
}, {
  id: "effect_zoom_corners",
  title: "Zoom Corners",
  description: "Zoom into x/y corners",
  input: "beach.mp4",
  process: (stream) => (
    effect(stream, [
      visual.zoom({ factor: 3, x: cornerXKeyframes, y: cornerYKeyframes })
    ])
  ),
}, {
  id: "effect_zoom_stacked",
  title: "Stacked Zoom Effects",
  description: "Zoom at a scale into a video coordinate",
  input: "AI.mp4",
  process: (stream) => effect(stream, [
    visual.zoom({ factor: 1.5, x: 0, y: 0 }),
    visual.zoom({ factor: 1.25, x: 0, y: 0 }),
  ]),
}, {
  id: "effect_zoom_out",
  title: "Zoom Out",
  description: "Zoom out adjusting the alpha channel on area out of zoom",
  input: "AI.mp4",
  process: (stream) => effect(stream, [
    visual.zoom({ factor: 0.5, x: 0.5, y: 0.25 })
  ])
}, {
  id: "effect_blur",
  title: "Blur",
  description: "Blur video using fast gaussian and convolution",
  input: "boats.mp4",
  process: (stream) => effect(stream, [
    visual.blur({ passes: 8, quality: 0.5 })
  ])
}, {
  id: "effect_rotate",
  title: "Rotate",
  description: "Rotate transformation",
  input: "boats.mp4",
  process: (stream) => effect(stream, [
    visual.scale({ values: [1 / 1.5, 1 / 1.5, 1 / 1.5] }),
    visual.rotate({ angle: keyframes([{
      time: 0,
      value: 0
    }, {
      time: 12000,
      value: 720
    }], easing.linear), values: [1, 1, 1] }),
    visual.scale({ values: [1.5, 1.5, 1.5] }),
  ]),

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
    });
  }
}];
