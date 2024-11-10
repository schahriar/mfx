/** @group Stream */
export class MFXBlob extends Blob {
  position?: number;
  videoEncodingConfig: VideoEncoderConfig;
  constructor(
    parts: BlobPart[],
    opt: BlobPropertyBag & {
      position?: number;
      videoEncodingConfig: VideoEncoderConfig;
    },
  ) {
    super(parts, opt);
    this.position = opt.position;
    this.videoEncodingConfig = opt.videoEncodingConfig;
  }

  getMimeType() {
    return `${this.type}; codecs="${this.videoEncodingConfig.codec}"`;
  }
}