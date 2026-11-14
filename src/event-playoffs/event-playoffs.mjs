/*!
 * ftc-embeds/event-playoffs: an FTC event's playoffs: the alliances (captain and picks, numbered by
 * their captains' rank) and the bracket (double elimination, or the older best-of-3 semifinals and
 * finals), refreshing during the event, from FTCScout. Zero dependencies. License: MIT
 */
import { TeamWidget, defineTeamElement, h } from "../core/team-ui.mjs";
import { EVENT_CSS, eventLine, highlighted } from "../core/event-views.mjs";
import { chip } from "../core/team-views.mjs";
import { getEventPlayoffs } from "../core/event-api.mjs";
import { playoffBracket, matchWinner } from "../core/playoffs.mjs";
export { configure, EmbedsApiError, DEFAULT_API_BASE } from "../core/api.mjs";
export { getEventPlayoffs, parseEventCode, EVENT_PLAYOFFS_QUERY } from "../core/event-api.mjs";
export { playoffBracket, playoffAlliances, playoffMatches, matchWinner } from "../core/playoffs.mjs";
export { seasonOf } from "../core/team-api.mjs";
export { TEAM_THEMES, TEAM_THEME_MODES, TEAM_SHAPES, TEAM_THEME_SHAPES, ICONS } from "../core/team-ui.mjs";
export { TEAM_TEXT, TEAM_LANGUAGES, registerLanguage } from "../core/team-text.mjs";

export class EventPlayoffs extends TeamWidget {
    static kind = "event-playoffs";
    static subjects = ["event"];
    // highlight: teams to mark; refresh: seconds between refreshes while the event is on
    static defaults = { highlight: null, refresh: 30 };
    static css = EVENT_CSS + `
.po-sec{margin-top:14px}
.po-sec:first-of-type{margin-top:0}
.po-h{font-size:var(--_small-size);font-weight:650;color:var(--_muted);text-transform:var(--_label-transform);letter-spacing:var(--_label-letter-spacing);margin:0 0 8px}
.tbl .seed{font-weight:var(--_value-weight);width:1%;white-space:nowrap}
.tbl td.t{white-space:nowrap}
.tbl td.t .num{font-weight:600}
.tbl td.res{text-align:right;white-space:nowrap}
.chip.gold{background:color-mix(in srgb,var(--_gold) 20%,transparent);color:var(--_text)}
.br{display:flex;gap:14px;overflow-x:auto;padding-bottom:4px;scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--_muted) 45%,transparent) transparent}
.br-col{flex:0 0 var(--ftcw-bracket-width,176px);display:flex;flex-direction:column;justify-content:space-around;gap:10px}
.br-col .po-h{margin:0}
.br-col.titled{justify-content:flex-start}
.br-col.titled .mb-wrap{display:flex;flex-direction:column;justify-content:space-around;gap:10px;flex:1}
.mb{background:var(--_surface);border-radius:var(--_inner-radius);padding:6px 8px;font-size:var(--_small-size);line-height:1.35}
.mb.me{box-shadow:inset 0 0 0 2px var(--_accent)}
.mb-h{display:flex;justify-content:space-between;gap:6px;color:var(--_muted);font-size:calc(var(--_small-size) - 1px);margin-bottom:2px}
.mb-r{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:6px;align-items:baseline;padding:1px 0 1px 6px;border-left:3px solid transparent}
.mb-r.red{border-left-color:var(--_red)}
.mb-r.blue{border-left-color:var(--_blue)}
.mb-r .al{font-weight:700;min-width:1.6em}
.mb-r .tn{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--_muted)}
.mb-r .tn .me{color:var(--_text);font-weight:700}
.mb-r .sc{font-weight:600;font-variant-numeric:tabular-nums}
.mb-r.win .al,.mb-r.win .sc{color:var(--_text)}
.mb-r.win .tn{color:var(--_text)}
.mb-r.lose{opacity:.62}
.mb-games{color:var(--_muted);font-size:calc(var(--_small-size) - 1px);margin-top:2px}
.density-compact .mb{padding:4px 6px}`;

    fetch(api) {
        return getEventPlayoffs(this.options.event, api);
    }

    isLive(ev) {
        return !!ev?.ongoing;
    }

    view(ev) {
        let b = playoffBracket(ev);
        let head = [this.heading(this.t("playoffs")), eventLine(this, ev)];
        if (!b.alliances.length) {
            let started = ev.matches?.some((m) => m.hasBeenPlayed);
            return h("div", null, ...head, h("div", { class: "empty" }, this.t(ev.finished && started ? "noPlayoffs" : "noPlayoffsYet")));
        }
        this._alliances = new Map(b.alliances.map((a) => [a.id, a]));
        this._mine = highlighted(this);
        return h("div", null, ...head,
            this.shows("alliances") ? this.allianceTable(b) : null,
            this.shows("bracket") ? this.bracket(b) : null,
        );
    }

    /** An alliance's short name: "A1", or its captain when the alliances have no numbers. */
    label(id) {
        let a = this._alliances.get(id);
        if (!a) return "–";
        return a.seed != null ? this.t("allianceShort", { n: a.seed }) : String(a.captain);
    }

    hasMine(id) {
        return !!this._alliances.get(id)?.teams.some((n) => this._mine.has(n));
    }

