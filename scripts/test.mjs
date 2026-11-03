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

const EXPORTS = ["PitMap", "THEMES", "CELL_TYPES", "normalizePitMap", "definePitMapElement", "configure", "getPitMap", "EmbedsApiError", "PIT_MAP_QUERY"];

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
    await assert.rejects(getPitMap("2025/C"), (e) => e instanceof EmbedsApiError && /no ftc-embeds API configured/.test(e.message));
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
            for (const name of [w.cls, w.define, "configure", "EmbedsApiError", "TEAM_THEMES", "ICONS", "TEAM_TEXT", ...w.api]) assert.ok(name in m, `missing export ${name}`);
            assert.equal(typeof m[w.cls], "function");
            assert.ok(m.TEAM_THEMES.trophy && m.TEAM_THEMES.light, "themes");
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
