// Automatic starting points (section 11): up to 10 ordinary variants built from rules that encode
// what worked in the 2026 hand-made set. Each is rendered and checked, so the page can show it as a
// tile with its warning count; picking one is the same as editing any other variant.

import { defaultVariant, wholeFit } from "./project.mjs";
import { render, fitFor, subjectBoxFor, WORK_SCALE } from "./render.mjs";
import { runChecks } from "./checks.mjs";
import { suggestBackgrounds, colorName, cutoutRegion } from "./analyze.mjs";
import { srgbToOklab, deltaE, parseHex } from "./color.mjs";
import { nameBarSize } from "./font.mjs";

// The circle frame's radius in output px (158 working px, section 9.9).
const FRAME_RADIUS = 158 / WORK_SCALE;
const DUPLICATE = 0.01;

/** A temporary project holding one variant, to render it. */
function projectOf(source, variant) {
    return {
        format: "ftc-avatar-project",
        version: 1,
        team: null,
        source: { name: source.name, width: source.width, height: source.height, kind: source.kind },
        selected: variant.id,
        variants: [variant],
    };
}

// Mean ΔE between two 40 × 40 images; transparent ones are compared over white.
function meanDelta(a, b) {
    let sum = 0;
    let lab = (d, i) => {
        let al = d[i + 3] / 255;
        return srgbToOklab([0, 1, 2].map((c) => (d[i + c] / 255) * al + (1 - al)));
    };
    for (let i = 0; i < a.data.length; i += 4) sum += deltaE(lab(a.data, i), lab(b.data, i));
    return sum / (a.data.length / 4);
}

/** Initials of a team name: "Casimir Tech" → ["C", "T"]. */
export function initials(name) {
    return String(name)
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .split(/[^A-Za-z0-9]+/)
        .filter(Boolean)
        .slice(0, 3)
        .map((w) => w[0].toUpperCase());
}

const whiteOrBlack = (colors) => {
    let score = (hex) => Math.min(...colors.map((c) => deltaE(srgbToOklab(parseHex(hex)), srgbToOklab(parseHex(c)))));
    return score("#ffffff") >= score("#000000") ? "#ffffff" : "#000000";
};

/**
 * Starting points for a source and its analysis (team: { number, name } or null, for the name bar).
 * Returns [{ kind (1 to 10), label, colorName, variant, result, checks }], duplicates removed, ones
 * with errors last. onTile(candidate) is called as each one is ready.
 */
