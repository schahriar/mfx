import type { ContainerEncoderConfig } from "./container/encoderConfig";

/** @group Stream */
export class MFXBlob extends Blob {
  position?: number;
  config: ContainerEncoderConfig;
  constructor(
    parts: BlobPart[],
    opt: BlobPropertyBag & {
      position?: number;
      config: ContainerEncoderConfig;
    },
  ) {
    super(parts, opt);
    this.position = opt.position;
    this.config = opt.config;
  }

  getMimeType() {
    const { video, audio } = this.config;
    return `${this.type}; codecs="${[video?.codec, audio?.codec].filter(Boolean).join(",")}"`;
  }
}