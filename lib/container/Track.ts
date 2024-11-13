export enum TrackType {
  Video = "video",
  Audio = "audio",
}

export interface VideoTrack<Sample> {
  id: string | number;
  type: TrackType.Video;
  config: VideoDecoderConfig;
  // Unix milli
  createdAt?: number;
  duration: number; // Seconds
  toChunk: (sample: Sample) => EncodedVideoChunk;
}

export interface AudioTrack<Sample> {
  id: string | number;
  type: TrackType.Audio;
  config: AudioDecoderConfig;
  toChunk: (sample: Sample) => EncodedAudioChunk;
}

export type GenericTrack<Sample> = VideoTrack<Sample> | AudioTrack<Sample>;

export class Track<T> extends ReadableStream<T> {
  _track: GenericTrack<T>;

  constructor(track: GenericTrack<T>, stream: ReadableStream<T>) {
    const reader = stream.getReader();

    super({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }

        controller.enqueue(value);
      },
      cancel(reason) {
        reader.cancel(reason);
      },
    });

    this._track = track;
  }

  get track() {
    return this._track;
  }
}
