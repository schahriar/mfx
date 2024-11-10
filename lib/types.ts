/**
 * @group Encode
 */
export interface MFXEncodedChunk {
  video?: {
    chunk: EncodedVideoChunk;
    metadata?: EncodedVideoChunkMetadata;
  };
  audio?: {
    chunk?: EncodedAudioChunk;
    metadata?: EncodedAudioChunkMetadata;
  };
}
