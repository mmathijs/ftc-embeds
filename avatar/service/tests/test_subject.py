#!/usr/bin/env python3
"""Unit test of subject.py on made-up logos (no team logos needed):

    python3 tests/test_subject.py            (from avatar/service)

Checks that the gaps inside letters are cut out, that eyes, letters in the background colour and a
large white face stay, that gradient and two-tone backgrounds are found, that the flood does not
leak through a small gap in an outline, and that a name line can be left out.
"""
import os, sys, time
import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import subject  # noqa: E402

failures = []

def check(cond, what):
    print(('ok   ' if cond else 'FAIL ') + what)
    if not cond: failures.append(what)

def font(size):
    for p in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf', '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf']:
        if os.path.exists(p): return ImageFont.truetype(p, size)
    return ImageFont.load_default(size)

def alpha(img, x, y):
    return int(np.asarray(img)[y, x, 3])

def counter_point(text, f, origin, letter_index):
    """A point in the middle of the counter of one letter (the hole of an O, 8, A...)."""
    m = Image.new('L', (900, 700), 0); d = ImageDraw.Draw(m); d.text(origin, text, font=f, fill=255)
    prefix = d.textlength(text[:letter_index], font=f); w = d.textlength(text[letter_index], font=f)
    a = np.asarray(m) > 127; x0 = int(origin[0] + prefix); x1 = int(origin[0] + prefix + w)
    from scipy import ndimage
    holes = ndimage.binary_fill_holes(a[:, x0:x1]) & ~a[:, x0:x1]
    lab, n = ndimage.label(holes)
    sizes = ndimage.sum(holes, lab, range(1, n + 1)); k = int(np.argmax(sizes)) + 1
    dt = ndimage.distance_transform_edt(lab == k); y, x = np.unravel_index(int(dt.argmax()), dt.shape)
    return x + x0, y

# 1. a mascot face with two white eyes and a name line with counters, on white
img = Image.new('RGBA', (768, 600), (255, 255, 255, 255)); d = ImageDraw.Draw(img)
d.ellipse([234, 30, 534, 330], fill=(20, 60, 160))                 # head
d.ellipse([300, 120, 360, 180], fill=(255, 255, 255)); d.ellipse([408, 120, 468, 180], fill=(255, 255, 255))   # eyes
d.ellipse([318, 140, 342, 164], fill=(10, 10, 10)); d.ellipse([426, 140, 450, 164], fill=(10, 10, 10))         # pupils
f = font(110); text = 'ROBO 8086'; d.text((40, 420), text, font=f, fill=(20, 20, 20))
t0 = time.time(); r = subject.analyse(img); dt = time.time() - t0
cut = r['cut']
check(r['kind'] == 'flat', f"white background found as flat ({r['kind']})")
check(alpha(cut, 5, 5) == 0 and alpha(cut, 760, 590) == 0, 'outer background removed')
for idx in (1, 3, 5, 6, 7, 8):         # O, O, 8, 0, 8, 6
    x, y = counter_point(text, f, (40, 420), idx)
    check(alpha(cut, x, y) == 0, f"counter of '{text[idx]}' cut out")
check(alpha(cut, 310, 130) == 255 and alpha(cut, 458, 130) == 255, 'white eyes kept')
check(alpha(cut, 384, 300) == 255, 'head kept')
nt = r['notext']
check(nt is not None, 'a "without text" version is made')
if nt is not None:
    ys, xs = np.nonzero(np.asarray(nt)[..., 3] > 127)
    check(ys.max() < 400, f'without text: only the head is left (bottom at {ys.max()})')
check(dt < 3, f'analysed in {dt:.2f} s')

# 2. white letters with a dark outline on white: the letters are gaps in the background colour, keep them
img = Image.new('RGBA', (768, 300), (255, 255, 255, 255)); d = ImageDraw.Draw(img)
d.rounded_rectangle([20, 60, 748, 240], 40, fill=(200, 30, 40))
d.text((70, 85), 'TEAM', font=font(130), fill=(255, 255, 255))
r = subject.analyse(img); cut = r['cut']
m = Image.new('L', img.size, 0); ImageDraw.Draw(m).text((70, 85), 'TEAM', font=font(130), fill=255)
inside = np.asarray(m) > 250; ys, xs = np.nonzero(inside)
kept = np.asarray(cut)[ys, xs, 3] > 127
check(kept.mean() > 0.95, f'white letters on a red banner kept ({kept.mean():.0%} of their pixels)')

