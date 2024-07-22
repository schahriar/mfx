import { keyframes, MFXGLEffect, MFXVideoSource, shaders } from "mfx";
import { easing } from "ts-easing";
import type { TestDefinition } from "../types";

export const definitions: TestDefinition[] = [{
  id: "source_preview",
  title: "Video Source",
  description: "Sources frames from an HTMLVideoElement",
  path: "/source_preview",
  input: "boats.mp4",
  decode: async (input) => {
    const video = document.createElement("video");
    video.src = input;
    video.autoplay = true;
    video.muted = true;
    video.play();
    const stream = new MFXVideoSource(video);

    return stream;
  },
  process: async () => {
    return [
      new MFXGLEffect([
        shaders.zoom({
          factor: keyframes([{
            time: 0,
            value: 1
          }, {
            time: 5000,
            value: 20
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
    ]
  }
}];