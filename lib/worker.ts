import { MFXTransformStream } from "./stream";

export type TransformLike<T extends MFXTransformStream<any, any>> = new <I, O>(
  ...any
) => T;

const accept = <T>(target: EventTarget) => {
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

export class ForwardedStream<I, O> extends MFXTransformStream<I, O> {
  name: string;
  get identifier(): any {
    return `ForwardedStream(${this.name})`;
  }

  constructor(
    name: string,
    worker: Worker,
    {
      transfer = () => [],
    }: {
      transfer?: (_: I) => any[];
    } = {},
  ) {
    let resolver;
    let ready = new Promise((resolve) => {
      resolver = resolve;
    });

    super({
      start: async () => {
        const [type] = await accept<[string]>(worker);
        if (type === "ready") {
          resolver();
        }
      },
      transform: async (chunk, controller) => {
        // Wait until worker is listening
        await ready;
        worker.postMessage(
          ["transform", chunk],
          transfer
            ? {
                transfer: transfer(chunk),
              }
            : {},
        );

        const transformed = await accept<O>(worker);
        controller.enqueue(transformed);
      },
      flush: async () => {
        worker.postMessage(["flush"]);
      },
    });

    this.name = name;
  }
}
