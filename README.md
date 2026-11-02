# ftc-embeds

Embeddable widgets for FIRST Tech Challenge events. Each widget is a single dependency-free module that works in plain HTML and in any framework (React, Vue, Svelte, Angular), as a JS class or a web component.

| Widget | Import | Docs |
| --- | --- | --- |
| Pit map | `ftc-embeds/pit-map` | [docs/pit-map.md](docs/pit-map.md) |

Widgets can load their own data from the [ftc-embeds API](docs/api.md): REST endpoints that are cached presets of GraphQL queries (`configure({ apiBase })`), or the same queries sent to a GraphQL endpoint (`configure({ graphqlUrl })`).

```js
import { PitMap } from "ftc-embeds/pit-map";

new PitMap(document.getElementById("map"), { data, theme: "ftcscout", highlight: "16236" });
// or let it fetch the data: new PitMap(el, { event: "2025/FPEEUR" })
```

Without a bundler: `<script src="dist/pit-map.umd.js"></script>` (global `FtcPitMap`).

## Install

```bash
npm install ftc-embeds
```

Or download the built files (`pit-map.mjs`, `pit-map.umd.js`, `pit-map-demo.html`) from the [releases](https://github.com/mmathijs/ftc-embeds/releases).

## Development

```bash
npm run build      # dist/<widget>.mjs, dist/<widget>.umd.js, dist/<widget>-demo.html
npm test           # tests (after a build)
npm run typecheck  # checks the .d.ts files
```

CI builds and tests every push and pull request. To release, bump `version` in `package.json`, then push a matching tag (`git tag v0.2.0 && git push origin v0.2.0`). The release workflow builds and tests, publishes the package to npm (with provenance) and creates a GitHub release with the built files.

Pre-releases work the same way: version `0.2.0-beta.1` with tag `v0.2.0-beta.1` is published under the npm dist-tag `beta` (`npm install ftc-embeds@beta`) and marked as a pre-release on GitHub; `latest` keeps pointing at the last normal release. The dist-tag is the pre-release name (`beta`, `rc`, `alpha`, …), or `next` for numeric ones like `0.2.0-1`.

Publishing uses npm trusted publishing (no stored token): on npmjs.com, the `ftc-embeds` package's settings list this repository's `release.yml` workflow as a trusted publisher.

Open `dist/pit-map-demo.html` (self-contained) or `demo/pit-map/index.html` after building.

## Website

[ftc-embeds.com](https://ftc-embeds.com) hosts the configuration dashboard (`site/index.html`), the iframe embed pages (`site/embed/`), the library (`/lib/pit-map.umd.js`) and example data. `npm run build` builds it into `dist/site`; `scripts/deploy.sh [ssh host]` (default `ftc-embeds-server`) uploads it to `/opt/ftc-embeds` on the server, where the `ftc-embeds-web` container (`deploy/docker-compose.yml`, `deploy/Caddyfile`) serves it. The server's edge Caddy terminates TLS and forwards ftc-embeds.com to that container (`deploy/edge.Caddyfile`, added to it once by hand). Live events need the embeds API: set its URL in `site/config.js`.

## Layout

```
src/core/api.mjs              shared API client (configure, preset queries)
src/<widget>/<widget>.mjs     source (ES module) + <widget>.d.ts types
demo/<widget>/                demo pages and example data
docs/<widget>.md              documentation
site/                         ftc-embeds.com: dashboard, embed pages, config.js
deploy/                       ftc-embeds-web container (compose + Caddyfile) and the edge Caddy site block
scripts/build.mjs             builds every widget and the site into dist/
scripts/deploy.sh             uploads dist/site to the server
```

## License

MIT, see [LICENSE](LICENSE).
