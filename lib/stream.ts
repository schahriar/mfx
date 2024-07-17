import { ExtendedVideoFrame } from "./frame";
import { next } from "./mfx";

/**
 * @group Stream
 */
export abstract class MFXWritableStream<I> extends WritableStream {
	protected _eventTarget: EventTarget;

	abstract get identifier();

	constructor(
		underlyingSink?: UnderlyingSink<I>,
		strategy: QueuingStrategy<I> = new CountQueuingStrategy({
			highWaterMark: 60,
		}),
	) {
		super(underlyingSink, strategy);
		setTimeout(() => {
			console.info(`<defined:${this.identifier}>`);
		}, 0);
		this._eventTarget = new EventTarget();
	}

	dispatchEvent(event: Event) {
		this._eventTarget.dispatchEvent(event);
	}

	dispatchError(error: Error) {
		console.error(error);
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
}

/**
 * @group Stream
 */
export abstract class MFXTransformStream<I, O> extends TransformStream {
	protected _buffer: O[];
	protected _eventTarget: EventTarget;
	protected _controller: TransformStreamDefaultController<O>;

	abstract get identifier();

	constructor(
		transformer: Transformer<I, O> = {},
		writableStrategy: QueuingStrategy<I> = new CountQueuingStrategy({
			highWaterMark: 60,
		}),
		readableStrategy: QueuingStrategy<O> = new CountQueuingStrategy({
			highWaterMark: 60,
		}),
	) {
		let lastMetDesiredSize = Date.now();
		const streamMonitor = setInterval(() => {
			if (!this._controller) return;

			if (this._controller.desiredSize === 0) {
				if (lastMetDesiredSize < Date.now() - 10000) {
					console.warn(
						`Stream clogged on pipe ${this.identifier}\n you might be missing .pipeTo(new MFXVoid()) at the end of your stream`,
					);
					lastMetDesiredSize = Date.now() + 30 * 60 * 1000; // Already reported, check in 30 seconds
				}
				return;
			}

			lastMetDesiredSize = Date.now();
		}, 1000);

		super(
			{
				...transformer,
				transform: async (chunk, controller) => {
					while (!controller?.desiredSize) {
						await next();
					}

					await transformer.transform(chunk, controller);
					this._controller = controller;
					if (this._buffer.length) {
						this._copy_buffer(controller);
					}
				},
				flush: async (controller) => {
					console.info(`<flushed:${this.identifier}>`);
					clearInterval(streamMonitor);
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
		setTimeout(() => {
			console.info(`<defined:${this.identifier}>`);
		}, 0);
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
			while (this._controller?.desiredSize <= 0) {
				await next();
			}

			resolve();
		});
	}

	dispatchEvent(event: Event) {
		this._eventTarget.dispatchEvent(event);
	}

	dispatchError(error: Error) {
		console.error(error);
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
}

/**
 * @group Stream
 */
export class MFXBufferCopy<T> extends MFXWritableStream<T> {
	get identifier() {
		return "MFXBufferCopy";
	}

	constructor(a: WritableStream<T>, b: WritableStream<T>) {
		super({
			write: async (chunk) => {
				const aw = a.getWriter();
				const bw = b.getWriter();

				aw.write(chunk);
				aw.releaseLock();

				bw.write(chunk);
				bw.releaseLock();
			},
			close: () => {
				a.close();
				b.close();
			},
		});
	}
}

/**
 * @group Stream
 */
export class MFXFrameTee extends MFXTransformStream<
	ExtendedVideoFrame,
	ExtendedVideoFrame
> {
	get identifier() {
		return "MFXFrameTee";
	}

	constructor(ctx: (stream: ReadableStream<ExtendedVideoFrame>) => void) {
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
			},
		});

		ctx(stream.readable);
	}
}
