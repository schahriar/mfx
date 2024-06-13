export class ConsoleWritableStream<T = any> {
  writable: WritableStream<T>;

  constructor(id: string) {
    let size = 0;
    let length = 0;

    this.writable = new WritableStream({
      write(chunk) {
        console.log("id", chunk);
        length++;
        size += (chunk as ArrayBuffer)?.byteLength || (chunk as any).size || (chunk as string)?.length;
      },
      close() {
        console.log(`Stream ${id} closed: Read ${length} chunks at total of ${size} bytes`);
      },
      abort(err) {
        console.error('Stream ${id} aborted:', err);
      },
    });
  }
}
