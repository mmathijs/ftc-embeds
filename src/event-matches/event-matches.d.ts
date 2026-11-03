// Types for ftc-embeds/event-matches. Shared types: ../core/team-widgets.d.ts

import type { TeamWidget, EventWidgetOptions, ApiOptions, EventInfo } from "../core/team-widgets";
export type { TeamWidgetOptions, EventWidgetOptions, EventInfo, TeamThemeName, TeamTheme, TeamThemeOption, IconName, ApiOptions, EmbedsConfig } from "../core/team-widgets";
export { configure, EmbedsApiError, TEAM_THEMES, TEAM_THEME_MODES, TEAM_SHAPES, TEAM_THEME_SHAPES, ICONS, TEAM_TEXT, seasonOf, DEFAULT_API_BASE, parseEventCode } from "../core/team-widgets";

export interface EventMatch {
    id: number;
    description: string;
    hasBeenPlayed: boolean;
    scheduledStartTime: string | null;
    actualStartTime: string | null;
    tournamentLevel: "Quals" | "RoundRobin" | "Semis" | "Finals" | "DoubleElim";
    series: number;
    matchNum: number;
    scores: { red: { totalPoints: number }; blue: { totalPoints: number } } | null;
    teams: { teamNumber: number; alliance: "Red" | "Blue"; station: string; surrogate: boolean; noShow: boolean; dq: boolean; team: { name: string } | null }[];
}

export interface EventMatchesData extends EventInfo {
    matches: EventMatch[];
}

export declare const EVENT_MATCHES_QUERY: string;
export declare function getEventMatches(event: string, options?: ApiOptions): Promise<EventMatchesData>;

/** The matches to show in play order, and the next one (the first unplayed one while the event is on). */
export declare function matchRows(event: EventMatchesData, filter?: { level?: "all" | "quals" | "playoffs"; state?: "all" | "upcoming" | "played"; team?: number | null }): { rows: EventMatch[]; next: EventMatch | null };

export interface EventMatchesOptions extends EventWidgetOptions {
    /** "all" (default) | "quals" | "playoffs" */
    level?: "all" | "quals" | "playoffs";
    /** "all" (default) | "upcoming" | "played" */
    state?: "all" | "upcoming" | "played";
}

/** An event's match schedule and results: times, alliances, scores; the next match marked while the event is on. `team` shows one team's matches. */
export declare class EventMatches extends TeamWidget<EventMatchesData, EventMatchesOptions> {}

/** Registers <ftc-event-matches> (done on import in browsers). Attributes: the shared ones plus level, state, highlight, refresh (team: one team's matches). */
export declare function defineEventMatchesElement(tagName?: string): void;
