import MP4Box, { type MP4ArrayBuffer, type MP4Sample } from "mp4box";
import { getVideoBoxDescription } from "./utils";
import { ContainerDecoder } from "../ContainerDecoder";
import { type AudioTrack, TrackType, type VideoTrack } from "../Track";
import { getESDSBoxFromMP4File, parseAudioInfo4ESDSBox } from "./ESDS";

/**
 * @group Decode
 */
export class MP4ContainerDecoder extends ContainerDecoder<MP4Sample> {
  get identifier() {
    return "MP4ContainerDecoder";
  }

  constructor({ seek }: { seek: number }) {
    const file = MP4Box.createFile();
    let position = 0;

    super({
      transform: async (chunk) => {
        const buffer = chunk.buffer as MP4ArrayBuffer;
        buffer.fileStart = position;
        position += buffer.byteLength;
        file.appendBuffer(buffer);
      },
      flush: async () => {
        await this.tracks;
        file.flush();
      },
    });

    file.onError = (err) => this.dispatchError(new Error(err));
    file.onSamples = async (id, user, samples) => {
      const tracks = await this.tracks;
      const track = tracks.find((track) => track.id === id);

      this.queue({
        track,
        samples,
      });
    };
    file.onReady = (info) => {
      // TODO: Support multiple video tracks?
      const videoTrack = info.videoTracks?.[0];
      const audioTracks = info.audioTracks;
      const esdsBox = getESDSBoxFromMP4File(file);
      const { numberOfChannels, sampleRate } = parseAudioInfo4ESDSBox(esdsBox);

      const processedVideoTrack: VideoTrack<MP4Sample> | null = videoTrack
        ? {
            id: videoTrack.id,
            type: TrackType.Video,
            duration: videoTrack.duration / videoTrack.timescale,
            createdAt: videoTrack.created.getTime(),
            config: {
              codec: videoTrack.codec,
              codedHeight: videoTrack.video.height,
              codedWidth: videoTrack.video.width,
              description: getVideoBoxDescription(
                file.getTrackById(videoTrack.id),
              ),
            },
            toChunk: (sample) => {
              const chunk = new EncodedVideoChunk({
                type: sample.is_sync ? "key" : "delta",
                timestamp: (1e6 * sample.cts) / sample.timescale,
                duration: (1e6 * sample.duration) / sample.timescale,
                data: sample.data.buffer,
                transfer: [sample.data.buffer],
              });

              // Free memory
              file.releaseUsedSamples(videoTrack.id, sample.number);

              return chunk;
            },
          }
        : null;

      const processedAudioTracks = audioTracks.map<AudioTrack<MP4Sample>>(
        (track) => ({
          id: track.id,
          type: TrackType.Audio,
          duration: track.duration / track.timescale,
          createdAt: track.created.getTime(),
          config: {
            /** @see: https://www.w3.org/TR/webcodecs-aac-codec-registration/ */
            codec: track.codec,
            /** @note numberOfChannels and sampleRate defaults are based on open issue with mp4box.js https://github.com/gpac/mp4box.js/issues/376 */
            numberOfChannels: numberOfChannels || track.audio.channel_count,
            sampleRate: sampleRate || track.audio.sample_rate,
            // description: esdsBox, // TODO: remux for AAC support
          },
          toChunk: (sample) =>
            new EncodedAudioChunk({
              // TODO: Audio is continous in majority of encodings, see if this can be removed for all MP4 audio encodings
              type: sample.is_sync ? "key" : "delta",
              data: sample.data.buffer,
              timestamp: sample.cts,
              duration: (1e6 * sample.duration) / sample.timescale,
            }),
        }),
      );

      const tracks = [
        /**
         * @note
         * Skip video if not available to support
         * audio only (m4a) files
         */
        ...(processedVideoTrack ? [processedVideoTrack] : []),
        ...(processedAudioTracks ? processedAudioTracks : []),
      ];

      this.start(tracks);

      tracks.forEach((track) => {
        file.setExtractionOptions(track.id as number);
      });

      if (seek) {
        file.seek(seek / 1000);
      }

      file.start();
    };
  }
}
