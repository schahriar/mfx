import { Muxer, StreamTarget } from "webm-muxer";
import { type MFXEncodedVideoChunk } from "./mfx";
import { MFXTransformStream } from "./stream";

export class MFXFileWriter extends WritableStream<[Uint8Array, number]> {
	writer: Promise<FileSystemWritableFileStream>;
	constructor(fileName: string, description = "Video File") {
		super({
			write: async ([chunk, pos]) => {
				const writer = await this.writer;
				await writer.seek(pos);
				await writer.write(chunk);
			}
		});

		this.writer = (async () => {
			const fileHandle = await window.showSaveFilePicker({
				suggestedName: fileName,
				startIn: "videos",
				types: [
					{
						description,
						accept: { "video/webm": [".webm"] },
					},
				],
			});
		
			return await fileHandle.createWritable();
		})();
	}
};

export class MFXWebMMuxer extends MFXTransformStream<MFXEncodedVideoChunk, [Uint8Array, number]> {
	ready: Promise<any>;
	constructor(
		config: any,
		chunkSize?: number,
	) {
		const muxer = new Muxer({
			video: config as any,
			firstTimestampBehavior: "permissive",
			type: "matroska",
			streaming: true,
			target: new StreamTarget({
				chunked: true,
				onData: (data, position) => {
					this.queue([data, position]);
				},
				...Number.isInteger(chunkSize) ? {
					chunkSize
				} : {},
			}),
		});

		super({
			transform: async (encodedVideoChunk) => {
				muxer.addVideoChunk(
					encodedVideoChunk.videoChunk,
					encodedVideoChunk.videoMetadata,
				);
			},
			flush: async () => {
				muxer.finalize();
			},
		});
	}
}
