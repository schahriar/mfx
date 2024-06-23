declare interface EncodedVideoChunkInit {
  data: AllowSharedBufferSource;
  duration?: number | undefined;
  timestamp: number;
  type: EncodedVideoChunkType;
  transfer?: ArrayBuffer[];
}
