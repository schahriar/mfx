export interface ContainerEncoderConfig {
  video?: VideoEncoderConfig;
  audio?: AudioEncoderConfig;
  // Configure whether encoding is meant for livestreaming or storage
  streaming?: boolean;
};
