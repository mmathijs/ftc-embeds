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
    };
    // Colors: a family, in a light, a dark, or a follow-the-visitor version. The theme names are the
    // libraries' own. Swatches (background, accent) are close to each theme, for picking only.
    const FAMILIES = {
        default: { label: "Default", text: "Clean, with blue accents", names: { auto: "auto", light: "light", dark: "dark" }, light: ["#ffffff", "#2563eb"], dark: ["#16191e", "#6b9cff"] },
        trophy: { label: "Trophy case", text: "Metallic cards, amber for wins", names: { auto: "trophy-auto", light: "trophy-light", dark: "trophy" }, light: ["#f7f5f0", "#d97706"], dark: ["#2b313d", "#fbbf24"], teamOnly: true },
        ftcscout: { label: "FTCScout", text: "Looks like FTCScout", names: { auto: "ftcscout-auto", light: "ftcscout", dark: "ftcscout-dark" }, light: ["#ffffff", "#2c666e"], dark: ["#2d2d2d", "#39848e"] },
        "ftc-events": { label: "FTC Events", text: "Looks like FIRST's site", names: { auto: "ftc-events-auto", light: "ftc-events", dark: "ftc-events-dark" }, light: ["#ffffff", "#0066b3"], dark: ["#212529", "#4d9fe0"] },
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

    // Shape & spacing, separate from the colors: each preset sets every shape token, so it looks the
    // same on any color theme ("" keeps the color theme's own shape). Only the tokens that differ from
    // the picked color theme end up in the code.
    const SHAPE_DEFAULTS = {
        radius: "12px", innerRadius: "8px", chipRadius: "999px", avatarRadius: "4px", avatarSize: "44px", padding: "16px", gap: "8px", rowPadding: "10px",
        tileWidth: "176px", cardHeight: "150px", fontSize: "14px", titleSize: "16px", titleWeight: "650", titleTransform: "none", titleLetterSpacing: "normal",
        valueSize: "19px", valueWeight: "700", labelLetterSpacing: ".04em", nameSize: "18px", nameWeight: "700", chipFontSize: "11.5px", chipWeight: "550", chipPadding: "2px 8px",
    };
    const TEAM_SHAPES = {
        "": ["Theme's own", "Whatever the colors come with", null],
        rounded: ["Rounded", "Soft corners, normal spacing", {}],
        square: ["Square", "Sharp corners, flat", { radius: "0", innerRadius: "0", chipRadius: "0", avatarRadius: "0" }],
        compact: ["Compact", "Tight, for sidebars", { radius: "6px", innerRadius: "4px", chipRadius: "4px", avatarSize: "36px", padding: "10px", gap: "6px", rowPadding: "6px", fontSize: "13px", titleSize: "15px", valueSize: "17px", nameSize: "16px", tileWidth: "156px" }],
        spacious: ["Spacious", "More room to breathe", { radius: "16px", innerRadius: "12px", avatarRadius: "10px", avatarSize: "52px", padding: "24px", gap: "14px", rowPadding: "14px", tileWidth: "196px", fontSize: "15px", titleSize: "18px" }],
        bubbly: ["Bubbly", "Round everything", { radius: "24px", innerRadius: "18px", avatarRadius: "50%", padding: "20px", gap: "10px", rowPadding: "12px" }],
        showcase: ["Showcase", "Big, bold type", { radius: "14px", innerRadius: "12px", padding: "20px", gap: "12px", tileWidth: "200px", cardHeight: "264px", titleSize: "20px", titleWeight: "800", titleTransform: "uppercase", titleLetterSpacing: ".01em", valueSize: "26px", valueWeight: "850", labelLetterSpacing: ".06em", nameSize: "24px", nameWeight: "850", chipFontSize: "10.5px", chipWeight: "700", chipPadding: "3px 9px" }],
    };
    const MAP_SHAPE_KEYS = ["pitRadius", "pitGap", "objectRadius", "fieldRadius", "wallRadius"];
    const MAP_SHAPES = {
        "": ["Theme's own", "Whatever the colors come with", null],
        rounded: ["Rounded", "Soft pits with gaps", [0.3, 0.08, 0.25, 0.3, 0.12]],
        soft: ["Subtle", "Slightly rounded", [0.16, 0.07, 0.16, 0.16, 0.06]],
        square: ["Square", "Sharp, with gaps", [0, 0.07, 0, 0, 0]],
        blocks: ["Blocks", "Sharp, pits touching", [0, 0, 0, 0, 0]],
        bubbly: ["Bubbly", "Round pits, round walls", [0.5, 0.1, 0.45, 0.4, 0.3]],
    };
    /** The picked color theme's own token values (light for "auto"). */
    // A follow-the-visitor theme compares as its light version: both versions have the same shape.
    const lightOf = (name) => FAMILIES[splitTheme(name)[0]].names.light;
    const teamBase = () => (window.FtcTeamCard?.TEAM_THEMES || {})[lightOf(state.theme)] || {};
    const mapBase = () => (window.FtcPitMap?.THEMES || {})[lightOf(state.mapTheme)] || {};
    function shapeTokens() {
        let preset = TEAM_SHAPES[state.shape]?.[2];
        if (!preset) return {};
        let full = { ...SHAPE_DEFAULTS, ...preset };
        let base = teamBase();
        return Object.fromEntries(Object.entries(full).filter(([k, v]) => String(base[k]) !== v));
    }
    function mapShapeTokens() {
        let preset = MAP_SHAPES[state.mapShape]?.[2];
        if (!preset) return {};
        let base = mapBase();
        return Object.fromEntries(MAP_SHAPE_KEYS.map((k, i) => [k, preset[i]]).filter(([k, v]) => base[k] !== v));
    }
    const STATS = { opr: "OPR", epa: "EPA", "region-rank": "Rank in region", record: "Season record", "record-total": "All-time record", "win-rate": "Win rate", awards: "Season awards", "awards-total": "All awards", matches: "Season matches", events: "Season events", seasons: "Seasons", rookie: "Since" };
    const EXAMPLE_NAMES = {
        FPEEUR: "European Premier Event", NLCMP: "Netherlands Championship", FTCCMP1: "FIRST Championship",
        FTCCMP1EDIS: "Worlds – Edison", FTCCMP1FRAN: "Worlds – Franklin", FTCCMP1GOOD: "Worlds – Goodall",
        FTCCMP1JACK: "Worlds – Jackson", FTCCMP1LOVE: "Worlds – Lovelace", FTCCMP1ROSS: "Worlds – Ross",
    };
    const THIS_SEASON = SITE.demoSeason || 2025;

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
        event: "Event",
        highlight: "Teams",
        look: "Look",
        content: "What to show",
        site: "Your website",
        done: "Code",
    };
    const flow = () => (state.kind == "event" ? ["kind", "event", "highlight", "look", "site", "done"] : ["kind", "team", "widget", "look", "content", "site", "done"]);

    // ------------------------------------------------------------ answers

    const DEFAULTS = {
        kind: "",
        // team widgets (same names as the /team builder)
        team: "", season: "", widget: "team-card", theme: "auto", shape: "", layout: "list", accent: "#2563eb", useAccent: false,
        stats: ["opr", "epa", "record"], upcoming: 1, skipScrimmages: false, oldest: false, onlyWon: false, seasons: "",
        // pit map (same names as the /pit-map dashboard)
        source: "example", example: "FPEEUR", code: "", eventSeason: THIS_SEASON, highlight: "", mapTheme: "auto", mapShape: "", height: 600,
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
        // Theme names from a link: only known ones, and none the pit map doesn't have.
        const known = (name) => Object.values(FAMILIES).some((f) => Object.values(f.names).includes(name));
        if (!known(state.theme)) state.theme = "auto";
        if (!known(state.mapTheme) || FAMILIES[splitTheme(state.mapTheme)[0]].teamOnly) state.mapTheme = "auto";
        if (!TEAM_SHAPES[state.shape]) state.shape = "";
        if (!MAP_SHAPES[state.mapShape]) state.mapShape = "";
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
        if (s == "event") return state.source == "example" || !!state.code.trim();
        if (s == "site") return !!PLATFORMS[state.site];
        return true;
    }

    // ------------------------------------------------------------ options -> code (team widgets)

    function teamOptions() {
        let o = { team: +state.team || null };
        if (state.season) o.season = +state.season;
        let tokens = shapeTokens();
        if (state.useAccent) tokens.accent = state.accent;
        if (Object.keys(tokens).length) o.theme = { base: state.theme, ...tokens };
        else if (state.theme !== "auto") o.theme = state.theme;
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
        if (w == "team-awards") {
            if (state.onlyWon) o.onlyWon = true;
            if (state.seasons) o.seasons = +state.seasons;
        }
        return o;
    }
    const teamHeight = () => (state.layout == "strip" ? 260 : state.layout == "compact" ? 140 : WIDGETS[state.widget].height);

    const kebab = (s) => s.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
    const attrValue = (v) => (typeof v === "object" ? JSON.stringify(v) : String(v));

    function teamCode(method) {
        let w = WIDGETS[state.widget];
        let o = teamOptions();
        let custom = SITE.apiBase && window[w.global] && SITE.apiBase !== window[w.global].DEFAULT_API_BASE;
        let q = new URLSearchParams(Object.entries(o).map(([k, v]) => [k, attrValue(v)]));
        if (method == "url") return `${ORIGIN}/embed/${state.widget}?${q}`;
        if (method == "iframe") return `<iframe src="${esc(`${ORIGIN}/embed/${state.widget}?${q}`)}" title="${w.label}" style="width:100%;height:${teamHeight()}px;border:0" loading="lazy"></iframe>`;
        if (method == "element") {
            let attr = (k, v) => (v === true ? ` ${kebab(k)}` : typeof v === "object" ? ` ${kebab(k)}='${JSON.stringify(v).replace(/'/g, "&#39;")}'` : ` ${kebab(k)}="${esc(String(v))}"`);
            let api = custom ? ` api-base="${SITE.apiBase}"` : "";
            return `<script type="module" src="${ORIGIN}/lib/${state.widget}.mjs"></script>\n<${w.tag}${Object.entries(o).map(([k, v]) => attr(k, v)).join("")}${api}></${w.tag}>`;
        }
        let body = JSON.stringify(o, null, 4).replace(/"([a-zA-Z]+)":/g, "$1:");
        return `// npm install ftc-embeds\nimport { ${custom ? `${w.cls}, configure` : w.cls} } from "ftc-embeds/${state.widget}";\n\n${custom ? `configure({ apiBase: "${SITE.apiBase}" });\n` : ""}new ${w.cls}(document.getElementById("team-widget"), ${body});`;
    }

    // ------------------------------------------------------------ options -> code (pit map)

    const eventRef = () => (state.source == "example" ? `2025/${state.example}` : `${state.eventSeason}/${state.code.trim().toUpperCase()}`);
    const teamList = () => state.highlight.split(/[\s,;]+/).filter(Boolean).join(", ");
    /** "auto", a theme name, or { base, ...shape tokens }. */
    const mapTheme = () => (Object.keys(mapShapeTokens()).length ? { base: state.mapTheme, ...mapShapeTokens() } : state.mapTheme);
    const mapOptions = () => ({ theme: mapTheme(), highlight: teamList() || null });

    function mapCode(method) {
        let theme = mapTheme();
        let themeText = typeof theme == "string" ? theme : JSON.stringify(theme);
        let p = new URLSearchParams({ event: eventRef() });
        if (state.source == "example") p.set("source", "example");
        if (theme != "auto") p.set("theme", themeText);
        if (teamList()) p.set("highlight", teamList());
        let url = `${ORIGIN}/embed/pit-map?${p}`;
        if (method == "url") return url;
        if (method == "iframe") return `<iframe\n    src="${esc(url)}"\n    title="Pit map"\n    style="width: 100%; height: ${state.height}px; border: 0; border-radius: 12px;"\n    loading="lazy"\n></iframe>`;
        let custom = SITE.apiBase ? SITE.apiBase !== FtcPitMap.DEFAULT_API_BASE : !!SITE.graphqlUrl;
        if (method == "element") {
            let attrs = state.source == "example" ? [["src", `${ORIGIN}/examples/${state.example}.json`]] : [["event", eventRef()]];
            if (state.source == "live" && custom) attrs.push(SITE.apiBase ? ["api-base", SITE.apiBase] : ["graphql-url", SITE.graphqlUrl]);
            if (theme != "auto") attrs.push(["theme", themeText]);
            if (teamList()) attrs.push(["highlight", teamList()]);
            // JSON goes in single quotes, so it stays readable.
            let lines = attrs.map(([k, v]) => (v.includes('"') ? `    ${k}='${v.replace(/'/g, "&#39;")}'` : `    ${k}="${esc(v)}"`)).concat(`    style="display: block; height: ${state.height}px;"`);
            return `<script src="${ORIGIN}/lib/pit-map.umd.js"></script>\n<ftc-pit-map\n${lines.join("\n")}\n></ftc-pit-map>`;
        }
        let opts = [];
        if (theme != "auto") opts.push(`    theme: ${JSON.stringify(theme).replace(/"([a-zA-Z]+)":/g, "$1: ").replace(/,(?=\S)/g, ", ")},`);
        if (teamList()) opts.push(`    highlight: "${teamList()}",`);
        let head = `// npm install ftc-embeds\nimport { PitMap${state.source == "live" && custom ? ", configure" : ""} } from "ftc-embeds/pit-map";\n\n`;
        if (state.source == "example") return `${head}const data = await fetch("${ORIGIN}/examples/${state.example}.json").then((r) => r.json());\nnew PitMap(document.getElementById("pit-map"), {\n    data,\n${opts.join("\n")}\n});`;
        let api = !custom ? "" : SITE.apiBase ? `configure({ apiBase: "${SITE.apiBase}" });\n` : `configure({ graphqlUrl: "${SITE.graphqlUrl}" });\n`;
        return `${head}${api}new PitMap(document.getElementById("pit-map"), {\n    event: "${eventRef()}",\n${opts.join("\n")}\n});`;
    }

    /** The same settings in the full dashboard, to fine-tune what the wizard doesn't ask. */
    function editorLink() {
        if (state.kind == "event") {
            let s = { source: state.source, example: state.example, season: state.eventSeason, code: state.code, highlight: state.highlight, theme: state.mapTheme, overrides: mapShapeTokens(), height: state.height };
            let d = { source: "example", example: "FPEEUR", season: 2025, code: "", highlight: "", theme: "auto", overrides: {}, height: 600 };
            let diff = Object.fromEntries(Object.entries(s).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(d[k])));
            return "/pit-map" + (Object.keys(diff).length ? "#" + encodeURIComponent(JSON.stringify(diff)) : "");
        }
        let keys = ["widget", "team", "season", "theme", "layout", "accent", "useAccent", "stats", "upcoming", "skipScrimmages", "oldest", "onlyWon", "seasons"];
        let s = Object.fromEntries(keys.filter((k) => JSON.stringify(state[k]) !== JSON.stringify(DEFAULTS[k]) || k == "team").map((k) => [k, state[k]]));
        // The editor has no shape presets: the shape goes along as CSS variables in its custom CSS.
        let shape = Object.entries(shapeTokens());
        if (shape.length) s.css = `:host {\n${shape.map(([k, v]) => `    --ftcw-${kebab(k)}: ${v};`).join("\n")}\n}`;
        return "/team#" + encodeURIComponent(JSON.stringify(s));
    }

    // ------------------------------------------------------------ the questions

    const choice = (key, value, title, text = "", extra = "") =>
        `<button type="button" class="choice" data-key="${key}" data-value="${esc(JSON.stringify(value))}">${extra}<b>${title}</b>${text ? `<span>${text}</span>` : ""}</button>`;
    // Light half and dark half of a family; the mode cards show which half is used.
    const familySwatch = (f) => `<div class="swatch">${[...f.light, ...f.dark].map((c) => `<i style="background:${c}"></i>`).join("")}</div>`;
    const modeIcon = (m) => `<span class="mode-ico ${m}"></span>`;
    function colorPicker(familyKey, modeKey, map) {
        let fams = Object.entries(FAMILIES).filter(([, f]) => !(map && f.teamOnly));
        return `<div class="choices">${fams.map(([id, f]) => choice(familyKey, id, f.label, f.text, familySwatch(f))).join("")}</div>
            <p class="q">Light or dark?</p>
            <div class="choices small">${Object.entries(MODES).map(([m, [label, text]]) => choice(modeKey, m, label, text, modeIcon(m))).join("")}</div>`;
    }
    const swatch = (colors) => `<div class="swatch">${colors.map((c) => `<i style="background:${c}"></i>`).join("")}</div>`;
    // Small drawings of a shape preset, in the site's own colors: a card with three blocks, at half size.
    const half = (v) => (/%$/.test(v) ? v : `${Math.min(parseFloat(v) || 0, 60) / 2}px`);
    function teamShapeDemo(tokens) {
        let t = tokens ? { ...SHAPE_DEFAULTS, ...tokens } : null;
        if (!t) return `<div class="shape own"><i></i><i></i><i></i></div>`;
        return `<div class="shape" style="border-radius:${half(t.radius)};padding:${half(t.padding)};gap:${half(t.gap)}"><b style="border-radius:${t.avatarRadius == "50%" ? "50%" : half(t.avatarRadius)}"></b><i style="border-radius:${half(t.innerRadius)}"></i><i style="border-radius:${half(t.innerRadius)}"></i></div>`;
    }
    // A row of pits between two walls; values are in cells (one pit ≈ 18px here).
    function mapShapeDemo(v) {
        if (!v) return `<div class="pits own">${"<i></i>".repeat(5)}</div>`;
        let [pit, gap, , , wall] = v;
        return `<div class="pits" style="gap:${gap * 36}px;border-radius:${wall * 18}px">${`<i style="border-radius:${pit * 18}px"></i>`.repeat(5)}</div>`;
    }

    const PAGES = {
        kind: () => `
            <span class="kicker">Let's set it up</span>
            <h1>What do you want to put on your website?</h1>
            <p class="sub">A few questions, one at a time. You'll see it live as you go, and get the code with instructions for your website builder at the end.</p>
            <div class="choices two">
                ${choice("kind", "team", "Something about my team", "A team card, season results, awards, or your next match while you compete.", '<span class="ico">◆</span>')}
                ${choice("kind", "event", "A pit map for an event", "A map visitors can search, with walking routes to pits and fields.", '<span class="ico">▦</span>')}
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
                ${Array.from({ length: 4 }, (_, i) => THIS_SEASON - i).map((y) => choice("season", String(y), `${y}–${String(y + 1).slice(2)}`)).join("")}
            </div>`,

        widget: () => `
            <span class="kicker">Widget</span>
            <h1>Which widget do you want?</h1>
            <p class="sub">Pick one; the preview shows it with your team. You can come back for another one later.</p>
            <div class="choices">
                ${Object.entries(WIDGETS).map(([id, w]) => choice("widget", id, w.label, w.text, "", "").replace("</button>", w.badge ? `<span class="tag">${w.badge}</span></button>` : "</button>")).join("")}
            </div>`,

        look: () =>
            state.kind == "event"
                ? `
            <span class="kicker">Look</span>
            <h1>How should the map look?</h1>
            <p class="sub">Colors and shape are picked separately, so any two go together. The full editor has every color and corner if you need more.</p>
            <h2 class="sec"><span>A</span>Colors</h2>
            ${colorPicker("mapFamily", "mapMode", true)}
            <h2 class="sec"><span>B</span>Shape & spacing <small>Works with any colors</small></h2>
            <div class="choices">
                ${Object.entries(MAP_SHAPES).map(([id, [name, text, v]]) => choice("mapShape", id, name, text, mapShapeDemo(v))).join("")}
            </div>
            <p class="q">How tall?</p>
            <div class="choices small">
                ${choice("height", 450, "Short", "450px")}${choice("height", 600, "Normal", "600px")}${choice("height", 800, "Tall", "800px")}
            </div>`
                : `
            <span class="kicker">Look</span>
            <h1>How should it look?</h1>
            <p class="sub">Colors and shape are picked separately, so any two go together. The preview follows along.</p>
            <h2 class="sec"><span>A</span>Colors</h2>
            ${colorPicker("family", "mode", false)}
            <p class="q">Your team's color? <small>Optional, replaces the accent</small></p>
            <div class="row">
                <label class="check"><input type="checkbox" data-check="useAccent"> Use my own accent color</label>
                <input type="color" data-color="accent" aria-label="Accent color">
            </div>
            <h2 class="sec"><span>B</span>Shape & spacing <small>Works with any colors</small></h2>
            <div class="choices">
                ${Object.entries(TEAM_SHAPES).map(([id, [name, text, tokens]]) => choice("shape", id, name, text, teamShapeDemo(tokens))).join("")}
            </div>
            <p class="q">Arrangement</p>
            <div class="choices small">
                ${Object.entries(WIDGETS[state.widget].layouts).map(([v, label]) => choice("layout", v, label)).join("")}
            </div>`,

        content: () => {
            let w = state.widget;
            let head = `<span class="kicker">What to show</span>`;
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
            <p class="sub">${LIVE_API ? "Your own event, by its FTC event code, or one of the examples to try things out." : "Pick one of the example events."}</p>
            ${LIVE_API ? `<div class="choices two">${choice("source", "live", "My event", "By its event code, from FTC Events")}${choice("source", "example", "An example", "To try it out first")}</div>` : ""}
            <div id="live-box">
                <div class="row" style="margin-top:20px">
                    <label class="f" style="flex:1 1 200px">Event code <input class="big" type="text" data-input="code" placeholder="e.g. NLCMP" autocomplete="off" style="text-transform:uppercase"></label>
                    <label class="f" style="flex:0 0 140px">Season
                        <select data-select="eventSeason">${Array.from({ length: 4 }, (_, i) => THIS_SEASON - i).map((y) => `<option value="${y}">${y}–${String(y + 1).slice(2)}</option>`).join("")}</select>
                    </label>
                </div>
                <div class="status" id="event-status"></div>
                <p class="hint">The code is in the event's URL on ftc-events.firstinspires.org. No pit map yet? The <a href="/pit-map">full editor</a> can load one for you.</p>
            </div>
            <div id="example-box">
                <p class="q">Example events</p>
                <div class="choices small">${Object.keys(EXAMPLES).map((k) => choice("example", k, EXAMPLE_NAMES[k] || k, k)).join("")}</div>
            </div>`,

        highlight: () => `
            <span class="kicker">Teams</span>
            <h1>Should any teams stand out?</h1>
            <p class="sub">Highlighted pits get a color and a pulse, the rest dims. Handy on a team's own site, or for your region's teams. Leave it empty for a plain map.</p>
            <input class="big" type="text" data-input="highlight" placeholder="e.g. 19444, 16236" autocomplete="off" aria-label="Teams to highlight">
            <p class="hint">Team numbers, separated by commas.</p>`,

        site: () => `
            <span class="kicker">Your website</span>
            <h1>Where is your website made?</h1>
            <p class="sub">So you get the kind of code that works there, with the steps to paste it.</p>
            <div class="choices">
                ${Object.entries(PLATFORMS).map(([id, p]) => choice("site", id, p.label, METHODS[p.method])).join("")}
            </div>`,

        done: () => {
            let p = PLATFORMS[state.site] || PLATFORMS.other;
            let what = state.kind == "event" ? `Pit map · ${state.source == "example" ? EXAMPLE_NAMES[state.example] || state.example : eventRef()}` : `${WIDGETS[state.widget].label} · team ${state.team}`;
            let rows = state.kind == "event"
                ? [["event", "Event", what.split(" · ")[1]], ["highlight", "Teams", teamList() || "none"], ["look", "Look", `${themeLabel(state.mapTheme)} colors, ${MAP_SHAPES[state.mapShape][0].toLowerCase()} shape, ${state.height}px`], ["site", "Website", p.label]]
                : [["team", "Team", `${state.team}${state.season ? `, ${state.season}` : ""}`], ["widget", "Widget", WIDGETS[state.widget].label], ["look", "Look", `${themeLabel(state.theme)} colors, ${TEAM_SHAPES[state.shape][0].toLowerCase()} shape, ${(WIDGETS[state.widget].layouts[state.layout] || "list").toLowerCase()}`], ["site", "Website", p.label]];
            return `
            <span class="kicker">Done</span>
            <h1>Here's your code.</h1>
            <p class="sub">${esc(what)}, for ${esc(p.label)}.</p>
            <dl class="recap">${rows.map(([s, k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd><dd><a href="${href(s)}" data-step="${s}">change</a></dd>`).join("")}</dl>
            <ol class="steps">${p.steps.map((s) => `<li>${s.replace("{h}", state.kind == "event" ? state.height : teamHeight())}</li>`).join("")}</ol>
            ${p.note ? `<p class="hint">${p.note}</p>` : ""}
            <div class="code-head">
                <div class="tabs" role="tablist">${Object.entries(METHODS).map(([m, label]) => `<button role="tab" data-tab="${m}">${label}${m == p.method ? " ✓" : ""}</button>`).join("")}</div>
            </div>
            <pre id="code"></pre>
            <div class="done-actions">
                <button class="btn go" id="copy">Copy code</button>
                <button class="btn" id="share">Copy link to this setup</button>
                <a class="btn" href="${editorLink()}">Fine-tune in the full editor →</a>
            </div>
            <p class="hint" style="margin-top:22px"><a href="/setup" data-restart>Set up another widget</a></p>`;
        },
    };

    // ------------------------------------------------------------ preview

    let widget = null;
    let widgetKey = null;

    function preview() {
        let side = $("side");
        let solo = step == "kind";
        $("stage").classList.toggle("solo", solo);
        side.hidden = solo;
        if (solo) return;
        let box = $("preview");

        if (state.kind == "event") {
            box.classList.add("map");
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
        o = { layout: "list", season: null, theme: "auto", ...(id == "team-card" ? { stats: "opr,epa,record", upcoming: 1 } : {}), ...(id == "team-awards" ? { onlyWon: false, seasons: null } : {}), ...(id == "team-results" || id == "team-season" ? { skipTypes: null, order: "newest" } : {}), ...o };
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
    function setEventCheck(ok, error) {
        if (state.source == "example") return;
        eventCheck = { ...eventCheck, ok, text: ok ? `Found ${eventRef()}` : error?.notFound ? `${eventRef()} has no pit map (yet)` : `Couldn't load ${eventRef()}` };
        eventStatus();
    }
    function eventStatus() {
        let el = $("event-status");
        if (!el) return;
        el.className = "status" + (eventCheck.ok === true ? " ok" : eventCheck.ok === false ? " bad" : "");
        el.textContent = state.source == "live" && answered("event") ? eventCheck.text : "";
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
    }

    function renderNav() {
        let steps = flow();
        let i = steps.indexOf(step);
        let nav = document.querySelector(".ask .nav");
        if (!nav) return;
        let prev = steps[i - 1];
        let next = steps[i + 1];
        let skip = step == "highlight" && !teamList();
        nav.innerHTML = `${prev ? `<a class="btn quiet" href="${href(prev)}" data-step="${prev}">← Back</a>` : "<span></span>"}${next ? `<a class="btn go" href="${href(next)}" data-step="${next}" ${answered(step) ? "" : 'aria-disabled="true"'}>${skip ? "Skip" : next == "done" ? "Show me the code" : "Next"} →</a>` : ""}`;
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
        if ($("live-box")) $("live-box").hidden = state.source != "live";
        if ($("example-box")) $("example-box").hidden = state.source != "example";
        if ($("code")) {
            let method = tab || (PLATFORMS[state.site] || PLATFORMS.other).method;
            $("code").textContent = state.kind == "event" ? mapCode(method) : teamCode(method);
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
