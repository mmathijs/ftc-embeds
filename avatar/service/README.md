# Avatar options service

Turns one uploaded team logo into up to eight 40 × 40 FIRST avatar options. The page is
`site/avatar.html` (https://ftc-embeds.com/avatar); this folder is the server part behind
`/api/avatar/`. No AI and no API tokens: the image steps are `campaign.py` from the
ftc-avatar-campaign skill (the 2026 Benelux campaign), unchanged except for how the main part is
chosen. Nothing is stored: the upload is processed in memory and dropped once the answer is sent.

None of this is part of the npm package (`files` in package.json lists `src`, `dist/*.mjs`,
`dist/*.js`, `docs`, `README.md` and `LICENSE`), so people who install ftc-embeds download none of it.

## API

`POST /api/avatar/options?team=<number>` with the image as the raw request body (PNG, JPEG, WebP or
GIF; the page always sends a PNG of at most 1024 px). At most 10 MiB, and at most 25 megapixels to
decode (a JPEG is decoded at 1/2, 1/4 or 1/8 size first, so bigger photos are fine).

```json
{
  "team": 23452,
  "name": "TieWraps",                    // from FTCScout, null if it couldn't be reached
  "current": "data:image/png;base64,…",  // the team's current FIRST avatar, or null
  "base": "23452-tiewraps",              // file name prefix
  "flat": true,                          // false: no flat background, so only the whole logo
  "options": [{
    "id": "whole",                       // whole, on-<colour>, main, top, coin, crisp
    "label": "Whole logo",
    "note": "Background removed in the transparent version, kept as a thin border",
    "bg": "#000000",                     // background of the opaque version
    "opaque": "data:image/png;base64,…", // 40 x 40, no alpha
    "transparent": "data:image/png;base64,…",
    "bytes": [2741, 3466],
    "warnings": ["There's an empty band of 7 px on the left."],
    "files": ["23452-tiewraps-whole-avatar-40.png", "23452-tiewraps-whole-avatar-40-transparent.png"]
  }],
  "zip": "data:application/zip;base64,…",// every PNG, a comparison sheet, HOW-TO-UPLOAD.txt
  "ms": 640
}
```

Errors are `{"error": "<a sentence for the visitor>"}` with 400 (no team number, empty body, image
under 16 px), 413 (over 10 MiB or 25 megapixels), 415 (not an image), 429 (more than `RATE` uploads
from one visitor in 10 minutes), 503 (busy for 20 s) or 500 (a bug; details only in the log).
Through Caddy, a body over 10 MiB gets Caddy's own 413 without JSON; the page handles both.

`GET /api/avatar/health` answers `{"ok": true}`.

## The options

1. **Whole logo** on its own background colour, with the background cut away in the transparent
   version and kept as a 1.1 px border. A logo that is already transparent goes on the colour with
   the most contrast. A logo without a flat background is kept as it is, with rounded corners.
2. **On a colour**: the cut-out on up to two of teal `#00626e`, navy `#16264a`, black `#121216`,
   white and cream: those with fewer than 35% of the cut-out's edge pixels within distance 70 of the
   colour, best first, or else the single best. The colour the whole logo already uses is skipped.
3. **Main part**: separate text left out (parts are grouped by overlapping boxes; the biggest group stays).
4. **Top part**: for tall logos, the top square, cut at the bottom edge with no gap under it.
5. **Coin**: for round badges, zoomed in a little, with a complete 1.1 px ring inside the square.
6. **Crisp colours**: for soft or photo-like logos, more contrast and 14 colours.

Near-duplicates are dropped. Every option is checked: 40 × 40, at most 20 kB, static PNG, opaque
version without alpha, no colour hidden under transparent pixels, pixels near lime `#00FF00` or
magenta `#FF00FF` (video overlays key them out), and empty bands of 5 px or more. Checks become
`warnings`; they never hide an option. `tests/test_service.py` asserts the file rules on every option
and checks the lime and empty-band notes on two made-up logos.

## Settings

| Variable | Default | |
| --- | --- | --- |
| `PORT` | 8080 | |
| `FTCSCOUT_API` | https://ftcscout-api.mmathijs.nl/rest/embeds/v1 | team name and current avatar (`/teams/<n>/card`), cached 10 minutes |
| `MAX_JOBS` | 2 | images processed at once; more wait up to 20 s, then 503 |
| `RATE` | 10 | uploads per visitor per 10 minutes |
| `CLIENT_IP_HEADER` | X-Client-IP | set by Caddy (`avatars.caddy`); `X-Forwarded-For` is never read, visitors can send their own |
| `DEV_PAGE` | | an HTML file served at `/` and `/avatar`, for testing without Caddy |

## Run and test locally

```bash
pip install -r requirements.txt playwright   # Python 3.10 or newer
python3 -m playwright install chromium       # the browser for test_page.py
DEV_PAGE=../../site/avatar.html RATE=5 python3 service.py &
python3 tests/test_service.py http://127.0.0.1:8080 tests/logos --rate 5
# restart the service with RATE=1000 for the page test, which uploads every logo it is given
python3 tests/test_page.py http://127.0.0.1:8080 tests/logos/*.png --shots /tmp/shots
```

`tests/logos/` holds the test logos (not committed: they are other teams' artwork). Collect at least
20 public FTC team logos, with at least one of each: transparent PNG, JPEG photo, round badge, wide
banner, tall mascot, text only, dark background, and an SVG (the page turns SVGs into PNGs).

## Deploy

`scripts/avatars.sh install` copies this folder (without the tests) to `/opt/ftc-embeds/avatars` on
the server, builds and starts the `ftc-embeds-avatars` container (`docker-compose.yml`, on the
`ftcscout-edge` network, no published ports) and waits up to 30 s for its health check. Only then
does it copy `avatars.caddy` to `/opt/ftc-embeds/extra/` and reload Caddy; if Caddy refuses the
snippet, it removes it again. It needs the `./extra:/etc/caddy/extra:ro` mount on `ftc-embeds-web`
in `deploy/docker-compose.yml`. `scripts/avatars.sh logs` follows the log, one line per request with
no images and no IP addresses, such as `"POST /api/avatar/options?team=23452 HTTP/1.1" 200 -
whole,on-teal,main,crisp 640 ms` (`no-flat` at the end when the background wasn't flat).
`scripts/avatars.sh remove` takes it down again.

Measured on 2 CPU cores with 32 logo files from 2026 and a 4000 x 3000 JPEG photo: 0.6 to 0.7 s per
logo (median), 1.4 s at most; 8 uploads at once: 105 to 115 a minute, answers within 8 s; memory
peaks at about 640 MB with two jobs running (`mem_limit: 1g`).
