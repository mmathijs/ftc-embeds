// Colour maths for the avatar maker: sRGB and linear light, OKLab and OKLCH, ΔE, HSV, hex colours,
// WCAG contrast and colour-to-alpha. Pure functions. Channels are numbers in 0..1 unless noted.

/** Clamp to 0..1. */
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

export function srgbToLinear(c) {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function linearToSrgb(c) {
    return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/** OKLab (Björn Ottosson) from linear sRGB. */
export function linearToOklab(r, g, b) {
    let l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    let m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    let s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
        0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ];
}

/** Linear sRGB from OKLab (may fall outside 0..1). */
export function oklabToLinear(L, a, b) {
    let l = L + 0.3963377774 * a + 0.2158037573 * b;
    let m = L - 0.1055613458 * a - 0.0638541728 * b;
    let s = L - 0.0894841775 * a - 1.291485548 * b;
    l = l * l * l;
    m = m * m * m;
    s = s * s * s;
    return [
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
}

/** OKLab from an sRGB-encoded colour [r, g, b]. */
export const srgbToOklab = (rgb) => linearToOklab(srgbToLinear(rgb[0]), srgbToLinear(rgb[1]), srgbToLinear(rgb[2]));

/** sRGB-encoded [r, g, b] from OKLab, clamped to 0..1 per channel. */
export function oklabToSrgb(lab) {
    let lin = oklabToLinear(lab[0], lab[1], lab[2]);
    return lin.map((c) => clamp01(linearToSrgb(clamp01(c))));
}

/** OKLCH [L, C, h in degrees 0..360) from OKLab. */
export function oklabToOklch(lab) {
    let h = (Math.atan2(lab[2], lab[1]) * 180) / Math.PI;
    return [lab[0], Math.hypot(lab[1], lab[2]), h < 0 ? h + 360 : h];
}

export function oklchToOklab(lch) {
    let h = (lch[2] * Math.PI) / 180;
    return [lch[0], lch[1] * Math.cos(h), lch[1] * Math.sin(h)];
}

/** Distance in OKLab, L in 0..1: 0.02 is just noticeable, 0.12 counts as similar. */
export function deltaE(lab1, lab2) {
    return Math.hypot(lab1[0] - lab2[0], lab1[1] - lab2[1], lab1[2] - lab2[2]);
}

/** HSV from sRGB-encoded channels: [h in degrees 0..360), s, v]. */
export function rgbToHsv(r, g, b) {
    let max = Math.max(r, g, b);
    let d = max - Math.min(r, g, b);
    let h = 0;
    if (d > 0) {
        if (max === r) h = 60 * (((g - b) / d) % 6);
        else if (max === g) h = 60 * ((b - r) / d + 2);
        else h = 60 * ((r - g) / d + 4);
    }
    if (h < 0) h += 360;
    return [h, max === 0 ? 0 : d / max, max];
}

export function hsvToRgb(h, s, v) {
    h = (((h % 360) + 360) % 360) / 60;
    let c = v * s;
    let x = c * (1 - Math.abs((h % 2) - 1));
    let [r, g, b] = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
    let m = v - c;
    return [r + m, g + m, b + m];
}

const HEX_RE = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i;

/** "#rrggbb" or "#rrggbbaa" to [r, g, b, a] in 0..1, or null. */
export function parseHex(hex) {
    let m = typeof hex === "string" && HEX_RE.exec(hex);
    if (!m) return null;
    let n = parseInt(m[1], 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, m[2] ? parseInt(m[2], 16) / 255 : 1];
}

const hex2 = (v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, "0");

/** [r, g, b] (and optional a) in 0..1 to "#rrggbb" (or "#rrggbbaa" with alpha). */
export function formatHex(rgb, withAlpha = false) {
    return "#" + hex2(rgb[0]) + hex2(rgb[1]) + hex2(rgb[2]) + (withAlpha ? hex2(rgb[3] ?? 1) : "");
}

/** WCAG relative luminance of an sRGB-encoded colour, for the page's own text. */
export function relativeLuminance(rgb) {
    return 0.2126 * srgbToLinear(rgb[0]) + 0.7152 * srgbToLinear(rgb[1]) + 0.0722 * srgbToLinear(rgb[2]);
}

export function contrastRatio(rgb1, rgb2) {
    let a = relativeLuminance(rgb1);
    let b = relativeLuminance(rgb2);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * Un-blends a straight colour c from a background b (section 9.4): the smallest alpha that explains
 * c as some colour over b, and that colour. A pixel equal to b gets alpha 0, which is what removes
 * the halo a cut-out otherwise leaves.
 */
export function colorToAlpha(c, b) {
    let alpha = 0;
    for (let k = 0; k < 3; k++) {
        let a = c[k] > b[k] ? (c[k] - b[k]) / (1 - b[k]) : c[k] < b[k] ? (b[k] - c[k]) / b[k] : 0;
        if (a > alpha) alpha = a;
    }
    if (alpha <= 0) return { alpha: 0, color: [c[0], c[1], c[2]] };
    return { alpha, color: [0, 1, 2].map((k) => clamp01((c[k] - b[k]) / alpha + b[k])) };
}

// Lime and magenta, the keying colours of event video overlays (check C4). *calibrate*
export const CHROMA_KEYS = { lime: 120, magenta: 300 };
const KEY_HUE_RANGE = 25;
const KEY_MIN_SAT = 0.55;
const KEY_MIN_VALUE = 0.6;

/** Signed hue difference h − key in degrees, in −180..180. */
export const hueDiff = (h, key) => ((h - key + 540) % 360) - 180;

/** Which chroma key ("lime" or "magenta") an 8-bit colour is close to, or null. */
export function chromaKeyOf(r, g, b) {
    let [h, s, v] = rgbToHsv(r / 255, g / 255, b / 255);
    if (s < KEY_MIN_SAT || v < KEY_MIN_VALUE) return null;
    for (let [name, key] of Object.entries(CHROMA_KEYS)) if (Math.abs(hueDiff(h, key)) <= KEY_HUE_RANGE) return name;
    return null;
}
