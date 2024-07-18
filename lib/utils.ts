/** @ignore */
export const nextTask = () =>
	new Promise((resolve) => queueMicrotask(resolve as any));

/** @ignore */
export const nextTick = (dur = 1) =>
	new Promise((resolve) => setTimeout(resolve as any, dur));
/** @ignore */
export const next = nextTick;
