// Tests for the built packages and the API client. Run after the build: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const demoData = (code) => JSON.parse(readFileSync(resolve(root, `demo/pit-map/data/${code}_pitmap.json`), "utf8"));

const EXPORTS = ["PitMap", "THEMES", "THEME_MODES", "SHAPES", "THEME_SHAPES", "CELL_TYPES", "normalizePitMap", "definePitMapElement", "configure", "getPitMap", "EmbedsApiError", "PIT_MAP_QUERY"];

for (const [label, load] of [
    ["source", () => import(resolve(root, "src/pit-map/pit-map.mjs"))],
    ["dist ES module", () => import(resolve(root, "dist/pit-map.mjs"))],
    ["dist UMD", async () => require(resolve(root, "dist/pit-map.umd.js"))],
    ["minified ES module", () => import(resolve(root, "dist/pit-map.min.mjs"))],
    ["minified UMD", async () => require(resolve(root, "dist/pit-map.umd.min.js"))],
]) {
    test(`${label} loads without a DOM and has every export`, async () => {
        const m = await load();
        for (const name of EXPORTS) assert.ok(name in m, `missing export ${name}`);
        assert.equal(typeof m.PitMap, "function");
        for (const [theme, shape] of Object.entries(m.THEME_SHAPES)) assert.ok(m.SHAPES[shape], `${theme}: shape ${shape} exists`);
        for (const [name, t] of Object.entries(m.THEMES)) assert.ok(!("pitRadius" in t), `${name} has no shape`);
    });
}

test("package exports point at existing files", () => {
    const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
    for (const [sub, target] of Object.entries(pkg.exports)) {
        const files = typeof target == "string" ? [target] : Object.values(target);
        for (const f of files) assert.ok(existsSync(resolve(root, f)), `${sub}: ${f} missing`);
    }
    assert.ok(existsSync(resolve(root, "dist/pit-map-demo.html")), "demo not built");
});

test("normalizePitMap reads every demo event", async () => {
    const { normalizePitMap } = await import(resolve(root, "src/pit-map/pit-map.mjs"));
    for (const code of ["FPEEUR", "NLCMP", "FTCCMP1", "FTCCMP1EDIS"]) {
        const raw = demoData(code);
        const n = normalizePitMap(raw);
        assert.equal(n.elements.length, raw.elements.length);
        assert.ok(n.elements.some((e) => e.type == "PIT" && e.team?.number), `${code}: no team pits`);
        assert.ok(n.width > 0 && n.height > 0);
    }
});

test("normalizePitMap accepts snake_case keys and numeric types", async () => {
    const { normalizePitMap } = await import(resolve(root, "src/pit-map/pit-map.mjs"));
    const n = normalizePitMap({
        min_x: 0,
        min_y: 0,
        width: 4,
        height: 2,
        show_pit_numbers: false,
        elements: [{ type: 2, x: 0, y: 0, width: 2, height: 2, label_orientation: "vertical", team: { number: 1, display_number: "1" } }],
    });
    assert.equal(n.showPitNumbers, false);
    assert.equal(n.elements[0].type, "PIT");
    assert.equal(n.elements[0].labelOrientation, "VERTICAL");
    assert.equal(n.elements[0].team.number, "1");
});

function mockFetch(responses) {
    const calls = [];
    const fetch = async (url, init = {}) => {
        calls.push({ url, init });
        const r = typeof responses == "function" ? responses(url, init) : responses;
        return { ok: r.status < 400, status: r.status, json: async () => r.body };
    };
    return { fetch, calls };
}

test("getPitMap uses the REST preset and unwraps the GraphQL result", async () => {
    const { getPitMap } = await import(resolve(root, "src/pit-map/pit-map.mjs"));
    const pitMap = { ...demoData("NLCMP"), updatedAt: "2026-01-01T00:00:00.000Z" };
    const { fetch, calls } = mockFetch({ status: 200, body: { data: { eventByCode: { season: 2025, code: "NLCMP", pitMap } } } });
    const r = await getPitMap("2025/nlcmp", { apiBase: "https://api.test/v1/", fetch });
    assert.equal(calls[0].url, "https://api.test/v1/events/2025/NLCMP/pit-map");
    assert.equal(calls[0].init.method ?? "GET", "GET");
    assert.deepEqual([r.season, r.code, r.updatedAt], [2025, "NLCMP", "2026-01-01T00:00:00.000Z"]);
    assert.equal(r.pitMap.elements.length, pitMap.elements.length);
});

