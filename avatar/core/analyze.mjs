// Analysis of a logo (sections 9.1 to 9.5, 9.11, 9.12), on a proxy of at most 1024 px: background
// detection, the cut-out region, "main part only", circle detection, the palette and the colour
// suggestions. Runs in the worker; everything it returns is plain data and typed arrays, so it can
// be sent to the page. Values marked *calibrate* are tuned on the test corpus.

import { srgbToOklab, oklabToSrgb, oklabToOklch, oklchToOklab, deltaE, formatHex, parseHex, chromaKeyOf } from "./color.mjs";
import { resampleRows, rowsFromRGBA8, rasterToImage8, floodFill, labelComponents, distanceTransform, mulberry32 } from "./raster.mjs";

export const PROXY_SIZE = 1024;

// Background detection (9.3). *calibrate*
const BAND = 2;
const TRANSPARENT_SHARE = 0.15;
const CLUSTER_RADIUS = 0.04;
const FLAT_SHARE = 0.6;
// Specks smaller than this share of the image are dropped from what the cut-out keeps (9.4).
const SPECK_SHARE = 0.0005;
// Main part (9.5): parts whose box touches the main part's box grown by this share of the long side stay.
const MAIN_PART_GROW = 0.02;
// Colour suggestions (9.11). *calibrate*
const SIMILAR = 0.12;
const GOOD_SCORE = 0.15;
const FAIR_SCORE = 0.35;

/**
 * Named colours for candidate labels ("Logo on teal"): the list from section 11, plus brown, which
 * the complement of an orange or yellow logo often is.
 */
export const COLOR_NAMES = {
    teal: "#00626e",
    navy: "#16264a",
    black: "#121216",
    white: "#ffffff",
    cream: "#f5ecd6",
    grey: "#808080",
    red: "#d32f2f",
    orange: "#f08a24",
    yellow: "#f5c518",
    green: "#2e8b3e",
    blue: "#2563eb",
    purple: "#7b3fa0",
    brown: "#7a4a1e",
};

/**
 * The nearest named colour to a hex colour, by OKLab distance with lightness counted half: plain ΔE
 * is dominated by lightness and would call a dark brown "teal". *calibrate*
 */
export function colorName(hex) {
    let lab = srgbToOklab(parseHex(hex));
    let best = null;
    let bestD = Infinity;
    for (let [name, h] of Object.entries(COLOR_NAMES)) {
        let ref = srgbToOklab(parseHex(h));
        let d = Math.hypot((lab[0] - ref[0]) / 2, lab[1] - ref[1], lab[2] - ref[2]);
        if (d < bestD) (bestD = d), (best = name);
    }
    return best;
}

const hexOfLab = (lab) => formatHex(oklabToSrgb(lab));

// ------------------------------------------------------------ the proxy (9.1)

/** The analysis proxy: the core's own Lanczos-3 reduction to at most 1024 px on the long side. */
export function makeProxy(source) {
    let long = Math.max(source.width, source.height);
    if (long <= PROXY_SIZE) return { width: source.width, height: source.height, kx: 1, ky: 1, rgba: source.rgba };
    let width = Math.max(1, Math.round((source.width * PROXY_SIZE) / long));
    let height = Math.max(1, Math.round((source.height * PROXY_SIZE) / long));
    let kx = width / source.width;
    let ky = height / source.height;
    let r = resampleRows(rowsFromRGBA8(source.width, source.height, source.rgba), width, height, kx, 0, ky, 0, "lanczos3", "clamp");
    return { width, height, kx, ky, rgba: rasterToImage8(r).data };
}

// ------------------------------------------------------------ background (9.3)

function bandPixels(w, h) {
    let out = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x < BAND || y < BAND || x >= w - BAND || y >= h - BAND) out.push(y * w + x);
    return out;
}

