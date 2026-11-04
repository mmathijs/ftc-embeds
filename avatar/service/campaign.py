#!/usr/bin/env python3
"""FTC avatar campaign toolkit: build, check, review, package and announce 40x40 FIRST avatars
for many teams at once. Run it from the campaign folder:

  teams.json                      the teams (see SKILL.md for the fields)
  src/<n>.png                     source logos
  out/<n>-<slug>-avatar-40.png    avatars (+ -avatar-40-transparent.png)
  existing/<n>.png                current FIRST avatars of teams that already have one
  final/                          sheets, overview images, zips, pages

Needs Python 3 with Pillow, numpy and scipy.  `python3 campaign.py -h` lists the commands.
"""
import argparse, base64, glob, html as htmlmod, io, json, os, re, sys, zipfile
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
S = 8                      # supersampling factor: draw at 320 x 320, reduce to 40 x 40 once
N = 40 * S
COLOURS = {'teal': (0, 98, 110), 'navy': (22, 38, 74), 'black': (18, 18, 22), 'white': (255, 255, 255),
           'cream': (245, 236, 214), 'orange': (226, 150, 26), 'grey': (128, 128, 128)}
# FIRST's display backgrounds (community.firstinspires.org/team-avatars) plus a dark page
FIRST_BG = [('White', (255, 255, 255)), ('Red', (237, 28, 36)), ('Blue', (0, 102, 179)),
            ('Award', (0, 131, 174)), ('Dark', (28, 27, 25))]
PAPER, INK, MUTED, ACCENT, LINE = (238, 240, 243), (22, 26, 34), (91, 99, 114), (217, 72, 15), (211, 215, 223)


# ---------- small helpers ----------

def colour(s):
    """'teal', '00626e', '#00626e' or '0,98,110' -> (r, g, b)."""
    if isinstance(s, (list, tuple)): return tuple(int(v) for v in s[:3])
    s = str(s).strip().lower()
    if s in COLOURS: return COLOURS[s]
    if ',' in s: return tuple(int(v) for v in s.split(',')[:3])
    s = s.lstrip('#'); return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))

def font(size, bold=False, mono=False):
    names = (['DejaVuSansMono-Bold.ttf'] if mono else []) + (['DejaVuSans-Bold.ttf'] if bold else ['DejaVuSans.ttf'])
    for d in ['/usr/share/fonts/truetype/dejavu/', '/usr/share/fonts/dejavu/', '/Library/Fonts/', '']:
        for n in names:
            if os.path.exists(d + n): return ImageFont.truetype(d + n, size)
    return ImageFont.load_default()

def load(p): return Image.open(p).convert('RGBA')

def teams():
    if not os.path.exists('teams.json'): sys.exit('teams.json not found (run from the campaign folder)')
    return json.load(open('teams.json'))

def avatar_files(n, root='out'):
    """(opaque, transparent) paths of team n, or (None, None)."""
    ops = [p for p in glob.glob(f'{root}/{n}-*-avatar-40.png')]
    if not ops: return None, None
    op = sorted(ops, key=len)[0]
    tr = op.replace('-avatar-40.png', '-avatar-40-transparent.png')
    return op, (tr if os.path.exists(tr) else None)

def base_name(n, root='out'):
    op, _ = avatar_files(n, root)
    return os.path.basename(op)[:-len('-avatar-40.png')] if op else None

def trim(img, min_alpha=8):
    bb = img.getchannel('A').point(lambda v: 255 if v > min_alpha else 0).getbbox()
    return img.crop(bb) if bb else img

def fit(img, area=(1, 1, 39, 39), size=40, align='center'):
    """Scale an RGBA image into `area` of a size x size canvas in one premultiplied Lanczos step
    (no dark fringes). align: center | top | bottom."""
    x0, y0, x1, y1 = area; aw, ah = x1 - x0, y1 - y0
    s = min(aw / img.width, ah / img.height); w, h = img.width * s, img.height * s
    ox = x0 + (aw - w) / 2
    oy = y0 + (ah - h) / 2 if align == 'center' else (y0 if align == 'top' else y1 - h)
    pad = 4 * max(img.size)
    big = Image.new('RGBa', (img.width + 2 * pad, img.height + 2 * pad), (0, 0, 0, 0))
    big.paste(img.convert('RGBa'), (pad, pad))
    bx, by = pad - ox / s, pad - oy / s
    return big.resize((size, size), Image.LANCZOS, box=(bx, by, bx + size / s, by + size / s)).convert('RGBA')

def mask(kind, size=40, r=4.0, inset=0.0):
    """Anti-aliased 'disc' or 'rounded' mask, supersampled."""
    m = Image.new('L', (size * S, size * S), 0); d = ImageDraw.Draw(m); a = inset * S; b = size * S - 1 - inset * S
    if kind == 'disc': d.ellipse([a, a, b, b], fill=255)
    else: d.rounded_rectangle([a, a, b, b], radius=r * S, fill=255)
    return m.resize((size, size), Image.LANCZOS)

def on(bg, layer):
    base = Image.new('RGBA', layer.size, tuple(bg) + (255,)); base.alpha_composite(layer); return base

def border_colour_of(a):
    """Median colour of the outer 3 px of an RGB(A) array."""
    e = np.concatenate([a[:3].reshape(-1, a.shape[2]), a[-3:].reshape(-1, a.shape[2]),
                        a[:, :3].reshape(-1, a.shape[2]), a[:, -3:].reshape(-1, a.shape[2])])
    return tuple(int(v) for v in np.median(e[:, :3], 0))

