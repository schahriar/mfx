---
sidebar_position: 2
---

# Pipelines

A "pipeline" is a simple representation of streams of data that load → transform → store the video data.

## A complete pipeline

```js title="pipeline.js"
import {
  decode,
  encode,
  effect,
  visual,
  writeToFile,
} from "mfx";

// Files can be fetched locally
const file = await fetch("https://example.com/myvideo.mp4");

// Decode video container, returns each track as a WebStream
const { video, audio } = await decode(file, "video/mp4", {
  // Addresses Chromium WebCodecs bug, Set to true for HEVC or if "Can't readback frame textures" is thrown. Has ~10% performance impact.
  forceDecodeToSoftware: false,
});

// Hardware accelerated (WebGL2) effect pipeline
const videoOutput = effect(video, [
  // Apply zoom out effect
  visual.zoom({ factor: 0.5, x: 0.5, y: 0.25 }),
  visual.add(video2, {}),
]);

// Readable WebStream
const outputStream = encode({
  mimeType: `video/webm; codecs="vp8,opus"`, // Transcode to WebM VP8 (video) and Opus (audio)
  video: {
    ...video.track.config, // Inherit configuration from input video
    stream: videoOutput,
    width: 640,
    height: 360,
    bitrate: 1e6,
    framerate: 30,
  },
  audio: {
    ...audio.track.config, // Inherit configuration from input audio
    stream: audio
  }
});

// Opens a save dialog in the browser
await writeToFile(outputStream, "output.webm");
```


:::warning[Workers]
Pipelines can execute both on the main thread and in a worker context but it's highly recommended to run your entire video pipeline in a [WebWorker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers).

This is especially important as certain videos using unusual profiles of VP9 codec (e.g. 10bit video) may cause the process to crash in Chromium which is only safe if the pipeline is executed in a worker. 

`mfx` provides `MFXWorkerVideoEncoder` and `MFXWorkerVideoEncoder` transformers by default to alleviate this problem by offloading encoding/decoding parts of the pipeline to dedicated workers.
:::