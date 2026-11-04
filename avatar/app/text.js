// Every text of the avatar maker's page, in one place (like src/core/team-text.mjs), ready for
// translation later. Elements with data-t="key" get TEXT[key]; check messages are built from a
// check's id and params.

export const TEXT = {
    legendTeam: "Team",
    teamLabel: "Team number (optional)",
    teamLoading: "Looking up the team…",
    teamFound: (name) => name,
    teamNoAvatar: (name) => `${name}. No FIRST avatar yet.`,
    teamNotFound: (n) => `No team ${n}.`,
    teamError: "Couldn't reach FTCScout. You can still make an avatar.",
    editCurrent: "Edit this avatar",
    legendLogo: "Logo",
    dropShort: "Drop a logo here, or paste it anywhere.",
    chooseFile: "Choose file",
    load: "Load",
    staysHere: "Your logo stays on this device.",
    logoName: (name, w, h) => `${name} · ${w} × ${h} px`,
    logoBg: { flat: (hex) => `Background: ${hex}`, transparent: "Background: none (already transparent)", none: "Background: not one colour (a photo or busy edge)", pending: "Finding the background…" },
    replaceConfirm: (n) => `Replace the logo? Your variants and their settings stay; ${n} drawn edits are lost.`,
    legendVariants: "Variants",
    variantsHint: "Each variant is one option for the avatar. Pick a starting point to add one.",
    duplicate: "Duplicate",
    delete: "Delete",
    deleteConfirm: (name) => `Delete “${name}”?`,
    moveUp: "Move up",
    moveDown: "Move down",
    legendSettings: "Variant settings",
    groupFit: "Fit",
    fitFit: "Fit",
    fitFill: "Fill width",
    fitCut: "Cut at bottom",
    fitCentre: "Centre",
    nothingToCut: "Nothing to cut: zoom in first.",
    zoom: "Zoom",
    nudgeHint: "Arrows move it by ⅛ px; with Shift by 1 px.",
    rotateLeft: "Rotate ⟲",
    rotateRight: "Rotate ⟳",
    flip: "Flip",
    groupBackground: "Background",
    none: "None",
    groupFrame: "Frame",
    square: "Square",
    rounded: "Rounded",
    circle: "Circle",
    radius: "Corner radius",
    ring: "Ring",
    ringWidth: "Ring width",
    outside: "Colour outside the frame",
    breakOut: "Let parts break out of the frame",
    groupCutout: "Cut-out",
    off: "Off",
    cutEdge: "Edge",
    cutAll: "All",
    cutNeedsAnalysis: "Finding the background first…",
    cutNoBackground: "This logo's background isn't one colour, so there's nothing to cut out automatically.",
    cutTransparent: "The logo is already transparent: the cut-out only removes loose parts (with “main part only”).",
    tolerance: "Tolerance",
    softness: "Edge softness",
    mainPart: "Main part only",
    groupAdjust: "Adjust",
    brightness: "Brightness",
    contrast: "Contrast",
    saturation: "Saturation",
    thicken: "Thicken dark lines",
    crisp: "Crisp colours",
    crispOff: "Off",
    crispN: (n) => `${n} colours`,
    groupBorder: "Border (transparent version)",
    borderWidth: "Width",
    borderSame: "Same colour as the background",
    groupResample: "Resampling",
    sharp: "Sharp",
    soft: "Soft",
    legendDownload: "Download",
    downloadOpaque: "Download PNG",
    downloadTransparent: "Download transparent PNG",
    copyPng: "Copy PNG",
    copied: "Copied",
    downloadSheet: "Download comparison sheet",
    downloadZip: "Download everything (zip)",
    saveProject: "Save project",
    blocked: "Fix the errors in the checks first.",
    contentNote: "Only use artwork your team owns. FIRST doesn't accept TV or movie characters, or company or sports-team logos.",
    uploadSteps: [
        "Lead Mentor 1 or 2 logs in at ftc-scoring.firstinspires.org with their FIRST account.",
        "Choose Team Avatar on the left, then Upload New Avatar.",
        "Pick the PNG (opaque or transparent), check the preview on the scoring backgrounds, add notes for the reviewer if needed, and upload.",
        "Upload at least 2 weeks before your event. Changes can take up to 24 hours to appear.",
        "You can have one submission at a time, and FIRST may not review more than three a season, so clear the warnings first.",
        "Only use artwork your team owns. FIRST doesn't accept TV or movie characters, or company or sports-team logos.",
    ],
    firstPost: "FIRST's Team Avatars post",
    dropHint: "Drop your logo here, paste it, or choose a file",
    types: "PNG, JPEG, WebP, GIF, SVG, AVIF or BMP, or a saved avatar project.",
    example: "Try an example",
    reading: "Reading the image…",
    tabStart: "Starting points",
    tabEdit: "Edit",
    tabCompare: "Compare",
    analysing: "Finding the background…",
    startReady: (n) => `${n} starting points. Pick one to make it a variant you can change.`,
    addAll: "Add all as options",
    showMore: "Show more",
    warnings: (n) => (n ? `${n} warning${n === 1 ? "" : "s"}` : "no warnings"),
    candidate: (c) => (!c.colorName ? c.label : / on$/.test(c.label) ? `${c.label} ${c.colorName}` : `${c.label} on ${c.colorName}`),
    showOpaque: "Opaque",
    showTransparent: "Transparent",
    viewDetail: "Detail",
    viewPixels: "Pixels",
    compareOriginal: "Hold to see the original",
    editNote: "Drawing tools (erase, brush, clone, shapes, text and pixel editing) are coming soon. Until then, change the variant with the settings on the left.",
    canvasLabel: (name, n) => `Avatar preview: ${name}, ${n} warning${n === 1 ? "" : "s"}`,
    sizes: ["40 px", "20 px (FTCScout small)"],
    zoomed: (what) => `${what}, 6×`,
    currentVs: "Current FIRST avatar (left) and this variant (right).",
    cardLight: "Light",
    cardDark: "Dark",
    cardList: "Card",
    cardCompact: "One row",
    yourTeam: "Your team",
    noChecks: "No warnings. This avatar is ready.",
    levels: { error: "error", warning: "warning", info: "info" },
    newWarning: (msg) => `New warning: ${msg}`,
    cleared: "All warnings cleared.",
    errType: "This file type can't be opened here. Export it as PNG or JPEG.",
    errLarge: "This image is too large.",
    errRead: "This file couldn't be read. Is it an image?",
    errUrl: "This site doesn't allow loading its images here. Save the image and drop it on this page.",
    errRender: "Something went wrong drawing this variant.",
    errProject: (msg) => `This project file can't be opened: ${msg}`,
    resetVariant: "Reset this variant",
    firstFrame: "Animated image: only its first frame is used.",
    restore: (name, n, when) => `Continue where you left off (${name}, ${n} variant${n === 1 ? "" : "s"}, saved ${when})?`,
    restoreYes: "Continue",
    restoreNo: "Start over",
    autosaveOff: "Autosave is off in this browser. Download the project file to keep your work.",
    loadProjectConfirm: "Open this project? Your current work is replaced.",
    sheetTitle: (team) => `${team} · avatar options`,
    sheetLegend: "left: opaque · right: transparent",
    sheetCurrent: "Current FIRST avatar",
    readmeTitle: "FIRST team avatar",
    backgrounds: { white: "White", red: "Red", blue: "Blue", award: "Award", dark: "Dark" },
    loaded: (name, w, h) => `${name} · ${w} × ${h} px`,
    bytes: (n) => `${(n / 1000).toFixed(1)} kB`,
};

