/*!
 * ftc-embeds.com/avatar: make a team's 40 × 40 FIRST avatar in the browser. License: MIT
 */
// The page (sections 4 and 5): team lookup, loading a logo, the starting points from the worker,
// variants and their settings, live checks, previews and downloads. All state is one project plus
// one source image; every render is a pure function of the two (and the analysis).
import { sourceFromRGBA, newProject, validateProject, projectToFile, nextId, render, runChecks, applyFix, fitFor, analyze, candidates, suggestBackgrounds, makeZip, rasterToImage8, defaultVariant, wholeFit, textPixels, LIMITS } from "../core/avatar.mjs";
import { getTeamCard, configure } from "../../src/team-card/team-card.mjs";
import { TEXT, checkText, fixText } from "./text.js";
import { decodeFile, decodeUrl, encodeOutputs, sourceToPng, pngToRGBA, bytesToDataUrl, dataUrlToBytes, download, canCopyPng, copyPng, slug, autosave, InputError } from "./io.js";
import { showStrip, showCompare, showCurrentVs, showTeamCard, comparisonSheet } from "./preview.js";
import { initPanels, syncPanels, nudge, $ } from "./panels.js";

// Replaced by the build with "avatar-worker.js?v=<hash>"; in development the worker is next to this file.
const WORKER_URL = "__AVATAR_WORKER__";
const SITE = window.FTC_EMBEDS_SITE || {};
const SHOWN_TILES = 8;

let state = {
    source: null,
    sourcePng: null,
    analysis: null,
    project: null,
    // The first variant, made on load so there is something to show before the starting points: a
    // picked starting point replaces it as long as it hasn't been changed.
    placeholder: null,
    team: null,
    tiles: [],
    analysing: false,
    job: 0,
    showAllTiles: false,
    outs: new Map(),
    tab: "start",
    show: "opaque",
    view: "detail",
    original: false,
    cardTheme: "light",
    cardLayout: "list",
    lastWarnings: null,
    changed: false,
};

const assets = () => ({ source: state.source, analysis: state.analysis });
const current = () => state.project.variants.find((v) => v.id === state.project.selected);
const clone = (x) => JSON.parse(JSON.stringify(x));
const say = (text) => ($("announce").textContent = text);

function showError(message) {
    $("error").textContent = message || "";
}

// ------------------------------------------------------------ changes and rendering

/** Change the selected variant (edit gets a copy to mutate), then render and save. */
function change(edit) {
    let p = clone(state.project);
    let v = p.variants.find((x) => x.id === p.selected);
    edit(v);
    state.project = p;
    if (state.placeholder === v.id) state.placeholder = null;
    state.outs.delete(v.id);
    state.changed = true;
    refresh();
    scheduleSave();
}

function setProject(p) {
    state.project = p;
    state.changed = true;
    refresh();
    scheduleSave();
}

let busy = false;
let again = false;

/** Render the selected variant (and any variant without a thumbnail), then update the page. */
async function refresh() {
    if (busy) return void (again = true);
    busy = true;
    try {
        do {
            again = false;
            await new Promise(requestAnimationFrame);
            let v = current();
            let out = await renderVariant(v.id);
            showSelected(out);
        } while (again);
        for (let v of state.project.variants) if (!state.outs.has(v.id)) await renderVariant(v.id);
        showVariants();
    } finally {
        busy = false;
    }
}

async function renderVariant(id) {
    let hit = state.outs.get(id);
    if (hit) return hit;
    let out;
    try {
        let result = render(state.project, id, assets());
        let files = await encodeOutputs(result);
        let checks = runChecks(result, state.project, id, { opaque: files.opaque.length, transparent: files.transparent.length }, state.analysis);
        let urls = { opaque: URL.createObjectURL(new Blob([files.opaque], { type: "image/png" })), transparent: URL.createObjectURL(new Blob([files.transparent], { type: "image/png" })) };
        out = { result, files, checks, urls };
    } catch (err) {
        console.error(err);
        out = { error: err };
    }
    let old = state.outs.get(id);
    if (old?.urls) Object.values(old.urls).forEach((u) => setTimeout(() => URL.revokeObjectURL(u), 5000));
    state.outs.set(id, out);
    return out;
}

function showSelected(out) {
    let v = current();
    if (out.error) {
        showError(TEXT.errRender);
        let b = document.createElement("button");
        b.type = "button";
        b.className = "btn sm";
        b.textContent = TEXT.resetVariant;
        b.onclick = () => change((x) => Object.assign(x, defaultVariant(x.id, x.name, fitFor("fit", { ...x, fit: wholeFit(state.source.width, state.source.height) }, assets()) ?? x.fit)));
        $("error").append(" ", b);
        return;
    }
    showError("");
    showStrip($("strip"), out.urls);
    showChecks(out);
    syncPanels(v, { analysis: state.analysis, suggestions: suggestBackgrounds(state.analysis, out.result.info.subject40) });
    showDownloads(out);
    if (state.tab === "edit") showCanvas(out);
    if (state.tab === "compare") showComparePane(out);
    let n = out.checks.filter((c) => c.level !== "info").length;
    $("canvas").setAttribute("aria-label", TEXT.canvasLabel(v.name, n));
    writeHash();
}

