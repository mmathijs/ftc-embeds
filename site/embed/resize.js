// Sizes ftc-embeds iframes to their widget: each iframe page posts { type: "ftc-embeds:height",
// height } when its height changes. Add once per page, after the iframes or anywhere:
//   <script src="https://ftc-embeds.com/embed/resize.js" async></script>
// An iframe with data-ftc-height="fixed" keeps its own height.
(() => {
    if (window.__ftcEmbedsResize) return;
    window.__ftcEmbedsResize = true;
    const origin = new URL(document.currentScript ? document.currentScript.src : location.href).origin;
    addEventListener("message", (e) => {
        if (e.origin !== origin || !e.data || e.data.type !== "ftc-embeds:height" || !(e.data.height > 0)) return;
        for (const frame of document.getElementsByTagName("iframe")) {
            if (frame.contentWindow === e.source && frame.dataset.ftcHeight !== "fixed") frame.style.height = Math.ceil(e.data.height) + 2 + "px";
        }
    });
})();
