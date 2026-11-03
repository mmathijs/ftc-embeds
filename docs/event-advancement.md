# Event advancement (`ftc-embeds/event-advancement`)

Who advances from an event: how many slots it has and to which event, each team's advancement points (qualification, alliance selection, playoffs, awards and the total), which teams advanced (a line under the last one), and why other teams can't (already advanced, another region, too many events). Points that aren't final yet are in italics. While the event is on it refreshes every minute.

FTCScout has advancement points from the 2025 season on.

```html
<script type="module" src="https://ftc-embeds.com/lib/event-advancement.mjs"></script>
<ftc-event-advancement event="NLCMP" season="2025" highlight="19444"></ftc-event-advancement>
```

```js
import { EventAdvancement } from "ftc-embeds/event-advancement";

new EventAdvancement(document.getElementById("here"), { event: "NLHAQ", season: 2025, columns: "total", limit: 10 });
```

Or as an iframe, or a plain link: `https://ftc-embeds.com/embed/event-advancement?event=NLHAQ&season=2025`.

## Options

All the [event widgets' options](event-widgets.md#options) (event, season, highlight, refresh, theme, density, hide, limit, max-height, text, css, …), and:

| Option | Attribute | |
| --- | --- | --- |
| `columns` | `columns` | which point columns, in order: `qual,alliance,playoff,award,total` (default) |
| `limit` | `limit` | the top N, plus the highlighted teams below them |
| `maxHeight` | `max-height` | scroll inside the widget; it scrolls to the highlighted team |

Narrow widgets show only the total.

**Parts for `hide`:** event, date, location, type, names, summary.

**Style parts** (`ftc-event-advancement::part(…)` from the page): card, head, title, event, date, location, type, summary, slots, reserved, advanced-count, table, row, row-me, row-advanced, rank, team, name, col, col-qual, col-alliance, col-playoff, col-award, col-total, status, chip-good.

Data comes from `GET {apiBase}/events/{season}/{code}/advancement` ([docs/api.md](api.md)).
