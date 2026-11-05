// Tells search engines that take IndexNow (Bing, Yandex, Seznam, Naver; api.indexnow.org passes it
// on) which pages changed in a deploy: the URLs that are new in the sitemap or have a new lastmod.
// deploy.sh saves the live sitemap before uploading and runs this after; without that old sitemap
// it sends nothing (so a failed download never submits every page).
//   node scripts/indexnow.mjs <old sitemap.xml> <new sitemap.xml> [--dry-run]
// The key is public by design: ftc-embeds.com/<key>.txt proves the site is ours.
import { existsSync, readFileSync } from "node:fs";

const KEY = "b54a948dc10a8304eb5bc0eec34ee64a";
const HOST = "ftc-embeds.com";
const [oldFile, newFile] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const dry = process.argv.includes("--dry-run");

/** loc -> lastmod ("" without one) */
const read = (file) => new Map([...readFileSync(file, "utf8").matchAll(/<loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?/g)].map((m) => [m[1], m[2] || ""]));

if (!newFile || !existsSync(newFile)) {
    console.error("usage: node scripts/indexnow.mjs <old sitemap.xml> <new sitemap.xml> [--dry-run]");
    process.exit(1);
}
if (!oldFile || !existsSync(oldFile)) {
    console.log("indexnow: no sitemap from before the deploy, nothing sent");
    process.exit(0);
}
const before = read(oldFile);
const changed = [...read(newFile)].filter(([loc, mod]) => before.get(loc) !== mod).map(([loc]) => loc);
if (!changed.length) {
    console.log("indexnow: no changed pages");
    process.exit(0);
}
if (dry) {
    console.log(`indexnow: would send ${changed.length} pages, e.g. ${changed.slice(0, 3).join(" ")}`);
    process.exit(0);
}
// At most 10,000 URLs per request.
for (let i = 0; i < changed.length; i += 10000) {
    const urlList = changed.slice(i, i + 10000);
    const r = await fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList }),
        signal: AbortSignal.timeout(30000),
    });
    // 200 and 202 are both fine (202: the key is still being checked).
    console.log(`indexnow: sent ${urlList.length} pages, answer ${r.status}`);
    if (r.status >= 400) process.exitCode = 1;
}
