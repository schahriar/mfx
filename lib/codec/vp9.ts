export type VP9Profile = "profile0" | "profile1" | "profile2" | "profile3";
export type VP9Level =
  | "1"
  | "1.1"
  | "2"
  | "2.1"
  | "3"
  | "3.1"
  | "4"
  | "4.1"
  | "5"
  | "5.1"
  | "6"
  | "6.1";
export type VP9BitDepth = 8 | 10 | 12;

const profileMap: Record<VP9Profile, string> = {
  profile0: "00",
  profile1: "01",
  profile2: "02",
  profile3: "03",
};

const levelMap: Record<VP9Level, string> = {
  "1": "01",
  "1.1": "11",
  "2": "02",
  "2.1": "21",
  "3": "03",
  "3.1": "31",
  "4": "04",
  "4.1": "41",
  "5": "05",
  "5.1": "51",
  "6": "06",
  "6.1": "61",
};

const bitDepthMap: Record<VP9BitDepth, string> = {
  "8": "08",
  "10": "10",
  "12": "12",
};

export interface VideoParams {
  width: number;
  height: number;
  bitrate: number;
  bitDepth: VP9BitDepth;
  profile?: VP9Profile;
}

const levels = [
  { value: "1", maxLumaPictureSize: 36864, maxBitrate: 200000 },
  { value: "1.1", maxLumaPictureSize: 73728, maxBitrate: 800000 },
  { value: "2.1", maxLumaPictureSize: 245760, maxBitrate: 3600000 },
  { value: "3.1", maxLumaPictureSize: 983040, maxBitrate: 12000000 },
  { value: "4.1", maxLumaPictureSize: 2228224, maxBitrate: 30000000 },
  { value: "5.1", maxLumaPictureSize: 8912896, maxBitrate: 120000000 },
  { value: "6.1", maxLumaPictureSize: 35651584, maxBitrate: 240000000 },
  // Not supported by Chrome
  // { value: '6', maxLumaPictureSize: 35651584, maxBitrate: 180000000 },
  // { value: '5', maxLumaPictureSize: 8912896, maxBitrate: 60000000 },
  // { value: '3', maxLumaPictureSize: 552960, maxBitrate: 7200000 },
  // { value: '2', maxLumaPictureSize: 122880, maxBitrate: 1800000 },
  // { value: '4', maxLumaPictureSize: 2228224, maxBitrate: 18000000 },
];

export const vp9 = {
  autoSelectCodec({
    width,
    height,
    bitrate,
    bitDepth,
    profile,
  }: VideoParams): string {
    const lumaPictureSize = width * height;

    const selectedProfile: VP9Profile =
      profile || bitDepth < 10 ? "profile0" : "profile2";

    for (const level of levels) {
      if (
        lumaPictureSize <= level.maxLumaPictureSize &&
        bitrate <= level.maxBitrate
      ) {
        const profileString = profileMap[selectedProfile];
        const levelString = levelMap[level.value];
        const bitDepthString = bitDepthMap[bitDepth];

        return `vp09.${profileString}.${levelString}.${bitDepthString}`;
      }
    }

    throw new Error(
      "No suitable profile and level found for the given parameters.",
    );
  },
};
