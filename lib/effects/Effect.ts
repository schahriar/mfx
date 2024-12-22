import * as twgl from "twgl.js";
import vertexShaderSource from "!!raw-loader!./shaders/vertex.glsl";
import paintShaderSource from "!!raw-loader!./shaders/paint.glsl";
import { MFXTransformStream } from "../stream";
import { ExtendedVideoFrame } from "../frame";
import type { Uniform, UniformProducer } from "./shaders";
import { mat4 } from "gl-matrix";

const identity = mat4.create();
mat4.identity(identity);

export type BoundTextureTransformer = (
  gl: WebGL2RenderingContext,
  type: "frameIn" | "frameOut" | "uniform",
  key: string,
  v: WebGLTexture,
) => void;

export type Uniforms =
  | Record<string, Uniform<any>>
  | ((frame: VideoFrame) => Promise<Record<string, Uniform<any>>>);

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

export const u = async <T>(
  o: Uniform<T>,
  frame: ExtendedVideoFrame,
): Promise<T> => {
  if (["string", "number", "boolean"].includes(typeof o)) {
    return o as T;
  }

  if (typeof o === "function") {
    return (o as UniformProducer<T>)(frame);
  }

  if (Array.isArray(o)) {
    return Promise.all((o as any).map((v) => u(v, frame))) as T;
  }

  if (o instanceof VideoFrame || o instanceof ExtendedVideoFrame) {
    return o;
  }

  throw new Error(`Invalid uniform type ${typeof o}`);
};

export class MFXGLHandle {
  frame: VideoFrame;
  context: MFXGLContext;
  textures: number[];
  closed: boolean;
  busy: number;
  // Dirty handles don't clear buffer between paints
  isDirty: boolean = false;

  constructor(frame: VideoFrame, context: MFXGLContext) {
    this.context = context;
    this.frame = frame;
    const { gl, frameBufferInfo, textureIn } = context;

    twgl.bindFramebufferInfo(gl, frameBufferInfo);
    gl.bindTexture(gl.TEXTURE_2D, textureIn);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame);

    // 8 textures are guaranteed by WebGL
    // this is a theoretical minimum and browsers support significantly higher
    // texture counts but 8 textures should cover all use-cases for MFX
    this.textures = [
      gl.TEXTURE1,
      gl.TEXTURE2,
      gl.TEXTURE3,
      gl.TEXTURE4,
      gl.TEXTURE5,
      gl.TEXTURE6,
      gl.TEXTURE7,
    ];

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

  async paint(
    programInfo: twgl.ProgramInfo,
    uniforms: Uniforms,
    {
      transformBoundTexture = (ctx, type, key, v) => v,
    }: {
      transformBoundTexture?: BoundTextureTransformer;
    } = {},
  ) {
    if (this.busy > 0) {
      throw new Error(
        "Encountered a busy MFXGLHandle. GL paints in MFX are not allowed to paint more than one frame per stream in order to re-use the framebuffer.",
      );
    }

    this.busy++;
    const { gl, textureIn, textureOut, bufferInfo } = this.context;

    let resolvedUniforms = {};
    let openFrames = new Set<VideoFrame>();
    const inputUniforms =
      typeof uniforms === "function" ? await uniforms(this.frame) : uniforms;

    await Promise.all(
      Object.keys(inputUniforms || {}).map(async (key) => {
        const value = await u(inputUniforms[key], this.frame);
        resolvedUniforms[key] = value;
      }),
    );

    // Bind any textures assigned to uniforms
    Object.keys(resolvedUniforms)
      .filter(
        (k) =>
          resolvedUniforms[k] instanceof VideoFrame ||
          resolvedUniforms[k] instanceof ExtendedVideoFrame,
      )
      .forEach((key: string, i) => {
        const frame = resolvedUniforms[key] as VideoFrame;
        const textureUnit = this.textures[i];

        if (!textureUnit) {
          throw new Error(
            `Attempted to bind too many textures, total textures supported by MFX are capped at ${this.textures.length}`,
          );
        }

        const texture = twgl.createTexture(gl, {
          min: gl.NEAREST,
          mag: gl.NEAREST,
          wrapS: gl.CLAMP_TO_EDGE,
          wrapT: gl.CLAMP_TO_EDGE,
          width: frame.displayWidth,
          height: frame.displayHeight,
        });

        gl.activeTexture(textureUnit);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          frame,
        );
        transformBoundTexture(gl, "uniform", key, texture);

        resolvedUniforms[key] = texture;

        if (!(frame as ExtendedVideoFrame).properties?.keepOpen) {
          openFrames.add(frame);
        }
      });

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textureIn);
    this.resetBoundTexture();
    transformBoundTexture(gl, "frameIn", "", textureIn);

    this.context.attachTextureToFramebuffer(textureOut);
    this.resetBoundTexture();
    transformBoundTexture(gl, "frameOut", "", textureOut);
    if (!this.isDirty) {
      this.context.clear();
    }

    gl.useProgram(programInfo.program);
    twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
    twgl.setUniforms(programInfo, {
      transform: identity,
      ...resolvedUniforms,
      frame: textureIn,
      frameSize: [this.frame.displayWidth, this.frame.displayHeight],
      MFXInternalFlipY: 0,
    });
    twgl.drawBufferInfo(gl, bufferInfo, gl.TRIANGLE_FAN);

    // Swap textures
    [this.context.textureIn, this.context.textureOut] = [textureOut, textureIn];

    [...openFrames].forEach((frame) => frame.close());
    this.busy--;
  }

  resetBoundTexture() {
    const { gl } = this.context;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  // Draw action
  close() {
    if (this.busy > 0) {
      console.error("Attempted to close a busy MFXGLHandle");
      throw new Error("Attempted to close a busy MFXGLHandle");
    }

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
      MFXInternalFlipY: 1,
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
      premultipliedAlpha: false,
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
      mag: gl.NEAREST,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
      width,
      height,
    });
    this.textureOut = twgl.createTexture(gl, {
      min: gl.NEAREST,
      mag: gl.NEAREST,
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
  }
}

