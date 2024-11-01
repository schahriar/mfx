import { MFXTransformStream } from "../stream";

export enum MFXTrackType {
  Video = "video",
  Audio = "audio",
};

export interface MFXVideoTrack<Sample> {
  id: string | number;
	type: MFXTrackType.Video;
	config: VideoDecoderConfig;
  // Unix milli
  createdAt?: number;
  duration: number; // Seconds
  toChunk: (sample: Sample) => EncodedVideoChunk;
};

export interface MFXAudioTrack<Sample> {
  id: string | number;
	type: MFXTrackType.Audio;
	config: AudioDecoderConfig;
  toChunk: (sample: Sample) => EncodedAudioChunk;
};

export type MFXTrack<Sample> = MFXVideoTrack<Sample> | MFXAudioTrack<Sample>;

export interface MFXDecodableTrackChunk<Sample> {
	track: MFXTrack<Sample>;
	samples: Sample[];
};

export abstract class ContainerDecoder<Sample> extends MFXTransformStream<
  Uint8Array,
  MFXDecodableTrackChunk<Sample>
>  {
  start: (_: MFXTrack<Sample>[]) => void;
  tracks: Promise<MFXTrack<Sample>[]>;
  constructor(
		transformer: Transformer<Uint8Array, MFXDecodableTrackChunk<Sample>> = {},
		writableStrategy: QueuingStrategy<Uint8Array> = new CountQueuingStrategy({
			highWaterMark: 60,
		}),
		readableStrategy: QueuingStrategy<MFXDecodableTrackChunk<Sample>> = new CountQueuingStrategy({
			highWaterMark: 60,
		})
  ) {
    super(transformer, writableStrategy, readableStrategy);

		this.tracks = new Promise<MFXTrack<Sample>[]>((resolve) => {
			this.start = resolve;
		});
  }
}