/** "transparent", "flat" (with its colour) or "none" (a photo or busy edge). */
export function detectBackground(proxy) {
    let { width: w, height: h, rgba } = proxy;
    let band = bandPixels(w, h);
    let clear = band.filter((p) => rgba[p * 4 + 3] < 16).length;
    if (clear >= TRANSPARENT_SHARE * band.length) return { kind: "transparent", color: null };
    let counts = new Map();
    for (let p of band) {
        let key = (rgba[p * 4] << 16) | (rgba[p * 4 + 1] << 8) | rgba[p * 4 + 2];
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    // Greedy clusters, seeded by the most frequent colours first (ties by colour value): deterministic.
    let order = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    let clusters = [];
    for (let [key, n] of order) {
        let lab = srgbToOklab([((key >> 16) & 255) / 255, ((key >> 8) & 255) / 255, (key & 255) / 255]);
        let c = clusters.find((k) => deltaE(k.seed, lab) <= CLUSTER_RADIUS);
        if (!c) clusters.push((c = { seed: lab, sum: [0, 0, 0], n: 0 }));
        c.sum[0] += lab[0] * n;
        c.sum[1] += lab[1] * n;
        c.sum[2] += lab[2] * n;
        c.n += n;
    }
    let big = clusters.reduce((a, b) => (b.n > a.n ? b : a));
    if (big.n < FLAT_SHARE * band.length) return { kind: "none", color: null };
    return { kind: "flat", color: hexOfLab(big.sum.map((s) => s / big.n)) };
}

// ------------------------------------------------------------ the cut-out region (9.4, 9.5)

const regionCache = new WeakMap();

// Close a mask with a 1 px radius (3 × 3 dilate, then erode); outside the image counts as set.
function closeMask(mask, w, h) {
    let morph = (src, dilate) => {
        let out = new Uint8Array(src.length);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let any = false;
                let all = true;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        let xx = x + dx;
                        let yy = y + dy;
                        let v = xx < 0 || yy < 0 || xx >= w || yy >= h ? 1 : src[yy * w + xx];
                        if (v) any = true;
                        else all = false;
                    }
                }
                out[y * w + x] = (dilate ? any : all) ? 1 : 0;
            }
        }
        return out;
    };
    return morph(morph(mask, true), false);
}

function proxyLab(analysis) {
    let p = analysis.proxy;
    if (!p.lab) {
        let n = p.width * p.height;
        p.lab = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
            let lab = srgbToOklab([p.rgba[i * 4] / 255, p.rgba[i * 4 + 1] / 255, p.rgba[i * 4 + 2] / 255]);
            p.lab[i * 3] = lab[0];
            p.lab[i * 3 + 1] = lab[1];
            p.lab[i * 3 + 2] = lab[2];
        }
    }
    return p.lab;
}

/** The colour the cut-out removes: cutout.color, or the detected flat background; null if none. */
export function cutoutColor(analysis, cutout) {
    if (cutout.color && cutout.color !== "auto") return cutout.color;
    return analysis.background.kind === "flat" ? analysis.background.color : null;
}

/**
 * The removed region R on the proxy (1 = removed) for a variant's cut-out settings, with what's
 * left: { removed, box (of kept pixels with alpha ≥ 0.5, proxy px), keptArea, dropped (parts that
 * "main part only" removed) }. Already transparent pixels count as background. Cached per settings.
 */
