/*!
 * ftc-embeds/event-awards: who won what at an FTC event (judged awards, the alliances, Dean's
 * List), grouped by award, from FTCScout. Zero dependencies. License: MIT
 */
import { TeamWidget, defineTeamElement, h, awardParts, isWinningAward } from "../core/team-ui.mjs";
import { EVENT_CSS, eventLine, highlighted } from "../core/event-views.mjs";
import { getEventAwards } from "../core/event-api.mjs";
export { configure, EmbedsApiError, DEFAULT_API_BASE } from "../core/api.mjs";
export { getEventAwards, parseEventCode, EVENT_AWARDS_QUERY } from "../core/event-api.mjs";
export { seasonOf } from "../core/team-api.mjs";
export { TEAM_THEMES, TEAM_THEME_MODES, TEAM_SHAPES, TEAM_THEME_SHAPES, ICONS } from "../core/team-ui.mjs";
export { TEAM_TEXT, TEAM_LANGUAGES, registerLanguage } from "../core/team-text.mjs";

/** The order of the ceremony's slides, roughly: the alliances, then the judged awards, Inspire last. */
const ORDER = [
    "Winner", "Finalist", "DivisionWinner", "DivisionFinalist", "ConferenceFinalist", "TopRanked",
    "Think", "Connect", "Innovate", "Control", "Motivate", "Design", "Reach", "Sustain", "Promote", "Compass", "JudgesChoice",
    "DeansListWinner", "DeansListFinalist", "DeansListSemiFinalist", "Inspire",
];
const rank = (type) => (ORDER.includes(type) ? ORDER.indexOf(type) : ORDER.length - 1.5);

/**
 * An event's awards grouped by award, in ceremony order (alliances, judged awards, Inspire last),
 * each group's winners by placement. Options: onlyWon (first places and the winning alliance),
 * types (a set of award types, lower case).
 */
export function awardGroups(ev, { onlyWon = false, types = null } = {}) {
    let groups = new Map();
    for (let a of ev.awards || []) {
        if (onlyWon && !isWinningAward(a.type, a.placement)) continue;
        if (types && !types.has(a.type.toLowerCase())) continue;
        // Championships give some awards per division.
        let key = `${a.type}|${a.divisionName || ""}`;
        if (!groups.has(key)) groups.set(key, { type: a.type, division: a.divisionName || null, awards: [] });
        groups.get(key).awards.push(a);
    }
    for (let g of groups.values()) g.awards.sort((x, y) => x.placement - y.placement || x.teamNumber - y.teamNumber);
    return [...groups.values()].sort((x, y) => (x.division || "").localeCompare(y.division || "") || rank(x.type) - rank(y.type));
}

export class EventAwards extends TeamWidget {
    static kind = "event-awards";
    static subjects = ["event"];
    // onlyWon: first places and the winning alliance only; types: only these ("Inspire,Think,Winner"); highlight: teams to mark
    static defaults = { onlyWon: false, types: null, highlight: null };
    static css = EVENT_CSS + `
.ag{display:grid;grid-template-columns:22px minmax(0,1fr);gap:2px 8px;padding:calc(var(--_row-padding) * .8) 0;border-top:var(--_separator-width) solid var(--_border)}
.ag:first-of-type{border-top:0}
.ag .icon{font-size:14px;justify-self:center;align-self:baseline}
.ag-name{font-weight:650}
.ag-div{font-weight:450;color:var(--_muted)}
.ag-list{grid-column:2;display:flex;flex-wrap:wrap;gap:4px 14px}
.aw-t{white-space:nowrap}
.aw-t .num{font-weight:600}
.aw-t .nm{color:var(--_muted);margin-left:5px}
.aw-t .pl{font-size:var(--_small-size);color:var(--_muted);margin-right:5px}
.aw-t .person{color:var(--_text);margin-left:5px}
.aw-t.me{background:color-mix(in srgb,var(--_accent) 14%,transparent);box-shadow:0 0 0 3px color-mix(in srgb,var(--_accent) 14%,transparent);border-radius:3px}
.ag.won .ag-name{color:var(--_text)}
.ag.alliance .ag-list{gap:2px 14px}
.density-compact .ag{padding:4px 0}
@container (max-width:420px){.aw-t .nm{display:none}.aw-t{white-space:normal}}`;

    fetch(api) {
        return getEventAwards(this.options.event, api);
    }

    view(ev) {
        let types = this.options.types ? new Set(String(this.options.types).split(/[\s,]+/).map((x) => x.toLowerCase())) : null;
        let groups = awardGroups(ev, { onlyWon: this.options.onlyWon === true || this.options.onlyWon === "true", types });
        if (Number(this.options.limit)) groups = groups.slice(0, Number(this.options.limit));
        let body = groups.length
            ? groups.map((g) => this.group(ev, g))
            : h("div", { class: "empty" }, this.t(ev.finished ? "noAwards" : "noAwardsYet"));
        return h("div", null, this.heading(this.t("awards")), eventLine(this, ev), body);
    }

    group(ev, g) {
        let mine = highlighted(this);
        let alliance = ["Winner", "Finalist", "DivisionWinner", "DivisionFinalist", "ConferenceFinalist"].includes(g.type);
        let won = g.awards.some((a) => isWinningAward(a.type, a.placement));
        let [name] = awardParts(g.type, 1, ev.season, this);
        return h("div", { class: `ag${alliance ? " alliance" : " judged"}${won ? " won" : ""} type-${g.type}`, part: `award award-${alliance ? "alliance" : "judged"}` },
            this.shows("icon") ? this.icon(won && (alliance || g.awards.length === 1 || g.type.startsWith("DeansList")) ? "trophy" : "medal") : h("span"),
            h("div", { class: "ag-name", part: "award-name" }, name, g.division && this.shows("division") ? h("span", { class: "ag-div" }, ` · ${g.division}`) : null),
            h("div", { class: "ag-list" }, g.awards.map((a) => {
                let [, placement] = awardParts(a.type, a.placement, ev.season, this);
                return h("span", { class: `aw-t${mine.has(a.teamNumber) ? " me" : ""}`, part: mine.has(a.teamNumber) ? "winner winner-me" : "winner" },
                    placement && this.shows("placement") ? h("span", { class: "pl", part: "placement" }, placement) : null,
                    h("span", { class: "num" }, this.teamLink(a.teamNumber, String(a.teamNumber))),
                    a.team?.name && this.shows("names") ? h("span", { class: "nm", part: "name" }, a.team.name) : null,
                    a.personName ? h("span", { class: "person", part: "person" }, `(${a.personName})`) : null,
                );
            })),
        );
    }
}

/** Registers <ftc-event-awards event="NLCMP" season="2025">. Extra attributes: only-won, types, highlight. */
export function defineEventAwardsElement(tagName = "ftc-event-awards") {
    defineTeamElement(tagName, EventAwards, { "only-won": "onlyWon", types: "types", highlight: "highlight" });
}

if (typeof window !== "undefined" && typeof customElements !== "undefined") defineEventAwardsElement();
