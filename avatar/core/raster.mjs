// Rasters for the avatar maker: premultiplied RGBA in 0..1 (Float32Array), conversion to and from
// 8-bit straight RGBA, compositing, separable resampling (Lanczos-3, box, nearest), exact rotate and
// flip, a Euclidean distance transform, flood fill and connected components. No DOM.

import { clamp01 } from "./color.mjs";

/** A width × height raster of premultiplied RGBA floats, all transparent. */
export function createRaster(width, height) {
    return { width, height, data: new Float32Array(width * height * 4) };
}

/** Raster from 8-bit straight RGBA. */
export function rasterFromRGBA8(width, height, rgba) {
    let r = createRaster(width, height);
    let d = r.data;
    for (let i = 0; i < d.length; i += 4) {
        let a = rgba[i + 3] / 255;
        d[i] = (rgba[i] / 255) * a;
        d[i + 1] = (rgba[i + 1] / 255) * a;
        d[i + 2] = (rgba[i + 2] / 255) * a;
        d[i + 3] = a;
    }
    return r;
}

/** 8-bit straight RGBA image ({ width, height, data }) from a raster: unpremultiply, then round. */
export function rasterToImage8(r) {
    let out = new Uint8ClampedArray(r.width * r.height * 4);
    let d = r.data;
    for (let i = 0; i < d.length; i += 4) {
        let a = clamp01(d[i + 3]);
        if (a <= 1e-6) continue;
        out[i] = Math.round(clamp01(d[i] / a) * 255);
        out[i + 1] = Math.round(clamp01(d[i + 1] / a) * 255);
        out[i + 2] = Math.round(clamp01(d[i + 2] / a) * 255);
        out[i + 3] = Math.round(a * 255);
    }
    return { width: r.width, height: r.height, data: out };
}

export function cloneRaster(r) {
    return { width: r.width, height: r.height, data: new Float32Array(r.data) };
}

/** dst ← src over dst (same size, premultiplied). */
export function compositeOver(dst, src) {
    let d = dst.data;
    let s = src.data;
    for (let i = 0; i < d.length; i += 4) {
        let k = 1 - s[i + 3];
        d[i] = s[i] + d[i] * k;
        d[i + 1] = s[i + 1] + d[i + 1] * k;
        d[i + 2] = s[i + 2] + d[i + 2] * k;
        d[i + 3] = s[i + 3] + d[i + 3] * k;
    }
}

/** dst ← (flat straight colour rgb with per-pixel coverage; null means 1 everywhere) over dst. */
export function fillOver(dst, rgb, coverage = null) {
    let d = dst.data;
    for (let p = 0, i = 0; i < d.length; p++, i += 4) {
        let a = coverage ? coverage[p] : 1;
        if (a <= 0) continue;
        let k = 1 - a;
        d[i] = rgb[0] * a + d[i] * k;
        d[i + 1] = rgb[1] * a + d[i + 1] * k;
        d[i + 2] = rgb[2] * a + d[i + 2] * k;
        d[i + 3] = a + d[i + 3] * k;
    }
}

/** Multiply every pixel (premultiplied, so all four channels) by a coverage. */
export function multiplyCoverage(r, coverage) {
    let d = r.data;
    for (let p = 0, i = 0; i < d.length; p++, i += 4) {
        let c = coverage[p];
        if (c === 1) continue;
        d[i] *= c;
        d[i + 1] *= c;
        d[i + 2] *= c;
        d[i + 3] *= c;
    }
}

// ------------------------------------------------------------ resampling

/** Lanczos-3: sinc(x) · sinc(x / 3) for |x| < 3. */
export function lanczos3(x) {
    if (x === 0) return 1;
    if (x <= -3 || x >= 3) return 0;
    let px = Math.PI * x;
    return (3 * Math.sin(px) * Math.sin(px / 3)) / (px * px);
}

/**
 * 1-D resampling weights (section 9.6). Output pixel i (centre i + 0.5) samples the source at
 * u = (i + 0.5 − offset) / scale, where scale is output px per source px and offset the output
 * position of the source's origin. Reducing by f = 1 / scale > 1 widens the kernel to 3f. Weights are
 * normalised over the whole kernel; edge "zero" makes taps outside the source transparent (they
 * still count, so edges fade out), "clamp" moves them onto the edge pixel.
 * Taps of output i are idx/wt[start[i] .. start[i + 1]).
 */
