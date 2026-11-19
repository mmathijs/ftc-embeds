#!/usr/bin/env python3
"""API test of the avatar options service. Standard library and Pillow only.

    RATE=5 python3 service.py &                                         (from avatar/service)
    python3 tests/test_service.py http://127.0.0.1:8080 tests/logos [--rate 5]

For every logo in the folder it checks FIRST's file rules on every option (40 x 40 PNG, at most
20 kB, opaque without alpha, no colour hidden under transparent pixels), the zip, and the time
taken. Then the errors: no team, an empty body, too large, not an image, too small, a
decompression bomb; the lime and empty-band notes on two made-up logos; and (with --rate N,
matching the service's RATE) the rate limit. Against the live site, without --rate, every upload
counts for one visitor: 5 of these checks count, so use at most 5 logos with RATE=10.
"""
import base64, hashlib, http.client, io, json, os, sys, time, urllib.error, urllib.parse, urllib.request, zipfile
import numpy as np
from PIL import Image, ImageDraw

args = sys.argv[1:]
rate = None
if '--rate' in args:
    i = args.index('--rate'); rate = int(args[i + 1]); del args[i:i + 2]
base, folder = args[0].rstrip('/'), args[1]
failures, visitor = [], [0]

def post(query, body, ip=None):
    """POST to /api/avatar/options; returns (status, parsed JSON). Each call is a new visitor."""
    visitor[0] += 1
    req = urllib.request.Request(f'{base}/api/avatar/options{query}', data=body, method='POST',
                                 headers={'Content-Type': 'application/octet-stream', 'X-Client-IP': ip or f'10.0.0.{visitor[0] % 250}'})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b'{}')

def post_raw(query, body):
    """POST and return (status, content type, content disposition, body bytes)."""
    visitor[0] += 1
    req = urllib.request.Request(f'{base}/api/avatar/options{query}', data=body, method='POST',
                                 headers={'Content-Type': 'application/octet-stream', 'X-Client-IP': f'10.0.1.{visitor[0] % 250}'})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return r.status, r.headers.get('Content-Type'), r.headers.get('Content-Disposition') or '', r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get('Content-Type'), '', e.read()

