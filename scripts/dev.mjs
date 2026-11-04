// Local dev server for the website: `npm run dev` (PORT=8080 HOST=0.0.0.0 to change).
// Serves site/ directly, so edits show up on reload, with the built libraries and example data
// from dist/site (run `npm run build` once, and again after changing src/). Clean URLs like the
// production Caddyfile: /setup -> setup.html, /embed/pit-map -> embed/pit-map.html.
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const ROOTS = [resolve(root, "site"), resolve(root, "dist/site")];
// Paths served from somewhere else in production.
const ALIASES = { "/stats": resolve(root, "deploy/stats/stats.html") };
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".avif": "image/avif", ".bmp": "image/bmp" };
// The avatar maker's sources, unbundled, for a fast edit-and-reload loop (development only). Its page
// script then loads main.js directly, and main.js finds its worker next to itself.
const SOURCE_DIRS = { "/__avatar/": resolve(root, "avatar"), "/src/": resolve(root, "src"), "/demo/": resolve(root, "demo"), "/test-corpus/": resolve(root, "test-corpus") };
const AVATAR_ENTRY = 'import "/__avatar/app/main.js";\n';
const PORT = +process.env.PORT || 8080;
const HOST = process.env.HOST || "0.0.0.0";

if (!existsSync(resolve(root, "dist/site/lib"))) {
    console.error("dist/site is missing: run `npm run build` first.");
    process.exit(1);
}

const isFile = (p) => existsSync(p) && statSync(p).isFile();

function find(path) {
    if (ALIASES[path]) return ALIASES[path];
    for (const [prefix, dir] of Object.entries(SOURCE_DIRS)) {
        if (!path.startsWith(prefix)) continue;
        const p = normalize(join(dir, path.slice(prefix.length)));
        return p.startsWith(dir) && isFile(p) ? p : null;
    }
    for (const base of ROOTS) {
        const p = normalize(join(base, path));
        if (!p.startsWith(base)) return null;
        // try_files {path} {path}.html {path}/index.html
        for (const c of [p, p + ".html", join(p, "index.html")]) if (isFile(c)) return c;
    }
    return null;
}

createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const log = (status) => console.log(`${status} ${req.method} ${req.url}`);
    if (path === "/avatar.js") {
        log(200);
        res.writeHead(200, { "content-type": TYPES[".js"], "cache-control": "no-store" }).end(AVATAR_ENTRY);
        return;
    }
    const file = find(path);
    if (!file) {
        log(404);
        res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
        return;
    }
    log(200);
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream", "cache-control": "no-store", "access-control-allow-origin": "*" });
    res.end(readFileSync(file));
}).listen(PORT, HOST, () => {
    console.log(`ftc-embeds dev server: http://localhost:${PORT}/  (setup wizard: http://localhost:${PORT}/setup)`);
});
