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

/** Provided a canvas frame, produces a new frame or enqueues null.
- Note that a FrameProducer stream should not produce more than 1 frame per frame 
*/
export type FrameProducer =
  | ReadableStream<VideoFrame>
  | TransformStream<VideoFrame, VideoFrame>;

export type GenericData = ExtendedVideoFrame | AudioData;
