import * as shaders from "./raw";
export const blur = () => ({
    shader: shaders.blur,
});
export const convolution = (kernel = [0, 0, 0, 0, 1, 0, 0, 0, 0]) => ({
    shader: shaders.convolution,
    uniforms: {
        kernel,
    },
});
export const zoom = ({ factor = 1, x = 0.5, y = 0.5, } = {}) => ({
    shader: shaders.zoom,
    uniforms: {
        zoomFactor: factor,
        position: [x, y],
    },
});
export const adjustment = ({ saturation = 1, brightness = 1, contrast = 1, } = {}) => ({
    shader: shaders.adjustment,
    uniforms: {
        saturation,
        brightness,
        contrast,
    },
});
