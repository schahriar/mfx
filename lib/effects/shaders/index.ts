import type { ExtendedVideoFrame } from "../../frame";

export type UniformProducer<T> = (frame: ExtendedVideoFrame) => T;
export type Uniform<T> = T | UniformProducer<T>;