def cut_bg(img, bg=None, tol=40, mode='edge', main=False):
    """Remove a flat background. mode 'edge' removes only background connected to the image border
    (white eyes stay); 'all' also removes enclosed holes (inside letters). Edge pixels are un-blended
    from the background colour, so no halo is left. main=True keeps only the largest part and parts
    overlapping its box (drops a separate name line)."""
    a = np.asarray(img.convert('RGBA')).astype(float)
    if a[..., 3].min() < 250 and bg is None:          # already transparent
        out = img.convert('RGBA')
    else:
        B = np.array(colour(bg) if bg is not None else border_colour_of(a), float)
        d = np.sqrt(((a[..., :3] - B) ** 2).sum(-1))
        near = d < tol
        if mode == 'edge':
            lab, _ = ndimage.label(near)
            edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
            bgm = np.isin(lab, list(edge))
        else: bgm = near
        bgm = ndimage.binary_closing(bgm, iterations=1) | bgm
        band = ndimage.binary_dilation(bgm, iterations=2) & ~bgm
        # colour-to-alpha against B, inside the 2 px band only
        c = a[..., :3] / 255; b = B / 255
        ak = np.where(c > b, (c - b) / np.maximum(1 - b, 1e-6), np.where(c < b, (b - c) / np.maximum(b, 1e-6), 0))
        ac = np.clip(ak.max(-1), 0, 1)
        un = np.where(ac[..., None] > 1e-3, (c - b) / np.maximum(ac[..., None], 1e-3) + b, c)
        alpha = a[..., 3] / 255
        alpha = np.where(bgm, 0, np.where(band, np.minimum(alpha, ac), alpha))
        rgb = np.where(band[..., None], np.clip(un, 0, 1), c) * 255
        out = Image.fromarray(np.dstack([rgb, alpha * 255]).astype(np.uint8), 'RGBA')
    if main:
        # Group parts whose boxes (grown by 2%) overlap, keep the group with the biggest box: a mascot
        # with its outline and inner details stays together, a separate name line under it goes.
        A = np.asarray(out)[..., 3] > 127
        lab, n = ndimage.label(A, structure=np.ones((3, 3)))
        if n > 1:
            sl = ndimage.find_objects(lab); g = int(0.02 * max(A.shape)); parent = list(range(n))
            def root(i):
                while parent[i] != i: parent[i] = parent[parent[i]]; i = parent[i]
                return i
            bx = [(s[0].start - g, s[0].stop + g, s[1].start - g, s[1].stop + g) for s in sl]
            for i in range(n):
                for j in range(i + 1, n):
                    p, q = bx[i], bx[j]
                    if p[0] < q[1] and q[0] < p[1] and p[2] < q[3] and q[2] < p[3]: parent[root(i)] = root(j)
            groups = {}
            for i in range(n): groups.setdefault(root(i), []).append(i)
            box = lambda ids: (max(sl[i][0].stop for i in ids) - min(sl[i][0].start for i in ids)) * (max(sl[i][1].stop for i in ids) - min(sl[i][1].start for i in ids))
            best = max(groups.values(), key=box); keep = np.zeros(n + 1, bool); keep[[i + 1 for i in best]] = True
            arr = np.asarray(out).copy(); kept = keep[lab]
            arr[..., 3] = np.where(ndimage.binary_dilation(kept, iterations=2), arr[..., 3], 0)
            out = Image.fromarray(arr, 'RGBA')
    return out

def clean(img, floor=20):
    """Alpha below `floor` -> 0, and RGB 0 wherever alpha is 0 (no hidden lime/magenta)."""
    q = np.asarray(img.convert('RGBA')).copy(); q[q[..., 3] < floor] = 0
    return Image.fromarray(q, 'RGBA')

def add_border(layer, colour_=(0, 0, 0), width=1.1):
    """Thin outline around an RGBA layer (any size; drawn at 8x the 40 px scale). width in output px."""
    big = layer if layer.width == N else layer.resize((N, N), Image.LANCZOS)
    rad = int(round(width * S))
    out = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    if rad > 0:
        out.paste(tuple(colour_) + (255,), (0, 0), big.getchannel('A').filter(ImageFilter.MaxFilter(rad * 2 + 1)))
    out.alpha_composite(big)
    return clean(out.resize((40, 40), Image.LANCZOS))

def save_pair(prefix, op, tr):
    os.makedirs(os.path.dirname(prefix) or '.', exist_ok=True)
    op.convert('RGB').save(f'{prefix}-avatar-40.png', optimize=True)
    if tr is not None: clean(tr).save(f'{prefix}-avatar-40-transparent.png', optimize=True)
    return f'{prefix}-avatar-40.png'

def uri(img, fmt='PNG', **kw):
    b = io.BytesIO(); img.save(b, fmt, **kw); return f'data:image/{fmt.lower()};base64,' + base64.b64encode(b.getvalue()).decode()

def js(obj):
    """JSON that is safe inside a <script> element."""
    return json.dumps(obj).replace('</', '<\\/')

