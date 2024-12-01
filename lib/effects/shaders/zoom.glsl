#version 300 es
precision mediump float;
precision mediump int;
in vec2 uv;
out vec4 fragColor;

uniform sampler2D frame;
uniform vec2 frameSize;
uniform float zoomFactor;
uniform vec2 position;

void main() {
  // Adjust coordinates where top, left = 0, 0
  float adjustedY = position.y;
  vec2 calculatedPosition = vec2(position.x, adjustedY);
  // Calculate the offset from the zoom position based on the zoom factor
  vec2 zoomedCoord = (uv - calculatedPosition) / zoomFactor + calculatedPosition;

  vec4 color = texture(frame, zoomedCoord);

  // Set alpha channel to 0 if the zoom factor is below 1 and the coordinates are outside the zoomed area
  // Calculate the mask for the alpha channel using step functions
  float isZoomedOut = step(0.0, 1.0 - zoomFactor);
  float isInsideX = step(0.0, zoomedCoord.x) * step(zoomedCoord.x, 1.0);
  float isInsideY = step(0.0, zoomedCoord.y) * step(zoomedCoord.y, 1.0);
  float mask = mix(isInsideX * isInsideY, 1.0, 1.0 - isZoomedOut);

  // Apply the mask to the alpha channel
  color.a *= mask;

  fragColor = color;
}