export function candidates(source, analysis, team = null, onTile = null) {
    let assets = { source, analysis };
    let out = [];
    let n = 0;
    let fresh = (name) => defaultVariant(`c${++n}`, name, wholeFit(source.width, source.height, source.kind));
    let add = (kind, label, color, v) => {
        let p = projectOf(source, v);
        let result = render(p, v.id, assets);
        let checks = runChecks(result, p, v.id, null, analysis);
        for (let c of out) if (meanDelta(c.result.opaque, result.opaque) < DUPLICATE && meanDelta(c.result.transparent, result.transparent) < DUPLICATE) return null;
        let cand = { kind, label, colorName: color, variant: v, result, checks };
        out.push(cand);
        onTile?.(cand);
        return cand;
    };

    // An existing 40 × 40 avatar: one candidate, every pixel as it is.
    if (source.kind === "avatar") {
        let v = fresh("Edit as is");
        Object.assign(v, { fit: { ...v.fit, scale: 1, x: 0, y: 0, sampling: "pixel" }, resample: "box" });
        add(1, "Edit as is", null, v);
        return out;
    }

    let bg = analysis.background;
    let canCut = bg.kind === "flat" || source.hasAlpha;

    // Colour suggestions come from the cut-out subject (or the whole logo when nothing can be cut).
    let probe = fresh("probe");
    if (canCut) probe.cutout.mode = "edge";
    probe.fit = fitFor("fit", probe, assets);
    let probeResult = render(projectOf(source, probe), probe.id, assets);
    let swatches = suggestBackgrounds(analysis, probeResult.info.subject40);
    let s1 = swatches[0]?.color ?? "#00626e";
    let s2 = swatches[1]?.color ?? null;
    n = 0;

    // 1: the whole logo, as it is.
    let whole = fresh("Whole logo");
    whole.background = bg.kind === "flat" ? bg.color : bg.kind === "transparent" ? s1 : "#ffffff";
    whole.fit = fitFor("fit", whole, assets);
    add(1, "Whole logo", null, whole);

    let cut = (name, color, mainPart = false) => {
        let v = fresh(name);
        v.cutout = { ...v.cutout, mode: "edge", mainPart };
        v.background = color;
        v.fit = fitFor("fit", v, assets);
        return v;
    };
    if (canCut) {
        // 2 and 3: the logo, cut out, on the two best background colours.
        let on1 = cut("Logo on", s1);
        add(2, "Logo on", colorName(s1), on1);
        if (s2) add(3, "Logo on", colorName(s2), cut("Logo on", s2));

        // 4: the main part only (a name line under or above a mascot goes).
        if (analysis.mainPart && analysis.mainPart.change >= 0.03) add(4, "Main part on", colorName(s1), cut("Main part on", s1, true));

        let S = subjectBoxFor(assets, on1);
        // 5: tall subjects fill the width; the overflow is cut at the bottom.
        if (S.h >= 1.15 * S.w) {
            let v = cut("Big, cut at the bottom", s1);
            v.fit = fitFor("fillWidth", v, assets);
            add(5, "Big, cut at the bottom", colorName(s1), v);
        }
        // 6: the top part (a mascot's head), cut at the bottom.
        if (S.h >= 0.8 * S.w) {
            let region = cutoutRegion(analysis, on1.cutout);
            let { width: pw, rgba, kx } = analysis.proxy;
            let top = region.box[1] + 0.55 * (region.box[3] - region.box[1]);
            let x0 = Infinity, x1 = -Infinity;
            for (let y = region.box[1]; y < top; y++) {
                for (let x = region.box[0]; x < region.box[2]; x++) {
                    let p = y * pw + x;
                    if (!region.removed[p] && rgba[p * 4 + 3] >= 128) (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x + 1));
                }
            }
            if (x1 > x0) {
                let bandW = (x1 - x0) / kx;
                let s = Math.min(38 / bandW, 39 / (0.55 * S.h));
                let v = cut("Top part", s1);
                v.fit = { ...v.fit, scale: s, x: 20 - ((x0 + x1) / 2 / kx) * s, y: 1 - S.y * s, anchor: "top" };
                add(6, "Top part", colorName(s1), v);
            }
        }
    }

    // 7 and 8: a coin, whole in a circle frame, and zoomed in with a ring.
    if (analysis.circle) {
        let { cx, cy, r } = analysis.circle;
        let rim = analysis.rimColor ?? "#000000";
        let coin = (name, s, ring) => {
            let v = fresh(name);
            v.background = bg.kind === "flat" ? bg.color : rim;
            v.fit = { ...v.fit, scale: s, x: 20 - cx * s, y: 20 - cy * s };
            v.frame = { kind: "circle", radius: 4, ring, outside: ring ? null : rim, breakOut: false };
            v.transparent = "shape";
            return v;
        };
        add(7, "Whole coin", null, coin("Whole coin", 39.5 / (2 * r), null));
        add(8, "Coin with ring", null, coin("Coin with ring", FRAME_RADIUS / (0.86 * r), { width: 1.1, color: rim }));
    }

    // 9: photo-like art gets crisp colours.
    if (canCut) {
        let colours = new Set();
        let d = probeResult.info.subject40.data;
        for (let i = 0; i < d.length; i += 4) if (d[i + 3] >= 128) colours.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
        if (colours.size >= 40) {
            let v = cut("Crisp colours", s1);
            v.adjust = { ...v.adjust, contrast: 25, saturation: 25, colors: 14 };
            add(9, "Crisp colours", colorName(s1), v);
        }
    }

    // 10: the main part, with the logo's name banner redrawn as a readable name bar (Casimir Tech).
    let line = analysis.nameLine;
    let letters = team?.name ? initials(team.name) : [];
    if (canCut && line && letters.length) {
        let segments = line.colors.length === 2 && letters.length >= 2 ? [{ text: letters[0], color: line.colors[0] }, { text: letters.slice(1).join(""), color: line.colors[1] }] : [{ text: letters.join(""), color: line.colors[0] }];
        let bar = { id: "t1", lines: [""], font: "bold", scale: 1, align: "center", x: 2, y: 0, color: whiteOrBlack(segments.map((sg) => sg.color)), outline: line.outline, plate: null, letterSpacing: 1, lineGap: 1, segments, width: "fill", radius: "pill", pad: 2 };
        let { height } = nameBarSize(bar);
        bar.y = 40 - height;
        let v = cut("Main part with name bar", s1, true);
        let S = subjectBoxFor(assets, v);
        let room = 40 - height - 2;
        let s = Math.min(38 / S.w, room / S.h);
        v.fit = { ...v.fit, scale: s, x: 20 - (S.x + S.w / 2) * s, y: 1 + (room - S.h * s) / 2 - S.y * s };
        v.texts = [bar];
        add(10, "Main part with name bar", colorName(s1), v);
    }

    // Errors last; otherwise the table's order (a stable sort).
    let hasError = (c) => c.checks.some((k) => k.level === "error");
    return out.sort((a, b) => hasError(a) - hasError(b));
}

/** How many warnings (and errors) a candidate has, for its tile. */
export const warningCount = (cand) => cand.checks.filter((c) => c.level !== "info").length;

