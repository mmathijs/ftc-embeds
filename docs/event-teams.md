# Event teams (`ftc-embeds/event-teams`)

The teams at an event, also before it starts ("who's coming"): avatar, number, name and place, with a Rookie chip for first-year teams. Once matches are played they're in rank order with their rank (and record in the table). During the event it refreshes every 5 minutes.

```html
<script type="module" src="https://ftc-embeds.com/lib/event-teams.mjs"></script>
<ftc-event-teams event="NLHAQ" season="2025" highlight="19444"></ftc-event-teams>
<ftc-event-teams event="NLHAQ" season="2025" layout="list" order="name"></ftc-event-teams>
```

```js
import { EventTeams } from "ftc-embeds/event-teams";

new EventTeams(document.getElementById("here"), { event: "NLHAQ", season: 2025, layout: "list" });
```

Or as an iframe, or a plain link (it embeds itself when pasted in WordPress): `https://ftc-embeds.com/embed/event-teams?event=NLHAQ&season=2025`.

## Options

All the [event widgets' options](event-widgets.md#options) (event, season, highlight, theme, density, hide, limit, max-height, text, lang, css, …), and:

| Option | Attribute | |
| --- | --- | --- |
| `layout` | `layout` | `grid` (tiles with avatars, the default) or `list` (a table) |
| `order` | `order` | `auto` (by rank once there are ranks, else by number; the default), `number`, `name`, `rank` |
| `refresh` | `refresh` | seconds between refreshes while the event is on (default 300) |

The tiles are at least 200px wide: `--ftcw-team-tile-width: 160px` from the page changes that.

**Parts for `hide`:** event, date, location, type, count, avatar, names, rank, rookie.

**Style parts** (`ftc-event-teams::part(…)` from the page): card, head, title, event, count, teams, team, team-me, avatar, rank, name, location, chip-rookie; in the table also table, row, row-me, record.

Data comes from `GET {apiBase}/events/{season}/{code}/teams` ([docs/api.md](api.md)).
