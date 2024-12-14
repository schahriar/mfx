import { effect, visual } from "mfx";
import type { TestDefinition } from "../types";

export const definitions: TestDefinition[] = [{
  id: "effect_zoom",
  title: "Zoom",
  description: "Zoom at a scale into a video coordinate",
  path: "/zoom",
  input: "AI.mp4",
  process: (stream) => (
    effect(stream, [
      visual.zoom({ factor: 2, x: 0.5, y: 0.5 })
    ])
  )
}, {
  id: "effect_zoom_stacked",
  title: "Stacked Zoom Effects",
  description: "Zoom at a scale into a video coordinate",
  path: "/zoom_stacked",
  input: "AI.mp4",
  process: (stream) => effect(stream, [
    visual.zoom({ factor: 1.5, x: 0, y: 0 }),
    visual.zoom({ factor: 1.25, x: 0, y: 0 }),
  ]),
}, {
  id: "effect_zoom_out",
  title: "Zoom Out",
  description: "Zoom out adjusting the alpha channel on area out of zoom",
  path: "/zoom_out",
  input: "AI.mp4",
  process: (stream) => effect(stream, [
    visual.zoom({ factor: 0.5, x: 0.5, y: 0.25 })
  ])
}, {
  id: "effect_blur",
  title: "Blur",
  description: "Blur video using fast gaussian and convolution",
  path: "/blur",
  input: "boats.mp4",
  process: (stream) => effect(stream, [
    visual.blur({ passes: 5, quality: 0.1 })
  ])
}];
