/*!
 * ftc-pit-map: render FTC pit maps (ApiV3PitMap JSON) as interactive SVG.
 * Zero dependencies. Works with plain JS, React, Vue, Svelte, Angular, ...
 * Schema: https://github.com/maths22/ftc-api-v3-client-ruby/blob/master/docs/ApiV3PitMap.md
 * License: MIT
 */

import { getPitMap, parseEventRef } from "../core/api.mjs";
export { configure, getPitMap, EmbedsApiError, PIT_MAP_QUERY } from "../core/api.mjs";

const SVG_NS = "http://www.w3.org/2000/svg";
const PREFIX = "ftcpm";

export const CELL_TYPES = [
    "EMPTY",
    "BOUNDARY",
    "PIT",
    "HORIZONTAL_FIELD",
    "VERTICAL_FIELD",
    "OBJECT",
    "LABEL",
];

const QUEUE_RE = /\bqueu/i; // "Queue", "Queueing", "QUEUE"

/** Element types that people can't walk through (used for routing). */
const BLOCKING = new Set(["BOUNDARY", "PIT", "OBJECT", "HORIZONTAL_FIELD", "VERTICAL_FIELD"]);

// ------------------------------------------------------------------ themes
//
// A theme is a flat object of style tokens. Every token can be overridden, and any value
// may be a CSS expression such as "var(--theme-color, #2c666e)": it's resolved against the
// page at render time (and re-resolved when the page's theme class changes).

/** Shape, typography and effects shared by the built-in color themes. */
const BASE_STYLE = {
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    uiFontFamily: null, // tooltip/controls; null = fontFamily
    numberWeight: 700, // team numbers in pits
    numberSize: 0.24, // team number height as a fraction of the pit's height (also capped by its width)
    subWeight: 600, // pit number / address under the team number
    nameWeight: 500, // team names (when zoomed in)
    labelWeight: 700, // floor labels ("B STREET")
    labelTransform: "uppercase", // "uppercase" | "none" | "capitalize"
    labelLetterSpacing: 0.08, // em
    pitRadius: 0.3, // cells
    pitGap: 0.08, // inset per side, cells
    pitStrokeWidth: 0.05,
    objectRadius: 0.25, // labelled areas ("Pit Admin", "Queue", …)
    fieldRadius: 0.3, // field elements; the field square and stations scale from this
    wallRadius: 0.12, // corners of each connected wall outline
    elementStroke: "none", // outline drawn around walls/objects/fields ("none" = off)
    elementStrokeWidth: 0.05,
    fieldStyle: "detailed", // "detailed" (tiles, alliance sides, table) | "stations" (FTC-Events style outlines)
    gridDot: null, // set per color theme; "none" hides the dot grid
    shadows: true, // drop shadow under fields
    glow: true, // glow around highlighted pits
    dimOpacity: 0.4, // opacity of other pits while some are highlighted
    outlineWidth: 0.17, // cells
    hoverStrokeWidth: 0.12,
    hoverStroke: null, // border color of a hovered pit; null = keep the pit's own border color
    routeWidth: 0.22, // cells
    routeCasingWidth: 0.42,
    routeCornerRadius: 0.7, // cells; 0 = sharp corners
    routeDash: true, // animated dashes on the route
    uiRadius: 10, // px, tooltip & controls
    highlight: "#f59e0b", // default highlight color (option highlightColor wins)
    outline: "#ef4444", // default outline color (option outlineColor wins)
    focus: "#3b82f6",
};

export const THEMES = {
    light: {
        ...BASE_STYLE,
        background: "#f5f6f8",
        gridDot: "#d5dae1",
        wall: "#394150",
        pitBase: "#ffffff", // pit colors are mixed towards this
        pitMix: 0.4, // 0 = raw event color, 1 = pitBase
        pitDefault: "#dfe4ea", // pits without a color
        pitStroke: "rgba(15, 23, 42, 0.16)",
        pitEmpty: "#eceff3",
        textDark: "#111827",
        textLight: "#ffffff",
        objectFill: "#e6e9ee",
        objectHatch: "#cdd3dc", // "none" = solid fill
        objectStroke: "#cdd3dc",
        objectText: "#4b5563",
        label: "#64748b",
        fieldZone: "#e3e8ef",
        fieldMat: "#4a5260",
        fieldTile: "#5a6372",
        fieldStation: "#94a3b8", // both ends of a field when the alliance sides are unknown
        fieldRed: "#e5484d",
        fieldBlue: "#3e63dd",
        fieldStroke: "#94a3b8",
        route: "#7c3aed",
        routeCasing: "#ffffff",
        tooltipBg: "rgba(255, 255, 255, 0.97)",
        tooltipText: "#0f172a",
        tooltipMuted: "#64748b",
        tooltipBorder: "rgba(15, 23, 42, 0.10)",
        controlBg: "rgba(255, 255, 255, 0.92)",
        controlText: "#334155",
        shadow: "rgba(15, 23, 42, 0.18)",
    },
    dark: {
        ...BASE_STYLE,
        background: "#0e1015",
        gridDot: "#252a33",
        wall: "#5a6476",
        pitBase: "#171a21",
        pitMix: 0.42,
        pitDefault: "#2a2f39",
        pitStroke: "rgba(255, 255, 255, 0.10)",
        pitEmpty: "#191c23",
        textDark: "#0b0d12",
        textLight: "#f3f5f8",
        objectFill: "#1a1e26",
        objectHatch: "#2b313c",
        objectStroke: "#2b313c",
        objectText: "#9aa3b2",
        label: "#8b95a5",
        fieldZone: "#161920",
        fieldMat: "#2b303a",
        fieldTile: "#363c48",
        fieldStation: "#6b7385",
        fieldRed: "#e5484d",
        fieldBlue: "#5b7bff",
        fieldStroke: "#4b5563",
        route: "#a78bfa",
        routeCasing: "#0e1015",
        tooltipBg: "rgba(24, 27, 34, 0.97)",
        tooltipText: "#f3f5f8",
        tooltipMuted: "#9aa3b2",
        tooltipBorder: "rgba(255, 255, 255, 0.08)",
        controlBg: "rgba(24, 27, 34, 0.92)",
        controlText: "#d4d9e1",
        shadow: "rgba(0, 0, 0, 0.5)",
        focus: "#6d9bff",
    },
};

// FTCScout (ftcscout.org): reads the site's own CSS variables, so it follows its light/dark
// switch (body.dark) automatically. The fallbacks are FTCScout's light values.
const ftcscout = (d) => ({
    ...BASE_STYLE,
    fontFamily: `var(--font-family, "Inter", sans-serif)`,
    numberWeight: 600,
    subWeight: 500,
    labelWeight: 600,
    labelTransform: "uppercase",
    labelLetterSpacing: 0.06,
    pitRadius: 0.16,
    pitGap: 0.07,
    objectRadius: 0.16,
    fieldRadius: 0.16,
    wallRadius: 0.06,
    uiRadius: 8,
    glow: false,
    background: `var(--fg-color, ${d ? "rgb(45, 45, 45)" : "#ffffff"})`,
    gridDot: `var(--sep-color, ${d ? "#4a4e51" : "lightgray"})`,
    // Text color mixed into the surface: dark walls in light mode, light walls in dark mode.
    wall: `color-mix(in srgb, var(--text-color, ${d ? "#dfe2e6" : "#000000"}) ${d ? 55 : 85}%, var(--fg-color, ${d ? "rgb(45, 45, 45)" : "#ffffff"}))`,
    pitBase: `var(--fg-color, ${d ? "rgb(45, 45, 45)" : "#ffffff"})`,
    pitMix: d ? 0.3 : 0.35,
    pitDefault: `var(--form-bg-color, ${d ? "#191919" : "#efefef"})`,
    pitStroke: `var(--sep-color, ${d ? "#4a4e51" : "lightgray"})`,
    pitEmpty: `var(--zebra-stripe-color, ${d ? "#353535" : "rgb(245, 245, 245)"})`,
    textDark: "#000000",
    textLight: "#ffffff",
    objectFill: `var(--bg-color, ${d ? "#161616" : "#f2f2f2"})`,
    objectHatch: `var(--sep-color, ${d ? "#4a4e51" : "lightgray"})`,
    objectStroke: `var(--sep-color, ${d ? "#4a4e51" : "lightgray"})`,
    objectText: `var(--secondary-text-color, ${d ? "#b7b7b8" : "#636466"})`,
    label: `var(--secondary-text-color, ${d ? "#b7b7b8" : "#636466"})`,
    fieldZone: `var(--bg-color, ${d ? "#161616" : "#f2f2f2"})`,
    fieldMat: d ? "#3a3a3a" : "#4a4a4a",
    fieldTile: d ? "#474747" : "#5a5a5a",
    fieldStation: `var(--secondary-text-color, ${d ? "#b7b7b8" : "#636466"})`,
    fieldRed: `var(--red-team-color, ${d ? "rgb(175, 29, 29)" : "rgb(244, 67, 54)"})`,
    fieldBlue: `var(--blue-team-color, ${d ? "rgb(25, 103, 165)" : "rgb(33, 150, 243)"})`,
    fieldStroke: `var(--sep-color, ${d ? "#4a4e51" : "lightgray"})`,
    route: `var(--inline-theme-color, ${d ? "#39848e" : "rgb(44, 102, 110)"})`,
    routeCasing: `var(--fg-color, ${d ? "rgb(45, 45, 45)" : "#ffffff"})`,
    // FTCScout's focused-team color (selected team on the event page) and its hover outline.
    highlight: `var(--neutral-team-color, ${d ? "rgb(127, 0, 190)" : "rgb(170, 0, 255)"})`,
    hoverStroke: `var(--neutral-team-color, ${d ? "rgb(127, 0, 190)" : "rgb(170, 0, 255)"})`,
    hoverStrokeWidth: 0.08,
    outline: `var(--red-team-color, ${d ? "rgb(175, 29, 29)" : "rgb(244, 67, 54)"})`,
    focus: `var(--inline-theme-color, ${d ? "#39848e" : "rgb(44, 102, 110)"})`,
    tooltipBg: `var(--fg-color, ${d ? "rgb(45, 45, 45)" : "#ffffff"})`,
    tooltipText: `var(--text-color, ${d ? "#dfe2e6" : "#000000"})`,
    tooltipMuted: `var(--secondary-text-color, ${d ? "#b7b7b8" : "#636466"})`,
    tooltipBorder: `var(--sep-color, ${d ? "#4a4e51" : "lightgray"})`,
    controlBg: `var(--fg-color, ${d ? "rgb(45, 45, 45)" : "#ffffff"})`,
    controlText: `var(--text-color, ${d ? "#dfe2e6" : "#000000"})`,
    shadow: `var(--fade-shadow, ${d ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.2)"})`,
});
THEMES.ftcscout = ftcscout(false);
THEMES["ftcscout-dark"] = ftcscout(true);

// FTC-Events (ftc-events.firstinspires.org/…/pitMap): flat, printable, black outlines,
// raw event colors, Roboto, cyan selection (like its own canvas pit map).
THEMES["ftc-events"] = {
    ...BASE_STYLE,
    fontFamily: 'Roboto, "Helvetica Neue", Arial, sans-serif',
    numberWeight: 500,
    subWeight: 400,
    nameWeight: 400,
    labelWeight: 500,
    labelTransform: "none",
    labelLetterSpacing: 0,
    pitRadius: 0,
    pitGap: 0,
    pitStrokeWidth: 0.05,
    objectRadius: 0,
    fieldRadius: 0,
    wallRadius: 0,
    elementStroke: "#000000",
    elementStrokeWidth: 0.05,
    fieldStyle: "stations",
    shadows: false,
    glow: false,
    dimOpacity: 0.5,
    outlineWidth: 0.16,
    hoverStrokeWidth: 0.1,
    routeWidth: 0.2,
    routeCasingWidth: 0.36,
    routeCornerRadius: 0,
    routeDash: false,
    uiRadius: 6,
    uiFontFamily: 'Roboto, "Helvetica Neue", Arial, sans-serif',
    highlight: "cyan",
    outline: "#ed1c24",
    focus: "#0066b3",
    background: "#ffffff",
    gridDot: "none",
    wall: "#000000",
    pitBase: "#ffffff",
    pitMix: 0,
    pitDefault: "orange",
    pitStroke: "#000000",
    pitEmpty: "orange",
    textDark: "#000000",
    textLight: "#ffffff",
    objectFill: "#ffffff",
    objectHatch: "none",
    objectStroke: "#000000",
    objectText: "#000000",
    label: "#000000",
    fieldZone: "#ffffff",
    fieldMat: "#ffffff",
    fieldTile: "none",
    fieldStation: "none",
    fieldRed: "none",
    fieldBlue: "none",
    fieldStroke: "#000000",
    route: "#0066b3",
    routeCasing: "#ffffff",
    tooltipBg: "#ffffff",
    tooltipText: "#212529",
    tooltipMuted: "#606060",
    tooltipBorder: "rgba(0, 0, 0, 0.175)",
    controlBg: "#ffffff",
    controlText: "#003974",
    shadow: "rgba(0, 0, 0, 0.15)",
};

