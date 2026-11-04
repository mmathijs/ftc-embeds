/* Avatar editor for /avatar-upload: AvatarEditor.open({...}) opens a full-screen editor on one option.
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
        ["select", "v", "Select", "Click a shape or line you drew to select it; drag it to move it. Drag its square points and round handles to reshape it. Delete removes it."],
        ["move", "m", "Move logo", "Drag to move the logo. Use the size slider above to make it bigger or smaller. Arrow keys nudge it by one avatar pixel."],
        ["erase", "e", "Eraser", "Drag to erase. Choose above whether it erases the logo or your drawing. Hold Alt to restore instead."],
        ["restore", "r", "Restore", "Paint to bring back the original logo, including its background, where the cut-out removed too much."],
        ["wand", "w", "Magic wand", "Click an area (like the gap inside a letter, or a leftover background) to cut it out. Alt-click brings it back."],
        ["brush", "b", "Brush", "Drag to paint with the line colour. [ and ] change the size. Alt-click picks a colour."],
        ["pen", "p", "Pen", "Click to place corner points; click and drag to make a curve. Click the first point to close the shape. Enter or double-click finishes. Backspace removes the last point."],
        ["shape", "u", "Shapes", "Drag to draw a rectangle, ellipse or line (choose above). Shift keeps it square or straight. Shapes stay editable with Select."],
        ["picker", "i", "Eyedropper", "Click the canvas to pick a colour. Choose above where it goes: line, fill or background."],
        ["hand", "h", "Hand", "Drag to look around. Scroll to zoom. Hold Space with any tool for the hand."],
    ];
    const SHORTCUTS = [
        ["V M E R W B P U I H", "the tools, as labelled"],
        ["Ctrl+Z, Ctrl+Shift+Z or Ctrl+Y", "undo, redo"],
        ["[ and ]", "smaller or bigger eraser and brush"],
        ["Space + drag, scroll", "look around, zoom"],
        ["+ − 0", "zoom in, out, fit"],
        ["Alt", "eraser restores, wand brings back, brush picks a colour, pen breaks a curve handle"],
        ["Shift", "square shapes, straight lines, move in one direction"],
        ["Enter, Esc", "finish the path you are drawing"],
        ["Delete", "remove the selected point or shape"],
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
    function maxFilter(A, R) {   // square max filter of a 320 x 320 alpha map, as Pillow's MaxFilter
        let T = new Float32Array(N * N), U = new Float32Array(N * N);
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let m = 0; for (let k = Math.max(0, x - R); k <= Math.min(N - 1, x + R); k++) m = Math.max(m, A[y * N + k]); T[y * N + x] = m; }
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let m = 0; for (let k = Math.max(0, y - R); k <= Math.min(N - 1, y + R); k++) m = Math.max(m, T[k * N + x]); U[y * N + x] = m; }
        return U;
    }
    function toImageData(O, floor) {   // premultiplied 40 x 40 -> ImageData; alpha under `floor` becomes 0 (no hidden colour)
        let d = new ImageData(40, 40);
        for (let i = 0; i < 1600; i++) {
            let a = O[i * 4 + 3];
            if (a * 255 < floor) continue;
            d.data[i * 4] = Math.round((O[i * 4] / a) * 255); d.data[i * 4 + 1] = Math.round((O[i * 4 + 1] / a) * 255);
            d.data[i * 4 + 2] = Math.round((O[i * 4 + 2] / a) * 255); d.data[i * 4 + 3] = Math.round(a * 255);
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

    // --- paths ----------------------------------------------------------------------------------------
    const node = (x, y) => ({ x, y, ix: x, iy: y, ox: x, oy: y, smooth: false });
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
        p.moveTo(n[0].x, n[0].y);
        let seg = (a, b) => p.bezierCurveTo(a.ox, a.oy, b.ix, b.iy, b.x, b.y);
        for (let i = 1; i < n.length; i++) seg(n[i - 1], n[i]);
        if (o.closed && n.length > 1) { seg(n[n.length - 1], n[0]); p.closePath(); }
        return p;
    }
    const bez = (a, b, c, d, t) => { let u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d; };
    function shapeNodes(kind, a, b, shift) {
        let x0 = a.x, y0 = a.y, x1 = b.x, y1 = b.y;
        if (kind === "line") {
            if (shift) { let dx = x1 - x0, dy = y1 - y0, ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4), len = Math.hypot(dx, dy); x1 = x0 + Math.cos(ang) * len; y1 = y0 + Math.sin(ang) * len; }
            return { nodes: [node(x0, y0), node(x1, y1)], closed: false };
        }
        if (shift) { let s = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); x1 = x0 + Math.sign(x1 - x0 || 1) * s; y1 = y0 + Math.sign(y1 - y0 || 1) * s; }
        let l = Math.min(x0, x1), r = Math.max(x0, x1), t = Math.min(y0, y1), bt = Math.max(y0, y1);
        if (kind === "rect") return { nodes: [node(l, t), node(r, t), node(r, bt), node(l, bt)], closed: true };
        let cx = (l + r) / 2, cy = (t + bt) / 2, rx = (r - l) / 2, ry = (bt - t) / 2, k = 0.5523;
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

    class Editor {
        constructor(o) {
            this.o = o;
            this.label = o.label || "Avatar";
            this.tool = "erase";
            this.opt = { eraseSize: 2, eraseOn: "logo", restoreSize: 2, wandTol: 40, wandContig: true, brushSize: 1.2, stroke: "#121216", fill: "#ffffff", strokeOn: true, fillOn: false, lineW: 1.2, shape: "rect", pickInto: "stroke", grid: true, showBg: true, mode: "detail" };
            this.view = { k: 1, px: 0, py: 0 };
            this.undo = []; this.redo = [];
            this.sel = null;          // {id, node}
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
            if (saved) { this.doc = saved.doc; this.undo = saved.undo.slice(); this.redo = saved.redo.slice(); }
            else this.doc = {
                src: this.src[p.src] ? p.src : (this.src.cut ? "cut" : "logo"),
                t: { s: p.s || 1, x: p.x || 0, y: p.y || 0 },
                bg: p.bg || "#00626e", border: p.border == null ? 1.1 : p.border, borderColour: "",
                frame: p.frame ? Object.assign({}, p.frame) : { type: "none" },
                adjust: Object.assign({ brightness: 1, contrast: 1, saturate: 1, colours: 0 }, p.adjust || {}),
                logoOps: [], draw: [], vis: { logo: true, draw: true },
            };
            if (!saved && !p.s) this.doc.t = this.fitT(this.doc.src, "fit");
            this.preset = JSON.parse(JSON.stringify(this.doc));
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
            this.root.append(el("header", { className: "ae-head" },
                el("h2", {}, "Edit avatar", el("small", {}, this.label)),
                this.btnUndo, this.btnRedo,
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
            this.stage = el("div", { className: "ae-stage" }, this.cv, this.busy,
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
            s.append(sec("Transparent version", el("label", {}, "Border", this.borderR, this.borderOut),
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
            // layers and view
            this.visLogo = el("input", { type: "checkbox" }); this.visDraw = el("input", { type: "checkbox" });
            this.visLogo.addEventListener("change", () => { this.set({ vis: Object.assign({}, this.doc.vis, { logo: this.visLogo.checked }) }); this.commit(); });
            this.visDraw.addEventListener("change", () => { this.set({ vis: Object.assign({}, this.doc.vis, { draw: this.visDraw.checked }) }); this.commit(); });
            this.gridOn = el("input", { type: "checkbox", checked: true }); this.gridOn.addEventListener("change", () => { this.opt.grid = this.gridOn.checked; this.paint(); });
            this.showBg = el("input", { type: "checkbox", checked: true }); this.showBg.addEventListener("change", () => { this.opt.showBg = this.showBg.checked; this.paint(); });
            this.modeSel = el("select", { ariaLabel: "View" }, el("option", { value: "detail" }, "Detail (draw at 8 × 8 per pixel)"), el("option", { value: "pixels" }, "Pixels (the 40 px result)"));
            this.modeSel.addEventListener("change", () => { this.opt.mode = this.modeSel.value; this.paint(); });
            this.clearDraw = el("button", { className: "b", type: "button", onclick: () => { this.set({ draw: [] }); this.sel = null; this.commit(); } }, "Clear drawing");
            s.append(sec("Layers and view",
                el("div", { className: "ae-layers" }, el("label", {}, this.visDraw, "Drawing (brush, pen, shapes)"), el("label", {}, this.visLogo, "Logo")),
                this.clearDraw,
                el("label", { className: "col" }, "View", this.modeSel),
                el("label", {}, this.gridOn, "Pixel grid when zoomed in (G)"), el("label", {}, this.showBg, "Show the background colour")));
            // export
            this.dlOp = el("a", { className: "b", href: "#" }, "Download PNG"); this.dlTr = el("a", { className: "b", href: "#" }, "Download transparent PNG");
            this.dlOp.addEventListener("click", (e) => this.download(e, "opaque")); this.dlTr.addEventListener("click", (e) => this.download(e, "transparent"));
            s.append(sec("Save", el("div", { className: "row" }, this.dlOp, this.dlTr),
                el("div", { className: "ae-ok" }, "Use this avatar adds it to your options, with these downloads.")));
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
        }
        doUndo() {
            if (this.building) this.finishPath();
            this.commit();
            if (!this.undo.length) return;
            this.redo.push(this.doc); this.doc = this.base = this.undo.pop();
            this.sel = null; this.sync(); this.paint();
        }
        doRedo() {
            if (!this.redo.length) return;
            this.undo.push(this.doc); this.doc = this.base = this.redo.pop();
            this.sel = null; this.sync(); this.paint();
        }
        reset() {
            this.commit();
            this.doc = JSON.parse(JSON.stringify(this.preset)); this.commit();
            this.sel = null; this.building = null; this.sync(); this.paint();
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
            this.visLogo.checked = d.vis.logo; this.visDraw.checked = d.vis.draw;
            this.clearDraw.disabled = !d.draw.length;
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
        wandMask(op) {
            if (op._mask) return op._mask;
            let { w, h } = this, D = this.orig.data, m = new Float32Array(w * h);
            let i0 = (op.y * w + op.x) * 4, r0 = D[i0], g0 = D[i0 + 1], b0 = D[i0 + 2], t = op.tol, t2 = t * t;
            let dist2 = (i) => { let dr = D[i * 4] - r0, dg = D[i * 4 + 1] - g0, db = D[i * 4 + 2] - b0; return dr * dr + dg * dg + db * db; };
            if (!op.contig) { for (let i = 0; i < w * h; i++) if (dist2(i) <= t2) m[i] = 1; }
            else {
                let stack = new Int32Array(w * h), sp = 0; stack[sp++] = op.y * w + op.x; m[op.y * w + op.x] = 1;
                while (sp) {
                    let i = stack[--sp], x = i % w, y = (i - x) / w;
                    for (let j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
                        if (j >= 0 && !m[j] && dist2(j) <= t2) { m[j] = 1; stack[sp++] = j; }
                    }
                }
            }
            // a soft edge: pixels next to the area that are a blend of its colour get a partial value
            let edge = new Float32Array(m);
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
                let i = y * w + x; if (m[i]) continue;
                if (!((x > 0 && m[i - 1]) || (x < w - 1 && m[i + 1]) || (y > 0 && m[i - w]) || (y < h - 1 && m[i + w]))) continue;
                let d = Math.sqrt(dist2(i)); edge[i] = clamp(1 - (d - t) / Math.max(30, t * 1.5), 0, 0.95);
            }
            op._mask = edge; op._seed = [r0, g0, b0];
            return edge;
        }
        applyWand(op) {
            let m = this.wandMask(op), { w, h } = this;
            if (op.mode === "erase") {
                let img = this.lctx.getImageData(0, 0, w, h), D = img.data, [r0, g0, b0] = op._seed;
                for (let i = 0; i < w * h; i++) {
                    let v = m[i]; if (!v) continue;
                    if (v >= 1) { D[i * 4] = D[i * 4 + 1] = D[i * 4 + 2] = D[i * 4 + 3] = 0; continue; }
                    let a = 1 - v;       // un-blend the seed colour from the edge pixel, so no halo is left
                    D[i * 4] = clamp((D[i * 4] - v * r0) / a, 0, 255); D[i * 4 + 1] = clamp((D[i * 4 + 1] - v * g0) / a, 0, 255); D[i * 4 + 2] = clamp((D[i * 4 + 2] - v * b0) / a, 0, 255);
                    D[i * 4 + 3] = D[i * 4 + 3] * a;
                }
                this.lctx.putImageData(img, 0, 0);
            } else {
                let t = ctx2d(this.tmp, { willReadFrequently: true }), img = new ImageData(w, h), D = img.data, O = this.orig.data;
                for (let i = 0; i < w * h; i++) if (m[i]) { D[i * 4] = O[i * 4]; D[i * 4 + 1] = O[i * 4 + 1]; D[i * 4 + 2] = O[i * 4 + 2]; D[i * 4 + 3] = O[i * 4 + 3] * Math.min(1, m[i] / 0.95); }
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
            if (d.vis.logo) {
                let L = this.adjusted();
                ctx.setTransform(M.k * d.t.s, 0, 0, M.k * d.t.s, M.ox + M.k * d.t.x, M.oy + M.k * d.t.y);
                ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
                ctx.drawImage(L, 0, 0);
            }
            if (d.vis.draw && d.draw.length) {
                let x = ctx2d(dl); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, dl.width, dl.height);
                x.setTransform(M.k, 0, 0, M.k, M.ox, M.oy);
                this.renderDraw(x, d.draw);
                ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(dl, 0, 0);
            }
            ctx.restore();
        }
        renderDraw(x, objs) {
            for (let o of objs) {
                let p = pathOf(o);
                x.lineCap = "round"; x.lineJoin = "round";
                if (o.k === "stroke") {
                    x.globalCompositeOperation = o.mode === "erase" ? "destination-out" : "source-over";
                    x.strokeStyle = o.colour || "#000"; x.lineWidth = o.w; x.stroke(p);
                    continue;
                }
                x.globalCompositeOperation = "source-over";
                if (o.fill && o.closed) { x.fillStyle = o.fill; x.fill(p); }
                if (o.stroke) { x.strokeStyle = o.stroke; x.lineWidth = o.w; x.stroke(p); }
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
            if (R > 0) {
                let Dm = maxFilter(A, R), [cr, cg, cb] = hex2rgb(this.doc.borderColour || this.doc.bg).map((v) => v / 255), Q = new Float32Array(P.length);
                for (let i = 0; i < N * N; i++) { let a = P[i * 4 + 3], m = Dm[i] * (1 - a); Q[i * 4] = P[i * 4] + cr * m; Q[i * 4 + 1] = P[i * 4 + 1] + cg * m; Q[i * 4 + 2] = P[i * 4 + 2] + cb * m; Q[i * 4 + 3] = a + m; }
                T = reduce(Q);
            }
            return { op: toImageData(O, 0), tr: toImageData(T, 20), content: toImageData(content, 20) };
        }
        uri(imgData) { let c = canvas(40, 40); ctx2d(c).putImageData(imgData, 0, 0); return c.toDataURL("image/png"); }
        warnings(r, opUri, trUri) {
            let w = [], bytes = (u) => Math.floor(((u.length - u.indexOf(",") - 1) * 3) / 4);
            for (let [nm, u] of [["opaque", opUri], ["transparent", trUri]]) if (bytes(u) > 20000) w.push(`The ${nm} PNG is ${bytes(u)} bytes; FIRST allows 20 kB.`);
            let D = r.op.data, keyed = 0;
            for (let i = 0; i < 1600; i++) { let R = D[i * 4], G = D[i * 4 + 1], B = D[i * 4 + 2]; if ((G > 200 && R < 120 && B < 120) || (R > 200 && B > 200 && G < 80)) keyed++; }
            if (keyed) w.push(`${keyed} pixels are close to lime or magenta, which video overlays can key out.`);
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
                this.pvTimer = setTimeout(() => this.updatePreview(), this.dragging ? 160 : 30);
            });
        }
        draw() {
            let c = this.vctx, dpr = window.devicePixelRatio || 1, v = this.view, d = this.doc;
            let M = { k: v.k * dpr, ox: v.px * dpr, oy: v.py * dpr };
            c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.cv.width, this.cv.height);
            // the logo outside the square, faint, so moving it shows what is cut off
            if (d.vis.logo) {
                c.save(); c.globalAlpha = 0.22;
                c.setTransform(M.k * d.t.s, 0, 0, M.k * d.t.s, M.ox + M.k * d.t.x, M.oy + M.k * d.t.y);
                c.drawImage(this.adjusted(), 0, 0); c.restore();
            }
            c.setTransform(M.k, 0, 0, M.k, M.ox, M.oy);
            if (!this.chk) { let p = canvas(16, 16), x = ctx2d(p); x.fillStyle = "#fff"; x.fillRect(0, 0, 16, 16); x.fillStyle = "#d4d4d4"; x.fillRect(0, 0, 8, 8); x.fillRect(8, 8, 8, 8); this.chk = c.createPattern(p, "repeat"); }
            c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = this.chk; c.fillRect(M.ox, M.oy, N * M.k, N * M.k); c.restore();
            if (this.opt.mode === "pixels") {
                let r = (this.last && this.last.r) || this.result(), img = canvas(40, 40);
                ctx2d(img).putImageData(this.opt.showBg ? r.op : r.tr, 0, 0);
                c.imageSmoothingEnabled = false; c.drawImage(img, 0, 0, N, N); c.imageSmoothingEnabled = true;
            } else this.scene(c, M, this.opt.showBg, this.dlView);
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
            if (this.tool === "erase") b.append(el("label", {}, "Erase from", seg("eraseOn", [["logo", "Logo"], ["draw", "Drawing"]])), slider("Size", "eraseSize", 0.5, 12, 0.5, px));
            if (this.tool === "restore") b.append(slider("Size", "restoreSize", 0.5, 12, 0.5, px));
            if (this.tool === "brush") b.append(slider("Size", "brushSize", 0.3, 8, 0.1, px), el("span", {}, "Colour: the line colour (right panel)"));
            if (this.tool === "wand") b.append(slider("Tolerance", "wandTol", 2, 120, 1, (v) => String(v)), el("label", {}, Object.assign(el("input", { type: "checkbox", checked: o.wandContig, onchange: (e) => { o.wandContig = e.target.checked; } })), "Only the connected area"));
            if (this.tool === "shape") b.append(seg("shape", [["rect", "Rectangle"], ["ellipse", "Ellipse"], ["line", "Line"]]));
            if (["pen", "shape", "select"].includes(this.tool)) {
                let ob = this.selObj();
                if (this.tool !== "select" || ob) b.append(el("span", {}, (ob ? "Selected: " : "New: ") + [o.strokeOn ? `line ${px(o.lineW)}` : "", o.fillOn ? "fill" : ""].filter(Boolean).join(" + ") + " (colours in the right panel)"));
                if (ob) b.append(el("button", { className: "b", type: "button", onclick: () => this.deleteSel() }, "Delete shape"));
                if (this.building) b.append(el("button", { className: "b", type: "button", onclick: () => this.finishPath() }, "Finish path (Enter)"));
            }
            if (this.tool === "picker") b.append(el("label", {}, "Pick into", seg("pickInto", [["stroke", "Line"], ["fill", "Fill"], ["bg", "Background"]])));
            if (this.tool === "move") {
                b.append(el("button", { className: "b", type: "button", onclick: () => this.place("fit") }, "Fit"), el("button", { className: "b", type: "button", onclick: () => this.place("fill") }, "Fill"),
                    el("button", { className: "b", type: "button", onclick: () => this.place("center") }, "Centre"), el("button", { className: "b", type: "button", onclick: () => this.place("bottom") }, "Cut at bottom"),
                    el("span", {}, "Size: slider under Logo, right"));
            }
        }
        pt(e) { return { x: (e.offsetX - this.view.px) / this.view.k, y: (e.offsetY - this.view.py) / this.view.k }; }
        toSrc(p) { let t = this.doc.t; return [(p.x - t.x) / t.s, (p.y - t.y) / t.s]; }
        objById(id) { return this.doc.draw.find((o) => o.id === id); }
        selObj() { return this.sel && this.doc && this.objById(this.sel.id); }
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
                let restore = (tool === "restore") !== e.altKey;
                if (tool === "erase" && this.opt.eraseOn === "draw") {
                    let o = { id: uid++, k: "stroke", mode: "erase", pts: [[p.x, p.y]], w: this.opt.eraseSize * S };
                    this.set({ draw: [...this.doc.draw, o] }); this.g = { k: "dstroke", o };
                    return;
                }
                let op = { k: restore ? "restore" : "erase", pts: [this.toSrc(p)], r: this.brushR() / this.doc.t.s };
                this.set({ logoOps: [...this.doc.logoOps, op] }, true);
                this.buildLayer(); this.g = { k: "lstroke", op }; this.paint();
                return;
            }
            if (tool === "wand") {
                let [sx, sy] = this.toSrc(p).map(Math.floor);
                if (sx < 0 || sy < 0 || sx >= this.w || sy >= this.h) return this.flash("Click on the logo.");
                let op = { k: "wand", mode: e.altKey ? "restore" : "erase", x: sx, y: sy, tol: this.opt.wandTol, contig: this.opt.wandContig };
                this.set({ logoOps: [...this.doc.logoOps, op] }); this.commit();
                return;
            }
            if (tool === "brush") {
                let o = { id: uid++, k: "stroke", mode: "paint", pts: [[p.x, p.y]], w: this.opt.brushSize * S, colour: this.opt.stroke };
                this.set({ draw: [...this.doc.draw, o] }); this.g = { k: "dstroke", o };
                return;
            }
            if (tool === "shape") {
                let o = Object.assign({ id: uid++, k: "path" }, this.style(), shapeNodes(this.opt.shape, p, p, false));
                if (!o.stroke && (!o.fill || this.opt.shape === "line")) { o.stroke = this.opt.stroke; this.opt.strokeOn = true; }
                this.set({ draw: [...this.doc.draw, o] }); this.g = { k: "shape", p, id: o.id }; this.sel = { id: o.id, node: -1 };
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
                let o = Object.assign({}, this.objById(g.id), shapeNodes(this.opt.shape, g.p, p, e.shiftKey));
                this.replaceObj(o); this.paint(); return;
            }
            if (g.k === "penhandle" || g.k === "handle" || g.k === "node" || g.k === "obj") return this.editMove(g, p, e);
        }
        up(e) {
            this.pointers.delete(e.pointerId);
            if (this.pinch) { if (this.pointers.size < 2) this.pinch = null; return; }
            let g = this.g; this.g = null; this.dragging = false;
            if (g && g.k === "pan") { this.setTool(this.tool); return; }
            if (g && g.k === "lstroke") this.layerOps = null;   // redraw from the list, as undo and redo will
            if (g && g.k === "shape") {
                let o = this.objById(g.id), xs = o.nodes.map((n) => n.x), ys = o.nodes.map((n) => n.y);
                if (Math.max(...xs) - Math.min(...xs) < 2 && Math.max(...ys) - Math.min(...ys) < 2) { this.set({ draw: this.doc.draw.filter((x) => x.id !== g.id) }); this.sel = null; this.doc = this.base; this.paint(); return; }
            }
            if (g && g.k === "penhandle" && g.fresh && !g.moved && e.altKey) { /* a click: a corner point */ }
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
        applyStyle(commit) {   // the colour controls change the selected shape too
            let o = this.selObj();
            if (o && o.k === "path") { this.replaceObj(Object.assign({}, o, this.style())); if (commit) this.commit(); }
            else if (o && o.k === "stroke" && o.mode === "paint") { this.replaceObj(Object.assign({}, o, { colour: this.opt.stroke })); if (commit) this.commit(); }
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
        hitObj(p) {
            if (!this.hitCtx) this.hitCtx = ctx2d(canvas(1, 1));
            let x = this.hitCtx;
            for (let i = this.doc.draw.length - 1; i >= 0; i--) {
                let o = this.doc.draw[i]; if (o.k === "stroke" && o.mode === "erase") continue;
                let path = pathOf(o);
                x.lineWidth = Math.max(o.w || 1, 12 / this.view.k); x.lineCap = x.lineJoin = "round";
                if ((o.fill && o.closed && x.isPointInPath(path, p.x, p.y)) || x.isPointInStroke(path, p.x, p.y)) return o;
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
            return Object.assign({}, o, { nodes: n });
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
                if (hit) { let o = this.splitAt(so, hit.s, hit.t); this.replaceObj(o); this.sel = { id: o.id, node: hit.s + 1 }; this.commit(); this.paint(); this.dragging = false; return; }
            }
            let o = Object.assign({ id: uid++, k: "path", nodes: [node(p.x, p.y)], closed: false }, this.style());
            if (!o.stroke && !o.fill) { o.stroke = this.opt.stroke; this.opt.strokeOn = true; }
            this.set({ draw: [...this.doc.draw, o] }, true);
            this.building = o.id; this.sel = { id: o.id, node: 0 };
            this.g = { k: "penhandle", id: o.id, i: 0 }; this.renderBar(); this.paint();
        }
        finishPath() {
            let b = this.building && this.objById(this.building);
            this.building = null;
            if (b) {     // a double-click adds a point twice: drop points on top of the one before
                let n = b.nodes.filter((m, i) => i === 0 || Math.hypot(m.x - b.nodes[i - 1].x, m.y - b.nodes[i - 1].y) > 3 / this.view.k);
                if (n.length !== b.nodes.length) { b = Object.assign({}, b, { nodes: n }); this.replaceObj(b); }
            }
            if (b && b.nodes.length < 2) { this.set({ draw: this.doc.draw.filter((x) => x.id !== b.id) }, true); this.sel = null; }
            this.commit(); this.renderBar(); this.paint();
        }
        selectDown(p, e) {
            let h = this.hitHandle(p);
            if (h) return this.startEdit(h, p, e);
            let o = this.hitObj(p);
            if (o) { this.sel = { id: o.id, node: -1 }; this.g = { k: "obj", id: o.id, p, o }; this.sync(); this.paint(); return; }
            this.sel = null; this.dragging = false; this.sync(); this.paint();
        }
        startEdit(h, p, e) {
            let o = this.selObj();
            this.sel = { id: o.id, node: h.i };
            if (h.k === "node" && e.altKey) {     // Alt-click a point: corner <-> smooth
                let n = o.nodes.map((x) => Object.assign({}, x)), m = n[h.i], corner = m.ix === m.x && m.iy === m.y && m.ox === m.x && m.oy === m.y;
                if (corner) {
                    let prev = n[(h.i - 1 + n.length) % n.length], next = n[(h.i + 1) % n.length], dx = next.x - prev.x, dy = next.y - prev.y, l = Math.hypot(dx, dy) || 1, len = l / 6;
                    Object.assign(m, { ix: m.x - (dx / l) * len, iy: m.y - (dy / l) * len, ox: m.x + (dx / l) * len, oy: m.y + (dy / l) * len, smooth: true });
                } else Object.assign(m, { ix: m.x, iy: m.y, ox: m.x, oy: m.y, smooth: false });
                this.replaceObj(Object.assign({}, o, { nodes: n })); this.commit(); this.paint(); this.dragging = false; return;
            }
            this.g = Object.assign({ id: o.id, p, o }, h); this.paint();
        }
        editMove(g, p, e) {
            let o = this.objById(g.id); if (!o) return;
            if (g.k === "obj") {
                let dx = p.x - g.p.x, dy = p.y - g.p.y, src = g.o;
                if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
                let moved = src.k === "stroke" ? Object.assign({}, src, { pts: src.pts.map(([x, y]) => [x + dx, y + dy]) })
                    : Object.assign({}, src, { nodes: src.nodes.map((n) => ({ x: n.x + dx, y: n.y + dy, ix: n.ix + dx, iy: n.iy + dy, ox: n.ox + dx, oy: n.oy + dy, smooth: n.smooth })) });
                this.replaceObj(moved); this.paint(); return;
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
            this.replaceObj(Object.assign({}, o, { nodes: n })); this.paint();
        }
        deleteSel() {
            let o = this.selObj(); if (!o) return;
            if (o.k === "path" && this.sel.node >= 0 && o.nodes.length > 2) {
                let n = o.nodes.filter((_, i) => i !== this.sel.node);
                this.replaceObj(Object.assign({}, o, { nodes: n })); this.sel = { id: o.id, node: -1 };
            } else { this.set({ draw: this.doc.draw.filter((x) => x.id !== o.id) }, true); this.sel = null; if (this.building === o.id) this.building = null; }
            this.commit(); this.sync(); this.paint();
        }

        key(e, isDown) {
            if (!this.doc) return;
            let tag = (e.target && e.target.tagName) || "", typing = (tag === "INPUT" && !["range", "checkbox", "color", "radio"].includes(e.target.type)) || tag === "SELECT" || tag === "TEXTAREA";
            if (!isDown) { this.keys.delete(e.key); if (e.key === " ") this.setTool(this.tool); return; }
            if (this.helpBox && this.helpBox.open) return;
            if (typing) return;
            let k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
            if (mod && k === "z") { e.preventDefault(); return e.shiftKey ? this.doRedo() : this.doUndo(); }
            if (mod && k === "y") { e.preventDefault(); return this.doRedo(); }
            if (mod) return;
            if (e.key === " ") { e.preventDefault(); if (!this.keys.has(" ")) { this.keys.add(" "); this.cv.style.cursor = "grab"; } return; }
            if (e.key === "Escape") { e.preventDefault(); if (this.building) this.finishPath(); else { this.sel = null; this.sync(); this.paint(); } return; }
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
            let saved = this.doc ? { doc: this.doc, undo: this.undo, redo: this.redo } : null;
            if (window.AvatarEditor.current === this) window.AvatarEditor.current = null;
            if (this.o.onClose) this.o.onClose(saved);
            if (use && this.o.onDone) this.o.onDone({ opaque: r.op, transparent: r.tr, warnings: r.warnings, saved });
        }
    }

    window.AvatarEditor = {
        /** open({label, preset, layers: () => Promise<{w, h, layers}>, saved, fileBase, onDone, onClose}) */
        open(o) { let ed = new Editor(o); this.current = ed; ed.ready = ed.start(); return ed; },
        _internal: { reduce, maxFilter, medianCut, shapeNodes },
    };
})();
