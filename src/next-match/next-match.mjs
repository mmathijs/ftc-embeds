/*!
 * ftc-embeds/next-match: an FTC team's next match at the event it is at (time, alliances) and its
 * last result, refreshing itself during the event; otherwise its next event. From FTCScout. Zero
 * dependencies. License: MIT
 */
import { TeamWidget, defineTeamElement, h } from "../core/team-ui.mjs";
import { MATCH_CSS, MATCH_TROPHY, matchView, isLive } from "../core/team-views.mjs";
import { getTeamMatches } from "../core/team-api.mjs";
export { configure, EmbedsApiError, DEFAULT_API_BASE } from "../core/api.mjs";
export { getTeamMatches, seasonOf, TEAM_MATCHES_QUERY } from "../core/team-api.mjs";
export { TEAM_THEMES, ICONS } from "../core/team-ui.mjs";
export { TEAM_TEXT } from "../core/team-text.mjs";

export class NextMatch extends TeamWidget {
    static kind = "next-match";
    // layout: "list" (full) | "compact" (two lines); refresh: seconds between updates during an event
    static defaults = { layout: "list", refresh: 30 };
    static css = MATCH_CSS;
    static skins = { trophy: MATCH_TROPHY };

    fetch(api) {
        return getTeamMatches(this.options.team, api);
    }

    isLive(t) {
        return isLive(t);
    }

    view(t) {
        return h("div", null, this.heading(this.t("team", { team: t.number })), matchView(this, t, { now: this.now() }));
    }
}

/** Registers <ftc-next-match team="16236">. Extra attribute: refresh (seconds, default 30). */
export function defineNextMatchElement(tagName = "ftc-next-match") {
    defineTeamElement(tagName, NextMatch, { refresh: "refresh" });
}

if (typeof window !== "undefined" && typeof customElements !== "undefined") defineNextMatchElement();