test("getPitMap falls back to POSTing the preset query to GraphQL", async () => {
    const { getPitMap, PIT_MAP_QUERY } = await import(resolve(root, "src/pit-map/pit-map.mjs"));
    const { fetch, calls } = mockFetch({ status: 200, body: { data: { eventByCode: { season: 2025, code: "X", pitMap: { elements: [] } } } } });
    await getPitMap({ season: 2025, code: "x" }, { graphqlUrl: "https://api.test/graphql", fetch });
    assert.equal(calls[0].init.method, "POST");
    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.query, PIT_MAP_QUERY);
    assert.deepEqual(body.variables, { season: 2025, code: "X" });
});

test("getPitMap reports missing events, missing pit maps and config errors", async () => {
    const { getPitMap, EmbedsApiError } = await import(resolve(root, "src/pit-map/pit-map.mjs"));
    const noEvent = mockFetch({ status: 200, body: { data: { eventByCode: null } } });
    await assert.rejects(getPitMap("2025/NOPE", { apiBase: "https://a.test", fetch: noEvent.fetch }), (e) => e instanceof EmbedsApiError && e.notFound);
    const noMap = mockFetch({ status: 200, body: { data: { eventByCode: { season: 2025, code: "A", pitMap: null } } } });
    await assert.rejects(getPitMap("2025/A", { apiBase: "https://b.test", fetch: noMap.fetch }), (e) => e.notFound);
    const serverError = mockFetch({ status: 500, body: { message: "boom" } });
    await assert.rejects(getPitMap("2025/B", { apiBase: "https://c.test", fetch: serverError.fetch }), (e) => e.status == 500 && !e.notFound);
    const { configure, DEFAULT_API_BASE } = await import(resolve(root, "src/pit-map/pit-map.mjs"));
    assert.equal(configure().apiBase, DEFAULT_API_BASE);
    configure({ apiBase: null });
    await assert.rejects(getPitMap("2025/C"), (e) => e instanceof EmbedsApiError && /no ftc-embeds API configured/.test(e.message));
    configure({ apiBase: DEFAULT_API_BASE });
    await assert.rejects(getPitMap("not an event", { apiBase: "https://d.test" }), /not an event reference/);
});

test("identical requests at the same time share one fetch", async () => {
    const { getPitMap } = await import(resolve(root, "src/pit-map/pit-map.mjs"));
    const { fetch, calls } = mockFetch({ status: 200, body: { data: { eventByCode: { season: 2025, code: "S", pitMap: { elements: [] } } } } });
    await Promise.all([getPitMap("2025/S", { apiBase: "https://e.test", fetch }), getPitMap("2025-s", { apiBase: "https://e.test", fetch })]);
    assert.equal(calls.length, 1);
});










// ------------------------------------------------------------------ team widgets

const TEAM_WIDGETS = [
    { name: "team-card", cls: "TeamCard", define: "defineTeamCardElement", api: ["getTeamCard", "getTeamStats", "TEAM_CARD_QUERY"] },
    { name: "team-results", cls: "TeamResults", define: "defineTeamResultsElement", api: ["getTeamResults", "TEAM_RESULTS_QUERY"] },
    { name: "team-awards", cls: "TeamAwards", define: "defineTeamAwardsElement", api: ["getTeamAwards", "TEAM_AWARDS_QUERY"] },
    { name: "next-match", cls: "NextMatch", define: "defineNextMatchElement", api: ["getTeamMatches", "TEAM_MATCHES_QUERY"] },
    { name: "team-season", cls: "TeamSeason", define: "defineTeamSeasonElement", api: ["getTeamResults", "getTeamMatches"] },
    { name: "event-rankings", cls: "EventRankings", define: "defineEventRankingsElement", api: ["getEventRankings", "parseEventCode", "EVENT_RANKINGS_QUERY", "getTeamResults", "teamRankingsEvent"] },
    { name: "event-matches", cls: "EventMatches", define: "defineEventMatchesElement", api: ["getEventMatches", "matchRows", "EVENT_MATCHES_QUERY"] },
    { name: "event-advancement", cls: "EventAdvancement", define: "defineEventAdvancementElement", api: ["getEventAdvancement", "advancementRows", "EVENT_ADVANCEMENT_QUERY"] },
    { name: "league-standings", cls: "LeagueStandings", define: "defineLeagueStandingsElement", api: ["getEventLeague", "EVENT_LEAGUE_QUERY"] },
    { name: "countdown", cls: "Countdown", define: "defineCountdownElement", api: ["getEventInfo", "getTeamMatches", "zonedMidnight", "timeLeft", "EVENT_INFO_QUERY"] },
];

