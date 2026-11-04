#!/usr/bin/env python3
"""Avatar options service for ftc-embeds.com, phase 1: one team at a time, the team uploads its logo.

  POST /api/avatar/options?team=<number>    body: the logo file (PNG, JPEG, WebP or GIF, at most 10 MB)
       -> 200 {team, name, current, options: [...], zip}    (images and the zip as data URIs)
  GET  /api/avatar/health                   -> {"ok": true}

Nothing is stored: the upload is processed in memory and dropped when the answer is sent.
Needs Python 3.10+ with Pillow, numpy and scipy, and campaign.py next to this file.

Environment: PORT (8080), FTCSCOUT_API (https://ftcscout-api.mmathijs.nl/rest/embeds/v1),
MAX_JOBS (2 at a time), RATE (10 uploads per visitor per 10 minutes), CLIENT_IP_HEADER (X-Client-IP:
the header the proxy sets to the visitor's address; X-Forwarded-For is not read, because visitors can
send their own), DEV_PAGE (an HTML file served at / and /avatar, for testing without Caddy).
"""
import base64, collections, io, json, os, re, sys, tempfile, threading, time, unicodedata, urllib.request, zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import numpy as np
from PIL import Image, ImageEnhance, ImageOps
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import campaign as c  # noqa: E402  (the ftc-avatar-campaign toolkit)

MAX_PIXELS = 25_000_000                      # checked before decoding, after JPEG draft: refuses decompression bombs
Image.MAX_IMAGE_PIXELS = 4 * MAX_PIXELS      # Pillow's own guard (it raises above twice this, before the draft)
MAX_BYTES = 10 * 1024 * 1024
WORK_SIDE = 768        # logos are reduced to this first: results match 1024 px within 1 to 2.5 colour levels on
                       # average, in about 60% of the time and half the memory (the 40 px result is drawn at 320 px)
PORT = int(os.environ.get('PORT', 8080))
API = os.environ.get('FTCSCOUT_API', 'https://ftcscout-api.mmathijs.nl/rest/embeds/v1').rstrip('/')
JOBS = threading.BoundedSemaphore(int(os.environ.get('MAX_JOBS', 2)))
RATE, WINDOW = int(os.environ.get('RATE', 10)), 600
IP_HEADER = os.environ.get('CLIENT_IP_HEADER', 'X-Client-IP')
_hits, _lock = collections.defaultdict(collections.deque), threading.Lock()
# background colours to try, in this order when scores tie (the 2026 picks first)
TRY_BGS = [('teal', (0, 98, 110)), ('navy', (22, 38, 74)), ('black', (18, 18, 22)), ('white', (255, 255, 255)), ('cream', (245, 236, 214))]
UPLOAD_STEPS = """How to upload your avatar

1. Lead Mentor 1 or 2 logs in at ftc-scoring.firstinspires.org with their FIRST account.
2. Choose Team Avatar on the left, then Upload New Avatar.
3. Pick one PNG (with background or transparent), check the preview and upload.
4. Upload at least 2 weeks before your event. Changes can take up to 24 hours to appear.
5. One submission at a time, and FIRST may not review more than three a season.
6. Only use artwork your team owns.

More: https://community.firstinspires.org/team-avatars
"""


class UserError(Exception):
    def __init__(self, status, message): super().__init__(message); self.status = status


def slug(name):
    s = unicodedata.normalize('NFKD', name or '').encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')[:40] or 'team'

_teams = {}   # team number -> (time, name, avatar): a team often uploads several logos in a row

def team_info(n):
    """Name and current FIRST avatar from FTCScout; (None, None) when it can't be reached."""
    hit = _teams.get(n)
    if hit and time.time() - hit[0] < 600: return hit[1], hit[2]
    try:
        with urllib.request.urlopen(f'{API}/teams/{n}/card', timeout=4) as r:
            t = (json.load(r).get('data') or {}).get('teamByNumber') or {}
    except Exception:
        return None, None
    av = t.get('avatar')
    if av and not av.startswith(('data:', 'http')): av = 'data:image/png;base64,' + av
    if len(_teams) > 1000: _teams.clear()
    _teams[n] = (time.time(), t.get('name'), av)
    return t.get('name'), av