def post_to(path, body, ip=None):
    """POST to another path of the service; returns (status, parsed JSON)."""
    visitor[0] += 1
    req = urllib.request.Request(f'{base}{path}', data=body, method='POST', headers={'Content-Type': 'image/png', 'X-Client-IP': ip or f'10.0.2.{visitor[0] % 250}'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r: return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b'{}')

def pixel_sha(data):
    a = np.asarray(Image.open(io.BytesIO(data)).convert('RGBA')).copy(); a[a[..., 3] == 0] = 0
    return hashlib.sha256(a.tobytes()).hexdigest()

def check(cond, what):
    print(('ok   ' if cond else 'FAIL ') + what)
    if not cond: failures.append(what)

def decode(uri):
    return base64.b64decode(uri.split(',', 1)[1])

def png_bytes(im):
    b = io.BytesIO(); im.save(b, 'PNG'); return b.getvalue()

# --- every logo -------------------------------------------------------------------------------
logos = sorted(f for f in os.listdir(folder) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.gif')))
times = []
for name in logos:
    t0 = time.time(); status, d = post('?team=23452', open(os.path.join(folder, name), 'rb').read()); dt = time.time() - t0
    times.append(dt)
    if status != 200:
        check(False, f'{name}: status {status} {d}'); continue
    problems = []
    for o in d['options']:
        op, tr = decode(o['opaque']), decode(o['transparent'])
        for kind, data in (('opaque', op), ('transparent', tr)):
            im = Image.open(io.BytesIO(data))
            if im.format != 'PNG' or im.size != (40, 40) or getattr(im, 'is_animated', False): problems.append(f"{o['id']} {kind}: {im.format} {im.size}")
            if len(data) > 20000: problems.append(f"{o['id']} {kind}: {len(data)} bytes")
        if o['sha256'] != [hashlib.sha256(op).hexdigest(), hashlib.sha256(tr).hexdigest()]: problems.append(f"{o['id']}: sha256 doesn't match the PNGs")
        if o['pixelSha256'] != [pixel_sha(op), pixel_sha(tr)]: problems.append(f"{o['id']}: pixelSha256 doesn't match the pixels")
        if Image.open(io.BytesIO(op)).mode not in ('RGB', 'P', 'L'): problems.append(f"{o['id']} opaque has alpha")
        al = np.asarray(Image.open(io.BytesIO(tr)).convert('RGBA'))[..., 3].astype(int); P = np.pad(al, 1)
        inside = (P[1:-1, :-2] >= 128) & (P[1:-1, 2:] >= 128) & (P[:-2, 1:-1] >= 128) & (P[2:, 1:-1] >= 128)
        half = int(((al > 0) & (al < 255) & inside).sum()); faint = int(((al > 0) & (al < 31)).sum())
        if half or faint: problems.append(f"{o['id']} transparent has {half} half-transparent pixels inside and {faint} faint specks")
        a = np.asarray(Image.open(io.BytesIO(tr)).convert('RGBA'))
        if a[a[..., 3] == 0][:, :3].any(): problems.append(f"{o['id']} transparent: colour hidden under transparent pixels")
    names = zipfile.ZipFile(io.BytesIO(decode(d['zip']))).namelist()
    listed = {f for o in d['options'] for f in o['files']}
    if not listed <= set(names) or 'HOW-TO-UPLOAD.txt' not in names: problems.append(f'zip: {names}')
    if d['current'] and not (d['current'].startswith('data:image/') and d['currentSha256'] == hashlib.sha256(decode(d['current'])).hexdigest() and d['currentPixelSha256'] == pixel_sha(decode(d['current']))):
        problems.append('the current avatar: not an image with its hashes')
    check(not problems and d['options'], f"{name}: {len(d['options'])} options ({', '.join(o['id'] for o in d['options'])}) in {dt:.2f} s {problems}")
if times:
    check(max(times) < 10, f'slowest logo {max(times):.2f} s, median {sorted(times)[len(times) // 2]:.2f} s')

# --- errors -----------------------------------------------------------------------------------
small = png_bytes(Image.new('RGB', (64, 64), (0, 98, 110)))
dot = Image.new('RGB', (300, 300), (255, 255, 255)); ImageDraw.Draw(dot).ellipse([60, 60, 240, 240], fill=(200, 30, 40))
status, d = post('', png_bytes(dot))
check(status == 200 and d['team'] is None and d['name'] is None and d['current'] is None and d['base'] == 'avatar'
      and all(f.startswith('avatar-') for o in d['options'] for f in o['files']), 'no team number: still the options, with files named avatar-…')
status, ctype, disp, body = post_raw('?format=zip', png_bytes(dot))
check(status == 200 and ctype == 'application/zip' and 'avatar-avatars.zip' in disp and 'HOW-TO-UPLOAD.txt' in zipfile.ZipFile(io.BytesIO(body)).namelist(),
      'format=zip: the zip itself, as a download')
status, d = post('?images=none', png_bytes(dot))
check(status == 200 and 'zip' not in d and 'current' not in d and d['hasCurrent'] is False and d['options']
      and all('opaque' not in o and 'transparent' not in o and len(o['sha256']) == 2 and o['files'] for o in d['options']) and len(json.dumps(d)) < 20000,
      f"images=none: no images, sha256 and file names kept ({len(json.dumps(d))} bytes)")
check(post('?format=xml', small)[0] == 400 and post('?images=some', small)[0] == 400, 'unknown format or images: 400')
check(post('?format=zip&layers=only', small)[0] == 400, 'format=zip with layers=only: 400')
# --- /check: a finished avatar's rules, notes and hashes ------------------------------------------
status, d = post('', png_bytes(dot))
good = decode(d['options'][0]['transparent'])
status, k = post_to('/api/avatar/check', good)
check(status == 200 and k['followsFirstRules'] and k['width'] == 40 and k['sha256'] == hashlib.sha256(good).hexdigest() and k['pixelSha256'] == d['options'][0]['pixelSha256'][1],
      f"check: an option follows the rules, same hashes as the options answer {k.get('notes')}")
again = io.BytesIO(); im = Image.open(io.BytesIO(good)); info = __import__('PIL.PngImagePlugin', fromlist=['PngInfo']).PngInfo(); info.add_text('Software', 'another editor')
im.convert('RGBA').save(again, 'PNG', pnginfo=info, compress_level=1); again = again.getvalue()
status, k2 = post_to('/api/avatar/check', again)
check(k2['sha256'] != k['sha256'] and k2['pixelSha256'] == k['pixelSha256'], 'check: saved again by another program, a new sha256 and the same pixelSha256')
wide = Image.new('RGBA', (41, 40), (0, 98, 110, 255)); ImageDraw.Draw(wide).rectangle([5, 5, 35, 35], fill=(0, 255, 0, 255))
status, k3 = post_to('/api/avatar/check', png_bytes(wide))
check(status == 200 and not k3['firstRules']['size40'] and not k3['firstRules']['noLimeOrMagenta'] and not k3['followsFirstRules'], f"check: 41 x 40 with lime: {k3['notes']}")
hid = Image.new('RGBA', (40, 40), (0, 0, 0, 0)); ImageDraw.Draw(hid).rectangle([0, 0, 39, 39], fill=(22, 38, 74, 255)); hid.putpixel((0, 0), (0, 255, 0, 0))
status, k4 = post_to('/api/avatar/check', png_bytes(hid))
check(any('1 fully transparent pixel still has a colour (1 lime or magenta)' in n for n in k4['notes']) and k4['firstRules']['noLimeOrMagenta'], f"check: a hidden lime pixel is noted {k4['notes']}")
check(post_to('/api/avatar/check', b'not an image')[0] == 415 and post_to('/api/avatar/check', b'')[0] == 400, 'check: not an image 415, empty 400')
check(post('?team=abc', small)[0] == 400, 'team number that is not a number: 400')
check(post('?team=1', b'')[0] == 400, 'empty body: 400')
def announce_big():
    """Only the headers of an 11 MB upload: the service must answer 413 without reading the body."""
    u = urllib.parse.urlparse(base)
    conn = (http.client.HTTPSConnection if u.scheme == 'https' else http.client.HTTPConnection)(u.hostname, u.port, timeout=10)
    conn.putrequest('POST', '/api/avatar/options?team=1'); conn.putheader('Content-Length', str(11 * 1024 * 1024))
    conn.putheader('X-Client-IP', '10.9.9.9'); conn.endheaders()
    return conn.getresponse().status
check(announce_big() == 413, 'body over 10 MB: 413 before it is sent')
check(post('?team=1', b'this is not an image')[0] == 415, 'not an image: 415')
check(post('?team=1', png_bytes(Image.new('RGB', (12, 12))))[0] == 400, 'image under 16 px: 400')
bomb = png_bytes(Image.new('1', (8000, 8000)))           # 64 megapixels in a few kB
check(post('?team=1', bomb)[0] == 413, f'decompression bomb ({len(bomb)} bytes, 8000 x 8000): 413')
# --- the notes: a made-up logo with lime pixels, and a wide banner --------------------------------
lime = Image.new('RGB', (400, 400), (255, 255, 255)); ImageDraw.Draw(lime).rectangle([100, 100, 300, 300], fill=(0, 255, 0))
status, d = post('?team=1', png_bytes(lime))
check(status == 200 and d['options'] and all(any('lime or magenta' in w for w in o['warnings']) for o in d['options']),
      'a lime square: every option notes the lime pixels')
banner = Image.new('RGB', (800, 200), (255, 255, 255)); ImageDraw.Draw(banner).rectangle([20, 20, 780, 180], fill=(22, 38, 74))
status, d = post('?team=1', png_bytes(banner))
check(status == 200 and d['options'] and all(any('empty band' in w for w in o['warnings']) for o in d['options']),
      'a wide banner: every option notes the empty band')
if rate:
    codes = [post('?team=1', small, ip='192.0.2.77')[0] for _ in range(rate + 1)]
    check(codes[-1] == 429 and 429 not in codes[:-1], f'rate limit after {rate} uploads from one visitor: {codes}')
    check(post('?team=1', small, ip='192.0.2.78')[0] == 200, 'another visitor is not limited')

print(f'\n{len(failures)} failed' if failures else '\nall passed')
sys.exit(1 if failures else 0)
