import { MFXBlob } from "./blob";
import { MFXTransformStream } from "./stream";

/**
 * @group Encode
 */
export class FileWriter extends MFXTransformStream<MFXBlob, MFXBlob> {
  get identifier() {
    return "FileWriter";
  }

  writer: Promise<FileSystemWritableFileStream>;
  constructor(fileName: string, description = "Video File") {
    super({
      transform: async (blob, controller) => {
        const writer = await this.writer;
        if (Number.isInteger(blob.position)) {
          await writer.seek(blob.position as number);
        }

        await writer.write(blob);

        controller.enqueue(blob);
      },
      flush: async () => {
        const writer = await this.writer;
        await writer.close();
      },
    });

    // TODO: Read one chunk to determine type before initializing saver
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
}

/**
 * @group Encode
 */
export class MFXMediaSourceStream extends WritableStream<MFXBlob> {
  mediaSource: MediaSource;
  sourcePromise: Promise<void>;

  constructor() {
    const mediaSource = new MediaSource();
    const source = new Promise<void>((resolve) => {
      mediaSource.addEventListener("sourceopen", () => resolve());
    });
    let sourceBuffer: SourceBuffer;

    super({
      write: async (chunk) => {
        await source;
        if (typeof chunk.getMimeType !== "function") {
          throw new Error(
            "Invalid stream piped to MFXMediaSourceStream, expected MFXBlob as chunks",
          );
        }

        if (!sourceBuffer) {
          if (!MediaSource.isTypeSupported(chunk.getMimeType())) {
            throw new Error(
              `Unsupported mime type piped to MFXMediaSourceStream ${chunk.getMimeType()}`,
            );
          }
          sourceBuffer = mediaSource.addSourceBuffer(chunk.getMimeType());
        }

        const arrayBuffer = await chunk.arrayBuffer();
        sourceBuffer.appendBuffer(arrayBuffer);

        await new Promise((resolve) =>
          sourceBuffer.addEventListener("updateend", resolve, { once: true }),
        );
      },
      close: () => {
        mediaSource.endOfStream();
      },
    });

    this.mediaSource = mediaSource;
    this.sourcePromise = source;
  }

  getSource() {
    return URL.createObjectURL(this.mediaSource);
  }
}
