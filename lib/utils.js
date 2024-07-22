/** @ignore */
export const nextTask = () => new Promise((resolve) => queueMicrotask(resolve));
/** @ignore */
export const nextTick = (dur = 1) => new Promise((resolve) => setTimeout(resolve, dur));
/** @ignore */
export const next = nextTick;
