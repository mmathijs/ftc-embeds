// Synthetic logos for the avatar maker's tests, drawn by code (never downloaded): shapes with
// 4 × 4 supersampled, anti-aliased edges, painted in order like a simple vector drawing.

const SS = 4;

// Paint layers [{ hit(x, y) → bool, rgb: [r, g, b] in 0..255, or (x, y) → [r, g, b] }] over a
// background (null: transparent).
function paint(width, height, background, layers) {
    let rgba = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            // Premultiplied accumulation over the samples of this pixel.
            let acc = [0, 0, 0, 0];
            for (let sy = 0; sy < SS; sy++) {
                for (let sx = 0; sx < SS; sx++) {
                    let px = x + (sx + 0.5) / SS;
                    let py = y + (sy + 0.5) / SS;
                    let c = background;
                    for (let l of layers) if (l.hit(px, py)) c = typeof l.rgb === "function" ? l.rgb(px, py) : l.rgb;
                    if (c) {
                        acc[0] += c[0];
                        acc[1] += c[1];
                        acc[2] += c[2];
                        acc[3] += 1;
                    }
                }
            }
            let i = (y * width + x) * 4;
            if (acc[3]) {
                rgba[i] = Math.round(acc[0] / acc[3]);
                rgba[i + 1] = Math.round(acc[1] / acc[3]);
                rgba[i + 2] = Math.round(acc[2] / acc[3]);
                rgba[i + 3] = Math.round((acc[3] / (SS * SS)) * 255);
            }
        }
    }
    return { width, height, rgba };
}

const disc = (cx, cy, r) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const ellipse = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const rect = (x0, y0, x1, y1) => (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1;

export const SOURCES = {
    // A blue disc with a white eye on a white background (opaque).
    "disc-on-white": () =>
        paint(480, 360, [255, 255, 255], [
            { hit: disc(240, 180, 150), rgb: [30, 80, 200] },
            { hit: disc(290, 130, 40), rgb: [255, 255, 255] },
        ]),
    // An orange mascot (body and head with a dark outline) on transparency.
    "mascot-alpha": () =>
        paint(300, 360, null, [
            { hit: ellipse(150, 250, 112, 102), rgb: [58, 31, 18] },
            { hit: ellipse(150, 250, 100, 90), rgb: [226, 150, 26] },
            { hit: disc(150, 100, 82), rgb: [58, 31, 18] },
            { hit: disc(150, 100, 70), rgb: [226, 150, 26] },
            { hit: disc(122, 92, 14), rgb: [255, 255, 255] },
            { hit: disc(178, 92, 14), rgb: [255, 255, 255] },
        ]),
    // A coin: dark rim, cream face and a red star-ish centre, on white (opaque).
    "coin": () =>
        paint(400, 400, [255, 255, 255], [
            { hit: disc(200, 200, 190), rgb: [18, 18, 22] },
            { hit: disc(200, 200, 168), rgb: [245, 236, 214] },
            { hit: (x, y) => Math.abs(x - 200) + Math.abs(y - 200) < 90, rgb: [200, 40, 50] },
        ]),
    // Diagonal gradient with a few flat shapes: many colours, for crisp colours and the box filter.
    "gradient": () =>
        paint(256, 256, null, [
            { hit: () => true, rgb: (x, y) => [Math.round((x / 256) * 200), Math.round((y / 256) * 120), 90] },
            { hit: rect(40, 40, 120, 216), rgb: [250, 210, 40] },
            { hit: disc(180, 128, 50), rgb: [20, 140, 200] },
        ]),
    // A tall figure on transparency (head, body, legs), for cutting at the bottom.
    "tall-figure": () =>
        paint(200, 500, null, [
            { hit: disc(100, 70, 60), rgb: [22, 38, 74] },
            { hit: rect(40, 120, 160, 330), rgb: [0, 98, 110] },
            { hit: rect(50, 330, 90, 500), rgb: [22, 38, 74] },
            { hit: rect(110, 330, 150, 500), rgb: [22, 38, 74] },
            { hit: disc(80, 60, 10), rgb: [255, 255, 255] },
            { hit: disc(120, 60, 10), rgb: [255, 255, 255] },
        ]),
    // A 40 × 40 pixel-art avatar with hard pixels and a transparent corner (an existing FIRST avatar).
    "pixel-avatar": () => {
        let rgba = new Uint8ClampedArray(40 * 40 * 4);
        for (let y = 0; y < 40; y++) {
            for (let x = 0; x < 40; x++) {
                let i = (y * 40 + x) * 4;
                let inside = (x - 19.5) ** 2 + (y - 19.5) ** 2 < 19 ** 2;
                if (!inside) continue;
                let c = (x >> 3) % 2 === (y >> 3) % 2 ? [255, 90, 31] : [28, 27, 25];
                if (x < 10 && y < 10) c = [255, 255, 255];
                rgba.set([...c, 255], i);
            }
        }
        return { width: 40, height: 40, rgba };
    },
};
