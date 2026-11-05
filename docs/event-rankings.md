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

**For a team:** give `team` instead of `event`, and it shows the rankings of the event the team is at, or else its most recent event this season (or of `season`), with the team marked. Good on a team's own site: it moves on to the next event by itself.

```html
<ftc-event-rankings team="19444" limit="8"></ftc-event-rankings>
<ftc-event-rankings team="19444" events="tabs" max-height="400px"></ftc-event-rankings>
```

With `events="tabs"` it has a tab for every event the team was ranked at this season, newest first (like a "Detailed event results" box).

Or as an iframe, or a plain link: `https://ftc-embeds.com/embed/event-rankings?event=NLHAQ&season=2025&theme=dark` (any option as a URL parameter; the page posts `{ type: "ftc-embeds:height", height }` to the parent so it can size the iframe).

## Options

All the [event widgets' options](event-widgets.md#options) (event, season, highlight, refresh, theme, density, hide, limit, max-height, text, css, …), and:

| Option | Attribute | |
| --- | --- | --- |
| `layout` | `layout` | `list` (a table, the default), `cards` (a leaderboard: a card per team, gold, silver and bronze for the top three), `podium` (the top three on a podium, then the others as a table) or `strip` (scrolling tiles) |
| `events` | `events` | team mode: `tabs` for a tab per event of the team this season |
| `columns` | `columns` | which columns, in order: `rp,record,matches,opr` (default); any of `rp`, `tb1`, `tb2`, `record`, `winrate` (win %), `matches`, `opr`, `epa`, `dqs` |
| `limit` | `limit` | show the top N, plus the highlighted teams below them (with `podium`, the three on the podium count) |
| `maxHeight` | `max-height` | scroll inside the widget; it scrolls to the highlighted team |

**Parts for `hide`:** event, date, location, type, names, divisions.

**Style parts** (`ftc-event-rankings::part(…)` from the page): card, head, title, event, date, location, type, table, row, row-me, rank, team, name, col, col-rp, col-tb1, col-tb2, col-record, col-winrate, col-matches, col-opr, col-epa, col-dqs, divisions, division, events, event-tab, chip-live; with `cards`, `strip` and `podium` also stats, tile, tile-me, podium, step, step-me, strip, arrows, arrow.

```html
<ftc-event-rankings event="NLHAQ" season="2025" layout="cards" highlight="19444" limit="8"></ftc-event-rankings>
<ftc-event-rankings event="NLHAQ" season="2025" layout="podium" limit="8"></ftc-event-rankings>
```

Data comes from `GET {apiBase}/events/{season}/{code}/rankings` ([docs/api.md](api.md)).
