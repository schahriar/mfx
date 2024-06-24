#version 300 es
precision mediump float;
precision mediump int;
in vec2 uv;
out vec4 fragColor;

uniform sampler2D frame;
uniform vec2 frameSize;
uniform float zoomFactor;

void main() {
  // Calculate the center of the texture
  vec2 center = vec2(0.5, 0.5);

  // Calculate the offset from the center based on the zoom factor
  vec2 zoomedCoord = (uv - center) / zoomFactor + center;

  // Sample the texture with the new coordinates
  fragColor = texture(frame, zoomedCoord);
}
