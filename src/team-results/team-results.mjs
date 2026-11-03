/*!
 * ftc-embeds/team-results: an FTC team's events in a season, with rank, record, awards and
 * advancement, from FTCScout. Zero dependencies. License: MIT
 */
import { TeamWidget, defineTeamElement, h } from "../core/team-ui.mjs";
import { RESULTS_CSS, RESULTS_TROPHY, resultsView, resultsTitle } from "../core/team-views.mjs";
import { getTeamResults } from "../core/team-api.mjs";
export { configure, EmbedsApiError } from "../core/api.mjs";
export { getTeamResults, seasonOf, TEAM_RESULTS_QUERY } from "../core/team-api.mjs";
export { TEAM_THEMES, ICONS } from "../core/team-ui.mjs";
export { TEAM_TEXT } from "../core/team-text.mjs";

export class TeamResults extends TeamWidget {
    static kind = "team-results";
    // layout: "list" | "strip"; order: "newest" | "oldest"; skipTypes: "Scrimmage,LeagueMeet"
    static defaults = { layout: "list", order: "newest", skipTypes: null };
    static css = RESULTS_CSS;
    static skins = { trophy: RESULTS_TROPHY };

    fetch(api) {
        return getTeamResults(this.options.team, api);
    }

    view(t) {
        let { body, arrows } = resultsView(this, t, { limit: Number(this.options.limit) || null, now: this.now() });
        let extra = arrows || (this.shows("team") ? this.teamLink(t.number, this.t("team", { team: t.number })) : null);
        return h("div", null, this.heading(resultsTitle(this, t), extra), body);
    }
}

/** Registers <ftc-team-results team="16236" season="2025">. Extra attributes: order, skip-types. */
export function defineTeamResultsElement(tagName = "ftc-team-results") {
    defineTeamElement(tagName, TeamResults, { order: "order", "skip-types": "skipTypes" });
}

if (typeof window !== "undefined" && typeof customElements !== "undefined") defineTeamResultsElement();
