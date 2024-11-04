import JsWebm from "jswebm";
import { next } from "../../utils";
import { vp9 } from "../../codec/vp9";
import { MFXWritableStream } from "../../stream";

/**
 * Probes codec information about a WebM container
 * @group Decode
 */
export class MFXWebMContainerProbe extends MFXWritableStream<Uint8Array> {
	get identifier() {
		return "MFXWebMContainerProbe";
	}

	// Returns codec string after container is fully processed
	async getCodec(): Promise<string> {
		return new Promise((resolve, reject) => {
			this.addEventListener("codec", (ev: CustomEvent) =>
				resolve(ev.detail.codec as string),
			);

			this.addEventListener("error", (ev: CustomEvent) =>
				reject(ev.detail.error as string),
			);
		});
	}

	constructor() {
		const demuxer = new JsWebm();

		super(
			{
				write: async (chunk) => {
					demuxer.queueData(chunk.buffer);
				},
				close: async () => {
					let idx = 0;
					let size = 0;

					while (!demuxer.eof) {
						await demuxer.demux();
						await next(0);

						while (idx < demuxer.videoPackets.length) {
							const packet = demuxer.videoPackets[idx];
							size += packet.data.byteLength;
							idx++;
						}
					}

					this.dispatchEvent(
						new CustomEvent("codec", {
							detail: {
								codec: {
									V_VP9: vp9.autoSelectCodec({
										width: demuxer.videoTrack.width,
										height: demuxer.videoTrack.height,
										bitDepth: 8, // TODO: calculate bit depth
										bitrate: (size * 8) / demuxer?.duration, // Bitrate is assigned after all video tracks are read
									}),
									V_VP8: "vp8",
								}[demuxer.videoTrack.codecID],
								codedHeight: demuxer.videoTrack.height,
								codedWidth: demuxer.videoTrack.width,
							},
						}),
					);
				},
			},
			new CountQueuingStrategy({
				highWaterMark: Infinity,
			}),
		);
	}
}
