import { MFXBlob } from "../lib/blob";
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
  decode?: (input: string) => Promise<ReadableStream<ExtendedVideoFrame>>,
  expect?: () => Promise<boolean>;
  process?: () => Promise<MFXTransformStream<ExtendedVideoFrame, ExtendedVideoFrame>[]>,
  output?: (v: ReadableStream<ExtendedVideoFrame>, a?: ReadableStream<AudioData>) => Promise<(MFXTransformStream<ExtendedVideoFrame, any>[]) | ReadableStream<MFXBlob>>,
};