export function resampleWeights(outSize, srcSize, scale, offset, filter, edge = "zero") {
    let start = new Int32Array(outSize + 1);
    let idx = [];
    let wt = [];
    let f = Math.max(1, 1 / scale);
    let support = 3 * f;
    for (let i = 0; i < outSize; i++) {
        start[i] = idx.length;
        let u = (i + 0.5 - offset) / scale;
        if (filter === "nearest") {
            let j = Math.floor(u);
            if (j >= 0 && j < srcSize) idx.push(j), wt.push(1);
            else if (edge === "clamp") idx.push(j < 0 ? 0 : srcSize - 1), wt.push(1);
            continue;
        }
        let j0 = Math.ceil(u - support - 0.5);
        let j1 = Math.floor(u + support - 0.5);
        let ws = [];
        let sum = 0;
        for (let j = j0; j <= j1; j++) {
            let w = lanczos3((j + 0.5 - u) / f);
            ws.push(w);
            sum += w;
        }
        if (sum === 0) continue;
        for (let j = j0; j <= j1; j++) {
            let w = ws[j - j0] / sum;
            if (w === 0) continue;
            if (j >= 0 && j < srcSize) idx.push(j), wt.push(w);
            else if (edge === "clamp") idx.push(j < 0 ? 0 : srcSize - 1), wt.push(w);
        }
    }
    start[outSize] = idx.length;
    return { start, idx: Int32Array.from(idx), wt: Float64Array.from(wt) };
}

/** Row reader over 8-bit straight RGBA: writes row j as premultiplied floats. */
export function rowsFromRGBA8(width, height, rgba) {
    return {
        width,
        height,
        row(j, out) {
            let o = j * width * 4;
            for (let i = 0; i < width * 4; i += 4) {
                let a = rgba[o + i + 3] / 255;
                out[i] = (rgba[o + i] / 255) * a;
                out[i + 1] = (rgba[o + i + 1] / 255) * a;
                out[i + 2] = (rgba[o + i + 2] / 255) * a;
                out[i + 3] = a;
            }
        },
    };
}

/** Row reader over a raster. */
export function rowsFromRaster(r) {
    return {
        width: r.width,
        height: r.height,
        row(j, out) {
            out.set(r.data.subarray(j * r.width * 4, (j + 1) * r.width * 4));
        },
    };
}

/**
 * Separable resampling (horizontal pass, then vertical) into a width × height raster: output (x, y)
 * samples source ((x + 0.5 − ox) / sx, (y + 0.5 − oy) / sy). Only the source rows that reach the
 * output are read. Colour is clamped to [0, α] and α to [0, 1] after each pass.
 */
export function resampleRows(src, width, height, sx, ox, sy, oy, filter, edge = "zero") {
    let out = createRaster(width, height);
    let wx = resampleWeights(width, src.width, sx, ox, filter, edge);
    let wy = resampleWeights(height, src.height, sy, oy, filter, edge);
    if (!wx.idx.length || !wy.idx.length) return out;
    let jmin = Infinity;
    let jmax = -1;
    for (let k = 0; k < wy.idx.length; k++) {
        if (wy.idx[k] < jmin) jmin = wy.idx[k];
        if (wy.idx[k] > jmax) jmax = wy.idx[k];
    }
    let rows = jmax - jmin + 1;
    let tmp = new Float32Array(rows * width * 4);
    let line = new Float32Array(src.width * 4);
    for (let j = jmin; j <= jmax; j++) {
        src.row(j, line);
        let base = (j - jmin) * width * 4;
        for (let x = 0; x < width; x++) {
            let r = 0, g = 0, b = 0, a = 0;
            for (let k = wx.start[x]; k < wx.start[x + 1]; k++) {
                let w = wx.wt[k];
                let s = wx.idx[k] * 4;
                r += line[s] * w;
                g += line[s + 1] * w;
                b += line[s + 2] * w;
                a += line[s + 3] * w;
            }
            a = clamp01(a);
            let o = base + x * 4;
            tmp[o] = r < 0 ? 0 : r > a ? a : r;
            tmp[o + 1] = g < 0 ? 0 : g > a ? a : g;
            tmp[o + 2] = b < 0 ? 0 : b > a ? a : b;
            tmp[o + 3] = a;
        }
    }
    let d = out.data;
    let acc = new Float64Array(width * 4);
    for (let y = 0; y < height; y++) {
        if (wy.start[y] === wy.start[y + 1]) continue;
        acc.fill(0);
        for (let k = wy.start[y]; k < wy.start[y + 1]; k++) {
            let w = wy.wt[k];
            let base = (wy.idx[k] - jmin) * width * 4;
            for (let i = 0; i < width * 4; i++) acc[i] += tmp[base + i] * w;
        }
        let o = y * width * 4;
        for (let i = 0; i < width * 4; i += 4) {
            let a = clamp01(acc[i + 3]);
            d[o + i] = acc[i] < 0 ? 0 : acc[i] > a ? a : acc[i];
            d[o + i + 1] = acc[i + 1] < 0 ? 0 : acc[i + 1] > a ? a : acc[i + 1];
            d[o + i + 2] = acc[i + 2] < 0 ? 0 : acc[i + 2] > a ? a : acc[i + 2];
            d[o + i + 3] = a;
        }
    }
    return out;
}