def checker(w, h, sq=8, a=(255, 255, 255), b=(214, 214, 214)):
    c = Image.new('RGB', (w, h), a); d = ImageDraw.Draw(c)
    for y in range(0, h, sq):
        for x in range(0, w, sq):
            if (x // sq + y // sq) % 2: d.rectangle([x, y, x + sq - 1, y + sq - 1], fill=b)
    return c


# ---------- building ----------

def cmd_make(a):
    """Batch build from a plan file: lines `<n> <slug> {json options}`."""
    for line in open(a.plan):
        if not line.strip() or line.lstrip().startswith('#'): continue
        n, slug, *rest = line.split(None, 2); o = json.loads(rest[0]) if rest else {}
        im = load(o.get('src', f'src/{n}.png'))
        if o.get('crop'): im = im.crop(tuple(o['crop']))
        had_alpha = np.asarray(im)[..., 3].min() < 250
        cut = o.get('trans', 'auto') != 'none' and (had_alpha or o.get('cut', True))
        bg = colour(o['bg']) if o.get('bg') else border_colour_of(np.asarray(im).astype(float))
        art = cut_bg(im, None if had_alpha else bg, o.get('tol', 40), o.get('mode', 'edge'), o.get('main', False)) if cut else im
        if had_alpha and not o.get('bg'): bg = colour(o.get('bgcolour', 'white'))
        art40 = fit(trim(art), area=tuple(o.get('area', (1, 1, 39, 39))), align=o.get('align', 'center'))
        op = on(bg, art40)
        t = o.get('trans', 'auto')
        if t == 'auto': t = 'border' if cut else 'rounded'
        if t == 'border': tr = add_border(fit(trim(art), area=tuple(v * S for v in o.get('area', (1, 1, 39, 39))), size=N, align=o.get('align', 'center')), bg, o.get('width', 1.1))
        elif t == 'art': tr = art40
        elif t == 'rounded': tr = op.copy(); tr.putalpha(mask('rounded'))
        elif t == 'circle': tr = op.copy(); tr.putalpha(mask('disc'))
        else: tr = None
        print(n, save_pair(f'out/{n}-{slug}', op, tr), 'bg', '#%02x%02x%02x' % bg, 'transparent:', t)

def cmd_border(a):
    """Rebuild transparent versions from the opaque ones: background cut away, kept as a thin border."""
    for n in a.teams:
        op, _ = avatar_files(n)
        if not op: print(n, 'no avatar in out/'); continue
        o = Image.open(op).convert('RGB'); bg = colour(a.bg) if a.bg else border_colour_of(np.asarray(o).astype(float))
        big = np.asarray(o.resize((N, N), Image.LANCZOS)).astype(float)
        d = np.sqrt(((big - np.array(bg)) ** 2).sum(-1)); near = d < a.tol
        if a.mode == 'edge':
            lab, _ = ndimage.label(near); edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
            bgm = np.isin(lab, list(edge))
        else: bgm = near
        alpha = ndimage.gaussian_filter(np.where(bgm, np.clip((d - a.tol * .55) / (a.tol * .45), 0, 1), 1.0), 0.6)
        layer = Image.fromarray(np.dstack([big, alpha * 255]).astype(np.uint8), 'RGBA')
        add_border(layer, bg, a.width).save(op.replace('-avatar-40.png', '-avatar-40-transparent.png'), optimize=True)
        print(n, 'border', '#%02x%02x%02x' % bg, 'width', a.width)

def cmd_cutout(a):
    """Cut a logo out of its flat background (full resolution RGBA)."""
    art = cut_bg(load(a.logo), a.bg, a.tol, a.mode, a.main); art = trim(art); art.save(a.out); print(a.out, art.size)

def cmd_variants(a):
    """The same cut-out on several background colours (e.g. teal, navy, black), plus one transparent."""
    art = trim(load(a.art)); area = tuple(float(v) for v in a.area.split(','))
    lay = fit(art, area=tuple(v * S for v in area), size=N)
    for name in a.bgs.split(','):
        save_pair(f'{a.out}-{name}', on(colour(name), lay).resize((40, 40), Image.LANCZOS), None)
    add_border(lay, colour(a.border_colour), a.width).save(f'{a.out}-avatar-40-transparent.png', optimize=True)
    print('wrote', a.out + '-{' + a.bgs + '}-avatar-40.png and', a.out + '-avatar-40-transparent.png')

def cmd_cutbottom(a):
    """Zoom on part of a cut-out (a head) and run the cut edge off the bottom: no gap under it."""
    art = load(a.art)
    if a.box: art = art.crop(tuple(int(v) for v in a.box.split(',')))
    al = np.asarray(art)[..., 3] > 20; ys, xs = np.nonzero(al)
    art = art.crop((xs.min(), ys.min(), xs.max() + 1, art.height))      # keep the cut (bottom) edge
    sc = min((40 - 2 * a.margin) * S / art.width, (40 - a.margin) * S / art.height)
    hh = art.resize((max(1, int(art.width * sc)), max(1, int(art.height * sc))), Image.LANCZOS)
    lay = Image.new('RGBA', (N, N), (0, 0, 0, 0)); lay.alpha_composite(hh, ((N - hh.width) // 2, N - hh.height))
    for name in a.bgs.split(','):
        save_pair(f'{a.out}-{name}', on(colour(name), lay).resize((40, 40), Image.LANCZOS), None)
    add_border(lay, colour(a.border_colour), a.width).save(f'{a.out}-avatar-40-transparent.png', optimize=True)
    top = (N - hh.height) / S
    print('top margin %.2f px, flush with the bottom' % top + ('  <- crop narrower (--box) to fill the height' if top > 3 else ''))

def find_circle(img, bg=None, tol=40):
    m = np.asarray(cut_bg(img, bg, tol, main=True))[..., 3] > 127
    ys, xs = np.nonzero(m)
    return (xs.min() + xs.max() + 1) / 2, (ys.min() + ys.max() + 1) / 2, max(xs.max() - xs.min(), ys.max() - ys.min()) / 2

def cmd_coin(a):
    """Round badge as a disc with a complete ring inside the square (zoom < 1 crops into the badge)."""
    src = load(a.logo)
    cx, cy, r = (a.cx, a.cy, a.r) if a.r else find_circle(src, a.bg)
    R = r * a.zoom; dy = r * a.shift
    crop = src.crop((int(cx - R), int(cy - R + dy), int(cx + R), int(cy + R + dy)))
    ring = int(a.ring * S); d = N - 2 * ring - 4
    c = crop.resize((d, d), Image.LANCZOS); m = Image.new('L', (d, d), 0); ImageDraw.Draw(m).ellipse([0, 0, d - 1, d - 1], fill=255)
    c.putalpha(Image.fromarray(np.minimum(np.asarray(m), np.asarray(c.getchannel('A')))))
    lay = Image.new('RGBA', (N, N), (0, 0, 0, 0)); lay.alpha_composite(c, ((N - d) // 2, (N - d) // 2))
    full = Image.new('L', (N, N), 0); ImageDraw.Draw(full).ellipse([(N - d) // 2, (N - d) // 2, (N + d) // 2 - 1, (N + d) // 2 - 1], fill=255)
    L = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    if ring: L.paste(colour(a.ring_colour) + (255,), (0, 0), full.filter(ImageFilter.MaxFilter(ring * 2 + 1)))
    inner = Image.new('RGBA', (N, N), (0, 0, 0, 0)); inner.paste(colour(a.fill) + (255,), (0, 0), full)
    L.alpha_composite(inner); L.alpha_composite(lay)
    save_pair(a.out, on(colour(a.outside), L).resize((40, 40), Image.LANCZOS), L.resize((40, 40), Image.LANCZOS))
    print('circle centre (%.1f, %.1f) radius %.1f, zoom %.2f' % (cx, cy, r, a.zoom))


# ---------- sheets ----------

def compare_sheet(rows, out, title, logo=None):
    """rows: [(label, opaque_path, transparent_path_or_None)]. 6x zoom + actual size on FIRST's backgrounds."""
    Z = 6; cell = 40 * Z; W = 1000; rh = cell + 44; H = 80 + rh * len(rows)
    im = Image.new('RGB', (W, H), PAPER); d = ImageDraw.Draw(im)
    d.text((28, 22), title, font=font(20, True), fill=INK)
    d.text((246, 58), 'Opaque (6x)', font=font(13, True), fill=INK); d.text((514, 58), 'Transparent (6x)', font=font(13, True), fill=INK)
    d.text((782, 58), 'Actual size', font=font(13, True), fill=INK)
    for i, (label, op, tr) in enumerate(rows):
        y = 80 + i * rh; d.text((28, y + 6), label, font=font(14, True), fill=INK)
        if logo and i == 0:
            lg = load(logo); lg.thumbnail((180, 180)); bgc = Image.new('RGB', (180, 180), (255, 255, 255)); bgc.paste(lg, ((180 - lg.width) // 2, (180 - lg.height) // 2), lg)
            im.paste(bgc, (28, y + 30)); d.text((28, y + 214), 'Original logo', font=font(11), fill=MUTED)
        o = load(op); t = load(tr) if tr else None
        im.paste(on((255, 255, 255), o).convert('RGB').resize((cell, cell), Image.NEAREST), (246, y)); d.rectangle([245, y - 1, 246 + cell, y + cell], outline=LINE)
        if t:
            c = checker(cell, cell, 12); tt = t.resize((cell, cell), Image.NEAREST); c.paste(tt, (0, 0), tt); im.paste(c, (514, y)); d.rectangle([513, y - 1, 514 + cell, y + cell], outline=LINE)
        for j, (nm, bgc) in enumerate(FIRST_BG):
            yy = y + j * 48; d.rectangle([782, yy, 972, yy + 44], fill=bgc)
            im.paste(on(bgc, o).convert('RGB'), (790, yy + 2))
            if t: b = Image.new('RGB', (40, 40), bgc); b.paste(t, (0, 0), t); im.paste(b, (840, yy + 2))
            d.text((892, yy + 14), nm, font=font(12), fill=(255, 255, 255) if sum(bgc) < 500 else INK)
    im.save(out); return out

def cmd_compare(a):
    rows = [tuple((r.split('|') + [None])[:3]) for r in a.row]
    print(compare_sheet([(l, o, t or None) for l, o, t in rows], a.out, a.title, a.logo))

def cmd_grid(a):
    """Options x background colours: rows 'Label|prefix'; files <prefix>-<bg>-avatar-40.png,
    <prefix>-avatar-40.png (as is) and <prefix>-avatar-40-transparent.png."""
    bgs = a.bgs.split(','); rows = [r.split('|') for r in a.row]
    asis = any(os.path.exists(f'{p}-avatar-40.png') for _, p in rows)
    cols = (['as is'] if asis else []) + bgs + ['transparent']
    c = 160; g = 24; lw = 210; W = lw + len(cols) * (c + g) + g; H = 70 + len(rows) * (c + 76)
    im = Image.new('RGB', (W, H), (246, 247, 249)); d = ImageDraw.Draw(im)
    d.text((g, 18), a.title, font=font(16, True), fill=INK)
    for j, nm in enumerate(cols): d.text((lw + j * (c + g), 48), nm, font=font(13), fill=MUTED)
    ch = checker(c, c, 16, (255, 255, 255), (220, 220, 220))
    for i, (label, p) in enumerate(rows):
        y = 70 + i * (c + 76); d.text((g, y + c // 2 - 8), label, font=font(15, True), fill=INK)
        for j, nm in enumerate(cols):
            f = {'as is': f'{p}-avatar-40.png', 'transparent': f'{p}-avatar-40-transparent.png'}.get(nm, f'{p}-{nm}-avatar-40.png')
            if not os.path.exists(f): continue
            x = lw + j * (c + g); t = load(f); b = ch.copy().convert('RGBA'); b.alpha_composite(t.resize((c, c), Image.NEAREST))
            im.paste(b.convert('RGB'), (x, y)); d.rectangle([x - 1, y - 1, x + c, y + c], outline=(200, 200, 200))
            for k, bc in enumerate([(255, 255, 255), (28, 28, 32), (0, 102, 179)]):
                bb = Image.new('RGBA', (48, 48), bc + (255,)); bb.alpha_composite(t, (4, 4)); im.paste(bb.convert('RGB'), (x + k * 52, y + c + 10))
    im.save(a.out); print(a.out, im.size)

def cmd_sheet(a):
    """Contact sheet of logo candidates logos/<n>/c*.png -> logos/<n>/candidates.png."""
    fs = sorted((p for p in glob.glob(f'{a.dir}/c*.png') if os.path.basename(p)[1:-4].isdigit()), key=lambda p: int(os.path.basename(p)[1:-4]))
    if not fs: sys.exit('no candidates')
    W = 220; im = Image.new('RGB', (W * min(4, len(fs)), (W + 20) * ((len(fs) + 3) // 4)), (128, 128, 128)); d = ImageDraw.Draw(im)
    for i, f in enumerate(fs):
        x, y = (i % 4) * W, (i // 4) * (W + 20); t = load(f); size = t.size; t.thumbnail((W - 10, W - 10))
        im.paste(t, (x + 5, y + 5), t); d.text((x + 5, y + W), os.path.basename(f) + ' ' + 'x'.join(map(str, size)), fill='white')
    im.save(f'{a.dir}/candidates.png'); print(f'{a.dir}/candidates.png')

def cmd_extract(a):
    """Save the data-URI images in a browser-script result (JSON text) as logos/<n>/c<k>.png."""
    t = open(a.json).read()
    try:
        j = json.loads(t)
        if isinstance(j, list): t = '\n'.join(x.get('text', '') if isinstance(x, dict) else str(x) for x in j)
    except ValueError: pass
    os.makedirs(f'logos/{a.team}', exist_ok=True)
    k = len([x for x in os.listdir(f'logos/{a.team}') if re.fullmatch(r'c\d+\.png', x)])
    for m in re.finditer(r'data:image/(?:png|webp|jpeg);base64,([A-Za-z0-9+/=]+)', t):
        k += 1; p = f'logos/{a.team}/c{k}.png'; Image.open(io.BytesIO(base64.b64decode(m.group(1)))).save(p); print(p, Image.open(p).size)

def cmd_quicksheet(a):
    """Several avatars side by side (logo, opaque, transparent, actual size) for a quick look."""
    Z = 4; RW = 120 + 40 * Z * 2 + 30 + 5 * 60
    im = Image.new('RGB', (RW * 2, (40 * Z + 14) * ((len(a.teams) + 1) // 2)), (235, 235, 235)); d = ImageDraw.Draw(im)
    for i, n in enumerate(a.teams):
        x0, y0 = (i % 2) * RW, (i // 2) * (40 * Z + 14); op, tr = avatar_files(n)
        if not op: continue
        if os.path.exists(f'src/{n}.png'): s = load(f'src/{n}.png'); s.thumbnail((110, 110)); im.paste(s, (x0, y0 + 20), s)
        d.text((x0, y0 + 2), os.path.basename(op)[:-14], fill='black')
        im.paste(Image.open(op).convert('RGB').resize((40 * Z, 40 * Z), Image.NEAREST), (x0 + 120, y0))
        if tr: t = load(tr).resize((40 * Z, 40 * Z), Image.NEAREST); c = checker(40 * Z, 40 * Z); c.paste(t, (0, 0), t); im.paste(c, (x0 + 126 + 40 * Z, y0))
        for j, (_, bg) in enumerate(FIRST_BG):
            b = Image.new('RGB', (56, 100), bg); b.paste(load(op), (8, 4), load(op))
            if tr: b.paste(load(tr), (8, 52), load(tr))
            im.paste(b, (x0 + 140 + 80 * Z + j * 60, y0))
    im.save(a.out); print(a.out)


# ---------- checks ----------

def chroma_pixels(arr):
    """Pixels near lime (#00FF00) or magenta (#FF00FF), the chroma keys FIRST warns about:
    lime = G > 200, R < 120, B < 120; magenta = R > 200, B > 200, G < 80."""
    r, g, b = (arr[..., i].astype(int) for i in range(3))
    return int(((g > 200) & (r < 120) & (b < 120)).sum()), int(((r > 200) & (b > 200) & (g < 80)).sum())

def cmd_check(a):
    files = a.files or sorted(glob.glob('out/*-avatar-40*.png'))
    bad = 0
    for f in files:
        im = Image.open(f); msgs = []
        if im.size != (40, 40): msgs.append(f'size {im.size}')
        if getattr(im, 'is_animated', False): msgs.append('animated')
        sz = os.path.getsize(f)
        if sz > 20000: msgs.append(f'{sz} bytes > 20 kB')
        arr = np.asarray(im.convert('RGBA')).copy(); vis = arr[..., 3] > 0
        lv, mv = chroma_pixels(np.where(vis[..., None], arr, 0).astype(np.uint8))
        if lv or mv: msgs.append(f'visible chroma-key colours: {lv} lime, {mv} magenta (warning)')
        hid = np.where((~vis)[..., None], arr, 0).astype(np.uint8); hl, hm = chroma_pixels(hid)
        if hl or hm: msgs.append(f'hidden lime/magenta under alpha 0: {hl + hm} px')
        if a.fix and (~vis & (arr[..., :3].max(-1) > 0)).any():
            arr[~vis] = 0; Image.fromarray(arr, 'RGBA').save(f, optimize=True)
            if hl or hm: msgs[-1] += ' (fixed)'
        if msgs: bad += 1
        print(('OK  ' if not msgs else 'FIX ') + f + ('' if not msgs else ': ' + '; '.join(msgs)))
    print(f'{len(files)} files, {bad} with remarks')

def cmd_coverage(a):
    T = teams(); ex = [t for t in T if t.get('existing')]; new = [t for t in T if not t.get('existing') and avatar_files(t['n'])[0]]
    tot = a.total or len(T)
    print(f'before: {len(ex)} of {tot} ({round(len(ex) / tot * 100)}%)')
    print(f'new: {len(new)} -> after: {len(ex) + len(new)} of {tot} ({round((len(ex) + len(new)) / tot * 100)}%)')


# ---------- packaging and overview images ----------

def cmd_zips(a):
    """One zip per team (avatar, transparent, comparison sheet, logo) plus a bundle of all zips."""
    os.makedirs(a.out, exist_ok=True); made = []
    for t in teams():
        if t.get('existing'): continue
        n = t['n']; op, tr = avatar_files(n)
        if not op: continue
        base = base_name(n); folder = os.path.join(a.out, base); os.makedirs(folder, exist_ok=True)
        logo = f'src/{n}.png' if os.path.exists(f'src/{n}.png') else None
        sheet = compare_sheet([(t.get('name', str(n)), op, tr)], os.path.join(folder, f'{base}-comparison.png'), f"{t.get('name', '')} ({n}) 40x40 avatar", logo)
        z = os.path.join(a.out, f'{base}-avatar.zip')
        with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as zf:
            zf.write(op, os.path.basename(op))
            if tr: zf.write(tr, os.path.basename(tr))
            zf.write(sheet, os.path.basename(sheet))
            if logo: zf.write(logo, f'{base}-logo-source.png')
        made.append(z)
    with zipfile.ZipFile(a.bundle, 'w', zipfile.ZIP_STORED) as zf:
        for z in made: zf.write(z, os.path.basename(z))
    print(len(made), 'team zips in', a.out, '+ bundle', a.bundle)

def _wrap(d, text, f, w, lines=2):
    out, cur = [], ''
    for word in str(text).split():
        tt = (cur + ' ' + word).strip()
        if d.textlength(tt, font=f) <= w: cur = tt
        else: out.append(cur); cur = word
    out.append(cur); return out[:lines]

def cmd_overview(a):
    """New avatars grouped by event, 3x size, with number and name."""
    T = [t for t in teams() if not t.get('existing') and avatar_files(t['n'])[0]]
    events = []
    for t in T:
        k = (t.get('event', ''), t.get('date', ''))
        if k not in events: events.append(k)
    SC, CW, PAD = 3, 150, 48; A = 40 * SC; cols = max(1, min(a.cols, max(len([t for t in T if (t.get('event', ''), t.get('date', '')) == e]) for e in events)))
    W = PAD * 2 + CW * cols; im = Image.new('RGB', (W, 6000), PAPER); d = ImageDraw.Draw(im)
    d.text((PAD, PAD), a.title, font=font(40, True), fill=INK); d.text((PAD, PAD + 56), a.subtitle, font=font(18), fill=MUTED); y = PAD + 110
    for ev, date in events:
        items = [t for t in T if (t.get('event', ''), t.get('date', '')) == (ev, date)]
        d.text((PAD, y), ev or 'Teams', font=font(26, True), fill=INK); tw = d.textlength(ev or 'Teams', font=font(26, True))
        d.text((PAD + tw + 14, y + 8), ' · '.join(x for x in [date, f'{len(items)} avatars'] if x), font=font(17), fill=MUTED)
        d.line([PAD, y + 42, W - PAD, y + 42], fill=INK, width=2); y += 56
        for i, t in enumerate(items):
            if i and i % cols == 0: y += A + 96
            x = PAD + (i % cols) * CW; av = Image.open(avatar_files(t['n'])[0]).convert('RGB').resize((A, A), Image.NEAREST)
            im.paste(av, (x, y)); d.rectangle([x - 1, y - 1, x + A, y + A], outline=LINE)
            d.text((x, y + A + 6), f"#{t['n']}", font=font(16, True, True), fill=ACCENT)
            for j, l in enumerate(_wrap(d, t.get('name', ''), font(14), CW - 14)): d.text((x, y + A + 26 + j * 17), l, font=font(14), fill=INK)
        y += A + 96
    im = im.crop((0, 0, W, y - 20)); im.save(a.out); print(a.out, im.size)

def cmd_backgrounds(a):
    """All new avatars on FIRST's backgrounds, transparent (default) or opaque, 2x size."""
    T = sorted([t for t in teams() if not t.get('existing') and avatar_files(t['n'])[0]], key=lambda t: t['n'])
    SC, CW, COLS, PAD = 2, 98, a.cols, 48; A = 40 * SC; W = PAD * 2 + CW * COLS; rows = (len(T) + COLS - 1) // COLS; gh = rows * (A + 26) + 16
    im = Image.new('RGB', (W, 300 + 5 * (gh + 80)), PAPER); d = ImageDraw.Draw(im)
    d.text((PAD, PAD), a.title, font=font(40, True), fill=INK)
    d.text((PAD, PAD + 56), ('Versions with background' if a.opaque else 'Transparent versions') + ' at 2x size, sorted by team number', font=font(18), fill=MUTED); y = PAD + 110
    for name, bg in FIRST_BG:
        d.text((PAD, y), name, font=font(22, True), fill=INK); y += 34
        d.rounded_rectangle([PAD, y, W - PAD, y + gh], radius=10, fill=bg); lab = (255, 255, 255) if sum(bg) < 500 else MUTED
        for i, t in enumerate(T):
            op, tr = avatar_files(t['n']); p = op if a.opaque or not tr else tr
            cx = PAD + 12 + (i % COLS) * CW + (CW - A) // 2 - 6; cy = y + 12 + (i // COLS) * (A + 26)
            av = load(p).resize((A, A), Image.NEAREST); im.paste(av, (cx, cy), av)
            s = str(t['n']); d.text((cx + (A - d.textlength(s, font=font(13, True, True))) / 2, cy + A + 4), s, font=font(13, True, True), fill=lab)
        y += gh + 26
    im = im.crop((0, 0, W, y)); im.save(a.out); print(a.out, im.size)

def cmd_allteams(a):
    """Every team with an avatar: existing FIRST avatars (existing/<n>.png) plus new ones, NEW tag."""
    T = teams(); items = []
    for t in T:
        p = f"existing/{t['n']}.png" if t.get('existing') else avatar_files(t['n'])[0]
        if p and os.path.exists(p): items.append((t['n'], t.get('name', ''), p, not t.get('existing')))
    items.sort(); tot = a.total or len(T); nn = sum(1 for i in items if i[3])
    SC, CW, COLS, PAD = 2, 128, a.cols, 48; A = 40 * SC; RH = A + 70; W = PAD * 2 + CW * COLS
    im = Image.new('RGB', (W, 200 + RH * ((len(items) + COLS - 1) // COLS) + 40), PAPER); d = ImageDraw.Draw(im)
    d.text((PAD, PAD), a.title, font=font(40, True), fill=INK)
    d.text((PAD, PAD + 56), f'{len(items) - nn} already on FIRST + {nn} new = {len(items)} of {tot} teams ({round(len(items) / tot * 100)}%) · sorted by team number', font=font(18), fill=MUTED)
    d.rounded_rectangle([PAD, PAD + 92, PAD + 46, PAD + 110], radius=4, fill=ACCENT); d.text((PAD + 8, PAD + 94), 'NEW', font=font(11, True), fill=(255, 255, 255))
    d.text((PAD + 56, PAD + 92), 'made in this batch', font=font(16), fill=MUTED); y = PAD + 136
    for i, (n, name, p, new) in enumerate(items):
        x, yy = PAD + (i % COLS) * CW, y + (i // COLS) * RH; av = load(p).resize((A, A), Image.NEAREST)
        d.rectangle([x, yy, x + A - 1, yy + A - 1], fill=(225, 228, 234)); im.paste(av, (x, yy), av)
        if new: d.rounded_rectangle([x + A - 34, yy - 7, x + A + 8, yy + 9], radius=4, fill=ACCENT); d.text((x + A - 28, yy - 5), 'NEW', font=font(11, True), fill=(255, 255, 255))
        d.text((x, yy + A + 5), f'#{n}', font=font(15, True, True), fill=ACCENT if new else MUTED)
        for j, l in enumerate(_wrap(d, name, font(13), CW - 12)): d.text((x, yy + A + 24 + j * 16), l, font=font(13), fill=INK)
    im.save(a.out); print(a.out, im.size)


# ---------- pages (publish as artifacts with the db capability) ----------

def cmd_review_page(a):
    """Rating page: one card per avatar, grouped by event; ratings, verdicts and feedback save to the
    page's db (collection `reviews`, doc = team number)."""
    data, order = {}, []
    for t in teams():
        if t.get('existing'): continue
        op, tr = avatar_files(t['n'])
        if not op: continue
        k = t.get('event', '') or 'Teams'
        if k not in data: data[k] = {'city': k, 'date': t.get('date', ''), 'items': []}; order.append(k)
        src = f"src/{t['n']}.png"
        s = load(src) if os.path.exists(src) else Image.open(op).convert('RGBA'); s.thumbnail((180, 180), Image.LANCZOS)
        bgc = Image.new('RGBA', s.size, (255, 255, 255, 255)); bgc.alpha_composite(s)
        data[k]['items'].append({'n': t['n'], 'name': t.get('name', ''), 'op': uri(Image.open(op)), 'tr': uri(Image.open(tr or op)),
                                 'src': uri(bgc.convert('RGB'), 'WEBP', quality=82), 'note': t.get('note', ''), 'from': t.get('from', 'the team')})
    html = open(os.path.join(HERE, 'review_tpl.html')).read()
    html = html.replace('__TITLE__', htmlmod.escape(a.title)).replace('__INTRO__', htmlmod.escape(a.intro)).replace('__EVENT__', js(a.event_label))
    html = html.replace('__DATA__', js([data[k] for k in order]))
    open(a.out, 'w').write(html); print(a.out, os.path.getsize(a.out), 'bytes')

def cmd_review_reset(a):
    """From exported reviews (a JSON list of {doc_id/team, rating, verdict, feedback, version?}) make an
    ArtifactData batch that clears the not-approved ones for the next round and keeps them as `previous`."""
    rows = json.load(open(a.reviews)); ops = []
    for r in rows:
        v = r.get('data', r); n = int(r.get('doc_id', v.get('team')))
        if v.get('verdict') == 'approve' and not a.all: continue
        op = {'op': 'set', 'collection': 'reviews', 'doc_id': str(n),
              'data': {'team': n, 'rating': None, 'verdict': None, 'feedback': '', 'updatedAt': a.now,
                       'previous': {'rating': v.get('rating'), 'verdict': v.get('verdict'), 'feedback': v.get('feedback', '')}}}
        if r.get('version') is not None: op['if_version'] = r['version']
        ops.append(op)
    json.dump(ops, open(a.out, 'w')); print(len(ops), 'reviews to reset ->', a.out)

DEFAULT_SLACK = (":robot_face: *Free 40×40 FIRST avatars for your team*\n\nThe avatar is the small picture shown next to your team number at events. "
                 "Right now only {before_pct}% of the teams in {region} have one ({before} of {total}). So I've been making them from teams' own logos, "
                 "and a batch of {new} is ready (see the images). Once those are uploaded, we're at {after_pct}%.\n\n*Is your team in the images?*\n"
                 "Download the zip attached to this post. Inside is one zip per team, named after your team number, with:\n• the avatar with background\n"
                 "• a transparent version\n• a preview sheet showing it at actual size on different backgrounds\n• the logo it's based on\n\n"
                 "*Want one too?*\nPost your logo in this thread or email it to {reply} and I'll make one for you.\n\n*Uploading*\nYour Lead Mentor 1 or 2 "
                 "uploads the avatar in ftc-scoring → Team Avatar → Upload New Avatar. Upload it at least two weeks before your event, so it shows up "
                 "in time. More about avatars: https://community.firstinspires.org/team-avatars\n\nQuestions, or want something changed? Reply in this thread or email {reply}.")

def cmd_outreach_page(a):
    """Outreach page: per team the contact (email or Instagram), the zip to attach and the ready message
    (Dutch or English templates, editable); sent state and template edits save to the page's db."""
    T = teams(); rows = []
    for t in T:
        if t.get('existing'): continue
        op, tr = avatar_files(t['n'])
        if not op: continue
        rows.append(dict(n=t['n'], name=t.get('name', ''), city=t.get('event', ''), date=t.get('date', ''), lang=t.get('lang', a.lang),
                         email=t.get('email', ''), emailSrc=t.get('emailSrc', ''), emailNote=t.get('emailNote', ''), ig=t.get('ig', ''),
                         zip=f"{base_name(t['n'])}-avatar.zip", op=uri(Image.open(op)), tr=uri(Image.open(tr or op))))
    ex = sum(1 for t in T if t.get('existing')); tot = a.total or len(T); new = len(rows)
    slack = DEFAULT_SLACK.format(before_pct=round(ex / tot * 100), before=ex, total=tot, new=new, after_pct=round((ex + new) / tot * 100), region=a.region, reply=a.reply)
    img = uri(Image.open(a.image).convert('RGB'), 'WEBP', quality=85) if a.image and os.path.exists(a.image) else ''
    html = open(os.path.join(HERE, 'outreach_tpl.html')).read()
    for k, v in {'__TITLE__': htmlmod.escape(a.title), '__SENDER__': js(a.sender), '__REPLY__': a.reply or 'me', '__IMAGE__': img,
                 '__SLACK__': js(slack), '__DATA__': js(rows)}.items():
        html = html.replace(k, v)
    open(a.out, 'w').write(html); print(a.out, os.path.getsize(a.out), 'bytes;', new, 'teams,', sum(1 for r in rows if r['email']), 'with email')


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter); sp = p.add_subparsers(dest='cmd', required=True)
    c = sp.add_parser('make', help='batch build from a plan file'); c.add_argument('plan'); c.set_defaults(f=cmd_make)
    c = sp.add_parser('border', help='transparent = background cut away, kept as a thin border'); c.add_argument('teams', nargs='+')
    c.add_argument('--tol', type=float, default=40); c.add_argument('--mode', default='edge', choices=['edge', 'all']); c.add_argument('--bg'); c.add_argument('--width', type=float, default=1.15); c.set_defaults(f=cmd_border)
    c = sp.add_parser('cutout', help='cut a logo out of its background'); c.add_argument('logo'); c.add_argument('--out', required=True); c.add_argument('--bg')
    c.add_argument('--tol', type=float, default=40); c.add_argument('--mode', default='edge', choices=['edge', 'all']); c.add_argument('--main', action='store_true'); c.set_defaults(f=cmd_cutout)
    c = sp.add_parser('variants', help='a cut-out on several backgrounds'); c.add_argument('art'); c.add_argument('--out', required=True)
    c.add_argument('--bgs', default='teal,navy,black'); c.add_argument('--area', default='1,1,39,39'); c.add_argument('--border-colour', default='black'); c.add_argument('--width', type=float, default=1.1); c.set_defaults(f=cmd_variants)
    c = sp.add_parser('cutbottom', help='zoomed part, cut edge flush with the bottom'); c.add_argument('art'); c.add_argument('--out', required=True); c.add_argument('--box')
    c.add_argument('--bgs', default='teal,navy,black'); c.add_argument('--margin', type=float, default=1); c.add_argument('--border-colour', default='black'); c.add_argument('--width', type=float, default=1.1); c.set_defaults(f=cmd_cutbottom)
    c = sp.add_parser('coin', help='round badge with a complete ring'); c.add_argument('logo'); c.add_argument('--out', required=True)
    for k, v in [('--cx', 0.0), ('--cy', 0.0), ('--r', 0.0), ('--zoom', 1.0), ('--shift', 0.0), ('--ring', 1.1)]: c.add_argument(k, type=float, default=v)
    c.add_argument('--bg'); c.add_argument('--ring-colour', default='000000'); c.add_argument('--outside', default='000000'); c.add_argument('--fill', default='000000'); c.set_defaults(f=cmd_coin)
    c = sp.add_parser('compare', help='comparison sheet'); c.add_argument('--out', required=True); c.add_argument('--title', default='Avatar options'); c.add_argument('--logo')
    c.add_argument('--row', action='append', required=True, help='"Label|opaque.png|transparent.png"'); c.set_defaults(f=cmd_compare)
    c = sp.add_parser('grid', help='options x background colours sheet'); c.add_argument('--out', required=True); c.add_argument('--title', default='Avatar options')
    c.add_argument('--bgs', default='teal,navy,black'); c.add_argument('--row', action='append', required=True, help='"Label|prefix"'); c.set_defaults(f=cmd_grid)
    c = sp.add_parser('sheet', help='contact sheet of logo candidates'); c.add_argument('dir'); c.set_defaults(f=cmd_sheet)
    c = sp.add_parser('extract', help='save images from a browser-script result'); c.add_argument('json'); c.add_argument('team'); c.set_defaults(f=cmd_extract)
    c = sp.add_parser('quicksheet', help='several avatars side by side'); c.add_argument('teams', nargs='+'); c.add_argument('--out', default='quicksheet.png'); c.set_defaults(f=cmd_quicksheet)
    c = sp.add_parser('check', help='FIRST rules: 40x40, <= 20 kB, chroma keys, hidden RGB'); c.add_argument('files', nargs='*'); c.add_argument('--fix', action='store_true'); c.set_defaults(f=cmd_check)
    c = sp.add_parser('coverage', help='teams with an avatar, before and after'); c.add_argument('--total', type=int); c.set_defaults(f=cmd_coverage)
    c = sp.add_parser('zips', help='one zip per team + a bundle'); c.add_argument('--out', default='final/zips'); c.add_argument('--bundle', default='final/avatars-per-team.zip'); c.set_defaults(f=cmd_zips)
    c = sp.add_parser('overview', help='new avatars grouped by event'); c.add_argument('--out', default='final/avatars-overview.png'); c.add_argument('--title', default='New 40x40 team avatars')
    c.add_argument('--subtitle', default=''); c.add_argument('--cols', type=int, default=8); c.set_defaults(f=cmd_overview)
    c = sp.add_parser('backgrounds', help='all new avatars on FIRST backgrounds'); c.add_argument('--opaque', action='store_true'); c.add_argument('--out')
    c.add_argument('--title', default='40x40 team avatars on different backgrounds'); c.add_argument('--cols', type=int, default=13); c.set_defaults(f=cmd_backgrounds)
    c = sp.add_parser('allteams', help='every team with an avatar, existing + new'); c.add_argument('--out', default='final/avatars-all-teams.png')
    c.add_argument('--title', default='Teams with an avatar'); c.add_argument('--total', type=int); c.add_argument('--cols', type=int, default=10); c.set_defaults(f=cmd_allteams)
    c = sp.add_parser('review-page', help='rating page (publish with capabilities {db: {}})'); c.add_argument('--out', default='final/avatar-review.html')
    c.add_argument('--title', default='Avatar Review'); c.add_argument('--intro', default='Rate each avatar, pick a verdict and write what should change. Everything saves as you go.')
    c.add_argument('--event-label', default='Qualifier'); c.set_defaults(f=cmd_review_page)
    c = sp.add_parser('review-reset', help='ArtifactData batch for the next review round'); c.add_argument('reviews'); c.add_argument('--out', default='reset.json')
    c.add_argument('--now', default='1970-01-01T00:00:00.000Z'); c.add_argument('--all', action='store_true'); c.set_defaults(f=cmd_review_reset)
    c = sp.add_parser('outreach-page', help='email/Instagram tracker (publish with capabilities {db: {}})'); c.add_argument('--out', default='final/avatar-outreach.html')
    c.add_argument('--title', default='Avatar Outreach'); c.add_argument('--sender', default=''); c.add_argument('--reply', default='', help='email address for questions and logos')
    c.add_argument('--region', default='these events'); c.add_argument('--lang', default='en'); c.add_argument('--total', type=int); c.add_argument('--image', default='final/avatars-overview.png'); c.set_defaults(f=cmd_outreach_page)
    a = p.parse_args()
    if a.cmd == 'backgrounds' and not a.out: a.out = 'final/avatars-backgrounds' + ('-opaque' if a.opaque else '') + '.png'
    for d in ('final',): os.makedirs(d, exist_ok=True)
    a.f(a)

if __name__ == '__main__':
    main()
