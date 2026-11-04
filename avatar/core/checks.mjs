// Checks (section 12) on a render's 40 × 40 outputs. Each check is data: { id, level, output, params,
// fix }; the page turns ids and params into words (avatar/app/text.js) and fix into a button that
// calls applyFix(). Errors block only that download; warnings and info never block.
//
// Implemented: C1, C2, C4 to C12. C13 (text) and C14 (stale pixel edits) come with the editor.

import { srgbToOklab, deltaE, rgbToHsv, hsvToRgb, parseHex, formatHex, chromaKeyOf, hueDiff, CHROMA_KEYS } from "./color.mjs";
import { fitFor, orientPoint, AVATAR_SIZE } from "./render.mjs";
import { LIMITS } from "./project.mjs";
import { edgeSamples, backgroundScore, suggestBackgrounds } from "./analyze.mjs";
import { textPixels } from "./font.mjs";

/** FIRST's file size limit in bytes. */
export const MAX_BYTES = 20000;

// C6: content smaller than this on its longest side, or a margin this wide, is empty space.
const MIN_CONTENT = 34;
const MAX_MARGIN = 5;
const BACKGROUND_DELTA = 0.04;
// C5: share of the edge within ΔE 0.12 of the background. C9: share of the outer edge within this of a FIRST background. *calibrate*
const LOW_CONTRAST = 0.35;
const VANISH_DELTA = 0.1;

/** FIRST's display backgrounds (section 2). */
export const FIRST_BACKGROUNDS = { white: "#ffffff", red: "#ed1c24", blue: "#0066b3", award: "#0083ae" };

/**
 * The content box (C6, C11) in output px [x0, y0, x1, y1), or null when empty: with a transparent
 * cut-out, the subject (alpha ≥ 0.5) and any pixel text (a name bar is content too); otherwise pixels
 * that differ from the background.
 */
