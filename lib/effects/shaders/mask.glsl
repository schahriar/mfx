#version 300 es
precision mediump float;
precision mediump int;

in vec2 uv;
out vec4 fragColor;

uniform sampler2D frame;
uniform vec2 frameSize;
uniform sampler2D mask;
uniform vec2 maskSize;

void main() {
  vec4 color = texture(frame, uv);
  vec2 maskUV = uv * (frameSize / maskSize);
  vec4 maskColor = texture(mask, maskUV);

  fragColor = vec4(color.rgb, color.a * maskColor.a);
}
