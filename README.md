<img src="./Logo.png" width="100">

## MFX
In-browser video editing using WebCodec and WebGL
→ [mfxlib.com](https://mfxlib.com)

----

## Usage
Decode MP4 Video -> zoom out -> encode to WebM keeping original Audio (vp8):
```javascript
import {
  shaders,
  decode,
  encode,
  GLEffect,
  FileWriter,
} from "mfx";

// Files can be fetched locally
const file = await fetch("https://example.com/myvideo.mp4");

// Decode video container, returns each track as a WebStream
const { video, audio } = await decode(file, "video/mp4");

// Create video pipeline taking raw frames through Web Streams
const videoOutput = video.pipeThrough(new GLEffect([ // Apply zoom out effect
  shaders.zoom({ factor: 0.5, x: 0.5, y: 0.25 }),
]));

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
})

outputStream.pipeTo(new FileWriter("output.webm")); // Opens a save dialog in the browser
// Alternatively you can pipeTo a fetch POST request
```

## Contributing
Install git-lfs to pull sample files:
```
brew install git-lfs
```

```
npm install
npm start
```

## Roadmap

### Soon
- Compositor texture alpha masks
  - Blend mode and opacity as compositor functions
  - Dynamic layer counts using GLSL generation
  - `compose` function to quickly merge 
- GIF (https://github.com/jnordberg/gif.js)
- Add note on VP9 probe
- Testing: Source videos with frame duration > fps to showcase FrameFiller
- API Documentation
- Run tests on Github actions
- Contribution Guide

### Later
- Decode WebM via Matroska decoder to resolve issues of jswebm dependency (https://www.npmjs.com/package/ebml-stream), alternatively build libwebm for WebAssembly https://github.com/webmproject/libwebm/tree/main/webm_parser
- Utilize (https://github.com/dmnsgn/media-codecs?tab=readme-ov-file) for codec string generation
- Canvas frame generator
  - Add threejs demo
- Audio effect support
  - Audio waveform
- Audio Containers (mp3, flac, wav, opus)
- Improve encoding performance by reverting fill behavior for nearly identical frames (high effort)
- Seek
  - Clips view (similar to QuickTime)
- Log WebCodec bug (https://chromium.googlesource.com/chromium/src/+/7786d34a4e7771725b85f354247ad1bb1902c556/third_party/blink/renderer/modules/webcodecs/video_encoder.cc#939)
- Reduce CPU → GPU → CPU copy times using texture atlas
- Benchmarks (during test) against ffmpeg (AVC https://trac.ffmpeg.org/wiki/Encode/H.264#FAQ and possibly WebM)
- Integrate GLSL debugger using [Spector](https://github.com/BabylonJS/Spector.js?tab=readme-ov-file#use-as-a-script-reference)

### License
MIT [License](LICENSE)

##### Disclaimer on Sample Videos
Some test videos are sourced from `coverr.co` yet they are only used for testing and will not be built into the `MFX` package.
These videos are under a permissive license (https://coverr.co/license).
