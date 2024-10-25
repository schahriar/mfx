import React, { useState } from "react";
import ReactLiveScope from '@theme/ReactLiveScope';
import Playground from '@theme/Playground';
import * as MFX from "../../mfx/bundle";
import videoSource from "@site/static/4KWithAudio.mp4";

export default () => {
  const [source, setSource] = useState("https://github.com/schahriar/mfx/raw/refs/heads/main/samples/4KWithAudio.mp4");
  const {default: _, ...lib} = MFX;
  return (
    <div>
      <div className="input-container">
        <label>Source</label>
        <input value={source} onChange={(ev) => setSource(ev.target.value)}/>
      </div>
      <Playground
        language="jsx"
        metastring="noInline"
        scope={{...ReactLiveScope, ...lib}}
        transformCode={(code) => `
          const VideoPreview = () => {
            const [source, setSource] = useState("");
            const videoEl = useRef();
            useEffect(() => {
              (async () => {
                const videoIn = "${videoSource}";
                const videoOut = new MFXMediaSourceStream();
                setSource(videoOut.getSource());
                ${code};
              })();
            }, []);
          
            return (
              <video ref={videoEl} autoplay controls style={{ width: "100%" }} src={source}></video>
            );
          }
          
          render(<VideoPreview />);
        `}
        title="/src/components/HelloCodeTitle.js"
        showLineNumbers>
        {`
const video = await fetch(videoIn);

const output = {
  // Codec string
  codec: "vp8",
  width: 640,
  height: 360,
  bitrate: 1e6,
  framerate: 30,
};

// Create video pipeline
video.body
  // Next two lines define the decoder
  .pipeThrough(new MFXMP4VideoContainerDecoder())
  .pipeThrough(new MFXVideoDecoder())
  .pipeThrough(new MFXGLEffect([ // Apply zoom out effect
    shaders.zoom({ factor: 1.5, x: 0.5, y: 0.25 }),
  ]))
  // Next two lines define the encoder
  .pipeThrough(new MFXVideoEncoder(output))
  .pipeThrough(new MFXWebMMuxer(output)) // Returns a Blob type that can be piped to a backend if needed
  .pipeTo(videoOut)
        `}
      </Playground>
    </div>
  );
};
