export type AVCProfileLevel = "baseline" | "main" | "high";
export type AVCLevel =
	| "3.0"
	| "3.1"
	| "4.0"
	| "4.1"
	| "4.2"
	| "5.0"
	| "5.1"
	| "5.2";

export const avc = {
	generateCodecString: (profile: AVCProfileLevel, level: AVCLevel): string => {
		const profileString = {
			baseline: "42E0",
			main: "4D40",
			high: "6400",
		}[profile];
		const levelString = {
			"3.0": "1E",
			"3.1": "1F",
			"4.0": "28",
			"4.1": "29",
			"4.2": "2A",
			"5.0": "32",
			"5.1": "33",
			"5.2": "34",
		}[level];

		if (!profileString || !levelString) {
			throw new Error("Invalid profile or level");
		}

		return `avc1.${profileString}${levelString}`;
	},
};
