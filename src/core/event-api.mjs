// The event widgets' presets: the GraphQL queries behind GET {apiBase}/events/{season}/{code}/...
// See docs/api.md. Keep these identical to the presets in FTCScout's server-rs (src/embed_presets.rs).

import { preset, EmbedsApiError } from "./api.mjs";
import { seasonOf } from "./team-api.mjs";

/** What every event preset says about the event itself. */
const EVENT_FIELDS = "season code name start end timezone type remote started ongoing finished divisionCode leagueCode location { city state country }";

const RANK_STATS_FRAGMENT = `fragment EmbedRankStats on TeamEventStats {
    ... on TeamEventStats2019 { rank rp tb1 wins losses ties dqs qualMatchesPlayed opr { totalPointsNp } epa }
    ... on TeamEventStats2020Trad { rank rp tb1 tb2 wins losses ties dqs qualMatchesPlayed opr { totalPointsNp } epa }
    ... on TeamEventStats2020Remote { rank rp tb1 tb2 qualMatchesPlayed opr { totalPointsNp } epa }
    ... on TeamEventStats2021Trad { rank rp tb1 tb2 wins losses ties dqs qualMatchesPlayed opr { totalPointsNp } epa }
    ... on TeamEventStats2021Remote { rank rp tb1 tb2 qualMatchesPlayed opr { totalPointsNp } epa }
    ... on TeamEventStats2022 { rank rp tb1 tb2 wins losses ties dqs qualMatchesPlayed opr { totalPointsNp } epa }
    ... on TeamEventStats2023 { rank rp tb1 tb2 wins losses ties dqs qualMatchesPlayed opr { totalPointsNp } epa }
    ... on TeamEventStats2024 { rank rp tb1 tb2 wins losses ties dqs qualMatchesPlayed opr { totalPointsNp } epa }
    ... on TeamEventStats2025 { rank rp tb1 tb2 wins losses ties dqs qualMatchesPlayed opr { totalPointsNp } epa }
    ... on TeamEventStats2026 { rank rp tb1 tb2 wins losses ties dqs qualMatchesPlayed opr { totalPointsNp } epa }
}`;

/** The GraphQL query behind GET {apiBase}/events/{season}/{code}/info. */
export const EVENT_INFO_QUERY = `query EmbedEventInfo($season: Int!, $code: String!) {
    eventByCode(season: $season, code: $code) { ${EVENT_FIELDS} website liveStreamURL }
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

const EVENT_SCORE_FRAGMENT = `fragment EmbedScore on MatchScores {
    ... on MatchScores2019 { red { totalPoints } blue { totalPoints } }
    ... on MatchScores2020Trad { red { totalPoints } blue { totalPoints } }
    ... on MatchScores2021Trad { red { totalPoints } blue { totalPoints } }
    ... on MatchScores2022 { red { totalPoints } blue { totalPoints } }
    ... on MatchScores2023 { red { totalPoints } blue { totalPoints } }
    ... on MatchScores2024 { red { totalPoints } blue { totalPoints } }
    ... on MatchScores2025 { red { totalPoints } blue { totalPoints } }
    ... on MatchScores2026 { red { totalPoints } blue { totalPoints } }
}`;

/** The GraphQL query behind GET {apiBase}/events/{season}/{code}/matches. */
export const EVENT_MATCHES_QUERY = `query EmbedEventMatches($season: Int!, $code: String!) {
    eventByCode(season: $season, code: $code) {
        ${EVENT_FIELDS}
        matches {
            id description hasBeenPlayed scheduledStartTime actualStartTime tournamentLevel series matchNum
            scores { ...EmbedScore }
            teams { teamNumber alliance station surrogate noShow dq team { name } }
        }
    }
}
${EVENT_SCORE_FRAGMENT}`;

/** The GraphQL query behind GET {apiBase}/events/{season}/{code}/advancement. */
export const EVENT_ADVANCEMENT_QUERY = `query EmbedEventAdvancement($season: Int!, $code: String!) {
    eventByCode(season: $season, code: $code) {
        ${EVENT_FIELDS}
        advancementInfo { advancementSlots advancesTo fcmpReserved advancesToEvent { season code name start } }
        advancement {
            teamNumber rank advancementRank advanced eligibility totalPoints
            qualPoints isQualFinal allianceSelectionPoints isAllianceSelectionFinal playoffPoints isPlayoffPointsFinal awardPoints
            team { name }
        }
    }
}`;

const EVENT_RECORD_FRAGMENT = `fragment EmbedRecord on TeamEventStats {
    ... on TeamEventStats2019 { rank wins losses ties }
    ... on TeamEventStats2020Trad { rank wins losses ties }
    ... on TeamEventStats2021Trad { rank wins losses ties }
    ... on TeamEventStats2022 { rank wins losses ties }
    ... on TeamEventStats2023 { rank wins losses ties }
    ... on TeamEventStats2024 { rank wins losses ties }
    ... on TeamEventStats2025 { rank wins losses ties }
    ... on TeamEventStats2026 { rank wins losses ties }
}`;

/** The GraphQL query behind GET {apiBase}/events/{season}/{code}/league. */
export const EVENT_LEAGUE_QUERY = `query EmbedEventLeague($season: Int!, $code: String!) {
    eventByCode(season: $season, code: $code) {
        ${EVENT_FIELDS}
        leagueRankings {
            league { code name regionCode parentLeagueCode parentLeagueName }
            teams { teamNumber avgRp team { name } stats { ...EmbedRecord } }
        }
    }
}
${EVENT_RECORD_FRAGMENT}`;

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

/** An event's match schedule and results: GET {apiBase}/events/{season}/{code}/matches. */
export function getEventMatches(event, options = {}) {
    return eventPreset("matches", event, EVENT_MATCHES_QUERY, options);
}

/** An event's advancement: slots, and each team's advancement points: GET {apiBase}/events/{season}/{code}/advancement. */
export function getEventAdvancement(event, options = {}) {
    return eventPreset("advancement", event, EVENT_ADVANCEMENT_QUERY, options);
}

/**
 * The standings of the league an event (a league meet or tournament) belongs to: GET
 * {apiBase}/events/{season}/{code}/league. Any event of the league gives its current standings.
 */
export function getEventLeague(event, options = {}) {
    return eventPreset("league", event, EVENT_LEAGUE_QUERY, options);
}

/** An event's details (dates, time zone, place, website, livestream): GET {apiBase}/events/{season}/{code}/info. */
export function getEventInfo(event, options = {}) {
    return eventPreset("info", event, EVENT_INFO_QUERY, options);
}
