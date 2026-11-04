// Types for the avatar maker core (avatar/core/avatar.mjs). Not part of the npm package.

export declare const AVATAR_SIZE: 40;
export declare const WORK_SCALE: 8;
export declare const WORK_SIZE: 320;

/** 8-bit straight RGBA. */
export interface Image8 {
    width: number;
    height: number;
    data: Uint8ClampedArray;
}

/** Premultiplied RGBA floats in 0..1. */
export interface Raster {
    width: number;
    height: number;
    data: Float32Array;
}

/** The normalised logo (section 9.1), kept as 8-bit straight RGBA. */
export interface Source {
    width: number;
    height: number;
    rgba: Uint8ClampedArray;
    hasAlpha: boolean;
    name: string;
    kind: "logo" | "avatar";
}

export interface SourceInfo {
    name?: string;
    width: number;
    height: number;
    kind?: "logo" | "avatar";
}

/** "#rrggbb" */
export type Hex = string;

export interface Fit {
    /** Frame px per source px. */
    scale: number;
    /** Frame position of the oriented source's top-left corner. */
    x: number;
    y: number;
    rotate: 0 | 90 | 180 | 270;
    flip: boolean;
    sampling: "auto" | "smooth" | "pixel";
    anchor: "free" | "top";
}

export type MaskOp =
    | { op: "erase" | "restore"; kind: "stroke"; size: number; hardness: number; points: [number, number][] }
    | { op: "erase" | "restore"; kind: "wand"; x: number; y: number; tolerance: number; contiguous: boolean };

export type PaintOp =
    | { kind: "brush"; color: Hex; alpha: number; size: number; hardness: number; points: [number, number][] }
    | { kind: "fill"; x: number; y: number; color: Hex; tolerance: number; contiguous: boolean }
    | { kind: "clone"; dx: number; dy: number; size: number; hardness: number; points: [number, number][] };

interface ShapeBase {
    id: string;
    fill: Hex | null;
    stroke: Hex | null;
    width: number;
    layer: "below" | "above";
}
export type Shape =
    | (ShapeBase & { type: "ellipse"; cx: number; cy: number; rx: number; ry: number })
    | (ShapeBase & { type: "ring"; cx: number; cy: number; r: number; start: number; end: number })
    | (ShapeBase & { type: "rect"; x: number; y: number; w: number; h: number; radius: number })
    | (ShapeBase & { type: "polygon"; points: [number, number][] })
    | (ShapeBase & { type: "line"; x1: number; y1: number; x2: number; y2: number });

export interface TextBlock {
    id: string;
    lines: string[];
    font: "bold" | "light";
    scale: 1 | 2;
    align: "left" | "center" | "right";
    x: number;
    y: number;
    color: Hex;
    outline: Hex | null;
    plate: { color: Hex; pad: number; radius: number } | null;
    letterSpacing: number;
    lineGap: number;
    /** A name bar (section 10.5). */
    segments?: { text: string; color: Hex }[];
    width?: number | "fill";
    radius?: number | "pill";
    pad?: number;
}

export interface Piece {
    id: string;
    crop: [number, number, number, number];
    fit: Fit;
}

export interface Variant {
    id: string;
    name: string;
    fit: Fit;
    pieces: Piece[];
    background: Hex | null;
    frame: { kind: "square" | "rounded" | "circle"; radius: number; ring: { width: number; color: Hex } | null; outside: Hex | null; breakOut: boolean };
    cutout: { mode: "off" | "edge" | "all"; color: "auto" | Hex; tolerance: number; softness: number; mainPart: boolean };
    maskOps: MaskOp[];
    paintOps: PaintOp[];
    adjust: { brightness: number; contrast: number; saturation: number; thicken: number; colors: number };
    shapes: Shape[];
    texts: TextBlock[];
    border: { width: number; color: Hex | null };
    transparent: "auto" | "cutout" | "shape" | "rounded";
    resample: "lanczos3" | "box";
    alphaFloor: number;
    /** [x, y, "#rrggbbaa"] per output, applied last. */
    pixels: { opaque: [number, number, string][]; transparent: [number, number, string][] };
}