def read_logo(raw):
    try:
        im = Image.open(io.BytesIO(raw))
        if im.format == 'JPEG': im.draft('RGB', (1024, 1024))      # decode big photos at 1/2, 1/4 or 1/8 size
        if im.width * im.height > MAX_PIXELS: raise Image.DecompressionBombError()
        im.seek(0); im.load()
    except (Image.DecompressionBombError, Image.DecompressionBombWarning): raise UserError(413, 'This image is too large. Upload one under 25 megapixels.')
    except Exception: raise UserError(415, "This file couldn't be read. Upload a PNG, JPEG, WebP or GIF.")
    im = ImageOps.exif_transpose(im).convert('RGBA')
    if min(im.size) < 16: raise UserError(400, 'This image is too small; upload a larger logo.')
    if max(im.size) > WORK_SIDE: im.thumbnail((WORK_SIDE, WORK_SIDE), Image.LANCZOS)
    return im

def png(img, mode):
    b = io.BytesIO(); (c.clean(img) if mode == 'RGBA' else img.convert('RGB')).save(b, 'PNG', optimize=True); return b.getvalue()

def edge_band(art40):
    a = np.asarray(art40).astype(float); al = a[..., 3] > 127
    return a[al & ~ndimage.binary_erosion(al, iterations=2)][:, :3]

def similar_share(px, bg):
    """Share of the subject's edge pixels close to a background colour: lower = more contrast."""
    return 1.0 if len(px) == 0 else float((np.sqrt(((px - np.array(bg, float)) ** 2).sum(-1)) < 70).mean())

def flat_background(logo, bg, tol=40):
    a = np.asarray(logo).astype(float); e = np.concatenate([a[:3].reshape(-1, 4), a[-3:].reshape(-1, 4), a[:, :3].reshape(-1, 4), a[:, -3:].reshape(-1, 4)])
    return float((np.sqrt(((e[:, :3] - np.array(bg)) ** 2).sum(-1)) < tol).mean()) >= 0.6

def checks(op, tr, op_png, tr_png, content):
    """Warnings for one option (FIRST's rules and the design rules)."""
    w = []
    for nm, data in (('opaque', op_png), ('transparent', tr_png)):
        if len(data) > 20000: w.append(f'The {nm} PNG is {len(data)} bytes; FIRST allows 20 kB.')
    lime, mag = c.chroma_pixels(np.asarray(op.convert('RGB')))
    if lime or mag: w.append(f'{lime + mag} pixels are close to lime or magenta, which video overlays can key out.')
    al = np.asarray(content)[..., 3] > 127
    if al.any():
        ys, xs = np.nonzero(al); bw, bh = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
        margins = [xs.min(), ys.min(), 39 - xs.max(), 39 - ys.max()]
        if max(bw, bh) < 34: w.append(f'The logo only uses {bw} x {bh} px of 40 x 40.')
        elif max(margins) >= 5: w.append(f"There's an empty band of {max(margins)} px on the {['left', 'top', 'right', 'bottom'][int(np.argmax(margins))]}.")
    return w