    allianceTable(b) {
        let picks = Math.max(...b.alliances.map((a) => a.teams.length));
        let numbered = b.alliances.some((a) => a.seed != null);
        let head = h("tr", null,
            numbered ? h("th", { class: "seed" }, this.t("colRank")) : null,
            h("th", null, this.t("captain")),
            Array.from({ length: picks - 1 }, (_, i) => h("th", null, this.t("pick", { nth: this.ordinal(i + 1), n: i + 1 }))),
            h("th", { class: "res" }, ""),
        );
        let rows = b.alliances.map((a) => {
            let res = a.id === b.champion ? chip("gold", this.icon("trophy"), this.t("winner")) : a.id === b.finalist ? chip("finalist", this.t("finalist")) : null;
            let mine = this.hasMine(a.id);
            return h("tr", { class: mine ? "me" : null, part: mine ? "alliance alliance-me" : "alliance" },
                numbered ? h("td", { class: "seed", part: "seed" }, a.seed ?? "–") : null,
                Array.from({ length: picks }, (_, i) => {
                    let n = a.teams[i];
                    return h("td", { class: "t", part: "team" }, n ? h("span", { class: "num" }, this.teamLink(n, String(n))) : "");
                }),
                h("td", { class: "res", part: "result" }, res),
            );
        });
        return h("div", { class: "po-sec", part: "alliances" },
            h("h3", { class: "po-h" }, this.t("alliances")),
            h("div", { class: "tbl-wrap" }, h("table", { class: "tbl", part: "table" }, h("thead", null, head), h("tbody", null, rows))),
        );
    }

    bracket(b) {
        let col = (title, entries, final = false) =>
            h("div", { class: "br-col titled", part: "round" }, h("div", { class: "po-h" }, title), h("div", { class: "mb-wrap" }, entries.map((e) => this.box(e, final))));
        let sections = [];
        if (b.format === "series") {
            let cols = [];
            if (b.upper.length) cols.push(col(this.t("semifinals"), b.upper[0], true));
            if (b.finals.length) cols.push(col(this.t("finals"), b.finals, true));
            sections.push(h("div", { class: "br", part: "bracket" }, cols));
        } else {
            let rounds = (list) => list.map((r, i) => col(this.t("roundN", { n: i + 1 }), r));
            if (b.upper.length) sections.push(this.section(this.t("upperBracket"), h("div", { class: "br", part: "bracket bracket-upper" }, rounds(b.upper), b.finals.length && !b.lower.length ? col(this.t("finals"), b.finals, true) : null)));
            if (b.lower.length) sections.push(this.section(this.t("lowerBracket"), h("div", { class: "br", part: "bracket bracket-lower" }, rounds(b.lower))));
            if (b.finals.length && b.lower.length) sections.push(this.section(this.t("finals"), h("div", { class: "br", part: "bracket bracket-finals" }, h("div", { class: "br-col" }, b.finals.map((e) => this.box(e, true))))));
        }
        return h("div", { class: "po-sec", part: "brackets" }, sections);
    }

    section(title, body) {
        return h("div", { class: "po-sec" }, h("h3", { class: "po-h" }, title), body);
    }

    /** One match (or a series of matches between the same two alliances: the finals). */
    box(e, series) {
        let one = e.matches.length === 1 && !series;
        let m = e.matches[e.matches.length - 1];
        let scores = (color) => (m.scores ? m.scores[color.toLowerCase()]?.totalPoints : null);
        let w = one ? matchWinner(m) : null;
        let side = (id, color, i) => {
            let a = this._alliances.get(id);
            let state = e.winner == null ? "" : e.winner === id ? " win" : " lose";
            let value = one ? (m.hasBeenPlayed ? scores(color) : "") : e.wins ? e.wins[i] : "";
            return h("div", { class: `mb-r ${color.toLowerCase()}${state}`, part: `alliance-${color.toLowerCase()}` },
                h("span", { class: "al" }, this.label(id)),
                h("span", { class: "tn" }, (a?.teams || []).filter((n) => a.seed != null || n !== a.captain).map((n, k) => [k ? " " : "", h("span", { class: this._mine.has(n) ? "me" : null }, String(n))])),
                h("span", { class: "sc" }, value ?? ""),
            );
        };
        let when = !m.hasBeenPlayed && m.scheduledStartTime && this.shows("time") ? this.time(m.scheduledStartTime) : "";
        let mine = this.hasMine(e.red) || this.hasMine(e.blue);
        return h("div", { class: `mb${mine ? " me" : ""}`, part: mine ? "match match-me" : "match" },
            h("div", { class: "mb-h" }, h("span", null, e.matches.map((x) => x.description).join(" · ")), h("span", null, when || (one && w === "Tie" ? "=" : ""))),
            side(e.red, "Red", 0),
            side(e.blue, "Blue", 1),
            !one && e.matches.some((x) => x.hasBeenPlayed) && this.shows("games")
                ? h("div", { class: "mb-games", part: "games" }, e.matches.filter((x) => x.hasBeenPlayed && x.scores).map((x) => {
                      // Scores from the series' red side's point of view (alliances can switch colors).
                      let [r] = ["Red", "Blue"].filter((c) => x.teams.some((t) => t.alliance === c && this._alliances.get(e.red)?.teams.includes(t.teamNumber)));
                      let mineScore = x.scores[(r || "Red").toLowerCase()].totalPoints;
                      let theirs = x.scores[(r === "Blue" ? "red" : "blue")].totalPoints;
                      return `${mineScore}–${theirs}`;
                  }).join(" · "))
                : null,
        );
    }
}

/** Registers <ftc-event-playoffs event="NLCMP" season="2025">. Extra attributes: highlight, refresh. */
export function defineEventPlayoffsElement(tagName = "ftc-event-playoffs") {
    defineTeamElement(tagName, EventPlayoffs, { highlight: "highlight", refresh: "refresh" });
}

if (typeof window !== "undefined" && typeof customElements !== "undefined") defineEventPlayoffsElement();
