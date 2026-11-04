// Pixel fonts and text for the avatar maker (section 10.5): readable at 40 px because every glyph
// pixel is a whole output pixel. The glyphs were drawn for this repo. "bold" is 7 px tall with
// mostly 2 px stems; "light" is 5 px tall with 1 px strokes, for longer names. Text is drawn on the
// 40 × 40 outputs after the reduction (pipeline step 13), fully opaque in both.

import { parseHex } from "./color.mjs";

// Glyphs as rows; "#" is a pixel. Lowercase maps to uppercase and accents to their base letter.
const BOLD = {
    A: [".###.", "##.##", "##.##", "#####", "##.##", "##.##", "##.##"],
    B: ["####.", "##.##", "##.##", "####.", "##.##", "##.##", "####."],
    C: [".####", "##...", "##...", "##...", "##...", "##...", ".####"],
    D: ["####.", "##.##", "##.##", "##.##", "##.##", "##.##", "####."],
    E: ["#####", "##...", "##...", "####.", "##...", "##...", "#####"],
    F: ["#####", "##...", "##...", "####.", "##...", "##...", "##..."],
    G: [".####", "##...", "##...", "##.##", "##.##", "##.##", ".####"],
    H: ["##.##", "##.##", "##.##", "#####", "##.##", "##.##", "##.##"],
    I: ["####", ".##.", ".##.", ".##.", ".##.", ".##.", "####"],
    J: ["..###", "...##", "...##", "...##", "##.##", "##.##", ".###."],
    K: ["##.##", "##.##", "####.", "###..", "####.", "##.##", "##.##"],
    L: ["##...", "##...", "##...", "##...", "##...", "##...", "#####"],
    M: ["##...##", "###.###", "#######", "##.#.##", "##...##", "##...##", "##...##"],
    N: ["##..##", "###.##", "######", "##.###", "##..##", "##..##", "##..##"],
    O: [".####.", "##..##", "##..##", "##..##", "##..##", "##..##", ".####."],
    P: ["####.", "##.##", "##.##", "####.", "##...", "##...", "##..."],
    Q: [".####.", "##..##", "##..##", "##..##", "##.###", "##..##", ".###.#"],
    R: ["####.", "##.##", "##.##", "####.", "##.##", "##.##", "##.##"],
    S: [".####", "##...", "##...", ".###.", "...##", "...##", "####."],
    T: ["######", "..##..", "..##..", "..##..", "..##..", "..##..", "..##.."],
    U: ["##.##", "##.##", "##.##", "##.##", "##.##", "##.##", ".###."],
    V: ["##.##", "##.##", "##.##", "##.##", "##.##", ".###.", "..#.."],
    W: ["##...##", "##...##", "##...##", "##.#.##", "#######", "###.###", "##...##"],
    X: ["##.##", "##.##", ".###.", "..#..", ".###.", "##.##", "##.##"],
    Y: ["##..##", "##..##", ".####.", "..##..", "..##..", "..##..", "..##.."],
    Z: ["#####", "...##", "..##.", ".##..", "##...", "##...", "#####"],
    0: [".###.", "##.##", "##.##", "##.##", "##.##", "##.##", ".###."],
    1: ["..##.", ".###.", "..##.", "..##.", "..##.", "..##.", ".####"],
    2: [".###.", "##.##", "...##", "..##.", ".##..", "##...", "#####"],
    3: ["####.", "...##", "...##", ".###.", "...##", "...##", "####."],
    4: ["...##", "..###", ".#.##", "##.##", "#####", "...##", "...##"],
    5: ["#####", "##...", "####.", "...##", "...##", "##.##", ".###."],
    6: [".###.", "##...", "##...", "####.", "##.##", "##.##", ".###."],
    7: ["#####", "...##", "...##", "..##.", "..##.", ".##..", ".##.."],
    8: [".###.", "##.##", "##.##", ".###.", "##.##", "##.##", ".###."],
    9: [".###.", "##.##", "##.##", ".####", "...##", "...##", ".###."],
    " ": ["...", "...", "...", "...", "...", "...", "..."],
    "-": ["....", "....", "....", "####", "....", "....", "...."],
    ".": ["..", "..", "..", "..", "..", "##", "##"],
    "!": ["##", "##", "##", "##", "##", "..", "##"],
    "&": [".##..", "#..#.", ".##..", "##.#.", "#..#.", "#..##", ".##.#"],
    "'": ["##", "##", "..", "..", "..", "..", ".."],
    ":": ["..", "##", "##", "..", "##", "##", ".."],
    "/": ["...##", "...##", "..##.", "..#..", ".##..", "##...", "##..."],
    "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
    "#": [".#.#.", "#####", ".#.#.", ".#.#.", "#####", ".#.#.", "....."],
};

