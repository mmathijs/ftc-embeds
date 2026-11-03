/*!
 * ftc-embeds/event-advancement: who advances from an FTC event: its slots, and each team's
 * advancement points (qualification, alliance selection, playoffs, awards), from FTCScout.
 * Zero dependencies. License: MIT
 */
import { TeamWidget, defineTeamElement, h } from "../core/team-ui.mjs";
import { EVENT_CSS, eventLine, highlighted, teamCell, limitRows, scrollToMine } from "../core/event-views.mjs";
import { chip } from "../core/team-views.mjs";
import { getEventAdvancement } from "../core/event-api.mjs";
export { configure, EmbedsApiError, DEFAULT_API_BASE } from "../core/api.mjs";
export { getEventAdvancement, parseEventCode, EVENT_ADVANCEMENT_QUERY } from "../core/event-api.mjs";
export { seasonOf } from "../core/team-api.mjs";
export { TEAM_THEMES, TEAM_THEME_MODES, TEAM_SHAPES, TEAM_THEME_SHAPES, ICONS } from "../core/team-ui.mjs";
export { TEAM_TEXT } from "../core/team-text.mjs";

/** The point columns: the value and whether it is final. */
const POINTS = {
    qual: { label: "colQual", value: (a) => a.qualPoints, final: (a) => a.isQualFinal },
    alliance: { label: "colAlliance", value: (a) => a.allianceSelectionPoints, final: (a) => a.isAllianceSelectionFinal },
    playoff: { label: "colPlayoff", value: (a) => a.playoffPoints, final: (a) => a.isPlayoffPointsFinal },
    award: { label: "colAward", value: (a) => a.awardPoints, final: () => true },
    total: { label: "colTotal", value: (a) => a.totalPoints, final: (a) => a.isQualFinal && a.isAllianceSelectionFinal && a.isPlayoffPointsFinal },
};

const ELIGIBILITY = { ALREADY_ADVANCED: "elAlreadyAdvanced", WRONG_REGION: "elWrongRegion", TOO_MANY_EVENTS: "elTooManyEvents", MULTIPLE_REASONS: "elMultiple" };

/** The teams in advancement order (most points first; those without points last). */
export function advancementRows(ev) {
    let key = (a) => [a.rank ?? Infinity, a.advancementRank ?? Infinity, a.teamNumber];
    return [...(ev.advancement || [])].sort((x, y) => {
        let [a, b] = [key(x), key(y)];
        return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
    });
}

export class EventAdvancement extends TeamWidget {
    static kind = "event-advancement";
    static subjects = ["event"];
    // columns: "qual,alliance,playoff,award,total" (any of them); highlight: team numbers to mark
    static defaults = { columns: "qual,alliance,playoff,award,total", highlight: null, refresh: 60 };
    static css = EVENT_CSS + `
.adv-sum{display:flex;flex-wrap:wrap;gap:4px 14px;margin:-4px 0 12px;font-size:var(--_small-size)}
.adv-sum b{font-weight:650}
.tbl tr.cut td{border-top:2px solid var(--_good)}
.tbl td.st{white-space:nowrap;text-align:right}
.tbl .nf{color:var(--_muted);font-style:italic}
.tbl tr.out td:not(.st){color:var(--_muted)}
.tbl .chip.good{background:color-mix(in srgb,var(--_good) 14%,transparent);color:var(--_good)}
@container (max-width:520px){.tbl .c-qual,.tbl .c-alliance,.tbl .c-playoff,.tbl .c-award{display:none}}`;

    fetch(api) {
        return getEventAdvancement(this.options.event, api);
    }

    isLive(ev) {
        return !!ev?.ongoing;
    }

    columns() {
        let list = Array.isArray(this.options.columns) ? this.options.columns : String(this.options.columns || "").split(/[\s,]+/);
        return list.filter((c) => POINTS[c]);
    }

    view(ev) {
        let rows = advancementRows(ev);
        let body = rows.length ? this.table(rows) : h("div", { class: "empty" }, this.t(ev.finished || ev.season < 2025 ? "noAdvancement" : "advancementLater"));
        return h("div", null, this.heading(this.t("advancement")), eventLine(this, ev), this.summary(ev, rows), body);
    }