for (const w of TEAM_WIDGETS) {
    for (const [label, load] of [
        ["source", () => import(resolve(root, `src/${w.name}/${w.name}.mjs`))],
        ["dist ES module", () => import(resolve(root, `dist/${w.name}.mjs`))],
        ["minified ES module", () => import(resolve(root, `dist/${w.name}.min.mjs`))],
        ["minified UMD", async () => require(resolve(root, `dist/${w.name}.umd.min.js`))],
    ]) {
        test(`${w.name}: ${label} loads without a DOM and has its exports`, async () => {
            const m = await load();
            for (const name of [w.cls, w.define, "configure", "EmbedsApiError", "DEFAULT_API_BASE", "TEAM_THEMES", "TEAM_THEME_MODES", "TEAM_SHAPES", "TEAM_THEME_SHAPES", "ICONS", "TEAM_TEXT", ...w.api]) assert.ok(name in m, `missing export ${name}`);
            assert.equal(typeof m[w.cls], "function");
            assert.ok(m.TEAM_THEMES.trophy && m.TEAM_THEMES.light, "themes");
            for (const [mode, pair] of Object.entries(m.TEAM_THEME_MODES)) for (const name of pair) assert.ok(m.TEAM_THEMES[name], `${mode}: theme ${name} exists`);
            for (const [theme, shape] of Object.entries(m.TEAM_THEME_SHAPES)) assert.ok(m.TEAM_SHAPES[shape], `${theme}: shape ${shape} exists`);
            // Colors and shape are separate: no color theme carries a size, no shape a color.
            for (const [name, t] of Object.entries(m.TEAM_THEMES)) assert.ok(!("radius" in t) && !("font" in t), `${name} has only colors`);
            for (const [name, t] of Object.entries(m.TEAM_SHAPES)) assert.ok(!("bg" in t) && !("accent" in t) && t.radius, `${name} has only shape`);
        });
    }
}

test("team presets use REST paths, with the season only when given", async () => {
    const api = await import(resolve(root, "src/core/team-api.mjs"));
    const team = { number: 3977, name: "T", events: [], awards: [], matches: [] };
    const { fetch, calls } = mockFetch({ status: 200, body: { data: { teamByNumber: team } } });
    await api.getTeamCard("3977", { apiBase: "https://t1.test/v1/", fetch });
    await api.getTeamResults(3977, { apiBase: "https://t2.test/v1", season: 2024, fetch });
    await api.getTeamAwards({ number: 3977 }, { apiBase: "https://t3.test/v1", season: 2024, fetch });
    await api.getTeamMatches(3977, { apiBase: "https://t4.test/v1", fetch });
    assert.deepEqual(calls.map((c) => c.url), [
        "https://t1.test/v1/teams/3977/card",
        "https://t2.test/v1/teams/3977/results?season=2024",
        "https://t3.test/v1/teams/3977/awards",
        "https://t4.test/v1/teams/3977/matches",
    ]);
});

test("team presets fall back to GraphQL with the current season", async () => {
    const api = await import(resolve(root, "src/core/team-api.mjs"));
    const { fetch, calls } = mockFetch({ status: 200, body: { data: { teamByNumber: { number: 1, events: [] } } } });
    await api.getTeamCard(1, { graphqlUrl: "https://g.test/graphql", fetch });
    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.query, api.TEAM_CARD_QUERY);
    assert.deepEqual(body.variables, { number: 1, season: api.seasonOf() });
    assert.equal(api.seasonOf(new Date(2026, 1, 7)), 2025);
    assert.equal(api.seasonOf(new Date(2026, 8, 1)), 2026);
});

test("team stats are REST only, and unknown teams are not found", async () => {
    const api = await import(resolve(root, "src/core/team-api.mjs"));
    await assert.rejects(api.getTeamStats(1, { graphqlUrl: "https://g.test/graphql" }), /REST API/);
    const none = mockFetch({ status: 200, body: { data: { team: null } } });
    await assert.rejects(api.getTeamStats(5, { apiBase: "https://s.test", fetch: none.fetch }), (e) => e.notFound);
    const noTeam = mockFetch({ status: 200, body: { data: { teamByNumber: null } } });
    await assert.rejects(api.getTeamCard(6, { apiBase: "https://s2.test", fetch: noTeam.fetch }), (e) => e.notFound);
    await assert.rejects(api.getTeamCard("abc", { apiBase: "https://s3.test" }), /not a team number/);
});

