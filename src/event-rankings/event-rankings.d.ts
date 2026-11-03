// Types for ftc-embeds/event-rankings. Shared types: ../core/team-widgets.d.ts

import type { TeamWidget, EventWidgetOptions, ApiOptions, EventInfo, Location } from "../core/team-widgets";
export type { TeamWidgetOptions, EventWidgetOptions, EventInfo, TeamThemeName, TeamTheme, TeamThemeOption, IconName, ApiOptions, EmbedsConfig } from "../core/team-widgets";
export { configure, EmbedsApiError, TEAM_THEMES, TEAM_THEME_MODES, TEAM_SHAPES, TEAM_THEME_SHAPES, ICONS, TEAM_TEXT, seasonOf, DEFAULT_API_BASE, parseEventCode } from "../core/team-widgets";

/** A team's ranking columns (remote events have no record; 2019 no tb2). */
export interface RankStats {
    rank: number;
    rp: number;
    tb1: number;
    tb2?: number;
    wins?: number;
    losses?: number;
    ties?: number;
    dqs?: number;
    qualMatchesPlayed: number;
    opr: { totalPointsNp: number } | null;
}

export interface EventRankingsData extends EventInfo {
    /** Team mode: the team whose event this is, and its ranked events this season. */
    forTeam?: number;
    teamEvents?: { code: string; name: string; start: string }[];
    /** The championship and its divisions. */
    relatedEvents: { code: string; name: string; divisionCode: string | null }[];
    teams: { teamNumber: number; team: { name: string; location: Location } | null; stats: RankStats | null }[];
}

export declare const EVENT_RANKINGS_QUERY: string;
export declare function getEventRankings(event: string, options?: ApiOptions): Promise<EventRankingsData>;

/** For a team's season results: the event whose rankings to show (the one it's at, or its latest), or null. */
export declare function teamRankingsEvent(results: { events: { event: { code: string; start: string; ongoing: boolean }; stats: { rank: number } | null }[] }): string | null;
export { getTeamResults } from "../team-results/team-results";

export interface EventRankingsOptions extends EventWidgetOptions {
    /** Which columns, in order: "rp,record,matches,opr" (default); any of rp, tb1, tb2, record, matches, opr. */
    columns?: string | string[];
    /** Team mode: "tabs" for a tab per event the team was ranked at this season (newest first). */
    events?: "tabs" | null;
}

/** A team's ranked events this season, newest first. */
export declare function teamRankedEvents(results: { events: { event: { code: string; name: string; start: string }; stats: { rank: number } | null }[] }): { code: string; name: string; start: string }[];

/** An event's rankings (rank, RP, record, matches, OPR), refreshing while the event is on; championships switch between their divisions. With `team` instead of `event`: the rankings of the event the team is at, or else its latest, with the team marked. */
export declare class EventRankings extends TeamWidget<EventRankingsData, EventRankingsOptions> {}

/** Registers <ftc-event-rankings> (done on import in browsers). Attributes: the shared ones plus columns, highlight, refresh. */
export declare function defineEventRankingsElement(tagName?: string): void;
