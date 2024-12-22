import { ExtendedVideoFrame } from "../frame";

export const createEmptyFrame = () => {
  const canvas = new OffscreenCanvas(1, 1);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  return new VideoFrame(canvas, {
    timestamp: 0,
  });
};

export const cloneOrReuse = (frame: ExtendedVideoFrame) => {
  if (frame.properties?.keepOpen) {
    return frame;
  }

  return frame.clone();
};

export const coalesce = (stream: ReadableStream<VideoFrame>) => {
  let buffer: VideoFrame | undefined;
  // Lock stream for coalescing
  const reader = stream.getReader();
  let isDone = false;
  let offset = -1;

  const pull = async () => {
    if (isDone) {
      return;
    }

    const { done, value } = await reader.read();

    if (done) {
      buffer = createEmptyFrame();
      isDone = true;
      return;
    }

    if (!(buffer as ExtendedVideoFrame)?.properties?.keepOpen) {
      buffer?.close();
    }
    buffer = value;
  };

  return async (frame: VideoFrame) => {
    if (offset < 0) {
      offset = frame.timestamp;
    }

    // Check if current frame is within range
    if (
      buffer &&
      buffer?.timestamp + buffer?.duration >= frame.timestamp - offset
    ) {
      return cloneOrReuse(buffer);
    }

    if (!isDone) {
      await pull();
    }

    return cloneOrReuse(buffer);
  };
};