export function cutoutRegion(analysis, cutout) {
    let key = JSON.stringify([cutout.mode, cutoutColor(analysis, cutout), cutout.tolerance, cutout.mode === "off" ? false : cutout.mainPart]);
    let cache = regionCache.get(analysis);
    if (!cache) regionCache.set(analysis, (cache = new Map()));
    if (cache.has(key)) return cache.get(key);
    let { width: w, height: h, rgba } = analysis.proxy;
    let n = w * h;
    let removed = new Uint8Array(n);
    let dropped = [];
    if (cutout.mode !== "off") {
        let hex = cutoutColor(analysis, cutout);
        let bg = hex ? srgbToOklab(parseHex(hex)) : null;
        let lab = bg ? proxyLab(analysis) : null;
        let tol = cutout.tolerance;
        let within = new Uint8Array(n);
        for (let p = 0; p < n; p++) {
            if (rgba[p * 4 + 3] < 128) within[p] = 1;
            else if (bg) {
                let d = Math.hypot(lab[p * 3] - bg[0], lab[p * 3 + 1] - bg[1], lab[p * 3 + 2] - bg[2]);
                if (d <= tol) within[p] = 1;
            }
        }
        removed = cutout.mode === "all" ? within : floodFill(within, w, h, bandPixels(w, h));
        removed = closeMask(removed, w, h);
        // Specks the cut-out leaves are dropped.
        let kept = removed.map((r) => (r ? 0 : 1));
        let parts = labelComponents(kept, w, h);
        let speck = SPECK_SHARE * n;
        for (let p = 0; p < n; p++) if (parts.labels[p] && parts.areas[parts.labels[p] - 1] < speck) removed[p] = 1;
        if (cutout.mainPart) dropped = keepMainPart(removed, rgba, w, h);
    }
    let box = [w, h, 0, 0];
    let keptArea = 0;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let p = y * w + x;
            if (removed[p] || rgba[p * 4 + 3] < 128) continue;
            keptArea++;
            if (x < box[0]) box[0] = x;
            if (y < box[1]) box[1] = y;
            if (x + 1 > box[2]) box[2] = x + 1;
            if (y + 1 > box[3]) box[3] = y + 1;
        }
    }
    let out = { removed, box: keptArea ? box : null, keptArea, dropped };
    cache.set(key, out);
    return out;
}

// Keep the largest part and the parts whose box meets its (grown) box; add the rest to removed.
function keepMainPart(removed, rgba, w, h) {
    let kept = new Uint8Array(w * h);
    for (let p = 0; p < kept.length; p++) kept[p] = !removed[p] && rgba[p * 4 + 3] >= 128 ? 1 : 0;
    let parts = labelComponents(kept, w, h);
    if (parts.count < 2) return [];
    let main = 0;
    for (let i = 1; i < parts.count; i++) if (parts.areas[i] > parts.areas[main]) main = i;
    let g = MAIN_PART_GROW * Math.max(w, h);
    let mb = parts.boxes[main];
    let grown = [mb[0] - g, mb[1] - g, mb[2] + g, mb[3] + g];
    let keep = parts.boxes.map((b) => b[0] < grown[2] && b[2] > grown[0] && b[1] < grown[3] && b[3] > grown[1]);
    let dropped = [];
    for (let i = 0; i < parts.count; i++) if (!keep[i]) dropped.push({ label: i + 1, box: parts.boxes[i], area: parts.areas[i], pixels: [] });
    if (!dropped.length) return [];
    let byLabel = new Map(dropped.map((d) => [d.label, d]));
    for (let p = 0; p < kept.length; p++) {
        let d = byLabel.get(parts.labels[p]);
        if (d) {
            removed[p] = 1;
            d.pixels.push(p);
        }
    }
    return dropped;
}

// ------------------------------------------------------------ palette and k-means

/** Weighted k-means in OKLab (k-means++ with mulberry32(1), at most 12 rounds): [{ lab, share, members }]. */
export function kmeansLab(points, weights, k) {
    if (!points.length) return [];
    let rng = mulberry32(1);
    let d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
    let pickIndex = (ws) => {
        let total = 0;
        for (let x of ws) total += x;
        if (total <= 0) return -1;
        let r = rng() * total;
        for (let i = 0; i < ws.length; i++) if ((r -= ws[i]) < 0) return i;
        return ws.length - 1;
    };
    let centres = [points[pickIndex(weights)].slice()];
    let near = points.map((p) => d2(p, centres[0]));
    while (centres.length < k) {
        let i = pickIndex(near.map((d, j) => d * weights[j]));
        if (i < 0) break;
        centres.push(points[i].slice());
        for (let j = 0; j < points.length; j++) near[j] = Math.min(near[j], d2(points[j], centres[centres.length - 1]));
    }
    let assign = new Int32Array(points.length).fill(-1);
    for (let round = 0; round < 12; round++) {
        let changed = false;
        for (let j = 0; j < points.length; j++) {
            let best = 0;
            for (let c = 1; c < centres.length; c++) if (d2(points[j], centres[c]) < d2(points[j], centres[best])) best = c;
            if (assign[j] !== best) (assign[j] = best), (changed = true);
        }
        if (!changed) break;
        let sums = centres.map(() => [0, 0, 0, 0]);
        for (let j = 0; j < points.length; j++) {
            let s = sums[assign[j]];
            for (let c = 0; c < 3; c++) s[c] += points[j][c] * weights[j];
            s[3] += weights[j];
        }
        sums.forEach((s, c) => s[3] > 0 && (centres[c] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]));
    }
    let total = weights.reduce((a, b) => a + b, 0) || 1;
    let out = centres.map((lab) => ({ lab, share: 0, members: [] }));
    for (let j = 0; j < points.length; j++) {
        out[assign[j]].share += weights[j] / total;
        out[assign[j]].members.push(j);
    }
    return out.filter((c) => c.share > 0).sort((a, b) => b.share - a.share);
}

