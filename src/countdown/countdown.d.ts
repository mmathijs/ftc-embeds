// Types for ftc-embeds/countdown. Shared types: ../core/team-widgets.d.ts

import type { TeamWidget, TeamWidgetOptions, ApiOptions, EventInfo } from "../core/team-widgets";
import type { TeamMatchesData } from "../next-match/next-match";
export type { TeamWidgetOptions, EventInfo, TeamThemeName, TeamTheme, TeamThemeOption, IconName, ApiOptions, EmbedsConfig } from "../core/team-widgets";
export { configure, EmbedsApiError, TEAM_THEMES, TEAM_THEME_MODES, TEAM_SHAPES, TEAM_THEME_SHAPES, ICONS, TEAM_TEXT, seasonOf, DEFAULT_API_BASE, parseEventCode } from "../core/team-widgets";
export { getTeamMatches } from "../next-match/next-match";

export interface EventInfoData extends EventInfo {
    website: string | null;
    liveStreamURL: string | null;
}

export declare const EVENT_INFO_QUERY: string;
export declare function getEventInfo(event: string, options?: ApiOptions): Promise<EventInfoData>;

/** The moment a day ("2026-02-07") starts in a time zone, as epoch milliseconds. */
export declare function zonedMidnight(date: string, timeZone?: string | null): number;
/** Days, hours, minutes and seconds from `now` until `target` (epoch ms; all 0 once passed). */
export declare function timeLeft(target: number, now: number): { days: number; hours: number; minutes: number; seconds: number; total: number };

export interface CountdownOptions extends TeamWidgetOptions {
    /** "boxes" (default) | "compact" (one line) */
    layout?: "boxes" | "compact" | null;
    /** Team mode: seconds between refreshes while the team's event is on (default 30). */
    refresh?: number;
}

/** A countdown to an event's first day (event + season), or (team) to the team's next match during an event, or else its next event. "Happening now" (with the livestream) while the event is on. */
export declare class Countdown extends TeamWidget<EventInfoData | TeamMatchesData, CountdownOptions> {}

/** Registers <ftc-countdown> (done on import in browsers). Attributes: the shared ones (event and season, or team) plus refresh. */
export declare function defineCountdownElement(tagName?: string): void;
