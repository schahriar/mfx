import * as twgl from "twgl.js";
import vertexShaderSource from "!!raw-loader!./shaders/vertex.glsl";
import paintShaderSource from "!!raw-loader!./shaders/paint.glsl";
import { MFXTransformStream } from "../stream";
import { ExtendedVideoFrame } from "../frame";
import type { Uniform } from "./shaders";

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

const resolveUniforms = (o: any, frame: ExtendedVideoFrame) => {
	if (["string", "number", "boolean"].includes(typeof o)) {
		return o;
	}

	if (typeof o === "function") {
		return o(frame);
	}

	if (Array.isArray(o)) {
		return o.map((v) => resolveUniforms(v, frame));
	}

	throw new Error(`Invalid uniform type ${typeof o}`);
};

/** @group Effects */
export class MFXGLEffect extends MFXTransformStream<
	ExtendedVideoFrame,
	ExtendedVideoFrame
> {
	get identifier() {
		return "MFXGLEffect";
	}

	constructor(
		pipeline: Effect[],
		canvas: HTMLCanvasElement = document.createElement("canvas"),
		writableStrategy?: QueuingStrategy<ExtendedVideoFrame>,
		readableStrategy?: QueuingStrategy<ExtendedVideoFrame>,
	) {
		const gl = canvas.getContext("webgl2");
		const programmedPipeline = pipeline.reduce(
			(accu, v, i) => ({
				...accu,
				[i]: {
					shaders: [vertexShaderSource, v.shader],
					uniforms: v.uniforms,
				},
			}),
			{},
		);
		const programInfos = twgl.createProgramInfos(gl, programmedPipeline);
		const paintProgramInfo = twgl.createProgramInfo(gl, [
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

		super(
			{
				transform: async (frame, controller) => {
					const width = frame.displayWidth;
					const height = frame.displayHeight;
					canvas.width = width;
					canvas.height = height;

					gl.pixelStorei(
						gl.UNPACK_FLIP_Y_WEBGL,
						Object.keys(programInfos).length % 2,
					);

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

					// Free resource after GPU paint
					frame.close();

					Object.keys(programInfos).map((programId) => {
						const programInfo = programInfos[programId];
						const pipeline = programmedPipeline[programId];
						gl.activeTexture(gl.TEXTURE0);
						gl.bindTexture(gl.TEXTURE_2D, textureIn);
						attachTextureToFramebuffer(textureOut);
						gl.viewport(0, 0, width, height);

						const uniforms = Object.keys(pipeline.uniforms || {}).reduce(
							(accu, key) => ({
								...accu,
								[key]: resolveUniforms(pipeline.uniforms[key], frame),
							}),
							{},
						);

						gl.useProgram(programInfo.program);
						twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
						twgl.setUniforms(programInfo, {
							...uniforms,
							frame: textureIn,
							frameSize: [width, height],
						});
						twgl.drawBufferInfo(gl, bufferInfo, gl.TRIANGLE_FAN);

						[textureIn, textureOut] = [textureOut, textureIn];
					});

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

					controller.enqueue(ExtendedVideoFrame.revise(frame, canvas));
				},
			},
			writableStrategy,
			readableStrategy,
		);
	}
}
