/** @group Effects */
export const convolution3x3Kernels = {
  edge0: [1, 0, -1, 0, 0, 0, -1, 0, 1],
  edge1: [0, 1, 0, 1, -4, 1, 0, 1, 0],
  edge2: [-1, -1, -1, -1, 8, -1, -1, -1, -1],
  sharpen: [0, -1, 0, -1, 5, -1, 0, -1, 0],
  boxBlur: [1, 1, 1, 1, 1, 1, 1, 1, 1].map((v) => v * 0.1111),
  gaussianBlur: [1, 2, 1, 2, 4, 2, 1, 2, 1].map((v) => v * 0.0625),
  emboss: [-2, -1, 0, -1, 1, 1, 0, 1, 2],
  identity: [0, 0, 0, 0, 1, 0, 0, 0, 0],
};
