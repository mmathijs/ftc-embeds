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

## Development

```bash
npm run build    # dist/<widget>.mjs, dist/<widget>.umd.js, dist/<widget>-demo.html
```

Open `dist/pit-map-demo.html` (self-contained) or `demo/pit-map/index.html` after building.

## Layout

```
src/core/api.mjs              shared API client (configure, preset queries)
src/<widget>/<widget>.mjs     source (ES module) + <widget>.d.ts types
demo/<widget>/                demo pages and example data
docs/<widget>.md              documentation
scripts/build.mjs             builds every widget into dist/
```

## License

MIT, see [LICENSE](LICENSE).
