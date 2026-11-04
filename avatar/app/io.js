// Input and output for the avatar maker's page: decoding files and links (section 9.1), PNG
// compression with the browser's own zlib, downloads, the clipboard, and the autosave in IndexedDB
// (section 7.5). Everything stays on the device.

import { encodePNG, decodePNG, deflateStored } from "../core/avatar.mjs";
import { TEXT } from "./text.js";

const MAX_FILE = 40 * 1024 * 1024;
const MAX_SIDE = 16384;
const NORMAL_SIDE = 2048;
const REJECTED = /\.(heic|heif|pdf|psd|ai|eps)$/i;
const REJECTED_TYPES = /heic|heif|pdf|photoshop|postscript|illustrator/i;

/** An error whose message is meant for the visitor. */
export class InputError extends Error {}

// ------------------------------------------------------------ zlib

/** zlib-compress bytes (PNG's IDAT), with stored blocks where CompressionStream is missing. */
export async function deflate(data) {
    if (typeof CompressionStream === "undefined") return deflateStored(data);
    let stream = new Blob([data]).stream().pipeThrough(new CompressionStream("deflate"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function inflate(data) {
    let stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Both outputs of a render as PNG files: { opaque, transparent } bytes. */
export async function encodeOutputs(result) {
    let [opaque, transparent] = await Promise.all([encodePNG(result.opaque, { alpha: false }, deflate), encodePNG(result.transparent, { alpha: true }, deflate)]);
    return { opaque, transparent };
}

/** The normalised source as a PNG (exact pixels, for project files and the autosave). */
export function sourceToPng(source) {
    return encodePNG({ width: source.width, height: source.height, data: source.rgba }, { alpha: true, check: false }, deflate);
}

export async function pngToRGBA(bytes) {
    let img = await decodePNG(bytes, inflate);
    return { width: img.width, height: img.height, rgba: img.data };
}

export function bytesToDataUrl(bytes, type = "image/png") {
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `data:${type};base64,${btoa(s)}`;
}

export function dataUrlToBytes(url) {
    let bin = atob(url.slice(url.indexOf(",") + 1));
    let out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

// ------------------------------------------------------------ decoding (section 9.1)

// An <img> from a blob URL: the fallback decoder, and the only way SVG is ever opened (never in the DOM).
function loadImage(blob) {
    let url = URL.createObjectURL(blob);
    return new Promise((resolve, reject) => {
        let img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new InputError(TEXT.errRead));
        img.src = url;
    }).finally(() => setTimeout(() => URL.revokeObjectURL(url), 1000));
}

async function svgHasSize(file) {
    let text = await file.slice(0, 4096).text();
    let root = /<svg\b[^>]*>/i.exec(text)?.[0] || "";
    return /\swidth\s*=/.test(root) && /\sheight\s*=/.test(root);
}

const isAnimated = async (file) => {
    if (!/gif|webp|png/i.test(file.type)) return false;
    let text = new TextDecoder("latin1").decode(await file.slice(0, 65536).arrayBuffer());
    return (/gif/i.test(file.type) && (text.match(/\x21\xF9\x04/g) || []).length > 1) || text.includes("acTL") || text.includes("ANMF");
};

/**
 * Decode and normalise a file to 8-bit sRGB RGBA, at most 2048 px on its long side (the only place
 * the browser scales: the result is stored in the project, so renders stay reproducible).
 * Returns { width, height, rgba, name, note }.
 */
export async function decodeFile(file) {
    if (REJECTED.test(file.name || "") || REJECTED_TYPES.test(file.type || "")) throw new InputError(TEXT.errType);
    if (file.size > MAX_FILE) throw new InputError(TEXT.errLarge);
    let svg = file.type === "image/svg+xml" || /\.svg$/i.test(file.name || "");
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
    if (!w || !h) throw new InputError(TEXT.errRead);
    if (w > MAX_SIDE || h > MAX_SIDE) throw new InputError(TEXT.errLarge);
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
    return { width: W, height: H, rgba: new Uint8ClampedArray(data), name: file.name || "pasted image", note: (await isAnimated(file)) ? TEXT.firstFrame : "" };
}

/** Load an image link once; CORS or network failures become a plain message. */
export async function decodeUrl(url) {
    let res;
    try {
        res = await fetch(url, { mode: "cors", credentials: "omit" });
    } catch {
        throw new InputError(TEXT.errUrl);
    }
    if (!res.ok) throw new InputError(TEXT.errUrl);
    let blob = await res.blob();
    let name = decodeURIComponent(new URL(url, location.href).pathname.split("/").pop() || "image");
    return decodeFile(new File([blob], name, { type: blob.type }));
}

// ------------------------------------------------------------ output

/** Download bytes or a Blob under a name (a temporary <a download>, revoked after 10 s). */
export function download(data, name, type = "application/octet-stream") {
    let url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type }));
    let a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export const canCopyPng = () => typeof ClipboardItem !== "undefined" && !!navigator.clipboard?.write;

export async function copyPng(bytes) {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": new Blob([bytes], { type: "image/png" }) })]);
}

/** "TieWraps" → "tiewraps", "Ré-Bots 2.0" → "re-bots-2-0" (at most 40 characters). */
export function slug(text) {
    return String(text)
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40)
        .replace(/-+$/, "");
}

// ------------------------------------------------------------ autosave (IndexedDB)

const DB = "ftc-embeds-avatar";
const STORE = "drafts";

function openDb() {
    return new Promise((resolve, reject) => {
        let req = indexedDB.open(DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function withStore(mode, fn) {
    let db = await openDb();
    try {
        return await new Promise((resolve, reject) => {
            let tx = db.transaction(STORE, mode);
            let req = fn(tx.objectStore(STORE));
            tx.oncomplete = () => resolve(req?.result);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    } finally {
        db.close();
    }
}

/** The autosave: { savedAt, project, source (PNG Blob) } under key "current". Every access may fail. */
export const autosave = {
    async available() {
        try {
            if (typeof indexedDB === "undefined") return false;
            await withStore("readonly", (s) => s.count());
            return true;
        } catch {
            return false;
        }
    },
    async load() {
        try {
            return (await withStore("readonly", (s) => s.get("current"))) ?? null;
        } catch {
            return null;
        }
    },
    async save(entry) {
        try {
            await withStore("readwrite", (s) => s.put(entry, "current"));
            return true;
        } catch {
            return false;
        }
    },
    async clear() {
        try {
            await withStore("readwrite", (s) => s.delete("current"));
        } catch {
            // nothing to clear
        }
    },
};
