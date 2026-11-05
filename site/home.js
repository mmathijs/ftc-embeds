// Homepage: one live team card, the team and event widgets as lists, a live pit map, a live
// preview of every widget (the showcase), and the spotlight to try their layouts and themes.
(() => {
    const SITE = window.FTC_EMBEDS_SITE || {};
    const TEAM = SITE.demoTeam || 19444;
    const $ = (id) => document.getElementById(id);
    const builder = (settings) => `/team#${encodeURIComponent(JSON.stringify(settings))}`;
    // The widgets in this site's own style: its colors (light and dark), font and square corners.
    // CSS variables reach into the widgets, so this follows the site's dark mode by itself.
    const THEME = {
        // surface: the panels inside a widget (countdown boxes, tiles), a step away from its background in light and dark
        base: "auto", bg: "var(--field)", surface: "color-mix(in srgb, var(--ink) 7%, var(--field))", text: "var(--ink)", muted: "var(--ink-2)", border: "var(--rule)",
        accent: "var(--accent)", accentText: "var(--accent-ink)", gold: "var(--accent)", radius: "2px", innerRadius: "2px", font: "var(--sans)", shadow: "none",
    };

    // The example: a team card, live.
    try {
        FtcTeamCard.configure({ apiBase: SITE.apiBase || null, graphqlUrl: SITE.graphqlUrl || null });
        let card = new FtcTeamCard.TeamCard($("example"), { team: TEAM, season: SITE.demoSeason || null, theme: THEME, stats: "opr,record,awards-total", upcoming: 0 });
        let caption = (n) => ($("example-cap").textContent = `<ftc-team-card team="${n}">, live`);
        card.on("load", ({ data }) => caption(data.card.number));
        // "Make it yours": the styles (FTCScout, trophy case, …) and corners on this very card; the rest further down
        const HERO_STYLES = [["site", "This site's"], ["ftcscout", "FTCScout"], ["ftc-events", "FTC Events"], ["trophy", "Trophy case"], ["dark", "Dark"]];
        let pick = { style: "site", corners: "" };
        let restyle = () => {
            let site = pick.style === "site";
            // this site's look has square corners of its own: a shape only shows without them
            let theme = site ? (pick.corners ? (({ radius, innerRadius, ...t }) => t)(THEME) : THEME) : pick.style;
            card.update({ theme, shape: pick.corners || null });
            let name = HERO_STYLES.find((x) => x[0] === pick.style)[1];
            let corner = pick.corners === "square" ? "square corners" : pick.corners === "bubbly" ? "rounded corners" : null;
            let text = [site ? null : `in the ${name} style`, corner ? `with ${corner}` : null].filter(Boolean).join(", ");
            $("example-cap").textContent = `<ftc-team-card team="${TEAM}">, live${text ? ", " + text : ""}`;
        };
        let seg = (box, key, items) => items.forEach(([v, label]) => {
            let b = document.createElement("button");
            Object.assign(b, { type: "button", textContent: label });
            b.setAttribute("aria-pressed", String(pick[key] === v));
            b.addEventListener("click", () => { pick[key] = v; box.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); restyle(); });
            box.append(b);
        });
        seg(document.querySelector("#hero-try .ht-styles"), "style", HERO_STYLES);
        let corners = document.querySelector("#hero-try .ht-corners");
        corners.replaceChildren();
        seg(corners, "corners", [["", "The style's"], ["square", "Square"], ["bubbly", "Rounded"]]);
        $("hero-try").hidden = false;
    } catch {
        $("example").textContent = "Preview unavailable.";
    }

    const WIDGETS = [
        ["Team card", "your stats and next events", { widget: "team-card" }],
        ["Season results", "every event: rank, record, awards", { widget: "team-results" }],
        ["Awards", "every award, as a list or trophy cards", { widget: "team-awards", layout: "strip" }],
        ["Next match", "during events: your next match, live", { widget: "next-match" }],
        ["Season + next match", "both in one, for a team homepage", { widget: "team-season" }],
        ["Event rankings", "your current event's rankings, you marked", { widget: "event-rankings", team: String(TEAM) }],
        ["Countdown", "to your next event or match", { widget: "countdown" }],
    ];
    // The event widgets start from an example event.
    const EVENT_WIDGETS = [
        ["Rankings", "live, with divisions and your teams marked", { widget: "event-rankings", event: "NLHAQ", season: "2025" }],
        ["Match schedule", "times, alliances, scores; the next match marked", { widget: "event-matches", event: "NLHAQ", season: "2025" }],
        ["Advancement", "the slots, each team's points, who advanced", { widget: "event-advancement", event: "NLCMP", season: "2025" }],
        ["League standings", "from any meet, current all season", { widget: "league-standings", event: "NLBNM7", season: "2023" }],
        ["Countdown", "to the first day or the first match", { widget: "countdown", event: "FTCCMP1" }],
    ];
    const list = (id, widgets) => {
        for (let [name, text, settings] of widgets) {
            let a = document.createElement("a");
            a.href = builder(settings);
            let b = document.createElement("b");
            b.textContent = name;
            let span = document.createElement("span");
            span.textContent = text;
            let i = document.createElement("i");
            i.textContent = "Configure →";
            a.append(b, span, i);
            let li = document.createElement("li");
            li.append(a);
            $(id).append(li);
        }
    };
    list("team-widgets", WIDGETS);

    // "See every widget with your own team": the team's page, /teams/<number>
    $("myteam").addEventListener("submit", (e) => {
        e.preventDefault();
        let n = $("myteam-n").value.trim().replace(/^#/, "");
        if (!/^\d{1,6}$/.test(n)) {
            $("myteam-msg").textContent = "A team number is digits only, like 16382.";
            $("myteam-n").focus();
            return;
        }
        location.href = `/teams/${+n}`;
    });
    $("myteam-n").addEventListener("input", () => ($("myteam-msg").textContent = ""));
    list("event-widgets", EVENT_WIDGETS);

    // The pit map: the example event, with the demo team's pit highlighted.
    fetch("examples/FPEEUR.json")
        .then((r) => r.json())
        .then((data) => new FtcPitMap.PitMap($("pit-map"), { data, theme: { base: "auto", background: "var(--field)" }, highlight: String(TEAM), controls: false, scrollZoom: false, pulse: false }))
        .catch(() => ($("pit-map").textContent = "Preview unavailable."));

    // ---------------------------------------------------------------- showcase and spotlight
    // Every widget, previewed live. A widget's library is loaded the first time it is shown.
    const PREVIEW = {
        "pit-map": { lib: "pit-map", layouts: [] },
        "team-card": { lib: "team-card", global: "FtcTeamCard", cls: "TeamCard", opts: { team: TEAM, stats: "opr,record,awards-total", upcoming: 1 }, layouts: [["list", "Card"], ["compact", "One row"]] },
        "team-results": { lib: "team-results", global: "FtcTeamResults", cls: "TeamResults", opts: { team: TEAM, season: 2025 }, layouts: [["strip", "Tiles"], ["list", "List"]] },
        "team-awards": { lib: "team-awards", global: "FtcTeamAwards", cls: "TeamAwards", opts: { team: TEAM }, layouts: [["banners", "FTC banners"], ["strip", "Award cards"], ["list", "List"]] },
        "next-match": { lib: "next-match", global: "FtcNextMatch", cls: "NextMatch", opts: { team: TEAM }, layouts: [["list", "Full"], ["compact", "Two lines"]] },
        "team-season": { lib: "team-season", global: "FtcTeamSeason", cls: "TeamSeason", opts: { team: TEAM, season: 2025 }, layouts: [["strip", "Tiles"], ["list", "List"]] },
        countdown: { lib: "countdown", global: "FtcCountdown", cls: "Countdown", opts: { event: "FTCCMP1" }, layouts: [["list", "Boxes"], ["compact", "One line"]] },
        "event-rankings": { lib: "event-rankings", global: "FtcEventRankings", cls: "EventRankings", opts: { event: "NLHAQ", season: 2025, highlight: String(TEAM) }, layouts: [["podium", "Podium"], ["cards", "Leaderboard"], ["list", "Table"], ["strip", "Tiles"]] },
        "event-matches": { lib: "event-matches", global: "FtcEventMatches", cls: "EventMatches", opts: { event: "NLHAQ", season: 2025, highlight: String(TEAM) }, layouts: [] },
        "event-advancement": { lib: "event-advancement", global: "FtcEventAdvancement", cls: "EventAdvancement", opts: { event: "NLCMP", season: 2025 }, layouts: [] },
        "league-standings": { lib: "league-standings", global: "FtcLeagueStandings", cls: "LeagueStandings", opts: { event: "NLBNM7", season: 2023 }, layouts: [] },
    };
    const THEMES = [["site", "This site's look"], ["light", "Light"], ["dark", "Dark"], ["ftcscout", "FTCScout"], ["ftc-events", "FTC Events"], ["trophy", "Trophy case"]];
    const el = (tag, props = {}, ...kids) => { let e = Object.assign(document.createElement(tag), props); e.append(...kids.flat().filter((k) => k != null)); return e; };
    const loading = {};
    const lib = (name) => (loading[name] ||= new Promise((ok, bad) => {
        let global = PREVIEW[name] && PREVIEW[name].global;
        if (global && window[global]) return ok();
        document.head.append(el("script", { src: `lib/${name}.umd.js`, onload: ok, onerror: bad }));
    }));
    let pitData = null;

    /** A live preview in `box`, drawn when it comes into view; box.restyle({ layout, theme }) draws it again.
     *  maxHeight: the widget scrolls inside itself above this (as on a real page), so every row is there. */
    function preview(id, box, style, maxHeight) {
        let p = PREVIEW[id], shown = false;
        if (id === "pit-map") box.classList.add("map");
        if (typeof ResizeObserver !== "undefined") {   // the fade at the bottom only when the widget is taller than its box
            let check = () => box.classList.toggle("clip", id !== "pit-map" && box.scrollHeight > box.clientHeight + 2);
            new ResizeObserver(check).observe(box);
            new MutationObserver(() => requestAnimationFrame(check)).observe(box, { childList: true, subtree: true });
        }
        let widget = null;
        let draw = async (st) => {
            widget = null;
            box.replaceChildren(el("div", { className: "wait" }, "loading…"));
            try {
                let host = el("div");
                if (id === "pit-map") {
                    pitData = pitData || (await (await fetch("examples/FPEEUR.json")).json());
                    box.replaceChildren(host); host.style.height = "100%";
                    new FtcPitMap.PitMap(host, { data: pitData, theme: { base: "auto", background: "var(--field)" }, highlight: String(TEAM), controls: false, scrollZoom: false, pulse: false });
                    return;
                }
                await lib(p.lib);
                let L = window[p.global];
                L.configure({ apiBase: SITE.apiBase || null, graphqlUrl: SITE.graphqlUrl || null });
                box.replaceChildren(host);
                widget = new L[p.cls](host, { ...themeAndLayout(st), linkTarget: "_blank", maxHeight: matchMedia("(max-width: 900px)").matches ? "360px" : maxHeight, ...p.opts });
            } catch {
                box.replaceChildren(el("div", { className: "wait" }, "Preview unavailable."));
            }
        };
        let io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); shown = true; draw(style); } }, { rootMargin: "300px" });
        io.observe(box);
        // Another layout or theme: the same widget draws itself again from the data it has (no new
        // request, no "loading…"), and the box eases from its old height to the new one.
        box.restyle = (st) => {
            style = st;
            if (!shown) return;
            if (!widget) return draw(st);
            let from = box.offsetHeight;
            box.style.height = from + "px";
            widget.update(themeAndLayout(st));
            box.style.height = "auto";
            let to = box.offsetHeight;
            if (Math.abs(to - from) < 2 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
            box.style.height = from + "px";
            box.getBoundingClientRect();
            box.style.transition = "height .22s ease";
            box.style.height = to + "px";
            let done = () => { box.style.transition = ""; box.style.height = ""; box.removeEventListener("transitionend", done); };
            box.addEventListener("transitionend", done);
            setTimeout(done, 400);
        };
        return box;
    }
    const themeAndLayout = (st) => ({ theme: !st.theme || st.theme === "site" ? THEME : st.theme, layout: st.layout || "list" });

    /** The configurator link with the chosen layout and theme. */
    const withStyle = (href, st) => {
        if (!href.startsWith("/team#")) return href;
        let settings = JSON.parse(decodeURIComponent(href.slice(6)));
        if (st.layout && st.layout !== "list") settings.layout = st.layout; else delete settings.layout;
        if (st.theme && st.theme !== "site") settings.theme = st.theme;
        return builder(settings);
    };

    /** Layout (and theme) buttons; onchange(style) after each click. */
    function switches(id, st, onchange, themes) {
        let wrap = el("div", { className: "switch" });
        let seg = (label, key, items) => {
            if (items.length < 2) return;
            let s = el("span", { className: "seg", role: "group", ariaLabel: label });
            for (let [v, text] of items) {
                let b = el("button", { type: "button", onclick: () => { st[key] = v; s.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); onchange(st); } }, text);
                b.setAttribute("aria-pressed", String(st[key] === v));
                s.append(b);
            }
            wrap.append(el("span", {}, label), s);
        };
        seg("Layout", "layout", PREVIEW[id].layouts);
        if (themes && id !== "pit-map") seg("Theme", "theme", THEMES);
        return wrap;
    }
    const firstLayout = (id) => (PREVIEW[id].layouts[0] || [null])[0];

    // The showcase: a preview with its layouts in every row (the row's text is in the page itself).
    document.querySelectorAll(".sc-row").forEach((row) => {
        let id = row.dataset.widget, st = { layout: firstLayout(id) }, go = row.querySelector(".sc-go"), href = go.getAttribute("href");
        let box = preview(id, row.querySelector(".pv"), st, "440px");
        go.href = withStyle(href, st);
        row.querySelector(".sc-switch").append(switches(id, st, (s2) => { box.restyle({ ...s2 }); go.href = withStyle(href, s2); }, false));
        row.querySelector(".sc-try").addEventListener("click", (e) => { e.preventDefault(); spotlight(id, st.layout); });
    });

    // The spotlight: pick a widget, try every layout and theme.
    const spot = $("spotlight");
    const rows = [...document.querySelectorAll(".sc-row")].map((r) => ({ id: r.dataset.widget, name: r.querySelector("h3").textContent, who: r.querySelector(".eyebrow").textContent, line: r.querySelector("p").textContent, href: r.querySelector(".sc-go").getAttribute("href"), tag: r.querySelector("code").textContent }));
    let pick = el("div", { className: "pick", role: "group", ariaLabel: "Widgets" }), show = el("div", { className: "show" });
    for (let [title, test] of [["For teams", (w) => /teams/i.test(w.who)], ["For events", (w) => w.who === "For events"], ["For leagues", (w) => w.who === "For leagues"]]) {
        pick.append(el("div", { className: "grp" }, title));
        rows.filter(test).forEach((w) => { let b = el("button", { type: "button", onclick: () => spotlight(w.id) }, w.name); b.dataset.id = w.id; pick.append(b); });
    }
    spot.append(pick, show);
    function spotlight(id, layout, scroll = true) {
        let w = rows.find((r) => r.id === id);
        pick.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === id)));
        let st = { layout: layout || firstLayout(id), theme: "site" }, go = el("a", { className: "go-link", href: withStyle(w.href, st) }, "Configure this widget →");
        let box = preview(id, el("div", { className: "pv" }), st, "560px");
        show.replaceChildren(el("div", {}, el("span", { className: "eyebrow" }, w.who), el("h3", {}, w.name)), el("p", {}, w.line),
            switches(id, st, (s2) => { box.restyle({ ...s2 }); go.href = withStyle(w.href, s2); }, true), box,
            el("div", { className: "foot" }, el("code", {}, w.tag), go));
        if (scroll) $("styles").scrollIntoView({ behavior: "smooth", block: "start" });
    }
    spotlight("event-rankings", null, false);

    // ---------------------------------------------------------------- make it yours
    // One live team card; every control redraws it with update() (no new request), and the code
    // shows the attributes for what was picked.
    const CZ = {
        accents: [["#ff5a1f", "Orange"], ["#2563eb", "Blue"], ["#16a34a", "Green"], ["#7c3aed", "Purple"], ["#e4002b", "Red"]],
        bases: [["site", "This site's"], ["light", "Light"], ["dark", "Dark"], ["ftcscout", "FTCScout"], ["trophy", "Trophy case"]],
        shapes: [["", "Default"], ["square", "Square"], ["bubbly", "Rounded"], ["compact", "Compact"], ["spacious", "Spacious"]],
        fonts: [["", "The theme's", null], ["plex", "IBM Plex", 'var(--sans)'], ["serif", "Serif", 'Georgia, "Times New Roman", serif'], ["mono", "Mono", 'var(--mono)']],
        locales: [["", "Visitor's"], ["en-US", "English (US)"], ["nl-NL", "Nederlands"], ["de-DE", "Deutsch"], ["fr-FR", "Français"]],
        parts: [["avatar", "Avatar"], ["location", "Location"], ["rookie", "Rookie year"], ["website", "Website"], ["next-event", "Next event"]],
    };
    const cz = { accent: "#ff5a1f", base: "site", shape: "", font: "plex", locale: "", hide: [] };
    const czPreview = $("cz-preview"), czCode = $("cz-code"), czControls = $("cz-controls");
    let czCard = null;
    const czOptions = () => {
        let font = CZ.fonts.find((f) => f[0] === cz.font)[2];
        let theme = cz.base === "site" ? { ...THEME, accent: cz.accent } : { base: cz.base, accent: cz.accent };
        if (font) theme.font = font;
        if (cz.shape) { delete theme.radius; delete theme.innerRadius; }   // the site's square corners would win over the shape
        return { theme, shape: cz.shape || null, locale: cz.locale || null, hide: cz.hide.length ? cz.hide.join(",") : null };
    };
    const czRender = () => {
        let o = czOptions();
        if (czCard) czCard.update(o);
        // the HTML element: this site's look is "auto" with the accent (its other colors are this site's own CSS variables)
        let theme = { base: cz.base === "site" ? "auto" : cz.base, accent: cz.accent };
        let font = CZ.fonts.find((f) => f[0] === cz.font);
        if (font[2]) theme.font = font[0] === "plex" ? '"IBM Plex Sans", sans-serif' : font[0] === "mono" ? '"IBM Plex Mono", monospace' : font[2];
        let attrs = [`team="${TEAM}"`, `theme='${JSON.stringify(theme)}'`];
        if (cz.shape) attrs.push(`shape="${cz.shape}"`);
        if (cz.locale) attrs.push(`locale="${cz.locale}"`);
        if (cz.hide.length) attrs.push(`hide="${cz.hide.join(",")}"`);
        czCode.textContent = `<script type="module" src="https://ftc-embeds.com/lib/team-card.mjs"></script>\n<ftc-team-card ${attrs.join(" ")}></ftc-team-card>`;
    };
    const czSeg = (label, key, items) => {
        let s = el("span", { className: "seg", role: "group", ariaLabel: label });
        for (let [v, text] of items) {
            let b = el("button", { type: "button", onclick: () => { cz[key] = v; s.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); czRender(); } }, text);
            b.setAttribute("aria-pressed", String(cz[key] === v));
            s.append(b);
        }
        return el("div", { className: "q" }, el("span", {}, label), s);
    };
    if (czPreview) {
        let swatches = el("div", { className: "cz-swatches", role: "group", ariaLabel: "Accent color" });
        let picker = el("input", { type: "color", value: cz.accent, ariaLabel: "Any color" });
        let pressAccent = () => swatches.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.color === cz.accent)));
        for (let [c, name] of CZ.accents) {
            let b = el("button", { type: "button", title: name, ariaLabel: name, style: `background:${c}`, onclick: () => { cz.accent = c; picker.value = c; pressAccent(); czRender(); } });
            b.dataset.color = c; swatches.append(b);
        }
        picker.addEventListener("input", () => { cz.accent = picker.value; pressAccent(); czRender(); });
        swatches.append(el("label", {}, picker, "any color"));
        pressAccent();
        let checks = el("div", { className: "cz-checks" });
        for (let [part, label] of CZ.parts) {
            let cb = el("input", { type: "checkbox", checked: true });
            cb.addEventListener("change", () => { cz.hide = CZ.parts.map((x) => x[0]).filter((x) => (x === part ? !cb.checked : cz.hide.includes(x))); czRender(); });
            checks.append(el("label", {}, cb, label));
        }
        czControls.append(
            el("div", { className: "q" }, el("span", {}, "Accent color"), swatches),
            czSeg("Colors", "base", CZ.bases),
            czSeg("Shape and corners", "shape", CZ.shapes),
            czSeg("Font", "font", CZ.fonts.map(([v, l]) => [v, l])),
            czSeg("Dates and numbers", "locale", CZ.locales),
            el("div", { className: "q" }, el("span", {}, "Show"), checks));
        let io = new IntersectionObserver((es) => {
            if (!es.some((e) => e.isIntersecting)) return;
            io.disconnect();
            czCard = new FtcTeamCard.TeamCard(czPreview, { team: TEAM, season: SITE.demoSeason || null, stats: "opr,record,awards-total", upcoming: 1, linkTarget: "_blank", ...czOptions() });
        }, { rootMargin: "300px" });
        io.observe(czPreview);
        czRender();
    }
})();
