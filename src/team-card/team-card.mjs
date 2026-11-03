/*!
 * ftc-embeds/team-card: an FTC team's card (name, location, the stats you pick, next event), from
 * FTCScout. Zero dependencies. License: MIT
 */
import { TeamWidget, defineTeamElement, h, place, seasonName, daysUntil, ordinal, eventType } from "../core/team-ui.mjs";
import { getTeamCard, getTeamStats } from "../core/team-api.mjs";
export { configure, EmbedsApiError } from "../core/api.mjs";
export { getTeamCard, getTeamStats, seasonOf, TEAM_CARD_QUERY } from "../core/team-api.mjs";
export { TEAM_THEMES, ICONS } from "../core/team-ui.mjs";
export { TEAM_TEXT } from "../core/team-text.mjs";

const rec = (t) => (t ? `${t.wins}-${t.losses}-${t.ties}` : "–");

/** The stats a card can show, in the `stats` option ("opr,epa,record" by default). */
export const TEAM_CARD_STATS = [
    "opr", "epa", "region-rank", "record", "record-total", "win-rate", "awards", "awards-total",
    "matches", "matches-total", "events", "events-total", "seasons", "rookie",
];

/** [label, value, detail] of a stat, or null when there's nothing to show. */
function statValue(w, key, c, s, season) {
    let sn = seasonName(season);
    let st = s?.seasonTotals;
    let all = s?.allTime;
    let opr = s?.opr ?? (c.quickStats ? { value: c.quickStats.tot.value, rank: c.quickStats.tot.rank, count: c.quickStats.count } : null);
    let epa = s?.epa ?? (c.epa ? { value: c.epa.epa, rank: c.epa.rank } : null);
    // Without the stats endpoint (GraphQL only), the season's record comes from the card's events.
    let played = c.events.filter((e) => e.stats && e.stats.wins != null);
    let seasonRec = st ?? played.reduce((t, e) => ({ wins: t.wins + e.stats.wins, losses: t.losses + e.stats.losses, ties: t.ties + e.stats.ties, events: t.events + 1 }), { wins: 0, losses: 0, ties: 0, events: 0 });
    let n = (v) => Number(v).toLocaleString(w.locale);
    let t = (k, v) => w.t(k, v);
    switch (key) {
        case "opr": return [t("statOpr"), w.num(opr?.value), opr ? t("ofCount", { rank: n(opr.rank), count: n(opr.count) }) : t("noMatches")];
        case "epa": return [t("statEpa"), w.num(epa?.value), epa ? t("worldwide", { rank: n(epa.rank) }) : t("noMatches")];
        case "region-rank": {
            let r = s?.regionalOpr;
            if (s && !r) return null; // no home region
            return [t("statRegion", { region: r?.region ?? "region" }), r ? `#${n(r.rank)}` : "–", r ? t("regionDetail", { count: n(r.count) }) : t("needsRest")];
        }
        case "record": return [t("statRecord", { season: sn }), seasonRec.events ? rec(seasonRec) : "–", t("eventCount", { n: seasonRec.events })];
        case "record-total": return all ? [t("statRecordTotal"), rec(all), t("eventCount", { n: all.events })] : null;
        case "win-rate": {
            let g = seasonRec.wins + seasonRec.losses + seasonRec.ties;
            return [t("statWinRate", { season: sn }), g ? `${Math.round((seasonRec.wins / g) * 100)}%` : "–", g ? t("winRateDetail", { wins: seasonRec.wins, games: g }) : t("noMatches")];
        }
        case "awards": return st ? [t("statAwards", { season: sn }), n(st.awards), st.awardsWon ? t("wonCount", { n: st.awardsWon }) : t("thisSeason")] : null;
        case "awards-total": return all ? [t("statAwardsTotal"), n(all.awards), all.awardsWon ? t("wonCount", { n: all.awardsWon }) : t("allTime")] : null;
        case "matches": return st ? [t("statMatches", { season: sn }), n(st.matches), t("played")] : null;
        case "matches-total": return all ? [t("statMatchesTotal"), n(all.matches), t("allTime")] : null;
        case "events": return st ? [t("statEvents", { season: sn }), n(st.events), t("played")] : null;
        case "events-total": return all ? [t("statEventsTotal"), n(all.events), t("allTime")] : null;
        case "seasons": return all ? [t("statSeasons"), n(all.seasons), t("onFtcscout")] : null;
        case "rookie": {
            let k = season - c.rookieYear + 1;
            return [t("statRookie"), String(c.rookieYear), t("nthSeason", { n: k, nth: ordinal(k) })];
        }
        default: return null;
    }
}

