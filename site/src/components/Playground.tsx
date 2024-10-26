import React, { useMemo, useState } from "react";
import ReactLiveScope from "@theme/ReactLiveScope";
import Playground from "@theme/Playground";
import useLocalStorage from "react-use-localstorage";

import BrowserOnly from "@docusaurus/BrowserOnly";

const demoCode = `const video = await fetch(videoIn);

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
  .pipeThrough(new MFXFrameFiller(30)) // Fill to 30 fps
  .pipeThrough(new MFXGLEffect([ // Apply zoom out effect
    shaders.zoom({
      factor: keyframes([{
        time: 0,
        value: 1
      }, {
        time: 2000,
        value: 2
      }, {
        time: 10000,
        value: 1
      }]),
      x: 0.5,
      y: 0.5
    }),
  ]))
  // Next two lines define the encoder
  .pipeThrough(new MFXVideoEncoder(output))
  .pipeThrough(new MFXWebMMuxer(output)) // Returns a Blob type that can be piped to a backend if needed
  .pipeTo(videoOut)`;

const PlaygroundComponent = () => {
  const [code, setCode] = useLocalStorage("playground-code", demoCode);
  const [source, setSource] = useState(
    "https://mfxcdn.b-cdn.net/Serene.mp4"
  );

  const { default: _, ...lib } = window.MFX || {};

  return (
    <div>
      <div className="input-container">
        <label>Source</label>
        <input value={source} onChange={(ev) => setSource(ev.target.value)} />
      </div>
      <Playground
        language="jsx"
        metastring="noInline"
        scope={{ ...ReactLiveScope, ...lib }}
        transformCode={(code) => {
          setCode(code);
          return `
          const VideoPreview = () => {
            const [source, setSource] = useState("");
            const videoEl = useRef();
            useEffect(() => {
              (async () => {
                const videoIn = "${source}";
                const videoOut = new MFXMediaSourceStream();
                setSource(videoOut.getSource());
                ${code};
              })();
            }, []);
          
            return (
              <video ref={videoEl} autoPlay muted controls style={{ width: "100%" }} src={source}></video>
            );
          }
          
          render(<VideoPreview />);
        `;
        }}
        title="/src/components/HelloCodeTitle.js"
        showLineNumbers
      >
        {code}
      </Playground>
    </div>
  );
};

export default () => {
  return <BrowserOnly>{() => <PlaygroundComponent />}</BrowserOnly>;
};
