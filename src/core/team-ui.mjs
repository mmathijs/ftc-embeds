// Shared by the team widgets (team-card, team-results, team-awards, next-match, team-season):
// themes, the widget base class, formatting, and the custom element factory.

import { parseTeamNumber } from "./team-api.mjs";
import { TEAM_TEXT, fill } from "./team-text.mjs";

const PREFIX = "ftcw";

// Theme tokens. Sizes and type are shared (SIZES) and themes override what they change; every token
// can also be set from the page as --ftcw-<kebab-name>, or in a theme object.
const SIZES = {
    radius: "12px", // the card
    innerRadius: "8px", // tiles, stat blocks, the next-match box
    chipRadius: "999px", // chips and the scroll buttons
    avatarRadius: "4px", // team avatars (like FTCScout)
    avatarSize: "44px",
    borderWidth: "1px", // the card's border
    padding: "16px", // inside the card
    gap: "8px", // between stat blocks, tiles and alliances
    rowPadding: "10px", // above and below each row of a list
    tileWidth: "176px", // strip tiles
    tileHeight: "128px", // results tiles (at least)
    cardHeight: "150px", // award cards (at least)
    fontSize: "14px",
    smallSize: "12px", // dates, details, counts
    titleSize: "16px",
    titleWeight: "650",
    titleTransform: "none",
    titleLetterSpacing: "normal",
    valueSize: "19px", // stat values and ranks
    valueWeight: "700",
    labelTransform: "uppercase", // small labels ("Next match", "Upcoming events", seasons)
    labelLetterSpacing: ".04em",
    lineHeight: "1.4",
    nameSize: "18px", // the team card's team name
    nameWeight: "700",
    iconSize: "1em",
    chipFontSize: "11.5px",
    chipWeight: "550",
    chipPadding: "2px 8px",
    separatorWidth: "1px", // lines between rows
    glow: "0 0 22px 4px", // size of the glow around won awards and live/upcoming tiles ("0 0 0 0": none)
    glowRoom: "14px", // room around scrolling strips, so glows aren't cut off
    font: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
};

// FTCScout: its own CSS variables, with its light or dark values as fallback (so on FTCScout it
// follows the site's dark mode; elsewhere "ftcscout-dark" gives the dark look).
const ftcscout = (d) => ({
    ...SIZES,
    bg: `var(--fg-color, ${d ? "rgb(45, 45, 45)" : "#ffffff"})`, surface: `var(--bg-color, ${d ? "#161616" : "#f2f2f2"})`,
    text: `var(--text-color, ${d ? "#dfe2e6" : "#000000"})`, muted: `var(--secondary-text-color, ${d ? "#b7b7b8" : "#636466"})`,
    border: `var(--sep-color, ${d ? "#4a4e51" : "lightgray"})`,
    accent: `var(--theme-color, ${d ? "rgb(57, 132, 142)" : "rgb(44, 102, 110)"})`, accentText: "var(--theme-text-color, #ffffff)",
    red: `var(--red-team-text-color, ${d ? "rgb(255, 83, 71)" : "rgb(175, 29, 29)"})`, blue: `var(--blue-team-text-color, ${d ? "rgb(33, 150, 243)" : "rgb(27, 87, 179)"})`,
    good: `var(--generic-advanced-color, ${d ? "#14d55b" : "#097a34"})`, bad: `var(--red-team-text-color, ${d ? "rgb(255, 83, 71)" : "rgb(175, 29, 29)"})`,
    gold: d ? "#e0b23a" : "#c99a06", shadow: "none",
    radius: "8px", innerRadius: "5px", padding: "14px", font: 'var(--font-family, "Inter", sans-serif)',
});

