import { nextAnimationFrame } from "./mfx";

export class MFXTransformStream<I, O> extends TransformStream {
	protected _buffer: O[];
	protected _eventTarget: EventTarget;
	protected _controller: TransformStreamDefaultController<O>;
	constructor(
		transformer: Transformer<I, O> = {},
		writableStrategy: QueuingStrategy<I> = new CountQueuingStrategy({
			highWaterMark: 60,
		}),
		readableStrategy: QueuingStrategy<O> = new CountQueuingStrategy({
			highWaterMark: 60,
		}),
	) {
		super(
			{
				...transformer,
				transform: async (chunk, controller) => {
					while (!controller.desiredSize) {
						await nextAnimationFrame();
					}

					await transformer.transform(chunk, controller);
					this._controller = controller;
					if (this._buffer.length) {
						this._copy_buffer(controller);
					}
				},
				flush: async (controller) => {
					this._controller = controller;
					if (this._buffer.length) {
						this._copy_buffer(controller);
					}

					if (typeof transformer.flush === "function") {
						await transformer.flush(controller);
					}
				},
			},
			writableStrategy,
			readableStrategy,
		);
		this._buffer = [];
		this._eventTarget = new EventTarget();
	}

	private _copy_buffer(controller) {
		while (this._buffer.length) {
			controller.enqueue(this._buffer.shift());
		}
	}

	queue(...items: O[]) {
		if (this._controller) {
			items.forEach((item) => this._controller.enqueue(item));
		} else {
			this._buffer.push(...items);
			this.dispatchEvent(new CustomEvent("queue"));
		}

		return new Promise<void>(async (resolve) => {
			while (this._controller.desiredSize <= 0) {
				await nextAnimationFrame();
			}

			resolve();
		});
	}

	dispatchEvent(event: Event) {
		this._eventTarget.dispatchEvent(event);
	}

	dispatchError(error: Error) {
		console.trace(error);
		this._eventTarget.dispatchEvent(
			new CustomEvent("error", { detail: { error } }),
		);
	}

	addEventListener(
		type: string,
		callback: EventListenerOrEventListenerObject,
		options?: boolean | AddEventListenerOptions,
	) {
		this._eventTarget.addEventListener(type, callback, options);
	}

	removeEventListener(
		type: string,
		callback: EventListenerOrEventListenerObject,
		options?: boolean | EventListenerOptions,
	) {
		this._eventTarget.removeEventListener(type, callback, options);
	}
};

export class MFXFrameTee extends MFXTransformStream<VideoFrame, VideoFrame> {
  constructor(ctx: (stream: ReadableStream<VideoFrame>) => void) {
		const stream = new TransformStream();

    super({
      transform: async (chunk, controller) => {
				const clone = chunk.clone();
				const writer = stream.writable.getWriter();
				await writer.write(clone);
				writer.releaseLock();

        controller.enqueue(chunk);
      },
			flush: async () => {
				await stream.writable.close();
			}
    });

		ctx(stream.readable);
  }
};
