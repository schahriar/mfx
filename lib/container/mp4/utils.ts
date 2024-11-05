import MP4Box from "mp4box";
import type { Trak } from "mp4box";

export const getVideoBoxDescription = (track: Trak) => {
  /**
   * @note
   * We don't exactly support multi-codec tracks
   * and the use-case doesn't exist for common MP4
   * videos so iterating over is only intended to
   * remove redunant codecs
   */
  for (const entry of track.mdia.minf.stbl.stsd.entries) {
    const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
    if (box) {
      const stream = new MP4Box.DataStream(
        undefined,
        0,
        MP4Box.DataStream.BIG_ENDIAN,
      );
      box.write(stream);
      return new Uint8Array(stream.buffer, 8);
    }
  }

  return new Uint8Array();
};
