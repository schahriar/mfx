---
sidebar_position: 1
---

# Introduction
MFX library allows for video decoding and encoding within the browser.

This includes:
- Full decoding and encoding of Video frames as native buffers
- Video pipeline via Web Streams
- GPU effects

### Fundamentals
The building block of MFX are [WebStreams](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API). Video files can be read from a [`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/Response/body) readable stream and piped into a decoder to get the raw frames.

The frames themselves then are manipulated via "effects" applied through GPU shaders (via WebGL) and can be re-encoded in the original or other video formats.