export const TEAM_THEMES = {
    light: {
        ...SIZES,
        bg: "#ffffff", surface: "#f5f6f8", text: "#1d2329", muted: "#5d6773", border: "#e2e5ea",
        accent: "#2563eb", accentText: "#ffffff", red: "#d32f2f", blue: "#1e63d6", good: "#1f8a4c", bad: "#c62828", gold: "#c99a06",
        shadow: "0 1px 3px rgba(16,24,40,.08)",
    },
    dark: {
        ...SIZES,
        bg: "#16191e", surface: "#1e2228", text: "#e8ebef", muted: "#9aa3ad", border: "#2c313a",
        accent: "#6b9cff", accentText: "#0b1220", red: "#ef5350", blue: "#5b9bff", good: "#43c47a", bad: "#ef5350", gold: "#e0b23a",
        shadow: "none",
    },
    ftcscout: ftcscout(false),
    "ftcscout-dark": ftcscout(true),
    // Trophy-case look (dark slate, metallic award cards, amber for wins). Also adds the widgets'
    // "trophy" CSS (TeamWidget.skins.trophy).
    trophy: {
        ...SIZES,
        bg: "#2b313d", surface: "rgba(255,255,255,.07)", text: "#f8fafc", muted: "#cbd5e1", border: "rgba(255,255,255,.09)",
        accent: "#fbbf24", accentText: "#111827", red: "#f87171", blue: "#60a5fa", good: "#4ade80", bad: "#f87171", gold: "#fbbf24",
        shadow: "0 10px 30px rgba(0,0,0,.25)",
        radius: "14px", innerRadius: "12px", padding: "20px", gap: "12px", tileWidth: "200px", cardHeight: "264px",
        titleSize: "20px", titleWeight: "800", titleTransform: "uppercase", titleLetterSpacing: ".01em",
        valueSize: "26px", valueWeight: "850", labelLetterSpacing: ".06em", nameSize: "24px", nameWeight: "850",
        chipFontSize: "10.5px", chipWeight: "700", chipPadding: "3px 9px", glow: "0 0 24px 5px", glowRoom: "18px",
    },
    "ftc-events": {
        ...SIZES,
        bg: "#ffffff", surface: "#f2f2f2", text: "#212529", muted: "#6c757d", border: "#dee2e6",
        accent: "#0066b3", accentText: "#ffffff", red: "#ed1c24", blue: "#0066b3", good: "#198754", bad: "#dc3545", gold: "#c99a06",
        shadow: "none", radius: "4px", innerRadius: "4px", chipRadius: "4px", avatarRadius: "0",
        font: '"Roboto", "Helvetica Neue", Arial, sans-serif',
    },
};

/** The icons and their default glyphs; override with --ftcw-icon-<name> or the `icons` option. */
export const ICONS = {
    trophy: "🏆", // a won award
    medal: "🏅", // any other award
    advanced: "✓", // advanced from the event
    live: "", // the dot before "Live" (drawn with CSS)
    upcoming: "", // before an upcoming event's countdown
    calendar: "📅",
    location: "📍",
    website: "🔗",
    prev: "‹",
    next: "›",
};

const DARK = typeof matchMedia !== "undefined" ? matchMedia("(prefers-color-scheme: dark)") : null;

const themeBase = (t) => (t && typeof t === "object" ? t.base : t);

// Extra CSS a theme brings besides its tokens, shared by all widgets; each widget adds its own
// (static skins = { trophy: "…" }). Pick one without its colors with the `skin` option.
const SKINS = {
    trophy: `
.ftcw{background:linear-gradient(180deg,color-mix(in srgb,var(--_bg) 82%,#fff) 0%,var(--_bg) 140px)}
.head{margin-bottom:16px}
.chip{letter-spacing:.03em;text-transform:uppercase}
.chip.upcoming{background:var(--_accent);color:var(--_accent-text)}
.arrows button{background:rgba(255,255,255,.1);color:#fff}
.arrows button:hover:not(:disabled){background:var(--_accent);color:var(--_accent-text)}
.metal{background:linear-gradient(160deg,#e4e4e7 0%,#b4b4bb 45%,#8e8e97 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.65),inset 0 -2px 6px rgba(0,0,0,.12),0 8px 18px rgba(0,0,0,.28)}`,
};

/** "auto" | "light" | "dark" | "ftcscout" | "ftc-events" | "trophy", or { base, ...tokens }. */
export function resolveTeamTheme(theme) {
    let named = (name) => (!name || name === "auto" ? (DARK?.matches ? TEAM_THEMES.dark : TEAM_THEMES.light) : TEAM_THEMES[name] || TEAM_THEMES.light);
    if (theme && typeof theme === "object") return { ...named(theme.base || "auto"), ...theme };
    return named(theme);
}

