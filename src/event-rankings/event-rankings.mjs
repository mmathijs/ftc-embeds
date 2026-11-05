/*!
 * ftc-embeds/event-rankings: an FTC event's rankings (rank, ranking points, record, matches, OPR),
 * refreshing itself while the event is on; or for a team, those of the event it is at (or its
 * latest), with the team marked. From FTCScout. Zero dependencies. License: MIT
 */
import { TeamWidget, defineTeamElement, h, record, strip } from "../core/team-ui.mjs";
import { EVENT_CSS, eventLine, highlighted, teamCell, stat, columnDigits, limitRows, scrollToMine } from "../core/event-views.mjs";
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
    // d: the column's decimals (columnDigits), so every row has the same number of them.
    rp: { label: "colRp", value: (w, s, d) => stat(w, s.rp, d), digits: (s) => s.rp },
    tb1: { label: "colTb1", value: (w, s, d) => stat(w, s.tb1, d), digits: (s) => s.tb1 },
    tb2: { label: "colTb2", value: (w, s, d) => stat(w, s.tb2, d), digits: (s) => s.tb2 },
    record: { label: "colRecord", value: (w, s) => record(s) ?? "–" },
    matches: { label: "colMatches", value: (w, s) => stat(w, s.qualMatchesPlayed, 0) },
    opr: { label: "colOpr", value: (w, s) => w.num(s.opr?.totalPointsNp) },
    epa: { label: "colEpa", value: (w, s) => w.num(s.epa) },
    // Share of matches won (ties count as played, not won).
    winrate: { label: "colWinRate", value: (w, s) => (s.wins == null || !(s.wins + s.losses + s.ties) ? "–" : `${w.num((100 * s.wins) / (s.wins + s.losses + s.ties), 0)}%`) },
    dqs: { label: "colDqs", value: (w, s) => stat(w, s.dqs, 0) },
};