// Lab and weight of proxy pixels (every step-th), for clustering.
function samplePixels(analysis, indices, maxSamples = 20000) {
    let lab = proxyLab(analysis);
    let rgba = analysis.proxy.rgba;
    let step = Math.max(1, Math.ceil(indices.length / maxSamples));
    let points = [];
    let weights = [];
    let at = [];
    for (let i = 0; i < indices.length; i += step) {
        let p = indices[i];
        points.push([lab[p * 3], lab[p * 3 + 1], lab[p * 3 + 2]]);
        weights.push(rgba[p * 4 + 3] / 255);
        at.push(p);
    }
    return { points, weights, at };
}

// ------------------------------------------------------------ circle (9.12)

/** A circle fitted to the subject's outline: { cx, cy, r } in source px, or null. */
function detectCircle(analysis, kept) {
    let { width: w, height: h, kx, ky } = analysis.proxy;
    let sx = 0, sy = 0, n = 0;
    for (let p = 0; p < kept.length; p++) if (kept[p]) (sx += p % w), (sy += Math.floor(p / w)), n++;
    if (!n) return null;
    let cx = sx / n + 0.5;
    let cy = sy / n + 0.5;
    let reach = Math.hypot(w, h);
    let pts = [];
    for (let a = 0; a < 360; a++) {
        let t = (a * Math.PI) / 180;
        let dx = Math.cos(t);
        let dy = Math.sin(t);
        let far = -1;
        for (let s = 0; s < reach; s += 0.5) {
            let x = Math.floor(cx + dx * s);
            let y = Math.floor(cy + dy * s);
            if (x < 0 || y < 0 || x >= w || y >= h) break;
            if (kept[y * w + x]) far = s;
        }
        if (far >= 0) pts.push([cx + dx * (far + 0.5), cy + dy * (far + 0.5)]);
    }
    if (pts.length < 90) return null;
    let fit = (ps) => {
        // Kasa: minimise Σ (x² + y² + Dx + Ey + F)², a 3 × 3 linear system.
        let m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
        let v = [0, 0, 0];
        for (let [x, y] of ps) {
            let row = [x, y, 1];
            let z = -(x * x + y * y);
            for (let i = 0; i < 3; i++) {
                v[i] += row[i] * z;
                for (let j = 0; j < 3; j++) m[i][j] += row[i] * row[j];
            }
        }
        let det = (a) => a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) - a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
        let d = det(m);
        if (!d) return null;
        let col = (k) => m.map((r, i) => r.map((x, j) => (j === k ? v[i] : x)));
        let [D, E, F] = [0, 1, 2].map((k) => det(col(k)) / d);
        let r2 = (D * D + E * E) / 4 - F;
        return r2 > 0 ? { cx: -D / 2, cy: -E / 2, r: Math.sqrt(r2) } : null;
    };
    let c = fit(pts);
    let use = pts;
    for (let round = 0; c && round < 3; round++) {
        let next = use.filter(([x, y]) => Math.abs(Math.hypot(x - c.cx, y - c.cy) - c.r) <= 0.03 * c.r);
        if (next.length === use.length || next.length < 10) break;
        use = next;
        c = fit(use);
    }
    if (!c) return null;
    let close = pts.filter(([x, y]) => Math.abs(Math.hypot(x - c.cx, y - c.cy) - c.r) <= 0.02 * c.r).length;
    if (close < 0.7 * 360 || c.r < 0.3 * Math.min(w, h)) return null;
    return { cx: c.cx / kx, cy: c.cy / ky, r: c.r / ((kx + ky) / 2) };
}

