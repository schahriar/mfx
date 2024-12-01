#version 300 es
precision mediump float;

uniform float flipY;
in vec2 texcoord;
out vec2 uv;

void main(void) {
  gl_Position = vec4(texcoord, 0.0, 1.0);

  uv = vec2((1.0 + texcoord.x) / 2.0, (1.0 + texcoord.y * (1.0 - flipY) - texcoord.y * flipY) / 2.0);
}
