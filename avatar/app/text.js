// Every text of the avatar maker's page, in one place (like src/core/team-text.mjs), ready for
// translation later. Check messages are built from a check's id and params.

export const TEXT = {
    dropHint: "Drop your logo here, paste it, or choose a file",
    chooseFile: "Choose file",
    staysHere: "Your logo stays on this device.",
    reading: "Reading the image…",
    errType: "This file type can't be opened here. Export it as PNG or JPEG.",
    errLarge: "This image is too large.",
    errRead: "This file couldn't be read. Is it an image?",
    errRender: "Something went wrong drawing this variant.",
    firstFrame: "Animated image: only its first frame is used.",
    workerReady: "Analysis worker ready.",
    workerFallback: "Analysis runs on the page (this browser can't start module workers).",
    downloadOpaque: "Download PNG",
    downloadTransparent: "Download transparent PNG",
    blocked: "Can't download: fix the error above first.",
    noChecks: "No warnings.",
    opaque: "Opaque",
    transparent: "Transparent",
    loaded: (name, w, h) => `${name} · ${w} × ${h} px`,
    bytes: (n) => `${(n / 1000).toFixed(1)} kB`,
};

const SIDES = { top: ["top", "rows"], bottom: ["bottom", "rows"], left: ["left", "columns"], right: ["right", "columns"] };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** The message for a check (section 12). */
export function checkText(check) {
    let p = check.params || {};
    let out = check.output === "transparent" ? "transparent PNG" : "PNG";
    switch (check.id) {
        case "C1":
            return "Internal error: the avatar isn't 40 × 40.";
        case "C2":
            return `The ${out} is ${(p.bytes / 1000).toFixed(1)} kB; FIRST's limit is 20 kB.`;
        case "C4":
            return `${plural(p.count, "pixel is", "pixels are")} close to ${p.key === "lime" ? "lime green" : "magenta"}. Event video overlays can key them out.`;
        case "C6": {
            if (p.empty) return "The avatar is empty.";
            if (p.size < 5) return `The logo only fills ${p.longest} of the 40 pixels.`;
            let [side, unit] = SIDES[p.side];
            return `The ${side} ${p.size} ${unit} are empty.`;
        }
        case "C10":
            return "The logo file is small, so the avatar may look blurry. A larger file would help.";
        case "C11":
            return `The logo is ${p.px} px ${p.side} of centre.`;
        case "C12":
            return p.case === "kept" ? "The transparent version still has its background." : "No background colour; the opaque version uses white.";
        default:
            return check.id;
    }
}

/** The label of a check's fix button. */
export function fixText(check) {
    switch (check.fix?.action) {
        case "fewerColors":
            return "Fewer colours";
        case "shiftChroma":
            return "Shift these colours";
        case "fit":
            return "Fit";
        case "fillWidth":
            return "Fill the width, cut at the bottom";
        case "nudge":
        case "centre":
            return "Centre";
        case "removeBackground":
            return "Remove background";
        case "pickBackground":
            return "Pick a colour";
        default:
            return null;
    }
}
