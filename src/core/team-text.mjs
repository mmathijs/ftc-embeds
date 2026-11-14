// Every text the team widgets show. Change any of them with the `text` option
// ({ nextMatch: "Up next" }). {name} is filled in; a [one, other] pair picks by {n}.
// Other languages come as packs (src/lang/<code>.json, served at ftc-embeds.com/lib/lang/), picked
// with the `lang` option: they hold the same keys, plus ordinals, event types and award names.

import { storage } from "./cache.mjs";

export const TEAM_TEXT = {
    // states
    noTeam: "No team set.",
    notFound: "There is no team {team}.",
    noEvent: "No event set.",
    eventNotFound: "There is no event {event} in {season}.",
    loadError: "Couldn't load this right now.",
    staleData: "Couldn't refresh · showing data from {when}",
    // shared
    team: "Team {team}",
    live: "Live",
    remote: "Remote",
    advanced: "Advanced",
    today: "today",
    tomorrow: "tomorrow",
    inDays: "in {n} days",
    inWeeks: "in {n} weeks",
    inMonths: "in {n} months",
    scrollBack: "Scroll back",
    scrollOn: "Scroll on",
    // team card
    teamNumber: "TEAM {team}",
    rookieYear: "Rookie year {year}",
    nowAt: "Now at ",
    next: "Next: ",
    noMoreEvents: "No more events this season",
    noEventsYet: "No events yet this season",
    upcomingEvents: "Upcoming events",
    noneScheduled: "None scheduled this season",
    // team card stats: labels and details
    statOpr: "OPR",
    statEpa: "EPA",
    statRegion: "Rank in {region}",
    statRecord: "{season} record",
    statRecordTotal: "All-time record",
    statWinRate: "{season} win rate",
    statAwards: "{season} awards",
    statAwardsTotal: "Awards",
    statMatches: "{season} matches",
    statMatchesTotal: "Matches played",
    statEvents: "{season} events",
    statEventsTotal: "Events",
    statSeasons: "Seasons",
    statRookie: "Since",
    ofCount: "#{rank} of {count}",
    worldwide: "#{rank} worldwide",
    regionDetail: "of {count} by OPR",
    noMatches: "no matches yet",
    needsRest: "needs the REST API",
    eventCount: ["{n} event", "{n} events"],
    teamCount: ["{n} team", "{n} teams"],
    wonCount: "{n} won",
    winRateDetail: "{wins} of {games} matches",
    thisSeason: "this season",
    played: "played",
    allTime: "all time",
    onFtcscout: "on FTCScout",
    nthSeason: "{nth} season",
    captain: "Captain",
    pick: "{nth} Pick",
    winner: "Winner",
    place: "{nth} Place",
    // event widgets
    rankings: "Rankings",
    colRank: "#",
    colTeam: "Team",
    colRp: "RP",
    colTb1: "TBP",
    colTb2: "TBP2",
    colRecord: "W-L-T",
    colMatches: "Played",
    colOpr: "OPR",
    colEpa: "EPA",
    colWinRate: "Win %",
    colDqs: "DQ",
    noRankings: "No rankings for this event.",
    noRankingsYet: "Rankings appear once matches are played.",
    rankedPerDivision: "Teams are ranked per division:",
    teamNotRankedYet: "Team {team} hasn't been ranked at an event this season yet.",
    matches: "Matches",
    teamMatches: "Matches of {team}",
    colMatch: "Match",
    colTime: "Time",
    colScore: "Score",
    nextUp: "Next",
    noMatchesShown: "No matches to show.",
    noScheduleYet: "The match schedule isn't out yet.",
    advancement: "Advancement",
    advSlots: ["{n} slot to {to}", "{n} slots to {to}"],
    advReserved: "{n} for the FIRST Championship",
    advancedCount: ["{n} team advanced", "{n} teams advanced"],
    colQual: "Qual",
    colAlliance: "Alliance",
    colPlayoff: "Playoff",
    colAward: "Award",
    colTotal: "Total",
    colStatus: "",
    elAlreadyAdvanced: "Already advanced",
    elWrongRegion: "Other region",
    elTooManyEvents: "Too many events",
    elMultiple: "Not eligible",
    notFinal: "Not final yet",
    noAdvancement: "No advancement points for this event.",
    advancementLater: "Advancement points appear as the event goes.",
    leagueStandings: "League standings",
    leagueTitle: "{league} League",
    leagueParent: "part of {league}",
    leagueRegion: "Region {region}",
    colAvgRp: "Avg RP",
    notALeagueEvent: "This event isn't part of a league.",
    noLeagueStandings: "No league standings for this league yet.",
    countdown: "Countdown",
    cdStartsIn: "Starts in",
    cdFirstMatchIn: "First match in",
    cdMatchIn: "{match} in",
    cdNextEvent: "Next event",
    cdDays: ["day", "days"],
    cdHours: ["hour", "hours"],
    cdMinutes: ["minute", "minutes"],
    cdSeconds: ["second", "seconds"],
    cdLive: "Happening now",
    cdOnField: "On the field now",
    cdFinished: "This event is over.",
    cdNoUpcoming: "No upcoming events this season.",
    cdWatch: "Watch live",
    // results
    seasonTitle: "{season} season",
    seasonResults: "Season results",
    noEventsSeason: "No events this season yet.",
    // awards
    awards: "Awards",
    awardCount: ["{n} award", "{n} awards"],
    awardsWon: " · {n} won",
    noAwards: "No awards yet.",
    // matches
    nextMatch: "Next match",
    nextMatchAlliance: "Next match · {alliance} alliance",
    red: "Red",
    blue: "Blue",
    nextEvent: "Next event",
    notCompeting: "Not competing right now, and no upcoming events this season.",
    noMoreMatches: "No more matches scheduled yet.",
    scheduleNotOut: "The match schedule isn't out yet.",
    lastMatch: "Last: {match} · ",
    won: "Won",
    lost: "Lost",
    tied: "Tied",
    noScore: "{match} · no score yet",
    rankRecord: "Rank #{rank} · {record}",
    vs: " vs ",
    minLate: "{n} min late",
    now: "now",
    inMinutes: "in {n} min",
    inHours: "in {h} h {m} min",
};

