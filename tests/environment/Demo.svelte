<script lang="ts">
  import Dropzone from "svelte-file-dropzone";
  import { MFXWebGLRenderer, MFXWebMMuxer, MFXVideoDecoder, MFXMP4VideoContainerDecoder, Scaler, PaintToCanvas, Compositor, createContainerDecoder, MFXFPSDebugger, MFXVideoEncoder } from "mfx";
  import adjustmentShaderSource from "!!raw-loader!../lib/effects/shaders/adjustment.glsl";
  import zoomShaderSource from "!!raw-loader!../lib/effects/shaders/zoom.glsl";
  import convShaderSource from "!!raw-loader!../lib/effects/shaders/convolution.glsl";
  import blueShaderSource from "!!raw-loader!../lib/effects/shaders/blur.glsl";

  let canvasEl: HTMLCanvasElement;
  let fileOver = false;
  let file: File;
  let files: {
    accepted: File[];
  } = {
    accepted: [],
  };

  const handleFilesSelect = (e: any) => {
    fileOver = false;

    const { acceptedFiles } = e.detail;
    files.accepted = [...files.accepted, ...acceptedFiles];
  };

  const fpsCounter = new MFXFPSDebugger();

  const program1 = async (resolved) => {
    const pass1 = new MFXWebGLRenderer([...[...new Array(12)].map((_, i) => ({
      id: `blur_${i}`,
      shader: blueShaderSource,
    })), {
      shader: convShaderSource,
      uniforms: {
        kernel: [1, 2, 1, 2, 4, 2, 1, 2, 1].map((v) => v * 0.0625)
      }
    }]);

    const pass2 = new MFXWebGLRenderer([{
      shader: convShaderSource,
      uniforms: {
        kernel: [1, 2, 1, 2, 4, 2, 1, 2, 1].map((v) => v * 0.0625)
      }
    }, {
      shader: convShaderSource,
      uniforms: {
        kernel: [1, 2, 1, 2, 4, 2, 1, 2, 1].map((v) => v * 0.0625)
      }
    }, {
      shader: convShaderSource,
      uniforms: {
        kernel: [-2, 0, -1, -2, 8.025, -2, -1, 1, -1]
      }
    }, {
      shader: convShaderSource,
      uniforms: {
        kernel: [1, 2, 1, 2, 4, 2, 1, 2, 1]
      }
    }, {
      shader: convShaderSource,
      uniforms: {
        kernel: [1, 2, 1, 2, 4, 2, 1, 2, 1].map((v) => v * 0.0625)
      }
    }, {
      shader: convShaderSource,
      uniforms: {
        kernel: [-2, -1, 0, -1, 1, 1, 0, 1, 2]
      }
    }, {
      shader: adjustmentShaderSource,
      uniforms: {
        contrast: 1.5,
        brightness: 1,
        saturation: 0.8
      }
    }]);
    const compositor = new Compositor([{
      id: "c2",
      texture: resolved[1]?.body
        .pipeThrough(createContainerDecoder(resolved[1].file.name))
        .pipeThrough(new MFXVideoDecoder())
        .pipeThrough(pass2),
      textureSize: [],
    }]);

    resolved[0].body
      .pipeThrough(new MFXMP4VideoContainerDecoder())
      .pipeThrough(new MFXVideoDecoder())
      .pipeThrough(new Scaler(1))
      .pipeThrough(pass1)
      .pipeThrough(new Scaler(1))
      .pipeThrough(fpsCounter)
      //.pipeThrough(compositor)
      .pipeTo(new PaintToCanvas(canvasEl));
  };

  const program2 = async (resolved) => {
    const blurPass = new MFXWebGLRenderer([...[...new Array(12)].map((_, i) => ({
      id: `blur_${i}`,
      shader: blueShaderSource,
    })), {
      shader: convShaderSource,
      uniforms: {
        kernel: [1, 2, 1, 2, 4, 2, 1, 2, 1].map((v) => v * 0.0625)
      }
    }]);

    const zoomPass = new MFXWebGLRenderer([{
      shader: zoomShaderSource,
      uniforms: (frame) => {
        if (frame.timestamp > 10200000) {
          return { zoomFactor: 1 };
        }

        return {
          zoomFactor: 1 * (frame.timestamp / 620000)
        }
      }
    }]);

    const config = {
      codec: 'vp8',
      width: 640,
      height: 360,
      bitrate: 1e6
    };

    const output = new MFXWebMMuxer({
      codec: 'V_VP8',
			width: 640,
      height: 360,
			framerate: 30
    });

    await output.ready;

    (resolved[0].body as ReadableStream<Uint8Array>)
      .pipeThrough(createContainerDecoder(resolved[0].file.name))
      .pipeThrough(new MFXVideoDecoder())
      .pipeThrough(new Scaler(0.2))
      .pipeThrough(blurPass)
      .pipeThrough(new Scaler(5))
      .pipeThrough(fpsCounter)
      .pipeThrough(new MFXVideoEncoder(config))
      .pipeTo(output.writable)
  };

  setInterval(() => {
    console.log("FPS", fpsCounter.getFPS());
  }, 1000);

  $: {
    if (files.accepted?.length) {
      file = files.accepted[0];

      (async () => {
        const resolved = await Promise.all(files.accepted.map(async (file) => {
          const url = URL.createObjectURL(file);
          const res = await fetch(url);

          return { body: res.body, file };
        }));

        program2(resolved);
      })();
    }
  }
</script>

<section class="container">
  <section class="dropzone-container" class:dropzone-highlight={fileOver}>
    <Dropzone
      accept="video/*"
      multiple={true}
      disableDefaultStyles={true}
      on:dragenter={() => (fileOver = true)}
      on:dragleave={() => (fileOver = false)}
      on:drop={handleFilesSelect}
    >
      <section class="dropzone">
        <p class="dropzone-text">Drag 'n' drop or select video files</p>
      </section>
    </Dropzone>
  </section>
  <canvas bind:this={canvasEl} width="500px"/>
</section>

<style>
  .container {
    margin: 18px;
  }

  canvas {
    aspect-ratio: 16 / 9;
  }

  .dropzone {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: center;
  }

  .dropzone-text {
    font-weight: 400;
  }

  .dropzone-container {
    border-radius: 10px;
    padding: 18px;
    width: 100%;
    overflow: hidden;
    background-color: #f4f4f4;
    outline: 2px dashed rgba(199, 199, 199, 0.2);
    color: #777;
    outline-offset: 2px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .dropzone-highlight {
    transform: scale(0.95);
  }

  .dropzone-highlight,
  .dropzone-container:hover {
    outline-offset: 1px;
    color: rgb(141, 138, 201);
    background-color: rgba(20, 12, 255, 0.1);
    outline: 2px dashed rgba(60, 50, 254, 0.4);
  }
</style>
