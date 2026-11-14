# Event awards (`ftc-embeds/event-awards`)

Who won what at an event, grouped by award in ceremony order: the winning and finalist alliances (captain and picks) first, then the judged awards with their 1st, 2nd and 3rd places, Dean's List (with the student's name), and Inspire last. Championships with divisions show the division's alliances too. Before the awards are given it says they come at the end of the event.

```html
<script type="module" src="https://ftc-embeds.com/lib/event-awards.mjs"></script>
<ftc-event-awards event="NLCMP" season="2025" highlight="19444"></ftc-event-awards>
<ftc-event-awards event="NLCMP" season="2025" only-won types="Inspire,Think,Winner"></ftc-event-awards>
```

```js
import { EventAwards } from "ftc-embeds/event-awards";

new EventAwards(document.getElementById("here"), { event: "NLCMP", season: 2025, onlyWon: true });
```

Or as an iframe, or a plain link (it embeds itself when pasted in WordPress): `https://ftc-embeds.com/embed/event-awards?event=NLCMP&season=2025`.

## Options

All the [event widgets' options](event-widgets.md#options) (event, season, highlight, theme, density, hide, limit, text, lang, awardNames, css, …), and:

| Option | Attribute | |
| --- | --- | --- |
| `onlyWon` | `only-won` | only first places and the winning alliance |
| `types` | `types` | only these award types: `"Inspire,Think,Winner"` (`Winner`, `Finalist`, `Inspire`, `Think`, `Connect`, `Innovate`, `Control`, `Motivate`, `Design`, `Reach`, `Sustain`, `JudgesChoice`, `DeansListWinner`, …) |
| `limit` | `limit` | the first N awards |
| `highlight` | `highlight` | team numbers to mark |

**Parts for `hide`:** event, date, location, type, icon, placement, names, division.

**Style parts** (`ftc-event-awards::part(…)` from the page): card, head, title, event, award, award-alliance, award-judged, award-name, winner, winner-me, placement, name, person, icon. Classes for the `css` option: `.ag` (an award; `.alliance` / `.judged`, `.won`, `.type-Inspire`, …), `.aw-t` (a winner; `.me`).

Data comes from `GET {apiBase}/events/{season}/{code}/awards` ([docs/api.md](api.md)).
