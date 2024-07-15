---
sidebar_position: 2
---

# Pipelines

A "pipeline" is a simple representation of streams of data that load → transform → store the video data.

## A complete pipeline

```js title="pipeline.js"
import {
  shaders,
  MFXMP4VideoContainerDecoder,
  MFXVideoDecoder,
  MFXGLEffect,
  MFXVideoEncoder,
  MFXWebMMuxer,
  MFXFileWriter,
} from "mfx";

const filename = "myvideo.mp4";
// Files can be fetched locally
const video = await fetch(`https://example.com/${filename}`);

const output = {
  // highlight-start
  // Codec string
  codec: "vp8",
  // highlight-end
  width: 640,
  height: 360,
  bitrate: 1e6,
  framerate: 30,
};

// Create video pipeline
video.body
  // highlight-start
  // Next two lines define the decoder
  .pipeThrough(new MFXMP4VideoContainerDecoder(filename))
  .pipeThrough(new MFXVideoDecoder())
  // highlight-end
  .pipeThrough(new MFXGLEffect([ // Apply zoom out effect
    shaders.zoom({ factor: 0.5, x: 0.5, y: 0.25 }),
  ]))
  // highlight-start
  // Next two lines define the encoder
  .pipeThrough(new MFXVideoEncoder(output))
  .pipeThrough(new MFXWebMMuxer(output)) // Returns a Blob type that can be piped to a backend if needed
  // highlight-end
  .pipeTo(new MFXFileWriter("output.webm")) // Opens a save dialog in the browser
```
