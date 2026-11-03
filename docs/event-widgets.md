# Event widgets

Widgets about one event, for event, league and region websites. Each is a separate module, web component and iframe page:

| Widget | Element | Shows |
| --- | --- | --- |
| [event-rankings](event-rankings.md) | `<ftc-event-rankings>` | the rankings: rank, RP, record, matches, OPR (or with `team`: of that team's current or latest event) |
| [event-matches](event-matches.md) | `<ftc-event-matches>` | the match schedule and results, the next match marked |
| [event-advancement](event-advancement.md) | `<ftc-event-advancement>` | the slots, each team's advancement points, who advanced |
| [league-standings](league-standings.md) | `<ftc-league-standings>` | a league's standings, from any of its meets |
| [countdown](countdown.md) | `<ftc-countdown>` | a countdown to the event (or with `team`: to a team's next match or event) |

They take an event code and a season (`event="NLCMP" season="2025"`; the season defaults to the current one), and load from FTCScout's ftc-embeds API like the team widgets (see [api.md](api.md)).

```html
<script type="module" src="https://ftc-embeds.com/lib/event-rankings.mjs"></script>
<ftc-event-rankings event="NLCMP" season="2025" highlight="19444"></ftc-event-rankings>
```

## Options

The event widgets take the [team widgets' options](team-widgets.md#options) (theme, layout, density, hide, limit, max-height, title, links, text, locale, css, …) with `event` instead of `team`, and:

| Option | Attribute | |
| --- | --- | --- |
| `event` | `event` | the event code, e.g. `NLCMP` |
| `season` | `season` | the event's season (default: the current one) |
| `highlight` | `highlight` | team numbers to mark: `"19444,16236"` |
| `refresh` | `refresh` | seconds between refreshes while the event is on (default 30) |
| `scrollTo` | `scroll-to` | with `max-height`: the row to scroll to: `auto` (the next match, else the highlighted team), `team`, `next`, `none` |
| `scrollOffset` | `scroll-offset` | rows to keep above that row (default: centered) |

Themes, icons, texts and `::part()` styling work as described in [team-widgets.md](team-widgets.md); the event widgets' texts are in `TEAM_TEXT` too.

## Live updates

While the event is on, the live event widgets refresh every 30 seconds (`refresh`) while the page is visible. The API keeps their answers for at most 30 seconds.

## Iframes

Every widget has an iframe page (`https://ftc-embeds.com/embed/<widget>?event=…`), with any option as a URL parameter. It posts `{ type: "ftc-embeds:height", page: "event-rankings", widget: "EventRankings", height }` to the parent whenever its height changes. Add `<script src="https://ftc-embeds.com/embed/resize.js" async></script>` once to the page and the iframes size themselves to their widget (`data-ftc-height="fixed"` on an iframe opts out). With `max-height` the widget scrolls inside, and to the highlighted team or the next match.

## Divisions

A championship with divisions ranks and schedules its teams per division. The widgets show the championship's divisions as buttons to switch between, or take a division's code directly (`event="NLCMPOCK1"`).
