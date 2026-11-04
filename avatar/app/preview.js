// Previews (section 13.1 to 13.3): the live strip, the Compare tab (FIRST's four backgrounds and
// dark, at 40 px and FTCScout's 20 px, and zoomed), the team card with the new avatar, and the
// comparison sheet PNG.

import { TeamCard } from "../../src/team-card/team-card.mjs";
import { TEXT } from "./text.js";

/** FIRST's display backgrounds (section 2), plus dark for dark-mode sites. */
export const PREVIEW_BACKGROUNDS = [
    ["white", "#ffffff"],
    ["red", "#ed1c24"],
    ["blue", "#0066b3"],
    ["award", "#0083ae"],
    ["dark", "#1c1b19"],
];

const el = (tag, attrs = {}, ...kids) => {
    let e = document.createElement(tag);
    for (let [k, v] of Object.entries(attrs)) {
        if (k === "text") e.textContent = v;
        else if (k === "style") e.style.cssText = v;
        else if (v != null) e.setAttribute(k, v);
    }
    e.append(...kids.filter((k) => k != null));
    return e;
};

const img = (src, size, alt) => el("img", { src, width: size, height: size, alt });

/** The live strip: the selected variant at 40 px on each background, opaque and transparent. */
export function showStrip(host, urls) {
    let cells = [el("span")];
    for (let [name] of PREVIEW_BACKGROUNDS) cells.push(el("span", { class: "head", text: TEXT.backgrounds[name] }));
    for (let kind of ["opaque", "transparent"]) {
        cells.push(el("span", { class: "lab", text: kind === "opaque" ? TEXT.showOpaque : TEXT.showTransparent }));
        for (let [name, color] of PREVIEW_BACKGROUNDS) cells.push(el("span", { class: "bg", style: `background:${color}`, title: name }, img(urls[kind], 40, `${kind}, on ${name}`)));
    }
    host.replaceChildren(...cells);
}

// FTCScout's small size: the 40 px image drawn at 20 × 20 with the browser's best smoothing, shown
// pixelated so the 1× look is visible on high-DPI screens too.
function small(image8) {
    let c = el("canvas", { width: 20, height: 20, class: "px20" });
    let full = el("canvas", { width: 40, height: 40 });
    full.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(image8.data), 40, 40), 0, 0);
    let ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(full, 0, 0, 20, 20);
    return c;
}

/** One grid of the Compare tab: rows of (label, image per background). */
function gridRows(host, rows) {
    let cells = [el("span")];
    for (let [name] of PREVIEW_BACKGROUNDS) cells.push(el("span", { class: "head", text: TEXT.backgrounds[name] }));
    for (let { label, make } of rows) {
        cells.push(el("span", { class: "lab", text: label }));
        for (let [name, color] of PREVIEW_BACKGROUNDS) cells.push(el("span", { class: "cell", style: `background:${color}`, title: name }, ...make()));
    }
    host.replaceChildren(...cells);
}

/** The Compare tab: both outputs at 40 and 20 px on each background, and zoomed 6×. */
export function showCompare(host, zoomHost, urls, images) {
    let rows = [];
    for (let kind of ["opaque", "transparent"]) {
        let what = kind === "opaque" ? TEXT.showOpaque : TEXT.showTransparent;
        rows.push({ label: `${what} · ${TEXT.sizes[0]}`, make: () => [img(urls[kind], 40, `${kind}, 40 px`)] });
        rows.push({ label: `${what} · ${TEXT.sizes[1]}`, make: () => [small(images[kind])] });
    }
    gridRows(host, rows);
    zoomHost.replaceChildren(
        el("figure", {}, el("img", { src: urls.opaque, alt: "opaque, 6×" }), el("figcaption", { text: TEXT.zoomed(TEXT.showOpaque) })),
        el("figure", {}, el("img", { src: urls.transparent, alt: "transparent, 6×", class: "checker" }), el("figcaption", { text: TEXT.zoomed(TEXT.showTransparent) }))
    );
}

/** Current FIRST avatar against the new one, at 40 and 20 px on FIRST's backgrounds. */
export function showCurrentVs(host, currentUrl, currentImage, urls, images) {
    gridRows(host, [
        { label: TEXT.sizes[0], make: () => [img(currentUrl, 40, "current"), img(urls.opaque, 40, "new")] },
        { label: TEXT.sizes[1], make: () => [currentImage ? small(currentImage) : null, small(images.opaque)] },
    ]);
}

