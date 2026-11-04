// Projects (section 7): one JSON document plus one source image describe everything the visitor did.
// Defaults, validation (clamping numbers, rejecting what can't be trusted, migrating old versions)
// and saving. Pure: no DOM, no clock.

export const PROJECT_FORMAT = "ftc-avatar-project";
export const PROJECT_VERSION = 1;
export const LIMITS = { variants: 50, ops: 5000, points: 20000, shapes: 500, texts: 10, pieces: 6, pixels: 1600, history: 200 };

/** A fit that shows a w × h source whole, centred, with a 1 px margin. */
export function wholeFit(width, height, kind = "logo") {
    if (kind === "avatar") return { scale: 40 / Math.max(width, height), x: 0, y: 0, rotate: 0, flip: false, sampling: "auto", anchor: "free" };
    let scale = 38 / Math.max(width, height);
    return { scale, x: 20 - (width * scale) / 2, y: 20 - (height * scale) / 2, rotate: 0, flip: false, sampling: "auto", anchor: "free" };
}

/** A variant with every default from section 7.3. */
export function defaultVariant(id, name, fit) {
    return {
        id,
        name,
        fit: { ...fit },
        pieces: [],
        background: "#ffffff",
        frame: { kind: "square", radius: 4, ring: null, outside: null, breakOut: false },
        cutout: { mode: "off", color: "auto", tolerance: 0.06, softness: 2, mainPart: false },
        maskOps: [],
        paintOps: [],
        adjust: { brightness: 0, contrast: 0, saturation: 0, thicken: 0, colors: 0 },
        shapes: [],
        texts: [],
        border: { width: 1.1, color: null },
        transparent: "auto",
        resample: "lanczos3",
        alphaFloor: 20,
        pixels: { opaque: [], transparent: [] },
    };
}

/**
 * A new project for a source ({ name, width, height, kind? }; a 40 × 40 source is a FIRST avatar)
 * with one variant showing the whole logo.
 */
export function newProject(info, team = null) {
    let kind = info.kind ?? (info.width === 40 && info.height === 40 ? "avatar" : "logo");
    let source = { name: String(info.name ?? "logo"), width: info.width, height: info.height, kind };
    let variant = defaultVariant("v1", "Whole logo", wholeFit(info.width, info.height, kind));
    // An existing avatar is drawn as exact 8 × 8 blocks; the box reduction gives its pixels back
    // unchanged, where Lanczos would blend neighbouring pixels.
    if (kind === "avatar") variant.resample = "box";
    return {
        format: PROJECT_FORMAT,
        version: PROJECT_VERSION,
        team: team ? { number: team.number, name: team.name } : null,
        source,
        selected: "v1",
        variants: [variant],
    };
}

/** The next free id with this prefix ("v", "s", "t" or "p") in the project. */
export function nextId(project, prefix) {
    let max = 0;
    let see = (id) => {
        let m = typeof id === "string" && id.startsWith(prefix) && /^\d+$/.test(id.slice(prefix.length));
        if (m) max = Math.max(max, +id.slice(prefix.length));
    };
    for (let v of project.variants) {
        see(v.id);
        for (let list of [v.shapes, v.texts, v.pieces]) for (let item of list) see(item.id);
    }
    return prefix + (max + 1);
}

/** The project as a project file: the schema plus the source as a PNG data URL. */
export function projectToFile(project, sourcePngDataUrl) {
    return JSON.stringify({ ...project, assets: { source: sourcePngDataUrl } });
}

// ------------------------------------------------------------ validation

class ProjectError extends Error {}

const rejectProject = (msg) => {
    throw new ProjectError(msg);
};

// A finite number clamped to [min, max], or the default when missing or not a number.
const clampNum = (v, min, max, def) => (typeof v === "number" && Number.isFinite(v) ? (v < min ? min : v > max ? max : v) : def);
const clampInt = (v, min, max, def) => Math.round(clampNum(v, min, max, def));
const boolOr = (v, def) => (typeof v === "boolean" ? v : def);
const enumOr = (v, list, def) => (list.includes(v) ? v : def);
const asObject = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const asArray = (v) => (Array.isArray(v) ? v : []);

