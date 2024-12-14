import { mat4, vec3 } from "gl-matrix";

/**
 * Helper function to create a matrix with a translation to the specified origin.
 * @param origin - The transform origin [x, y, z].
 * @returns A mat4 with translation to the origin.
 */
export const origin = (origin: number[] = [0, 0, 0]): [mat4, () => mat4] => {
  const matrix = mat4.create();
  const [x, y, z] = origin.map((v) => v * 2 - 1);
  const vecTransform = vec3.fromValues(x, y, z);
  mat4.translate(matrix, matrix, vecTransform);
  return [matrix, () => mat4.translate(matrix, matrix, vec3.negate(vecTransform, vecTransform))];
};

/**
 * Scale transformation with a specified origin.
 * @param factors - Scale factors [scaleX, scaleY, scaleZ].
 * @param originPoint - Transform origin [x, y, z].
 * @returns A mat4 scaling matrix.
 */
export const scale = (factors: number[] = [1, 1, 1], originPoint: number[] = [0.5, 0.5, 0]) => {
  const [matrix, revert] = origin(originPoint);
  mat4.scale(matrix, matrix, vec3.fromValues(factors[0], factors[1], factors[2]));
  return revert();
};

/**
 * Rotate transformation with a specified origin and axis.
 * @param angle - Rotation angle in degrees.
 * @param axis - Rotation axis [x, y, z]. Example: [1, 0, 0] for X-axis.
 * @param originPoint - Transform origin [x, y, z].
 * @returns A mat4 rotation matrix.
 */
export const rotate = (angle: number = 0, axis: number[] = [0, 0, 1], originPoint: number[] = [0.5, 0.5, 0]) => {
  console.log("rotate", { angle, axis, originPoint });
  const rad = (angle * Math.PI) / 180; // Convert degrees to radians
  const matrix = mat4.create();
  mat4.rotate(matrix, matrix, rad, vec3.fromValues(axis[0], axis[1], axis[2]));
  return matrix;
};

/**
 * Translation transformation.
 * @param vector - Translation vector [translateX, translateY, translateZ].
 * @returns A mat4 translation matrix.
 */
export const translate = (vector: number[] = [0, 0, 0]) => {
  const matrix = mat4.create();
  mat4.translate(matrix, matrix, vec3.fromValues(vector[0], vector[1], vector[2]));
  return matrix;
};

/**
 * Skew transformation with a specified origin.
 * @param skewFactors - Skew angles in degrees [skewXY, skewXZ, skewYX, skewYZ, skewZX, skewZY].
 * @param originPoint - Transform origin [x, y, z].
 * @returns A mat4 skewing matrix.
 */
export const skew = (
  skewFactors: number[] = [0, 0, 0, 0, 0, 0],
  originPoint: number[] = [0.5, 0.5, 0]
) => {
  const [skewXY, skewXZ, skewYX, skewYZ, skewZX, skewZY] = skewFactors.map(
    (angle) => Math.tan((angle * Math.PI) / 180) // Convert degrees to radians and apply tan
  );

  const [matrix, revert] = origin(originPoint);

  const skewMatrix = mat4.fromValues(
    1, skewXY, skewXZ, 0,
    skewYX, 1, skewYZ, 0,
    skewZX, skewZY, 1, 0,
    0, 0, 0, 1
  );

  mat4.multiply(matrix, matrix, skewMatrix);

  return revert();
};
