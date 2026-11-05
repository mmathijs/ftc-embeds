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
        card.on("load", ({ data }) => ($("example-cap").textContent = `<ftc-team-card team="${data.card.number}">, live`));
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
})();
