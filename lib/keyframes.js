/**
 * @group Advanced
 */
export const keyframes = (defs, easing = (v) => v) => {
    return (frame) => {
        const ts = frame.timestamp / 1000;
        const idx = defs.findIndex((_, i) => {
            const nextTime = defs[i + 1]?.time || Infinity;
            return ts < nextTime;
        });
        const windowStart = defs[idx];
        const windowEnd = defs[idx + 1] || windowStart;
        // Fractional / relative value
        if (typeof windowStart.value === "number") {
            const pos = ts - windowStart.time;
            const duration = windowEnd.time - windowStart.time;
            const ease = windowStart.easing || easing || ((v) => v);
            if (duration <= 0) {
                return windowEnd.value;
            }
            const delta = ease(pos / duration);
            const diff = windowEnd.value - windowStart.value;
            const value = (windowStart.value + diff * delta);
            return value;
        }
        // Absolute value
        return windowStart.value;
    };
};
