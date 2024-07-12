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
  // Calculate the offset from the zoom position based on the zoom factor
  vec2 zoomedCoord = (uv - position) / zoomFactor + position;

  // Sample the texture with the new coordinates
  fragColor = texture(frame, zoomedCoord);
}