const kebab = (s) => s.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());

const BASE_CSS = `
:host{display:block;container-type:inline-size}
.${PREFIX}{box-sizing:border-box;font-family:var(--_font);color:var(--_text);background:var(--_bg);border:var(--_border-width) solid var(--_border);border-radius:var(--_radius);box-shadow:var(--_shadow);padding:var(--_padding);font-size:var(--_font-size);line-height:var(--_line-height);font-variant-numeric:tabular-nums;overflow-wrap:break-word}
.${PREFIX}.density-compact{--_padding:10px;--_gap:6px;--_row-padding:6px;line-height:1.3}
.${PREFIX}.density-compact .head{margin-bottom:6px}
.${PREFIX}.bare{border:0;box-shadow:none;background:transparent;padding:0}
.${PREFIX}.bare .strip{margin-inline:0;padding-inline:0;scroll-padding-inline:0}
.${PREFIX} *,.${PREFIX} *::before,.${PREFIX} *::after{box-sizing:inherit}
.${PREFIX} a{color:inherit;text-decoration:none}
.${PREFIX} a:hover{text-decoration:underline}
.muted{color:var(--_muted)}
.small{font-size:var(--_small-size)}
.title{font-weight:var(--_title-weight);font-size:var(--_title-size);text-transform:var(--_title-transform);letter-spacing:var(--_title-letter-spacing);margin:0}
.head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:12px}
.chip{display:inline-flex;align-items:center;gap:4px;font-size:var(--_chip-font-size);font-weight:var(--_chip-weight);padding:var(--_chip-padding);border-radius:var(--_chip-radius);background:var(--_surface);color:var(--_muted);white-space:nowrap}
.chip.accent{background:var(--_accent);color:var(--_accent-text)}
.chip.good{background:color-mix(in srgb,var(--_good) 14%,transparent);color:var(--_good)}
.chip.live{background:color-mix(in srgb,var(--_bad) 14%,transparent);color:var(--_bad)}
.chip.live::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor;animation:${PREFIX}-blink 1.4s ease-in-out infinite}
@keyframes ${PREFIX}-blink{50%{opacity:.25}}
.status{padding:20px 4px;text-align:center;color:var(--_muted)}
.skeleton{height:12px;border-radius:6px;background:var(--_surface);margin:10px 0;animation:${PREFIX}-pulse 1.4s ease-in-out infinite}
@keyframes ${PREFIX}-pulse{50%{opacity:.5}}
.foot{margin-top:12px;display:flex;justify-content:flex-end;font-size:12px;color:var(--_muted)}
.strip{display:flex;gap:var(--_gap);overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--_muted) 45%,transparent) transparent;padding:var(--_glow-room);margin:calc(var(--_glow-room) * -1);scroll-padding-inline:var(--_glow-room)}
.strip>*{flex:0 0 var(--tile,var(--_tile-width));scroll-snap-align:start;background:var(--_surface);border-radius:var(--_inner-radius);padding:10px 12px;display:flex;flex-direction:column;min-width:0}
.arrows{display:flex;gap:4px}
.arrows button{all:unset;cursor:pointer;width:26px;height:26px;display:grid;place-items:center;border-radius:var(--_chip-radius);background:var(--_surface);color:var(--_text);font-size:15px;line-height:1}
.arrows button:disabled{opacity:.35;cursor:default}
.arrows button:focus-visible{outline:2px solid var(--_accent)}
.clamp2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ell{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.icon{display:inline-flex;align-items:center;justify-content:center;line-height:1;flex:none;font-size:var(--_icon-size)}
.icon:empty:not([data-icon]){display:none}
.icon img,.icon svg{width:1em;height:1em;object-fit:contain}
.red{color:var(--_red)}
.blue{color:var(--_blue)}
.win{color:var(--_good);font-weight:650}
.loss{color:var(--_bad);font-weight:650}
@media (prefers-reduced-motion:reduce){.chip.live::before,.skeleton{animation:none}}
`;

