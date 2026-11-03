// Dashboard for ftc-embeds.com: one settings object drives the live preview and the snippets.
(() => {
    const { PitMap, configure, THEMES } = window.FtcPitMap;
    const SITE = window.FTC_EMBEDS_SITE || {};
    const EXAMPLES = window.PIT_MAPS || {};
    const ORIGIN = location.origin;
    const LIVE_API = !!(SITE.apiBase || SITE.graphqlUrl);
    const $ = (id) => document.getElementById(id);

    const EXAMPLE_NAMES = {
        FPEEUR: "European Premier Event",
        NLCMP: "Netherlands Championship",
        FTCCMP1: "FIRST Championship (all divisions)",
        FTCCMP1EDIS: "Worlds – Edison",
        FTCCMP1FRAN: "Worlds – Franklin",
        FTCCMP1GOOD: "Worlds – Goodall",
        FTCCMP1JACK: "Worlds – Jackson",
        FTCCMP1LOVE: "Worlds – Lovelace",
        FTCCMP1ROSS: "Worlds – Ross",
    };

    const DEFAULTS = {
        source: "example",
        example: "FPEEUR",
        season: 2025,
        code: "",
        highlight: "",
        outline: "",
        themeColors: true,
        hlColor: "#f59e0b",
        olColor: "#ef4444",
        dim: true,
        pulse: true,
        focus: "",
        theme: "auto",
        overrides: {},
        click: "popup",
        names: "zoom",
        alliances: "",
        scroll: "modifier",
        controls: true,
        height: 600,
    };

    // Style controls -> theme tokens ("Area & field corners" sets both radii).
    const TOKENS = {
        "t-pitRadius": ["pitRadius"],
        "t-objectRadius": ["objectRadius", "fieldRadius"],
        "t-wallRadius": ["wallRadius"],
        "t-pitGap": ["pitGap"],
        "t-numberSize": ["numberSize"],
        "t-pitMix": ["pitMix"],
        "t-background": ["background"],
        "t-wall": ["wall"],
        "t-route": ["route"],
        "t-fontFamily": ["fontFamily"],
    };

    let state = { ...DEFAULTS, ...readHash() };
    state.overrides = { ...(state.overrides || {}) };
    let tab = "iframe";

    // ------------------------------------------------------------ settings <-> URL hash

    function readHash() {
        try {
            return location.hash.length > 1 ? JSON.parse(decodeURIComponent(location.hash.slice(1))) : {};
        } catch {
            return {};
        }
    }

    function writeHash() {
        let diff = {};
        for (let [k, v] of Object.entries(state)) {
            if (JSON.stringify(v) !== JSON.stringify(DEFAULTS[k])) diff[k] = v;
        }
        let hash = Object.keys(diff).length ? "#" + encodeURIComponent(JSON.stringify(diff)) : "";
        history.replaceState(null, "", location.pathname + location.search + hash);
    }

    // ------------------------------------------------------------ derived values

    const eventRef = () => (state.source == "example" ? `2025/${state.example}` : `${state.season}/${(state.code || "").trim().toUpperCase()}`);
    const hasEvent = () => state.source == "example" || !!(state.code || "").trim();
    const themeOption = () => (Object.keys(state.overrides).length ? { base: state.theme, ...state.overrides } : state.theme);
    const teams = (s) => (s || "").split(/[\s,;]+/).filter(Boolean).join(", ");

    function mapOptions() {
        return {
            theme: themeOption(),
            highlight: teams(state.highlight) || null,
            outline: teams(state.outline) || null,
            highlightColor: state.themeColors ? null : state.hlColor,
            outlineColor: state.themeColors ? null : state.olColor,
            dimOthers: state.dim,
            pulse: state.pulse,
            clickAction: state.click,
            showTeamNames: state.names == "zoom" ? "zoom" : state.names == "true",
            fieldAlliances: state.alliances || null,
            scrollZoom: state.scroll == "modifier" ? "modifier" : state.scroll == "true",
            controls: state.controls,
        };
    }

    function embedParams() {
        let p = new URLSearchParams();
        p.set("event", eventRef());
        if (state.source == "example") p.set("source", "example");
        let theme = themeOption();
        if (theme !== "auto") p.set("theme", typeof theme == "string" ? theme : JSON.stringify(theme));
        if (teams(state.highlight)) p.set("highlight", teams(state.highlight));
        if (teams(state.outline)) p.set("outline", teams(state.outline));
        if (!state.themeColors) {
            p.set("highlightColor", state.hlColor);
            p.set("outlineColor", state.olColor);
        }
        if (!state.dim) p.set("dimOthers", "0");
        if (!state.pulse) p.set("pulse", "0");
        if (!state.controls) p.set("controls", "0");
        if (state.scroll != "modifier") p.set("scrollZoom", state.scroll);
        if (state.names != "zoom") p.set("showTeamNames", state.names);
        if (state.click != "popup") p.set("clickAction", state.click);
        if (state.alliances) p.set("fieldAlliances", state.alliances);
        if ((state.focus || "").trim()) p.set("focus", state.focus.trim());
        return p;
    }

    const embedUrl = () => `${ORIGIN}/embed/pit-map?${embedParams()}`;
    const exampleJsonUrl = () => `${ORIGIN}/examples/${state.example}.json`;

    // ------------------------------------------------------------ snippets

    const escAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

    function snippet() {
        if (!hasEvent()) return "<!-- Enter an event code to get the code -->";
        if (tab == "iframe") {
            return `<iframe
    src="${escAttr(embedUrl())}"
    title="Pit map"
    style="width: 100%; height: ${state.height}px; border: 0; border-radius: 12px;"
    loading="lazy"
></iframe>`;
        }
        if (tab == "url") return embedUrl();
        if (tab == "element") {
            let attrs = [];
            if (state.source == "example") attrs.push(["src", exampleJsonUrl()]);
            else {
                attrs.push(["event", eventRef()]);
                if (SITE.apiBase) attrs.push(["api-base", SITE.apiBase]);
                else if (SITE.graphqlUrl) attrs.push(["graphql-url", SITE.graphqlUrl]);
            }
            let theme = themeOption();
            if (theme !== "auto") attrs.push(["theme", typeof theme == "string" ? theme : JSON.stringify(theme)]);
            if (teams(state.highlight)) attrs.push(["highlight", teams(state.highlight)]);
            if (teams(state.outline)) attrs.push(["outline", teams(state.outline)]);
            if (!state.themeColors) attrs.push(["highlight-color", state.hlColor], ["outline-color", state.olColor]);
            if (!state.dim) attrs.push(["dim-others", "false"]);
            if (!state.pulse) attrs.push(["pulse", "false"]);
            if (!state.controls) attrs.push(["controls", "false"]);
            if (state.scroll != "modifier") attrs.push(["scroll-zoom", state.scroll]);
            if (state.names != "zoom") attrs.push(["show-team-names", state.names]);
            if (state.click != "popup") attrs.push(["click-action", state.click]);
            let lines = attrs.map(([k, v]) => (v.includes('"') ? `    ${k}='${v.replace(/'/g, "&#39;")}'` : `    ${k}="${escAttr(v)}"`));
            lines.push(`    style="display: block; height: ${state.height}px;"`);
            let extra = [];
            if (state.alliances || (state.focus || "").trim()) {
                let opts = [];
                if (state.alliances) opts.push(`fieldAlliances: "${state.alliances}"`);
                let js = `document.querySelector("ftc-pit-map").options = { ${opts.join(", ")} };`;
                if ((state.focus || "").trim()) js += `\n    document.querySelector("ftc-pit-map").addEventListener("load", (e) => e.target.map.focusTeam("${state.focus.trim()}"));`;
                if (opts.length || (state.focus || "").trim()) extra.push(`<script>\n    ${opts.length ? js : js.split("\n").slice(1).join("\n").trim()}\n</script>`);
            }
            return [`<script src="${ORIGIN}/lib/pit-map.umd.js"></script>`, `<ftc-pit-map\n${lines.join("\n")}\n></ftc-pit-map>`, ...extra].join("\n");
        }
        // JavaScript (npm)
        let opts = mapOptions();
        let entries = Object.entries(opts).filter(([k, v]) => {
            let d = { theme: "auto", dimOthers: true, pulse: true, clickAction: "popup", showTeamNames: "zoom", scrollZoom: "modifier", controls: true };
            return v != null && v !== "" && JSON.stringify(v) !== JSON.stringify(d[k]);
        });
        let body = entries.map(([k, v]) => `    ${k}: ${JSON.stringify(v, null, 4).replace(/\n/g, "\n    ")},`).join("\n");
        let head = `// npm install ftc-embeds\nimport { PitMap${state.source == "live" ? ", configure" : ""} } from "ftc-embeds/pit-map";\n\n`;
        if (state.source == "example") {
            return `${head}const data = await fetch("${exampleJsonUrl()}").then((r) => r.json());\nconst map = new PitMap(document.getElementById("pit-map"), {\n    data,\n${body}\n});${state.focus ? `\nmap.focusTeam("${state.focus.trim()}");` : ""}`;
        }
        let api = SITE.apiBase ? `configure({ apiBase: "${SITE.apiBase}" });\n` : SITE.graphqlUrl ? `configure({ graphqlUrl: "${SITE.graphqlUrl}" });\n` : `configure({ apiBase: "…" }); // the ftc-embeds API\n`;
        return `${head}${api}const map = new PitMap(document.getElementById("pit-map"), {\n    event: "${eventRef()}",\n${body}\n});${state.focus ? `\nmap.on("load", () => map.focusTeam("${state.focus.trim()}"));` : ""}`;
    }

    const HINTS = {
        iframe: "Paste it into any site, including Wix, Google Sites and Squarespace (use their embed block).",
        element: "For sites where you can add a script tag. Listen for pitclick events if you want to react to clicks.",
        js: "For apps built with a bundler, like React, Vue or Svelte. The docs have an example per framework.",
        url: "A link to just the map, for example behind a QR code at the event.",
    };

    // ------------------------------------------------------------ preview

    const map = new PitMap($("preview"), mapOptions());
    // Right after FTCScout loaded a pit map, the browser (and CDN) may still have the event without
    // one: that reload asks for a fresh copy.
    let freshAfter = null;
    const freshFetch = (url, init) =>
        freshAfter ? fetch(`${url}${url.includes("?") ? "&" : "?"}fresh=${encodeURIComponent(freshAfter)}`, { ...init, cache: "reload" }) : fetch(url, init);
    if (LIVE_API) configure({ apiBase: SITE.apiBase || null, graphqlUrl: SITE.graphqlUrl || null, fetch: freshFetch });
    let shownEvent = null;

    function updatePreview() {
        map.update(mapOptions());
        let key = state.source + ":" + eventRef();
        if (key !== shownEvent && hasEvent()) {
            shownEvent = key;
            hideRequest();
            if (state.source == "example") map.setData(EXAMPLES[state.example] || null);
            else map.load(eventRef());
            if ((state.focus || "").trim()) setTimeout(() => map.focusTeam(state.focus.trim(), { flash: false }), 50);
        }
    }

    // ------------------------------------------------------------ pit map requests

    // An event without a pit map on FTCScout can be loaded on request: from FTC Events, or from a
    // saved copy of its pit map page. Only with the REST API (apiBase).
    const CAN_REQUEST = !!SITE.apiBase;
    let pollTimer = null;
    let hasMap = false;
    const requestUrl = (what) => `${SITE.apiBase.replace(/\/+$/, "")}/events/${state.season}/${encodeURIComponent((state.code || "").trim().toUpperCase())}/pit-map/${what}`;
    const ftcEventsUrl = () => `https://ftc-events.firstinspires.org/${state.season}/${encodeURIComponent((state.code || "").trim().toUpperCase())}/pitMap`;

    // The buttons only make sense while there is no pit map: an existing one is updated through the
    // "Reload" link, and uploads can't replace it.
    function showRequest(msg, { error = false, actions = !hasMap } = {}) {
        $("request-box").hidden = false;
        $("request-box").dataset.state = error ? "error" : "";
        $("request-msg").textContent = msg;
        $("request-actions").hidden = !actions;
        $("request-help").hidden = !actions;
        $("request-link").href = ftcEventsUrl();
    }
    function hideRequest() {
        clearTimeout(pollTimer);
        hasMap = false;
        $("request-box").hidden = true;
        $("request-refresh").hidden = true;
    }
    const when = (iso) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // Follows a request until the loader is done with it.
    function follow(r, key) {
        clearTimeout(pollTimer);
        if (key !== shownEvent) return;
        if (r.status == "pending" || r.status == "running") {
            showRequest(r.source == "upload" ? "Reading the uploaded page…" : "Loading the pit map from FTC Events…", { actions: false });
            pollTimer = setTimeout(async () => {
                try {
                    let res = await fetch(requestUrl("request"), { cache: "no-store" });
                    follow(await res.json(), key);
                } catch {
                    pollTimer = setTimeout(() => follow(r, key), 5000);
                }
            }, 2500);
        } else if (r.status == "done") {
            freshAfter = r.finishedAt;
            map.load(eventRef()).finally(() => (freshAfter = null));
        } else if (r.status == "failed") {
            showRequest(`That didn't work: ${r.error}`, { error: true });
        }
    }

    async function send(what, body) {
        let key = shownEvent;
        showRequest(what == "upload" ? "Uploading…" : "Asking FTCScout to load it…", { actions: false });
        try {
            let res = await fetch(requestUrl(what), body == null ? { method: "POST" } : { method: "POST", headers: { "Content-Type": "text/plain" }, body });
            let json = await res.json().catch(() => ({}));
            if (res.status == 202) return follow(json, key);
            if (res.status == 429 && json.fetchAllowedAt) {
                return showRequest(`It was loaded from FTC Events less than an hour ago. You can try again after ${when(json.fetchAllowedAt)}.`, { error: true });
            }
            if (res.status == 404 && !json.message) throw new Error("this server can't load pit maps yet");
            showRequest(json.message || `The server answered ${res.status}.`, { error: true });
        } catch (e) {
            showRequest(`Couldn't reach FTCScout: ${e.message}`, { error: true });
        }
    }

    map.on("load", () => {
        if (state.source != "live" || !CAN_REQUEST) return;
        hasMap = true;
        $("request-box").hidden = true;
        $("request-refresh").hidden = false;
    });
    map.on("error", async ({ error }) => {
        if (state.source != "live" || !CAN_REQUEST || !error?.notFound) return;
        let key = shownEvent;
        showRequest("FTCScout doesn't have this event's pit map yet.");
        // Pick up a request someone already made.
        try {
            let r = await (await fetch(requestUrl("request"), { cache: "no-store" })).json();
            if (r.status == "pending" || r.status == "running") follow(r, key);
            else if (r.status == "failed" && key === shownEvent) showRequest(`The last try didn't work: ${r.error}`, { error: true });
        } catch {}
    });
    $("request-fetch").onclick = () => send("request");
    $("request-refresh").onclick = () => send("request");
    $("request-file").onchange = async (e) => {
        let file = e.target.files[0];
        e.target.value = "";
        if (file) send("upload", await file.text());
    };

    // ------------------------------------------------------------ controls

    function syncControls() {
        $("src-example").setAttribute("aria-pressed", state.source == "example");
        $("src-live").setAttribute("aria-pressed", state.source == "live");
        $("src-live").disabled = !LIVE_API;
        $("example-box").hidden = state.source != "example";
        $("live-box").hidden = state.source != "live";
        $("live-hint").textContent = LIVE_API ? "Shows the event's published pit map." : "";
        $("example").value = state.example;
        $("season").value = state.season;
        $("code").value = state.code;
        $("highlight").value = state.highlight;
        $("outline").value = state.outline;
        $("theme-colors").checked = state.themeColors;
        $("dim").checked = state.dim;
        $("pulse").checked = state.pulse;
        $("focus").value = state.focus;
        $("theme").value = state.theme;
        $("click").value = state.click;
        $("names").value = state.names;
        $("alliances").value = state.alliances;
        $("scroll").value = state.scroll;
        $("controls").checked = state.controls;
        $("height").value = state.height;
        let T = map.theme;
        $("hl-color").value = state.themeColors ? toHex(T.highlight) : state.hlColor;
        $("ol-color").value = state.themeColors ? toHex(T.outline) : state.olColor;
        for (let [id, keys] of Object.entries(TOKENS)) {
            let el = $(id);
            let v = keys[0] in state.overrides ? state.overrides[keys[0]] : T[keys[0]];
            if (el.type == "color") el.value = toHex(v);
            else if (el.tagName == "SELECT") el.value = keys[0] in state.overrides ? v : "";
            else el.value = v;
        }
    }

    function toHex(c) {
        let ctx = (toHex.ctx = toHex.ctx || document.createElement("canvas").getContext("2d"));
        ctx.fillStyle = "#000";
        ctx.fillStyle = String(c);
        let v = ctx.fillStyle;
        let m = /rgba?\(([^)]+)\)/.exec(v);
        return m ? "#" + m[1].split(/[ ,]+/).slice(0, 3).map((x) => (+x).toString(16).padStart(2, "0")).join("") : v;
    }

    function render() {
        updatePreview();
        syncControls();
        $("snippet").textContent = snippet();
        $("tb-event").textContent = hasEvent() ? eventRef().replace("/", " · ") : "no event";
        $("tab-hint").textContent = HINTS[tab];
        document.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab == tab));
        writeHash();
    }

    function set(patch) {
        state = { ...state, ...patch };
        render();
    }

    for (let [code, name] of Object.entries(EXAMPLE_NAMES)) {
        if (!EXAMPLES[code]) continue;
        let o = document.createElement("option");
        o.value = code;
        o.textContent = `${name} (${code})`;
        $("example").appendChild(o);
    }

    $("src-example").onclick = () => set({ source: "example" });
    $("src-live").onclick = () => LIVE_API && set({ source: "live" });
    $("example").onchange = (e) => set({ example: e.target.value });
    $("season").onchange = (e) => set({ season: +e.target.value || DEFAULTS.season });
    $("code").onchange = (e) => set({ code: e.target.value.trim().toUpperCase() });
    $("highlight").oninput = (e) => set({ highlight: e.target.value });
    $("outline").oninput = (e) => set({ outline: e.target.value });
    $("hl-color").oninput = (e) => set({ themeColors: false, hlColor: e.target.value, olColor: $("ol-color").value });
    $("ol-color").oninput = (e) => set({ themeColors: false, olColor: e.target.value, hlColor: $("hl-color").value });
    $("theme-colors").onchange = (e) => set({ themeColors: e.target.checked });
    $("dim").onchange = (e) => set({ dim: e.target.checked });
    $("pulse").onchange = (e) => set({ pulse: e.target.checked });
    $("focus").onchange = (e) => {
        set({ focus: e.target.value.trim() });
        if (state.focus) map.focusTeam(state.focus);
    };
    $("theme").onchange = (e) => set({ theme: e.target.value });
    $("click").onchange = (e) => set({ click: e.target.value });
    $("names").onchange = (e) => set({ names: e.target.value });
    $("alliances").onchange = (e) => set({ alliances: e.target.value });
    $("scroll").onchange = (e) => set({ scroll: e.target.value });
    $("controls").onchange = (e) => set({ controls: e.target.checked });
    $("height").onchange = (e) => set({ height: Math.max(240, +e.target.value || DEFAULTS.height) });
    $("reset-style").onclick = () => set({ overrides: {} });
    for (let [id, keys] of Object.entries(TOKENS)) {
        $(id).addEventListener("input", (e) => {
            let el = e.target;
            let overrides = { ...state.overrides };
            for (let k of keys) {
                if (el.tagName == "SELECT" && !el.value) delete overrides[k];
                else overrides[k] = el.type == "range" ? +el.value : el.value;
            }
            set({ overrides });
        });
    }
    document.querySelectorAll(".tabs button").forEach((b) => (b.onclick = () => ((tab = b.dataset.tab), render())));

    async function copy(text, button) {
        let label = button.textContent;
        try {
            await navigator.clipboard.writeText(text);
            button.textContent = "Copied!";
        } catch {
            prompt("Copy this:", text);
        }
        setTimeout(() => (button.textContent = label), 1200);
    }
    $("copy").onclick = () => copy($("snippet").textContent, $("copy"));
    $("share").onclick = () => copy(location.href, $("share"));

    function download(blob, ext) {
        let a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${eventRef().replace("/", "-")}-pit-map.${ext}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    $("dl-png").onclick = async () => download(await map.toPNG(), "png");
    $("dl-svg").onclick = () => download(new Blob([map.toSVGString()], { type: "image/svg+xml" }), "svg");

    if (!LIVE_API) state.source = "example";
    if (!EXAMPLES[state.example]) state.example = DEFAULTS.example;
    render();
})();
