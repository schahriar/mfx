import MIMEType from "whatwg-mimetype";
/** @ignore */
export const nextTask = () =>
  new Promise((resolve) => queueMicrotask(resolve as any));

/** @ignore */
export const nextTick = (dur = 1) =>
  new Promise((resolve) => setTimeout(resolve as any, dur));
/** @ignore */
export const next = nextTick;

export const getContainerFromMimeType = (
  mimeType: string,
): "webm" | "mp4" | undefined => {
  const mime = new MIMEType(mimeType);
  if (mime.subtype === "webm" || mime.subtype === "x-matroska") {
    return "webm";
  }

  if (mime.subtype === "mp4") {
    return "mp4";
  }
};

export const getCodecFromMimeType = (mimeType: string) => {
  const mime = new MIMEType(mimeType);
  const [videoCodec = "", audioCodec = ""] = (
    mime.parameters.get("codecs") || ""
  ).split(",");

  return { videoCodec, audioCodec };
};
