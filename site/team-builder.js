// Team widget builder for ftc-embeds.com/team: one settings object drives the preview and the code.
(() => {
    const SITE = window.FTC_EMBEDS_SITE || {};
    const ORIGIN = location.origin;
    const $ = (id) => document.getElementById(id);

    const WIDGETS = {
        "team-card": { global: "FtcTeamCard", cls: "TeamCard", tag: "ftc-team-card", label: "Team card", hint: "Name, location, the stats you pick, and the next events.", layouts: { list: "Card", compact: "One row" }, parts: "avatar, number, location, rookie, website, stats, stat-detail, next-event" },
        "team-results": { global: "FtcTeamResults", cls: "TeamResults", tag: "ftc-team-results", label: "Season results", hint: "Every event this season: rank, record, awards, advancement.", layouts: { list: "List", strip: "Scrolling tiles" }, parts: "date, type, location, division, rank, record, awards, advanced, team" },
        "team-awards": { global: "FtcTeamAwards", cls: "TeamAwards", tag: "ftc-team-awards", label: "Awards", hint: "Every award, by season.", layouts: { list: "List", strip: "Award cards" }, parts: "count, icon, placement, event, season, date" },
        "next-match": { global: "FtcNextMatch", cls: "NextMatch", tag: "ftc-next-match", label: "Next match", hint: "During an event: the next match and the last result, updating itself. Otherwise the next event.", layouts: { list: "Full", compact: "Two lines" }, parts: "event, time, countdown, alliances, names, last, rank, upcoming" },
        "team-season": { global: "FtcTeamSeason", cls: "TeamSeason", tag: "ftc-team-season", label: "Season + next match", hint: "Season results, with the next match on top while competing.", layouts: { list: "List", strip: "Scrolling tiles" }, parts: "live, team, date, type, location, division, rank, record, awards, advanced, event, time, countdown, alliances, names, last, upcoming" },
        countdown: { global: "FtcCountdown", cls: "Countdown", tag: "ftc-countdown", label: "Countdown", hint: "To an event's first day (with an event code), or to the team's next match or event.", layouts: { list: "Boxes", compact: "One line" }, parts: "event, date, location, stream", subject: "either", height: 200 },
        "event-rankings": { global: "FtcEventRankings", cls: "EventRankings", tag: "ftc-event-rankings", label: "Event rankings", hint: "An event's rankings; or without an event code, those of the team's current or latest event.", layouts: { list: "Table" }, parts: "event, date, location, type, names, divisions", subject: "either", columns: "rp, tb1, tb2, record, matches, opr", demo: [2025, "NLHAQ"], height: 560 },
        "event-matches": { global: "FtcEventMatches", cls: "EventMatches", tag: "ftc-event-matches", label: "Match schedule", hint: "An event's matches: times, alliances, scores; the next match marked.", layouts: { list: "Table" }, parts: "event, date, location, type, time, days", subject: "event", demo: [2025, "NLHAQ"], height: 600 },
        "event-advancement": { global: "FtcEventAdvancement", cls: "EventAdvancement", tag: "ftc-event-advancement", label: "Advancement", hint: "An event's slots, each team's advancement points, and who advanced.", layouts: { list: "Table" }, parts: "event, date, location, type, names, summary", subject: "event", columns: "qual, alliance, playoff, award, total", demo: [2025, "NLCMP"], height: 600 },
        "league-standings": { global: "FtcLeagueStandings", cls: "LeagueStandings", tag: "ftc-league-standings", label: "League standings", hint: "A league's standings, from any of its meets (or its tournament).", layouts: { list: "Table" }, parts: "region, parent, record, names", subject: "event", demo: [2023, "NLBNM7"], height: 560 },
    };
    // What a widget is about: a team (default), an event, or either (an event code, else the team).
    const subject = (id) => WIDGETS[id].subject || "team";
    // Starting points for the custom CSS: for every widget, and per widget.
    const CSS_EXAMPLES = {
        all: [
            ["Brand colors", ":host {\n    --ftcw-accent: #e4002b;\n    --ftcw-gold: #e4002b;\n}"],
            ["Square corners", ":host {\n    --ftcw-radius: 0;\n    --ftcw-inner-radius: 0;\n    --ftcw-chip-radius: 0;\n}"],
            ["Bigger title", ".title {\n    font-size: 24px;\n    letter-spacing: -0.01em;\n}"],
            ["No card border", ".ftcw {\n    border: 0;\n    box-shadow: none;\n}"],
            ["Your font", ":host {\n    --ftcw-font: Georgia, serif;\n}"],
        ],
        "team-card": [
            ["Big centered stats", ".stat {\n    text-align: center;\n}\n.stat .v {\n    font-size: 30px;\n    color: var(--_accent);\n}"],
            ["Round avatar", ":host {\n    --ftcw-avatar-radius: 50%;\n    --ftcw-avatar-size: 56px;\n}"],
            ["Name in capitals", ".name {\n    text-transform: uppercase;\n    letter-spacing: .02em;\n}"],
        ],
        "team-results": [
            ["Big ranks", ".rank {\n    font-size: 26px;\n    color: var(--_accent);\n}"],
            ["Plain award labels", ".chip.award {\n    background: none;\n    padding-left: 0;\n}"],
            ["Tall tiles", ":host {\n    --ftcw-tile-height: 170px;\n    --ftcw-tile-width: 220px;\n}"],
        ],
        "team-awards": [
            ["Trophy cards (Lorentz style)", ".strip > .card {\n    background: linear-gradient(#b3b3b3, #a3a3a3);\n    text-transform: uppercase;\n    text-align: center;\n    align-items: center;\n    color: #fff;\n}\n.card.judged.won {\n    background: linear-gradient(#f39a4f, #e07a2b);\n}\n.card.alliance.won {\n    outline: 4px solid #fbbf24;\n    outline-offset: -4px;\n}\n.card .c-event {\n    order: 1;\n    color: #000;\n    font-weight: 800;\n}"],
            ["Dim awards not won", ".card:not(.won), .aw:not(.won) {\n    opacity: .6;\n}"],
            ["No icons", ".icon {\n    display: none;\n}"],
        ],
        "next-match": [
            ["Big match number", ".nm-desc {\n    font-size: 36px;\n}"],
            ["Bold alliances", ".al {\n    border-left-width: 6px;\n    font-size: 15px;\n}"],
        ],
        "team-season": [
            ["Bigger live part", ".nm-desc, .c-desc {\n    font-size: 30px;\n}"],
            ["Big ranks", ".rank {\n    font-size: 26px;\n    color: var(--_accent);\n}"],
        ],
    };
    const CLASSES = {
        "team-card": ".ftcw (the card), .top, .avatar, .num, .name, .meta, .stats, .stat, .stat .k / .v / .r, .next, .upc, .upc-row, .upc-date, .chip",
        "team-results": ".ftcw, .head, .title, .rows, .row, .ev, .sub, .chips, .chip.award, .chip.award.won, .chip.good, .rank, .rec, .strip, .tile, .tile.live, .tile.upcoming",
        "team-awards": ".ftcw, .head, .title, .count, .season, .sname, .aw, .an, .ae, .strip, .card, .card.won, .card.alliance, .card.judged, .card.p1 / .p2 / …, .card.type-Inspire / …, .c-icon, .c-name, .c-place, .c-event, .c-season",
        "next-match": ".ftcw, .live-head, .nm, .nm-label, .nm-desc, .nm-when, .alliances, .al.red, .al.blue, .al .t.me, .last, .upnext, .cm (compact)",
        "team-season": "those of season results and next match, plus .now (the live part)",
        countdown: ".ftcw, .cd-what, .cd-label, .cd-boxes, .cd-box, .cd-num, .cd-unit, .cd-line (compact), .cd-pair, .cd-state",
        "event-rankings": ".ftcw, .evline, .tabs, .tbl, .tbl th, .tbl td, tr.me, tr.gap, .rk, .tm, .num, .nm, .c-rp / .c-tb1 / .c-record / .c-matches / .c-opr",
        "event-matches": ".ftcw, .evline, .tbl, tr.day, tr.played, tr.nextm, tr.me, .md, .tt, .al.red, .al.blue, .tn, .tn.me, .tnm, .sc, .scg",
        "event-advancement": ".ftcw, .evline, .adv-sum, .tbl, tr.me, tr.cut, tr.out, .c-qual / .c-alliance / .c-playoff / .c-award / .c-total, .nf (not final), td.st",
        "league-standings": ".ftcw, .lg-sub, .tbl, tr.me, tr.gap, .rk, .tm, .c-record",
    };

    const STATS = { opr: "OPR", epa: "EPA", "region-rank": "Rank in region", record: "Season record", "record-total": "All-time record", "win-rate": "Win rate", awards: "Season awards", "awards-total": "All awards", matches: "Season matches", "matches-total": "All matches", events: "Season events", "events-total": "All events", seasons: "Seasons", rookie: "Since" };

    const DEFAULTS = {
        widget: "team-card", team: "19444", season: "", theme: "auto", layout: "list", density: "normal", accent: "#2563eb", useAccent: false, bare: false,
        radius: -1, avatarRadius: "", linkTo: "ftcscout", css: "",
        stats: ["opr", "epa", "record"], upcoming: 1, skipScrimmages: false, oldest: false, onlyWon: false, seasons: "", limit: "", hide: "",
        locale: "", numberFormat: "locale", decimals: 1, dateFormat: "short", hourCycle: "", timeZone: "",
        // event widgets
        event: "", shape: "", highlight: "", columns: "", maxHeight: "", level: "all", matchState: "all", onlyTeam: false, names: false,
    };
    let state = { ...DEFAULTS };
    let tab = "element";

    function readHash() {
        try {
            let saved = JSON.parse(decodeURIComponent(location.hash.slice(1)) || "{}");
            state = { ...DEFAULTS, ...saved };
            if (!WIDGETS[state.widget]) state.widget = DEFAULTS.widget;
        } catch {
            state = { ...DEFAULTS };
        }
    }
    function writeHash() {
        let diff = Object.fromEntries(Object.entries(state).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(DEFAULTS[k])));
        history.replaceState(null, "", Object.keys(diff).length ? "#" + encodeURIComponent(JSON.stringify(diff)) : location.pathname);
    }

    /** The widget's options (camelCase), only those that differ from the widget's defaults. */
    function options() {
        let w = state.widget;
        let kind = subject(w);
        let code = state.event.trim().toUpperCase();
        let o = {};
        // An event widget takes the event; "either" takes the event when one is given, else the team.
        if (kind === "event" || (kind === "either" && code)) o.event = code || null;
        if (kind === "team" || (kind === "either" && !code) || (w === "event-matches" && state.onlyTeam)) o.team = +state.team || null;
        if (state.season) o.season = +state.season;
        // Tokens on top of the theme: accent, corners (card; tiles 4px less), avatar corners.
        let tokens = {};
        if (state.useAccent) tokens.accent = state.accent;
        if (state.radius >= 0) Object.assign(tokens, { radius: `${state.radius}px`, innerRadius: `${Math.max(0, state.radius - 4)}px` });
        if (state.avatarRadius) tokens.avatarRadius = state.avatarRadius;
        if (Object.keys(tokens).length) o.theme = { base: state.theme, ...tokens };
        else if (state.theme !== "auto") o.theme = state.theme;
        if (state.shape) o.shape = state.shape;
        if (state.layout !== "list") o.layout = state.layout;
        if (state.maxHeight.trim()) o.maxHeight = /^\d+$/.test(state.maxHeight.trim()) ? `${state.maxHeight.trim()}px` : state.maxHeight.trim();
        if (kind !== "team" && w !== "countdown" && state.highlight.trim()) o.highlight = state.highlight.split(/[\s,;]+/).filter(Boolean).join(",");
        if ((w === "event-rankings" || w === "event-advancement") && state.columns.trim()) o.columns = state.columns.split(/[\s,]+/).filter(Boolean).join(",");
        if (w === "event-matches") {
            if (state.level !== "all") o.level = state.level;
            if (state.matchState !== "all") o.state = state.matchState;
            if (state.names) o.names = true;
        }
        if (state.density !== "normal") o.density = state.density;
        if (state.bare) o.bare = true;
        if (state.linkTo === "none") o.linkTarget = "none";
        else if (state.linkTo !== "ftcscout") o.linkTo = state.linkTo;
        if (state.limit) o.limit = +state.limit;
        if (state.css.trim()) o.css = state.css.trim();
        if (state.hide.trim()) o.hide = state.hide.split(/[\s,]+/).filter(Boolean).join(",");
        if (state.locale) o.locale = state.locale;
        if (state.numberFormat !== "locale") o.numberFormat = state.numberFormat;
        if (+state.decimals !== 1) o.decimals = +state.decimals;
        if (state.dateFormat !== "short") o.dateFormat = state.dateFormat;
        if (state.hourCycle) o.hourCycle = +state.hourCycle;
        if (state.timeZone) o.timeZone = state.timeZone;
        if (w === "team-card") {
            if (state.stats.join(",") !== "opr,epa,record") o.stats = state.stats.join(",");
            if (+state.upcoming !== 1) o.upcoming = +state.upcoming;
        }
        if (w === "team-results" || w === "team-season") {
            if (state.skipScrimmages) o.skipTypes = "Scrimmage";
            if (state.oldest) o.order = "oldest";
        }
        if (w === "team-awards") {
            if (state.onlyWon) o.onlyWon = true;
            if (state.seasons) o.seasons = +state.seasons;
        }
        return o;
    }

    const kebab = (s) => s.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
    const attrValue = (v) => (typeof v === "object" ? JSON.stringify(v) : String(v));
    const escapeAttr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

    function snippet() {
        let w = WIDGETS[state.widget];
        let o = options();
        if (tab === "element") {
            // JSON goes in single quotes, so it stays readable.
            let attr = (k, v) => (v === true ? ` ${kebab(k)}` : typeof v === "object" ? ` ${kebab(k)}='${JSON.stringify(v).replace(/'/g, "&#39;")}'` : ` ${kebab(k)}="${escapeAttr(String(v))}"`);
            let attrs = Object.entries(o).map(([k, v]) => attr(k, v)).join("");
            // FTCScout's API is the default: only another one needs api-base.
            let api = SITE.apiBase && SITE.apiBase !== window[w.global].DEFAULT_API_BASE ? ` api-base="${SITE.apiBase}"` : "";
            return `<script type="module" src="${ORIGIN}/lib/${state.widget}.mjs"></script>\n<${w.tag}${attrs}${api}></${w.tag}>`;
        }
        if (tab === "url") {
            let q = new URLSearchParams(Object.entries(o).map(([k, v]) => [k, attrValue(v)]));
            return `${ORIGIN}/embed/${state.widget}?${q}`;
        }
        if (tab === "iframe") {
            let q = new URLSearchParams(Object.entries(o).map(([k, v]) => [k, attrValue(v)]));
            let height = { "team-card": 300, "team-results": 460, "team-awards": 420, "next-match": 230, "team-season": 520 }[state.widget] || w.height || 500;
            if (state.layout === "strip") height = 260;
            if (state.layout === "compact") height = 140;
            if (o.maxHeight && /px$/.test(o.maxHeight)) height = parseInt(o.maxHeight) + 4;
            return `<iframe src="${ORIGIN}/embed/${state.widget}?${q}" title="${w.label}" style="width:100%;height:${height}px;border:0" loading="lazy"></iframe>`;
        }
        let body = JSON.stringify(o, null, 4).replace(/"([a-zA-Z]+)":/g, "$1:");
        let custom = SITE.apiBase && SITE.apiBase !== window[w.global].DEFAULT_API_BASE;
        let imports = custom ? `${w.cls}, configure` : w.cls;
        let api = custom ? `configure({ apiBase: "${SITE.apiBase}" });\n` : "";
        return `// npm install ftc-embeds\nimport { ${imports} } from "ftc-embeds/${state.widget}";\n\n${api}new ${w.cls}(document.getElementById("team-widget"), ${body});`;
    }

    const HINTS = {
        element: "Paste it where the widget should go. It fits the width of its container.",
        iframe: "For sites that don't allow scripts (Wix, Google Sites, …). Set the height to fit.",
        js: "For apps built with a bundler. The options are the same as the attributes.",
        url: "A link to just the widget: to share, or behind a QR code at your pit.",
        css: "Style anything inside the widget: start from an example or write your own. The preview updates as you type, and the CSS goes into the code.",
    };

    // ------------------------------------------------------------ preview

    let widget = null;
    let shown = null;
    function preview() {
        let w = WIDGETS[state.widget];
        let lib = window[w.global];
        if (!lib) return;
        if (SITE.apiBase || SITE.graphqlUrl) lib.configure({ apiBase: SITE.apiBase || null, graphqlUrl: SITE.graphqlUrl || null });
        // Every option goes to the widget, so values back at their default are applied too.
        let o = { layout: "list", density: "normal", bare: false, limit: null, hide: null, season: null, theme: "auto", linkTo: "ftcscout", linkTarget: "_blank", css: "", locale: null, numberFormat: "locale", decimals: 1, dateFormat: "short", hourCycle: null, timeZone: null, ...options() };
        if (state.widget === "team-card") o = { stats: "opr,epa,record", upcoming: 1, ...o };
        if (state.widget === "team-awards") o = { onlyWon: false, seasons: null, ...o };
        if (state.widget === "team-results" || state.widget === "team-season") o = { skipTypes: null, order: "newest", ...o };
        if (subject(state.widget) !== "team") o = { ...lib[w.cls].defaults, event: null, team: null, shape: null, maxHeight: null, highlight: null, ...o };
        else o = { shape: null, maxHeight: null, ...o };
        if (shown !== state.widget || !widget) {
            widget?.destroy();
            $("preview").replaceChildren();
            widget = new lib[w.cls]($("preview"), o);
            shown = state.widget;
        } else widget.update(o);
        let dark = /-auto$|^auto$/.test(state.theme) ? matchMedia("(prefers-color-scheme: dark)").matches : state.theme == "dark" || state.theme == "trophy" || state.theme.endsWith("-dark");
        $("preview").classList.toggle("on-dark", dark);
    }

    // ------------------------------------------------------------ controls

    function syncControls() {
        let w = WIDGETS[state.widget];
        $("widget").value = state.widget;
        $("widget-hint").textContent = w.hint;
        $("team").value = state.team;
        $("season").value = state.season;
        let kind = subject(state.widget);
        if (document.activeElement !== $("event")) $("event").value = state.event;
        $("event-field").hidden = kind === "team";
        $("team-field").hidden = kind === "event" && !(state.widget === "event-matches" && state.onlyTeam);
        $("event-label").textContent = kind === "either" ? "Event code (optional)" : "Event code";
        $("subject-hint").textContent = kind === "either" ? "Leave the event code empty for the team's own: " + (state.widget === "countdown" ? "its next match or event." : "its current or latest event.") : state.widget === "league-standings" ? "Any meet of the league, or its tournament." : "";
        $("shape").value = state.shape;
        $("layout-field").hidden = Object.keys(w.layouts).length < 2;
        $("event-box").hidden = kind === "team" || state.widget === "countdown";
        $("columns-field").hidden = !w.columns;
        $("columns-hint").hidden = !w.columns;
        $("columns-hint").textContent = w.columns ? `Any of: ${w.columns}. Empty: the default.` : "";
        if (document.activeElement !== $("columns")) $("columns").value = state.columns;
        if (document.activeElement !== $("highlight")) $("highlight").value = state.highlight;
        $("matches-box").hidden = state.widget !== "event-matches";
        $("level").value = state.level;
        $("match-state").value = state.matchState;
        $("only-team").checked = state.onlyTeam;
        $("names").checked = state.names;
        if (document.activeElement !== $("max-height")) $("max-height").value = state.maxHeight;
        $("theme").value = state.theme;
        $("layout").replaceChildren(...Object.entries(w.layouts).map(([v, label]) => new Option(label, v)));
        if (!w.layouts[state.layout]) state.layout = "list";
        $("layout").value = state.layout;
        $("density").value = state.density;
        $("accent").value = state.accent;
        $("radius").value = state.radius;
        $("radius-out").textContent = state.radius >= 0 ? `${state.radius}px` : "theme's own";
        $("avatar-radius").value = state.avatarRadius;
        $("use-accent").checked = state.useAccent;
        $("bare").checked = state.bare;
        $("link-to").value = state.linkTo;
        $("card-box").hidden = state.widget !== "team-card";
        // (countdown and the event widgets have their own boxes, set above)
        $("results-box").hidden = !(state.widget === "team-results" || state.widget === "team-season");
        $("awards-box").hidden = state.widget !== "team-awards";
        for (let input of $("stats").querySelectorAll("input")) {
            let i = state.stats.indexOf(input.value);
            input.checked = i >= 0;
            input.parentElement.dataset.order = i >= 0 ? i + 1 : "";
        }
        $("upcoming").value = state.upcoming;
        $("skip-scrimmages").checked = state.skipScrimmages;
        $("oldest").checked = state.oldest;
        $("only-won").checked = state.onlyWon;
        $("seasons").value = state.seasons;
        $("limit").value = state.limit;
        $("hide").value = state.hide;
        $("locale").value = state.locale;
        $("number-format").value = state.numberFormat;
        $("decimals").value = state.decimals;
        $("date-format").value = state.dateFormat;
        $("hour-cycle").value = state.hourCycle;
        $("time-zone").value = state.timeZone;
        $("hide-hint").textContent = `Parts of this widget: ${w.parts}.`;
        if (document.activeElement !== $("css")) $("css").value = state.css;
        $("css-examples").replaceChildren(...[...CSS_EXAMPLES.all, ...(CSS_EXAMPLES[state.widget] || [])].map(([label, css]) => {
            let b = document.createElement("button");
            b.type = "button";
            b.textContent = label;
            b.onclick = () => set({ css: (state.css.trim() ? state.css.trim() + "\n\n" : "") + css });
            return b;
        }));
        $("css-classes").textContent = `Classes in this widget: ${CLASSES[state.widget]}.`;
    }

    function render() {
        syncControls();
        preview();
        if (tab !== "css") $("snippet").textContent = snippet();
        $("snippet").hidden = tab === "css";
        $("css-panel").hidden = tab !== "css";
        $("copy").hidden = tab === "css";
        $("tab-hint").textContent = HINTS[tab];
        document.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === tab));
        writeHash();
    }

    function set(patch) {
        state = { ...state, ...patch };
        render();
    }

    for (let [label, ids] of [["Team widgets", Object.keys(WIDGETS).filter((id) => subject(id) === "team" || id === "countdown")], ["Event widgets", Object.keys(WIDGETS).filter((id) => subject(id) !== "team" && id !== "countdown")]]) {
        let group = document.createElement("optgroup");
        group.label = label;
        for (let id of ids) group.appendChild(new Option(WIDGETS[id].label, id));
        $("widget").appendChild(group);
    }
    for (let [key, label] of Object.entries(STATS)) {
        let input = document.createElement("input");
        input.type = "checkbox";
        input.value = key;
        let l = document.createElement("label");
        l.append(input, label);
        $("stats").appendChild(l);
        input.onchange = () => set({ stats: input.checked ? [...state.stats, key] : state.stats.filter((s) => s !== key) });
    }

    $("widget").onchange = (e) => {
        let id = e.target.value;
        let patch = { widget: id, columns: "" };
        // An event widget without an event: start from an example one.
        let demo = WIDGETS[id].demo;
        if (subject(id) === "event" && !state.event.trim() && demo) Object.assign(patch, { season: String(demo[0]), event: demo[1] });
        set(patch);
    };
    $("event").onchange = (e) => set({ event: e.target.value.trim().toUpperCase() });
    $("shape").onchange = (e) => set({ shape: e.target.value });
    $("highlight").onchange = (e) => set({ highlight: e.target.value });
    $("columns").onchange = (e) => set({ columns: e.target.value });
    $("max-height").onchange = (e) => set({ maxHeight: e.target.value.trim() });
    $("level").onchange = (e) => set({ level: e.target.value });
    $("match-state").onchange = (e) => set({ matchState: e.target.value });
    $("only-team").onchange = (e) => set({ onlyTeam: e.target.checked });
    $("names").onchange = (e) => set({ names: e.target.checked });
    $("team").onchange = (e) => set({ team: e.target.value.trim() });
    $("season").onchange = (e) => set({ season: e.target.value.trim() });
    $("theme").onchange = (e) => set({ theme: e.target.value });
    $("layout").onchange = (e) => set({ layout: e.target.value });
    $("density").onchange = (e) => set({ density: e.target.value });
    $("accent").oninput = (e) => set({ accent: e.target.value, useAccent: true });
    $("radius").oninput = (e) => set({ radius: +e.target.value });
    $("avatar-radius").onchange = (e) => set({ avatarRadius: e.target.value });
    $("use-accent").onchange = (e) => set({ useAccent: e.target.checked });
    $("bare").onchange = (e) => set({ bare: e.target.checked });
    $("link-to").onchange = (e) => set({ linkTo: e.target.value });
    $("upcoming").onchange = (e) => set({ upcoming: Math.max(0, +e.target.value || 0) });
    $("skip-scrimmages").onchange = (e) => set({ skipScrimmages: e.target.checked });
    $("oldest").onchange = (e) => set({ oldest: e.target.checked });
    $("only-won").onchange = (e) => set({ onlyWon: e.target.checked });
    $("seasons").onchange = (e) => set({ seasons: e.target.value.trim() });
    $("limit").onchange = (e) => set({ limit: e.target.value.trim() });
    $("hide").onchange = (e) => set({ hide: e.target.value });
    $("locale").onchange = (e) => set({ locale: e.target.value.trim() });
    $("number-format").onchange = (e) => set({ numberFormat: e.target.value });
    $("decimals").onchange = (e) => set({ decimals: Math.max(0, Math.min(3, +e.target.value || 0)) });
    $("date-format").onchange = (e) => set({ dateFormat: e.target.value });
    $("hour-cycle").onchange = (e) => set({ hourCycle: e.target.value });
    $("time-zone").onchange = (e) => set({ timeZone: e.target.value.trim() });
    if (Intl.supportedValuesOf) $("time-zones").replaceChildren(...Intl.supportedValuesOf("timeZone").map((z) => new Option(z.replace(/_/g, " "), z)));
    let cssTimer;
    $("css").oninput = (e) => {
        clearTimeout(cssTimer);
        cssTimer = setTimeout(() => set({ css: e.target.value }), 250);
    };
    document.querySelectorAll(".tabs button").forEach((b) => (b.onclick = () => ((tab = b.dataset.tab), render())));
    $("open-css").onclick = () => {
        tab = "css";
        render();
        $("css").focus({ preventScroll: true });
        $("css-panel").scrollIntoView({ behavior: "smooth", block: "nearest" });
    };

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
    $("copy").onclick = () => copy($("snippet").textContent, $("copy"));
    $("share").onclick = () => copy(location.href, $("share"));

    readHash();
    render();
})();
