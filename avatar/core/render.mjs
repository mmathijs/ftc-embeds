// The render pipeline (section 8): a variant is drawn at 320 × 320 (8×) in premultiplied floating
// point and reduced to 40 × 40 once, at the end. render() is a pure function of the project, the
// source and its analysis; caches only save time, they never change the result.
//
// Implemented: steps 1 (logo layer), 2 (cut-out, with colour-to-alpha at its edge), 5 (adjustments),
// 6 to 12 (composition, frame and ring, opaque and transparent outputs with the border, reduction,
// crisp colours, alpha floor) and 13 (pixel text and name bars, then pixel edits). Steps 3 and 4
// (mask and paint operations), shapes and logo pieces come with the editor: their fields are kept in
// the project but not drawn yet.

import { clamp01, parseHex, srgbToOklab, oklabToSrgb, oklabToOklch, oklchToOklab, colorToAlpha } from "./color.mjs";
import { createRaster, cloneRaster, compositeOver, fillOver, multiplyCoverage, resampleRows, rowsFromRGBA8, rowsFromRaster, halveRows, boxReduce, boxReduceChannel, rasterToImage8, orientRGBA, distanceTransform, distanceTransformNearest, mulberry32 } from "./raster.mjs";
import { cutoutRegion, cutoutColor } from "./analyze.mjs";
import { drawTexts } from "./font.mjs";

export const AVATAR_SIZE = 40;
export const WORK_SCALE = 8;
export const WORK_SIZE = 320;

const WHITE = [1, 1, 1];
const BLACK = [0, 0, 0];
const rgbOf = (hex, fallback) => (hex ? parseHex(hex).slice(0, 3) : fallback);

/**
 * A source from 8-bit straight RGBA (the normalised logo, section 9.1). A 40 × 40 source is a FIRST
 * avatar. The pixels are kept as they are, never as a full-size float copy.
 */
export function sourceFromRGBA(width, height, rgba, name = "logo") {
    let hasAlpha = false;
    for (let i = 3; i < rgba.length; i += 4) {
        if (rgba[i] < 255) {
            hasAlpha = true;
            break;
        }
    }
    return { width, height, rgba, hasAlpha, name, kind: width === 40 && height === 40 ? "avatar" : "logo" };
}

// Per source: oriented copies (with their mip levels and subject box) and each variant's last logo layer.
const sourceCaches = new WeakMap();

function cacheFor(source) {
    let c = sourceCaches.get(source);
    if (!c) sourceCaches.set(source, (c = { oriented: new Map(), layers: new Map() }));
    return c;
}

function oriented(source, rotate, flip) {
    let cache = cacheFor(source).oriented;
    let key = `${rotate}|${flip}`;
    let o = cache.get(key);
    if (!o) {
        o = orientRGBA(source.width, source.height, source.rgba, rotate, flip);
        o.levels = [rowsFromRGBA8(o.width, o.height, o.rgba)];
        cache.set(key, o);
    }
    return o;
}

/**
 * The subject box (section 9.7) in oriented source px: pixels with alpha ≥ 0.5, or the whole source
 * when it has no transparency. (With the cut-out, a later milestone uses what's left after it.)
 */