test("awards are named like FTCScout names them", async () => {
    const { awardParts, isWinningAward } = await import(resolve(root, "src/core/team-ui.mjs"));
    assert.deepEqual(awardParts("Winner", 2), ["Winning Alliance", "1st Pick"]);
    assert.deepEqual(awardParts("Winner", 1), ["Winning Alliance", "Captain"]);
    assert.deepEqual(awardParts("Inspire", 2), ["Inspire Award", "2nd Place"]);
    assert.deepEqual(awardParts("Think", 1), ["Think Award", "Winner"]);
    assert.deepEqual(awardParts("DeansListFinalist", 1, 2025), ["FIRST Leadership Award Finalist", ""]);
    assert.ok(isWinningAward("Winner", 3) && isWinningAward("Reach", 1) && !isWinningAward("Connect", 2));
});

const ev = (code, start, extra = {}) => ({ season: 2025, code, name: code, start, end: start, type: "Qualifier", remote: false, started: true, ongoing: false, finished: true, ...extra });

test("season results fold divisions into their championship and sort newest first", async () => {
    const { seasonRows } = await import(resolve(root, "src/core/team-views.mjs"));
    const t = {
        number: 1,
        events: [
            { event: ev("Q1", "2025-12-06"), stats: { rank: 5, wins: 3, losses: 3, ties: 0 }, awards: [] },
            { event: { ...ev("CMP", "2026-02-07"), name: "Championship" }, stats: null, awards: [{ type: "Connect", placement: 3 }] },
            { event: { ...ev("CMPJAC1", "2026-02-07"), name: "Championship - Jacobs Division" }, stats: { rank: 5, wins: 7, losses: 1, ties: 0 }, awards: [] },
            { event: ev("S1", "2025-11-15", { type: "Scrimmage" }), stats: { rank: 8, wins: 2, losses: 2, ties: 0 }, awards: [] },
        ],
    };
    const rows = seasonRows(t);
    assert.deepEqual(rows.map((r) => r.event.code), ["CMP", "Q1", "S1"]);
    assert.equal(rows[0].division, "Jacobs Division");
    assert.equal(rows[0].stats.wins, 7);
    assert.equal(rows[0].awards.length, 1);
    assert.deepEqual(seasonRows(t, { order: "oldest", skipTypes: "Scrimmage" }).map((r) => r.event.code), ["Q1", "CMP"]);
});

test("the next match is the first unplayed one at the event that's on", async () => {
    const { matchStatus } = await import(resolve(root, "src/core/team-views.mjs"));
    const m = (id, played, time) => ({ eventCode: "E", alliance: "Red", match: { id, description: `Q-${id}`, hasBeenPlayed: played, scheduledStartTime: time, teams: [] } });
    const t = {
        number: 1,
        events: [{ event: ev("E", "2026-02-07", { ongoing: true, finished: false }), stats: { rank: 2, wins: 1, losses: 0, ties: 0 } }, { event: ev("F", "2026-03-01", { started: false, finished: false }), stats: null }],
        matches: [m(3, false, "2026-02-07T11:00:00Z"), m(1, true, "2026-02-07T09:00:00Z"), m(2, true, "2026-02-07T10:00:00Z"), m(4, false, "2026-02-07T12:00:00Z")],
    };
    const st = matchStatus(t, new Date("2026-02-07T10:30:00Z"));
    assert.equal(st.current.code, "E");
    assert.equal(st.next.match.id, 3);
    assert.equal(st.last.match.id, 2);
    assert.equal(st.upcoming.code, "F");
    const idle = matchStatus({ ...t, events: t.events.map((e) => ({ ...e, event: { ...e.event, ongoing: false } })) }, new Date("2026-02-20T10:00:00Z"));
    assert.equal(idle.current, null);
    assert.equal(idle.upcoming.code, "F");
});

