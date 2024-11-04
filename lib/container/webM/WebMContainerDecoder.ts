import JsWebm from "jswebm";
import { ContainerDecoder, type MFXAudioTrack, MFXTrackType, type MFXVideoTrack } from "../ContainerDecoder";
import { next } from "../../utils";

/**
 * @group Decode
 */
export class WebMContainerDecoder extends ContainerDecoder<any> {
  get identifier() {
    return "WebMContainerDecoder";
  }

  constructor({
    videoCodec = "vp8",
    audioCodec = ""
  }) {
    const demuxer = new JsWebm();

    super({
      transform: async (chunk) => {
        demuxer.queueData(chunk.buffer);
      },
      flush: async () => {
        while (!demuxer.videoTrack && !demuxer.eof) {
          await demuxer.demux();
        }
        let videoCursor = 0;
        let audioCursor = 0;

        const { videoTrack, audioTrack } = demuxer;

        const processedVideoTrack: MFXVideoTrack<any> | null = videoTrack ? {
          id: videoTrack.trackUID,
          type: MFXTrackType.Video,
          duration: 0,
          config: {
            codec: videoCodec,
            codedHeight: videoTrack.height,
            codedWidth: videoTrack.width,
          },
          toChunk: (sample) => new EncodedVideoChunk({
            type: sample.isKeyframe ? "key" : "delta",
            timestamp: sample.timestamp * demuxer.segmentInfo.timecodeScale,
            data: sample.data,
            transfer: [sample.data],
          })
        } : null;

        const processedAudioTrack: MFXAudioTrack<any> | null = audioTrack ? {
          id: audioTrack.trackUID,
          type: MFXTrackType.Audio,
          config: {
            codec: audioCodec || demuxer.audioCodec,
            numberOfChannels: audioTrack.channels,
            sampleRate: audioTrack.rate,
          },
          toChunk: (sample) => new EncodedAudioChunk({
            type: "key",
            data: sample.data,
            timestamp: sample.timestamp * demuxer.segmentInfo.timecodeScale,
          })
        } : null;

        const tracks = [
          /**
           * @note
           * Skip video if not available to support
           * audio only (m4a) files
           */
          ...processedVideoTrack ? [processedVideoTrack] : [],
          ...processedAudioTrack ? [processedAudioTrack] : [],
        ];

        this.start(tracks);

        while (!demuxer.eof) {
          await demuxer.demux();
          await next(0);

          if (!this.desiredSize) {
            await next(0);
            continue;
          }

          while (videoCursor < demuxer.videoPackets.length) {
            const packet = demuxer.videoPackets[videoCursor];

            if (videoCursor === 0) {
              packet.isKeyframe = true;
            }

            this.queue({
              track: processedVideoTrack,
              samples: [packet],
            });

            videoCursor++;
          }

          while (audioCursor < demuxer.audioPackets.length) {
            const packet = demuxer.audioPackets[audioCursor];

            this.queue({
              track: processedAudioTrack,
              samples: [packet],
            });

            audioCursor++;
          }
        }
      },
    });
  }
}