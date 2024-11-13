import type { ExtendedVideoFrame } from "./frame";

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

export type GenericData = ExtendedVideoFrame | AudioData;
