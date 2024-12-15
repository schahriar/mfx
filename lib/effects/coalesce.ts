export const createEmptyFrame = (base: VideoFrame) => {
  const canvas = new OffscreenCanvas(base.displayWidth, base.displayHeight);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  return new VideoFrame(canvas, {
    timestamp: 0
  });
};


export const coalesce = (stream: ReadableStream<VideoFrame>) => {
  let buffer: VideoFrame | undefined;
  // Lock stream for coalescing
  const reader = stream.getReader();
  let isDone = false;
  let offset = -1;

  const pull = async () => {
    const { done, value } = await reader.read();

    if (done) {
      buffer = createEmptyFrame(buffer);
      isDone = true;
      return;
    }

    buffer?.close();
    buffer = value;
  };

  return async (frame: VideoFrame) => {
    if (offset < 0) {
      offset = frame.timestamp;
    }

    // Check if current frame is within range
    if (buffer && (buffer?.timestamp + buffer?.duration) >= (frame.timestamp - offset)) {
      return buffer.clone();
    }

    if (!isDone) {
      await pull();
    }

    return buffer.clone();
  };
};
