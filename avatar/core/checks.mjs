// Checks (section 12) on a render's 40 × 40 outputs. Each check is data: { id, level, output, params,
// fix }; the page turns ids and params into words (avatar/app/text.js) and fix into a button that
// calls applyFix(). Errors block only that download; warnings and info never block.
//
// Implemented: C1, C2, C4, C6, C10, C11, C12. C5, C7, C8 and C9 need the analysis; C13 and C14 the editor.

import { srgbToOklab, deltaE, rgbToHsv, hsvToRgb, parseHex, formatHex } from "./color.mjs";
import { fitFor, AVATAR_SIZE } from "./render.mjs";
import { LIMITS } from "./project.mjs";

/** FIRST's file size limit in bytes. */
export const MAX_BYTES = 20000;

// Lime and magenta, the keying colours of event video overlays (C4). *calibrate*
const CHROMA_KEYS = { lime: 120, magenta: 300 };
const KEY_HUE_RANGE = 25;
const KEY_MIN_SAT = 0.55;
const KEY_MIN_VALUE = 0.6;
// C6: content smaller than this on its longest side, or a margin this wide, is empty space.
const MIN_CONTENT = 34;
const MAX_MARGIN = 5;
const BACKGROUND_DELTA = 0.04;

const hueDiff = (h, key) => ((h - key + 540) % 360) - 180;

/** Which chroma key an 8-bit colour is close to, or null. */
export function chromaKeyOf(r, g, b) {
    let [h, s, v] = rgbToHsv(r / 255, g / 255, b / 255);
    if (s < KEY_MIN_SAT || v < KEY_MIN_VALUE) return null;
    for (let [name, key] of Object.entries(CHROMA_KEYS)) if (Math.abs(hueDiff(h, key)) <= KEY_HUE_RANGE) return name;
    return null;
}

/**
 * The content box (C6, C11) in output px [x0, y0, x1, y1), or null when empty: with a transparent
 * cut-out, the subject (alpha ≥ 0.5); otherwise pixels that differ from the background.
 */
export function contentBox(result, variant) {
    let N = AVATAR_SIZE;
    let counts;
    if (result.info.transparentMode === "cutout") {
        let a = result.info.subjectAlpha;
        counts = (x, y) => a[y * N + x] >= 0.5;
    } else {
        let bg = srgbToOklab(parseHex(variant.background ?? "#ffffff"));
        let d = result.opaque.data;
        counts = (x, y) => {
            let i = (y * N + x) * 4;
            return deltaE(srgbToOklab([d[i] / 255, d[i + 1] / 255, d[i + 2] / 255]), bg) > BACKGROUND_DELTA;
        };
    }
    let box = [N, N, 0, 0];
    for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
            if (!counts(x, y)) continue;
            if (x < box[0]) box[0] = x;
            if (y < box[1]) box[1] = y;
            if (x + 1 > box[2]) box[2] = x + 1;
            if (y + 1 > box[3]) box[3] = y + 1;
        }
    }
    return box[2] > box[0] ? box : null;
}

/**
 * Run the checks on a render (result of render()). bytes: { opaque, transparent } encoded PNG sizes,
 * when known (C2).
 */