export class MFXGLEffect extends MFXTransformStream<MFXGLHandle, MFXGLHandle> {
  get identifier() {
    return "MFXGLEffect";
  }

  constructor(
    shader: string,
    uniforms: Uniforms = {},
    {
      isDirty = false,
      transformBoundTexture,
    }: {
      transformBoundTexture?: BoundTextureTransformer;
      isDirty?: boolean;
    } = {},
  ) {
    let program: twgl.ProgramInfo;

    super(
      {
        transform: async (handle, controller) => {
          if (!program) {
            program = handle.compile(shader);
          }

          if (isDirty) {
            handle.dirty();
          } else {
            handle.clean();
          }

          try {
            await handle.paint(program, uniforms, {
              transformBoundTexture,
            });
          } catch (e) {
            controller.error(e);
            return;
          }

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

  constructor() {
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
      // Allow up to 1 minute of 60fps frames to buffer waiting for effects pipeline
      // TODO: Make this configurable, needed for composing async effects without dropping frames
      new CountQueuingStrategy({ highWaterMark: 60 * 60 }),
      new CountQueuingStrategy({ highWaterMark: 1 }),
    );
  }
}

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
}

export const effect = (
  input: ReadableStream<VideoFrame>,
  effects: MFXTransformStream<MFXGLHandle, MFXGLHandle>[][],
  {
    trim = {},
    writableStrategy,
    readableStrategy,
  }: {
    trim?: {
      // Inclusive number of milliseconds to start cutting from (supports for microsecond fractions)
      start?: number;
      // Exclusive number of milliseconds to cut to (supports for microsecond fractions)
      end?: number;
    };
    writableStrategy?: QueuingStrategy<any>;
    readableStrategy?: QueuingStrategy<any>;
  } = {},
) => {
  // Converts VideoFrames to a WebGL2 handle (framebuffer)
  const stream = new FrameToGL() as TransformStream;
  const effectPipeline: ReadableStream<VideoFrame> = effects
    .flat()
    .reduce((accu, effect) => accu.pipeThrough(effect), stream.readable)
    .pipeThrough(
      // Converts framebuffers back to VideoFrame
      new GLToFrame(writableStrategy, readableStrategy),
    );

  const trimPipeline = new TransformStream<VideoFrame, VideoFrame>({
    transform: async (frame, controller) => {
      if (
        frame.timestamp / 1e3 < (trim.start || 0) ||
        (trim.end > 0 && frame.timestamp / 1e3 > trim.end)
      ) {
        controller.enqueue(frame);
        return;
      }

      const writer = stream.writable.getWriter();
      const reader = effectPipeline.getReader();
      writer.write(frame);

      const { value } = await reader.read();

      controller.enqueue(value);

      writer.releaseLock();
      reader.releaseLock();
    },
    flush: async () => {
      await stream.writable.close();
    },
  });

  return input.pipeThrough(trimPipeline);
};
