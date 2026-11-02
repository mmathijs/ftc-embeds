# ftc-embeds API

Widgets load their data from a small REST API. **Each endpoint is a preset of a GraphQL query**: the backend runs the fixed query against its GraphQL schema with the path parameters as variables, caches the result for longer than normal API calls, and returns the result unchanged. Because the query is fixed, responses can be cached by URL (CDN, browser).

> Status: not implemented on the backend yet. Until it is, point widgets at a GraphQL endpoint with `graphqlUrl`: the client then POSTs the same query directly (FTCScout's API already allows cross-origin requests).

## Configuration

```js
import { configure } from "ftc-embeds/pit-map";

configure({ apiBase: "https://api.example.org/rest/embeds/v1" }); // REST presets (preferred)
configure({ graphqlUrl: "https://ftcscout-api.mmathijs.nl/graphql" });  // fallback: same query over GraphQL
```

Per widget: the `apiBase` / `graphqlUrl` options, or the `api-base` / `graphql-url` attributes on web components. When both are set, `apiBase` wins.

## Conventions

- `GET` only, no auth, no cookies.
- `Access-Control-Allow-Origin: *` (widgets run on any site).
- `Content-Type: application/json`; the body is the GraphQL result: `{ "data": { … } }`, plus `errors` if any.
- Status codes: `200` for any GraphQL result (including a `null` event); `400` for invalid path parameters; `5xx` for server errors. The client treats a `null` event or `null` pit map as "not found", so the backend doesn't need to map those to `404` (it may).
- Caching (`Cache-Control`, TTL, invalidation): to be decided. Don't rely on specific values yet.

## Endpoints

### `GET {apiBase}/events/{season}/{code}/pit-map`

The event's pit map. `season` is the FTC season year (e.g. `2025`), `code` the event code (case-insensitive).

Preset query (exported by the client as `PIT_MAP_QUERY`, keep both identical), variables `{ season, code }`:

```graphql
query EmbedPitMap($season: Int!, $code: String!) {
    eventByCode(season: $season, code: $code) {
        season
        code
        pitMap {
            minX minY width height showPitNumbers showPitAddresses updatedAt
            elements {
                type x y width height label labelOrientation index address addressGroup color
                team { number name displayNumber }
            }
        }
    }
}
```

Response:

```json
{
    "data": {
        "eventByCode": {
            "season": 2025,
            "code": "FPEEUR",
            "pitMap": {
                "minX": 0, "minY": 0, "width": 35, "height": 36,
                "showPitNumbers": true, "showPitAddresses": false,
                "updatedAt": "2026-11-02T16:15:26.863Z",
                "elements": [
                    { "type": "PIT", "x": 3, "y": 5, "width": 2, "height": 2, "label": "1",
                      "labelOrientation": "HORIZONTAL", "team": { "number": "8626", "name": "The Prototypes", "displayNumber": "8626" },
                      "color": "#ffa500" }
                ]
            }
        }
    }
}
```

`pitMap` follows the FTC API v3 [`ApiV3PitMap`](https://github.com/maths22/ftc-api-v3-client-ruby/blob/master/docs/ApiV3PitMap.md) schema (camelCase keys), plus `updatedAt`.

| Case | Response |
| --- | --- |
| Event and pit map exist | `200`, as above |
| Event exists, no pit map | `200`, `"pitMap": null` |
| Unknown event | `200`, `"eventByCode": null` |

## Client

```js
import { getPitMap, EmbedsApiError } from "ftc-embeds/pit-map";

try {
    const { season, code, updatedAt, pitMap } = await getPitMap("2025/FPEEUR");
} catch (e) {
    if (e instanceof EmbedsApiError && e.notFound) { /* no such event or no pit map */ }
}
```

Widgets do this for you with the `event` option / attribute: `<ftc-pit-map event="2025/FPEEUR"></ftc-pit-map>`. Identical requests made at the same time (several widgets for one event) share one network request.

## Adding an endpoint

1. Write the GraphQL query and export it from `src/core/api.mjs` (e.g. `RANKINGS_QUERY`).
2. Add a `get…()` function there that calls `preset(path, query, variables)` and unwraps the result.
3. Document the path, query and response here; the backend registers the same query under that path.
