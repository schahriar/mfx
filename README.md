# mfx
In-browser video editing toolkit


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
- Timeline for effects (keyframes)
- Easing for uniforms
- Compositor texture alpha masks
  - Blend mode and opacity as compositor functions
- API Documentation
- Contribution Guide
- Canvas frame generator
  - Add threejs demo
- Audio support
  - Audio waveform
  - Audio effects
- Seek
  - Clips view (similar to QuickTime)
- Reduce CPU → GPU → CPU copy times using texture atlas
- Benchmarks (during test) against ffmpeg (AVC https://trac.ffmpeg.org/wiki/Encode/H.264#FAQ and possibly WebM)
- Integrate debugger using [Spector](https://github.com/BabylonJS/Spector.js?tab=readme-ov-file#use-as-a-script-reference)

##### Disclaimer on Sample Videos
Some test videos are sourced from `coverr.co` yet they are only used for testing and will not be built into the `MFX` package.
These videos are under a permissive license (https://coverr.co/license).
