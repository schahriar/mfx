#version 300 es
precision mediump float;
precision mediump int;

in vec2 uv;
out vec4 fragColor;

uniform sampler2D frame;
uniform vec2 frameSize;

uniform mat3 kernel;

struct ConvSamples {
  mat3[3] c3x3;
};

ConvSamples createSamples(sampler2D sampler, vec2 uv) {
  ConvSamples s;
  // 3x3 sampling
  vec2 offsets3x3[9];
  vec4[9] areas3x3;
  offsets3x3[0] = vec2(-1.0f, 1.0f);
  offsets3x3[1] = vec2(0.0f, 1.0f);
  offsets3x3[2] = vec2(1.0f, 1.0f);
  offsets3x3[3] = vec2(-1.0f, 0.0f);
  offsets3x3[4] = vec2(0.0f, 0.0f);
  offsets3x3[5] = vec2(1.0f, 0.0f);
  offsets3x3[6] = vec2(-1.0f, -1.0f);
  offsets3x3[7] = vec2(0.0f, -1.0f);
  offsets3x3[8] = vec2(1.0f, -1.0f);

  for(int i = 0; i < 9; i++) {
    vec4 color = texture(sampler, uv + (offsets3x3[i] / frameSize));
    areas3x3[i] = color;
  }

  for(int i = 0; i < 3; i++) {
    s.c3x3[i] = mat3(areas3x3[0][i], areas3x3[1][i], areas3x3[2][i], areas3x3[3][i], areas3x3[4][i], areas3x3[5][i], areas3x3[6][i], areas3x3[7][i], areas3x3[8][i]);
  }

  return s;
}

float sumMat3(mat3 c) {
  float r = 0.0f;
  for(int i = 0; i < 3; i++) {
    for(int j = 0; j < 3; j++) {
      r += c[i][j];
    }
  }
  return r;
}

vec3 conv3x3(mat3 kernel, ConvSamples s) {
  vec3 fragment;

  for(int i = 0; i < 3; i++) {
    mat3 rc = s.c3x3[i];
    mat3 c = matrixCompMult(kernel, rc);

    fragment[i] = sumMat3(c);
  }

  return fragment;
}


void main() {
  vec4 color = texture(frame, uv);
  ConvSamples s = createSamples(frame, uv);

  fragColor = vec4(conv3x3(kernel, s), 1);
}
