# Awards (`ftc-embeds/team-awards`)

Every award a team won, by season: a list, or a strip of award cards. Cards have classes for styling by kind: alliance/judged, p1/p2/…, won, type-<Award>.

```html
<script type="module" src="https://ftc-embeds.com/lib/team-awards.mjs"></script>
<ftc-team-awards team="19444" layout="strip" theme="trophy"></ftc-team-awards>
```

```js
import { TeamAwards } from "ftc-embeds/team-awards";

const widget = new TeamAwards(document.getElementById("here"), { team: 19444, theme: "trophy" });
```

Or as an iframe, or a plain link (to share, or behind a QR code): `https://ftc-embeds.com/embed/team-awards?team=19444&theme=dark` (any option as a URL parameter; the page posts `{ type: "ftc-embeds:height", height }` to the parent so it can size the iframe).

## Options

They use FTCScout's API by default; see [api.md](api.md) to use another.

All the [shared options](team-widgets.md#options) (team, season, theme, layout, density, hide, limit, max-height, link-to, text, locale, decimals, icons, css, skin, …), and:

| Option | Attribute | |
| --- | --- | --- |
| `seasons` | `seasons` | Only the last N seasons with awards. |
| `onlyWon` | `only-won` | Only awards won outright (first place, winning alliance). |
| `types` | `types` | Only these award types: "Inspire,Think,Winner". |
| `layout` | `layout` | "list" (default) \| "strip" (award cards) \| "banners" (FTC-style banners: a heading per season, orange, silver and bronze by place, a gold border on Winning Alliance and Inspire) |

**Parts for `hide`:** count, icon, placement, event, season, date.

**Style parts** (`ftc-team-awards::part(…)` from the page): card, head, title, count, season-group, season, award, award-won, award-alliance, award-judged, award-card, award-card-won, award-card-alliance, award-card-judged, award-name, placement, event, date, strip, arrows, arrow, icon, icon-&lt;name&gt;.

Data comes from the REST API ([docs/api.md](api.md)); see [team-widgets.md](team-widgets.md) for theming, icons and the trophy theme.

## Banners

`layout="banners"` draws every award as a tall banner, grouped by season, in one row that scrolls sideways. Change the look with CSS variables on the element:

```css
ftc-team-awards {
    --ftcw-banner-width: 240px;            /* height follows (5:8) */
    --ftcw-banner-first: linear-gradient(#e88a49, #df7a35);
    --ftcw-banner-second: linear-gradient(#b3b3b3, #a3a3a3);
    --ftcw-banner-third: linear-gradient(#ad7f32, #ad5f12);
    --ftcw-banner-other: #777;
    --ftcw-banner-gold: #facc15;            /* Winning Alliance and Inspire */
}
```

Put your own logo on them with `icons`: `icons='{"trophy":"https://example.org/ftc-logo.png","medal":"https://example.org/ftc-logo.png"}'`. Style parts: `banner`, `banner-won`, `banner-alliance`, `banner-judged`, `season-group`, `season`, `event`, `award-name`, `placement`.