/**
 * Halve a source in both directions by 2 × 2 box averaging, for the mip pyramid. Odd sizes round up:
 * the missing pixels count as transparent, so the level covers exactly twice the source's area.
 */
export function halveRows(src) {
    let w = Math.ceil(src.width / 2);
    let h = Math.ceil(src.height / 2);
    let out = createRaster(w, h);
    let a = new Float32Array(src.width * 4);
    let b = new Float32Array(src.width * 4);
    let d = out.data;
    for (let y = 0; y < h; y++) {
        src.row(2 * y, a);
        if (2 * y + 1 < src.height) src.row(2 * y + 1, b);
        else b.fill(0);
        for (let x = 0; x < w; x++) {
            let i0 = 2 * x * 4;
            let has1 = 2 * x + 1 < src.width;
            let o = (y * w + x) * 4;
            for (let c = 0; c < 4; c++) {
                let s = a[i0 + c] + b[i0 + c];
                if (has1) s += a[i0 + 4 + c] + b[i0 + 4 + c];
                d[o + c] = s / 4;
            }
        }
    }
    return out;
}

/** Exact mean of each k × k block (the "box" reduction), premultiplied. */
export function boxReduce(r, k) {
    let w = Math.floor(r.width / k);
    let h = Math.floor(r.height / k);
    let out = createRaster(w, h);
    let s = r.data;
    let d = out.data;
    let n = k * k;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let acc = [0, 0, 0, 0];
            for (let yy = 0; yy < k; yy++) {
                let row = ((y * k + yy) * r.width + x * k) * 4;
                for (let xx = 0; xx < k * 4; xx += 4) {
                    acc[0] += s[row + xx];
                    acc[1] += s[row + xx + 1];
                    acc[2] += s[row + xx + 2];
                    acc[3] += s[row + xx + 3];
                }
            }
            let o = (y * w + x) * 4;
            for (let c = 0; c < 4; c++) d[o + c] = acc[c] / n;
        }
    }
    return out;
}

/** Mean of each k × k block of a single-channel coverage map. */
export function boxReduceChannel(values, width, height, k) {
    let w = Math.floor(width / k);
    let h = Math.floor(height / k);
    let out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let acc = 0;
            for (let yy = 0; yy < k; yy++) for (let xx = 0; xx < k; xx++) acc += values[(y * k + yy) * width + x * k + xx];
            out[y * w + x] = acc / (k * k);
        }
    }
    return out;
}

// ------------------------------------------------------------ orientation

/**
 * Rotate (0, 90, 180 or 270 degrees clockwise), then flip horizontally: an exact permutation of 8-bit
 * RGBA pixels, no resampling (section 7.1).
 */