def build_options(logo, name, number):
    """Up to 8 options from one logo, each {id, label, opaque, transparent, ...}, and whether its background was flat."""
    had_alpha = np.asarray(logo)[..., 3].min() < 250
    bg0 = None if had_alpha else c.border_colour_of(np.asarray(logo).astype(float))
    flat = had_alpha or flat_background(logo, bg0)
    cut = c.cut_bg(logo, bg0) if flat else None                             # one full cut-out ...
    main_cut = c.cut_bg(cut, None, main=True) if flat else None             # ... and the main part from it
    art, main = (c.trim(cut), c.trim(main_cut)) if flat else (None, None)
    if had_alpha:   # an already transparent logo has no colour of its own: use the one with the most contrast
        px0 = edge_band(c.fit(art, area=(1, 1, 39, 39)))
        bg0 = min(TRY_BGS, key=lambda t: similar_share(px0, t[1]))[1]
    big = lambda a, area=(1, 1, 39, 39): c.fit(a, area=tuple(v * c.S for v in area), size=c.N)
    down = lambda im: im.resize((40, 40), Image.LANCZOS)
    opts = []

    def add(oid, label, lay, bg, border=None, note=''):
        """lay: 320 x 320 RGBA layer; opaque = lay on bg; transparent = lay with a thin border."""
        op = c.on(bg, down(lay)).convert('RGB')
        tr = c.add_border(lay, bg if border is None else border, 1.1) if border != 'none' else c.clean(down(lay))
        opts.append(dict(id=oid, label=label, note=note, bg='#%02x%02x%02x' % tuple(bg), _op=op, _tr=tr, _content=down(lay)))

    # 1. the whole logo on its own background
    if art is not None and had_alpha:
        add('whole', 'Whole logo on ' + next(nm for nm, rgb in TRY_BGS if rgb == bg0), big(art), bg0, note='Your logo was already transparent; shown on the colour with the most contrast')
    elif art is not None:
        add('whole', 'Whole logo', big(art), bg0, note='Background removed in the transparent version, kept as a thin border')
    else:
        lay = c.fit(logo, area=(0, 0, c.N, c.N), size=c.N)
        op = c.on(bg0, down(lay)).convert('RGB'); tr = op.convert('RGBA'); tr.putalpha(c.mask('rounded'))
        opts.append(dict(id='whole', label='Whole logo', note='The logo has no flat background, so it is kept as it is', bg='#%02x%02x%02x' % bg0, _op=op, _tr=tr, _content=c.on(bg0, down(lay))))
    if art is None:
        return opts, False
    # 2-3. the cut-out on the two best-contrast colours
    px = edge_band(c.fit(art, area=(1, 1, 39, 39)))
    ranked = sorted([(similar_share(px, rgb), i, nm, rgb) for i, (nm, rgb) in enumerate(TRY_BGS)])
    pool = [(nm, rgb, s) for s, _, nm, rgb in ranked if tuple(rgb) != tuple(bg0)]   # `whole` already shows bg0
    best = [(nm, rgb, s) for nm, rgb, s in pool if s < 0.35][:2] or pool[:1]
    for nm, rgb, s in best:
        add(f'on-{nm}', f'On {nm}', big(art), rgb, note='Good contrast' if s < 0.15 else 'Fair contrast')
    top_nm, top_rgb = ranked[0][2], ranked[0][3]                                    # the most contrast of all
    # 4. main part only (drops a separate name line)
    A = (np.asarray(cut)[..., 3] > 127).sum(); M = (np.asarray(main_cut)[..., 3] > 127).sum()
    if A and (A - M) / A >= 0.03:
        add('main', f'Main part on {top_nm}', big(main), top_rgb, note='Separate text left out')
    # 5. top part, cut at the bottom (tall mascots, heads)
    if main.height >= 1.15 * main.width:
        part = main.crop((0, 0, main.width, int(main.width * 39 / 38)))      # the top square: fills 38 x 39 px
        sc = min(38 * c.S / part.width, 39 * c.S / part.height)
        hh = part.resize((max(1, int(part.width * sc)), max(1, int(part.height * sc))), Image.LANCZOS)
        lay = Image.new('RGBA', (c.N, c.N), (0, 0, 0, 0)); lay.alpha_composite(hh, ((c.N - hh.width) // 2, c.N - hh.height))
        add('top', f'Top part on {top_nm}', lay, top_rgb, note='Cut off at the bottom edge')
    # 6. a coin with a complete ring, for round badges
    m = np.asarray(art)[..., 3] > 127; h, w = m.shape
    if abs(h - w) / max(h, w) < 0.08 and m.sum() / (np.pi * (max(h, w) / 2) ** 2) > 0.8:
        r = max(h, w) / 2; rw = round(1.1 * c.S); d = c.N - 2 * rw - 4
        crop = art.crop((int(w / 2 - r * 0.92), int(h / 2 - r * 0.92), int(w / 2 + r * 0.92), int(h / 2 + r * 0.92))).resize((d, d), Image.LANCZOS)
        disc = Image.new('L', (d, d), 0); from PIL import ImageDraw, ImageFilter
        ImageDraw.Draw(disc).ellipse([0, 0, d - 1, d - 1], fill=255)
        full = Image.new('L', (c.N, c.N), 0); full.paste(disc, ((c.N - d) // 2, (c.N - d) // 2))
        lay = Image.new('RGBA', (c.N, c.N), (0, 0, 0, 0)); ring = (18, 18, 22)
        lay.paste(ring + (255,), (0, 0), full.filter(ImageFilter.MaxFilter(rw * 2 + 1)))
        inner = Image.new('RGBA', (c.N, c.N), (0, 0, 0, 0)); inner.paste(bg0 + (255,), (0, 0), full); lay.alpha_composite(inner)
        coin = Image.new('RGBA', (d, d), (0, 0, 0, 0)); coin.paste(crop, (0, 0), Image.fromarray(np.minimum(np.asarray(disc), np.asarray(crop.getchannel('A')))))
        lay.alpha_composite(coin, ((c.N - d) // 2, (c.N - d) // 2))
        add('coin', 'Coin with a full ring', lay, ring, border='none', note='Zoomed in a little, ring kept inside the square')
    # 7. crisp colours (photo-like or soft artwork)
    small = c.fit(main, area=(1, 1, 39, 39)); cols = len(np.unique(np.asarray(small)[np.asarray(small)[..., 3] > 127][:, :3], axis=0))
    if cols >= 40:
        crisp = ImageEnhance.Color(ImageEnhance.Contrast(main.convert('RGB')).enhance(1.25)).enhance(1.25).convert('RGBA'); crisp.putalpha(main.getchannel('A'))
        lay = big(crisp); q = lay.convert('RGB').quantize(14, method=Image.Quantize.MEDIANCUT).convert('RGBA'); q.putalpha(lay.getchannel('A'))
        add('crisp', f'Crisp colours on {top_nm}', q, top_rgb, note='More contrast, 14 colours')
    # drop near-duplicates
    out = []
    for o in opts:
        if all(np.abs(np.asarray(o['_op']).astype(int) - np.asarray(p['_op']).astype(int)).mean() > 2 for p in out): out.append(o)
    return out[:8], True

def make_answer(number, raw):
    name, current = team_info(number)
    logo = read_logo(raw)
    opts, flat = build_options(logo, name, number)
    base = f"{number}-{slug(name)}" if name else str(number)
    zbuf = io.BytesIO()
    with tempfile.TemporaryDirectory() as tmp, zipfile.ZipFile(zbuf, 'w', zipfile.ZIP_DEFLATED) as zf:
        rows = []
        for o in opts:
            op_png, tr_png = png(o['_op'], 'RGB'), png(o['_tr'], 'RGBA')
            o.update(opaque='data:image/png;base64,' + base64.b64encode(op_png).decode(),
                     transparent='data:image/png;base64,' + base64.b64encode(tr_png).decode(),
                     bytes=[len(op_png), len(tr_png)], warnings=checks(o['_op'], o['_tr'], op_png, tr_png, o['_content']),
                     files=[f"{base}-{o['id']}-avatar-40.png", f"{base}-{o['id']}-avatar-40-transparent.png"])
            for fn, data in zip(o['files'], (op_png, tr_png)):
                zf.writestr(fn, data); open(os.path.join(tmp, fn), 'wb').write(data)
            rows.append((o['label'], os.path.join(tmp, o['files'][0]), os.path.join(tmp, o['files'][1])))
        lg = logo.copy(); lg.thumbnail((512, 512)); lp = os.path.join(tmp, 'logo.png'); lg.save(lp)
        sheet = c.compare_sheet(rows, os.path.join(tmp, 'sheet.png'), f"{name or 'Team'} ({number}) avatar options", lp)
        zf.write(sheet, f'{base}-options.png'); zf.writestr('HOW-TO-UPLOAD.txt', UPLOAD_STEPS)
    for o in opts:
        for k in ('_op', '_tr', '_content'): o.pop(k)
    return {'team': number, 'name': name, 'current': current, 'base': base, 'flat': flat, 'options': opts,
            'zip': 'data:application/zip;base64,' + base64.b64encode(zbuf.getvalue()).decode()}


class Handler(BaseHTTPRequestHandler):
    server_version = 'ftc-avatars/1'
    def log_message(self, fmt, *args):                      # one line per request: no images, no IP addresses
        sys.stderr.write('%s %s%s\n' % (time.strftime('%Y-%m-%dT%H:%M:%S'), fmt % args, getattr(self, 'note', '')))

    def send(self, status, body, ctype='application/json'):
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(status); self.send_header('Content-Type', ctype); self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store'); self.send_header('X-Content-Type-Options', 'nosniff'); self.end_headers(); self.wfile.write(data)

    def client(self):
        return (self.headers.get(IP_HEADER) or self.client_address[0]).split(',')[0].strip()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/api/avatar/health': return self.send(200, {'ok': True})
        if os.environ.get('DEV_PAGE') and path in ('/', '/avatar', '/avatar-upload'):
            return self.send(200, open(os.environ['DEV_PAGE'], 'rb').read(), 'text/html; charset=utf-8')
        self.send(404, {'error': 'Not found'})

    def do_POST(self):
        u = urlparse(self.path)
        if u.path != '/api/avatar/options': return self.send(404, {'error': 'Not found'})
        try:
            team = (parse_qs(u.query).get('team') or [''])[0].strip()
            if not re.fullmatch(r'\d{1,6}', team): raise UserError(400, 'Enter your team number.')
            size = int(self.headers.get('Content-Length') or 0)
            if size <= 0: raise UserError(400, 'Choose your logo file first.')
            if size > MAX_BYTES: raise UserError(413, 'The file is larger than 10 MB.')
            now = time.time()
            with _lock:
                q = _hits[self.client()]
                while q and q[0] < now - WINDOW: q.popleft()
                if len(q) >= RATE: raise UserError(429, 'Too many uploads. Try again in a few minutes.')
                q.append(now)
            self.connection.settimeout(20); raw = self.rfile.read(size)
            if not JOBS.acquire(timeout=20): raise UserError(503, 'The server is busy. Try again in a minute.')
            try:
                t0 = time.time(); answer = make_answer(int(team), raw); answer['ms'] = int((time.time() - t0) * 1000)
                self.note = f" {','.join(o['id'] for o in answer['options'])} {answer['ms']} ms" + ('' if answer['flat'] else ' no-flat')
            finally:
                JOBS.release()
            self.send(200, answer)
        except UserError as e:
            self.send(e.status, {'error': str(e)})
        except Exception as e:                               # never leak details to the visitor
            sys.stderr.write(f'error: {e!r}\n'); self.send(500, {'error': 'Something went wrong making the options.'})


if __name__ == '__main__':
    print(f'avatar service on :{PORT}', flush=True)
    ThreadingHTTPServer(('0.0.0.0', PORT), Handler).serve_forever()
