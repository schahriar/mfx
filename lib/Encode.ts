import { Muxer, FileSystemWritableFileStreamTarget } from "webm-muxer";
import { type MFXEncodedVideoChunk } from "./mfx";

export class MFXWebMMuxer extends WritableStream<MFXEncodedVideoChunk> {
	ready: Promise<any>;
	constructor(
		config: any,
		fileName: string = "video.webm",
		description = "Video File",
	) {
		let fileStreamRef: any;
		const muxerPromise = (async () => {
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
			const fileStream = await fileHandle.createWritable();
			fileStreamRef = fileStream;
			return new Muxer({
				video: config as any,
				firstTimestampBehavior: "permissive",
				type: "matroska",
				streaming: true,
				target: new FileSystemWritableFileStreamTarget(fileStream),
			});
		})();

		super({
			write: async (encodedVideoChunk) => {
				const muxer = await muxerPromise;
				muxer.addVideoChunk(
					encodedVideoChunk.videoChunk,
					encodedVideoChunk.videoMetadata,
				);
			},
			close: async () => {
				const muxer = await muxerPromise;
				muxer.finalize();
				await fileStreamRef?.close();
			},
		});

		this.ready = muxerPromise;
	}
}
