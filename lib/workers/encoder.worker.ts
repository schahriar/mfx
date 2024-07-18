import { StreamCloser, useStream, accept } from "./comm";
import { MFXVideoEncoder } from "../encode";

const { config } = await accept<{ config: VideoEncoderConfig }>(self);

useStream().pipeThrough(new MFXVideoEncoder(config)).pipeTo(new StreamCloser());
