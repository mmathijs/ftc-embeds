// Guided setup for ftc-embeds.com/setup: a few questions, one per page, then the code with
// instructions for the visitor's website builder. The step is in the query (?step=look), the answers
// in the hash (same JSON-in-the-hash style as the dashboards), so every page is a real link and the
// back button walks back through the questions.
(() => {
    const SITE = window.FTC_EMBEDS_SITE || {};
    const EXAMPLES = window.PIT_MAPS || {};
    const LIVE_API = !!(SITE.apiBase || SITE.graphqlUrl);
    const ORIGIN = location.origin;
    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    // ------------------------------------------------------------ what can be picked

    const WIDGETS = {
        "team-card": { global: "FtcTeamCard", cls: "TeamCard", tag: "ftc-team-card", label: "Team card", text: "Name, location, the stats you pick and your next events. Good at the top of a homepage.", badge: "Most used", layouts: { list: "Card", compact: "One row" }, height: 300 },
        "team-results": { global: "FtcTeamResults", cls: "TeamResults", tag: "ftc-team-results", label: "Season results", text: "Every event this season: rank, record, awards and advancement.", layouts: { list: "List", strip: "Scrolling tiles" }, height: 460 },
        "team-awards": { global: "FtcTeamAwards", cls: "TeamAwards", tag: "ftc-team-awards", label: "Awards", text: "Every award your team has won, grouped by season.", layouts: { list: "List", strip: "Trophy cards" }, height: 420 },
        "next-match": { global: "FtcNextMatch", cls: "NextMatch", tag: "ftc-next-match", label: "Next match", text: "While you compete: your next match, the alliances and a countdown. Updates by itself.", badge: "During events", layouts: { list: "Full", compact: "Two lines" }, height: 230 },
        "team-season": { global: "FtcTeamSeason", cls: "TeamSeason", tag: "ftc-team-season", label: "Season + next match", text: "Season results, with the live next match on top while you compete.", layouts: { list: "List", strip: "Scrolling tiles" }, height: 520 },
        countdown: { global: "FtcCountdown", cls: "Countdown", tag: "ftc-countdown", label: "Countdown", text: "Days, hours and minutes to your next event, or to your next match while you compete.", layouts: { list: "Boxes", compact: "One line" }, height: 200 },
        "event-rankings": { global: "FtcEventRankings", cls: "EventRankings", tag: "ftc-event-rankings", label: "Event rankings", text: "The rankings of the event you're at, or your latest one, with your team marked. Moves on by itself.", badge: "Live", layouts: {}, height: 560 },
    };
    // Widgets about an event. The pit map has its own steps (and library); the rest work like the
    // team widgets, with an event code instead of a team.
    const EVENT_WIDGETS = {
        "pit-map": { label: "Pit map", text: "A map visitors can search, with walking routes to pits and fields.", badge: "Most used" },
        "event-rankings": { global: "FtcEventRankings", cls: "EventRankings", tag: "ftc-event-rankings", label: "Rankings", text: "Rank, ranking points, record and OPR of every team. Updates itself during the event.", badge: "Live", layouts: {}, height: 560 },
        "event-matches": { global: "FtcEventMatches", cls: "EventMatches", tag: "ftc-event-matches", label: "Match schedule", text: "Every match with its time, alliances and score, the next one marked.", badge: "Live", layouts: {}, height: 600 },
        "event-advancement": { global: "FtcEventAdvancement", cls: "EventAdvancement", tag: "ftc-event-advancement", label: "Advancement", text: "How many teams advance and where to, each team's points, and who made it.", layouts: {}, height: 600 },
        "league-standings": { global: "FtcLeagueStandings", cls: "LeagueStandings", tag: "ftc-league-standings", label: "League standings", text: "A league's standings, from any of its meets. Stays current all season.", layouts: {}, height: 560 },
        countdown: { global: "FtcCountdown", cls: "Countdown", tag: "ftc-countdown", label: "Countdown", text: "Days, hours and minutes until the event starts; \"Happening now\" while it's on.", layouts: { list: "Boxes", compact: "One line" }, height: 200 },
    };
    /** What the event path is setting up: the pit map, or one of the other event widgets. */
    const isMap = () => state.kind == "event" && state.eventWidget == "pit-map";
    const isEventWidget = () => state.kind == "event" && state.eventWidget != "pit-map";
    // Colors: a family, in a light, a dark, or a follow-the-visitor version. The theme names are the
    // libraries' own ("custom" is the wizard's: the visitor's own colors, sent as tokens). Swatches
    // (background, accent) are close to each theme, for picking only.
    const FAMILIES = {
        default: { label: "Default", text: "Clean, with blue accents", names: { auto: "auto", light: "light", dark: "dark" }, light: ["#ffffff", "#2563eb"], dark: ["#16191e", "#6b9cff"] },
        trophy: { label: "Trophy case", text: "Metallic cards, amber for wins", names: { auto: "trophy-auto", light: "trophy-light", dark: "trophy" }, light: ["#f7f5f0", "#d97706"], dark: ["#2b313d", "#fbbf24"], teamOnly: true },
        ftcscout: { label: "FTCScout", text: "Looks like FTCScout", names: { auto: "ftcscout-auto", light: "ftcscout", dark: "ftcscout-dark" }, light: ["#ffffff", "#2c666e"], dark: ["#2d2d2d", "#39848e"] },
        "ftc-events": { label: "FTC Events", text: "Looks like FIRST's site", names: { auto: "ftc-events-auto", light: "ftc-events", dark: "ftc-events-dark" }, light: ["#ffffff", "#0066b3"], dark: ["#212529", "#4d9fe0"] },
        custom: { label: "Custom", text: "Your own colors", names: { auto: "custom", light: "custom-light", dark: "custom-dark" } },
    };
    const MODES = { auto: ["Follow the visitor", "Light or dark, like their device"], light: ["Light", "For light websites"], dark: ["Dark", "For dark websites"] };
    /** [family, mode] of a theme name; unknown names count as the default family. */
    function splitTheme(name) {
        for (let [f, fam] of Object.entries(FAMILIES)) for (let [m, n] of Object.entries(fam.names)) if (n == name) return [f, m];
        return ["default", "auto"];
    }
    const themeLabel = (name) => {
        let [f, m] = splitTheme(name);
        return `${FAMILIES[f].label}, ${m == "auto" ? "following the visitor" : m}`;
    };
    const DARK_MQ = matchMedia("(prefers-color-scheme: dark)");
    const looksDark = (name) => {
        let m = splitTheme(name)[1];
        return m == "dark" || (m == "auto" && DARK_MQ.matches);
    };
    // Choice keys that aren't stored as such: family and mode of the team (theme) or map (mapTheme) colors.
    const VIRTUAL = {
        family: ["theme", 0], mode: ["theme", 1],
        mapFamily: ["mapTheme", 0], mapMode: ["mapTheme", 1],
    };
    const virtualGet = (key) => splitTheme(state[VIRTUAL[key][0]])[VIRTUAL[key][1]];
    function virtualSet(key, value) {
        let [field, i] = VIRTUAL[key];
        let parts = splitTheme(state[field]);
        parts[i] = value;
        return { [field]: FAMILIES[parts[0]].names[parts[1]] };
    }

    // Custom colors: the six tokens both libraries understand, for light and for dark mode. Saved
    // ones ("templates") live in this browser, and in the link of a setup that uses them.
    const PALETTE = { bg: "Background", surface: "Cards & tiles", text: "Text", muted: "Quiet text", border: "Lines", accent: "Accent" };
    const CUSTOM_DEFAULT = {
        light: { bg: "#ffffff", surface: "#f5f6f8", text: "#1d2329", muted: "#5d6773", border: "#e2e5ea", accent: "#2563eb" },
        dark: { bg: "#16191e", surface: "#1e2228", text: "#e8ebef", muted: "#9aa3ad", border: "#2c313a", accent: "#6b9cff" },
    };
    const TEMPLATES_KEY = "ftc-embeds:color-templates";
    function loadTemplates() {
        try {
            let list = JSON.parse(localStorage.getItem(TEMPLATES_KEY) || "[]");
            return Array.isArray(list) ? list.filter((t) => t && t.name && t.light && t.dark) : [];
        } catch {
            return [];
        }
    }
    function saveTemplates(list) {
        try {
            localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list));
            return true;
        } catch {
            return false;
        }
    }
    // Any CSS color (also var(--x, fallback) and rgba over a background) as #rrggbb, for <input type=color>.
    const ctx = Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d", { willReadFrequently: true });
    function toHex(color, under = "#ffffff") {
        let c = String(color).trim().replace(/^var\([^,]+,\s*(.*)\)$/, "$1");
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = under;
        ctx.fillRect(0, 0, 1, 1);
        ctx.fillStyle = "#000";
        ctx.fillStyle = c;
        ctx.fillRect(0, 0, 1, 1);
        let [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
    }
    /** A built-in family's colors, to start a custom one from. */
    function familyPalette(f) {
        let themes = window.FtcTeamCard?.TEAM_THEMES || {};
        let one = (name) => {
            let t = themes[name] || {};
            let bg = toHex(t.bg || "#fff");
            return Object.fromEntries(Object.keys(PALETTE).map((k) => [k, k == "bg" ? bg : toHex(t[k] || "#888", bg)]));
        };
        return { light: one(FAMILIES[f].names.light), dark: one(FAMILIES[f].names.dark) };
    }
    const readableOn = (hex) => {
        let [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
        return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#111111" : "#ffffff";
    };

    /**
     * The `theme` option: a name, or for custom colors (and the own accent) { base, ...tokens,
     * dark: { ...tokens } }. team: also sets accentText, which only the team widgets have.
     */
    function themeOption(name, extra = {}, team = true) {
        let [f, m] = splitTheme(name);
        if (f != "custom") return Object.keys(extra).length ? { base: name, ...extra } : name;
        let colors = (mode) => {
            let c = { ...state.custom[mode], ...extra };
            return team ? { ...c, accentText: readableOn(c.accent) } : c;
        };
        if (m != "auto") return { base: m, ...colors(m) };
        return { base: "auto", ...colors("light"), dark: colors("dark") };
    }

    // Shapes: corners, spacing and type, separate from the colors. The values come from the
    // libraries (TEAM_SHAPES, SHAPES); "" keeps the color theme's own.
    const TEAM_SHAPE_LABELS = {
        "": ["Theme's own", "Whatever the colors come with"],
        default: ["Rounded", "Soft corners, normal spacing"],
        square: ["Square", "Sharp corners, flat"],
        compact: ["Compact", "Tight, for sidebars"],
        spacious: ["Spacious", "More room to breathe"],
        bubbly: ["Bubbly", "Round everything"],
        showcase: ["Showcase", "Big, bold type"],
        ftcscout: ["FTCScout", "FTCScout's corners and font"],
        "ftc-events": ["FTC Events", "Small corners, Roboto"],
    };
    const MAP_SHAPE_LABELS = {
        "": ["Theme's own", "Whatever the colors come with"],
        default: ["Rounded", "Soft pits with gaps"],
        subtle: ["Subtle", "Slightly rounded"],
        square: ["Square", "Sharp, with gaps"],
        blocks: ["Blocks", "Sharp, pits touching"],
        bubbly: ["Bubbly", "Round pits, round walls"],
    };
    const STATS = { opr: "OPR", epa: "EPA", "region-rank": "Rank in region", record: "Season record", "record-total": "All-time record", "win-rate": "Win rate", awards: "Season awards", "awards-total": "All awards", matches: "Season matches", events: "Season events", seasons: "Seasons", rookie: "Since" };
    const EXAMPLE_NAMES = {
        FPEEUR: "European Premier Event", NLCMP: "Netherlands Championship", FTCCMP1: "FIRST Championship",
        FTCCMP1EDIS: "Worlds – Edison", FTCCMP1FRAN: "Worlds – Franklin", FTCCMP1GOOD: "Worlds – Goodall",
        FTCCMP1JACK: "Worlds – Jackson", FTCCMP1LOVE: "Worlds – Lovelace", FTCCMP1ROSS: "Worlds – Ross",
    };
    // The season that's on now (FTC seasons start in September), as the widgets work it out.
    const THIS_SEASON = window.FtcTeamCard?.seasonOf?.() ?? (new Date().getMonth() >= 8 ? new Date().getFullYear() : new Date().getFullYear() - 1);
    // Every season the widgets have data for: FTCScout's start with 2019–20.
    const FIRST_SEASON = 2019;
    /** "2020–2021": a season with both years in full. */
    const seasonLabel = (y) => `${y}–${+y + 1}`;
    const SEASONS = Array.from({ length: THIS_SEASON - FIRST_SEASON + 1 }, (_, i) => THIS_SEASON - i);

    // Website builders: which code fits, and how to paste it there. {h} is the suggested height.
    const PLATFORMS = {
        wix: { label: "Wix", method: "iframe", steps: [
            "In the Wix editor, click <b>Add Elements</b> (+) → <b>Embed Code</b> → <b>Embed HTML</b>.",
            "Choose <b>Code</b>, paste the code below and click <b>Update</b>.",
            "Drag the box to the width you want and about {h}px high.",
        ] },
        "google-sites": { label: "Google Sites", method: "iframe", steps: [
            "Open your site and click <b>Embed</b> in the <b>Insert</b> panel on the right.",
            "Pick the <b>Embed code</b> tab, paste the code below, then <b>Next</b> → <b>Insert</b>.",
            "Drag the box's corner until the whole widget fits.",
        ] },
        squarespace: { label: "Squarespace", method: "iframe", steps: [
            "Edit the page, click <b>Add Block</b> and choose <b>Code</b>.",
            "Paste the code below, leave the mode on <b>HTML</b>, and click outside the block.",
            "Save. (The code shows as a placeholder while editing and works on the live page.)",
        ] },
        wordpress: { label: "WordPress", method: "element", steps: [
            "Edit the page and add a <b>Custom HTML</b> block where the widget should go.",
            "Paste the code below and click <b>Preview</b> to check it.",
            "Update the page.",
        ], note: "On WordPress.com's free and Personal plans scripts are removed: use the <b>iframe</b> tab instead." },
        html: { label: "My own HTML", method: "element", steps: [
            "Paste the code where the widget should appear. It takes the width of the element it's in.",
            "Several widgets on one page? The <code>&lt;script&gt;</code> line is needed once per widget type.",
        ] },
        framework: { label: "React, Vue, Svelte…", method: "js", steps: [
            "Install the package: <code>npm install ftc-embeds</code>.",
            "Run the code below once the element exists (in React: in a <code>useEffect</code>, and call <code>.destroy()</code> in its cleanup).",
            "Or use the HTML element tab: the custom elements work in every framework.",
        ] },
        link: { label: "Just a link / QR code", method: "url", steps: [
            "Copy the link below: it opens just the widget, full screen.",
            "Share it, or turn it into a QR code for your pit or flyer.",
        ] },
        other: { label: "Something else / not sure", method: "iframe", steps: [
            "Look for a block called <b>Embed</b>, <b>HTML</b> or <b>Code</b> in your site's editor.",
            "Paste the code below in it.",
            "Make the block about {h}px high. Scripts not allowed? An iframe still works almost everywhere.",
        ] },
    };
    const METHODS = { iframe: "iframe", element: "HTML element", js: "JavaScript (npm)", url: "Link" };

    const STEPS = {
        kind: "What for",
        team: "Your team",
        widget: "Widget",
        eventWidget: "Widget",
        event: "Event",
        highlight: "Teams",
        look: "Look",
        content: "What to show",
        format: "Formats",
        site: "Your website",
        done: "Code",
    };
    function flow() {
        if (state.kind != "event") return ["kind", "team", "widget", "look", "content", "format", "site", "done"];
        if (isMap()) return ["kind", "eventWidget", "event", "highlight", "look", "site", "done"];
        // A countdown has no teams to mark and nothing else to pick.
        let countdown = state.eventWidget == "countdown";
        return ["kind", "eventWidget", "event", ...(countdown ? [] : ["highlight"]), "look", ...(countdown ? [] : ["content"]), "format", "site", "done"];
    }

    // ------------------------------------------------------------ answers

    const DEFAULTS = {
        kind: "",
        // team widgets (same names as the /team builder)
        custom: CUSTOM_DEFAULT,
        team: "", season: "", widget: "team-card", theme: "auto", shape: "", layout: "list", accent: "#2563eb", useAccent: false,
        stats: ["opr", "epa", "record"], upcoming: 1, skipScrimmages: false, oldest: false, onlyWon: false, seasons: "",
        // event widgets: which one, and what they show ("" / "all": the widget's default)
        eventWidget: "pit-map", columns: "", eventLimit: "", level: "all", matchState: "all", matchTeam: "", maxHeight: "",
        // pit map (same names as the /pit-map dashboard)
        source: "example", example: "FPEEUR", code: "", eventSeason: THIS_SEASON, highlight: "", mapTheme: "auto", mapShape: "", height: 600,
        // number, date and time formats (team widgets); "" / "locale" / "short": the widgets' defaults
        locale: "", numberFormat: "locale", decimals: 1, dateFormat: "short", hourCycle: "", timeZone: "",
        site: "",
    };
    let state = { ...DEFAULTS };
    let step = "kind";
    let tab = null; // code tab on the last step; null: the one that fits the website
    let teamCheck = { team: null, ok: null, text: "" };
    let eventCheck = { ref: null, ok: null, text: "" };

    function readUrl() {
        try {
            state = { ...DEFAULTS, ...JSON.parse(decodeURIComponent(location.hash.slice(1)) || "{}") };
        } catch {
            state = { ...DEFAULTS };
        }
        if (!WIDGETS[state.widget]) state.widget = DEFAULTS.widget;
        if (!EVENT_WIDGETS[state.eventWidget]) state.eventWidget = DEFAULTS.eventWidget;
        // Theme names from a link: only known ones, and none the pit map doesn't have.
        const known = (name) => Object.values(FAMILIES).some((f) => Object.values(f.names).includes(name));
        if (!known(state.theme)) state.theme = "auto";
        if (!known(state.mapTheme) || FAMILIES[splitTheme(state.mapTheme)[0]].teamOnly) state.mapTheme = "auto";
        if (!TEAM_SHAPE_LABELS[state.shape]) state.shape = "";
        if (!MAP_SHAPE_LABELS[state.mapShape]) state.mapShape = "";
        let hex = (v) => typeof v == "string" && /^#[0-9a-f]{6}$/i.test(v);
        if (!["light", "dark"].every((m) => Object.keys(PALETTE).every((k) => hex(state.custom?.[m]?.[k])))) state.custom = CUSTOM_DEFAULT;
        if (!EXAMPLES[state.example]) state.example = Object.keys(EXAMPLES)[0] || DEFAULTS.example;
        if (!LIVE_API) state.source = "example";
        let s = new URLSearchParams(location.search).get("step") || "kind";
        step = flow().includes(s) ? s : "kind";
        // Don't land past a question that still needs an answer.
        let open = flow().find((s) => !answered(s));
        if (open && flow().indexOf(open) < flow().indexOf(step)) step = open;
    }
    const hash = () => {
        let diff = Object.fromEntries(Object.entries(state).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(DEFAULTS[k])));
        return Object.keys(diff).length ? "#" + encodeURIComponent(JSON.stringify(diff)) : "";
    };
    const href = (s) => `/setup${s == "kind" ? "" : "?step=" + s}${hash()}`;

    /** Whether a step has what it needs to move on. */
    function answered(s) {
        if (s == "kind") return !!state.kind;
        if (s == "team") return /^\d+$/.test(String(state.team).trim());
        if (s == "event") return (isMap() && state.source == "example") || /^[a-z0-9]+$/i.test(state.code.trim());
        if (s == "site") return !!PLATFORMS[state.site];
        return true;
    }

    // ------------------------------------------------------------ options -> code (team widgets)

    function teamOptions() {
        let o = { team: +state.team || null };
        if (state.season) o.season = +state.season;
        let theme = themeOption(state.theme, state.useAccent && splitTheme(state.theme)[0] != "custom" ? { accent: state.accent } : {});
        if (theme !== "auto") o.theme = theme;
        if (state.shape) o.shape = state.shape;
        if (state.layout !== "list" && WIDGETS[state.widget].layouts[state.layout]) o.layout = state.layout;
        let w = state.widget;
        if (w == "team-card") {
            if (state.stats.join(",") !== "opr,epa,record") o.stats = state.stats.join(",");
            if (+state.upcoming !== 1) o.upcoming = +state.upcoming;
        }
        if (w == "team-results" || w == "team-season") {
            if (state.skipScrimmages) o.skipTypes = "Scrimmage";
            if (state.oldest) o.order = "oldest";
        }
        if (w == "event-rankings") {
            if (state.columns) o.columns = state.columns;
            if (state.eventLimit) o.limit = +state.eventLimit;
            if (state.maxHeight) o.maxHeight = state.maxHeight;
        }
        if (w == "team-awards") {
            if (state.onlyWon) o.onlyWon = true;
            if (state.seasons) o.seasons = +state.seasons;
        }
        return formatOptions(o);
    }

    /** The number, date and time format options (team and event widgets). */
    function formatOptions(o) {
        if (state.locale) o.locale = state.locale;
        if (state.numberFormat != "locale") o.numberFormat = state.numberFormat;
        if (+state.decimals !== 1) o.decimals = +state.decimals;
        if (state.dateFormat != "short") o.dateFormat = state.dateFormat;
        if (state.hourCycle) o.hourCycle = +state.hourCycle;
        if (state.timeZone) o.timeZone = state.timeZone;
        return o;
    }

    function eventWidgetOptions() {
        let id = state.eventWidget;
        let o = { event: state.code.trim().toUpperCase() || null, season: +state.eventSeason };
        let theme = themeOption(state.theme, state.useAccent && splitTheme(state.theme)[0] != "custom" ? { accent: state.accent } : {});
        if (theme !== "auto") o.theme = theme;
        if (state.shape) o.shape = state.shape;
        if (state.layout !== "list" && EVENT_WIDGETS[id].layouts?.[state.layout]) o.layout = state.layout;
        if (id != "countdown" && teamList()) o.highlight = teamList().replace(/ /g, "");
        if ((id == "event-rankings" || id == "event-advancement") && state.columns) o.columns = state.columns;
        if (id == "event-matches") {
            if (state.level != "all") o.level = state.level;
            if (state.matchState != "all") o.state = state.matchState;
            if (/^\d+$/.test(state.matchTeam)) o.team = +state.matchTeam;
        }
        if (id != "countdown" && state.eventLimit) o.limit = +state.eventLimit;
        if (id != "countdown" && state.maxHeight) o.maxHeight = state.maxHeight;
        return formatOptions(o);
    }
    const scrollHeight = () => (state.maxHeight ? parseInt(state.maxHeight) + 4 : null);
    const eventHeight = () => (state.eventWidget == "countdown" ? (state.layout == "compact" ? 140 : 200) : scrollHeight() || EVENT_WIDGETS[state.eventWidget].height || 560);
    /** Where the code may load a script: there the iframe sizes itself to the widget (embed/resize.js). */
    const autoHeight = () => !["wix", "google-sites"].includes(state.site) && !state.maxHeight;
    const teamHeight = () => (state.widget == "event-rankings" && scrollHeight() ? scrollHeight() : state.layout == "strip" ? 260 : state.layout == "compact" ? 140 : WIDGETS[state.widget].height);

    const kebab = (s) => s.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
    const attrValue = (v) => (typeof v === "object" ? JSON.stringify(v) : String(v));

    /** The code for a team or event widget (id: its module name, w: its WIDGETS entry). */
    function widgetCode(method, id, w, o, height, elementId) {
        let custom = SITE.apiBase && window[w.global] && SITE.apiBase !== window[w.global].DEFAULT_API_BASE;
        let q = new URLSearchParams(Object.entries(o).map(([k, v]) => [k, attrValue(v)]));
        if (method == "url") return `${ORIGIN}/embed/${id}?${q}`;
        if (method == "iframe") {
            let frame = `<iframe src="${esc(`${ORIGIN}/embed/${id}?${q}`)}" title="${w.label}" style="width:100%;height:${height}px;border:0" loading="lazy"></iframe>`;
            // Where scripts are allowed, the iframe grows and shrinks with the widget.
            return autoHeight() ? `${frame}\n<script src="${ORIGIN}/embed/resize.js" async></script>` : frame;
        }
        if (method == "element") {
            let attr = (k, v) => (v === true ? ` ${kebab(k)}` : typeof v === "object" ? ` ${kebab(k)}='${JSON.stringify(v).replace(/'/g, "&#39;")}'` : ` ${kebab(k)}="${esc(String(v))}"`);
            let api = custom ? ` api-base="${SITE.apiBase}"` : "";
            return `<script type="module" src="${ORIGIN}/lib/${id}.mjs"></script>\n<${w.tag}${Object.entries(o).map(([k, v]) => attr(k, v)).join("")}${api}></${w.tag}>`;
        }
        let body = JSON.stringify(o, null, 4).replace(/"([a-zA-Z]+)":/g, "$1:");
        return `// npm install ftc-embeds\nimport { ${custom ? `${w.cls}, configure` : w.cls} } from "ftc-embeds/${id}";\n\n${custom ? `configure({ apiBase: "${SITE.apiBase}" });\n` : ""}new ${w.cls}(document.getElementById("${elementId}"), ${body});`;
    }
    const teamCode = (method) => widgetCode(method, state.widget, WIDGETS[state.widget], teamOptions(), teamHeight(), "team-widget");
    const eventCode = (method) => widgetCode(method, state.eventWidget, EVENT_WIDGETS[state.eventWidget], eventWidgetOptions(), eventHeight(), "event-widget");

    // ------------------------------------------------------------ options -> code (pit map)

    const eventRef = () => (isMap() && state.source == "example" ? `2025/${state.example}` : `${state.eventSeason}/${state.code.trim().toUpperCase()}`);
    const teamList = () => state.highlight.split(/[\s,;]+/).filter(Boolean).join(", ");
    const mapTheme = () => themeOption(state.mapTheme, {}, false);
    const mapOptions = () => ({ theme: mapTheme(), shape: state.mapShape || null, highlight: teamList() || null });

    function mapCode(method) {
        let theme = mapTheme();
        let themeText = typeof theme == "string" ? theme : JSON.stringify(theme);
        let p = new URLSearchParams({ event: eventRef() });
        if (state.source == "example") p.set("source", "example");
        if (theme != "auto") p.set("theme", themeText);
        if (state.mapShape) p.set("shape", state.mapShape);
        if (teamList()) p.set("highlight", teamList());
        let url = `${ORIGIN}/embed/pit-map?${p}`;
        if (method == "url") return url;
        if (method == "iframe") return `<iframe\n    src="${esc(url)}"\n    title="Pit map"\n    style="width: 100%; height: ${state.height}px; border: 0; border-radius: 12px;"\n    loading="lazy"\n></iframe>`;
        let custom = SITE.apiBase ? SITE.apiBase !== FtcPitMap.DEFAULT_API_BASE : !!SITE.graphqlUrl;
        if (method == "element") {
            let attrs = state.source == "example" ? [["src", `${ORIGIN}/examples/${state.example}.json`]] : [["event", eventRef()]];
            if (state.source == "live" && custom) attrs.push(SITE.apiBase ? ["api-base", SITE.apiBase] : ["graphql-url", SITE.graphqlUrl]);
            if (theme != "auto") attrs.push(["theme", themeText]);
            if (state.mapShape) attrs.push(["shape", state.mapShape]);
            if (teamList()) attrs.push(["highlight", teamList()]);
            // JSON goes in single quotes, so it stays readable.
            let lines = attrs.map(([k, v]) => (v.includes('"') ? `    ${k}='${v.replace(/'/g, "&#39;")}'` : `    ${k}="${esc(v)}"`)).concat(`    style="display: block; height: ${state.height}px;"`);
            return `<script src="${ORIGIN}/lib/pit-map.umd.js"></script>\n<ftc-pit-map\n${lines.join("\n")}\n></ftc-pit-map>`;
        }
        let opts = [];
        if (theme != "auto") opts.push(`    theme: ${JSON.stringify(theme).replace(/"([a-zA-Z]+)":/g, "$1: ").replace(/,(?=\S)/g, ", ")},`);
        if (state.mapShape) opts.push(`    shape: "${state.mapShape}",`);
        if (teamList()) opts.push(`    highlight: "${teamList()}",`);
        let head = `// npm install ftc-embeds\nimport { PitMap${state.source == "live" && custom ? ", configure" : ""} } from "ftc-embeds/pit-map";\n\n`;
        if (state.source == "example") return `${head}const data = await fetch("${ORIGIN}/examples/${state.example}.json").then((r) => r.json());\nnew PitMap(document.getElementById("pit-map"), {\n    data,\n${opts.join("\n")}\n});`;
        let api = !custom ? "" : SITE.apiBase ? `configure({ apiBase: "${SITE.apiBase}" });\n` : `configure({ graphqlUrl: "${SITE.graphqlUrl}" });\n`;
        return `${head}${api}new PitMap(document.getElementById("pit-map"), {\n    event: "${eventRef()}",\n${opts.join("\n")}\n});`;
    }

    /** The same settings in the full dashboard, to fine-tune what the wizard doesn't ask. */
    function editorLink() {
        if (isMap()) {
            // The dashboard knows theme names and token overrides: custom colors and the shape go along as tokens.
            let t = mapTheme();
            let { base, ...colorTokens } = typeof t == "object" ? t : { base: t };
            let shape = state.mapShape ? window.FtcPitMap?.SHAPES?.[state.mapShape] || {} : {};
            let s = { source: state.source, example: state.example, season: state.eventSeason, code: state.code, highlight: state.highlight, theme: base, overrides: { ...colorTokens, ...shape }, height: state.height };
            let d = { source: "example", example: "FPEEUR", season: 2025, code: "", highlight: "", theme: "auto", overrides: {}, height: 600 };
            let diff = Object.fromEntries(Object.entries(s).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(d[k])));
            return "/pit-map" + (Object.keys(diff).length ? "#" + encodeURIComponent(JSON.stringify(diff)) : "");
        }
        let keys = ["widget", "team", "season", "theme", "layout", "accent", "useAccent", "stats", "upcoming", "skipScrimmages", "oldest", "onlyWon", "seasons", "locale", "numberFormat", "decimals", "dateFormat", "hourCycle", "timeZone"];
        let s = Object.fromEntries(keys.filter((k) => JSON.stringify(state[k]) !== JSON.stringify(DEFAULTS[k]) || k == "team").map((k) => [k, state[k]]));
        // The editor has no shapes or custom colors: those go along as CSS variables in its custom CSS.
        let vars = (tokens) => Object.entries(tokens).map(([k, v]) => `    --ftcw-${kebab(k)}: ${v};`).join("\n");
        let css = [];
        let shape = state.shape ? window.FtcTeamCard?.TEAM_SHAPES?.[state.shape] : null;
        let custom = splitTheme(state.theme)[0] == "custom" ? themeOption(state.theme) : null;
        if (custom) {
            s.theme = custom.base;
            let { base, dark, ...light } = custom;
            css.push(`:host {\n${vars({ ...(shape || {}), ...light })}\n}`);
            if (dark) css.push(`@media (prefers-color-scheme: dark) {\n:host {\n${vars(dark)}\n}\n}`);
        } else if (shape) css.push(`:host {\n${vars(shape)}\n}`);
        if (css.length) s.css = css.join("\n\n");
        return "/team#" + encodeURIComponent(JSON.stringify(s));
    }

    // ------------------------------------------------------------ formats

    const LOCALES = { "": "Visitor's own", "en-US": "English (US)", "en-GB": "English (UK)", "nl-NL": "Nederlands", "de-DE": "Deutsch", "fr-FR": "Français", "es-ES": "Español", "pt-BR": "Português (BR)" };
    // Same names and separators as the widgets' numberFormat option.
    const NUMBER_FORMATS = { locale: "Like the language", point: "Point", comma: "Comma", space: "Space", apostrophe: "Apostrophe", plain: "No grouping" };
    const NUMBER_LOCALES = { point: "en-US", comma: "de-DE", space: "fr-FR", apostrophe: "de-CH", plain: "en-US" };
    const DATE_FORMATS = { short: "Short", long: "Long", numeric: "Numbers", iso: "ISO" };
    const DATE_OPTIONS = { short: { month: "short" }, long: { month: "long" }, numeric: { month: "numeric" } };
    const HOUR_CYCLES = [["", "Like the language"], ["24", "24-hour"], ["12", "12-hour"]];
    const HERE = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const timeZones = () => {
        let all = Intl.supportedValuesOf ? Intl.supportedValuesOf("timeZone") : [];
        return [...new Set([HERE, ...all].filter(Boolean))];
    };
    /** The language tag in use, or undefined (the visitor's); an invalid one counts as the visitor's. */
    const localeOf = (tag) => {
        try {
            return tag ? Intl.getCanonicalLocales(tag)[0] : undefined;
        } catch {
            return undefined;
        }
    };
    // Examples, written the way the widgets will (same Intl options).
    function example(kind, value) {
        let loc = localeOf(state.locale);
        let numLoc = (f) => NUMBER_LOCALES[f] || loc;
        let num = (n, digits, f = state.numberFormat) => n.toLocaleString(numLoc(f), { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: f !== "plain" });
        let date = (f, l = loc) => (f == "iso" ? "2026-02-07" : new Date("2026-02-07T12:00:00Z").toLocaleDateString(l, { ...DATE_OPTIONS[f], day: "numeric", year: "numeric", timeZone: "UTC" }));
        let time = (cycle, l = loc) => {
            let o = { hour: "2-digit", minute: "2-digit", timeZone: "UTC" };
            if (cycle) o.hour12 = cycle == "12";
            return new Date("2026-02-07T14:30:00Z").toLocaleTimeString(l, o);
        };
        if (kind == "locale") {
            let l = localeOf(value);
            return `${date(state.dateFormat == "iso" ? "short" : state.dateFormat, l)} · ${(12345.6).toLocaleString(l)}`;
        }
        if (kind == "number") return num(12345.6, 1, value);
        if (kind == "decimals") return `OPR ${num(87.654, +value)}`;
        if (kind == "date") return date(value);
        if (kind == "time") return time(value);
        return "";
    }
    function formatSummary() {
        let parts = [LOCALES[state.locale] ?? state.locale, example("number", state.numberFormat), example("date", state.dateFormat), example("time", state.hourCycle)];
        if (state.timeZone) parts.push(state.timeZone.replace(/_/g, " "));
        return parts.join(" · ");
    }

    // ------------------------------------------------------------ the questions

    const choice = (key, value, title, text = "", extra = "") =>
        `<button type="button" class="choice" data-key="${key}" data-value="${esc(JSON.stringify(value))}">${extra}<b>${title}</b>${text ? `<span>${text}</span>` : ""}</button>`;
    // Light half and dark half of a family; the mode cards show which half is used.
    const familySwatch = (f) => `<div class="swatch">${[...f.light, ...f.dark].map((c) => `<i style="background:${c}"></i>`).join("")}</div>`;
    const modeIcon = (m) => `<span class="mode-ico ${m}"></span>`;
    const customSwatch = (c) => [c.light.bg, c.light.accent, c.dark.bg, c.dark.accent];
    const swatchCells = (colors) => colors.map((c) => `<i style="background:${c}"></i>`).join("");
    function colorPicker(familyKey, modeKey, map) {
        let fams = Object.entries(FAMILIES).filter(([, f]) => !(map && f.teamOnly));
        let cards = fams.map(([id, f]) =>
            choice(familyKey, id, f.label, f.text, id == "custom" ? `<div class="swatch" id="custom-swatch">${swatchCells(customSwatch(state.custom))}</div>` : familySwatch(f))
        );
        let saved = loadTemplates().map(
            (t, i) =>
                `<div class="tpl-wrap"><button type="button" class="choice tpl" data-tpl="${i}"><div class="swatch">${swatchCells(customSwatch(t))}</div><b>${esc(t.name)}</b><span>Saved colors</span></button><button type="button" class="tpl-del" data-tpl-del="${i}" aria-label="Delete ${esc(t.name)}" title="Delete">×</button></div>`
        );
        return `<div class="choices">${cards.join("")}${saved.join("")}</div>
            <div class="custom" id="custom-box">
                <div class="custom-grid">
                    <span></span><b data-col="light">Light</b><b data-col="dark">Dark</b>
                    ${Object.entries(PALETTE).map(([k, label]) => `<span>${label}</span>${["light", "dark"].map((m) => `<input type="color" data-custom="${m}.${k}" data-col="${m}" aria-label="${label}, ${m}">`).join("")}`).join("")}
                </div>
                <p class="q">Start from <small>Copies a look's colors, light and dark</small></p>
                <div class="starts">${Object.entries(FAMILIES).filter(([id, f]) => id != "custom" && !(map && f.teamOnly)).map(([id, f]) => `<button type="button" class="btn sm" data-start="${id}">${f.label}</button>`).join("")}</div>
                <p class="q">Save these colors <small>To use them again, in this browser</small></p>
                <div class="row">
                    <input type="text" id="tpl-name" placeholder="e.g. Team colors" autocomplete="off" maxlength="40" style="flex:1 1 180px;width:auto">
                    <button type="button" class="btn sm" id="tpl-save">Save as template</button>
                </div>
                <p class="hint" id="tpl-status"></p>
            </div>
            <p class="q">Light or dark?</p>
            <div class="choices small">${Object.entries(MODES).map(([m, [label, text]]) => choice(modeKey, m, label, text, modeIcon(m))).join("")}</div>`;
    }
    const swatch = (colors) => `<div class="swatch">${colors.map((c) => `<i style="background:${c}"></i>`).join("")}</div>`;
    // Small drawings of a shape preset, in the site's own colors: a card with three blocks, at half size.
    const half = (v) => (/%$/.test(v) ? v : `${Math.min(parseFloat(v) || 0, 60) / 2}px`);
    function teamShapeDemo(name) {
        let t = name ? window.FtcTeamCard?.TEAM_SHAPES?.[name] : null;
        if (!t) return `<div class="shape own"><i></i><i></i><i></i></div>`;
        return `<div class="shape" style="border-radius:${half(t.radius)};padding:${half(t.padding)};gap:${half(t.gap)}"><b style="border-radius:${t.avatarRadius == "50%" ? "50%" : half(t.avatarRadius)}"></b><i style="border-radius:${half(t.innerRadius)}"></i><i style="border-radius:${half(t.innerRadius)}"></i></div>`;
    }
    // A row of pits between two walls; values are in cells (one pit ≈ 18px here).
    function mapShapeDemo(name) {
        let t = name ? window.FtcPitMap?.SHAPES?.[name] : null;
        if (!t) return `<div class="pits own">${"<i></i>".repeat(5)}</div>`;
        let { pitRadius: pit, pitGap: gap, wallRadius: wall } = t;
        return `<div class="pits" style="gap:${gap * 36}px;border-radius:${wall * 18}px">${`<i style="border-radius:${pit * 18}px"></i>`.repeat(5)}</div>`;
    }

    /** The "What to show" page of the event widgets. */
    function eventContent(head, id) {
        let tall = `<p class="q">How tall? <small>A fixed height scrolls inside the widget, to ${id == "event-matches" ? "the next match" : "your team"}</small></p>
            <div class="choices small">${choice("maxHeight", "", "Fit everything", "As long as the list")}${choice("maxHeight", "400px", "400px", "Scrolls inside")}${choice("maxHeight", "600px", "600px", "Scrolls inside")}</div>`;
        let limits = (label, values) => `<div class="choices small">${choice("eventLimit", "", label)}${values.map(([v, l]) => choice("eventLimit", v, l)).join("")}</div>`;
        if (id == "event-rankings")
            return `${head}
            <h1>Which columns?</h1>
            <p class="sub">Rank and team are always there. Narrow places (a sidebar, a phone) drop the less important columns by themselves.</p>
            <div class="choices small">
                ${choice("columns", "", "Standard", "RP, record, matches, OPR")}${choice("columns", "rp,tb1,tb2,record,matches,opr", "With tiebreakers", "Adds TBP and TBP2")}${choice("columns", "rp,record", "Short", "RP and record")}${choice("columns", "rp,opr", "Strength", "RP and OPR")}
            </div>
            <p class="q">How many teams? <small>Highlighted teams lower down are shown too</small></p>
            ${limits("All", [["8", "Top 8"], ["16", "Top 16"]])}
            ${tall}`;
        if (id == "event-advancement")
            return `${head}
            <h1>Which points?</h1>
            <p class="sub">Each team's advancement points, by where they came from, and who advanced (from the 2025 season on).</p>
            <div class="choices small">${choice("columns", "", "Every part", "Qualification, alliance, playoff, award, total")}${choice("columns", "total", "Total only", "For narrow places")}</div>
            <p class="q">How many teams? <small>Highlighted teams lower down are shown too</small></p>
            ${limits("All", [["10", "Top 10"], ["20", "Top 20"]])}
            ${tall}`;
        if (id == "league-standings")
            return `${head}
            <h1>How many teams?</h1>
            <p class="sub">The league's standings: rank, average ranking points and record. Highlighted teams lower down are shown too.</p>
            ${limits("All", [["8", "Top 8"], ["16", "Top 16"]])}
            ${tall}`;
        return `${head}
            <h1>Which matches?</h1>
            <p class="sub">While the event is on, the next match is marked and the list updates itself.</p>
            <div class="choices small">${choice("level", "all", "All")}${choice("level", "quals", "Qualification")}${choice("level", "playoffs", "Playoffs")}</div>
            <p class="q">Played or not?</p>
            <div class="choices small">${choice("matchState", "all", "All")}${choice("matchState", "upcoming", "Still to play")}${choice("matchState", "played", "Played")}</div>
            <p class="q">Only one team's matches? <small>Optional: a team's own schedule, with its next match marked</small></p>
            <input type="text" inputmode="numeric" data-input="matchTeam" placeholder="e.g. 19444" autocomplete="off" aria-label="Only this team's matches" style="max-width:200px">
            <p class="q">How many?</p>
            ${limits("All", [["5", state.matchState == "upcoming" ? "Next 5" : "First 5"], ["10", state.matchState == "upcoming" ? "Next 10" : "First 10"]])}
            ${tall}`;
    }

    const PAGES = {
        kind: () => `
            <span class="kicker">Let's set it up</span>
            <h1>What do you want to put on your website?</h1>
            <p class="sub">A few questions, one at a time. You'll see it live as you go, and get the code with instructions for your website builder at the end.</p>
            <div class="choices two">
                ${choice("kind", "team", "Something about my team", "A team card, season results, awards, or your next match while you compete.", '<span class="ico">◆</span>')}
                ${choice("kind", "event", "Something about an event", "Rankings, the match schedule, advancement, league standings, a countdown, or a pit map.", '<span class="ico">▦</span>')}
            </div>`,

        team: () => `
            <span class="kicker">Your team</span>
            <h1>What's your team number?</h1>
            <p class="sub">The widgets fill in everything else themselves, from FTCScout and <i>FIRST</i>.</p>
            <input class="big" type="text" inputmode="numeric" pattern="[0-9]*" id="team-input" data-input="team" placeholder="e.g. ${SITE.demoTeam || 19444}" autocomplete="off" aria-label="Team number">
            <div class="status" id="team-status"></div>
            <p class="q">Which season? <small>Most people keep "current": it moves on by itself.</small></p>
            <div class="choices small">
                ${choice("season", "", "Current")}
                ${SEASONS.map((y) => choice("season", String(y), `${seasonLabel(y)}`)).join("")}
            </div>`,

        widget: () => `
            <span class="kicker">Widget</span>
            <h1>Which widget do you want?</h1>
            <p class="sub">Pick one; the preview shows it with your team. You can come back for another one later.</p>
            <div class="choices">
                ${Object.entries(WIDGETS).map(([id, w]) => choice("widget", id, w.label, w.text, "", "").replace("</button>", w.badge ? `<span class="tag">${w.badge}</span></button>` : "</button>")).join("")}
            </div>`,

        eventWidget: () => `
            <span class="kicker">Widget</span>
            <h1>Which widget do you want?</h1>
            <p class="sub">Pick one; the next step asks for the event. You can come back for another one later.</p>
            <div class="choices">
                ${Object.entries(EVENT_WIDGETS).map(([id, w]) => choice("eventWidget", id, w.label, w.text, "", "").replace("</button>", w.badge ? `<span class="tag">${w.badge}</span></button>` : "</button>")).join("")}
            </div>`,

        look: () =>
            isMap()
                ? `
            <span class="kicker">Look</span>
            <h1>How should the map look?</h1>
            <p class="sub">Colors and shape are picked separately, so any two go together. The full editor has every color and corner if you need more.</p>
            <h2 class="sec"><span>A</span>Colors</h2>
            ${colorPicker("mapFamily", "mapMode", true)}
            <h2 class="sec"><span>B</span>Shape & spacing <small>Works with any colors</small></h2>
            <div class="choices">
                ${Object.entries(MAP_SHAPE_LABELS).map(([id, [name, text]]) => choice("mapShape", id, name, text, mapShapeDemo(id))).join("")}
            </div>
            <p class="q">How tall? <small>Or drag the preview's corner</small></p>
            <div class="choices small">
                ${choice("height", 450, "Short", "450px")}${choice("height", 600, "Normal", "600px")}${choice("height", 800, "Tall", "800px")}
            </div>`
                : `
            <span class="kicker">Look</span>
            <h1>How should it look?</h1>
            <p class="sub">Colors and shape are picked separately, so any two go together. The preview follows along.</p>
            <h2 class="sec"><span>A</span>Colors</h2>
            ${colorPicker("family", "mode", false)}
            <p class="q" data-accent-row>Your team's color? <small>Optional, replaces the accent</small></p>
            <div class="row" data-accent-row>
                <label class="check"><input type="checkbox" data-check="useAccent"> Use my own accent color</label>
                <input type="color" data-color="accent" aria-label="Accent color">
            </div>
            <h2 class="sec"><span>B</span>Shape & spacing <small>Works with any colors</small></h2>
            <div class="choices">
                ${Object.entries(TEAM_SHAPE_LABELS).map(([id, [name, text]]) => choice("shape", id, name, text, teamShapeDemo(id))).join("")}
            </div>
            ${(() => {
                let layouts = (isEventWidget() ? EVENT_WIDGETS[state.eventWidget] : WIDGETS[state.widget]).layouts || {};
                return Object.keys(layouts).length > 1 ? `<p class="q">Arrangement</p><div class="choices small">${Object.entries(layouts).map(([v, label]) => choice("layout", v, label)).join("")}</div>` : "";
            })()}`,

        content: () => {
            let w = state.widget;
            let head = `<span class="kicker">What to show</span>`;
            if (isEventWidget()) return eventContent(head, state.eventWidget);
            if (w == "event-rankings") return eventContent(head, w);
            if (w == "team-card")
                return `${head}
            <h1>Which stats should the card show?</h1>
            <p class="sub">Click them in the order you want them. Three or four fit best.</p>
            <div class="stats-pick" id="stats">
                ${Object.entries(STATS).map(([k, label]) => `<label><input type="checkbox" value="${k}">${label}</label>`).join("")}
            </div>
            <p class="q">List your upcoming events?</p>
            <div class="choices small">${choice("upcoming", 0, "No")}${choice("upcoming", 1, "The next one")}${choice("upcoming", 3, "The next three")}</div>`;
            if (w == "team-awards")
                return `${head}
            <h1>Which awards?</h1>
            <p class="sub">By default it lists every award, including places you came close.</p>
            <label class="check"><input type="checkbox" data-check="onlyWon"> Only awards we won</label>
            <p class="q">How far back?</p>
            <div class="choices small">${choice("seasons", "", "Every season")}${choice("seasons", "1", "This season")}${choice("seasons", "3", "Last 3 seasons")}${choice("seasons", "5", "Last 5 seasons")}</div>`;
            if (w == "countdown")
                return `${head}
            <h1>Nothing else to pick.</h1>
            <p class="sub">During an event this counts down to your next match. Between events it counts down to your next event this season.</p>`;
            if (w == "next-match")
                return `${head}
            <h1>Nothing else to pick.</h1>
            <p class="sub">During an event this shows your next match, the alliances, your last result and your rank, and refreshes itself. Between events it shows your next event with a countdown.</p>`;
            return `${head}
            <h1>Which events?</h1>
            <p class="sub">Every event of the season is listed, newest first.</p>
            <label class="check"><input type="checkbox" data-check="skipScrimmages"> Leave out scrimmages</label>
            <label class="check"><input type="checkbox" data-check="oldest"> Oldest event first</label>`;
        },

        event: () => `
            <span class="kicker">Event</span>
            <h1>Which event?</h1>
            <p class="sub">${!isMap() ? "By its FTC event code and season." : LIVE_API ? "Your own event, by its FTC event code, or one of the examples to try things out." : "Pick one of the example events."}</p>
            ${LIVE_API && isMap() ? `<div class="choices two">${choice("source", "live", "My event", "By its event code, from FTC Events")}${choice("source", "example", "An example", "To try it out first")}</div>` : ""}
            <div id="live-box">
                <div class="row" style="margin-top:20px">
                    <label class="f" style="flex:1 1 200px">Event code <input class="big" type="text" data-input="code" placeholder="e.g. NLCMP" autocomplete="off" style="text-transform:uppercase"></label>
                    <label class="f" style="flex:0 0 140px">Season
                        <select data-select="eventSeason">${SEASONS.map((y) => `<option value="${y}">${seasonLabel(y)}</option>`).join("")}</select>
                    </label>
                </div>
                <div class="status" id="event-status"></div>
                <p class="hint">The code is in the event's URL on ftc-events.firstinspires.org (or FTCScout's). ${isMap() ? `No pit map yet? The <a href="/pit-map">full editor</a> can load one for you.` : state.eventWidget == "league-standings" ? "Any meet of the league (or its tournament) will do: it shows the league's current standings, all season." : "A championship with divisions? Its own code shows buttons to switch between the divisions."}</p>
            </div>
            <div id="example-box">
                <p class="q">Example events</p>
                <div class="choices small">${Object.keys(EXAMPLES).map((k) => choice("example", k, EXAMPLE_NAMES[k] || k, k)).join("")}</div>
            </div>`,

        highlight: () => `
            <span class="kicker">Teams</span>
            <h1>Should any teams stand out?</h1>
            <p class="sub">${isMap() ? "Highlighted pits get a color and a pulse, the rest dims. Handy on a team's own site, or for your region's teams. Leave it empty for a plain map." : "Their rows get a color, and a scrolling widget scrolls to them. Handy on a team's own site. Leave it empty to mark none."}</p>
            <input class="big" type="text" data-input="highlight" placeholder="e.g. 19444, 16236" autocomplete="off" aria-label="Teams to highlight">
            <p class="hint">Team numbers, separated by commas.</p>`,

        format: () => `
            <span class="kicker">Formats</span>
            <h1>How should numbers, dates and times look?</h1>
            <p class="sub">The widgets' words stay English; this changes how numbers, dates and times are written. The examples follow your choices.</p>
            <p class="q">Language and region <small>Sets all of the below, unless you pick otherwise</small></p>
            <div class="choices small">
                ${Object.entries(LOCALES).map(([v, label]) => choice("locale", v, label, `<span data-example="locale:${v}"></span>`)).join("")}
            </div>
            <label class="f" style="margin-top:10px;max-width:280px">Or another one, as a language tag <input type="text" data-input="locale" placeholder="e.g. pl-PL, ja-JP, sv-SE" autocomplete="off"></label>
            <p class="hint" id="locale-status"></p>
            <h2 class="sec"><span>A</span>Numbers</h2>
            <div class="choices small">
                ${Object.entries(NUMBER_FORMATS).map(([v, label]) => choice("numberFormat", v, label, `<span data-example="number:${v}"></span>`)).join("")}
            </div>
            <p class="q">Decimals for OPR and EPA</p>
            <div class="choices small">${[0, 1, 2].map((d) => choice("decimals", d, String(d), `<span data-example="decimals:${d}"></span>`)).join("")}</div>
            <h2 class="sec"><span>B</span>Dates</h2>
            <div class="choices small">
                ${Object.entries(DATE_FORMATS).map(([v, label]) => choice("dateFormat", v, label, `<span data-example="date:${v}"></span>`)).join("")}
            </div>
            <h2 class="sec"><span>C</span>Match times</h2>
            <div class="choices small">
                ${HOUR_CYCLES.map(([v, label]) => choice("hourCycle", v, label, `<span data-example="time:${v}"></span>`)).join("")}
            </div>
            <label class="f" style="margin-top:14px">Time zone
                <select data-select="timeZone">
                    <option value="">The visitor's own</option>
                    ${timeZones().map((z) => `<option value="${esc(z)}">${esc(z.replace(/_/g, " "))}${z == HERE ? " (yours)" : ""}</option>`).join("")}
                </select>
            </label>
            <p class="hint">${isEventWidget() ? "Match times show in the event's own time zone. Pick another to show everyone that clock instead." : "Match times show in each visitor's own time zone. Pick one to show everyone the same clock, for example the event's."}</p>`,

        site: () => `
            <span class="kicker">Your website</span>
            <h1>Where is your website made?</h1>
            <p class="sub">So you get the kind of code that works there, with the steps to paste it.</p>
            <div class="choices">
                ${Object.entries(PLATFORMS).map(([id, p]) => choice("site", id, p.label, METHODS[p.method])).join("")}
            </div>`,

        done: () => {
            let p = PLATFORMS[state.site] || PLATFORMS.other;
            let ew = EVENT_WIDGETS[state.eventWidget];
            let what = isMap() ? `Pit map · ${state.source == "example" ? EXAMPLE_NAMES[state.example] || state.example : eventRef()}` : isEventWidget() ? `${ew.label} · ${eventRef()}` : `${WIDGETS[state.widget].label} · team ${state.team}`;
            let rows = isMap()
                ? [["eventWidget", "Widget", "Pit map"], ["event", "Event", what.split(" · ")[1]], ["highlight", "Teams", teamList() || "none"], ["look", "Look", `${themeLabel(state.mapTheme)} · ${MAP_SHAPE_LABELS[state.mapShape][0]} shape · ${state.height}px`], ["site", "Website", p.label]]
                : isEventWidget()
                ? [["eventWidget", "Widget", ew.label], ["event", "Event", eventRef()], ...(flow().includes("highlight") ? [["highlight", "Teams", teamList() || "none"]] : []), ["look", "Look", `${themeLabel(state.theme)} · ${TEAM_SHAPE_LABELS[state.shape][0]} shape${Object.keys(ew.layouts || {}).length > 1 ? ` · ${ew.layouts[state.layout] || Object.values(ew.layouts)[0]}` : ""}`], ["format", "Formats", formatSummary()], ["site", "Website", p.label]]
                : [["team", "Team", `${state.team}${state.season ? `, ${seasonLabel(state.season)}` : ""}`], ["widget", "Widget", WIDGETS[state.widget].label], ["look", "Look", `${themeLabel(state.theme)} · ${TEAM_SHAPE_LABELS[state.shape][0]} shape · ${WIDGETS[state.widget].layouts[state.layout] || "List"}`], ["format", "Formats", formatSummary()], ["site", "Website", p.label]];
            return `
            <span class="kicker">Done</span>
            <h1>Here's your code.</h1>
            <p class="sub">${esc(what)}, for ${esc(p.label)}.</p>
            <dl class="recap">${rows.map(([s, k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd><dd><a href="${href(s)}" data-step="${s}">change</a></dd>`).join("")}</dl>
            <ol class="steps">${p.steps.map((s) => `<li>${s.replace("{h}", isMap() ? state.height : isEventWidget() ? eventHeight() : teamHeight())}</li>`).join("")}</ol>
            ${p.note ? `<p class="hint">${p.note}</p>` : ""}
            <div class="code-head">
                <div class="tabs" role="tablist">${Object.entries(METHODS).map(([m, label]) => `<button role="tab" data-tab="${m}">${label}${m == p.method ? " ✓" : ""}</button>`).join("")}</div>
            </div>
            <pre id="code"></pre>
            <div class="done-actions">
                <button class="btn go" id="copy">Copy code</button>
                <button class="btn" id="share">Copy link to this setup</button>
                ${isEventWidget() ? "" : `<a class="btn" href="${editorLink()}">Fine-tune in the full editor →</a>`}
            </div>
            <p class="hint" style="margin-top:22px"><a href="/setup" data-restart>Set up another widget</a></p>`;
        },
    };

    // ------------------------------------------------------------ preview

    let widget = null;
    let widgetKey = null;

    // Dragging the pit map preview's corner sets the map's height (to the nearest 10px) once the drag
    // settles; until then the box is left alone.
    let resizing = null;
    if (window.ResizeObserver) {
        let seen = null;
        new ResizeObserver(() => {
            let box = $("preview");
            if (state.kind != "event" || step == "kind" || !box.classList.contains("map")) return;
            let h = Math.max(240, Math.round(box.offsetHeight / 10) * 10);
            if (seen === null || h == state.height) return void (seen = h);
            clearTimeout(resizing);
            resizing = setTimeout(() => {
                resizing = null;
                set({ height: h });
            }, 300);
        }).observe($("preview"));
    }

    function preview() {
        let side = $("side");
        let solo = step == "kind";
        $("stage").classList.toggle("solo", solo);
        side.hidden = solo;
        if (solo) return;
        let box = $("preview");

        if (isEventWidget()) return eventPreview(box);
        if (isMap()) {
            box.classList.add("map");
            // The map's box is as tall as the height in the code; dragging its corner changes that height.
            if (!resizing) box.style.height = `${state.height}px`;
            $("preview-hint").textContent = `Drag the corner to resize. The height goes into the code: ${state.height}px.`;
            box.classList.toggle("on-dark", looksDark(state.mapTheme));
            $("preview-label").textContent = "Live preview";
            $("preview-note").textContent = eventRef();
            if (widgetKey !== "map") {
                widget?.destroy?.();
                box.replaceChildren();
                if (LIVE_API) FtcPitMap.configure({ apiBase: SITE.apiBase || null, graphqlUrl: SITE.graphqlUrl || null });
                widget = new FtcPitMap.PitMap(box, { ...mapOptions(), scrollZoom: "modifier" });
                widget.on("load", () => setEventCheck(true));
                widget.on("error", ({ error }) => setEventCheck(false, error));
                widgetKey = "map";
                eventCheck.ref = null;
            }
            widget.update(mapOptions());
            if (answered("event") && eventCheck.ref !== state.source + eventRef()) {
                eventCheck = { ref: state.source + eventRef(), ok: null, text: "Loading…" };
                if (state.source == "example") {
                    widget.setData(EXAMPLES[state.example] || null);
                    eventCheck = { ...eventCheck, ok: true, text: `${EXAMPLE_NAMES[state.example] || state.example}` };
                } else widget.load(eventRef());
                eventStatus();
            }
            return;
        }

        box.classList.remove("map");
        $("preview-hint").textContent = "Drag the corner to try other sizes: the widget fits the width it gets.";
        if (widgetKey == "map") box.style.removeProperty("height");
        // Before the widget question, show the team card: it confirms the team number.
        let id = step == "team" ? "team-card" : state.widget;
        let w = WIDGETS[id];
        let lib = window[w.global];
        $("preview-label").textContent = step == "team" ? "Is this your team?" : "Live preview";
        $("preview-note").textContent = `<${w.tag}>`;
        if (!answered("team")) {
            widget?.destroy?.();
            widget = null;
            widgetKey = null;
            box.innerHTML = `<p class="hint" style="margin:0">Type a team number to see it here.</p>`;
            box.classList.remove("on-dark");
            return;
        }
        if (SITE.apiBase || SITE.graphqlUrl) lib.configure({ apiBase: SITE.apiBase || null, graphqlUrl: SITE.graphqlUrl || null });
        let o = step == "team" ? { team: +state.team, season: state.season ? +state.season : null, stats: "opr,record,awards-total", upcoming: 0 } : teamOptions();
        // Every option goes in, so ones back at their default are reset too.
        o = { layout: "list", season: null, theme: "auto", ...(id == "team-card" ? { stats: "opr,epa,record", upcoming: 1 } : {}), ...(id == "team-awards" ? { onlyWon: false, seasons: null } : {}), ...(id == "team-results" || id == "team-season" ? { skipTypes: null, order: "newest" } : {}), ...(id == "event-rankings" ? { columns: lib[w.cls].defaults.columns, limit: null, maxHeight: null } : {}), ...o };
        if (widgetKey !== id || !widget) {
            widget?.destroy?.();
            box.replaceChildren();
            widget = new lib[w.cls](box, o);
            widget.on("load", ({ data }) => setTeamCheck(true, data));
            widget.on("error", ({ error }) => setTeamCheck(false, error));
            widgetKey = id;
        } else widget.update(o);
        box.classList.toggle("on-dark", step != "team" && looksDark(state.theme));
    }

    // What the preview shows before an event is picked: an example per widget ([season, code]).
    const DEMO_EVENTS = {
        "event-rankings": [2025, "NLHAQ"],
        "event-matches": [2025, "NLHAQ"],
        "event-advancement": [2025, "NLCMP"],
        "league-standings": [2023, "NLBNM7"],
        // The World Championship is always ahead during the season.
        countdown: [THIS_SEASON, "FTCCMP1"],
    };

    function eventPreview(box) {
        box.classList.remove("map");
        let id = state.eventWidget;
        let w = EVENT_WIDGETS[id];
        let lib = window[w.global];
        let demo = !answered("event");
        $("preview-label").textContent = demo ? "Example (pick your event next)" : "Live preview";
        $("preview-note").textContent = `<${w.tag}>`;
        if (SITE.apiBase || SITE.graphqlUrl) lib.configure({ apiBase: SITE.apiBase || null, graphqlUrl: SITE.graphqlUrl || null });
        // Every option goes in, so ones back at their default are reset too.
        let o = {
            ...lib[w.cls].defaults, theme: "auto", shape: null, layout: "list", highlight: null, limit: null, team: null, maxHeight: null,
            locale: null, numberFormat: "locale", decimals: 1, dateFormat: "short", hourCycle: null, timeZone: null,
            ...eventWidgetOptions(),
        };
        if (demo) {
            let [season, code] = DEMO_EVENTS[id];
            Object.assign(o, { event: code, season, team: null });
            if (!o.highlight && id != "countdown" && SITE.demoTeam) o.highlight = String(SITE.demoTeam);
        }
        if (widgetKey !== "event:" + id || !widget) {
            widget?.destroy?.();
            box.replaceChildren();
            widget = new lib[w.cls](box, o);
            widget.on("load", ({ data }) => setEventCheck(true, null, data));
            widget.on("error", ({ error }) => setEventCheck(false, error));
            widgetKey = "event:" + id;
            eventCheck = { ref: state.code, ok: null, text: "Looking it up…" };
        } else {
            if (eventCheck.ref !== state.code) eventCheck = { ref: state.code, ok: null, text: "Looking it up…" };
            widget.update(o);
        }
        box.classList.toggle("on-dark", looksDark(state.theme));
        eventStatus();
    }

    function setTeamCheck(ok, data) {
        let card = ok && data && (data.card || data.team || data);
        let name = card && (card.name || card.team?.name);
        teamCheck = { team: state.team, ok, text: ok ? (name ? `Team ${state.team}: ${name}` : `Team ${state.team} found`) : `Couldn't load team ${state.team}. Check the number?` };
        teamStatus();
    }
    function teamStatus() {
        let el = $("team-status");
        if (!el) return;
        let current = teamCheck.team == state.team && answered("team");
        el.className = "status" + (current && teamCheck.ok === true ? " ok" : current && teamCheck.ok === false ? " bad" : "");
        el.textContent = current ? teamCheck.text : answered("team") ? "Looking it up…" : "";
    }
    function setEventCheck(ok, error, data) {
        if ((isMap() && state.source == "example") || (!isMap() && !answered("event"))) return;
        let ref = eventRef();
        let found = data?.name ? `${data.name} (${ref})` : `Found ${ref}`;
        let missing = isMap() ? `${ref} has no pit map (yet)` : `There's no event ${ref}. Check the code and season?`;
        eventCheck = { ...eventCheck, ok, text: ok ? found : error?.notFound ? missing : `Couldn't load ${ref}` };
        eventStatus();
    }
    function eventStatus() {
        let el = $("event-status");
        if (!el) return;
        el.className = "status" + (eventCheck.ok === true ? " ok" : eventCheck.ok === false ? " bad" : "");
        el.textContent = (!isMap() || state.source == "live") && answered("event") ? eventCheck.text : "";
    }

    // ------------------------------------------------------------ rendering

    function renderProgress() {
        let steps = flow();
        let reachable = true;
        $("progress").innerHTML = steps
            .map((s, i) => {
                let label = `${String(i + 1).padStart(2, "0")} ${s == "kind" || state.kind ? STEPS[s] : "…"}`;
                let here = s == step;
                let html = here
                    ? `<span aria-current="step">${label}</span>`
                    : reachable
                      ? `<a href="${href(s)}" data-step="${s}" class="${steps.indexOf(s) < steps.indexOf(step) ? "done" : ""}">${label}</a>`
                      : `<span class="todo">${label}</span>`;
                if (!answered(s)) reachable = false;
                return html;
            })
            .join("");
        // On narrow screens the steps scroll sideways: keep the current one in view.
        let bar = $("progress").parentElement;
        let here = bar.querySelector('[aria-current="step"]');
        if (here && bar.scrollWidth > bar.clientWidth) bar.scrollLeft = here.offsetLeft - (bar.clientWidth - here.offsetWidth) / 2;
    }

    function renderNav() {
        let steps = flow();
        let i = steps.indexOf(step);
        let nav = document.querySelector(".ask .nav");
        if (!nav) return;
        let prev = steps[i - 1];
        let next = steps[i + 1];
        let skip = step == "highlight" && !teamList();
        // On narrow screens the preview sits below the question: a jump to it.
        let jump = step != "kind" ? `<a class="btn quiet preview-jump" href="#side">Preview ↓</a>` : "";
        nav.innerHTML = `${prev ? `<a class="btn quiet" href="${href(prev)}" data-step="${prev}">← Back</a>` : "<span></span>"}${jump}${next ? `<a class="btn go" href="${href(next)}" data-step="${next}" ${answered(step) ? "" : 'aria-disabled="true"'}>${skip ? "Skip" : next == "done" ? "Show me the code" : "Next"} →</a>` : ""}`;
    }

    /** Sync everything that shows an answer, without rebuilding the page (keeps focus in inputs). */
    function sync() {
        let ask = $("ask");
        for (let b of ask.querySelectorAll(".choice[data-key]")) b.setAttribute("aria-pressed", JSON.stringify(VIRTUAL[b.dataset.key] ? virtualGet(b.dataset.key) : state[b.dataset.key]) === b.dataset.value);
        for (let el of ask.querySelectorAll("[data-check]")) el.checked = !!state[el.dataset.check];
        for (let el of ask.querySelectorAll("[data-color]")) el.value = state[el.dataset.color];
        for (let el of ask.querySelectorAll("[data-select]")) el.value = String(state[el.dataset.select]);
        for (let el of ask.querySelectorAll("[data-input]")) if (document.activeElement !== el) el.value = state[el.dataset.input];
        for (let input of ask.querySelectorAll("#stats input")) {
            let i = state.stats.indexOf(input.value);
            input.checked = i >= 0;
            input.parentElement.dataset.order = i >= 0 ? i + 1 : "";
        }
        let field = isMap() ? "mapTheme" : "theme";
        let [family, mode] = splitTheme(state[field]);
        if ($("custom-box")) {
            $("custom-box").hidden = family != "custom";
            $("custom-box").dataset.mode = mode;
            for (let el of ask.querySelectorAll("[data-custom]")) {
                let [m, k] = el.dataset.custom.split(".");
                if (document.activeElement !== el) el.value = state.custom[m][k];
            }
            $("custom-swatch").innerHTML = swatchCells(customSwatch(state.custom));
            let templates = loadTemplates();
            for (let b of ask.querySelectorAll("[data-tpl]")) {
                let t = templates[+b.dataset.tpl];
                b.setAttribute("aria-pressed", family == "custom" && !!t && JSON.stringify({ light: t.light, dark: t.dark }) == JSON.stringify(state.custom));
            }
            // A saved template is picked: the Custom card itself stays unpressed.
            let fromTemplate = ask.querySelector('[data-tpl][aria-pressed="true"]');
            if (fromTemplate) ask.querySelector('.choice[data-value=\'"custom"\']')?.setAttribute("aria-pressed", "false");
        }
        for (let el of ask.querySelectorAll("[data-accent-row]")) el.hidden = family == "custom";
        for (let el of ask.querySelectorAll("[data-example]")) {
            let [kind, value] = el.dataset.example.split(":");
            el.textContent = example(kind, value);
        }
        if ($("locale-status")) $("locale-status").textContent = state.locale && !localeOf(state.locale) ? `"${state.locale}" isn't a language tag the browser knows: the visitor's own is used.` : "";
        if ($("live-box")) $("live-box").hidden = isMap() && state.source != "live";
        if ($("example-box")) $("example-box").hidden = !isMap() || state.source != "example";
        if ($("code")) {
            let method = tab || (PLATFORMS[state.site] || PLATFORMS.other).method;
            $("code").textContent = isMap() ? mapCode(method) : isEventWidget() ? eventCode(method) : teamCode(method);
            for (let b of ask.querySelectorAll("[data-tab]")) b.setAttribute("aria-selected", b.dataset.tab == method);
        }
        for (let a of document.querySelectorAll("a[data-step]")) a.href = href(a.dataset.step);
        teamStatus();
        eventStatus();
        renderProgress();
        renderNav();
        preview();
        history.replaceState(null, "", href(step));
    }

    function renderStep() {
        $("ask").innerHTML = PAGES[step]() + `<div class="nav"></div>`;
        document.title = `${step == "kind" ? "Set up a widget" : STEPS[step]} · ftc-embeds`;
        sync();
        let first = $("ask").querySelector("input[data-input]");
        if (first && !first.value) first.focus({ preventScroll: true });
    }

    function set(patch) {
        state = { ...state, ...patch };
        if (patch.widget && !WIDGETS[state.widget].layouts[state.layout]) state.layout = "list";
        if (patch.eventWidget && !EVENT_WIDGETS[state.eventWidget].layouts?.[state.layout]) state.layout = "list";
        sync();
    }

    function go(s, push = true) {
        if (!flow().includes(s)) s = "kind";
        // Can't skip past an open question.
        let open = flow().find((x) => !answered(x));
        if (open && flow().indexOf(open) < flow().indexOf(s)) s = open;
        step = s;
        if (s != "done") tab = null;
        if (push) history.pushState(null, "", href(s));
        renderStep();
        window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
    }

    // ------------------------------------------------------------ input

    document.addEventListener("click", (e) => {
        let c = e.target.closest(".choice[data-key]");
        if (c) {
            let key = c.dataset.key;
            let value = JSON.parse(c.dataset.value);
            set(VIRTUAL[key] ? virtualSet(key, value) : { [key]: value });
            // The first question moves on by itself: nothing else to set there.
            if (key == "kind") go(flow()[1]);
            return;
        }
        let a = e.target.closest("a[data-step], a[data-restart]");
        if (a && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
            e.preventDefault();
            if (a.getAttribute("aria-disabled") == "true") return;
            if (a.hasAttribute("data-restart")) {
                state = { ...DEFAULTS };
                return go("kind");
            }
            return go(a.dataset.step);
        }
        let start = e.target.closest("[data-start]");
        if (start) return setCustom(familyPalette(start.dataset.start));
        let tpl = e.target.closest("[data-tpl]");
        if (tpl) {
            let t = loadTemplates()[+tpl.dataset.tpl];
            if (t) setCustom({ light: { ...t.light }, dark: { ...t.dark } });
            return;
        }
        let del = e.target.closest("[data-tpl-del]");
        if (del) {
            let list = loadTemplates();
            let [gone] = list.splice(+del.dataset.tplDel, 1);
            if (gone && confirm(`Delete the saved colors "${gone.name}"?`)) {
                saveTemplates(list);
                renderStep();
            }
            return;
        }
        if (e.target.id == "tpl-save") {
            let name = $("tpl-name").value.trim() || `My colors ${loadTemplates().length + 1}`;
            let list = loadTemplates().filter((t) => t.name != name);
            list.push({ name, light: state.custom.light, dark: state.custom.dark });
            if (saveTemplates(list)) renderStep();
            else $("tpl-status").textContent = "Couldn't save here (private window?). The colors are still in this setup's link.";
            return;
        }
        let t = e.target.closest("[data-tab]");
        if (t) {
            tab = t.dataset.tab;
            sync();
        }
    });
    let typing;
    document.addEventListener("input", (e) => {
        let el = e.target;
        if (el.dataset.input) {
            state[el.dataset.input] = el.value.trim();
            clearTimeout(typing);
            // Nav and progress right away (Next enables), the preview after a pause.
            renderProgress();
            renderNav();
            teamStatus();
            typing = setTimeout(sync, 450);
        } else if (el.dataset.color) set({ [el.dataset.color]: el.value, useAccent: true });
        else if (el.dataset.custom) {
            let [m, k] = el.dataset.custom.split(".");
            state.custom = { ...state.custom, [m]: { ...state.custom[m], [k]: el.value } };
            clearTimeout(typing);
            typing = setTimeout(sync, 60);
        }
    });
    document.addEventListener("change", (e) => {
        let el = e.target;
        if (el.dataset.check) set({ [el.dataset.check]: el.checked });
        else if (el.dataset.select) set({ [el.dataset.select]: +el.value || el.value });
        else if (el.closest("#stats")) set({ stats: el.checked ? [...state.stats, el.value] : state.stats.filter((s) => s !== el.value) });
    });
    // Enter in a text field = Next.
    document.addEventListener("keydown", (e) => {
        if (e.key == "Enter" && e.target.matches("input[data-input]")) {
            clearTimeout(typing);
            sync();
            let next = document.querySelector(".ask .nav .btn.go");
            if (next && next.getAttribute("aria-disabled") != "true") go(next.dataset.step);
        }
    });
    window.addEventListener("popstate", () => {
        readUrl();
        renderStep();
    });

    /** Use these custom colors (and the Custom family, keeping light/dark/follow). */
    function setCustom(custom) {
        let field = isMap() ? "mapTheme" : "theme";
        set({ custom, [field]: FAMILIES.custom.names[splitTheme(state[field])[1]] });
    }

    async function copy(text, button) {
        let label = button.textContent;
        try {
            await navigator.clipboard.writeText(text);
            button.textContent = "Copied!";
        } catch {
            prompt("Copy this:", text);
        }
        setTimeout(() => (button.textContent = label), 1200);
    }
    document.addEventListener("click", (e) => {
        if (e.target.id == "copy") copy($("code").textContent, e.target);
        if (e.target.id == "share") copy(location.href, e.target);
    });

    readUrl();
    renderStep();
})();
