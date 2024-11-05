export const accept = <T>(target: EventTarget) => {
  return new Promise<T>((resolve, reject) => {
    target.addEventListener("error", reject, { once: true });
    target.addEventListener(
      "message",
      (ev: MessageEvent) => {
        resolve(ev.data);
        target.removeEventListener("error", reject);
      },
      { once: true },
    );
  });
};

export class StreamCloser extends WritableStream {
  constructor({ transfarable = false } = {}) {
    super({
      write: (chunk) => {
        self.postMessage(chunk, {
          transfer: transfarable ? [chunk] : [],
        });
      },
    });
  }
}

export const useStream = <I>(): ReadableStream<I> => {
  return new ReadableStream<I>({
    start: () => {
      self.postMessage(["ready"]);
    },
    pull: async (controller) => {
      const [type, chunk] = await accept<[string, I]>(self);

      if (type === "transform") {
        controller.enqueue(chunk);
      } else if (type === "flush") {
        controller.close();
      }
    },
  });
};