// ------------------------------------------------------------ analyze

/**
 * Analyse a source: the proxy, the background, the default cut-out (edge, tolerance 0.06), what
 * "main part only" changes, a circle, the palette and colours for candidates.
 */
export function analyze(source) {
    let proxy = makeProxy(source);
    let analysis = { proxy, background: detectBackground(proxy), hasAlpha: source.hasAlpha, circle: null, palette: [], mainPart: null, nameLine: null, rimColor: null };
    let { width: w, height: h, rgba } = proxy;
    let canCut = analysis.background.kind !== "none";
    let base = cutoutRegion(analysis, { mode: canCut ? "edge" : "off", color: "auto", tolerance: 0.06, mainPart: false });
    let kept = new Uint8Array(w * h);
    let keptList = [];
    for (let p = 0; p < kept.length; p++) {
        if (!base.removed[p] && rgba[p * 4 + 3] >= 128) {
            kept[p] = 1;
            keptList.push(p);
        }
    }
    analysis.subjectBox = base.box;
    analysis.canCut = canCut;

    // Palette of the subject.
    let s = samplePixels(analysis, keptList);
    analysis.palette = kmeansLab(s.points, s.weights, 6).map((c) => ({ color: hexOfLab(c.lab), share: c.share }));

    // What "main part only" would remove.
    if (canCut) {
        let main = cutoutRegion(analysis, { mode: "edge", color: "auto", tolerance: 0.06, mainPart: true });
        let change = base.keptArea ? (base.keptArea - main.keptArea) / base.keptArea : 0;
        analysis.mainPart = { change, box: main.box };
        // A wide, short part above or below the main part: a name line (candidate 10).
        let line = main.dropped
            .filter((d) => (d.box[2] - d.box[0]) / (d.box[3] - d.box[1]) >= 3 && d.area >= 0.05 * base.keptArea)
            .sort((a, b) => b.area - a.area)[0];
        if (line) {
            // The outline is the darkest colour along the banner's edge (a band 8% of its height
            // wide); the segment colours are the two biggest distinct colours of its inside, ordered
            // left to right, or one. (The letters are a smaller cluster and lose to the fill.)
            let inLine = new Uint8Array(w * h);
            for (let p of line.pixels) inLine[p] = 1;
            let outside = inLine.map((v) => (v ? 0 : 1));
            let depth = distanceTransform(outside, w, h);
            let band = Math.max(1.5, 0.08 * (line.box[3] - line.box[1]));
            let edgePx = line.pixels.filter((p) => depth[p] <= band);
            let innerPx = line.pixels.filter((p) => depth[p] > band);
            let edge = samplePixels(analysis, edgePx, 6000);
            let darkest = [...kmeansLab(edge.points, edge.weights, 2)].sort((a, b) => a.lab[0] - b.lab[0])[0];
            let inner = samplePixels(analysis, innerPx.length ? innerPx : line.pixels, 8000);
            let parts = kmeansLab(inner.points, inner.weights, 3);
            let meanX = (c) => c.members.reduce((t, j) => t + (inner.at[j] % w), 0) / c.members.length;
            let second = parts.slice(1).find((c) => c.share >= 0.2 && deltaE(c.lab, parts[0].lab) >= 0.15);
            let colors = second ? [parts[0], second].sort((a, b) => meanX(a) - meanX(b)).map((c) => hexOfLab(c.lab)) : [hexOfLab(parts[0].lab)];
            analysis.nameLine = { colors, outline: hexOfLab(darkest.lab), box: line.box };
        }
    }

    // A circle (coins and badges), and the colour of its rim.
    analysis.circle = detectCircle(analysis, kept);
    if (analysis.circle) {
        let { cx, cy, r } = analysis.circle;
        let k = (proxy.kx + proxy.ky) / 2;
        let rim = keptList.filter((p) => {
            let d = Math.hypot((p % w) + 0.5 - cx * proxy.kx, Math.floor(p / w) + 0.5 - cy * proxy.ky);
            return d >= 0.88 * r * k && d <= r * k;
        });
        let rs = samplePixels(analysis, rim, 8000);
        let clusters = kmeansLab(rs.points, rs.weights, 3).filter((c) => c.share >= 0.15);
        analysis.rimColor = clusters.length ? hexOfLab([...clusters].sort((a, b) => a.lab[0] - b.lab[0])[0].lab) : "#000000";
    }
    return analysis;
}

