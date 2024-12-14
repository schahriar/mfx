#version 300 es
precision mediump float;

uniform mat4 transform; // 4x4 transformation matrix
uniform float MFXInternalFlipY;

in vec2 texcoord;
out vec2 uv;

void main(void) {
  // Apply the transformation matrix to the texcoord
  gl_Position = transform * vec4(texcoord, 0.0, 1.0);

  // Flip Y axis based on MFXInternalFlipY
  uv = vec2(
    (1.0 + texcoord.x) / 2.0,
    (1.0 - texcoord.y * MFXInternalFlipY + texcoord.y * (1.0 - MFXInternalFlipY)) / 2.0
  );
}