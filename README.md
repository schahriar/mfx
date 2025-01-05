<img src="./Logo.png" width="100">

## MFX
In-browser video editing using WebCodecs, WebStreams, and WebGL
→ [mfxlib.com](https://mfxlib.com)

----

## Usage
Decode MP4 Video -> zoom out -> encode to WebM keeping original Audio (vp8):
```javascript
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
  visual.zoom({ factor: 0.5, x: 0.5, y: 0.25 })
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

// Alternatively you can pipeTo a fetch POST request
await fetch("example.com/save", {
  method: "POST",
  body: outputStream
});
```

## Support Table
While `codec` support heavily depends on the browser, `mfx` aims to provide support for the following container / codec pairs:

| Container | Codec       | Encode / Decode |
| --------  | ---------   | --------------- 
| MP4       | H.264/AVC   | Both            |
| MP4       | H.265/HEVC  | Decode          |
| MP4       | VP8         | Both            |
| MP4       | VP9         | Both            |
| WebM      | VP8         | Both            |
| WebM      | VP9         | Both            |
| <hr> | **`Audio`** | <hr>
| MP4       | Opus        | Both            |
| MP4       | AAC         | Both            |
| WebM      | Opus        | Both            |
| WebM      | Vorbis      | Both            |

## Roadmap

### Soon
- Fix Audio trimming to include subframes
- GIF codec
  - encode: https://github.com/jnordberg/gif.js
- Regional effects
- GIF decoder
  - decode: https://github.com/mattdesl/gifenc (or ImageDecoder)
- Optimization Pipeline
  - Frame delta GPU pipeline
    - To remove duplicated or near-identical frames based on controllable parameters
    - Auto-quantization based on frame hints
  - RGB -> YUV conversion for better compatibility and output size
  - Multi-pass adaptive bitrate
  - Frame rate pinning to auto-adjust timestamps
    - Optionally disable VFR
  - Temporal Noise Reduction
- API Documentation
  - Add note on VP9 probe
- Testing: Source videos with frame duration > fps to showcase frameRate
- Run tests on Github actions
- Contribution Guide

### Later
- Decode WebM via Matroska decoder to resolve issues of jswebm dependency (https://www.npmjs.com/package/ebml-stream), alternatively build libwebm for WebAssembly https://github.com/webmproject/libwebm/tree/main/webm_parser (e.g. https://github.com/ForeverSc/web-demuxer/blob/main/lib/web-demuxer/web_demuxer.cpp)
  - https://github.com/GoogleChromeLabs/webm-wasm/tree/master
- Utilize (https://github.com/dmnsgn/media-codecs?tab=readme-ov-file) for codec string generation
- Canvas frame generator
  - Add threejs demo
- SVG → Image → Frame animated pipeline
- Audio effect support
  - Audio waveform
- Color Grading
  - HSV support
  - Palette detection / Adjustment
  - Mask: Alpha/Green-screen
- Audio Containers (mp3, flac, wav, opus)
- Improve encoding performance by reverting fill behavior for nearly identical frames (high effort)
- Seek
  - Clips view (similar to QuickTime)
- Per frame quantizer
- Log WebCodec bug (https://chromium.googlesource.com/chromium/src/+/7786d34a4e7771725b85f354247ad1bb1902c556/third_party/blink/renderer/modules/webcodecs/video_encoder.cc#939)
- Reduce CPU → GPU → CPU copy times using texture atlas
- Benchmarks (during test) against ffmpeg (AVC https://trac.ffmpeg.org/wiki/Encode/H.264#FAQ and possibly WebM)
- Integrate GLSL debugger using [Spector](https://github.com/BabylonJS/Spector.js?tab=readme-ov-file#use-as-a-script-reference)

----

## Contributing
Install git-lfs to pull sample files:
```
brew install git-lfs
```

```
npm install
npm start
```
----

### License
MIT [License](LICENSE)

##### Disclaimer on Sample Videos
Some test videos are sourced from `coverr.co` yet they are only used for testing and will not be built into the `MFX` package.
These videos are under a permissive license (https://coverr.co/license).
