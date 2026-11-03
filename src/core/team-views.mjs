// Views shared by the team widgets: a season's results, and a team's next/last match. The
// combined widget (team-season) uses both. Every element has a part name (::part(...)), and the
// parts listed in each widget's docs can be left out with the `hide` option.

import { h, strip, awardParts, isWinningAward, place, record, eventType, seasonName, daysUntil } from "./team-ui.mjs";

/** <span class="chip …" part="chip chip-…">. */
export const chip = (kind, ...children) => h("span", { class: `chip ${kind}`, part: `chip chip-${kind}` }, ...children);

export const RESULTS_CSS = `
.rows{list-style:none;margin:0;padding:0}
.row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 12px;padding:var(--_row-padding) 0;border-top:var(--_separator-width) solid var(--_border)}
.row:first-child{border-top:0;padding-top:2px}
.ev{font-weight:600;min-width:0}
.ev .div{font-weight:450;color:var(--_muted)}
.sub{font-size:var(--_small-size);color:var(--_muted);margin-top:1px}
.chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.density-compact .chips{margin-top:3px}
.chip.award.won{background:color-mix(in srgb,var(--_gold) 18%,transparent);color:color-mix(in srgb,var(--_gold) 70%,var(--_text))}
.chip.upcoming{background:color-mix(in srgb,var(--_accent) 14%,transparent);color:var(--_accent)}
.res{text-align:right;white-space:nowrap}
.rank{font-size:var(--_value-size);font-weight:var(--_value-weight);line-height:1.1}
.rec{font-size:var(--_small-size);color:var(--_muted)}
.empty{padding:14px 0 4px;color:var(--_muted)}
.strip>.tile{gap:2px;min-height:var(--_tile-height)}
.tile .t-date{font-size:calc(var(--_small-size) - .5px);color:var(--_muted)}
.tile .t-name{font-weight:650;line-height:1.25;margin-top:2px}
.tile .t-foot{margin-top:auto;padding-top:8px;display:flex;align-items:flex-end;justify-content:space-between;gap:6px}
.tile .t-icons{display:flex;gap:3px;font-size:14px}
.tile.live{box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--_bad) 55%,transparent)}
.tile.upcoming{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--_accent) 45%,transparent)}
.good{color:var(--_good)}`;

/** The trophy theme's extra CSS for results (list and strip). */
export const RESULTS_TROPHY = `
.strip>.tile{color:#fff;text-transform:uppercase;background:linear-gradient(160deg,#e4e4e7 0%,#b4b4bb 45%,#8e8e97 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.65),0 8px 18px rgba(0,0,0,.28)}
.tile .t-date,.tile .t-date.ell{color:rgba(255,255,255,.92);font-weight:700;font-size:10.5px;letter-spacing:.05em}
.tile .t-name{color:#111827;font-weight:850;letter-spacing:.01em}
.tile .t-name a{color:inherit}
.tile .rank{color:#111827}
.tile .rec{color:#fff;font-weight:700}
.tile.live{box-shadow:0 0 0 3px var(--_bad),var(--_glow) color-mix(in srgb,var(--_bad) 40%,transparent)}
.tile.upcoming{box-shadow:0 0 0 3px var(--_gold),var(--_glow) color-mix(in srgb,var(--_gold) 35%,transparent)}
.row .rank{color:var(--_accent)}
.ev{text-transform:uppercase;letter-spacing:.02em;font-weight:800}`;

/** The trophy theme's extra CSS for the match views. */
export const MATCH_TROPHY = `
.nm,.upnext{background:rgba(255,255,255,.06);border:1px solid var(--_border)}
.nm-desc,.c-desc{font-weight:850}
.upnext .u-when b{color:var(--_accent)}
.live-ev{text-transform:uppercase;letter-spacing:.02em;font-weight:800}`;

