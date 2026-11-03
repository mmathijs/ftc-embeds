// Types for ftc-embeds/league-standings. Shared types: ../core/team-widgets.d.ts

import type { TeamWidget, EventWidgetOptions, ApiOptions, EventInfo, EventRecord } from "../core/team-widgets";
export type { TeamWidgetOptions, EventWidgetOptions, EventInfo, TeamThemeName, TeamTheme, TeamThemeOption, IconName, ApiOptions, EmbedsConfig } from "../core/team-widgets";
export { configure, EmbedsApiError, TEAM_THEMES, TEAM_THEME_MODES, TEAM_SHAPES, TEAM_THEME_SHAPES, ICONS, TEAM_TEXT, seasonOf, DEFAULT_API_BASE, parseEventCode } from "../core/team-widgets";

export interface LeagueStandingsData extends EventInfo {
    /** The event's league (empty for events outside a league). */
    leagueRankings: {
        league: { code: string; name: string; regionCode: string | null; parentLeagueCode: string | null; parentLeagueName: string | null };
        teams: { teamNumber: number; avgRp: number; team: { name: string } | null; stats: EventRecord | null }[];
    }[];
}

export declare const EVENT_LEAGUE_QUERY: string;
/** The standings of the league an event belongs to (any of its meets, or its tournament). */
export declare function getEventLeague(event: string, options?: ApiOptions): Promise<LeagueStandingsData>;

export interface LeagueStandingsOptions extends EventWidgetOptions {}

/** A league's standings (rank, average RP, record), from any league meet or the tournament of that league. */
export declare class LeagueStandings extends TeamWidget<LeagueStandingsData, LeagueStandingsOptions> {}

/** Registers <ftc-league-standings> (done on import in browsers). Attributes: the shared ones plus highlight, refresh. */
export declare function defineLeagueStandingsElement(tagName?: string): void;
