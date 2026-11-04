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
import base64, http.client, io, json, os, sys, time, urllib.error, urllib.parse, urllib.request, zipfile
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
        if Image.open(io.BytesIO(op)).mode not in ('RGB', 'P', 'L'): problems.append(f"{o['id']} opaque has alpha")
        al = np.asarray(Image.open(io.BytesIO(tr)).convert('RGBA'))[..., 3]; half = int(((al > 0) & (al < 255)).sum())
        if half: problems.append(f"{o['id']} transparent has {half} half-transparent pixels")
        a = np.asarray(Image.open(io.BytesIO(tr)).convert('RGBA'))
        if a[a[..., 3] == 0][:, :3].any(): problems.append(f"{o['id']} transparent: colour hidden under transparent pixels")
    names = zipfile.ZipFile(io.BytesIO(decode(d['zip']))).namelist()
    listed = {f for o in d['options'] for f in o['files']}
    if not listed <= set(names) or 'HOW-TO-UPLOAD.txt' not in names: problems.append(f'zip: {names}')
    check(not problems and d['options'], f"{name}: {len(d['options'])} options ({', '.join(o['id'] for o in d['options'])}) in {dt:.2f} s {problems}")
if times:
    check(max(times) < 10, f'slowest logo {max(times):.2f} s, median {sorted(times)[len(times) // 2]:.2f} s')

# --- errors -----------------------------------------------------------------------------------
small = png_bytes(Image.new('RGB', (64, 64), (0, 98, 110)))
check(post('', small)[0] == 400, 'no team number: 400')
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