/** Element helper: h("div", { class: "x", onclick }, child, "text", [more]). */
export function h(tag, attrs, ...children) {
    let el = document.createElement(tag);
    for (let [k, v] of Object.entries(attrs || {})) {
        if (v == null || v === false) continue;
        if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
        else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
        else el.setAttribute(k, v === true ? "" : v);
    }
    for (let c of children.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
    return el;
}

// -------------------------------------------------------------- formatting

export function ordinal(n) {
    let s = ["th", "st", "nd", "rd"];
    let v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const AWARD_NAMES = {
    Compass: "Compass Award", Connect: "Connect Award", Control: "Control Award", Design: "Design Award",
    Innovate: "Innovate Award", Inspire: "Inspire Award", JudgesChoice: "Judges' Choice Award", Motivate: "Motivate Award",
    Reach: "Reach Award", Sustain: "Sustain Award", Promote: "Promote Award", Think: "Think Award",
    Winner: "Winning Alliance", Finalist: "Finalist Alliance", DivisionWinner: "Division Winning Alliance",
    DivisionFinalist: "Division Finalist Alliance", ConferenceFinalist: "Conference Finalist Alliance", TopRanked: "Top Ranked",
};
const ALLIANCE_AWARDS = new Set(["Winner", "Finalist", "DivisionWinner", "DivisionFinalist", "ConferenceFinalist"]);

/**
 * [name, placement] the way FTCScout prints awards, e.g. ["Winning Alliance", "1st Pick"]. With a
 * widget: its awardNames and texts (captain, pick, winner, place).
 */
export function awardParts(type, placement, season = null, w = null) {
    let t = (key, vars) => (w ? w.t(key, vars) : fill(TEAM_TEXT[key], vars));
    let custom = w?.options.awardNames?.[type];
    let nth = ordinal;
    if (type.startsWith("DeansList")) {
        let rank = { DeansListWinner: "Winner", DeansListFinalist: "Finalist", DeansListSemiFinalist: "Semifinalist" }[type];
        return [custom ?? (season >= 2025 ? `FIRST Leadership Award ${rank}` : `Dean's List ${rank}`), ""];
    }
    if (ALLIANCE_AWARDS.has(type)) return [custom ?? AWARD_NAMES[type], placement == 1 ? t("captain") : t("pick", { nth: nth(placement - 1) })];
    if (type === "TopRanked") return [custom ?? "Top Ranked", t("place", { nth: nth(placement) })];
    return [custom ?? AWARD_NAMES[type] ?? type, placement == 1 ? t("winner") : t("place", { nth: nth(placement) })];
}

/** Whether an award means the team won something (for highlighting). */
export const isWinningAward = (type, placement) => placement == 1 || (ALLIANCE_AWARDS.has(type) && type.includes("Winner"));

export function seasonName(season) {
    return `${season}–${String((season + 1) % 100).padStart(2, "0")}`;
}

// Event dates are plain dates ("2026-02-07"): format them without a time zone shift.
const asDate = (d) => new Date(`${d}T12:00:00Z`);
export function dateRange(start, end, locale = undefined) {
    let s = asDate(start);
    let e = asDate(end || start);
    let f = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
    if (start === end || !end || !f.formatRange) return f.format(s);
    return f.formatRange(s, e);
}
export const shortDate = (d, locale = undefined) => asDate(d).toLocaleDateString(locale, { month: "short", day: "numeric", timeZone: "UTC" });

export function place(loc) {
    if (!loc) return "";
    let parts = [loc.city, loc.state, loc.country].filter(Boolean);
    return [...new Set(parts)].join(", ");
}

/** Whole days from `now` until a plain date ("2026-02-07"), in the viewer's calendar. */
export function daysUntil(date, now = new Date()) {
    let today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((asDate(date) - 12 * 3600e3 - today) / 86400e3);
}

export function untilLabel(days) {
    if (days <= 0) return "today";
    if (days === 1) return "tomorrow";
    if (days < 14) return `in ${days} days`;
    if (days < 60) return `in ${Math.round(days / 7)} weeks`;
    return `in ${Math.round(days / 30)} months`;
}

export const record = (s) => (s && s.wins != null ? `${s.wins}-${s.losses}-${s.ties}` : null);

const TYPE_NAMES = {
    Scrimmage: "Scrimmage", LeagueMeet: "League Meet", Qualifier: "Qualifier", LeagueTournament: "League Tournament",
    Championship: "Championship", FIRSTChampionship: "FIRST Championship", SuperQualifier: "Super Qualifier",
    Premier: "Premier Event", OffSeason: "Off-Season", Kickoff: "Kickoff", Workshop: "Workshop",
    DemoExhibition: "Demo", PracticeDay: "Practice Day", NonAdvancement: "Non-Advancement", InnovationChallenge: "Innovation Challenge",
};
export const eventType = (t, w = null) => w?.options.eventTypes?.[t] ?? TYPE_NAMES[t] ?? t;

/** A horizontally scrolling row of tiles, with prev/next buttons for the heading. */
export function strip(tiles, w = null) {
    let row = h("div", { class: "strip", part: "strip", tabindex: "0" }, tiles);
    let step = (dir) => row.scrollBy({ left: dir * (row.clientWidth * 0.8), behavior: "smooth" });
    let prev = h("button", { type: "button", part: "arrow", "aria-label": w ? w.t("scrollBack") : "Scroll back", onclick: () => step(-1) }, w ? w.icon("prev") : "‹");
    let next = h("button", { type: "button", part: "arrow", "aria-label": w ? w.t("scrollOn") : "Scroll on", onclick: () => step(1) }, w ? w.icon("next") : "›");
    let sync = () => {
        prev.disabled = row.scrollLeft <= 2;
        next.disabled = row.scrollLeft + row.clientWidth >= row.scrollWidth - 2;
        arrows.style.visibility = row.scrollWidth > row.clientWidth + 2 ? "" : "hidden";
    };
    let arrows = h("div", { class: "arrows", part: "arrows" }, prev, next);
    row.addEventListener("scroll", sync, { passive: true });
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(sync).observe(row);
    requestAnimationFrame(sync);
    return { row, arrows };
}

// -------------------------------------------------------------- base widget

const DEFAULTS = {
    team: null,
    season: null, // default: the current season
    theme: "auto",
    apiBase: null,
    graphqlUrl: null,
    siteUrl: "https://ftcscout.mmathijs.nl", // links to the team/event pages; "" for no links
    title: null, // override the heading; "" hides it
    layout: null, // each widget's default; see its docs ("list", "strip", "compact")
    density: "normal", // "normal" | "compact"
    hide: null, // parts to leave out: "website,epa" or ["website", "epa"]; see each widget's docs
    limit: null, // show at most this many items
    linkTarget: "_blank", // "_blank" | "_self" | "none" (no links)
    bare: false, // no card around it (no background, border or padding)
    icons: null, // { trophy: "★", medal: "<svg …>", advanced: "https://…/flag.png" }; see ICONS
    text: null, // change any text: { nextMatch: "Up next", awards: "Trophies" }; see TEAM_TEXT
    locale: null, // dates, times and numbers, e.g. "en-GB"; default: the visitor's
    decimals: 1, // OPR and EPA
    awardNames: null, // { Inspire: "Inspire Award", Winner: "Winning Alliance" }
    eventTypes: null, // { Qualifier: "Kwalificatie" }
    linkTo: "ftcscout", // "ftcscout" | "ftc-events": where team and event names link to
    teamUrl: null, // or a template: "https://example.org/teams/{team}"
    eventUrl: null, // "https://example.org/events/{season}/{code}"
    css: "", // extra CSS inside the widget (style anything; parts are also open to ::part())
    skin: null, // a theme's extra CSS without its colors, e.g. "trophy"; default: the theme's own
    maxHeight: null, // e.g. "320px": the list scrolls inside the widget
    now: null, // pretend it is this time (demos, tests)
};

/**
 * Base of the team widgets: renders into its own shadow root inside `container`, loads its data
 * when `team` is set, and re-renders on update(). Subclasses implement fetch() and view().
 */
export class TeamWidget {
    constructor(container, options = {}) {
        if (!container) throw new Error("ftc-embeds: no container element");
        this.container = container;
        this.options = { ...DEFAULTS, ...this.constructor.defaults, ...options };
        this.data = options.data ?? null;
        this.error = null;
        this._listeners = new Map();
        this.host = h("div", { class: `${PREFIX}-host` });
        container.append(this.host);
        this.root = this.host.attachShadow({ mode: "open" });
        this._onScheme = () => this.render();
        DARK?.addEventListener?.("change", this._onScheme);
        if (this.data) this.render();
        else if (this.options.team != null) this.load();
        else this.render();
    }

    /** Merge options; reloads when what is shown changes, otherwise only re-renders. */
    update(options = {}) {
        let prev = this.options;
        this.options = { ...prev, ...options };
        if ("data" in options) return this.setData(options.data);
        let reload = ["team", "season", "apiBase", "graphqlUrl"].some((k) => k in options && options[k] !== prev[k]);
        reload && this.options.team != null ? this.load() : this.render();
        return this;
    }

    setData(data) {
        this.data = data;
        this.error = null;
        this.render();
        return this;
    }

    /** Load (or refresh) the data. Resolves to the data, or null on failure. */
    async load() {
        let token = (this._token = {});
        if (!this.data) this.render();
        try {
            let data = await this.fetch({ season: this.options.season, apiBase: this.options.apiBase, graphqlUrl: this.options.graphqlUrl });
            if (token !== this._token) return null;
            this.data = data;
            this.error = null;
            this.render();
            this._emit("load", { data });
            return data;
        } catch (error) {
            if (token !== this._token) return null;
            this.error = error;
            this.render();
            this._emit("error", { error });
            return null;
        }
    }

    /** Subscribe to "load" | "error". Returns an unsubscribe function. */
    on(name, fn) {
        if (!this._listeners.has(name)) this._listeners.set(name, new Set());
        this._listeners.get(name).add(fn);
        return () => this._listeners.get(name)?.delete(fn);
    }

    _emit(name, detail) {
        for (let fn of this._listeners.get(name) || []) fn(detail);
    }

    destroy() {
        this._destroyed = true;
        this._token = null;
        clearTimeout(this._refreshTimer);
        DARK?.removeEventListener?.("change", this._onScheme);
        this.host.remove();
    }

    /**
     * An icon. The `icons` option replaces it ({ trophy: "★" }, an "<svg …>" string or an image
     * URL); otherwise CSS draws it, so --ftcw-icon-<name>: "★" on the page changes it too.
     */
    icon(name) {
        let custom = this.options.icons?.[name];
        let attrs = { class: "icon", "data-icon": custom == null ? name : null, part: `icon icon-${name}`, "aria-hidden": "true" };
        if (custom == null) return h("span", attrs);
        if (custom === "" || custom === false) return null;
        let el = h("span", { ...attrs, class: "icon custom" });
        if (/^\s*<svg[\s>]/i.test(custom)) el.innerHTML = custom;
        else if (/^(https?:|data:|\/|\.\/)/.test(custom)) el.append(h("img", { src: custom, alt: "" }));
        else el.textContent = custom;
        return el;
    }

    /** A text, with the `text` option's changes; see TEAM_TEXT. */
    t(key, vars) {
        return fill(this.options.text?.[key] ?? TEAM_TEXT[key] ?? key, vars);
    }

    get locale() {
        return this.options.locale || undefined;
    }

    /** "in 3 weeks", "tomorrow", … */
    until(days) {
        if (days <= 0) return this.t("today");
        if (days === 1) return this.t("tomorrow");
        if (days < 14) return this.t("inDays", { n: days });
        if (days < 60) return this.t("inWeeks", { n: Math.round(days / 7) });
        return this.t("inMonths", { n: Math.round(days / 30) });
    }

    num(value, digits = Number(this.options.decimals ?? 1)) {
        return value == null ? "–" : Number(value).toLocaleString(this.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    }

    dates(start, end) {
        return dateRange(start, end, this.locale);
    }

    day(date) {
        return shortDate(date, this.locale);
    }

    /** Whether a part is shown: not in the `hide` option. */
    shows(part) {
        let hide = this.options.hide;
        if (!hide) return true;
        let list = Array.isArray(hide) ? hide : String(hide).split(/[\s,]+/);
        return !list.includes(part);
    }

    get layout() {
        return this.options.layout || this.constructor.defaults?.layout || "list";
    }

    /** The time widgets treat as now (the `now` option, for demos). */
    now() {
        return this.options.now ? new Date(this.options.now) : new Date();
    }

    get number() {
        try {
            return parseTeamNumber(this.options.team);
        } catch {
            return null;
        }
    }

    /** Link to a page on FTCScout ("/teams/16236"), or plain text without a siteUrl. */
    link(path, ...children) {
        let base = this.options.siteUrl;
        let target = this.options.linkTarget;
        if (!base || target === "none") return h("span", null, ...children);
        return h("a", { href: base.replace(/\/+$/, "") + path, target: target === "_self" ? null : target || "_blank", rel: "noopener" }, ...children);
    }

    /** A link to a full URL, honoring linkTarget. */
    linkTo(url, ...children) {
        let target = this.options.linkTarget;
        if (!url || target === "none") return h("span", null, ...children);
        return h("a", { href: url, target: target === "_self" ? null : target || "_blank", rel: "noopener" }, ...children);
    }

    teamLink(number, ...children) {
        let o = this.options;
        let season = o.season || "";
        let url = o.teamUrl
            ? fill(o.teamUrl, { team: number, season })
            : o.linkTo === "ftc-events"
              ? `https://ftc-events.firstinspires.org/${season || new Date().getFullYear()}/team/${number}`
              : null;
        return url ? this.linkTo(url, ...(children.length ? children : [String(number)])) : this.link(`/teams/${number}`, ...(children.length ? children : [String(number)]));
    }

    eventLink(season, code, ...children) {
        let o = this.options;
        let url = o.eventUrl ? fill(o.eventUrl, { season, code }) : o.linkTo === "ftc-events" ? `https://ftc-events.firstinspires.org/${season}/${code}` : null;
        return url ? this.linkTo(url, ...children) : this.link(`/events/${season}/${code}/matches`, ...children);
    }

    heading(text, extra = null) {
        let title = this.options.title ?? text;
        if (title === "" && !extra) return null;
        return h("div", { class: "head", part: "head" }, title === "" ? h("span") : h("h2", { class: "title", part: "title" }, title), extra);
    }

    render() {
        let t = resolveTeamTheme(this.options.theme);
        // Every token can also be set from the page: --ftcw-accent, --ftcw-radius, ...
        // Internally --_<token>, so a theme can use the page's own variables of the same name
        // (accent: "var(--accent)") without referring to itself.
        let vars = Object.entries(t).map(([k, v]) => `--_${kebab(k)}:var(--${PREFIX}-${kebab(k)},${v})`).join(";");
        let icons = Object.entries(ICONS).map(([k, v]) => `.icon[data-icon="${k}"]::before{content:var(--${PREFIX}-icon-${k},${JSON.stringify(v)})}`).join("");
        let body;
        if (this.options.team == null && !this.data) body = h("div", { class: "status" }, this.t("noTeam"));
        else if (this.error) {
            body = h("div", { class: "status" }, this.error.notFound ? this.t("notFound", { team: this.options.team }) : this.t("loadError"));
        } else if (!this.data) body = h("div", { "aria-busy": "true" }, h("div", { class: "skeleton", style: { width: "45%" } }), h("div", { class: "skeleton" }), h("div", { class: "skeleton", style: { width: "75%" } }));
        else body = this.view(this.data);
        let skin = this.options.skin ?? (themeBase(this.options.theme) === "trophy" ? "trophy" : null);
        let skinCss = skin ? (SKINS[skin] || "") + (this.constructor.skins?.[skin] || "") : "";
        let style = h("style", null, `:host{${vars}}` + BASE_CSS + icons + (this.constructor.css || "") + skinCss + (this.options.css || ""));
        let cls = [PREFIX, `${PREFIX}-${this.constructor.kind}`, `layout-${this.layout}`, `density-${this.options.density || "normal"}`, this.options.bare ? "bare" : ""];
        let card = h("div", { class: cls.filter(Boolean).join(" "), part: `card ${this.constructor.kind}` }, body);
        if (this.options.maxHeight) Object.assign(card.style, { maxHeight: this.options.maxHeight, overflowY: "auto" });
        this.root.replaceChildren(style, card);
        this._scheduleRefresh();
    }

    // Live widgets (isLive(data) true) refresh every `refresh` seconds while the page is visible.
    _scheduleRefresh() {
        clearTimeout(this._refreshTimer);
        let seconds = Number(this.options.refresh) || 30;
        if (this._destroyed || !this.isLive || !this.data || this.options.data || !this.isLive(this.data)) return;
        this._refreshTimer = setTimeout(() => {
            if (typeof document !== "undefined" && document.hidden) {
                document.addEventListener("visibilitychange", () => this.load(), { once: true });
            } else this.load();
        }, seconds * 1000);
    }

    // Subclasses: fetch(apiOptions) -> data, view(data) -> Node.
    fetch() {
        throw new Error("not implemented");
    }
    view() {
        return h("div");
    }
}

/** Options that are on or off: present (`<ftc-team-card bare>`) means on. */
const FLAGS = new Set(["bare", "onlyWon"]);

/** An attribute's option value: JSON for objects and arrays, "true"/"false" as booleans, and a
 * flag attribute without a value ("") as true. */
export function attrValue(v, flag = false) {
    if (flag && v === "") return true;
    if (/^\s*[{[]/.test(v)) {
        try {
            return JSON.parse(v);
        } catch {
            // keep the string
        }
    }
    if (v === "true" || v === "false") return v === "true";
    return v;
}

/**
 * Registers a custom element for a widget class. Attributes: team, season, theme (preset name or
 * JSON tokens), api-base, graphql-url, site-url, title, plus the widget's own (extraAttrs:
 * { "attr-name": "optionName" }). Property: options (any widget option); the instance is .widget.
 * Events: "load", "error".
 */
export function defineTeamElement(tagName, Widget, extraAttrs = {}) {
    if (typeof customElements === "undefined" || customElements.get(tagName)) return;
    const ATTRS = {
        team: "team", season: "season", theme: "theme", "api-base": "apiBase", "graphql-url": "graphqlUrl", "site-url": "siteUrl", title: "title",
        layout: "layout", density: "density", hide: "hide", limit: "limit", "max-height": "maxHeight", "link-target": "linkTarget", bare: "bare", now: "now",
        icons: "icons", css: "css", skin: "skin", text: "text", locale: "locale", decimals: "decimals",
        "award-names": "awardNames", "event-types": "eventTypes", "link-to": "linkTo", "team-url": "teamUrl", "event-url": "eventUrl",
        ...extraAttrs,
    };

    class TeamWidgetElement extends HTMLElement {
        static get observedAttributes() {
            return Object.keys(ATTRS);
        }
        connectedCallback() {
            if (this.widget) return;
            this.widget = new Widget(this, { ...this._attrOptions(), ...this._opts });
            for (let name of ["load", "error"]) this.widget.on(name, (detail) => this.dispatchEvent(new CustomEvent(name, { detail })));
        }
        disconnectedCallback() {
            this.widget?.destroy();
            this.widget = null;
        }
        attributeChangedCallback(name, oldV, newV) {
            if (oldV !== newV && this.widget) this.widget.update(this._attrOptions());
        }
        _attrOptions() {
            let o = {};
            for (let [attr, key] of Object.entries(ATTRS)) {
                if (!this.hasAttribute(attr)) continue;
                o[key] = attrValue(this.getAttribute(attr), FLAGS.has(key));
            }
            return o;
        }
        get options() {
            return this._opts || {};
        }
        set options(v) {
            this._opts = v || {};
            this.widget?.update(this._opts);
        }
    }
    customElements.define(tagName, TeamWidgetElement);
}

