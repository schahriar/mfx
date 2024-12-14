import type { ExtendedVideoFrame } from "../../frame";

export type UniformProducer<T> = (frame: ExtendedVideoFrame) => Promise<T>;
export type Uniform<T> = T | UniformProducer<T>;