export function contentBox(result, variant) {
    let N = AVATAR_SIZE;
    let counts;
    if (result.info.transparentMode === "cutout") {
        let a = result.info.subjectAlpha;
        let text = new Uint8Array(N * N);
        for (let t of variant.texts) for (let [x, y] of textPixels(t, N)) if (x >= 0 && y >= 0 && x < N && y < N) text[y * N + x] = 1;
        counts = (x, y) => a[y * N + x] >= 0.5 || text[y * N + x] === 1;
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
export function runChecks(result, project, variantId, bytes = null, analysis = null) {
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

    // C5: the logo's edge blends into the background (opaque version).
    if (v.background) {
        let score = backgroundScore(edgeSamples(result.info.subject40), v.background);
        if (score >= LOW_CONTRAST) {
            let best = suggestBackgrounds(analysis, result.info.subject40).find((s) => s.color !== v.background && s.score < LOW_CONTRAST);
            out.push({ id: "C5", level: "warning", output: "opaque", params: { score, suggestion: best?.color ?? null, name: best?.name ?? null }, fix: best ? { action: "setBackground", color: best.color } : undefined });
        }
    }

    // C7: the subject is cut off at the top, left or right (only a cut-out subject: a full-bleed
    // logo is cut everywhere on purpose).
    if (result.info.transparentMode === "cutout") {
        let a = result.info.subjectAlpha;
        let N = AVATAR_SIZE;
        let run = (at) => {
            let best = 0, cur = 0;
            for (let i = 0; i < N; i++) {
                cur = a[at(i)] >= 0.5 ? cur + 1 : 0;
                best = Math.max(best, cur);
            }
            return best;
        };
        let b = result.info.subjectBox;
        let sides = [
            ["top", run((i) => i), b.y < -0.01],
            ["left", run((i) => i * N), b.x < -0.01],
            ["right", run((i) => i * N + N - 1), b.x + b.w > N + 0.01],
        ];
        let cut = sides.find(([, n, past]) => n >= 3 && past);
        if (cut) out.push({ id: "C7", level: "warning", output: null, params: { side: cut[0] }, fix: { action: "cutOrFit" } });
    }

    // C8: the logo's circle is cut off by the square's edge.
    if (analysis?.circle && v.frame.kind !== "circle") {
        let c = analysis.circle;
        let src = project.source;
        let [ox, oy] = orientPoint(c.cx, c.cy, src.width, src.height, v.fit.rotate, v.fit.flip);
        let cx = v.fit.x + ox * v.fit.scale;
        let cy = v.fit.y + oy * v.fit.scale;
        let r = c.r * v.fit.scale;
        let past = Math.max(-(cx - r), -(cy - r), cx + r - AVATAR_SIZE, cy + r - AVATAR_SIZE);
        if (past > 0.25) {
            // Share of the disc inside the square, sampled on a 48 × 48 grid over its box.
            let inside = 0, all = 0;
            for (let j = 0; j < 48; j++) {
                for (let i = 0; i < 48; i++) {
                    let x = cx - r + ((i + 0.5) / 48) * 2 * r;
                    let y = cy - r + ((j + 0.5) / 48) * 2 * r;
                    if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
                    all++;
                    if (x >= 0 && y >= 0 && x <= AVATAR_SIZE && y <= AVATAR_SIZE) inside++;
                }
            }
            if (all && inside / all >= 0.75) out.push({ id: "C8", level: "warning", output: null, params: {}, fix: { action: "coinFrame" } });
        }
    }

    // C9: on one of FIRST's backgrounds, the transparent version's outer edge disappears. A border
    // that matches a background may vanish on it while the logo inside still shows (a white border on
    // FIRST's white is the logo on white again): then it only counts if the logo's own edge vanishes too.
    {
        let vanishes = (img, hex) => {
            let N = AVATAR_SIZE;
            let solid = (x, y) => x >= 0 && y >= 0 && x < N && y < N && img.data[(y * N + x) * 4 + 3] >= 128;
            let lab = srgbToOklab(parseHex(hex));
            let total = 0, near = 0;
            for (let y = 0; y < N; y++) {
                for (let x = 0; x < N; x++) {
                    if (!solid(x, y)) continue;
                    let border = x === 0 || y === 0 || x === N - 1 || y === N - 1;
                    if (!border && solid(x - 1, y) && solid(x + 1, y) && solid(x, y - 1) && solid(x, y + 1)) continue;
                    let i = (y * N + x) * 4;
                    let w = img.data[i + 3] / 255;
                    total += w;
                    if (deltaE(srgbToOklab([img.data[i] / 255, img.data[i + 1] / 255, img.data[i + 2] / 255]), lab) <= VANISH_DELTA) near += w;
                }
            }
            return total > 0 && near >= total / 2;
        };
        let bordered = result.info.transparentMode === "cutout" && v.border.width > 0;
        let lost = Object.entries(FIRST_BACKGROUNDS).filter(([, hex]) => vanishes(result.transparent, hex) && (!bordered || vanishes(result.info.subject40, hex)));
        if (lost.length) {
            out.push({ id: "C9", level: "warning", output: "transparent", params: { backgrounds: lost.map(([name]) => name) }, fix: { action: v.border.width > 0 ? "darkerBorder" : "addBorder" } });
        }
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
 * ctx: { result, assets: { source, analysis } } of the variant's current render.
 */
export function applyFix(project, variantId, check, ctx) {
    let fix = check.fix;
    if (!fix || fix.action === "pickBackground") return null;
    ctx = { ...ctx, assets: ctx.assets ?? { source: ctx.source, analysis: null } };
    let next = JSON.parse(JSON.stringify(project));
    let v = next.variants.find((x) => x.id === variantId);
    if (fix.action === "fewerColors") {
        let c = v.adjust.colors;
        v.adjust.colors = c === 0 ? 32 : c > 24 ? 24 : c > 16 ? 16 : Math.max(4, c - 4);
    } else if (fix.action === "fit" || fix.action === "fillWidth" || fix.action === "centre") {
        v.fit = fitFor(fix.action, v, ctx.assets);
    } else if (fix.action === "cutOrFit") {
        v.fit = fitFor("cutBottom", v, ctx.assets) ?? fitFor("fit", v, ctx.assets);
    } else if (fix.action === "setBackground") {
        v.background = fix.color;
    } else if (fix.action === "addBorder") {
        // A border in a colour that itself disappears on one of FIRST's backgrounds (white, often
        // the background colour) only moves the problem: then it is near-black.
        v.border.width = 1.1;
        let col = srgbToOklab(parseHex(v.border.color ?? v.background ?? "#000000"));
        if (Object.values(FIRST_BACKGROUNDS).some((hex) => deltaE(col, srgbToOklab(parseHex(hex))) <= VANISH_DELTA)) v.border.color = "#121216";
    } else if (fix.action === "darkerBorder") {
        v.border = { width: Math.max(1.1, v.border.width), color: "#121216" };
    } else if (fix.action === "coinFrame") {
        let c = ctx.assets.analysis.circle;
        let src = next.source;
        let [ox, oy] = orientPoint(c.cx, c.cy, src.width, src.height, v.fit.rotate, v.fit.flip);
        let s = 39.5 / (2 * c.r);
        v.fit = { ...v.fit, scale: s, x: 20 - ox * s, y: 20 - oy * s, anchor: "free" };
        v.frame = { ...v.frame, kind: "circle" };
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
