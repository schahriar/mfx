#version 300 es
precision mediump float;
precision mediump int;
in vec2 uv;
out vec4 fragColor;

uniform sampler2D frame;
uniform vec2 frameSize;

void main() {
  vec4 color = texture(frame, uv);
  fragColor = color;
}
