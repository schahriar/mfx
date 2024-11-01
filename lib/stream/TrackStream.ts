import type { MFXTrack } from "../container/ContainerDecoder";

/**
 * @group Stream
 */
export class TrackStream<T> extends TransformStream<T, T> {
	track: MFXTrack<T>;
	constructor(track: MFXTrack<T>) {
		super({
			transform: (chunk, controller) => {
				controller.enqueue(chunk);
			}
		});

		this.track = track;
	}
};
