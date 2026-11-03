// The event widgets' presets: the GraphQL queries behind GET {apiBase}/events/{season}/{code}/...
// See docs/api.md. Keep these identical to the presets in FTCScout's server-rs (src/embed_presets.rs).

import { preset, EmbedsApiError } from "./api.mjs";
import { seasonOf } from "./team-api.mjs";

/** What every event preset says about the event itself. */
const EVENT_FIELDS = "season code name start end timezone type remote started ongoing finished divisionCode leagueCode location { city state country }";

const RANK_STATS_FRAGMENT = `fragment EmbedRankStats on TeamEventStats {
    ... on TeamEventStats2019 { rank rp tb1 wins losses ties dqs qualMatchesPlayed opr { totalPointsNp } }
    ... on TeamEventStats2020Trad { rank rp tb1 tb2 wins losses ties dqs qualMatchesPlayed opr { totalPointsNp } }
    ... on TeamEventStats2020Remote { rank rp tb1 tb2 qualMatchesPlayed opr { totalPointsNp } }
    ... on TeamEventStats2021Trad { rank rp tb1 tb2 wins losses ties dqs qualMatchesPlayed opr { totalPointsNp } }
    ... on TeamEventStats2021Remote { rank rp tb1 tb2 qualMatchesPlayed opr { totalPointsNp } }
    ... on TeamEventStats2022 { rank rp tb1 tb2 wins losses ties dqs qualMatchesPlayed opr { totalPointsNp } }
    ... on TeamEventStats2023 { rank rp tb1 tb2 wins losses ties dqs qualMatchesPlayed opr { totalPointsNp } }
    ... on TeamEventStats2024 { rank rp tb1 tb2 wins losses ties dqs qualMatchesPlayed opr { totalPointsNp } }
    ... on TeamEventStats2025 { rank rp tb1 tb2 wins losses ties dqs qualMatchesPlayed opr { totalPointsNp } }
    ... on TeamEventStats2026 { rank rp tb1 tb2 wins losses ties dqs qualMatchesPlayed opr { totalPointsNp } }
}`;

/** The GraphQL query behind GET {apiBase}/events/{season}/{code}/rankings. */
export const EVENT_RANKINGS_QUERY = `query EmbedEventRankings($season: Int!, $code: String!) {
    eventByCode(season: $season, code: $code) {
        ${EVENT_FIELDS}
        relatedEvents { code name divisionCode }
        teams { teamNumber team { name location { city state country } } stats { ...EmbedRankStats } }
    }
}
${RANK_STATS_FRAGMENT}`;

/** "nlcmp" -> "NLCMP"; throws for anything that isn't an event code. */
export function parseEventCode(code) {
    let c = String(code ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9]{1,32}$/.test(c)) throw new EmbedsApiError(`not an event code: ${JSON.stringify(code)}`);
    return c;
}

async function eventPreset(name, event, query, options) {
    let code = parseEventCode(event);
    let season = options.season != null && options.season !== "" ? +options.season : seasonOf();
    let body = await preset(`/events/${season}/${code}/${name}`, query, { season, code }, options);
    let ev = body?.data?.eventByCode;
    if (body?.data && !ev) throw new EmbedsApiError(`no ${season} event ${code}`, 404);
    return ev;
}

/**
 * An event and its teams' rankings: GET {apiBase}/events/{season}/{code}/rankings (preset of
 * EVENT_RANKINGS_QUERY). Options: season (default: the current one), apiBase/graphqlUrl, fetch,
 * signal. err.notFound means there is no such event.
 */
export function getEventRankings(event, options = {}) {
    return eventPreset("rankings", event, EVENT_RANKINGS_QUERY, options);
}