/** The typed arrays of an analysis, to transfer it to another thread without copying. */
export function analysisBuffers(analysis) {
    let out = [analysis.proxy.rgba.buffer];
    if (analysis.proxy.lab) out.push(analysis.proxy.lab.buffer);
    return out;
}

// ------------------------------------------------------------ colour suggestions (9.11)

/**
 * The edge pixels E of a 40 × 40 subject (no background, no border): subject pixels (alpha ≥ 0.5)
 * touching a pixel with alpha < 0.5, and the subject pixels up to 2 px inside them. [{ lab, w }]
 */
export function edgeSamples(subject) {
    let N = subject.width;
    let d = subject.data;
    let solid = (x, y) => x >= 0 && y >= 0 && x < N && y < N && d[(y * N + x) * 4 + 3] >= 128;
    let edge = new Uint8Array(N * N);
    for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
            if (!solid(x, y)) continue;
            let inside = (xx, yy) => xx < 0 || yy < 0 || xx >= N || yy >= N || solid(xx, yy);
            if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) edge[y * N + x] = 1;
        }
    }
    let out = [];
    for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
            if (!solid(x, y)) continue;
            let near = false;
            for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2 && !near; dx++) if (x + dx >= 0 && y + dy >= 0 && x + dx < N && y + dy < N && edge[(y + dy) * N + x + dx]) near = true;
            if (!near) continue;
            let i = (y * N + x) * 4;
            out.push({ lab: srgbToOklab([d[i] / 255, d[i + 1] / 255, d[i + 2] / 255]), w: d[i + 3] / 255 });
        }
    }
    return out;
}

/** Share of the edge samples within ΔE 0.12 of a background: lower is better contrast. */
export function backgroundScore(samples, hex) {
    let lab = srgbToOklab(parseHex(hex));
    let total = 0;
    let similar = 0;
    for (let s of samples) {
        total += s.w;
        if (deltaE(s.lab, lab) <= SIMILAR) similar += s.w;
    }
    return total ? similar / total : 0;
}

export const scoreLabel = (score) => (score < GOOD_SCORE ? "good" : score < FAIR_SCORE ? "fair" : "low");

/**
 * The 5 best backgrounds for a subject (a render's info.subject40), with their scores and labels:
 * the logo's own flat background, the complement of its dominant hue (two lightnesses), and teal,
 * navy, near-black, white and cream. Chroma-key colours are never suggested.
 */
export function suggestBackgrounds(analysis, subject) {
    let list = [];
    if (analysis?.background.kind === "flat") list.push(analysis.background.color);
    let dominant = analysis?.palette.map((c) => oklabToOklch(srgbToOklab(parseHex(c.color)))).find((lch) => lch[1] >= 0.03);
    if (dominant) {
        let h = (dominant[2] + 180) % 360;
        let C = Math.min(0.12, Math.max(0.06, dominant[1]));
        list.push(hexOfLab(oklchToOklab([0.42, C, h])), hexOfLab(oklchToOklab([0.28, C, h])));
    }
    list.push(COLOR_NAMES.teal, COLOR_NAMES.navy, COLOR_NAMES.black, COLOR_NAMES.white, COLOR_NAMES.cream);
    let samples = edgeSamples(subject);
    let seen = new Set();
    let scored = [];
    for (let hex of list) {
        let [r, g, b] = parseHex(hex);
        if (seen.has(hex) || chromaKeyOf(r * 255, g * 255, b * 255)) continue;
        seen.add(hex);
        let score = backgroundScore(samples, hex);
        scored.push({ color: hex, score, label: scoreLabel(score), name: colorName(hex) });
    }
    // Stable sort: ties keep the list order.
    return scored.sort((a, b) => a.score - b.score).slice(0, 5);
}
