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
- Wrap VideoFrame to provide shared downsampled video
- Trim
- Reduce CPU → GPU → CPU copy times using texture atlas
- Multi-track support
- Audio support
  - Audio waveform
  - Audio effects
- Integrate debugger using [Spector](https://github.com/BabylonJS/Spector.js?tab=readme-ov-file#use-as-a-script-reference)

##### Disclaimer
Some test videos are sourced from `coverr.co`
