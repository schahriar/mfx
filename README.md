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
- Compositor texture masks
- Wrap VideoFrame to provide shared downsampled video
  - Total video duration
  - Pipeline-assigned frame metadata
- Trim
- Clips view (similar to QuickTime)
- Audio support
  - Audio waveform
  - Audio effects
- Seek
- Reduce CPU → GPU → CPU copy times using texture atlas
- Multi-track support
- Integrate debugger using [Spector](https://github.com/BabylonJS/Spector.js?tab=readme-ov-file#use-as-a-script-reference)

##### Disclaimer on Sample Videos
Some test videos are sourced from `coverr.co` yet they are only used for testing and will not be built into the `MFX` package.
These videos are under a permissive license (https://coverr.co/license).
