import { StreamCloser, useStream, accept } from "./comm";
import { MFXVideoDecoder } from "../decode";

await accept(self);

useStream().pipeThrough(new MFXVideoDecoder()).pipeTo(new StreamCloser());
