# League standings (`ftc-embeds/league-standings`)

A league's standings: rank, team, average ranking points and record. Give it any event of the league (one of its league meets, or the league tournament): the standings are the league's current ones, so a league website doesn't need to change the code after every meet. While a meet is on it refreshes every minute.

```html
<script type="module" src="https://ftc-embeds.com/lib/league-standings.mjs"></script>
<ftc-league-standings event="HUHWM3" season="2025" highlight="28903"></ftc-league-standings>
```

```js
import { LeagueStandings } from "ftc-embeds/league-standings";

new LeagueStandings(document.getElementById("here"), { event: "USNJNOLT2", season: 2025, limit: 10 });
```

Or as an iframe, or a plain link: `https://ftc-embeds.com/embed/league-standings?event=HUHWM3&season=2025`.

## Options

All the [event widgets' options](event-widgets.md#options) (event, season, highlight, refresh, theme, density, hide, limit, max-height, text, css, …). The heading is the league's name (`title` replaces it). `limit` shows the top N plus the highlighted teams; `max-height` scrolls to the highlighted team.

**Parts for `hide`:** region, parent, record, names.

**Style parts** (`ftc-league-standings::part(…)` from the page): card, head, title, league, league-info, table, row, row-me, rank, team, name, col, col-avg-rp, col-record.

Data comes from `GET {apiBase}/events/{season}/{code}/league` ([docs/api.md](api.md)). Events outside a league show "This event isn't part of a league."
