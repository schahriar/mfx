import { nextTick } from "./utils";

export interface ContainerContext {
  duration: number;
  createdAt?: Date;
  // TODO: Support seek
}

export const cloneFrame = (
  frame: VideoFrame,
  init?: VideoFrameInit,
  source: any = frame,
) => {
  return new VideoFrame(source, {
    timestamp: frame.timestamp,
    ...(frame.duration
      ? {
          duration: frame.duration,
        }
      : {}),
    ...(frame.displayWidth
      ? {
          displayWidth: frame.displayWidth,
        }
      : {}),
    ...(frame.displayHeight
      ? {
          displayHeight: frame.displayHeight,
        }
      : {}),
    ...(frame.visibleRect
      ? {
          visibleRect: frame.visibleRect,
        }
      : {}),
    ...init,
  });
};

export interface ExtendedVideoFrameProperties {
  keyFrame?: boolean;
  keepOpen?: boolean;
}

export class ExtendedVideoFrame extends VideoFrame {
  properties?: ExtendedVideoFrameProperties;
  constructor(
    source: CanvasImageSource | ImageData,
    init?: VideoFrameInit,
    properties: ExtendedVideoFrameProperties = {},
  ) {
    super(source as any, init);

    this.properties = {
      ...properties,
    };
  }

  static revise(
    frame: ExtendedVideoFrame | VideoFrame,
    source: CanvasImageSource | ImageData | ExtendedVideoFrame,
    init?: VideoFrameInit,
    properties: ExtendedVideoFrameProperties = {},
  ) {
    return new ExtendedVideoFrame(
      source as any,
      {
        timestamp: frame.timestamp,
        ...(frame.duration
          ? {
              duration: frame.duration,
            }
          : {}),
        ...(frame.displayWidth
          ? {
              displayWidth: frame.displayWidth,
            }
          : {}),
        ...(frame.displayHeight
          ? {
              displayHeight: frame.displayHeight,
            }
          : {}),
        ...(frame.visibleRect
          ? {
              visibleRect: frame.visibleRect,
            }
          : {}),
        ...init,
      },
      {
        ...(source as ExtendedVideoFrame).properties,
        ...properties,
      },
    );
  }
}

export class MFXVideoSource extends ReadableStream<ExtendedVideoFrame> {
  constructor(source: HTMLVideoElement, { playbackRate = 3 } = {}) {
    let ended = false;
    let buffer = [];
    let handle = -1;
    const callback = () => {
      buffer.push(
        new ExtendedVideoFrame(source, {
          timestamp: source.currentTime * 1e6,
          displayWidth: source.videoWidth,
          displayHeight: source.videoHeight,
        }),
      );
      handle = source.requestVideoFrameCallback(callback);
    };

    source.addEventListener(
      "ended",
      () => {
        ended = true;
        source.cancelVideoFrameCallback(handle);
      },
      { once: true },
    );

    super({
      start: () => {
        source.playbackRate = playbackRate;
        handle = source.requestVideoFrameCallback(callback);
      },
      pull: async (controller) => {
        while (!ended && !buffer.length) {
          await nextTick(15);
        }

        if (ended) {
          return controller.close();
        }

        const frame = buffer.shift();
        controller.enqueue(frame);
      },
      cancel: () => {
        source.cancelVideoFrameCallback(handle);
      },
    });
  }
}
