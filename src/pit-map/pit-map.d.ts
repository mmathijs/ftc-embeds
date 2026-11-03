// Types for ftc-pit-map. Data types follow ApiV3PitMap:
// https://github.com/maths22/ftc-api-v3-client-ruby/blob/master/docs/ApiV3PitMap.md

export type CellType = "EMPTY" | "BOUNDARY" | "PIT" | "HORIZONTAL_FIELD" | "VERTICAL_FIELD" | "OBJECT" | "LABEL";
export type LabelOrientation = "HORIZONTAL" | "VERTICAL";

export interface SimpleTeam {
    number: string;
    name: string;
    /** Use for presentation; may be shorter than `number`. */
    displayNumber: string;
}

export interface PitMapElement {
    type?: CellType;
    x: number;
    y: number;
    width: number;
    height: number;
    label?: string;
    labelOrientation?: LabelOrientation;
    index?: number;
    team?: SimpleTeam;
    address?: string;
    addressGroup?: string;
    color?: string;
}

export interface PitMapData {
    minX: number;
    minY: number;
    width: number;
    height: number;
    showPitNumbers: boolean;
    showPitAddresses: boolean;
    elements: PitMapElement[];
}

/** Element after normalization (always has a type, index `i` into `elements`). */
export interface NormalizedElement extends Required<Pick<PitMapElement, "x" | "y" | "width" | "height">> {
    i: number;
    type: CellType;
    label: string | null;
    labelOrientation: LabelOrientation;
    index: number | null;
    team: SimpleTeam | null;
    address: string | null;
    addressGroup: string | null;
    color: string | null;
}

/**
 * Teams to decorate. Accepts:
 * - "16236" or 16236, or a comma/space separated string "16236, 365"
 * - an array: ["16236", 365]  or  [{ team: "16236", color: "#f00" }]
 * - an object: { "16236": "#f00", "365": "#0af" }
 * Teams without their own color use highlightColor / outlineColor.
 */
export type TeamSelection =
    | string
    | number
    | Array<string | number | { team: string | number; color?: string }>
    | Record<string, string | null | true>
    | null;

/**
 * Style tokens. Every value may also be a CSS expression such as "var(--brand, #2c666e)";
 * it's resolved against the page when rendering (and again when <html>/<body> theme classes change).
 * Color tokens accept "none" to switch that part off.
 */
export interface Theme {
    // colors
    background: string;
    gridDot: string;
    wall: string;
    pitBase: string;
    /** 0 = raw event pit colors, 1 = fully pitBase. */
    pitMix: number;
    pitDefault: string;
    pitStroke: string;
    pitEmpty: string;
    textDark: string;
    textLight: string;
    objectFill: string;
    objectHatch: string;
    objectStroke: string;
    objectText: string;
    label: string;
    fieldZone: string;
    fieldMat: string;
    fieldTile: string;
    /** Both field ends when the alliance sides are unknown (the default). */
    fieldStation: string;
    fieldRed: string;
    fieldBlue: string;
    fieldStroke: string;
    route: string;
    routeCasing: string;
    highlight: string;
    outline: string;
    focus: string;
    tooltipBg: string;
    tooltipText: string;
    tooltipMuted: string;
    tooltipBorder: string;
    controlBg: string;
    controlText: string;
    shadow: string;
    elementStroke: string;
    // typography
    fontFamily: string;
    uiFontFamily: string | null;
    numberWeight: number | string;
    /** Team number height as a fraction of the pit height. Default 0.24. */
    numberSize: number;
    subWeight: number | string;
    nameWeight: number | string;
    labelWeight: number | string;
    labelTransform: "uppercase" | "none" | "capitalize";
    /** em */
    labelLetterSpacing: number;
    // shape (map cells unless noted)
    pitRadius: number;
    pitGap: number;
    pitStrokeWidth: number;
    /** Labelled areas. Radii are in map cells and capped at half the shape's short side. */
    objectRadius: number;
    /** Field elements; the field square and alliance stations scale from this. */
    fieldRadius: number;
    /** Corners of each connected wall outline. */
    wallRadius: number;
    elementStrokeWidth: number;
    outlineWidth: number;
    hoverStrokeWidth: number;
    /** Border color of a hovered pit; null/"none" keeps the pit's own border color. */
    hoverStroke: string | null;
    fieldStyle: "detailed" | "stations";
    // effects
    shadows: boolean;
    glow: boolean;
    dimOpacity: number;
    // route
    routeWidth: number;
    routeCasingWidth: number;
    /** 0 = sharp corners */
    routeCornerRadius: number;
    routeDash: boolean;
    /** px, tooltip/popup/controls */
    uiRadius: number;
}