export function subjectBox(source, rotate = 0, flip = false) {
    let o = oriented(source, rotate, flip);
    if (o.box) return o.box;
    let box = { x: 0, y: 0, w: o.width, h: o.height };
    if (source.hasAlpha) {
        let x0 = o.width, y0 = o.height, x1 = 0, y1 = 0;
        for (let y = 0; y < o.height; y++) {
            for (let x = 0; x < o.width; x++) {
                if (o.rgba[(y * o.width + x) * 4 + 3] >= 128) {
                    if (x < x0) x0 = x;
                    if (y < y0) y0 = y;
                    if (x + 1 > x1) x1 = x + 1;
                    if (y + 1 > y1) y1 = y + 1;
                }
            }
        }
        if (x1 > x0) box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
    return (o.box = box);
}

/** A box (source px) after rotating and flipping a w × h source like a fit does. */
export function orientBox(b, w, h, rotate, flip) {
    let o = rotate === 90 ? { x: h - (b.y + b.h), y: b.x, w: b.h, h: b.w } : rotate === 180 ? { x: w - (b.x + b.w), y: h - (b.y + b.h), w: b.w, h: b.h } : rotate === 270 ? { x: b.y, y: w - (b.x + b.w), w: b.h, h: b.w } : { ...b };
    if (flip) o.x = (rotate === 90 || rotate === 270 ? h : w) - (o.x + o.w);
    return o;
}

/** A point (source px) after rotating and flipping a w × h source like a fit does. */
export function orientPoint(u, v, w, h, rotate, flip) {
    let [x, y] = rotate === 90 ? [h - v, u] : rotate === 180 ? [w - u, h - v] : rotate === 270 ? [v, w - u] : [u, v];
    if (flip) x = (rotate === 90 || rotate === 270 ? h : w) - x;
    return [x, y];
}

// Assets are { source, analysis }; a bare source is accepted where only the source is needed.
const assetsOf = (a) => (a && a.rgba ? { source: a, analysis: null } : a);

/** Whether the variant's cut-out is drawn: it is on, and the analysis it needs is there. */
export const cutoutOn = (variant, assets) => variant.cutout.mode !== "off" && !!assetsOf(assets).analysis;

/**
 * The subject box (section 9.7) of a variant, in oriented source px: what the cut-out keeps (alpha
 * ≥ 0.5), or with the cut-out off the pixels with alpha ≥ 0.5, or the whole source without alpha.
 */
export function subjectBoxFor(assets, variant) {
    let { source, analysis } = assetsOf(assets);
    let f = variant.fit;
    if (cutoutOn(variant, assets)) {
        let box = cutoutRegion(analysis, variant.cutout).box;
        if (box) {
            let { kx, ky } = analysis.proxy;
            let b = { x: box[0] / kx, y: box[1] / ky, w: (box[2] - box[0]) / kx, h: (box[3] - box[1]) / ky };
            return orientBox(b, source.width, source.height, f.rotate, f.flip);
        }
    }
    return subjectBox(source, f.rotate, f.flip);
}

/** "pixel" or "smooth": what fit.sampling "auto" means for this fit and source (section 7.3). */
export function resolveSampling(fit, sourceInfo) {
    if (fit.sampling !== "auto") return fit.sampling;
    if (sourceInfo.kind === "avatar") return "pixel";
    let k = 8 * fit.scale;
    return sourceInfo.width <= 64 && Math.abs(k - Math.round(k)) <= 0.01 ? "pixel" : "smooth";
}

// ------------------------------------------------------------ fit modes (section 9.7)

const centreOn = (S, s) => [20 - (S.x + S.w / 2) * s, 20 - (S.y + S.h / 2) * s];

/**
 * A new fit for a variant: "fit" (whole subject, margin m), "fillWidth", "cutBottom" (the cut falls
 * on the bottom edge; null when there is nothing to cut at this zoom) or "centre".
 */
export function fitFor(mode, variant, assets, margin = 1) {
    let f = variant.fit;
    let S = subjectBoxFor(assets, variant);
    let inner = 40 - 2 * margin;
    if (mode === "fit") {
        let s = Math.min(inner / S.w, inner / S.h);
        let [x, y] = centreOn(S, s);
        return { ...f, scale: s, x, y, anchor: "free" };
    }
    if (mode === "fillWidth") {
        let s = inner / S.w;
        let [x, y] = centreOn(S, s);
        if (S.h * s <= inner) return { ...f, scale: s, x, y, anchor: "free" };
        return { ...f, scale: s, x, y: margin - S.y * s, anchor: "top" };
    }
    if (mode === "cutBottom") {
        let s = f.scale;
        if (S.h * s <= 40 - margin) return null;
        return { ...f, x: centreOn(S, s)[0], y: margin - S.y * s, anchor: "top" };
    }
    if (mode === "centre") {
        let [x, y] = centreOn(S, f.scale);
        return { ...f, x, y, anchor: "free" };
    }
    throw new Error(`fitFor: unknown mode ${mode}`);
}

/**
 * Zoom to a new scale: about the frame centre, or with anchor "top" about the subject's top, which
 * stays at the margin so zooming in pushes the overflow out of the bottom.
 */
export function zoomFit(variant, assets, scale, margin = 1) {
    let f = variant.fit;
    let k = scale / f.scale;
    let x = 20 - (20 - f.x) * k;
    if (f.anchor === "top") {
        let S = subjectBoxFor(assets, variant);
        return { ...f, scale, x, y: margin - S.y * scale };
    }
    return { ...f, scale, x, y: 20 - (20 - f.y) * k };
}

/** Rotate or flip about the frame centre, keeping the subject's centre where it was. */
export function orientFit(variant, assets, rotate, flip) {
    let f = variant.fit;
    let S0 = subjectBoxFor(assets, variant);
    let cx = f.x + (S0.x + S0.w / 2) * f.scale;
    let cy = f.y + (S0.y + S0.h / 2) * f.scale;
    let S1 = subjectBoxFor(assets, { ...variant, fit: { ...f, rotate, flip } });
    return { ...f, rotate, flip, x: cx - (S1.x + S1.w / 2) * f.scale, y: cy - (S1.y + S1.h / 2) * f.scale };
}

// ------------------------------------------------------------ step 1: the logo layer

function sampleLayer(source, fit, sampling) {
    let o = oriented(source, fit.rotate, fit.flip);
    let s = fit.scale * WORK_SCALE;
    let ox = fit.x * WORK_SCALE;
    let oy = fit.y * WORK_SCALE;
    if (sampling === "pixel") return resampleRows(o.levels[0], WORK_SIZE, WORK_SIZE, s, ox, s, oy, "nearest", "zero");
    // Mip pyramid: big reductions start from 2× box-reduced levels, so the Lanczos pass reduces by a
    // factor between 2 and 4 (section 8.1). The levels cover the same area, so offsets don't change.
    let level = 0;
    while (s < 0.25) {
        level++;
        s *= 2;
        if (!o.levels[level]) o.levels[level] = rowsFromRaster(halveRows(o.levels[level - 1]));
    }
    return resampleRows(o.levels[level], WORK_SIZE, WORK_SIZE, s, ox, s, oy, "lanczos3", "zero");
}

function logoLayer(source, sourceInfo, variant) {
    let sampling = resolveSampling(variant.fit, sourceInfo);
    let f = variant.fit;
    let key = JSON.stringify([f.scale, f.x, f.y, f.rotate, f.flip, sampling]);
    let layers = cacheFor(source).layers;
    let hit = layers.get(variant.id);
    if (hit && hit.key === key) return { layer: hit.layer, sampling };
    let layer = sampleLayer(source, f, sampling);
    layers.set(variant.id, { key, layer });
    return { layer, sampling };
}

// ------------------------------------------------------------ step 2: the cut-out (section 9.4)

/**
 * Remove the cut-out region from a logo layer: where the resampled region r ≥ 0.5 the layer is
 * transparent; in a band next to it, colours are un-blended from the background colour, so no halo
 * of it is left.
 */
function cutLayer(L, assets, v) {
    let { source, analysis } = assets;
    let region = cutoutRegion(analysis, v.cutout);
    let p = analysis.proxy;
    let f = v.fit;
    let m = new Uint8ClampedArray(p.width * p.height * 4);
    for (let i = 0; i < region.removed.length; i++) if (region.removed[i]) m[i * 4 + 3] = 255;
    let o = orientRGBA(p.width, p.height, m, f.rotate, f.flip);
    let side = f.rotate === 90 || f.rotate === 270;
    let kx = side ? p.ky : p.kx;
    let ky = side ? p.kx : p.ky;
    let s = f.scale * WORK_SCALE;
    let r = resampleRows(rowsFromRGBA8(o.width, o.height, o.rgba), WORK_SIZE, WORK_SIZE, s / kx, f.x * WORK_SCALE, s / ky, f.y * WORK_SCALE, "lanczos3", "zero");
    let out = cloneRaster(L);
    let d = out.data;
    let n = WORK_SIZE * WORK_SIZE;
    let mask = new Uint8Array(n);
    for (let q = 0; q < n; q++) {
        if (r.data[q * 4 + 3] >= 0.5) {
            mask[q] = 1;
            d[q * 4] = d[q * 4 + 1] = d[q * 4 + 2] = d[q * 4 + 3] = 0;
        }
    }
    let hex = cutoutColor(analysis, v.cutout);
    if (!hex) return out;
    let bg = parseHex(hex).slice(0, 3);
    let band = Math.max(1.5, (v.cutout.softness * s) / ((p.kx + p.ky) / 2));
    let dist = distanceTransform(mask, WORK_SIZE, WORK_SIZE);
    for (let q = 0; q < n; q++) {
        let a = d[q * 4 + 3];
        if (mask[q] || a <= 0 || dist[q] > band) continue;
        let c = [d[q * 4] / a, d[q * 4 + 1] / a, d[q * 4 + 2] / a];
        let un = colorToAlpha(c, bg);
        let na = Math.min(a, un.alpha);
        d[q * 4] = un.color[0] * na;
        d[q * 4 + 1] = un.color[1] * na;
        d[q * 4 + 2] = un.color[2] * na;
        d[q * 4 + 3] = na;
    }
    return out;
}

// ------------------------------------------------------------ step 5: adjustments (section 9.10)

// Ink for "thicken": dark (OKLab L below this) and mostly opaque. *calibrate*
const INK_LIGHTNESS = 0.45;

/** Brightness, contrast and saturation in straight colour, then thicken dark lines. In place. */
function adjustLayer(L, adj) {
    let d = L.data;
    let n = L.width * L.height;
    if (adj.brightness || adj.contrast || adj.saturation) {
        let b = adj.brightness / 100;
        let k = 1 + adj.contrast / 100;
        let sat = 1 + adj.saturation / 100;
        for (let q = 0; q < n; q++) {
            let a = d[q * 4 + 3];
            if (a <= 0) continue;
            let c = [d[q * 4] / a, d[q * 4 + 1] / a, d[q * 4 + 2] / a];
            for (let i = 0; i < 3; i++) {
                if (b >= 0) c[i] += (1 - c[i]) * b;
                else c[i] *= 1 + b;
                c[i] = clamp01((c[i] - 0.5) * k + 0.5);
            }
            if (sat !== 1) {
                let lch = oklabToOklch(srgbToOklab(c));
                c = oklabToSrgb(oklchToOklab([lch[0], lch[1] * sat, lch[2]]));
            }
            d[q * 4] = c[0] * a;
            d[q * 4 + 1] = c[1] * a;
            d[q * 4 + 2] = c[2] * a;
        }
    }
    if (adj.thicken > 0) {
        let ink = new Uint8Array(n);
        for (let q = 0; q < n; q++) {
            let a = d[q * 4 + 3];
            if (a >= 0.5 && srgbToOklab([d[q * 4] / a, d[q * 4 + 1] / a, d[q * 4 + 2] / a])[0] < INK_LIGHTNESS) ink[q] = 1;
        }
        let { distance, nearest } = distanceTransformNearest(ink, L.width, L.height);
        let reach = adj.thicken * WORK_SCALE;
        let src = Float32Array.from(d);
        for (let q = 0; q < n; q++) {
            let cov = clamp01(reach + 0.5 - distance[q]);
            if (ink[q] || cov <= 0 || nearest[q] < 0) continue;
            let j = nearest[q] * 4;
            let ia = src[j + 3];
            let k = 1 - cov;
            d[q * 4] = (src[j] / ia) * cov + d[q * 4] * k;
            d[q * 4 + 1] = (src[j + 1] / ia) * cov + d[q * 4 + 1] * k;
            d[q * 4 + 2] = (src[j + 2] / ia) * cov + d[q * 4 + 2] * k;
            d[q * 4 + 3] = cov + d[q * 4 + 3] * k;
        }
    }
}

const isAdjusted = (adj) => !!(adj.brightness || adj.contrast || adj.saturation || adj.thicken);

// ------------------------------------------------------------ frames (section 9.9)

// Signed distance to the square (0, 0, size, size) with corner radius r: negative inside.
function sdRoundedSquare(px, py, size, r) {
    let h = size / 2;
    let qx = Math.abs(px - h) - (h - r);
    let qy = Math.abs(py - h) - (h - r);
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

// The circle stays 2 working px (¼ output px) inside the square, so its anti-aliased edge and any
// ring are never clipped (design rule 8).
const CIRCLE_R = 158;

function frameDistances(kind, radius) {
    let sd = new Float32Array(WORK_SIZE * WORK_SIZE);
    let r = kind === "rounded" ? Math.min(radius * WORK_SCALE, WORK_SIZE / 2) : 0;
    for (let y = 0; y < WORK_SIZE; y++) {
        for (let x = 0; x < WORK_SIZE; x++) {
            let px = x + 0.5;
            let py = y + 0.5;
            sd[y * WORK_SIZE + x] = kind === "circle" ? Math.hypot(px - WORK_SIZE / 2, py - WORK_SIZE / 2) - CIRCLE_R : sdRoundedSquare(px, py, WORK_SIZE, r);
        }
    }
    return sd;
}

const frameCache = new Map();

/** Frame coverage F and the signed distances, per frame kind and radius (null F: square, 1 everywhere). */
function frameOf(kind, radius) {
    let key = `${kind}|${kind === "rounded" ? radius : 0}`;
    let hit = frameCache.get(key);
    if (hit) return hit;
    let sd = frameDistances(kind, radius);
    let cov = null;
    if (kind !== "square") {
        cov = new Float32Array(sd.length);
        for (let i = 0; i < sd.length; i++) cov[i] = clamp01(0.5 - sd[i]);
    }
    hit = { sd, cov };
    frameCache.set(key, hit);
    return hit;
}

/** The ring: the band from the frame edge inward by width output px, anti-aliased on both sides. */
function ringCoverage(frame, width) {
    let w = width * WORK_SCALE;
    let out = new Float32Array(frame.sd.length);
    for (let i = 0; i < out.length; i++) {
        let outer = frame.cov ? frame.cov[i] : 1;
        out[i] = clamp01(outer - clamp01(0.5 - (frame.sd[i] + w)));
    }
    return out;
}

/** How the transparent version is made (section 8, step 9). */
export function resolveTransparent(variant, sourceInfo, hasCutout = false) {
    if (variant.transparent !== "auto") return variant.transparent;
    if (hasCutout || variant.maskOps.length || sourceInfo.hasAlpha) return "cutout";
    return variant.frame.kind !== "square" ? "shape" : "rounded";
}

// ------------------------------------------------------------ step 11: crisp colours (section 9.10)

/**
 * Reduce an 8-bit image's visible pixels (alpha ≥ floor) to n colours: k-means in OKLab weighted by
 * alpha, k-means++ seeded with mulberry32(1), at most 12 rounds. Alpha is kept.
 */
export function quantizeColors(image, n, floor) {
    let d = image.data;
    let idx = [];
    let lab = [];
    let wt = [];
    for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < floor || d[i + 3] === 0) continue;
        idx.push(i);
        lab.push(srgbToOklab([d[i] / 255, d[i + 1] / 255, d[i + 2] / 255]));
        wt.push(d[i + 3] / 255);
    }
    if (!idx.length) return;
    let rng = mulberry32(1);
    let dist2 = (p, c) => (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
    let pick = (weights) => {
        let total = weights.reduce((a, b) => a + b, 0);
        if (total <= 0) return -1;
        let r = rng() * total;
        for (let i = 0; i < weights.length; i++) {
            r -= weights[i];
            if (r < 0) return i;
        }
        return weights.length - 1;
    };
    let centres = [lab[pick(wt)].slice()];
    let near = lab.map((p) => dist2(p, centres[0]));
    while (centres.length < n) {
        let i = pick(near.map((d2, k) => d2 * wt[k]));
        if (i < 0) break;
        centres.push(lab[i].slice());
        for (let k = 0; k < lab.length; k++) near[k] = Math.min(near[k], dist2(lab[k], centres[centres.length - 1]));
    }
    let assign = new Int32Array(lab.length).fill(-1);
    for (let round = 0; round < 12; round++) {
        let changed = false;
        for (let k = 0; k < lab.length; k++) {
            let best = 0;
            let bestD = Infinity;
            for (let c = 0; c < centres.length; c++) {
                let dd = dist2(lab[k], centres[c]);
                if (dd < bestD) (bestD = dd), (best = c);
            }
            if (assign[k] !== best) (assign[k] = best), (changed = true);
        }
        if (!changed) break;
        let sums = centres.map(() => [0, 0, 0, 0]);
        for (let k = 0; k < lab.length; k++) {
            let s = sums[assign[k]];
            s[0] += lab[k][0] * wt[k];
            s[1] += lab[k][1] * wt[k];
            s[2] += lab[k][2] * wt[k];
            s[3] += wt[k];
        }
        sums.forEach((s, c) => {
            if (s[3] > 0) centres[c] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
        });
    }
    let rgb = centres.map((c) => oklabToSrgb(c).map((v) => Math.round(v * 255)));
    for (let k = 0; k < idx.length; k++) {
        let c = rgb[assign[k]];
        d[idx[k]] = c[0];
        d[idx[k] + 1] = c[1];
        d[idx[k] + 2] = c[2];
    }
}

// ------------------------------------------------------------ the pipeline

function reduce(r, resample, edge) {
    if (resample === "box") return boxReduce(r, WORK_SCALE);
    return resampleRows(rowsFromRaster(r), AVATAR_SIZE, AVATAR_SIZE, 1 / WORK_SCALE, 0, 1 / WORK_SCALE, 0, "lanczos3", edge);
}

function applyPixelEdits(image, edits, opaque) {
    for (let [x, y, hex] of edits) {
        let i = (y * AVATAR_SIZE + x) * 4;
        let n = parseInt(hex.slice(1), 16);
        let a = opaque ? 255 : n & 255;
        image.data[i] = a ? (n >>> 24) & 255 : 0;
        image.data[i + 1] = a ? (n >>> 16) & 255 : 0;
        image.data[i + 2] = a ? (n >>> 8) & 255 : 0;
        image.data[i + 3] = a;
    }
}

/**
 * Render one variant: { opaque, transparent } as 40 × 40 8-bit RGBA, the 320 × 320 working rasters,
 * and info for the checks. assets: { source (from sourceFromRGBA), analysis (from analyze(); null
 * while it isn't there yet: the cut-out then counts as off) }.
 */
export function render(project, variantId, assets) {
    assets = assetsOf(assets);
    let v = project.variants.find((x) => x.id === variantId);
    if (!v) throw new Error(`render: no variant ${variantId}`);
    let source = assets.source;
    let sourceInfo = { ...project.source, hasAlpha: source.hasAlpha };

    // Step 1, then step 2 (cut-out) and 5 (adjustments) on the logo layer.
    let { layer: L, sampling } = logoLayer(source, sourceInfo, v);
    let hasCutout = cutoutOn(v, assets);
    if (hasCutout) L = cutLayer(L, assets, v);
    if (isAdjusted(v.adjust)) {
        if (!hasCutout) L = cloneRaster(L);
        adjustLayer(L, v.adjust);
    }

    // Steps 6 and 7: composition, frame and ring. S is "C and the ring".
    let frame = frameOf(v.frame.kind, v.frame.radius);
    let F = frame.cov;
    let C = cloneRaster(L);
    if (F && !v.frame.breakOut) multiplyCoverage(C, F);
    let S = cloneRaster(C);
    let ring = v.frame.ring && v.frame.ring.width > 0 ? ringCoverage(frame, v.frame.ring.width) : null;
    if (ring) {
        fillOver(S, rgbOf(v.frame.ring.color, BLACK), ring);
        if (v.frame.breakOut) compositeOver(S, L);
    }

    // Step 8: the opaque output.
    let bg = rgbOf(v.background, WHITE);
    let outside = rgbOf(v.frame.outside ?? v.frame.ring?.color ?? v.background, WHITE);
    let O = createRaster(WORK_SIZE, WORK_SIZE);
    fillOver(O, outside, null);
    fillOver(O, bg, F);
    compositeOver(O, S);

    // Step 9: the transparent output.
    let mode = resolveTransparent(v, sourceInfo, hasCutout);
    let T = createRaster(WORK_SIZE, WORK_SIZE);
    if (mode === "cutout") {
        let r = v.border.width * WORK_SCALE;
        if (r > 0) {
            let mask = new Uint8Array(WORK_SIZE * WORK_SIZE);
            for (let p = 0; p < mask.length; p++) mask[p] = S.data[p * 4 + 3] >= 0.5 ? 1 : 0;
            let dist = distanceTransform(mask, WORK_SIZE, WORK_SIZE);
            let cov = new Float32Array(mask.length);
            for (let p = 0; p < cov.length; p++) cov[p] = clamp01(r + 0.5 - dist[p]);
            fillOver(T, rgbOf(v.border.color ?? v.background, BLACK), cov);
        }
        compositeOver(T, S);
    } else {
        // "shape": the opaque composition without the outside colour, cut to the frame; "rounded":
        // the same cut to a rounded square with radius 4 px.
        fillOver(T, bg, null);
        compositeOver(T, S);
        let cut = mode === "rounded" ? frameOf("rounded", 4).cov : F;
        if (cut) multiplyCoverage(T, cut);
    }

    // Step 10: one reduction to 40 × 40.
    let opaque = rasterToImage8(reduce(O, v.resample, "clamp"));
    for (let i = 3; i < opaque.data.length; i += 4) opaque.data[i] = 255;
    let transparent = rasterToImage8(reduce(T, v.resample, "zero"));

    // Step 11: crisp colours.
    if (v.adjust.colors >= 4) {
        quantizeColors(opaque, v.adjust.colors, 0);
        quantizeColors(transparent, v.adjust.colors, v.alphaFloor);
    }

    // Step 12: no faint pixels, and no colour under fully transparent ones (design rule 13).
    let td = transparent.data;
    for (let i = 0; i < td.length; i += 4) {
        if (td[i + 3] < v.alphaFloor) td[i + 3] = 0;
        if (td[i + 3] === 0) td[i] = td[i + 1] = td[i + 2] = 0;
    }

    // Step 13: pixel text (crisp: drawn after the reduction), then pixel edits, per output.
    drawTexts(opaque, v.texts);
    drawTexts(transparent, v.texts);
    applyPixelEdits(opaque, v.pixels.opaque, true);
    applyPixelEdits(transparent, v.pixels.transparent, false);

    // Step 14: what the checks need.
    let subjectAlpha = new Float32Array(WORK_SIZE * WORK_SIZE);
    for (let p = 0; p < subjectAlpha.length; p++) subjectAlpha[p] = S.data[p * 4 + 3];
    let box = subjectBoxFor(assets, v);
    let s = v.fit.scale;
    let info = {
        sampling,
        transparentMode: mode,
        hasCutout,
        background: v.background,
        subjectAlpha: boxReduceChannel(subjectAlpha, WORK_SIZE, WORK_SIZE, WORK_SCALE),
        // The subject without background or border at 40 × 40 (colour checks and suggestions).
        subject40: rasterToImage8(reduce(S, v.resample, "zero")),
        frameCoverage: F ? boxReduceChannel(F, WORK_SIZE, WORK_SIZE, WORK_SCALE) : new Float32Array(AVATAR_SIZE * AVATAR_SIZE).fill(1),
        subjectBox: { x: v.fit.x + box.x * s, y: v.fit.y + box.y * s, w: box.w * s, h: box.h * s },
    };
    return { opaque, transparent, work: { opaque: O, transparent: T }, info };
}
