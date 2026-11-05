// Local dev server for the website: `npm run dev` (PORT=8080 HOST=0.0.0.0 to change).
// Serves site/ directly, so edits show up on reload, with the built libraries and example data
// from dist/site (run `npm run build` once, and again after changing src/). Clean URLs like the
// production Caddyfile: /setup -> setup.html, /embed/pit-map -> embed/pit-map.html.
// /teams/<number> is teams.html, with its Caddy template filled in (see renderTemplate).
// /api/avatar/* goes to the avatar service, as Caddy does in production: run it next to this one
// (cd avatar/service && PORT=8095 python3 service.py) or point AVATAR_API somewhere else.
import { createServer, request } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const ROOTS = [resolve(root, "site"), resolve(root, "dist/site")];
// Paths served from somewhere else in production.
const ALIASES = { "/stats": resolve(root, "deploy/stats/stats.html") };
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml" };
const AVATAR_API = new URL(process.env.AVATAR_API || "http://127.0.0.1:8095");
const PORT = +process.env.PORT || 8080;
const HOST = process.env.HOST || "0.0.0.0";

if (!existsSync(resolve(root, "dist/site/lib"))) {
    console.error("dist/site is missing: run `npm run build` first.");
    process.exit(1);
}

const isFile = (p) => existsSync(p) && statSync(p).isFile();

function find(path) {
    if (ALIASES[path]) return ALIASES[path];
    for (const base of ROOTS) {
        const p = normalize(join(base, path));
        if (!p.startsWith(base)) return null;
        // try_files {path} {path}.html {path}/index.html
        for (const c of [p, p + ".html", join(p, "index.html")]) if (isFile(c)) return c;
    }
    return null;
}

/**
 * The few Caddy template actions teams.html uses, so the dev server shows what Caddy sends:
 * {{$n := placeholder "http.regexp.team.1"}}, {{if $n}}…{{else}}…{{end}} (not nested) and {{$n}}.
 */
function renderTemplate(html, team) {
    return html
        .replace(/\{\{\$n := placeholder "[^"]*"\}\}\n?/g, "")
        .replace(/\{\{if \$n\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{end\}\}/g, (_, yes, no = "") => (team ? yes : no))
        .replace(/\{\{\$n\}\}/g, team);
}

function proxyAvatar(req, res) {
    const up = request({ hostname: AVATAR_API.hostname, port: AVATAR_API.port, method: req.method, path: req.url, headers: req.headers }, (r) => {
        console.log(`${r.statusCode} ${req.method} ${req.url} (avatar service)`);
        res.writeHead(r.statusCode, r.headers);
        r.pipe(res);
    });
    up.on("error", () => {
        console.log(`502 ${req.method} ${req.url} (avatar service not running at ${AVATAR_API.origin})`);
        if (!res.headersSent) res.writeHead(502, { "content-type": "application/json" }).end(JSON.stringify({ error: `The avatar service isn't running at ${AVATAR_API.origin}.` }));
    });
    req.pipe(up);
}

createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (path.startsWith("/api/avatar/")) return proxyAvatar(req, res);
    // Team pages, like the Caddyfile: /teams/16382 -> teams.html with the number.
    const team = /^\/teams\/(\d{1,6})\/?$/.exec(path)?.[1] ?? "";
    const file = team ? find("/teams.html") : find(path);
    const log = (status) => console.log(`${status} ${req.method} ${req.url}`);
    if (!file) {
        log(404);
        res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
        return;
    }
    log(200);
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream", "cache-control": "no-store", "access-control-allow-origin": "*" });
    if (file.endsWith("/teams.html")) return res.end(renderTemplate(readFileSync(file, "utf8"), team));
    res.end(readFileSync(file));
}).listen(PORT, HOST, () => {
    console.log(`ftc-embeds dev server: http://localhost:${PORT}/  (setup wizard: http://localhost:${PORT}/setup)`);
});