// ------------------------------------------------------------ checks

function showChecks(out) {
    let list = $("checks");
    list.replaceChildren();
    let warnings = out.checks.filter((c) => c.level !== "info").map((c) => checkText(c));
    if (state.lastWarnings) {
        let added = warnings.filter((w) => !state.lastWarnings.includes(w));
        if (added.length) say(TEXT.newWarning(added[0]));
        else if (!warnings.length && state.lastWarnings.length) say(TEXT.cleared);
    }
    state.lastWarnings = warnings;
    if (!out.checks.length) {
        let li = document.createElement("li");
        li.textContent = TEXT.noChecks;
        list.append(li);
        return;
    }
    let order = { error: 0, warning: 1, info: 2 };
    for (let check of [...out.checks].sort((a, b) => order[a.level] - order[b.level])) {
        let li = document.createElement("li");
        li.className = check.level;
        let tag = document.createElement("b");
        tag.className = "tag";
        tag.textContent = `${check.level === "info" ? "ⓘ" : "⚠"} ${TEXT.levels[check.level]}`;
        let text = document.createElement("span");
        text.textContent = checkText(check);
        li.append(tag, text);
        let label = fixText(check);
        if (label && check.fix) {
            let b = document.createElement("button");
            b.type = "button";
            b.className = "btn sm";
            b.textContent = label;
            b.onclick = () => {
                if (check.fix.action === "pickBackground") {
                    $("bg-picker").closest("details").open = true;
                    return $("bg-picker").focus();
                }
                let next = applyFix(state.project, state.project.selected, check, { result: out.result, assets: assets() });
                if (next) {
                    if (state.placeholder === state.project.selected) state.placeholder = null;
                    state.outs.delete(state.project.selected);
                    setProject(next);
                }
            };
            li.append(b);
        }
        list.append(li);
    }
}

// ------------------------------------------------------------ variants (fieldset 03)

const thumbUrl = (id) => state.outs.get(id)?.urls?.opaque || "";

function showVariants() {
    let list = $("variants");
    list.replaceChildren();
    let vs = state.project.variants;
    vs.forEach((v, i) => {
        let li = document.createElement("li");
        li.setAttribute("aria-current", String(v.id === state.project.selected));
        let img = new Image(40, 40);
        img.src = thumbUrl(v.id);
        img.alt = v.name;
        img.onclick = () => select(v.id);
        let name = document.createElement("input");
        name.type = "text";
        name.value = v.name;
        name.setAttribute("aria-label", "Variant name");
        name.onfocus = () => v.id !== state.project.selected && select(v.id);
        name.onchange = () => {
            let p = clone(state.project);
            p.variants.find((x) => x.id === v.id).name = name.value.trim().slice(0, 80) || v.name;
            setProject(p);
        };
        let out = state.outs.get(v.id);
        let n = out?.checks ? out.checks.filter((c) => c.level !== "info").length : 0;
        let count = document.createElement("span");
        count.className = "count" + (n ? " warn" : "");
        count.textContent = out?.checks ? (n ? `⚠ ${n}` : "✓") : "";
        let menu = document.createElement("span");
        menu.className = "row";
        menu.style.gap = "2px";
        let button = (text, label, fn) => {
            let b = document.createElement("button");
            b.type = "button";
            b.className = "btn sm";
            b.textContent = text;
            b.title = label;
            b.setAttribute("aria-label", `${label}: ${v.name}`);
            b.onclick = fn;
            return b;
        };
        menu.append(
            button("⧉", TEXT.duplicate, () => duplicate(v.id)),
            button("✕", TEXT.delete, () => remove(v.id))
        );
        li.onkeydown = (e) => {
            if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
            e.preventDefault();
            move(v.id, e.key === "ArrowUp" ? -1 : 1);
        };
        li.append(img, name, count, menu);
        list.append(li);
        void i;
    });
}

function select(id) {
    state.project = { ...state.project, selected: id };
    state.lastWarnings = null;
    refresh();
    scheduleSave();
}

function duplicate(id) {
    let p = clone(state.project);
    if (p.variants.length >= LIMITS.variants) return;
    let src = p.variants.find((x) => x.id === id);
    let copy = { ...clone(src), id: nextId(p, "v"), name: `${src.name} (2)` };
    p.variants.splice(p.variants.indexOf(src) + 1, 0, copy);
    p.selected = copy.id;
    setProject(p);
}

