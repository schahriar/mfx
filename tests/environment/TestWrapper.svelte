<script lang="ts">
  import {
    MFXVideoDecoder,
    PassthroughCanvas,
    createContainerDecoder,
    MFXFPSDebugger,
    MFXDigest,
    MFXFrameSampler,
    MFXFrameTee,
    MFXVoid,
    Scaler,
  } from "mfx";
  import bwipjs from "bwip-js";
  import { onMount } from "svelte";
  import { openURL } from "../utils";
  import FramePreview from "./FramePreview.svelte";
  import { circInOut } from "svelte/easing";
  import { MFXMediaSourceStream } from "../../lib/encode";
  import type { TestDefinition } from "../types";

  export let definition: TestDefinition;

  let canvasEl: HTMLCanvasElement;
  let barcodeEl: HTMLCanvasElement;
  let outputIntegrityEl: HTMLCanvasElement;
  let outputVideo = new MFXMediaSourceStream();
  let hash = "";
  let snapshot = [];
  let samples: {
    frame: VideoFrame;
    id: number;
  }[] = [];
  const fpsCounter = new MFXFPSDebugger();
  const digest = new MFXDigest((value) => {
    snapshot.push(value);
  });

  let completionCallback: () => void;
  const done = new Promise<void>((resolve) => {
    completionCallback = resolve;
  });

  const outputDigest = new MFXDigest((value) => {
    hash = value;
  }, () => {
    completionCallback();
  });

  $: {
    window["results"] = {
      hash,
      snapshot,
      done
    };
  }

  setInterval(() => {
    console.log("FPS", fpsCounter.getFPS());
  }, 1000);

  function appear(node: HTMLElement, { delay = 0, duration = 500 } = {}) {
    const w = node.getBoundingClientRect().width;
    const h = node.getBoundingClientRect().height;

    return {
      delay,
      duration,
      css: (ti) => {
        const t = circInOut(ti);

        return `
          max-width: ${t * w}px;
          min-width: ${t * 100}px;
          max-height: ${t * h}px;
          border-radius: ${(1 - t) * 8}px;
          opacity: ${t};
          filter: grayscale(${1 - t}) blur(${(1 - t) * 2}px);
        `;
      },
    };
  }

  onMount(async () => {
    const stream = await openURL(definition.input);
    const computedPipeline = await definition.process();

    const decodeStream = stream
      .pipeThrough(createContainerDecoder("AI.mp4"))
      .pipeThrough(new MFXVideoDecoder())
      .pipeThrough(
        new MFXFrameTee((stream) => {
          stream
            .pipeThrough(
              new MFXFrameSampler(async (f, i) => i === 0 || !Boolean(i % 30))
            )
            .pipeThrough(new Scaler(0.1))
            .pipeThrough(digest)
            .pipeThrough(
              new MFXFrameSampler(
                async (frame, i) => {
                  samples = [
                    ...samples,
                    {
                      frame,
                      id: i,
                    },
                  ];

                  if (samples.length >= 10) {
                    const extra = samples.shift();
                    extra.frame.close();
                  }
                  return true;
                },
                { closer: false }
              )
            )
            .pipeTo(new MFXVoid());
        })
      );

    const processStream = computedPipeline.length
      ? computedPipeline.reduce(
          (stream, pipe) => stream.pipeThrough(pipe),
          decodeStream
        )
      : decodeStream;

    const displayStream = processStream
      .pipeThrough(new PassthroughCanvas(canvasEl))
      .pipeThrough(fpsCounter);

    if (definition.output) {
      const outputPipeline = await definition.output();
      const outputStream = outputPipeline.reduce(
        (stream, pipe) => stream.pipeThrough(pipe),
        displayStream
      );

      outputStream.pipeThrough(outputDigest).pipeTo(outputVideo);

      return;
    }

    displayStream.pipeThrough(outputDigest).pipeTo(new MFXVoid());
  });

  $: {
    if (hash && barcodeEl) {
      (bwipjs as any).toCanvas(barcodeEl, {
        bcid: "codablockf",
        text: hash,
        scaleX: 8,
        scaleY: 1,
        height: 1,
        barcolor: "#fafafa",
        textcolor: "#fafafa",
        bordercolor: "transparent",
        includetext: true,
        textxalign: "center",
      });
    }
  }

  $: {
    if (hash && outputIntegrityEl) {
      (bwipjs as any).toCanvas(outputIntegrityEl, {
        bcid: "codablockf",
        text: hash,
        scaleX: 8,
        scaleY: 1,
        height: 1,
        barcolor: "#fafafa",
        textcolor: "#fafafa",
        bordercolor: "transparent",
        includetext: true,
        textxalign: "center",
      });
    }
  }
</script>

<section class="container">
  <h2>{definition.title}</h2>
  <h4 style="opacity: 0.7">{definition.description}</h4>
  <br/>
  <canvas class="video" bind:this={canvasEl} width="500px" />
  <div class="preview">
    {#each samples as sample (sample.id)}
      <div class="inner" transition:appear>
        <FramePreview frame={sample.frame} />
      </div>
    {/each}
  </div>
  <div style:width="60vw" class="barcode-container">
    <canvas class="barcode" bind:this={barcodeEl} />
    {#if hash.length}
      <canvas
        in:appear={{ duration: 300 }}
        class="barcode"
        bind:this={outputIntegrityEl}
      />
    {/if}
  </div>
  {#if definition.output}
    <div class="compare">
      <!-- svelte-ignore a11y-media-has-caption -->
      <video controls autoplay muted loop src={definition.input} />
      <!-- svelte-ignore a11y-media-has-caption -->
      <video controls autoplay muted loop src={outputVideo.getSource()} />
    </div>
  {/if}
</section>

<style>
  .container {
    display: flex;
    flex-direction: column;
    max-width: 60vw;
  }

  .preview {
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    overflow-x: scroll;
  }

  .compare {
    display: flex;
  }

  .compare video {
    width: 50%;
  }

  .inner {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 100px;
    height: 60px;
    margin-top: 4px;
    overflow: hidden;
  }

  canvas {
    box-sizing: border-box;
    border: 1px solid white;
  }

  .video {
    max-width: 100%;
    aspect-ratio: 16 / 9;
  }

  .barcode-container {
    display: flex;
    overflow: hidden;
    margin: 4px 0px;
  }

  .barcode {
    flex: 1;
    height: 28px;
    width: 50%;
  }
</style>
