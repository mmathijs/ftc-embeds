# Season results (`ftc-embeds/team-results`)

A team's events in a season, newest first: dates, rank and record, awards, advancement; upcoming events with a countdown, live ones marked.

```html
<script type="module" src="https://ftc-embeds.com/lib/team-results.mjs"></script>
<ftc-team-results team="19444" api-base="https://ftcscout-api.mmathijs.nl/rest/embeds/v1" layout="strip" skip-types="Scrimmage"></ftc-team-results>
```

```js
import { TeamResults, configure } from "ftc-embeds/team-results";

configure({ apiBase: "https://ftcscout-api.mmathijs.nl/rest/embeds/v1" });
const widget = new TeamResults(document.getElementById("here"), { team: 19444, theme: "trophy" });
```

Or as an iframe: `https://ftc-embeds.com/embed/team-results?team=19444&theme=dark` (any option as a URL parameter, `apiBase` included when the site's default isn't wanted; the page posts `{ type: "ftc-embeds:height", height }` to the parent so it can size the iframe).

## Options

All the [shared options](team-widgets.md#options) (team, season, theme, layout, density, hide, limit, max-height, link-to, text, locale, decimals, icons, css, skin, …), and:

| Option | Attribute | |
| --- | --- | --- |
| `order` | `order` | "newest" (default) | "oldest". |
| `skipTypes` | `skip-types` | Leave out event types: "Scrimmage,LeagueMeet". |
| `layout` | `layout` | "list" (default) \| "strip" (scrolling tiles, fixed height) |

**Parts for `hide`:** date, type, location, division, rank, record, awards, advanced, team.

**Style parts** (`ftc-team-results::part(…)` from the page): card, head, title, rows, row, tile, event, division, meta, date, chips, chip, chip-award, chip-award-won, chip-good, chip-live, chip-upcoming, result, rank, record, icons, strip, arrows, arrow, icon, icon-&lt;name&gt;.

Data comes from the REST API ([docs/api.md](api.md)); see [team-widgets.md](team-widgets.md) for theming, icons and the trophy theme.
