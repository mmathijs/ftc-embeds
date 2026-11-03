/*!
 * ftc-embeds/league-standings: the standings of an FTC league (rank, average ranking points,
 * record), from any of its league meets or its tournament, from FTCScout. Zero dependencies.
 * License: MIT
 */
import { TeamWidget, defineTeamElement, h, record } from "../core/team-ui.mjs";
import { EVENT_CSS, highlighted, teamCell, stat, limitRows, scrollToMine } from "../core/event-views.mjs";
import { getEventLeague } from "../core/event-api.mjs";
export { configure, EmbedsApiError, DEFAULT_API_BASE } from "../core/api.mjs";
export { getEventLeague, parseEventCode, EVENT_LEAGUE_QUERY } from "../core/event-api.mjs";
export { seasonOf } from "../core/team-api.mjs";
export { TEAM_THEMES, TEAM_THEME_MODES, TEAM_SHAPES, TEAM_THEME_SHAPES, ICONS } from "../core/team-ui.mjs";
export { TEAM_TEXT } from "../core/team-text.mjs";

export class LeagueStandings extends TeamWidget {
    static kind = "league-standings";
    static subjects = ["event"];
    // event: any league meet or the league tournament of the league; highlight: team numbers to mark
    static defaults = { highlight: null, refresh: 60 };
    static css = EVENT_CSS + `
.lg-sub{margin:-6px 0 12px;font-size:var(--_small-size);color:var(--_muted)}
@container (max-width:340px){.tbl .c-record{display:none}}`;

    fetch(api) {
        return getEventLeague(this.options.event, api);
    }

    // League standings change when a meet is on.
    isLive(ev) {
        return !!ev?.ongoing;
    }

    view(ev) {
        let groups = ev.leagueRankings || [];
        if (!groups.length) return h("div", null, this.heading(this.t("leagueStandings")), h("div", { class: "empty" }, this.t("notALeagueEvent")));
        return h("div", null, groups.map((g) => this.group(ev, g)));
    }

    group(ev, g) {
        let rows = [...g.teams].filter((t) => t.stats?.rank).sort((a, b) => a.stats.rank - b.stats.rank);
        let sub = [
            this.shows("region") && g.league.regionCode ? this.t("leagueRegion", { region: g.league.regionCode }) : null,
            this.shows("parent") && g.league.parentLeagueName ? this.t("leagueParent", { league: g.league.parentLeagueName }) : null,
        ].filter(Boolean);
        return h("div", { part: "league" },
            // "Hungarian" -> "Hungarian League"; "NorCal FTC Peninsula League" stays.
            this.heading(/\b(league|tournament)\b/i.test(g.league.name) ? g.league.name : this.t("leagueTitle", { league: g.league.name })),
            sub.length ? h("div", { class: "lg-sub", part: "league-info" }, sub.join(" · ")) : null,
            rows.length ? this.table(rows) : h("div", { class: "empty" }, this.t("noLeagueStandings")),
        );
    }

    table(rows) {
        let mine = highlighted(this);
        let shown = limitRows(rows, Number(this.options.limit) || null, (r) => mine.has(r.teamNumber));
        let head = h("tr", null,
            h("th", { class: "rk" }, this.t("colRank")),
            h("th", null, this.t("colTeam")),
            h("th", { class: "n" }, this.t("colAvgRp")),
            this.shows("record") ? h("th", { class: "n c-record" }, this.t("colRecord")) : null,
        );
        let body = shown.map((r) => r === null
            ? h("tr", { class: "gap" }, h("td", { colspan: "4" }, "⋯"))
            : h("tr", { class: mine.has(r.teamNumber) ? "me" : null, part: mine.has(r.teamNumber) ? "row row-me" : "row" },
                h("td", { class: "rk", part: "rank" }, this.int(r.stats.rank)),
                teamCell(this, r.teamNumber, r.team?.name),
                h("td", { class: "n", part: "col col-avg-rp" }, stat(this, r.avgRp)),
                this.shows("record") ? h("td", { class: "n c-record", part: "col col-record" }, record(r.stats) ?? "–") : null,
            ));
        return h("div", { class: "tbl-wrap" }, h("table", { class: "tbl", part: "table" }, h("thead", null, head), h("tbody", null, body)));
    }

    render() {
        super.render();
        if (this.options.maxHeight) requestAnimationFrame(() => scrollToMine(this));
    }
}

/** Registers <ftc-league-standings event="USNJNOLT2" season="2025"> (any event of the league). Extra attributes: highlight, refresh. */
export function defineLeagueStandingsElement(tagName = "ftc-league-standings") {
    defineTeamElement(tagName, LeagueStandings, { highlight: "highlight", refresh: "refresh" });
}

if (typeof window !== "undefined" && typeof customElements !== "undefined") defineLeagueStandingsElement();