/** The team's events of a season, with divisions folded into their parent event. */
export function seasonRows(t, { order = "newest", skipTypes = null } = {}) {
    let rows = t.events.map((e) => ({ ...e, division: null }));
    // A division (NLCMPJAC1) has the record; its parent (NLCMP) has the awards. Show them as one row.
    for (let parent of rows) {
        if (parent.stats) continue;
        let divs = rows.filter((d) => d !== parent && !d.merged && d.event.code.startsWith(parent.event.code) && d.event.start === parent.event.start);
        let div = divs.find((d) => d.stats) || divs[0];
        if (!div) continue;
        parent.stats = div.stats;
        parent.event = { ...parent.event, ongoing: parent.event.ongoing || div.event.ongoing, started: parent.event.started || div.event.started };
        parent.division = div.event.name.replace(parent.event.name, "").replace(/^\s*[-–:]\s*/, "") || div.event.name;
        parent.awards = [...(parent.awards || []), ...(div.awards || [])];
        div.merged = true;
    }
    let skip = skipTypes ? new Set((Array.isArray(skipTypes) ? skipTypes : String(skipTypes).split(/[\s,]+/)).map((s) => s.toLowerCase())) : null;
    let out = rows.filter((r) => !r.merged && !(skip && skip.has(r.event.type.toLowerCase())));
    out.sort((a, b) => a.event.start.localeCompare(b.event.start));
    return order === "oldest" ? out : out.reverse();
}

function rowParts(w, t, r, now) {
    let ev = r.event;
    let advanced = w.shows("advanced") && ev.advancement?.some((a) => a.teamNumber === t.number && a.advanced);
    let awards = w.shows("awards")
        ? (r.awards || []).map((a) => {
            let [name, placement] = awardParts(a.type, a.placement, ev.season, w);
            let won = isWinningAward(a.type, a.placement);
            return h("span", { class: `chip award${won ? " won" : ""}`, part: `chip chip-award${won ? " chip-award-won" : ""}` }, placement ? `${name} · ${placement}` : name);
        })
        : [];
    let days = !ev.started ? daysUntil(ev.start, now) : null;
    return { ev, advanced, awards, days };
}

function rankAndRecord(w, r) {
    return [
        w.shows("rank") ? h("div", { class: "rank", part: "rank" }, `#${r.stats.rank}`) : null,
        w.shows("record") ? h("div", { class: "rec", part: "record" }, record(r.stats)) : null,
    ];
}

function resultsList(w, t, rows, now) {
    return h("ul", { class: "rows", part: "rows" }, rows.map((r) => {
        let { ev, advanced, awards, days } = rowParts(w, t, r, now);
        let sub = [w.shows("date") && w.dates(ev.start, ev.end), w.shows("type") && eventType(ev.type, w), w.shows("location") && (ev.remote ? w.t("remote") : place(ev.location))].filter(Boolean);
        let res = ev.ongoing
            ? chip("live", w.t("live"))
            : days != null
                ? chip("upcoming", w.icon("upcoming"), w.until(days))
                : r.stats?.rank
                    ? rankAndRecord(w, r)
                    : h("span", { class: "muted small" }, "–");
        return h("li", { class: `row${ev.ongoing ? " live" : ""}${days != null ? " upcoming" : ""}`, part: "row" },
            h("div", { style: { minWidth: "0" } },
                h("div", { class: "ev", part: "event" }, w.eventLink(ev.season, ev.code, ev.name), r.division && w.shows("division") ? h("span", { class: "div", part: "division" }, ` · ${r.division}`) : null),
                sub.length ? h("div", { class: "sub", part: "meta" }, sub.join(" · ")) : null,
                awards.length || advanced ? h("div", { class: "chips", part: "chips" }, advanced ? chip("good", w.icon("advanced"), w.t("advanced")) : null, awards) : null,
            ),
            h("div", { class: "res", part: "result" }, res),
        );
    }));
}