export type ThemeName = "auto" | "light" | "dark" | "ftcscout" | "ftcscout-dark" | "ftc-events";
/** A preset name, or tokens layered over a preset ({ base: "ftc-events", pitRadius: 0.2 }). */
export type ThemeOption = ThemeName | (Partial<Theme> & { base?: ThemeName; extends?: ThemeName });

export interface PitStyle {
    fill: string;
    stroke: string;
    strokeWidth: number;
    radius: number;
    /** Text color; null = automatic contrast. */
    text: string | null;
    opacity: number | null;
}

export interface ContentContext {
    kind: "tooltip" | "popup";
    map: PitMap;
    theme: Theme;
    /** The built-in content as a DOM node, to extend or wrap. */
    defaultContent(): HTMLElement;
    /** Close the popup (popup content only). */
    close(): void;
}

export type ContentFn = (team: SimpleTeam | null, element: NormalizedElement, ctx: ContentContext) => string | Node | false | null | undefined;

export interface PitEventDetail {
    team: SimpleTeam | null;
    element: NormalizedElement;
    originalEvent: Event;
    map: PitMap;
}

export interface PitClickDetail extends PitEventDetail {
    /** Skip the built-in click action (the popup). Returning false from the handler does the same. */
    preventDefault(): void;
    readonly defaultPrevented: boolean;
}

