/*!
 * ftc-embeds.com/avatar analysis worker. License: MIT
 */
// Runs the slow parts off the page's thread (section 6, Threads): analyze() and the starting points.
// Tiles are sent one by one as they are ready; pixel buffers are copied, the page keeps its own.
import { sourceFromRGBA, analyze, candidates } from "../core/avatar.mjs";

/** What the page needs of a candidate: no 320 × 320 working rasters. */
const tileOf = (c) => ({ kind: c.kind, label: c.label, colorName: c.colorName, variant: c.variant, opaque: c.result.opaque, transparent: c.result.transparent, checks: c.checks });

self.onmessage = (e) => {
    let m = e.data || {};
    if (m.type === "ping") return self.postMessage({ type: "pong" });
    if (m.type !== "analyze") return;
    try {
        let source = sourceFromRGBA(m.width, m.height, new Uint8ClampedArray(m.rgba), m.name);
        let analysis = analyze(source);
        // OKLab per proxy pixel is recomputed on the page when needed: no need to copy 12 MB.
        let { lab, ...proxy } = analysis.proxy;
        self.postMessage({ type: "analysis", id: m.id, analysis: { ...analysis, proxy } });
        candidates(source, analysis, m.team, (c) => self.postMessage({ type: "tile", id: m.id, tile: tileOf(c) }));
        self.postMessage({ type: "done", id: m.id });
    } catch (err) {
        self.postMessage({ type: "error", id: m.id, message: String((err && err.message) || err) });
    }
};