export class TeamCard extends TeamWidget {
    static kind = "team-card";
    // upcoming: how many upcoming events to list (1: the "Next:" line; 0: none)
    static defaults = { layout: "list", stats: "opr,epa,record", statLabels: null, statColumns: null, upcoming: 1 };
    static css = `
.top{display:flex;gap:12px;align-items:center}
.top+.meta{margin-top:10px}
.avatar{width:var(--_avatar-size);height:var(--_avatar-size);border-radius:var(--_avatar-radius);flex:none;image-rendering:pixelated;object-fit:contain}
.num{font-size:12px;font-weight:650;color:var(--_accent);letter-spacing:.02em}
.name{font-size:var(--_name-size);font-weight:var(--_name-weight);line-height:1.2;margin:1px 0 2px}
.meta{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12.5px;color:var(--_muted)}
.meta>span,.meta>a{display:inline-flex;gap:4px;align-items:center}
.stats{display:grid;grid-template-columns:repeat(var(--stat-columns,3),minmax(0,1fr));gap:var(--_gap);margin-top:14px}
.stat{background:var(--_surface);border-radius:var(--_inner-radius);padding:8px 10px;min-width:0}
.stat .k{font-size:11.5px;color:var(--_muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.stat .v{font-size:var(--_value-size);font-weight:var(--_value-weight);line-height:1.25}
.stat .r{font-size:11.5px;color:var(--_muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.next{margin-top:12px;display:flex;gap:10px;align-items:center;justify-content:space-between;border-top:var(--_separator-width) solid var(--_border);padding-top:10px;font-size:13px}
.next .what{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.chip.upcoming{background:color-mix(in srgb,var(--_accent) 14%,transparent);color:var(--_accent)}
.upc{margin-top:12px;border-top:var(--_separator-width) solid var(--_border);padding-top:10px}
.upc-h{font-size:calc(var(--_small-size) - .5px);color:var(--_muted);text-transform:var(--_label-transform);letter-spacing:var(--_label-letter-spacing);margin-bottom:4px}
.upc-row{display:grid;grid-template-columns:52px minmax(0,1fr) auto;gap:10px;align-items:center;padding:5px 0}
.upc-date{text-align:center;background:var(--_surface);border-radius:var(--_inner-radius);padding:3px 0;line-height:1.1}
.upc-date b{display:block;font-size:17px}
.upc-date span{font-size:10.5px;text-transform:uppercase;color:var(--_muted)}
.upc-name{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.upc-sub{font-size:12px;color:var(--_muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.density-compact .stats{margin-top:8px}
.density-compact .stat{padding:5px 8px}
.density-compact .stat .v{font-size:16px}
@container (max-width:340px){.stats{grid-template-columns:repeat(min(var(--stat-columns,3),2),minmax(0,1fr))}}
.layout-compact .row1{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.layout-compact .avatar{width:calc(var(--_avatar-size) * .73);height:calc(var(--_avatar-size) * .73)}
.layout-compact .name{font-size:calc(var(--_name-size) * .83);margin:0}
.layout-compact .who{min-width:0;flex:1 1 160px}
.layout-compact .inline{display:flex;gap:14px;flex-wrap:wrap}
.layout-compact .inline .stat{background:none;padding:0}
.layout-compact .inline .v{font-size:15px}
.layout-compact .inline .k{font-size:11px}`;