test("texts can be filled and changed", async () => {
    const { TEAM_TEXT, fill } = await import(resolve(root, "src/core/team-text.mjs"));
    assert.equal(fill(TEAM_TEXT.awardCount, { n: 1 }), "1 award");
    assert.equal(fill(TEAM_TEXT.awardCount, { n: 3 }), "3 awards");
    const { awardParts } = await import(resolve(root, "src/core/team-ui.mjs"));
    const w = { options: { awardNames: { Think: "Think Tank Award" } }, t: (k, v) => fill({ pick: "pick {nth}" }[k] ?? TEAM_TEXT[k], v) };
    assert.deepEqual(awardParts("Think", 1, 2025, w), ["Think Tank Award", "Winner"]);
    assert.deepEqual(awardParts("Winner", 3, 2025, w), ["Winning Alliance", "pick 2nd"]);
});

test("the default API is FTCScout's, and a GraphQL endpoint alone replaces it", async () => {
    const api = await import(resolve(root, "src/core/api.mjs"));
    assert.equal(api.restBase(), api.DEFAULT_API_BASE);
    assert.equal(api.restBase({ apiBase: "https://x.test" }), "https://x.test");
    assert.equal(api.restBase({ graphqlUrl: "https://g.test/graphql" }), null);
    api.configure({ graphqlUrl: "https://g.test/graphql" });
    assert.equal(api.restBase(), null);
    api.configure({ apiBase: api.DEFAULT_API_BASE, graphqlUrl: null });
    assert.equal(api.restBase(), api.DEFAULT_API_BASE);
});

test("flag attributes are on when present without a value", async () => {
    const { attrValue } = await import(resolve(root, "src/core/team-ui.mjs"));
    assert.equal(attrValue("", true), true);
    assert.equal(attrValue("false", true), false);
    assert.equal(attrValue("", false), "");
    assert.deepEqual(attrValue('{"accent":"red"}'), { accent: "red" });
    assert.equal(attrValue("[oops"), "[oops");
});

test("team themes: colors and shape resolve separately", async () => {
    const { resolveTeamTheme } = await import(resolve(root, "src/core/team-ui.mjs"));
    // A theme keeps its own shape unless one is picked.
    assert.equal(resolveTeamTheme("trophy").radius, "14px");
    assert.equal(resolveTeamTheme("ftc-events").font.includes("Roboto"), true);
    let t = resolveTeamTheme("trophy", "square");
    assert.equal(t.radius, "0");
    assert.equal(t.titleSize, "16px");
    assert.equal(t.bg, "#2b313d");
    // Custom colors over a base, a shape object over a shape, and tokens in the theme still win.
    t = resolveTeamTheme({ base: "auto", bg: "#fff7ed", dark: { bg: "#1c1917" } }, { base: "compact", radius: "2px" });
    assert.equal(t.bg, "#fff7ed"); // no DOM: light mode
    assert.equal(t.radius, "2px");
    assert.equal(t.padding, "10px");
    assert.equal(resolveTeamTheme({ base: "dark", radius: "3px" }).radius, "3px");
});

test("team widgets: number, date and time formats", async () => {
    const { TeamWidget, dateRange, shortDate } = await import(resolve(root, "src/core/team-ui.mjs"));
    // The formatting methods only read options: try them on a bare object.
    const w = (options) => Object.assign(Object.create(TeamWidget.prototype), { options });
    assert.equal(w({ locale: "en-US" }).num(1234.56), "1,234.6");
    assert.equal(w({ locale: "en-US", numberFormat: "comma", decimals: 2 }).num(1234.5), "1.234,50");
    assert.equal(w({ numberFormat: "plain" }).int(12345), "12345");
    assert.equal(w({ locale: "en-US", hourCycle: 24, timeZone: "UTC" }).time("2026-02-07T14:30:00Z"), "14:30");
    assert.match(w({ locale: "en-US", hourCycle: "12", timeZone: "UTC" }).time("2026-02-07T14:30:00Z"), /^02:30\sPM$/);
    assert.equal(w({ locale: "en-US", timeZone: "Nowhere/Invalid", hourCycle: 24 }).time("2026-02-07T14:30:00Z").length, 5);
    assert.equal(dateRange("2026-02-07", "2026-02-08", "en-US", "iso"), "2026-02-07 – 2026-02-08");
    assert.equal(dateRange("2026-02-07", null, "en-US", "long"), "February 7, 2026");
    assert.equal(dateRange("2026-02-07", null, "en-GB", "numeric"), "07/02/2026");
    assert.equal(shortDate("2026-02-07", "en-US", "short"), "Feb 7");
});