// The layouts besides the table: a leaderboard (a card per team), a podium for the top three with
// the rest as a table, and a scrolling strip of tiles. (No CSS comments in RANK_CSS: see EVENT_CSS.)
const MEDALS = ["gold", "silver", "bronze"];
const RANK_CSS = `
.ftcw:not(.bare) .tbl-wrap.rk-wrap{margin:0}
.rk-cards{display:grid;gap:var(--_gap)}
.rk-card{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:6px 14px;padding:10px 14px;background:var(--_surface);border-radius:var(--_inner-radius)}
.density-compact .rk-card{padding:6px 10px;gap:4px 10px}
.rk-badge{display:grid;place-items:center;min-width:2.1em;height:2.1em;padding:0 .45em;border-radius:999px;background:var(--_bg);font-weight:800;font-size:calc(var(--_font-size) * 1.12);box-shadow:inset 0 0 0 1.5px var(--_border)}
.rk-gold .rk-badge{background:#f2c94c;color:#3b2a00;box-shadow:none}
.rk-silver .rk-badge{background:#cfd6de;color:#1f2933;box-shadow:none}
.rk-bronze .rk-badge{background:#d9a06f;color:#3a1d05;box-shadow:none}
.rk-team{min-width:0;display:flex;flex-direction:column;line-height:1.25}
.rk-team .num{font-weight:700;font-size:calc(var(--_font-size) * 1.06)}
.rk-team .nm{color:var(--_muted);font-size:var(--_small-size);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rk-stats{display:flex;gap:18px;margin:0}
.rk-stats div{display:flex;flex-direction:column;align-items:flex-end;min-width:2.4em}
.rk-stats dt{font-size:calc(var(--_small-size) - 1px);color:var(--_muted);text-transform:var(--_label-transform);letter-spacing:var(--_label-letter-spacing);font-weight:600;white-space:nowrap}
.rk-stats dd{margin:0;font-weight:var(--_value-weight);white-space:nowrap}
.rk-card.me{box-shadow:inset 0 0 0 2px var(--_accent);background:color-mix(in srgb,var(--_accent) 12%,var(--_surface))}
.rk-gap{text-align:center;color:var(--_muted);letter-spacing:.2em;line-height:1;padding:2px 0}
@container (max-width:520px){.rk-card{grid-template-columns:auto minmax(0,1fr)}.rk-card .rk-stats{grid-column:2 / -1;gap:4px 14px;flex-wrap:wrap}.rk-card .rk-stats div{align-items:flex-start}}
.ftcw[style*="max-height"] .rk-podwrap{display:flex;flex-direction:column;flex:1 1 auto;min-height:0}
.ftcw[style*="max-height"] .rk-podium{flex:none}
.rk-podium{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:end;gap:var(--_gap);margin:6px 0 16px}
.rk-step{display:flex;flex-direction:column;align-items:center;text-align:center;gap:3px;min-width:0}
.rk-step .rk-team{align-items:center;width:100%}
.rk-step .rk-team .nm{max-width:100%}
.rk-step .rk-val{font-size:var(--_small-size);color:var(--_muted);white-space:nowrap}
.rk-block{width:100%;border-radius:var(--_inner-radius) var(--_inner-radius) 0 0;display:grid;place-items:center;font-weight:850;font-size:calc(var(--_font-size) * 1.7);margin-top:6px}
.rk-gold .rk-block{height:96px;background:#f2c94c;color:#3b2a00}
.rk-silver .rk-block{height:70px;background:#cfd6de;color:#1f2933}
.rk-bronze .rk-block{height:52px;background:#d9a06f;color:#3a1d05}
.density-compact .rk-gold .rk-block{height:64px}
.density-compact .rk-silver .rk-block{height:48px}
.density-compact .rk-bronze .rk-block{height:36px}
.rk-step.me .rk-team .num{color:var(--_accent)}
.rk-step.me .rk-block{box-shadow:0 0 0 3px var(--_accent)}
.strip>.rk-tile{gap:8px;min-height:0}
.rk-tile .rk-top{display:flex;align-items:center;gap:8px;min-width:0}
.rk-tile .rk-badge{font-size:var(--_font-size)}
.rk-tile .rk-stats{flex-wrap:wrap;gap:6px 14px}
.rk-tile .rk-stats div{align-items:flex-start;min-width:0}
.strip>.rk-tile.me{box-shadow:inset 0 0 0 2px var(--_accent)}`;

/**
 * For a team (its season's results): the code of the event whose rankings to show, the one it is
 * at now, or else the most recent one it was ranked at; null when it hasn't been ranked yet.
 */