function resultsStrip(w, t, rows, now) {
    let tiles = rows.map((r) => {
        let { ev, advanced, days } = rowParts(w, t, r, now);
        let foot = ev.ongoing
            ? chip("live", w.t("live"))
            : days != null
                ? chip("upcoming", w.icon("upcoming"), w.until(days))
                : r.stats?.rank
                    ? h("div", null, rankAndRecord(w, r))
                    : h("span", { class: "muted small" }, "–");
        let icons = [
            advanced ? h("span", { title: w.t("advanced"), class: "good" }, w.icon("advanced")) : null,
            ...(w.shows("awards")
                ? (r.awards || []).map((a) => h("span", { title: awardParts(a.type, a.placement, ev.season, w).filter(Boolean).join(" · ") }, w.icon(isWinningAward(a.type, a.placement) ? "trophy" : "medal")))
                : []),
        ].filter(Boolean);
        return h("div", { class: `tile${ev.ongoing ? " live" : ""}${days != null ? " upcoming" : ""}`, part: "tile" },
            w.shows("date") ? h("div", { class: "t-date", part: "date" }, w.dates(ev.start, ev.end)) : null,
            h("div", { class: "t-name clamp2", part: "event" }, w.eventLink(ev.season, ev.code, ev.name)),
            w.shows("type") ? h("div", { class: "t-date ell", part: "meta" }, r.division && w.shows("division") ? r.division : eventType(ev.type, w)) : null,
            h("div", { class: "t-foot" }, foot, icons.length ? h("div", { class: "t-icons", part: "icons" }, icons) : null),
        );
    });
    return strip(tiles, w);
}

/** The results list/strip, and (strip only) the arrows for the heading. */
export function resultsView(w, t, { limit = null, now = new Date() } = {}) {
    let rows = seasonRows(t, { order: w.options.order, skipTypes: w.options.skipTypes });
    if (limit) rows = rows.slice(0, limit);
    if (!rows.length) return { body: h("div", { class: "empty" }, w.t("noEventsSeason")), arrows: null };
    if (w.layout === "strip") {
        let { row, arrows } = resultsStrip(w, t, rows, now);
        return { body: row, arrows };
    }
    return { body: resultsList(w, t, rows, now), arrows: null };
}

export function resultsTitle(w, t) {
    let season = t.events[0]?.event.season;
    return season ? w.t("seasonTitle", { season: seasonName(season) }) : w.t("seasonResults");
}

// ------------------------------------------------------------------ matches

export const MATCH_CSS = `
.live-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px}
.live-ev{font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nm{background:var(--_surface);border-radius:var(--_inner-radius);padding:12px}
.nm-top{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.nm-label{font-size:calc(var(--_small-size) - .5px);color:var(--_muted);text-transform:var(--_label-transform);letter-spacing:var(--_label-letter-spacing)}
.nm-desc{font-size:22px;font-weight:750;line-height:1.15}
.nm-when{text-align:right;font-size:13px}
.nm-when b{display:block;font-size:16px}
.alliances{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:var(--_gap);margin-top:10px}
.al{min-width:0;border-radius:max(0px, var(--_inner-radius) - 2px);padding:6px 8px;font-size:13px;border-left:3px solid}
.al.red{border-color:var(--_red);background:color-mix(in srgb,var(--_red) 9%,transparent)}
.al.blue{border-color:var(--_blue);background:color-mix(in srgb,var(--_blue) 9%,transparent)}
.al .t{display:block;color:var(--_text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.al .t.me{font-weight:750}
.last{display:flex;justify-content:space-between;gap:8px;margin-top:10px;font-size:13px}
.idle{color:var(--_muted);padding:6px 0}
.upnext{display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--_surface);border-radius:var(--_inner-radius);padding:10px 12px}
.upnext .u-label{font-size:calc(var(--_small-size) - .5px);color:var(--_muted);text-transform:var(--_label-transform);letter-spacing:var(--_label-letter-spacing)}
.upnext .u-name{font-weight:650}
.upnext .u-when{text-align:right;white-space:nowrap;font-size:13px}
.upnext .u-when b{display:block;font-size:16px;color:var(--_accent)}
.cm{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:4px 12px}
.cm .c-desc{font-size:20px;font-weight:750;line-height:1}
.cm .c-teams{font-size:13px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cm .c-teams .me{font-weight:750;text-decoration:underline;text-underline-offset:2px}
.cm .c-when{text-align:right;font-size:13px;white-space:nowrap}
.cm .c-sub{grid-column:1/-1;display:flex;justify-content:space-between;gap:8px;font-size:var(--_small-size);color:var(--_muted)}`;

