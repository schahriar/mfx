type WriteParams =
    | { type: 'write'; position?: number | undefined; data: BufferSource | Blob | string }
    | { type: 'seek'; position: number }
    | { type: 'truncate'; size: number };

type FileSystemWriteChunkType = BufferSource | Blob | string | WriteParams;

class FileSystemWritableFileStream extends WritableStream {
  write(data: FileSystemWriteChunkType): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
};
