// Types for ftc-embeds/team-results. Shared types: ../core/team-widgets.d.ts

import type { TeamWidget, TeamWidgetOptions, ApiOptions, EventSummary, EventRecord, Award, Location } from "../core/team-widgets";
export type { TeamWidgetOptions, TeamThemeName, TeamTheme, TeamThemeOption, IconName, ApiOptions, EmbedsConfig } from "../core/team-widgets";
export { configure, EmbedsApiError, TEAM_THEMES, TEAM_THEME_MODES, TEAM_SHAPES, TEAM_THEME_SHAPES, ICONS, TEAM_TEXT, seasonOf, DEFAULT_API_BASE } from "../core/team-widgets";

export interface TeamResultsData {
    number: number;
    name: string;
    events: {
        event: EventSummary & { advancement: { teamNumber: number; advanced: boolean }[] };
        stats: EventRecord | null;
        awards: { type: string; placement: number; divisionName: string | null }[];
    }[];
}

export declare const TEAM_RESULTS_QUERY: string;
export declare function getTeamResults(team: number | string, options?: ApiOptions): Promise<TeamResultsData>;

export interface TeamResultsOptions extends TeamWidgetOptions {
    /** "list" (default) | "strip" (scrolling tiles, fixed height) */
    layout?: "list" | "strip" | "compact" | null;
    /** "newest" (default) | "oldest". */
    order?: "newest" | "oldest";
    /** Leave out event types: "Scrimmage,LeagueMeet". */
    skipTypes?: string | string[] | null;
}

/** A team's events in a season, newest first: dates, rank and record, awards, advancement; upcoming events with a countdown, live ones marked. */
export declare class TeamResults extends TeamWidget<TeamResultsData, TeamResultsOptions> {}

/** Registers <ftc-team-results> (done on import in browsers). Attributes: the shared ones plus order, skip-types. */
export declare function defineTeamResultsElement(tagName?: string): void;
