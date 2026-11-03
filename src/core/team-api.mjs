// The team widgets' presets: the GraphQL queries behind GET {apiBase}/teams/{number}/... See
// docs/api.md. Keep these identical to the presets in FTCScout's server-rs (src/embed_presets.rs).

import { preset, restBase, EmbedsApiError } from "./api.mjs";

const RECORD_FRAGMENT = `fragment EmbedRecord on TeamEventStats {
    ... on TeamEventStats2019 { rank wins losses ties }
    ... on TeamEventStats2020Trad { rank wins losses ties }
    ... on TeamEventStats2021Trad { rank wins losses ties }
    ... on TeamEventStats2022 { rank wins losses ties }
    ... on TeamEventStats2023 { rank wins losses ties }
    ... on TeamEventStats2024 { rank wins losses ties }
    ... on TeamEventStats2025 { rank wins losses ties }
    ... on TeamEventStats2026 { rank wins losses ties }
}`;

const SCORE_FRAGMENT = `fragment EmbedScore on MatchScores {
    ... on MatchScores2019 { red { totalPoints } blue { totalPoints } }
    ... on MatchScores2020Trad { red { totalPoints } blue { totalPoints } }
    ... on MatchScores2021Trad { red { totalPoints } blue { totalPoints } }
    ... on MatchScores2022 { red { totalPoints } blue { totalPoints } }
    ... on MatchScores2023 { red { totalPoints } blue { totalPoints } }
    ... on MatchScores2024 { red { totalPoints } blue { totalPoints } }
    ... on MatchScores2025 { red { totalPoints } blue { totalPoints } }
    ... on MatchScores2026 { red { totalPoints } blue { totalPoints } }
}`;

/** The GraphQL query behind GET {apiBase}/teams/{number}/card?season=. */
export const TEAM_CARD_QUERY = `query EmbedTeamCard($number: Int!, $season: Int!) {
    teamByNumber(number: $number) {
        number name schoolName rookieYear website avatar
        location { city state country }
        quickStats(season: $season) { tot { value rank } count }
        epa(season: $season) { epa rank }
        events(season: $season) {
            event { season code name start end type remote started ongoing finished location { city state country } }
            stats { ...EmbedRecord }
        }
    }
}
${RECORD_FRAGMENT}`;

/** The GraphQL query behind GET {apiBase}/teams/{number}/results?season=. */
export const TEAM_RESULTS_QUERY = `query EmbedTeamResults($number: Int!, $season: Int!) {
    teamByNumber(number: $number) {
        number name
        events(season: $season) {
            event {
                season code name start end type remote started ongoing finished
                location { city state country }
                advancement { teamNumber advanced }
            }
            stats { ...EmbedRecord }
            awards { type placement divisionName }
        }
    }
}
${RECORD_FRAGMENT}`;

/** The GraphQL query behind GET {apiBase}/teams/{number}/awards. */
export const TEAM_AWARDS_QUERY = `query EmbedTeamAwards($number: Int!) {
    teamByNumber(number: $number) {
        number name
        awards { season eventCode type placement divisionName personName event { name start } }
    }
}`;

/** The GraphQL query behind GET {apiBase}/teams/{number}/matches?season=. */
export const TEAM_MATCHES_QUERY = `query EmbedTeamMatches($number: Int!, $season: Int!) {
    teamByNumber(number: $number) {
        number name
        events(season: $season) {
            event { season code name start end timezone remote started ongoing finished }
            stats { ...EmbedRecord }
        }
        matches(season: $season) {
            eventCode alliance station surrogate
            match {
                id description hasBeenPlayed scheduledStartTime actualStartTime tournamentLevel series matchNum
                scores { ...EmbedScore }
                teams { teamNumber alliance station team { name } }
            }
        }
    }
}
${RECORD_FRAGMENT}
${SCORE_FRAGMENT}`;

/** The FTC season a date falls in: seasons start in September (2025 = 2025-2026). */
export function seasonOf(date = new Date()) {
    return date.getMonth() >= 8 ? date.getFullYear() : date.getFullYear() - 1;
}

/** "16236", 16236 or { number } -> 16236. */
export function parseTeamNumber(team) {
    let n = team && typeof team === "object" ? team.number : team;
    n = typeof n === "string" ? Number(n.trim()) : n;
    if (!Number.isInteger(n) || n <= 0) throw new EmbedsApiError(`not a team number: ${JSON.stringify(team)}`);
    return n;
}

async function teamPreset(name, team, query, seasonal, options) {
    let number = parseTeamNumber(team);
    let season = options.season != null && options.season !== "" ? +options.season : null;
    // The REST API picks the current season itself; GraphQL needs one.
    let variables = seasonal ? { number, season: season ?? seasonOf() } : { number };
    let path = `/teams/${number}/${name}${seasonal && season != null ? `?season=${season}` : ""}`;
    let body = await preset(path, query, variables, options);
    let data = body?.data?.teamByNumber;
    if (body?.data && !data) throw new EmbedsApiError(`no team ${number}`, 404);
    return data;
}

/**
 * A team's card: GET {apiBase}/teams/{number}/card (preset of TEAM_CARD_QUERY).
 * Options: season (default: the current one), apiBase/graphqlUrl, fetch, signal.
 * Resolves to the team; err.notFound means there is no such team.
 */
export function getTeamCard(team, options = {}) {
    return teamPreset("card", team, TEAM_CARD_QUERY, true, options);
}

/** A team's events, records, awards and advancement in a season: GET {apiBase}/teams/{number}/results. */
export function getTeamResults(team, options = {}) {
    return teamPreset("results", team, TEAM_RESULTS_QUERY, true, options);
}

/** All of a team's awards, every season: GET {apiBase}/teams/{number}/awards. */
export function getTeamAwards(team, options = {}) {
    return teamPreset("awards", team, TEAM_AWARDS_QUERY, false, options);
}

/** A team's events and matches in a season, for live widgets: GET {apiBase}/teams/{number}/matches. */
export function getTeamMatches(team, options = {}) {
    return teamPreset("matches", team, TEAM_MATCHES_QUERY, true, options);
}

/**
 * A team's numbers for the team card: GET {apiBase}/teams/{number}/stats. Not a preset (FTCScout
 * computes them for this endpoint), so there is no GraphQL fallback: with only graphqlUrl this
 * rejects, and the card shows what the card preset has.
 * Resolves to { team: { number, name, rookieYear, region }, season, opr, regionalOpr, epa,
 * seasonTotals: { events, matches, wins, losses, ties, awards, awardsWon }, allTime: { …, seasons } }.
 */
export async function getTeamStats(team, options = {}) {
    let number = parseTeamNumber(team);
    let season = options.season != null && options.season !== "" ? +options.season : null;
    if (!restBase(options)) throw new EmbedsApiError("team stats need the REST API (apiBase)", 0);
    let body = await preset(`/teams/${number}/stats${season != null ? `?season=${season}` : ""}`, null, null, options);
    if (body?.data && !body.data.team) throw new EmbedsApiError(`no team ${number}`, 404);
    return body.data;
}
