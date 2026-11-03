/*!
 * ftc-embeds/team-awards: every award an FTC team won, by season, as a list or a scrolling strip
 * of award cards, from FTCScout. Zero dependencies. License: MIT
 */
import { TeamWidget, defineTeamElement, h, strip, awardParts, isWinningAward, seasonName } from "../core/team-ui.mjs";

const ALLIANCE = new Set(["Winner", "Finalist", "DivisionWinner", "DivisionFinalist", "ConferenceFinalist"]);
/** Classes for styling by kind: "alliance" | "judged", "p1".."pN", "won". */
const kinds = (a) => `${ALLIANCE.has(a.type) ? "alliance" : "judged"} p${a.placement}${isWinningAward(a.type, a.placement) ? " won" : ""} type-${a.type}`;
const kindParts = (a) => `${ALLIANCE.has(a.type) ? "alliance" : "judged"}${isWinningAward(a.type, a.placement) ? " won" : ""}`;
import { getTeamAwards } from "../core/team-api.mjs";
export { configure, EmbedsApiError, DEFAULT_API_BASE } from "../core/api.mjs";
export { getTeamAwards, TEAM_AWARDS_QUERY } from "../core/team-api.mjs";
export { TEAM_THEMES, TEAM_THEME_MODES, TEAM_SHAPES, TEAM_THEME_SHAPES, ICONS } from "../core/team-ui.mjs";
export { TEAM_TEXT } from "../core/team-text.mjs";

export class TeamAwards extends TeamWidget {
    static kind = "team-awards";
    // layout: "list" | "strip"; seasons: how many seasons; onlyWon: only won awards;
    // types: only these award types ("Inspire,Think,Winner")
    static defaults = { layout: "list", seasons: null, onlyWon: false, types: null };
    static css = `
.season{margin-top:12px}
.season:first-of-type{margin-top:0}
.sname{font-size:var(--_small-size);font-weight:650;color:var(--_muted);text-transform:var(--_label-transform);letter-spacing:var(--_label-letter-spacing);margin-bottom:4px}
.aw{display:grid;grid-template-columns:22px minmax(0,1fr) auto;gap:8px;align-items:baseline;padding:calc(var(--_row-padding) / 2) 0;border-top:var(--_separator-width) solid var(--_border)}
.sname+.aw{border-top:0}
.aw .icon{font-size:14px;justify-self:center}
.an{font-weight:600}
.an .pl{font-weight:450;color:var(--_muted)}
.ae{font-size:12px;color:var(--_muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ad{font-size:12px;color:var(--_muted);white-space:nowrap}
.count{font-size:12px;color:var(--_muted)}
.hd-extra{display:flex;gap:10px;align-items:center}
.strip>.card{min-height:var(--_card-height);gap:3px;border-top:4px solid var(--_border)}
.card.won{border-top-color:var(--_gold)}
.card.p2{border-top-color:color-mix(in srgb,var(--_muted) 60%,transparent)}
.card .c-icon{font-size:22px;line-height:1;margin-bottom:4px}
.card .c-name{font-weight:700;line-height:1.2}
.card .c-place{font-size:12.5px;color:var(--_muted)}
.card .c-event{margin-top:auto;padding-top:6px;font-size:12px;line-height:1.3}
.card .c-season{font-size:11.5px;color:var(--_muted)}`;

    static skins = {
        trophy: `
.strip>.card{border:0;padding:20px 14px 16px;align-items:center;text-align:center;text-transform:uppercase;color:#fff;position:relative;overflow:hidden;
  background:linear-gradient(160deg,#e4e4e7 0%,#b4b4bb 45%,#8e8e97 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.65),0 8px 18px rgba(0,0,0,.28);transition:transform .2s ease,box-shadow .2s ease}
.strip>.card::after{content:"";position:absolute;inset:0;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.22) 45%,transparent 60%);pointer-events:none}
.strip>.card:hover{transform:translateY(-4px)}
.card.judged.won{background:linear-gradient(160deg,#fdba74 0%,#f97316 55%,#d9580b 100%)}
.card.alliance.won{box-shadow:0 0 0 3px var(--_gold),var(--_glow) color-mix(in srgb,var(--_gold) 45%,transparent),inset 0 1px 0 rgba(255,255,255,.65)}
.card .c-icon{order:0;font-size:46px;margin:2px 0 0;filter:drop-shadow(0 6px 8px rgba(0,0,0,.28))}
.card .c-event{order:1;margin:auto 0 0;padding:0;font-size:18px;font-weight:850;line-height:1.12;color:#111827;letter-spacing:.01em;-webkit-line-clamp:3}
.card .c-event a{color:inherit}
.card .c-name{order:2;margin-top:14px;font-size:13px;font-weight:800;letter-spacing:.06em;text-shadow:0 1px 2px rgba(0,0,0,.28)}
.card .c-season{order:3;margin-top:2px;font-size:12px;font-weight:700;color:rgba(255,255,255,.9)}
.card .c-place{order:4;margin-top:10px;font-size:10.5px;font-weight:800;letter-spacing:.06em;color:var(--_gold);background:rgba(17,24,39,.78);padding:4px 11px;border-radius:999px}
.count{color:var(--_muted);text-transform:uppercase;letter-spacing:.05em;font-size:11px;font-weight:700}
.sname{color:var(--_accent)}
.aw{border-color:var(--_border)}
.aw.won .an{color:var(--_gold)}`,
    };

