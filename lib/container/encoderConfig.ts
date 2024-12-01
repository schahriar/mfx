export interface ContainerEncoderConfig {
  video?: VideoEncoderConfig;
  audio?: AudioEncoderConfig;
  // Buffer size of encoder before a chunk is streamed, may not be respected by every container encoder
  chunkSize?: number;
  // Configure whether encoding is meant for livestreaming or storage
  streaming?: boolean;
};