export interface Project {
    format: "ftc-avatar-project";
    version: 1;
    team: { number: number; name: string } | null;
    source: { name: string; width: number; height: number; kind: "logo" | "avatar" };
    selected: string;
    variants: Variant[];
    /** Only in project files: the source as a PNG data URL. */
    assets?: { source: string };
}

export interface Assets {
    source: Source;
}

export interface RenderInfo {
    sampling: "smooth" | "pixel";
    transparentMode: "cutout" | "shape" | "rounded";
    hasCutout: boolean;
    background: Hex | null;
    /** Subject alpha at 40 × 40, before the background. */
    subjectAlpha: Float32Array;
    /** Frame coverage at 40 × 40. */
    frameCoverage: Float32Array;
    /** The subject box in frame px. */
    subjectBox: { x: number; y: number; w: number; h: number };
}

export interface RenderResult {
    opaque: Image8;
    transparent: Image8;
    work: { opaque: Raster; transparent: Raster };
    info: RenderInfo;
}

export type CheckId = "C1" | "C2" | "C3" | "C4" | "C5" | "C6" | "C7" | "C8" | "C9" | "C10" | "C11" | "C12" | "C13" | "C14";

export interface Check {
    id: CheckId;
    level: "error" | "warning" | "info";
    output: "opaque" | "transparent" | null;
    params: Record<string, unknown>;
    fix?: { action: string; [key: string]: unknown };
}

export type FitMode = "fit" | "fillWidth" | "cutBottom" | "centre";

export declare function sourceFromRGBA(width: number, height: number, rgba: Uint8ClampedArray, name?: string): Source;
export declare function subjectBox(source: Source, rotate?: number, flip?: boolean): { x: number; y: number; w: number; h: number };
export declare function resolveSampling(fit: Fit, sourceInfo: { kind: "logo" | "avatar"; width: number }): "smooth" | "pixel";
export declare function resolveTransparent(variant: Variant, sourceInfo: { hasAlpha: boolean }, hasCutout?: boolean): "cutout" | "shape" | "rounded";
export declare function fitFor(mode: FitMode, variant: Variant, source: Source, margin?: number): Fit | null;
export declare function zoomFit(variant: Variant, source: Source, scale: number, margin?: number): Fit;
export declare function orientFit(variant: Variant, source: Source, rotate: Fit["rotate"], flip: boolean): Fit;
export declare function quantizeColors(image: Image8, n: number, floor: number): void;
export declare function render(project: Project, variantId: string, assets: Assets): RenderResult;

export declare const MAX_BYTES: 20000;
export declare function runChecks(result: RenderResult, project: Project, variantId: string, bytes?: { opaque: number; transparent: number } | null): Check[];
export declare function applyFix(project: Project, variantId: string, check: Check, ctx: { result: RenderResult; source: Source }): Project | null;
export declare function contentBox(result: RenderResult, variant: Variant): [number, number, number, number] | null;
export declare function chromaKeyOf(r: number, g: number, b: number): "lime" | "magenta" | null;

export declare const PROJECT_FORMAT: "ftc-avatar-project";
export declare const PROJECT_VERSION: 1;
export declare const LIMITS: { variants: number; ops: number; points: number; shapes: number; texts: number; pieces: number; pixels: number; history: number };
export declare function wholeFit(width: number, height: number, kind?: "logo" | "avatar"): Fit;
export declare function defaultVariant(id: string, name: string, fit: Fit): Variant;
export declare function newProject(info: SourceInfo, team?: { number: number; name: string } | null): Project;
export declare function nextId(project: Project, prefix: "v" | "s" | "t" | "p"): string;
export declare function projectToFile(project: Project, sourcePngDataUrl: string): string;
/** Throws an Error with a readable message; migrates old versions. */
export declare function validateProject(json: unknown): Project;

