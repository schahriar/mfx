#version 300 es
precision mediump float;

in vec2 texcoord;
out vec2 uv;

void main(void) {
  gl_Position = vec4(texcoord, 0.0, 1.0);
  uv = vec2((1.0 + texcoord.x) / 2.0, (1.0 - texcoord.y) / 2.0);
}
