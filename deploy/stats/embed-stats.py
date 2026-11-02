#!/usr/bin/env python3
"""Summarizes where ftc-embeds is used, from the embed log written by the site's Caddy.

Counts iframe loads (/embed/*) and library loads (/lib/*, the HTML element and JavaScript
versions) per embedding site, taken from the Referer. Run on the server, or from your machine
with scripts/stats.sh.

    python3 embed-stats.py [--days N] [--json] [--logs DIR]
"""
import argparse
import collections
import datetime as dt
import glob
import gzip
import json
import os
import sys
from urllib.parse import parse_qs, urlsplit

OWN_HOSTS = {"ftc-embeds.com", "www.ftc-embeds.com"}


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
            "events": collections.Counter(),
            "last": None,
            "days": collections.defaultdict(lambda: {"iframe": 0, "library": 0}),
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


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--days", type=int, default=30, help="look back this many days (default 30)")
    ap.add_argument("--json", action="store_true", help="print JSON instead of a table")
    ap.add_argument("--logs", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs"))
    args = ap.parse_args()

    sites, per_day = collect(args.logs, args.days)
    ranked = sorted(sites.items(), key=lambda kv: -(kv[1]["iframe"] + kv[1]["script"]))

    if args.json:
        print(json.dumps({
            "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
            "days": args.days,
            "sites": [
                {
                    "site": site,
                    "iframeLoads": s["iframe"],
                    "libraryLoads": s["script"],
                    "events": dict(s["events"].most_common()),
                    "lastSeen": s["last"].isoformat() if s["last"] else None,
                    "perDay": {d.isoformat(): n for d, n in sorted(s["days"].items())},  # {iframe, library}
                }
                for site, s in ranked
            ],
            "perDay": {d.isoformat(): n for d, n in sorted(per_day.items())},
        }, indent=2))
        return

    total_iframe = sum(s["iframe"] for s in sites.values())
    total_script = sum(s["script"] for s in sites.values())
    print(f"Last {args.days} days: {total_iframe} iframe loads, {total_script} library loads, {len(sites)} sites\n")
    if not ranked:
        print("No embeds yet.")
        return
    width = max(len("site"), *(len(site) for site, _ in ranked))
    print(f"{'site':<{width}}  {'iframe':>7}  {'library':>7}  {'last seen':<16}  events")
    for site, s in ranked:
        last = s["last"].strftime("%Y-%m-%d %H:%M") if s["last"] else ""
        events = ", ".join(f"{e} ({n})" for e, n in s["events"].most_common(3))
        print(f"{site:<{width}}  {s['iframe']:>7}  {s['script']:>7}  {last:<16}  {events}")

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
