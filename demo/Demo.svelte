<script lang="ts">
  import Dropzone from "svelte-file-dropzone";
  import { WebGLRenderer, MFXFrameVoid, MFXVideoDecoder, MFXVideoContainerDecoder, Scaler, PaintToCanvas } from "../lib/mfx";
  import adjustmentShaderSource from "!!raw-loader!../lib/renderers/shaders/adjustment.glsl";
  import convShaderSource from "!!raw-loader!../lib/renderers/shaders/convolution.glsl";
  import blueShaderSource from "!!raw-loader!../lib/renderers/shaders/blur.glsl";

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

  $: {
    if (files.accepted?.length) {
      file = files.accepted[0];

      (async () => {
        const url = URL.createObjectURL(file);
        const res = await fetch(url);

        const pass1 = new WebGLRenderer([...[...new Array(16)].map((_, i) => ({
          id: `blur_${i}`,
          shader: blueShaderSource,
        }))]);

        const pass2 = new WebGLRenderer([{
          id: "conv3",
          shader: convShaderSource,
          uniforms: {
            kernel: [1, 2, 1, 2, 4, 2, 1, 2, 1].map((v) => v * 0.0625)
          }
        }, {
          id: "conv4",
          shader: convShaderSource,
          uniforms: {
            kernel: [1, 2, 1, 2, 4, 2, 1, 2, 1].map((v) => v * 0.0625)
          }
        }, {
          id: "conv",
          shader: convShaderSource,
          uniforms: {
            kernel: [-2, 0, -1, -2, 8.025, -2, -1, 1, -1]
          }
        }, {
          id: "conv2",
          shader: convShaderSource,
          uniforms: {
            kernel: [1, 2, 1, 2, 4, 2, 1, 2, 1]
          }
        }, {
          id: "conv5",
          shader: convShaderSource,
          uniforms: {
            kernel: [1, 2, 1, 2, 4, 2, 1, 2, 1].map((v) => v * 0.0625)
          }
        }, {
          id: "conv6",
          shader: convShaderSource,
          uniforms: {
            kernel: [-2, -1, 0, -1, 1, 1, 0, 1, 2]
          }
        }, {
          id: 'adj',
          shader: adjustmentShaderSource,
          uniforms: {
            contrast: 1.5,
            brightness: 1,
            saturation: 0.8
          }
        }]);
        const container = new MFXVideoContainerDecoder();
        const decoder = new MFXVideoDecoder();

        res.body
          .pipeThrough(container)
          .pipeThrough(decoder)
          .pipeThrough(new Scaler(0.1))
          .pipeThrough(pass1)
          .pipeThrough(new Scaler(10))
          .pipeTo(new PaintToCanvas(canvasEl));
      })();
    }
  }
</script>

<section class="container">
  <section class="dropzone-container" class:dropzone-highlight={fileOver}>
    <Dropzone
      accept="video/*"
      multiple={false}
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
