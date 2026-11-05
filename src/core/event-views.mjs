// Views shared by the event widgets: the event line under the heading, tables, and highlighting
// teams. Every element has a part name (::part(...)); the parts in each widget's docs can be left
// out with the `hide` option.

import { h, place, eventType } from "./team-ui.mjs";
import { chip } from "./team-views.mjs";

// With maxHeight only the table scrolls (heading, event line and tabs stay), with the column names in view. Narrow widgets drop the less
// important columns first. (No CSS comments here: the build splits modules at a line ending in a
// comment's end.)
export const EVENT_CSS = `
.ftcw{position:relative}
.evline{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;margin:-6px 0 12px;font-size:var(--_small-size);color:var(--_muted)}
.evline .ev-name{font-weight:600;color:var(--_text)}
.tbl-wrap{overflow-x:auto;scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--_muted) 45%,transparent) transparent}
.ftcw:not(.bare) .tbl-wrap{margin:0 -8px}
.tbl{width:100%;border-collapse:collapse;font-size:var(--_font-size)}
.ftcw[style*="max-height"]{display:flex;flex-direction:column;overflow:hidden!important}
.ftcw[style*="max-height"] > div,.ftcw[style*="max-height"] [part~="league"]{display:flex;flex-direction:column;flex:1 1 auto;min-height:0}
.ftcw[style*="max-height"] .tbl-wrap{flex:1 1 auto;min-height:0;overflow:auto}
.ftcw[style*="max-height"] .tbl thead th{position:sticky;top:0;z-index:1;background:var(--_bg);box-shadow:inset 0 -1px 0 var(--_border)}
@container (max-width:480px){.tbl .c-tb2,.tbl .c-matches,.tbl .c-dqs,.tbl .c-winrate{display:none}}
@container (max-width:400px){.tbl .c-tb1,.tbl .c-opr,.tbl .c-epa{display:none}}
.tbl th{font-size:calc(var(--_small-size) - .5px);font-weight:600;color:var(--_muted);text-transform:var(--_label-transform);letter-spacing:var(--_label-letter-spacing);text-align:left;padding:0 6px 8px;white-space:nowrap}
.tbl td{padding:calc(var(--_row-padding) * .8) 6px;border-top:var(--_separator-width) solid var(--_border);vertical-align:middle}
.density-compact .tbl th{padding-bottom:6px}
.density-compact .tbl td{padding-top:3px;padding-bottom:3px}
.tbl th:first-child,.tbl td:first-child{padding-left:8px}
.tbl th:last-child,.tbl td:last-child{padding-right:8px}
.tbl .n{text-align:right;white-space:nowrap}
.tbl .rk{font-weight:var(--_value-weight);width:1%;white-space:nowrap}
.tbl .tm{min-width:0}
.tbl .tm .num{font-weight:600}
.tbl .tm .nm{color:var(--_muted);margin-left:6px}
.tbl tr.me td{background:color-mix(in srgb,var(--_accent) 14%,transparent)}
.tbl tr.me td:first-child{box-shadow:inset 3px 0 0 var(--_accent)}
.tbl td.tm{width:100%;max-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tbl .chip{text-transform:none;letter-spacing:normal}
.tbl tr.gap td{border-top:0;color:var(--_muted);text-align:center;padding:4px 0;line-height:1;letter-spacing:.2em}
.tabs{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}
.density-compact .evline{margin:-4px 0 8px}
@container (max-width:420px){.evline [part=type],.evline [part=location]{display:none}}
.tabs button{all:unset;cursor:pointer;font-size:var(--_chip-font-size);font-weight:var(--_chip-weight);padding:var(--_chip-padding);border-radius:var(--_chip-radius);background:var(--_surface);color:var(--_text)}
.tabs button[aria-pressed="true"]{background:var(--_accent);color:var(--_accent-text)}
.tabs button:focus-visible{outline:2px solid var(--_accent);outline-offset:1px}
.empty{padding:14px 0 4px;color:var(--_muted)}
.chip.upcoming{background:color-mix(in srgb,var(--_accent) 14%,transparent);color:var(--_accent)}
.muted{color:var(--_muted)}`;