function remove(id) {
    let p = clone(state.project);
    if (p.variants.length <= 1) return;
    let v = p.variants.find((x) => x.id === id);
    if (id !== state.placeholder && !confirm(TEXT.deleteConfirm(v.name))) return;
    p.variants = p.variants.filter((x) => x.id !== id);
    if (p.selected === id) p.selected = p.variants[0].id;
    state.outs.delete(id);
    if (state.placeholder === id) state.placeholder = null;
    setProject(p);
}

function move(id, by) {
    let p = clone(state.project);
    let i = p.variants.findIndex((x) => x.id === id);
    let j = i + by;
    if (j < 0 || j >= p.variants.length) return;
    [p.variants[i], p.variants[j]] = [p.variants[j], p.variants[i]];
    setProject(p);
    requestAnimationFrame(() => $("variants").children[j]?.querySelector("input")?.focus());
}

// ------------------------------------------------------------ starting points (section 11)

function imageUrl(image8) {
    let c = document.createElement("canvas");
    c.width = image8.width;
    c.height = image8.height;
    c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(image8.data), image8.width, image8.height), 0, 0);
    return c.toDataURL("image/png");
}

function showTiles() {
    let host = $("tiles");
    host.replaceChildren();
    let tiles = state.showAllTiles ? state.tiles : state.tiles.slice(0, SHOWN_TILES);
    for (let t of tiles) {
        let b = document.createElement("button");
        b.type = "button";
        b.className = "tile";
        let pair = document.createElement("span");
        pair.className = "pair";
        let o = new Image(80, 80);
        o.src = t.urls.opaque;
        o.alt = "";
        let tr = new Image(80, 80);
        tr.src = t.urls.transparent;
        tr.alt = "";
        tr.className = "checker";
        pair.append(o, tr);
        let label = document.createElement("b");
        label.textContent = TEXT.candidate(t);
        let n = t.checks.filter((c) => c.level !== "info").length;
        let count = document.createElement("span");
        count.className = n ? "warn" : "";
        count.textContent = TEXT.warnings(n);
        b.append(pair, label, count);
        b.onclick = () => adopt([t]);
        host.append(b);
    }
    if (state.analysing) {
        for (let i = tiles.length; i < Math.max(4, tiles.length + 1) && i < SHOWN_TILES; i++) {
            let s = document.createElement("div");
            s.className = "tile skeleton";
            s.setAttribute("aria-hidden", "true");
            host.append(s);
        }
    }
    $("start-status").textContent = state.analysing ? TEXT.analysing : TEXT.startReady(state.tiles.length);
    $("add-all").hidden = state.analysing || state.tiles.length < 2;
    $("show-more").hidden = state.showAllTiles || state.tiles.length <= SHOWN_TILES;
}

/** Make variants from starting points; the first one is selected and opened. */
function adopt(tiles) {
    let p = clone(state.project);
    if (state.placeholder) p.variants = p.variants.filter((v) => v.id !== state.placeholder);
    let first = null;
    for (let t of tiles) {
        if (p.variants.length >= LIMITS.variants) break;
        let v = { ...clone(t.variant), id: nextId(p, "v"), name: TEXT.candidate(t) };
        p.variants.push(v);
        first ??= v.id;
    }
    if (!p.variants.length) return;
    p.selected = first ?? p.variants[0].id;
    if (state.placeholder) state.outs.delete(state.placeholder);
    state.placeholder = null;
    setProject(validateProject(p));
    setTab("edit");
}

// ------------------------------------------------------------ the worker

let worker = null;
let workerBroken = false;

function workerUrl() {
    return WORKER_URL.startsWith("__") ? new URL("./worker.js", import.meta.url) : new URL(WORKER_URL, import.meta.url);
}

function startAnalysis() {
    let job = ++state.job;
    state.analysis = null;
    state.tiles = [];
    state.analysing = true;
    state.showAllTiles = false;
    showTiles();
    showLogoInfo();
    let team = state.team ? { number: state.team.number, name: state.team.name } : null;
    let onAnalysis = (analysis) => {
        if (job !== state.job) return;
        state.analysis = analysis;
        state.outs.clear();
        showLogoInfo();
        refresh();
    };
    let onTile = (t) => {
        if (job !== state.job) return;
        state.tiles.push({ ...t, urls: { opaque: imageUrl(t.opaque), transparent: imageUrl(t.transparent) } });
        showTiles();
    };
    let onDone = () => {
        if (job !== state.job) return;
        // Errors last; otherwise the table's order.
        let bad = (t) => t.checks.some((c) => c.level === "error");
        state.tiles.sort((a, b) => bad(a) - bad(b));
        state.analysing = false;
        showTiles();
    };
    let onMainThread = () => {
        // Without a module worker (or when it crashed): the same functions, here.
        setTimeout(() => {
            if (job !== state.job) return;
            let analysis = analyze(state.source);
            onAnalysis(analysis);
            candidates(state.source, analysis, team, (c) => onTile({ kind: c.kind, label: c.label, colorName: c.colorName, variant: c.variant, opaque: c.result.opaque, transparent: c.result.transparent, checks: c.checks }));
            onDone();
        }, 30);
    };
    if (workerBroken) return onMainThread();
    try {
        worker ??= new Worker(workerUrl(), { type: "module" });
    } catch {
        workerBroken = true;
        return onMainThread();
    }
    worker.onmessage = (e) => {
        let m = e.data;
        if (m.id !== job) return;
        if (m.type === "analysis") onAnalysis(m.analysis);
        else if (m.type === "tile") onTile(m.tile);
        else if (m.type === "done") onDone();
        else if (m.type === "error") {
            console.error(m.message);
            onMainThread();
        }
    };
    worker.onerror = (e) => {
        console.error(e.message || e);
        workerBroken = true;
        worker = null;
        onMainThread();
    };
    let rgba = new Uint8ClampedArray(state.source.rgba);
    worker.postMessage({ type: "analyze", id: job, width: state.source.width, height: state.source.height, rgba: rgba.buffer, name: state.source.name, team }, [rgba.buffer]);
}

