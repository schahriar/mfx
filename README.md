<img src="./Logo.png" width="100">

## MFX
In-browser video editing toolkit
→ [mfxlib.com](https://mfxlib.com)

----

## Usage
Decode MP4 Video -> zoom out -> encode to WebM (vp8):
```javascript
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
  codec: "vp8",
  width: 640,
  height: 360,
  bitrate: 1e6,
  framerate: 30,
};

// Create video pipeline
video.body
  .pipeThrough(new MFXMP4VideoContainerDecoder(filename))
  .pipeThrough(new MFXVideoDecoder())
  .pipeThrough(new MFXGLEffect([ // Apply zoom out effect
    shaders.zoom({ factor: 0.5, x: 0.5, y: 0.25 }),
  ]))
  .pipeThrough(new MFXVideoEncoder(output))
  .pipeThrough(new MFXWebMMuxer(output)) // Returns a Blob type that can be piped to a backend if needed
  .pipeTo(new MFXFileWriter("output.webm")) // Opens a save dialog in the browser

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

### Roadmap
- API Documentation
- Run tests on Github actions
- Contribution Guide
- Compositor texture alpha masks
  - Blend mode and opacity as compositor functions
- Canvas frame generator
  - Add threejs demo
- Audio support
  - Audio waveform
  - Audio effects
- Seek
  - Clips view (similar to QuickTime)
- GIF (https://github.com/jnordberg/gif.js)
- Reduce CPU → GPU → CPU copy times using texture atlas
- Benchmarks (during test) against ffmpeg (AVC https://trac.ffmpeg.org/wiki/Encode/H.264#FAQ and possibly WebM)
- Integrate debugger using [Spector](https://github.com/BabylonJS/Spector.js?tab=readme-ov-file#use-as-a-script-reference)

##### Disclaimer on Sample Videos
Some test videos are sourced from `coverr.co` yet they are only used for testing and will not be built into the `MFX` package.
These videos are under a permissive license (https://coverr.co/license).
