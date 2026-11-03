# Event rankings (`ftc-embeds/event-rankings`)

An event's rankings: rank, team, ranking points, record, matches played and OPR, refreshing every 30 seconds while the event is on. Championships with divisions show buttons to switch between the divisions.

```html
<script type="module" src="https://ftc-embeds.com/lib/event-rankings.mjs"></script>
<ftc-event-rankings event="NLCMP" season="2025" highlight="19444" limit="8"></ftc-event-rankings>
```

```js
import { EventRankings } from "ftc-embeds/event-rankings";

const widget = new EventRankings(document.getElementById("here"), { event: "NLHAQ", season: 2025, columns: "rp,tb1,record", theme: "dark" });
```

Or as an iframe, or a plain link: `https://ftc-embeds.com/embed/event-rankings?event=NLHAQ&season=2025&theme=dark` (any option as a URL parameter; the page posts `{ type: "ftc-embeds:height", height }` to the parent so it can size the iframe).

## Options

All the [event widgets' options](event-widgets.md#options) (event, season, highlight, refresh, theme, density, hide, limit, max-height, text, css, …), and:

| Option | Attribute | |
| --- | --- | --- |
| `columns` | `columns` | which columns, in order: `rp,record,matches,opr` (default); any of `rp`, `tb1`, `tb2`, `record`, `matches`, `opr` |
| `limit` | `limit` | show the top N, plus the highlighted teams below them |
| `maxHeight` | `max-height` | scroll inside the widget; it scrolls to the highlighted team |

**Parts for `hide`:** event, date, location, type, names, divisions.

**Style parts** (`ftc-event-rankings::part(…)` from the page): card, head, title, event, date, location, type, table, row, row-me, rank, team, name, col, col-rp, col-tb1, col-tb2, col-record, col-matches, col-opr, divisions, division, chip-live.

Data comes from `GET {apiBase}/events/{season}/{code}/rankings` ([docs/api.md](api.md)).