    summary(ev, rows) {
        if (!this.shows("summary")) return null;
        let info = ev.advancementInfo;
        let advanced = rows.filter((a) => a.advanced).length;
        let to = info?.advancesToEvent ? this.eventLink(info.advancesToEvent.season, info.advancesToEvent.code, info.advancesToEvent.name) : info?.advancesTo;
        let bits = [
            info?.advancementSlots ? h("span", { part: "slots" }, ...this.withNode(this.t("advSlots", { n: info.advancementSlots, to: "\u0000" }), to)) : null,
            info?.fcmpReserved ? h("span", { class: "muted", part: "reserved" }, this.t("advReserved", { n: info.fcmpReserved })) : null,
            advanced ? h("span", { class: "muted", part: "advanced-count" }, this.t("advancedCount", { n: advanced })) : null,
        ].filter(Boolean);
        return bits.length ? h("div", { class: "adv-sum", part: "summary" }, bits) : null;
    }

    /** A text with a node (a link) where \0 is. */
    withNode(text, node) {
        let [a, b = ""] = text.split("\u0000");
        return node == null ? [text.replace("\u0000", "")] : [a, typeof node === "string" ? h("b", null, node) : h("b", null, node), b];
    }

    table(rows) {
        let mine = highlighted(this);
        let cols = this.columns();
        let shown = limitRows(rows, Number(this.options.limit) || null, (r) => mine.has(r.teamNumber));
        let head = h("tr", null,
            h("th", { class: "rk" }, this.t("colRank")),
            h("th", null, this.t("colTeam")),
            cols.map((c) => h("th", { class: `n c-${c}` }, this.t(POINTS[c].label))),
            h("th", { class: "st" }, this.t("colStatus")),
        );
        let wasAdvanced = false;
        let body = shown.map((a) => {
            if (a === null) return h("tr", { class: "gap" }, h("td", { colspan: String(cols.length + 3) }, "⋯"));
            // A line under the last team that advanced.
            let cut = wasAdvanced && !a.advanced && a.eligibility === "ELIGIBLE";
            if (cut) wasAdvanced = false;
            if (a.advanced) wasAdvanced = true;
            let out = a.eligibility && a.eligibility !== "ELIGIBLE";
            let cls = [mine.has(a.teamNumber) ? "me" : null, cut ? "cut" : null, out ? "out" : null].filter(Boolean).join(" ");
            let status = a.advanced
                ? chip("good", this.icon("advanced"), this.t("advanced"))
                : out
                  ? h("span", { class: "muted small" }, this.t(ELIGIBILITY[a.eligibility] || "elMultiple"))
                  : null;
            return h("tr", { class: cls || null, part: ["row", mine.has(a.teamNumber) ? "row-me" : null, a.advanced ? "row-advanced" : null].filter(Boolean).join(" ") },
                h("td", { class: "rk", part: "rank" }, a.rank != null ? String(a.rank) : "–"),
                teamCell(this, a.teamNumber, a.team?.name),
                cols.map((c) => {
                    let p = POINTS[c];
                    let v = p.value(a);
                    let final = p.final(a);
                    return h("td", { class: `n c-${c}${final ? "" : " nf"}`, part: `col col-${c}`, title: final ? null : this.t("notFinal") }, this.int(v));
                }),
                h("td", { class: "st", part: "status" }, status),
            );
        });
        return h("div", { class: "tbl-wrap" }, h("table", { class: "tbl", part: "table" }, h("thead", null, head), h("tbody", null, body)));
    }

    render() {
        super.render();
        if (this.options.maxHeight) requestAnimationFrame(() => scrollToMine(this));
    }
}

/** Registers <ftc-event-advancement event="NLCMP" season="2025">. Extra attributes: columns, highlight, refresh. */
export function defineEventAdvancementElement(tagName = "ftc-event-advancement") {
    defineTeamElement(tagName, EventAdvancement, { columns: "columns", highlight: "highlight", refresh: "refresh" });
}

if (typeof window !== "undefined" && typeof customElements !== "undefined") defineEventAdvancementElement();
