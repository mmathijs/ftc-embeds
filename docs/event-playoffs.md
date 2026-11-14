# Playoffs (`ftc-embeds/event-playoffs`)

An event's playoffs: the alliances (captain, first and second pick) with the winner and finalist marked, and the bracket. From the 2023 season on that's double elimination: the upper bracket, the lower bracket (an alliance's second chance after its first loss) and the finals; before 2023, best-of-3 semifinals and finals. It fills in as matches are played and refreshes every 30 seconds while the event is on.

```html
<script type="module" src="https://ftc-embeds.com/lib/event-playoffs.mjs"></script>
<ftc-event-playoffs event="NLHAQ" season="2025" highlight="19444"></ftc-event-playoffs>
```

```js
import { EventPlayoffs } from "ftc-embeds/event-playoffs";

new EventPlayoffs(document.getElementById("here"), { event: "NLHAQ", season: 2025, hide: "alliances" });
```

Or as an iframe, or a plain link (it embeds itself when pasted in WordPress): `https://ftc-embeds.com/embed/event-playoffs?event=NLHAQ&season=2025`.

**Where the alliances come from.** The API has no list of alliances, so the widget reads them from the playoff matches (each team's role: captain, first or second pick) and numbers them A1, A2, … by their captains' qualification rank, the order alliance selection goes in. Until the first playoff match is scheduled there's nothing to show yet. At a championship whose teams ranked in their divisions the captains have no rank at the event itself; the alliances are then named by their captain instead of a guessed number. The bracket's rounds follow from the results: an alliance plays in the upper bracket until it loses once, in the lower bracket until it loses twice, and the last two alliances meet in the finals. `playoffBracket(data)` and `playoffAlliances(data)` are exported for your own views.

## Options

All the [event widgets' options](event-widgets.md#options) (event, season, highlight, refresh, theme, density, hide, text, lang, css, …). `highlight` marks the alliances and matches of those teams. The bracket's columns are 176px wide (`--ftcw-bracket-width`); narrow widgets scroll them sideways.

**Parts for `hide`:** event, date, location, type, alliances, bracket, games (the scores of each finals match), time (of matches still to play).

**Style parts** (`ftc-event-playoffs::part(…)` from the page): card, head, title, event, alliances, alliance, alliance-me, seed, team, result, brackets, bracket, bracket-upper, bracket-lower, bracket-finals, round, match, match-me, alliance-red, alliance-blue, games.

Data comes from `GET {apiBase}/events/{season}/{code}/playoffs` ([docs/api.md](api.md)).
