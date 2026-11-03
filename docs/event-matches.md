# Event matches (`ftc-embeds/event-matches`)

An event's match schedule and results: match, time (in the event's time zone, unless `timeZone` says otherwise; `hourCycle` picks 12 or 24 hours), both alliances and the score, grouped by day for multi-day events. While the event is on, the next match is marked and the widget refreshes every 30 seconds. With `team`, it shows one team's matches.

```html
<script type="module" src="https://ftc-embeds.com/lib/event-matches.mjs"></script>
<ftc-event-matches event="NLCMP" season="2025" highlight="19444"></ftc-event-matches>
<ftc-event-matches event="NLCMP" season="2025" team="19444" state="upcoming" limit="3"></ftc-event-matches>
```

```js
import { EventMatches } from "ftc-embeds/event-matches";

new EventMatches(document.getElementById("here"), { event: "NLHAQ", season: 2025, level: "playoffs" });
```

Or as an iframe, or a plain link: `https://ftc-embeds.com/embed/event-matches?event=NLHAQ&season=2025&level=quals`.

## Options

All the [event widgets' options](event-widgets.md#options) (event, season, highlight, refresh, theme, density, hide, limit, max-height, text, css, …), and:

| Option | Attribute | |
| --- | --- | --- |
| `team` | `team` | only this team's matches (and marked) |
| `names` | `names` | team names under the numbers (off by default) |
| `level` | `level` | `all` (default), `quals`, `playoffs` |
| `state` | `state` | `all` (default), `upcoming`, `played` |
| `limit` | `limit` | the first N matches (with `state="upcoming"`: the next N) |
| `maxHeight` | `max-height` | scroll inside the widget; it scrolls to the next match |

Surrogate matches have a `*`; no-shows and disqualified teams are struck through.

**Parts for `hide`:** event, date, location, type, time, days.

**Style parts** (`ftc-event-matches::part(…)` from the page): card, head, title, event, date, location, type, table, day, row, row-next, row-me, match, time, alliance, alliance-red, alliance-blue, score, name, chip-upcoming, chip-live.

Data comes from `GET {apiBase}/events/{season}/{code}/matches` ([docs/api.md](api.md)).
