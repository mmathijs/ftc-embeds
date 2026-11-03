// Types for ftc-embeds/event-advancement. Shared types: ../core/team-widgets.d.ts

import type { TeamWidget, EventWidgetOptions, ApiOptions, EventInfo } from "../core/team-widgets";
export type { TeamWidgetOptions, EventWidgetOptions, EventInfo, TeamThemeName, TeamTheme, TeamThemeOption, IconName, ApiOptions, EmbedsConfig } from "../core/team-widgets";
export { configure, EmbedsApiError, TEAM_THEMES, TEAM_THEME_MODES, TEAM_SHAPES, TEAM_THEME_SHAPES, ICONS, TEAM_TEXT, seasonOf, DEFAULT_API_BASE, parseEventCode } from "../core/team-widgets";

export interface AdvancementScore {
    teamNumber: number;
    /** By advancement points, all teams. */
    rank: number | null;
    /** Among the eligible teams. */
    advancementRank: number | null;
    advanced: boolean;
    eligibility: "ELIGIBLE" | "ALREADY_ADVANCED" | "WRONG_REGION" | "TOO_MANY_EVENTS" | "MULTIPLE_REASONS" | null;
    totalPoints: number | null;
    qualPoints: number | null;
    isQualFinal: boolean;
    allianceSelectionPoints: number | null;
    isAllianceSelectionFinal: boolean;
    playoffPoints: number | null;
    isPlayoffPointsFinal: boolean;
    awardPoints: number | null;
    team: { name: string } | null;
}

export interface EventAdvancementData extends EventInfo {
    advancementInfo: { advancementSlots: number | null; advancesTo: string | null; fcmpReserved: number | null; advancesToEvent: { season: number; code: string; name: string; start: string } | null } | null;
    advancement: AdvancementScore[];
}

export declare const EVENT_ADVANCEMENT_QUERY: string;
export declare function getEventAdvancement(event: string, options?: ApiOptions): Promise<EventAdvancementData>;
/** The teams in advancement order (most points first). */
export declare function advancementRows(event: EventAdvancementData): AdvancementScore[];

export interface EventAdvancementOptions extends EventWidgetOptions {
    /** Which point columns, in order: "qual,alliance,playoff,award,total" (default). */
    columns?: string | string[];
}

/** Who advances from an event: its slots, each team's advancement points (points not final yet in italics), the teams that advanced, and why others can't. */
export declare class EventAdvancement extends TeamWidget<EventAdvancementData, EventAdvancementOptions> {}

/** Registers <ftc-event-advancement> (done on import in browsers). Attributes: the shared ones plus columns, highlight, refresh. */
export declare function defineEventAdvancementElement(tagName?: string): void;