export function orientRGBA(width, height, rgba, rotate, flip) {
    if (!rotate && !flip) return { width, height, rgba };
    let side = rotate === 90 || rotate === 270;
    let W = side ? height : width;
    let H = side ? width : height;
    let out = new Uint8ClampedArray(rgba.length);
    for (let j = 0; j < height; j++) {
        for (let i = 0; i < width; i++) {
            let x, y;
            if (rotate === 90) (x = height - 1 - j), (y = i);
            else if (rotate === 180) (x = width - 1 - i), (y = height - 1 - j);
            else if (rotate === 270) (x = j), (y = width - 1 - i);
            else (x = i), (y = j);
            if (flip) x = W - 1 - x;
            let s = (j * width + i) * 4;
            let o = (y * W + x) * 4;
            out[o] = rgba[s];
            out[o + 1] = rgba[s + 1];
            out[o + 2] = rgba[s + 2];
            out[o + 3] = rgba[s + 3];
        }
    }
    return { width: W, height: H, rgba: out };
}

// ------------------------------------------------------------ distances and regions

const FAR = 1e20;

// Felzenszwalb–Huttenlocher lower envelope of parabolas: squared distances along one line.
function edtLine(f, n, d, v, z) {
    let k = 0;
    v[0] = 0;
    z[0] = -FAR;
    z[1] = FAR;
    for (let q = 1; q < n; q++) {
        let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        while (s <= z[k]) {
            k--;
            s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        }
        k++;
        v[k] = q;
        z[k] = s;
        z[k + 1] = FAR;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
        while (z[k + 1] < q) k++;
        d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
    }
}

/**
 * Exact Euclidean distance (between pixel centres) from every pixel to the nearest pixel where
 * mask is non-zero, in linear time. Pixels in the mask get 0; with an empty mask everything is huge.
 */
export function distanceTransform(mask, width, height) {
    let n = Math.max(width, height);
    let f = new Float64Array(n);
    let d = new Float64Array(n);
    let v = new Int32Array(n);
    let z = new Float64Array(n + 1);
    let grid = new Float64Array(width * height);
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) f[y] = mask[y * width + x] ? 0 : FAR;
        edtLine(f, height, d, v, z);
        for (let y = 0; y < height; y++) grid[y * width + x] = d[y];
    }
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) f[x] = grid[y * width + x];
        edtLine(f, width, d, v, z);
        for (let x = 0; x < width; x++) grid[y * width + x] = Math.sqrt(d[x]);
    }
    return grid;
}

/** 4-connected flood fill from the seed pixels through pixels where ok is non-zero. */
export function floodFill(ok, width, height, seeds) {
    let region = new Uint8Array(width * height);
    let stack = [];
    for (let p of seeds) {
        if (ok[p] && !region[p]) (region[p] = 1), stack.push(p);
    }
    while (stack.length) {
        let p = stack.pop();
        let x = p % width;
        let y = (p - x) / width;
        let next = [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, y > 0 ? p - width : -1, y < height - 1 ? p + width : -1];
        for (let q of next) {
            if (q >= 0 && ok[q] && !region[q]) {
                region[q] = 1;
                stack.push(q);
            }
        }
    }
    return region;
}

/**
 * 8-connected components of the non-zero pixels: labels (0 = none, else 1..count), and per label its
 * area and bounding box [x0, y0, x1, y1) (index label − 1). Labels follow scan order, so they are stable.
 */
export function labelComponents(mask, width, height) {
    let labels = new Int32Array(width * height);
    let areas = [];
    let boxes = [];
    let stack = [];
    for (let start = 0; start < labels.length; start++) {
        if (!mask[start] || labels[start]) continue;
        let id = areas.length + 1;
        let area = 0;
        let box = [width, height, 0, 0];
        labels[start] = id;
        stack.push(start);
        while (stack.length) {
            let p = stack.pop();
            let x = p % width;
            let y = (p - x) / width;
            area++;
            if (x < box[0]) box[0] = x;
            if (y < box[1]) box[1] = y;
            if (x + 1 > box[2]) box[2] = x + 1;
            if (y + 1 > box[3]) box[3] = y + 1;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    let xx = x + dx;
                    let yy = y + dy;
                    if ((dx || dy) && xx >= 0 && yy >= 0 && xx < width && yy < height) {
                        let q = yy * width + xx;
                        if (mask[q] && !labels[q]) {
                            labels[q] = id;
                            stack.push(q);
                        }
                    }
                }
            }
        }
        areas.push(area);
        boxes.push(box);
    }
    return { labels, count: areas.length, areas, boxes };
}

/** mulberry32: the seeded random numbers the core uses where it needs any (seed 1), never Math.random. */
export function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