const LIGHT = {
    A: [".#.", "#.#", "###", "#.#", "#.#"],
    B: ["##.", "#.#", "##.", "#.#", "##."],
    C: [".##", "#..", "#..", "#..", ".##"],
    D: ["##.", "#.#", "#.#", "#.#", "##."],
    E: ["###", "#..", "##.", "#..", "###"],
    F: ["###", "#..", "##.", "#..", "#.."],
    G: [".##", "#..", "#.#", "#.#", ".##"],
    H: ["#.#", "#.#", "###", "#.#", "#.#"],
    I: ["###", ".#.", ".#.", ".#.", "###"],
    J: ["..#", "..#", "..#", "#.#", ".#."],
    K: ["#.#", "#.#", "##.", "#.#", "#.#"],
    L: ["#..", "#..", "#..", "#..", "###"],
    M: ["#...#", "##.##", "#.#.#", "#...#", "#...#"],
    N: ["#..#", "##.#", "#.##", "#..#", "#..#"],
    O: [".#.", "#.#", "#.#", "#.#", ".#."],
    P: ["##.", "#.#", "##.", "#..", "#.."],
    Q: [".##.", "#..#", "#..#", "#.#.", ".#.#"],
    R: ["##.", "#.#", "##.", "#.#", "#.#"],
    S: [".##", "#..", ".#.", "..#", "##."],
    T: ["###", ".#.", ".#.", ".#.", ".#."],
    U: ["#.#", "#.#", "#.#", "#.#", "###"],
    V: ["#.#", "#.#", "#.#", "#.#", ".#."],
    W: ["#...#", "#...#", "#.#.#", "##.##", "#...#"],
    X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
    Y: ["#.#", "#.#", ".#.", ".#.", ".#."],
    Z: ["###", "..#", ".#.", "#..", "###"],
    0: ["###", "#.#", "#.#", "#.#", "###"],
    1: [".#", "##", ".#", ".#", ".#"],
    2: ["##.", "..#", ".#.", "#..", "###"],
    3: ["##.", "..#", ".#.", "..#", "##."],
    4: ["#.#", "#.#", "###", "..#", "..#"],
    5: ["###", "#..", "##.", "..#", "##."],
    6: [".##", "#..", "###", "#.#", "###"],
    7: ["###", "..#", ".#.", ".#.", ".#."],
    8: ["###", "#.#", "###", "#.#", "###"],
    9: ["###", "#.#", "###", "..#", "##."],
    " ": ["..", "..", "..", "..", ".."],
    "-": ["..", "..", "##", "..", ".."],
    ".": [".", ".", ".", ".", "#"],
    "!": ["#", "#", "#", ".", "#"],
    "&": [".#..", "#.#.", ".#..", "#.#.", ".#.#"],
    "'": ["#", "#", ".", ".", "."],
    ":": [".", "#", ".", "#", "."],
    "/": ["..#", "..#", ".#.", "#..", "#.."],
    "+": ["...", ".#.", "###", ".#.", "..."],
    "#": ["#.#", "###", "#.#", "###", "#.#"],
};

export const FONTS = { bold: { height: 7, glyphs: BOLD }, light: { height: 5, glyphs: LIGHT } };

/** Text as the fonts draw it: uppercase, accents removed. Returns the characters with no glyph too. */
export function fontText(text, font = "bold") {
    let glyphs = FONTS[font].glyphs;
    let chars = [...String(text).normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase()];
    return { chars, missing: [...new Set(chars.filter((c) => !glyphs[c]))] };
}

/**
 * Lay out a text block: { width, height, pixels: [[x, y]] (relative to its top-left), missing }.
 * Unknown characters are drawn as a gap.
 */
export function layoutText(block) {
    let font = FONTS[block.font] || FONTS.bold;
    let s = block.scale || 1;
    let gap = (block.letterSpacing ?? 1) * s;
    let lineH = font.height * s;
    let missing = new Set();
    let lines = block.lines.map((line) => {
        let { chars, missing: m } = fontText(line, block.font);
        m.forEach((c) => missing.add(c));
        let pixels = [];
        let x = 0;
        chars.forEach((c, i) => {
            let g = font.glyphs[c] || font.glyphs[" "];
            g.forEach((row, gy) => [...row].forEach((ch, gx) => ch === "#" && pixels.push([x + gx * s, gy * s])));
            x += g[0].length * s + (i < chars.length - 1 ? gap : 0);
        });
        return { width: chars.length ? x : 0, pixels };
    });
    let width = Math.max(0, ...lines.map((l) => l.width));
    let height = lines.length * lineH + (lines.length - 1) * (block.lineGap ?? 1);
    let out = [];
    lines.forEach((l, i) => {
        let dx = block.align === "right" ? width - l.width : block.align === "center" ? Math.floor((width - l.width) / 2) : 0;
        let dy = i * (lineH + (block.lineGap ?? 1));
        for (let [x, y] of l.pixels) for (let yy = 0; yy < s; yy++) for (let xx = 0; xx < s; xx++) out.push([x + xx + dx, y + yy + dy]);
    });
    return { width, height, pixels: out, missing: [...missing] };
}

