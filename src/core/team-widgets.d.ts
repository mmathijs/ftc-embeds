// Types shared by the widgets (team-card, team-results, team-awards, next-match, team-season and
// the event widgets).

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
    // Shape (TEAM_SHAPES): corners, spacing, sizes and type
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

/** The color tokens: what a color theme (TEAM_THEMES) sets. */
export type TeamColorToken = "bg" | "surface" | "text" | "muted" | "border" | "accent" | "accentText" | "red" | "blue" | "good" | "bad" | "gold" | "shadow";
export type TeamColors = Pick<TeamTheme, TeamColorToken>;
export type TeamShapeTokens = Omit<TeamTheme, TeamColorToken>;
export type TeamShapeName = "default" | "square" | "compact" | "spacious" | "bubbly" | "showcase" | "ftcscout" | "ftc-events";

/** A color theme, or tokens over one; `dark` holds tokens used only when the visitor is in dark mode. */
export type TeamThemeOption = TeamThemeName | (Partial<TeamTheme> & { base?: TeamThemeName; dark?: Partial<TeamTheme> });
/** A shape, or shape tokens over one. */
export type TeamShapeOption = TeamShapeName | (Partial<TeamShapeTokens> & { base?: TeamShapeName });

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
    /** Team number (team widgets). */
    team?: number | string | null;
    /** Event code, e.g. "NLCMP" (event widgets), in `season`. */
    event?: string | null;
    /** Season (e.g. 2025); default: the current one. */
    season?: number | string | null;
    /** Colors. Default "auto" (light or dark, following the visitor). */
    theme?: TeamThemeOption;
    /** Corners, spacing and type, separate from the colors. Default: the theme's own (TEAM_THEME_SHAPES). */
    shape?: TeamShapeOption | null;
    apiBase?: string | null;
    graphqlUrl?: string | null;
    /** Where team and event names link to; "" for no links. Default "https://ftcscout.mmathijs.nl". */
    siteUrl?: string;
    /** "_blank" (default), "_self", or "none" for no links. */
    linkTarget?: "_blank" | "_self" | "none";
    /** Replaces the heading; "" hides it. */
    title?: string | null;
    /** The widget's layouts: see its docs. */
    layout?: "list" | "strip" | "compact" | "boxes" | "banners" | "cards" | "podium" | null;
    density?: "normal" | "compact";
    /** Parts to leave out: "website,epa" or ["website", "epa"]. See each widget's docs. */
    hide?: string | string[] | null;
    limit?: number | string | null;
    /** e.g. "320px": the content scrolls inside the widget. */
    maxHeight?: string | null;
    /** Tables with maxHeight: the row to scroll to: "auto" (the next match, else the marked team), "team", "next" or "none". */
    scrollTo?: "auto" | "team" | "next" | "none";
    /** Rows to keep above that row (default: centered). */
    scrollOffset?: number | string | null;
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
    /** Number separators regardless of `locale`: "point" 1,234.5 · "comma" 1.234,5 · "space" 1 234,5 · "apostrophe" 1'234.5 · "plain" 1234.5. Default "locale". */
    numberFormat?: "locale" | "point" | "comma" | "space" | "apostrophe" | "plain";
    /** Event dates: "short" Feb 7, 2026 (default) · "long" February 7, 2026 · "numeric" 2/7/2026 (in the locale's order) · "iso" 2026-02-07. */
    dateFormat?: "short" | "long" | "numeric" | "iso";
    /** Match times on a 12- or 24-hour clock. Default: the locale's. */
    hourCycle?: 12 | 24 | "12" | "24" | null;
    /** Time zone for match times, e.g. "Europe/Amsterdam". Default: the visitor's. */
    timeZone?: string | null;
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

export declare const TEAM_THEMES: Record<Exclude<TeamThemeName, TeamThemeModeName>, TeamColors>;
export declare const TEAM_SHAPES: Record<TeamShapeName, TeamShapeTokens>;
/** The shape each color theme gets when `shape` isn't set ("default" for the ones not listed). */
export declare const TEAM_THEME_SHAPES: Partial<Record<TeamThemeName, TeamShapeName>>;
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

/** What every event preset says about the event itself. */
export interface EventInfo {
    season: number;
    code: string;
    name: string;
    start: string;
    end: string;
    timezone: string;
    type: string;
    remote: boolean;
    started: boolean;
    ongoing: boolean;
    finished: boolean;
    /** A division's championship (its code). */
    divisionCode: string | null;
    leagueCode: string | null;
    location: Location;
}

/** Options of every event widget. */
export interface EventWidgetOptions extends TeamWidgetOptions {
    /** Team numbers to mark: "19444,16236" or [19444]. */
    highlight?: string | number[] | null;
    /** Seconds between refreshes while the event is on (default 30). */
    refresh?: number;
}

export declare function parseEventCode(code: string): string;

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
