# ftc-embeds API

Widgets load their data from a small REST API. **Each endpoint is a preset of a GraphQL query**: the backend runs the fixed query against its GraphQL schema with the path parameters as variables, caches the result for longer than normal API calls, and returns the result unchanged. Because the query is fixed, responses can be cached by URL (CDN, browser).

The API runs at `https://ftcscout-api.mmathijs.nl/rest/embeds/v1` (FTCScout, server-rs). For a GraphQL endpoint instead, set `graphqlUrl`: the client then POSTs the same queries directly (everything except `teams/{number}/stats`, which only exists as REST).

## Configuration

```js
import { configure } from "ftc-embeds/pit-map";

// Nothing needed for FTCScout's API: it is the default (DEFAULT_API_BASE).
configure({ apiBase: "https://api.example.org/rest/embeds/v1" }); // another REST API
configure({ graphqlUrl: "https://ftcscout-api.mmathijs.nl/graphql" });  // or GraphQL: the same queries, POSTed
```

Per widget: the `apiBase` / `graphqlUrl` options, or the `api-base` / `graphql-url` attributes on web components. When both are set, `apiBase` wins; setting only `graphqlUrl` replaces the default REST API.

## Conventions

- `GET` only, no auth, no cookies.
- `Access-Control-Allow-Origin: *` (widgets run on any site).
- `Content-Type: application/json`; the body is the GraphQL result: `{ "data": { … } }`, plus `errors` if any.
- Status codes: `200` for any GraphQL result (including a `null` event); `400` for invalid path parameters; `5xx` for server errors. The client treats a `null` event or `null` pit map as "not found", so the backend doesn't need to map those to `404` (it may).
- Caching: `Cache-Control: public, max-age=300` (5 minutes), and 30 seconds for what the live widgets poll (`teams/{number}/matches`, `events/{season}/{code}/rankings` and `/matches`). FTCScout's response cache and CDN keep answers longer, until the data behind them changes.

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

### Loading a missing pit map

Pit maps aren't loaded from FTC Events automatically. Anyone can ask for one; the dashboard on ftc-embeds.com does this for events without a pit map. These are not presets: they are never cached, and they spend more of the client's rate limit.

| Request | |
| --- | --- |
| `POST {apiBase}/events/{season}/{code}/pit-map/request` | Load the pit map from FTC Events. At most once an hour per event. |
| `POST {apiBase}/events/{season}/{code}/pit-map/upload` | Load it from a saved copy of the event's FTC Events pit map page (the request body, `text/plain`). Only for events without a pit map, and the page's teams must be the event's registered teams. |
| `GET {apiBase}/events/{season}/{code}/pit-map/request` | How the last request went. |

The POSTs answer `202` with the request, which is then handled in the background (usually within seconds):

```json
{ "status": "pending", "source": "fetch", "error": null, "requestedAt": "…", "finishedAt": null, "fetchAllowedAt": null }
```

`status` becomes `done` or `failed` (with `error`). Other answers: `400` invalid season or not a pit map page, `404` unknown event, `409` an upload for an event that has a pit map, `429` loaded from FTC Events less than an hour ago (`Retry-After`, `fetchAllowedAt`) or the client's rate limit, `503` too many requests waiting. Errors have a `message`.

After `done`, fetch the pit map with a cache-busting query parameter: the event without a pit map may still be in the browser's cache.

## Team endpoints

Presets of the queries in `src/core/team-api.mjs` (`TEAM_CARD_QUERY`, `TEAM_RESULTS_QUERY`, `TEAM_AWARDS_QUERY`, `TEAM_MATCHES_QUERY`), with variables `{ number, season }`. `season` is optional: the current season by default. An unknown team answers `{"data":{"teamByNumber":null}}`.

| Endpoint | Query | Cache |
| --- | --- | --- |
| `GET {apiBase}/teams/{number}/card?season=` | `TEAM_CARD_QUERY` | 5 min |
| `GET {apiBase}/teams/{number}/results?season=` | `TEAM_RESULTS_QUERY` | 5 min |
| `GET {apiBase}/teams/{number}/awards` | `TEAM_AWARDS_QUERY` | 5 min |
| `GET {apiBase}/teams/{number}/matches?season=` | `TEAM_MATCHES_QUERY` | 30 s (live widgets) |

`GET {apiBase}/teams/{number}/stats?season=` is not a preset: FTCScout computes the team card's numbers for it (no GraphQL fallback).

```json
{ "data": {
    "team": { "number": 19444, "name": "Lorentz Engineering", "rookieYear": 2021, "regionCode": "NL", "region": "NL" },
    "season": 2025,
    "opr": { "value": 69.1, "rank": 1454, "count": 8375 },
    "regionalOpr": { "value": 69.1, "rank": 9, "count": 58, "region": "NL" },
    "epa": { "value": 79.0, "rank": 1135 },
    "seasonTotals": { "season": 2025, "events": 3, "matches": 32, "wins": 11, "losses": 11, "ties": 0, "awards": 4, "awardsWon": 3 },
    "allTime": { "seasons": 5, "events": 17, "matches": 137, "wins": 65, "losses": 39, "ties": 0, "awards": 10, "awardsWon": 9 }
} }
```

`regionalOpr` ranks among the teams of the team's home region; `null` when it has none. Unknown team: `{"data":{"team":null}}`.

## Event endpoints

Presets of the queries in `src/core/event-api.mjs`, with variables `{ season, code }`. An unknown event answers `{"data":{"eventByCode":null}}`. Every answer has the event's `season code name start end timezone type remote started ongoing finished divisionCode leagueCode location`.

| Endpoint | Query | Cache |
| --- | --- | --- |
| `GET {apiBase}/events/{season}/{code}/rankings` | `EVENT_RANKINGS_QUERY`: `relatedEvents` (divisions) and `teams { teamNumber team { name location } stats { rank rp tb1 tb2 wins losses ties qualMatchesPlayed opr } }` | 30 s (live) |
| `GET {apiBase}/events/{season}/{code}/matches` | `EVENT_MATCHES_QUERY`: `matches { id description hasBeenPlayed scheduledStartTime actualStartTime tournamentLevel series matchNum scores { red blue } teams { teamNumber alliance station surrogate noShow dq team { name } } }` | 30 s (live) |
| `GET {apiBase}/events/{season}/{code}/advancement` | `EVENT_ADVANCEMENT_QUERY`: `advancementInfo { advancementSlots advancesTo fcmpReserved advancesToEvent }` and `advancement { teamNumber rank advancementRank advanced eligibility totalPoints qualPoints allianceSelectionPoints playoffPoints awardPoints is…Final team { name } }` | 1 min |

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

The team presets work the same way (`getTeamCard`, `getTeamResults`, `getTeamAwards`, `getTeamMatches`, `getTeamStats`, each exported by the widgets that use them):

```js
import { getTeamCard } from "ftc-embeds/team-card";

const team = await getTeamCard(19444, { season: 2025 }); // { number, name, location, quickStats, epa, events, … }
```

## Adding an endpoint

1. Write the GraphQL query and export it from the client (`src/core/api.mjs` for the pit map, `src/core/event-api.mjs` for events, `src/core/team-api.mjs` for teams), e.g. `EVENT_RANKINGS_QUERY`.
2. Add a `get…()` function there that calls `preset(path, query, variables)` and unwraps the result.
3. Document the path, query and response here.
4. Register the same query under that path in FTCScout's server-rs (`src/embed_presets.rs` for teams and events, `src/rest/embeds.rs` for the pit map), with its cache time.
