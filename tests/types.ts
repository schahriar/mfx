import type { MFXTransformStream } from "../lib/stream";

export interface TestDefinition {
  path: string;
  title: string;
  description: string;
  input: string;
  process?: () => Promise<MFXTransformStream<VideoFrame, VideoFrame>[]>,
  output?: () => Promise<MFXTransformStream<VideoFrame, any>[]>,
};