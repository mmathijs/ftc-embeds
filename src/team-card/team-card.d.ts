// Types for ftc-embeds/team-card. Shared types: ../core/team-widgets.d.ts

import type { TeamWidget, TeamWidgetOptions, ApiOptions, EventSummary, EventRecord, Award, Location } from "../core/team-widgets";
export type { TeamWidgetOptions, TeamThemeName, TeamTheme, TeamThemeOption, IconName, ApiOptions, EmbedsConfig } from "../core/team-widgets";
export { configure, EmbedsApiError, TEAM_THEMES, TEAM_THEME_MODES, ICONS, TEAM_TEXT, seasonOf, DEFAULT_API_BASE } from "../core/team-widgets";

export type TeamCardStat =
    | "opr" | "epa" | "region-rank" | "record" | "record-total" | "win-rate" | "awards" | "awards-total"
    | "matches" | "matches-total" | "events" | "events-total" | "seasons" | "rookie";

export interface TeamStats {
    team: { number: number; name: string; rookieYear: number; regionCode: string | null; region: string | null };
    season: number;
    opr: { value: number; rank: number; count: number } | null;
    regionalOpr: { value: number; rank: number; count: number; region: string } | null;
    epa: { value: number; rank: number } | null;
    seasonTotals: { season: number; events: number; matches: number; wins: number; losses: number; ties: number; awards: number; awardsWon: number };
    allTime: { seasons: number; events: number; matches: number; wins: number; losses: number; ties: number; awards: number; awardsWon: number };
}

export interface TeamCardData {
    card: {
        number: number; name: string; schoolName: string; rookieYear: number; website: string | null; avatar: string | null;
        location: Location;
        quickStats: { tot: { value: number; rank: number }; count: number } | null;
        epa: { epa: number; rank: number } | null;
        events: { event: EventSummary; stats: EventRecord | null }[];
    };
    /** From GET /teams/{n}/stats; null with only a GraphQL endpoint. */
    stats: TeamStats | null;
}

export declare const TEAM_CARD_STATS: TeamCardStat[];
export declare const TEAM_CARD_QUERY: string;
export declare function getTeamCard(team: number | string, options?: ApiOptions): Promise<TeamCardData["card"]>;
/** REST only (apiBase): FTCScout computes these. */
export declare function getTeamStats(team: number | string, options?: ApiOptions): Promise<TeamStats>;

export interface TeamCardOptions extends TeamWidgetOptions {
    /** "list" (default) | "compact" (one row, stats inline) */
    layout?: "list" | "strip" | "compact" | null;
    /** Stat tiles and their order: "opr,epa,record" (default). See TEAM_CARD_STATS. */
    stats?: string | TeamCardStat[];
    /** Rename stat labels: { opr: "Power" }. */
    statLabels?: Partial<Record<TeamCardStat, string>> | null;
    /** Columns of the stat grid; default: as many as stats, up to 3 (4 stats: 2 by 2). */
    statColumns?: number | null;
    /** How many upcoming events to list: 1 = the "Next:" line (default), 0 = none. */
    upcoming?: number;
}

/** A team's card: number, name, location, rookie year, website, the stats you pick, and its next or upcoming events. */
export declare class TeamCard extends TeamWidget<TeamCardData, TeamCardOptions> {}

/** Registers <ftc-team-card> (done on import in browsers). Attributes: the shared ones plus stats, stat-labels (JSON), stat-columns, upcoming. */
export declare function defineTeamCardElement(tagName?: string): void;
