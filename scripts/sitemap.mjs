// Writes, after the build (deploy.sh runs it):
//   dist/site/sitemap.xml        the site's pages and a /teams/<number> page for every team that played
//                                an event this season or last, with lastmod dates
//   dist/site/_data/teams/NN.tsv what the team pages say about each team, by the last two digits of
//                                the number (Caddy's template in teams.html reads one, ~25 KB, per page)
// The team data comes from FTCScout (about a minute). If it can't be reached, the sitemap has the
// pages only and the team pages fall back to the number; the script says so.
//   node scripts/sitemap.mjs [--offline]
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const site = resolve(root, "dist/site");
const ORIGIN = "https://ftc-embeds.com";
const GRAPHQL = "https://api.ftcscout.org/graphql";
// path -> the file whose last commit dates it
const PAGES = { "/": "site/index.html", "/setup": "site/setup.html", "/team": "site/team.html", "/teams": "site/teams.html", "/pit-map": "site/pit-map.html", "/avatars": "site/avatars.html", "/privacy": "site/privacy.html" };
// Events that count for "played N events" (not scrimmages, kickoffs, demos)
const OFFICIAL = new Set(["Qualifier", "LeagueMeet", "LeagueTournament", "Championship", "SuperQualifier", "Premier", "FIRSTChampionship", "OffSeason"]);
// Playoff alliances, best first, said as "was on …"
const ALLIANCE = { Winner: "the winning alliance", DivisionWinner: "a division-winning alliance", Finalist: "the finalist alliance", DivisionFinalist: "a division finalist alliance" };
const AWARD = {
    JudgesChoice: "Judges' Choice Award", DeansListWinner: "Dean's List Award", DeansListFinalist: "Dean's List Finalist", DeansListSemiFinalist: "Dean's List Semi-Finalist",
};
const awardName = (type) => AWARD[type] || `${type.replace(/([a-z])([A-Z])/g, "$1 $2")} Award`;
const ORDINAL = { 2: "2nd", 3: "3rd" };

/** The FTC season a date is in: it starts in September. */
const seasonOf = (d = new Date()) => (d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1);
const seasonName = (s) => `${s}–${String((s + 1) % 100).padStart(2, "0")}`;
const today = new Date().toISOString().slice(0, 10);

async function season(s) {
    let query = `{ events: eventsSearch(season: ${s}) { name start end type started
        teams { teamNumber team { name rookieYear location { city state country } } stats { ... on TeamEventStats${s} { rank } } }
        awards { teamNumber type placement } } }`;
    let r = await fetch(GRAPHQL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query }), signal: AbortSignal.timeout(180000) });
    if (!r.ok) throw new Error(`FTCScout answered ${r.status}`);
    let { data, errors } = await r.json();
    if (!data) throw new Error(errors?.[0]?.message || "no data");
    return data.events;
}

/** Every team in these seasons: { team, where, seasons: { [s]: { events, best, awards } }, last } */
function collect(bySeason) {
    let teams = new Map();
    for (let [s, events] of Object.entries(bySeason)) {
        for (let ev of events) {
            for (let p of ev.teams) {
                let t = teams.get(p.teamNumber);
                if (!t) teams.set(p.teamNumber, (t = { n: p.teamNumber, team: p.team, seasons: {}, last: null }));
                if (+s > (t.teamSeason || 0)) Object.assign(t, { team: p.team, teamSeason: +s });
                if (!ev.started || !OFFICIAL.has(ev.type)) continue;
                let st = (t.seasons[s] ||= { events: 0, best: null, awards: [] });
                st.events++;
                let rank = p.stats?.rank;
                if (rank && (!st.best || rank < st.best.rank)) st.best = { rank, event: ev.name };
                let end = ev.end || ev.start;
                if (end && end <= today && (!t.last || end > t.last)) t.last = end;
            }
            if (!ev.started) continue;
            for (let a of ev.awards) {
                let st = teams.get(a.teamNumber)?.seasons[s];
                if (st) st.awards.push(a);
            }
        }
    }
    return teams;
}

const clean = (s) => String(s ?? "").replace(/[\t\r\n]+/g, " ").trim();
// HTML-escaped, and no "{" so nothing in the data can look like a template action
const esc = (s) => clean(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\{/g, "&#123;").replace(/\}/g, "&#125;");
const list = (items) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);

