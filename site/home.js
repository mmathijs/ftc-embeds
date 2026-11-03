// Homepage: one live team card, the team and event widgets as lists, and a live pit map.
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
})();
