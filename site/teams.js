// Team pages: ftc-embeds.com/teams/16382 shows that team's card and its widgets live, each one a
// link into the setup with the team and widget already filled in. /teams alone is the team finder.
// The number comes from the path, so the page works the same with or without Caddy's template.
(() => {
    const SITE = window.FTC_EMBEDS_SITE || {};
    const $ = (id) => document.getElementById(id);
    const el = (tag, props = {}, ...kids) => {
        let e = Object.assign(document.createElement(tag), props);
        e.append(...kids.flat().filter((k) => k != null));
        return e;
    };
    const m = /^\/teams\/(\d{1,6})\/?$/.exec(location.pathname);
    const TEAM = m ? String(+m[1]) : null;
    // The site's own look, like the homepage previews (CSS variables, so it follows dark mode).
    const THEME = {
        base: "auto", bg: "var(--field)", surface: "color-mix(in srgb, var(--ink) 7%, var(--field))", text: "var(--ink)", muted: "var(--ink-2)", border: "var(--rule)",
        accent: "var(--accent)", accentText: "var(--accent-ink)", gold: "var(--accent)", radius: "2px", innerRadius: "2px", font: "var(--sans)", shadow: "none",
    };
    const setupUrl = (extra = {}, step = "widget") => `/setup?step=${step}#${encodeURIComponent(JSON.stringify({ kind: "team", team: TEAM, ...extra }))}`;
    const builderUrl = (extra = {}) => `/team#${encodeURIComponent(JSON.stringify({ widget: "team-card", team: TEAM, ...extra }))}`;

    // ------------------------------------------------------------ the number box

    const find = $("find");
    find.onsubmit = (e) => {
        e.preventDefault();
        let n = $("find-n").value.trim().replace(/^#/, "");
        if (!/^\d{1,6}$/.test(n)) {
            $("find-msg").textContent = "A team number is digits only, like 16382.";
            return;
        }
        location.href = `/teams/${+n}`;
    };
    $("find-n").oninput = () => ($("find-msg").textContent = "");

    if (!TEAM) {
        $("finder").hidden = false;
        $("finder").append(find);
        $("find-label").textContent = "Team number";
        $("find-label").className = "eyebrow";
        $("find-label").style.flexBasis = "100%";
        $("other").remove();
        $("find-n").focus();
        return;
    }

    // ------------------------------------------------------------ one team

    $("team-page").hidden = false;
    $("setup-link").href = setupUrl();
    $("options-link").href = builderUrl();

    const api = { apiBase: SITE.apiBase || null, graphqlUrl: SITE.graphqlUrl || null };
    let card;
    try {
        FtcTeamCard.configure(api);
        card = new FtcTeamCard.TeamCard($("card"), { team: +TEAM, theme: THEME, stats: "opr,epa,record,awards-total", upcoming: 1 });
    } catch {
        $("card").textContent = "Preview unavailable.";
    }
    // Early in a season there's little to show yet: until the team has played an event, the season
    // widgets preview last season (the setup still makes them show the current one).
    let ready;
    const lastSeason = new Promise((r) => (ready = r));
    if (!card) ready(null);
    card?.on("error", () => ready(null));
    card?.on("load", ({ data }) => {
        let c = data.card || {};
        let played = (c.events || []).some((e) => e.event?.started);
        ready(played ? null : (FtcTeamCard.seasonOf?.() ?? (new Date().getMonth() >= 8 ? new Date().getFullYear() : new Date().getFullYear() - 1)) - 1);
        let name = c.name ? `${c.number} ${c.name}` : `Team ${TEAM}`;
        $("name").textContent = name;
        $("gallery-h").textContent = `Widgets with ${c.name || `team ${TEAM}`}'s data`;
        let loc = c.location || {};
        let where = [loc.city, loc.state, loc.country].filter(Boolean).join(", ");
        $("where").textContent = [where, c.rookieYear ? `rookie year ${c.rookieYear}` : ""].filter(Boolean).join(" · ");
        document.title = `${name} · widgets for your team's website · ftc-embeds`;
        let d = document.querySelector('meta[name="description"]');
        if (d && c.name) d.content = `${c.name} (FTC team ${TEAM}${where ? `, ${where}` : ""}): results, awards, rankings and next match as free widgets for your team's website.`;
    });
    card?.on("error", ({ error }) => {
        if (!error?.notFound) return;
        // A number FTCScout doesn't know: say so, and keep it out of search results.
        $("team-page").hidden = true;
        $("missing").hidden = false;
        $("missing-h").textContent = `There's no team ${TEAM}`;
        $("find-label").textContent = "Try another number:";
        document.title = `No team ${TEAM} · ftc-embeds`;
        document.head.append(el("meta", { name: "robots", content: "noindex" }));
    });

    // The team widgets, each in its most visual layout; the link takes that layout into the setup.
    const WIDGETS = [
        { id: "team-results", global: "FtcTeamResults", cls: "TeamResults", name: "Season results", line: "Every event this season: rank, record, awards and advancement.", layout: "strip", seasonal: true },
        { id: "team-awards", global: "FtcTeamAwards", cls: "TeamAwards", name: "Awards", line: "Every award the team has won, from its first season on.", layout: "banners", wide: true, maxHeight: "460px" },
        { id: "next-match", global: "FtcNextMatch", cls: "NextMatch", name: "Next match", line: "While you compete: the next match, the alliances and a countdown.", layout: "list" },
        { id: "event-rankings", global: "FtcEventRankings", cls: "EventRankings", name: "Event rankings", line: "The rankings of the event you're at, or your latest, with you marked.", layout: "cards", seasonal: true },
        { id: "team-season", global: "FtcTeamSeason", cls: "TeamSeason", name: "Season + next match", line: "Season results, with the live next match on top while you compete.", layout: "list" },
        { id: "countdown", global: "FtcCountdown", cls: "Countdown", name: "Countdown", line: "Days, hours and minutes to your next event, or your next match.", layout: "list" },
    ];

    const MAX_HEIGHT = "400px";

    function preview(w, box) {
        box.append(el("div", { className: "wait" }, "loading…"));
        let start = async () => {
            let last = w.seasonal ? await lastSeason : null;
            box.textContent = "";
            let host = el("div");
            box.append(host);
            try {
                window[w.global].configure(api);
                // Every preview at most MAX_HEIGHT: a taller widget scrolls inside itself (like it
                // would with the max-height option on a website), a short one keeps its own height.
                new window[w.global][w.cls](host, { theme: THEME, bare: true, team: +TEAM, layout: w.layout, maxHeight: w.maxHeight || MAX_HEIGHT, ...w.opts, ...(last ? { season: last } : {}) });
                if (last) box.closest(".tile").querySelector("p").textContent += " Shown here: last season, until this season's first event.";
            } catch {
                box.textContent = "Preview unavailable.";
            }
        };
        if (!window.IntersectionObserver) return start();
        let io = new IntersectionObserver((es) => {
            if (es.some((e) => e.isIntersecting)) {
                io.disconnect();
                start();
            }
        }, { rootMargin: "200px" });
        io.observe(box);
    }

    for (let w of WIDGETS) {
        let box = el("div", { className: "pv" });
        let tile = el("a", { className: "tile", href: setupUrl({ widget: w.id, ...(w.layout != "list" ? { layout: w.layout } : {}) }, "look") },
            box,
            el("div", { className: "txt" }, el("h3", {}, w.name, el("i", {}, "Use this →")), el("p", {}, w.line)));
        // The preview can be scrolled, but a click anywhere on the tile goes to the setup, also
        // one on a link inside the widget.
        box.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            location.href = tile.href;
        }, true);
        if (w.wide) tile.classList.add("wide");
        (w.wide ? $("wide") : $("grid")).append(tile);
        preview(w, box);
    }
})();
