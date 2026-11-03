# Team widgets

Five widgets about one team, each a separate module, web component and iframe page:

| Widget | Element | Shows |
| --- | --- | --- |
| [team-card](team-card.md) | `<ftc-team-card>` | name, location, chosen stats, next/upcoming events |
| [team-results](team-results.md) | `<ftc-team-results>` | a season's events: rank, record, awards, advancement |
| [team-awards](team-awards.md) | `<ftc-team-awards>` | every award, by season |
| [next-match](next-match.md) | `<ftc-next-match>` | the next match and last result during an event |
| [team-season](team-season.md) | `<ftc-team-season>` | team-results + next-match in one |

They load from FTCScout's ftc-embeds API by default, so a widget needs nothing but a team number. For another API: `configure({ apiBase })` once per page, or the `api-base` attribute per widget (see [api.md](api.md)). The builder at [ftc-embeds.com/team](https://ftc-embeds.com/team) writes the code for you.

## Options

Every team widget takes these (as options, or kebab-case attributes on the element, or URL parameters on the iframe page). Object options can be given as JSON in attributes.

| Option | | |
| --- | --- | --- |
| `team` | number | the team |
| `season` | number | default: the current season |
| `theme` | name or object | `auto` (light/dark from the visitor), `light`, `dark`; `ftcscout`, `ftcscout-dark`, `ftcscout-auto`; `ftc-events`, `ftc-events-dark`, `ftc-events-auto`; `trophy` (dark), `trophy-light`, `trophy-auto`; or your own colors: `{ base: "auto", accent: "#e4002b", dark: { accent: "#ff6b6b" } }` (see [Theming](#theming)) |
| `shape` | name or object | corners, spacing and type, apart from the colors: `default`, `square`, `compact`, `spacious`, `bubbly`, `showcase`, `ftcscout`, `ftc-events`; or `{ base: "compact", radius: "2px" }`. Default: the theme's own |
| `layout` | | the widget's layouts (`list`, `strip`, `compact`) |
| `density` | `normal` \| `compact` | tighter spacing |
| `hide` | `"website,epa"` | parts to leave out (each widget lists its parts) |
| `limit` | number | show at most this many items |
| `maxHeight` | `"320px"` | scroll inside the widget |
| `title` | string | replace the heading; `""` hides it |
| `siteUrl` | URL | where names link to (default `https://ftcscout.mmathijs.nl`); `""` for no links |
| `linkTarget` | `_blank` \| `_self` \| `none` | |
| `bare` | boolean | no card around it |
| `icons` | object | replace icons (see below) |
| `css` | string | extra CSS inside the widget |
| `skin` | `trophy` | the trophy theme's look with another theme's colors |
| `apiBase`, `graphqlUrl` | URL | another API than FTCScout's (the default), per widget instead of `configure()` |
| `data` | object | show this data instead of loading it |
| `text` | object | change any text: `{ nextMatch: "Up next", awards: "Trophies" }` (see `TEAM_TEXT`; `{name}` is filled in) |
| `locale` | `"en-GB"` | dates, times and numbers (default: the visitor's) |
| `decimals` | number | OPR and EPA (default 1) |
| `numberFormat` | `point`, `comma`, `space`, `apostrophe`, `plain` | separators no matter the language: 1,234.5 · 1.234,5 · 1 234,5 · 1'234.5 · 1234.5 (default `locale`: the language's) |
| `dateFormat` | `short`, `long`, `numeric`, `iso` | event dates: Feb 7, 2026 (default) · February 7, 2026 · 2/7/2026 (in the language's order) · 2026-02-07 |
| `hourCycle` | `12`, `24` | match times on a 12- or 24-hour clock (default: the language's) |
| `timeZone` | `"Europe/Amsterdam"` | time zone of match times (default: the visitor's) |
| `awardNames` | object | rename awards: `{ Inspire: "Inspire Award" }` |
| `eventTypes` | object | rename event types: `{ Qualifier: "Kwalificatie" }` |
| `linkTo` | `ftcscout` \| `ftc-events` | where team and event names link to |
| `teamUrl`, `eventUrl` | template | your own links: `"https://example.org/teams/{team}"`, `"…/events/{season}/{code}"` |

## Theming

The look has two independent halves: the colors (`theme`, from `TEAM_THEMES`) and the shape (`shape`, from `TEAM_SHAPES`: corners, spacing and type). Any colors go with any shape. Without a `shape`, a theme brings its own (`TEAM_THEME_SHAPES`: the trophy case gets `showcase`, FTCScout and FTC Events get theirs, the rest `default`), so `theme="trophy"` looks as it always did and `theme="trophy" shape="square"` is the trophy case's colors on square corners.

```html
<ftc-team-card team="19444" theme="ftc-events-auto" shape="bubbly"></ftc-team-card>
```

**Your own colors.** A theme object puts tokens over a theme; tokens under `dark` apply only when the visitor is in dark mode, so one object can follow light/dark mode with your own colors:

```js
theme: {
    base: "auto",
    bg: "#fff7ed", surface: "#ffedd5", text: "#431407", muted: "#9a3412", border: "#fed7aa", accent: "#ea580c",
    dark: { bg: "#1c1917", surface: "#292524", text: "#fafaf9", muted: "#a8a29e", border: "#44403c", accent: "#fb923c" },
}
```

The six colors there (`bg`, `surface`, `text`, `muted`, `border`, `accent`) work for the pit map too. [ftc-embeds.com/setup](https://ftc-embeds.com/setup) has an editor for them, and saves them as templates in your browser.

Every token can also be set in a theme or shape object, or from the page with CSS variables, which pass into the widgets (`--ftcw-<kebab-name>`):

| Group | Tokens |
| --- | --- |
| Colors (`theme`) | `bg`, `surface`, `text`, `muted`, `border`, `accent`, `accentText`, `red`, `blue`, `good`, `bad`, `gold`, `shadow` |
| Corners (`shape`, like the rows below) | `radius` (the card), `innerRadius` (tiles, stat blocks), `chipRadius` (chips, scroll buttons), `avatarRadius` (4px, like FTCScout) |
| Spacing and sizes | `padding`, `gap` (stat blocks, tiles, alliances), `rowPadding` (list rows), `borderWidth`, `avatarSize`, `tileWidth`, `tileHeight`, `cardHeight` (award cards) |
| Type | `font`, `fontSize`, `smallSize`, `lineHeight`, `titleSize`, `titleWeight`, `titleTransform`, `titleLetterSpacing`, `nameSize` and `nameWeight` (team card name), `valueSize` and `valueWeight` (stat values, ranks), `labelTransform` and `labelLetterSpacing` (small labels) |
| Chips and icons | `chipFontSize`, `chipWeight`, `chipPadding`, `iconSize` |
| Lines and glow | `separatorWidth` (between rows), `glow` (around won awards, live and upcoming tiles; `"0 0 0 0"` for none), `glowRoom` (room around strips so glows aren't cut off) |

```css
ftc-team-awards { --ftcw-accent: #e4002b; --ftcw-radius: 4px; --ftcw-inner-radius: 0; --ftcw-gap: 16px; --ftcw-font: Georgia, serif; }
```

`theme="ftcscout"` reads FTCScout's own variables (so on FTCScout it follows its dark mode); `ftcscout-dark` is the same with FTCScout's dark colors as fallback, for dark pages elsewhere. `theme="trophy"` is a trophy case: dark slate, metallic award cards and stat tiles, amber for wins, orange for won judged awards; `trophy-light` is the same on warm paper. `ftc-events-dark` is FTC Events' look on a dark page.

Every look comes in light, dark and a version that follows the visitor's light or dark mode: `auto` (light/dark), `ftcscout-auto`, `ftc-events-auto` and `trophy-auto`. `TEAM_THEME_MODES` lists which two themes each one switches between.

## Texts

Every text a widget shows is in `TEAM_TEXT`. Change any of them with `text`:

```html
<ftc-team-awards team="19444" text='{"awards":"Trophy cabinet","awardCount":["{n} trophy","{n} trophies"]}'></ftc-team-awards>
```

`{name}` placeholders are filled in, and a pair `[one, other]` picks by number. Dates, times and numbers follow `locale`; award and event type names change with `awardNames` and `eventTypes`.

## Icons

Icons: `trophy`, `medal`, `advanced`, `upcoming`, `calendar`, `location`, `website`, `prev`, `next`. Change one from the page:

```css
ftc-team-awards { --ftcw-icon-trophy: "★"; --ftcw-icon-medal: "☆"; }
```

or with the `icons` option: text, an `<svg …>` string, or an image URL (`""` hides it):

```js
new TeamAwards(el, { team: 19444, icons: { trophy: "https://example.org/first-logo.svg", medal: "" } });
```

## Styling anything

Every element has a part name, styled from the page with `::part()`:

```css
ftc-team-card::part(stat-value) { font-size: 28px; }
ftc-team-awards::part(award-card-won) { outline: 3px solid gold; }
```

The `css` option adds CSS inside the widget, where its classes are available too (award cards have `alliance`/`judged`, `p1`/`p2`/…, `won` and `type-<Award>`). Lorentz Engineering-style award cards, for example, are `theme="trophy"`, or by hand:

```js
new TeamAwards(el, { team: 19444, layout: "strip", theme: { base: "dark", bg: "rgb(59,66,82)" }, css: `
    .strip > .card { background: linear-gradient(#b3b3b3, #a3a3a3); text-transform: uppercase; text-align: center }
    .card.judged.won { background: linear-gradient(#f39a4f, #e07a2b) }
    .card.alliance.won { outline: 6px solid #fbbf24; outline-offset: -6px }
    .card .c-event { order: 1; color: #000 }` });
```

The builder at [ftc-embeds.com/team](https://ftc-embeds.com/team) has a CSS editor with examples for each widget and the classes you can use, and shows the result as you type.

## Live updates

`next-match` and `team-season` refresh every 30 seconds (`refresh`) while the team's event is on and the page is visible.