export interface View {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface RouteResult {
    /** Polyline in map cells. */
    points: [number, number][];
    cells: number;
    meters: number;
    seconds: number;
    from: NormalizedElement | null;
    to: NormalizedElement | null;
}

/**
 * A team number, "field" (nearest field), "queue" (nearest queueing area),
 * an area name such as "Pit Admin", { area: name | RegExp }, or a point in map cells.
 */
export type RouteEndpoint = string | number | "field" | "queue" | { area: string | RegExp } | { x: number; y: number };

export interface Area {
    name: string;
    count: number;
    kind: "field" | "queue" | "area";
}

export interface PitMapOptions {
    /** Pit map JSON to show. Or leave it out and set `event` to load it from the ftc-embeds API. */
    data?: PitMapData | null;
    /** Load this event's pit map from the ftc-embeds API: "2025/FPEEUR" or { season, code }. */
    event?: EventRef | null;
    /** REST API base for this widget (default: configure({ apiBase })). */
    apiBase?: string | null;
    /** GraphQL endpoint used when no REST base is set (default: configure({ graphqlUrl })). */
    graphqlUrl?: string | null;
    /** Texts shown while loading / when the event has no pit map / on errors. */
    messages?: { loading?: string; notFound?: string; error?: string };
    /** Default "auto" (light/dark following prefers-color-scheme). */
    theme?: ThemeOption;
    /** Re-resolve CSS-variable theme values when <html>/<body> class/style/data-theme change. Default true. */
    watchTheme?: boolean;
    /** Per-pit style override, applied after the theme. */
    pitStyle?: ((team: SimpleTeam | null, element: NormalizedElement, state: { highlighted: string | null; outlined: string | null; theme: Theme }) => Partial<PitStyle> | null | undefined) | null;
    /** Extra class(es) on the root element. */
    className?: string;
    /**
     * Which end of each field is red. Pit map data doesn't record it, so the default (null) draws
     * both ends neutral. "red-first" = red at the top/left end; or decide per field.
     */
    fieldAlliances?: "red-first" | "blue-first" | null | ((field: NormalizedElement) => "red-first" | "blue-first" | null | undefined);
    highlight?: TeamSelection;
    outline?: TeamSelection;
    /** Default: the theme's `highlight` color. */
    highlightColor?: string | null;
    /** Default: the theme's `outline` color. */
    outlineColor?: string | null;
    /** Fade other pits while something is highlighted/outlined. Default true. */
    dimOthers?: boolean;
    /** Pulsing ring around highlighted pits. Default true. */
    pulse?: boolean;
    /** Base color per pit, e.g. for heatmaps. Return null to keep the event's color. */
    colorBy?: ((team: SimpleTeam, element: NormalizedElement) => string | null | undefined) | null;
    /** Override the data's showPitNumbers. */
    showPitNumbers?: boolean | null;
    /** Override the data's showPitAddresses. */
    showPitAddresses?: boolean | null;
    /** Default "zoom": names appear once pits are big enough to read them. */
    showTeamNames?: boolean | "zoom";
    /** Hover tooltip: true (built-in), false, or a function returning HTML / a Node (false = none for that pit). */
    tooltip?: boolean | ContentFn;
    /** Click popup content: true (same as the tooltip), false, or a function. It can contain links/buttons. */
    popup?: boolean | ContentFn;
    /** What clicking a pit does. Default "popup". */
    clickAction?: "popup" | "tooltip" | "focus" | "none" | ((detail: PitClickDetail) => void);
    /** Zoom buttons. Default true. */
    controls?: boolean;
    /** Allow panning/zooming. Default true. */
    zoom?: boolean;
    /** Default "modifier": ctrl/cmd + wheel zooms, plain wheel scrolls the page. */
    scrollZoom?: boolean | "modifier";
    /** Default 8. */
    maxZoom?: number;
    /** Cells of padding around the map. Default 1. */
    padding?: number;
    /** Size of a standard pit in meters; sets the map scale. Default 3 (3 x 3 m pits). */
    pitSizeMeters?: number;
    /** Override the scale directly. Default null = pitSizeMeters / the most common pit size in cells. */
    metersPerCell?: number | null;
    /** Default 1.3 m/s. */
    walkingSpeed?: number;
    ariaLabel?: string;
    /** Return false (or call detail.preventDefault()) to skip the built-in click action. */
    onPitClick?: ((detail: PitClickDetail) => void | boolean) | null;
    onPitHover?: ((detail: PitEventDetail | null) => void) | null;
}

export interface TeamInfo extends SimpleTeam {
    address: string | null;
    label: string | null;
    color: string | null;
}

export type EventRef = string | { season: number | string; code: string };

export interface EmbedsConfig {
    /** REST base URL; each endpoint is a cached preset of a GraphQL query (see PIT_MAP_QUERY). */
    apiBase: string | null;
    /** GraphQL endpoint, used when apiBase isn't set. */
    graphqlUrl: string | null;
    /** Custom fetch (SSR, tests, headers). */
    fetch: typeof fetch | null;
}

/** Configure every widget on the page. */
export declare function configure(options: Partial<EmbedsConfig>): EmbedsConfig;

export declare class EmbedsApiError extends Error {
    /** HTTP status; 0 for network/configuration problems. */
    readonly status: number;
    readonly url: string | null;
    /** The event or its pit map doesn't exist. */
    readonly notFound: boolean;
}

export interface PitMapResult {
    season: number;
    code: string;
    updatedAt: string | null;
    pitMap: PitMapData;
}

/** GET {apiBase}/events/{season}/{code}/pit-map, or PIT_MAP_QUERY against graphqlUrl. */
export declare function getPitMap(
    event: EventRef,
    options?: { apiBase?: string | null; graphqlUrl?: string | null; signal?: AbortSignal; fetch?: typeof fetch }
): Promise<PitMapResult>;

/** The GraphQL query behind the pit map REST endpoint. */
export declare const PIT_MAP_QUERY: string;
/** FTCScout's embeds API, used unless configure() says otherwise. */
export declare const DEFAULT_API_BASE: string;

export declare class PitMap {
    constructor(container: HTMLElement, options?: PitMapOptions);
    readonly container: HTMLElement;
    readonly root: HTMLDivElement;
    readonly svg: SVGSVGElement;
    readonly options: PitMapOptions;
    readonly theme: Theme;
    view: View | undefined;
    /** Map scale in meters per grid cell. */
    readonly metersPerCell: number;

