/*!
 * ftc-embeds/event-matches: an FTC event's match schedule and results, with the next match marked,
 * refreshing itself while the event is on, from FTCScout. Zero dependencies. License: MIT
 */
import { TeamWidget, defineTeamElement, h } from "../core/team-ui.mjs";
import { EVENT_CSS, eventLine, highlighted, scrollToMine } from "../core/event-views.mjs";
import { chip } from "../core/team-views.mjs";
import { getEventMatches } from "../core/event-api.mjs";
export { configure, EmbedsApiError, DEFAULT_API_BASE } from "../core/api.mjs";
export { getEventMatches, parseEventCode, EVENT_MATCHES_QUERY } from "../core/event-api.mjs";
export { seasonOf } from "../core/team-api.mjs";
export { TEAM_THEMES, TEAM_THEME_MODES, TEAM_SHAPES, TEAM_THEME_SHAPES, ICONS } from "../core/team-ui.mjs";
export { TEAM_TEXT } from "../core/team-text.mjs";

const LEVELS = { Quals: 0, RoundRobin: 1, DoubleElim: 2, Semis: 3, Finals: 4 };

/**
 * The matches to show, in play order: filtered by level ("all" | "quals" | "playoffs"), state
 * ("all" | "upcoming" | "played") and team, and which one is next (the first unplayed one, the
 * team's own with a team, while the event is on).
 */
export function matchRows(ev, { level = "all", state = "all", team = null } = {}) {
    let time = (m) => m.scheduledStartTime || m.actualStartTime || "";
    let all = [...(ev.matches || [])].sort((a, b) =>
        (LEVELS[a.tournamentLevel] ?? 9) - (LEVELS[b.tournamentLevel] ?? 9) || time(a).localeCompare(time(b)) || a.series - b.series || a.matchNum - b.matchNum || a.id - b.id);
    let mine = (m) => team == null || m.teams.some((t) => t.teamNumber === team);
    // The next match on the field, or with a team, that team's next match.
    let next = ev.ongoing ? all.find((m) => !m.hasBeenPlayed && mine(m)) ?? null : null;
    let rows = all.filter((m) =>
        (level === "all" || (level === "quals") === (m.tournamentLevel === "Quals")) &&
        (state === "all" || (state === "played") === m.hasBeenPlayed) &&
        (team == null || m.teams.some((t) => t.teamNumber === team)));
    return { rows, next };
}

export class EventMatches extends TeamWidget {
    static kind = "event-matches";
    static subjects = ["event"];
    // team: only that team's matches (and marked); level: "all" | "quals" | "playoffs";
    // state: "all" | "upcoming" | "played"; highlight: team numbers to mark
    // names: team names under the numbers
    static defaults = { level: "all", state: "all", highlight: null, names: false, refresh: 30 };
    static css = EVENT_CSS + `
.tbl .md{font-weight:650;white-space:nowrap}
.tbl .tt{white-space:nowrap;color:var(--_muted);font-size:var(--_small-size)}
.tbl .al{white-space:nowrap}
.tbl .al.red{text-align:right}
.tbl .al .tn{display:inline-block;margin:0 3px}
.tbl .al .tn.me{font-weight:750;text-decoration:underline;text-underline-offset:2px}
.tbl .al .tn.out{text-decoration:line-through;color:var(--_muted)}
.tbl .sc{white-space:nowrap;font-variant-numeric:tabular-nums}
.tbl .sc .scg{display:inline-grid;grid-template-columns:2.4em auto 2.4em;gap:4px;align-items:baseline}
.tbl .sc .r{text-align:right}
.tbl .sc .b{text-align:left}
.tbl th.sc{text-align:center}
.tbl .sc .win{font-weight:750}
.tbl .sc .r{color:var(--_red)}
.tbl .sc .b{color:var(--_blue)}
.tbl tr.played .md{color:var(--_muted)}
.tbl tr.nextm td{background:color-mix(in srgb,var(--_accent) 10%,transparent);border-top:2px solid var(--_accent)}
.tbl tr.nextm + tr td{border-top-color:var(--_accent)}
.tbl .al .tn .tnm{display:block;font-size:calc(var(--_small-size) - 1px);color:var(--_muted);font-weight:400;text-decoration:none;max-width:12em;overflow:hidden;text-overflow:ellipsis}
.tbl tr.day td{border-top:0;padding-top:12px;font-size:calc(var(--_small-size) - .5px);font-weight:600;color:var(--_muted);text-transform:var(--_label-transform);letter-spacing:var(--_label-letter-spacing)}
.tbl .chip{margin-left:6px;vertical-align:1px}
@container (max-width:440px){.tbl .tt{display:none}}
@container (max-width:380px){.tbl .al .tn{display:block;margin:1px 0}.tbl .md .chip{display:none}.tbl .al .tn .tnm{display:none}}`;

    fetch(api) {
        return getEventMatches(this.options.event, api);
    }

    isLive(ev) {
        return !!ev?.ongoing;
    }

    teamFilter() {
        let n = Number(this.options.team);
        return Number.isInteger(n) && n > 0 ? n : null;
    }

