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
uniform float alpha;

uniform vec2 offset;

void main() {
  vec4 baseColor = texture(frame, uv);
  vec2 luv = (uv - offset) * (frameSize / layerSize) + offset;

  vec4 layerColor = texture(layer, luv);
  float layerAlpha = layerColor.a;

  vec4 normalBlend = mix(baseColor, layerColor, layerAlpha);
  vec4 additiveBlend = baseColor + layerColor * layerAlpha;
  vec4 multiplyBlend = mix(baseColor, baseColor * layerColor, layerAlpha);
  vec4 screenBlend = mix(baseColor, 1.0 - (1.0 - baseColor) * (1.0 - layerColor), layerAlpha);
  vec4 alphaBlend = mix(baseColor, layerColor, 1.0 - baseColor.a);

  vec4 mixedColor = normal * normalBlend +
              additive * additiveBlend +
              multiply * multiplyBlend +
              screen * screenBlend +
              alpha * alphaBlend;


  float outOfBounds = max(
    max(step(1.0, luv.x), step(1.0, luv.y)),
    max(step(0.0, -luv.x), step(0.0, -luv.y))
  );

  mixedColor = mix(mixedColor, baseColor, outOfBounds);

  // Prevent clipping using clamp
  fragColor = clamp(mixedColor, 0.0, 1.0);
}