// ------------------------------------------------------------ loading a logo (section 9.1)

function showLogoInfo() {
    if (!state.source) return;
    $("logo-info").hidden = false;
    $("logo-name").textContent = TEXT.logoName(state.source.name, state.source.width, state.source.height);
    let bg = state.analysis?.background;
    let line = $("logo-bg");
    line.replaceChildren();
    if (!bg) line.textContent = TEXT.logoBg.pending;
    else if (bg.kind === "flat") {
        let chip = document.createElement("span");
        chip.className = "bg-chip";
        chip.style.background = bg.color;
        line.append(chip, TEXT.logoBg.flat(bg.color));
    } else line.textContent = TEXT.logoBg[bg.kind];
}

/** Use a decoded image ({ width, height, rgba, name, note }) as the source. */
function useImage(img) {
    let source = sourceFromRGBA(img.width, img.height, img.rgba, img.name);
    let replacing = state.project && !state.placeholder;
    if (replacing) {
        let ops = state.project.variants.reduce((n, v) => n + v.maskOps.length + v.paintOps.length, 0);
        if (ops && !confirm(TEXT.replaceConfirm(ops))) return;
    }
    state.source = source;
    state.sourcePng = sourceToPng(source);
    state.outs.clear();
    state.lastWarnings = null;
    if (replacing) {
        // Keep the variants and their settings; drawn edits belong to the old logo, and the fit is redone.
        let p = clone(state.project);
        p.source = { name: img.name, width: img.width, height: img.height, kind: source.kind };
        for (let v of p.variants) {
            v.maskOps = [];
            v.paintOps = [];
            v.pieces = [];
            v.fit = fitFor("fit", { ...v, fit: wholeFit(img.width, img.height, source.kind) }, { source, analysis: null }) ?? v.fit;
        }
        state.project = validateProject(p);
    } else {
        let p = newProject({ name: img.name, width: img.width, height: img.height }, state.team ? { number: state.team.number, name: state.team.name } : null);
        let v = p.variants[0];
        v.fit = fitFor("fit", v, { source, analysis: null }) ?? v.fit;
        state.project = p;
        state.placeholder = v.id;
    }
    $("logo-note").textContent = img.note || "";
    $("empty").hidden = true;
    $("workspace").hidden = false;
    for (let id of ["fs-variants", "fs-settings", "fs-download"]) $(id).hidden = false;
    setTab("start");
    startAnalysis();
    refresh();
    scheduleSave();
}

async function loadFile(file) {
    showError("");
    if (/\.json$/i.test(file.name) || file.type === "application/json") return loadProjectFile(file);
    $("logo-note").textContent = TEXT.reading;
    try {
        useImage(await decodeFile(file));
    } catch (err) {
        console.error(err);
        $("logo-note").textContent = "";
        showError(err instanceof InputError ? err.message : TEXT.errRead);
    }
}

async function loadUrl(url) {
    showError("");
    $("logo-note").textContent = TEXT.reading;
    try {
        useImage(await decodeUrl(url));
    } catch (err) {
        $("logo-note").textContent = "";
        showError(err instanceof InputError ? err.message : TEXT.errUrl);
    }
}

// ------------------------------------------------------------ projects and autosave (section 7.5)

async function loadProjectFile(file) {
    try {
        let p = validateProject(JSON.parse(await file.text()));
        if (!p.assets) throw new Error("it has no logo in it");
        if (state.changed && !confirm(TEXT.loadProjectConfirm)) return;
        let img = await pngToRGBA(dataUrlToBytes(p.assets.source));
        delete p.assets;
        restore(p, img);
    } catch (err) {
        showError(TEXT.errProject(err.message));
    }
}