/**
 * Whether a pixel is in a rounded rectangle with pixel-exact corners: radius 1 drops each corner
 * pixel, 2 drops a 3-pixel corner, larger radii follow a circle through pixel centres.
 */
export function inRoundedRect(px, py, x0, y0, w, h, r) {
    if (px < x0 || py < y0 || px >= x0 + w || py >= y0 + h) return false;
    r = Math.min(r, Math.floor(Math.min(w, h) / 2));
    if (r <= 0) return true;
    let dx = Math.min(px - x0, x0 + w - 1 - px);
    let dy = Math.min(py - y0, y0 + h - 1 - py);
    if (dx >= r || dy >= r) return true;
    if (r <= 2) return dx + dy >= r;
    return (r - dx - 0.5) ** 2 + (r - dy - 0.5) ** 2 <= r * r;
}

function setPixel(img, x, y, rgb) {
    if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
    let i = (y * img.width + x) * 4;
    img.data[i] = rgb[0];
    img.data[i + 1] = rgb[1];
    img.data[i + 2] = rgb[2];
    img.data[i + 3] = 255;
}

const bytesOf = (hex) => parseHex(hex).slice(0, 3).map((v) => Math.round(v * 255));

/** A name bar's size: { width, height } (section 10.5). */
export function nameBarSize(block) {
    let font = FONTS[block.font] || FONTS.bold;
    let height = font.height * (block.scale || 1) + 2 * (block.pad ?? 2) + 2;
    return { width: block.width === "fill" || block.width == null ? 36 : block.width, height };
}

/** The pixels a text block covers on the 40 × 40 output, with their colours: [[x, y, rgb]]. */
export function textPixels(block, size = 40) {
    let out = [];
    if (block.segments?.length) {
        let { width, height } = nameBarSize(block);
        let x0 = block.width === "fill" || block.width == null || block.align === "center" ? Math.floor((size - width) / 2) : block.x;
        let y0 = block.y;
        let r = block.radius === "pill" ? Math.floor(height / 2) : block.radius ?? 0;
        let inBar = (x, y) => inRoundedRect(x, y, x0, y0, width, height, r);
        let outline = block.outline ? bytesOf(block.outline) : null;
        // Inner area: inside the 1 px outline; the segments split its width (the remainder goes last).
        let ix0 = x0 + (outline ? 1 : 0);
        let iw = width - (outline ? 2 : 0);
        let n = block.segments.length;
        let segW = Math.floor(iw / n);
        let segAt = (x) => Math.min(n - 1, Math.floor((x - ix0) / segW));
        for (let y = y0; y < y0 + height; y++) {
            for (let x = x0; x < x0 + width; x++) {
                if (!inBar(x, y)) continue;
                let edge = !inBar(x - 1, y) || !inBar(x + 1, y) || !inBar(x, y - 1) || !inBar(x, y + 1);
                out.push([x, y, outline && edge ? outline : bytesOf(block.segments[segAt(x)].color)]);
            }
        }
        let glyph = bytesOf(block.color);
        block.segments.forEach((seg, k) => {
            let lay = layoutText({ ...block, lines: [seg.text], align: "left" });
            let sx = ix0 + k * segW;
            let sw = k === n - 1 ? iw - k * segW : segW;
            let gx = sx + Math.floor((sw - lay.width) / 2);
            let gy = y0 + (outline ? 1 : 0) + (block.pad ?? 2);
            for (let [x, y] of lay.pixels) out.push([gx + x, gy + y, glyph]);
        });
        return out;
    }
    let lay = layoutText(block);
    let x0 = block.align === "center" ? Math.floor((size - lay.width) / 2) : block.x;
    let y0 = block.y;
    let glyphs = new Set(lay.pixels.map(([x, y]) => `${x0 + x},${y0 + y}`));
    if (block.plate) {
        let p = block.plate;
        let color = bytesOf(p.color);
        for (let y = y0 - p.pad; y < y0 + lay.height + p.pad; y++) {
            for (let x = x0 - p.pad; x < x0 + lay.width + p.pad; x++) {
                if (inRoundedRect(x, y, x0 - p.pad, y0 - p.pad, lay.width + 2 * p.pad, lay.height + 2 * p.pad, p.radius)) out.push([x, y, color]);
            }
        }
    }
    if (block.outline) {
        let color = bytesOf(block.outline);
        let ring = new Set();
        for (let [x, y] of lay.pixels) {
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    let k = `${x0 + x + dx},${y0 + y + dy}`;
                    if (!glyphs.has(k)) ring.add(k);
                }
            }
        }
        for (let k of ring) {
            let [x, y] = k.split(",").map(Number);
            out.push([x, y, color]);
        }
    }
    let color = bytesOf(block.color);
    for (let [x, y] of lay.pixels) out.push([x0 + x, y0 + y, color]);
    return out;
}

/** Draw text blocks on an 8-bit 40 × 40 image (pipeline step 13). */
export function drawTexts(img, texts) {
    for (let t of texts) for (let [x, y, rgb] of textPixels(t, img.width)) setPixel(img, x, y, rgb);
}
