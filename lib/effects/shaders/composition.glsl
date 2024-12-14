#version 300 es
precision mediump float;
precision mediump int;

in vec2 uv;
out vec4 fragColor;

uniform sampler2D frame;
uniform vec2 frameSize;

uniform sampler2D layer;
uniform vec2 layerSize;

// Weights for different blend modes
uniform float normal;
uniform float additive;
uniform float multiply;
uniform float screen;

void main() {
  vec4 baseColor = texture(frame, uv);
  vec2 luv = (uv * frameSize ) / layerSize;

  vec4 layerColor = texture(layer, luv);

  vec4 normalBlend = baseColor * (1.0 - layerColor.a) + layerColor * layerColor.a;
  vec4 additiveBlend = baseColor + layerColor;
  vec4 multiplyBlend = baseColor * layerColor;
  vec4 screenBlend = 1.0 - (1.0 - baseColor) * (1.0 - layerColor);

  fragColor = normal * normalBlend +
              additive * additiveBlend +
              multiply * multiplyBlend +
              screen * screenBlend;

  // Prevent clipping using clamp
  fragColor = clamp(fragColor, 0.0, 1.0);
}