function restore(project, img) {
    state.source = sourceFromRGBA(img.width, img.height, img.rgba, project.source.name);
    state.sourcePng = sourceToPng(state.source);
    state.project = project;
    state.placeholder = null;
    state.outs.clear();
    state.lastWarnings = null;
    if (project.team) lookupTeam(project.team.number, { keepProject: true });
    $("empty").hidden = true;
    $("workspace").hidden = false;
    for (let id of ["fs-variants", "fs-settings", "fs-download"]) $(id).hidden = false;
    setTab("edit");
    startAnalysis();
    refresh();
}

let saveTimer = null;
function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 1000);
}

async function saveNow() {
    if (!state.project || !state.source) return;
    let png = await state.sourcePng;
    await autosave.save({ savedAt: Date.now(), project: state.project, source: new Blob([png], { type: "image/png" }) });
}

async function offerRestore() {
    if (!(await autosave.available())) {
        $("logo-note").textContent = TEXT.autosaveOff;
        return;
    }
    let draft = await autosave.load();
    if (!draft || state.project) return;
    let project;
    try {
        project = validateProject(draft.project);
    } catch {
        return autosave.clear();
    }
    let when = new Date(draft.savedAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    $("restore-text").textContent = TEXT.restore(project.team?.name || project.source.name, project.variants.length, when);
    $("restore").hidden = false;
    $("restore-yes").onclick = async () => {
        $("restore").hidden = true;
        let img = await pngToRGBA(new Uint8Array(await draft.source.arrayBuffer()));
        restore(project, img);
    };
    $("restore-no").onclick = () => {
        $("restore").hidden = true;
        autosave.clear();
    };
}

// ------------------------------------------------------------ team (fieldset 01)

const avatarUrl = (a) => (!a ? null : /^(https?:|data:)/.test(a) ? a : `data:image/png;base64,${a}`);

async function imageDataOf(url) {
    let blob = await (await fetch(url)).blob();
    let bmp = await createImageBitmap(blob, { premultiplyAlpha: "none" });
    let c = document.createElement("canvas");
    c.width = bmp.width;
    c.height = bmp.height;
    let ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0);
    return { width: c.width, height: c.height, data: ctx.getImageData(0, 0, c.width, c.height).data, blob };
}

let teamTimer = null;
let teamAsk = 0;

async function lookupTeam(number, { keepProject = false } = {}) {
    let ask = ++teamAsk;
    let status = $("team-status");
    $("team-current").hidden = true;
    if (!number) {
        status.textContent = "";
        state.team = null;
        if (!keepProject && state.project) setProject({ ...state.project, team: null });
        return;
    }
    status.textContent = TEXT.teamLoading;
    try {
        let card = await getTeamCard(number);
        if (ask !== teamAsk) return;
        let avatar = avatarUrl(card.avatar);
        state.team = { number: card.number, name: card.name, avatar, card, image: null };
        status.textContent = avatar ? TEXT.teamFound(card.name) : TEXT.teamNoAvatar(card.name);
        if (avatar) {
            $("team-avatar").src = avatar;
            $("team-avatar").alt = `Current FIRST avatar of ${card.name}`;
            $("team-current").hidden = false;
            imageDataOf(avatar).then((img) => ask === teamAsk && (state.team.image = img), () => {});
        }
        if (state.project && (!keepProject || !state.project.team)) setProject({ ...state.project, team: { number: card.number, name: card.name } });
        else if (state.project) refresh();
    } catch (err) {
        if (ask !== teamAsk) return;
        state.team = null;
        status.textContent = err?.notFound ? TEXT.teamNotFound(number) : TEXT.teamError;
    }
    writeHash();
}

// ------------------------------------------------------------ tabs, editor view, compare

function setTab(tab) {
    state.tab = tab;
    for (let b of document.querySelectorAll("[data-tab]")) b.setAttribute("aria-selected", String(b.dataset.tab === tab));
    $("pane-start").hidden = tab !== "start";
    $("pane-edit").hidden = tab !== "edit";
    $("pane-compare").hidden = tab !== "compare";
    let out = state.project && state.outs.get(state.project.selected);
    if (out?.result) {
        if (tab === "edit") showCanvas(out);
        if (tab === "compare") showComparePane(out);
    }
}

let originalCache = null;