export function runChecks(result, project, variantId, bytes = null) {
    let v = project.variants.find((x) => x.id === variantId);
    let out = [];
    let outputs = [["opaque", result.opaque], ["transparent", result.transparent]];

    // C1: should never happen, but a wrong size would be rejected by FIRST.
    for (let [output, img] of outputs) {
        if (img.width !== AVATAR_SIZE || img.height !== AVATAR_SIZE || img.data.length !== AVATAR_SIZE * AVATAR_SIZE * 4) out.push({ id: "C1", level: "error", output, params: {} });
    }

    // C2: FIRST's 20 kB limit, on the real encoded files.
    if (bytes) {
        for (let [output] of outputs) {
            if (bytes[output] > MAX_BYTES) out.push({ id: "C2", level: "error", output, params: { bytes: bytes[output] }, fix: { action: "fewerColors" } });
        }
    }

    // C4: colours an event's video overlay keys out.
    for (let [output, img] of outputs) {
        let n = { lime: 0, magenta: 0 };
        let d = img.data;
        for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] === 0) continue;
            let key = chromaKeyOf(d[i], d[i + 1], d[i + 2]);
            if (key) n[key]++;
        }
        if (n.lime || n.magenta) {
            out.push({ id: "C4", level: "warning", output, params: { count: n.lime + n.magenta, key: n.lime >= n.magenta ? "lime" : "magenta", lime: n.lime, magenta: n.magenta }, fix: { action: "shiftChroma", output } });
        }
    }

    // C6 and C11: empty bands, and off-centre content.
    let box = contentBox(result, v);
    let tall = result.info.subjectBox.h > result.info.subjectBox.w;
    if (!box) {
        out.push({ id: "C6", level: "warning", output: null, params: { empty: true }, fix: { action: tall ? "fillWidth" : "fit" } });
    } else {
        let margins = { top: box[1], bottom: AVATAR_SIZE - box[3], left: box[0], right: AVATAR_SIZE - box[2] };
        let longest = Math.max(box[2] - box[0], box[3] - box[1]);
        let [side, size] = Object.entries(margins).reduce((a, b) => (b[1] > a[1] ? b : a));
        if (longest < MIN_CONTENT || size >= MAX_MARGIN) out.push({ id: "C6", level: "warning", output: null, params: { side, size, longest }, fix: { action: tall ? "fillWidth" : "fit" } });
        let off = margins.right - margins.left;
        if (Math.abs(off) >= 2) out.push({ id: "C11", level: "info", output: null, params: { px: Math.round(Math.abs(off) / 2), side: off > 0 ? "left" : "right" }, fix: { action: "nudge", dx: off / 2 } });
    }

    // C10: one source pixel is bigger than an output pixel.
    if (v.fit.scale > 1 && project.source.kind === "logo") out.push({ id: "C10", level: "warning", output: null, params: { scale: v.fit.scale } });

    // C12: the transparent version kept its background, or there is no background colour.
    if (result.info.transparentMode === "rounded") out.push({ id: "C12", level: "info", output: "transparent", params: { case: "kept" }, fix: { action: "removeBackground" } });
    if (v.background == null) out.push({ id: "C12", level: "warning", output: "opaque", params: { case: "none" }, fix: { action: "pickBackground" } });
    return out;
}

/**
 * Apply a check's fix: a new project, or null when the page has to ask something first (a colour).
 * ctx: { result, source } of the variant's current render.
 */
export function applyFix(project, variantId, check, ctx) {
    let fix = check.fix;
    if (!fix || fix.action === "pickBackground") return null;
    let next = JSON.parse(JSON.stringify(project));
    let v = next.variants.find((x) => x.id === variantId);
    if (fix.action === "fewerColors") {
        let c = v.adjust.colors;
        v.adjust.colors = c === 0 ? 32 : c > 24 ? 24 : c > 16 ? 16 : Math.max(4, c - 4);
    } else if (fix.action === "fit" || fix.action === "fillWidth" || fix.action === "centre") {
        v.fit = fitFor(fix.action, v, ctx.source);
    } else if (fix.action === "nudge") {
        v.fit.x += fix.dx;
    } else if (fix.action === "removeBackground") {
        v.cutout.mode = "edge";
    } else if (fix.action === "shiftChroma") {
        // Turn each keyed colour's hue 30° further from the key and lower its value by 15%.
        let img = ctx.result[fix.output];
        let edits = new Map(v.pixels[fix.output].map((e) => [`${e[0]},${e[1]}`, e]));
        for (let y = 0; y < AVATAR_SIZE; y++) {
            for (let x = 0; x < AVATAR_SIZE; x++) {
                let i = (y * AVATAR_SIZE + x) * 4;
                let d = img.data;
                if (d[i + 3] === 0) continue;
                let key = chromaKeyOf(d[i], d[i + 1], d[i + 2]);
                if (!key) continue;
                let [h, s, val] = rgbToHsv(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255);
                let diff = hueDiff(h, CHROMA_KEYS[key]);
                let rgb = hsvToRgb(h + (diff < 0 ? -30 : 30), s, val * 0.85);
                edits.set(`${x},${y}`, [x, y, formatHex([...rgb, d[i + 3] / 255], true)]);
            }
        }
        v.pixels[fix.output] = [...edits.values()].slice(0, LIMITS.pixels);
    } else {
        throw new Error(`applyFix: unknown action ${fix.action}`);
    }
    return next;
}