/** The team numbers of the `highlight` option ("19444,16236" or [19444]). */
export function highlighted(w) {
    let v = w.options.highlight;
    if (v == null || v === "") return new Set();
    let list = Array.isArray(v) ? v : String(v).split(/[\s,]+/);
    return new Set(list.map(Number).filter((n) => Number.isInteger(n) && n > 0));
}

/** The event's name, dates, place and a Live chip: the line under the heading. */
export function eventLine(w, ev) {
    if (!w.shows("event")) return null;
    let bits = [
        w.shows("date") ? h("span", { part: "date" }, w.dates(ev.start, ev.end)) : null,
        w.shows("location") ? h("span", { part: "location" }, ev.remote ? w.t("remote") : place(ev.location)) : null,
        w.shows("type") ? h("span", { part: "type" }, eventType(ev.type, w)) : null,
        // how many teams are at the event (the widgets whose data lists them: rankings)
        Array.isArray(ev.teams) && ev.teams.length && w.shows("teams") ? h("span", { part: "teams" }, w.t("teamCount", { n: ev.teams.length })) : null,
    ].filter(Boolean);
    return h("div", { class: "evline", part: "event" },
        h("span", { class: "ev-name" }, w.eventLink(ev.season, ev.code, ev.name)),
        ...bits,
        ev.ongoing ? chip("live", w.t("live")) : null,
    );
}

/** A team cell: the number (a link) and, unless hidden, the name. */
export function teamCell(w, number, name) {
    // One line: a long name ends in "…" (the full name on hover); the number always shows.
    return h("td", { class: "tm", part: "team", title: name ? `${number} ${name}` : null },
        h("span", { class: "num" }, w.teamLink(number, String(number))),
        name && w.shows("names") ? h("span", { class: "nm", part: "name" }, name) : null,
    );
}

/**
 * A number in a table column, in the widget's numberFormat: with `digits` decimals (zeros
 * included, so a column lines up), or none for a column of whole numbers (see columnDigits).
 */
export function stat(w, v, digits = 2) {
    if (v == null) return "–";
    return digits === 0 ? w.int(v) : w.num(v, digits);
}

/** The decimals for a column: none when every value is whole (counts, 2021 RP totals), else `digits`. */
export function columnDigits(values, digits = 2) {
    return values.every((v) => v == null || Number.isInteger(v)) ? 0 : digits;
}

/**
 * The rows to show: the first `limit` (all without a limit), plus the highlighted ones further down
 * after a gap marker (null).
 */
export function limitRows(rows, limit, isMine) {
    if (!limit || rows.length <= limit) return rows;
    let top = rows.slice(0, limit);
    let mine = rows.slice(limit).filter(isMine);
    return mine.length ? [...top, null, ...mine] : top;
}

/**
 * With maxHeight: scroll the widget (not the page) to a row. scrollTo picks which: "auto" (the
 * widget's choice: the next match, else the marked team), "team", "next" or "none". With
 * scrollOffset, that many rows stay above it (under the column names); otherwise it's centered.
 */
export function scrollToMine(w, auto = ["tr.me"]) {
    let mode = w.options.scrollTo || "auto";
    if (mode === "none") return;
    let selectors = mode === "team" ? ["tr.me", ".rk-card.me"] : mode === "next" ? ["tr.nextm"] : auto;
    let row = selectors.map((s) => w.root.querySelector(s)).find(Boolean);
    // The table scrolls (the heading stays); without room for that, the whole card.
    let wrap = row?.closest(".tbl-wrap");
    let card = wrap && wrap.scrollHeight > wrap.clientHeight ? wrap : w.root.querySelector(".ftcw");
    if (!card || !row || card.scrollHeight <= card.clientHeight) return;
    let top = (el) => el.getBoundingClientRect().top - card.getBoundingClientRect().top + card.scrollTop;
    let n = w.options.scrollOffset;
    if (n != null && n !== "" && Number(n) >= 0) {
        let anchor = row;
        for (let i = 0; i < Number(n) && anchor.previousElementSibling; i++) anchor = anchor.previousElementSibling;
        let head = card.querySelector(".tbl thead");
        card.scrollTop = Math.max(0, top(anchor) - (head ? head.offsetHeight : 0));
    } else card.scrollTop = Math.max(0, top(row) - card.clientHeight / 2 + row.offsetHeight / 2);
}
