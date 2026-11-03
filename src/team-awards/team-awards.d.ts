// Types for ftc-embeds/team-awards. Shared types: ../core/team-widgets.d.ts

import type { TeamWidget, TeamWidgetOptions, ApiOptions, EventSummary, EventRecord, Award, Location } from "../core/team-widgets";
export type { TeamWidgetOptions, TeamThemeName, TeamTheme, TeamThemeOption, IconName, ApiOptions, EmbedsConfig } from "../core/team-widgets";
export { configure, EmbedsApiError, TEAM_THEMES, TEAM_THEME_MODES, TEAM_SHAPES, TEAM_THEME_SHAPES, ICONS, TEAM_TEXT, seasonOf, DEFAULT_API_BASE } from "../core/team-widgets";

export interface TeamAwardsData {
    number: number;
    name: string;
    awards: Award[];
}

export declare const TEAM_AWARDS_QUERY: string;
export declare function getTeamAwards(team: number | string, options?: ApiOptions): Promise<TeamAwardsData>;

export interface TeamAwardsOptions extends TeamWidgetOptions {
    /** "list" (default) | "strip" (award cards) */
    /** "list" (default) | "strip" (award cards) | "banners" (FTC-style banners, a heading per season) */
    layout?: "list" | "strip" | "compact" | "banners" | null;
    /** Only the last N seasons with awards. */
    seasons?: number | null;
    /** Only awards won outright (first place, winning alliance). */
    onlyWon?: boolean;
    /** Only these award types: "Inspire,Think,Winner". */
    types?: string | null;
}

/** Every award a team won, by season: a list, or a strip of award cards. Cards have classes for styling by kind: alliance/judged, p1/p2/…, won, type-<Award>. */
export declare class TeamAwards extends TeamWidget<TeamAwardsData, TeamAwardsOptions> {}

/** Registers <ftc-team-awards> (done on import in browsers). Attributes: the shared ones plus seasons, only-won, types. */
export declare function defineTeamAwardsElement(tagName?: string): void;