const isNone = (v) => v == null || v === "" || v === "none" || v === "transparent" || v === false;

const DEFAULTS = {
    data: null, // ApiV3PitMap JSON; or let the widget fetch it with `event`
    event: null, // "2025/FPEEUR" or { season, code }: load the pit map from the ftc-embeds API
    apiBase: null, // REST API base for this widget (default: configure({ apiBase }))
    graphqlUrl: null, // or a GraphQL endpoint (default: configure({ graphqlUrl }))
    messages: {
        loading: "Loading pit map…",
        notFound: "No pit map has been published for this event.",
        error: "Couldn't load the pit map.",
    },
    // "auto" | "light" | "dark" | "ftcscout" | "ftcscout-dark" | "ftc-events",
    // or an object of tokens: { base: "ftc-events", pitRadius: 0.2, route: "var(--brand)" }
    theme: "auto",
    watchTheme: true, // re-resolve CSS variables when <html>/<body> class/style/data-theme change
    highlight: null, // "16236" | ["1","2"] | {"16236": "#f00"} | [{team, color}]
    outline: null, // same forms as highlight
    highlightColor: null, // null = the theme's highlight color
    outlineColor: null, // null = the theme's outline color
    pitStyle: null, // (team, element, state) => { fill, stroke, strokeWidth, text, radius, opacity } per pit
    // Which end of each field is red. The pit map data doesn't record this, so the default
    // (null) draws both ends neutral. "red-first" = red at the top/left end, "blue-first" =
    // blue there, or (fieldElement) => "red-first" | "blue-first" | null per field.
    fieldAlliances: null,
    className: "", // extra class(es) on the root element
    dimOthers: true, // fade pits that are not highlighted/outlined while something is
    pulse: true, // animated ring around highlighted pits
    colorBy: null, // (team, element) => color | null   (e.g. heatmaps)
    showPitNumbers: null, // null = use the value from the data
    showPitAddresses: null,
    showTeamNames: "zoom", // true | false | "zoom" (only when zoomed in far enough)
    tooltip: true, // hover: true | false | (team, element, ctx) => string | Node | false
    popup: true, // click popup content: true (same as tooltip) | false | (team, element, ctx) => string | Node | false
    clickAction: "popup", // "popup" | "tooltip" | "focus" | "none" | (detail) => void
    controls: true, // zoom buttons
    zoom: true, // allow pan/zoom
    scrollZoom: "modifier", // true | false | "modifier" (ctrl/cmd + wheel, like embedded maps)
    maxZoom: 8,
    padding: 1, // cells of padding around the map
    pitSizeMeters: 3, // a standard pit is 3 x 3 m; sets the map scale for route distances
    metersPerCell: null, // override the scale directly (null = pitSizeMeters / pit size in cells)
    walkingSpeed: 1.3, // m/s
    ariaLabel: "Pit map",
    onPitClick: null,
    onPitHover: null,
};

// ------------------------------------------------------------------ color utils

let colorCtx = null;
function parseColor(input) {
    if (input == null) return null;
    let s = String(input).trim();
    let m = /^#([0-9a-f]{3,8})$/i.exec(s);
    if (m) {
        let h = m[1];
        if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
        return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    }
    m = /^rgba?\(([^)]+)\)$/i.exec(s);
    if (m) return m[1].split(/[\s,/]+/).slice(0, 3).map((v) => parseFloat(v));
    // Named colors etc.: let the browser resolve them.
    if (typeof document !== "undefined") {
        colorCtx = colorCtx || document.createElement("canvas").getContext("2d");
        if (colorCtx) {
            colorCtx.fillStyle = "#000";
            colorCtx.fillStyle = s;
            let r = colorCtx.fillStyle;
            if (r !== s) return parseColor(r);
        }
    }
    return null;
}

function toHex(rgb) {
    return "#" + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}

function mix(a, b, t) {
    let ca = parseColor(a);
    let cb = parseColor(b);
    if (!ca) return b;
    if (!cb) return a;
    return toHex(ca.map((v, i) => v + (cb[i] - v) * t));
}