    static skins = {
        trophy: `
.num{color:var(--_accent);letter-spacing:.14em;font-weight:800}
.name{text-transform:uppercase;letter-spacing:.01em;line-height:1.1}
.avatar{box-shadow:0 4px 10px rgba(0,0,0,.3)}
.stats{margin-top:18px}
.stat{text-align:center;text-transform:uppercase;padding:12px 8px 10px;
  background:linear-gradient(160deg,#e4e4e7 0%,#b4b4bb 45%,#8e8e97 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.65),0 6px 14px rgba(0,0,0,.25)}
.stat .k{color:#fff;font-weight:800;font-size:10.5px;letter-spacing:.07em;text-shadow:0 1px 2px rgba(0,0,0,.28)}
.stat .v{color:#111827;line-height:1.15}
.stat .r{color:rgba(255,255,255,.92);font-size:10.5px;font-weight:700;letter-spacing:.04em}
.next,.upc{border-color:var(--_border)}
.upc-h{color:var(--_accent);font-weight:800}
.upc-date{background:var(--_accent);color:var(--_accent-text);box-shadow:0 4px 10px color-mix(in srgb,var(--_accent) 30%,transparent)}
.upc-date span{color:var(--_accent-text);font-weight:700}
.upc-name{text-transform:uppercase;letter-spacing:.02em;font-weight:800}
.layout-compact .inline .stat{background:none;box-shadow:none;padding:0;text-align:left}
.layout-compact .inline .v{color:var(--_text)}`,
    };

    async fetch(api) {
        let [card, stats] = await Promise.all([
            getTeamCard(this.options.team, api),
            getTeamStats(this.options.team, api).catch((e) => (e.notFound ? Promise.reject(e) : null)),
        ]);
        return { card, stats };
    }

    _stats(c, s) {
        let season = s?.season ?? c.events[0]?.event.season ?? this.options.season ?? new Date().getFullYear();
        let keys = Array.isArray(this.options.stats) ? this.options.stats : String(this.options.stats || "").split(/[\s,]+/).filter(Boolean);
        let labels = this.options.statLabels || {};
        return keys
            .map((k) => {
                let v = statValue(this, k, c, s, season);
                if (!v) return null;
                let [label, value, detail] = v;
                return h("div", { class: "stat", part: `stat stat-${k}` },
                    h("div", { class: "k", part: "stat-label" }, labels[k] ?? label),
                    h("div", { class: "v", part: "stat-value" }, value),
                    this.shows("stat-detail") ? h("div", { class: "r", part: "stat-detail" }, detail) : null,
                );
            })
            .filter(Boolean);
    }

    _upcomingList(c, n) {
        let now = this.now();
        let events = c.events.map((e) => e.event).filter((e) => e.ongoing || !e.started).sort((a, b) => a.start.localeCompare(b.start));
        // A championship and its division are one event here.
        events = events.filter((e) => !events.some((p) => p !== e && e.code.startsWith(p.code) && p.start === e.start)).slice(0, n);
        if (!events.length) return h("div", { class: "upc", part: "upcoming" }, h("div", { class: "upc-h" }, this.t("upcomingEvents")), h("div", { class: "muted" }, this.t("noneScheduled")));
        return h("div", { class: "upc", part: "upcoming" },
            h("div", { class: "upc-h" }, this.t("upcomingEvents")),
            events.map((e) => {
                let d = new Date(`${e.start}T12:00:00Z`);
                return h("div", { class: "upc-row", part: "upcoming-event" },
                    h("div", { class: "upc-date", part: "upcoming-date" }, h("b", null, d.getUTCDate()), h("span", null, d.toLocaleDateString(this.locale, { month: "short", timeZone: "UTC" }))),
                    h("div", { style: { minWidth: "0" } },
                        h("div", { class: "upc-name", part: "event" }, this.eventLink(e.season, e.code, e.name)),
                        h("div", { class: "upc-sub" }, [eventType(e.type, this), e.remote ? this.t("remote") : place(e.location)].filter(Boolean).join(" · ")),
                    ),
                    e.ongoing ? h("span", { class: "chip live", part: "chip chip-live" }, this.t("live")) : h("span", { class: "chip upcoming", part: "chip chip-upcoming" }, this.icon("upcoming"), this.until(daysUntil(e.start, now))),
                );
            }),
        );
    }