/** [name, where, facts, description] for one team: plain text, escaped when written. */
function describe(t, current) {
    let name = clean(t.team.name) || `Team ${t.n}`;
    let loc = t.team.location || {};
    let where = [loc.city, loc.state, loc.country].map(clean).filter(Boolean).join(", ");
    let facts = [`${name} is an FTC team${where ? ` from ${where}` : ""}${t.team.rookieYear ? `, competing since ${t.team.rookieYear}` : ""}.`];
    // This season once it has played an event in it, last season until then.
    let s = t.seasons[current] ? current : t.seasons[current - 1] ? current - 1 : null;
    if (s) {
        let st = t.seasons[s];
        let line = `In the ${seasonName(s)} season it played ${st.events} event${st.events == 1 ? "" : "s"}`;
        if (st.best) line += `, with a best rank of #${st.best.rank} at ${clean(st.best.event)}`;
        facts.push(line + ".");
        let won = st.awards.filter((a) => !ALLIANCE[a.type]).map((a) => `the ${awardName(a.type)}${ORDINAL[a.placement] && !a.type.startsWith("DeansList") ? ` (${ORDINAL[a.placement]} place)` : ""}`);
        if (won.length > 4) won = [...won.slice(0, 3), `${won.length - 3} more awards`];
        // Playoff results once each, the best first: "on the winning alliance at 2 events"
        let alliances = Object.entries(ALLIANCE).map(([type, text]) => [text, st.awards.filter((a) => a.type == type).length]).filter(([, k]) => k);
        let on = alliances.map(([text, k]) => `${text}${k > 1 ? ` at ${k} events` : ""}`);
        if (won.length) facts.push(`It won ${list(won)}${on.length ? `, and was on ${list(on)}` : ""}.`);
        else if (on.length) facts.push(`It was on ${list(on)}.`);
    }
    let desc = `FTC team ${t.n} ${name}${where ? ` from ${where}` : ""}: results, awards, rankings and next match as free widgets for your team's website.`;
    let whereLine = [where, t.team.rookieYear ? `rookie year ${t.team.rookieYear}` : ""].filter(Boolean).join(" · ");
    return [name, whereLine, facts.join(" "), desc];
}

const lastCommit = (file) => {
    try {
        return execFileSync("git", ["log", "-1", "--format=%cs", "--", file], { cwd: root, encoding: "utf8" }).trim() || today;
    } catch {
        return today;
    }
};

let teams = new Map();
let current = seasonOf();
if (!process.argv.includes("--offline")) {
    try {
        let [a, b] = await Promise.all([season(current), season(current - 1)]);
        teams = collect({ [current]: a, [current - 1]: b });
    } catch (e) {
        console.warn(`sitemap: no team pages, FTCScout couldn't be reached (${e.message})`);
    }
}
let numbers = [...teams.keys()].filter((n) => Number.isInteger(n) && n > 0).sort((x, y) => x - y);

// The team pages' data, 100 files by the number's last two digits.
const dataDir = resolve(site, "_data/teams");
rmSync(dataDir, { recursive: true, force: true });
mkdirSync(dataDir, { recursive: true });
let shards = Array.from({ length: 100 }, () => []);
for (let n of numbers) shards[n % 100].push([n, ...describe(teams.get(n), current).map(esc)].join("\t"));
shards.forEach((rows, i) => writeFileSync(resolve(dataDir, `${String(i).padStart(2, "0")}.tsv`), rows.join("\n") + "\n"));

const url = (path, lastmod, priority) => `  <url><loc>${ORIGIN}${path}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}<priority>${priority}</priority></url>`;
const teamsDate = lastCommit(PAGES["/teams"]);
const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...Object.entries(PAGES).map(([p, file]) => url(p, lastCommit(file), p == "/" ? "1.0" : "0.8")),
    // A team page changes when the team plays (its data) or when the page itself changes.
    ...numbers.map((n) => url(`/teams/${n}`, [teams.get(n).last, teamsDate].filter(Boolean).sort().at(-1), "0.5")),
    "</urlset>",
    "",
].join("\n");
writeFileSync(resolve(site, "sitemap.xml"), xml);
console.log(`built sitemap (dist/site/sitemap.xml): ${Object.keys(PAGES).length} pages, ${numbers.length} team pages, ${(xml.length / 1024).toFixed(0)} KB; team data in dist/site/_data/teams`);
