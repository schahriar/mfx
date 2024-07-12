import { ExtendedVideoFrame } from "../lib/frame";
import type { MFXTransformStream } from "../lib/stream";

export interface TestDefinition {
  id: string;
  path: string;
  title: string;
  description: string;
  input: string;
  process?: () => Promise<MFXTransformStream<ExtendedVideoFrame, ExtendedVideoFrame>[]>,
  output?: () => Promise<MFXTransformStream<ExtendedVideoFrame, any>[]>,
};
