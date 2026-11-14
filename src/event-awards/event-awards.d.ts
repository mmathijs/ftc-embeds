// Types for ftc-embeds/event-awards. Shared types: ../core/team-widgets.d.ts

import type { TeamWidget, EventWidgetOptions, ApiOptions, EventInfo } from "../core/team-widgets";
export type { TeamWidgetOptions, EventWidgetOptions, EventInfo, TeamThemeName, TeamTheme, TeamThemeOption, IconName, ApiOptions, EmbedsConfig } from "../core/team-widgets";
export { configure, EmbedsApiError, TEAM_THEMES, TEAM_THEME_MODES, TEAM_SHAPES, TEAM_THEME_SHAPES, ICONS, TEAM_TEXT, TEAM_LANGUAGES, registerLanguage, seasonOf, DEFAULT_API_BASE, parseEventCode } from "../core/team-widgets";

export interface EventAward {
    type: string;
    /** 1 for the winner (or an alliance's captain), 2, 3, … */
    placement: number;
    divisionName: string | null;
    /** Dean's List: the student. */
    personName: string | null;
    teamNumber: number;
    team: { name: string } | null;
}

export interface EventAwardsData extends EventInfo {
    awards: EventAward[];
}

export interface AwardGroup {
    type: string;
    division: string | null;
    awards: EventAward[];
}

export declare const EVENT_AWARDS_QUERY: string;
export declare function getEventAwards(event: string, options?: ApiOptions): Promise<EventAwardsData>;
/** The awards grouped by award, in ceremony order (the alliances first, Inspire last). */
export declare function awardGroups(event: EventAwardsData, options?: { onlyWon?: boolean; types?: Set<string> | null }): AwardGroup[];

export interface EventAwardsOptions extends EventWidgetOptions {
    /** Only first places and the winning alliance. */
    onlyWon?: boolean;
    /** Only these award types: "Inspire,Think,Winner". */
    types?: string | null;
}

/** Who won which award at an event, grouped by award; Dean's List with the student's name. */
export declare class EventAwards extends TeamWidget<EventAwardsData, EventAwardsOptions> {}

/** Registers <ftc-event-awards> (done on import in browsers). Attributes: the shared ones plus only-won, types, highlight. */
export declare function defineEventAwardsElement(tagName?: string): void;
