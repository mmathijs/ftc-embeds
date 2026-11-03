// Views shared by the event widgets: the event line under the heading, tables, and highlighting
// teams. Every element has a part name (::part(...)); the parts in each widget's docs can be left
// out with the `hide` option.

import { h, place, eventType } from "./team-ui.mjs";
import { chip } from "./team-views.mjs";

// With maxHeight the widget scrolls: the column names stay in view. Narrow widgets drop the less
// important columns first. (No CSS comments here: the build splits modules at a line ending in a
// comment's end.)
export const EVENT_CSS = `
.ftcw{position:relative}
.evline{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;margin:-6px 0 12px;font-size:var(--_small-size);color:var(--_muted)}
.evline .ev-name{font-weight:600;color:var(--_text)}
.tbl-wrap{overflow-x:auto}
.tbl{width:100%;border-collapse:collapse;font-size:var(--_font-size)}
.ftcw[style*="max-height"] .tbl-wrap{overflow:visible}
.ftcw[style*="max-height"] .tbl thead th{position:sticky;top:calc(var(--_padding) * -1);z-index:1;background:var(--_bg);box-shadow:inset 0 -1px 0 var(--_border)}
@container (max-width:480px){.tbl .c-tb2,.tbl .c-matches,.tbl .c-dqs{display:none}}
@container (max-width:400px){.tbl .c-tb1,.tbl .c-opr{display:none}}
.tbl th{font-size:calc(var(--_small-size) - .5px);font-weight:600;color:var(--_muted);text-transform:var(--_label-transform);letter-spacing:var(--_label-letter-spacing);text-align:left;padding:0 6px 6px;white-space:nowrap}
.tbl td{padding:calc(var(--_row-padding) / 2) 6px;border-top:var(--_separator-width) solid var(--_border);vertical-align:middle}
.tbl th:first-child,.tbl td:first-child{padding-left:0}
.tbl th:last-child,.tbl td:last-child{padding-right:0}
.tbl .n{text-align:right;white-space:nowrap}
.tbl .rk{font-weight:var(--_value-weight);width:1%;white-space:nowrap}
.tbl .tm{min-width:0}
.tbl .tm .num{font-weight:600}
.tbl .tm .nm{color:var(--_muted);margin-left:6px}
.tbl tr.me td{background:color-mix(in srgb,var(--_accent) 14%,transparent)}
.tbl tr.me td:first-child{box-shadow:inset 3px 0 0 var(--_accent);padding-left:8px}
.tbl tr.me td:last-child{padding-right:8px}
.tbl .tm{overflow-wrap:break-word}
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
    ].filter(Boolean);
    return h("div", { class: "evline", part: "event" },
        h("span", { class: "ev-name" }, w.eventLink(ev.season, ev.code, ev.name)),
        ...bits,
        ev.ongoing ? chip("live", w.t("live")) : null,
    );
}

/** A team cell: the number (a link) and, unless hidden, the name. */
export function teamCell(w, number, name) {
    return h("td", { class: "tm", part: "team" },
        h("span", { class: "num" }, w.teamLink(number, String(number))),
        name && w.shows("names") ? h("span", { class: "nm", part: "name" }, name) : null,
    );
}

/** A number as FTC shows it: whole numbers as is, others with two decimals (in the widget's numberFormat). */
export function stat(w, v, digits = 2) {
    if (v == null) return "–";
    return Number.isInteger(v) ? w.int(v) : w.num(v, digits);
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

/** Scroll a highlighted row (or `selector`'s first) into view inside the widget (with maxHeight), not the page. */
export function scrollToMine(w, selector = "tr.me") {
    let card = w.root.querySelector(".ftcw");
    let row = w.root.querySelector(selector);
    if (!card || !row || card.scrollHeight <= card.clientHeight) return;
    let offset = row.getBoundingClientRect().top - card.getBoundingClientRect().top;
    card.scrollTop = Math.max(0, card.scrollTop + offset - card.clientHeight / 2 + row.offsetHeight / 2);
}