const SIDES = { top: ["top", "rows"], bottom: ["bottom", "rows"], left: ["left", "columns"], right: ["right", "columns"] };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const BG_NAMES = { white: "white (#FFFFFF)", red: "red (#ED1C24)", blue: "blue (#0066B3)", award: "the award colour (#0083AE)" };

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
        case "C5":
            return p.name ? `The logo blends into the background. ${p.name[0].toUpperCase() + p.name.slice(1)} stands out more.` : "The logo blends into the background.";
        case "C6": {
            if (p.empty) return "The avatar is empty.";
            if (p.size < 5) return `The logo only fills ${p.longest} of the 40 pixels.`;
            let [side, unit] = SIDES[p.side];
            return `The ${side} ${p.size} ${unit} are empty.`;
        }
        case "C7":
            return `The logo is cut off at the ${p.side}. If you cut it off, cut it at the bottom.`;
        case "C8":
            return "The logo's circle is cut off by the edge.";
        case "C9": {
            let list = (p.backgrounds || []).map((b) => BG_NAMES[b] || b);
            return `On ${list.join(" and ")} the edge of the transparent version disappears.`;
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
        case "cutOrFit":
            return "Cut at the bottom";
        case "nudge":
        case "centre":
            return "Centre";
        case "setBackground":
            return "Use the suggested background";
        case "removeBackground":
            return "Remove background";
        case "pickBackground":
            return "Pick a colour";
        case "coinFrame":
            return "Use a circle frame";
        case "addBorder":
            return "Add a border";
        case "darkerBorder":
            return "Use a darker border";
        default:
            return null;
    }
}
