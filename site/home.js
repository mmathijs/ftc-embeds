// Homepage: one live team card, the team widgets as a list, and a live pit map.
(() => {
    const SITE = window.FTC_EMBEDS_SITE || {};
    const TEAM = SITE.demoTeam || 19444;
    const $ = (id) => document.getElementById(id);
    const builder = (settings) => `/team#${encodeURIComponent(JSON.stringify(settings))}`;
    // The widgets in this site's own style: its colors (light and dark), font and square corners.
    // CSS variables reach into the widgets, so this follows the site's dark mode by itself.
    const THEME = {
        base: "auto", bg: "var(--field)", surface: "var(--paper-2)", text: "var(--ink)", muted: "var(--ink-2)", border: "var(--rule)",
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
    ];
    for (let [name, text, settings] of WIDGETS) {
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
        $("team-widgets").append(li);
    }

    // The pit map: the example event, with the demo team's pit highlighted.
    fetch("examples/FPEEUR.json")
        .then((r) => r.json())
        .then((data) => new FtcPitMap.PitMap($("pit-map"), { data, theme: { base: "auto", background: "var(--field)" }, highlight: String(TEAM), controls: false, scrollZoom: false, pulse: false }))
        .catch(() => ($("pit-map").textContent = "Preview unavailable."));
})();
