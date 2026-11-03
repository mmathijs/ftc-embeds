/*!
 * ftc-embeds/countdown: a countdown to an FTC event (its first day, in its own time zone), or to
 * a team's next match at the event it is at, or else its next event, from FTCScout. Zero
 * dependencies. License: MIT
 */
import { TeamWidget, defineTeamElement, h, place } from "../core/team-ui.mjs";
import { chip, matchStatus, isLive } from "../core/team-views.mjs";
import { getEventInfo } from "../core/event-api.mjs";
import { getTeamMatches } from "../core/team-api.mjs";
export { configure, EmbedsApiError, DEFAULT_API_BASE } from "../core/api.mjs";
export { getEventInfo, parseEventCode, EVENT_INFO_QUERY } from "../core/event-api.mjs";
export { getTeamMatches, seasonOf } from "../core/team-api.mjs";
export { TEAM_THEMES, TEAM_THEME_MODES, TEAM_SHAPES, TEAM_THEME_SHAPES, ICONS } from "../core/team-ui.mjs";
export { TEAM_TEXT } from "../core/team-text.mjs";

/** The moment a day ("2026-02-07") starts in a time zone ("Europe/Amsterdam"), as epoch ms. */
export function zonedMidnight(date, timeZone) {
    let [y, m, d] = date.split("-").map(Number);
    let guess = Date.UTC(y, m - 1, d);
    if (!timeZone) return guess;
    let offset = (t) => {
        let p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
            .formatToParts(new Date(t)).map((x) => [x.type, x.value]));
        return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - t;
    };
    let t = guess - offset(guess);
    return guess - offset(t); // again, in case the offset changes in between (DST)
}

/** Days, hours, minutes and seconds left until `target` (all 0 once it has passed). */
export function timeLeft(target, now) {
    let s = Math.max(0, Math.floor((target - now) / 1000));
    return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60, total: s };
}

const UNITS = [["days", "cdDays"], ["hours", "cdHours"], ["minutes", "cdMinutes"], ["seconds", "cdSeconds"]];

export class Countdown extends TeamWidget {
    static kind = "countdown";
    static subjects = ["event", "team"];
    // layout: "boxes" (default) | "compact" (one line)
    static defaults = { layout: "boxes", refresh: 30 };
    static css = `
.cd-what{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;margin:-4px 0 12px;font-size:var(--_small-size);color:var(--_muted)}
.cd-what .ev-name{font-weight:600;color:var(--_text)}
.cd-label{font-size:calc(var(--_small-size) - .5px);color:var(--_muted);text-transform:var(--_label-transform);letter-spacing:var(--_label-letter-spacing);margin-bottom:6px}
.cd-boxes{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--_gap)}
.cd-box{background:var(--_surface);border-radius:var(--_inner-radius);padding:10px 6px;text-align:center}
.cd-num{display:block;font-size:calc(var(--_value-size) * 1.6);font-weight:var(--_value-weight);line-height:1.1;font-variant-numeric:tabular-nums}
.cd-unit{display:block;font-size:calc(var(--_small-size) - .5px);color:var(--_muted);text-transform:var(--_label-transform);letter-spacing:var(--_label-letter-spacing);margin-top:2px}
.cd-line{font-size:var(--_value-size);font-weight:var(--_value-weight);font-variant-numeric:tabular-nums}
.cd-line .cd-unit{display:inline;margin:0 8px 0 2px;font-size:var(--_small-size)}
.cd-state{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;font-size:var(--_value-size);font-weight:var(--_value-weight)}
.cd-state a.watch{font-size:var(--_small-size);font-weight:600;color:var(--_accent)}
.cd-done{color:var(--_muted)}
@container (max-width:300px){.cd-boxes{grid-template-columns:repeat(2,minmax(0,1fr))}}`;

    fetch(api) {
        // An event (event + season), or else a team's next match or event.
        return this.byEvent ? getEventInfo(this.options.event, api) : getTeamMatches(this.options.team, api);
    }

    get byEvent() {
        return this.options.event != null && this.options.event !== "";
    }

    isLive(d) {
        return this.byEvent ? false : isLive(d);
    }