function luminance(c) {
    let rgb = parseColor(c);
    if (!rgb) return 1;
    let [r, g, b] = rgb.map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function textOn(bg, theme) {
    // Pick whichever text color has the better contrast ratio.
    let L = luminance(bg);
    let cDark = (L + 0.05) / (luminance(theme.textDark) + 0.05);
    let cLight = (luminance(theme.textLight) + 0.05) / (L + 0.05);
    return cDark >= cLight ? theme.textDark : theme.textLight;
}

// ------------------------------------------------------------------ data

/** Normalize an ApiV3PitMap (camelCase or snake_case keys) into a predictable shape. */
export function normalizePitMap(raw) {
    if (!raw || typeof raw !== "object") throw new TypeError("PitMap: data must be an ApiV3PitMap object");
    let pick = (o, camel, snake, dflt) => (o[camel] !== undefined ? o[camel] : o[snake] !== undefined ? o[snake] : dflt);
    let elements = (raw.elements || []).map((e, i) => {
        let type = pick(e, "type", "type", "EMPTY");
        if (typeof type === "number") type = CELL_TYPES[type] || "EMPTY";
        type = String(type).toUpperCase();
        let team = e.team
            ? {
                  number: String(pick(e.team, "number", "number", "")),
                  name: pick(e.team, "name", "name", null),
                  displayNumber: String(pick(e.team, "displayNumber", "display_number", null) ?? pick(e.team, "number", "number", "")),
              }
            : null;
        return {
            i,
            type,
            x: +e.x || 0,
            y: +e.y || 0,
            width: Math.max(+e.width || 1, 0),
            height: Math.max(+e.height || 1, 0),
            label: pick(e, "label", "label", null),
            labelOrientation: String(pick(e, "labelOrientation", "label_orientation", "HORIZONTAL") || "HORIZONTAL").toUpperCase(),
            index: pick(e, "index", "index", null),
            team,
            address: pick(e, "address", "address", null),
            addressGroup: pick(e, "addressGroup", "address_group", null),
            color: pick(e, "color", "color", null),
        };
    });

    let minX = pick(raw, "minX", "min_x", null);
    let minY = pick(raw, "minY", "min_y", null);
    let width = pick(raw, "width", "width", null);
    let height = pick(raw, "height", "height", null);
    if (elements.length) {
        let x0 = Math.min(...elements.map((e) => e.x));
        let y0 = Math.min(...elements.map((e) => e.y));
        let x1 = Math.max(...elements.map((e) => e.x + e.width));
        let y1 = Math.max(...elements.map((e) => e.y + e.height));
        minX = minX ?? x0;
        minY = minY ?? y0;
        width = Math.max(width ?? 0, x1 - minX);
        height = Math.max(height ?? 0, y1 - minY);
    }
    return {
        minX: minX ?? 0,
        minY: minY ?? 0,
        width: width || 1,
        height: height || 1,
        showPitNumbers: !!pick(raw, "showPitNumbers", "show_pit_numbers", true),
        showPitAddresses: !!pick(raw, "showPitAddresses", "show_pit_addresses", false),
        elements,
    };
}

/** Turn the many accepted highlight/outline forms into Map<teamNumber, color>. */
function teamColorMap(input, fallback) {
    let map = new Map();
    if (input == null || input === false || input === "") return map;
    let add = (team, color) => {
        if (team == null || team === "") return;
        map.set(String(team).trim(), color || fallback);
    };
    if (Array.isArray(input)) {
        for (let item of input) {
            if (item && typeof item === "object") add(item.team ?? item.number, item.color);
            else add(item);
        }
    } else if (typeof input === "object") {
        for (let [team, color] of Object.entries(input)) add(team, typeof color === "string" ? color : null);
    } else {
        for (let part of String(input).split(/[\s,;]+/)) add(part);
    }
    return map;
}

// ------------------------------------------------------------------ DOM helpers

function svg(tag, attrs, parent) {
    let el = document.createElementNS(SVG_NS, tag);
    if (attrs) for (let k in attrs) if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
}

function fitText(text, maxW, maxH, ratio = 0.6) {
    let len = Math.max(String(text).length, 1);
    return Math.max(0.05, Math.min(maxH, maxW / (len * ratio)));
}

const STYLE_ID = `${PREFIX}-style`;
const CSS = `
.${PREFIX}{position:relative;overflow:hidden;border-radius:inherit;outline:none;-webkit-tap-highlight-color:transparent;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI"}
.${PREFIX}:focus-visible{box-shadow:inset 0 0 0 2px var(--${PREFIX}-focus,#3b82f6)}
.${PREFIX}-svg{display:block;width:100%;height:100%;touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab}
.${PREFIX}-svg.${PREFIX}-dragging{cursor:grabbing}
.${PREFIX}-svg text{pointer-events:none;font-variant-numeric:tabular-nums}
.${PREFIX}-pit{cursor:pointer;transition:opacity .25s ease}
.${PREFIX}-pit>.${PREFIX}-tile{transition:fill .25s ease,stroke .2s ease}
.${PREFIX}-pit:hover>.${PREFIX}-tile{stroke-width:var(--${PREFIX}-hover-stroke,.12);stroke:var(--${PREFIX}-hover-color,currentColor)}
.${PREFIX}:not(.${PREFIX}-has-hover-color) .${PREFIX}-pit:hover>.${PREFIX}-tile{stroke:unset}
.${PREFIX}-dim .${PREFIX}-pit:not(.${PREFIX}-on){opacity:var(--${PREFIX}-dim,.4)}
.${PREFIX}-name{display:none}
.${PREFIX}-names .${PREFIX}-name{display:inline}
.${PREFIX}-pulse{animation:${PREFIX}-pulse 1.8s ease-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes ${PREFIX}-pulse{0%{opacity:.85;transform:scale(1)}100%{opacity:0;transform:scale(1.55)}}
.${PREFIX}-route-line{animation:${PREFIX}-march 1s linear infinite}
@keyframes ${PREFIX}-march{to{stroke-dashoffset:-1.2}}
.${PREFIX}-flash{animation:${PREFIX}-flash .9s ease-out 2}
@keyframes ${PREFIX}-flash{50%{opacity:.25}}
.${PREFIX}-tip{position:absolute;left:0;top:0;z-index:2;pointer-events:none;min-width:150px;max-width:260px;padding:10px 12px;border-radius:var(--${PREFIX}-radius,10px);font-size:13px;line-height:1.35;box-shadow:0 8px 28px var(--${PREFIX}-shadow);border:1px solid var(--${PREFIX}-tip-border);background:var(--${PREFIX}-tip-bg);color:var(--${PREFIX}-tip-text);opacity:0;transform:translateY(4px);transition:opacity .12s ease,transform .12s ease;backdrop-filter:blur(6px)}
.${PREFIX}-tip.${PREFIX}-show{opacity:1;transform:none}
.${PREFIX}-tip-num{font-size:18px;font-weight:700;letter-spacing:-.01em;display:flex;align-items:center;gap:8px}
.${PREFIX}-tip-dot{width:10px;height:10px;border-radius:3px;flex:none;box-shadow:inset 0 0 0 1px rgba(0,0,0,.15)}
.${PREFIX}-tip-name{font-weight:500;margin-top:1px;overflow-wrap:anywhere}
.${PREFIX}-tip-meta{margin-top:6px;display:flex;flex-wrap:wrap;gap:4px 10px;color:var(--${PREFIX}-tip-muted);font-size:12px}
.${PREFIX}-tip-meta b{color:var(--${PREFIX}-tip-text);font-weight:600}
.${PREFIX}-popup{pointer-events:auto;z-index:4;max-width:300px;padding-right:30px}
.${PREFIX}-popup a{color:inherit}
.${PREFIX}-popup-close{all:unset;position:absolute;top:6px;right:6px;width:22px;height:22px;display:grid;place-items:center;border-radius:6px;cursor:pointer;color:var(--${PREFIX}-tip-muted);font-size:17px;line-height:1}
.${PREFIX}-popup-close:hover{background:var(--${PREFIX}-tip-border);color:var(--${PREFIX}-tip-text)}
.${PREFIX}-status{position:absolute;inset:0;z-index:2;display:grid;place-items:center;padding:16px;text-align:center;font-size:14px;color:var(--${PREFIX}-tip-muted);pointer-events:none}
.${PREFIX}-status[hidden]{display:none}
.${PREFIX}-ctrl{position:absolute;right:10px;bottom:10px;z-index:1;display:flex;flex-direction:column;border-radius:var(--${PREFIX}-radius,10px);overflow:hidden;box-shadow:0 2px 10px var(--${PREFIX}-shadow);background:var(--${PREFIX}-ctrl-bg)}
.${PREFIX}-ctrl button{all:unset;box-sizing:border-box;width:34px;height:34px;display:grid;place-items:center;cursor:pointer;color:var(--${PREFIX}-ctrl-text)}
.${PREFIX}-ctrl button+button{border-top:1px solid var(--${PREFIX}-tip-border)}
.${PREFIX}-ctrl button:hover{background:var(--${PREFIX}-tip-border)}
.${PREFIX}-ctrl button:focus-visible{box-shadow:inset 0 0 0 2px var(--${PREFIX}-focus,#3b82f6)}
.${PREFIX}-hint{position:absolute;inset:0;z-index:3;display:grid;place-items:center;pointer-events:none;background:rgba(0,0,0,.38);color:#fff;font-size:15px;font-weight:600;opacity:0;transition:opacity .2s ease}
.${PREFIX}-hint.${PREFIX}-show{opacity:1}
@media (prefers-reduced-motion:reduce){.${PREFIX}-pulse,.${PREFIX}-route-line,.${PREFIX}-flash{animation:none}.${PREFIX}-tip,.${PREFIX}-pit,.${PREFIX}-pit>.${PREFIX}-tile{transition:none}}
`;

function injectStyle(node) {
    let root = node.getRootNode ? node.getRootNode() : document;
    let host = root instanceof ShadowRoot ? root : document.head;
    if (!host || host.querySelector?.(`#${STYLE_ID}`)) return;
    let style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    host.appendChild(style);
}

const ICONS = {
    plus: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>',
    minus: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 8h10"/></svg>',
    fit: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/></svg>',
};

const prefersReducedMotion = () =>
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// ------------------------------------------------------------------ routing

class MinHeap {
    constructor() {
        this.a = [];
    }
    push(item, prio) {
        let a = this.a;
        a.push([prio, item]);
        let i = a.length - 1;
        while (i > 0) {
            let p = (i - 1) >> 1;
            if (a[p][0] <= a[i][0]) break;
            [a[p], a[i]] = [a[i], a[p]];
            i = p;
        }
    }
    pop() {
        let a = this.a;
        let top = a[0];
        let last = a.pop();
        if (a.length) {
            a[0] = last;
            let i = 0;
            for (;;) {
                let l = 2 * i + 1;
                let r = l + 1;
                let m = i;
                if (l < a.length && a[l][0] < a[m][0]) m = l;
                if (r < a.length && a[r][0] < a[m][0]) m = r;
                if (m === i) break;
                [a[m], a[i]] = [a[i], a[m]];
                i = m;
            }
        }
        return top && top[1];
    }
    get size() {
        return this.a.length;
    }
}

class WalkGrid {
    constructor(map, pad = 1) {
        this.ox = map.minX - pad;
        this.oy = map.minY - pad;
        this.w = Math.ceil(map.width) + pad * 2;
        this.h = Math.ceil(map.height) + pad * 2;
        this.blocked = new Uint8Array(this.w * this.h);
        for (let e of map.elements) {
            if (!BLOCKING.has(e.type)) continue;
            this.forCells(e, (cx, cy) => (this.blocked[cy * this.w + cx] = 1));
        }
    }
    forCells(e, fn) {
        let x0 = Math.floor(e.x - this.ox);
        let y0 = Math.floor(e.y - this.oy);
        let x1 = Math.ceil(e.x + e.width - this.ox);
        let y1 = Math.ceil(e.y + e.height - this.oy);
        for (let y = Math.max(0, y0); y < Math.min(this.h, y1); y++)
            for (let x = Math.max(0, x0); x < Math.min(this.w, x1); x++) fn(x, y);
    }
    free(cx, cy) {
        return cx >= 0 && cy >= 0 && cx < this.w && cy < this.h && !this.blocked[cy * this.w + cx];
    }
    /** Walkable cells touching an element's edge (where you'd stand to enter it). */
    doors(e) {
        let out = [];
        let seen = new Set();
        let x0 = Math.floor(e.x - this.ox);
        let y0 = Math.floor(e.y - this.oy);
        let x1 = Math.ceil(e.x + e.width - this.ox);
        let y1 = Math.ceil(e.y + e.height - this.oy);
        let add = (x, y) => {
            let k = y * this.w + x;
            if (this.free(x, y) && !seen.has(k)) {
                seen.add(k);
                out.push(k);
            }
        };
        for (let x = x0; x < x1; x++) {
            add(x, y0 - 1);
            add(x, y1);
        }
        for (let y = y0; y < y1; y++) {
            add(x0 - 1, y);
            add(x1, y);
        }
        return out;
    }
    /**
     * Shortest route that only moves horizontally/vertically. Each turn costs extra, so routes
     * have few corners; cells next to walls/pits cost a little more, so routes keep to the
     * middle of aisles. Returns the corner points (cell centers) or null.
     */
    path(starts, goals, { turnCost = 2, wallCost = 0.35 } = {}) {
        if (!starts.length || !goals.length) return null;
        let n = this.w * this.h;
        if (!this.nearWall) {
            this.nearWall = new Uint8Array(n);
            for (let y = 0; y < this.h; y++)
                for (let x = 0; x < this.w; x++)
                    for (let dy = -1; dy <= 1; dy++)
                        for (let dx = -1; dx <= 1; dx++)
                            if ((dx || dy) && !this.free(x + dx, y + dy) && x + dx >= 0 && y + dy >= 0 && x + dx < this.w && y + dy < this.h)
                                this.nearWall[y * this.w + x] = 1;
        }
        // State = cell * 5 + heading (0..3 = E, W, S, N; 4 = not moving yet).
        const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        let goalSet = new Set(goals);
        let dist = new Float64Array(n * 5).fill(Infinity);
        let prev = new Int32Array(n * 5).fill(-1);
        let heap = new MinHeap();
        for (let c of starts) {
            dist[c * 5 + 4] = 0;
            heap.push(c * 5 + 4, 0);
        }
        let end = -1;
        while (heap.size) {
            let st = heap.pop();
            let c = (st / 5) | 0;
            let dir = st % 5;
            if (goalSet.has(c)) {
                end = st;
                break;
            }
            let cx = c % this.w;
            let cy = (c - cx) / this.w;
            for (let d = 0; d < 4; d++) {
                let nx = cx + DIRS[d][0];
                let ny = cy + DIRS[d][1];
                if (!this.free(nx, ny)) continue;
                let nc = ny * this.w + nx;
                let cost = 1 + (this.nearWall[nc] ? wallCost : 0) + (dir !== 4 && dir !== d ? turnCost : 0);
                let ns = nc * 5 + d;
                let nd = dist[st] + cost;
                if (nd < dist[ns]) {
                    dist[ns] = nd;
                    prev[ns] = st;
                    heap.push(ns, nd);
                }
            }
        }
        if (end < 0) return null;
        let cells = [];
        for (let st = end; st !== -1; st = prev[st]) cells.push((st / 5) | 0);
        cells.reverse();
        let pts = cells.map((c) => [(c % this.w) + this.ox + 0.5, Math.floor(c / this.w) + this.oy + 0.5]);
        // Keep only the corners.
        let out = [pts[0]];
        for (let i = 1; i < pts.length - 1; i++) {
            let [a, b, c] = [pts[i - 1], pts[i], pts[i + 1]];
            if ((a[0] === b[0]) !== (b[0] === c[0]) || (a[1] === b[1]) !== (b[1] === c[1])) out.push(b);
        }
        if (pts.length > 1) out.push(pts[pts.length - 1]);
        return out;
    }
}

/**
 * Outline of the union of wall rects as SVG path data, corners rounded by `radius`.
 * Walls on the integer grid are traced cell by cell (outer outlines clockwise, holes
 * counter-clockwise, so the nonzero fill rule keeps enclosed floor open).
 */
function wallPath(walls, radius) {
    let integer = walls.every((e) => [e.x, e.y, e.width, e.height].every(Number.isInteger));
    if (!integer) return walls.map((e) => `M${e.x} ${e.y}h${e.width}v${e.height}h${-e.width}z`).join("");
    let cells = new Set();
    let key = (x, y) => `${x},${y}`;
    for (let e of walls) for (let y = e.y; y < e.y + e.height; y++) for (let x = e.x; x < e.x + e.width; x++) cells.add(key(x, y));
    // Directed boundary edges with the wall on their right (screen coordinates, y down).
    let out = new Map(); // "x,y" -> [[x2, y2], ...]
    let addEdge = (x1, y1, x2, y2) => {
        let k = key(x1, y1);
        if (!out.has(k)) out.set(k, []);
        out.get(k).push([x2, y2]);
    };
    for (let c of cells) {
        let [x, y] = c.split(",").map(Number);
        if (!cells.has(key(x, y - 1))) addEdge(x, y, x + 1, y);
        if (!cells.has(key(x + 1, y))) addEdge(x + 1, y, x + 1, y + 1);
        if (!cells.has(key(x, y + 1))) addEdge(x + 1, y + 1, x, y + 1);
        if (!cells.has(key(x - 1, y))) addEdge(x, y + 1, x, y);
    }
    let d = "";
    for (let [startKey, list] of out) {
        while (list.length) {
            let [sx, sy] = startKey.split(",").map(Number);
            let loop = [[sx, sy]];
            let [px, py] = [sx, sy];
            let next = list.pop();
            for (let guard = 0; next && guard < 1e6; guard++) {
                let [nx, ny] = next;
                if (nx === sx && ny === sy) break;
                loop.push([nx, ny]);
                let cands = out.get(key(nx, ny)) || [];
                if (!cands.length) break;
                // Where two outlines touch at a corner, turn right to keep them separate.
                let dx = nx - px;
                let dy = ny - py;
                let best = 0;
                let bestTurn = -Infinity;
                cands.forEach(([cx, cy], i) => {
                    let turn = dx * (cy - ny) - dy * (cx - nx);
                    if (turn > bestTurn) [best, bestTurn] = [i, turn];
                });
                [px, py] = [nx, ny];
                next = cands.splice(best, 1)[0];
            }
            // Drop points in the middle of straight runs.
            let pts = loop.filter((p, i) => {
                let a = loop[(i - 1 + loop.length) % loop.length];
                let b = loop[(i + 1) % loop.length];
                return (b[0] - p[0]) * (p[1] - a[1]) !== (b[1] - p[1]) * (p[0] - a[0]);
            });
            if (pts.length >= 3) d += roundedLoop(pts, radius);
        }
    }
    return d;
}

/** Closed polygon with rounded corners as SVG path data. */
function roundedLoop(pts, radius) {
    let n = pts.length;
    if (radius <= 0) return pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join("") + "Z";
    let d = "";
    for (let i = 0; i < n; i++) {
        let [p0, p1, p2] = [pts[(i - 1 + n) % n], pts[i], pts[(i + 1) % n]];
        let l1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
        let l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
        let r = Math.min(radius, l1 / 2, l2 / 2);
        let a = [p1[0] - ((p1[0] - p0[0]) / l1) * r, p1[1] - ((p1[1] - p0[1]) / l1) * r];
        let b = [p1[0] + ((p2[0] - p1[0]) / l2) * r, p1[1] + ((p2[1] - p1[1]) / l2) * r];
        d += `${i ? "L" : "M"}${a[0]} ${a[1]}Q${p1[0]} ${p1[1]} ${b[0]} ${b[1]}`;
    }
    return d + "Z";
}

/** Polyline with rounded corners (radius in map cells; 0 = sharp). */
function roundedPath(pts, radius) {
    if (pts.length < 3 || radius <= 0) return pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join("");
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length - 1; i++) {
        let [p0, p1, p2] = [pts[i - 1], pts[i], pts[i + 1]];
        let l1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
        let l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
        let r = Math.min(radius, l1 / 2, l2 / 2);
        if (!r) continue;
        let a = [p1[0] - ((p1[0] - p0[0]) / l1) * r, p1[1] - ((p1[1] - p0[1]) / l1) * r];
        let b = [p1[0] + ((p2[0] - p1[0]) / l2) * r, p1[1] + ((p2[1] - p1[1]) / l2) * r];
        d += `L${a[0]} ${a[1]}Q${p1[0]} ${p1[1]} ${b[0]} ${b[1]}`;
    }
    let last = pts[pts.length - 1];
    return d + `L${last[0]} ${last[1]}`;
}

