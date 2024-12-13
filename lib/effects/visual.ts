import { convolution3x3Kernels } from "./convolution";
import { MFXGLEffect } from "./Effect";
import type { Uniform } from "./shaders";
import * as shaders from "./shaders/raw";

const repeat = (n: number, fn: () => MFXGLEffect) => [...new Array(n)].map(fn);
const conv = (kernel: number[]) => ({ passes = 1 } = {}) => repeat(passes, () => new MFXGLEffect(shaders.convolution, { kernel }));

export const visual = {
  adjustment: ({
    saturation = 1,
    brightness = 1,
    contrast = 1,
  }: {
    saturation?: Uniform<number>;
    brightness?: Uniform<number>;
    contrast?: Uniform<number>;
  }) => [
      new MFXGLEffect(shaders.adjustment, { saturation, brightness, contrast })
    ],
  zoom: ({
    factor = 1,
    x = 0.5,
    y = 0.5,
  }: {
    factor?: Uniform<number>,
    x?: Uniform<number>,
    y?: Uniform<number>,
  }) => [
      new MFXGLEffect(shaders.zoom, { position: [x, y], factor })
    ],
  edge: conv(convolution3x3Kernels.edge0),
  edge1: conv(convolution3x3Kernels.edge1),
  edge2: conv(convolution3x3Kernels.edge2),
  sharpen: conv(convolution3x3Kernels.sharpen),
  boxBlur: conv(convolution3x3Kernels.boxBlur),
  gaussianBlur: conv(convolution3x3Kernels.gaussianBlur),
  emboss: conv(convolution3x3Kernels.emboss),
  convolution3x3: ({
    passes = 1,
    kernel
  }: {
    passes?: number;
    kernel: Uniform<number[]>;
  }) => repeat(passes, () => new MFXGLEffect(shaders.convolution, { kernel })),
};
