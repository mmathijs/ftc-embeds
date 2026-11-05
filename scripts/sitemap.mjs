// Writes dist/site/sitemap.xml: the site's pages, and a /teams/<number> page for every team that
// played an event this season or last (from FTCScout, about 10,000). Run it after the build;
// deploy.sh does. If FTCScout can't be reached, the sitemap has the pages only, and it says so.
//   node scripts/sitemap.mjs [--offline]
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const ORIGIN = "https://ftc-embeds.com";
const GRAPHQL = "https://api.ftcscout.org/graphql";
const PAGES = ["/", "/setup", "/team", "/teams", "/pit-map", "/avatars", "/privacy"];

/** The FTC season a date is in: it starts in September. */
const seasonOf = (d = new Date()) => (d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1);

async function activeTeams() {
    let s = seasonOf();
    let query = `{ a: eventsSearch(season: ${s}) { teams { teamNumber } } b: eventsSearch(season: ${s - 1}) { teams { teamNumber } } }`;
    let r = await fetch(GRAPHQL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query }), signal: AbortSignal.timeout(60000) });
    if (!r.ok) throw new Error(`FTCScout answered ${r.status}`);
    let { data, errors } = await r.json();
    if (!data) throw new Error(errors?.[0]?.message || "no data");
    let numbers = new Set([...data.a, ...data.b].flatMap((e) => e.teams.map((t) => t.teamNumber)));
    return [...numbers].filter((n) => Number.isInteger(n) && n > 0).sort((x, y) => x - y);
}

let teams = [];
if (!process.argv.includes("--offline")) {
    try {
        teams = await activeTeams();
    } catch (e) {
        console.warn(`sitemap: no team pages, FTCScout couldn't be reached (${e.message})`);
    }
}
const url = (path, priority) => `  <url><loc>${ORIGIN}${path}</loc><priority>${priority}</priority></url>`;
const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...PAGES.map((p) => url(p, p == "/" ? "1.0" : "0.8")),
    ...teams.map((n) => url(`/teams/${n}`, "0.5")),
    "</urlset>",
    "",
].join("\n");
writeFileSync(resolve(root, "dist/site/sitemap.xml"), xml);
console.log(`built sitemap (dist/site/sitemap.xml): ${PAGES.length} pages, ${teams.length} team pages, ${(xml.length / 1024).toFixed(0)} KB`);