function validHex(v, where, nullable = false) {
    if (v == null && nullable) return null;
    if (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
    rejectProject(`${where} isn't a colour like #1a2b3c.`);
}

function validFit(f, where) {
    f = asObject(f);
    return {
        scale: clampNum(f.scale, 1e-4, 1000, null) ?? rejectProject(`${where}: the logo's scale is missing.`),
        x: clampNum(f.x, -10000, 10000, 0),
        y: clampNum(f.y, -10000, 10000, 0),
        rotate: enumOr(f.rotate, [0, 90, 180, 270], 0),
        flip: boolOr(f.flip, false),
        sampling: enumOr(f.sampling, ["auto", "smooth", "pixel"], "auto"),
        anchor: enumOr(f.anchor, ["free", "top"], "free"),
    };
}

function validPoints(points, where) {
    points = asArray(points);
    if (points.length > LIMITS.points) rejectProject(`${where}: a stroke has more than ${LIMITS.points} points.`);
    return points.map((p) => [clampNum(asArray(p)[0], -1e6, 1e6, 0), clampNum(asArray(p)[1], -1e6, 1e6, 0)]);
}

function validMaskOp(o, where) {
    o = asObject(o);
    let op = enumOr(o.op, ["erase", "restore"], null) ?? rejectProject(`${where}: an operation is neither erase nor restore.`);
    if (o.kind === "wand") return { op, kind: "wand", x: clampNum(o.x, -1e6, 1e6, 0), y: clampNum(o.y, -1e6, 1e6, 0), tolerance: clampNum(o.tolerance, 0, 1, 0.08), contiguous: boolOr(o.contiguous, true) };
    if (o.kind !== "stroke") rejectProject(`${where}: unknown mask operation "${String(o.kind)}".`);
    return { op, kind: "stroke", size: clampNum(o.size, 0.01, 1e5, 1), hardness: clampNum(o.hardness, 0, 1, 0.8), points: validPoints(o.points, where) };
}

function validPaintOp(o, where) {
    o = asObject(o);
    if (o.kind === "brush") return { kind: "brush", color: validHex(o.color, `${where}: brush colour`), alpha: clampNum(o.alpha, 0, 1, 1), size: clampNum(o.size, 0.01, 1e5, 1), hardness: clampNum(o.hardness, 0, 1, 1), points: validPoints(o.points, where) };
    if (o.kind === "fill") return { kind: "fill", x: clampNum(o.x, -1e6, 1e6, 0), y: clampNum(o.y, -1e6, 1e6, 0), color: validHex(o.color, `${where}: fill colour`), tolerance: clampNum(o.tolerance, 0, 1, 0.05), contiguous: boolOr(o.contiguous, true) };
    if (o.kind === "clone") return { kind: "clone", dx: clampNum(o.dx, -1e6, 1e6, 0), dy: clampNum(o.dy, -1e6, 1e6, 0), size: clampNum(o.size, 0.01, 1e5, 1), hardness: clampNum(o.hardness, 0, 1, 0.7), points: validPoints(o.points, where) };
    rejectProject(`${where}: unknown paint operation "${String(o.kind)}".`);
}

const PROJECT_SHAPE_TYPES = ["ellipse", "ring", "rect", "polygon", "line"];

function validShape(s, where) {
    s = asObject(s);
    let type = enumOr(s.type, PROJECT_SHAPE_TYPES, null) ?? rejectProject(`${where}: unknown shape "${String(s.type)}".`);
    let out = { id: s.id, type, fill: validHex(s.fill, `${where}: fill`, true), stroke: validHex(s.stroke, `${where}: stroke`, true), width: clampNum(s.width, 0, 40, 1), layer: enumOr(s.layer, ["below", "above"], "above") };
    let c = (k, d = 0) => clampNum(s[k], -1000, 1000, d);
    if (type === "ellipse") Object.assign(out, { cx: c("cx", 20), cy: c("cy", 20), rx: clampNum(s.rx, 0, 1000, 10), ry: clampNum(s.ry, 0, 1000, 10) });
    if (type === "ring") Object.assign(out, { cx: c("cx", 20), cy: c("cy", 20), r: clampNum(s.r, 0, 1000, 19), start: clampNum(s.start, -720, 720, 0), end: clampNum(s.end, -720, 720, 360) });
    if (type === "rect") Object.assign(out, { x: c("x"), y: c("y"), w: clampNum(s.w, 0, 1000, 10), h: clampNum(s.h, 0, 1000, 10), radius: clampNum(s.radius, 0, 20, 0) });
    if (type === "polygon") out.points = asArray(s.points).slice(0, 1000).map((p) => [clampNum(asArray(p)[0], -1000, 1000, 0), clampNum(asArray(p)[1], -1000, 1000, 0)]);
    if (type === "line") Object.assign(out, { x1: c("x1"), y1: c("y1"), x2: c("x2"), y2: c("y2") });
    return out;
}

function validTextBlock(t, where) {
    t = asObject(t);
    let lines = asArray(t.lines).slice(0, 3).map((l) => String(l).slice(0, 16));
    if (!lines.length) lines = [""];
    let out = {
        id: t.id,
        lines,
        font: enumOr(t.font, ["bold", "light"], "bold"),
        scale: enumOr(t.scale, [1, 2], 1),
        align: enumOr(t.align, ["left", "center", "right"], "center"),
        x: clampInt(t.x, -40, 80, 0),
        y: clampInt(t.y, -40, 80, 0),
        color: validHex(t.color ?? "#ffffff", `${where}: text colour`),
        outline: validHex(t.outline, `${where}: outline`, true),
        plate: null,
        letterSpacing: clampInt(t.letterSpacing, 0, 2, 1),
        lineGap: clampInt(t.lineGap, 1, 3, 1),
    };
    if (t.plate) {
        let p = asObject(t.plate);
        out.plate = { color: validHex(p.color, `${where}: plate colour`), pad: clampInt(p.pad, 1, 3, 1), radius: clampInt(p.radius, 0, 2, 0) };
    }
    if (Array.isArray(t.segments)) {
        out.segments = t.segments.slice(0, 3).map((s) => ({ text: String(asObject(s).text ?? "").slice(0, 16), color: validHex(asObject(s).color, `${where}: bar colour`) }));
        if (!out.segments.length) delete out.segments;
        else {
            out.width = t.width === "fill" ? "fill" : clampInt(t.width, 4, 40, 36);
            out.radius = t.radius === "pill" ? "pill" : clampInt(t.radius, 0, 6, 0);
            out.pad = clampInt(t.pad, 1, 3, 2);
        }
    }
    return out;
}

function validPixels(edits, where) {
    edits = asArray(edits);
    if (edits.length > LIMITS.pixels) rejectProject(`${where}: more than ${LIMITS.pixels} pixel edits.`);
    return edits.map((e) => {
        e = asArray(e);
        if (typeof e[2] !== "string" || !/^#[0-9a-f]{8}$/i.test(e[2])) rejectProject(`${where}: a pixel edit isn't a colour like #1a2b3cff.`);
        return [clampInt(e[0], 0, 39, 0), clampInt(e[1], 0, 39, 0), e[2].toLowerCase()];
    });
}

function validVariant(v, n) {
    v = asObject(v);
    let name = typeof v.name === "string" && v.name.trim() ? v.name.slice(0, 80) : `Option ${n}`;
    let where = `Variant “${name}”`;
    let def = defaultVariant(v.id, name, { scale: 1 });
    let frame = asObject(v.frame);
    let ring = frame.ring ? asObject(frame.ring) : null;
    let cut = asObject(v.cutout);
    let adj = asObject(v.adjust);
    let border = asObject(v.border);
    let maskOps = asArray(v.maskOps);
    let paintOps = asArray(v.paintOps);
    if (maskOps.length + paintOps.length > LIMITS.ops) rejectProject(`${where} has more than ${LIMITS.ops} operations.`);
    let shapes = asArray(v.shapes);
    if (shapes.length > LIMITS.shapes) rejectProject(`${where} has more than ${LIMITS.shapes} shapes.`);
    let texts = asArray(v.texts);
    if (texts.length > LIMITS.texts) rejectProject(`${where} has more than ${LIMITS.texts} texts.`);
    let pieces = asArray(v.pieces);
    if (pieces.length > LIMITS.pieces) rejectProject(`${where} has more than ${LIMITS.pieces} logo pieces.`);
    let colors = clampInt(adj.colors, 0, 32, 0);
    return {
        id: v.id,
        name,
        fit: validFit(v.fit, where),
        pieces: pieces.map((p) => {
            p = asObject(p);
            let c = asArray(p.crop).map((x) => clampNum(x, -1e6, 1e6, 0));
            if (c.length !== 4 || c[2] <= c[0] || c[3] <= c[1]) rejectProject(`${where}: a logo piece has no area.`);
            return { id: p.id, crop: c, fit: validFit(p.fit, where) };
        }),
        background: validHex(v.background, `${where}: background`, true),
        frame: {
            kind: enumOr(frame.kind, ["square", "rounded", "circle"], "square"),
            radius: clampNum(frame.radius, 0, 20, def.frame.radius),
            ring: ring ? { width: clampNum(ring.width, 0, 20, 1.1), color: validHex(ring.color, `${where}: ring colour`) } : null,
            outside: validHex(frame.outside, `${where}: outside colour`, true),
            breakOut: boolOr(frame.breakOut, false),
        },
        cutout: {
            mode: enumOr(cut.mode, ["off", "edge", "all"], "off"),
            color: cut.color === "auto" || cut.color == null ? "auto" : validHex(cut.color, `${where}: cut-out colour`),
            tolerance: clampNum(cut.tolerance, 0, 0.3, def.cutout.tolerance),
            softness: clampNum(cut.softness, 0, 4, def.cutout.softness),
            mainPart: boolOr(cut.mainPart, false),
        },
        maskOps: maskOps.map((o) => validMaskOp(o, where)),
        paintOps: paintOps.map((o) => validPaintOp(o, where)),
        adjust: {
            brightness: clampNum(adj.brightness, -100, 100, 0),
            contrast: clampNum(adj.contrast, -100, 100, 0),
            saturation: clampNum(adj.saturation, -100, 100, 0),
            thicken: Math.round(clampNum(adj.thicken, 0, 1, 0) * 8) / 8,
            colors: colors > 0 && colors < 4 ? 4 : colors,
        },
        shapes: shapes.map((s) => validShape(s, where)),
        texts: texts.map((t) => validTextBlock(t, where)),
        border: { width: clampNum(border.width, 0, 2, def.border.width), color: validHex(border.color, `${where}: border colour`, true) },
        transparent: enumOr(v.transparent, ["auto", "cutout", "shape", "rounded"], "auto"),
        resample: enumOr(v.resample, ["lanczos3", "box"], "lanczos3"),
        alphaFloor: clampInt(v.alphaFloor, 0, 64, def.alphaFloor),
        pixels: { opaque: validPixels(asObject(v.pixels).opaque, where), transparent: validPixels(asObject(v.pixels).transparent, where) },
    };
}

/**
 * A trusted copy of a project (or project file): readable errors for anything that can't be used,
 * numbers clamped to their ranges, unknown keys dropped. Older versions are migrated here.
 */
export function validateProject(json) {
    let p = asObject(json);
    if (p.format !== PROJECT_FORMAT) rejectProject("This isn't an avatar project file.");
    if (!Number.isInteger(p.version) || p.version < 1) rejectProject("This project file has no valid version.");
    if (p.version > PROJECT_VERSION) rejectProject("This project was made with a newer version of the avatar maker.");
    let src = asObject(p.source);
    let width = clampInt(src.width, 1, 16384, 0);
    let height = clampInt(src.height, 1, 16384, 0);
    if (!width || !height) rejectProject("The project doesn't say how big its logo is.");
    let variants = asArray(p.variants);
    if (!variants.length) rejectProject("The project has no variants.");
    if (variants.length > LIMITS.variants) rejectProject(`The project has more than ${LIMITS.variants} variants.`);
    let team = p.team && Number.isInteger(asObject(p.team).number) && p.team.number > 0 ? { number: p.team.number, name: String(p.team.name ?? "").slice(0, 120) } : null;
    let out = {
        format: PROJECT_FORMAT,
        version: PROJECT_VERSION,
        team,
        source: { name: String(src.name ?? "logo").slice(0, 200), width, height, kind: enumOr(src.kind, ["logo", "avatar"], "logo") },
        selected: null,
        variants: variants.map((v, i) => validVariant(v, i + 1)),
    };
    // Ids: a prefix and an integer, unique in the project.
    let seen = new Set();
    let id = (value, prefix, what) => {
        if (typeof value !== "string" || !new RegExp(`^${prefix}\\d+$`).test(value)) rejectProject(`A ${what} has no valid id.`);
        if (seen.has(value)) rejectProject(`The id ${value} is used twice.`);
        seen.add(value);
    };
    for (let v of out.variants) {
        id(v.id, "v", "variant");
        for (let s of v.shapes) id(s.id, "s", "shape");
        for (let t of v.texts) id(t.id, "t", "text");
        for (let piece of v.pieces) id(piece.id, "p", "logo piece");
    }
    out.selected = out.variants.some((v) => v.id === p.selected) ? p.selected : out.variants[0].id;
    let assets = asObject(p.assets);
    if (typeof assets.source === "string" && assets.source.startsWith("data:image/png;base64,")) out.assets = { source: assets.source };
    return out;
}