// ------------------------------------------------------------------ main class

export class PitMap {
    /**
     * @param {HTMLElement} container element to render into (give it a size, or it uses the map's aspect ratio)
     * @param {object} options see README / pit-map.d.ts
     */
    constructor(container, options = {}) {
        if (!container) throw new TypeError("PitMap: container element is required");
        this.container = container;
        this.options = { ...DEFAULTS, ...options };
        this._listeners = new Map();
        this._cleanup = [];
        this._route = null;
        this._pitEls = new Map(); // element index -> <g>
        this._teamIndex = new Map(); // team number -> [elements]

        injectStyle(container);
        this.root = document.createElement("div");
        this.root.className = PREFIX;
        this.root.tabIndex = 0;
        this.root.style.width = "100%";
        this.root.style.height = "100%";
        container.appendChild(this.root);

        this.svg = svg("svg", { class: `${PREFIX}-svg`, part: "map", role: "img", "aria-label": this.options.ariaLabel });
        this.root.appendChild(this.svg);
        this.tip = document.createElement("div");
        this.tip.className = `${PREFIX}-tip`;
        this.tip.setAttribute("part", "tooltip");
        this.tip.setAttribute("role", "tooltip");
        this.root.appendChild(this.tip);
        this.hint = document.createElement("div");
        this.hint.className = `${PREFIX}-hint`;
        this.hint.textContent = `Use ${/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl"} + scroll to zoom`;
        this.root.appendChild(this.hint);

        this._bindInteraction();
        if (typeof matchMedia !== "undefined") {
            let mq = matchMedia("(prefers-color-scheme: dark)");
            let onScheme = () => this.refreshTheme();
            mq.addEventListener?.("change", onScheme);
            this._cleanup.push(() => mq.removeEventListener?.("change", onScheme));
        }
        if (typeof MutationObserver !== "undefined") {
            // Sites switch themes by toggling a class/attribute on <html> or <body> (FTCScout: body.dark).
            let mo = new MutationObserver(() => this.options.watchTheme && this.refreshTheme());
            let attributeFilter = ["class", "style", "data-theme", "data-bs-theme", "data-color-scheme"];
            mo.observe(document.documentElement, { attributes: true, attributeFilter });
            if (document.body) mo.observe(document.body, { attributes: true, attributeFilter });
            this._cleanup.push(() => mo.disconnect());
        }
        if (typeof ResizeObserver !== "undefined") {
            let ro = new ResizeObserver(() => this._updateLod());
            ro.observe(this.root);
            this._cleanup.push(() => ro.disconnect());
        }
        if (this.options.data) this.setData(this.options.data);
        else if (this.options.event) this.load(this.options.event);
    }

    /**
     * Load an event's pit map from the ftc-embeds API (a cached preset of a GraphQL query).
     * Shows loading / "no pit map" / error messages in the widget and emits "load" or "error".
     * Resolves to { season, code, updatedAt, pitMap }, or null on failure.
     */
    async load(event = this.options.event) {
        let token = (this._loadToken = {});
        this.options = { ...this.options, event };
        this._setStatus("loading");
        try {
            let ref = parseEventRef(event);
            let result = await getPitMap(ref, { apiBase: this.options.apiBase, graphqlUrl: this.options.graphqlUrl });
            if (token !== this._loadToken) return null; // a newer load() won
            this._setStatus(null);
            this.setData(result.pitMap);
            this._emit("load", result);
            return result;
        } catch (error) {
            if (token !== this._loadToken) return null;
            this.setData(null);
            this._setStatus(error && error.notFound ? "notFound" : "error", error);
            this._emit("error", { error, event });
            return null;
        }
    }

    _setStatus(kind, error) {
        if (!this._status) {
            this._status = document.createElement("div");
            this._status.className = `${PREFIX}-status`;
            this._status.setAttribute("part", "status");
            this._status.setAttribute("role", "status");
            this.root.appendChild(this._status);
        }
        let msg = kind ? this.options.messages?.[kind] ?? DEFAULTS.messages[kind] : "";
        this._status.textContent = msg;
        this._status.hidden = !kind;
        this._status.dataset.kind = kind || "";
        if (error && kind === "error") this._status.title = String(error.message || error);
    }

    // -------------------------------------------------------------- public API

    /** Replace the pit map data (ApiV3PitMap JSON). Resets the view. */
    setData(data) {
        this.closePopup?.();
        this.map = data ? normalizePitMap(data) : null;
        this._teamIndex.clear();
        if (this.map) {
            for (let e of this.map.elements) {
                if (e.type !== "PIT" || !e.team) continue;
                for (let key of new Set([e.team.number, e.team.displayNumber])) {
                    if (!this._teamIndex.has(key)) this._teamIndex.set(key, []);
                    this._teamIndex.get(key).push(e);
                }
            }
        }
        this._grid = null;
        this._route = null;
        this._renderAll(true);
        return this;
    }

    /** Merge new options and re-render what changed. */
    update(options = {}) {
        let prev = this.options;
        this.options = { ...prev, ...options };
        if ("data" in options && options.data !== prev.data) return this.setData(options.data);
        let sameEvent = (a, b) => {
            try {
                let [x, y] = [parseEventRef(a), parseEventRef(b)];
                return x.season === y.season && x.code === y.code;
            } catch {
                return a === b;
            }
        };
        if (options.event && (!prev.event || !sameEvent(options.event, prev.event))) {
            this.load(options.event);
            return this;
        }
        let full = ["theme", "showPitNumbers", "showPitAddresses", "padding", "controls", "colorBy", "className", "fieldAlliances"].some(
            (k) => k in options && options[k] !== prev[k]
        );
        if (full) this._renderAll(false);
        else this._renderPits();
        return this;
    }

    setHighlight(teams, color) {
        return this.update({ highlight: teams, ...(color ? { highlightColor: color } : {}) });
    }

    setOutline(teams, color) {
        return this.update({ outline: teams, ...(color ? { outlineColor: color } : {}) });
    }

    /** All teams on the map: [{number, name, displayNumber, address, label, color}] */
    getTeams() {
        if (!this.map) return [];
        return this.map.elements
            .filter((e) => e.type === "PIT" && e.team)
            .map((e) => ({ ...e.team, address: e.address, label: e.label, color: e.color }))
            .sort((a, b) => (parseInt(a.number) || 0) - (parseInt(b.number) || 0));
    }

    /** Search teams by (partial) number or name. */
    findTeams(query, limit = 10) {
        let q = String(query || "").trim().toLowerCase();
        if (!q) return [];
        let score = (t) => {
            if (t.number === q || t.displayNumber === q) return 0;
            if (t.number.startsWith(q) || t.displayNumber.startsWith(q)) return 1;
            if ((t.name || "").toLowerCase().startsWith(q)) return 2;
            if ((t.name || "").toLowerCase().includes(q)) return 3;
            if ((t.address || "").toLowerCase() === q) return 1;
            return -1;
        };
        return this.getTeams()
            .map((t) => [score(t), t])
            .filter(([s]) => s >= 0)
            .sort((a, b) => a[0] - b[0])
            .slice(0, limit)
            .map(([, t]) => t);
    }

    hasTeam(team) {
        return this._teamIndex.has(String(team).trim());
    }

    /** Smoothly zoom to a team's pit. Returns false if the team isn't on the map. */
    /**
     * Smoothly bring a team's pit into view.
     * - cells: width of the area to show around the pit (default 22, or a fraction of the map
     *   width when given as 0..1, e.g. 0.5 = half the map)
     * - keepZoom: never zoom in further than the current view, only pan (default false)
     * - onlyIfHidden: do nothing if the pit is already fully visible (default false)
     * - flash: briefly flash the pit (default true)
     */
    focusTeam(team, { cells = 22, flash = true, keepZoom = false, onlyIfHidden = false } = {}) {
        let els = this._teamIndex.get(String(team).trim());
        if (!els) return false;
        let e = els[0];
        let v = this.view;
        let visible =
            v && e.x >= v.x && e.y >= v.y && e.x + e.width <= v.x + v.w && e.y + e.height <= v.y + v.h;
        if (!(onlyIfHidden && visible)) {
            let cx = e.x + e.width / 2;
            let cy = e.y + e.height / 2;
            let aspect = this._aspect();
            let want = cells > 0 && cells <= 1 ? Math.max(20, cells * Math.max(this.map.width, this.map.height * aspect)) : cells;
            let w = Math.max(want, e.width * 3);
            if (keepZoom && v) w = Math.max(w, v.w);
            let h = w / aspect;
            this._animateTo(this._clampView({ x: cx - w / 2, y: cy - h / 2, w, h }));
        }
        if (flash) {
            let g = this._pitEls.get(e.i);
            if (g) {
                g.classList.remove(`${PREFIX}-flash`);
                requestAnimationFrame(() => g.classList.add(`${PREFIX}-flash`)); // restarts the animation
            }
        }
        return true;
    }

    /** Zoom out to show the whole map. */
    fit(animate = true) {
        if (!this.map) return;
        let v = this._fullView();
        animate ? this._animateTo(v) : this._setView(v);
    }

    zoomBy(factor, center) {
        if (!this.view) return;
        let c = center || [this.view.x + this.view.w / 2, this.view.y + this.view.h / 2];
        this._animateTo(this._zoomed(this.view, factor, c), 180);
    }

    /**
     * Draw a walking route. `from`/`to` can be a team number, "field" (nearest field),
     * "queue" (nearest queueing area), an area name like "Pit Admin", {area: "..." | RegExp},
     * or {x, y} in map cells. Returns {points, cells, meters, seconds, from, to} or null.
     */
    showRoute(from, to, { color } = {}) {
        let r = this.route(from, to);
        this._route = r ? { ...r, color } : null;
        this._renderRoute();
        return r;
    }

    clearRoute() {
        this._route = null;
        this._renderRoute();
    }

