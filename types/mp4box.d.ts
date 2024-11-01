/**
 * @note types imported from WebAV library
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
declare module 'mp4box' {
  export interface MP4MediaTrack {
    id: number;
    created: Date;
    modified: Date;
    movie_duration: number;
    layer: number;
    alternate_group: number;
    volume: number;
    track_width: number;
    track_height: number;
    timescale: number;
    duration: number;
    bitrate: number;
    codec: string;
    language: string;
    nb_samples: number;
  }

  export interface MP4VideoTrack extends MP4MediaTrack {
    video: {
      width: number;
      height: number;
    };
  }

  export interface MP4AudioTrack extends MP4MediaTrack {
    audio: {
      sample_rate: number;
      channel_count: number;
      sample_size?: number;
    };
  }

  export interface MP4Info {
    duration: number;
    timescale: number;
    fragment_duration: number;
    isFragmented: boolean;
    isProgressive: boolean;
    hasIOD: boolean;
    brands: string[];
    created: Date;
    modified: Date;
    tracks: Array<MP4VideoTrack | MP4AudioTrack>;
    videoTracks: MP4VideoTrack[];
    audioTracks: MP4AudioTrack[];
  }

  export type MP4ArrayBuffer = ArrayBuffer & { fileStart: number };

  const DataStream: {
    BIG_ENDIAN: unknown;
    END_ENDIAN: unknown;
    prototype: DataStream;
    new (
      size?: number | ArrayBufferView,
      byteOffset?: number,
      // @ts-expect-error
      endianness?: DataStream.BIG_ENDIAN | DataStream.END_ENDIAN,
    ): DataStream;
  };

  interface DataStream {
    buffer: ArrayBuffer;
    endianness: unknown;
  }

  export interface VideoTrackOpts {
    timescale: number;
    duration?: number;
    type?: string;
    width: number;
    height: number;
    brands: string[];
    description_boxes?: AVCCBox[];
    avcDecoderConfigRecord?: AllowSharedBufferSource | undefined | null;
  }

  export interface AudioTrackOpts {
    timescale: number;
    media_duration?: number;
    duration?: number;
    samplerate: number;
    channel_count: number;
    samplesize?: number;
    description?: ESDSBoxParser;
    hdlr: string;
    type: string;
  }

  export interface SampleOpts {
    duration: number;
    dts?: number;
    cts: number;
    sample_description_index?: number;
    is_sync: boolean;
    description?: MP4ABoxParser | AVC1BoxParser | HVCBoxParser;
  }

  export interface MP4Sample {
    track_id: number;
    description: MP4ABoxParser | AVC1BoxParser | HVCBoxParser;
    is_rap: boolean;
    is_sync: boolean;
    timescale: number;
    dts: number;
    cts: number;
    duration: number;
    has_redundancy: number;
    is_depended_on: number;
    is_leading: number;
    is_sync: boolean;
    number: number;
    offset: number;
    size: number;
    data: Uint8Array;
  }

  interface BoxParser {
    boxes: BoxParser[];
    size: number;
    hdr_size: number;
    start: number;
    type: string;
    data?: Uint8Array;
    write: (dataStream: DataStream) => void;
    parse: (dataStream: DataStream) => void;
    add: (name: string) => BoxParser;
    addEntry: (value: string, name: string) => BoxParser;
  }

  export interface TrakBoxParser extends BoxParser {
    type: 'trak';
    samples: MP4Sample[];
    nextSample: number;
    sample_size: number;
    samples_duration: number;
    mdia: MDIABoxParser;
    tkhd: TKHDBoxParser;
  }

  interface MDATBoxParser extends BoxParser {
    type: 'mdat';
    data: Uint8Array;
  }

  interface MOOFBoxParser extends BoxParser {
    type: 'moof';
  }

  interface MDIABoxParser extends BoxParser {
    type: 'mdia';
    minf: MINFBoxParser;
  }

  interface MINFBoxParser extends BoxParser {
    type: 'minf';
    stbl: STBLBoxParser;
  }

  interface STBLBoxParser extends BoxParser {
    type: 'stbl';
    stsd: STSDBoxParser;
  }

  interface ESDBoxParser extends BoxParser {
    tag: number;
    descs: [DecoderConfigDescriptor, SLConfigDescriptor];
  }

  interface DecoderConfigDescriptor {
    descs: [DecoderSpecificInfo] | [];
  }
  interface DecoderSpecificInfo {
    data: Uint8ArrayBuffer;
  }
  interface SLConfigDescriptor {
    data: Uint8ArrayBuffer;
  }

  export interface ESDSBoxParser extends BoxParser {
    type: 'esds';
    version: number;
    flags: number;
    esd: ESDBoxParser;
    new (size: number): ESDSBoxParser;
  }

  interface MOOVBoxParser extends BoxParser {
    type: 'moov';
    traks: TrakBoxParser[];
    mvhd: MVHDBoxParser;
  }

  interface MVHDBoxParser extends BoxParser {
    type: 'mvhd';
    duration: number;
    timescale: number;
  }

  interface TKHDBoxParser extends BoxParser {
    type: 'tkhd';
    track_id: number;
  }

  type STSDBoxParser = Omit<
    BoxParser & {
      type: 'stsd';
      entries: Array<AVC1BoxParser | HVCBoxParser | MP4ABoxParser>;
    },
    'boxes'
  >;

  export interface AVC1BoxParser extends BoxParser {
    type: 'avc1';
    boxes: AVCCBox[];
    avcC: AVCCBox;
    compressorname: string;
    frame_count: number;
    height: number;
    size: number;
    start: number;
    width: number;
  }

  export interface HVCBoxParser extends BoxParser {
    type: 'hvc1';
    boxes: HVCCBox[];
    hvcC: HVCCBox;
    compressorname: string;
    frame_count: number;
    height: number;
    size: number;
    start: number;
    width: number;
  }

  interface AVCCBox extends BoxParser {
    PPS: Array<{ length: number; nalu: Uint8Array }>;
    SPS: Array<{ length: number; nalu: Uint8Array }>;
    type: 'avcC';
  }

  interface HVCCBox extends BoxParser {
    PPS: Array<{ length: number; nalu: Uint8Array }>;
    SPS: Array<{ length: number; nalu: Uint8Array }>;
    type: 'hvcC';
  }

  export interface MP4ABoxParser extends BoxParser {
    type: 'mp4a';
    channel_count: number;
    samplerate: number;
    samplesize: number;
    size: number;
    start: number;
    boxes: [];
    esds?: ESDSBoxParser;
    getCodec: () => string;
  }

  export interface MP4File {
    boxes: BoxParser[];
    mdats: MDATBoxParser[];
    moofs: MOOFBoxParser[];
    moov?: MOOVBoxParser;

    add: (name: string) => BoxParser;
    addTrack: (opts: VideoTrackOpts | AudioTrackOpts) => number;
    addSample: (trackId: number, buf: ArrayBuffer, sample: SampleOpts) => void;
    releaseUsedSamples(id: number, usedCount: number): void;

    getTrackById(trackId: number): Trak;
    setExtractionOptions: (
      id: number,
      user?: unknown,
      opts?: {
        nbSamples?: number;
        rapAlignement?: boolean;
      },
    ) => void;

    onMoovStart?: () => void;
    onReady?: (info: MP4Info) => void;
    onSamples: (id: number, user: any, samples: MP4Sample[]) => void;
    onError?: (e: string) => void;

    appendBuffer: (data: MP4ArrayBuffer) => number | undefined;
    start: () => void;
    seek: (time: number, useRAP?: boolean) => { offset: number; time: number };
    stop: () => void;
    write: (ds: DataStream) => void;
    flush: () => void;
    onFlush?: () => void;
  }

  interface MPEG4DescriptorParser {
    new (): MPEG4DescriptorParser;
    parseOneDescriptor(stream: DataStream): ESDBoxParser;
  }

  export interface Trak {
    mdia?: {
      minf?: {
        stbl?: {
          stsd?: {
            entries: {
              avcC?: {
                write: (stream: DataStream) => void
              }
              hvcC?: {
                write: (stream: DataStream) => void
              },
              vpcC?: {
                write: (stream: DataStream) => void
              },
              av1C?: {
                write: (stream: DataStream) => void
              }
            }[]
          }
        }
      }
    }
  };

  export function createFile(): MP4File;

  const DefExp: {
    MP4File: MP4File;
    createFile: (keepMdta?: boolean) => MP4File;
    BoxParser: {
      esdsBox: ESDSBoxParser;
    };
    DataStream: typeof DataStream;
    MPEG4DescriptorParser: MPEG4DescriptorParser;
    Log: {
      debug: () => void;
      setLogLevel: (fn: () => void) => void;
    };
  };

  export default DefExp;
}