function showCanvas(out) {
    let canvas = $("canvas");
    let ctx = canvas.getContext("2d");
    for (let b of $("show").querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.show === state.show));
    for (let b of $("view").querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.view === state.view));
    $("canvas-wrap").classList.toggle("checker", state.show === "transparent");
    ctx.clearRect(0, 0, 320, 320);
    if (state.original) {
        // The logo through the same fit, without cut-out, adjustments, text or pixel edits.
        let v = current();
        let key = JSON.stringify(v.fit) + state.source.name;
        if (originalCache?.key !== key) {
            let bare = { ...clone(v), id: "v1", cutout: { ...v.cutout, mode: "off" }, adjust: { brightness: 0, contrast: 0, saturation: 0, thicken: 0, colors: 0 }, texts: [], pixels: { opaque: [], transparent: [] }, frame: { ...v.frame, kind: "square", ring: null }, background: null, transparent: "cutout", border: { width: 0, color: null } };
            let r = render({ ...state.project, selected: "v1", variants: [bare] }, "v1", assets());
            originalCache = { key, image: rasterToImage8(r.work.transparent) };
        }
        $("canvas-wrap").classList.add("checker");
        ctx.putImageData(new ImageData(new Uint8ClampedArray(originalCache.image.data), 320, 320), 0, 0);
        return;
    }
    if (state.view === "detail") {
        let img = rasterToImage8(out.result.work[state.show]);
        ctx.putImageData(new ImageData(img.data, 320, 320), 0, 0);
        // Pixel text is drawn on the 40 × 40 result, so here it shows as its 8 × 8 blocks.
        for (let t of current().texts) {
            for (let [x, y, rgb] of textPixels(t, 40)) {
                ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
                ctx.fillRect(x * 8, y * 8, 8, 8);
            }
        }
    } else {
        // The 40 × 40 result as 8 × 8 blocks, with a faint grid between output pixels.
        let img = out.result[state.show];
        for (let y = 0; y < 40; y++) {
            for (let x = 0; x < 40; x++) {
                let i = (y * 40 + x) * 4;
                ctx.fillStyle = `rgba(${img.data[i]},${img.data[i + 1]},${img.data[i + 2]},${img.data[i + 3] / 255})`;
                ctx.fillRect(x * 8, y * 8, 8, 8);
            }
        }
        ctx.fillStyle = "rgba(128,128,128,0.2)";
        for (let k = 1; k < 40; k++) {
            ctx.fillRect(k * 8, 0, 1, 320);
            ctx.fillRect(0, k * 8, 320, 1);
        }
    }
}

function showComparePane(out) {
    showCompare($("compare-grid"), $("zooms"), out.urls, { opaque: out.result.opaque, transparent: out.result.transparent });
    let team = state.team;
    $("current-vs").hidden = !team?.avatar;
    if (team?.avatar) showCurrentVs($("current-grid"), team.avatar, team.image, out.urls, { opaque: out.result.opaque });
    for (let b of $("card-theme").querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.cardTheme === state.cardTheme));
    for (let b of $("card-layout").querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.cardLayout === state.cardLayout));
    showTeamCard($("card-host"), team, bytesToDataUrl(out.files.opaque), state.cardTheme, state.cardLayout);
}

// ------------------------------------------------------------ downloads (section 13.5)

/** File names: ‹number›-‹slug› with a team, otherwise plain avatar-40.png. */
function names() {
    let t = state.project.team ?? (state.team ? { number: state.team.number, name: state.team.name } : null);
    let base = t ? `${t.number}-${slug(t.name) || "team"}` : null;
    let pre = base ? `${base}-` : "";
    return {
        base: base ?? "avatar",
        png: `${pre}avatar-40.png`,
        transparent: `${pre}avatar-40-transparent.png`,
        sheet: `${pre}options-comparison.png`,
        current: `${pre}current-first-avatar.png`,
        project: `${base ?? "avatar"}.avatar-project.json`,
        zip: base ? `${base}-avatar.zip` : "avatar.zip",
        variant: (v, transparent) => `${pre}${slug(v.name) || v.id}-avatar-40${transparent ? "-transparent" : ""}.png`,
    };
}

const blocks = (out, kind) => out.checks.some((c) => c.level === "error" && (c.output === kind || c.output == null));

function showDownloads(out) {
    $("dl-png").disabled = blocks(out, "opaque");
    $("dl-transparent").disabled = blocks(out, "transparent");
    $("copy-png").disabled = blocks(out, "opaque");
    $("dl-blocked").textContent = blocks(out, "opaque") || blocks(out, "transparent") ? TEXT.blocked : "";
}

async function allOuts() {
    for (let v of state.project.variants) await renderVariant(v.id);
    return state.project.variants.map((v) => ({ v, out: state.outs.get(v.id) })).filter((x) => x.out?.result);
}

function sourceCanvas() {
    let c = document.createElement("canvas");
    c.width = state.source.width;
    c.height = state.source.height;
    c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(state.source.rgba), c.width, c.height), 0, 0);
    return c;
}

async function sheetBlob() {
    let team = state.project.team;
    let rows = (await allOuts()).map(({ v, out }) => ({ name: v.name, opaque: out.result.opaque, transparent: out.result.transparent }));
    return comparisonSheet({
        title: TEXT.sheetTitle(team ? `${team.name} (${team.number})` : TEXT.yourTeam),
        sourceCanvas: sourceCanvas(),
        current: state.team?.image ?? null,
        rows,
    });
}

