import * as twgl from "twgl.js";
import vertexShaderSource from "!!raw-loader!./shaders/vertex.glsl";
import paintShaderSource from "!!raw-loader!./shaders/paint.glsl";
import { MFXTransformStream } from "../stream";
import { ExtendedVideoFrame } from "../frame";
import type { Uniform, UniformProducer } from "./shaders";
import { mat4 } from "gl-matrix";

const identity = mat4.create();
mat4.identity(identity);

const checkStatus = (gl: WebGL2RenderingContext) => {
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    switch (status) {
      case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
        console.error(
          "Framebuffer incomplete: FRAMEBUFFER_INCOMPLETE_ATTACHMENT",
        );
        break;
      case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
        console.error(
          "Framebuffer incomplete: FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT",
        );
        break;
      case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
        console.error(
          "Framebuffer incomplete: FRAMEBUFFER_INCOMPLETE_DIMENSIONS",
        );
        break;
      case gl.FRAMEBUFFER_UNSUPPORTED:
        console.error("Framebuffer incomplete: FRAMEBUFFER_UNSUPPORTED");
        break;
      default:
        console.error("Framebuffer incomplete: Unknown error");
    }
  }
};

/** @group Effects */
export interface Effect<T = any> {
  shader: string;
  uniforms?: Record<string, Uniform<T>>;
}

export const u = <T>(o: Uniform<T>, frame: ExtendedVideoFrame): T => {
  if (["string", "number", "boolean"].includes(typeof o)) {
    return o as T;
  }

  if (typeof o === "function") {
    return (o as UniformProducer<T>)(frame);
  }

  if (Array.isArray(o)) {
    return (o as any).map((v) => u(v, frame)) as T;
  }

  throw new Error(`Invalid uniform type ${typeof o}`);
};

export class MFXGLHandle {
  frame: VideoFrame;
  context: MFXGLContext;
  closed: boolean;
  // Dirty handles don't clear buffer between paints
  isDirty: boolean = false;
  private flips: number = 0;
  private paintCount: number = 0;

  constructor(frame: VideoFrame, context: MFXGLContext) {
    this.context = context;
    this.frame = frame;

    const { gl, frameBufferInfo, textureIn } = context;

    twgl.bindFramebufferInfo(gl, frameBufferInfo);
    gl.bindTexture(gl.TEXTURE_2D, textureIn);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      frame,
    );

    context.attachTextureToFramebuffer(textureIn);
  }

  compile(shader: string) {
    return twgl.createProgramInfo(this.context.gl, [
      vertexShaderSource,
      shader,
    ]);
  }

  dirty() {
    this.isDirty = true;
  }

  clean() {
    this.isDirty = false;
  }

  paint(programInfo: twgl.ProgramInfo, uniforms: Record<string, any>) {
    const { gl, textureIn, textureOut, bufferInfo } = this.context;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textureIn);
    this.context.attachTextureToFramebuffer(textureOut);
    if (!this.isDirty) {
      this.context.clear();
    }

    const resolvedUniforms = Object.keys(uniforms || {}).reduce(
      (accu, key) => ({
        ...accu,
        [key]: u(uniforms[key], this.frame),
      }),
      {},
    );

    const MFXInternalFlipY = this.paintCount % 2 ? 1 : 0;
    if (MFXInternalFlipY) {
      this.flips++;
    }

    gl.useProgram(programInfo.program);
    twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
    twgl.setUniforms(programInfo, {
      transform: identity,
      ...resolvedUniforms,
      frame: textureIn,
      frameSize: [this.frame.displayWidth, this.frame.displayHeight],
      MFXInternalFlipY,
    });
    twgl.drawBufferInfo(gl, bufferInfo, gl.TRIANGLE_FAN);

    // Swap textures
    [this.context.textureIn, this.context.textureOut] = [textureOut, textureIn];

    // Increment paint count
    this.paintCount++;
  }

  // Draw action
  close() {
    if (this.closed) {
      throw new Error("Attempted to close an already closed MFXGLHandle");
    }

    this.closed = true;

    // Free resource after GPU paint
    this.frame.close();

    const { gl, bufferInfo, paintProgramInfo, textureIn } = this.context;
    const { width, height } = gl.canvas;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textureIn);

    gl.useProgram(paintProgramInfo.program);
    twgl.setBuffersAndAttributes(gl, paintProgramInfo, bufferInfo);
    twgl.setUniforms(paintProgramInfo, {
      frame: textureIn,
      frameSize: [width, height],
      transform: identity,
      MFXInternalFlipY: this.flips % 2 ? 0 : 1,
    });
    twgl.drawBufferInfo(gl, bufferInfo, gl.TRIANGLE_FAN);

    return ExtendedVideoFrame.revise(this.frame, gl.canvas);
  }
}


