import { codecs, keyframes, encode, effect, visual } from "mfx";
import { easing } from "ts-easing";
import type { TestDefinition } from "../types";

const scaleFactor = 3;

export const definitions: TestDefinition[] = [{
  id: "editing_cut",
  title: "Trimming",
  description: "Trim videos at specific points",
  input: "boats.mp4",
  decodeOptions: {
    trim: {
      start: 1000, // Start at 1 second
      end: 2000, // End at 2 seconds
    }
  },
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
  id: "editing_trim_with_audio",
  title: "Trimming with Audio",
  description: "Trim media at specific points",
  input: "BeachWithAudio.webm",
  codec: "vp09.00.40.08,opus",
  decodeOptions: {
    trim: {
      start: 1000, // Start at 1 second
      end: 4000, // End at 4 seconds
    }
  },
  output: async (v, a) => {
    return encode({
      mimeType: `video/mp4; codecs="${codecs.avc.generateCodecString("baseline", "5.0")},opus"`,
      video: {
        stream: v,
        width: 640 * scaleFactor,
        height: 360 * scaleFactor,
        bitrate: 1e6 * scaleFactor,
      },
      audio: {
        stream: a,
        numberOfChannels: 2,
        sampleRate: 48000,
      }
    });
  }
}, {
  id: "editing_keyframes",
  title: "Keyframes",
  description: "Keyframes animating values",
  input: "beach.webm",
  decodeOptions: {
    frameRate: 30
  },
  process: (stream) => effect(stream, [
    visual.zoom({
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
    })
  ]),
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