// ------------------------------------------------------------ team card (13.2)

let card = null;

/** The team card with the new avatar: the team's real data, or example data without a team. */
export function showTeamCard(host, team, avatarUrl, theme, layout) {
    let data = team?.card
        ? { card: { ...team.card, avatar: avatarUrl }, stats: null }
        : {
              card: { number: team?.number ?? 0, name: team?.name ?? TEXT.yourTeam, schoolName: null, rookieYear: null, website: null, avatar: avatarUrl, location: null, quickStats: null, epa: null, events: [] },
              stats: null,
          };
    let options = { data, theme, layout, stats: "record", upcoming: 0, linkTarget: "none" };
    if (!card || !card.host || !host.contains(card.host)) {
        host.replaceChildren();
        card = new TeamCard(host, options);
    } else card.update(options);
}

// ------------------------------------------------------------ comparison sheet (13.3)

const toCanvas = (image8) => {
    let c = document.createElement("canvas");
    c.width = image8.width;
    c.height = image8.height;
    c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(image8.data), image8.width, image8.height), 0, 0);
    return c;
};

function checker(ctx, x, y, size, a, b) {
    let s = 12;
    for (let j = 0; j < size; j += s) for (let i = 0; i < size; i += s) {
        ctx.fillStyle = ((i + j) / s) % 2 ? b : a;
        ctx.fillRect(x + i, y + j, Math.min(s, size - i), Math.min(s, size - j));
    }
}

/**
 * The comparison sheet (1000 px wide, the layout of the 2026 sheets): a title, the original logo,
 * an optional row for the current FIRST avatar, and one row per variant with both outputs at 6×
 * and at actual size on the five backgrounds. Returns a PNG Blob.
 */
export async function comparisonSheet({ title, sourceCanvas, current, rows }) {
    await document.fonts?.ready;
    let font = (size, weight = 400) => `${weight} ${size}px "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif`;
    let rowH = 300;
    let all = current ? [{ name: TEXT.sheetCurrent, opaque: current, transparent: null }, ...rows] : rows;
    let H = 240 + all.length * rowH + 30;
    let canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = H;
    let ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f4f1ea";
    ctx.fillRect(0, 0, 1000, H);
    ctx.fillStyle = "#1c1b19";
    ctx.font = font(28, 600);
    ctx.fillText(title, 32, 56);
    ctx.font = font(14);
    ctx.fillStyle = "#5d5a53";
    ctx.fillText(TEXT.sheetLegend, 32, 84);
    // The original, fitted in a 180 px box.
    if (sourceCanvas) {
        let k = Math.min(180 / sourceCanvas.width, 180 / sourceCanvas.height);
        let w = sourceCanvas.width * k;
        let h = sourceCanvas.height * k;
        checker(ctx, 788, 24, 180, "#ffffff", "#e3ded2");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(sourceCanvas, 788 + (180 - w) / 2, 24 + (180 - h) / 2, w, h);
    }
    let y = 240;
    for (let r of all) {
        ctx.fillStyle = "#1c1b19";
        ctx.font = font(18, 600);
        ctx.fillText(r.name, 32, y);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(toCanvas(r.opaque), 32, y + 16, 240, 240);
        if (r.transparent) {
            checker(ctx, 290, y + 16, 240, "#ffffff", "#e3ded2");
            ctx.drawImage(toCanvas(r.transparent), 290, y + 16, 240, 240);
        }
        // Actual size on each background: opaque left, transparent right.
        PREVIEW_BACKGROUNDS.forEach(([, color], i) => {
            let bx = 560 + (i % 3) * 136;
            let by = y + 16 + Math.floor(i / 3) * 76;
            ctx.fillStyle = color;
            ctx.fillRect(bx, by, 120, 64);
            ctx.drawImage(toCanvas(r.opaque), bx + 12, by + 12, 40, 40);
            if (r.transparent) ctx.drawImage(toCanvas(r.transparent), bx + 68, by + 12, 40, 40);
        });
        ctx.imageSmoothingEnabled = true;
        y += rowH;
    }
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
