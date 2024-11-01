import type { MP4File, MP4ABoxParser, ESDSBoxParser } from "mp4box";

/**
 * @note getESDSBoxFromMP4File and parseAudioInfo4ESDSBox functions imported from WebAV library
 * MIT License (https://github.com/bilibili/WebAV/blob/8c04c082ba8985625b0d643f66d5e49902c57dba/LICENSE)

Copyright (c) 2023 风痕

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
 */
export const getESDSBoxFromMP4File = (file: MP4File, codec = 'mp4a') => {
  const mp4aBox = file.moov?.traks
    .map((t) => t.mdia.minf.stbl.stsd.entries)
    .flat()
    .find(({ type }) => type === codec) as MP4ABoxParser;

  return mp4aBox?.esds;
}

export const parseAudioInfo4ESDSBox = (esds: ESDSBoxParser) => {
  const decoderConf = esds?.esd?.descs[0]?.descs[0];
  if (decoderConf == null) return {};

  const [byte1, byte2] = decoderConf.data;
  const sampleRateIdx = ((byte1 & 0x07) << 1) + (byte2 >> 7);
  const numberOfChannels = (byte2 & 0x7f) >> 3;
  const sampleRateEnum = [
    96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025,
    8000, 7350,
  ] as const;
  return {
    sampleRate: sampleRateEnum[sampleRateIdx],
    numberOfChannels,
  };
};
