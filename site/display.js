// The pit display (/display?team=19444): the team's next match, its matches and the event's
// rankings, full screen. The next-match widget's data says which event the team is at; the other
// two follow it. Without a team: the form.
(() => {
    const $ = (id) => document.getElementById(id);
    const q = new URLSearchParams(location.search);
    const site = window.FTC_EMBEDS_SITE || {};
    const libs = [window.FtcNextMatch, window.FtcEventMatches, window.FtcEventRankings];
    for (const lib of libs) lib.configure({ apiBase: q.get("apiBase") || site.apiBase || null, graphqlUrl: q.get("graphqlUrl") || site.graphqlUrl || null });

    const team = (q.get("team") || "").trim();
    if (!/^\d{1,6}$/.test(team)) return showForm();

    // Options for every widget: any URL parameter (hour-cycle -> hourCycle), JSON for objects.
    const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const shared = { theme: "dark" };
    for (const [key, raw] of q) {
        if (["team", "event", "apiBase", "graphqlUrl"].includes(key)) continue;
        let value = raw;
        if (/^\s*[{[]/.test(raw)) {
            try {
                value = JSON.parse(raw);
            } catch {
                // keep the text
            }
        } else if (raw === "true" || raw === "false") value = raw === "true";
        shared[camel(key)] = value;
    }
    // A TV isn't for clicking around: plain text instead of links.
    shared.linkTarget = "none";
    const fixedEvent = (q.get("event") || "").trim().toUpperCase() || null;

    // The page's own colors follow the widgets' theme: light themes get a light page.
    const themeName = typeof shared.theme === "string" ? shared.theme : shared.theme?.base || "dark";
    const light = /^(light|ftc-events|ftcscout|trophy-light)$/.test(themeName) || (themeName.endsWith("auto") && !matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("light", light);
    document.documentElement.lang = shared.lang || "en";

    $("display").hidden = false;
    $("team-num").textContent = team;
    document.title = `${team} · Pit display`;
    $("change").href = `/display#${team}`;

    // ------------------------------------------------------------ widgets

    const height = (el) => `${Math.max(120, el.clientHeight)}px`;
    // The widget's next-match box at TV size (its own sizes are for a website). --u is the page's
    // screen unit, which reaches inside the widget.
    const NEXT_CSS = `
.nm{padding:calc(var(--u) * 1.4)}
.nm-label{font-size:calc(var(--u) * 1.2)}
.nm-desc{font-size:calc(var(--u) * 4.4);letter-spacing:-.02em}
.nm-when{font-size:calc(var(--u) * 1.5)}
.nm-top{align-items:flex-start}
.nm-when{white-space:nowrap}
.nm-when b{font-size:calc(var(--u) * 3);line-height:1.1}
.alliances{grid-template-columns:minmax(0,1fr);gap:calc(var(--u) * .7);margin-top:calc(var(--u) * 1.2)}
.al{font-size:calc(var(--u) * 1.6);padding:calc(var(--u) * .6) calc(var(--u) * 1);border-left-width:calc(var(--u) * .35)}
.al .t{line-height:1.35}
.last{font-size:calc(var(--u) * 1.4);margin-top:calc(var(--u) * 1.2)}
.upnext{padding:calc(var(--u) * 1.4)}
.upnext .u-label{font-size:calc(var(--u) * 1.2)}
.upnext .u-name{font-size:calc(var(--u) * 2.4)}
.upnext .u-when{font-size:calc(var(--u) * 1.3)}
.upnext .u-when b{font-size:calc(var(--u) * 2)}`;
    const next = new FtcNextMatch.NextMatch($("next"), { ...shared, team, title: "", css: NEXT_CSS + (shared.css || "") });
    let matches = null;
    let rankings = null;
    let shownEvent = null;

    /** The event to show: the one the team is at, else one starting today or tomorrow, else the last one. */
    function pickEvent(t) {
        if (!t?.events?.length) return null;
        let pad = (n) => String(n).padStart(2, "0");
        let now = new Date();
        let today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        let days = (d) => Math.round((Date.parse(d) - Date.parse(today)) / 86400e3);
        let events = t.events.map((e) => e.event).sort((a, b) => a.start.localeCompare(b.start));
        let mine = (e) => t.matches?.some((m) => m.eventCode === e.code);
        return (
            events.find((e) => e.ongoing && mine(e)) ||
            events.find((e) => e.ongoing) ||
            events.find((e) => !e.started && days(e.start) >= 0 && days(e.start) <= 1) ||
            events.filter((e) => e.started).at(-1) ||
            events.find((e) => !e.started) ||
            null
        );
    }

    function follow() {
        let t = next.data;
        if (t?.name) $("team-name").textContent = t.name;
        if (t?.name) document.title = `${team} ${t.name} · Pit display`;
        let ev = fixedEvent
            ? { code: fixedEvent, season: shared.season || t?.events?.find((e) => e.event.code === fixedEvent)?.event.season || null, name: t?.events?.find((e) => e.event.code === fixedEvent)?.event.name }
            : pickEvent(t);
        // Nothing yet (still loading): wait. No event at all this season: the next match alone.
        if (!ev) {
            if (t || next.error) $("panels").classList.add("solo");
            return;
        }
        $("panels").classList.remove("solo");
        $("event-name").textContent = ev.name || ev.code;
        let key = `${ev.season}/${ev.code}`;
        if (key === shownEvent) return;
        shownEvent = key;
        let o = { ...shared, event: ev.code, season: ev.season ?? shared.season ?? null };
        if (!matches) {
            matches = new FtcEventMatches.EventMatches($("matches"), { ...o, team, hide: "location,type", maxHeight: height($("matches")) });
            rankings = new FtcEventRankings.EventRankings($("rankings"), { columns: "rp,record,opr", ...o, highlight: team, hide: "location,type,date,divisions", scrollTo: "team", maxHeight: height($("rankings")) });
        } else {
            matches.update(o);
            rankings.update(o);
        }
    }
    // The widget shows data from the browser's cache at once (no "load" event for that) and
    // then loads; follow both.
    follow();
    next.on("load", follow);
    next.on("error", follow);

    // The rankings and matches scroll inside their panel: give them its height.
    if (typeof ResizeObserver !== "undefined") {
        new ResizeObserver(() => {
            matches?.update({ maxHeight: height($("matches")) });
            rankings?.update({ maxHeight: height($("rankings")) });
        }).observe($("panels"));
    }

    // The widgets refresh themselves every 30 s while the event is on. Outside an event they
    // don't, so a display started the evening before would miss the start: check every 5 minutes.
    setInterval(() => {
        if (document.hidden) return;
        for (const w of [next, matches, rankings]) {
            if (!w || w.offline || w.error) continue; // their own retries run
            let live = w.isLive && w.data && w.isLive(w.data);
            if (!live) w.load();
        }
    }, 5 * 60e3);

    // ------------------------------------------------------------ clock

    let clockFormat;
    try {
        let o = { hour: "2-digit", minute: "2-digit" };
        let cycle = String(shared.hourCycle ?? "");
        if (cycle === "12" || cycle === "24") o.hour12 = cycle === "12";
        if (shared.timeZone) o.timeZone = shared.timeZone;
        clockFormat = new Intl.DateTimeFormat(shared.locale || shared.lang || undefined, o);
    } catch {
        clockFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
    }
    const tick = () => {
        let now = new Date();
        $("clock").textContent = clockFormat.format(now);
        $("clock").dateTime = now.toISOString();
        setTimeout(tick, 1000 - (now.getMilliseconds() % 1000) + 5);
    };
    tick();

    // ------------------------------------------------------------ screen

    // Keep the screen on. The lock goes when the tab is hidden; take it again when it's back.
    let lock = null;
    async function stayAwake() {
        if (lock || !navigator.wakeLock || document.visibilityState !== "visible") return;
        try {
            lock = await navigator.wakeLock.request("screen");
            lock.addEventListener("release", () => (lock = null));
        } catch {
            // not allowed (battery saver, no user gesture yet in some browsers): try on the next click
        }
    }
    stayAwake();
    document.addEventListener("visibilitychange", stayAwake);
    document.addEventListener("pointerdown", stayAwake);

    const fullscreen = () => {
        stayAwake();
        if (document.fullscreenElement) document.exitFullscreen?.();
        else document.documentElement.requestFullscreen?.().catch(() => {});
    };
    $("fullscreen").addEventListener("click", fullscreen);
    if (!document.documentElement.requestFullscreen) $("fullscreen").hidden = true;
    document.addEventListener("keydown", (e) => {
        if ((e.key === "f" || e.key === "F") && !e.ctrlKey && !e.metaKey && !e.altKey) fullscreen();
    });

    // The cursor and the buttons hide after a few seconds without movement.
    let idleTimer;
    const wake = () => {
        document.body.classList.remove("idle");
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => document.body.classList.add("idle"), 3000);
    };
    for (const ev of ["pointermove", "pointerdown", "keydown"]) document.addEventListener(ev, wake, { passive: true });
    wake();

    // ------------------------------------------------------------ form

    function showForm() {
        $("start").hidden = false;
        let langs = window.FtcNextMatch?.TEAM_LANGUAGES || { en: "English" };
        $("lang").innerHTML = Object.entries(langs).map(([code, name]) => `<option value="${code}">${name}</option>`).join("");
        // Preselect the visitor's language, and the team from /display#19444 ("Change").
        let mine = (navigator.language || "en").slice(0, 2).toLowerCase();
        if (mine in langs) $("lang").value = mine;
        let prev = location.hash.slice(1);
        if (/^\d{1,6}$/.test(prev)) $("form").team.value = prev;
        $("form").addEventListener("submit", (e) => {
            e.preventDefault();
            let f = $("form");
            let p = new URLSearchParams({ team: f.team.value.trim() });
            if (f.theme.value !== "dark") p.set("theme", f.theme.value);
            if (f.lang.value !== "en") p.set("lang", f.lang.value);
            location.href = `/display?${p}`;
        });
    }
})();
