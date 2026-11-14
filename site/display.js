// The pit display (/display?team=19444): the team's next match, standing, matches and the event's
// rankings on one sheet, in the site's look. The next-match widget's data says which event the team
// is at; the others follow it. Without a team: the form.
(() => {
    const $ = (id) => document.getElementById(id);
    const q = new URLSearchParams(location.search);
    const site = window.FTC_EMBEDS_SITE || {};
    const libs = [window.FtcNextMatch, window.FtcEventMatches, window.FtcEventRankings];
    for (const lib of libs) lib.configure({ apiBase: q.get("apiBase") || site.apiBase || null, graphqlUrl: q.get("graphqlUrl") || site.graphqlUrl || null });

    // The form when there's no team, or to change a display's settings (?setup=1&…).
    const team = (q.get("team") || "").trim();
    const formMode = !/^\d{1,6}$/.test(team) || q.has("setup");
    // Colors: on the display dark unless asked otherwise (a TV in a hall), light, or like the
    // device; the form follows the device, like the rest of the site.
    let themeParam = formMode ? "auto" : (q.get("theme") || "dark").toLowerCase();
    const darkMq = matchMedia("(prefers-color-scheme: dark)");
    const isDark = () => (themeParam === "light" ? false : themeParam === "auto" ? darkMq.matches : true);
    document.documentElement.classList.toggle("dark", isDark());

    if (formMode) return showForm();

    // ------------------------------------------------------------ the sheet's settings

    /** URL parameters that set up the sheet itself; the rest are options for every widget. */
    const SHEET_PARAMS = ["team", "event", "theme", "shape", "css", "apiBase", "graphqlUrl", "size", "spacing", "hide", "side", "split", "highlight", "columns", "accent", "frame", "setup"];
    const SIZES = { s: 0.85, m: 1, l: 1.15, xl: 1.3 };
    const SPACINGS = { compact: 0.6, normal: 1, roomy: 1.5 };
    const clamp = (v, lo, hi, dflt) => (Number.isFinite(+v) && v !== null && v !== "" ? Math.min(hi, Math.max(lo, +v)) : dflt);
    // The look (size, spacing, colors, sides, which sections show) can change while the display
    // runs: the setup page's preview sends new settings instead of loading the display again.
    let size, spacing, hide, rankingsLeft, split, accent;
    const readLook = (p) => {
        size = SIZES[p.get("size")] ?? clamp(p.get("size"), 0.6, 2, 1);
        spacing = SPACINGS[p.get("spacing")] ?? clamp(p.get("spacing"), 0.4, 2, 1);
        hide = new Set((p.get("hide") || "").toLowerCase().split(/[\s,]+/).filter(Boolean));
        rankingsLeft = p.get("side") === "left";
        // The team's column (next match, matches) in percent of the width.
        split = clamp(p.get("split"), 30, 70, 50);
        accent = /^#?[0-9a-f]{6}$/i.test(p.get("accent") || "") ? "#" + p.get("accent").replace("#", "") : null;
    };
    readLook(q);
    const shows = (part) => !hide.has(part);
    const extraTeams = (q.get("highlight") || "").split(/[\s,]+/).filter((n) => /^\d{1,6}$/.test(n) && n !== team);
    const columns = /^[a-z0-9,]+$/i.test(q.get("columns") || "") ? q.get("columns") : "rp,record,opr";
    const display = $("display");
    // Zoom. Everything follows the screen's size, so the browser's zoom alone would change nothing:
    // its zoom is measured and applied on top. Ctrl/⌘ + and − change the sheet's own size instead
    // (saved in the address, so a reload or bookmark keeps it), Ctrl/⌘ 0 goes back to 100%.
    let keyZoom = 1;
    let browserZoom = 1;
    const applySize = () => display.style.setProperty("--size", (size * keyZoom * browserZoom).toFixed(3));
    let zoomNote;
    const showZoom = () => {
        let el = $("zoom-note");
        el.textContent = `${Math.round(size * keyZoom * browserZoom * 100)}%`;
        el.hidden = false;
        clearTimeout(zoomNote);
        zoomNote = setTimeout(() => (el.hidden = true), 1200);
    };
    const saveZoom = () => {
        let p = new URLSearchParams(location.search);
        let total = Math.round(size * keyZoom * 100) / 100;
        if (total === 1) p.delete("size");
        else p.set("size", String(total));
        history.replaceState(null, "", `${location.pathname}?${p}`);
    };
    // The browser's zoom. Chrome and Edge: the window's outer width is in screen pixels, its inner
    // width in CSS pixels, so their ratio is the zoom (also the zoom the site already had when the
    // display opened: browsers keep it per site). It's snapped to the browsers' zoom levels; any
    // other ratio (a docked developer panel) doesn't count. Other browsers: the change of the
    // pixel ratio since the display opened.
    const LEVELS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];
    const startRatio = window.devicePixelRatio || 1;
    const measureZoom = () => {
        let r = window.outerWidth && window.innerWidth ? window.outerWidth / window.innerWidth : 1;
        let level = LEVELS.reduce((a, b) => (Math.abs(b - r) < Math.abs(a - r) ? b : a));
        let fromWindow = Math.abs(level - r) / level < 0.03 ? level : 1;
        let fromRatio = (window.devicePixelRatio || 1) / startRatio;
        return Math.abs(fromWindow - 1) > 0.01 ? fromWindow : fromRatio;
    };
    browserZoom = measureZoom();
    applySize();
    // Every zoom change resizes the page.
    window.addEventListener("resize", () => {
        let z = measureZoom();
        if (Math.abs(z - browserZoom) < 0.01) return;
        browserZoom = z;
        applySize();
        showZoom();
    });
    const KEYS = { plus: ["+", "="], minus: ["-", "_"], reset: ["0"] };
    const CODES = { plus: ["Equal", "NumpadAdd"], minus: ["Minus", "NumpadSubtract"], reset: ["Digit0", "Numpad0"] };
    const which = (e) => Object.keys(KEYS).find((k) => KEYS[k].includes(e.key) || CODES[k].includes(e.code));
    window.addEventListener("keydown", (e) => {
        if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
        let k = which(e);
        if (!k) return;
        if (k === "plus") keyZoom = Math.min(2.5 / size, keyZoom * 1.1);
        else if (k === "minus") keyZoom = Math.max(0.5 / size, keyZoom / 1.1);
        else keyZoom = 1 / size;
        e.preventDefault();
        e.stopPropagation();
        applySize();
        saveZoom();
        showZoom();
    }, { capture: true });
    function applyLook(p) {
        applySize();
        display.style.setProperty("--space", spacing);
        display.classList.toggle("no-frame", p.get("frame") === "false");
        if (accent) document.documentElement.style.setProperty("--accent", accent);
        else document.documentElement.style.removeProperty("--accent");
        $("clock").closest(".now").hidden = !shows("clock");
        document.querySelector(".foot").hidden = !shows("footer");
        // Rankings on the left: that column first.
        let cols = $("right-col").parentNode;
        if (rankingsLeft) cols.prepend($("right-col"));
        else cols.append($("right-col"));
    }
    applyLook(q);

    // Options for every widget from the URL (hour-cycle -> hourCycle); the look is the site's own.
    const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const shared = {};
    for (const [key, value] of q) {
        if (SHEET_PARAMS.includes(key)) continue;
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
    // "Change": the form with these settings.
    $("change").href = `/display?${new URLSearchParams([...q, ["setup", "1"]])}`;
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
    const next = shows("next") ? new FtcNextMatch.NextMatch($("next"), { ...shared, team, hide: "event,rank", css: NEXT_CSS }) : new FtcNextMatch.NextMatch(document.createElement("div"), { ...shared, team });
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

    let currentEvent;
    function follow() {
        let t = next.data;
        if (t?.name) {
            $("team-name").textContent = t.name;
            document.title = `${team} ${t.name} · Pit display`;
        }
        let found = t?.events?.find((e) => e.event.code === fixedEvent)?.event;
        let ev = fixedEvent ? { code: fixedEvent, season: Number(shared.season) || found?.season, ...found } : pickEvent(t);
        currentEvent = ev;
        layout(ev);
        if (!ev) return status();
        $("event-name").textContent = [ev.name || ev.code, ev.start ? dates(ev) : null].filter(Boolean).join(" · ");
        $("f-event").textContent = `${ev.code} · ${ev.season ?? ""}`;
        $("live").hidden = !ev.ongoing;
        let key = `${ev.season}/${ev.code}`;
        if (key !== shown) {
            shown = key;
            let o = { ...shared, event: ev.code, season: ev.season ?? shared.season ?? null };
            if (!rankings) {
                // after the sections are shown, so they have their height; the rankings also feed the standing
                if (shows("matches")) matches = new FtcEventMatches.EventMatches($("matches"), { ...o, team, hide: "event", css: MATCHES_CSS, maxHeight: height($("matches")) });
                rankings = new FtcEventRankings.EventRankings($("rankings"), { columns, ...o, highlight: [team, ...extraTeams].join(","), hide: "event,divisions", scrollTo: "team", scrollOffset: 5, maxHeight: height($("rankings")) });
                for (const w of [matches, rankings].filter(Boolean)) for (const name of ["load", "error"]) w.on(name, status);
                rankings.on("load", standing);
                rankings.on("error", standing);
            } else {
                matches?.update(o);
                rankings.update(o);
            }
            standing();
        }
        status();
    }

    /**
     * Which sections show (the hide parameter, and the event ones only with an event), and the two
     * columns' widths: one column when the other has nothing in it.
     */
    function layout(ev) {
        let sec = (id) => $(id).closest(".sec");
        sec("next").hidden = !shows("next");
        sec("matches").hidden = !(ev && shows("matches"));
        sec("standing").hidden = !(ev && shows("standing"));
        sec("rankings").hidden = !(ev && shows("rankings"));
        let left = $("next").closest(".col");
        let right = $("right-col");
        left.hidden = sec("next").hidden && sec("matches").hidden;
        right.hidden = sec("standing").hidden && sec("rankings").hidden;
        let both = !left.hidden && !right.hidden;
        let [first, second] = rankingsLeft ? [100 - split, split] : [split, 100 - split];
        document.querySelector(".cols").style.gridTemplateColumns = both ? `minmax(0, ${first}fr) minmax(0, ${second}fr)` : "minmax(0, 1fr)";
        // The rule between the columns: on the second one.
        let cols = [...document.querySelectorAll(".cols > .col")];
        cols.forEach((c, i) => c.classList.toggle("divided", both && i === 1));
        // Number the sections in the order they show (01, 02, …), whichever side the rankings are on.
        [...document.querySelectorAll(".cols .sec")].filter((x) => !x.hidden && !x.closest(".col").hidden).forEach((x, i) => (x.querySelector(".sec-h span").textContent = String(i + 1).padStart(2, "0")));
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

    // New settings from the setup page's preview (same site only). A change of the look is applied
    // here; anything else (team, event, language, columns, the next match or matches shown or not:
    // other data or widgets) loads the display again.
    const LOOK = ["size", "spacing", "accent", "frame", "side", "split", "theme", "hide"];
    const REBUILD_PARTS = ["next", "matches"];
    let current = new URLSearchParams(q);
    window.addEventListener("message", (e) => {
        if (e.origin !== location.origin || typeof e.data?.ftcDisplay !== "string") return;
        let url = new URL(e.data.ftcDisplay, location.href);
        if (url.pathname !== location.pathname) return;
        let p = url.searchParams;
        let rest = (x) => [...x].filter(([k]) => !LOOK.includes(k)).map(([k, v]) => `${k}=${v}`).sort().join("&");
        let parts = (x) => REBUILD_PARTS.filter((s) => (x.get("hide") || "").toLowerCase().split(/[\s,]+/).includes(s)).join();
        if (rest(p) !== rest(current) || parts(p) !== parts(current)) return location.replace(url.href);
        current = new URLSearchParams(p);
        history.replaceState(null, "", url.pathname + url.search);
        readLook(p);
        applyLook(p);
        layout(currentEvent);
        let mode = (p.get("theme") || "dark").toLowerCase();
        if (mode !== themeParam) {
            themeParam = mode;
            document.documentElement.classList.toggle("dark", isDark());
            for (const w of [next, matches, rankings]) w?.update({ theme: theme() });
        }
        $("change").href = `/display?${new URLSearchParams([...p, ["setup", "1"]])}`;
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
        const f = $("form");
        const langs = window.FtcNextMatch?.TEAM_LANGUAGES || { en: "English" };
        $("lang").innerHTML = Object.entries(langs).map(([code, name]) => `<option value="${code}">${name}</option>`).join("");
        const DEFAULT_ACCENT = "#ff5a1f";

        // Start from the display's settings (its "Change" link), or the visitor's language.
        let get = (k) => q.get(k) || "";
        f.team.value = /^\d{1,6}$/.test(team) ? team : /^\d{1,6}$/.test(location.hash.slice(1)) ? location.hash.slice(1) : "";
        f.event.value = get("event");
        f.theme.value = ["light", "auto"].includes(get("theme")) ? get("theme") : "dark";
        let mine = (get("lang") || navigator.language || "en").slice(0, 2).toLowerCase();
        f.lang.value = mine in langs ? mine : "en";
        f["hour-cycle"].value = ["12", "24"].includes(get("hour-cycle")) ? get("hour-cycle") : "";
        f.accent.value = /^[0-9a-f]{6}$/i.test(get("accent")) ? `#${get("accent")}` : DEFAULT_ACCENT;
        f.frame.checked = get("frame") !== "false";
        let hidden = new Set(get("hide").split(/[\s,]+/));
        for (let box of f.querySelectorAll('[name="show"]')) box.checked = !hidden.has(box.value);
        f.split.value = get("split") || "50";
        f.columns.value = [...f.columns.options].some((o) => o.value === get("columns")) ? get("columns") : "";
        f.highlight.value = get("highlight");
        const segs = { size: get("size") || "m", spacing: get("spacing") || "normal", side: get("side") || "right" };

        for (let seg of document.querySelectorAll(".seg[data-name]")) {
            let name = seg.dataset.name;
            let mark = () => seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === segs[name])));
            mark();
            seg.addEventListener("click", (e) => {
                let b = e.target.closest("button");
                if (!b) return;
                segs[name] = b.dataset.v;
                mark();
                update();
            });
        }
        $("accent-reset").addEventListener("click", () => {
            f.accent.value = DEFAULT_ACCENT;
            update();
        });

        /** The display's link, with only what differs from the defaults. */
        function params() {
            let p = new URLSearchParams();
            let n = f.team.value.trim();
            p.set("team", n);
            let ev = f.event.value.trim().toUpperCase();
            if (/^[A-Z0-9]{1,32}$/.test(ev)) p.set("event", ev);
            if (f.theme.value !== "dark") p.set("theme", f.theme.value);
            if (f.lang.value !== "en") p.set("lang", f.lang.value);
            if (segs.size !== "m") p.set("size", segs.size);
            if (segs.spacing !== "normal") p.set("spacing", segs.spacing);
            if (f["hour-cycle"].value) p.set("hour-cycle", f["hour-cycle"].value);
            if (f.accent.value.toLowerCase() !== DEFAULT_ACCENT) p.set("accent", f.accent.value.slice(1).toLowerCase());
            if (!f.frame.checked) p.set("frame", "false");
            let hide = [...f.querySelectorAll('[name="show"]')].filter((b) => !b.checked).map((b) => b.value);
            if (hide.length) p.set("hide", hide.join(","));
            if (segs.side !== "right") p.set("side", segs.side);
            if (f.split.value !== "50") p.set("split", f.split.value);
            if (f.columns.value) p.set("columns", f.columns.value);
            let marked = f.highlight.value.split(/[\s,]+/).filter((x) => /^\d{1,6}$/.test(x));
            if (marked.length) p.set("highlight", marked.join(","));
            return p;
        }

        // Whether two display links differ only in their look (what the display can change live).
        const LOOK = ["size", "spacing", "accent", "frame", "side", "split", "theme", "hide"];
        function lookOnly(a, b) {
            let [x, y] = [a, b].map((u) => new URL(u || "/display", location.href).searchParams);
            let rest = (p) => [...p].filter(([k]) => !LOOK.includes(k)).map(([k, v]) => `${k}=${v}`).sort().join("&");
            let parts = (p) => ["next", "matches"].filter((s) => (p.get("hide") || "").split(",").includes(s)).join();
            return rest(x) === rest(y) && parts(x) === parts(y);
        }

        let timer;
        function update() {
            let ok = /^\d{1,6}$/.test(f.team.value.trim());
            let path = `/display?${params()}`;
            $("link").value = ok ? location.origin + path : `${location.origin}/display`;
            $("open").href = ok ? path : "/display";
            $("open").setAttribute("aria-disabled", String(!ok));
            $("pv-empty").hidden = ok;
            // The preview loads the real display; wait until the typing stops.
            clearTimeout(timer);
            if (!ok) return ($("pv-frame").hidden = true);
            // Once it has loaded, it gets the new settings instead: a change of the look shows at once,
            // without loading everything again (the display reloads itself when it has to).
            let frame = $("pv-frame");
            if (frame.dataset.ready && frame.dataset.path !== path && lookOnly(frame.dataset.path, path)) {
                frame.dataset.path = path;
                frame.hidden = false;
                frame.contentWindow?.postMessage({ ftcDisplay: path }, location.origin);
                return;
            }
            timer = setTimeout(() => {
                if (frame.dataset.path !== path) {
                    frame.dataset.path = path;
                    delete frame.dataset.ready;
                    frame.src = path;
                }
                frame.hidden = false;
            }, 500);
        }
        // The preview is the display at 1920 × 1080, scaled to fit.
        let scale = () => ($("pv-frame").style.transform = `scale(${$("pv").clientWidth / 1920})`);
        if (typeof ResizeObserver !== "undefined") new ResizeObserver(scale).observe($("pv"));
        scale();
        $("pv-frame").addEventListener("load", () => ($("pv-frame").dataset.ready = "1"));
        f.addEventListener("input", update);
        f.addEventListener("change", update);
        f.addEventListener("submit", (e) => {
            e.preventDefault();
            if (/^\d{1,6}$/.test(f.team.value.trim())) location.href = `/display?${params()}`;
        });
        $("copy").addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText($("link").value);
                $("copy").textContent = "Copied";
                setTimeout(() => ($("copy").textContent = "Copy link"), 1500);
            } catch {
                $("link").select();
            }
        });
        update();
    }
})();
