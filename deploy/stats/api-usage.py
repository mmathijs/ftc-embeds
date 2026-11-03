#!/usr/bin/env python3
"""Summarizes the embeds API calls per website, from the API's nginx access log.

Sites that bundle the npm package never load anything from ftc-embeds.com; their widgets only
call the embeds API (GET /rest/embeds/v1/teams/{n}/{preset}, /events/{season}/{code}/pit-map).
This counts those calls per site, taken from the Referer, and writes JSON that embed-stats.py
merges into the statistics page. Runs by cron on the API server (scripts/stats.sh install-api).
No IP addresses or other request details end up in the output.

    python3 api-usage.py [--days N] [--logs DIR] [--out FILE]
"""
import argparse
import collections
import datetime as dt
import glob
import gzip
import ipaddress
import json
import os
import re
import sys
from urllib.parse import urlsplit

# ftc-embeds.com itself (its iframes and dashboards) is counted by embed-stats.py already.
OWN_HOSTS = {"ftc-embeds.com", "www.ftc-embeds.com"}

# nginx "main": $remote_addr - $remote_user [$time_local] "$request" $status $bytes "$referer" ...
LINE = re.compile(r'^\S+ - \S+ \[([^\]]+)\] "(\S+) (\S+)[^"]*" (\d{3}) \S+ "([^"]*)"')
CALL = re.compile(r"^/rest/embeds/v1/(?:teams/(\d+)/(card|results|awards|matches|stats)|events/(\d+)/([^/]+)/pit-map)$")


def read_lines(log_dir):
    for path in sorted(glob.glob(os.path.join(log_dir, "access.log*"))):
        opener = gzip.open if path.endswith(".gz") else open
        try:
            with opener(path, "rt", encoding="utf-8", errors="replace") as f:
                yield from f
        except OSError as e:
            print(f"skipping {path}: {e}", file=sys.stderr)


def site_of(referer):
    """The embedding site, or None for ftc-embeds.com itself and local development."""
    host = (urlsplit(referer).hostname or "").lower() if referer and referer != "-" else ""
    if not host:
        return "(no referrer)"
    if host in OWN_HOSTS or host == "localhost" or host.endswith(".localhost") or host.endswith(".local"):
        return None
    try:
        ip = ipaddress.ip_address(host)
        if ip.is_private or ip.is_loopback or ip.is_link_local:
            return None
    except ValueError:
        pass
    return host[4:] if host.startswith("www.") else host


def collect(log_dir, days):
    since = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days)
    sites = collections.defaultdict(lambda: {
        "calls": 0,
        "presets": collections.Counter(),
        "teams": collections.Counter(),
        "events": collections.Counter(),
        "last": None,
        "days": collections.Counter(),
    })
    for line in read_lines(log_dir):
        m = LINE.match(line)
        if not m:
            continue
        when, method, uri, status, referer = m.groups()
        if method != "GET" or not (200 <= int(status) < 400):
            continue
        call = CALL.match(uri.partition("?")[0])
        if not call:
            continue
        try:
            ts = dt.datetime.strptime(when, "%d/%b/%Y:%H:%M:%S %z")
        except ValueError:
            continue
        if ts < since:
            continue
        site = site_of(referer)
        if site is None:
            continue
        team, preset, _season, event = call.groups()
        s = sites[site]
        s["calls"] += 1
        s["presets"][preset or "pit-map"] += 1
        if team:
            s["teams"][team] += 1
        if event:
            s["events"][event.upper()] += 1
        ts = ts.astimezone(dt.timezone.utc)
        s["last"] = max(s["last"] or ts, ts)
        s["days"][ts.date()] += 1
    return sites


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--days", type=int, default=90, help="look back this many days (default 90)")
    ap.add_argument("--logs", default="/home/mmathijs-ftcscout-api/logs/nginx")
    ap.add_argument("--out", help="write here (atomically) instead of printing")
    args = ap.parse_args()

    sites = collect(args.logs, args.days)
    out = json.dumps({
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "days": args.days,
        "sites": [
            {
                "site": site,
                "apiCalls": s["calls"],
                "presets": dict(s["presets"].most_common()),
                "teams": dict(s["teams"].most_common(10)),
                "events": dict(s["events"].most_common(10)),
                "lastSeen": s["last"].isoformat() if s["last"] else None,
                "perDay": {d.isoformat(): n for d, n in sorted(s["days"].items())},
            }
            for site, s in sorted(sites.items(), key=lambda kv: -kv[1]["calls"])
        ],
    }, indent=1)
    if not args.out:
        print(out)
        return
    tmp = args.out + ".tmp"
    with open(tmp, "w") as f:
        f.write(out)
    os.chmod(tmp, 0o644)
    os.replace(tmp, args.out)


if __name__ == "__main__":
    main()
