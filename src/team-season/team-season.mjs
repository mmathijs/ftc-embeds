/*!
 * ftc-embeds/team-season: an FTC team's season results with, during an event, its next match and
 * last result on top (team-results and next-match in one). From FTCScout. Zero dependencies.
 * License: MIT
 */
import { TeamWidget, defineTeamElement, h } from "../core/team-ui.mjs";
import { RESULTS_CSS, MATCH_CSS, RESULTS_TROPHY, MATCH_TROPHY, resultsView, resultsTitle, matchView, isLive } from "../core/team-views.mjs";
import { getTeamResults, getTeamMatches } from "../core/team-api.mjs";
export { configure, EmbedsApiError, DEFAULT_API_BASE } from "../core/api.mjs";
export { getTeamResults, getTeamMatches, seasonOf, TEAM_RESULTS_QUERY, TEAM_MATCHES_QUERY } from "../core/team-api.mjs";
export { TEAM_THEMES, TEAM_THEME_MODES, ICONS } from "../core/team-ui.mjs";
export { TEAM_TEXT } from "../core/team-text.mjs";

export class TeamSeason extends TeamWidget {
    static kind = "team-season";
    // layout: "list" | "strip" (results) — the live part is compact in "strip";
    // liveLayout: "list" | "compact" overrides that; plus team-results' order and skipTypes
    static defaults = { layout: "list", liveLayout: null, refresh: 30, order: "newest", skipTypes: null };
    static css = RESULTS_CSS + MATCH_CSS + `.now{margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--_border)}`;
    static skins = { trophy: RESULTS_TROPHY + MATCH_TROPHY };

    async fetch(api) {
        let [results, matches] = await Promise.all([getTeamResults(this.options.team, api), getTeamMatches(this.options.team, api)]);
        return { results, matches };
    }

    isLive(d) {
        return isLive(d.matches);
    }

    view({ results, matches }) {
        // matchView reads the layout from the widget: give it the live part's own.
        let liveLayout = this.options.liveLayout || (this.layout === "strip" ? "compact" : "list");
        let live = this.shows("live") ? matchView(Object.create(this, { layout: { value: liveLayout } }), matches, { now: this.now(), quiet: true }) : null;
        let { body, arrows } = resultsView(this, results, { limit: Number(this.options.limit) || null, now: this.now() });
        let extra = arrows || (this.shows("team") ? this.teamLink(results.number, this.t("team", { team: results.number })) : null);
        return h("div", null, this.heading(resultsTitle(this, results), extra), live ? h("div", { class: "now", part: "live" }, live) : null, body);
    }
}

/** Registers <ftc-team-season team="16236">. Extra attributes: live-layout, refresh, order, skip-types. */
export function defineTeamSeasonElement(tagName = "ftc-team-season") {
    defineTeamElement(tagName, TeamSeason, { "live-layout": "liveLayout", refresh: "refresh", order: "order", "skip-types": "skipTypes" });
}

if (typeof window !== "undefined" && typeof customElements !== "undefined") defineTeamSeasonElement();
