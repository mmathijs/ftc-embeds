# Countdown (`ftc-embeds/countdown`)

A countdown in days, hours, minutes and seconds:

- **to an event**: to its first day (midnight in the event's own time zone). While it's on: "Happening now", with a link to the livestream when the event has one. Afterwards: "This event is over."
- **for a team**: during an event, to the team's next match; otherwise to the team's next event this season.

```html
<script type="module" src="https://ftc-embeds.com/lib/countdown.mjs"></script>
<ftc-countdown event="FPEEUR" season="2025"></ftc-countdown>
<ftc-countdown team="19444" layout="compact"></ftc-countdown>
```

```js
import { Countdown } from "ftc-embeds/countdown";

new Countdown(document.getElementById("here"), { event: "NLCMP", season: 2026, theme: "dark" });
```

Or as an iframe, or a plain link: `https://ftc-embeds.com/embed/countdown?team=19444&theme=dark`. Good for team socials and event pages.

## Options

The [shared options](team-widgets.md#options) (theme, density, hide, title, text, locale, css, …) with `event` + `season`, or `team`, and:

| Option | Attribute | |
| --- | --- | --- |
| `layout` | `layout` | `boxes` (default) or `compact` (one line) |
| `refresh` | `refresh` | team mode: seconds between refreshes during the team's event (default 30) |

It ticks every second, and reloads when it reaches zero.

**Parts for `hide`:** event, date, location, stream.

**Style parts** (`ftc-countdown::part(…)` from the page): card, head, title, event, date, location, label, clock, unit, unit-days, unit-hours, unit-minutes, unit-seconds, state, chip-live.

Data comes from `GET {apiBase}/events/{season}/{code}/info` (an event) or `GET {apiBase}/teams/{number}/matches` (a team) ([docs/api.md](api.md)).
