#!/usr/bin/env python3
"""Summarizes where ftc-embeds is used, from the embed log written by the site's Caddy.

Counts iframe loads (/embed/*) and library loads (/lib/*, the HTML element and JavaScript
versions) per embedding site, taken from the Referer, and merges in the embeds API calls per
site from the API server (api-usage.py), which is how sites using the npm package show up. Run
on the server, or from your machine with scripts/stats.sh.

    python3 embed-stats.py [--days N] [--json] [--logs DIR] [--api-usage URL|FILE|none]
"""
import argparse
import collections
import datetime as dt
import glob
import gzip
import json
import os
import sys
import urllib.request
from urllib.parse import parse_qs, urlsplit

OWN_HOSTS = {"ftc-embeds.com", "www.ftc-embeds.com"}
API_USAGE = "https://ftcscout-api.mmathijs.nl/embeds-usage.json"


def read_lines(log_dir):
    files = sorted(glob.glob(os.path.join(log_dir, "embeds*.log*")))
    for path in files:
        opener = gzip.open if path.endswith(".gz") else open
        try:
            with opener(path, "rt", encoding="utf-8", errors="replace") as f:
                yield from f
        except OSError as e:
            print(f"skipping {path}: {e}", file=sys.stderr)


def site_of(referer):
    if not referer:
        return "(no referrer)"
    parts = urlsplit(referer)
    host = (parts.hostname or "").lower()
    if not host:
        return "(no referrer)"
    return host[4:] if host.startswith("www.") else host


def collect(log_dir, days):
    since = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days)
    sites = collections.defaultdict(
        lambda: {
            "iframe": 0,
            "script": 0,
            "api": 0,
            "events": collections.Counter(),
            "teams": collections.Counter(),
            "last": None,
            "days": collections.defaultdict(lambda: {"iframe": 0, "library": 0, "api": 0}),
        }
    )
    per_day = collections.Counter()
    for line in read_lines(log_dir):
        try:
            entry = json.loads(line)
        except ValueError:
            continue
        ts = dt.datetime.fromtimestamp(entry.get("ts", 0), dt.timezone.utc)
        status = entry.get("status", 0)
        if ts < since or not (200 <= status < 400):
            continue
        uri = entry.get("request", {}).get("uri", "")
        path, _, query = uri.partition("?")
        kind = "iframe" if path.startswith("/embed/") else "script" if path.startswith("/lib/") else None
        if not kind:
            continue
        site = site_of(entry.get("referer", ""))
        if site in OWN_HOSTS:
            continue  # the dashboard and the embed page loading the library themselves
        s = sites[site]
        s[kind] += 1
        if kind == "iframe":
            event = (parse_qs(query).get("event") or [""])[0].upper()
            if event:
                s["events"][event] += 1
        s["last"] = max(s["last"] or ts, ts)
        s["days"][ts.date()]["iframe" if kind == "iframe" else "library"] += 1
        per_day[ts.date()] += 1
    return sites, per_day


def load_api_usage(source):
    """api-usage.py's JSON, from a URL or a file; None (and a warning) if it can't be had."""
    try:
        if source.startswith(("http://", "https://")):
            with urllib.request.urlopen(source, timeout=20) as r:
                return json.load(r)
        with open(source) as f:
            return json.load(f)
    except (OSError, ValueError) as e:
        print(f"no API usage from {source}: {e}", file=sys.stderr)
        return None


def merge_api(sites, per_day, usage, days):
    """Adds the API calls (per site, per day) within the last `days` days."""
    since = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days)).date()
    for u in usage.get("sites", []):
        site = u.get("site") or "(no referrer)"
        if site in OWN_HOSTS:
            continue
        calls = 0
        for day, n in (u.get("perDay") or {}).items():
            d = dt.date.fromisoformat(day)
            if d < since:
                continue
            calls += n
            per_day[d] += n
        if not calls:
            continue
        s = sites[site]
        s["api"] += calls
        for d, n in (u.get("perDay") or {}).items():
            if dt.date.fromisoformat(d) >= since:
                s["days"][dt.date.fromisoformat(d)]["api"] += n
        s["events"].update(u.get("events") or {})
        s["teams"].update(u.get("teams") or {})
        if u.get("lastSeen"):
            last = dt.datetime.fromisoformat(u["lastSeen"])
            s["last"] = max(s["last"] or last, last)


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--days", type=int, default=30, help="look back this many days (default 30)")
    ap.add_argument("--json", action="store_true", help="print JSON instead of a table")
    ap.add_argument("--logs", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs"))
    ap.add_argument("--api-usage", default=API_USAGE, help=f"api-usage.py's JSON: URL or file, or none (default {API_USAGE})")
    args = ap.parse_args()

    sites, per_day = collect(args.logs, args.days)
    usage = load_api_usage(args.api_usage) if args.api_usage != "none" else None
    if usage:
        merge_api(sites, per_day, usage, args.days)
    ranked = sorted(sites.items(), key=lambda kv: -(kv[1]["iframe"] + kv[1]["script"] + kv[1]["api"]))

    if args.json:
        print(json.dumps({
            "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
            "days": args.days,
            "apiUsage": bool(usage),
            "sites": [
                {
                    "site": site,
                    "iframeLoads": s["iframe"],
                    "libraryLoads": s["script"],
                    "apiCalls": s["api"],
                    "events": dict(s["events"].most_common()),
                    "teams": dict(s["teams"].most_common(10)),
                    "lastSeen": s["last"].isoformat() if s["last"] else None,
                    "perDay": {d.isoformat(): n for d, n in sorted(s["days"].items())},  # {iframe, library, api}
                }
                for site, s in ranked
            ],
            "perDay": {d.isoformat(): n for d, n in sorted(per_day.items())},
        }, indent=2))
        return

    total_iframe = sum(s["iframe"] for s in sites.values())
    total_script = sum(s["script"] for s in sites.values())
    total_api = sum(s["api"] for s in sites.values())
    print(f"Last {args.days} days: {total_iframe} iframe loads, {total_script} library loads, {total_api} API calls, {len(sites)} sites\n")
    if not ranked:
        print("No embeds yet.")
        return
    width = max(len("site"), *(len(site) for site, _ in ranked))
    print(f"{'site':<{width}}  {'iframe':>7}  {'library':>7}  {'api':>7}  {'last seen':<16}  events / teams")
    for site, s in ranked:
        last = s["last"].strftime("%Y-%m-%d %H:%M") if s["last"] else ""
        used = s["events"].most_common(3) + s["teams"].most_common(3)
        events = ", ".join(f"{e} ({n})" for e, n in used)
        print(f"{site:<{width}}  {s['iframe']:>7}  {s['script']:>7}  {s['api']:>7}  {last:<16}  {events}")

    print("\nLoads per day (last 14 days):")
    today = dt.datetime.now(dt.timezone.utc).date()
    peak = max(per_day.values(), default=0) or 1
    for i in range(13, -1, -1):
        d = today - dt.timedelta(days=i)
        n = per_day.get(d, 0)
        print(f"  {d}  {'#' * max(1 if n else 0, round(n / peak * 40)):<40} {n}")
    print("\nLibrary loads are a lower bound: Cloudflare serves cached copies without asking the server.")


if __name__ == "__main__":
    main()
