import * as twgl from "twgl.js";
import vertexShaderSource from "!!raw-loader!./shaders/vertex.glsl";
import compositorShaderSource from "!!raw-loader!./shaders/compositor.glsl";
import { MFXTransformStream } from "../stream";
import { ExtendedVideoFrame } from "../frame";

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

/**
 * @group Advanced
 */
export interface Layer {
  id: string;
  texture: ReadableStream<ExtendedVideoFrame>;
  textureSize: number[];
}

/**
 * @group Advanced
 */
export class Compositor extends MFXTransformStream<
  ExtendedVideoFrame,
  ExtendedVideoFrame
> {
  get identifier() {
    return "Compositor";
  }

  drained: boolean = false;

  constructor(
    pipeline: Layer[],
    canvas: HTMLCanvasElement = document.createElement("canvas"),
  ) {
    const gl = canvas.getContext("webgl2");
    const programmedPipeline: Record<
      string,
      {
        shaders: string[];
        layer: Layer;
      }
    > = pipeline.reduce(
      (accu, v) => ({
        ...accu,
        [v.id]: {
          shaders: [vertexShaderSource, compositorShaderSource],
          layer: v,
        },
      }),
      {},
    );
    const programInfos = twgl.createProgramInfos(gl, programmedPipeline);
    const paintProgramInfo = twgl.createProgramInfo(gl, [
      vertexShaderSource,
      compositorShaderSource,
    ]);

    const arrays = {
      texcoord: {
        numComponents: 2,
        data: [-1, -1, -1, +1, +1, +1, +1, -1],
      },
    };

    const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);
    let frameBufferInfo: twgl.FramebufferInfo;
    let textureIn: WebGLTexture;
    let textureOut: WebGLTexture;

    const attachTextureToFramebuffer = (texture: WebGLTexture) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, frameBufferInfo.framebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture,
        0,
      );
      checkStatus(gl);
    };

    super({
      transform: async (frame, controller) => {
        if (this.drained) {
          return controller.enqueue(frame);
        }

        const width = frame.displayWidth;
        const height = frame.displayHeight;
        canvas.width = width;
        canvas.height = height;

        if (!frameBufferInfo) {
          textureIn = twgl.createTexture(gl, {
            min: gl.NEAREST,
            mag: gl.NEAREST,
            wrapS: gl.CLAMP_TO_EDGE,
            wrapT: gl.CLAMP_TO_EDGE,
            width,
            height,
          });
          textureOut = twgl.createTexture(gl, {
            min: gl.NEAREST,
            mag: gl.NEAREST,
            wrapS: gl.CLAMP_TO_EDGE,
            wrapT: gl.CLAMP_TO_EDGE,
            width,
            height,
          });

          frameBufferInfo = twgl.createFramebufferInfo(
            gl,
            [textureIn],
            width,
            height,
          );

          // Clear frame only at start
          gl.clearColor(1.0, 0.0, 0.0, 1.0);
          gl.clear(gl.COLOR_BUFFER_BIT);
        }

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

        attachTextureToFramebuffer(textureIn);
        gl.viewport(0, 0, width, height);

        // Free resource after GPU draw
        frame.close();

        if (!Object.keys(programInfos).length) {
          this.drained = true;
        }

        await Promise.all(
          Object.keys(programInfos).map(async (programId, i) => {
            const programInfo = programInfos[programId];
            const { layer } = programmedPipeline[programId];
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, textureIn);
            attachTextureToFramebuffer(textureOut);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, (i + 1) % 2);
            gl.viewport(0, 0, width, height);

            gl.useProgram(programInfo.program);
            twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);

            const layerTexture = twgl.createTexture(gl, {
              min: gl.NEAREST,
              mag: gl.NEAREST,
              wrapS: gl.CLAMP_TO_EDGE,
              wrapT: gl.CLAMP_TO_EDGE,
              width,
              height,
            });
            const reader = layer.texture.getReader();
            const layerFrame = await reader.read();
            if (layerFrame.value) {
              gl.activeTexture(gl.TEXTURE1);
              gl.bindTexture(gl.TEXTURE_2D, layerTexture);
              gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                gl.RGBA,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                layerFrame.value,
              );
              layerFrame.done = true;
              layerFrame.value.close();
            } else {
              // Out of frames, remove step from pipeline
              delete programInfos[programId];
            }
            reader.releaseLock();

            twgl.setUniforms(programInfo, {
              frame: textureIn,
              frameSize: [width, height],
              layer: layerTexture,
              layerSize: layer,
            });
            twgl.drawBufferInfo(gl, bufferInfo, gl.TRIANGLE_FAN);

            [textureIn, textureOut] = [textureOut, textureIn];
          }),
        );

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, textureIn);

        gl.useProgram(paintProgramInfo.program);
        twgl.setBuffersAndAttributes(gl, paintProgramInfo, bufferInfo);
        twgl.setUniforms(paintProgramInfo, {
          frame: textureIn,
          frameSize: [width, height],
        });
        twgl.drawBufferInfo(gl, bufferInfo, gl.TRIANGLE_FAN);

        controller.enqueue(
          new VideoFrame(canvas, { timestamp: frame.timestamp }),
        );
      },
    });
  }
}