    view(ev) {
        let team = this.teamFilter();
        let { rows, next } = matchRows(ev, { level: this.options.level, state: this.options.state, team });
        let limit = Number(this.options.limit) || null;
        if (limit) rows = rows.slice(0, limit);
        let title = team ? this.t("teamMatches", { team }) : this.t("matches");
        let body = rows.length ? this.table(ev, rows, next, team) : h("div", { class: "empty" }, this.t(ev.matches?.length ? "noMatchesShown" : "noScheduleYet"));
        return h("div", null, this.heading(title), eventLine(this, ev), body);
    }

    table(ev, rows, next, team) {
        let mine = highlighted(this);
        if (team) mine.add(team);
        // Times and days in the timeZone option, or else the event's own time zone.
        let tz = this.options.timeZone || ev.timezone || undefined;
        // Day headers in the dateFormat (iso: 2026-02-07, numeric: Sat 2/7, long: Saturday, February 7).
        let fmt = this.options.dateFormat;
        let dayOpts = fmt === "long" ? { weekday: "long", month: "long", day: "numeric" } : fmt === "numeric" ? { weekday: "short", month: "numeric", day: "numeric" } : { weekday: "short", month: "short", day: "numeric" };
        let dayOf = (iso) => {
            if (!iso) return "";
            if (fmt === "iso") return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
            return new Date(iso).toLocaleDateString(this.locale, { ...dayOpts, timeZone: tz });
        };
        let days = new Set(rows.map((m) => dayOf(m.scheduledStartTime || m.actualStartTime)).filter(Boolean));
        let showDays = days.size > 1 && this.shows("days");
        let out = [];
        let lastDay = null;
        for (let m of rows) {
            let day = dayOf(m.scheduledStartTime || m.actualStartTime);
            if (showDays && day && day !== lastDay) out.push(h("tr", { class: "day", part: "day" }, h("td", { colspan: "5" }, day)));
            lastDay = day;
            out.push(this.row(m, next, mine, tz));
        }
        let head = h("tr", null,
            h("th", null, this.t("colMatch")),
            this.shows("time") ? h("th", { class: "tt" }, this.t("colTime")) : null,
            h("th", { class: "al red" }, this.t("red")),
            h("th", { class: "sc" }, this.t("colScore")),
            h("th", { class: "al blue" }, this.t("blue")),
        );
        return h("div", { class: "tbl-wrap" }, h("table", { class: "tbl", part: "table" }, h("thead", null, head), h("tbody", null, out)));
    }

    row(m, next, mine, tz) {
        let isNext = next && m.id === next.id;
        let has = m.teams.some((t) => mine.has(t.teamNumber));
        let when = m.hasBeenPlayed ? m.actualStartTime || m.scheduledStartTime : m.scheduledStartTime;
        let time = when ? this.time(when, tz) : "";
        let s = m.scores;
        let red = s?.red?.totalPoints, blue = s?.blue?.totalPoints;
        let score = m.hasBeenPlayed && s
            ? h("span", { class: "scg" }, h("span", { class: `s r${red > blue ? " win" : ""}` }, this.int(red)), h("span", { class: "muted" }, "–"), h("span", { class: `s b${blue > red ? " win" : ""}` }, this.int(blue)))
            : h("span", { class: "muted" }, "–");
        let cls = [m.hasBeenPlayed ? "played" : null, isNext ? "nextm" : null, has ? "me" : null].filter(Boolean).join(" ");
        return h("tr", { class: cls || null, part: ["row", isNext ? "row-next" : null, has ? "row-me" : null].filter(Boolean).join(" ") },
            h("td", { class: "md", part: "match" }, m.description, isNext ? chip("upcoming", this.t("nextUp")) : null),
            this.shows("time") ? h("td", { class: "tt", part: "time" }, time) : null,
            this.alliance(m, "Red", mine),
            h("td", { class: "sc", part: "score" }, score),
            this.alliance(m, "Blue", mine),
        );
    }

    alliance(m, color, mine) {
        let teams = m.teams.filter((t) => t.alliance === color).sort((a, b) => a.station.localeCompare(b.station));
        return h("td", { class: `al ${color.toLowerCase()}`, part: `alliance alliance-${color.toLowerCase()}` }, teams.map((t) =>
            h("span", { class: ["tn", mine.has(t.teamNumber) ? "me" : null, t.noShow || t.dq ? "out" : null].filter(Boolean).join(" "), title: t.team?.name || null },
                this.teamLink(t.teamNumber, String(t.teamNumber)), t.surrogate ? "*" : "",
                this.options.names && t.team?.name ? h("span", { class: "tnm", part: "name" }, t.team.name) : null)));
    }

    render() {
        super.render();
        if (this.options.maxHeight) requestAnimationFrame(() => scrollToMine(this, ["tr.nextm", "tr.me"]));
    }
}

/** Registers <ftc-event-matches event="NLCMP" season="2025">. Extra attributes: level, state, highlight, refresh (and team, to show one team's matches). */
export function defineEventMatchesElement(tagName = "ftc-event-matches") {
    defineTeamElement(tagName, EventMatches, { level: "level", state: "state", highlight: "highlight", names: "names", refresh: "refresh" });
}

if (typeof window !== "undefined" && typeof customElements !== "undefined") defineEventMatchesElement();