// ------------------------------------------------------------------ event widgets

test("event presets use REST paths with the season, and GraphQL with the same variables", async () => {
    const api = await import(resolve(root, "src/core/event-api.mjs"));
    const { seasonOf } = await import(resolve(root, "src/core/team-api.mjs"));
    const event = { season: 2025, code: "NLHAQ", teams: [], relatedEvents: [] };
    const { fetch, calls } = mockFetch({ status: 200, body: { data: { eventByCode: event } } });
    await api.getEventRankings("nlhaq", { apiBase: "https://ev1.test/v1/", season: 2025, fetch });
    await api.getEventRankings("NLCMP", { apiBase: "https://ev2.test/v1", fetch });
    await api.getEventMatches("NLCMP", { apiBase: "https://ev5.test/v1", season: 2025, fetch });
    await api.getEventAdvancement("NLCMP", { apiBase: "https://ev6.test/v1", season: 2025, fetch });
    await api.getEventLeague("HUHWM3", { apiBase: "https://ev7.test/v1", season: 2025, fetch });
    assert.deepEqual(calls.map((c) => c.url), [
        "https://ev1.test/v1/events/2025/NLHAQ/rankings",
        `https://ev2.test/v1/events/${seasonOf()}/NLCMP/rankings`,
        "https://ev5.test/v1/events/2025/NLCMP/matches",
        "https://ev6.test/v1/events/2025/NLCMP/advancement",
        "https://ev7.test/v1/events/2025/HUHWM3/league",
    ]);
    const gql = mockFetch({ status: 200, body: { data: { eventByCode: event } } });
    await api.getEventRankings("NLHAQ", { graphqlUrl: "https://g2.test/graphql", season: "2024", fetch: gql.fetch });
    const body = JSON.parse(gql.calls[0].init.body);
    assert.equal(body.query, api.EVENT_RANKINGS_QUERY);
    assert.deepEqual(body.variables, { season: 2024, code: "NLHAQ" });
});

test("unknown events are not found, and only event codes are accepted", async () => {
    const api = await import(resolve(root, "src/core/event-api.mjs"));
    const none = mockFetch({ status: 200, body: { data: { eventByCode: null } } });
    await assert.rejects(api.getEventRankings("ZZZ", { apiBase: "https://ev3.test", season: 2025, fetch: none.fetch }), (e) => e.notFound);
    await assert.rejects(api.getEventRankings("NL-HAQ", { apiBase: "https://ev4.test" }), /not an event code/);
    assert.equal(api.parseEventCode(" fpeeur "), "FPEEUR");
});

test("event tables show the top rows plus the highlighted teams below them", async () => {
    const { limitRows, highlighted, stat } = await import(resolve(root, "src/core/event-views.mjs"));
    const rows = [1, 2, 3, 4, 5, 6].map((n) => ({ teamNumber: n }));
    const mine = (r) => r.teamNumber === 5;
    assert.deepEqual(limitRows(rows, 3, mine).map((r) => r && r.teamNumber), [1, 2, 3, null, 5]);
    assert.deepEqual(limitRows(rows, 3, () => false).map((r) => r.teamNumber), [1, 2, 3]);
    assert.equal(limitRows(rows, null, mine).length, 6);
    assert.deepEqual([...highlighted({ options: { highlight: "19444, 16236,x" } })], [19444, 16236]);
    assert.deepEqual([...highlighted({ options: { highlight: [3977] } })], [3977]);
    const { TeamWidget } = await import(resolve(root, "src/core/team-ui.mjs"));
    const w = (options) => Object.assign(Object.create(TeamWidget.prototype), { options });
    assert.equal(stat(w({ locale: "en-US" }), 903), "903");
    assert.equal(stat(w({ locale: "en-US" }), 2.6666), "2.67");
    assert.equal(stat(w({ locale: "en-US", numberFormat: "comma" }), 2.6666), "2,67");
    assert.equal(stat(w({}), null), "–");
});

