# Next match (`ftc-embeds/next-match`)

During an event: the team's next match (time, countdown, both alliances) and its last result and rank, refreshing every 30 seconds. Otherwise: its next event with a countdown.

```html
<script type="module" src="https://ftc-embeds.com/lib/next-match.mjs"></script>
<ftc-next-match team="19444" api-base="https://ftcscout-api.mmathijs.nl/rest/embeds/v1" layout="compact"></ftc-next-match>
```

```js
import { NextMatch, configure } from "ftc-embeds/next-match";

configure({ apiBase: "https://ftcscout-api.mmathijs.nl/rest/embeds/v1" });
const widget = new NextMatch(document.getElementById("here"), { team: 19444, theme: "trophy" });
```

Or as an iframe: `https://ftc-embeds.com/embed/next-match?team=19444&theme=dark` (any option as a URL parameter, `apiBase` included when the site's default isn't wanted; the page posts `{ type: "ftc-embeds:height", height }` to the parent so it can size the iframe).

## Options

All the [shared options](team-widgets.md#options) (team, season, theme, layout, density, hide, limit, max-height, link-to, text, locale, decimals, icons, css, skin, …), and:

| Option | Attribute | |
| --- | --- | --- |
| `refresh` | `refresh` | Seconds between refreshes during an event (default 30). |
| `layout` | `layout` | "list" (default) \| "compact" (two lines) |

**Parts for `hide`:** event, time, countdown, alliances, names, last, rank, upcoming.

**Style parts** (`ftc-next-match::part(…)` from the page): card, head, title, event, next, match, time, alliance, alliance-red, alliance-blue, team, team-me, alliances, last, rank, upcoming, countdown, idle, chip, chip-live, icon.

Data comes from the REST API ([docs/api.md](api.md)); see [team-widgets.md](team-widgets.md) for theming, icons and the trophy theme.
