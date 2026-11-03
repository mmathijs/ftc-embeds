# Pit map (`ftc-embeds/pit-map`)

Render FTC pit maps as interactive SVG: pan and zoom, highlight and outline teams in any color, tooltips and click popups you can replace, walking routes, fully customizable styling (with FTCScout and FTC-Events presets), PNG/SVG export.

- **Zero dependencies**, one file. Works as an ES module, CommonJS, or a plain `<script>` tag.
- **Any framework**: use the `PitMap` class directly, or the `<ftc-pit-map>` web component (React, Vue, Svelte, Angular, plain HTML).
- **SSR-safe**: importing on the server does nothing; it only touches the DOM when you create a map.
- **Data**: [`ApiV3PitMap`](https://github.com/maths22/ftc-api-v3-client-ruby/blob/master/docs/ApiV3PitMap.md) JSON, e.g. from `pitmap_to_json.py` (camelCase or snake_case keys).

```bash
python3 pitmap_to_json.py 2025 FPEEUR NLCMP FTCCMP1 -o pitmaps/
```

Open `demo/pit-map/index.html` (works straight from disk) for the full demo with 2025 FPEEUR, NLCMP and FTCCMP1 plus all six divisions, and `demo/pit-map/web-component.html` for the web component.

## Quick start

```html
<div id="map" style="height: 600px"></div>
<script type="module">
    import { PitMap } from "ftc-embeds/pit-map";

    const data = await (await fetch("/pitmaps/FPEEUR_pitmap.json")).json();
    const map = new PitMap(document.getElementById("map"), {
        data,
        highlight: "21222",            // or ["21222", "8626"], or { "21222": "#8b5cf6" }
        highlightColor: "#f59e0b",
        outline: { "23069": "#ef4444" },
    });

    map.on("pitclick", ({ team }) => console.log(team.number, team.name));
    map.focusTeam("21222");                 // smooth zoom to a pit
    map.showRoute("21222", "field");        // walking route to the nearest field
    map.showRoute("21222", "queue");        // ...or the nearest queueing area, or "Pit Admin", ...
</script>
```

Without a module bundler: `<script src="dist/pit-map.umd.js"></script>` exposes `window.FtcPitMap.PitMap`.

The container needs a size. If it has no height, the map uses its own aspect ratio.

## Loading data from the API

Instead of passing `data`, give the widget an event and it fetches the pit map from the [ftc-embeds API](api.md):

```js
import { configure, PitMap } from "ftc-embeds/pit-map";

// FTCScout's API is the default; for another: configure({ apiBase: "…" }) or configure({ graphqlUrl: "…" })
const map = new PitMap(el, { event: "2025/FPEEUR", highlight: "16236" });
map.on("load", ({ updatedAt }) => …);
map.on("error", ({ error }) => …);   // error.notFound: no such event / no pit map
```

While loading, and when there's no pit map or an error, the widget shows a short message (change the texts with `messages: { loading, notFound, error }`). `map.load("2025/NLCMP")` switches events; so does `update({ event })`.

## Web component

Importing the library registers `<ftc-pit-map>`.

```html
<ftc-pit-map
    event="2025/NLCMP"
    api-base="https://…/rest/embeds/v1"
    highlight="3977, 16476"
    highlight-color="#10b981"
    outline="12475"
    outline-color="#e11d48"
    theme="auto"
    style="height: 600px"
></ftc-pit-map>
```

| Attribute | Values |
| --- | --- |
| `event` | Event to load from the API, e.g. `2025/NLCMP` |
| `api-base` / `graphql-url` | API to load from (default: `configure()`) |
| `src` | Alternative: URL of a pit map JSON file (or set the `.data` property) |
| `highlight`, `outline` | team numbers, comma/space separated |
| `highlight-color`, `outline-color` | any CSS color |
| `theme` | `auto` (default), `light`, `dark`, `ftcscout`, `ftcscout-dark`, `ftc-events` |
| `dim-others`, `controls`, `pulse` | `true` / `false` |
| `scroll-zoom` | `modifier` (default, ctrl/⌘ + wheel), `true`, `false` |
| `click-action` | `popup` (default), `tooltip`, `focus`, `none` |
| `theme` | also accepts JSON tokens: `theme='{"base":"ftc-events","pitRadius":0.2}'` |
| `show-team-names` | `zoom` (default), `true`, `false` |

Properties: `.data`, `.options` (any `PitMap` option, e.g. functions like `colorBy`), `.map` (the `PitMap` instance).
Events (`CustomEvent`, data in `event.detail`): `pitclick` (cancelable), `pithover`, `viewchange`, `popupopen`, `popupclose`, `load`, `error`.

## Frameworks

### React

```jsx
import { useEffect, useRef } from "react";
import { PitMap } from "ftc-embeds/pit-map";

export function PitMapView({ data, highlight, outline, onPitClick }) {
    const ref = useRef(null);
    const map = useRef(null);

    useEffect(() => {
        map.current = new PitMap(ref.current, { data });
        return () => map.current.destroy();
    }, []);
    useEffect(() => void map.current?.setData(data), [data]);
    useEffect(() => void map.current?.update({ highlight, outline, onPitClick }), [highlight, outline, onPitClick]);

    return <div ref={ref} style={{ height: 600 }} />;
}
```

Or use the element directly (React 19 passes properties and custom events natively):
`<ftc-pit-map src="/pitmaps/FPEEUR_pitmap.json" highlight="21222" onpitclick={(e) => ...} />`.

### Vue 3

```vue
<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import { PitMap } from "ftc-embeds/pit-map";

const props = defineProps(["data", "highlight", "outline"]);
const el = ref(null);
let map;

onMounted(() => (map = new PitMap(el.value, { data: props.data, highlight: props.highlight, outline: props.outline })));
onBeforeUnmount(() => map?.destroy());
watch(() => props.data, (d) => map?.setData(d));
watch(() => [props.highlight, props.outline], ([highlight, outline]) => map?.update({ highlight, outline }));
</script>

<template><div ref="el" style="height: 600px" /></template>
```

For the web component, tell Vue it's a custom element: `compilerOptions.isCustomElement = (tag) => tag === "ftc-pit-map"`.

### Svelte

```svelte
<script>
    import { onMount } from "svelte";
    import { PitMap } from "ftc-embeds/pit-map";

    export let data, highlight = null, outline = null;
    let el, map;

    onMount(() => {
        map = new PitMap(el, { data });
        return () => map.destroy();
    });
    $: map?.setData(data);
    $: map?.update({ highlight, outline });
</script>

<div bind:this={el} style="height: 600px" />
```

### Angular

```ts
// add CUSTOM_ELEMENTS_SCHEMA to the component/module, and `import "ftc-embeds/pit-map";` once (e.g. in main.ts)
@Component({
    selector: "app-pits",
    standalone: true,
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    template: `<ftc-pit-map [data]="pitMap" [attr.highlight]="team" (pitclick)="clicked($event)" style="height:600px"></ftc-pit-map>`,
})
export class PitsComponent { /* ... */ }
```

## Options

| Option | Default | Description |
| --- | --- | --- |
| `data` | `null` | ApiV3PitMap JSON |
| `highlight` / `outline` | `null` | `"123"`, `"1, 2"`, `["1", 2]`, `[{ team, color }]`, `{ "123": "#f00" }` |
| `highlightColor` / `outlineColor` | theme | Color for teams without their own color (default: the theme's `highlight` / `outline`) |
| `dimOthers` | `true` | Fade other pits while teams are highlighted/outlined |
| `pulse` | `true` | Pulsing ring around highlighted pits |
| `colorBy` | `null` | `(team, element) => color` to recolor pits (heatmaps, "visited" lists, …) |
| `theme` | `"auto"` | Preset name or token object, see [Styling](#styling) |
| `watchTheme` | `true` | Re-read CSS variables when `<html>`/`<body>` class, style or `data-theme` changes |
| `pitStyle` | `null` | `(team, element, { highlighted, outlined, theme }) => ({ fill, stroke, strokeWidth, radius, text, opacity })` |
| `className` | `""` | Extra class(es) on the root element |
| `fieldAlliances` | `null` | Which field end is red. The data doesn't say, so by default both ends are neutral. `"red-first"` (red at the top/left end), `"blue-first"`, or `(field) => …` per field |
| `showPitNumbers` / `showPitAddresses` | from data | Override what's shown under the team number |
| `showTeamNames` | `"zoom"` | Team names inside pits: `true`, `false`, or once zoomed in |
| `tooltip` | `true` | Hover tooltip: `true`, `false`, or a [content function](#tooltip-popup-and-click) |
| `popup` | `true` | Click popup content: `true` (same as tooltip), `false`, or a content function |
| `clickAction` | `"popup"` | `"popup"`, `"tooltip"`, `"focus"` (zoom to pit), `"none"`, or `(detail) => …` |
| `controls` | `true` | Zoom in / out / fit buttons |
| `zoom` | `true` | Pan & zoom (drag, pinch, double-click, keyboard) |
| `scrollZoom` | `"modifier"` | Wheel zoom: `true`, `false`, or only with ctrl/⌘ (avoids hijacking page scroll) |
| `maxZoom` | `8` | Maximum zoom relative to the whole map |
| `pitSizeMeters` | `3` | Size of a standard pit (3 × 3 m); sets the map scale for route distances |
| `metersPerCell` | auto | Override the scale (default: `pitSizeMeters` / pit size in cells, i.e. 1.5 m for 2×2-cell pits) |
| `walkingSpeed` | `1.3` | m/s, for route walking time |
| `onPitClick` / `onPitHover` | `null` | Callbacks (same as `map.on(...)`); return `false` from `onPitClick` to skip the click action |

## Styling

Pick a preset, then override any token. Presets: `auto` (default, light/dark from the OS), `light`, `dark`, `ftcscout`, `ftcscout-dark`, `ftc-events`.

```js
new PitMap(el, { data, theme: "ftc-events" });

// Tokens layered over a preset
new PitMap(el, {
    data,
    theme: {
        base: "ftcscout",
        pitRadius: 0.25,          // map cells
        fontFamily: "'Space Grotesk', sans-serif",
        route: "#e11d48",
        routeCornerRadius: 0,     // sharp corners
    },
});
```

**CSS variables.** Any token can be a CSS expression, resolved against the page:

```js
theme: { base: "light", route: "var(--brand)", background: "var(--card-bg, white)", fontFamily: "var(--font-family)" }
```

When `<html>` or `<body>` changes class/style/`data-theme` (a dark-mode toggle), the map re-reads the variables and re-renders. The `ftcscout` preset works this way: inside FTCScout it uses the site's own variables (`--fg-color`, `--theme-color`, `--sep-color`, `--red-team-color`, `--font-family`, …), so it follows `body.dark` automatically. Outside FTCScout it falls back to FTCScout's light colors (`ftcscout-dark` falls back to the dark ones). The `ftc-events` preset copies FTC-Events' own pit map: flat raw event colors, black outlines, outlined fields with alliance stations, Roboto, and cyan selection.

**Tokens** (see `Theme` in `pit-map.d.ts`; color tokens accept `"none"` to switch a part off):

| Group | Tokens |
| --- | --- |
| Surfaces | `background`, `gridDot`, `wall`, `wallRadius`, `elementStroke`, `elementStrokeWidth`, `shadow`, `focus` |
| Corners | `pitRadius`, `objectRadius`, `fieldRadius`, `wallRadius` (map cells; up to half the short side gives pills/circles), `routeCornerRadius`, `uiRadius` (px) |
| Pits | `pitBase`, `pitMix` (0 = raw event colors), `pitDefault`, `pitEmpty`, `pitStroke`, `pitStrokeWidth`, `pitRadius`, `pitGap`, `textDark`, `textLight` |
| Areas | `objectFill`, `objectHatch` (`"none"` = solid), `objectStroke`, `objectText`, `objectRadius`, `label`, `labelTransform`, `labelLetterSpacing` |
| Fields | `fieldStyle` (`"detailed"` / `"stations"`), `fieldRadius`, `fieldZone`, `fieldMat`, `fieldTile`, `fieldStation`, `fieldRed`, `fieldBlue`, `fieldStroke`. The field square is centered on the element's long axis; the extra length becomes an alliance station at each end, neutral (`fieldStation`) unless `fieldAlliances` says which end is red |
| Text | `fontFamily`, `uiFontFamily`, `numberSize` (fraction of pit height), `numberWeight`, `subWeight`, `nameWeight`, `labelWeight` |
| Selection | `highlight`, `outline`, `outlineWidth`, `hoverStroke`, `hoverStrokeWidth`, `glow`, `dimOpacity` |
| Route | `route`, `routeCasing`, `routeWidth`, `routeCasingWidth`, `routeCornerRadius`, `routeDash` |
| UI | `tooltipBg`, `tooltipText`, `tooltipMuted`, `tooltipBorder`, `controlBg`, `controlText`, `uiRadius` (px) |

**Per pit:** `pitStyle: (team, el, { highlighted }) => team && myTeams.has(team.number) ? { stroke: "#16a34a", strokeWidth: 0.15 } : null`.

**CSS.** The root has class `ftcpm` (plus `className`). Inside: `.ftcpm-tip` (tooltip), `.ftcpm-popup`, `.ftcpm-ctrl` (zoom buttons), and SVG groups `.ftcpm-pits`, `.ftcpm-pit`, `.ftcpm-num`, `.ftcpm-sub`, `.ftcpm-name`, `.ftcpm-route`. The web component exposes `::part(map)`, `::part(tooltip)`, `::part(popup)` and `::part(controls)`.

## Tooltip, popup and click

Hovering shows the **tooltip**. Clicking runs the **click action**, which by default opens a **popup** pinned to the pit. The popup stays put while you pan, can contain links and buttons, and closes on Esc, a click elsewhere, or `ctx.close()`.

Content functions get `(team, element, ctx)` and return an HTML string, a DOM node, or `false` (show nothing). `ctx.defaultContent()` gives the built-in content to extend:

```js
new PitMap(el, {
    data,
    tooltip: (team) => team && `<b>${team.number}</b> ${team.name}`,
    popup: (team, element, ctx) => {
        const box = ctx.defaultContent();
        const link = document.createElement("a");
        link.href = `https://ftcscout.mmathijs.nl/teams/${team.number}`;
        link.textContent = "View on FTCScout →";
        box.append(link);
        return box;
    },
});
```

Replace the click behavior entirely:

```js
clickAction: ({ team }) => router.push(`/teams/${team.number}`)   // or "focus" | "tooltip" | "none"

// or per click: skip the built-in action
map.on("pitclick", (detail) => {
    if (detail.team?.number === "16236") detail.preventDefault();  // or return false
});
```

With the web component, `pitclick` is a cancelable DOM event: `el.addEventListener("pitclick", (e) => e.preventDefault())`. Set functions through `.options`: `el.options = { popup: (team, el, ctx) => … }`.

## Methods

| Method | |
| --- | --- |
| `setData(data)` | Load another map (resets the view) |
| `update(options)` | Change any options |
| `setHighlight(teams, color?)` / `setOutline(teams, color?)` | Shortcuts for `update` |
| `focusTeam(team, { cells, keepZoom, onlyIfHidden, flash })` | Smoothly bring a pit into view and flash it. `cells`: area width to show (default 22; `0.5` = half the map). `keepZoom`: only pan. `onlyIfHidden`: skip if already visible. Returns `false` if the team isn't on the map |
| `fit()` / `zoomBy(factor)` | Whole map / zoom in (<1) or out (>1) |
| `getTeams()` / `findTeams(query)` / `hasTeam(team)` | Team list and search by number, name or pit address |
| `showRoute(from, to)` / `route(from, to)` / `clearRoute()` | Walking route from/to a team, `"field"`, `"queue"`, an area name (`"Pit Admin"`, `{ area: /inspect/i }`) or `{x, y}`; returns meters and seconds. Routes only run horizontally/vertically along the aisles, with as few turns as possible |
| `getAreas()` | Named destinations on the map: fields, queues and labelled areas |
| `openPopup(team)` / `closePopup()` | Open/close the click popup from code |
| `defaultContent(element)` | The built-in tooltip/popup content as a DOM node |
| `refreshTheme()` | Re-read CSS variables (automatic with `watchTheme`) |
| `toSVGString()` / `toPNG({ scale })` | Export the whole map |
| `on(event, fn)` | `pitclick`, `pithover`, `viewchange`, `popupopen`, `popupclose`; returns an unsubscribe function |
| `destroy()` | Remove everything |

Keyboard (when the map has focus): arrows pan, `+` / `-` zoom, `0` fits, `Esc` closes the popup / clears the route.

## Build

```bash
npm run build   # from the ftc-embeds root: dist/pit-map.mjs, dist/pit-map.umd.js, dist/pit-map-demo.html
```
