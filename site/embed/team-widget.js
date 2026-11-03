// Renders one team widget from URL parameters, for the iframe pages (embed/team-card.html etc.).
// The parameters mirror the web components' attributes: team, season, theme (name or JSON),
// layout, density, hide, limit, max-height, stats, ... (see the docs of each widget).
(() => {
    const page = document.currentScript.dataset;
    const lib = window[page.global];
    const Widget = lib[page.widget];
    const q = new URLSearchParams(location.search);
    const site = window.FTC_EMBEDS_SITE || {};
    const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

    let options = {};
    for (let [key, value] of q) {
        if (key === "apiBase" || key === "graphqlUrl") continue;
        if (/^\s*[{[]/.test(value)) {
            try {
                value = JSON.parse(value);
            } catch {
                // keep the text
            }
        } else if (value === "true" || value === "false") value = value === "true";
        options[camel(key)] = value;
    }
    // In an iframe, links open in a new tab unless asked otherwise.
    options.linkTarget ??= "_blank";
    lib.configure({ apiBase: q.get("apiBase") || site.apiBase || null, graphqlUrl: q.get("graphqlUrl") || site.graphqlUrl || null });

    let theme = typeof options.theme === "string" ? options.theme : options.theme?.base;
    // Dark themes end in -dark (plus "dark" and "trophy"); the -auto ones follow the visitor.
    document.documentElement.style.colorScheme = !theme || theme === "auto" || theme.endsWith("-auto") ? "light dark" : theme === "dark" || theme === "trophy" || theme.endsWith("-dark") ? "dark" : "light";

    let root = document.getElementById("widget");
    let widget = new Widget(root, options);
    // Tell the embedding page the height, so it can size the iframe to fit.
    let report = () => parent !== window && parent.postMessage({ type: "ftc-embeds:height", widget: page.widget, height: Math.ceil(root.getBoundingClientRect().height) }, "*");
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(report).observe(root);
    widget.on("load", report);
})();