const time = (w, iso) => new Date(iso).toLocaleTimeString(w.locale, { hour: "2-digit", minute: "2-digit" });
function until(w, iso, now) {
    let min = Math.round((new Date(iso) - now) / 60000);
    if (min < -1) return w.t("minLate", { n: -min });
    if (min <= 1) return w.t("now");
    if (min < 60) return w.t("inMinutes", { n: min });
    return w.t("inHours", { h: Math.floor(min / 60), m: min % 60 });
}

/** Which event matters right now, and the team's next and last match there. */
export function matchStatus(t, now = new Date()) {
    let events = [...t.events].sort((a, b) => a.event.start.localeCompare(b.event.start));
    let current = events.find((e) => e.event.ongoing && t.matches.some((m) => m.eventCode === e.event.code)) || events.find((e) => e.event.ongoing);
    let upcoming = events.find((e) => !e.event.started && daysUntil(e.event.start, now) >= 0) || events.find((e) => !e.event.started);
    if (!current) return { current: null, upcoming: upcoming?.event ?? null };
    let order = (m) => m.match.scheduledStartTime || "";
    let matches = t.matches.filter((m) => m.eventCode === current.event.code).sort((a, b) => order(a).localeCompare(order(b)) || a.match.id - b.match.id);
    return {
        current: current.event,
        stats: current.stats,
        next: matches.find((m) => !m.match.hasBeenPlayed) ?? null,
        last: [...matches].reverse().find((m) => m.match.hasBeenPlayed) ?? null,
        upcoming: upcoming?.event ?? null,
    };
}

function allianceBox(w, m, color, me) {
    let teams = m.match.teams.filter((p) => p.alliance === color);
    return h("div", { class: `al ${color.toLowerCase()}`, part: `alliance alliance-${color.toLowerCase()}` },
        teams.map((p) => h("span", { class: `t${p.teamNumber === me ? " me" : ""}`, part: p.teamNumber === me ? "team team-me" : "team" },
            w.teamLink(p.teamNumber, `${p.teamNumber}`),
            w.shows("names") && p.team?.name ? h("span", { class: "muted" }, ` ${p.team.name}`) : null)),
    );
}

function lastLine(w, m) {
    let s = m.match.scores;
    if (!s) return h("span", { class: "muted", part: "last" }, w.t("noScore", { match: m.match.description }));
    let mine = m.alliance === "Red" ? s.red.totalPoints : s.blue.totalPoints;
    let theirs = m.alliance === "Red" ? s.blue.totalPoints : s.red.totalPoints;
    let outcome = mine > theirs ? ["won", "win"] : mine < theirs ? ["lost", "loss"] : ["tied", ""];
    return h("span", { part: "last" }, h("span", { class: "muted" }, w.t("lastMatch", { match: m.match.description })), h("span", { class: outcome[1] }, `${w.t(outcome[0])} ${mine}–${theirs}`));
}

function upcomingView(w, ev, now) {
    let days = daysUntil(ev.start, now);
    return h("div", { class: "upnext", part: "upcoming" },
        h("div", { style: { minWidth: "0" } },
            h("div", { class: "u-label" }, w.t("nextEvent")),
            h("div", { class: "u-name ell", part: "event" }, w.eventLink(ev.season, ev.code, ev.name)),
        ),
        h("div", { class: "u-when", part: "countdown" }, h("b", null, w.until(days)), h("span", { class: "muted" }, w.dates(ev.start, ev.end))),
    );
}

