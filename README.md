# ftc-embeds

Embeddable widgets for FIRST Tech Challenge events and teams. Each widget is a single dependency-free module that works in plain HTML and in any framework (React, Vue, Svelte, Angular), as a JS class or a web component.

| Widget | Import | Docs |
| --- | --- | --- |
| Pit map | `ftc-embeds/pit-map` | [docs/pit-map.md](docs/pit-map.md) |
| Team card | `ftc-embeds/team-card` | [docs/team-card.md](docs/team-card.md) |
| Season results | `ftc-embeds/team-results` | [docs/team-results.md](docs/team-results.md) |
| Awards | `ftc-embeds/team-awards` | [docs/team-awards.md](docs/team-awards.md) |
| Next match | `ftc-embeds/next-match` | [docs/next-match.md](docs/next-match.md) |
| Season + next match | `ftc-embeds/team-season` | [docs/team-season.md](docs/team-season.md) |

The team widgets share their options, themes (including a trophy-case look), icons and styling hooks: see [docs/team-widgets.md](docs/team-widgets.md).

Widgets can load their own data from the [ftc-embeds API](docs/api.md): REST endpoints that are cached presets of GraphQL queries (`configure({ apiBase })`), or the same queries sent to a GraphQL endpoint (`configure({ graphqlUrl })`).

The quickest way: pick a widget and copy its code at [ftc-embeds.com](https://ftc-embeds.com) (pit maps at [/pit-map](https://ftc-embeds.com/pit-map), team widgets at [/team](https://ftc-embeds.com/team)). By hand:

```html
<script type="module" src="https://ftc-embeds.com/lib/team-card.mjs"></script>
<ftc-team-card team="19444" stats="opr,record,awards-total" api-base="https://ftcscout-api.mmathijs.nl/rest/embeds/v1"></ftc-team-card>
```

```js
import { configure } from "ftc-embeds/team-card";
import { PitMap } from "ftc-embeds/pit-map";

configure({ apiBase: "https://ftcscout-api.mmathijs.nl/rest/embeds/v1" });
new PitMap(document.getElementById("map"), { event: "2025/FPEEUR", theme: "ftcscout", highlight: "19444" });
```

Without a bundler: `<script src="https://ftc-embeds.com/lib/<widget>.umd.js"></script>` (globals `FtcPitMap`, `FtcTeamCard`, `FtcTeamResults`, `FtcTeamAwards`, `FtcNextMatch`, `FtcTeamSeason`), or `dist/<widget>.umd.js` from a build.

## Install

```bash
npm install ftc-embeds
```

Or download the built files (`<widget>.mjs`, `<widget>.umd.js` and their `.min` versions, `pit-map-demo.html`) from the [releases](https://github.com/mmathijs/ftc-embeds/releases).

## Development

```bash
npm ci             # installs esbuild (only used to minify the builds)
npm run build      # dist/<widget>.mjs and .umd.js, minified .min.mjs and .umd.min.js, <widget>-demo.html
npm test           # tests (after a build)
npm run typecheck  # checks the .d.ts files
```

CI builds and tests every push and pull request. To release, run `npm version minor` (or `patch`, or an exact version): it bumps `version` in `package.json`, commits and tags `v<version>`. Then push the commit and the tag (`git push --atomic origin main v0.9.0`). The release workflow builds and tests, publishes the package to npm (with provenance) and creates a GitHub release with the built files.

Pre-releases work the same way: version `0.2.0-beta.1` with tag `v0.2.0-beta.1` is published under the npm dist-tag `beta` (`npm install ftc-embeds@beta`) and marked as a pre-release on GitHub; `latest` keeps pointing at the last normal release. The dist-tag is the pre-release name (`beta`, `rc`, `alpha`, …), or `next` for numeric ones like `0.2.0-1`.

Publishing uses npm trusted publishing (no stored token): on npmjs.com, the `ftc-embeds` package's settings list this repository's `release.yml` workflow as a trusted publisher.

Open `dist/pit-map-demo.html` (self-contained) or `demo/pit-map/index.html` after building.

## Website

[ftc-embeds.com](https://ftc-embeds.com) hosts the homepage (`site/index.html`), the configuration dashboards (`site/pit-map.html`, `site/team.html`), the iframe embed pages (`site/embed/`), the libraries (`/lib/<widget>.mjs` and `.umd.js`) and example data. `npm run build` builds it into `dist/site`; `scripts/deploy.sh [ssh host]` (default `ftc-embeds-server`) uploads it to `/opt/ftc-embeds` on the server, where the `ftc-embeds-web` container (`deploy/docker-compose.yml`, `deploy/Caddyfile`) serves it. The server's edge Caddy terminates TLS and forwards ftc-embeds.com to that container (`deploy/edge.Caddyfile`, added to it once by hand). `site/config.js` sets the embeds API (`apiBase`) and the team the homepage shows (`demoTeam`, `demoSeason`).

The site counts how often the embed is loaded per website, using the Referer header browsers send; it stores no IP addresses and sets no cookies. The numbers are public at [ftc-embeds.com/stats](https://ftc-embeds.com/stats). Caddy writes the log (`deploy/stats/stats.caddy`), `embed-stats.py` turns it into the `stats.json` behind the page every 10 minutes, and `scripts/stats.sh install` sets all of that up on the server. `scripts/stats.sh [--days N]` prints the numbers in your terminal.

## Layout

```
src/core/api.mjs              shared API client (configure, preset queries, the pit map's)
src/core/team-api.mjs         the team presets
src/core/team-ui.mjs          team widgets: themes, tokens, options, icons, the base class, the element
src/core/team-views.mjs       team widgets: the results and match views
src/core/team-text.mjs        team widgets: every text
src/<widget>/<widget>.mjs     source (ES module) + <widget>.d.ts types
demo/<widget>/                demo pages and example data
docs/<widget>.md              documentation
site/                         ftc-embeds.com: homepage, pit map and team dashboards, embed pages, config.js
deploy/                       ftc-embeds-web container (compose + Caddyfile) and the edge Caddy site block
deploy/stats/                 embed statistics: Caddy logging, embed-stats.py and the /stats page
scripts/build.mjs             builds every widget and the site into dist/
scripts/deploy.sh             uploads dist/site to the server
scripts/stats.sh              installs the statistics on the server, or prints them
```

## License

MIT, see [LICENSE](LICENSE).