test("the match schedule runs in play order, and the next match is the first unplayed one", async () => {
    const { matchRows } = await import(resolve(root, "src/event-matches/event-matches.mjs"));
    const t = (n, alliance) => ({ teamNumber: n, alliance, station: "One" });
    const m = (id, level, played, time, teams = [t(1, "Red"), t(2, "Blue")]) => ({ id, description: `M${id}`, tournamentLevel: level, series: 0, matchNum: id, hasBeenPlayed: played, scheduledStartTime: time, teams });
    const ev = { ongoing: true, matches: [m(4, "DoubleElim", false, "2026-02-07T15:00:00Z"), m(2, "Quals", true, "2026-02-07T10:10:00Z", [t(3, "Red"), t(4, "Blue")]), m(1, "Quals", true, "2026-02-07T10:00:00Z"), m(3, "Quals", false, "2026-02-07T10:20:00Z")] };
    let { rows, next } = matchRows(ev);
    assert.deepEqual(rows.map((r) => r.id), [1, 2, 3, 4]);
    assert.equal(next.id, 3);
    assert.deepEqual(matchRows(ev, { level: "playoffs" }).rows.map((r) => r.id), [4]);
    assert.deepEqual(matchRows(ev, { state: "upcoming", team: 1 }).rows.map((r) => r.id), [3, 4]);
    assert.deepEqual(matchRows(ev, { state: "played" }).rows.map((r) => r.id), [1, 2]);
    assert.equal(matchRows({ ...ev, ongoing: false }).next, null);
    assert.equal(matchRows(ev, { team: 1 }).next.id, 3);
    assert.equal(matchRows(ev, { team: 3 }).next, null);
});

test("match times are in the event's time zone unless timeZone says otherwise", async () => {
    const { TeamWidget } = await import(resolve(root, "src/core/team-ui.mjs"));
    const w = (options) => Object.assign(Object.create(TeamWidget.prototype), { options });
    assert.equal(w({ locale: "en-US", hourCycle: 24 }).time("2026-02-07T09:30:00Z", "Europe/Amsterdam"), "10:30");
    assert.equal(w({ locale: "en-US", hourCycle: 24, timeZone: "UTC" }).time("2026-02-07T09:30:00Z", "Europe/Amsterdam"), "09:30");
});

test("advancement runs by points, with teams without points last", async () => {
    const { advancementRows } = await import(resolve(root, "src/event-advancement/event-advancement.mjs"));
    const a = (teamNumber, rank, advancementRank) => ({ teamNumber, rank, advancementRank });
    const rows = advancementRows({ advancement: [a(5, null, null), a(3, 2, null), a(1, 1, 1), a(2, 3, 2)] });
    assert.deepEqual(rows.map((r) => r.teamNumber), [1, 3, 2, 5]);
    assert.deepEqual(advancementRows({ advancement: [] }), []);
});

test("countdowns start at midnight in the event's time zone", async () => {
    const { zonedMidnight, timeLeft } = await import(resolve(root, "src/countdown/countdown.mjs"));
    assert.equal(new Date(zonedMidnight("2026-02-07", "Europe/Amsterdam")).toISOString(), "2026-02-06T23:00:00.000Z");
    assert.equal(new Date(zonedMidnight("2026-06-17", "Europe/Amsterdam")).toISOString(), "2026-06-16T22:00:00.000Z");
    assert.equal(new Date(zonedMidnight("2026-03-08", "America/New_York")).toISOString(), "2026-03-08T05:00:00.000Z");
    assert.equal(new Date(zonedMidnight("2026-02-07", null)).toISOString(), "2026-02-07T00:00:00.000Z");
    assert.deepEqual(timeLeft(Date.UTC(2026, 1, 8, 1, 2, 3), Date.UTC(2026, 1, 6)), { days: 2, hours: 1, minutes: 2, seconds: 3, total: 176523 });
    assert.equal(timeLeft(0, 5000).total, 0);
});

test("rankings for a team: the event it is at, or else its latest ranked one", async () => {
    const { teamRankingsEvent } = await import(resolve(root, "src/event-rankings/event-rankings.mjs"));
    const e = (code, start, rank, ongoing = false) => ({ event: { code, start, ongoing }, stats: rank ? { rank } : null });
    assert.equal(teamRankingsEvent({ events: [e("Q1", "2025-11-29", 4), e("CMP", "2026-02-07", null), e("CMPOCK1", "2026-02-07", 12)] }), "CMPOCK1");
    assert.equal(teamRankingsEvent({ events: [e("Q1", "2025-11-29", 4), e("Q2", "2026-01-10", 3, true), e("Q3", "2026-02-07", 1)] }), "Q2");
    assert.equal(teamRankingsEvent({ events: [e("Q9", "2026-12-01", null)] }), null);
    assert.equal(teamRankingsEvent({ events: [] }), null);
});