    setData(data: PitMapData | null): this;
    /** Load an event's pit map from the ftc-embeds API. Resolves to null on failure (see the "error" event). */
    load(event?: EventRef): Promise<PitMapResult | null>;
    update(options: PitMapOptions): this;
    setHighlight(teams: TeamSelection, color?: string): this;
    setOutline(teams: TeamSelection, color?: string): this;

    getTeams(): TeamInfo[];
    findTeams(query: string, limit?: number): TeamInfo[];
    hasTeam(team: string | number): boolean;

    /**
     * Bring a team's pit into view. `cells`: width of the area to show (default 22; 0..1 = fraction
     * of the map). `keepZoom`: only pan, never zoom in further. `onlyIfHidden`: skip if already visible.
     */
    focusTeam(
        team: string | number,
        options?: { cells?: number; flash?: boolean; keepZoom?: boolean; onlyIfHidden?: boolean }
    ): boolean;
    fit(animate?: boolean): void;
    zoomBy(factor: number, center?: [number, number]): void;

    /** Named destinations on this map (fields, queues, labelled areas). */
    getAreas(): Area[];
    route(from: RouteEndpoint, to: RouteEndpoint): RouteResult | null;
    showRoute(from: RouteEndpoint, to: RouteEndpoint, options?: { color?: string }): RouteResult | null;
    clearRoute(): void;

    toSVGString(options?: { fullMap?: boolean }): string;
    toPNG(options?: { scale?: number; pxPerCell?: number }): Promise<Blob>;

    /** Open the click popup for a team. */
    openPopup(team: string | number): boolean;
    closePopup(): void;
    /** The built-in tooltip/popup content for a pit. */
    defaultContent(element: NormalizedElement): HTMLElement;
    /** Re-read CSS variables and re-render if the theme changed (automatic with watchTheme). */
    refreshTheme(): void;

    on(event: "pitclick", fn: (detail: PitClickDetail) => void | boolean): () => void;
    on(event: "popupopen", fn: (detail: { team: SimpleTeam | null; element: NormalizedElement; node: HTMLElement; map: PitMap }) => void): () => void;
    on(event: "popupclose", fn: (detail: { team: SimpleTeam | null; element: NormalizedElement; map: PitMap }) => void): () => void;
    on(event: "pithover", fn: (detail: PitEventDetail | null) => void): () => void;
    on(event: "viewchange", fn: (view: View) => void): () => void;
    on(event: "load", fn: (result: PitMapResult) => void): () => void;
    on(event: "error", fn: (detail: { error: EmbedsApiError | Error; event: EventRef }) => void): () => void;

    destroy(): void;
}

export declare const CELL_TYPES: CellType[];
export declare const THEMES: Record<Exclude<ThemeName, "auto">, Theme>;
export declare function normalizePitMap(raw: unknown): {
    minX: number;
    minY: number;
    width: number;
    height: number;
    showPitNumbers: boolean;
    showPitAddresses: boolean;
    elements: NormalizedElement[];
};
/** Registers the <ftc-pit-map> custom element (done automatically on import in browsers). */
export declare function definePitMapElement(tagName?: string): void;

export interface PitMapElementAttributes {
    /** Event to load from the ftc-embeds API, e.g. "2025/FPEEUR". */
    event?: string;
    "api-base"?: string;
    "graphql-url"?: string;
    /** URL of pit map JSON (alternative to `event`). */
    src?: string;
    highlight?: string;
    outline?: string;
    "highlight-color"?: string;
    "outline-color"?: string;
    theme?: "light" | "dark" | "auto";
    "dim-others"?: "true" | "false";
    controls?: "true" | "false";
    pulse?: "true" | "false";
    "scroll-zoom"?: "true" | "false" | "modifier";
    "show-team-names"?: "true" | "false" | "zoom";
    "click-action"?: "popup" | "tooltip" | "focus" | "none";
    "class-name"?: string;
}

export interface FtcPitMapElement extends HTMLElement {
    data: PitMapData | null;
    options: PitMapOptions;
    readonly map: PitMap | null;
}

declare global {
    interface HTMLElementTagNameMap {
        "ftc-pit-map": FtcPitMapElement;
    }
}

export default PitMap;
