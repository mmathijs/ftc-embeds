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
