import { MFXTransformStream } from "../stream";
import type { GenericTrack } from "./Track";
export interface MFXDecodableTrackChunk<Sample> {
  track: GenericTrack<Sample>;
  samples: Sample[];
}

export abstract class ContainerDecoder<Sample> extends MFXTransformStream<
  Uint8Array,
  MFXDecodableTrackChunk<Sample>
> {
  start: (_: GenericTrack<Sample>[]) => void;
  tracks: Promise<GenericTrack<Sample>[]>;
  constructor(
    transformer: Transformer<Uint8Array, MFXDecodableTrackChunk<Sample>> = {},
    writableStrategy: QueuingStrategy<Uint8Array> = new CountQueuingStrategy({
      highWaterMark: 60,
    }),
    readableStrategy: QueuingStrategy<
      MFXDecodableTrackChunk<Sample>
    > = new CountQueuingStrategy({
      highWaterMark: 60,
    }),
  ) {
    super(transformer, writableStrategy, readableStrategy);

    this.tracks = new Promise<GenericTrack<Sample>[]>((resolve) => {
      this.start = resolve;
    });
  }
}
