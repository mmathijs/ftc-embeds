/*!
 * ftc-embeds/event-rankings: an FTC event's rankings (rank, ranking points, record, matches, OPR),
 * refreshing itself while the event is on; or for a team, those of the event it is at (or its
 * latest), with the team marked. From FTCScout. Zero dependencies. License: MIT
 */
import { TeamWidget, defineTeamElement, h, record } from "../core/team-ui.mjs";
import { EVENT_CSS, eventLine, highlighted, teamCell, stat, limitRows, scrollToMine } from "../core/event-views.mjs";
import { getEventRankings } from "../core/event-api.mjs";
import { getTeamResults } from "../core/team-api.mjs";
export { configure, EmbedsApiError, DEFAULT_API_BASE } from "../core/api.mjs";
export { getEventRankings, parseEventCode, EVENT_RANKINGS_QUERY } from "../core/event-api.mjs";
export { getTeamResults } from "../core/team-api.mjs";
export { seasonOf } from "../core/team-api.mjs";
export { TEAM_THEMES, TEAM_THEME_MODES, TEAM_SHAPES, TEAM_THEME_SHAPES, ICONS } from "../core/team-ui.mjs";
export { TEAM_TEXT } from "../core/team-text.mjs";

/** The columns, in order; `columns` picks and orders them (rank and team are always shown). */
const COLUMNS = {
    rp: { label: "colRp", value: (w, s) => stat(w, s.rp) },
    tb1: { label: "colTb1", value: (w, s) => stat(w, s.tb1) },
    tb2: { label: "colTb2", value: (w, s) => stat(w, s.tb2) },
    record: { label: "colRecord", value: (w, s) => record(s) ?? "–" },
    matches: { label: "colMatches", value: (w, s) => stat(w, s.qualMatchesPlayed) },
    opr: { label: "colOpr", value: (w, s) => w.num(s.opr?.totalPointsNp) },
};

/**
 * For a team (its season's results): the code of the event whose rankings to show, the one it is
 * at now, or else the most recent one it was ranked at; null when it hasn't been ranked yet.
 */
export function teamRankingsEvent(t) {
    let ranked = (t?.events || []).filter((e) => e.stats?.rank);
    let live = ranked.find((e) => e.event.ongoing);
    let latest = [...ranked].sort((a, b) => b.event.start.localeCompare(a.event.start))[0];
    return (live || latest)?.event.code ?? null;
}

export class EventRankings extends TeamWidget {
    static kind = "event-rankings";
    // An event, or a team: the rankings of the event it is at, or its latest.
    static subjects = ["event", "team"];
    // columns: "rp,record,matches,opr" (any of rp, tb1, tb2, record, matches, opr);
    // highlight: team numbers to mark; refresh: seconds between updates while the event is on
    static defaults = { columns: "rp,record,matches,opr", highlight: null, refresh: 30 };
    static css = EVENT_CSS;

    async fetch(api) {
        if (this.options.event) return getEventRankings(this.options.event, api);
        let t = await getTeamResults(this.options.team, api);
        let code = teamRankingsEvent(t);
        if (!code) return { teamOnly: t.number, season: t.events[0]?.event.season ?? null };
        let season = t.events.find((e) => e.event.code === code).event.season;
        return { ...(await getEventRankings(code, { ...api, season })), forTeam: t.number };
    }

    /** The teams to mark: `highlight`, and in team mode the team itself. */
    marked() {
        let mine = highlighted(this);
        if (this.data?.forTeam) mine.add(this.data.forTeam);
        return mine;
    }

    isLive(ev) {
        return !!ev?.ongoing;
    }

    columns() {
        let list = Array.isArray(this.options.columns) ? this.options.columns : String(this.options.columns || "").split(/[\s,]+/);
        return list.filter((c) => COLUMNS[c]);
    }

    view(ev) {
        if (ev.teamOnly) return h("div", null, this.heading(this.t("rankings")), h("div", { class: "empty" }, this.t("teamNotRankedYet", { team: ev.teamOnly })));
        let rows = ev.teams.filter((t) => t.stats?.rank).sort((a, b) => a.stats.rank - b.stats.rank);
        let tabs = this.divisionTabs(ev);
        let hint = !rows.length && tabs ? h("div", { class: "muted", style: { marginBottom: "8px" } }, this.t("rankedPerDivision")) : null;
        let body = rows.length ? this.table(rows) : tabs ? null : h("div", { class: "empty" }, this.t(ev.started ? "noRankings" : "noRankingsYet"));
        return h("div", null, this.heading(this.t("rankings")), eventLine(this, ev), hint, tabs, body);
    }

    /** A championship ranks its teams per division: buttons to switch between them. */
    divisionTabs(ev) {
        if (!this.shows("divisions")) return null;
        let parent = ev.divisionCode || ev.code;
        let parentName = ev.divisionCode ? (ev.relatedEvents || []).find((e) => e.code === parent)?.name ?? "" : ev.name;
        let divisions = [...(ev.divisionCode ? [ev] : []), ...(ev.relatedEvents || []).filter((e) => e.divisionCode === parent)]
            .sort((a, b) => a.code.localeCompare(b.code));
        if (!divisions.length) return null;
        let label = (d) => d.name.replace(parentName, "").replace(/^\s*[-–:]\s*/, "") || d.name;
        return h("div", { class: "tabs", part: "divisions" }, divisions.map((d) =>
            h("button", { type: "button", part: "division", "aria-pressed": String(d.code === ev.code), onclick: () => d.code !== ev.code && this.update({ event: d.code, season: ev.season, highlight: [...this.marked()] }) }, label(d))));
    }

    table(rows) {
        let mine = this.marked();
        // Remote events have no record.
        let cols = this.columns().filter((c) => c !== "record" || rows.some((r) => r.stats.wins != null));
        let shown = limitRows(rows, Number(this.options.limit) || null, (r) => mine.has(r.teamNumber));
        let head = h("tr", null,
            h("th", { class: "rk" }, this.t("colRank")),
            h("th", null, this.t("colTeam")),
            cols.map((c) => h("th", { class: `n c-${c}` }, this.t(COLUMNS[c].label))),
        );
        let body = shown.map((r) => r === null
            ? h("tr", { class: "gap" }, h("td", { colspan: String(cols.length + 2) }, "⋯"))
            : h("tr", { class: mine.has(r.teamNumber) ? "me" : null, part: mine.has(r.teamNumber) ? "row row-me" : "row" },
                h("td", { class: "rk", part: "rank" }, this.int(r.stats.rank)),
                teamCell(this, r.teamNumber, r.team?.name),
                cols.map((c) => h("td", { class: `n c-${c}`, part: `col col-${c}` }, COLUMNS[c].value(this, r.stats))),
            ));
        return h("div", { class: "tbl-wrap" }, h("table", { class: "tbl", part: "table" }, h("thead", null, head), h("tbody", null, body)));
    }

    render() {
        super.render();
        if (this.options.maxHeight) requestAnimationFrame(() => scrollToMine(this));
    }
}

/** Registers <ftc-event-rankings event="NLCMP" season="2025"> (or team="19444": its current or latest event). Extra attributes: columns, highlight, refresh. */
export function defineEventRankingsElement(tagName = "ftc-event-rankings") {
    defineTeamElement(tagName, EventRankings, { columns: "columns", highlight: "highlight", refresh: "refresh" });
}

if (typeof window !== "undefined" && typeof customElements !== "undefined") defineEventRankingsElement();