function readme() {
    let lines = [TEXT.readmeTitle, "", ...TEXT.uploadSteps.map((s, i) => `${i + 1}. ${s}`), "", `${TEXT.firstPost}: https://community.firstinspires.org/team-avatars`, "", "Made with https://ftc-embeds.com/avatar"];
    return new TextEncoder().encode(lines.join("\n") + "\n");
}

async function projectBytes() {
    let png = await state.sourcePng;
    return new TextEncoder().encode(projectToFile(state.project, bytesToDataUrl(png)));
}

async function zipAll() {
    let n = names();
    let date = new Date();
    let files = [];
    let sel = state.outs.get(state.project.selected);
    if (sel?.files) files.push({ name: n.png, data: sel.files.opaque, date }, { name: n.transparent, data: sel.files.transparent, date });
    for (let { v, out } of await allOuts()) {
        if (blocks(out, "opaque") || blocks(out, "transparent")) continue;
        files.push({ name: n.variant(v, false), data: out.files.opaque, date }, { name: n.variant(v, true), data: out.files.transparent, date });
    }
    files.push({ name: n.sheet, data: new Uint8Array(await (await sheetBlob()).arrayBuffer()), date });
    if (state.team?.image?.blob) files.push({ name: n.current, data: new Uint8Array(await state.team.image.blob.arrayBuffer()), date });
    files.push({ name: n.project, data: await projectBytes(), date }, { name: "README.txt", data: readme(), date });
    return makeZip(files);
}

// ------------------------------------------------------------ URL fragment

function readHash() {
    try {
        return JSON.parse(decodeURIComponent(location.hash.slice(1)) || "{}");
    } catch {
        return {};
    }
}

function writeHash() {
    let h = {};
    let team = state.team?.number ?? state.project?.team?.number;
    if (team) h.team = team;
    if (state.project && state.project.variants.length > 1) h.variant = current()?.name;
    let next = Object.keys(h).length ? "#" + encodeURIComponent(JSON.stringify(h)) : "";
    if (next !== location.hash) history.replaceState(null, "", location.pathname + location.search + next);
}

// ------------------------------------------------------------ wiring

