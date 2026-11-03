// Types shared by the team widgets (team-card, team-results, team-awards, next-match, team-season).

/** The themes that follow the visitor's light or dark mode (see TEAM_THEME_MODES). */
export type TeamThemeModeName = "auto" | "ftcscout-auto" | "ftc-events-auto" | "trophy-auto";
export type TeamThemeName = TeamThemeModeName | "light" | "dark" | "ftcscout" | "ftcscout-dark" | "ftc-events" | "ftc-events-dark" | "trophy" | "trophy-light";

/** Theme tokens; each can also be set from the page with --ftcw-<kebab-name> (e.g. --ftcw-accent). */
export interface TeamTheme {
    // Colors
    bg: string;
    surface: string;
    text: string;
    muted: string;
    border: string;
    accent: string;
    accentText: string;
    red: string;
    blue: string;
    good: string;
    bad: string;
    gold: string;
    shadow: string;
    // Corners
    /** The card. */
    radius: string;
    /** Tiles, stat blocks, the next-match box. */
    innerRadius: string;
    /** Chips and scroll buttons ("999px": pills). */
    chipRadius: string;
    /** Team avatars (4px, like FTCScout). */
    avatarRadius: string;
    // Spacing and sizes
    avatarSize: string;
    borderWidth: string;
    padding: string;
    /** Between stat blocks, tiles and alliances. */
    gap: string;
    /** Above and below each list row. */
    rowPadding: string;
    tileWidth: string;
    tileHeight: string;
    /** Award cards' height (at least). */
    cardHeight: string;
    // Type
    font: string;
    fontSize: string;
    smallSize: string;
    titleSize: string;
    titleWeight: string;
    titleTransform: string;
    titleLetterSpacing: string;
    /** Stat values and ranks. */
    valueSize: string;
    valueWeight: string;
    /** Small labels ("Next match", seasons). */
    labelTransform: string;
    labelLetterSpacing: string;
    lineHeight: string;
    /** The team card's team name. */
    nameSize: string;
    nameWeight: string;
    iconSize: string;
    chipFontSize: string;
    chipWeight: string;
    chipPadding: string;
    /** Lines between rows. */
    separatorWidth: string;
    /** Glow around won awards and live/upcoming tiles, e.g. "0 0 22px 4px" ("0 0 0 0": none). */
    glow: string;
    /** Room around scrolling strips, so glows aren't cut off. */
    glowRoom: string;
}

export type TeamThemeOption = TeamThemeName | (Partial<TeamTheme> & { base?: TeamThemeName });

/** Icon names; override with --ftcw-icon-<name>: "★" on the page, or the `icons` option. */
export type IconName = "trophy" | "medal" | "advanced" | "live" | "upcoming" | "calendar" | "location" | "website" | "prev" | "next";

export interface EmbedsConfig {
    /** REST base; default DEFAULT_API_BASE (FTCScout's). null: only graphqlUrl. */
    apiBase: string | null;
    /** Fallback: a GraphQL endpoint that runs the same queries. */
    graphqlUrl: string | null;
    fetch: typeof fetch | null;
}

export interface ApiOptions {
    apiBase?: string | null;
    graphqlUrl?: string | null;
    season?: number | string | null;
    fetch?: typeof fetch;
    signal?: AbortSignal;
}

