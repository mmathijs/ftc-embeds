# Pit display (`ftc-embeds.com/display`)

A full-screen page for the TV or laptop in your pit: the team's next match (with both alliances and a countdown), its standing (rank, record, RP, OPR), its matches and the event's live rankings. It finds the team's current event by itself, refreshes every 30 seconds during the event (and every 5 minutes before it, so it can be set up the evening before), keeps the screen awake, and keeps showing the last data when the venue's wifi drops.

```
https://ftc-embeds.com/display?team=19444
```

[ftc-embeds.com/display](https://ftc-embeds.com/display) sets it up with a live preview and gives the link to open on the screen. Press **F** there for full screen.

## Parameters

| Parameter | Values | |
| --- | --- | --- |
| `team` | team number | required |
| `event` | event code | this event instead of the team's current one (a division, say) |
| `season` | year | another season |
| `theme` | `dark` (default), `light`, `auto` | the colors; `auto` follows the device |
| `lang` | `nl`, `de`, `fr`, `es` | the language of every text ([languages](team-widgets.md#languages)) |
| `size` | `s`, `m` (default), `l`, `xl`, or a factor (`1.2`) | the text size |
| `spacing` | `compact`, `normal` (default), `roomy`, or a factor | the space in and between the sections |
| `hide` | `next`, `matches`, `standing`, `rankings`, `clock`, `footer` | parts to leave out, comma-separated; with one side empty the other takes the whole width |
| `side` | `right` (default), `left` | where the rankings (and standing) go |
| `split` | `30`–`70` (default `50`) | the width of the team's column, in percent |
| `columns` | `rp,record,opr` (default) | the ranking columns: any of `rp`, `tb1`, `tb2`, `record`, `winrate`, `matches`, `opr`, `epa`, `dqs` |
| `highlight` | team numbers | other teams to mark in the rankings, e.g. your alliance partners |
| `accent` | hex color without `#` (`0066b3`) | the accent color (default ftc-embeds' orange) |
| `frame` | `false` | no frame around the screen |
| `hour-cycle` | `12`, `24` | the clock and match times |
| `time-zone` | `Europe/Amsterdam` | the clock and match times |

The display's **Change** button (bottom right, when the mouse moves) opens the setup page with its settings.
