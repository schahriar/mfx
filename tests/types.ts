import { MFXBlob } from "../lib/blob";
import type { GenericTrack } from "../lib/container/Track";
import type { DecodeOptions } from "../lib/decode";
import { ExtendedVideoFrame } from "../lib/frame";
import type { MFXTransformStream } from "../lib/stream";

export interface TestDefinition {
  id: string;
  path: string;
  title: string;
  description: string;
  skip?: boolean | string;
  codec?: string;
  input: string;
  decodeOptions?: DecodeOptions;
  decode?: (input: string) => Promise<ReadableStream<ExtendedVideoFrame>>,
  expect?: () => Promise<boolean>;
  process?: () => Promise<MFXTransformStream<ExtendedVideoFrame, ExtendedVideoFrame>[]>,
  output?: (v: ReadableStream<ExtendedVideoFrame>, a?: ReadableStream<AudioData>, vt?: GenericTrack<any>, at?: GenericTrack<any>) => Promise<(MFXTransformStream<ExtendedVideoFrame, any>[]) | ReadableStream<MFXBlob>>,
};
