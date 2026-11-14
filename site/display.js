// The pit display (/display?team=19444): the team's next match, standing, matches and the event's
// rankings on one sheet, in the site's look. The next-match widget's data says which event the team
// is at; the others follow it. Without a team: the form.
(() => {
    const $ = (id) => document.getElementById(id);
    const q = new URLSearchParams(location.search);
    const site = window.FTC_EMBEDS_SITE || {};
    const libs = [window.FtcNextMatch, window.FtcEventMatches, window.FtcEventRankings];
    for (const lib of libs) lib.configure({ apiBase: q.get("apiBase") || site.apiBase || null, graphqlUrl: q.get("graphqlUrl") || site.graphqlUrl || null });

    // Colors: on the display dark unless asked otherwise (a TV in a hall), light, or like the
    // device; the form follows the device, like the rest of the site.
    const team = (q.get("team") || "").trim();
    const themeParam = (q.get("theme") || (/^\d{1,6}$/.test(team) ? "dark" : "auto")).toLowerCase();
    const darkMq = matchMedia("(prefers-color-scheme: dark)");
    const isDark = () => (themeParam === "light" ? false : themeParam === "auto" ? darkMq.matches : true);
    document.documentElement.classList.toggle("dark", isDark());

    if (!/^\d{1,6}$/.test(team)) return showForm();

    // Options for every widget from the URL (hour-cycle -> hourCycle); the look is the site's own.
    const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const shared = {};
    for (const [key, value] of q) {
        if (["team", "event", "theme", "shape", "css", "apiBase", "graphqlUrl"].includes(key)) continue;
        shared[camel(key)] = value === "true" ? true : value === "false" ? false : value;
    }
    // The page's colors, inside the widgets (custom properties reach into them).
    const theme = () => ({
        base: isDark() ? "dark" : "light",
        bg: "var(--paper)", surface: "color-mix(in srgb, var(--ink) 7%, var(--paper))", text: "var(--ink)", muted: "var(--ink-2)", border: "var(--rule)",
        accent: "var(--accent)", accentText: "var(--accent-ink)", gold: "var(--accent)", font: "var(--sans)", shadow: "none",
        radius: "2px", innerRadius: "2px", chipRadius: "2px",
    });
    // A TV isn't for clicking around: plain text instead of links. No cards: the sheet has its own rules.
    Object.assign(shared, { theme: theme(), linkTarget: "none", bare: true, title: "" });
    const fixedEvent = (q.get("event") || "").trim().toUpperCase() || null;
    const locale = shared.locale || shared.lang || undefined;

    // The sheet's own words, in the widgets' languages.
    const WORDS = {
        en: { nextMatch: "Next match", ourMatches: "Our matches", standing: "Standing", rankings: "Rankings", rank: "Rank", record: "Record", ftcTeam: "FTC team {n}", live: "Live", team: "Team", event: "Event", updated: "Updated", screen: "Screen", staysOn: "Stays on", maySleep: "May sleep", maySleepClick: "May sleep · click to keep on", offline: "Offline · data from {t}", fullScreen: "Full screen", change: "Change" },
        nl: { nextMatch: "Volgende wedstrijd", ourMatches: "Onze wedstrijden", standing: "Stand", rankings: "Ranglijst", rank: "Positie", record: "Record", ftcTeam: "FTC-team {n}", live: "Live", team: "Team", event: "Evenement", updated: "Bijgewerkt", screen: "Scherm", staysOn: "Blijft aan", maySleep: "Kan uitgaan", maySleepClick: "Kan uitgaan · klik om aan te houden", offline: "Offline · gegevens van {t}", fullScreen: "Volledig scherm", change: "Wijzigen" },
        de: { nextMatch: "Nächstes Match", ourMatches: "Unsere Matches", standing: "Stand", rankings: "Rangliste", rank: "Rang", record: "Bilanz", ftcTeam: "FTC-Team {n}", live: "Live", team: "Team", event: "Event", updated: "Aktualisiert", screen: "Bildschirm", staysOn: "Bleibt an", maySleep: "Kann ausgehen", maySleepClick: "Kann ausgehen · klicken, um ihn anzulassen", offline: "Offline · Stand {t}", fullScreen: "Vollbild", change: "Ändern" },
        fr: { nextMatch: "Prochain match", ourMatches: "Nos matchs", standing: "Position", rankings: "Classement", rank: "Rang", record: "Bilan", ftcTeam: "Équipe FTC {n}", live: "En direct", team: "Équipe", event: "Événement", updated: "Mis à jour", screen: "Écran", staysOn: "Reste allumé", maySleep: "Peut se mettre en veille", maySleepClick: "Peut se mettre en veille · cliquez pour le garder allumé", offline: "Hors ligne · données de {t}", fullScreen: "Plein écran", change: "Modifier" },
        es: { nextMatch: "Próximo partido", ourMatches: "Nuestros partidos", standing: "Posición", rankings: "Clasificación", rank: "Puesto", record: "Balance", ftcTeam: "Equipo FTC {n}", live: "En directo", team: "Equipo", event: "Evento", updated: "Actualizado", screen: "Pantalla", staysOn: "Se mantiene encendida", maySleep: "Puede apagarse", maySleepClick: "Puede apagarse · haz clic para mantenerla", offline: "Sin conexión · datos de {t}", fullScreen: "Pantalla completa", change: "Cambiar" },
    };
    const words = WORDS[String(shared.lang || "").slice(0, 2).toLowerCase()] || WORDS.en;
    const say = (key, vars = {}) => words[key].replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
    for (const el of document.querySelectorAll("#display [data-l]")) el.textContent = say(el.dataset.l);

    $("display").hidden = false;
    $("team-num").textContent = say("ftcTeam", { n: team });
    $("f-team").textContent = team;
    $("change").href = `/display#${team}`;
    document.title = `${team} · Pit display`;

    // ------------------------------------------------------------ widgets

    // The next match at reading-from-the-pit size: the match and time large, the alliances side by side.
    const NEXT_CSS = `
.nm{padding:calc(var(--u) * 1.2) calc(var(--u) * 1.3);border-radius:2px}
.nm-top{align-items:flex-start}
.nm-label{font-family:var(--mono);font-size:calc(var(--u) * .8);letter-spacing:.08em}
.nm-desc{font-size:calc(var(--u) * 4);letter-spacing:-.03em;line-height:1;margin-top:calc(var(--u) * .4)}
.nm-when{white-space:nowrap;font-size:calc(var(--u) * 1.1)}
.nm-when b{font-family:var(--mono);font-weight:500;font-size:calc(var(--u) * 2.6);letter-spacing:-.03em;line-height:1.05}
.alliances{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:calc(var(--u) * .7);margin-top:calc(var(--u) * 1.1)}
.al{font-size:calc(var(--u) * 1.25);padding:calc(var(--u) * .5) calc(var(--u) * .8);border-left-width:calc(var(--u) * .3);border-radius:0}
.al .t{line-height:1.45}
.last{font-size:calc(var(--u) * 1.05);margin-top:calc(var(--u) * .9)}
.idle{font-size:calc(var(--u) * 1.3)}
.upnext{padding:calc(var(--u) * 1.2) calc(var(--u) * 1.3);border-radius:2px}
.upnext .u-label{font-family:var(--mono);font-size:calc(var(--u) * .8);letter-spacing:.08em}
.upnext .u-name{font-size:calc(var(--u) * 2);line-height:1.15}
.upnext .u-when{font-size:calc(var(--u) * 1.1)}
.upnext .u-when b{font-size:calc(var(--u) * 1.8)}`;
    const height = (el) => `${Math.max(120, el.clientHeight)}px`;
    // The rank is in the standing next to it.
    const next = new FtcNextMatch.NextMatch($("next"), { ...shared, team, hide: "event,rank", css: NEXT_CSS });
    // Every one of "our matches" is the team's own: no need to mark them all.
    const MATCHES_CSS = ".tbl tr.me td{background:none}.tbl tr.me td:first-child{box-shadow:none}";
    let matches = null;
    let rankings = null;
    let shown = null;

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

    const dates = (ev) => {
        try {
            let f = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
            let [a, b] = [new Date(`${ev.start}T12:00:00Z`), new Date(`${ev.end || ev.start}T12:00:00Z`)];
            return ev.end && ev.end !== ev.start && f.formatRange ? f.formatRange(a, b) : f.format(a);
        } catch {
            return ev.start || "";
        }
    };

    function follow() {
        let t = next.data;
        if (t?.name) {
            $("team-name").textContent = t.name;
            document.title = `${team} ${t.name} · Pit display`;
        }
        let found = t?.events?.find((e) => e.event.code === fixedEvent)?.event;
        let ev = fixedEvent ? { code: fixedEvent, season: Number(shared.season) || found?.season, ...found } : pickEvent(t);
        // Nothing to show next to the next match: no event this season (or not loaded at all).
        let solo = !ev && (t || next.error);
        $("standing-sec").hidden = $("matches-sec").hidden = $("rankings-sec").hidden = !ev;
        document.querySelector(".cols").style.gridTemplateColumns = solo ? "minmax(0, 1fr)" : "";
        $("right-col").hidden = !!solo;
        if (!ev) return status();
        $("event-name").textContent = [ev.name || ev.code, ev.start ? dates(ev) : null].filter(Boolean).join(" · ");
        $("f-event").textContent = `${ev.code} · ${ev.season ?? ""}`;
        $("live").hidden = !ev.ongoing;
        let key = `${ev.season}/${ev.code}`;
        if (key !== shown) {
            shown = key;
            let o = { ...shared, event: ev.code, season: ev.season ?? shared.season ?? null };
            if (!matches) {
                // after the sections are shown, so they have their height
                matches = new FtcEventMatches.EventMatches($("matches"), { ...o, team, hide: "event", css: MATCHES_CSS, maxHeight: height($("matches")) });
                rankings = new FtcEventRankings.EventRankings($("rankings"), { columns: "rp,record,opr", ...o, highlight: team, hide: "event,divisions", scrollTo: "team", scrollOffset: 5, maxHeight: height($("rankings")) });
                for (const w of [matches, rankings]) for (const name of ["load", "error"]) w.on(name, status);
                rankings.on("load", standing);
                rankings.on("error", standing);
            } else {
                matches.update(o);
                rankings.update(o);
            }
            standing();
        }
        status();
    }

    /** Rank, record, ranking points and OPR from the rankings. */
    function standing() {
        let ev = rankings?.data;
        let row = ev?.teams?.find((t) => String(t.teamNumber) === team);
        let s = row?.stats;
        let ranked = ev?.teams?.filter((t) => t.stats?.rank).length || 0;
        let num = (v, d) => (v == null ? "–" : Number(v).toLocaleString(locale, { minimumFractionDigits: d, maximumFractionDigits: d }));
        let cell = (label, value, small = "", key = false) =>
            `<div class="cell${key ? " key" : ""}"><b>${label}</b><span>${value}${small ? `<small>${small}</small>` : ""}</span></div>`;
        $("standing").innerHTML = [
            cell(say("rank"), s?.rank ? `#${s.rank}` : "–", s?.rank && ranked ? `/ ${ranked}` : "", true),
            cell(say("record"), s && s.wins != null ? `${s.wins}-${s.losses}-${s.ties}` : "–"),
            cell("RP", num(s?.rp, 2)),
            cell("OPR", num(s?.opr?.totalPointsNp, 1)),
        ].join("");
    }

    /** The footer: when the data was loaded, or that it couldn't be refreshed. */
    function status() {
        let ws = [next, matches, rankings].filter(Boolean);
        let at = Math.max(0, ...ws.map((w) => w.updatedAt || 0));
        let offline = ws.some((w) => w.offline);
        let time = (ms) => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(ms));
        let el = $("f-updated");
        el.textContent = at ? (offline ? say("offline", { t: time(at) }) : time(at)) : "–";
        el.classList.toggle("off", offline);
    }

    follow();
    next.on("load", follow);
    next.on("error", follow);

    // The rankings and matches scroll inside their section: give them its height.
    if (typeof ResizeObserver !== "undefined") {
        new ResizeObserver(() => {
            matches?.update({ maxHeight: height($("matches")) });
            rankings?.update({ maxHeight: height($("rankings")) });
        }).observe(document.querySelector(".cols"));
    }

    // The widgets refresh every 30 s while the event is on. Outside an event they don't, so a
    // display started the evening before would miss the start: check every 5 minutes.
    setInterval(() => {
        if (document.hidden) return;
        for (const w of [next, matches, rankings]) {
            if (!w || w.offline || w.error) continue; // their own retries run
            if (!(w.isLive && w.data && w.isLive(w.data))) w.load();
        }
    }, 5 * 60e3);

    // Theme "auto": follow the device.
    darkMq.addEventListener?.("change", () => {
        if (themeParam !== "auto") return;
        document.documentElement.classList.toggle("dark", isDark());
        for (const w of [next, matches, rankings]) w?.update({ theme: theme() });
    });

    // ------------------------------------------------------------ clock

    let clockFormat;
    try {
        let o = { hour: "2-digit", minute: "2-digit" };
        let cycle = String(shared.hourCycle ?? "");
        if (cycle === "12" || cycle === "24") o.hour12 = cycle === "12";
        if (shared.timeZone) o.timeZone = shared.timeZone;
        clockFormat = new Intl.DateTimeFormat(locale, o);
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
    const screenState = () => ($("f-screen").textContent = say(lock ? "staysOn" : navigator.wakeLock ? "maySleepClick" : "maySleep"));
    async function stayAwake() {
        if (lock || !navigator.wakeLock || document.visibilityState !== "visible") return screenState();
        try {
            lock = await navigator.wakeLock.request("screen");
            lock.addEventListener("release", () => {
                lock = null;
                screenState();
            });
        } catch {
            // not allowed yet (some browsers want a click first): try again on the next one
        }
        screenState();
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
        // The visitor's language, and the team from /display#19444 ("Change").
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
