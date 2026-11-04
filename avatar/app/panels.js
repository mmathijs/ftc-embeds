// The variant settings in the left column (section 5, fieldset 05): fit, background, frame,
// cut-out, adjustments, border and resampling. Controls read the selected variant in syncPanels()
// and write through api.change(edit), which renders and saves.

import { fitFor, zoomFit, orientFit } from "../core/avatar.mjs";
import { TEXT } from "./text.js";

export const $ = (id) => document.getElementById(id);
const CRISP = [0, 4, 6, 8, 10, 12, 14, 16, 24, 32];

let api = null;

const pressed = (group, attr, value) => {
    for (let b of $(group).querySelectorAll(`[data-${attr}]`)) b.setAttribute("aria-pressed", String(b.dataset[attr.replace(/-(\w)/g, (_, c) => c.toUpperCase())] === String(value)));
};

// The "Fit" scale of the current variant, the reference for the zoom slider (10% to 800%, log scale).
function fitScale(v) {
    return fitFor("fit", v, api.assets())?.scale ?? v.fit.scale;
}

/** Wire the controls once. api: { variant(), assets(), change(edit), suggestions() }. */
export function initPanels(handlers) {
    api = handlers;
    let set = (edit) => api.change(edit);
    $("adj-colors").replaceChildren(...CRISP.map((n) => new Option(n ? TEXT.crispN(n) : TEXT.crispOff, String(n))));

    // Fit
    for (let b of $("fit-modes").querySelectorAll("[data-fit]")) {
        b.onclick = () => {
            let v = api.variant();
            let fit = fitFor(b.dataset.fit, v, api.assets());
            $("fit-hint").textContent = fit ? "" : TEXT.nothingToCut;
            if (fit) set((x) => (x.fit = fit));
        };
    }
    $("zoom").oninput = (e) => {
        let v = api.variant();
        let scale = fitScale(v) * Math.pow(10, +e.target.value);
        set((x) => (x.fit = zoomFit(v, api.assets(), scale)));
    };
    for (let b of document.querySelectorAll("[data-nudge]")) {
        b.onclick = (e) => {
            let [dx, dy] = b.dataset.nudge.split(",").map(Number);
            nudge(dx, dy, e.shiftKey);
        };
    }
    let turn = (rotate, flip) => {
        let v = api.variant();
        set((x) => (x.fit = orientFit(v, api.assets(), rotate, flip)));
    };
    $("rotate-left").onclick = () => turn((api.variant().fit.rotate + 270) % 360, api.variant().fit.flip);
    $("rotate-right").onclick = () => turn((api.variant().fit.rotate + 90) % 360, api.variant().fit.flip);
    $("flip").onclick = () => turn(api.variant().fit.rotate, !api.variant().fit.flip);

    // Background
    $("bg-picker").oninput = (e) => set((x) => (x.background = e.target.value));
    $("bg-hex").onchange = (e) => {
        let v = e.target.value.trim().toLowerCase();
        if (/^#?[0-9a-f]{6}$/.test(v)) set((x) => (x.background = v.startsWith("#") ? v : "#" + v));
        else e.target.value = api.variant().background ?? "";
    };
    $("bg-none").onclick = () => set((x) => (x.background = null));

    // Frame
    for (let b of $("frame-kinds").querySelectorAll("[data-frame]")) b.onclick = () => set((x) => (x.frame.kind = b.dataset.frame));
    $("frame-radius").oninput = (e) => set((x) => (x.frame.radius = +e.target.value));
    $("ring-on").onchange = (e) => set((x) => (x.frame.ring = e.target.checked ? { width: +$("ring-width").value || 1.1, color: $("ring-color").value } : null));
    $("ring-color").oninput = (e) => set((x) => (x.frame.ring = { width: x.frame.ring?.width ?? 1.1, color: e.target.value }));
    $("ring-width").oninput = (e) => set((x) => (x.frame.ring = { width: +e.target.value, color: x.frame.ring?.color ?? $("ring-color").value }));
    $("outside-on").onchange = (e) => set((x) => (x.frame.outside = e.target.checked ? $("outside-color").value : null));
    $("outside-color").oninput = (e) => set((x) => (x.frame.outside = e.target.value));
    $("break-out").onchange = (e) => set((x) => (x.frame.breakOut = e.target.checked));

    // Cut-out
    for (let b of $("cut-modes").querySelectorAll("[data-cut]")) b.onclick = () => set((x) => (x.cutout.mode = b.dataset.cut));
    $("cut-tol").oninput = (e) => set((x) => (x.cutout.tolerance = +e.target.value));
    $("cut-soft").oninput = (e) => set((x) => (x.cutout.softness = +e.target.value));
    $("cut-main").onchange = (e) => set((x) => (x.cutout.mainPart = e.target.checked));

    // Adjust
    for (let k of ["brightness", "contrast", "saturation", "thicken"]) $(`adj-${k}`).oninput = (e) => set((x) => (x.adjust[k] = +e.target.value));
    $("adj-colors").onchange = (e) => set((x) => (x.adjust.colors = +e.target.value));

    // Border
    $("border-w").oninput = (e) => set((x) => (x.border.width = +e.target.value));
    $("border-same").onchange = (e) => set((x) => (x.border.color = e.target.checked ? null : $("border-color").value));
    $("border-color").oninput = (e) => set((x) => (x.border.color = e.target.value));

    // Resampling
    for (let b of $("resample").querySelectorAll("[data-resample]")) b.onclick = () => set((x) => (x.resample = b.dataset.resample));
}

/** Move the logo by ⅛ px (1 px with Shift); also for the arrow keys on the canvas. */
export function nudge(dx, dy, big = false) {
    let step = big ? 1 : 1 / 8;
    api.change((x) => {
        x.fit.x += dx * step;
        x.fit.y += dy * step;
    });
}

const out = (id, text) => ($(id).textContent = text);
const setIfIdle = (id, value) => {
    let e = $(id);
    if (document.activeElement !== e) e.value = value;
};

/** Show the selected variant's settings. ctx: { analysis, suggestions }. */
export function syncPanels(v, ctx) {
    // Fit
    let zoom = Math.log10(v.fit.scale / fitScale(v));
    setIfIdle("zoom", Number.isFinite(zoom) ? zoom : 0);
    out("zoom-out", `${Math.round(Math.pow(10, +$("zoom").value) * 100)}%`);

    // Background: the suggested swatches with their contrast labels, then the custom colour.
    $("swatches").replaceChildren(
        ...ctx.suggestions.map((s) => {
            let b = document.createElement("button");
            b.type = "button";
            b.className = "swatch";
            b.setAttribute("aria-pressed", String(v.background === s.color));
            b.title = `${s.name} ${s.color}`;
            let chip = document.createElement("i");
            chip.style.background = s.color;
            b.append(chip, s.label);
            b.onclick = () => api.change((x) => (x.background = s.color));
            return b;
        })
    );
    setIfIdle("bg-picker", v.background ?? "#ffffff");
    setIfIdle("bg-hex", v.background ?? "");
    $("bg-none").setAttribute("aria-pressed", String(v.background == null));

    // Frame
    pressed("frame-kinds", "frame", v.frame.kind);
    $("radius-row").hidden = v.frame.kind !== "rounded";
    setIfIdle("frame-radius", v.frame.radius);
    out("radius-out", `${v.frame.radius} px`);
    $("ring-on").checked = !!v.frame.ring;
    setIfIdle("ring-color", v.frame.ring?.color ?? "#000000");
    setIfIdle("ring-width", v.frame.ring?.width ?? 1.1);
    out("ring-width-out", `${(+$("ring-width").value).toFixed(1)} px`);
    $("outside-on").checked = v.frame.outside != null;
    setIfIdle("outside-color", v.frame.outside ?? "#000000");
    $("break-out").checked = v.frame.breakOut;

    // Cut-out: what it can do depends on the analysis.
    pressed("cut-modes", "cut", v.cutout.mode);
    let bg = ctx.analysis?.background.kind;
    $("cut-hint").textContent = !ctx.analysis ? TEXT.cutNeedsAnalysis : bg === "none" && v.cutout.color === "auto" ? TEXT.cutNoBackground : bg === "transparent" ? TEXT.cutTransparent : "";
    setIfIdle("cut-tol", v.cutout.tolerance);
    out("cut-tol-out", v.cutout.tolerance.toFixed(3));
    setIfIdle("cut-soft", v.cutout.softness);
    out("cut-soft-out", `${v.cutout.softness} px`);
    $("cut-main").checked = v.cutout.mainPart;

    // Adjust
    for (let k of ["brightness", "contrast", "saturation"]) {
        setIfIdle(`adj-${k}`, v.adjust[k]);
        out(`adj-${k}-out`, String(v.adjust[k]));
    }
    setIfIdle("adj-thicken", v.adjust.thicken);
    out("adj-thicken-out", `${v.adjust.thicken} px`);
    $("adj-colors").value = String(CRISP.includes(v.adjust.colors) ? v.adjust.colors : 0);

    // Border
    setIfIdle("border-w", v.border.width);
    out("border-w-out", `${v.border.width.toFixed(1)} px`);
    $("border-same").checked = v.border.color == null;
    setIfIdle("border-color", v.border.color ?? v.background ?? "#000000");

    pressed("resample", "resample", v.resample);
}