export class MFXGLContext {
  gl: WebGL2RenderingContext;
  paintProgramInfo: twgl.ProgramInfo;
  bufferInfo: twgl.BufferInfo;
  frameBufferInfo: twgl.FramebufferInfo;
  textureIn: WebGLTexture;
  textureOut: WebGLTexture;

  constructor(width: number, height: number) {
    const canvas = new OffscreenCanvas(width, height);
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      desynchronized: true,
      depth: true,
      preserveDrawingBuffer: true,
    }) as WebGL2RenderingContext;

    this.gl = gl;

    this.paintProgramInfo = twgl.createProgramInfo(gl, [
      vertexShaderSource,
      paintShaderSource,
    ]);

    const arrays = {
      texcoord: {
        numComponents: 2,
        data: [
          // x, y
          -1,
          -1, // Bottom-left corner (flipped)
          -1,
          +1, // Top-left corner (flipped)
          +1,
          +1, // Top-right corner (flipped)
          +1,
          -1, // Bottom-right corner (flipped)
        ],
      },
    };

    this.bufferInfo = twgl.createBufferInfoFromArrays(this.gl, arrays);

    this.textureIn = twgl.createTexture(gl, {
      min: gl.NEAREST,
      mag: gl.LINEAR,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
      width,
      height,
    });
    this.textureOut = twgl.createTexture(gl, {
      min: gl.NEAREST,
      mag: gl.LINEAR,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
      width,
      height,
    });

    this.frameBufferInfo = twgl.createFramebufferInfo(
      gl,
      [this.textureIn],
      width,
      height,
    );

    // Clear frame
    this.clear();
  }

  clear() {
    const { gl } = this;
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  attachTextureToFramebuffer(texture: WebGLTexture) {
    const { gl, frameBufferInfo } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBufferInfo.framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0,
    );
    checkStatus(gl);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  };
};

export class MFXGLEffect extends MFXTransformStream<
  MFXGLHandle,
  MFXGLHandle
> {
  get identifier() {
    return "MFXGLEffect";
  }

  constructor(shader: string, uniforms: Record<string, Uniform<any>> = {}, {
    isDirty = false
  }: {
    isDirty?: boolean;
  } = {}) {
    let program: twgl.ProgramInfo;

    super(
      {
        transform: async (handle, controller) => {
          if (!program) {
            program = handle.compile(shader);
          }

          if (isDirty) {
            handle.dirty();
          }

          handle.paint(program, uniforms);

          controller.enqueue(handle);
        },
      },
      // Only framebuffer at a time can be processed, this cannot change
      new CountQueuingStrategy({ highWaterMark: 1 }),
      new CountQueuingStrategy({ highWaterMark: 1 }),
    );
  }
}

/** @group Effects */
export class FrameToGL extends MFXTransformStream<
  ExtendedVideoFrame,
  MFXGLHandle
> {
  get identifier() {
    return "FrameToGL";
  }

  constructor(
    writableStrategy?: QueuingStrategy<ExtendedVideoFrame>,
    readableStrategy?: QueuingStrategy<MFXGLHandle>,
  ) {
    let context: MFXGLContext;
    super(
      {
        transform: async (frame, controller) => {
          if (!context) {
            context = new MFXGLContext(frame.displayWidth, frame.displayHeight);
          }
          const handle = new MFXGLHandle(frame, context);
          controller.enqueue(handle);
        },
      },
      writableStrategy,
      readableStrategy,
    );
  }
};

/** @group Effects */
export class GLToFrame extends MFXTransformStream<
  MFXGLHandle,
  ExtendedVideoFrame
> {
  get identifier() {
    return "GLToFrame";
  }

  constructor(
    writableStrategy?: QueuingStrategy<MFXGLHandle>,
    readableStrategy?: QueuingStrategy<ExtendedVideoFrame>,
  ) {
    super(
      {
        transform: async (handle, controller) => {
          controller.enqueue(handle.close());
        },
      },
      writableStrategy,
      readableStrategy,
    );
  }
};

export const effect = (input: ReadableStream<VideoFrame>, effects: MFXTransformStream<MFXGLHandle, MFXGLHandle>[][], {
  writableStrategy,
  readableStrategy
}: {
  writableStrategy?: QueuingStrategy<any>,
  readableStrategy?: QueuingStrategy<any>,
} = {}) => {
  // Converts VideoFrames to a WebGL2 handle (framebuffer)
  const stream = new FrameToGL(writableStrategy, readableStrategy) as TransformStream;

  return effects.flat().reduce((accu, effect) =>
    accu.pipeThrough(effect),
    input.pipeThrough(stream) // Pipe to starting stream
  ).pipeThrough(
    // Converts framebuffers back to VideoFrame
    new GLToFrame(writableStrategy, readableStrategy)
  );
};
