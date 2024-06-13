#version 300 es
precision mediump float;
precision mediump int;
in vec2 uv;
out vec4 fragColor;

uniform sampler2D frame;
uniform vec2 frameSize;

uniform sampler2D layer;
uniform vec2 layerSize;

void main() {
  vec4 color = texture(frame, uv);
  fragColor = color;
}