function wire() {
    for (let e of document.querySelectorAll("[data-t]")) {
        let text = TEXT[e.dataset.t];
        if (typeof text === "string") e.textContent = text;
    }
    let label = (id, text) => ($(id).textContent = text);
    label("edit-current", TEXT.editCurrent);
    label("restore-yes", TEXT.restoreYes);
    label("restore-no", TEXT.restoreNo);
    label("tab-start", TEXT.tabStart);
    label("tab-edit", TEXT.tabEdit);
    label("tab-compare", TEXT.tabCompare);
    label("add-all", TEXT.addAll);
    label("show-more", TEXT.showMore);
    label("compare-original", TEXT.compareOriginal);
    label("edit-note", TEXT.editNote);
    label("dl-png", TEXT.downloadOpaque);
    label("dl-transparent", TEXT.downloadTransparent);
    label("copy-png", TEXT.copyPng);
    label("dl-sheet", TEXT.downloadSheet);
    label("dl-zip", TEXT.downloadZip);
    label("save-project", TEXT.saveProject);
    label("content-note", TEXT.contentNote);
    $("show").querySelector('[data-show="opaque"]').textContent = TEXT.showOpaque;
    $("show").querySelector('[data-show="transparent"]').textContent = TEXT.showTransparent;
    $("view").querySelector('[data-view="detail"]').textContent = TEXT.viewDetail;
    $("view").querySelector('[data-view="pixels"]').textContent = TEXT.viewPixels;
    $("card-theme").querySelector('[data-card-theme="light"]').textContent = TEXT.cardLight;
    $("card-theme").querySelector('[data-card-theme="dark"]').textContent = TEXT.cardDark;
    $("card-layout").querySelector('[data-card-layout="list"]').textContent = TEXT.cardList;
    $("card-layout").querySelector('[data-card-layout="compact"]').textContent = TEXT.cardCompact;
    $("upload-steps").replaceChildren(
        ...TEXT.uploadSteps.slice(0, 5).map((s) => {
            let li = document.createElement("li");
            li.textContent = s;
            return li;
        })
    );
    let post = document.createElement("a");
    post.href = "https://community.firstinspires.org/team-avatars";
    post.target = "_blank";
    post.rel = "noopener";
    post.textContent = TEXT.firstPost;
    $("content-note").append(" ", post);
    $("copy-png").hidden = !canCopyPng();

    // Logo: file pickers, the link field, drop anywhere, paste anywhere.
    for (let id of ["file", "file-2"]) $(id).onchange = (e) => e.target.files[0] && loadFile(e.target.files[0]).finally(() => (e.target.value = ""));
    $("logo-url-go").onclick = () => $("logo-url").value.trim() && loadUrl($("logo-url").value.trim());
    $("logo-url").onkeydown = (e) => e.key === "Enter" && (e.preventDefault(), $("logo-url-go").click());
    $("example").onclick = async (e) => {
        e.preventDefault();
        let blob = await (await fetch("examples/avatar-example.svg")).blob();
        loadFile(new File([blob], "avatar-example.svg", { type: "image/svg+xml" }));
    };
    let zones = [$("empty"), $("logo-drop")];
    document.addEventListener("dragover", (e) => {
        e.preventDefault();
        zones.forEach((z) => z.classList.add("over"));
    });
    document.addEventListener("dragleave", (e) => !e.relatedTarget && zones.forEach((z) => z.classList.remove("over")));
    document.addEventListener("drop", (e) => {
        e.preventDefault();
        zones.forEach((z) => z.classList.remove("over"));
        let file = [...(e.dataTransfer?.files || [])][0];
        if (file) loadFile(file);
    });
    document.addEventListener("paste", (e) => {
        if (e.target.matches?.("input, textarea")) return;
        let file = [...(e.clipboardData?.files || [])][0];
        if (file) return loadFile(file);
        let text = e.clipboardData?.getData("text")?.trim();
        if (text && /^https?:\/\/\S+$/.test(text)) loadUrl(text);
    });

    // Team.
    $("team").oninput = (e) => {
        clearTimeout(teamTimer);
        let n = parseInt(e.target.value.replace(/\D/g, ""), 10) || null;
        teamTimer = setTimeout(() => lookupTeam(n), 400);
    };
    $("edit-current").onclick = async () => {
        if (!state.team?.avatar) return;
        let blob = await (await fetch(state.team.avatar)).blob();
        loadFile(new File([blob], `${state.team.number}-current-avatar.png`, { type: "image/png" }));
    };

    // Tabs, starting points, editor view.
    for (let b of document.querySelectorAll("[data-tab]")) b.onclick = () => setTab(b.dataset.tab);
    $("add-all").onclick = () => adopt(state.showAllTiles ? state.tiles : state.tiles.slice(0, SHOWN_TILES));
    $("show-more").onclick = () => {
        state.showAllTiles = true;
        showTiles();
    };
    let redrawCanvas = () => {
        let out = state.outs.get(state.project.selected);
        if (out?.result) showCanvas(out);
    };
    for (let b of $("show").querySelectorAll("button")) b.onclick = () => ((state.show = b.dataset.show), redrawCanvas());
    for (let b of $("view").querySelectorAll("button")) b.onclick = () => ((state.view = b.dataset.view), redrawCanvas());
    let hold = (on) => () => ((state.original = on), redrawCanvas());
    $("compare-original").onpointerdown = hold(true);
    $("compare-original").onpointerup = hold(false);
    $("compare-original").onpointerleave = hold(false);
    document.addEventListener("keydown", (e) => {
        if (e.target.matches?.("input, textarea, select")) return;
        if (e.key === "\\" && !e.repeat && state.project) hold(true)();
        if ((e.key === "h" || e.key === "H") && state.project) {
            state.show = state.show === "opaque" ? "transparent" : "opaque";
            redrawCanvas();
        }
    });
    document.addEventListener("keyup", (e) => e.key === "\\" && state.project && hold(false)());
    $("canvas").onkeydown = (e) => {
        let d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
        if (!d) return;
        e.preventDefault();
        nudge(d[0], d[1], e.shiftKey);
    };
    for (let b of $("card-theme").querySelectorAll("button")) b.onclick = () => ((state.cardTheme = b.dataset.cardTheme), setTab("compare"));
    for (let b of $("card-layout").querySelectorAll("button")) b.onclick = () => ((state.cardLayout = b.dataset.cardLayout), setTab("compare"));

    // Downloads.
    let sel = () => state.outs.get(state.project.selected);
    $("dl-png").onclick = () => sel()?.files && download(sel().files.opaque, names().png, "image/png");
    $("dl-transparent").onclick = () => sel()?.files && download(sel().files.transparent, names().transparent, "image/png");
    $("copy-png").onclick = async () => {
        try {
            await copyPng(sel().files.opaque);
            say(TEXT.copied);
        } catch (err) {
            console.error(err);
        }
    };
    $("dl-sheet").onclick = async () => download(await sheetBlob(), names().sheet);
    $("dl-zip").onclick = async () => download(await zipAll(), names().zip, "application/zip");
    $("save-project").onclick = async () => download(await projectBytes(), names().project, "application/json");

    // Save when the page is left.
    document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && saveNow());

    initPanels({ variant: current, assets, change, suggestions: () => [] });
}

// ------------------------------------------------------------ start

if (SITE.apiBase || SITE.graphqlUrl) configure({ apiBase: SITE.apiBase || null, graphqlUrl: SITE.graphqlUrl || null });
wire();
let hash = readHash();
if (Number.isInteger(hash.team) && hash.team > 0) {
    $("team").value = String(hash.team);
    lookupTeam(hash.team);
}
offerRestore();