/** Fill a text: {name} from vars; a [one, other] pair picks by vars.n. */
export function fill(text, vars = {}) {
    if (Array.isArray(text)) text = vars.n == 1 ? text[0] : text[1];
    return String(text ?? "").replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
}

// -------------------------------------------------------------- languages

/** The ready-made language packs (`lang` option), by code. English is built in. */
export const TEAM_LANGUAGES = { en: "English", nl: "Nederlands", de: "Deutsch", fr: "Français", es: "Español" };

/** Where the packs are loaded from; {lang} is the code. */
export const DEFAULT_LANG_URL = "https://ftc-embeds.com/lib/lang/{lang}.json";

// A UMD build loaded from an ftc-embeds lib/ folder finds the packs next to itself (lib/lang/), so
// a test server or a copy of the site uses its own. Module builds don't know where they came from.
const SCRIPT = typeof document !== "undefined" ? document.currentScript?.src : null;
const OWN_LANG_URL = SCRIPT && /\/lib\/[\w-]+\.umd(\.min)?\.js(\?.*)?$/.test(SCRIPT) ? new URL("lang/", SCRIPT).href + "{lang}.json" : null;

// Shared by every widget bundle on the page (each one inlines its own copy of this file).
const REG = (globalThis.__ftcEmbedsLanguages ??= { packs: {}, loading: {}, refreshed: {} });
const LANG_STORE_KEY = "ftcw:lang:";

/**
 * The language a `lang` value asks for: { code: "nl", tag: "nl-BE" }, or null for none.
 * "auto" is the page's own (<html lang>), when there's a pack for it.
 */
export function parseLang(lang) {
    if (lang == null || lang === "" || lang === false) return null;
    let auto = String(lang).trim().toLowerCase() === "auto";
    let tag = auto ? (typeof document !== "undefined" && document.documentElement?.lang) || "" : String(lang).trim();
    let m = /^([a-z]{2,3})(?:[-_][a-z0-9-]+)?$/i.exec(tag);
    if (!m) return null;
    let code = m[1].toLowerCase();
    if (auto && !(code in TEAM_LANGUAGES) && !REG.packs[code]) return null;
    return { code, tag: tag.replace("_", "-") };
}

/** Add a language pack, e.g. registerLanguage(nl) with `import nl from "ftc-embeds/lang/nl.json"`. */
export function registerLanguage(code, pack) {
    if (code && typeof code === "object") [code, pack] = [code.lang, code];
    code = parseLang(code)?.code;
    if (!code || !pack || typeof pack !== "object") throw new Error("ftc-embeds: registerLanguage(pack) needs a pack with a lang code");
    REG.packs[code] = pack;
    return pack;
}

/** The pack for a code when it's at hand (registered, loaded or saved in this browser), else null. */
export function languagePack(code) {
    if (!code || code === "en") return null;
    if (REG.packs[code]) return REG.packs[code];
    try {
        let saved = JSON.parse(storage()?.getItem(LANG_STORE_KEY + code) || "null");
        if (saved?.text) return (REG.packs[code] = saved);
    } catch {
        // not saved
    }
    return null;
}

/**
 * Load the pack for a code from `url` ({lang} template or a folder; default: next to the script or
 * ftc-embeds.com). Resolves to the pack, or null when it can't be had (the widgets stay English).
 * A pack this browser saved earlier is used at once and refreshed once per page.
 */
export function loadLanguage(code, { url = null, fetch: f = null } = {}) {
    let have = languagePack(code);
    if (code === "en" || (have && REG.refreshed[code])) return Promise.resolve(have);
    let template = url || OWN_LANG_URL || DEFAULT_LANG_URL;
    let href = template.includes("{lang}") ? template.replace("{lang}", code) : `${template.replace(/\/+$/, "")}/${code}.json`;
    REG.refreshed[code] = true;
    let pending = (REG.loading[href] ??= (async () => {
        let get = f || globalThis.fetch;
        let signal = typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined;
        let res = await get(href, { headers: { Accept: "application/json" }, signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        let pack = await res.json();
        if (!pack || typeof pack.text !== "object") throw new Error("not a language pack");
        REG.packs[code] = pack;
        try {
            storage()?.setItem(LANG_STORE_KEY + code, JSON.stringify(pack));
        } catch {
            // storage full or blocked: it's loaded again next time
        }
        return pack;
    })().catch((e) => {
        delete REG.loading[href];
        if (!have) console.warn(`ftc-embeds: couldn't load language "${code}" from ${href} (${e?.message || e}); showing English`);
        return have;
    }));
    return have ? Promise.resolve(have) : pending;
}

/** "1st" in a pack's language: its ordinal rules by Intl.PluralRules category ({ other: "{n}e" }). */
export function packOrdinal(n, pack, locale) {
    let rules = pack?.ordinal;
    if (!rules) return null;
    let cat = "other";
    try {
        cat = new Intl.PluralRules(locale || pack.lang, { type: "ordinal" }).select(n);
    } catch {
        // unknown locale: "other"
    }
    return fill(rules[cat] ?? rules.other, { n });
}
