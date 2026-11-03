// Types for ftc-embeds/team-season. Shared types: ../core/team-widgets.d.ts

import type { TeamWidget, TeamWidgetOptions, ApiOptions, EventSummary, EventRecord, Award, Location } from "../core/team-widgets";
export type { TeamWidgetOptions, TeamThemeName, TeamTheme, TeamThemeOption, IconName, ApiOptions, EmbedsConfig } from "../core/team-widgets";
export { configure, EmbedsApiError, TEAM_THEMES, TEAM_THEME_MODES, ICONS, TEAM_TEXT, seasonOf, DEFAULT_API_BASE } from "../core/team-widgets";

import type { TeamResultsData } from "../team-results/team-results";
import type { TeamMatchesData } from "../next-match/next-match";

export interface TeamSeasonData {
    results: TeamResultsData;
    matches: TeamMatchesData;
}

export { getTeamResults, TEAM_RESULTS_QUERY } from "../team-results/team-results";
export { getTeamMatches, TEAM_MATCHES_QUERY } from "../next-match/next-match";

export interface TeamSeasonOptions extends TeamWidgetOptions {
    /** "list" (default) | "strip" (results as tiles; the live part compact) */
    layout?: "list" | "strip" | "compact" | null;
    /** The live part's layout: "list" | "compact" (default: compact with layout "strip"). */
    liveLayout?: "list" | "compact" | null;
    /** Seconds between refreshes during an event (default 30). */
    refresh?: number;
    order?: "newest" | "oldest";
    skipTypes?: string | string[] | null;
}

/** team-results and next-match in one: during an event the next match and last result on top, the season's results below; otherwise the next event and the results. */
export declare class TeamSeason extends TeamWidget<TeamSeasonData, TeamSeasonOptions> {}

/** Registers <ftc-team-season> (done on import in browsers). Attributes: the shared ones plus live-layout, refresh, order, skip-types. */
export declare function defineTeamSeasonElement(tagName?: string): void;