/** The live view: next match and last result. Without an event on: the next event (null when `quiet` and there is none). */
export function matchView(w, t, { now = new Date(), quiet = false } = {}) {
    let st = matchStatus(t, now);
    if (!st.current) {
        if (st.upcoming && w.shows("upcoming")) return upcomingView(w, st.upcoming, now);
        return quiet ? null : h("div", { class: "idle", part: "idle" }, w.t("notCompeting"));
    }
    return w.layout === "compact" ? compactMatch(w, t, st, now) : fullMatch(w, t, st, now);
}

function fullMatch(w, t, st, now) {
    let ev = st.current;
    let next = st.next;
    let nm = next
        ? h("div", { class: "nm", part: "next" },
            h("div", { class: "nm-top" },
                h("div", null, h("div", { class: "nm-label" }, w.t("nextMatchAlliance", { alliance: w.t(next.alliance.toLowerCase()) })), h("div", { class: `nm-desc ${next.alliance.toLowerCase()}`, part: "match" }, next.match.description)),
                next.match.scheduledStartTime && w.shows("time")
                    ? h("div", { class: "nm-when", part: "time" }, h("b", null, time(w, next.match.scheduledStartTime)), w.shows("countdown") ? h("span", { class: "muted" }, until(w, next.match.scheduledStartTime, now)) : null)
                    : null,
            ),
            w.shows("alliances") ? h("div", { class: "alliances" }, allianceBox(w, next, "Red", t.number), allianceBox(w, next, "Blue", t.number)) : null,
        )
        : h("div", { class: "nm", part: "next" }, h("div", { class: "nm-label" }, w.t("nextMatch")), h("div", { class: "idle" }, st.last ? w.t("noMoreMatches") : w.t("scheduleNotOut")));
    let showLast = st.last && w.shows("last");
    let showRank = st.stats?.rank && w.shows("rank");
    return h("div", null,
        w.shows("event") ? h("div", { class: "live-head" }, h("span", { class: "live-ev", part: "event" }, w.eventLink(ev.season, ev.code, ev.name)), chip("live", w.t("live"))) : null,
        nm,
        showLast || showRank ? h("div", { class: "last" }, showLast ? lastLine(w, st.last) : h("span"), showRank ? h("span", { class: "muted", part: "rank" }, w.t("rankRecord", { rank: st.stats.rank, record: record(st.stats) })) : null) : null,
    );
}

function compactMatch(w, t, st, now) {
    let next = st.next;
    let teams = (m, color) => m.match.teams.filter((p) => p.alliance === color).map((p) => h("span", { class: p.teamNumber === t.number ? "me" : null }, String(p.teamNumber)));
    let join = (list) => list.flatMap((x, i) => (i ? [" ", x] : [x]));
    let sub = [st.last && w.shows("last") ? lastLine(w, st.last) : null, st.stats?.rank && w.shows("rank") ? h("span", { part: "rank" }, w.t("rankRecord", { rank: st.stats.rank, record: record(st.stats) })) : null].filter(Boolean);
    return h("div", { class: "cm", part: "next" },
        next ? h("span", { class: `c-desc ${next.alliance.toLowerCase()}`, part: "match" }, next.match.description) : chip("live", w.t("live")),
        next && w.shows("alliances")
            ? h("span", { class: "c-teams", part: "alliances" }, h("span", { class: "red" }, join(teams(next, "Red"))), h("span", { class: "muted" }, w.t("vs")), h("span", { class: "blue" }, join(teams(next, "Blue"))))
            : h("span", { class: "c-teams muted" }, next ? "" : st.last ? w.t("noMoreMatches") : w.t("scheduleNotOut")),
        next?.match.scheduledStartTime && w.shows("time")
            ? h("span", { class: "c-when", part: "time" }, h("b", null, time(w, next.match.scheduledStartTime)), w.shows("countdown") ? h("span", { class: "muted" }, ` · ${until(w, next.match.scheduledStartTime, now)}`) : null)
            : h("span"),
        sub.length ? h("div", { class: "c-sub" }, ...sub) : null,
    );
}

/** Whether a widget showing this data should keep refreshing (an event is on). */
export const isLive = (t) => !!t?.events?.some((e) => e.event.ongoing);
