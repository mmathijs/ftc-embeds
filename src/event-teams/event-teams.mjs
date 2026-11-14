/*!
 * ftc-embeds/event-teams: the teams at an FTC event (also before it starts): number, name, place,
 * avatar and, once matches are played, rank and record, from FTCScout. Zero dependencies.
 * License: MIT
 */
import { TeamWidget, defineTeamElement, h, place, record } from "../core/team-ui.mjs";
import { EVENT_CSS, eventLine, highlighted, teamCell, scrollToMine } from "../core/event-views.mjs";
import { getEventTeams } from "../core/event-api.mjs";
export { configure, EmbedsApiError, DEFAULT_API_BASE } from "../core/api.mjs";
export { getEventTeams, parseEventCode, EVENT_TEAMS_QUERY } from "../core/event-api.mjs";
export { seasonOf } from "../core/team-api.mjs";
export { TEAM_THEMES, TEAM_THEME_MODES, TEAM_SHAPES, TEAM_THEME_SHAPES, ICONS } from "../core/team-ui.mjs";
export { TEAM_TEXT, TEAM_LANGUAGES, registerLanguage } from "../core/team-text.mjs";

/**
 * The teams in order: "number" (default), "name", or "rank" (ranked teams first, by rank; the rest
 * by number). "auto" is rank once there are ranks, else number.
 */
export function teamRows(ev, order = "auto") {
    let rows = [...(ev.teams || [])];
    let ranked = rows.some((t) => t.stats?.rank);
    let by = order === "auto" ? (ranked ? "rank" : "number") : order;
    let num = (a, b) => a.teamNumber - b.teamNumber;
    if (by === "name") return rows.sort((a, b) => (a.team?.name || "").localeCompare(b.team?.name || "") || num(a, b));
    if (by === "rank") return rows.sort((a, b) => (a.stats?.rank ?? Infinity) - (b.stats?.rank ?? Infinity) || num(a, b));
    return rows.sort(num);
}

/** A team without an avatar: its name's initials ("Casimir Tech" -> "CT"), like a profile picture. */
export function initials(name) {
    let words = String(name || "").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
    if (!words.length) return "#";
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
}

export class EventTeams extends TeamWidget {
    static kind = "event-teams";
    static subjects = ["event"];
    // layout: "grid" (tiles with avatars) | "list" (a table); order: "auto" | "number" | "name" | "rank"; highlight: teams to mark
    static defaults = { layout: "grid", order: "auto", highlight: null, refresh: 300 };
    static css = EVENT_CSS + `
.tgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(var(--ftcw-team-tile-width,200px),1fr));gap:var(--_gap)}
.tt{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:2px 10px;padding:8px 10px;background:var(--_surface);border-radius:var(--_inner-radius);min-width:0}
.tt.me{box-shadow:inset 0 0 0 2px var(--_accent)}
.tt .av{grid-row:span 3;width:var(--_avatar-size);height:var(--_avatar-size);border-radius:var(--_avatar-radius);object-fit:contain;image-rendering:pixelated;background:color-mix(in srgb,var(--_text) 6%,transparent)}
.tt .av.none{display:grid;place-items:center;font-weight:700;font-size:calc(var(--_avatar-size) * .34);letter-spacing:.02em;color:var(--_muted);background:color-mix(in srgb,var(--_accent) 12%,transparent)}
.tt .num{font-weight:700;line-height:1.2}
.tt .num .rk{font-weight:600;color:var(--_muted);margin-left:6px;font-size:var(--_small-size)}
.tt .nm{font-weight:550;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tt .pl{font-size:var(--_small-size);color:var(--_muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tt .chip{margin-left:6px;vertical-align:1px}
.chip.rookie{background:color-mix(in srgb,var(--_good) 14%,transparent);color:var(--_good)}
.tbl td.pl{color:var(--_muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:14em}
@container (max-width:480px){.tbl td.pl,.tbl th.pl{display:none}}`;