    fetch(api) {
        return getTeamAwards(this.options.team, api);
    }

    _awards(t) {
        let types = this.options.types ? new Set(String(this.options.types).split(/[\s,]+/).map((x) => x.toLowerCase())) : null;
        return [...t.awards]
            .filter((a) => (!this.options.onlyWon || isWinningAward(a.type, a.placement)) && (!types || types.has(a.type.toLowerCase())))
            .sort((x, y) => y.season - x.season || (y.event?.start || "").localeCompare(x.event?.start || "") || x.placement - y.placement);
    }

    view(t) {
        let awards = this._awards(t);
        let seasons = [...new Set(awards.map((a) => a.season))];
        if (Number(this.options.seasons)) seasons = seasons.slice(0, Number(this.options.seasons));
        awards = awards.filter((a) => seasons.includes(a.season));
        if (Number(this.options.limit)) awards = awards.slice(0, Number(this.options.limit));
        // Only the seasons that still have awards after the limit.
        seasons = seasons.filter((s) => awards.some((a) => a.season === s));
        let wins = awards.filter((a) => isWinningAward(a.type, a.placement)).length;
        let count = this.shows("count") ? h("span", { class: "count", part: "count" }, this.t("awardCount", { n: awards.length }) + (wins ? this.t("awardsWon", { n: wins }) : "")) : null;

        if (!awards.length) return h("div", null, this.heading(this.t("awards"), count), h("div", { class: "muted" }, this.t("noAwards")));

        if (this.layout === "strip") {
            let cards = awards.map((a) => {
                let [name, placement] = awardParts(a.type, a.placement, a.season, this);
                let won = isWinningAward(a.type, a.placement);
                return h("div", { class: `card ${kinds(a)}`, part: `award-card ${kindParts(a).split(" ").map((k) => `award-card-${k}`).join(" ")}` },
                    this.shows("icon") ? h("div", { class: "c-icon" }, this.icon(won ? "trophy" : "medal")) : null,
                    h("div", { class: "c-name", part: "award-name" }, name),
                    placement && this.shows("placement") ? h("div", { class: "c-place", part: "placement" }, placement, a.personName ? ` · ${a.personName}` : "") : null,
                    this.shows("event") ? h("div", { class: "c-event clamp2", part: "event" }, this.eventLink(a.season, a.eventCode, a.event?.name || a.eventCode)) : null,
                    this.shows("season") ? h("div", { class: "c-season", part: "season" }, seasonName(a.season)) : null,
                );
            });
            let { row, arrows } = strip(cards, this);
            return h("div", null, this.heading(this.t("awards"), h("div", { class: "hd-extra" }, count, arrows)), row);
        }

        let groups = seasons.map((season) => h("div", { class: "season", part: "season-group" },
            this.shows("season") ? h("div", { class: "sname", part: "season" }, seasonName(season)) : null,
            awards.filter((a) => a.season === season).map((a) => {
                let [name, placement] = awardParts(a.type, a.placement, season, this);
                let won = isWinningAward(a.type, a.placement);
                return h("div", { class: `aw ${kinds(a)}`, part: `award ${kindParts(a).split(" ").map((k) => `award-${k}`).join(" ")}` },
                    this.shows("icon") ? this.icon(won ? "trophy" : "medal") : h("span"),
                    h("div", { style: { minWidth: "0" } },
                        h("div", { class: "an", part: "award-name" }, name, placement && this.shows("placement") ? h("span", { class: "pl" }, ` · ${placement}`) : null, a.personName ? h("span", { class: "pl" }, ` (${a.personName})`) : null),
                        this.shows("event") ? h("div", { class: "ae", part: "event" }, this.eventLink(season, a.eventCode, a.event?.name || a.eventCode)) : null,
                    ),
                    this.shows("date") ? h("span", { class: "ad", part: "date" }, a.event?.start ? this.day(a.event.start) : "") : h("span"),
                );
            }),
        ));
        return h("div", null, this.heading(this.t("awards"), count), groups);
    }
}

/** Registers <ftc-team-awards team="16236">. Extra attributes: seasons, only-won, types. */
export function defineTeamAwardsElement(tagName = "ftc-team-awards") {
    defineTeamElement(tagName, TeamAwards, { seasons: "seasons", "only-won": "onlyWon", types: "types" });
}

if (typeof window !== "undefined" && typeof customElements !== "undefined") defineTeamAwardsElement();