/** A team's ranked events this season, newest first: { code, name, start }. */
export function teamRankedEvents(t) {
    return (t?.events || [])
        .filter((e) => e.stats?.rank)
        .sort((a, b) => b.event.start.localeCompare(a.event.start) || a.event.code.localeCompare(b.event.code))
        .map((e) => ({ code: e.event.code, name: e.event.name, start: e.event.start }));
}

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
    // columns: "rp,record,matches,opr" (any of rp, tb1, tb2, record, winrate, matches, opr, epa, dqs);
    // highlight: team numbers to mark; refresh: seconds between updates while the event is on;
    // events: "tabs" (team mode) for a tab per event the team was ranked at this season;
    // layout: "list" (a table), "cards" (a leaderboard), "podium" (the top three, then a table), "strip" (tiles)
    static defaults = { columns: "rp,record,matches,opr", highlight: null, events: null, refresh: 30, layout: "list" };
    static css = EVENT_CSS + RANK_CSS;

    async fetch(api) {
        if (this.options.event) return getEventRankings(this.options.event, api);
        let t = await getTeamResults(this.options.team, api);
        let events = teamRankedEvents(t);
        // The event picked with the tabs (for this team and season), else the current or latest.
        let key = `${this.options.team}/${this.options.season ?? ""}`;
        let code = this._picked && this._pickedFor === key ? this._picked : teamRankingsEvent(t);
        if (!code) return { teamOnly: t.number, season: t.events[0]?.event.season ?? null };
        let season = t.events.find((e) => e.event.code === code)?.event.season ?? t.events[0]?.event.season;
        return { ...(await getEventRankings(code, { ...api, season })), forTeam: t.number, teamEvents: events };
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
        let body = null, arrows = null;
        if (rows.length) {
            let L = this.layout;
            if (L === "strip") ({ row: body, arrows } = this.tiles(rows));
            else body = L === "cards" ? this.cards(rows) : L === "podium" ? this.podium(rows) : this.table(rows);
        } else if (!tabs) body = h("div", { class: "empty" }, this.t(ev.started ? "noRankings" : "noRankingsYet"));
        return h("div", null, this.heading(this.t("rankings"), arrows), this.eventTabs(ev), eventLine(this, ev), hint, tabs, body);
    }

    /** Team mode with events="tabs": a tab per event the team was ranked at this season. */
    eventTabs(ev) {
        if (this.options.events !== "tabs" || !ev.teamEvents || ev.teamEvents.length < 2) return null;
        return h("div", { class: "tabs ev-tabs", part: "events" }, ev.teamEvents.map((e) =>
            h("button", { type: "button", part: "event-tab", "aria-pressed": String(e.code === ev.code), title: e.name, onclick: () => this.pick(e.code) }, `${e.name} · ${this.day(e.start)}`)));
    }

    /** Team mode: show another of the team's events (keeps the team's tabs and mark). */
    pick(code) {
        this._picked = code;
        this._pickedFor = `${this.options.team}/${this.options.season ?? ""}`;
        this.load();
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
            h("button", { type: "button", part: "division", "aria-pressed": String(d.code === ev.code), onclick: () => d.code !== ev.code && (ev.forTeam && !this.options.event ? this.pick(d.code) : this.update({ event: d.code, season: ev.season, highlight: [...this.marked()] })) }, label(d))));
    }

    /** The columns to show for these rows (remote events have no record), and their decimals. */
    colsFor(rows) {
        let cols = this.columns().filter((c) => !["record", "winrate", "dqs"].includes(c) || rows.some((r) => r.stats.wins != null));
        let digits = Object.fromEntries(cols.map((c) => [c, COLUMNS[c].digits ? columnDigits(rows.map((r) => COLUMNS[c].digits(r.stats))) : null]));
        return { cols, digits };
    }

    /** The rows to show: the top `limit`, and the marked teams below them after a gap (null). */
    shownRows(rows, limit = Number(this.options.limit) || null) {
        let mine = this.marked();
        return limitRows(rows, limit, (r) => mine.has(r.teamNumber));
    }

    /** A team's number (a link) and, unless hidden, its name, on two lines. */
    teamBlock(r) {
        let name = r.team?.name;
        return h("div", { class: "rk-team", part: "team", title: name ? `${r.teamNumber} ${name}` : null },
            h("span", { class: "num" }, this.teamLink(r.teamNumber, String(r.teamNumber))),
            name && this.shows("names") ? h("span", { class: "nm", part: "name" }, name) : null);
    }

    /** The chosen columns as labelled values. */
    statList(r, cols, digits) {
        return h("dl", { class: "rk-stats", part: "stats" }, cols.map((c) =>
            h("div", { part: `col col-${c}` }, h("dt", null, this.t(COLUMNS[c].label)), h("dd", null, COLUMNS[c].value(this, r.stats, digits[c])))));
    }

    medal(r) {
        return r.stats.rank <= 3 ? ` rk-${MEDALS[r.stats.rank - 1]}` : "";
    }

    /** layout "cards": a leaderboard, a card per team with a big rank (gold, silver, bronze for the top three). */
    cards(rows) {
        let mine = this.marked(), { cols, digits } = this.colsFor(rows);
        let cards = this.shownRows(rows).map((r) => r === null
            ? h("div", { class: "rk-gap" }, "⋯")
            : h("div", { class: `rk-card${this.medal(r)}${mine.has(r.teamNumber) ? " me" : ""}`, part: mine.has(r.teamNumber) ? "row row-me" : "row" },
                h("div", { class: "rk-badge", part: "rank" }, this.int(r.stats.rank)),
                this.teamBlock(r),
                this.statList(r, cols, digits)));
        return h("div", { class: "tbl-wrap rk-wrap" }, h("div", { class: "rk-cards", part: "table" }, cards));
    }

    /** layout "podium": the top three on a podium (2, 1, 3), then the others as a table. */
    podium(rows) {
        let mine = this.marked(), { cols, digits } = this.colsFor(rows), first = cols[0];
        let top = rows.slice(0, 3), order = [top[1], top[0], top[2]].filter(Boolean);
        let steps = order.map((r) => h("div", { class: `rk-step${this.medal(r)}${mine.has(r.teamNumber) ? " me" : ""}`, part: mine.has(r.teamNumber) ? "step step-me" : "step" },
            this.teamBlock(r),
            first ? h("div", { class: "rk-val", part: `col col-${first}` }, `${this.t(COLUMNS[first].label)} ${COLUMNS[first].value(this, r.stats, digits[first])}`) : null,
            h("div", { class: "rk-block", part: "rank" }, this.int(r.stats.rank))));
        let rest = rows.slice(3), limit = Number(this.options.limit) || null;
        // limit counts the podium: limit 8 is the top three and five more (and the marked teams further down)
        let shown = !limit ? rest : limit > 3 ? this.shownRows(rest, limit - 3) : rest.filter((r) => mine.has(r.teamNumber));
        // with maxHeight the podium stays and the table under it scrolls (rk-podwrap is a column then)
        return h("div", { class: "rk-podwrap" },
            h("div", { class: "rk-podium", part: "podium" }, steps),
            shown.length ? this.table(rest, shown) : null);
    }

    /** layout "strip": a scrolling row of tiles, with arrows in the heading. */
    tiles(rows) {
        let mine = this.marked(), { cols, digits } = this.colsFor(rows);
        let tiles = this.shownRows(rows).filter(Boolean).map((r) => h("div", { class: `rk-tile${this.medal(r)}${mine.has(r.teamNumber) ? " me" : ""}`, part: mine.has(r.teamNumber) ? "tile tile-me" : "tile" },
            h("div", { class: "rk-top" }, h("div", { class: "rk-badge", part: "rank" }, this.int(r.stats.rank)), this.teamBlock(r)),
            this.statList(r, cols, digits)));
        return strip(tiles, this);
    }

    table(rows, shown = null) {
        let mine = this.marked();
        let { cols, digits } = this.colsFor(rows);
        shown = shown || this.shownRows(rows);
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
                cols.map((c) => h("td", { class: `n c-${c}`, part: `col col-${c}` }, COLUMNS[c].value(this, r.stats, digits[c]))),
            ));
        return h("div", { class: "tbl-wrap" }, h("table", { class: "tbl", part: "table" }, h("thead", null, head), h("tbody", null, body)));
    }

    render() {
        super.render();
        if (this.options.maxHeight) requestAnimationFrame(() => scrollToMine(this, ["tr.me", ".rk-card.me"]));
        if (this.layout === "strip") requestAnimationFrame(() => {      // the strip starts at the marked team
            let tile = this.root.querySelector(".rk-tile.me"), row = tile?.closest(".strip");
            if (row && tile.offsetLeft > row.clientWidth - tile.offsetWidth) row.scrollLeft = tile.offsetLeft - 12;
        });
    }
}

/** Registers <ftc-event-rankings event="NLCMP" season="2025"> (or team="19444": its current or latest event). Extra attributes: columns, highlight, refresh; layout: list, cards, podium or strip. */
export function defineEventRankingsElement(tagName = "ftc-event-rankings") {
    defineTeamElement(tagName, EventRankings, { columns: "columns", highlight: "highlight", events: "events", refresh: "refresh" });
}

if (typeof window !== "undefined" && typeof customElements !== "undefined") defineEventRankingsElement();
