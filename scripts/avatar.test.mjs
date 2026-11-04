// Tests for the avatar maker (DESIGN.md section 16): the core in avatar/core/ without a DOM, golden
// images, and guards that the npm package doesn't change. Run after the build: npm test
// UPDATE_GOLDEN=1 npm test rewrites the golden PNGs in scripts/fixtures/avatar/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";
import * as A from "../avatar/core/avatar.mjs";
import { analyze, cutoutRegion, suggestBackgrounds, edgeSamples, backgroundScore, colorName } from "../avatar/core/analyze.mjs";
import { candidates, initials } from "../avatar/core/candidates.mjs";
import { layoutText, textPixels, nameBarSize, FONTS } from "../avatar/core/font.mjs";
import { checkText, fixText } from "../avatar/app/text.js";
import { SOURCES } from "./fixtures/avatar/sources.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES = resolve(root, "scripts/fixtures/avatar");
const deflate = async (bytes) => new Uint8Array(deflateSync(bytes));
const inflate = (bytes) => new Uint8Array(inflateSync(bytes));
const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ""} ${a} is not within ${eps} of ${b}`);

const sources = {};
const sourceOf = (name) => (sources[name] ??= (() => {
    let s = SOURCES[name]();
    return A.sourceFromRGBA(s.width, s.height, s.rgba, name);
})());

/** A project for a source, its one variant fitted ("fit"), optionally edited. */
function projectFor(name, edit = () => {}) {
    let src = sourceOf(name);
    let p = A.newProject({ name, width: src.width, height: src.height });
    let v = p.variants[0];
    v.fit = A.fitFor("fit", v, src);
    edit(v, src);
    return A.validateProject(JSON.parse(JSON.stringify(p)));
}
const renderOf = (p, name) => A.render(p, p.selected, { source: sourceOf(name) });
// Source plus analysis, as the page has them once the worker is done.
const analyses = {};
const assetsOf = (name) => ({ source: sourceOf(name), analysis: (analyses[name] ??= analyze(sourceOf(name))) });
/** Like projectFor, with the analysis (so the cut-out works). */
function cutProject(name, edit = () => {}) {
    let assets = assetsOf(name);
    let p = A.newProject({ name, width: assets.source.width, height: assets.source.height });
    let v = p.variants[0];
    v.cutout.mode = "edge";
    v.fit = A.fitFor("fit", v, assets);
    edit(v, assets);
    return A.validateProject(JSON.parse(JSON.stringify(p)));
}
const renderCut = (p, name) => A.render(p, p.selected, assetsOf(name));
const ids = (checks) => checks.map((c) => c.id);
const pixel = (img, x, y) => [...img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)];

// A flat image: every pixel the same 8-bit RGBA.
function flat(width, height, rgba) {
    let d = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < d.length; i += 4) d.set(rgba, i);
    return d;
}

// ------------------------------------------------------------ color

test("color: sRGB round trip, OKLab reference values, ΔE, HSV, hex and contrast", () => {
    for (let i = 0; i <= 1000; i++) close(A.linearToSrgb(A.srgbToLinear(i / 1000)), i / 1000, 1e-6, "sRGB");
    let white = A.srgbToOklab([1, 1, 1]);
    close(white[0], 1, 1e-4, "white L");
    close(white[1], 0, 1e-4, "white a");
    close(white[2], 0, 1e-4, "white b");
    let red = A.srgbToOklab([1, 0, 0]);
    close(red[0], 0.628, 1e-3, "red L");
    close(red[1], 0.225, 1e-3, "red a");
    close(red[2], 0.126, 1e-3, "red b");
    let back = A.oklabToSrgb(A.srgbToOklab([0.2, 0.5, 0.8]));
    [0.2, 0.5, 0.8].forEach((c, k) => close(back[k], c, 1e-6, "OKLab round trip"));
    close(A.deltaE(A.srgbToOklab([0, 0, 0]), white), 1, 1e-4, "ΔE black to white");
    assert.deepEqual(A.rgbToHsv(0, 1, 0), [120, 1, 1]);
    assert.deepEqual(A.rgbToHsv(1, 0, 1), [300, 1, 1]);
    let rgb = A.hsvToRgb(...A.rgbToHsv(0.3, 0.6, 0.9));
    [0.3, 0.6, 0.9].forEach((c, k) => close(rgb[k], c, 1e-9, "HSV round trip"));
    assert.deepEqual(A.parseHex("#00626E"), [0, 98 / 255, 110 / 255, 1]);
    assert.equal(A.formatHex(A.parseHex("#00626e")), "#00626e");
    assert.equal(A.formatHex([1, 0, 0, 0.5], true), "#ff000080");
    assert.equal(A.parseHex("teal"), null);
    close(A.contrastRatio([1, 1, 1], [0, 0, 0]), 21, 1e-9, "contrast");
});

test("color: colour-to-alpha un-blends a background", () => {
    // 50% red over white is (1, 0.5, 0.5): red at alpha 0.5.
    let { alpha, color } = A.colorToAlpha([1, 0.5, 0.5], [1, 1, 1]);
    close(alpha, 0.5, 1e-9);
    [1, 0, 0].forEach((c, k) => close(color[k], c, 1e-9));
    assert.equal(A.colorToAlpha([1, 1, 1], [1, 1, 1]).alpha, 0);
    // Over a coloured background too.
    let b = [0, 98 / 255, 110 / 255];
    let c = b.map((v) => v * 0.25 + 1 * 0.75);
    close(A.colorToAlpha(c, b).alpha, 0.75, 1e-9);
});

// ------------------------------------------------------------ raster

test("raster: Lanczos keeps a constant image constant, and its weights sum to 1", () => {
    let src = A.rasterFromRGBA8(30, 20, flat(30, 20, [120, 60, 200, 255]));
    let out = A.resampleRows(A.rowsFromRaster(src), 12, 8, 12 / 30, 0, 8 / 20, 0, "lanczos3", "clamp");
    let want = [120 / 255, 60 / 255, 200 / 255, 1];
    for (let i = 0; i < out.data.length; i++) close(out.data[i], want[i % 4], 1e-5, "constant");
    for (let scale of [0.1, 0.37, 1, 2.5]) {
        let w = A.resampleWeights(25, 50, scale, 3, "lanczos3", "clamp");
        for (let i = 0; i < 25; i++) {
            let sum = 0;
            for (let k = w.start[i]; k < w.start[i + 1]; k++) sum += w.wt[k];
            close(sum, 1, 1e-9, `weights at scale ${scale}`);
        }
    }
});

test("raster: a red disc on transparency keeps no dark fringe (premultiplied resampling)", () => {
    let n = 200;
    let rgba = new Uint8ClampedArray(n * n * 4);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if ((x - 100) ** 2 + (y - 100) ** 2 < 80 ** 2) rgba.set([255, 0, 0, 255], (y * n + x) * 4);
    let img = A.rasterToImage8(A.resampleRows(A.rowsFromRGBA8(n, n, rgba), 40, 40, 0.2, 0, 0.2, 0, "lanczos3", "zero"));
    let edge = 0;
    for (let i = 0; i < img.data.length; i += 4) {
        if (img.data[i + 3] === 0) continue;
        if (img.data[i + 3] < 255) edge++;
        assert.ok(img.data[i] >= 254, `red ${img.data[i]} at alpha ${img.data[i + 3]}`);
    }
    assert.ok(edge > 20, "there are anti-aliased edge pixels");
});

test("raster: box reduction is the exact mean; halving keeps the area", () => {
    let rng = A.mulberry32(3);
    let r = A.createRaster(16, 16);
    for (let i = 0; i < r.data.length; i += 4) {
        let a = rng();
        r.data.set([rng() * a, rng() * a, rng() * a, a], i);
    }
    let out = A.boxReduce(r, 8);
    for (let by = 0; by < 2; by++) {
        for (let bx = 0; bx < 2; bx++) {
            for (let c = 0; c < 4; c++) {
                let sum = 0;
                for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) sum += r.data[((by * 8 + y) * 16 + bx * 8 + x) * 4 + c];
                close(out.data[(by * 2 + bx) * 4 + c], sum / 64, 1e-6, "box mean");
            }
        }
    }
    let half = A.halveRows(A.rowsFromRGBA8(3, 3, flat(3, 3, [0, 0, 0, 255])));
    assert.equal(half.width, 2);
    close(half.data[3], 1, 0, "full block");
    close(half.data[(1 * 2 + 1) * 4 + 3], 0.25, 1e-9, "corner block is a quarter covered");
});

test("raster: rotate and flip are exact permutations", () => {
    let w = 3, h = 2;
    let rgba = new Uint8ClampedArray(w * h * 4);
    for (let p = 0; p < w * h; p++) rgba.set([p, 0, 0, 255], p * 4);
    let r90 = A.orientRGBA(w, h, rgba, 90, false);
    assert.deepEqual([r90.width, r90.height], [2, 3]);
    // Pixel (i, j) lands at (h − 1 − j, i).
    assert.equal(r90.rgba[(0 * 2 + 1) * 4], 0, "(0,0) → (1,0)");
    assert.equal(r90.rgba[(2 * 2 + 0) * 4], 5, "(2,1) → (0,2)");
    let twice = A.orientRGBA(r90.width, r90.height, r90.rgba, 90, false);
    assert.deepEqual([...twice.rgba], [...A.orientRGBA(w, h, rgba, 180, false).rgba]);
    let r270 = A.orientRGBA(w, h, rgba, 270, false);
    assert.deepEqual([...A.orientRGBA(r270.width, r270.height, r270.rgba, 90, false).rgba], [...rgba]);
    let flipped = A.orientRGBA(w, h, rgba, 0, true);
    assert.equal(flipped.rgba[0], 2);
    assert.deepEqual([...A.orientRGBA(w, h, flipped.rgba, 0, true).rgba], [...rgba]);
});

test("raster: the distance transform matches brute force", () => {
    let rng = A.mulberry32(7);
    for (let round = 0; round < 5; round++) {
        let w = 23, h = 17;
        let mask = new Uint8Array(w * h).map(() => (rng() < 0.08 ? 1 : 0));
        mask[round * 7] = 1;
        let d = A.distanceTransform(mask, w, h);
        for (let p = 0; p < w * h; p++) {
            let best = Infinity;
            for (let q = 0; q < w * h; q++) if (mask[q]) best = Math.min(best, Math.hypot((p % w) - (q % w), Math.floor(p / w) - Math.floor(q / w)));
            close(d[p], best, 1e-9, `pixel ${p}`);
        }
    }
});

test("raster: flood fill is 4-connected, components are 8-connected", () => {
    // Two pixels that only touch diagonally.
    let ok = new Uint8Array([1, 0, 0, 1]);
    assert.deepEqual([...A.floodFill(ok, 2, 2, [0])], [1, 0, 0, 0]);
    let c = A.labelComponents(ok, 2, 2);
    assert.equal(c.count, 1);
    let mask = new Uint8Array([1, 1, 0, 0, 0, 0, 0, 1, 1]);
    c = A.labelComponents(mask, 3, 3);
    assert.equal(c.count, 2);
    assert.deepEqual(c.areas, [2, 2]);
    assert.deepEqual(c.boxes, [[0, 0, 2, 1], [1, 2, 3, 3]]);
});

// ------------------------------------------------------------ render

test("render: the same project and source give identical outputs, also from a fresh source", () => {
    let p = projectFor("mascot-alpha");
    let a = renderOf(p, "mascot-alpha");
    let b = renderOf(p, "mascot-alpha");
    let s = SOURCES["mascot-alpha"]();
    let c = A.render(p, p.selected, { source: A.sourceFromRGBA(s.width, s.height, s.rgba) });
    for (let r of [b, c]) {
        assert.deepEqual(r.opaque.data, a.opaque.data);
        assert.deepEqual(r.transparent.data, a.transparent.data);
    }
});

test("render: outputs follow the export rules (opaque alpha 255, no colour under transparent pixels, alpha floor)", () => {
    for (let name of ["disc-on-white", "mascot-alpha", "tall-figure", "coin"]) {
        let r = renderOf(projectFor(name, (v) => (v.alphaFloor = 30)), name);
        for (let i = 0; i < r.opaque.data.length; i += 4) assert.equal(r.opaque.data[i + 3], 255);
        let t = r.transparent.data;
        for (let i = 0; i < t.length; i += 4) {
            assert.ok(t[i + 3] === 0 || t[i + 3] >= 30, `${name}: alpha ${t[i + 3]} under the floor`);
            if (!t[i + 3]) assert.equal(t[i] + t[i + 1] + t[i + 2], 0, `${name}: colour under a transparent pixel`);
        }
    }
});

test("render: fit modes place the subject box as section 9.7 says", () => {
    let src = sourceOf("disc-on-white");
    let p = projectFor("disc-on-white");
    let v = p.variants[0];
    let box = A.render(p, "v1", { source: src }).info.subjectBox;
    close(box.w, 38, 1e-9, "fit: width");
    close(box.x, 1, 1e-9, "fit: left margin");
    close(box.y + box.h / 2, 20, 1e-9, "fit: centred");
    assert.equal(A.fitFor("cutBottom", v, src), null, "nothing to cut at this zoom");

    let tall = projectFor("tall-figure", (vv, s) => (vv.fit = A.fitFor("fillWidth", vv, s)));
    let t = renderOf(tall, "tall-figure");
    assert.equal(tall.variants[0].fit.anchor, "top");
    close(t.info.subjectBox.w, 38, 1e-9, "fill width");
    close(t.info.subjectBox.y, 1, 1e-9, "cut at bottom: top at the margin");
    assert.ok(t.info.subjectBox.y + t.info.subjectBox.h > 40, "the overflow leaves at the bottom");
    // With anchor top, zooming keeps the top at the margin.
    let zoomed = A.zoomFit(tall.variants[0], sourceOf("tall-figure"), tall.variants[0].fit.scale * 1.5);
    close(zoomed.y + A.subjectBox(sourceOf("tall-figure")).y * zoomed.scale, 1, 1e-9, "zoom about the top");

    // Zooming about the centre keeps the centre; "centre" undoes a nudge; rotating keeps the subject's centre.
    let z = A.zoomFit(v, src, v.fit.scale * 0.5);
    close(z.x + 240 * z.scale, 20, 1e-9, "zoom about the frame centre");
    let nudged = { ...v, fit: { ...v.fit, x: v.fit.x + 3 } };
    close(A.fitFor("centre", nudged, src).x, v.fit.x, 1e-9, "centre");
    let turned = A.orientFit(v, src, 90, false);
    let S = A.subjectBox(src, 90, false);
    close(turned.x + (S.x + S.w / 2) * turned.scale, 20, 1e-9, "rotate keeps the centre");
});

test("render: the circle frame keeps its ring complete inside the square", () => {
    let fx = JSON.parse(readFileSync(join(FIXTURES, "coin-ring.json"), "utf8"));
    let p = A.validateProject(fx.project);
    let r = renderOf(p, fx.source);
    let lum = ([r0, g, b]) => (r0 + g + b) / 3;
    // The ring shows at all four edges, equally dark; the corners are the outside colour (the ring's).
    let edges = [[20, 0], [19, 39], [0, 20], [39, 19]].map(([x, y]) => lum(pixel(r.opaque, x, y)));
    for (let e of edges) assert.ok(e < 90, `ring pixel too light: ${e}`);
    assert.ok(Math.max(...edges) - Math.min(...edges) < 25, `ring uneven: ${edges}`);
    assert.deepEqual(pixel(r.opaque, 0, 0), [18, 18, 22, 255]);
    // The transparent version is the coin: its corners are transparent, its middle is not.
    assert.equal(r.info.transparentMode, "shape");
    assert.equal(pixel(r.transparent, 0, 0)[3], 0);
    assert.equal(pixel(r.transparent, 20, 20)[3], 255);
});

test("render: the border of the transparent version (1.1 px, and 0 for none)", () => {
    // A square subject on transparency, drawn as 20 × 20 output px from x = y = 10.
    let n = 200;
    let rgba = new Uint8ClampedArray(n * n * 4);
    for (let y = 50; y < 150; y++) for (let x = 50; x < 150; x++) rgba.set([226, 150, 26, 255], (y * n + x) * 4);
    let src = A.sourceFromRGBA(n, n, rgba);
    let make = (width) => {
        let p = A.newProject({ name: "square", width: n, height: n });
        let v = p.variants[0];
        Object.assign(v, { background: "#00626e", resample: "box", border: { width, color: null } });
        v.fit = { ...v.fit, scale: 0.2, x: 0, y: 0 };
        return A.render(p, "v1", { source: src }).transparent;
    };
    let t = make(1.1);
    // 1 px outside: the border in the background colour (the subject's anti-aliased edge tints it a little).
    let border = pixel(t, 9, 20);
    assert.equal(border[3], 255);
    [0, 98, 110].forEach((c, k) => close(border[k], c, 8, "border colour"));
    assert.ok(pixel(t, 8, 20)[3] <= 64, "2 px outside: at most a faint edge");
    assert.equal(pixel(t, 7, 20)[3], 0, "3 px outside: nothing");
    assert.deepEqual(pixel(t, 11, 20), [226, 150, 26, 255], "the subject itself");
    assert.equal(pixel(make(0), 9, 20)[3], 0, "border 0: no border at all");
});

test("render: pixel edits come last, crisp colours limit the palette, an avatar source stays pixel-exact", () => {
    let tall = A.validateProject(JSON.parse(readFileSync(join(FIXTURES, "tall-cut-bottom.json"), "utf8")).project);
    let r = renderOf(tall, "tall-figure");
    assert.deepEqual(pixel(r.opaque, 20, 20), [255, 90, 31, 255]);
    assert.deepEqual(pixel(r.transparent, 0, 0), [255, 90, 31, 255]);
    assert.deepEqual(pixel(r.transparent, 21, 20), [0, 0, 0, 0]);

    let crisp = projectFor("gradient", (v) => (v.adjust.colors = 6));
    let c = renderOf(crisp, "gradient");
    let colours = new Set();
    for (let i = 0; i < c.opaque.data.length; i += 4) colours.add(c.opaque.data.slice(i, i + 3).join());
    assert.ok(colours.size <= 6, `${colours.size} colours`);

    // A 40 × 40 avatar: sampled pixel by pixel and reduced by box, so its pixels come back unchanged.
    let src = sourceOf("pixel-avatar");
    let p = A.newProject({ name: "avatar.png", width: 40, height: 40 });
    assert.equal(p.source.kind, "avatar");
    let out = A.render(p, "v1", { source: src });
    assert.equal(out.info.sampling, "pixel");
    for (let i = 0; i < src.rgba.length; i += 4) {
        if (src.rgba[i + 3] === 255) assert.deepEqual([...out.opaque.data.slice(i, i + 4)], [...src.rgba.slice(i, i + 4)], `pixel ${i / 4}`);
    }
});

// ------------------------------------------------------------ checks

test("checks: each of C1, C2, C4, C6, C10, C11 and C12 fires on a fixture, and not on another", async () => {
    // A tall mascot filling the width, cut at the bottom (a whole-fit leaves empty sides: C6).
    let good = projectFor("mascot-alpha", (v, s) => ((v.background = "#00626e"), (v.fit = A.fitFor("fillWidth", v, s))));
    let goodResult = renderOf(good, "mascot-alpha");
    let quiet = A.runChecks(goodResult, good, "v1", { opaque: 1500, transparent: 1700 });
    assert.deepEqual(ids(quiet), [], `a good avatar is quiet: ${JSON.stringify(quiet)}`);

    // C1: a wrong size.
    let bad = { ...goodResult, opaque: { width: 39, height: 40, data: new Uint8ClampedArray(39 * 40 * 4) } };
    assert.deepEqual(ids(A.runChecks(bad, good, "v1")), ["C1"]);

    // C2: over 20,000 bytes is an error for that file only; exactly 20,000 is fine.
    let c2 = A.runChecks(goodResult, good, "v1", { opaque: 20001, transparent: 20000 });
    assert.deepEqual(c2.map((c) => [c.id, c.level, c.output]), [["C2", "error", "opaque"]]);
    let fewer = A.applyFix(good, "v1", c2[0], { result: goodResult, source: sourceOf("mascot-alpha") });
    assert.equal(fewer.variants[0].adjust.colors, 32);

    // C4: lime in the logo; the fix shifts those pixels away from the key.
    let lime = new Uint8ClampedArray(flat(100, 100, [255, 255, 255, 255]));
    for (let y = 20; y < 80; y++) for (let x = 20; x < 80; x++) lime.set([0, 255, 0, 255], (y * 100 + x) * 4);
    let limeSrc = A.sourceFromRGBA(100, 100, lime);
    let lp = A.newProject({ name: "lime", width: 100, height: 100 });
    let lr = A.render(lp, "v1", { source: limeSrc });
    let c4 = A.runChecks(lr, lp, "v1").filter((c) => c.id === "C4");
    assert.deepEqual(c4.map((c) => c.output), ["opaque", "transparent"]);
    assert.equal(c4[0].params.key, "lime");
    let shifted = A.applyFix(lp, "v1", c4[0], { result: lr, source: limeSrc });
    let after = A.runChecks(A.render(shifted, "v1", { source: limeSrc }), shifted, "v1").filter((c) => c.id === "C4");
    assert.deepEqual(after.map((c) => c.output), ["transparent"], "the opaque version is fixed");
    let blue = new Uint8ClampedArray(lime);
    for (let i = 0; i < blue.length; i += 4) if (blue[i + 1] === 255 && blue[i] === 0) blue.set([0, 0, 255, 255], i);
    let bp = A.newProject({ name: "blue", width: 100, height: 100 });
    assert.ok(!ids(A.runChecks(A.render(bp, "v1", { source: A.sourceFromRGBA(100, 100, blue) }), bp, "v1")).includes("C4"));

    // C6: a small logo leaves empty bands; Fit fixes it.
    let small = projectFor("mascot-alpha", (v, s) => (v.fit = A.zoomFit(v, s, v.fit.scale * 0.6)));
    let sr = renderOf(small, "mascot-alpha");
    let c6 = A.runChecks(sr, small, "v1").find((c) => c.id === "C6");
    assert.ok(c6, "C6 fires");
    assert.ok(c6.params.size >= 5);
    let refit = A.applyFix(small, "v1", c6, { result: sr, source: sourceOf("mascot-alpha") });
    assert.ok(!ids(A.runChecks(renderOf(refit, "mascot-alpha"), refit, "v1")).includes("C6"));

    // C10: a logo smaller than the avatar.
    let tinyRgba = flat(20, 16, [30, 80, 200, 255]);
    let tiny = A.newProject({ name: "tiny", width: 20, height: 16 });
    assert.ok(ids(A.runChecks(A.render(tiny, "v1", { source: A.sourceFromRGBA(20, 16, tinyRgba) }), tiny, "v1")).includes("C10"));
    assert.ok(!ids(quiet).includes("C10"));

    // C11: off centre by 3 px; the fix moves it back.
    // (On a logo with room on both sides: one cut by the edge can't show its whole offset.)
    let off = projectFor("disc-on-white", (v) => (v.fit.x += 3));
    let or = renderOf(off, "disc-on-white");
    let c11 = A.runChecks(or, off, "v1").find((c) => c.id === "C11");
    assert.deepEqual([c11.level, c11.params.side, c11.params.px], ["info", "right", 3]);
    let centred = A.applyFix(off, "v1", c11, { result: or, source: sourceOf("disc-on-white") });
    assert.ok(!ids(A.runChecks(renderOf(centred, "disc-on-white"), centred, "v1")).includes("C11"));

    // C12: an opaque logo's transparent version keeps its background; no background colour at all.
    let opaqueLogo = projectFor("disc-on-white");
    let c12 = A.runChecks(renderOf(opaqueLogo, "disc-on-white"), opaqueLogo, "v1").filter((c) => c.id === "C12");
    assert.deepEqual(c12.map((c) => [c.level, c.params.case]), [["info", "kept"]]);
    let none = projectFor("mascot-alpha", (v) => (v.background = null));
    let c12b = A.runChecks(renderOf(none, "mascot-alpha"), none, "v1").filter((c) => c.id === "C12");
    assert.deepEqual(c12b.map((c) => [c.level, c.params.case]), [["warning", "none"]]);
    assert.equal(A.applyFix(none, "v1", c12b[0], { result: null, source: null }), null, "picking a colour is up to the page");
});

test("checks: every check and fix has words on the page", () => {
    let samples = [
        { id: "C1", params: {} },
        { id: "C2", output: "transparent", params: { bytes: 21300 } },
        { id: "C4", params: { count: 4, key: "lime" } },
        { id: "C6", params: { side: "top", size: 7, longest: 38 } },
        { id: "C6", params: { empty: true } },
        { id: "C10", params: {} },
        { id: "C11", params: { px: 1, side: "left" } },
        { id: "C12", params: { case: "kept" } },
        { id: "C12", params: { case: "none" } },
    ];
    assert.equal(checkText(samples[1]), "The transparent PNG is 21.3 kB; FIRST's limit is 20 kB.");
    assert.equal(checkText(samples[3]), "The top 7 rows are empty.");
    assert.equal(checkText(samples[6]), "The logo is 1 px left of centre.");
    for (let s of samples) assert.notEqual(checkText(s), s.id, `${s.id} has a message`);
    for (let action of ["fewerColors", "shiftChroma", "fit", "fillWidth", "nudge", "removeBackground", "pickBackground"]) assert.ok(fixText({ fix: { action } }), action);
});

// ------------------------------------------------------------ png

// An independent reader for the tests: chunk list, IHDR, and an unfilter of its own.
function readPNG(bytes) {
    let view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let chunks = [];
    let idat = [];
    let ihdr;
    for (let o = 8; o < bytes.length; ) {
        let len = view.getUint32(o);
        let type = Buffer.from(bytes.subarray(o + 4, o + 8)).toString("latin1");
        chunks.push(type);
        let body = bytes.subarray(o + 8, o + 8 + len);
        if (type === "IHDR") ihdr = { width: view.getUint32(o + 8), height: view.getUint32(o + 12), depth: body[8], type: body[9], compression: body[10], filter: body[11], interlace: body[12] };
        if (type === "IDAT") idat.push(Buffer.from(body));
        o += 12 + len;
    }
    let raw = inflateSync(Buffer.concat(idat));
    let bpp = ihdr.type === 6 ? 4 : 3;
    let stride = ihdr.width * bpp;
    let px = [];
    let prev = new Array(stride).fill(0);
    for (let y = 0; y < ihdr.height; y++) {
        let t = raw[y * (stride + 1)];
        let row = [];
        for (let i = 0; i < stride; i++) {
            let x = raw[y * (stride + 1) + 1 + i];
            let a = i >= bpp ? row[i - bpp] : 0;
            let b = prev[i];
            let c = i >= bpp ? prev[i - bpp] : 0;
            let p = a + b - c;
            let pred = [0, a, b, (a + b) >> 1, Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c][t];
            row.push((x + pred) & 255);
        }
        for (let i = 0; i < stride; i += bpp) px.push(row[i], row[i + 1], row[i + 2], bpp === 4 ? row[i + 3] : 255);
        prev = row;
    }
    return { chunks, ihdr, pixels: px };
}

test("png: encodes 8-bit RGB and RGBA that decode to the same pixels, with no extra chunks", async () => {
    assert.equal(A.crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
    let r = renderOf(projectFor("gradient", (v) => (v.background = "#16264a")), "gradient");
    for (let [img, alpha] of [[r.opaque, false], [r.transparent, true]]) {
        for (let compress of [deflate, A.deflateStored]) {
            let bytes = await A.encodePNG(img, { alpha }, compress);
            let png = readPNG(bytes);
            assert.deepEqual(png.chunks, ["IHDR", "IDAT", "IEND"]);
            assert.deepEqual(png.ihdr, { width: 40, height: 40, depth: 8, type: alpha ? 6 : 2, compression: 0, filter: 0, interlace: 0 });
            assert.deepEqual(png.pixels, [...img.data]);
            let decoded = await A.decodePNG(bytes, inflate);
            assert.deepEqual([...decoded.data], [...img.data]);
            assert.ok(bytes.length <= A.MAX_BYTES, `${bytes.length} bytes`);
        }
    }
});

test("png: refuses images that break the export rules", async () => {
    let img = { width: 2, height: 1, data: new Uint8ClampedArray([1, 2, 3, 254, 1, 2, 3, 255]) };
    await assert.rejects(A.encodePNG(img, { alpha: false }, deflate), /alpha below 255/);
    let hidden = { width: 1, height: 1, data: new Uint8ClampedArray([0, 255, 0, 0]) };
    await assert.rejects(A.encodePNG(hidden, { alpha: true }, deflate), /transparent pixel has colour/);
});

// ------------------------------------------------------------ zip

test("zip: store-only archive with UTF-8 names, correct offsets and CRCs", () => {
    let date = new Date(2026, 10, 3, 15, 43, 10);
    let files = [
        { name: "23452-tiewraps-avatar-40.png", data: new Uint8Array([1, 2, 3, 4, 5]), date },
        { name: "README – rëadme.txt", data: new TextEncoder().encode("Upload steps\n"), date },
        { name: "empty.json", data: new Uint8Array(0), date },
    ];
    let zip = A.makeZip(files);
    let v = new DataView(zip.buffer);
    let end = zip.length - 22;
    assert.equal(v.getUint32(end, true), 0x06054b50);
    assert.equal(v.getUint16(end + 10, true), 3);
    let dir = v.getUint32(end + 16, true);
    assert.equal(dir + v.getUint32(end + 12, true), end);
    let o = dir;
    for (let f of files) {
        assert.equal(v.getUint32(o, true), 0x02014b50);
        assert.equal(v.getUint16(o + 8, true) & 0x0800, 0x0800, "UTF-8 flag");
        assert.equal(v.getUint16(o + 10, true), 0, "stored");
        assert.equal(v.getUint32(o + 16, true), A.crc32(f.data));
        let name = new TextDecoder().decode(zip.subarray(o + 46, o + 46 + v.getUint16(o + 28, true)));
        assert.equal(name, f.name);
        let local = v.getUint32(o + 42, true);
        assert.equal(v.getUint32(local, true), 0x04034b50);
        let nameLen = v.getUint16(local + 26, true);
        assert.deepEqual(zip.subarray(local + 30 + nameLen, local + 30 + nameLen + f.data.length), f.data);
        // DOS time 15:43:10 and date 2026-11-03.
        assert.equal(v.getUint16(local + 10, true), (15 << 11) | (43 << 5) | 5);
        assert.equal(v.getUint16(local + 12, true), ((2026 - 1980) << 9) | (11 << 5) | 3);
        o += 46 + v.getUint16(o + 28, true);
    }
    let hasUnzip = (() => {
        try {
            execFileSync("unzip", ["-v"], { stdio: "ignore" });
            return true;
        } catch {
            return false;
        }
    })();
    if (hasUnzip) {
        let dirPath = mkdtempSync(join(tmpdir(), "avatar-zip-"));
        try {
            writeFileSync(join(dirPath, "t.zip"), zip);
            assert.match(execFileSync("unzip", ["-t", join(dirPath, "t.zip")], { encoding: "utf8" }), /No errors detected/);
        } finally {
            rmSync(dirPath, { recursive: true, force: true });
        }
    }
});

// ------------------------------------------------------------ project

test("project: valid projects round-trip, numbers are clamped, unknown keys dropped", () => {
    let p = A.newProject({ name: "logo.png", width: 800, height: 600 }, { number: 23452, name: "TieWraps" });
    assert.deepEqual(A.validateProject(JSON.parse(JSON.stringify(p))), p);
    let file = JSON.parse(A.projectToFile(p, "data:image/png;base64,AAAA"));
    assert.equal(A.validateProject(file).assets.source, "data:image/png;base64,AAAA");
    let wild = JSON.parse(JSON.stringify(p));
    Object.assign(wild.variants[0], { alphaFloor: 500, extra: "dropped", background: "#00626E" });
    wild.variants[0].border.width = -3;
    wild.variants[0].frame.radius = 99;
    wild.variants[0].adjust.colors = 2;
    let ok = A.validateProject(wild).variants[0];
    assert.deepEqual([ok.alphaFloor, ok.border.width, ok.frame.radius, ok.adjust.colors, ok.background, "extra" in ok], [64, 0, 20, 4, "#00626e", false]);
    assert.equal(A.nextId(p, "v"), "v2");
});

test("project: unusable files are rejected with readable messages", () => {
    let p = A.newProject({ name: "logo.png", width: 800, height: 600 });
    let bad = (edit) => {
        let q = JSON.parse(JSON.stringify(p));
        edit(q);
        return () => A.validateProject(q);
    };
    assert.throws(bad((q) => (q.format = "something")), /isn't an avatar project file/);
    assert.throws(bad((q) => (q.version = 2)), /newer version of the avatar maker/);
    assert.throws(bad((q) => (q.variants[0].background = "#12345")), /isn't a colour like #1a2b3c/);
    assert.throws(bad((q) => (q.variants[0].maskOps = Array.from({ length: 5001 }, () => ({ op: "erase", kind: "wand", x: 0, y: 0 })))), /more than 5000 operations/);
    assert.throws(bad((q) => q.variants.push({ ...q.variants[0] })), /used twice/);
    assert.throws(bad((q) => (q.variants = [])), /no variants/);
    assert.throws(() => A.validateProject("not json"), /isn't an avatar project file/);
});

// ------------------------------------------------------------ golden images

const GOLDEN = readdirSync(FIXTURES).filter((f) => f.endsWith(".json") && f !== "npm-package.json");

test("golden: at least 5 fixture projects", () => assert.ok(GOLDEN.length >= 5, `${GOLDEN.length} fixtures`));

for (let file of GOLDEN) {
    let name = file.replace(/\.json$/, "");
    test(`golden: ${name}`, async () => {
        let fx = JSON.parse(readFileSync(join(FIXTURES, file), "utf8"));
        let p = A.validateProject(fx.project);
        let r = A.render(p, p.selected, assetsOf(fx.source));
        for (let [kind, alpha] of [["opaque", false], ["transparent", true]]) {
            let path = join(FIXTURES, `${name}.${kind}.png`);
            if (process.env.UPDATE_GOLDEN) writeFileSync(path, await A.encodePNG(r[kind], { alpha }, deflate));
            assert.ok(existsSync(path), `${path} is missing: run UPDATE_GOLDEN=1 npm test`);
            let want = await A.decodePNG(new Uint8Array(readFileSync(path)), inflate);
            let diff = 0;
            for (let i = 0; i < want.data.length; i++) if (want.data[i] !== r[kind].data[i]) diff++;
            assert.equal(diff, 0, `${name} ${kind}: ${diff} channels differ from the golden image`);
        }
    });
}

// ------------------------------------------------------------ guards: nothing changes for npm users

const NPM = JSON.parse(readFileSync(join(FIXTURES, "npm-package.json"), "utf8"));

test("guard: the npm package publishes the same files, none of them the avatar maker's", () => {
    // npm runs "prepare" (the build) even with --ignore-scripts: its log comes before the JSON.
    let raw = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    let files = JSON.parse(raw.slice(raw.startsWith("[") ? 0 : raw.indexOf("\n[") + 1))[0].files.map((f) => f.path).sort();
    assert.deepEqual(files.filter((f) => /avatar/i.test(f)), []);
    assert.deepEqual(files, NPM.files);
});

test("guard: package.json exports, files, sideEffects and dependencies are unchanged", () => {
    let pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
    assert.deepEqual({ exports: pkg.exports, files: pkg.files, sideEffects: pkg.sideEffects, dependencies: pkg.dependencies ?? null }, NPM.fields);
});

test("guard: nothing in src/ imports the avatar maker", () => {
    let walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
    for (let f of walk(resolve(root, "src"))) {
        let text = readFileSync(f, "utf8");
        assert.ok(!/from\s+["'][^"']*avatar[/"']/.test(text), `${f} imports the avatar maker`);
    }
});

test("guard: the build makes avatar.js and avatar-worker.js in dist/site only, within their size budgets", () => {
    let site = resolve(root, "dist/site");
    let page = readFileSync(join(site, "avatar.js"), "utf8");
    let worker = readFileSync(join(site, "avatar-worker.js"));
    let hash = createHash("sha256").update(worker).digest("hex").slice(0, 8);
    assert.ok(page.includes(`avatar-worker.js?v=${hash}`), "the page loads the worker by its hash");
    assert.ok(!page.includes("__AVATAR_WORKER__"));
    assert.ok(page.length <= 250 * 1024, `avatar.js is ${page.length} bytes`);
    assert.ok(worker.length <= 80 * 1024, `avatar-worker.js is ${worker.length} bytes`);
    assert.match(readFileSync(join(site, "avatar.html"), "utf8"), /<script type="module" src="avatar\.js\?v=[0-9a-f]{8}"><\/script>/);
    assert.deepEqual(readdirSync(resolve(root, "dist")).filter((f) => /avatar/i.test(f)), [], "nothing at the top of dist/");
});

// ------------------------------------------------------------ analysis (M2)

test("analyze: a flat background, a transparent one, a busy one, and noise", () => {
    assert.deepEqual(assetsOf("disc-on-white").analysis.background, { kind: "flat", color: "#ffffff" });
    assert.equal(assetsOf("mascot-alpha").analysis.background.kind, "transparent");
    assert.equal(assetsOf("gradient").analysis.background.kind, "none");
    let noisy = assetsOf("noisy-disc").analysis;
    assert.equal(noisy.background.kind, "flat");
    let r = cutoutRegion(noisy, { mode: "edge", color: "auto", tolerance: 0.06, mainPart: false });
    let kept = r.removed.map((x) => (x ? 0 : 1));
    assert.equal(A.labelComponents(kept, noisy.proxy.width, noisy.proxy.height).count, 1, "no specks left");
});

test("analyze: the edge cut-out keeps an enclosed white eye, the all cut-out removes it", () => {
    let a = assetsOf("disc-on-white").analysis;
    let eye = 130 * a.proxy.width + 290;
    assert.equal(cutoutRegion(a, { mode: "edge", color: "auto", tolerance: 0.06, mainPart: false }).removed[eye], 0);
    assert.equal(cutoutRegion(a, { mode: "all", color: "auto", tolerance: 0.06, mainPart: false }).removed[eye], 1);
    assert.equal(cutoutRegion(a, { mode: "edge", color: "auto", tolerance: 0.06, mainPart: false }).removed[0], 1, "the corner is background");
});

test("analyze: main part only drops a name line under a mascot, and reads its banner colours", () => {
    let a = assetsOf("mascot-banner").analysis;
    assert.ok(a.mainPart.change >= 0.03);
    let r = cutoutRegion(a, { mode: "edge", color: "auto", tolerance: 0.06, mainPart: true });
    assert.equal(r.removed[440 * a.proxy.width + 200], 1, "the banner is gone");
    assert.equal(r.removed[190 * a.proxy.width + 300], 0, "the mascot stays");
    assert.deepEqual(a.nameLine.colors, ["#1e5aaa", "#78beeb"], "two colours, left to right");
    assert.equal(a.nameLine.outline, "#141e3c", "the darkest colour is the outline");
});

test("analyze: a circle badge is found to within a pixel", () => {
    let c = assetsOf("coin").analysis.circle;
    close(c.cx, 200, 1, "cx");
    close(c.cy, 200, 1, "cy");
    close(c.r, 190, 1.5, "r");
    assert.equal(assetsOf("mascot-alpha").analysis.circle, null);
});

test("colour suggestions: the orange robot is low contrast on its own orange, good on teal, navy and black", () => {
    let p = cutProject("robot-orange");
    let r = renderCut(p, "robot-orange");
    let edge = edgeSamples(r.info.subject40);
    assert.ok(backgroundScore(edge, "#e2961a") >= 0.35, "low on orange");
    for (let c of ["#00626e", "#16264a", "#121216"]) assert.ok(backgroundScore(edge, c) < 0.15, `good on ${c}`);
    let list = suggestBackgrounds(assetsOf("robot-orange").analysis, r.info.subject40);
    assert.ok(list.length === 5 && list.every((s) => s.label === "good"));
    assert.ok(list.every((s) => !A.chromaKeyOf(...A.parseHex(s.color).slice(0, 3).map((v) => v * 255))), "no chroma-key colours");
    assert.equal(colorName("#00626e"), "teal");
    assert.equal(colorName("#6b4a1a"), "brown");
});

// ------------------------------------------------------------ render (M2)

test("render: the cut-out leaves no halo of the background, and fitting uses what it keeps", () => {
    let p = cutProject("disc-on-white", (v) => (v.background = "#00626e"));
    let r = renderCut(p, "disc-on-white");
    close(r.info.subjectBox.w, 38, 1e-6, "the disc fills the width");
    let t = r.transparent;
    assert.deepEqual(pixel(t, 0, 0), [0, 0, 0, 0], "outside the disc and its border");
    // Edge pixels of the disc (partly transparent, before the border) are blue, not whitish.
    let q = A.render({ ...p, variants: [{ ...p.variants[0], border: { width: 0, color: null } }] }, "v1", assetsOf("disc-on-white")).transparent;
    let edgy = 0;
    for (let i = 0; i < q.data.length; i += 4) {
        let a = q.data[i + 3];
        if (a > 0 && a < 255) {
            edgy++;
            assert.ok(q.data[i + 2] > q.data[i] + 60, `a whitish edge pixel: ${[...q.data.slice(i, i + 4)]}`);
        }
    }
    assert.ok(edgy > 10);
});

test("render: adjustments (brightness, saturation, thicken)", () => {
    let mean = (img) => {
        let s = 0;
        for (let i = 0; i < img.data.length; i += 4) s += img.data[i] + img.data[i + 1] + img.data[i + 2];
        return s / (img.data.length / 4);
    };
    let base = renderOf(projectFor("gradient"), "gradient");
    let bright = renderOf(projectFor("gradient", (v) => (v.adjust.brightness = 50)), "gradient");
    assert.ok(mean(bright.opaque) > mean(base.opaque) + 50);
    let grey = renderOf(projectFor("gradient", (v) => (v.adjust.saturation = -100)), "gradient");
    for (let i = 0; i < grey.opaque.data.length; i += 4) {
        let [r, g, b] = grey.opaque.data.slice(i, i + 3);
        assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 3, "greyscale");
    }
    let dark = (img) => {
        let n = 0;
        for (let i = 0; i < img.data.length; i += 4) if (img.data[i] + img.data[i + 1] + img.data[i + 2] < 200) n++;
        return n;
    };
    let thin = renderOf(projectFor("mascot-alpha"), "mascot-alpha");
    let thick = renderOf(projectFor("mascot-alpha", (v) => (v.adjust.thicken = 0.5)), "mascot-alpha");
    assert.ok(dark(thick.opaque) > dark(thin.opaque) + 10, "dark lines get thicker");
});

test("render: pixel text is drawn exactly, and a bold name bar with pad 2 is 13 px tall and flush with the bottom", () => {
    let lay = layoutText({ lines: ["A"], font: "bold", scale: 1, align: "left", letterSpacing: 1, lineGap: 1 });
    let want = FONTS.bold.glyphs.A.flatMap((row, y) => [...row].map((c, x) => (c === "#" ? `${x},${y}` : null)).filter(Boolean));
    assert.deepEqual(lay.pixels.map(([x, y]) => `${x},${y}`).sort(), want.sort());
    assert.deepEqual(layoutText({ lines: ["Été"], font: "light", scale: 2 }).missing, [], "accents map to their letter");
    assert.deepEqual(layoutText({ lines: ["A€B"], font: "bold" }).missing, ["€"], "a character without a glyph is reported (and drawn as a gap)");
    let bar = { lines: [""], font: "bold", scale: 1, align: "center", x: 2, y: 27, color: "#ffffff", outline: "#141e3c", plate: null, segments: [{ text: "C", color: "#1e5aaa" }, { text: "T", color: "#86c4ed" }], width: "fill", radius: "pill", pad: 2 };
    assert.equal(nameBarSize(bar).height, 13);
    let px = textPixels(bar);
    let ys = px.map(([, y]) => y);
    assert.deepEqual([Math.min(...ys), Math.max(...ys)], [27, 39], "rows 27 to 39: no gap under it");
    let fx = JSON.parse(readFileSync(join(FIXTURES, "name-bar.json"), "utf8"));
    let r = A.render(A.validateProject(fx.project), "v1", assetsOf("mascot-banner"));
    assert.deepEqual(pixel(r.opaque, 20, 39).slice(0, 3), [0x14, 0x1e, 0x3c], "the outline runs along the bottom row");
    assert.equal(pixel(r.transparent, 20, 39)[3], 255, "and is opaque in the transparent version");
    assert.ok(!ids(A.runChecks(r, A.validateProject(fx.project), "v1")).includes("C6"), "the name bar counts as content: no empty bottom rows");
});

// ------------------------------------------------------------ checks (M2)

test("checks: C5 (contrast), C7 (cut in the wrong place), C8 (circle cut off), C9 (edge disappears) fire and are fixed", () => {
    // C5: the orange robot on its own orange; the fix picks a suggested colour.
    let orange = cutProject("robot-orange", (v) => (v.background = "#e2961a"));
    let or = renderCut(orange, "robot-orange");
    let c5 = A.runChecks(or, orange, "v1", null, assetsOf("robot-orange").analysis).find((c) => c.id === "C5");
    assert.ok(c5 && c5.fix.action === "setBackground");
    let fixed = A.applyFix(orange, "v1", c5, { result: or, assets: assetsOf("robot-orange") });
    assert.ok(!ids(A.runChecks(renderCut(fixed, "robot-orange"), fixed, "v1")).includes("C5"));
    let teal = cutProject("robot-orange", (v) => (v.background = "#00626e"));
    assert.ok(!ids(A.runChecks(renderCut(teal, "robot-orange"), teal, "v1")).includes("C5"));

    // C7: a tall figure pushed off the left edge; cutting at the bottom instead is fine.
    let left = cutProject("tall-figure", (v, a) => ((v.fit = A.fitFor("fillWidth", v, a)), (v.fit.x -= 6)));
    let lr = renderCut(left, "tall-figure");
    let c7 = A.runChecks(lr, left, "v1").find((c) => c.id === "C7");
    assert.deepEqual([c7?.params.side, c7?.fix.action], ["left", "cutOrFit"]);
    let cutBottom = A.applyFix(left, "v1", c7, { result: lr, assets: assetsOf("tall-figure") });
    assert.ok(!ids(A.runChecks(renderCut(cutBottom, "tall-figure"), cutBottom, "v1")).includes("C7"));

    // C8: the coin, slightly too big for the square; the fix puts it in a circle frame.
    let a = assetsOf("coin");
    let big = projectFor("coin", (v) => (v.fit = A.zoomFit(v, a, v.fit.scale * 1.16)));
    let br = A.render(big, "v1", a);
    let c8 = A.runChecks(br, big, "v1", null, a.analysis).find((c) => c.id === "C8");
    assert.ok(c8, "C8 fires");
    let coin = A.applyFix(big, "v1", c8, { result: br, assets: a });
    assert.equal(coin.variants[0].frame.kind, "circle");
    assert.ok(!ids(A.runChecks(A.render(coin, "v1", a), coin, "v1", null, a.analysis)).includes("C8"));
    let fits = projectFor("coin");
    assert.ok(!ids(A.runChecks(A.render(fits, "v1", a), fits, "v1", null, a.analysis)).includes("C8"));

    // C9: a red subject without a border vanishes on FIRST's red; a border fixes it.
    let n = 200;
    let red = new Uint8ClampedArray(n * n * 4);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if ((x - 100) ** 2 + (y - 100) ** 2 < 80 ** 2) red.set([237, 28, 36, 255], (y * n + x) * 4);
    let src = A.sourceFromRGBA(n, n, red);
    let rp = A.newProject({ name: "red", width: n, height: n });
    rp.variants[0].border.width = 0;
    rp.variants[0].fit = A.fitFor("fit", rp.variants[0], src);
    let rr = A.render(rp, "v1", { source: src });
    let c9 = A.runChecks(rr, rp, "v1").find((c) => c.id === "C9");
    assert.deepEqual([c9?.params.backgrounds, c9?.fix.action], [["red"], "addBorder"]);
    let bordered = A.applyFix(rp, "v1", c9, { result: rr, source: src });
    assert.ok(!ids(A.runChecks(A.render(bordered, "v1", { source: src }), bordered, "v1")).includes("C9"));
    // A white border vanishes on FIRST's white, but the blue logo inside it doesn't: no warning.
    let blueOnWhite = cutProject("disc-on-white");
    assert.equal(blueOnWhite.variants[0].border.width, 1.1);
    assert.ok(!ids(A.runChecks(renderCut(blueOnWhite, "disc-on-white"), blueOnWhite, "v1")).includes("C9"));
});

// ------------------------------------------------------------ candidates (M2)

test("candidates: the starting points a logo gets, each a valid variant, no duplicates", () => {
    let kinds = (name, team) => candidates(sourceOf(name), assetsOf(name).analysis, team).map((c) => c.kind);
    assert.deepEqual(kinds("mascot-banner", { number: 16382, name: "Casimir Tech" }).filter((k) => k === 4 || k === 10), [4, 10]);
    assert.ok(!kinds("mascot-banner", null).includes(10), "no name bar without a team name");
    assert.ok(kinds("coin").includes(7) && kinds("coin").includes(8), "coin candidates");
    assert.ok(kinds("tall-figure").includes(5) && kinds("tall-figure").includes(6), "tall subjects: cut at the bottom, top part");
    assert.deepEqual(kinds("gradient"), [1], "a busy background: the whole logo only");
    let avatar = candidates(sourceOf("pixel-avatar"), analyze(sourceOf("pixel-avatar")));
    assert.deepEqual(avatar.map((c) => c.label), ["Edit as is"]);
    for (let c of candidates(sourceOf("disc-on-white"), assetsOf("disc-on-white").analysis)) {
        let p = A.newProject({ name: "d", width: 480, height: 360 });
        p.variants = [{ ...c.variant, id: "v1" }];
        assert.doesNotThrow(() => A.validateProject(JSON.parse(JSON.stringify(p))), c.label);
    }
    assert.deepEqual(initials("Casimir Tech"), ["C", "T"]);
    assert.deepEqual(initials("Ré-Bots"), ["R", "B"]);
});
