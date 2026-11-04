/* Avatar editor for /avatars: AvatarEditor.open({...}) opens a full-screen editor on one option.
 *
 * The avatar is drawn on a 320 x 320 canvas (8 x the 40 px result) and reduced to 40 x 40 once, with
 * a premultiplied Lanczos-3 filter, as the server does. The document is a plain object:
 *   src        which server layer the logo comes from (cut, all, main, notext, logo)
 *   t          the logo's place: canvas = source * s + (x, y)
 *   logoOps    erase / restore strokes and magic-wand clicks, in source pixels
 *   draw       the drawing layer: brush strokes, eraser strokes and Bezier paths, in canvas units
 *   bg, border, borderColour, frame, adjust, vis
 * Every change makes a new document object, so undo and redo are a list of documents.
 */
(() => {
    "use strict";
    const N = 320, S = 8;
    const FIRST_BG = [["white", "#ffffff", true], ["red", "#ed1c24"], ["blue", "#0066b3"], ["award", "#0083ae"], ["dark", "#16161a"]];
    const SUGGEST = [["teal", "#00626e"], ["navy", "#16264a"], ["black", "#121216"], ["white", "#ffffff"], ["cream", "#f5ecd6"]];
    const SOURCES = { cut: "Cut-out (letter gaps removed)", all: "Cut-out, every enclosed gap removed", main: "Main part only", notext: "Without the text", logo: "Original, with its background" };
    const ICON = {
        select: "M5 3l13 8-6 1.5L9 19z",
        move: "M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3",
        erase: "M8 20h12M5 15l8-8 6 6-5 5H9zM9 11l6 6",
        restore: "M4 12a8 8 0 1 0 3-6.2M4 4v4h4",
        wand: "M4 20L15 9M14 4v3M19 9h-3M17.5 5.5l-2 2M10 4.5l1 2M19.5 13l-2-1",
        brush: "M18 3l3 3-9 9-3-3zM9 12c-3 0-4 2-4 4s-1 3-2 3c2 1 6 1 7-1s2-3-1-6z",
        pen: "M12 3l6 9-6 9-6-9zM12 3v8M12 12.5a1 1 0 1 0 0 .1",
        shape: "M3 3h9v9H3zM17 12a4 4 0 1 0 .1 0M7 21l3-5 3 5z",
        picker: "M15 4l5 5-2 2-1-1-8 8H6v-3l8-8-1-1zM4 20l2-2",
        hand: "M8 13V5a1.5 1.5 0 0 1 3 0v6M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V5a1.5 1.5 0 0 1 3 0v8c0 5-3 8-7 8-3 0-5-2-6-5l-2-4a1.5 1.5 0 0 1 2.6-1.5L8 13",
    };
    const TOOLS = [
        ["select", "v", "Select", "Drag over an area to select it: the shapes inside it on the selected layer are selected, and the eraser, brush and wand then only work inside it. Click a shape to select it (Shift adds more); drag a selected shape to move it. Delete removes what is selected."],
        ["move", "m", "Move logo", "Drag to move the logo. Use the size slider above to make it bigger or smaller. Arrow keys nudge it by one avatar pixel."],
        ["erase", "e", "Eraser", "Drag to erase on the layer that is selected in Layers (right). Hold Alt to restore the logo instead."],
        ["restore", "r", "Restore", "Paint to bring back the original logo, including its background, where the cut-out removed too much."],
        ["wand", "w", "Magic wand", "Click an area (like the gap inside a letter, or a leftover background) to cut it out. Alt-click brings it back."],
        ["brush", "b", "Brush", "Drag to paint with the line colour. [ and ] change the size. Alt-click picks a colour."],
        ["pen", "p", "Pen", "Click to place corner points; click and drag to make a curve. Click the first point to close the shape. Enter or double-click finishes. Backspace removes the last point."],
        ["shape", "u", "Shapes", "Pick a shape above and drag to draw it. Shift keeps it square, Alt draws from the middle. Corners rounds the corners, now or later on the selected shape. Shapes stay editable with Select."],
        ["picker", "i", "Eyedropper", "Click the canvas to pick a colour. Choose above where it goes: line, fill or background."],
        ["hand", "h", "Hand", "Drag to look around. Scroll to zoom. Hold Space with any tool for the hand."],
    ];
    const SHORTCUTS = [
        ["V M E R W B P U I H", "the tools, as labelled"],
        ["Ctrl+S", "save in this browser"],
        ["Ctrl+Shift+S", "save a version"],
        ["Ctrl+E", "export"],
        ["Ctrl+A, Esc", "select everything, select nothing"],
        ["T", "view with background or transparent"],
        ["Ctrl+Z, Ctrl+Shift+Z or Ctrl+Y", "undo, redo"],
        ["[ and ]", "smaller or bigger eraser and brush"],
        ["Space + drag, scroll", "look around, zoom"],
        ["+ − 0", "zoom in, out, fit"],
        ["Alt", "eraser restores, wand brings back, brush picks a colour, pen breaks a curve handle, shapes draw from the middle"],
        ["Shift", "square shapes, straight lines, move in one direction"],
        ["Enter, Esc", "finish the path you are drawing"],
        ["Delete", "remove the selected point or shapes, or erase inside the selected area"],
        ["G", "pixel grid on or off"],
        ["X", "swap the line and fill colours"],
    ];

    const el = (tag, props = {}, ...kids) => { let e = Object.assign(document.createElement(tag), props); for (let k of kids) if (k != null && k !== false) e.append(k); return e; };
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const hex2rgb = (h) => { h = (h || "#000").replace("#", ""); if (h.length === 3) h = h.replace(/./g, "$&$&"); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0); };
    const rgb2hex = (r, g, b) => "#" + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");
    const canvas = (w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h });
    const ctx2d = (c, opts) => c.getContext("2d", opts);
    const svgIcon = (d) => { let s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true"); let p = document.createElementNS(s.namespaceURI, "path"); p.setAttribute("d", d); s.append(p); return s; };
    const loadImage = (src) => new Promise((ok, bad) => { let i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error("layer")); i.src = src; });
    let uid = 1;

    // --- the 40 px result: premultiplied Lanczos-3, 320 -> 40 ----------------------------------------
    const LANCZOS = (() => {
        let L = (x) => (x === 0 ? 1 : Math.abs(x) >= 3 ? 0 : (3 * Math.sin(Math.PI * x) * Math.sin(Math.PI * x / 3)) / (Math.PI * Math.PI * x * x));
        let out = [];
        for (let o = 0; o < 40; o++) {
            let c = (o + 0.5) * S, idx = [], w = [], sum = 0;
            for (let i = Math.floor(c - 3 * S); i < Math.ceil(c + 3 * S); i++) {
                if (i < 0 || i >= N) continue;
                let v = L((i + 0.5 - c) / S); idx.push(i); w.push(v); sum += v;
            }
            out.push({ idx, w: w.map((v) => v / sum) });
        }
        return out;
    })();
    function reduce(P) {   // P: Float32Array 320*320*4, premultiplied 0..1 -> Float32Array 40*40*4
        let H = new Float32Array(N * 40 * 4), O = new Float32Array(40 * 40 * 4);
        for (let y = 0; y < N; y++) for (let o = 0; o < 40; o++) {
            let { idx, w } = LANCZOS[o], r = 0, g = 0, b = 0, a = 0;
            for (let k = 0; k < idx.length; k++) { let p = (y * N + idx[k]) * 4, v = w[k]; r += P[p] * v; g += P[p + 1] * v; b += P[p + 2] * v; a += P[p + 3] * v; }
            let q = (y * 40 + o) * 4; H[q] = r; H[q + 1] = g; H[q + 2] = b; H[q + 3] = a;
        }
        for (let o = 0; o < 40; o++) for (let x = 0; x < 40; x++) {
            let { idx, w } = LANCZOS[o], r = 0, g = 0, b = 0, a = 0;
            for (let k = 0; k < idx.length; k++) { let p = (idx[k] * 40 + x) * 4, v = w[k]; r += H[p] * v; g += H[p + 1] * v; b += H[p + 2] * v; a += H[p + 3] * v; }
            let q = (o * 40 + x) * 4; a = clamp(a, 0, 1); O[q] = clamp(r, 0, a); O[q + 1] = clamp(g, 0, a); O[q + 2] = clamp(b, 0, a); O[q + 3] = a;
        }
        return O;
    }
    function maxFilter(A, R, W = N) {   // square max filter of a W x W alpha map, as Pillow's MaxFilter
        let T = new Float32Array(W * W), U = new Float32Array(W * W);
        for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { let m = 0; for (let k = Math.max(0, x - R); k <= Math.min(W - 1, x + R); k++) m = Math.max(m, A[y * W + k]); T[y * W + x] = m; }
        for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { let m = 0; for (let k = Math.max(0, y - R); k <= Math.min(W - 1, y + R); k++) m = Math.max(m, T[k * W + x]); U[y * W + x] = m; }
        return U;
    }
    function edt(inside, W, H) {   // distance from every pixel to the nearest `inside` pixel (Felzenszwalb and Huttenlocher)
        let INF = 1e20, n = Math.max(W, H), f = new Float64Array(n), dd = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1), out = new Float64Array(W * H);
        let pass = (len) => {
            let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
            for (let q = 1; q < len; q++) {
                let s2 = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
                while (s2 <= z[k]) { k--; s2 = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
                k++; v[k] = q; z[k] = s2; z[k + 1] = INF;
            }
            k = 0;
            for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; dd[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
        };
        for (let x = 0; x < W; x++) { for (let y = 0; y < H; y++) f[y] = inside[y * W + x] ? 0 : INF; pass(H); for (let y = 0; y < H; y++) out[y * W + x] = dd[y]; }
        for (let y = 0; y < H; y++) { for (let x = 0; x < W; x++) f[x] = out[y * W + x]; pass(W); for (let x = 0; x < W; x++) out[y * W + x] = Math.sqrt(dd[x]); }
        return out;
    }
    function roundBorder(A, R, W) {   // how much of each pixel the border covers: a circle of radius R around the shape, soft-edged
        let inside = new Uint8Array(W * W);
        for (let i = 0; i < W * W; i++) inside[i] = A[i] > 0.5 ? 1 : 0;
        let d = edt(inside, W, W), out = new Float32Array(W * W);
        for (let i = 0; i < W * W; i++) out[i] = Math.max(A[i], clamp(R + 0.5 - d[i], 0, 1));
        return out;
    }
    function tidyEdges(d, W = 40) {   // smooth outline: inside the avatar every pixel solid, only the outer row soft; no faint specks
        let D = d.data, A = new Uint8ClampedArray(W * W);
        for (let pass = 0; pass < 4; pass++) {      // until nothing changes: a pixel can become inside once its neighbours are solid
            for (let i = 0; i < W * W; i++) A[i] = D[i * 4 + 3];
            let at = (x, y) => (x < 0 || y < 0 || x >= W || y >= W ? 0 : A[y * W + x]), changed = false;
            for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
                let i = y * W + x, a = A[i];
                if (!a || a === 255) continue;
                if (a < 31) { D[i * 4] = D[i * 4 + 1] = D[i * 4 + 2] = D[i * 4 + 3] = 0; changed = true; continue; }
                if (a >= 235 || (at(x - 1, y) >= 128 && at(x + 1, y) >= 128 && at(x, y - 1) >= 128 && at(x, y + 1) >= 128)) { D[i * 4 + 3] = 255; changed = true; }
            }
            if (!changed) break;
        }
        return d;
    }
    function toImageData(O, floor, crisp) {   // premultiplied 40 x 40 -> ImageData; alpha under `floor` becomes 0 (no hidden colour)
        let d = new ImageData(40, 40);       // crisp: no half-transparent pixels (at least 50% -> solid, the rest -> nothing)
        for (let i = 0; i < 1600; i++) {
            let a = O[i * 4 + 3];
            if (a * 255 < (crisp ? 127.5 : floor)) continue;
            d.data[i * 4] = Math.round((O[i * 4] / a) * 255); d.data[i * 4 + 1] = Math.round((O[i * 4 + 1] / a) * 255);
            d.data[i * 4 + 2] = Math.round((O[i * 4 + 2] / a) * 255); d.data[i * 4 + 3] = crisp ? 255 : Math.round(a * 255);
        }
        return d;
    }
    function medianCut(px, n) {   // px: array of [r,g,b] -> palette of up to n colours
        let boxes = [px];
        while (boxes.length < n) {
            let bi = -1, best = -1, ch = 0;
            boxes.forEach((b, i) => {
                if (b.length < 2) return;
                for (let c = 0; c < 3; c++) { let lo = 255, hi = 0; for (let p of b) { lo = Math.min(lo, p[c]); hi = Math.max(hi, p[c]); } if (hi - lo > best) { best = hi - lo; bi = i; ch = c; } }
            });
            if (bi < 0 || best <= 0) break;
            let b = boxes[bi].sort((p, q) => p[ch] - q[ch]), m = b.length >> 1;
            boxes.splice(bi, 1, b.slice(0, m), b.slice(m));
        }
        return boxes.map((b) => { let s = [0, 0, 0]; for (let p of b) { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; } return s.map((v) => v / b.length); });
    }

    // --- polygons (selections) -----------------------------------------------------------------------
    function polyPath(poly, invertBox) {
        let p = new Path2D();
        if (invertBox) p.rect(...invertBox);
        poly.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
        p.closePath();
        return p;
    }
    function inPoly(poly, x, y) {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            let [xi, yi] = poly[i], [xj, yj] = poly[j];
            if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
        }
        return inside;
    }
    const rectPoly = (a, b) => [[a.x, a.y], [b.x, a.y], [b.x, b.y], [a.x, b.y]];

    // --- files: a project file, zip (stored), ICO ------------------------------------------------------
    const serialize = (v) => JSON.stringify(v, (k, x) => (k[0] === "_" ? undefined : x));   // no wand caches
    const CRC = (() => { let t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
    const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
    function zip(files) {   // files: [{name, data: Uint8Array}] -> Blob (no compression: PNGs are compressed already)
        let enc = new TextEncoder(), parts = [], central = [], off = 0;
        let le = (n, b) => { let a = new Uint8Array(b); for (let i = 0; i < b; i++) a[i] = (n >>> (8 * i)) & 255; return a; };
        for (let f of files) {
            let name = enc.encode(f.name), crc = crc32(f.data), n = f.data.length;
            let head = [le(0x04034b50, 4), le(20, 2), le(0x0800, 2), le(0, 2), le(0, 2), le(0x21, 2), le(crc, 4), le(n, 4), le(n, 4), le(name.length, 2), le(0, 2), name];
            central.push([le(0x02014b50, 4), le(20, 2), le(20, 2), le(0x0800, 2), le(0, 2), le(0, 2), le(0x21, 2), le(crc, 4), le(n, 4), le(n, 4), le(name.length, 2), le(0, 2), le(0, 2), le(0, 2), le(0, 2), le(0, 4), le(off, 4), name]);
            parts.push(...head, f.data);
            off += head.reduce((s, a) => s + a.length, 0) + n;
        }
        let cd = central.flat(), size = cd.reduce((s, a) => s + a.length, 0);
        return new Blob([...parts, ...cd, le(0x06054b50, 4), le(0, 2), le(0, 2), le(files.length, 2), le(files.length, 2), le(size, 4), le(off, 4), le(0, 2)], { type: "application/zip" });
    }
    function ico(pngs) {   // pngs: [{size, data: Uint8Array}] -> Blob (an ICO with PNG images, as browsers and Windows read)
        let head = new DataView(new ArrayBuffer(6 + 16 * pngs.length)), off = 6 + 16 * pngs.length;
        head.setUint16(2, 1, true); head.setUint16(4, pngs.length, true);
        pngs.forEach((p, i) => {
            let o = 6 + 16 * i;
            head.setUint8(o, p.size >= 256 ? 0 : p.size); head.setUint8(o + 1, p.size >= 256 ? 0 : p.size);
            head.setUint16(o + 4, 1, true); head.setUint16(o + 6, 32, true); head.setUint32(o + 8, p.data.length, true); head.setUint32(o + 12, off, true);
            off += p.data.length;
        });
        return new Blob([head.buffer, ...pngs.map((p) => p.data)], { type: "image/x-icon" });
    }
    const blobOf = (c, type, q) => new Promise((ok) => c.toBlob(ok, type, q));
    const bytesOfBlob = async (b) => new Uint8Array(await b.arrayBuffer());
    const saveBlob = (blob, name) => { let u = URL.createObjectURL(blob), a = el("a", { href: u, download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); };

    // --- saved in this browser: IndexedDB (projects, and the server layers they start from) -------------
    const store = (() => {
        let dbp = null;
        let db = () => dbp || (dbp = new Promise((ok, bad) => {
            let r = indexedDB.open("ftc-avatar-editor", 1);
            r.onupgradeneeded = () => { r.result.createObjectStore("projects", { keyPath: "id" }); r.result.createObjectStore("layers", { keyPath: "id" }); };
            r.onsuccess = () => ok(r.result); r.onerror = () => { dbp = null; bad(r.error); };
        }));
        let run = async (name, mode, fn) => {
            let d = await db();
            return new Promise((ok, bad) => { let t = d.transaction(name, mode), s = t.objectStore(name), r = fn(s); t.oncomplete = () => ok(r && r.result); t.onerror = () => bad(t.error); t.onabort = () => bad(t.error); });
        };
        return {
            list: () => run("projects", "readonly", (s) => s.getAll()).then((a) => (a || []).sort((p, q) => q.updated - p.updated)),
            get: (id) => run("projects", "readonly", (s) => s.get(id)),
            put: (rec) => run("projects", "readwrite", (s) => s.put(rec)),
            putLayers: (id, L) => run("layers", "readwrite", (s) => s.put(Object.assign({ id }, L))),
            getLayers: (id) => run("layers", "readonly", (s) => s.get(id)),
            async del(id) {
                let rec = await this.get(id);
                await run("projects", "readwrite", (s) => s.delete(id));
                if (rec && !(await this.list()).some((p) => p.layersId === rec.layersId)) await run("layers", "readwrite", (s) => s.delete(rec.layersId));
            },
        };
    })();

    // --- paths ----------------------------------------------------------------------------------------
    const node = (x, y) => ({ x, y, ix: x, iy: y, ox: x, oy: y, smooth: false });
    const isCorner = (n) => n.ix === n.x && n.iy === n.y && n.ox === n.x && n.oy === n.y;
    function roundNodes(nodes, closed, radius) {
        // Rounded corners, applied when drawing (the shape keeps its own points): every corner point
        // becomes two points joined by a quarter-circle-like curve, at most half-way along each edge.
        let N_ = nodes.length, out = [], k = 0.5523;
        for (let i = 0; i < N_; i++) {
            let n = nodes[i];
            if (!isCorner(n) || (!closed && (i === 0 || i === N_ - 1))) { out.push(Object.assign({}, n)); continue; }
            let p = nodes[(i - 1 + N_) % N_], q = nodes[(i + 1) % N_];
            let P = p.ox !== p.x || p.oy !== p.y ? [p.ox, p.oy] : [p.x, p.y], Q = q.ix !== q.x || q.iy !== q.y ? [q.ix, q.iy] : [q.x, q.y];
            let dp = Math.hypot(P[0] - n.x, P[1] - n.y), dq = Math.hypot(Q[0] - n.x, Q[1] - n.y);
            if (dp < 1e-6 || dq < 1e-6) { out.push(Object.assign({}, n)); continue; }
            let r = Math.min(radius, Math.hypot(p.x - n.x, p.y - n.y) / 2, Math.hypot(q.x - n.x, q.y - n.y) / 2);
            let A = [n.x + ((P[0] - n.x) / dp) * r, n.y + ((P[1] - n.y) / dp) * r], B = [n.x + ((Q[0] - n.x) / dq) * r, n.y + ((Q[1] - n.y) / dq) * r];
            out.push({ x: A[0], y: A[1], ix: A[0], iy: A[1], ox: A[0] + (n.x - A[0]) * k, oy: A[1] + (n.y - A[1]) * k, smooth: false });
            out.push({ x: B[0], y: B[1], ix: B[0] + (n.x - B[0]) * k, iy: B[1] + (n.y - B[1]) * k, ox: B[0], oy: B[1], smooth: false });
        }
        return out;
    }
    function pathOf(o) {
        let p = new Path2D(), n = o.nodes || o.pts;
        if (o.k === "stroke") {
            let q = o.pts;
            p.moveTo(q[0][0], q[0][1]);
            if (q.length === 1) p.lineTo(q[0][0] + 0.01, q[0][1]);
            for (let i = 1; i < q.length - 1; i++) p.quadraticCurveTo(q[i][0], q[i][1], (q[i][0] + q[i + 1][0]) / 2, (q[i][1] + q[i + 1][1]) / 2);
            if (q.length > 1) p.lineTo(q[q.length - 1][0], q[q.length - 1][1]);
            return p;
        }
        if (!n.length) return p;
        if (o.radius > 0 && n.length > 2) n = roundNodes(n, o.closed, o.radius);
        p.moveTo(n[0].x, n[0].y);
        let seg = (a, b) => p.bezierCurveTo(a.ox, a.oy, b.ix, b.iy, b.x, b.y);
        for (let i = 1; i < n.length; i++) seg(n[i - 1], n[i]);
        if (o.closed && n.length > 1) { seg(n[n.length - 1], n[0]); p.closePath(); }
        return p;
    }
    const bez = (a, b, c, d, t) => { let u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d; };
    const free = (o) => { if (!o.box) return o; let c = Object.assign({}, o); delete c.box; delete c.params; return c; };   // points edited by hand
    const SHAPES = [["rect", "Rectangle"], ["ellipse", "Ellipse"], ["triangle", "Triangle"], ["polygon", "Polygon"], ["star", "Star"], ["heart", "Heart"], ["arrow", "Arrow"], ["line", "Line"]];
    const ROUNDABLE = ["rect", "triangle", "polygon", "star", "arrow"];
    function shapeNodes(kind, a, b, shift, opt = {}, centre = false) {
        // a shape in the box dragged from a to b. shift: keep it square (lines: 45 degree steps);
        // centre: a is the middle. opt: {sides, points, inner} for polygons and stars.
        let x0 = a.x, y0 = a.y, x1 = b.x, y1 = b.y;
        if (kind === "line") {
            if (shift) { let dx = x1 - x0, dy = y1 - y0, ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4), len = Math.hypot(dx, dy); x1 = x0 + Math.cos(ang) * len; y1 = y0 + Math.sin(ang) * len; }
            if (centre) { x0 = 2 * a.x - x1; y0 = 2 * a.y - y1; }
            return { nodes: [node(x0, y0), node(x1, y1)], closed: false };
        }
        if (shift) { let s = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); x1 = x0 + Math.sign(x1 - x0 || 1) * s; y1 = y0 + Math.sign(y1 - y0 || 1) * s; }
        if (centre) { x0 = 2 * a.x - x1; y0 = 2 * a.y - y1; }
        let l = Math.min(x0, x1), r = Math.max(x0, x1), t = Math.min(y0, y1), bt = Math.max(y0, y1);
        let cx = (l + r) / 2, cy = (t + bt) / 2, rx = (r - l) / 2, ry = (bt - t) / 2, w = r - l, h = bt - t, k = 0.5523;
        let corners = (pts) => ({ nodes: pts.map(([x, y]) => node(x, y)), closed: true });
        if (kind === "rect") return corners([[l, t], [r, t], [r, bt], [l, bt]]);
        if (kind === "triangle") return corners([[cx, t], [r, bt], [l, bt]]);
        if (kind === "polygon" || kind === "star") {
            let n = kind === "star" ? Math.max(3, opt.points || 5) : Math.max(3, opt.sides || 6), pts = [];
            for (let i = 0; i < (kind === "star" ? 2 * n : n); i++) {
                let ang = -Math.PI / 2 + (i * Math.PI * 2) / (kind === "star" ? 2 * n : n), f = kind === "star" && i % 2 ? (opt.inner || 0.5) : 1;
                pts.push([cx + rx * f * Math.cos(ang), cy + ry * f * Math.sin(ang)]);
            }
            return corners(pts);
        }
        if (kind === "arrow") {    // pointing the way it was dragged: right, left, up or down
            let vertical = Math.abs(y1 - y0) > Math.abs(x1 - x0) * 1.5, back = vertical ? y1 < y0 : x1 < x0;
            let pts = [[0, 0.3], [0.58, 0.3], [0.58, 0], [1, 0.5], [0.58, 1], [0.58, 0.7], [0, 0.7]];
            return corners(pts.map(([u, v]) => { if (back) u = 1 - u; return vertical ? [l + v * w, t + u * h] : [l + u * w, t + v * h]; }));
        }
        if (kind === "heart") {
            let P = (u, v) => [l + u * w, t + v * h];
            let nd = (u, v, iu, iv, ou, ov, smooth) => { let [x, y] = P(u, v), [ix, iy] = P(iu, iv), [ox, oy] = P(ou, ov); return { x, y, ix, iy, ox, oy, smooth }; };
            return { nodes: [
                nd(0.5, 0.24, 0.5, 0.24, 0.62, 0.02, false),     // the dip at the top
                nd(0.78, 0.0, 0.66, 0.0, 0.92, 0.0, true),
                nd(1.0, 0.3, 1.0, 0.13, 1.0, 0.5, true),
                nd(0.5, 1.0, 0.82, 0.68, 0.18, 0.68, false),     // the point at the bottom
                nd(0.0, 0.3, 0.0, 0.5, 0.0, 0.13, true),
                nd(0.22, 0.0, 0.08, 0.0, 0.34, 0.0, true),
            ].map((n, i, all) => (i === 0 ? Object.assign(n, { ix: P(0.38, 0.02)[0], iy: P(0.38, 0.02)[1] }) : n)), closed: true };
        }
        let n = [[cx, t, -1, 0], [r, cy, 0, -1], [cx, bt, 1, 0], [l, cy, 0, 1]].map(([x, y, dx, dy]) => ({ x, y, ix: x + dx * rx * k, iy: y + dy * ry * k, ox: x - dx * rx * k, oy: y - dy * ry * k, smooth: true }));
        return { nodes: n, closed: true };
    }

    // --- styles (once) ---------------------------------------------------------------------------------
    const CSS = `
.ae{position:fixed;inset:0;z-index:100;background:var(--paper,#f4f1ea);color:var(--ink,#1c1b19);display:grid;grid-template:"head head head" auto "tools bar side" auto "tools stage side" minmax(0,1fr) / 96px minmax(0,1fr) 330px;font:14px/1.4 var(--sans,system-ui,sans-serif)}
.ae *{box-sizing:border-box}
.ae button{font:inherit;color:inherit}
.ae-head{grid-area:head;display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:2px solid var(--ink,#1c1b19);flex-wrap:wrap}
.ae-head h2{margin:0 auto 0 0;font-size:16px;font-weight:600}
.ae-head h2 small{font-weight:400;color:var(--ink-2,#5d5a53);margin-left:8px;font-size:13px}
.ae .b{border:1px solid var(--ink,#1c1b19);background:none;border-radius:2px;padding:5px 10px;cursor:pointer;font-size:13px;display:inline-flex;align-items:center;gap:6px;text-decoration:none}
.ae .b:hover{background:var(--paper-2,#ebe6db)}
.ae .b:disabled{opacity:.4;cursor:default;background:none}
.ae .b.go{background:var(--accent,#ff5a1f);border-color:var(--accent,#ff5a1f);color:var(--accent-ink,#1c1b19);font-weight:500}
.ae .b.on{background:var(--ink,#1c1b19);color:var(--paper,#f4f1ea)}
.ae-tools{grid-area:tools;border-right:1px solid var(--rule,#cfc8b8);padding:8px 6px;display:flex;flex-direction:column;gap:3px;overflow:auto}
.ae-tool{display:grid;justify-items:center;gap:2px;padding:6px 2px 5px;border:1px solid transparent;border-radius:3px;background:none;cursor:pointer;font-size:11.5px;line-height:1.15;text-align:center;position:relative}
.ae-tool svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.ae-tool kbd{position:absolute;top:3px;right:4px;font:9.5px var(--mono,monospace);color:var(--ink-2,#5d5a53)}
.ae-tool:hover{background:var(--paper-2,#ebe6db)}
.ae-tool[aria-pressed=true]{background:var(--ink,#1c1b19);color:var(--paper,#f4f1ea)}
.ae-tool[aria-pressed=true] kbd{color:inherit;opacity:.7}
.ae-bar{grid-area:bar;display:flex;align-items:center;gap:8px 16px;padding:8px 14px;border-bottom:1px solid var(--rule,#cfc8b8);flex-wrap:wrap;min-height:46px;font-size:13px}
.ae-bar label{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.ae-bar output{font:12px var(--mono,monospace);min-width:44px}
.ae-bar .seg{display:inline-flex}
.ae-bar .seg .b{border-radius:0;margin-left:-1px}
.ae-bar .seg .b:first-child{border-radius:2px 0 0 2px;margin-left:0}
.ae-bar .seg .b:last-child{border-radius:0 2px 2px 0}
.ae-bar .t{font-weight:600}
.ae input[type=range]{width:120px;accent-color:var(--ink,#1c1b19)}
.ae input[type=color]{width:30px;height:24px;padding:0;border:1px solid var(--rule,#cfc8b8);background:none;border-radius:2px;cursor:pointer}
.ae select{font:13px var(--sans,sans-serif);color:var(--ink,#1c1b19);background:var(--field,#fbf9f4);border:1px solid var(--rule,#cfc8b8);border-radius:2px;padding:4px 6px;max-width:100%}
.ae-stage{grid-area:stage;position:relative;overflow:hidden;background:var(--paper-2,#ebe6db);touch-action:none}
.ae-stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.ae-hint{position:absolute;left:10px;right:10px;bottom:10px;display:flex;gap:10px;align-items:flex-end;justify-content:space-between;pointer-events:none}
.ae-hint p{margin:0;max-width:62ch;padding:7px 10px;background:var(--paper,#f4f1ea);border:1px solid var(--rule,#cfc8b8);border-radius:2px;font-size:13px;pointer-events:auto}
.ae-hint p b{margin-right:6px}
.ae-zoom{display:flex;gap:4px;align-items:center;pointer-events:auto;background:var(--paper,#f4f1ea);border:1px solid var(--rule,#cfc8b8);padding:3px;border-radius:2px}
.ae-zoom .b{padding:2px 8px;border-color:transparent}
.ae-zoom output{font:12px var(--mono,monospace);min-width:48px;text-align:center}
.ae-side{grid-area:side;border-left:1px solid var(--rule,#cfc8b8);overflow:auto;display:grid;align-content:start}
.ae-sec{padding:12px 16px 14px;border-bottom:1px solid var(--rule,#cfc8b8);display:grid;gap:8px}
.ae-sec h3{margin:0;font-size:13px;font-weight:600;display:flex;justify-content:space-between;align-items:center}
.ae-sec label{display:flex;align-items:center;gap:8px;font-size:13px}
.ae-sec label.col{display:grid;gap:4px}
.ae-sec .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.ae-sec output{font:12px var(--mono,monospace)}
.ae-sw{display:flex;gap:4px;flex-wrap:wrap}
.ae-sw button{width:22px;height:22px;border:1px solid var(--rule,#cfc8b8);border-radius:2px;cursor:pointer;padding:0}
.ae-sw button[aria-pressed=true]{outline:2px solid var(--accent,#ff5a1f);outline-offset:1px}
.ae-pv{display:flex;gap:10px}
.ae-pv figure{margin:0}
.ae-pv figcaption{font:11px var(--mono,monospace);color:var(--ink-2,#5d5a53);margin-top:3px}
.ae-pv img{display:block;width:120px;height:120px;image-rendering:pixelated;border:1px solid var(--rule,#cfc8b8)}
.ae-chk{background:repeating-conic-gradient(#d4d4d4 0% 25%,#fff 0% 50%) 0 0/12px 12px}
.ae-strip{display:flex;gap:5px;flex-wrap:wrap}
.ae-strip div{display:grid;justify-items:center;gap:5px;width:50px;padding:6px 0 4px;border-radius:2px}
.ae-strip img{display:block}
.ae-strip span{font:9.5px var(--mono,monospace);color:#fff}
.ae-strip .light{box-shadow:inset 0 0 0 1px var(--rule,#cfc8b8)}
.ae-strip .light span{color:#1c1b19}
.ae-warn{margin:0;padding-left:18px;font-size:12.5px;color:var(--warn,#b3360f)}
.ae-ok{margin:0;font-size:12.5px;color:var(--ink-2,#5d5a53)}
.ae-layers{display:grid;gap:4px}
.ae-colours{display:grid;grid-template-columns:auto 1fr;gap:6px 10px;align-items:center}
.ae dialog{border:2px solid var(--ink,#1c1b19);background:var(--paper,#f4f1ea);color:var(--ink,#1c1b19);padding:18px 20px;max-width:560px}
.ae dialog table{border-collapse:collapse;font-size:13px}
.ae dialog td{padding:4px 12px 4px 0;vertical-align:top}
.ae dialog td:first-child{font:12px var(--mono,monospace);white-space:nowrap}
.ae-saved{font:12px var(--mono,monospace);color:var(--ink-2,#5d5a53)}
.ae-view{position:absolute;left:10px;top:10px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;background:var(--paper,#f4f1ea);border:1px solid var(--rule,#cfc8b8);padding:4px;border-radius:2px;font-size:12.5px;max-width:calc(100% - 20px)}
.ae-view .seg{display:inline-flex}
.ae-view .seg .b{border-radius:0;margin-left:-1px;padding:3px 8px;font-size:12.5px}
.ae-view .seg .b:first-child{border-radius:2px 0 0 2px;margin-left:0}
.ae-view .seg .b:last-child{border-radius:0 2px 2px 0}
.ae-view .bd{display:inline-flex;gap:3px}
.ae-view .bd button{width:20px;height:20px;padding:0;border:1px solid var(--rule,#cfc8b8);border-radius:2px;cursor:pointer}
.ae-view .bd button[aria-pressed=true]{outline:2px solid var(--accent,#ff5a1f);outline-offset:1px}
.ae-lay{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto auto;gap:2px 4px;align-items:center}
.ae-lay .nm{text-align:left;border:1px solid transparent;background:none;padding:4px 6px;border-radius:2px;cursor:pointer;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ae-lay .nm[aria-pressed=true]{background:var(--ink,#1c1b19);color:var(--paper,#f4f1ea)}
.ae-lay .ic{border:0;background:none;cursor:pointer;padding:2px 5px;font-size:13px;color:var(--ink-2,#5d5a53)}
.ae-lay .ic:disabled{opacity:.25;cursor:default}
.ae-lay small{font:10.5px var(--mono,monospace);color:var(--ink-2,#5d5a53)}
.ae dialog.ae-ex{max-width:620px;width:calc(100% - 32px)}
.ae-ex fieldset{border:0;padding:0;margin:0 0 12px;display:flex;gap:6px 14px;flex-wrap:wrap;align-items:center}
.ae-ex legend{font-weight:600;font-size:13px;margin-bottom:6px;padding:0}
.ae-ex label{display:inline-flex;gap:5px;align-items:center;font-size:13px}
.ae-ex .pv{display:flex;gap:12px;align-items:center;margin:4px 0 12px}
.ae-ex .pv canvas{border:1px solid var(--rule,#cfc8b8);image-rendering:pixelated}
.ae-ex .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.ae-vers{display:grid;gap:6px}
.ae-ver{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:4px 8px;align-items:center;padding:6px;border:1px solid var(--rule,#cfc8b8);background:var(--field,#fbf9f4);border-radius:2px}
.ae-ver .th{display:flex;gap:3px}
.ae-ver .th img{width:40px;height:40px;image-rendering:pixelated;display:block}
.ae-ver b{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ae-ver small{display:block;font:11px var(--mono,monospace);color:var(--ink-2,#5d5a53)}
.ae-ver .acts{display:flex;gap:4px}
.ae-ver .acts .b{padding:3px 7px;font-size:12px}
.ae dialog.ae-cmp{max-width:none;width:calc(100% - 48px);height:calc(100% - 48px);padding:0;display:none}
.ae dialog.ae-cmp[open]{display:grid;grid-template:"head head" auto "side view" minmax(0,1fr) / 240px minmax(0,1fr)}
.ae-cmp header{grid-area:head;display:flex;gap:10px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--rule,#cfc8b8);flex-wrap:wrap}
.ae-cmp header h3{margin:0 auto 0 0;font-size:16px}
.ae-cmp aside{grid-area:side;padding:12px 14px;border-right:1px solid var(--rule,#cfc8b8);overflow:auto;display:grid;gap:8px;align-content:start}
.ae-cmp aside label{display:flex;gap:8px;align-items:center;font-size:13px}
.ae-cmp aside label img{width:20px;height:20px;image-rendering:pixelated;flex:none}
.ae-cmp .view{grid-area:view;overflow:auto;padding:16px;background:var(--paper-2,#ebe6db)}
.ae-cmp .view img{display:block;margin:0 auto;max-width:100%;height:auto;cursor:zoom-in;box-shadow:0 1px 0 var(--rule,#cfc8b8)}
.ae-cmp .view.full img{max-width:none;width:auto;cursor:zoom-out}
@media (max-width:900px){.ae dialog.ae-cmp[open]{grid-template:"head" auto "side" auto "view" minmax(0,1fr) / minmax(0,1fr)} .ae-cmp aside{border-right:0;border-bottom:1px solid var(--rule,#cfc8b8)}}
.ae-busy{position:absolute;inset:0;display:grid;place-items:center;font-size:14px;color:var(--ink-2,#5d5a53)}
@media (max-width:900px){
 .ae{display:flex;flex-direction:column;overflow:auto}
 .ae>*{flex:none}
 .ae-head{order:1;padding:8px 12px;gap:6px}
 .ae-head h2{flex-basis:100%}
 .ae-bar{order:2;padding:6px 12px}
 .ae-stage{order:3;height:58vh}
 .ae-tools{order:4;flex-direction:row;border-right:0;border-bottom:1px solid var(--rule,#cfc8b8);overflow-x:auto;padding:6px}
 .ae-tool{min-width:68px;flex:none}
 .ae-side{order:5;border-left:0;overflow:visible}
 .ae-hint{left:6px;right:6px;bottom:6px}
 .ae-hint p{font-size:12px;padding:5px 8px;max-width:64%}
}`;
    let styled = false;
    const defaultLayers = () => [
        { id: "under", name: "Behind the logo", kind: "draw", vis: true, opacity: 1 },
        { id: "logo", name: "Logo", kind: "logo", vis: true, opacity: 1 },
        { id: "over", name: "Drawing", kind: "draw", vis: true, opacity: 1 },
    ];
    function migrate(d) {   // documents from before layers: {vis: {logo, draw}} and objects without a layer
        if (!d || d.layers) return d;
        let L = defaultLayers(), vis = d.vis || {};
        L[1].vis = vis.logo !== false; L[2].vis = vis.draw !== false;
        let out = Object.assign({}, d, { layers: L, draw: (d.draw || []).map((o) => (o.layer ? o : Object.assign({}, o, { layer: "over" }))) });
        delete out.vis;
        return out;
    }

    class Editor {
        constructor(o) {
            this.o = o;
            this.label = o.label || "Avatar";
            this.tool = "erase";
            this.opt = { eraseSize: 2, restoreSize: 2, wandTol: 40, wandContig: true, brushSize: 1.2, stroke: "#121216", fill: "#ffffff", strokeOn: true, fillOn: false, lineW: 1.2, shape: "rect", corners: 0, sides: 6, points: 5, inner: 0.5, pickInto: "stroke", grid: true, preview: "bg", backdrop: "checker", mode: "detail", selShape: "rect" };
            this.view = { k: 1, px: 0, py: 0 };
            this.undo = []; this.redo = [];
            this.sel = { ids: [], node: -1 };   // selected shapes; node: the selected point when one path is selected
            this.area = null;         // the selected area: a polygon in canvas units; edits stay inside it
            this.versions = [];       // saved versions: {id, name, time, doc (JSON), op, tr (the 40 px results)}
            this.active = "logo";     // the layer the eraser (and drawing) works on
            this.building = null;     // id of the path the pen is drawing
            this.hover = null;
            this.keys = new Set();
            this.pointers = new Map();
        }

        // ---------- set-up ----------
        async start() {
            if (!styled) { document.head.append(el("style", { textContent: CSS })); styled = true; }
            this.build();
            document.body.append(this.root);
            this.prevOverflow = document.documentElement.style.overflow;
            document.documentElement.style.overflow = "hidden";
            this.resize();
            try {
                let L = await this.o.layers();
                this.L = { w: L.w, h: L.h, kind: L.kind, bg: L.bg, layers: L.layers };
                this.w = L.w; this.h = L.h;
                this.src = {};
                await Promise.all(Object.entries(L.layers).map(async ([k, uri]) => {
                    let img = await loadImage(uri), c = canvas(this.w, this.h);
                    ctx2d(c).drawImage(img, 0, 0); this.src[k] = c;
                }));
            } catch (e) {
                this.busy.textContent = (e && e.message && e.message !== "layer" ? e.message : "The editor couldn't load this logo.") + " Close the editor and try again.";
                return;
            }
            this.busy.remove();
            this.orig = ctx2d(this.src.logo, { willReadFrequently: true }).getImageData(0, 0, this.w, this.h);
            this.layer = canvas(this.w, this.h); this.lctx = ctx2d(this.layer, { willReadFrequently: true });
            this.tmp = canvas(this.w, this.h);
            this.c320 = canvas(N, N); this.dl320 = canvas(N, N);
            this.palette = this.logoPalette();
            let p = this.o.preset || {};
            let saved = this.o.saved;
            let fresh = {      // the option as the server made it: what Start over goes back to
                src: this.src[p.src] ? p.src : (this.src.cut ? "cut" : "logo"),
                t: { s: p.s || 1, x: p.x || 0, y: p.y || 0 },
                bg: p.bg || "#00626e", border: p.border == null ? 1.1 : p.border, borderColour: "",
                frame: p.frame ? Object.assign({}, p.frame) : { type: "none" },
                adjust: Object.assign({ brightness: 1, contrast: 1, saturate: 1, colours: 0 }, p.adjust || {}),
                logoOps: [], draw: [], layers: defaultLayers(),
            };
            if (!p.s) fresh.t = this.fitT(fresh.src, "fit");
            this.preset = JSON.parse(JSON.stringify(fresh));
            this.versions = (this.o.saved && this.o.saved.versions) || [];
            if (saved && saved.doc) {
                this.doc = migrate(saved.doc); this.undo = (saved.undo || []).map(migrate); this.redo = (saved.redo || []).map(migrate);
                if (!this.src[this.doc.src]) this.doc = Object.assign({}, this.doc, { src: fresh.src });
                if (saved.active && this.doc.layers.some((l) => l.id === saved.active)) this.active = saved.active;
                for (let d of [this.doc, ...this.undo, ...this.redo]) for (let o of d.draw) uid = Math.max(uid, (+o.id || 0) + 1);
            } else this.doc = fresh;
            this.saveState("");
            this.renderVersions();
            this.base = this.doc;
            this.fitView();
            this.setTool(this.tool);
            this.sync();
            this.paint();
        }

        build() {
            let T = (s) => document.createTextNode(s);
            this.root = el("div", { className: "ae", role: "dialog", ariaLabel: "Avatar editor" });
            // header
            this.btnUndo = el("button", { className: "b", type: "button", title: "Undo (Ctrl+Z)", onclick: () => this.doUndo() }, "↶ Undo");
            this.btnRedo = el("button", { className: "b", type: "button", title: "Redo (Ctrl+Shift+Z)", onclick: () => this.doRedo() }, "↷ Redo");
            this.saveOut = el("span", { className: "ae-saved", role: "status" });
            this.openIn = el("input", { type: "file", accept: ".ftcavatar,.json,application/json", hidden: true });
            this.openIn.addEventListener("change", () => { let f = this.openIn.files[0]; this.openIn.value = ""; if (f) this.importFile(f); });
            this.root.append(el("header", { className: "ae-head" },
                el("h2", {}, "Edit avatar", el("small", {}, this.label)),
                this.saveOut,
                this.btnUndo, this.btnRedo,
                el("button", { className: "b", type: "button", title: "Save in this browser (Ctrl+S)", onclick: () => this.saveNow(true) }, "Save"),
                el("button", { className: "b", type: "button", title: "Open a project file (.ftcavatar)", onclick: () => this.openIn.click() }, "Open…"), this.openIn,
                el("button", { className: "b", type: "button", title: "Keep this state as a version you can go back to or compare (Ctrl+Shift+S)", onclick: () => this.saveVersion() }, "Save version"),
                el("button", { className: "b", type: "button", title: "The comparison sheet of this avatar and its versions, on screen", onclick: () => this.compareView() }, "Compare…"),
                el("button", { className: "b", type: "button", title: "Export (Ctrl+E)", onclick: () => this.exportDialog() }, "Export…"),
                el("button", { className: "b", type: "button", onclick: () => this.reset() }, "Start over"),
                el("button", { className: "b", type: "button", onclick: () => this.help() }, "Shortcuts"),
                el("button", { className: "b", type: "button", onclick: () => this.close(false) }, "Close"),
                el("button", { className: "b go", type: "button", onclick: () => this.close(true) }, "Use this avatar")));
            // tools
            let tools = el("nav", { className: "ae-tools", ariaLabel: "Tools" });
            this.toolBtns = {};
            for (let [id, key, label] of TOOLS) {
                let b = el("button", { className: "ae-tool", type: "button", title: `${label} (${key.toUpperCase()})`, onclick: () => this.setTool(id) }, svgIcon(ICON[id]), T(label), el("kbd", {}, key.toUpperCase()));
                b.setAttribute("aria-pressed", "false"); this.toolBtns[id] = b; tools.append(b);
            }
            this.root.append(tools);
            this.bar = el("div", { className: "ae-bar", role: "toolbar", ariaLabel: "Tool options" });
            this.root.append(this.bar);
            // stage
            this.cv = el("canvas"); this.vctx = ctx2d(this.cv);
            this.hintText = el("p", { ariaLive: "polite" });
            this.zoomOut = el("output");
            this.busy = el("div", { className: "ae-busy" }, "Loading your logo…");
            this.viewBox = el("div", { className: "ae-view", role: "group", ariaLabel: "Preview in the canvas" });
            this.stage = el("div", { className: "ae-stage" }, this.cv, this.busy, this.viewBox,
                el("div", { className: "ae-hint" }, this.hintText,
                    el("div", { className: "ae-zoom" },
                        el("button", { className: "b", type: "button", title: "Zoom out (−)", onclick: () => this.zoomBy(1 / 1.25) }, "−"), this.zoomOut,
                        el("button", { className: "b", type: "button", title: "Zoom in (+)", onclick: () => this.zoomBy(1.25) }, "+"),
                        el("button", { className: "b", type: "button", title: "Fit (0)", onclick: () => { this.fitView(); this.paint(); } }, "Fit"))));
            this.root.append(this.stage);
            // side panel
            this.side = el("aside", { className: "ae-side" });
            this.root.append(this.side);
            this.buildSide();
            // events
            this.cv.addEventListener("pointerdown", (e) => this.down(e));
            this.cv.addEventListener("pointermove", (e) => this.move(e));
            this.cv.addEventListener("pointerup", (e) => this.up(e));
            this.cv.addEventListener("pointercancel", (e) => this.up(e));
            this.cv.addEventListener("pointerleave", () => { this.hover = null; this.paint(); });
            this.cv.addEventListener("dblclick", () => { if (this.building) this.finishPath(); });
            this.cv.addEventListener("wheel", (e) => { e.preventDefault(); let f = Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0015)); this.zoomBy(f, e.offsetX, e.offsetY); }, { passive: false });
            this.cv.addEventListener("contextmenu", (e) => e.preventDefault());
            this.onKey = (e) => this.key(e, true); this.onKeyUp = (e) => this.key(e, false);
            document.addEventListener("keydown", this.onKey); document.addEventListener("keyup", this.onKeyUp);
            this.ro = new ResizeObserver(() => { let first = !this.cv.width; this.resize(); if (first || !this.doc) this.fitView(); this.paint(); });
            this.ro.observe(this.stage);
        }

        buildSide() {
            let s = this.side, sec = (title, ...kids) => el("section", { className: "ae-sec" }, el("h3", {}, ...[].concat(title)), ...kids);
            let range = (min, max, step, oninput, onchange) => { let r = el("input", { type: "range", min, max, step }); r.addEventListener("input", oninput); r.addEventListener("change", onchange || (() => this.commit())); return r; };
            // preview
            this.pvOp = el("img", { alt: "With background, zoomed in" }); this.pvTr = el("img", { alt: "Transparent, zoomed in", className: "ae-chk" });
            this.strip = el("div", { className: "ae-strip", role: "group", ariaLabel: "At 40 and 20 px on FIRST's backgrounds" });
            this.stripImgs = [];
            for (let [name, colour, light] of FIRST_BG) {
                let a = el("img", { width: 40, height: 40, alt: "" }), b = el("img", { width: 20, height: 20, alt: "" });
                this.stripImgs.push(a, b);
                this.strip.append(el("div", { className: light ? "light" : "", style: `background:${colour}` }, a, b, el("span", {}, name)));
            }
            this.warnBox = el("div");
            s.append(sec("Result, 40 × 40", el("div", { className: "ae-pv" }, el("figure", {}, this.pvOp, el("figcaption", {}, "with background")), el("figure", {}, this.pvTr, el("figcaption", {}, "transparent"))),
                this.strip, el("div", { className: "ae-ok" }, "Actual size, 40 and 20 px, as FTCScout and the event screens show it."), this.warnBox));
            // background
            this.bgSw = el("div", { className: "ae-sw" });
            this.bgPick = el("input", { type: "color", title: "Any colour" });
            this.bgPick.addEventListener("input", () => this.set({ bg: this.bgPick.value })); this.bgPick.addEventListener("change", () => this.commit());
            s.append(sec("Background", el("div", { className: "row" }, this.bgSw, this.bgPick),
                el("div", { className: "ae-ok" }, "Teal, navy and black give most logos good contrast. The eyedropper can pick one from the logo.")));
            // transparent version
            this.borderR = range(0, 3, 0.1, () => this.set({ border: +this.borderR.value }));
            this.borderOut = el("output");
            this.borderSame = el("input", { type: "checkbox" });
            this.borderPick = el("input", { type: "color" });
            this.borderSame.addEventListener("change", () => { this.set({ borderColour: this.borderSame.checked ? "" : this.borderPick.value }); this.commit(); });
            this.borderPick.addEventListener("input", () => { this.borderSame.checked = false; this.set({ borderColour: this.borderPick.value }); });
            this.borderPick.addEventListener("change", () => this.commit());
            this.edgeSel = el("select", { ariaLabel: "Edges" }, el("option", { value: "smooth" }, "Smooth outline (recommended)"), el("option", { value: "pixel" }, "Pixel edges: no half-transparent pixels"));
            this.edgeSel.addEventListener("change", () => { this.set({ edges: this.edgeSel.value }); this.commit(); });
            s.append(sec("Transparent version", el("label", {}, "Border", this.borderR, this.borderOut),
                el("label", {}, "Edges", this.edgeSel),
                el("div", { className: "row" }, el("label", {}, this.borderSame, "in the background colour"), this.borderPick),
                el("div", { className: "ae-ok" }, "A thin border keeps the cut-out readable on any page. 0 means no border.")));
            // logo
            this.srcSel = el("select", { ariaLabel: "Start from" });
            this.srcSel.addEventListener("change", () => { this.set({ src: this.srcSel.value }); this.commit(); });
            this.sizeR = range(10, 400, 1, () => this.setSize(+this.sizeR.value / 100));
            this.sizeOut = el("output");
            let adj = (key, label, min, max, step) => {
                let r = range(min, max, step, () => this.set({ adjust: Object.assign({}, this.doc.adjust, { [key]: +r.value }) }));
                let out = el("output"); this["adj_" + key] = [r, out];
                return el("label", {}, el("span", { style: "width:78px" }, label), r, out);
            };
            s.append(sec("Logo",
                el("label", { className: "col" }, "Start from", this.srcSel),
                el("label", {}, el("span", { style: "width:78px" }, "Size"), this.sizeR, this.sizeOut),
                el("div", { className: "row" },
                    el("button", { className: "b", type: "button", onclick: () => this.place("fit") }, "Fit"),
                    el("button", { className: "b", type: "button", onclick: () => this.place("fill") }, "Fill"),
                    el("button", { className: "b", type: "button", onclick: () => this.place("center") }, "Centre"),
                    el("button", { className: "b", type: "button", onclick: () => this.place("bottom") }, "Cut at bottom")),
                adj("brightness", "Brightness", 0.5, 1.5, 0.01), adj("contrast", "Contrast", 0.5, 2, 0.01), adj("saturate", "Saturation", 0, 2, 0.01),
                adj("colours", "Colours", 0, 32, 1),
                el("div", { className: "ae-ok" }, "Colours limits the logo to a few flat colours (0 = off); it helps soft or photo-like logos.")));
            // frame
            this.frameSel = el("select", { ariaLabel: "Frame" }, el("option", { value: "none" }, "None"), el("option", { value: "circle" }, "Circle badge with a ring"), el("option", { value: "rounded" }, "Rounded tile"));
            this.frameSel.addEventListener("change", () => {
                let type = this.frameSel.value, f = Object.assign({ r: 145, ring: "#121216", ringWidth: 1.1, fill: "#ffffff" }, this.doc.frame, { type });
                this.set({ frame: f }); this.commit();
            });
            this.ringPick = el("input", { type: "color", title: "Ring colour" }); this.fillPick = el("input", { type: "color", title: "Inside colour" });
            this.ringR = range(0, 3, 0.1, () => this.set({ frame: Object.assign({}, this.doc.frame, { ringWidth: +this.ringR.value }) }));
            this.radR = range(60, 158, 1, () => this.set({ frame: Object.assign({}, this.doc.frame, { r: +this.radR.value }) }));
            for (let [p, k] of [[this.ringPick, "ring"], [this.fillPick, "fill"]]) { p.addEventListener("input", () => this.set({ frame: Object.assign({}, this.doc.frame, { [k]: p.value }) })); p.addEventListener("change", () => this.commit()); }
            this.circleOpts = el("div", { className: "ae-sec", style: "padding:0;border:0" },
                el("label", {}, "Ring", this.ringPick, this.ringR), el("label", {}, "Inside", this.fillPick, "Size", this.radR));
            s.append(sec("Frame", this.frameSel, this.circleOpts, el("div", { className: "ae-ok" }, "A ring cut off by the square edge reads as a mistake: the circle badge keeps it whole.")));
            // colours
            this.strokePick = el("input", { type: "color" }); this.fillColPick = el("input", { type: "color" });
            this.strokeOn = el("input", { type: "checkbox" }); this.fillOn = el("input", { type: "checkbox" });
            this.lineR = range(0.2, 6, 0.1, () => { this.opt.lineW = +this.lineR.value; this.applyStyle(false); this.lineOut.textContent = this.opt.lineW.toFixed(1) + " px"; }, () => this.applyStyle(true));
            this.lineOut = el("output");
            this.strokePick.addEventListener("input", () => { this.opt.stroke = this.strokePick.value; this.applyStyle(false); });
            this.fillColPick.addEventListener("input", () => { this.opt.fill = this.fillColPick.value; this.applyStyle(false); });
            for (let x of [this.strokePick, this.fillColPick]) x.addEventListener("change", () => this.applyStyle(true));
            this.strokeOn.addEventListener("change", () => { this.opt.strokeOn = this.strokeOn.checked; this.applyStyle(true); });
            this.fillOn.addEventListener("change", () => { this.opt.fillOn = this.fillOn.checked; this.applyStyle(true); });
            this.paletteSw = el("div", { className: "ae-sw" });
            s.append(sec("Colours for drawing",
                el("div", { className: "ae-colours" },
                    el("label", {}, this.strokeOn, "Line"), el("div", { className: "row" }, this.strokePick, this.lineR, this.lineOut),
                    el("label", {}, this.fillOn, "Fill"), el("div", { className: "row" }, this.fillColPick)),
                el("div", { className: "ae-ok" }, "Click a swatch for the line colour, Shift-click for the fill. From your logo and FIRST's safe colours:"),
                this.paletteSw,
                el("div", { className: "ae-ok" }, "These apply to the brush, the pen, shapes, and the shape you have selected.")));
            // layers
            this.layList = el("div", { className: "ae-lay", role: "list", ariaLabel: "Layers, top first" });
            this.layName = el("input", { type: "text", ariaLabel: "Layer name", style: "flex:1;min-width:0;font:13px var(--sans,sans-serif);padding:4px 6px;border:1px solid var(--rule,#cfc8b8);background:var(--field,#fbf9f4);color:inherit;border-radius:2px" });
            this.layName.addEventListener("change", () => this.layerEdit(this.active, { name: this.layName.value.trim() || "Layer" }, true));
            this.layOp = range(0, 1, 0.01, () => this.layerEdit(this.active, { opacity: +this.layOp.value }));
            this.layOpOut = el("output");
            this.clearDraw = el("button", { className: "b", type: "button", onclick: () => this.clearLayer() }, "Clear layer");
            s.append(sec(["Layers", el("button", { className: "b", type: "button", title: "A new drawing layer above the selected one", onclick: () => this.addLayer() }, "+ New layer")],
                this.layList,
                el("div", { className: "row" }, this.layName, this.clearDraw),
                el("label", {}, "Opacity", this.layOp, this.layOpOut),
                el("div", { className: "ae-ok" }, "Click a layer to work on it: the eraser, brush, pen and shapes use it. Draw on Behind the logo to add a background shape without touching the logo.")));
            // view
            this.gridOn = el("input", { type: "checkbox", checked: true }); this.gridOn.addEventListener("change", () => { this.opt.grid = this.gridOn.checked; this.paint(); });
            this.modeSel = el("select", { ariaLabel: "View" }, el("option", { value: "detail" }, "Detail (draw at 8 × 8 per pixel)"), el("option", { value: "pixels" }, "Pixels (the 40 px result)"));
            this.modeSel.addEventListener("change", () => { this.opt.mode = this.modeSel.value; this.paint(); });
            s.append(sec("View",
                el("label", { className: "col" }, "Canvas", this.modeSel),
                el("label", {}, this.gridOn, "Pixel grid when zoomed in (G)"),
                el("div", { className: "ae-ok" }, "With background or transparent: the switch at the top left of the canvas (T).")));
            // versions
            this.verList = el("div", { className: "ae-vers" });
            s.append(sec(["Versions", el("span", { className: "row" },
                    el("button", { className: "b", type: "button", onclick: () => this.saveVersion() }, "Save version"),
                    el("button", { className: "b", type: "button", onclick: () => this.compareView() }, "Compare…"))],
                this.verList,
                el("div", { className: "ae-ok" }, "A version keeps the avatar as it is now. Go back to one, or compare them side by side. Saved with the project.")));
            // save and export
            this.dlOp = el("a", { className: "b", href: "#" }, "PNG"); this.dlTr = el("a", { className: "b", href: "#" }, "Transparent PNG");
            this.dlOp.addEventListener("click", (e) => this.download(e, "opaque")); this.dlTr.addEventListener("click", (e) => this.download(e, "transparent"));
            s.append(sec("Save and export",
                el("div", { className: "row" }, el("button", { className: "b", type: "button", onclick: () => this.saveNow(true) }, "Save in this browser"),
                    el("button", { className: "b", type: "button", onclick: () => this.downloadProject() }, "Download project file")),
                el("div", { className: "ae-ok" }, "Your work is saved in this browser as you go, and listed on the page under Saved in this browser. A project file (.ftcavatar) keeps everything, layers included: open it here or on the page, on any computer."),
                el("div", { className: "row" }, el("span", {}, "FIRST, 40 × 40:"), this.dlOp, this.dlTr),
                el("button", { className: "b go", type: "button", onclick: () => this.exportDialog() }, "Export other sizes and formats…")));
        }

        // ---------- document ----------
        set(patch, quiet) {
            this.doc = Object.assign({}, this.doc, patch);
            if (!quiet) { this.sync(); this.paint(); }
        }
        commit() {
            if (this.doc === this.base) return;
            this.undo.push(this.base); if (this.undo.length > 300) this.undo.shift();
            this.redo = []; this.base = this.doc; this.syncButtons();
            this.saveSoon();
        }
        doUndo() {
            if (this.building) this.finishPath();
            this.commit();
            if (!this.undo.length) return;
            this.redo.push(this.doc); this.doc = this.base = this.undo.pop();
            this.afterJump();
        }
        doRedo() {
            if (!this.redo.length) return;
            this.undo.push(this.doc); this.doc = this.base = this.redo.pop();
            this.afterJump();
        }
        afterJump() {   // after undo or redo: keep the selection only for shapes that still exist
            this.sel = { ids: this.sel.ids.filter((id) => this.objById(id)), node: -1 };
            if (!this.doc.layers.some((l) => l.id === this.active)) this.active = "logo";
            this.sync(); this.paint(); this.saveSoon();
        }
        reset() {
            this.commit();
            this.doc = JSON.parse(JSON.stringify(this.preset)); this.commit();
            this.sel = { ids: [], node: -1 }; this.area = null; this.building = null; this.active = "logo"; this.sync(); this.paint();
        }
        // ---------- layers ----------
        layerOf(id) { return this.doc.layers.find((l) => l.id === id); }
        renderLayers() {
            let L = this.doc.layers, list = this.layList; list.textContent = "";
            if (!this.layerOf(this.active)) this.active = "logo";
            for (let i = L.length - 1; i >= 0; i--) {
                let l = L[i], n = this.doc.draw.filter((o) => o.layer === l.id && o.k !== "area").length;
                let vis = el("input", { type: "checkbox", checked: l.vis, title: "Show this layer", ariaLabel: `Show ${l.name}` });
                vis.addEventListener("change", () => this.layerEdit(l.id, { vis: vis.checked }, true));
                let nm = el("button", { type: "button", className: "nm", title: "Work on this layer", onclick: () => { this.active = l.id; this.sync(); this.paint(); } },
                    l.name + " ", el("small", {}, l.kind === "logo" ? "your logo" : n ? `${n} shape${n === 1 ? "" : "s"}` : "empty"));
                nm.setAttribute("aria-pressed", String(l.id === this.active));
                list.append(vis, nm,
                    el("button", { type: "button", className: "ic", title: "Move up", ariaLabel: `Move ${l.name} up`, disabled: i === L.length - 1, onclick: () => this.moveLayer(l.id, 1) }, "▲"),
                    el("button", { type: "button", className: "ic", title: "Move down", ariaLabel: `Move ${l.name} down`, disabled: i === 0, onclick: () => this.moveLayer(l.id, -1) }, "▼"),
                    el("button", { type: "button", className: "ic", title: l.kind === "logo" ? "The logo layer stays" : "Delete layer", ariaLabel: `Delete ${l.name}`, disabled: l.kind === "logo", onclick: () => this.deleteLayer(l.id) }, "✕"));
            }
            let a = this.layerOf(this.active);
            if (document.activeElement !== this.layName) this.layName.value = a.name;
            this.layOp.value = a.opacity; this.layOpOut.textContent = Math.round(a.opacity * 100) + "%";
            this.clearDraw.textContent = a.kind === "logo" ? "Undo all erasing" : "Clear layer";
            this.clearDraw.disabled = a.kind === "logo" ? !this.doc.logoOps.length : !this.doc.draw.some((o) => o.layer === a.id);
        }
        layerEdit(id, patch, commit) {
            this.set({ layers: this.doc.layers.map((l) => (l.id === id ? Object.assign({}, l, patch) : l)) });
            if (commit) this.commit();
        }
        addLayer() {
            let L = this.doc.layers.slice(), i = L.findIndex((l) => l.id === this.active), id = "l" + uid++;
            let n = L.filter((l) => l.kind === "draw").length + 1;
            L.splice(i + 1, 0, { id, name: `Layer ${n}`, kind: "draw", vis: true, opacity: 1 });
            this.active = id; this.set({ layers: L }); this.commit();
        }
        moveLayer(id, dir) {
            let L = this.doc.layers.slice(), i = L.findIndex((l) => l.id === id), j = i + dir;
            if (j < 0 || j >= L.length) return;
            [L[i], L[j]] = [L[j], L[i]]; this.set({ layers: L }); this.commit();
        }
        deleteLayer(id) {
            let l = this.layerOf(id); if (!l || l.kind === "logo") return;
            this.set({ layers: this.doc.layers.filter((x) => x.id !== id), draw: this.doc.draw.filter((o) => o.layer !== id) }, true);
            if (this.active === id) this.active = "logo";
            this.sel = { ids: [], node: -1 }; this.commit(); this.sync(); this.paint();
        }
        clearLayer() {
            let a = this.layerOf(this.active);
            if (a.kind === "logo") this.set({ logoOps: [] }, true);
            else this.set({ draw: this.doc.draw.filter((o) => o.layer !== a.id) }, true);
            this.sel = { ids: [], node: -1 }; this.commit(); this.sync(); this.paint();
        }
        drawLayer() {   // where the brush, pen and shapes draw: the selected layer, or the drawing layer above the logo
            let a = this.layerOf(this.active);
            if (a && a.kind === "draw") return a.id;
            let L = this.doc.layers, i = L.findIndex((l) => l.kind === "logo"), up = L.slice(i + 1).find((l) => l.kind === "draw") || L.find((l) => l.kind === "draw");
            if (!up) { this.addLayer(); return this.active; }
            this.active = up.id; this.renderLayers();
            this.flash(`Drawing on the layer “${up.name}”. Choose another one under Layers, right.`);
            return up.id;
        }
        renderView() {
            let v = this.viewBox; v.textContent = "";
            let seg = el("span", { className: "seg" });
            for (let [k, label] of [["bg", "With background"], ["transparent", "Transparent"]]) {
                let b = el("button", { type: "button", className: "b" + (this.opt.preview === k ? " on" : ""), title: "T switches", onclick: () => { this.opt.preview = k; this.renderView(); this.paint(); } }, label);
                b.setAttribute("aria-pressed", String(this.opt.preview === k)); seg.append(b);
            }
            v.append(seg);
            if (this.opt.preview === "transparent") {
                let bd = el("span", { className: "bd", role: "group", ariaLabel: "Behind the transparent avatar" });
                for (let [name, colour] of [["checkerboard", null], ...FIRST_BG]) {
                    let b = el("button", { type: "button", title: name, ariaLabel: name, className: colour ? "" : "ae-chk", style: colour ? `background:${colour}` : "", onclick: () => { this.opt.backdrop = colour || "checker"; this.renderView(); this.paint(); } });
                    b.setAttribute("aria-pressed", String((colour || "checker") === this.opt.backdrop)); bd.append(b);
                }
                v.append(bd, el("span", {}, "border included"));
            }
        }

        syncButtons() { this.btnUndo.disabled = !this.undo.length && this.doc === this.base; this.btnRedo.disabled = !this.redo.length; }

        sync() {   // the controls follow the document (after undo, presets, eyedropper)
            if (!this.doc) return;
            let d = this.doc;
            this.bgSw.textContent = "";
            let sw = [...SUGGEST.map(([n, c]) => [n, c])];
            if (this.preset && !sw.some(([, c]) => c === this.preset.bg)) sw.unshift(["the logo's background", this.preset.bg]);
            for (let [name, colour] of sw) {
                let b = el("button", { type: "button", title: name, style: `background:${colour}`, onclick: () => { this.set({ bg: colour }); this.commit(); } });
                b.setAttribute("aria-pressed", String(colour.toLowerCase() === d.bg.toLowerCase())); this.bgSw.append(b);
            }
            this.bgPick.value = d.bg;
            this.borderR.value = d.border; this.borderOut.textContent = d.border ? d.border.toFixed(1) + " px" : "none";
            this.borderSame.checked = !d.borderColour; this.borderPick.value = d.borderColour || d.bg;
            this.edgeSel.value = d.edges === "pixel" || d.edges === "crisp" ? "pixel" : "smooth";
            if (this.srcSel.options.length !== Object.keys(this.src || {}).length) {
                this.srcSel.textContent = "";
                for (let k of Object.keys(SOURCES)) if (this.src && this.src[k]) this.srcSel.append(el("option", { value: k }, SOURCES[k]));
            }
            this.srcSel.value = d.src;
            let fit = this.fitT(d.src, "fit").s;
            this.sizeR.value = Math.round((d.t.s / fit) * 100); this.sizeOut.textContent = Math.round((d.t.s / fit) * 100) + "%";
            for (let k of ["brightness", "contrast", "saturate", "colours"]) {
                let [r, out] = this["adj_" + k]; r.value = d.adjust[k];
                out.textContent = k === "colours" ? (d.adjust[k] ? d.adjust[k] : "off") : Math.round(d.adjust[k] * 100) + "%";
            }
            let f = d.frame || { type: "none" };
            this.frameSel.value = f.type; this.circleOpts.hidden = f.type !== "circle";
            if (f.type === "circle") { this.ringPick.value = f.ring; this.fillPick.value = f.fill; this.ringR.value = f.ringWidth; this.radR.value = f.r; }
            this.renderLayers();
            this.renderView();
            let o = this.selObj();
            if (o && o.k === "path") { this.opt.strokeOn = !!o.stroke; this.opt.fillOn = !!o.fill; if (o.stroke) this.opt.stroke = o.stroke; if (o.fill) this.opt.fill = o.fill; this.opt.lineW = o.w / S; }
            this.strokePick.value = this.opt.stroke; this.fillColPick.value = this.opt.fill;
            this.strokeOn.checked = this.opt.strokeOn; this.fillOn.checked = this.opt.fillOn;
            this.lineR.value = this.opt.lineW; this.lineOut.textContent = this.opt.lineW.toFixed(1) + " px";
            this.paletteSw.textContent = "";
            for (let c of [...(this.palette || []), "#121216", "#ffffff", "#00626e", "#16264a", "#ed1c24", "#0066b3", "#f5ecd6"]) {
                this.paletteSw.append(el("button", { type: "button", title: c + " (Shift: fill)", style: `background:${c}`, onclick: (e) => {
                    if (e.shiftKey) { this.opt.fill = c; this.opt.fillOn = true; } else { this.opt.stroke = c; this.opt.strokeOn = true; }
                    this.applyStyle(true); this.sync();
                } }));
            }
            this.syncButtons();
            this.renderBar();
        }

        // ---------- the logo layer: the chosen source with the erase / restore / wand operations ----------
        buildLayer() {
            let d = this.doc, ops = d.logoOps, start = 0;
            if (this.layerSrc === d.src && this.layerOps && ops.length >= this.layerOps.length && this.layerOps.every((op, i) => op === ops[i])) start = this.layerOps.length;
            else { this.lctx.globalCompositeOperation = "source-over"; this.lctx.clearRect(0, 0, this.w, this.h); this.lctx.drawImage(this.src[d.src], 0, 0); }
            for (let i = start; i < ops.length; i++) this.applyOp(ops[i], 0);
            if (start < ops.length || this.layerSrc !== d.src || this.layerOps !== ops) this.layerVer = (this.layerVer || 0) + 1;
            this.layerSrc = d.src; this.layerOps = ops;
        }
        applyOp(op, from) {   // from: the first point to draw (strokes are drawn as they grow)
            let c = this.lctx;
            if (op.k === "wand") return this.applyWand(op);
            if (op.k === "area") {
                c.save(); c.globalCompositeOperation = "destination-out"; c.fillStyle = "#000";
                c.fill(polyPath(op.poly, op.invert ? [-1e5, -1e5, 2e5, 2e5] : null), "evenodd"); c.restore(); return;
            }
            if (op.clip) { c.save(); c.clip(polyPath(op.clip)); }
            this.strokeOp(op, from);
            if (op.clip) c.restore();
        }
        strokeOp(op, from) {
            let c = this.lctx;
            let pts = op.pts.slice(Math.max(0, from - 1));
            let stroke = (ctx) => {
                ctx.lineCap = ctx.lineJoin = "round"; ctx.lineWidth = op.r * 2; ctx.strokeStyle = ctx.fillStyle = "#fff";
                ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
                if (pts.length === 1) { ctx.arc(pts[0][0], pts[0][1], op.r, 0, 7); ctx.fill(); return; }
                for (let p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
                ctx.stroke();
            };
            if (op.k === "erase") { c.save(); c.globalCompositeOperation = "destination-out"; stroke(c); c.restore(); return; }
            let t = ctx2d(this.tmp);       // restore: the original pixels under the stroke
            t.globalCompositeOperation = "source-over"; t.clearRect(0, 0, this.w, this.h); stroke(t);
            t.globalCompositeOperation = "source-in"; t.drawImage(this.src.logo, 0, 0);
            c.save(); c.globalCompositeOperation = "source-over"; c.drawImage(this.tmp, 0, 0); c.restore();
        }
        wandMask(op) {   // the area the wand picks: 1 inside, 0 outside (cached on the operation)
            if (op._mask) return op._mask;
            let { w, h } = this, D = this.orig.data, m = new Uint8Array(w * h);
            let i0 = (op.y * w + op.x) * 4, r0 = D[i0], g0 = D[i0 + 1], b0 = D[i0 + 2], t2 = op.tol * op.tol;
            let near = (i) => { let dr = D[i * 4] - r0, dg = D[i * 4 + 1] - g0, db = D[i * 4 + 2] - b0; return dr * dr + dg * dg + db * db <= t2; };
            if (!op.contig) { for (let i = 0; i < w * h; i++) if (near(i)) m[i] = 1; }
            else {
                let stack = new Int32Array(w * h), sp = 0; stack[sp++] = op.y * w + op.x; m[op.y * w + op.x] = 1;
                while (sp) {
                    let i = stack[--sp], x = i % w, y = (i - x) / w;
                    if (x > 0 && !m[i - 1] && near(i - 1)) { m[i - 1] = 1; stack[sp++] = i - 1; }
                    if (x < w - 1 && !m[i + 1] && near(i + 1)) { m[i + 1] = 1; stack[sp++] = i + 1; }
                    if (y > 0 && !m[i - w] && near(i - w)) { m[i - w] = 1; stack[sp++] = i - w; }
                    if (y < h - 1 && !m[i + w] && near(i + w)) { m[i + w] = 1; stack[sp++] = i + w; }
                }
            }
            if (op.clip) {      // only inside the selected area
                let t = ctx2d(this.tmp, { willReadFrequently: true }); t.globalCompositeOperation = "source-over"; t.clearRect(0, 0, w, h);
                t.fillStyle = "#000"; t.fill(polyPath(op.clip));
                let A = t.getImageData(0, 0, w, h).data, ok = new Uint8Array(w * h);
                for (let i = 0; i < w * h; i++) { ok[i] = A[i * 4 + 3] >= 128 ? 1 : 0; if (!ok[i]) m[i] = 0; }
                op._clipOk = ok;
            }
            op._mask = m; op._seed = [r0, g0, b0];
            return m;
        }
        ringOf(m, n) {   // distance (1..n) of each pixel from area m, 0 = farther (or inside)
            let { w, h } = this, d = new Uint8Array(w * h), q = [];
            for (let i = 0; i < w * h; i++) if (m[i]) q.push(i);
            for (let k = 1; k <= n && q.length; k++) {
                let next = [];
                for (let i of q) {
                    let x = i % w;
                    for (let j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w, x > 0 ? i - w - 1 : -1, x < w - 1 ? i - w + 1 : -1, x > 0 ? i + w - 1 : -1, x < w - 1 ? i + w + 1 : -1]) {
                        if (j < 0 || j >= w * h || m[j] || d[j]) continue;
                        d[j] = k; next.push(j);
                    }
                }
                q = next;
            }
            return d;
        }
        applyWand(op) {
            let m = this.wandMask(op), { w, h } = this;
            if (op.mode === "erase") {
                let img = this.lctx.getImageData(0, 0, w, h), D = img.data, [r0, g0, b0] = op._seed.map((v) => v / 255);
                let ring = this.ringOf(m, 3);
                let clipOk = (i) => !op._clipOk || op._clipOk[i];
                for (let i = 0; i < w * h; i++) {
                    if (m[i]) { D[i * 4] = D[i * 4 + 1] = D[i * 4 + 2] = D[i * 4 + 3] = 0; continue; }
                    if (!ring[i] || ring[i] > 2 || !D[i * 4 + 3] || !clipOk(i)) continue;
                    // next to the cut: take the picked colour out of the pixel (colour to alpha), so no fringe is left
                    let c = [D[i * 4] / 255, D[i * 4 + 1] / 255, D[i * 4 + 2] / 255], b = [r0, g0, b0], ac = 0;
                    for (let k = 0; k < 3; k++) ac = Math.max(ac, c[k] > b[k] ? (c[k] - b[k]) / Math.max(1 - b[k], 1e-6) : c[k] < b[k] ? (b[k] - c[k]) / Math.max(b[k], 1e-6) : 0);
                    ac = clamp(ac, 0, 1);
                    if (ac < 1e-3) { D[i * 4 + 3] = 0; continue; }
                    for (let k = 0; k < 3; k++) D[i * 4 + k] = clamp(((c[k] - b[k]) / ac + b[k]) * 255, 0, 255);
                    D[i * 4 + 3] = D[i * 4 + 3] * ac;
                }
                // slivers: strands at most 2 px wide along the cut go (an opening, only near the cut)
                let solid = new Uint8Array(w * h);
                for (let i = 0; i < w * h; i++) solid[i] = D[i * 4 + 3] > 127 ? 1 : 0;
                let core = new Uint8Array(w * h);
                for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
                    let i = y * w + x;
                    if (solid[i] && solid[i - 1] && solid[i + 1] && solid[i - w] && solid[i + w] && solid[i - w - 1] && solid[i - w + 1] && solid[i + w - 1] && solid[i + w + 1]) core[i] = 1;
                }
                for (let i = 0; i < w * h; i++) {
                    if (!ring[i] || !D[i * 4 + 3]) continue;
                    let x = i % w, kept = core[i] || (x > 0 && core[i - 1]) || (x < w - 1 && core[i + 1]) || (i >= w && core[i - w]) || (i + w < w * h && core[i + w])
                        || (x > 0 && i >= w && core[i - w - 1]) || (x < w - 1 && i >= w && core[i - w + 1]) || (x > 0 && i + w < w * h && core[i + w - 1]) || (x < w - 1 && i + w < w * h && core[i + w + 1]);
                    if (!kept && clipOk(i)) D[i * 4] = D[i * 4 + 1] = D[i * 4 + 2] = D[i * 4 + 3] = 0;
                }
                this.lctx.putImageData(img, 0, 0);
            } else {
                let ring = this.ringOf(m, 1), t = ctx2d(this.tmp, { willReadFrequently: true }), img = new ImageData(w, h), D = img.data, O = this.orig.data;
                for (let i = 0; i < w * h; i++) if (m[i] || ring[i]) { D[i * 4] = O[i * 4]; D[i * 4 + 1] = O[i * 4 + 1]; D[i * 4 + 2] = O[i * 4 + 2]; D[i * 4 + 3] = O[i * 4 + 3]; }
                t.putImageData(img, 0, 0);
                this.lctx.save(); this.lctx.globalCompositeOperation = "source-over"; this.lctx.drawImage(this.tmp, 0, 0); this.lctx.restore();
            }
        }
        adjusted() {   // the logo layer with brightness, contrast, saturation and the colour limit
            this.buildLayer();
            let a = this.doc.adjust, key = this.layerVer + ":" + a.brightness + ":" + a.contrast + ":" + a.saturate + ":" + a.colours;
            if (a.brightness === 1 && a.contrast === 1 && a.saturate === 1 && !a.colours) return this.layer;
            if (this.adjKey === key) return this.adj;
            if (!this.adj) this.adj = canvas(this.w, this.h);
            let img = this.lctx.getImageData(0, 0, this.w, this.h), D = img.data, n = this.w * this.h;
            for (let i = 0; i < n; i++) {
                if (!D[i * 4 + 3]) continue;
                let r = D[i * 4] * a.brightness, g = D[i * 4 + 1] * a.brightness, b = D[i * 4 + 2] * a.brightness;
                r = (r - 128) * a.contrast + 128; g = (g - 128) * a.contrast + 128; b = (b - 128) * a.contrast + 128;
                let l = 0.299 * r + 0.587 * g + 0.114 * b;
                D[i * 4] = clamp(l + (r - l) * a.saturate, 0, 255); D[i * 4 + 1] = clamp(l + (g - l) * a.saturate, 0, 255); D[i * 4 + 2] = clamp(l + (b - l) * a.saturate, 0, 255);
            }
            if (a.colours >= 2) {
                let sample = [], step = Math.max(1, Math.floor(n / 30000));
                for (let i = 0; i < n; i += step) if (D[i * 4 + 3] > 127) sample.push([D[i * 4], D[i * 4 + 1], D[i * 4 + 2]]);
                let pal = sample.length ? medianCut(sample, a.colours) : [];
                for (let i = 0; i < n && pal.length; i++) {
                    if (!D[i * 4 + 3]) continue;
                    let best = 0, bd = 1e9;
                    for (let k = 0; k < pal.length; k++) { let p = pal[k], dr = D[i * 4] - p[0], dg = D[i * 4 + 1] - p[1], db = D[i * 4 + 2] - p[2], dd = dr * dr + dg * dg + db * db; if (dd < bd) { bd = dd; best = k; } }
                    D[i * 4] = pal[best][0]; D[i * 4 + 1] = pal[best][1]; D[i * 4 + 2] = pal[best][2];
                }
            }
            ctx2d(this.adj).putImageData(img, 0, 0);
            this.adjKey = key;
            return this.adj;
        }
        logoPalette() {   // the logo's main colours, for the swatches
            let src = this.src.cut || this.src.logo, c = ctx2d(src, { willReadFrequently: true }).getImageData(0, 0, this.w, this.h).data, px = [];
            let step = Math.max(1, Math.floor((this.w * this.h) / 20000));
            for (let i = 0; i < this.w * this.h; i += step) if (c[i * 4 + 3] > 200) px.push([c[i * 4], c[i * 4 + 1], c[i * 4 + 2]]);
            if (!px.length) return [];
            let out = [];
            for (let p of medianCut(px, 10).map((p) => rgb2hex(...p))) {
                let [r, g, b] = hex2rgb(p);
                if (!out.some((q) => { let [x, y, z] = hex2rgb(q); return Math.hypot(r - x, g - y, b - z) < 28; })) out.push(p);
            }
            return out.slice(0, 7);
        }
        fitT(srcKey, how) {
            let key = "bb:" + srcKey;
            if (!this[key]) {
                let d = ctx2d(this.src[srcKey], { willReadFrequently: true }).getImageData(0, 0, this.w, this.h).data, x0 = this.w, y0 = this.h, x1 = 0, y1 = 0;
                for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (d[(y * this.w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
                this[key] = x1 >= x0 ? [x0, y0, x1 + 1, y1 + 1] : [0, 0, this.w, this.h];
            }
            let [x0, y0, x1, y1] = this[key], bw = x1 - x0, bh = y1 - y0, a = S, A = N - 2 * S;
            let s = how === "fill" ? Math.max(A / bw, A / bh) : Math.min(A / bw, A / bh);
            return { s, x: a + (A - bw * s) / 2 - x0 * s, y: a + (A - bh * s) / 2 - y0 * s, box: this[key] };
        }
        place(how) {
            let d = this.doc, t;
            if (how === "fit" || how === "fill") t = this.fitT(d.src, how);
            else {
                let f = this.fitT(d.src, "fit"), [x0, y0, x1, y1] = f.box, s = d.t.s;
                t = { s, x: N / 2 - ((x0 + x1) / 2) * s, y: N / 2 - ((y0 + y1) / 2) * s };
                // cut at the bottom: the top 1 px from the edge and the rest running off the bottom,
                // or, if it all fits, standing on the bottom edge (never a gap under it)
                if (how === "bottom") t.y = (y1 - y0) * s > N - S ? S - y0 * s : N - y1 * s;
            }
            this.set({ t: { s: t.s, x: t.x, y: t.y } }); this.commit();
        }
        setSize(k) {   // scale around the middle of the canvas
            let d = this.doc, fit = this.fitT(d.src, "fit").s, s = fit * k, c = N / 2;
            let x = c - ((c - d.t.x) / d.t.s) * s, y = c - ((c - d.t.y) / d.t.s) * s;
            this.set({ t: { s, x, y } });
        }

        // ---------- drawing the scene ----------
        scene(ctx, M, opaque, dl) {
            let d = this.doc, f = d.frame || { type: "none" }, set = () => ctx.setTransform(M.k, 0, 0, M.k, M.ox, M.oy);
            ctx.save(); set();
            if (opaque) { ctx.fillStyle = d.bg; ctx.fillRect(0, 0, N, N); }
            ctx.beginPath();
            if (f.type === "circle") {
                let rw = f.ringWidth * S;
                ctx.fillStyle = f.ring; ctx.beginPath(); ctx.arc(N / 2, N / 2, f.r + rw, 0, 7); ctx.fill();
                ctx.fillStyle = f.fill; ctx.beginPath(); ctx.arc(N / 2, N / 2, f.r, 0, 7); ctx.fill();
                ctx.beginPath(); ctx.arc(N / 2, N / 2, f.r, 0, 7);
            } else if (f.type === "rounded" && !opaque) {
                ctx.roundRect(0, 0, N, N, 4 * S); ctx.fillStyle = d.bg; ctx.fill();
            } else ctx.rect(0, 0, N, N);
            ctx.clip();
            for (let l of d.layers) {      // bottom to top
                if (!l.vis || !l.opacity) continue;
                ctx.globalAlpha = l.opacity;
                if (l.kind === "logo") {
                    let L = this.adjusted();
                    ctx.setTransform(M.k * d.t.s, 0, 0, M.k * d.t.s, M.ox + M.k * d.t.x, M.oy + M.k * d.t.y);
                    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
                    ctx.drawImage(L, 0, 0);
                } else {
                    let objs = d.draw.filter((o) => o.layer === l.id);
                    if (!objs.length) continue;
                    let x = ctx2d(dl); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, dl.width, dl.height);
                    x.setTransform(M.k, 0, 0, M.k, M.ox, M.oy);
                    this.renderDraw(x, objs);
                    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(dl, 0, 0);
                }
            }
            ctx.globalAlpha = 1;
            ctx.restore();
        }
        renderDraw(x, objs) {
            for (let o of objs) {
                if (o.clip) { x.save(); x.clip(polyPath(o.clip)); }
                x.lineCap = "round"; x.lineJoin = "round";
                if (o.k === "area") {       // erase inside (or outside) a selected area
                    x.globalCompositeOperation = "destination-out"; x.fillStyle = "#000";
                    x.fill(polyPath(o.poly, o.invert ? [-1e4, -1e4, 2e4, 2e4] : null), "evenodd");
                } else if (o.k === "stroke") {
                    x.globalCompositeOperation = o.mode === "erase" ? "destination-out" : "source-over";
                    x.strokeStyle = o.colour || "#000"; x.lineWidth = o.w; x.stroke(pathOf(o));
                } else {
                    let p = pathOf(o);
                    x.globalCompositeOperation = "source-over";
                    if (o.fill && o.closed) { x.fillStyle = o.fill; x.fill(p); }
                    if (o.stroke) { x.strokeStyle = o.stroke; x.lineWidth = o.w; x.stroke(p); }
                }
                if (o.clip) x.restore();
            }
            x.globalCompositeOperation = "source-over";
        }
        result() {   // {op, tr, content}: 40 x 40 ImageData of the opaque and transparent versions
            let x = ctx2d(this.c320, { willReadFrequently: true });
            x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, N, N);
            this.scene(x, { k: 1, ox: 0, oy: 0 }, false, this.dl320);
            let D = x.getImageData(0, 0, N, N).data, P = new Float32Array(N * N * 4), A = new Float32Array(N * N);
            for (let i = 0; i < N * N; i++) { let a = D[i * 4 + 3] / 255; A[i] = a; P[i * 4] = (D[i * 4] / 255) * a; P[i * 4 + 1] = (D[i * 4 + 1] / 255) * a; P[i * 4 + 2] = (D[i * 4 + 2] / 255) * a; P[i * 4 + 3] = a; }
            let content = reduce(P), [br, bgc, bb] = hex2rgb(this.doc.bg).map((v) => v / 255);
            let O = new Float32Array(content.length);
            for (let i = 0; i < 1600; i++) { let a = content[i * 4 + 3]; O[i * 4] = content[i * 4] + br * (1 - a); O[i * 4 + 1] = content[i * 4 + 1] + bgc * (1 - a); O[i * 4 + 2] = content[i * 4 + 2] + bb * (1 - a); O[i * 4 + 3] = 1; }
            let R = Math.round(this.doc.border * S), T = content;
            if (!this.borderCv) this.borderCv = canvas(N, N);
            let bctx = ctx2d(this.borderCv); bctx.clearRect(0, 0, N, N);
            if (R > 0) {
                let Dm = roundBorder(A, this.doc.border * S, N), bc = hex2rgb(this.doc.borderColour || this.doc.bg), [cr, cg, cb] = bc.map((v) => v / 255), Q = new Float32Array(P.length);
                let B = new ImageData(N, N);       // the border alone, drawn under the scene in the transparent view
                for (let i = 0; i < N * N; i++) {
                    let a = P[i * 4 + 3], m = Dm[i] * (1 - a); Q[i * 4] = P[i * 4] + cr * m; Q[i * 4 + 1] = P[i * 4 + 1] + cg * m; Q[i * 4 + 2] = P[i * 4 + 2] + cb * m; Q[i * 4 + 3] = a + m;
                    B.data[i * 4] = bc[0]; B.data[i * 4 + 1] = bc[1]; B.data[i * 4 + 2] = bc[2]; B.data[i * 4 + 3] = Dm[i] * 255;
                }
                bctx.putImageData(B, 0, 0);
                T = reduce(Q);
            }
            let pixel = this.doc.edges === "pixel" || this.doc.edges === "crisp";
            return { op: toImageData(O, 0), tr: pixel ? toImageData(T, 20, true) : tidyEdges(toImageData(T, 20)), content: toImageData(content, 20) };
        }
        uri(imgData) { let c = canvas(40, 40); ctx2d(c).putImageData(imgData, 0, 0); return c.toDataURL("image/png"); }
        warnings(r, opUri, trUri) {
            let w = [], bytes = (u) => Math.floor(((u.length - u.indexOf(",") - 1) * 3) / 4);
            for (let [nm, u] of [["opaque", opUri], ["transparent", trUri]]) if (bytes(u) > 20000) w.push(`The ${nm} PNG is ${bytes(u)} bytes; FIRST allows 20 kB.`);
            let D = r.op.data, keyed = 0;
            for (let i = 0; i < 1600; i++) { let R = D[i * 4], G = D[i * 4 + 1], B = D[i * 4 + 2]; if ((G > 200 && R < 120 && B < 120) || (R > 200 && B > 200 && G < 80)) keyed++; }
            if (keyed) w.push(`${keyed} pixels are close to lime or magenta, which video overlays can key out.`);
            let T = r.tr.data, half = 0, A = (x, y) => (x < 0 || y < 0 || x > 39 || y > 39 ? 0 : T[(y * 40 + x) * 4 + 3]);
            for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) { let a = A(x, y); if (a > 0 && a < 255 && A(x - 1, y) >= 128 && A(x + 1, y) >= 128 && A(x, y - 1) >= 128 && A(x, y + 1) >= 128) half++; }
            if (half) w.push(`The transparent version has ${half} half-transparent pixels inside it, which can look muddy.`);
            let C = r.content.data, x0 = 40, y0 = 40, x1 = -1, y1 = -1;
            for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) if (C[(y * 40 + x) * 4 + 3] > 127) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
            if (x1 < 0) w.push("The avatar is empty.");
            else {
                let bw = x1 - x0 + 1, bh = y1 - y0 + 1, m = [x0, y0, 39 - x1, 39 - y1], mx = Math.max(...m);
                if (Math.max(bw, bh) < 34) w.push(`The logo only uses ${bw} × ${bh} px of 40 × 40. Make it bigger with Move logo or the size slider.`);
                else if (mx >= 5) w.push(`There's an empty band of ${mx} px on the ${["left", "top", "right", "bottom"][m.indexOf(mx)]}.`);
            }
            return w;
        }
        updatePreview() {
            let r = this.result(), op = this.uri(r.op), tr = this.uri(r.tr);
            this.pvOp.src = op; this.pvTr.src = tr;
            for (let im of this.stripImgs) im.src = tr;
            let w = this.warnings(r, op, tr);
            this.warnBox.textContent = "";
            this.warnBox.append(w.length ? el("ul", { className: "ae-warn" }, ...w.map((x) => el("li", {}, x))) : el("p", { className: "ae-ok" }, "Follows FIRST's rules: 40 × 40 PNG under 20 kB, no lime or magenta, fills the square."));
            this.last = { r, op, tr, warnings: w };
            return this.last;
        }

        // ---------- the view ----------
        resize() {
            let r = this.stage.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
            this.cssW = r.width; this.cssH = r.height;
            this.cv.width = Math.max(1, Math.round(r.width * dpr)); this.cv.height = Math.max(1, Math.round(r.height * dpr));
            this.dlView = canvas(this.cv.width, this.cv.height);
        }
        fitView() {
            let k = Math.max(0.2, Math.min(this.cssW, this.cssH - 60) / (N * 1.12));
            this.view = { k, px: (this.cssW - N * k) / 2, py: Math.max(8, (this.cssH - 50 - N * k) / 2) };
        }
        zoomBy(f, sx, sy) {
            if (sx == null) { sx = this.cssW / 2; sy = this.cssH / 2; }
            let v = this.view, k = clamp(v.k * f, 0.2, 40), cx = (sx - v.px) / v.k, cy = (sy - v.py) / v.k;
            this.view = { k, px: sx - cx * k, py: sy - cy * k }; this.paint();
        }
        paint() {
            if (this.raf) return;
            this.raf = requestAnimationFrame(() => {
                this.raf = 0;
                if (!this.doc) return;
                this.draw();
                clearTimeout(this.pvTimer);
                this.pvTimer = setTimeout(() => {
                    this.updatePreview();
                    // the transparent view's border and the pixel view come from that result: redraw with it,
                    // so no old border is left behind (it looked like a grey shadow after moving the logo)
                    if (this.opt.preview === "transparent" || this.opt.mode === "pixels") this.draw();
                }, this.dragging ? 160 : 30);
            });
        }
        draw() {
            let c = this.vctx, dpr = window.devicePixelRatio || 1, v = this.view, d = this.doc;
            let M = { k: v.k * dpr, ox: v.px * dpr, oy: v.py * dpr };
            c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.cv.width, this.cv.height);
            // the logo outside the square, faint, so moving it shows what is cut off
            let logoL = d.layers.find((l) => l.kind === "logo"), transparent = this.opt.preview === "transparent";
            if (logoL.vis) {
                c.save(); c.globalAlpha = 0.22;
                c.setTransform(M.k * d.t.s, 0, 0, M.k * d.t.s, M.ox + M.k * d.t.x, M.oy + M.k * d.t.y);
                c.drawImage(this.adjusted(), 0, 0); c.restore();
            }
            c.setTransform(M.k, 0, 0, M.k, M.ox, M.oy);
            if (!this.chk) { let p = canvas(16, 16), x = ctx2d(p); x.fillStyle = "#fff"; x.fillRect(0, 0, 16, 16); x.fillStyle = "#d4d4d4"; x.fillRect(0, 0, 8, 8); x.fillRect(8, 8, 8, 8); this.chk = c.createPattern(p, "repeat"); }
            c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
            c.fillStyle = transparent && this.opt.backdrop !== "checker" ? this.opt.backdrop : this.chk; c.fillRect(M.ox, M.oy, N * M.k, N * M.k); c.restore();
            if (this.opt.mode === "pixels") {
                let r = (this.last && this.last.r) || this.result(), img = canvas(40, 40);
                ctx2d(img).putImageData(transparent ? r.tr : r.op, 0, 0);
                c.imageSmoothingEnabled = false; c.drawImage(img, 0, 0, N, N); c.imageSmoothingEnabled = true;
            } else {
                if (transparent && this.borderCv) { c.save(); c.beginPath(); c.rect(0, 0, N, N); c.clip(); c.drawImage(this.borderCv, 0, 0); c.restore(); }
                this.scene(c, M, !transparent, this.dlView);
            }
            // guides: the square, the 1 px safe margin, the pixel grid
            c.setTransform(1, 0, 0, 1, 0, 0);
            let sq = (x, y) => [M.ox + x * M.k, M.oy + y * M.k];
            c.lineWidth = 1; c.strokeStyle = "rgba(28,27,25,.55)"; c.strokeRect(M.ox - 0.5, M.oy - 0.5, N * M.k + 1, N * M.k + 1);
            if (this.opt.grid && v.k * S >= 7) {
                c.beginPath(); c.strokeStyle = "rgba(128,128,128,.28)";
                for (let i = 1; i < 40; i++) { let [x] = sq(i * S, 0), [, y] = sq(0, i * S); c.moveTo(Math.round(x) + 0.5, M.oy); c.lineTo(Math.round(x) + 0.5, M.oy + N * M.k); c.moveTo(M.ox, Math.round(y) + 0.5); c.lineTo(M.ox + N * M.k, Math.round(y) + 0.5); }
                c.stroke();
            }
            this.overlay(c, M, dpr);
            this.zoomOut.textContent = Math.round(v.k * S * 100 / 8) / 1 + "%";
        }
        overlay(c, M, dpr) {
            let toS = (x, y) => [M.ox + x * M.k, M.oy + y * M.k];
            let ants = (poly) => {       // a selected area: black and white dashes
                c.save(); c.setTransform(M.k, 0, 0, M.k, M.ox, M.oy); let p = polyPath(poly);
                c.lineWidth = 1.5 * dpr / M.k; c.strokeStyle = "#fff"; c.stroke(p);
                c.setLineDash([5 * dpr / M.k, 4 * dpr / M.k]); c.lineDashOffset = -((performance.now() / 60) % 9) * dpr / M.k; c.strokeStyle = "#1c1b19"; c.stroke(p); c.restore();
            };
            if (this.area) ants(this.area);
            if (this.g && this.g.k === "marquee" && this.g.poly) ants(this.g.poly);
            for (let so of this.selObjs()) if (so !== this.selObj()) {
                c.save(); c.setTransform(M.k, 0, 0, M.k, M.ox, M.oy); c.strokeStyle = "#ff5a1f"; c.lineWidth = 1.5 / M.k * dpr; c.setLineDash([4 / M.k * dpr, 3 / M.k * dpr]);
                c.stroke(pathOf(so)); c.restore();
            }
            let o = this.selObj();
            if (o) {
                c.save(); c.setTransform(M.k, 0, 0, M.k, M.ox, M.oy); c.strokeStyle = "#ff5a1f"; c.lineWidth = 1.5 / M.k * dpr; c.setLineDash([4 / M.k * dpr, 3 / M.k * dpr]);
                c.stroke(pathOf(o)); c.restore();
                if (o.k === "path") {
                    let sel = this.sel.node;
                    o.nodes.forEach((n, i) => {
                        let [x, y] = toS(n.x, n.y);
                        for (let [hx, hy] of [[n.ix, n.iy], [n.ox, n.oy]]) {
                            if (hx === n.x && hy === n.y) continue;
                            let [a, b] = toS(hx, hy);
                            c.strokeStyle = "#ff5a1f"; c.lineWidth = dpr; c.beginPath(); c.moveTo(x, y); c.lineTo(a, b); c.stroke();
                            c.fillStyle = "#fff"; c.beginPath(); c.arc(a, b, 4 * dpr, 0, 7); c.fill(); c.stroke();
                        }
                        let r = 4.5 * dpr; c.fillStyle = i === sel ? "#ff5a1f" : "#fff"; c.strokeStyle = "#1c1b19"; c.lineWidth = dpr;
                        c.fillRect(x - r, y - r, 2 * r, 2 * r); c.strokeRect(x - r, y - r, 2 * r, 2 * r);
                    });
                }
            }
            // the pen's next segment
            let b = this.building && this.objById(this.building);
            if (b && this.hover && !this.dragging) {
                let n = b.nodes[b.nodes.length - 1], [x, y] = toS(n.x, n.y), [hx, hy] = toS(n.ox, n.oy), [px, py] = toS(this.hover.x, this.hover.y);
                c.strokeStyle = "#ff5a1f"; c.lineWidth = dpr; c.setLineDash([5 * dpr, 4 * dpr]); c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(hx, hy, px, py, px, py); c.stroke(); c.setLineDash([]);
                if (b.nodes.length > 1) { let [fx, fy] = toS(b.nodes[0].x, b.nodes[0].y); if (Math.hypot(fx - px, fy - py) < 9 * dpr) { c.beginPath(); c.arc(fx, fy, 8 * dpr, 0, 7); c.stroke(); } }
            }
            // the brush / eraser size
            if (this.hover && ["erase", "restore", "brush"].includes(this.tool)) {
                let r = this.brushR() * M.k, [x, y] = toS(this.hover.x, this.hover.y);
                c.lineWidth = dpr; c.strokeStyle = "rgba(255,255,255,.9)"; c.beginPath(); c.arc(x, y, r + dpr, 0, 7); c.stroke();
                c.strokeStyle = "rgba(0,0,0,.85)"; c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke();
            }
        }
        brushR() { return ((this.tool === "brush" ? this.opt.brushSize : this.tool === "restore" ? this.opt.restoreSize : this.opt.eraseSize) * S) / 2; }

        // ---------- tools ----------
        setTool(id) {
            if (this.building && id !== "pen") this.finishPath();
            this.tool = id;
            for (let [k, b] of Object.entries(this.toolBtns)) b.setAttribute("aria-pressed", String(k === id));
            let t = TOOLS.find((x) => x[0] === id);
            this.hintText.textContent = ""; this.hintText.append(el("b", {}, t[2] + ":"), t[3]);
            this.cv.style.cursor = { hand: "grab", move: "move", picker: "crosshair", wand: "crosshair", pen: "crosshair", shape: "crosshair", select: "default" }[id] || "none";
            this.renderBar(); this.paint();
        }
        renderBar() {
            let b = this.bar, o = this.opt; b.textContent = "";
            let t = TOOLS.find((x) => x[0] === this.tool);
            b.append(el("span", { className: "t" }, t[2]));
            let slider = (label, key, min, max, step, fmt) => {
                let out = el("output", {}, fmt(o[key])), r = el("input", { type: "range", min, max, step, value: o[key] });
                r.addEventListener("input", () => { o[key] = +r.value; out.textContent = fmt(o[key]); this.paint(); });
                return el("label", {}, label, r, out);
            };
            let seg = (key, items, after) => {
                let s = el("span", { className: "seg", role: "group" });
                for (let [v, label] of items) s.append(el("button", { type: "button", className: "b" + (o[key] === v ? " on" : ""), onclick: () => { o[key] = v; this.renderBar(); if (after) after(); } }, label));
                return s;
            };
            const px = (v) => v.toFixed(1) + " px";
            let lay = this.doc && this.layerOf(this.active);
            if (this.tool === "erase") b.append(slider("Size", "eraseSize", 0.5, 12, 0.5, px), el("span", {}, "Erasing on: ", el("b", {}, lay ? lay.name : "Logo"), " (choose under Layers)"));
            if (this.tool === "restore") b.append(slider("Size", "restoreSize", 0.5, 12, 0.5, px));
            if (this.tool === "brush") b.append(slider("Size", "brushSize", 0.3, 8, 0.1, px), el("span", {}, "Colour: the line colour (right panel)"));
            if (this.tool === "wand") b.append(slider("Tolerance", "wandTol", 2, 120, 1, (v) => String(v)), el("label", {}, Object.assign(el("input", { type: "checkbox", checked: o.wandContig, onchange: (e) => { o.wandContig = e.target.checked; } })), "Only the connected area"));
            if (this.tool === "shape") {
                b.append(seg("shape", SHAPES));
                if (o.shape === "polygon") b.append(this.shapeParam("Sides", "sides", 3, 12, 1, (v) => String(v), ["polygon"]));
                if (o.shape === "star") b.append(this.shapeParam("Points", "points", 3, 12, 1, (v) => String(v), ["star"]), this.shapeParam("Depth", "inner", 0.2, 0.9, 0.05, (v) => Math.round((1 - v) * 100) + "%", ["star"]));
                if (ROUNDABLE.includes(o.shape)) {
                    let c = slider("Corners", "corners", 0, 10, 0.5, (v) => (v ? v.toFixed(1) + " px" : "sharp")), r = c.querySelector("input");
                    // also the shape just drawn (it is selected), so the corners can be tried on it
                    r.addEventListener("input", () => {
                        let ids = this.selObjs().filter((x) => x.k === "path" && x.nodes.some(isCorner)).map((x) => x.id);
                        if (ids.length) this.set({ draw: this.doc.draw.map((x) => (ids.includes(x.id) ? Object.assign({}, x, { radius: o.corners * S }) : x)) }, true);
                    });
                    r.addEventListener("change", () => this.commit());
                    b.append(c);
                }
            }
            if (["select", "pen"].includes(this.tool) && !this.building) {   // the selected stars and polygons
                let kinds = new Set(this.selObjs().filter((x) => x.box).map((x) => x.shape));
                if (kinds.has("polygon")) b.append(this.shapeParam("Sides", "sides", 3, 12, 1, (v) => String(v), ["polygon"]));
                if (kinds.has("star")) b.append(this.shapeParam("Points", "points", 3, 12, 1, (v) => String(v), ["star"]), this.shapeParam("Depth", "inner", 0.2, 0.9, 0.05, (v) => Math.round((1 - v) * 100) + "%", ["star"]));
            }
            if (["select", "pen"].includes(this.tool)) {   // round the corners of the selected shapes, any time
                let paths = this.selObjs().filter((x) => x.k === "path" && x.closed !== undefined && x.nodes.length > 2 && x.nodes.some(isCorner));
                if (paths.length && !this.building) {
                    let cur = (paths[0].radius || 0) / S, out = el("output", {}, cur ? cur.toFixed(1) + " px" : "sharp");
                    let r = el("input", { type: "range", min: 0, max: 10, step: 0.5, value: cur, ariaLabel: "Corners of the selected shape" });
                    r.addEventListener("input", () => {
                        let v = +r.value * S, ids = paths.map((x) => x.id); out.textContent = +r.value ? (+r.value).toFixed(1) + " px" : "sharp";
                        this.set({ draw: this.doc.draw.map((x) => (ids.includes(x.id) ? Object.assign({}, x, { radius: v }) : x)) }, true); this.paint();
                    });
                    r.addEventListener("change", () => { this.commit(); this.opt.corners = +r.value; });
                    b.append(el("label", { title: "Rounds the corner points of the selected shape" }, paths.length > 1 ? `Corners (${paths.length} shapes)` : "Corners of the selected shape", r, out));
                }
            }
            if (this.tool === "select") b.append(el("label", {}, "Drag to select", seg("selShape", [["rect", "Rectangle"], ["lasso", "Lasso"]])));
            if (this.area && ["select", "erase", "brush", "wand", "restore"].includes(this.tool)) {
                b.append(el("span", {}, "Area on ", el("b", {}, lay ? lay.name : "Logo"), ":"),
                    el("button", { className: "b", type: "button", title: "Delete", onclick: () => this.areaAction("delete") }, "Erase inside"),
                    el("button", { className: "b", type: "button", onclick: () => this.areaAction("crop") }, "Keep only inside"),
                    el("button", { className: "b", type: "button", title: "With the fill colour, on a drawing layer", onclick: () => this.areaAction("fill") }, "Fill"),
                    el("button", { className: "b", type: "button", title: "Esc", onclick: () => { this.area = null; this.select([]); this.renderBar(); this.paint(); } }, "Deselect"));
            }
            if (["pen", "shape", "select"].includes(this.tool)) {
                let ob = this.selObj(), many = this.sel.ids.length;
                if (this.tool !== "select" || ob) b.append(el("span", {}, (ob ? "Selected: " : "New: ") + [o.strokeOn ? `line ${px(o.lineW)}` : "", o.fillOn ? "fill" : ""].filter(Boolean).join(" + ") + " (colours in the right panel)"));
                if (many) b.append(el("button", { className: "b", type: "button", onclick: () => this.deleteSel() }, many > 1 ? `Delete ${many} shapes` : "Delete shape"));
                if (this.building) b.append(el("button", { className: "b", type: "button", onclick: () => this.finishPath() }, "Finish path (Enter)"));
            }
            if (this.tool === "picker") b.append(el("label", {}, "Pick into", seg("pickInto", [["stroke", "Line"], ["fill", "Fill"], ["bg", "Background"]])));
            if (this.tool === "move") {
                b.append(el("button", { className: "b", type: "button", onclick: () => this.place("fit") }, "Fit"), el("button", { className: "b", type: "button", onclick: () => this.place("fill") }, "Fill"),
                    el("button", { className: "b", type: "button", onclick: () => this.place("center") }, "Centre"), el("button", { className: "b", type: "button", onclick: () => this.place("bottom") }, "Cut at bottom"),
                    el("span", {}, "Size: slider under Logo, right"));
            }
        }
        shapeParam(label, key, min, max, step, fmt, kinds) {
            // Sides, Points, Depth: in the Shapes tool for the next shape and the one just drawn; with
            // Select or the pen for the selected shapes. The shapes are rebuilt in the box they were drawn in.
            let ids = () => this.selObjs().filter((x) => x.box && kinds.includes(x.shape)).map((x) => x.id);
            let first = this.objById(ids()[0]), val = this.tool === "shape" || !first ? this.opt[key] : first.params[key];
            let out = el("output", {}, fmt(val)), r = el("input", { type: "range", min, max, step, value: val, ariaLabel: label });
            r.addEventListener("input", () => {
                let v = +r.value, sel = ids(); out.textContent = fmt(v);
                if (this.tool === "shape") this.opt[key] = v;
                this.set({ draw: this.doc.draw.map((x) => {
                    if (!sel.includes(x.id)) return x;
                    let params = Object.assign({}, x.params, { [key]: v });
                    return Object.assign({}, x, shapeNodes(x.shape, x.box.a, x.box.b, x.box.shift, params, x.box.centre), { params });
                }) }, true);
                this.paint();
            });
            r.addEventListener("change", () => this.commit());
            return el("label", {}, label, r, out);
        }
        pt(e) { return { x: (e.offsetX - this.view.px) / this.view.k, y: (e.offsetY - this.view.py) / this.view.k }; }
        toSrc(p) { let t = this.doc.t; return [(p.x - t.x) / t.s, (p.y - t.y) / t.s]; }
        objById(id) { return this.doc.draw.find((o) => o.id === id); }
        selObj() { return this.doc && this.sel.ids.length === 1 ? this.objById(this.sel.ids[0]) : null; }   // one shape: its points can be edited
        selObjs() { return this.doc ? this.sel.ids.map((id) => this.objById(id)).filter(Boolean) : []; }
        select(ids, node = -1) { this.sel = { ids, node }; }
        clipCanvas() { return this.area ? this.area.map(([x, y]) => [x, y]) : undefined; }
        clipSrc() { return this.area ? this.area.map((p) => this.toSrc({ x: p[0], y: p[1] })) : undefined; }
        replaceObj(o) { this.set({ draw: this.doc.draw.map((x) => (x.id === o.id ? o : x)) }, true); }

        down(e) {
            if (!this.doc) return;
            this.cv.setPointerCapture(e.pointerId);
            this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
            if (this.pointers.size === 2) {   // two fingers: pan and zoom
                this.abortGesture();
                let [a, b] = [...this.pointers.values()];
                this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, view: Object.assign({}, this.view) };
                return;
            }
            let p = this.pt(e), tool = this.tool;
            if (e.button === 1 || this.keys.has(" ") || tool === "hand") { this.g = { k: "pan", sx: e.offsetX, sy: e.offsetY, view: Object.assign({}, this.view) }; this.cv.style.cursor = "grabbing"; return; }
            if (e.button === 2) return;
            this.dragging = true;
            if (tool === "brush" && e.altKey) return this.pick(p, "stroke");
            if (tool === "picker") return this.pick(p, this.opt.pickInto);
            if (tool === "move") { this.g = { k: "move", p, t: this.doc.t }; return; }
            if (tool === "erase" || tool === "restore") {
                let restore = (tool === "restore") !== e.altKey, a = this.layerOf(this.active);
                if (tool === "erase" && !restore && a.kind === "draw") {
                    let o = { id: uid++, k: "stroke", mode: "erase", layer: a.id, pts: [[p.x, p.y]], w: this.opt.eraseSize * S, clip: this.clipCanvas() };
                    this.set({ draw: [...this.doc.draw, o] }); this.g = { k: "dstroke", o };
                    return;
                }
                let op = { k: restore ? "restore" : "erase", pts: [this.toSrc(p)], r: this.brushR() / this.doc.t.s, clip: this.clipSrc() };
                this.set({ logoOps: [...this.doc.logoOps, op] }, true);
                this.buildLayer(); this.g = { k: "lstroke", op }; this.paint();
                return;
            }
            if (tool === "wand") {
                let [sx, sy] = this.toSrc(p).map(Math.floor);
                if (sx < 0 || sy < 0 || sx >= this.w || sy >= this.h) return this.flash("Click on the logo.");
                let op = { k: "wand", mode: e.altKey ? "restore" : "erase", x: sx, y: sy, tol: this.opt.wandTol, contig: this.opt.wandContig, clip: this.clipSrc() };
                this.set({ logoOps: [...this.doc.logoOps, op] }); this.commit();
                return;
            }
            if (tool === "brush") {
                let o = { id: uid++, k: "stroke", mode: "paint", layer: this.drawLayer(), pts: [[p.x, p.y]], w: this.opt.brushSize * S, colour: this.opt.stroke, clip: this.clipCanvas() };
                this.set({ draw: [...this.doc.draw, o] }); this.g = { k: "dstroke", o };
                return;
            }
            if (tool === "shape") {
                let o = Object.assign({ id: uid++, k: "path", layer: this.drawLayer(), shape: this.opt.shape }, this.style(), shapeNodes(this.opt.shape, p, p, false, this.opt));
                if (ROUNDABLE.includes(this.opt.shape) && this.opt.corners) o.radius = this.opt.corners * S;
                if (!o.stroke && (!o.fill || this.opt.shape === "line")) { o.stroke = this.opt.stroke; this.opt.strokeOn = true; }
                this.set({ draw: [...this.doc.draw, o] }); this.g = { k: "shape", p, id: o.id }; this.select([o.id]);
                return;
            }
            if (tool === "pen") return this.penDown(p, e);
            if (tool === "select") return this.selectDown(p, e);
        }
        move(e) {
            if (!this.doc) return;
            if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
            if (this.pinch && this.pointers.size === 2) {
                let [a, b] = [...this.pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, v = this.pinch.view;
                let k = clamp(v.k * (d / this.pinch.d), 0.2, 40), ux = (this.pinch.cx - v.px) / v.k, uy = (this.pinch.cy - v.py) / v.k;
                this.view = { k, px: cx - ux * k, py: cy - uy * k }; this.paint(); return;
            }
            let p = this.pt(e); this.hover = p;
            let g = this.g;
            if (!g) { if (this.tool === "pen" || ["erase", "restore", "brush"].includes(this.tool)) this.paint(); return; }
            if (g.k === "pan") { this.view = { k: g.view.k, px: g.view.px + e.offsetX - g.sx, py: g.view.py + e.offsetY - g.sy }; this.paint(); return; }
            if (g.k === "move") {
                let dx = p.x - g.p.x, dy = p.y - g.p.y;
                if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
                this.set({ t: { s: g.t.s, x: g.t.x + dx, y: g.t.y + dy } }, true); this.paint(); return;
            }
            if (g.k === "lstroke") {
                let q = this.toSrc(p), last = g.op.pts[g.op.pts.length - 1];
                if (Math.hypot(q[0] - last[0], q[1] - last[1]) < 0.4) return;
                g.op.pts.push(q); this.applyOp(g.op, g.op.pts.length - 1); this.layerVer++; this.paint(); return;
            }
            if (g.k === "dstroke") {
                let last = g.o.pts[g.o.pts.length - 1];
                if (Math.hypot(p.x - last[0], p.y - last[1]) < 0.6) return;
                g.o.pts.push([p.x, p.y]); this.paint(); return;
            }
            if (g.k === "shape") {
                let params = { sides: this.opt.sides, points: this.opt.points, inner: this.opt.inner };
                let box = { a: { x: g.p.x, y: g.p.y }, b: { x: p.x, y: p.y }, shift: e.shiftKey, centre: e.altKey };   // to rebuild it with other settings
                let o = Object.assign({}, this.objById(g.id), shapeNodes(this.opt.shape, g.p, p, e.shiftKey, params, e.altKey), { box, params });
                this.replaceObj(o); this.paint(); return;
            }
            if (g.k === "marquee") {
                if (this.opt.selShape === "lasso") { let q = g.pts[g.pts.length - 1]; if (Math.hypot(p.x - q[0], p.y - q[1]) > 1.5 / this.view.k * 2) g.pts.push([p.x, p.y]); g.poly = g.pts.length > 2 ? g.pts : null; }
                else g.poly = Math.abs(p.x - g.p0.x) + Math.abs(p.y - g.p0.y) > 3 / this.view.k ? rectPoly(g.p0, p) : null;
                this.paint(); return;
            }
            if (g.k === "penhandle" || g.k === "handle" || g.k === "node" || g.k === "objs") return this.editMove(g, p, e);
        }
        up(e) {
            this.pointers.delete(e.pointerId);
            if (this.pinch) { if (this.pointers.size < 2) this.pinch = null; return; }
            let g = this.g; this.g = null; this.dragging = false;
            if (g && g.k === "pan") { this.setTool(this.tool); return; }
            if (g && g.k === "lstroke") this.layerOps = null;   // redraw from the list, as undo and redo will
            if (g && g.k === "shape") {
                let o = this.objById(g.id), xs = o.nodes.map((n) => n.x), ys = o.nodes.map((n) => n.y);
                if (Math.max(...xs) - Math.min(...xs) < 2 && Math.max(...ys) - Math.min(...ys) < 2) { this.set({ draw: this.doc.draw.filter((x) => x.id !== g.id) }); this.select([]); this.doc = this.base; this.paint(); return; }
            }
            if (g && g.k === "marquee") {
                if (g.poly) {
                    let poly = g.poly, a = this.layerOf(this.active);
                    let inside = this.doc.draw.filter((o) => o.k !== "area" && (a.kind === "draw" ? o.layer === a.id : this.layerOf(o.layer) && this.layerOf(o.layer).vis) && this.pointsOf(o).every(([x, y]) => inPoly(poly, x, y))).map((o) => o.id);
                    this.area = poly.map(([x, y]) => [clamp(x, -N, 2 * N), clamp(y, -N, 2 * N)]);
                    this.select(g.add ? [...new Set([...this.sel.ids, ...inside])] : inside);
                    this.flash(inside.length ? `Selected ${inside.length} shape${inside.length === 1 ? "" : "s"} and the area. The eraser, brush and wand now only work inside it.` : "Area selected: the eraser, brush and wand now only work inside it. Delete erases inside it.");
                } else if (g.click) { this.area = null; this.select(g.add ? [...new Set([...this.sel.ids, g.click.id])] : [g.click.id]); this.active = g.click.layer; this.sync(); }
                else { this.area = null; if (!g.add) this.select([]); }
                this.renderBar(); this.paint(); return;
            }
            if (g) { this.commit(); this.sync(); }
            this.paint();
        }
        abortGesture() { if (this.g && this.g.k !== "pan") { this.g = null; this.commit(); } this.dragging = false; }
        pick(p, into) {
            let x = ctx2d(this.c320, { willReadFrequently: true }); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, N, N);
            this.scene(x, { k: 1, ox: 0, oy: 0 }, true, this.dl320);
            let px = clamp(Math.floor(p.x), 0, N - 1), py = clamp(Math.floor(p.y), 0, N - 1), d = x.getImageData(px, py, 1, 1).data, c = rgb2hex(d[0], d[1], d[2]);
            this.dragging = false;
            if (into === "bg") { this.set({ bg: c }); this.commit(); }
            else { if (into === "fill") { this.opt.fill = c; this.opt.fillOn = true; } else { this.opt.stroke = c; this.opt.strokeOn = true; } this.applyStyle(true); this.sync(); }
            this.flash(`Picked ${c} for the ${into === "bg" ? "background" : into === "fill" ? "fill" : "line"}.`);
        }
        flash(text) {
            let t = TOOLS.find((x) => x[0] === this.tool);
            this.hintText.textContent = ""; this.hintText.append(el("b", {}, t[2] + ":"), text);
            clearTimeout(this.flashT); this.flashT = setTimeout(() => this.setTool(this.tool), 2600);
        }
        style() { return { stroke: this.opt.strokeOn ? this.opt.stroke : null, fill: this.opt.fillOn ? this.opt.fill : null, w: this.opt.lineW * S }; }
        applyStyle(commit) {   // the colour controls change the selected shapes too
            let ids = this.sel.ids;
            if (ids.length) {
                let st = this.style();
                this.set({ draw: this.doc.draw.map((x) => !ids.includes(x.id) ? x : x.k === "path" ? Object.assign({}, x, st) : x.k === "stroke" && x.mode === "paint" ? Object.assign({}, x, { colour: this.opt.stroke }) : x) }, true);
                if (commit) this.commit();
            }
            this.renderBar(); this.paint();
        }

        // pen and point editing
        hitHandle(p) {
            let o = this.selObj(); if (!o || o.k !== "path") return null;
            let r = 7 / this.view.k;
            for (let i = o.nodes.length - 1; i >= 0; i--) {
                let n = o.nodes[i];
                if (Math.hypot(n.x - p.x, n.y - p.y) <= r) return { k: "node", i };
                if ((n.ox !== n.x || n.oy !== n.y) && Math.hypot(n.ox - p.x, n.oy - p.y) <= r) return { k: "handle", i, h: "o" };
                if ((n.ix !== n.x || n.iy !== n.y) && Math.hypot(n.ix - p.x, n.iy - p.y) <= r) return { k: "handle", i, h: "i" };
            }
            return null;
        }
        hitObj(p, only) {   // only: a layer id, to look at that layer alone
            if (!this.hitCtx) this.hitCtx = ctx2d(canvas(1, 1));
            let x = this.hitCtx;
            let L = only ? this.doc.layers.filter((l) => l.id === only) : this.doc.layers;
            for (let li = L.length - 1; li >= 0; li--) {      // the top layer first
                if (L[li].kind === "logo" && L[li].vis && this.logoAlphaAt(p) > 127) return null;   // what you see: the logo covers what is under it
                if (!L[li].vis || L[li].kind !== "draw") continue;
                for (let i = this.doc.draw.length - 1; i >= 0; i--) {
                    let o = this.doc.draw[i]; if (o.layer !== L[li].id || o.k === "area" || (o.k === "stroke" && o.mode === "erase")) continue;
                    let path = pathOf(o);
                    x.lineWidth = Math.max(o.w || 1, 12 / this.view.k); x.lineCap = x.lineJoin = "round";
                    if ((o.fill && o.closed && x.isPointInPath(path, p.x, p.y)) || x.isPointInStroke(path, p.x, p.y)) return o;
                }
            }
            return null;
        }
        segmentHit(o, p) {   // the nearest point on the selected path, to add a point there
            let n = o.nodes, segs = n.length - 1 + (o.closed ? 1 : 0), best = null;
            for (let s = 0; s < segs; s++) {
                let a = n[s], b = n[(s + 1) % n.length];
                for (let k = 1; k < 40; k++) {
                    let t = k / 40, x = bez(a.x, a.ox, b.ix, b.x, t), y = bez(a.y, a.oy, b.iy, b.y, t), d = Math.hypot(x - p.x, y - p.y);
                    if (!best || d < best.d) best = { d, s, t };
                }
            }
            return best && best.d <= 6 / this.view.k ? best : null;
        }
        splitAt(o, s, t) {   // de Casteljau: a new point on segment s at t, keeping the curve's shape
            let n = o.nodes.map((x) => Object.assign({}, x)), a = n[s], b = n[(s + 1) % n.length], L = (p, q) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
            let P0 = [a.x, a.y], P1 = [a.ox, a.oy], P2 = [b.ix, b.iy], P3 = [b.x, b.y];
            let A = L(P0, P1), B = L(P1, P2), C = L(P2, P3), D = L(A, B), E = L(B, C), F = L(D, E);
            a.ox = A[0]; a.oy = A[1]; b.ix = C[0]; b.iy = C[1];
            let m = { x: F[0], y: F[1], ix: D[0], iy: D[1], ox: E[0], oy: E[1], smooth: true };
            n.splice(s + 1, 0, m);
            return free(Object.assign({}, o, { nodes: n }));
        }
        penDown(p, e) {
            let b = this.building && this.objById(this.building);
            if (b) {
                let f = b.nodes[0];
                if (b.nodes.length >= 2 && Math.hypot(f.x - p.x, f.y - p.y) <= 9 / this.view.k) {
                    this.replaceObj(Object.assign({}, b, { closed: true })); this.building = null; this.commit(); this.sync(); this.paint(); this.dragging = false; return;
                }
                let o = Object.assign({}, b, { nodes: [...b.nodes, node(p.x, p.y)] });
                this.replaceObj(o); this.g = { k: "penhandle", id: o.id, i: o.nodes.length - 1 }; this.paint(); return;
            }
            let h = this.hitHandle(p);
            if (h) return this.startEdit(h, p, e);
            let so = this.selObj();
            if (so && so.k === "path") {
                let hit = this.segmentHit(so, p);
                if (hit) { let o = this.splitAt(so, hit.s, hit.t); this.replaceObj(o); this.select([o.id], hit.s + 1); this.commit(); this.paint(); this.dragging = false; return; }
            }
            let o = Object.assign({ id: uid++, k: "path", layer: this.drawLayer(), nodes: [node(p.x, p.y)], closed: false }, this.style());
            if (!o.stroke && !o.fill) { o.stroke = this.opt.stroke; this.opt.strokeOn = true; }
            this.set({ draw: [...this.doc.draw, o] }, true);
            this.building = o.id; this.select([o.id], 0);
            this.g = { k: "penhandle", id: o.id, i: 0 }; this.renderBar(); this.paint();
        }
        finishPath() {
            let b = this.building && this.objById(this.building);
            this.building = null;
            if (b) {     // a double-click adds a point twice: drop points on top of the one before
                let n = b.nodes.filter((m, i) => i === 0 || Math.hypot(m.x - b.nodes[i - 1].x, m.y - b.nodes[i - 1].y) > 3 / this.view.k);
                if (n.length !== b.nodes.length) { b = Object.assign({}, b, { nodes: n }); this.replaceObj(b); }
            }
            if (b && b.nodes.length < 2) { this.set({ draw: this.doc.draw.filter((x) => x.id !== b.id) }, true); this.select([]); }
            this.commit(); this.renderBar(); this.paint();
        }
        logoAlphaAt(p) {
            let [x, y] = this.toSrc(p).map(Math.floor);
            if (x < 0 || y < 0 || x >= this.w || y >= this.h || p.x < 0 || p.y < 0 || p.x >= N || p.y >= N) return 0;
            this.buildLayer();
            return this.lctx.getImageData(x, y, 1, 1).data[3];
        }
        pointsOf(o) { return o.k === "stroke" ? o.pts : o.nodes ? o.nodes.map((n) => [n.x, n.y]) : []; }
        selectDown(p, e) {
            let h = this.hitHandle(p);
            if (h) return this.startEdit(h, p, e);
            // a drawing layer selected: drags grab its own shapes only, so a marquee can start over other
            // layers' shapes; a plain click still picks the top shape there (see up)
            let a = this.layerOf(this.active), only = a.kind === "draw" ? a.id : null;
            let o = this.hitObj(p, only);
            if (o) {
                let ids = this.sel.ids;
                if (e.shiftKey) ids = ids.includes(o.id) ? ids.filter((x) => x !== o.id) : [...ids, o.id];
                else if (!ids.includes(o.id)) ids = [o.id];
                this.select(ids); this.active = o.layer;
                this.g = { k: "objs", p, orig: this.selObjs() }; this.sync(); this.paint(); return;
            }
            // empty space: drag a rectangle (or a lasso) to select an area and the shapes inside it
            this.g = { k: "marquee", p0: p, pts: [[p.x, p.y]], poly: null, add: e.shiftKey, click: only ? this.hitObj(p) : null };
            this.paint();
        }
        areaAction(kind) {   // delete inside, keep only inside (crop), fill
            if (!this.area) return;
            let a = this.layerOf(this.active), poly = this.area;
            if (kind === "fill") {
                let o = { id: uid++, k: "path", layer: this.drawLayer(), nodes: poly.map(([x, y]) => node(x, y)), closed: true, fill: this.opt.fill, stroke: null, w: this.opt.lineW * S };
                this.set({ draw: [...this.doc.draw, o] }, true); this.select([o.id]);
            } else if (a.kind === "logo") {
                this.set({ logoOps: [...this.doc.logoOps, { k: "area", poly: this.clipSrc(), invert: kind === "crop" }] }, true);
            } else {
                this.set({ draw: [...this.doc.draw, { id: uid++, k: "area", layer: a.id, poly: poly.map((q) => q.slice()), invert: kind === "crop" }] }, true);
            }
            this.commit(); this.sync(); this.paint();
        }
        startEdit(h, p, e) {
            let o = this.selObj();
            this.select([o.id], h.i);
            if (h.k === "node" && e.altKey) {     // Alt-click a point: corner <-> smooth
                let n = o.nodes.map((x) => Object.assign({}, x)), m = n[h.i], corner = m.ix === m.x && m.iy === m.y && m.ox === m.x && m.oy === m.y;
                if (corner) {
                    let prev = n[(h.i - 1 + n.length) % n.length], next = n[(h.i + 1) % n.length], dx = next.x - prev.x, dy = next.y - prev.y, l = Math.hypot(dx, dy) || 1, len = l / 6;
                    Object.assign(m, { ix: m.x - (dx / l) * len, iy: m.y - (dy / l) * len, ox: m.x + (dx / l) * len, oy: m.y + (dy / l) * len, smooth: true });
                } else Object.assign(m, { ix: m.x, iy: m.y, ox: m.x, oy: m.y, smooth: false });
                this.replaceObj(free(Object.assign({}, o, { nodes: n }))); this.commit(); this.paint(); this.dragging = false; return;
            }
            this.g = Object.assign({ id: o.id, p, o }, h); this.paint();
        }
        editMove(g, p, e) {
            let o = g.k === "objs" ? null : this.objById(g.id);
            if (g.k !== "objs" && !o) return;
            if (g.k === "objs") {
                let dx = p.x - g.p.x, dy = p.y - g.p.y;
                if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
                let mv = (src) => src.k === "stroke" ? Object.assign({}, src, { pts: src.pts.map(([x, y]) => [x + dx, y + dy]) })
                    : Object.assign({}, src, { nodes: src.nodes.map((n) => ({ x: n.x + dx, y: n.y + dy, ix: n.ix + dx, iy: n.iy + dy, ox: n.ox + dx, oy: n.oy + dy, smooth: n.smooth })) },
                        src.box ? { box: Object.assign({}, src.box, { a: { x: src.box.a.x + dx, y: src.box.a.y + dy }, b: { x: src.box.b.x + dx, y: src.box.b.y + dy } }) } : {});
                let moved = new Map(g.orig.map((o) => [o.id, mv(o)]));
                this.set({ draw: this.doc.draw.map((x) => moved.get(x.id) || x) }, true); this.paint(); return;
            }
            let n = o.nodes.map((x) => Object.assign({}, x)), m = n[g.i];
            if (g.k === "node") {
                let dx = p.x - m.x, dy = p.y - m.y;
                Object.assign(m, { x: p.x, y: p.y, ix: m.ix + dx, iy: m.iy + dy, ox: m.ox + dx, oy: m.oy + dy });
            } else if (g.k === "penhandle") {     // dragging while placing a point: a smooth curve point
                m.ox = p.x; m.oy = p.y;
                if (!e.altKey) { m.ix = 2 * m.x - p.x; m.iy = 2 * m.y - p.y; m.smooth = true; } else m.smooth = false;
            } else {
                let mine = g.h, other = mine === "o" ? "i" : "o";
                m[mine + "x"] = p.x; m[mine + "y"] = p.y;
                if (e.altKey) m.smooth = false;
                else if (m.smooth) {      // keep the other handle opposite, at its own length
                    let ox = m[other + "x"] - m.x, oy = m[other + "y"] - m.y, len = Math.hypot(ox, oy), dx = p.x - m.x, dy = p.y - m.y, l = Math.hypot(dx, dy) || 1;
                    m[other + "x"] = m.x - (dx / l) * len; m[other + "y"] = m.y - (dy / l) * len;
                }
            }
            this.replaceObj(free(Object.assign({}, o, { nodes: n }))); this.paint();
        }
        deleteSel() {
            let o = this.selObj(), all = this.sel.ids;
            if (o && o.k === "path" && this.sel.node >= 0 && o.nodes.length > 2) {
                let n = o.nodes.filter((_, i) => i !== this.sel.node);
                this.replaceObj(free(Object.assign({}, o, { nodes: n }))); this.select([o.id]);
            } else if (all.length) {
                this.set({ draw: this.doc.draw.filter((x) => !all.includes(x.id)) }, true); this.select([]);
                if (all.includes(this.building)) this.building = null;
            } else if (this.area) return this.areaAction("delete");
            else return;
            this.commit(); this.sync(); this.paint();
        }

        key(e, isDown) {
            if (!this.doc) return;
            let tag = (e.target && e.target.tagName) || "", typing = (tag === "INPUT" && !["range", "checkbox", "color", "radio"].includes(e.target.type)) || tag === "SELECT" || tag === "TEXTAREA";
            if (!isDown) { this.keys.delete(e.key); if (e.key === " ") this.setTool(this.tool); return; }
            if ((this.helpBox && this.helpBox.open) || (this.exBox && this.exBox.open) || (this.cmpBox && this.cmpBox.open)) return;
            if (typing) return;
            let k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
            if (mod && k === "z") { e.preventDefault(); return e.shiftKey ? this.doRedo() : this.doUndo(); }
            if (mod && k === "y") { e.preventDefault(); return this.doRedo(); }
            if (mod && k === "s") { e.preventDefault(); return e.shiftKey ? this.saveVersion() : this.saveNow(true); }
            if (mod && k === "e") { e.preventDefault(); return this.exportDialog(); }
            if (mod && k === "a") {
                e.preventDefault(); this.area = rectPoly({ x: 0, y: 0 }, { x: N, y: N });
                this.select(this.doc.draw.filter((o) => o.k !== "area" && this.layerOf(o.layer).vis).map((o) => o.id)); this.renderBar(); return this.paint();
            }
            if (mod) return;
            if (e.key === " ") { e.preventDefault(); if (!this.keys.has(" ")) { this.keys.add(" "); this.cv.style.cursor = "grab"; } return; }
            if (e.key === "Escape") { e.preventDefault(); if (this.building) this.finishPath(); else { this.select([]); this.area = null; this.sync(); this.paint(); } return; }
            if (e.key === "Enter" && this.building) { e.preventDefault(); return this.finishPath(); }
            if ((e.key === "Delete" || e.key === "Backspace")) {
                e.preventDefault();
                let b = this.building && this.objById(this.building);
                if (b) { if (b.nodes.length > 1) { this.replaceObj(Object.assign({}, b, { nodes: b.nodes.slice(0, -1) })); this.commit(); this.paint(); } else this.finishPath(); return; }
                return this.deleteSel();
            }
            if (this.tool === "move" && e.key.startsWith("Arrow")) {
                e.preventDefault(); let st = (e.shiftKey ? 5 : 1) * S, t = this.doc.t;
                let dx = e.key === "ArrowLeft" ? -st : e.key === "ArrowRight" ? st : 0, dy = e.key === "ArrowUp" ? -st : e.key === "ArrowDown" ? st : 0;
                this.set({ t: { s: t.s, x: t.x + dx, y: t.y + dy } }); this.commit(); return;
            }
            let tool = TOOLS.find((x) => x[1] === k);
            if (tool && !e.altKey) { e.preventDefault(); return this.setTool(tool[0]); }
            if (k === "[" || k === "]") {
                let key = this.tool === "brush" ? "brushSize" : this.tool === "restore" ? "restoreSize" : "eraseSize", f = k === "]" ? 1.25 : 0.8;
                this.opt[key] = clamp(Math.round(this.opt[key] * f * 10) / 10, 0.3, 12); this.renderBar(); this.paint(); return;
            }
            if (k === "+" || k === "=") return this.zoomBy(1.25);
            if (k === "-") return this.zoomBy(0.8);
            if (k === "0") { this.fitView(); return this.paint(); }
            if (k === "t") { this.opt.preview = this.opt.preview === "bg" ? "transparent" : "bg"; this.renderView(); return this.paint(); }
            if (k === "g") { this.opt.grid = !this.opt.grid; this.gridOn.checked = this.opt.grid; return this.paint(); }
            if (k === "x") { [this.opt.stroke, this.opt.fill] = [this.opt.fill, this.opt.stroke]; this.applyStyle(true); this.sync(); }
        }
        help() {
            if (!this.helpBox) {
                this.helpBox = el("dialog", {}, el("h3", { style: "margin:0 0 10px" }, "Keyboard shortcuts"),
                    el("table", {}, ...SHORTCUTS.map(([k, v]) => el("tr", {}, el("td", {}, k), el("td", {}, v)))),
                    el("form", { method: "dialog", style: "margin-top:14px" }, el("button", { className: "b" }, "Close")));
                this.root.append(this.helpBox);
            }
            this.helpBox.showModal();
        }
        // ---------- saving: in this browser, and as a project file ----------
        saveState(text) { if (this.saveOut) this.saveOut.textContent = text; }
        saveSoon() { if (!this.o.project) return; clearTimeout(this.saveT); this.saveState("Saving…"); this.saveT = setTimeout(() => this.saveNow(false), 700); }
        async saveNow(manual) {
            clearTimeout(this.saveT);
            if (!this.doc) return;
            let pr = this.o.project;
            if (!pr) { if (manual) this.saveState("Not saved in this browser: use Download project file."); return; }
            let r = this.updatePreview();
            let rec = { id: pr.id, layersId: pr.layersId, team: pr.team || null, base: pr.base || "avatar", label: this.label, preset: this.o.preset || null,
                doc: serialize(this.doc), active: this.active, versions: serialize(this.versions), thumb: r.tr, thumbOp: r.op, updated: Date.now() };
            try {
                await store.put(rec);
                this.saveState("Saved in this browser " + new Date(rec.updated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
                if (this.o.onSaved) this.o.onSaved(rec);
            } catch {
                this.saveState("Couldn't save in this browser (private window?). Download a project file to keep it.");
            }
        }
        projectData() {
            let pr = this.o.project || {};
            return { format: "ftc-embeds-avatar", version: 1, saved: new Date().toISOString(), label: this.label, team: pr.team || null, base: pr.base || this.o.fileBase || "avatar",
                preset: this.o.preset || null, layers: this.L, doc: this.doc, active: this.active, versions: this.versions };
        }
        downloadProject() {
            saveBlob(new Blob([serialize(this.projectData())], { type: "application/json" }), (this.o.fileBase || "avatar") + ".ftcavatar");
            this.saveState("Project file downloaded");
        }
        async importFile(f) {
            let proj;
            try { proj = await readProject(f); } catch (e) { this.saveState(e.message); return; }
            this.close(false);
            (window.AvatarEditor.onImport || openProject)(proj);
        }

        // ---------- export: other sizes and formats ----------
        renderAt(Z, transparent, style) {   // a Z x Z canvas of the avatar
            let r = this.updatePreview().r, small = canvas(40, 40);
            ctx2d(small).putImageData(transparent ? r.tr : r.op, 0, 0);
            if (Z === 40) return small;
            let c = canvas(Z, Z), x = ctx2d(c, { willReadFrequently: true });
            if (style === "pixel") { x.imageSmoothingEnabled = false; x.drawImage(small, 0, 0, Z, Z); return c; }
            let M = { k: Z / N, ox: 0, oy: 0 }, dl = canvas(Z, Z);
            if (!transparent) { this.scene(x, M, true, dl); return c; }
            this.scene(x, M, false, dl);
            let R = Math.round(this.doc.border * (Z / 40));
            if (R > 0) {     // the thin border, at this size
                let img = x.getImageData(0, 0, Z, Z), A = new Float32Array(Z * Z);
                for (let i = 0; i < Z * Z; i++) A[i] = img.data[i * 4 + 3] / 255;
                let Dm = roundBorder(A, this.doc.border * (Z / 40), Z), bc = hex2rgb(this.doc.borderColour || this.doc.bg), B = new ImageData(Z, Z);
                for (let i = 0; i < Z * Z; i++) { B.data[i * 4] = bc[0]; B.data[i * 4 + 1] = bc[1]; B.data[i * 4 + 2] = bc[2]; B.data[i * 4 + 3] = Dm[i] * 255; }
                let b = canvas(Z, Z); ctx2d(b).putImageData(B, 0, 0); ctx2d(b).drawImage(c, 0, 0);
                return b;
            }
            return c;
        }
        svgOf(transparent) {   // the 40 px avatar as crisp pixel art: one rectangle per run of equal pixels
            let r = this.updatePreview().r, D = (transparent ? r.tr : r.op).data, out = [];
            for (let y = 0; y < 40; y++) for (let x = 0; x < 40;) {
                let i = (y * 40 + x) * 4, a = D[i + 3], run = 1;
                while (x + run < 40 && [0, 1, 2, 3].every((k) => D[i + run * 4 + k] === D[i + k])) run++;
                if (a) out.push(`<rect x="${x}" y="${y}" width="${run}" height="1" fill="${rgb2hex(D[i], D[i + 1], D[i + 2])}"${a < 255 ? ` fill-opacity="${(a / 255).toFixed(3)}"` : ""}/>`);
                x += run;
            }
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="400" height="400" shape-rendering="crispEdges">\n${out.join("\n")}\n</svg>\n`;
        }
        async exportBlob(fmt, Z, transparent, style) {
            if (fmt === "svg") return new Blob([this.svgOf(transparent)], { type: "image/svg+xml" });
            if (fmt === "ico") {
                let pngs = [];
                for (let z of [16, 32, 48, 64, 128]) {
                    let c = z < 40 ? canvas(z, z) : this.renderAt(z, transparent, "smooth");
                    if (z < 40) { let x = ctx2d(c); x.imageSmoothingQuality = "high"; x.drawImage(this.renderAt(40, transparent), 0, 0, z, z); }
                    pngs.push({ size: z, data: await bytesOfBlob(await blobOf(c, "image/png")) });
                }
                return ico(pngs);
            }
            let c = this.renderAt(Z, transparent && fmt !== "jpeg", style);
            return blobOf(c, { png: "image/png", webp: "image/webp", jpeg: "image/jpeg" }[fmt], 0.92);
        }
        exportName(fmt, Z, transparent, style) {
            let b = this.o.fileBase || "avatar";
            if (fmt === "ico") return `${b}${transparent ? "" : "-with-background"}.ico`;
            if (fmt === "svg") return `${b}-pixel${transparent ? "-transparent" : ""}.svg`;
            if (Z === 40) return `${b}-avatar-40${transparent && fmt !== "jpeg" ? "-transparent" : ""}.${fmt === "jpeg" ? "jpg" : fmt}`;
            return `${b}-${style === "pixel" ? "pixel-" : ""}${Z}${transparent && fmt !== "jpeg" ? "-transparent" : ""}.${fmt === "jpeg" ? "jpg" : fmt}`;
        }
        exportDialog() {
            if (!this.doc) return;
            let ex = this.ex || (this.ex = { fmt: "png", size: 40, version: "transparent", style: "smooth" });
            if (!this.exBox) { this.exBox = el("dialog", { className: "ae-ex", ariaLabel: "Export" }); this.root.append(this.exBox); }
            let box = this.exBox, note = el("p", { className: "ae-ok", ariaLive: "polite" });
            let radios = (key, items) => el("span", { className: "row" }, ...items.map(([v, label]) => {
                let r = el("input", { type: "radio", name: "ae-" + key, checked: ex[key] === v });
                r.addEventListener("change", () => { ex[key] = v; draw(); });
                return el("label", {}, r, label);
            }));
            let pv = el("canvas"), info = el("span", { className: "ae-ok" });
            let draw = async () => {
                let fixed = ex.fmt === "svg" || ex.fmt === "ico";
                sizeSet.disabled = fixed; styleSet.disabled = fixed || ex.size === 40;
                let tr = ex.version === "transparent" && ex.fmt !== "jpeg";
                let c = ex.fmt === "svg" ? this.renderAt(400, tr, "pixel") : ex.fmt === "ico" ? this.renderAt(64, tr, "smooth") : this.renderAt(ex.size, tr, ex.style);
                pv.width = c.width; pv.height = c.height; let x = ctx2d(pv); x.clearRect(0, 0, c.width, c.height); x.drawImage(c, 0, 0);
                pv.className = tr ? "ae-chk" : ""; pv.style.width = pv.style.height = "128px";
                let blob = await this.exportBlob(ex.fmt, ex.size, tr, ex.style);
                info.textContent = `${this.exportName(ex.fmt, ex.size, tr, ex.style)} · ${(blob.size / 1024).toFixed(1)} kB`;
                let msgs = [];
                if (ex.fmt === "jpeg" && ex.version === "transparent") msgs.push("JPEG has no transparency: this one has the background.");
                if (ex.fmt === "webp" && blob.type !== "image/webp") msgs.push("This browser can't make WebP; it would be a PNG.");
                if (ex.fmt === "svg") msgs.push("SVG: the 40 px avatar as sharp pixel art, at any size (for print, stickers, slides).");
                if (ex.fmt === "ico") msgs.push("ICO: a website icon (favicon) with 16, 32, 48, 64 and 128 px inside.");
                if (!(ex.fmt === "png" && ex.size === 40)) msgs.push("For FIRST, upload the 40 × 40 PNG. The others are for your website, social media and print.");
                note.textContent = msgs.join(" ");
                this.exBlob = blob;
            };
            let sizeSet = el("fieldset", {}, el("legend", {}, "Size"), radios("size", [[40, "40 (FIRST)"], [80, "80"], [160, "160"], [320, "320"], [512, "512"], [1024, "1024"]]));
            let styleSet = el("fieldset", {}, el("legend", {}, "Bigger sizes"), radios("style", [["smooth", "Smooth: drawn at that size"], ["pixel", "Pixel art: the 40 px avatar enlarged"]]));
            box.textContent = "";
            box.append(el("h3", { style: "margin:0 0 12px" }, "Export"),
                el("fieldset", {}, el("legend", {}, "Version"), radios("version", [["transparent", "Transparent, with the border"], ["opaque", "With background"]])),
                el("fieldset", {}, el("legend", {}, "Format"), radios("fmt", [["png", "PNG"], ["webp", "WebP"], ["jpeg", "JPEG"], ["svg", "SVG (pixel art)"], ["ico", "ICO (favicon)"]])),
                sizeSet, styleSet,
                el("div", { className: "pv" }, pv, info), note,
                el("div", { className: "row" },
                    el("button", { className: "b go", type: "button", onclick: async () => { await draw(); let tr = ex.version === "transparent" && ex.fmt !== "jpeg"; saveBlob(this.exBlob, this.exportName(ex.fmt, ex.size, tr, ex.style)); } }, "Download"),
                    el("button", { className: "b", type: "button", title: "As a PNG, to paste into chats and documents", onclick: async () => {
                        try { let tr = ex.version === "transparent"; let blob = await blobOf(this.renderAt(ex.fmt === "svg" || ex.fmt === "ico" ? 512 : ex.size, tr, ex.style), "image/png"); await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]); note.textContent = "Copied as a PNG. Paste it anywhere."; }
                        catch { note.textContent = "This browser didn't allow copying the image. Use Download instead."; }
                    } }, "Copy image"),
                    el("button", { className: "b", type: "button", title: "40 px PNGs, 512 px, pixel art, SVG, ICO and the project file", onclick: () => this.exportAll(note) }, "Everything (.zip)"),
                    el("button", { className: "b", type: "button", title: "Zoomed in, opaque and transparent, and at actual size on white, dark, blue and red", onclick: () => this.downloadSheet(note) }, "Comparison sheet"),
                    el("button", { className: "b", type: "button", onclick: () => this.downloadProject() }, "Project file (.ftcavatar)"),
                    el("form", { method: "dialog", style: "margin-left:auto" }, el("button", { className: "b" }, "Close"))));
            box.showModal(); draw();
        }
        // ---------- versions, and comparing them on screen ----------
        async saveVersion(name) {
            if (!this.doc) return;
            if (this.building) this.finishPath();
            this.commit();
            let r = this.updatePreview(), n = this.versions.length + 1;
            let v = { id: "v" + Date.now().toString(36) + uid++, name: name || `Version ${n}`, time: Date.now(), doc: serialize(this.doc), active: this.active, op: r.op, tr: r.tr };
            this.versions = [...this.versions, v];
            this.renderVersions(); this.saveSoon();
            this.flash(`Saved “${v.name}”. Compare… shows it next to the others.`);
            return v;
        }
        restoreVersion(v) {
            this.commit();
            this.doc = migrate(JSON.parse(v.doc)); this.commit();      // one undo step back to before
            if (v.active && this.doc.layers.some((l) => l.id === v.active)) this.active = v.active;
            this.sel = { ids: [], node: -1 }; this.area = null; this.building = null;
            this.sync(); this.paint(); this.saveSoon();
            this.flash(`Back to “${v.name}”. Undo goes back to what you had.`);
        }
        renderVersions() {
            if (!this.verList) return;
            let L = this.verList; L.textContent = "";
            if (!this.versions.length) { L.append(el("p", { className: "ae-ok" }, "No versions yet.")); return; }
            for (let v of [...this.versions].reverse()) {
                let when = new Date(v.time).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
                L.append(el("div", { className: "ae-ver" },
                    el("div", { className: "th" }, el("img", { src: v.op, alt: "" }), el("img", { src: v.tr, alt: "", className: "ae-chk" })),
                    el("div", {}, el("b", { title: v.name }, v.name), el("small", {}, when)),
                    el("div", { className: "acts" },
                        el("button", { className: "b", type: "button", title: "Go back to this version", onclick: () => this.restoreVersion(v) }, "Restore"),
                        el("button", { className: "b", type: "button", title: "Rename", ariaLabel: `Rename ${v.name}`, onclick: () => {
                            let n = prompt("Name of this version", v.name); if (n == null || !n.trim()) return;
                            this.versions = this.versions.map((x) => (x.id === v.id ? Object.assign({}, x, { name: n.trim() }) : x)); this.renderVersions(); this.saveSoon();
                        } }, "✎"),
                        el("button", { className: "b", type: "button", title: "Delete this version", ariaLabel: `Delete ${v.name}`, onclick: () => {
                            if (!confirm(`Delete “${v.name}”?`)) return;
                            this.versions = this.versions.filter((x) => x.id !== v.id); this.renderVersions(); this.saveSoon();
                        } }, "✕"))));
            }
        }
        startResult() {   // the option as the server made it, once
            if (!this.startR) {
                let keep = this.doc; this.doc = migrate(JSON.parse(JSON.stringify(this.preset)));
                try { let r = this.result(); this.startR = { op: this.uri(r.op), tr: this.uri(r.tr) }; } finally { this.doc = keep; this.layerOps = null; this.buildLayer(); }
            }
            return this.startR;
        }
        compareRows() {
            let r = this.updatePreview(), b = this.o.fileBase || "avatar";
            return [
                { id: "now", label: "Now", files: [`${b}-avatar-40.png`, `${b}-avatar-40-transparent.png`], opaque: r.op, transparent: r.tr },
                ...[...this.versions].reverse().map((v) => ({ id: v.id, label: v.name, files: [new Date(v.time).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })], opaque: v.op, transparent: v.tr })),
                Object.assign({ id: "start", label: `${this.label} (as made for you)`, files: ["before any edits"] }, (() => { let s = this.startResult(); return { opaque: s.op, transparent: s.tr }; })()),
            ];
        }
        compareView() {
            if (!this.doc) return;
            if (!this.cmpBox) { this.cmpBox = el("dialog", { className: "ae-cmp", ariaLabel: "Compare" }); this.root.append(this.cmpBox); }
            let box = this.cmpBox, rows = this.compareRows();
            if (!this.cmpPick) this.cmpPick = new Set(["now", ...rows.filter((r) => r.id !== "now" && r.id !== "start").slice(0, 2).map((r) => r.id), ...(this.versions.length ? [] : ["start"])]);
            let pick = this.cmpPick, title = el("input", { type: "text", value: this.cmpTitle || `${this.label}: versions compared`, ariaLabel: "Title", style: "flex:1 1 260px;max-width:560px;font:14px var(--sans,sans-serif);padding:5px 8px;border:1px solid var(--rule,#cfc8b8);background:var(--field,#fbf9f4);color:inherit" });
            let view = el("div", { className: "view" }), img = el("img", { alt: "The comparison sheet" }), msg = el("p", { className: "ae-ok" }), seq = 0, last = null;
            img.addEventListener("click", () => view.classList.toggle("full"));
            view.append(img, msg);
            let draw = async () => {
                let mine = ++seq, chosen = rows.filter((r) => pick.has(r.id));
                if (!chosen.length) { img.hidden = true; msg.textContent = "Tick at least one to compare."; return; }
                img.hidden = false; msg.textContent = "Click the sheet to see it at full size.";
                let c = await compareSheet({ title: title.value, logo: this.src.logo, rows: chosen });
                if (mine !== seq) return;
                last = c; img.src = c.toDataURL("image/png");
            };
            let side = el("aside", { ariaLabel: "What to compare" }, el("b", { style: "font-size:13px" }, "Show"));
            for (let r of rows) {
                let cb = el("input", { type: "checkbox", checked: pick.has(r.id) });
                cb.addEventListener("change", () => { cb.checked ? pick.add(r.id) : pick.delete(r.id); draw(); });
                side.append(el("label", {}, cb, el("img", { src: r.opaque, alt: "" }), el("span", {}, r.label)));
            }
            side.append(el("button", { className: "b", type: "button", onclick: async () => { await this.saveVersion(); this.cmpBox.close(); this.compareView(); } }, "+ Save the current state as a version"));
            title.addEventListener("input", () => { this.cmpTitle = title.value; clearTimeout(title.t); title.t = setTimeout(draw, 250); });
            box.textContent = "";
            box.append(el("header", {}, el("h3", {}, "Compare"), title,
                el("button", { className: "b go", type: "button", onclick: async () => { await draw(); if (last) saveBlob(await blobOf(last, "image/png"), `${this.o.fileBase || "avatar"}-comparison.png`); } }, "Download PNG"),
                el("form", { method: "dialog" }, el("button", { className: "b" }, "Close"))), side, view);
            box.showModal(); draw();
        }

        async sheetCanvas() {
            let r = this.updatePreview(), b = this.o.fileBase || "avatar";
            return compareSheet({ title: `${this.label}: 40×40 avatar, opaque and transparent`, logo: this.src.logo,
                rows: [{ label: this.label, files: [`${b}-avatar-40.png`, `${b}-avatar-40-transparent.png`], opaque: r.op, transparent: r.tr }] });
        }
        async downloadSheet(note) {
            saveBlob(await blobOf(await this.sheetCanvas(), "image/png"), `${this.o.fileBase || "avatar"}-comparison.png`);
            if (note) note.textContent = "Comparison sheet downloaded.";
        }
        async exportAll(note) {
            note.textContent = "Making the zip…";
            let b = this.o.fileBase || "avatar", files = [], add = async (name, blob) => files.push({ name, data: await bytesOfBlob(blob) });
            await add(`${b}-avatar-40.png`, await this.exportBlob("png", 40, false));
            await add(`${b}-avatar-40-transparent.png`, await this.exportBlob("png", 40, true));
            await add(`${b}-512-transparent.png`, await this.exportBlob("png", 512, true, "smooth"));
            await add(`${b}-512.png`, await this.exportBlob("png", 512, false, "smooth"));
            await add(`${b}-pixel-400-transparent.png`, await this.exportBlob("png", 400, true, "pixel"));
            await add(`${b}-pixel-transparent.svg`, await this.exportBlob("svg", 40, true));
            await add(`${b}.ico`, await this.exportBlob("ico", 40, true));
            await add(`${b}-comparison.png`, await blobOf(await this.sheetCanvas(), "image/png"));
            await add(`${b}.ftcavatar`, new Blob([serialize(this.projectData())]));
            await add("README.txt", new Blob([`${this.label}

${b}-avatar-40.png, ${b}-avatar-40-transparent.png
    For FIRST: upload one at ftc-scoring.firstinspires.org (Team Avatar, Upload New Avatar).
${b}-512*.png        smooth, for websites and social media
${b}-pixel-400-transparent.png, ${b}-pixel-transparent.svg
                     the 40 px avatar as pixel art; the SVG stays sharp at any size
${b}-comparison.png  every version zoomed in and at actual size, to compare or share
${b}.ico             a website icon (favicon)
${b}.ftcavatar       the project: open it in the editor at ftc-embeds.com/avatars to keep editing
`]));
            saveBlob(zip(files), `${b}-avatar-export.zip`);
            note.textContent = `Downloaded ${files.length} files as a zip.`;
        }
        download(e, kind) {
            e.preventDefault();
            let r = this.updatePreview(), a = el("a", { href: kind === "opaque" ? r.op : r.tr, download: (this.o.fileBase || "avatar") + (kind === "opaque" ? "-avatar-40.png" : "-avatar-40-transparent.png") });
            document.body.append(a); a.click(); a.remove();
        }
        close(use) {
            if (this.building) this.finishPath();
            this.commit();
            let r = use ? this.updatePreview() : null;
            document.removeEventListener("keydown", this.onKey); document.removeEventListener("keyup", this.onKeyUp);
            this.ro.disconnect(); this.root.remove();
            document.documentElement.style.overflow = this.prevOverflow || "";
            if (this.doc && this.o.project) this.saveNow(false);
            let saved = this.doc ? { doc: this.doc, undo: this.undo, redo: this.redo, active: this.active, versions: this.versions } : null;
            if (window.AvatarEditor.current === this) window.AvatarEditor.current = null;
            if (this.o.onClose) this.o.onClose(saved);
            if (use && this.o.onDone) this.o.onDone({ opaque: r.op, transparent: r.tr, warnings: r.warnings, saved });
        }
    }

    // --- comparison sheet: every avatar zoomed in, opaque and transparent, and at actual size -----------
    const SHEET_BG = [["White", "#ffffff", "#1c1b19"], ["Dark", "#1c1b19", "#ffffff"], ["Blue", "#0066b3", "#ffffff"], ["Red", "#ed1c24", "#ffffff"]];
    async function compareSheet({ title, logo, rows, scale = 2 }) {
        // rows: [{label, files: [opaque, transparent], opaque, transparent}] (images as data URIs or canvases);
        // logo: an image or canvas, shown under the first row's name. Returns a canvas.
        let img = async (x) => (typeof x === "string" ? loadImage(x) : x);
        let R = await Promise.all(rows.map(async (r) => Object.assign({}, r, { op: await img(r.opaque), tr: await img(r.transparent) })));
        let lg = logo ? await img(logo) : null;
        let pad = 28, colL = 210, gap = 26, cell = 240, actW = 196, rowH = 284, top = 104;
        let xO = pad + colL + gap, xT = xO + cell + gap, xA = xT + cell + gap, W = xA + actW + pad, H = top + R.length * rowH + 6;
        let c = canvas(W * scale, H * scale), x = ctx2d(c);
        x.scale(scale, scale);
        let font = (w, size, mono) => `${w} ${size}px ${mono ? '"IBM Plex Mono", ui-monospace, Menlo, monospace' : '"IBM Plex Sans", system-ui, sans-serif'}`;
        x.fillStyle = "#f5f6f8"; x.fillRect(0, 0, W, H);
        x.fillStyle = "#1c1b19"; x.font = font(600, 19); x.textBaseline = "alphabetic"; x.fillText(title, pad, 42);
        x.font = font(600, 14);
        x.fillText("Opaque (6× zoom)", xO, 80); x.fillText("Transparent (6× zoom)", xT, 80); x.fillText("Actual size", xA, 80);
        let checker = (X, Y, w, h, sq) => { x.fillStyle = "#ffffff"; x.fillRect(X, Y, w, h); x.fillStyle = "#d9d9d9"; for (let j = 0; j < h / sq; j++) for (let i = 0; i < w / sq; i++) if ((i + j) % 2) x.fillRect(X + i * sq, Y + j * sq, Math.min(sq, w - i * sq), Math.min(sq, h - j * sq)); };
        let frame = (X, Y, w, h) => { x.strokeStyle = "#cdd0d6"; x.lineWidth = 1; x.strokeRect(X + 0.5, Y + 0.5, w - 1, h - 1); };
        let clipText = (t, X, Y, w) => { x.save(); x.beginPath(); x.rect(X, Y - 14, w, 20); x.clip(); x.fillText(t, X, Y); x.restore(); };
        R.forEach((r, i) => {
            let y = top + i * rowH;
            x.fillStyle = "#1c1b19"; x.font = font(600, 14.5); clipText(r.label, pad, y + 14, colL);
            x.fillStyle = "#6b6f78"; x.font = font(400, 11, true);
            (r.files || []).forEach((f, k) => clipText(f, pad, y + 34 + k * 15, colL));
            if (i === 0 && lg) {      // the original logo, fitted in a white box
                let bw = 190, bh = 150, by = y + 72, k = Math.min((bw - 12) / lg.width, (bh - 12) / lg.height);
                x.fillStyle = "#ffffff"; x.fillRect(pad, by, bw, bh); frame(pad, by, bw, bh);
                x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
                x.drawImage(lg, pad + (bw - lg.width * k) / 2, by + (bh - lg.height * k) / 2, lg.width * k, lg.height * k);
                x.fillStyle = "#6b6f78"; x.font = font(400, 11.5); x.fillText("Original logo", pad, by + bh + 18);
            }
            x.imageSmoothingEnabled = false;
            x.drawImage(r.op, xO, y, cell, cell); frame(xO, y, cell, cell);
            checker(xT, y, cell, cell, 12); x.drawImage(r.tr, xT, y, cell, cell); frame(xT, y, cell, cell);
            SHEET_BG.forEach(([name, bg, ink], k) => {
                let sy = y + k * 61, sw = 52;
                x.fillStyle = bg; x.fillRect(xA, sy, actW, sw); if (bg === "#ffffff") frame(xA, sy, actW, sw);
                x.fillStyle = "#ffffff"; x.fillRect(xA + 8, sy + 6, 40, 40);      // the opaque one, as it is
                x.drawImage(r.op, xA + 8, sy + 6, 40, 40);
                x.drawImage(r.tr, xA + 62, sy + 6, 40, 40);                       // the transparent one, on this colour
                x.fillStyle = ink; x.font = font(400, 13); x.fillText(name, xA + 116, sy + 31);
            });
            x.fillStyle = "#6b6f78"; x.font = font(400, 11.5); x.fillText("left: opaque · right: transparent", xA, y + 4 * 61 + 12);
        });
        return c;
    }

    async function readProject(file) {   // a .ftcavatar file -> {label, team, base, preset, layers, doc, active}
        let p;
        try { p = JSON.parse(await file.text()); } catch { throw new Error("This isn't a project file from the avatar editor."); }
        if (!p || p.format !== "ftc-embeds-avatar" || !p.layers || !p.layers.layers || !p.layers.layers.logo || !p.doc) throw new Error("This isn't a project file from the avatar editor.");
        if (p.version > 1) throw new Error("This project was made with a newer editor. Reload the page and try again.");
        return p;
    }
    function openProject(p, extra) {   // open a project without the page's help (not saved in the browser)
        return window.AvatarEditor.open(Object.assign({ label: p.label, preset: p.preset, layers: () => Promise.resolve(p.layers), saved: { doc: p.doc, active: p.active, versions: p.versions || [] }, fileBase: p.base }, extra || {}));
    }

    window.AvatarEditor = {
        /** open({label, preset, layers: () => Promise<{w, h, layers}>, saved, fileBase, project: {id, layersId, team, base}, onDone, onClose, onSaved}) */
        open(o) { let ed = new Editor(o); this.current = ed; ed.ready = ed.start(); return ed; },
        readProject, openProject, store, compareSheet,
        onImport: null,     // the page sets this: open a project file chosen inside the editor
        _internal: { reduce, maxFilter, medianCut, shapeNodes, zip, ico, crc32 },
    };
})();
