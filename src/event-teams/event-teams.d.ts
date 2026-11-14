// Types for ftc-embeds/event-teams. Shared types: ../core/team-widgets.d.ts

import type { TeamWidget, EventWidgetOptions, ApiOptions, EventInfo } from "../core/team-widgets";
export type { TeamWidgetOptions, EventWidgetOptions, EventInfo, TeamThemeName, TeamTheme, TeamThemeOption, IconName, ApiOptions, EmbedsConfig } from "../core/team-widgets";
export { configure, EmbedsApiError, TEAM_THEMES, TEAM_THEME_MODES, TEAM_SHAPES, TEAM_THEME_SHAPES, ICONS, TEAM_TEXT, TEAM_LANGUAGES, registerLanguage, seasonOf, DEFAULT_API_BASE, parseEventCode } from "../core/team-widgets";

export interface EventTeam {
    teamNumber: number;
    team: { name: string; rookieYear: number; avatar: string | null; location: { city: string; state: string; country: string } | null } | null;
    /** Once matches are played. */
    stats: { rank: number; wins: number; losses: number; ties: number } | null;
}

export interface EventTeamsData extends EventInfo {
    teams: EventTeam[];
}

export declare const EVENT_TEAMS_QUERY: string;
export declare function getEventTeams(event: string, options?: ApiOptions): Promise<EventTeamsData>;
/** The teams in order: "auto" (rank once there are ranks, else number), "number", "name" or "rank". */
export declare function teamRows(event: EventTeamsData, order?: "auto" | "number" | "name" | "rank"): EventTeam[];

export interface EventTeamsOptions extends EventWidgetOptions {
    /** "grid" (tiles with avatars, default) or "list" (a table). */
    layout?: "grid" | "list";
    order?: "auto" | "number" | "name" | "rank";
    /** Seconds between refreshes while the event is on (default 300). */
    refresh?: number;
}

/** The teams at an event, also before it starts: avatar, number, name and place; rank and record once matches are played. */
export declare class EventTeams extends TeamWidget<EventTeamsData, EventTeamsOptions> {}

/** Registers <ftc-event-teams> (done on import in browsers). Attributes: the shared ones plus order, highlight, refresh. */
export declare function defineEventTeamsElement(tagName?: string): void;
