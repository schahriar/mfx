#version 300 es
precision mediump float;
precision mediump int;

in vec2 uv;
out vec4 fragColor;

uniform sampler2D frame;
uniform vec2 frameSize;

uniform float saturation;
uniform float brightness;
uniform float contrast;

vec4 adjustSaturation(vec4 color, float adjustment) {
  float gray = dot(color.rgb, vec3(0.299f, 0.587f, 0.114f));
  return vec4(mix(vec3(gray), color.rgb, adjustment), 1.0f);
}

vec4 adjustBrightness(vec4 color, float adjustment) {
  return vec4(color.rgb + (adjustment - 1.0f), 1.0f);
}

vec4 adjustContrast(vec4 color, float adjustment) {
  return vec4(((color.rgb - 0.5f) * max(adjustment, 0.0f)) + 0.5f, 1.0f);
}

void main() {
  vec4 color = texture(frame, uv);
  color = adjustSaturation(color, saturation);
  color = adjustBrightness(color, brightness);
  color = adjustContrast(color, contrast);

  fragColor = color;
}
