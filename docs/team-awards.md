# Awards (`ftc-embeds/team-awards`)

Every award a team won, by season: a list, or a strip of award cards. Cards have classes for styling by kind: alliance/judged, p1/p2/…, won, type-<Award>.

```html
<script type="module" src="https://ftc-embeds.com/lib/team-awards.mjs"></script>
<ftc-team-awards team="19444" api-base="https://ftcscout-api.mmathijs.nl/rest/embeds/v1" layout="strip" theme="trophy"></ftc-team-awards>
```

```js
import { TeamAwards, configure } from "ftc-embeds/team-awards";

configure({ apiBase: "https://ftcscout-api.mmathijs.nl/rest/embeds/v1" });
const widget = new TeamAwards(document.getElementById("here"), { team: 19444, theme: "trophy" });
```

Or as an iframe: `https://ftc-embeds.com/embed/team-awards?team=19444&theme=dark` (any option as a URL parameter, `apiBase` included when the site's default isn't wanted; the page posts `{ type: "ftc-embeds:height", height }` to the parent so it can size the iframe).

## Options

All the [shared options](team-widgets.md#options) (team, season, theme, layout, density, hide, limit, max-height, link-to, text, locale, decimals, icons, css, skin, …), and:

| Option | Attribute | |
| --- | --- | --- |
| `seasons` | `seasons` | Only the last N seasons with awards. |
| `onlyWon` | `only-won` | Only awards won outright (first place, winning alliance). |
| `types` | `types` | Only these award types: "Inspire,Think,Winner". |
| `layout` | `layout` | "list" (default) \| "strip" (award cards) |

**Parts for `hide`:** count, icon, placement, event, season, date.

**Style parts** (`ftc-team-awards::part(…)` from the page): card, head, title, count, season-group, season, award, award-won, award-alliance, award-judged, award-card, award-card-won, award-card-alliance, award-card-judged, award-name, placement, event, date, strip, arrows, arrow, icon, icon-&lt;name&gt;.

Data comes from the REST API ([docs/api.md](api.md)); see [team-widgets.md](team-widgets.md) for theming, icons and the trophy theme.