    /**
     * Named areas on the map (labelled objects and floor labels, e.g. "Queue", "Pit Admin"),
     * grouped by name: [{name, count, kind}] where kind is "queue" | "field" | "area".
     */
    getAreas() {
        if (!this.map) return [];
        let out = new Map();
        for (let e of this.map.elements) {
            if ((e.type !== "OBJECT" && e.type !== "LABEL") || !e.label) continue;
            if (/street$/i.test(e.label.trim())) continue; // aisle names aren't destinations
            let key = e.label.trim().toLowerCase();
            let a = out.get(key) || { name: e.label.trim(), count: 0, kind: QUEUE_RE.test(e.label) ? "queue" : "area" };
            a.count++;
            out.set(key, a);
        }
        let fields = this.map.elements.filter((e) => e.type.endsWith("_FIELD")).length;
        let list = [...out.values()];
        if (fields) list.unshift({ name: "Field", count: fields, kind: "field" });
        return list.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : ["field", "queue", "area"].indexOf(a.kind) - ["field", "queue", "area"].indexOf(b.kind)));
    }

    _resolveTargets(spec) {
        let els = this.map.elements;
        let named = (test) => els.filter((e) => (e.type === "OBJECT" || e.type === "LABEL") && e.label && test(e.label.trim()));
        if (spec && typeof spec === "object" && "area" in spec) {
            let a = spec.area;
            return named(a instanceof RegExp ? (l) => a.test(l) : (l) => l.toLowerCase() === String(a).trim().toLowerCase());
        }
        let key = String(spec).trim();
        let low = key.toLowerCase();
        if (low === "field") return els.filter((e) => e.type.endsWith("_FIELD"));
        if (low === "queue") return named((l) => QUEUE_RE.test(l));
        let teams = this._teamIndex.get(key);
        if (teams) return teams;
        return named((l) => l.toLowerCase() === low); // any area by name, e.g. "Pit Admin"
    }

    /** Map scale: meters per grid cell (from pitSizeMeters and the most common pit size). */
    get metersPerCell() {
        if (this.options.metersPerCell) return this.options.metersPerCell;
        let counts = new Map();
        for (let e of this.map ? this.map.elements : []) {
            if (e.type !== "PIT") continue;
            let size = Math.min(e.width, e.height);
            counts.set(size, (counts.get(size) || 0) + 1);
        }
        let pitCells = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] || 2;
        return this.options.pitSizeMeters / pitCells;
    }

    /** Compute (but don't draw) a walking route. */
    route(from, to) {
        if (!this.map) return null;
        this._grid = this._grid || new WalkGrid(this.map, 1);
        let g = this._grid;
        let resolve = (spec) => {
            if (spec && typeof spec === "object" && "x" in spec) {
                let cx = Math.floor(spec.x - g.ox);
                let cy = Math.floor(spec.y - g.oy);
                return { cells: g.free(cx, cy) ? [cy * g.w + cx] : [], center: [spec.x, spec.y] };
            }
            let targets = this._resolveTargets(spec);
            let cells = [];
            for (let e of targets) {
                cells.push(...g.doors(e));
                // Floor labels (e.g. "QUEUE") are walkable: you can stand inside them.
                if (!BLOCKING.has(e.type)) g.forCells(e, (cx, cy) => g.free(cx, cy) && cells.push(cy * g.w + cx));
            }
            return { cells, targets };
        };
        let a = resolve(from);
        let b = resolve(to);
        let pts = g.path(a.cells, b.cells);
        if (!pts) return null;
        let centerOf = (e) => [e.x + e.width / 2, e.y + e.height / 2];
        let nearest = (t, p) =>
            t.targets && t.targets.length
                ? t.targets.reduce((best, e) => {
                      let qx = Math.min(Math.max(p[0], e.x), e.x + e.width);
                      let qy = Math.min(Math.max(p[1], e.y), e.y + e.height);
                      let d = Math.hypot(qx - p[0], qy - p[1]);
                      return d < best[0] ? [d, centerOf(e), e] : best;
                  }, [Infinity])
                : null;
        // Pits, fields and areas: stop at their edge, straight out of the aisle (and without
        // covering the pit's text). Floor labels: the route already ends inside them.
        let anchor = (t, p) => {
            let n = nearest(t, p);
            if (!n) return null;
            let e = n[2];
            if (!BLOCKING.has(e.type)) return [p, e];
            let m = 0.12;
            let q = [Math.min(Math.max(p[0], e.x + m), e.x + e.width - m), Math.min(Math.max(p[1], e.y + m), e.y + e.height - m)];
            return [q, e];
        };
        let start = anchor(a, pts[0]);
        let end = anchor(b, pts[pts.length - 1]);
        if (start) pts.unshift(start[0]);
        if (end) pts.push(end[0]);
        let cells = 0;
        for (let i = 1; i < pts.length; i++) cells += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        let meters = cells * this.metersPerCell;
        return { points: pts, cells, meters, seconds: meters / this.options.walkingSpeed, from: start && start[1], to: end && end[1] };
    }

    /** Standalone SVG markup of the current map (current view, no controls/tooltip). */
    toSVGString({ fullMap = true } = {}) {
        let clone = this.svg.cloneNode(true);
        clone.setAttribute("xmlns", SVG_NS);
        if (fullMap && this.map) {
            let v = this._fullView(true);
            clone.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`);
            clone.setAttribute("width", Math.round(v.w * 24));
            clone.setAttribute("height", Math.round(v.h * 24));
        }
        clone.querySelectorAll(`.${PREFIX}-pulse`).forEach((n) => n.remove());
        clone.querySelectorAll(`.${PREFIX}-name`).forEach((n) => n.setAttribute("style", "display:inline"));
        let style = document.createElementNS(SVG_NS, "style");
        style.textContent = `text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;font-variant-numeric:tabular-nums}`;
        clone.insertBefore(style, clone.firstChild);
        return new XMLSerializer().serializeToString(clone);
    }

    /** Render the whole map to a PNG Blob. */
    async toPNG({ scale = 2, pxPerCell = 24 } = {}) {
        let v = this._fullView(true);
        let w = Math.round(v.w * pxPerCell * scale);
        let h = Math.round(v.h * pxPerCell * scale);
        let url = URL.createObjectURL(new Blob([this.toSVGString()], { type: "image/svg+xml" }));
        try {
            let img = new Image();
            await new Promise((res, rej) => {
                img.onload = res;
                img.onerror = rej;
                img.src = url;
            });
            let canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            canvas.getContext("2d").drawImage(img, 0, 0, w, h);
            return await new Promise((res) => canvas.toBlob(res, "image/png"));
        } finally {
            URL.revokeObjectURL(url);
        }
    }

    /** Subscribe to "pitclick" | "pithover" | "viewchange". Returns an unsubscribe function. */
    on(name, fn) {
        if (!this._listeners.has(name)) this._listeners.set(name, new Set());
        this._listeners.get(name).add(fn);
        return () => this._listeners.get(name)?.delete(fn);
    }

    destroy() {
        cancelAnimationFrame(this._anim);
        this._cleanup.forEach((f) => f());
        this._listeners.clear();
        this.root.remove();
    }

    // -------------------------------------------------------------- rendering

    /** The current theme with every CSS expression (var(), color-mix(), …) resolved. */
    get theme() {
        if (!this._theme) this._theme = this._resolveTheme();
        return this._theme;
    }

    /** Re-read CSS variables from the page and re-render if anything changed. */
    refreshTheme() {
        let prev = this._themeKey;
        this._theme = null;
        let next = JSON.stringify(this.theme);
        if (next !== prev) this._renderAll(false);
    }

    _rawTheme() {
        let t = this.options.theme;
        let dark = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches;
        let named = (name) => (name === "auto" || !name ? (dark() ? THEMES.dark : THEMES.light) : THEMES[name] || THEMES.light);
        if (t && typeof t === "object") return { ...named(t.base || t.extends || "auto"), ...t };
        return named(t);
    }

    _resolveTheme() {
        let raw = this._rawTheme();
        let out = {};
        let probe = null;
        for (let [k, v] of Object.entries(raw)) {
            if (typeof v === "string" && /\b(var|color-mix|light-dark|calc)\(/.test(v) && typeof getComputedStyle !== "undefined") {
                if (!probe) {
                    probe = document.createElement("span");
                    probe.style.display = "none";
                    this.root.appendChild(probe);
                }
                probe.style.setProperty(`--${PREFIX}-probe`, v);
                let r = getComputedStyle(probe).getPropertyValue(`--${PREFIX}-probe`).trim();
                // Colors written as color-mix()/light-dark() etc.: let the browser compute them.
                if (/\(/.test(r) && !/^(rgba?|hsla?)\(/i.test(r) && !/^[\d.]+$/.test(r)) {
                    probe.style.color = r;
                    let c = getComputedStyle(probe).color;
                    if (c) r = c;
                }
                v = r || v;
                if (typeof raw[k] === "string" && /^[\d.]+$/.test(v) && typeof THEMES.light[k] === "number") v = parseFloat(v);
            }
            out[k] = v;
        }
        probe?.remove();
        this._themeKey = JSON.stringify(out);
        return out;
    }

    _emit(name, detail) {
        let cb = { pitclick: this.options.onPitClick, pithover: this.options.onPitHover }[name];
        let results = [];
        if (cb) results.push(cb(detail));
        this._listeners.get(name)?.forEach((fn) => results.push(fn(detail)));
        // Returning false from a pitclick handler skips the built-in click action.
        if (results.includes(false) && detail && detail.preventDefault) detail.preventDefault();
    }

    _renderAll(resetView) {
        this._theme = null; // re-resolve CSS variables
        let s = this.svg;
        let T = this.theme;
        s.replaceChildren();
        this._pitEls.clear();
        this.root.className = [PREFIX, this.options.className].filter(Boolean).join(" ");
        let st = this.root.style;
        st.background = T.background;
        st.fontFamily = T.uiFontFamily || T.fontFamily;
        s.style.fontFamily = T.fontFamily;
        let vars = {
            "tip-bg": T.tooltipBg, "tip-text": T.tooltipText, "tip-muted": T.tooltipMuted, "tip-border": T.tooltipBorder,
            "ctrl-bg": T.controlBg, "ctrl-text": T.controlText, shadow: T.shadow, focus: T.focus,
            radius: `${T.uiRadius}px`, dim: T.dimOpacity, "hover-stroke": T.hoverStrokeWidth,
        };
        for (let [k, v] of Object.entries(vars)) st.setProperty(`--${PREFIX}-${k}`, v);
        let hoverColor = !isNone(T.hoverStroke);
        st.setProperty(`--${PREFIX}-hover-color`, hoverColor ? T.hoverStroke : "");
        this.root.classList.toggle(`${PREFIX}-has-hover-color`, hoverColor);
        this._renderControls();
        if (!this.map) return;

        let m = this.map;
        let full = this._fullView(true);
        // When the container has no height of its own, keep the map's aspect ratio.
        s.style.aspectRatio = `${full.w} / ${full.h}`;

        let uid = (this._uid = this._uid || Math.random().toString(36).slice(2, 8));
        let defs = svg("defs", null, s);
        let dots = svg("pattern", { id: `${PREFIX}-dots-${uid}`, width: 1, height: 1, patternUnits: "userSpaceOnUse" }, defs);
        svg("circle", { cx: 0, cy: 0, r: 0.045, fill: T.gridDot }, dots);
        let hatch = svg("pattern", { id: `${PREFIX}-hatch-${uid}`, width: 0.5, height: 0.5, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
        svg("rect", { width: 0.5, height: 0.5, fill: T.objectFill }, hatch);
        if (!isNone(T.objectHatch)) svg("line", { x1: 0, y1: 0, x2: 0, y2: 0.5, stroke: T.objectHatch, "stroke-width": 0.16 }, hatch);
        let shadow = svg("filter", { id: `${PREFIX}-shadow-${uid}`, x: "-20%", y: "-20%", width: "140%", height: "140%" }, defs);
        svg("feDropShadow", { dx: 0, dy: 0.06, stdDeviation: 0.07, "flood-color": T.shadow, "flood-opacity": 0.9 }, shadow);
        let glow = svg("filter", { id: `${PREFIX}-glow-${uid}`, x: "-50%", y: "-50%", width: "200%", height: "200%" }, defs);
        svg("feGaussianBlur", { stdDeviation: 0.18, result: "b" }, glow);
        let merge = svg("feMerge", null, glow);
        svg("feMergeNode", { in: "b" }, merge);
        svg("feMergeNode", { in: "SourceGraphic" }, merge);
        this._ids = {
            hatch: `url(#${PREFIX}-hatch-${uid})`,
            shadow: T.shadows ? `url(#${PREFIX}-shadow-${uid})` : null,
            glow: T.glow ? `url(#${PREFIX}-glow-${uid})` : null,
        };

        // Floor
        svg("rect", { x: full.x - 50, y: full.y - 50, width: full.w + 100, height: full.h + 100, fill: T.background }, s);
        if (!isNone(T.gridDot)) svg("rect", { x: full.x, y: full.y, width: full.w, height: full.h, fill: `url(#${PREFIX}-dots-${uid})` }, s);

        // Walls: every connected wall becomes one outline, so wallRadius rounds the shape's
        // corners (not each 1x1 cell) and there are no seams between cells.
        let walls = m.elements.filter((e) => e.type === "BOUNDARY");
        if (walls.length) {
            svg("path", { class: `${PREFIX}-walls`, d: wallPath(walls, +T.wallRadius || 0), fill: T.wall, "fill-rule": "nonzero", ...this._stroke(T) }, s);
        }

        let gFields = svg("g", { class: `${PREFIX}-fields` }, s);
        for (let e of m.elements) if (e.type === "HORIZONTAL_FIELD" || e.type === "VERTICAL_FIELD") this._drawField(e, gFields, T);

        let gObjects = svg("g", { class: `${PREFIX}-objects` }, s);
        for (let e of m.elements) if (e.type === "OBJECT") this._drawObject(e, gObjects, T);

        let gLabels = svg("g", { class: `${PREFIX}-labels` }, s);
        for (let e of m.elements) if (e.type === "LABEL" && e.label) this._drawLabel(e, gLabels, T);

        this._gPits = svg("g", { class: `${PREFIX}-pits` }, s);
        this._gRoute = svg("g", { class: `${PREFIX}-route` }, s);
        this._gOver = svg("g", { class: `${PREFIX}-outlines` }, s);
        this._renderPits();
        this._renderRoute();

        if (resetView || !this.view) this._setView(this._fullView());
        else this._setView(this.view);
    }

    _stroke(T) {
        return isNone(T.elementStroke) ? {} : { stroke: T.elementStroke, "stroke-width": T.elementStrokeWidth };
    }

    /**
     * Field geometry inside its element: a square field centered on the long axis, and the
     * overflow (the element's extra length) split into an alliance-station area at each end.
     * Everything is clamped to fit, whatever the element's size or aspect ratio.
     * Returns rects in map cells: { zone, field, stations: [red, blue], horizontal }.
     */
    _fieldLayout(e) {
        // Orientation follows the element's shape; the type only breaks ties (square elements).
        let horizontal = e.width !== e.height ? e.width > e.height : e.type === "HORIZONTAL_FIELD";
        let long = horizontal ? e.width : e.height;
        let short = horizontal ? e.height : e.width;
        let pad = Math.min(0.3, short * 0.1, long * 0.1);
        let side = Math.max(0, Math.min(short, long) - 2 * pad);
        let overflow = Math.max(0, long - 2 * pad - side); // extra length beyond the square
        let gap = overflow / 2 > 2 * pad ? pad : 0; // space between station and field, if there's room
        let station = Math.max(0, overflow / 2 - gap);
        // (along, across, length, thickness) -> {x, y, width, height}
        let rect = (along, across, len, thick) =>
            horizontal
                ? { x: e.x + along, y: e.y + across, width: len, height: thick }
                : { x: e.x + across, y: e.y + along, width: thick, height: len };
        let across = (short - side) / 2;
        let fieldAt = pad + station + gap;
        return {
            horizontal,
            zone: { x: e.x, y: e.y, width: e.width, height: e.height },
            field: rect(fieldAt, across, side, side),
            stations: station > 0.05 ? [rect(pad, across, station, side), rect(fieldAt + side + gap, across, station, side)] : [],
            // Edges of the field square that face the stations (parallel to the short side).
            edges: [rect(fieldAt, across, Math.min(0.09, side / 20), side), rect(fieldAt + side - Math.min(0.09, side / 20), across, Math.min(0.09, side / 20), side)],
        };
    }

    /** Colors for [top/left end, bottom/right end] of a field. */
    _allianceColors(e, T) {
        let opt = this.options.fieldAlliances;
        let order = typeof opt === "function" ? opt(e) : opt;
        if (order === "red-first") return [T.fieldRed, T.fieldBlue];
        if (order === "blue-first") return [T.fieldBlue, T.fieldRed];
        return [T.fieldStation, T.fieldStation];
    }

    _drawField(e, parent, T) {
        let g = svg("g", { class: `${PREFIX}-field` }, parent);
        let L = this._fieldLayout(e);
        let fieldStroke = isNone(T.fieldStroke) ? {} : { stroke: T.fieldStroke, "stroke-width": T.elementStrokeWidth };
        let r = (rc, attrs) => svg("rect", { ...rc, ...attrs }, g);
        // The data doesn't say which end is red, so stations are neutral unless fieldAlliances says.
        let alliance = this._allianceColors(e, T);
        // Every corner scales from fieldRadius, capped so small shapes stay sensible.
        let R = Math.max(0, +T.fieldRadius || 0);
        let rad = (rc, v) => Math.min(v, rc.width / 4, rc.height / 4) || null;

        if (T.fieldStyle === "stations") {
            // FTC-Events style: alliance station | field | alliance station, as outlines.
            r(L.zone, { rx: rad(L.zone, R), fill: T.fieldZone, ...this._stroke(T) });
            L.stations.forEach((st, i) => r(st, { rx: rad(st, R * 0.5), fill: isNone(alliance[i]) ? "none" : alliance[i], "fill-opacity": 0.25, ...fieldStroke }));
            r(L.field, { rx: rad(L.field, R * 0.5), fill: isNone(T.fieldMat) ? "none" : T.fieldMat, ...fieldStroke });
        } else {
            let inset = Math.min(0.06, e.width / 20, e.height / 20);
            let zone = { x: e.x + inset, y: e.y + inset, width: e.width - 2 * inset, height: e.height - 2 * inset };
            r(zone, { rx: rad(zone, R), fill: T.fieldZone, ...this._stroke(T) });
            // Alliance stations in the overflow at each end, with a driver-station console.
            L.stations.forEach((st, i) => {
                if (isNone(alliance[i])) return;
                r(st, { rx: rad(st, R * 0.4), fill: alliance[i], "fill-opacity": 0.16 });
                let t = Math.min(0.14, (L.horizontal ? st.width : st.height) / 3);
                let console = L.horizontal
                    ? { x: i ? st.x + st.width - t * 1.6 : st.x + t * 0.6, y: st.y + st.height * 0.15, width: t, height: st.height * 0.7 }
                    : { x: st.x + st.width * 0.15, y: i ? st.y + st.height - t * 1.6 : st.y + t * 0.6, width: st.width * 0.7, height: t };
                r(console, { rx: Math.min(t / 2, R) || null, fill: alliance[i], "fill-opacity": 0.7 });
            });
            let field = svg("g", { filter: this._ids.shadow }, g);
            svg("rect", { ...L.field, rx: rad(L.field, R * 0.3), fill: T.fieldMat, ...fieldStroke }, field);
            let { x: fx, y: fy, width: side } = L.field;
            if (!isNone(T.fieldTile) && side > 0) {
                let tiles = [];
                for (let i = 1; i < 6; i++) {
                    let t = (side * i) / 6;
                    tiles.push(`M${fx + t} ${fy}v${side}M${fx} ${fy + t}h${side}`);
                }
                svg("path", { d: tiles.join(""), stroke: T.fieldTile, "stroke-width": Math.min(0.03, side / 60), fill: "none" }, g);
            }
            // Alliance walls: the field edges facing each station, parallel to the short side.
            L.edges.forEach((edge, i) => !isNone(alliance[i]) && r(edge, { fill: alliance[i] }));
        }
        if (e.label) {
            let { x, y, width: side } = L.field;
            let t = svg("text", {
                x: x + side / 2, y: y + side / 2, "font-size": fitText(e.label, side * 0.7, side * 0.2),
                "font-weight": T.labelWeight, fill: textOn(isNone(T.fieldMat) ? T.fieldZone : T.fieldMat, T),
                "text-anchor": "middle", "dominant-baseline": "central",
            }, g);
            t.textContent = e.label;
        }
        svg("title", null, g).textContent = e.label ? `Field: ${e.label}` : "Competition field";
    }

    _drawObject(e, parent, T) {
        let g = svg("g", { class: `${PREFIX}-object` }, parent);
        let inset = isNone(T.elementStroke) ? Math.min(0.08, e.width / 6, e.height / 6) : 0;
        let stroke = isNone(T.elementStroke)
            ? isNone(T.objectStroke) ? {} : { stroke: T.objectStroke, "stroke-width": 0.05 }
            : this._stroke(T);
        svg("rect", {
            x: e.x + inset, y: e.y + inset, width: e.width - inset * 2, height: e.height - inset * 2,
            rx: Math.min(+T.objectRadius || 0, e.width / 2, e.height / 2) || null,
            fill: isNone(T.objectHatch) ? T.objectFill : this._ids.hatch, ...stroke,
        }, g);
        if (e.label) {
            this._text(e, e.label, g, { fill: T.objectText, weight: T.labelWeight, maxSize: 0.6 });
            svg("title", null, g).textContent = e.label;
        }
    }

    _drawLabel(e, parent, T) {
        let text = e.label;
        if (T.labelTransform === "uppercase") text = text.toUpperCase();
        else if (T.labelTransform === "capitalize") text = text.replace(/\b\w/g, (c) => c.toUpperCase());
        this._text(e, text, parent, { fill: T.label, weight: T.labelWeight, maxSize: 0.85, spacing: +T.labelLetterSpacing || 0 });
    }

    _text(e, text, parent, { fill, weight = 600, maxSize = 0.7, spacing = 0 }) {
        let vertical = e.labelOrientation === "VERTICAL";
        let along = (vertical ? e.height : e.width) - 0.3;
        let across = (vertical ? e.width : e.height) - 0.2;
        let fs = fitText(text, along, Math.min(maxSize, across * 0.7), 0.62 + spacing);
        let cx = e.x + e.width / 2;
        let cy = e.y + e.height / 2;
        let t = svg("text", {
            x: cx, y: cy, fill, "font-size": fs, "font-weight": weight,
            "letter-spacing": spacing ? spacing * fs : null,
            "text-anchor": "middle", "dominant-baseline": "central",
            transform: vertical ? `rotate(-90 ${cx} ${cy})` : null,
        }, parent);
        t.textContent = text;
        return t;
    }

    _renderPits() {
        if (!this.map || !this._gPits) return;
        let T = this.theme;
        let o = this.options;
        let hl = teamColorMap(o.highlight, o.highlightColor || T.highlight);
        let ol = teamColorMap(o.outline, o.outlineColor || T.outline);
        let showNum = o.showPitNumbers ?? this.map.showPitNumbers;
        let showAddr = o.showPitAddresses ?? this.map.showPitAddresses;
        let keyOf = (team) => (team ? [team.number, team.displayNumber] : []);
        let lookup = (map, team) => keyOf(team).map((k) => map.get(k)).find(Boolean) || null;

        this._gPits.replaceChildren();
        this._gOver.replaceChildren();
        this._pitEls.clear();
        let any = false;
        // One font size for every team number on the map, sized for the longest one.
        let numLen = Math.max(4, ...this.map.elements.filter((e) => e.team).map((e) => (e.team.displayNumber || e.team.number).length));
        let gap = +T.pitGap || 0;

        // Empty pits (dashed outline) first, so neighbouring pits' solid borders paint over them.
        let pits = this.map.elements.filter((e) => e.type === "PIT");
        pits.sort((a, b) => (a.team ? 1 : 0) - (b.team ? 1 : 0));
        for (let e of pits) {
            let hColor = lookup(hl, e.team);
            let oColor = lookup(ol, e.team);
            let custom = o.colorBy && e.team ? o.colorBy(e.team, e) : null;
            let base = custom || e.color;
            let fill = hColor || (base ? mix(base, T.pitBase, custom ? Math.min(0.1, T.pitMix) : T.pitMix) : e.team ? T.pitDefault : T.pitEmpty);
            let x = e.x + gap;
            let y = e.y + gap;
            let w = e.width - gap * 2;
            let h = e.height - gap * 2;
            let style = {
                fill,
                stroke: T.pitStroke,
                strokeWidth: T.pitStrokeWidth,
                radius: Math.min(+T.pitRadius || 0, w / 2, h / 2),
                text: null, // null = automatic contrast
                opacity: null,
            };
            if (o.pitStyle) Object.assign(style, o.pitStyle(e.team, e, { highlighted: hColor, outlined: oColor, theme: T }) || {});
            let on = !!(hColor || oColor);
            any = any || on;

            let g = svg("g", { class: `${PREFIX}-pit${on ? ` ${PREFIX}-on` : ""}`, "data-i": e.i, opacity: style.opacity }, this._gPits);
            this._pitEls.set(e.i, g);
            let r = style.radius;

            if (hColor && o.pulse) {
                svg("rect", { class: `${PREFIX}-pulse`, x, y, width: w, height: h, rx: r, fill: "none", stroke: hColor, "stroke-width": 0.14 }, g);
            }
            svg("rect", {
                class: `${PREFIX}-tile`, x, y, width: w, height: h, rx: r, fill: style.fill,
                stroke: isNone(style.stroke) ? null : style.stroke, "stroke-width": style.strokeWidth,
                "stroke-dasharray": e.team ? null : "0.18 0.12",
                filter: hColor ? this._ids.glow : null,
            }, g);

            let ink = style.text || textOn(style.fill, T);
            let sub = (showAddr && e.address) || (showNum && e.label) || null;
            let cx = e.x + e.width / 2;
            let cy = e.y + e.height / 2;
            if (e.team) {
                let num = e.team.displayNumber || e.team.number;
                let fs = fitText("0".repeat(numLen), w - 0.4, h * (+T.numberSize || 0.24), 0.58);
                let t = svg("text", {
                    class: `${PREFIX}-num`, x: cx, y: sub ? cy - h * 0.1 : cy, fill: ink, "font-size": fs, "font-weight": T.numberWeight,
                    "text-anchor": "middle", "dominant-baseline": "central", "letter-spacing": -0.01,
                }, g);
                t.textContent = num;
                if (sub) {
                    let st = svg("text", {
                        class: `${PREFIX}-sub`, x: cx, y: cy + h * 0.25, fill: ink, "fill-opacity": 0.62, "font-size": fitText(sub, w - 0.3, h * 0.17, 0.6),
                        "font-weight": T.subWeight, "text-anchor": "middle", "dominant-baseline": "central",
                    }, g);
                    st.textContent = sub;
                }
                if (e.team.name) {
                    let name = e.team.name.length > 16 ? e.team.name.slice(0, 15) + "…" : e.team.name;
                    let nt = svg("text", {
                        class: `${PREFIX}-name`, x: cx, y: y + h * 0.13, fill: ink, "fill-opacity": 0.8,
                        "font-size": fitText(name, w - 0.2, h * 0.09, 0.55), "font-weight": T.nameWeight,
                        "text-anchor": "middle", "dominant-baseline": "central",
                    }, g);
                    nt.textContent = name;
                }
                svg("title", null, g).textContent = [
                    `Team ${num}`, e.team.name, e.address && `Pit ${e.address}`, !e.address && e.label && `Pit ${e.label}`,
                ].filter(Boolean).join(" · ");
            } else if (sub || e.label) {
                let t = svg("text", {
                    x: cx, y: cy, fill: style.text || T.label, "font-size": fitText(sub || e.label, w - 0.3, h * 0.22, 0.6),
                    "font-weight": T.subWeight, "text-anchor": "middle", "dominant-baseline": "central",
                }, g);
                t.textContent = sub || e.label;
            }

            if (oColor) {
                let pad = 0.02;
                svg("rect", {
                    x: x - pad, y: y - pad, width: w + pad * 2, height: h + pad * 2, rx: r ? r + pad : 0,
                    fill: "none", stroke: oColor, "stroke-width": T.outlineWidth, "pointer-events": "none",
                }, this._gOver);
            }
        }
        this.svg.classList.toggle(`${PREFIX}-dim`, !!(o.dimOthers && any));
    }

    _renderRoute() {
        if (!this._gRoute) return;
        this._gRoute.replaceChildren();
        let r = this._route;
        if (!r) return;
        let T = this.theme;
        let color = r.color || T.route;
        let d = roundedPath(r.points, +T.routeCornerRadius || 0);
        let common = { d, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" };
        let rw = +T.routeWidth;
        if (!isNone(T.routeCasing)) svg("path", { ...common, stroke: T.routeCasing, "stroke-width": +T.routeCasingWidth, "stroke-opacity": 0.9 }, this._gRoute);
        svg("path", { ...common, stroke: color, "stroke-width": rw }, this._gRoute);
        if (T.routeDash && !isNone(T.routeCasing)) {
            svg("path", { ...common, class: `${PREFIX}-route-line`, stroke: T.routeCasing, "stroke-width": rw * 0.36, "stroke-dasharray": "0.3 0.9", "stroke-opacity": 0.9 }, this._gRoute);
        }
        let casing = isNone(T.routeCasing) ? color : T.routeCasing;
        let [s, e] = [r.points[0], r.points[r.points.length - 1]];
        svg("circle", { cx: s[0], cy: s[1], r: rw * 1.45, fill: color, stroke: casing, "stroke-width": rw * 0.45 }, this._gRoute);
        let end = svg("g", null, this._gRoute);
        svg("circle", { cx: e[0], cy: e[1], r: rw * 1.9, fill: casing }, end);
        svg("circle", { cx: e[0], cy: e[1], r: rw * 1.36, fill: color }, end);
        svg("circle", { cx: e[0], cy: e[1], r: rw * 0.5, fill: casing }, end);
    }

    _renderControls() {
        this.root.querySelector(`.${PREFIX}-ctrl`)?.remove();
        if (!this.options.controls || !this.options.zoom) return;
        let box = document.createElement("div");
        box.className = `${PREFIX}-ctrl`;
        box.setAttribute("part", "controls");
        let btn = (icon, label, fn) => {
            let b = document.createElement("button");
            b.type = "button";
            b.innerHTML = icon;
            b.title = label;
            b.setAttribute("aria-label", label);
            b.addEventListener("click", (ev) => {
                ev.stopPropagation();
                fn();
            });
            box.appendChild(b);
        };
        btn(ICONS.plus, "Zoom in", () => this.zoomBy(1 / 1.6));
        btn(ICONS.minus, "Zoom out", () => this.zoomBy(1.6));
        btn(ICONS.fit, "Show whole map", () => this.fit());
        this.root.appendChild(box);
    }

    // -------------------------------------------------------------- view / zoom

    _aspect() {
        let r = this.svg.getBoundingClientRect();
        return r.width && r.height ? r.width / r.height : this.map ? this.map.width / this.map.height : 1;
    }

    _fullView(exact = false) {
        let m = this.map;
        let p = this.options.padding;
        let v = { x: m.minX - p, y: m.minY - p, w: m.width + 2 * p, h: m.height + 2 * p };
        if (exact) return v;
        // Expand to the container's aspect ratio so zoom math stays simple.
        let a = this._aspect();
        if (v.w / v.h < a) {
            let w = v.h * a;
            v.x -= (w - v.w) / 2;
            v.w = w;
        } else {
            let h = v.w / a;
            v.y -= (h - v.h) / 2;
            v.h = h;
        }
        return v;
    }

    _clampView(v) {
        if (!this.map) return v;
        let full = this._fullView();
        let minW = full.w / this.options.maxZoom;
        if (v.w > full.w) v = { ...full };
        if (v.w < minW) {
            let cx = v.x + v.w / 2;
            let cy = v.y + v.h / 2;
            let k = minW / v.w;
            v = { x: cx - (v.w * k) / 2, y: cy - (v.h * k) / 2, w: v.w * k, h: v.h * k };
        }
        // Keep at least part of the map on screen.
        v.x = Math.min(Math.max(v.x, full.x - v.w * 0.5), full.x + full.w - v.w * 0.5);
        v.y = Math.min(Math.max(v.y, full.y - v.h * 0.5), full.y + full.h - v.h * 0.5);
        return v;
    }

    _zoomed(v, factor, [cx, cy]) {
        return this._clampView({ x: cx - (cx - v.x) * factor, y: cy - (cy - v.y) * factor, w: v.w * factor, h: v.h * factor });
    }

    _setView(v) {
        this.view = v;
        this.svg.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`);
        this._updateLod();
        this._placePopup();
        this._emit("viewchange", { ...v });
    }

    _animateTo(target, ms = 420) {
        cancelAnimationFrame(this._anim);
        let from = this.view || target;
        if (prefersReducedMotion() || !this.view) return this._setView(target);
        let t0 = performance.now();
        let ease = (t) => 1 - Math.pow(1 - t, 3);
        let step = (now) => {
            let t = Math.min(1, (now - t0) / ms);
            let k = ease(t);
            this._setView({
                x: from.x + (target.x - from.x) * k,
                y: from.y + (target.y - from.y) * k,
                w: from.w + (target.w - from.w) * k,
                h: from.h + (target.h - from.h) * k,
            });
            if (t < 1) this._anim = requestAnimationFrame(step);
        };
        this._anim = requestAnimationFrame(step);
    }

    _pxPerCell() {
        let r = this.svg.getBoundingClientRect();
        return this.view && r.width ? Math.min(r.width / this.view.w, r.height / this.view.h) : 0;
    }

    _updateLod() {
        let o = this.options.showTeamNames;
        let show = o === true || (o === "zoom" && this._pxPerCell() >= 46);
        this.svg.classList.toggle(`${PREFIX}-names`, show);
    }

    _clientToMap(clientX, clientY) {
        let ctm = this.svg.getScreenCTM();
        if (!ctm) return [0, 0];
        let p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
        return [p.x, p.y];
    }

    // -------------------------------------------------------------- interaction

    _bindInteraction() {
        let s = this.svg;
        let pointers = new Map();
        let drag = null;
        let moved = false;
        let hintTimer;
        let listen = (el, ev, fn, opts) => {
            el.addEventListener(ev, fn, opts);
            this._cleanup.push(() => el.removeEventListener(ev, fn, opts));
        };
        let pitFrom = (target) => {
            let g = target && target.closest && target.closest(`.${PREFIX}-pit`);
            return g ? this.map.elements[+g.dataset.i] : null;
        };

        listen(s, "wheel", (ev) => {
            if (!this.options.zoom || !this.view || !this.options.scrollZoom) return;
            if (this.options.scrollZoom === "modifier" && !(ev.ctrlKey || ev.metaKey)) {
                this.hint.classList.add(`${PREFIX}-show`);
                clearTimeout(hintTimer);
                hintTimer = setTimeout(() => this.hint.classList.remove(`${PREFIX}-show`), 900);
                return;
            }
            ev.preventDefault();
            this.hint.classList.remove(`${PREFIX}-show`);
            let dy = ev.deltaMode === 1 ? ev.deltaY * 16 : ev.deltaY;
            cancelAnimationFrame(this._anim);
            this._setView(this._zoomed(this.view, Math.exp(dy * 0.0018), this._clientToMap(ev.clientX, ev.clientY)));
        }, { passive: false });

        listen(s, "pointerdown", (ev) => {
            if (!this.options.zoom || !this.view || ev.button > 0) return;
            pointers.set(ev.pointerId, [ev.clientX, ev.clientY]);
            moved = false;
            cancelAnimationFrame(this._anim);
            drag = { view: { ...this.view }, ppc: this._pxPerCell(), start: [ev.clientX, ev.clientY], pinch: null };
            if (pointers.size === 2) {
                let [a, b] = [...pointers.values()];
                drag.pinch = { dist: Math.hypot(a[0] - b[0], a[1] - b[1]), mid: this._clientToMap((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) };
            }
        });
        listen(s, "pointermove", (ev) => {
            if (pointers.has(ev.pointerId)) {
                pointers.set(ev.pointerId, [ev.clientX, ev.clientY]);
                if (drag && drag.pinch && pointers.size === 2) {
                    let [a, b] = [...pointers.values()];
                    let d = Math.hypot(a[0] - b[0], a[1] - b[1]);
                    this._setView(this._zoomed(drag.view, drag.pinch.dist / Math.max(d, 1), drag.pinch.mid));
                    moved = true;
                } else if (drag && pointers.size === 1) {
                    let dx = ev.clientX - drag.start[0];
                    let dy = ev.clientY - drag.start[1];
                    if (!moved && Math.hypot(dx, dy) > 4) {
                        moved = true;
                        s.setPointerCapture?.(ev.pointerId);
                        s.classList.add(`${PREFIX}-dragging`);
                        this._hideTip();
                    }
                    if (moved && drag.ppc) {
                        this._setView(this._clampView({ ...drag.view, x: drag.view.x - dx / drag.ppc, y: drag.view.y - dy / drag.ppc }));
                    }
                }
                if (moved) return;
            }
            if (ev.pointerType === "mouse") this._hover(pitFrom(ev.target), ev);
        });
        let end = (ev) => {
            pointers.delete(ev.pointerId);
            if (pointers.size === 0) {
                drag = null;
                s.classList.remove(`${PREFIX}-dragging`);
            } else if (drag) {
                // Lifting one finger of a pinch: continue as a pan from here.
                let [p] = [...pointers.values()];
                drag = { view: { ...this.view }, ppc: this._pxPerCell(), start: p, pinch: null };
            }
        };
        listen(s, "pointerup", end);
        listen(s, "pointercancel", end);
        listen(s, "pointerleave", (ev) => ev.pointerType === "mouse" && this._hover(null, ev));
        listen(s, "click", (ev) => {
            if (moved) return;
            let e = pitFrom(ev.target);
            if (!e) {
                this._hideTip();
                this.closePopup();
                return;
            }
            let prevented = false;
            let detail = {
                team: e.team,
                element: e,
                originalEvent: ev,
                map: this,
                preventDefault: () => (prevented = true),
                get defaultPrevented() {
                    return prevented;
                },
            };
            this._emit("pitclick", detail);
            if (!prevented) this._clickAction(e, ev, detail);
        });
        listen(s, "dblclick", (ev) => {
            if (!this.options.zoom || !this.view) return;
            ev.preventDefault();
            this._animateTo(this._zoomed(this.view, ev.shiftKey ? 1.8 : 1 / 1.8, this._clientToMap(ev.clientX, ev.clientY)), 250);
        });
        listen(this.root, "keydown", (ev) => {
            if (!this.options.zoom || !this.view || ev.target !== this.root) return;
            let v = this.view;
            let step = v.w * 0.12;
            let moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
            if (moves[ev.key]) {
                let [dx, dy] = moves[ev.key];
                this._animateTo(this._clampView({ ...v, x: v.x + dx, y: v.y + dy }), 150);
            } else if (ev.key === "+" || ev.key === "=") this.zoomBy(1 / 1.4);
            else if (ev.key === "-" || ev.key === "_") this.zoomBy(1.4);
            else if (ev.key === "0") this.fit();
            else if (ev.key === "Escape") this._popup ? this.closePopup() : this.clearRoute();
            else return;
            ev.preventDefault();
        });
    }

    _hover(e, ev) {
        if (e !== this._hovered) {
            this._hovered = e;
            this._emit("pithover", e ? { team: e.team, element: e, originalEvent: ev, map: this } : null);
        }
        if (e && !(this._popup && this._popup.element === e)) this._showTip(e, ev);
        else this._hideTip();
    }

    _clickAction(e, ev, detail) {
        let act = this.options.clickAction;
        if (typeof act === "function") return act(detail);
        if (act === "none" || act === false) return;
        if (act === "focus") return this.focusTeam(e.team ? e.team.number : null);
        if (act === "tooltip") return this._showTip(e, ev); // transient, like hover (handy on touch)
        if (this._popup && this._popup.element === e) return this.closePopup(); // click again to close
        this.openPopup(e.team ? e.team.number : e);
    }

    /** The built-in tooltip/popup content for a pit, as a DOM node. */
    defaultContent(e) {
        let el = (tag, cls, text) => {
            let n = document.createElement(tag);
            n.className = `${PREFIX}-${cls}`;
            if (text != null) n.textContent = text;
            return n;
        };
        let box = document.createElement("div");
        if (!e.team) {
            box.appendChild(el("div", "tip-name", e.address || e.label ? `Pit ${e.address || e.label}` : "Empty pit"));
            return box;
        }
        let head = el("div", "tip-num");
        let custom = this.options.colorBy ? this.options.colorBy(e.team, e) : null;
        if (custom || e.color) {
            let dot = el("span", "tip-dot");
            dot.style.background = custom || e.color;
            head.appendChild(dot);
        }
        head.appendChild(document.createTextNode(e.team.displayNumber || e.team.number));
        box.appendChild(head);
        if (e.team.name) box.appendChild(el("div", "tip-name", e.team.name));
        let meta = el("div", "tip-meta");
        let addMeta = (k, v) => {
            if (v == null || v === "") return;
            let span = document.createElement("span");
            span.append(`${k} `);
            let b = document.createElement("b");
            b.textContent = v;
            span.appendChild(b);
            meta.appendChild(span);
        };
        addMeta("Pit", e.address || e.label);
        if (e.address && e.label) addMeta("No.", e.label);
        if (e.addressGroup) addMeta("Group", e.addressGroup);
        if (meta.childNodes.length) box.appendChild(meta);
        return box;
    }

    /** Fill `target` from an option (true | false | fn) — returns false when there's nothing to show. */
    _fillContent(target, opt, e, kind) {
        if (!opt) return false;
        target.replaceChildren();
        if (typeof opt !== "function") {
            if (!e.team && kind === "tooltip") return false;
            target.appendChild(this.defaultContent(e));
            return true;
        }
        let ctx = { kind, map: this, theme: this.theme, defaultContent: () => this.defaultContent(e), close: () => this.closePopup() };
        let c = opt(e.team, e, ctx);
        if (c == null || c === false || c === "") return false;
        if (typeof c === "string") target.innerHTML = c;
        else target.appendChild(c);
        return true;
    }

    _showTip(e, ev) {
        let tip = this.tip;
        if (this._tipFor !== e) {
            this._tipFor = e;
            if (!this._fillContent(tip, this.options.tooltip, e, "tooltip")) return this._hideTip();
        }
        let box = this.root.getBoundingClientRect();
        let x = ev.clientX - box.left;
        let y = ev.clientY - box.top;
        tip.classList.add(`${PREFIX}-show`);
        let tw = tip.offsetWidth;
        let th = tip.offsetHeight;
        let left = x + 14 + tw > box.width - 8 ? x - tw - 14 : x + 14;
        let top = y + 14 + th > box.height - 8 ? y - th - 14 : y + 14;
        tip.style.transform = "none";
        tip.style.left = `${Math.max(8, left)}px`;
        tip.style.top = `${Math.max(8, top)}px`;
    }

    _hideTip() {
        this._tipFor = null;
        this.tip.classList.remove(`${PREFIX}-show`);
    }

    /**
     * Open the click popup for a team (or element). It stays pinned to the pit while panning,
     * can contain links/buttons, and closes on Esc, a click elsewhere, or ctx.close().
     */
    openPopup(team) {
        let e = team && typeof team === "object" ? team : (this._teamIndex.get(String(team).trim()) || [])[0];
        if (!e) return false;
        this.closePopup();
        this._hideTip();
        let pop = document.createElement("div");
        pop.className = `${PREFIX}-tip ${PREFIX}-popup`;
        pop.setAttribute("part", "popup");
        pop.setAttribute("role", "dialog");
        let body = document.createElement("div");
        let opt = this.options.popup === true || this.options.popup == null ? this.options.tooltip || true : this.options.popup;
        if (!this._fillContent(body, opt, e, "popup")) return false;
        let close = document.createElement("button");
        close.type = "button";
        close.className = `${PREFIX}-popup-close`;
        close.setAttribute("aria-label", "Close");
        close.textContent = "×";
        close.addEventListener("click", (ev) => {
            ev.stopPropagation();
            this.closePopup();
        });
        pop.append(close, body);
        pop.addEventListener("pointerdown", (ev) => ev.stopPropagation());
        pop.addEventListener("wheel", (ev) => ev.stopPropagation());
        this.root.appendChild(pop);
        this._popup = { element: e, node: pop };
        this._placePopup();
        requestAnimationFrame(() => pop.classList.add(`${PREFIX}-show`));
        this._emit("popupopen", { team: e.team, element: e, node: pop, map: this });
        return true;
    }

    closePopup() {
        if (!this._popup) return;
        let { element, node } = this._popup;
        this._popup = null;
        node.remove();
        this._emit("popupclose", { team: element.team, element, map: this });
    }

    _placePopup() {
        let p = this._popup;
        if (!p) return;
        let e = p.element;
        let ctm = this.svg.getScreenCTM();
        if (!ctm) return;
        let box = this.root.getBoundingClientRect();
        let at = (x, y) => {
            let q = new DOMPoint(x, y).matrixTransform(ctm);
            return [q.x - box.left, q.y - box.top];
        };
        let [cx, top] = at(e.x + e.width / 2, e.y);
        let [, bottom] = at(e.x + e.width / 2, e.y + e.height);
        let node = p.node;
        let w = node.offsetWidth;
        let h = node.offsetHeight;
        let above = top - h - 10 >= 8;
        let y = above ? top - h - 10 : bottom + 10;
        let x = Math.min(Math.max(8, cx - w / 2), box.width - w - 8);
        node.style.left = `${x}px`;
        node.style.top = `${Math.min(Math.max(8, y), box.height - h - 8)}px`;
        node.dataset.side = above ? "top" : "bottom";
        let hidden = cx < 0 || cx > box.width || bottom < 0 || top > box.height;
        node.style.visibility = hidden ? "hidden" : "";
    }
}

// ------------------------------------------------------------------ web component

/**
 * Registers <ftc-pit-map>. Attributes: event ("2025/FPEEUR", loads from the ftc-embeds API),
 * api-base, graphql-url, src (URL of pit map JSON), highlight, outline, highlight-color, outline-color,
 * theme (preset name or JSON tokens), dim-others, controls, pulse, scroll-zoom, show-team-names,
 * click-action, class-name. Properties: data, options (any PitMap option, incl. functions), map.
 * Events: "pitclick" (cancelable: preventDefault() skips the popup), "pithover", "viewchange",
 * "popupopen", "popupclose", "load", "error". Style parts: ::part(map|tooltip|popup|controls).
 */
export function definePitMapElement(tagName = "ftc-pit-map") {
    if (typeof customElements === "undefined" || customElements.get(tagName)) return;

    const ATTRS = {
        highlight: "highlight",
        outline: "outline",
        "highlight-color": "highlightColor",
        "outline-color": "outlineColor",
        theme: "theme",
        "dim-others": "dimOthers",
        controls: "controls",
        "scroll-zoom": "scrollZoom",
        "show-team-names": "showTeamNames",
        "click-action": "clickAction",
        "class-name": "className",
        pulse: "pulse",
        event: "event",
        "api-base": "apiBase",
        "graphql-url": "graphqlUrl",
    };
    const BOOL = new Set(["dimOthers", "controls", "pulse"]);

    class PitMapElement extends HTMLElement {
        static get observedAttributes() {
            return ["src", ...Object.keys(ATTRS)];
        }
        constructor() {
            super();
            this._opts = {};
            let shadow = this.attachShadow({ mode: "open" });
            let style = document.createElement("style");
            style.textContent = ":host{display:block;position:relative;min-height:120px;border-radius:12px;overflow:hidden}.wrap{position:absolute;inset:0}";
            this._wrap = document.createElement("div");
            this._wrap.className = "wrap";
            shadow.append(style, this._wrap);
        }
        connectedCallback() {
            if (this.map) return;
            this.map = new PitMap(this._wrap, { ...this._attrOptions(), ...this._opts, data: this._data || null });
            for (let name of ["pitclick", "pithover", "viewchange", "popupopen", "popupclose", "load", "error"]) {
                this.map.on(name, (detail) => {
                    let ev = new CustomEvent(name, { detail, bubbles: true, composed: true, cancelable: name === "pitclick" });
                    // event.preventDefault() on "pitclick" skips the built-in click action (popup).
                    if (!this.dispatchEvent(ev) && detail && detail.preventDefault) detail.preventDefault();
                });
            }
            if (this.getAttribute("src") && !this._data) this._load(this.getAttribute("src"));
        }
        disconnectedCallback() {
            this.map?.destroy();
            this.map = null;
        }
        attributeChangedCallback(name, oldV, newV) {
            if (oldV === newV || !this.map) return;
            if (name === "src") return newV && this._load(newV);
            this.map.update(this._attrOptions());
        }
        _attrOptions() {
            let o = {};
            for (let [attr, key] of Object.entries(ATTRS)) {
                if (!this.hasAttribute(attr)) continue;
                let v = this.getAttribute(attr);
                if (BOOL.has(key)) o[key] = v !== "false";
                else if (key === "scrollZoom" || key === "showTeamNames") o[key] = v === "true" ? true : v === "false" ? false : v;
                else if (key === "theme" && /^\s*\{/.test(v)) {
                    try {
                        o[key] = JSON.parse(v); // theme='{"base":"ftc-events","pitRadius":0.2}'
                    } catch {
                        o[key] = v;
                    }
                }
                else o[key] = v;
            }
            return o;
        }
        async _load(url) {
            let token = (this._token = {});
            try {
                let res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                let json = await res.json();
                if (token !== this._token) return;
                this.data = json;
                this.dispatchEvent(new CustomEvent("load", { detail: { data: json } }));
            } catch (error) {
                this.dispatchEvent(new CustomEvent("error", { detail: { error } }));
            }
        }
        get data() {
            return this._data;
        }
        set data(v) {
            this._data = v;
            this.map?.setData(v);
        }
        get options() {
            return this._opts;
        }
        set options(v) {
            this._opts = v || {};
            this.map?.update(this._opts);
        }
    }
    customElements.define(tagName, PitMapElement);
}

if (typeof window !== "undefined" && typeof customElements !== "undefined") definePitMapElement();

export default PitMap;
