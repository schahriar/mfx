import { convolution3x3Kernels } from "./convolution";
import { MFXGLEffect, u } from "./Effect";
import type { Uniform } from "./shaders";
import * as shaders from "./shaders/raw";
import { rotate, scale } from "./matrix";
import { coalesce, createEmptyFrame } from "./coalesce";

const repeat = (n: number, fn: () => MFXGLEffect) => [...new Array(n)].map(fn);
const conv = (kernel: number[]) => ({ passes = 1 } = {}) => repeat(passes, () => new MFXGLEffect(shaders.convolution, { kernel }));

export type Vec3 = [number, number, number];
export type Origin = Vec3;

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
  mask: (video: ReadableStream<VideoFrame>) => {
    return [
      new MFXGLEffect(shaders.mask, {
        mask: coalesce(video),
        maskSize: (f) => [f.displayWidth, f.displayHeight],
      })
    ]
  },
  add: (video: ReadableStream<VideoFrame>, {
    normal = 1,
    additive = 0,
    multiply = 0,
    screen =  0
  } = {}) => {
    return [
      new MFXGLEffect(shaders.composition, {
        layer: coalesce(video),
        layerSize: (f) => [f.displayWidth, f.displayHeight],
        normal,
        additive,
        multiply,
        screen
      }, {
        isDirty: true
      })
    ];
  },
  scale: ({
    values = [1, 1, 1], // Provided as an example
    origin = [0.5, 0.5, 0],
  }: {
    values: Uniform<Vec3>;
    origin?: Uniform<Origin>;
  }) => [
      new MFXGLEffect(shaders.paint, {
        transform: async (f) => scale(await u(values, f), await u(origin, f))
      })
    ],
  rotate: ({
    angle = 45, // Provided as an example
    values = [1, 1, 1], // Provided as an example
    origin = [0.5, 0.5, 0],
  }: {
    angle: Uniform<number>;
    values: Uniform<Vec3>;
    origin?: Uniform<Origin>;
  }) => [
      new MFXGLEffect(shaders.paint, {
        transform: async (f) => rotate(await u(angle, f), await u(values, f), await u(origin, f))
      })
    ],
  zoom: ({
    factor = 1,
    x = 0.5,
    y = 0.5,
  }: {
    factor?: Uniform<number>,
    x?: Uniform<number>,
    y?: Uniform<number>,
  }, {
    isDirty
  }: {
    isDirty?: boolean
  } = {}) => [
      new MFXGLEffect(shaders.paint, {
        transform: async (f) => scale([
          await u(factor, f),
          await u(factor, f),
          1
        ], [
          await u(x, f),
          await u(y, f),
          0
        ])
      }, { isDirty })
    ],
  blur: ({
    passes = 5,
    quality = 0.5
  }: {
    passes?: number;
    // Between 0 to 1, The higher the quality the more passes you need to blur the image
    quality?: number;
  }) => [
      ...visual.zoom({ factor: quality, x: 0.5, y: 0.5 }, { isDirty: true }),
      ...repeat(passes, () => new MFXGLEffect(shaders.convolution, {
        kernel: convolution3x3Kernels.boxBlur
      }, {
        // Ensures vignetting effect is reduced while maintaining optimal performance 
        isDirty: true,
      })),
      ...repeat(Math.round(Math.log(passes)), () => new MFXGLEffect(shaders.convolution, {
        kernel: convolution3x3Kernels.gaussianBlur
      }, {
        // Ensures vignetting effect is reduced while maintaining optimal performance 
        isDirty: true,
      })),
      ...visual.zoom({ factor: async (f) => 1 / (await u(quality, f)), x: 0.5, y: 0.5 }, {
        isDirty: true
      }),
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