    /** What the countdown is to: { target (ms), label, event, live, done, match }. */
    goal(d, now) {
        if (this.byEvent) {
            let ev = d;
            if (ev.ongoing) return { event: ev, live: true };
            if (ev.finished || ev.started) return { event: ev, done: true };
            return { event: ev, target: zonedMidnight(ev.start, ev.timezone), label: this.t("cdStartsIn") };
        }
        let st = matchStatus(d, now);
        if (st.current) {
            let next = st.next;
            if (next?.match.scheduledStartTime && new Date(next.match.scheduledStartTime) > now) {
                return { event: st.current, target: new Date(next.match.scheduledStartTime).getTime(), label: this.t("cdMatchIn", { match: next.match.description }), match: next };
            }
            return { event: st.current, live: true, onField: !!next };
        }
        if (st.upcoming) {
            let tz = d.events.find((e) => e.event.code === st.upcoming.code)?.event.timezone;
            return { event: st.upcoming, target: zonedMidnight(st.upcoming.start, tz), label: this.t("cdNextEvent") };
        }
        return { none: true };
    }

    view(d) {
        let now = this.now();
        let g = this.goal(d, now);
        this._target = g.target ?? null;
        let title = this.byEvent ? this.t("countdown") : this.t("team", { team: d.number });
        let what = g.event && this.shows("event")
            ? h("div", { class: "cd-what", part: "event" },
                h("span", { class: "ev-name" }, this.eventLink(g.event.season, g.event.code, g.event.name)),
                this.shows("date") ? h("span", { part: "date" }, this.dates(g.event.start, g.event.end)) : null,
                this.shows("location") && g.event.location ? h("span", { part: "location" }, g.event.remote ? this.t("remote") : place(g.event.location)) : null)
            : null;
        let body;
        if (g.none) body = h("div", { class: "cd-done", part: "state" }, this.t("cdNoUpcoming"));
        else if (g.done) body = h("div", { class: "cd-done", part: "state" }, this.t("cdFinished"));
        else if (g.live) {
            let stream = this.byEvent && d.liveStreamURL && this.shows("stream") ? this.linkTo(d.liveStreamURL, this.t("cdWatch")) : null;
            if (stream) stream.classList.add("watch");
            body = h("div", { class: "cd-state", part: "state" }, chip("live", this.t("live")), g.onField ? this.t("cdOnField") : this.t("cdLive"), stream);
        } else body = h("div", null, h("div", { class: "cd-label", part: "label" }, g.label), this.clock(timeLeft(g.target, now.getTime())));
        return h("div", null, this.heading(title), what, body);
    }

    clock(left) {
        let units = UNITS.filter(([u]) => u !== "days" || left.days > 0 || this.layout !== "compact");
        if (this.layout === "compact") {
            return h("div", { class: "cd-line", part: "clock" }, units.map(([u, label]) => [
                h("span", { "data-unit": u }, String(left[u]).padStart(u === "days" ? 1 : 2, "0")),
                h("span", { class: "cd-unit", "data-label": u }, this.t(label, { n: left[u] })),
            ]));
        }
        return h("div", { class: "cd-boxes", part: "clock" }, units.map(([u, label]) =>
            h("div", { class: "cd-box", part: `unit unit-${u}` },
                h("span", { class: "cd-num", "data-unit": u }, String(left[u]).padStart(u === "days" ? 1 : 2, "0")),
                h("span", { class: "cd-unit", "data-label": u }, this.t(label, { n: left[u] })))));
    }

    render() {
        this._target = null; // set by view(), when there is something to count down to
        super.render();
        clearInterval(this._tick);
        if (this._target == null || this._destroyed) return;
        // Tick every second without rebuilding the widget; reload when it reaches zero.
        let start = this.now().getTime();
        let t0 = Date.now();
        this._tick = setInterval(() => {
            let left = timeLeft(this._target, start + (Date.now() - t0));
            for (let [u, label] of UNITS) {
                let n = this.root.querySelector(`[data-unit="${u}"]`);
                if (n) n.textContent = String(left[u]).padStart(u === "days" ? 1 : 2, "0");
                let l = this.root.querySelector(`[data-label="${u}"]`);
                if (l) l.textContent = this.t(label, { n: left[u] });
            }
            if (left.total === 0) {
                clearInterval(this._tick);
                if (!this.options.data) this.load();
            }
        }, 1000);
    }

    destroy() {
        clearInterval(this._tick);
        super.destroy();
    }
}

/** Registers <ftc-countdown event="NLCMP" season="2025"> or <ftc-countdown team="19444">. Extra attribute: refresh. */
export function defineCountdownElement(tagName = "ftc-countdown") {
    defineTeamElement(tagName, Countdown, { refresh: "refresh" });
}

if (typeof window !== "undefined" && typeof customElements !== "undefined") defineCountdownElement();
