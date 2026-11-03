// Types for ftc-embeds/next-match. Shared types: ../core/team-widgets.d.ts

import type { TeamWidget, TeamWidgetOptions, ApiOptions, EventSummary, EventRecord, Award, Location } from "../core/team-widgets";
export type { TeamWidgetOptions, TeamThemeName, TeamTheme, TeamThemeOption, IconName, ApiOptions, EmbedsConfig } from "../core/team-widgets";
export { configure, EmbedsApiError, TEAM_THEMES, ICONS, TEAM_TEXT, seasonOf } from "../core/team-widgets";

export interface TeamMatchesData {
    number: number;
    name: string;
    events: { event: EventSummary; stats: EventRecord | null }[];
    matches: {
        eventCode: string;
        alliance: "Red" | "Blue";
        station: string;
        surrogate: boolean;
        match: {
            id: number; description: string; hasBeenPlayed: boolean; scheduledStartTime: string | null; actualStartTime: string | null;
            tournamentLevel: string; series: number; matchNum: number;
            scores: { red: { totalPoints: number }; blue: { totalPoints: number } } | null;
            teams: { teamNumber: number; alliance: "Red" | "Blue"; station: string; team: { name: string } | null }[];
        };
    }[];
}

export declare const TEAM_MATCHES_QUERY: string;
export declare function getTeamMatches(team: number | string, options?: ApiOptions): Promise<TeamMatchesData>;

export interface NextMatchOptions extends TeamWidgetOptions {
    /** "list" (default) | "compact" (two lines) */
    layout?: "list" | "strip" | "compact" | null;
    /** Seconds between refreshes during an event (default 30). */
    refresh?: number;
}

/** During an event: the team's next match (time, countdown, both alliances) and its last result and rank, refreshing every 30 seconds. Otherwise: its next event with a countdown. */
export declare class NextMatch extends TeamWidget<TeamMatchesData, NextMatchOptions> {}

/** Registers <ftc-next-match> (done on import in browsers). Attributes: the shared ones plus refresh. */
export declare function defineNextMatchElement(tagName?: string): void;