    fetch(api) {
        return getEventTeams(this.options.event, api);
    }

    isLive(ev) {
        return !!ev?.ongoing;
    }

    view(ev) {
        let rows = teamRows(ev, this.options.order || "auto");
        if (Number(this.options.limit)) rows = rows.slice(0, Number(this.options.limit));
        let count = this.shows("count") && ev.teams?.length ? h("span", { class: "muted small", part: "count" }, this.t("teamCount", { n: ev.teams.length })) : null;
        let body = !rows.length
            ? h("div", { class: "empty" }, this.t("noTeamsYet"))
            : this.layout === "list"
              ? this.table(ev, rows)
              : h("div", { class: "tgrid", part: "teams" }, rows.map((t) => this.tile(ev, t)));
        return h("div", null, this.heading(this.t("teams"), count), eventLine(this, { ...ev, teams: null }), body);
    }

    rookie(ev, t) {
        return t.team?.rookieYear === ev.season && this.shows("rookie") ? h("span", { class: "chip rookie", part: "chip-rookie" }, this.t("rookie")) : null;
    }

    tile(ev, t) {
        let mine = highlighted(this).has(t.teamNumber);
        let avatar = this.shows("avatar")
            ? t.team?.avatar
                ? h("img", { class: "av", part: "avatar", src: t.team.avatar, alt: "", loading: "lazy" })
                : h("span", { class: "av none", part: "avatar", "aria-hidden": "true" }, initials(t.team?.name))
            : null;
        return h("div", { class: `tt${mine ? " me" : ""}`, part: mine ? "team team-me" : "team" },
            avatar,
            h("div", { class: "num" }, this.teamLink(t.teamNumber, String(t.teamNumber)), t.stats?.rank && this.shows("rank") ? h("span", { class: "rk", part: "rank" }, `#${this.int(t.stats.rank)}`) : null, this.rookie(ev, t)),
            this.shows("names") ? h("div", { class: "nm", part: "name", title: t.team?.name || null }, t.team?.name || "") : null,
            this.shows("location") ? h("div", { class: "pl", part: "location" }, place(t.team?.location)) : null,
        );
    }

    table(ev, rows) {
        let mine = highlighted(this);
        let ranked = rows.some((t) => t.stats?.rank);
        let head = h("tr", null,
            ranked ? h("th", { class: "rk" }, this.t("colRank")) : null,
            h("th", null, this.t("colTeam")),
            this.shows("location") ? h("th", { class: "pl" }, "") : null,
            ranked ? h("th", { class: "n" }, this.t("colRecord")) : null,
        );
        let body = rows.map((t) =>
            h("tr", { class: mine.has(t.teamNumber) ? "me" : null, part: mine.has(t.teamNumber) ? "row row-me" : "row" },
                ranked ? h("td", { class: "rk", part: "rank" }, t.stats?.rank ? this.int(t.stats.rank) : "–") : null,
                teamCell(this, t.teamNumber, t.team?.name),
                this.shows("location") ? h("td", { class: "pl", part: "location" }, place(t.team?.location)) : null,
                ranked ? h("td", { class: "n", part: "record" }, record(t.stats) ?? "–") : null,
            ));
        return h("div", { class: "tbl-wrap" }, h("table", { class: "tbl", part: "table" }, h("thead", null, head), h("tbody", null, body)));
    }

    render() {
        super.render();
        if (this.options.maxHeight) requestAnimationFrame(() => scrollToMine(this, ["tr.me", ".tt.me"]));
    }
}

/** Registers <ftc-event-teams event="NLCMP" season="2025">. Extra attributes: order, highlight, refresh. */
export function defineEventTeamsElement(tagName = "ftc-event-teams") {
    defineTeamElement(tagName, EventTeams, { order: "order", highlight: "highlight", refresh: "refresh" });
}

if (typeof window !== "undefined" && typeof customElements !== "undefined") defineEventTeamsElement();
