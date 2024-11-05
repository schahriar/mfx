import type { ExtendedVideoFrame } from "../../frame";
import type { Effect } from "../GLEffect";
import * as shaders from "./raw";

export type UniformProducer<T> = (frame: ExtendedVideoFrame) => T;
export type Uniform<T> = T | UniformProducer<T>;

export const blur = (): Effect => ({
  shader: shaders.blur,
});

export const convolution = (
  kernel: Uniform<number[]> = [0, 0, 0, 0, 1, 0, 0, 0, 0],
): Effect => ({
  shader: shaders.convolution,
  uniforms: {
    kernel,
  },
});

export const zoom = ({
  factor = 1,
  x = 0.5,
  y = 0.5,
}: {
  factor?: Uniform<number>;
  x?: Uniform<number>;
  y?: Uniform<number>;
} = {}): Effect => ({
  shader: shaders.zoom,
  uniforms: {
    zoomFactor: factor,
    position: [x, y],
  },
});

export const adjustment = ({
  saturation = 1,
  brightness = 1,
  contrast = 1,
}: {
  saturation?: Uniform<number>;
  brightness?: Uniform<number>;
  contrast?: Uniform<number>;
} = {}): Effect => ({
  shader: shaders.adjustment,
  uniforms: {
    saturation,
    brightness,
    contrast,
  },
});
