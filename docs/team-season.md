# Season + next match (`ftc-embeds/team-season`)

team-results and next-match in one: during an event the next match and last result on top, the season's results below; otherwise the next event and the results.

```html
<script type="module" src="https://ftc-embeds.com/lib/team-season.mjs"></script>
<ftc-team-season team="19444" layout="strip"></ftc-team-season>
```

```js
import { TeamSeason } from "ftc-embeds/team-season";

const widget = new TeamSeason(document.getElementById("here"), { team: 19444, theme: "trophy" });
```

Or as an iframe, or a plain link (to share, or behind a QR code): `https://ftc-embeds.com/embed/team-season?team=19444&theme=dark` (any option as a URL parameter; the page posts `{ type: "ftc-embeds:height", height }` to the parent so it can size the iframe).

## Options

They use FTCScout's API by default; see [api.md](api.md) to use another.

All the [shared options](team-widgets.md#options) (team, season, theme, layout, density, hide, limit, max-height, link-to, text, locale, decimals, icons, css, skin, …), and:

| Option | Attribute | |
| --- | --- | --- |
| `liveLayout` | `live-layout` | The live part's layout: "list" | "compact" (default: compact with layout "strip"). |
| `refresh` | `refresh` | Seconds between refreshes during an event (default 30). |
| `layout` | `layout` | "list" (default) \| "strip" (results as tiles; the live part compact) |

**Parts for `hide`:** live, upcoming, team, plus those of team-results and next-match.

**Style parts** (`ftc-team-season::part(…)` from the page): those of team-results and next-match, plus live.

Data comes from the REST API ([docs/api.md](api.md)); see [team-widgets.md](team-widgets.md) for theming, icons and the trophy theme.
