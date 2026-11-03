// Builds every widget. No dependencies.
//   dist/<widget>.mjs        single-file ES module (shared src/core code inlined)
//   dist/<widget>.umd.js     UMD build for <script> tags / CommonJS (global name per widget)
//   dist/<widget>.min.mjs, dist/<widget>.umd.min.js   minified versions (served on ftc-embeds.com)
//   dist/<widget>-demo.html  self-contained demo (library + example data inlined)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { transformSync } from "esbuild";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WIDGETS = [
    { name: "pit-map", global: "FtcPitMap" },
];

const IMPORT_RE = /^import\s*\{[^}]*\}\s*from\s*"(\.{1,2}\/[^"]+)";\s*$/gm;
const REEXPORT_RE = /^export\s*\{([^}]*)\}\s*from\s*"(\.{1,2}\/[^"]+)";\s*$/gm;

/**
 * Inline the relative imports of `file` (recursively, once each) so the result is one module.
 * Inlined modules lose their `export` keywords; re-exports become a local `export { … }`.
 */
function bundle(file, seen = new Set()) {
    let src = readFileSync(file, "utf8");
    let deps = [];
    let reexports = [];
    let take = (spec) => {
        let dep = resolve(dirname(file), spec);
        if (!seen.has(dep)) {
            seen.add(dep);
            deps.push(bundle(dep, seen).replace(/^\/\*![\s\S]*?\*\/\n/, "").replace(/^export (const|function|class|async function) /gm, "$1 "));
        }
    };
    src = src.replace(REEXPORT_RE, (_, names, spec) => {
        take(spec);
        reexports.push(names.trim());
        return "";
    });
    src = src.replace(IMPORT_RE, (_, spec) => {
        take(spec);
        return "";
    });
    let [banner, ...rest] = src.split(/(?<=\*\/)\n/);
    let out = [banner, ...deps, rest.join("\n")].join("\n");
    if (reexports.length) out += `\nexport { ${reexports.join(", ")} };\n`;
    return out;
}

mkdirSync(resolve(root, "dist"), { recursive: true });

for (const { name, global } of WIDGETS) {
    const esm = bundle(resolve(root, `src/${name}/${name}.mjs`));
    writeFileSync(resolve(root, `dist/${name}.mjs`), esm);

    const exported = [
        ...[...esm.matchAll(/^export (?:const|function|class|async function) (\w+)/gm)].map((m) => m[1]),
        ...[...esm.matchAll(/^export \{([^}]*)\};\s*$/gm)].flatMap((m) => m[1].split(",").map((s) => s.trim())),
    ].filter(Boolean);
    const defaultExport = /^export default (\w+);\s*$/m.exec(esm)?.[1];
    const body = esm
        .replace(/^export default \w+;\s*$/m, "")
        .replace(/^export \{[^}]*\};\s*$/gm, "")
        .replace(/^export (const|function|class|async function) /gm, "$1 ");
    const [banner, ...rest] = body.split(/(?<=\*\/)\n/);
    const umd = `${banner}
(function (global, factory) {
    if (typeof exports === "object" && typeof module !== "undefined") module.exports = factory();
    else if (typeof define === "function" && define.amd) define(factory);
    else (global = typeof globalThis !== "undefined" ? globalThis : global || self).${global} = factory();
})(this, function () {
"use strict";
${rest.join("\n")}
return { ${exported.join(", ")}${defaultExport ? `, default: ${defaultExport}` : ""} };
});
`;
    writeFileSync(resolve(root, `dist/${name}.umd.js`), umd);

    // Minified copies; the license banner (/*! ... */) is kept.
    const minify = (code, format) => transformSync(code, { minify: true, format, target: "es2020", legalComments: "inline" }).code;
    writeFileSync(resolve(root, `dist/${name}.min.mjs`), minify(esm, "esm"));
    writeFileSync(resolve(root, `dist/${name}.umd.min.js`), minify(umd, undefined));

    // Single-file demo: library + example data inlined, opens from anywhere.
    const demoDir = resolve(root, `demo/${name}`);
    if (existsSync(resolve(demoDir, "index.html"))) {
        let page = readFileSync(resolve(demoDir, "index.html"), "utf8");
        const inline = (tag, file) => {
            if (!page.includes(tag)) throw new Error(`build: ${tag} not found in demo/${name}/index.html`);
            const code = readFileSync(file, "utf8").replace(/<\/script/gi, "<\\/script");
            page = page.replace(tag, () => `<script>\n${code}\n</script>`);
        };
        inline(`<script src="../../dist/${name}.umd.js"></script>`, resolve(root, `dist/${name}.umd.min.js`));
        inline('<script src="data/events.js"></script>', resolve(demoDir, "data/events.js"));
        writeFileSync(resolve(root, `dist/${name}-demo.html`), page);
    }
    const kb = (f) => (readFileSync(resolve(root, `dist/${f}`)).length / 1024).toFixed(1) + " KB";
    console.log(`built ${name}: ${kb(`${name}.umd.js`)}, minified ${kb(`${name}.umd.min.js`)} (exports: ${exported.join(", ")})`);
}

// Website (ftc-embeds.com): dashboard, iframe embed pages, the library and the example events.
import { cpSync, readdirSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";

const site = resolve(root, "dist/site");
rmSync(site, { recursive: true, force: true });
cpSync(resolve(root, "site"), site, { recursive: true });
mkdirSync(resolve(site, "lib"), { recursive: true });
for (const { name } of WIDGETS) {
    // Same URLs as before, minified content.
    writeFileSync(resolve(site, `lib/${name}.mjs`), readFileSync(resolve(root, `dist/${name}.min.mjs`)));
    writeFileSync(resolve(site, `lib/${name}.umd.js`), readFileSync(resolve(root, `dist/${name}.umd.min.js`)));
}
const examples = resolve(root, "demo/pit-map/data");
mkdirSync(resolve(site, "examples"), { recursive: true });
writeFileSync(resolve(site, "examples/events.js"), readFileSync(resolve(examples, "events.js")));
for (const file of readdirSync(examples).filter((f) => f.endsWith("_pitmap.json"))) {
    writeFileSync(resolve(site, `examples/${file.replace("_pitmap", "")}`), readFileSync(resolve(examples, file)));
}
// Give the pages' own scripts a content hash (dashboard.js?v=1a2b3c4d), so a deploy never pairs a
// new page with an old script that the browser or Cloudflare still has cached.
const pages = readdirSync(site, { recursive: true }).filter((f) => f.endsWith(".html"));
for (const page of pages) {
    const path = resolve(site, page);
    const html = readFileSync(path, "utf8").replace(/(<script\b[^>]*\bsrc=")([^":?#]+\.m?js)"/g, (tag, start, src) => {
        const target = resolve(dirname(path), src);
        if (!existsSync(target)) throw new Error(`build: ${page} loads ${src}, which doesn't exist`);
        const hash = createHash("sha256").update(readFileSync(target)).digest("hex").slice(0, 8);
        return `${start}${src}?v=${hash}"`;
    });
    writeFileSync(path, html);
}
console.log("built site (dist/site)");