export declare function encodePNG(image: Image8, opts: { alpha: boolean }, deflate: (data: Uint8Array) => Promise<Uint8Array>): Promise<Uint8Array>;
export declare function decodePNG(bytes: Uint8Array, inflate: (data: Uint8Array) => Uint8Array | Promise<Uint8Array>): Promise<Image8>;
export declare function deflateStored(data: Uint8Array): Promise<Uint8Array>;
export declare function crc32(bytes: Uint8Array, crc?: number): number;
export declare function makeZip(files: { name: string; data: Uint8Array; date: Date }[]): Uint8Array;

export type RGB = [number, number, number];
export type Lab = [number, number, number];
export declare function clamp01(x: number): number;
export declare function srgbToLinear(c: number): number;
export declare function linearToSrgb(c: number): number;
export declare function linearToOklab(r: number, g: number, b: number): Lab;
export declare function oklabToLinear(L: number, a: number, b: number): RGB;
export declare function srgbToOklab(rgb: ArrayLike<number>): Lab;
export declare function oklabToSrgb(lab: ArrayLike<number>): RGB;
export declare function oklabToOklch(lab: ArrayLike<number>): [number, number, number];
export declare function oklchToOklab(lch: ArrayLike<number>): Lab;
export declare function deltaE(lab1: ArrayLike<number>, lab2: ArrayLike<number>): number;
export declare function rgbToHsv(r: number, g: number, b: number): [number, number, number];
export declare function hsvToRgb(h: number, s: number, v: number): RGB;
export declare function parseHex(hex: string): [number, number, number, number] | null;
export declare function formatHex(rgb: ArrayLike<number>, withAlpha?: boolean): string;
export declare function relativeLuminance(rgb: ArrayLike<number>): number;
export declare function contrastRatio(rgb1: ArrayLike<number>, rgb2: ArrayLike<number>): number;
export declare function colorToAlpha(c: ArrayLike<number>, b: ArrayLike<number>): { alpha: number; color: RGB };

export interface RowReader {
    width: number;
    height: number;
    row(j: number, out: Float32Array): void;
}
export interface Weights {
    start: Int32Array;
    idx: Int32Array;
    wt: Float64Array;
}
export declare function createRaster(width: number, height: number): Raster;
export declare function rasterFromRGBA8(width: number, height: number, rgba: ArrayLike<number>): Raster;
export declare function rasterToImage8(r: Raster): Image8;
export declare function cloneRaster(r: Raster): Raster;
export declare function compositeOver(dst: Raster, src: Raster): void;
export declare function fillOver(dst: Raster, rgb: ArrayLike<number>, coverage?: Float32Array | null): void;
export declare function multiplyCoverage(r: Raster, coverage: Float32Array): void;
export declare function lanczos3(x: number): number;
export declare function resampleWeights(outSize: number, srcSize: number, scale: number, offset: number, filter: "lanczos3" | "nearest", edge?: "zero" | "clamp"): Weights;
export declare function rowsFromRGBA8(width: number, height: number, rgba: ArrayLike<number>): RowReader;
export declare function rowsFromRaster(r: Raster): RowReader;
export declare function resampleRows(src: RowReader, width: number, height: number, sx: number, ox: number, sy: number, oy: number, filter: "lanczos3" | "nearest", edge?: "zero" | "clamp"): Raster;
export declare function halveRows(src: RowReader): Raster;
export declare function boxReduce(r: Raster, k: number): Raster;
export declare function boxReduceChannel(values: ArrayLike<number>, width: number, height: number, k: number): Float32Array;
export declare function orientRGBA(width: number, height: number, rgba: Uint8ClampedArray, rotate: number, flip: boolean): { width: number; height: number; rgba: Uint8ClampedArray };
export declare function distanceTransform(mask: ArrayLike<number>, width: number, height: number): Float64Array;
export declare function floodFill(ok: ArrayLike<number>, width: number, height: number, seeds: number[]): Uint8Array;
export declare function labelComponents(mask: ArrayLike<number>, width: number, height: number): { labels: Int32Array; count: number; areas: number[]; boxes: [number, number, number, number][] };
export declare function mulberry32(seed: number): () => number;
