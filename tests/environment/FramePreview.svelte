<script lang="ts">
  import { onMount } from "svelte";
  import type { ExtendedVideoFrame } from "../../lib/frame";

  export let frame: ExtendedVideoFrame;

  let canvas: HTMLCanvasElement;
  const width = frame.displayWidth;
  const height = frame.displayHeight;

  onMount(() => {
    const ctx = canvas.getContext("2d");
    canvas.width = width;
    canvas.height = height;

    ctx.drawImage(frame, 0, 0, width, height);
  });
</script>

<canvas bind:this={canvas} />

<style>
  canvas {
    max-width: 100%;
  }
</style>