export interface TeamWidgetOptions {
    /** Team number. */
    team?: number | string | null;
    /** Season (e.g. 2025); default: the current one. */
    season?: number | string | null;
    theme?: TeamThemeOption;
    apiBase?: string | null;
    graphqlUrl?: string | null;
    /** Where team and event names link to; "" for no links. Default "https://ftcscout.mmathijs.nl". */
    siteUrl?: string;
    /** "_blank" (default), "_self", or "none" for no links. */
    linkTarget?: "_blank" | "_self" | "none";
    /** Replaces the heading; "" hides it. */
    title?: string | null;
    /** The widget's layouts: see its docs. */
    layout?: "list" | "strip" | "compact" | null;
    density?: "normal" | "compact";
    /** Parts to leave out: "website,epa" or ["website", "epa"]. See each widget's docs. */
    hide?: string | string[] | null;
    limit?: number | string | null;
    /** e.g. "320px": the content scrolls inside the widget. */
    maxHeight?: string | null;
    /** No card around it: no background, border or padding. */
    bare?: boolean;
    /** Replace icons: text, an "<svg …>" string, or an image URL. "" hides one. */
    icons?: Partial<Record<IconName, string>> | null;
    /** Extra CSS inside the widget's shadow root. */
    css?: string;
    /** A theme's extra CSS without its colors, e.g. "trophy". */
    skin?: "trophy" | null;
    /** Show this data instead of loading it. */
    data?: unknown;
    /** Pretend it is this time (demos, tests). */
    now?: string | Date | null;
    /** Change any text, e.g. { nextMatch: "Up next" }; see TEAM_TEXT. {name} is filled in. */
    text?: Partial<Record<TeamTextKey, string | [string, string]>> | null;
    /** Dates, times and numbers, e.g. "en-GB"; default: the visitor's. */
    locale?: string | null;
    /** Decimals of OPR and EPA (default 1). */
    decimals?: number;
    /** Rename awards: { Inspire: "Inspire Award", Winner: "Winners" }. */
    awardNames?: Record<string, string> | null;
    /** Rename event types: { Qualifier: "Kwalificatie" }. */
    eventTypes?: Record<string, string> | null;
    /** Where team and event names link to (default "ftcscout"). */
    linkTo?: "ftcscout" | "ftc-events";
    /** Or your own: "https://example.org/teams/{team}" ({team}, {season}). */
    teamUrl?: string | null;
    /** "https://example.org/events/{season}/{code}" */
    eventUrl?: string | null;
}

export type TeamTextKey = string;
/** Every text the widgets show (English); change them with the `text` option. */
export declare const TEAM_TEXT: Record<string, string | [string, string]>;

export declare class TeamWidget<Data = unknown, Options extends TeamWidgetOptions = TeamWidgetOptions> {
    constructor(container: HTMLElement, options?: Options);
    readonly options: Options;
    readonly data: Data | null;
    readonly error: Error | null;
    /** Merge options; reloads when the team, season or API changed. */
    update(options: Partial<Options>): this;
    setData(data: Data): this;
    /** Load or refresh; resolves to the data, or null on failure. */
    load(): Promise<Data | null>;
    on(name: "load", fn: (detail: { data: Data }) => void): () => void;
    on(name: "error", fn: (detail: { error: Error }) => void): () => void;
    destroy(): void;
}

/** Set the API for every widget on the page. Default: FTCScout's (DEFAULT_API_BASE); setting only graphqlUrl uses GraphQL instead. */
export declare function configure(options: Partial<EmbedsConfig>): EmbedsConfig;
/** "https://ftcscout-api.mmathijs.nl/rest/embeds/v1" */
export declare const DEFAULT_API_BASE: string;

export declare class EmbedsApiError extends Error {
    readonly status: number;
    readonly url: string | null;
    /** No such team (or event). */
    readonly notFound: boolean;
}

export declare const TEAM_THEMES: Record<Exclude<TeamThemeName, TeamThemeModeName>, TeamTheme>;
/** Each theme that follows light/dark mode, with the [light, dark] themes it switches between. */
export declare const TEAM_THEME_MODES: Record<TeamThemeModeName, [Exclude<TeamThemeName, TeamThemeModeName>, Exclude<TeamThemeName, TeamThemeModeName>]>;
export declare const ICONS: Record<IconName, string>;

/** The FTC season a date falls in (seasons start in September). */
export declare function seasonOf(date?: Date): number;

// API data (the preset queries' results).

export interface Location {
    city: string;
    state: string;
    country: string;
}

export interface EventSummary {
    season: number;
    code: string;
    name: string;
    start: string;
    end: string;
    type: string;
    remote: boolean;
    started: boolean;
    ongoing: boolean;
    finished: boolean;
    location?: Location;
    timezone?: string;
}

export interface EventRecord {
    rank: number;
    wins: number;
    losses: number;
    ties: number;
}

export interface Award {
    season: number;
    eventCode: string;
    type: string;
    placement: number;
    divisionName: string | null;
    personName: string | null;
    event?: { name: string; start: string };
}
