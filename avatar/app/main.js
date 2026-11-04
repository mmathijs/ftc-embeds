/*!
 * ftc-embeds.com/avatar: make a team's 40 × 40 FIRST avatar in the browser. License: MIT
 */
// Milestone 1 page: load a logo, see both outputs and the checks, download both PNGs. The full page
// (team lookup, starting points, editor, previews) replaces this in the next milestones.
import { sourceFromRGBA, newProject, fitFor, render, runChecks, applyFix, encodePNG, deflateStored, AVATAR_SIZE } from "../core/avatar.mjs";
import { TEXT, checkText, fixText } from "./text.js";

// Replaced by the build with "avatar-worker.js?v=<hash>"; in development the worker is next to this file.
const WORKER_URL = "__AVATAR_WORKER__";
const MAX_FILE = 40 * 1024 * 1024;
const MAX_SIDE = 16384;
const NORMAL_SIDE = 2048;
// Fix actions this page can apply yet (the cut-out and colour picking come with the full page).
const FIXES_NOW = new Set(["fewerColors", "shiftChroma", "fit", "fillWidth", "nudge", "centre"]);
const BACKGROUNDS = [
    ["white", "#ffffff"],
    ["red", "#ed1c24"],
    ["blue", "#0066b3"],
    ["award", "#0083ae"],
    ["dark", "#1c1b19"],
];

const $ = (id) => document.getElementById(id);
let state = { source: null, project: null, result: null, files: null };

// ------------------------------------------------------------ worker

function startWorker() {
    let url = WORKER_URL.startsWith("__") ? new URL("./worker.js", import.meta.url) : new URL(WORKER_URL, import.meta.url);
    let say = (text) => ($("worker").textContent = text);
    try {
        let w = new Worker(url, { type: "module" });
        w.onmessage = (e) => e.data?.type === "pong" && say(TEXT.workerReady);
        w.onerror = () => say(TEXT.workerFallback);
        w.postMessage({ type: "ping" });
    } catch {
        say(TEXT.workerFallback);
    }
}

// ------------------------------------------------------------ input (section 9.1)

const REJECTED = /\.(heic|heif|pdf|psd|ai|eps)$/i;
const REJECTED_TYPES = /heic|heif|pdf|photoshop|postscript|illustrator/i;

// An <img> from a blob URL: the fallback decoder, and the only way SVG is ever opened (never in the DOM).
function loadImage(blob) {
    let url = URL.createObjectURL(blob);
    return new Promise((resolve, reject) => {
        let img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(TEXT.errRead));
        img.src = url;
    }).finally(() => setTimeout(() => URL.revokeObjectURL(url), 1000));
}

/** Decode and normalise a file to 8-bit sRGB RGBA, at most 2048 px on its long side. */
async function decodeFile(file) {
    if (REJECTED.test(file.name) || REJECTED_TYPES.test(file.type)) throw new Error(TEXT.errType);
    if (file.size > MAX_FILE) throw new Error(TEXT.errLarge);
    let svg = file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
    let img = null;
    if (!svg && typeof createImageBitmap === "function") {
        try {
            img = await createImageBitmap(file, { imageOrientation: "from-image", premultiplyAlpha: "none" });
        } catch {
            img = null;
        }
    }
    if (!img) img = await loadImage(file);
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    // An SVG without a size (and without a viewBox) can report 0 × 0: draw it as a square.
    if (svg && (!w || !h)) w = h = 1024;
    if (!w || !h) throw new Error(TEXT.errRead);
    if (w > MAX_SIDE || h > MAX_SIDE) throw new Error(TEXT.errLarge);
    // SVGs are drawn at 2048 px on the long side, or 1024 when they have no size of their own.
    let long = Math.max(w, h);
    let target = svg ? ((await svgHasSize(file)) ? NORMAL_SIDE : 1024) : Math.min(long, NORMAL_SIDE);
    let k = target / long;
    let W = Math.max(1, Math.round(w * k));
    let H = Math.max(1, Math.round(h * k));
    let canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    let ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, W, H);
    let data = ctx.getImageData(0, 0, W, H, { colorSpace: "srgb" }).data;
    return { width: W, height: H, rgba: new Uint8ClampedArray(data) };
}

async function svgHasSize(file) {
    let text = await file.slice(0, 4096).text();
    let root = /<svg\b[^>]*>/i.exec(text)?.[0] || "";
    return /\swidth\s*=/.test(root) && /\sheight\s*=/.test(root);
}

// ------------------------------------------------------------ output