# 3. a large white face inside a thin outline: keep the face, and the eyes in it
img = Image.new('RGBA', (600, 600), (255, 255, 255, 255)); d = ImageDraw.Draw(img)
d.ellipse([100, 100, 500, 500], fill=(255, 255, 255), outline=(0, 0, 0), width=8)
d.ellipse([200, 220, 260, 280], fill=(255, 255, 255), outline=(0, 0, 0), width=6)
d.ellipse([340, 220, 400, 280], fill=(255, 255, 255), outline=(0, 0, 0), width=6)
r = subject.analyse(img); cut = r['cut']
check(alpha(cut, 300, 400) == 255, 'white face inside a thin outline kept')
check(alpha(cut, 230, 250) == 255 and alpha(cut, 370, 250) == 255, 'eyes inside the white face kept')
check(r['all'] is not None and alpha(r['all'], 300, 400) == 0, '"all gaps cut out" version removes the face')

# 4. a gradient background
g = np.zeros((500, 700, 4), np.uint8); yy = np.linspace(0, 1, 500)[:, None]; xx = np.linspace(0, 1, 700)[None]
g[..., 0] = 30 + 120 * yy; g[..., 1] = 60 + 140 * xx; g[..., 2] = 200 - 60 * yy + 0 * xx; g[..., 3] = 255
img = Image.fromarray(g, 'RGBA'); d = ImageDraw.Draw(img)
d.polygon([(350, 60), (560, 420), (140, 420)], fill=(250, 140, 20))
r = subject.analyse(img); cut = r['cut']
check(r['kind'] == 'gradient', f"gradient background found ({r['kind']})")
check(alpha(cut, 10, 10) == 0 and alpha(cut, 690, 490) == 0 and alpha(cut, 10, 490) == 0, 'gradient removed in every corner')
check(alpha(cut, 350, 300) == 255, 'subject on the gradient kept')

# 5. a two-tone background (left navy, right white)
img = Image.new('RGBA', (700, 500), (255, 255, 255, 255)); d = ImageDraw.Draw(img)
d.rectangle([0, 0, 349, 499], fill=(22, 38, 74)); d.ellipse([200, 100, 500, 400], fill=(230, 120, 20))
r = subject.analyse(img); cut = r['cut']
check(r['kind'] == 'palette', f"two-tone background found ({r['kind']})")
check(alpha(cut, 20, 20) == 0 and alpha(cut, 680, 20) == 0, 'both background colours removed')
check(alpha(cut, 350, 250) == 255, 'subject kept')

# 6. an outline with a 3 px gap: the white inside must not leak away
img = Image.new('RGBA', (600, 600), (255, 255, 255, 255)); d = ImageDraw.Draw(img)
d.rectangle([150, 150, 450, 450], outline=(0, 0, 0), width=10); d.rectangle([298, 150, 301, 160], fill=(255, 255, 255))
d.ellipse([260, 260, 340, 340], fill=(200, 0, 0))
r = subject.analyse(img); cut = r['cut']
check(alpha(cut, 200, 400) == 255, 'white inside an outline with a 3 px gap kept')

# 7. JPEG noise on the background
img = Image.new('RGB', (768, 768), (240, 240, 240)); d = ImageDraw.Draw(img)
d.ellipse([150, 150, 618, 618], fill=(200, 20, 30)); d.text((260, 330), 'ABC', font=font(110), fill=(255, 255, 255))
import io
b = io.BytesIO(); img.save(b, 'JPEG', quality=55); img = Image.open(io.BytesIO(b.getvalue())).convert('RGBA')
r = subject.analyse(img); cut = r['cut']
A = np.asarray(cut)[..., 3]
check(A[:120, :120].max() < 20 and A[-120:, -120:].max() < 20, 'JPEG background removed without specks')
check(A[384, 200] == 255, 'JPEG subject kept')

# 8. thin slits: a 3 px channel of background between two blocks, open to the background, and a
#    3 px slit enclosed between two letters that touch; neither may stay as a white line
img = Image.new('RGBA', (768, 600), (255, 255, 255, 255)); d = ImageDraw.Draw(img)
d.rectangle([150, 100, 380, 500], fill=(200, 30, 40)); d.rectangle([384, 100, 620, 500], fill=(200, 30, 40))   # 3 px apart
d.rectangle([150, 520, 620, 560], fill=(20, 20, 20))                                     # a bar below, closing the bottom
d.ellipse([220, 200, 300, 280], fill=(255, 255, 255)); d.ellipse([460, 200, 540, 280], fill=(255, 255, 255))   # eyes
d.rectangle([150, 40, 620, 80], fill=(20, 20, 20)); d.rectangle([382, 80, 382, 96], fill=(255, 255, 255))      # enclosed slit
r = subject.analyse(img); A = np.asarray(r['cut'])[..., 3]
check(A[300, 382] == 0, f'a 3 px channel open to the background is removed (alpha {A[300, 382]})')
check(A[90, 382] < 128, f'a thin slit enclosed in the logo is removed (alpha {A[90, 382]})')
check(A[240, 260] == 255 and A[240, 500] == 255, 'the eyes stay')
# the leak guard still holds: a white area behind a 3 px break in an outline stays (case 6 above)

print(f'\n{len(failures)} failure(s)' if failures else '\nall passed')
sys.exit(1 if failures else 0)
