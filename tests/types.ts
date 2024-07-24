import { Page } from "puppeteer";
import { ExtendedVideoFrame } from "../lib/frame";
import type { MFXTransformStream } from "../lib/stream";

export interface TestDefinition {
  id: string;
  path: string;
  title: string;
  description: string;
  codec?: string;
  input: string;
  decode?: (input: string) => Promise<ReadableStream<ExtendedVideoFrame>>,
  expect?: () => Promise<boolean>;
  process?: () => Promise<MFXTransformStream<ExtendedVideoFrame, ExtendedVideoFrame>[]>,
  output?: () => Promise<MFXTransformStream<ExtendedVideoFrame, any>[]>,
};