async function deflate(data) {
    if (typeof CompressionStream === "undefined") return deflateStored(data);
    let stream = new Blob([data]).stream().pipeThrough(new CompressionStream("deflate"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

function download(bytes, name) {
    let url = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
    let a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function pngUrl(bytes, old) {
    if (old) URL.revokeObjectURL(old);
    return URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
}

// ------------------------------------------------------------ rendering

let urls = { opaque: null, transparent: null };

async function update() {
    let { project, source } = state;
    let id = project.selected;
    try {
        state.result = render(project, id, { source });
    } catch (err) {
        console.error(err);
        $("error").textContent = TEXT.errRender;
        return;
    }
    let opaque = await encodePNG(state.result.opaque, { alpha: false }, deflate);
    let transparent = await encodePNG(state.result.transparent, { alpha: true }, deflate);
    state.files = { opaque, transparent };
    let checks = runChecks(state.result, project, id, { opaque: opaque.length, transparent: transparent.length });
    urls.opaque = pngUrl(opaque, urls.opaque);
    urls.transparent = pngUrl(transparent, urls.transparent);
    showPreviews();
    showChecks(checks);
    for (let kind of ["opaque", "transparent"]) {
        let blocked = checks.some((c) => c.level === "error" && (c.output === kind || c.output === null));
        let button = $(`dl-${kind}`);
        button.disabled = blocked;
        button.title = blocked ? TEXT.blocked : "";
        $(`size-${kind}`).textContent = TEXT.bytes(state.files[kind].length);
    }
}

function showPreviews() {
    let strip = $("strip");
    strip.replaceChildren();
    for (let kind of ["opaque", "transparent"]) {
        let row = document.createElement("div");
        row.className = "row";
        let label = document.createElement("span");
        label.textContent = kind === "opaque" ? TEXT.opaque : TEXT.transparent;
        row.append(label);
        for (let [name, color] of BACKGROUNDS) {
            let cell = document.createElement("span");
            cell.className = "bg";
            cell.style.background = color;
            cell.title = name;
            let img = new Image(AVATAR_SIZE, AVATAR_SIZE);
            img.src = urls[kind];
            img.alt = `${kind} avatar on ${name}`;
            cell.append(img);
            row.append(cell);
        }
        let zoom = new Image(AVATAR_SIZE * 6, AVATAR_SIZE * 6);
        zoom.src = urls[kind];
        zoom.className = "zoom" + (kind === "transparent" ? " checker" : "");
        zoom.alt = `${kind} avatar, 6× zoom`;
        row.append(zoom);
        strip.append(row);
    }
}

function showChecks(checks) {
    let list = $("checks");
    list.replaceChildren();
    if (!checks.length) {
        let li = document.createElement("li");
        li.textContent = TEXT.noChecks;
        list.append(li);
        return;
    }
    for (let check of checks) {
        let li = document.createElement("li");
        li.className = check.level;
        let tag = document.createElement("b");
        tag.textContent = `${check.level} · ${check.id}`;
        let text = document.createElement("span");
        text.textContent = checkText(check);
        li.append(tag, text);
        let label = fixText(check);
        if (label && FIXES_NOW.has(check.fix.action)) {
            let b = document.createElement("button");
            b.type = "button";
            b.className = "btn";
            b.textContent = label;
            b.onclick = () => {
                let next = applyFix(state.project, state.project.selected, check, { result: state.result, source: state.source });
                if (next) {
                    state.project = next;
                    update();
                }
            };
            li.append(b);
        }
        list.append(li);
    }
}

// ------------------------------------------------------------ loading a logo

async function load(file) {
    $("error").textContent = "";
    $("status").textContent = TEXT.reading;
    try {
        let img = await decodeFile(file);
        let source = sourceFromRGBA(img.width, img.height, img.rgba, file.name);
        let project = newProject({ name: file.name, width: img.width, height: img.height });
        let v = project.variants[0];
        v.fit = fitFor("fit", v, source);
        state = { ...state, source, project };
        $("status").textContent = TEXT.loaded(file.name || "pasted image", img.width, img.height);
        $("result").hidden = false;
        await update();
    } catch (err) {
        console.error(err);
        $("status").textContent = "";
        $("error").textContent = err instanceof Error && Object.values(TEXT).includes(err.message) ? err.message : TEXT.errRead;
    }
}

$("file").onchange = (e) => e.target.files[0] && load(e.target.files[0]);
let zone = $("drop");
zone.ondragover = (e) => {
    e.preventDefault();
    zone.classList.add("over");
};
zone.ondragleave = () => zone.classList.remove("over");
zone.ondrop = (e) => {
    e.preventDefault();
    zone.classList.remove("over");
    let file = [...(e.dataTransfer?.files || [])].find((f) => f.type.startsWith("image/") || /\.\w+$/.test(f.name));
    if (file) load(file);
};
document.addEventListener("paste", (e) => {
    let file = [...(e.clipboardData?.files || [])][0];
    if (file) load(file);
});
$("dl-opaque").onclick = () => state.files && download(state.files.opaque, "avatar-40.png");
$("dl-transparent").onclick = () => state.files && download(state.files.transparent, "avatar-40-transparent.png");

$("drop-text").textContent = TEXT.dropHint;
$("private").textContent = TEXT.staysHere;
$("dl-opaque").textContent = TEXT.downloadOpaque;
$("dl-transparent").textContent = TEXT.downloadTransparent;
startWorker();
