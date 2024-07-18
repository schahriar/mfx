import { Page } from "puppeteer";
import { ExtendedVideoFrame } from "../lib/frame";
import type { MFXTransformStream } from "../lib/stream";

export interface TestDefinition {
  id: string;
  path: string;
  title: string;
  description: string;
  input: string;
  expect?: () => Promise<boolean>;
  process?: () => Promise<MFXTransformStream<ExtendedVideoFrame, ExtendedVideoFrame>[]>,
  output?: () => Promise<MFXTransformStream<ExtendedVideoFrame, any>[]>,
};
