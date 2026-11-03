# Team card (`ftc-embeds/team-card`)

A team's card: number, name, location, rookie year, website, the stats you pick, and its next or upcoming events.

```html
<script type="module" src="https://ftc-embeds.com/lib/team-card.mjs"></script>
<ftc-team-card team="19444" stats="opr,region-rank,record" upcoming="3"></ftc-team-card>
```

```js
import { TeamCard } from "ftc-embeds/team-card";

const widget = new TeamCard(document.getElementById("here"), { team: 19444, theme: "trophy" });
```

Or as an iframe, or a plain link (to share, or behind a QR code): `https://ftc-embeds.com/embed/team-card?team=19444&theme=dark` (any option as a URL parameter; the page posts `{ type: "ftc-embeds:height", height }` to the parent so it can size the iframe).

## Options

They use FTCScout's API by default; see [api.md](api.md) to use another.

All the [shared options](team-widgets.md#options) (team, season, theme, layout, density, hide, limit, max-height, link-to, text, locale, decimals, icons, css, skin, …), and:

| Option | Attribute | |
| --- | --- | --- |
| `stats` | `stats` | Stat tiles and their order: "opr,epa,record" (default). See TEAM_CARD_STATS. |
| `statLabels` | `stat-labels` | Rename stat labels: { opr: "Power" }. |
| `statColumns` | `stat-columns` | Columns of the stat grid; default: as many as stats, up to 3 (4 stats: 2 by 2). |
| `upcoming` | `upcoming` | How many upcoming events to list: 1 = the "Next:" line (default), 0 = none. |
| `layout` | `layout` | "list" (default) \| "compact" (one row, stats inline) |

**Stats** (`stats`, in the order given): `opr`, `epa` (with world rank), `region-rank` (OPR rank in the team's home region), `record` and `record-total` (season / all time), `win-rate`, `awards` and `awards-total` (with how many were won), `matches` and `matches-total`, `events` and `events-total`, `seasons`, `rookie` (registered since). The season and all-time numbers come from `GET /teams/{n}/stats` (REST only).

**Parts for `hide`:** avatar, number, location, rookie, website, stats, stat-detail, next-event.

**Style parts** (`ftc-team-card::part(…)` from the page): card, header, number, name, meta, location, rookie, website, avatar, stats, stat, stat-&lt;key&gt;, stat-label, stat-value, stat-detail, next-event, upcoming, upcoming-event, upcoming-date, event, chip, chip-live, chip-upcoming, icon, icon-&lt;name&gt;.

Data comes from the REST API ([docs/api.md](api.md)); see [team-widgets.md](team-widgets.md) for theming, icons and the trophy theme.
