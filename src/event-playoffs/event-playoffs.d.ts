// Types for ftc-embeds/event-playoffs. Shared types: ../core/team-widgets.d.ts

import type { TeamWidget, EventWidgetOptions, ApiOptions, EventInfo } from "../core/team-widgets";
export type { TeamWidgetOptions, EventWidgetOptions, EventInfo, TeamThemeName, TeamTheme, TeamThemeOption, IconName, ApiOptions, EmbedsConfig } from "../core/team-widgets";
export { configure, EmbedsApiError, TEAM_THEMES, TEAM_THEME_MODES, TEAM_SHAPES, TEAM_THEME_SHAPES, ICONS, TEAM_TEXT, TEAM_LANGUAGES, registerLanguage, seasonOf, DEFAULT_API_BASE, parseEventCode } from "../core/team-widgets";

export interface PlayoffMatch {
    id: number;
    description: string;
    hasBeenPlayed: boolean;
    scheduledStartTime: string | null;
    actualStartTime: string | null;
    tournamentLevel: "Quals" | "RoundRobin" | "Semis" | "Finals" | "DoubleElim";
    series: number;
    matchNum: number;
    scores: { red: { totalPoints: number }; blue: { totalPoints: number } } | null;
    teams: { teamNumber: number; alliance: "Red" | "Blue" | "Solo"; allianceRole: "Captain" | "FirstPick" | "SecondPick" | "Solo"; station: string; surrogate: boolean; noShow: boolean; dq: boolean }[];
}

export interface EventPlayoffsData extends EventInfo {
    teams: { teamNumber: number; team: { name: string } | null; stats: { rank: number } | null }[];
    matches: PlayoffMatch[];
}

export interface PlayoffAlliance {
    /** 1, 2, … in seed order (or first-played order without seeds). */
    id: number;
    /** By the captains' qualification rank; null when some captain has no rank at this event (a championship's divisions). */
    seed: number | null;
    captain: number;
    /** Captain, first pick, second pick. */
    teams: number[];
}

/** One match, or a series between the same two alliances. red, blue and winner are alliance ids. */
export interface BracketEntry {
    matches: PlayoffMatch[];
    red: number | null;
    blue: number | null;
    winner: number | null;
    /** Series only: the wins of red and blue. */
    wins?: [number, number];
}

export interface PlayoffBracket {
    /** "double": double elimination (2023 on); "series": best-of-3 semifinals and finals. */
    format: "double" | "series";
    alliances: PlayoffAlliance[];
    upper: BracketEntry[][];
    lower: BracketEntry[][];
    finals: BracketEntry[];
    champion: number | null;
    finalist: number | null;
}

export declare const EVENT_PLAYOFFS_QUERY: string;
export declare function getEventPlayoffs(event: string, options?: ApiOptions): Promise<EventPlayoffsData>;
export declare function playoffMatches(event: EventPlayoffsData): PlayoffMatch[];
export declare function playoffAlliances(event: EventPlayoffsData): PlayoffAlliance[];
export declare function playoffBracket(event: EventPlayoffsData): PlayoffBracket;
export declare function matchWinner(match: PlayoffMatch): "Red" | "Blue" | "Tie" | null;

export interface EventPlayoffsOptions extends EventWidgetOptions {
    /** Seconds between refreshes while the event is on (default 30). */
    refresh?: number;
}

/** An event's playoffs: the alliances (captain and picks) and the bracket, winner and finalist marked. */
export declare class EventPlayoffs extends TeamWidget<EventPlayoffsData, EventPlayoffsOptions> {}

/** Registers <ftc-event-playoffs> (done on import in browsers). Attributes: the shared ones plus highlight, refresh. */
export declare function defineEventPlayoffsElement(tagName?: string): void;