    _next(c) {
        if (!this.shows("next-event")) return null;
        let n = Number(this.options.upcoming ?? 1);
        if (n === 0) return null;
        if (n > 1 && this.layout !== "compact") return this._upcomingList(c, n);
        let events = c.events.map((e) => e.event).sort((a, b) => a.start.localeCompare(b.start));
        let live = events.find((e) => e.ongoing);
        let upcoming = events.find((e) => !e.started);
        let ev = live || upcoming;
        let when = ev && !live ? this.until(daysUntil(ev.start, this.now())) : null;
        return h("div", { class: "next", part: "next-event" },
            ev
                ? h("span", { class: "what" }, h("span", { class: "muted" }, live ? this.t("nowAt") : this.t("next")), this.eventLink(ev.season, ev.code, ev.name), h("span", { class: "muted" }, live ? "" : ` · ${this.dates(ev.start, ev.end)}`))
                : h("span", { class: "muted" }, events.length ? this.t("noMoreEvents") : this.t("noEventsYet")),
            ev ? (live ? h("span", { class: "chip live", part: "chip chip-live" }, this.t("live")) : h("span", { class: "chip upcoming", part: "chip chip-upcoming" }, this.icon("upcoming"), when)) : null,
        );
    }

    view({ card: c, stats: s }) {
        let avatar = c.avatar && this.shows("avatar") ? h("img", { class: "avatar", part: "avatar", src: /^(https?:|data:)/.test(c.avatar) ? c.avatar : `data:image/png;base64,${c.avatar}`, alt: "" }) : null;
        let meta = [
            this.shows("location") && place(c.location) ? h("span", { part: "location" }, this.icon("location"), place(c.location)) : null,
            this.shows("rookie") ? h("span", { part: "rookie" }, this.t("rookieYear", { year: c.rookieYear })) : null,
            this.shows("website") && c.website
                ? h("a", { href: c.website, target: "_blank", rel: "noopener", part: "website" }, this.icon("website"), c.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""))
                : null,
        ].filter(Boolean);
        let stats = this.shows("stats") ? this._stats(c, s) : [];
        // As many columns as stats, up to 3 (4 stats: 2 by 2), unless statColumns says otherwise.
        let n = stats.length;
        let style = { "--stat-columns": String(this.options.statColumns || (n <= 3 ? Math.max(n, 1) : n === 4 ? 2 : 3)) };
        // Number and name next to the avatar (about its height); the details on their own line below.
        let who = h("div", { class: "who", style: { minWidth: "0" } },
            this.shows("number") ? h("div", { class: "num", part: "number" }, this.t("teamNumber", { team: c.number })) : null,
            h("div", { class: "name", part: "name" }, this.teamLink(c.number, c.name)),
        );
        let metaRow = meta.length && this.layout !== "compact" ? h("div", { class: "meta", part: "meta" }, meta) : null;

        if (this.layout === "compact") {
            let row = h("div", { class: "row1" }, avatar, who, stats.length ? h("div", { class: "inline", part: "stats" }, stats) : null);
            return h("div", null, row, this._next(c));
        }
        let grid = stats.length ? h("div", { class: "stats", part: "stats" }, stats) : null;
        if (grid) grid.style.setProperty("--stat-columns", style["--stat-columns"]);
        return h("div", null, h("div", { class: "top", part: "header" }, avatar, who), metaRow, grid, this._next(c));
    }
}

/**
 * Registers <ftc-team-card team="16236">. Extra attributes: stats ("opr,epa,record"; see
 * TEAM_CARD_STATS), stat-labels (JSON: {"opr":"Power"}), stat-columns.
 */
export function defineTeamCardElement(tagName = "ftc-team-card") {
    defineTeamElement(tagName, TeamCard, { stats: "stats", "stat-labels": "statLabels", "stat-columns": "statColumns", upcoming: "upcoming" });
}

if (typeof window !== "undefined" && typeof customElements !== "undefined") defineTeamCardElement();
