import MIMEType from "whatwg-mimetype";
/** @ignore */
export const nextTask = () =>
	new Promise((resolve) => queueMicrotask(resolve as any));

/** @ignore */
export const nextTick = (dur = 1) =>
	new Promise((resolve) => setTimeout(resolve as any, dur));
/** @ignore */
export const next = nextTick;

export const getCodecFromMimeType = (mimeType: string) => {
	const mime = new MIMEType(mimeType);
	const [videoCodec = "", audioCodec = ""] = (mime.parameters.get("codecs") || "").split(",");

	return { videoCodec, audioCodec };
}

