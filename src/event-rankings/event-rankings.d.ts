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
    /** The championship and its divisions. */
    relatedEvents: { code: string; name: string; divisionCode: string | null }[];
    teams: { teamNumber: number; team: { name: string; location: Location } | null; stats: RankStats | null }[];
}

export declare const EVENT_RANKINGS_QUERY: string;
export declare function getEventRankings(event: string, options?: ApiOptions): Promise<EventRankingsData>;

export interface EventRankingsOptions extends EventWidgetOptions {
    /** Which columns, in order: "rp,record,matches,opr" (default); any of rp, tb1, tb2, record, matches, opr. */
    columns?: string | string[];
}

/** An event's rankings (rank, RP, record, matches, OPR), refreshing while the event is on; championships switch between their divisions. */
export declare class EventRankings extends TeamWidget<EventRankingsData, EventRankingsOptions> {}

/** Registers <ftc-event-rankings> (done on import in browsers). Attributes: the shared ones plus columns, highlight, refresh. */
export declare function defineEventRankingsElement(tagName?: string): void;
