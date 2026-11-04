"""Subject detection for the avatar service: which pixels are background, which are the logo.

campaign.cut_bg (the skill's toolkit) removes one flat colour, and only where it touches the image
border, so the gaps inside letters stay. The skill fixes that per logo by judgment ('all' mode,
manual crops). This module makes those calls automatically:

- the background model: one colour, two or three colours (a two-tone background), or a smooth
  gradient, fitted to the outer pixels, with a tolerance taken from their noise (JPEG);
- the flood from the border does not leak through gaps of a few pixels in an outline;
- every enclosed gap is judged: inside a letter (a row of glyph-sized parts), walled off by a
  thin line from the real background, or a hairline slit: removed; narrow channels of background
  between letters are background too; eyes (a pair of similar gaps), letters written in
  the background colour, large white areas (a face, the inside of a badge) and other gaps: kept;
- rows of text are found, so a name line can be left out;
- edge pixels are un-blended from the local background colour, so no halo is left.

analyse(logo) returns the cut-outs at the logo's own size. Needs numpy and scipy.
"""
import numpy as np
from PIL import Image
from scipy import ndimage

EIGHT = np.ones((3, 3), bool)


def _disk(r):
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r + r


def _ring_pixels(a, k):
    H, W = a.shape[:2]
    m = np.zeros((H, W), bool); m[:k] = True; m[-k:] = True; m[:, :k] = True; m[:, -k:] = True
    ys, xs = np.nonzero(m)
    return a[ys, xs], ys, xs


def _kmeans(X, k, it=8):
    """Small k-means with medians (robust to anti-aliased pixels); farthest-point start."""
    C = [np.median(X, 0)]
    for _ in range(k - 1):
        d = np.min([((X - c) ** 2).sum(1) for c in C], 0)
        C.append(X[int(np.argmax(d))])
    C = np.array(C, float)
    for _ in range(it):
        lab = np.argmin(((X[:, None, :] - C[None]) ** 2).sum(-1), 1)
        for j in range(k):
            if (lab == j).any(): C[j] = np.median(X[lab == j], 0)
    return C, np.argmin(((X[:, None, :] - C[None]) ** 2).sum(-1), 1)


def _tol(d):
    """Tolerance from the spread of the background's own pixels: 34 for clean art, up to 64 for noisy JPEG."""
    rms = float(np.sqrt((d ** 2).mean())) if len(d) else 0.0
    return float(np.clip(28 + 2.5 * rms, 34, 64))


def _poly(ys, xs, H, W):
    yy, xx = ys / H - 0.5, xs / W - 0.5
    return np.stack([np.ones_like(xx), xx, yy, xx * yy, xx * xx, yy * yy], -1)


def background(a):
    """Fit a background model to the outer pixels of an opaque RGB(A) float array.
    Returns a dict {kind: flat|palette|gradient, colours, tols | coef, tol, main} or None."""
    H, W = a.shape[:2]
    E, ys, xs = _ring_pixels(a, max(2, round(min(H, W) / 200)))
    X = E[:, :3].astype(float)
    med = np.median(X, 0); d = np.linalg.norm(X - med, axis=1)
    flat_cov = float((d < 40).mean())
    flat = dict(kind='flat', colours=[med], tols=[_tol(d[d < 40])], main=med, cover=flat_cov)
    if flat_cov >= 0.8:
        return flat
    found = []
    # two or three colours (a split or striped background), each on at least 12% of the border
    C, lab = _kmeans(X, 3)
    keep = []
    for j in range(3):
        sel = lab == j
        if sel.mean() < 0.12: continue
        dj = np.linalg.norm(X[sel] - C[j], axis=1)
        if any(np.linalg.norm(C[j] - k[0]) < 30 for k in keep): continue
        keep.append((C[j], _tol(dj[dj < 40]), sel.mean()))
    if len(keep) >= 2:
        dd = np.stack([np.linalg.norm(X - k[0], axis=1) / k[1] for k in keep], 1)
        cov = float((dd.min(1) < 1).mean())
        found.append((cov, dict(kind='palette', colours=[k[0] for k in keep], tols=[k[1] for k in keep],
                                main=max(keep, key=lambda k: k[2])[0], cover=cov)))
    # a smooth gradient: a quadratic surface per channel, refitted once without the outliers
    A = _poly(ys, xs, H, W)
    coef = np.linalg.lstsq(A, X, rcond=None)[0]; r = np.linalg.norm(X - A @ coef, axis=1)
    inl = r < max(12.0, 3 * float(np.median(r)))
    if inl.sum() > 20:
        coef = np.linalg.lstsq(A[inl], X[inl], rcond=None)[0]; r = np.linalg.norm(X - A @ coef, axis=1)
    tol = _tol(r[r < 40]); cov = float((r < tol).mean())
    corners = _poly(np.array([0, 0, H - 1, H - 1]), np.array([0, W - 1, 0, W - 1]), H, W) @ coef
    spread = float(np.linalg.norm(corners.max(0) - corners.min(0)))
    if spread > 25:
        found.append((cov, dict(kind='gradient', coef=coef, tol=tol, main=np.median(X[r < tol], 0) if (r < tol).any() else med, cover=cov)))
    if found:
        cov, best = max(found, key=lambda f: f[0])
        if cov >= 0.75 and cov > flat_cov + 0.05: return best
    return flat if flat_cov >= 0.6 else None


def near_map(a, model):
    """(near, B): pixels close to the background, and the background colour expected at each pixel."""
    rgb = a[..., :3].astype(np.float32); H, W = rgb.shape[:2]
    if model['kind'] == 'gradient':
        ys, xs = np.mgrid[0:H, 0:W]
        B = (_poly(ys.ravel().astype(float), xs.ravel().astype(float), H, W) @ model['coef']).reshape(H, W, 3).astype(np.float32)
        return np.linalg.norm(rgb - B, axis=-1) < model['tol'], np.clip(B, 0, 255)
    ratios = np.stack([np.linalg.norm(rgb - np.asarray(c, np.float32), axis=-1) / t for c, t in zip(model['colours'], model['tols'])], 0)
    pick = ratios.argmin(0)
    B = np.asarray(model['colours'], np.float32)[pick]
    return ratios.min(0) < 1, B


def unblend(a, rm, B):
    """Remove the pixels in `rm`; in a 2 px band around them, turn the background colour into alpha
    (colour-to-alpha against the local background B), so anti-aliased edges keep no halo."""
    out = a.copy()
    out[rm] = 0
    band = ndimage.binary_dilation(rm, iterations=2) & ~rm
    if band.any():
        c = a[band][:, :3] / 255.0; b = B[band] / 255.0
        ak = np.where(c > b, (c - b) / np.maximum(1 - b, 1e-6), np.where(c < b, (b - c) / np.maximum(b, 1e-6), 0))
        ac = np.clip(ak.max(-1), 0, 1)
        un = np.where(ac[:, None] > 1e-3, (c - b) / np.maximum(ac[:, None], 1e-3) + b, c)
        out[band, :3] = np.clip(un, 0, 1) * 255
        out[band, 3] = np.minimum(a[band][:, 3], ac * 255)
    out[out[..., 3] < 1] = 0
    return out


def _boxes(lab, n):
    sl = ndimage.find_objects(lab, n)
    return [(s[1].start, s[0].start, s[1].stop, s[0].stop) if s else (0, 0, 0, 0) for s in sl]


def text_rows(boxes, S, min_members=3):
    """Group boxes (x0, y0, x1, y1) into rows of glyph-sized parts. Returns a list of index lists."""
    idx = [i for i, (x0, y0, x1, y1) in enumerate(boxes) if 0.02 * S <= y1 - y0 <= 0.5 * S and x1 - x0 <= 1.6 * (y1 - y0) + 2]
    if len(idx) > 400: idx = sorted(idx, key=lambda i: -(boxes[i][3] - boxes[i][1]) * (boxes[i][2] - boxes[i][0]))[:400]
    parent = {i: i for i in idx}
    def find(i):
        while parent[i] != i: parent[i] = parent[parent[i]]; i = parent[i]
        return i
    strict = set()
    for p, i in enumerate(idx):
        x0, y0, x1, y1 = boxes[i]; hi = y1 - y0
        for j in idx[p + 1:]:
            u0, v0, u1, v1 = boxes[j]; hj = v1 - v0
            if max(hi, hj) > 1.8 * min(hi, hj): continue
            if min(y1, v1) - max(y0, v0) < 0.5 * min(hi, hj): continue
            gap = max(u0 - x1, x0 - u1)
            if gap > 0.9 * max(hi, hj): continue
            parent[find(i)] = find(j)
            if max(hi, hj) <= 1.25 * min(hi, hj) and gap <= 0.4 * max(hi, hj): strict.add((i, j))
    groups = {}
    for i in idx: groups.setdefault(find(i), []).append(i)
    rows = []
    for g in groups.values():
        if len(g) >= min_members: rows.append(sorted(g))
        elif len(g) == 2 and (tuple(g) in strict or tuple(g[::-1]) in strict): rows.append(sorted(g))
    return rows


def analyse(logo):
    """Cut a logo (RGBA PIL image) out of its background.

    Returns {kind, bg (the main background colour), cut (gaps judged), all (every enclosed gap cut,
    or None if that is the same), notext (without separate text rows, or None), info}. Images are
    RGBA at the logo's size. kind: alpha (already transparent), flat, palette, gradient or none
    (no background found: cut is None)."""
    a = np.asarray(logo.convert('RGBA')).astype(np.float32)
    H, W = a.shape[:2]; npx = H * W
    info = dict(gaps_removed=0, gaps_kept=0, text_rows=0, kept=[])
    if a[..., 3].min() < 250:
        fg = a[..., 3] > 127; bg = None; cut = a; cut_all = None; B = None; holes_lab = None; model = dict(kind='alpha', main=None)
    else:
        model = background(a)
        if model is None:
            return dict(kind='none', bg=tuple(int(v) for v in np.median(_ring_pixels(a, 3)[0][:, :3], 0)), cut=None, all=None, notext=None, info=info)
        near, B = near_map(a, model)
        # flood from the border, without leaking through gaps of up to 2r px in an outline
        r = max(1, round(min(H, W) / 384))
        core = ndimage.binary_opening(near, structure=_disk(r))
        lab, n = ndimage.label(core)
        edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])); edge = edge[edge > 0]
        bg = np.isin(lab, edge)
        bg = ndimage.binary_dilation(bg, structure=EIGHT, iterations=r + 1, mask=near) | bg
        # ... but a narrow channel of background that touches it (a gap of a few px between two
        # letters) is background too: it is thin all the way, where a region behind a break in an
        # outline is wide. Without this, such channels stay as thin light slits.
        rest = near & ~bg
        if rest.any():
            cl, cn = ndimage.label(rest)
            touch = np.unique(cl[ndimage.binary_dilation(bg, structure=EIGHT) & rest]); touch = touch[touch > 0]
            if len(touch):
                widest = np.asarray(ndimage.maximum(ndimage.distance_transform_edt(rest), cl, touch))
                bg |= np.isin(cl, touch[widest <= r + 1.5])
        bg = ndimage.binary_closing(bg, iterations=1) | bg
        fg = ~near
        # specks of noise in the background (JPEG, scanner dust) become background
        fl, fn = ndimage.label(fg & ~bg, structure=EIGHT)
        if fn:
            sizes = ndimage.sum(np.ones_like(fl), fl, np.arange(1, fn + 1))
            tiny_ids = np.nonzero(sizes < max(12, 0.00003 * npx))[0] + 1
            if len(tiny_ids):
                around = ndimage.binary_dilation(bg, iterations=2)
                inside = ndimage.minimum(around, fl, tiny_ids) > 0
                bg |= np.isin(fl, tiny_ids[inside])
        fg = fg & ~bg
        holes = near & ~bg
    # parts of the subject, and rows of text among them
    fl, fn = ndimage.label(fg, structure=EIGHT)
    fboxes = _boxes(fl, fn)
    ys, xs = np.nonzero(fg | (holes if bg is not None else fg))
    if not len(ys):
        return dict(kind=model['kind'], bg=_rgb(model.get('main')), cut=None, all=None, notext=None, info=info)
    sx0, sy0, sx1, sy1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    S = max(sx1 - sx0, sy1 - sy0); subj_area = float((sx1 - sx0) * (sy1 - sy0))
    fsizes = ndimage.sum(np.ones_like(fl), fl, np.arange(1, fn + 1)) if fn else np.zeros(0)
    rows = text_rows(fboxes, S)
    glyph = np.zeros(fn + 1, bool)
    for row in rows: glyph[np.array(row) + 1] = True
    for i, (x0, y0, x1, y1) in enumerate(fboxes):      # a word drawn as one joined part
        w, h = x1 - x0, y1 - y0
        if h and w >= 2.2 * h and h <= 0.45 * S and fsizes[i] / (w * h) < 0.55: glyph[i + 1] = True
    info['text_rows'] = len(rows)

    if bg is not None:
        hl, hn = ndimage.label(holes)
        hboxes = _boxes(hl, hn)
        hsizes = ndimage.sum(np.ones_like(hl), hl, np.arange(1, hn + 1)) if hn else np.zeros(0)
        tiny = max(30, 0.00005 * npx)
        letters = set(i for row in text_rows([b if hsizes[k] >= tiny else (0, 0, 0, 0) for k, b in enumerate(hboxes)], S) for i in row)
        verdict = {}
        # background seen through a gap has the background's own colour: a gap whose mean colour is
        # clearly different (a light band, cream on white) is part of the design
        if hn:
            idx = np.arange(1, hn + 1); dev = np.zeros(hn)
            for ch in range(3):
                dev += (ndimage.mean(a[..., ch], hl, idx) - ndimage.mean(B[..., ch], hl, idx)) ** 2
            dev = np.sqrt(dev); tol_here = min(model['tols']) if 'tols' in model else model['tol']
        hwide = np.asarray(ndimage.maximum(ndimage.distance_transform_edt(holes), hl, np.arange(1, hn + 1))) if hn else np.zeros(0)
        for i in range(hn):
            if dev[i] > max(12.0, 0.45 * tol_here): verdict[i] = 'colour'
            elif hsizes[i] < tiny: verdict[i] = 'noise'
            elif hwide[i] <= max(2.5, r + 1.5): verdict[i] = 'slit'      # a hairline of background: a light line at 40 px
        # the rest: look at what surrounds each gap
        meas = {}
        for i in range(hn):
            if i in verdict: continue
            x0, y0, x1, y1 = hboxes[i]; eqr = float(np.sqrt(hsizes[i] / np.pi))
            pad = int(max(0.08 * S, 3 * eqr)) + 6
            cy0, cy1, cx0, cx1 = max(0, y0 - pad), min(H, y1 + pad), max(0, x0 - pad), min(W, x1 + pad)
            hm = hl[cy0:cy1, cx0:cx1] == i + 1
            dist = ndimage.distance_transform_edt(~hm)
            near_ring = (dist > 0) & (dist <= 2) & fg[cy0:cy1, cx0:cx1]
            cont = np.bincount(fl[cy0:cy1, cx0:cx1][near_ring], minlength=fn + 1); cont[0] = 0
            container = int(cont.argmax()) if cont.any() else 0
            fgc, bgc = fg[cy0:cy1, cx0:cx1], bg[cy0:cy1, cx0:cx1]
            T = None
            for k in range(1, pad - 2):
                ring = (dist > k - 1) & (dist <= k)
                if not ring.any(): break
                if fgc[ring].mean() < 0.5: T = k; break
            beyond = 0.0
            if T is not None:
                far = (dist > T) & (dist <= T + max(3, T))
                beyond = float(bgc[far].mean()) if far.any() else 0.0
            meas[i] = (container, T, beyond, eqr)
            if glyph[container]:
                # inside a letter: its counter, unless the gap is much bigger than the letter's own
                # ink (an outlined letter, whose inside is the letter itself)
                big_inside = i in letters and hsizes[i] >= 1.2 * fsizes[container - 1]
                verdict[i] = 'letter' if big_inside else 'counter'
            elif i in letters: verdict[i] = 'letter'          # letters written in the background colour
            elif hsizes[i] >= 0.04 * subj_area: verdict[i] = 'large'
        # pairs of similar gaps side by side: eyes
        cand = [i for i in meas if i not in verdict and hsizes[i] >= 0.0005 * subj_area]
        for p, i in enumerate(cand):
            for j in cand[p + 1:]:
                ri, rj = meas[i][3], meas[j][3]
                if max(hsizes[i], hsizes[j]) > 1.7 * min(hsizes[i], hsizes[j]): continue
                ci = ((hboxes[i][0] + hboxes[i][2]) / 2, (hboxes[i][1] + hboxes[i][3]) / 2)
                cj = ((hboxes[j][0] + hboxes[j][2]) / 2, (hboxes[j][1] + hboxes[j][3]) / 2)
                rr = max(ri, rj)
                if abs(ci[1] - cj[1]) <= 0.6 * rr and 1.5 * rr <= abs(ci[0] - cj[0]) <= 7 * rr:
                    verdict.setdefault(i, 'eyes'); verdict.setdefault(j, 'eyes')
        for i, (container, T, beyond, eqr) in meas.items():
            if i in verdict: continue
            thin = T is not None and T <= max(1.0 * eqr, 0.025 * S)
            small = hsizes[i] < 0.015 * subj_area             # letter-sized; bigger ones are kept (a screen, a face)
            verdict[i] = 'gap' if thin and small and beyond >= 0.4 else 'enclosed'
        CUT = ('noise', 'counter', 'gap', 'slit')
        removed = [i + 1 for i, v in verdict.items() if v in CUT]
        kept = [i + 1 for i, v in verdict.items() if v not in CUT]
        judged = {i: v for i, v in verdict.items() if hsizes[i] >= tiny}
        info.update(gaps_removed=sum(1 for v in judged.values() if v in CUT),
                    gaps_kept=sum(1 for v in judged.values() if v not in CUT),
                    kept=sorted(set(v for v in judged.values() if v not in CUT)))
        rm = bg | np.isin(hl, removed)
        cut = unblend(a, rm, B)
        big_kept = [k for k in kept if hsizes[k - 1] >= tiny]
        cut_all = unblend(a, bg | holes, B) if big_kept and sum(hsizes[k - 1] for k in big_kept) >= 0.003 * subj_area else None
    # without the text rows that lie outside the main part (a name line under a mascot)
    notext = None
    nontext = [i for i in range(1, fn + 1) if not glyph[i]]
    if rows and nontext:
        # the main part: every part that is not text and at least 5% of the largest such part
        top = max(fsizes[i - 1] for i in nontext)
        mains = [i for i in nontext if fsizes[i - 1] >= 0.05 * top]
        bx0 = min(fboxes[i - 1][0] for i in mains); by0 = min(fboxes[i - 1][1] for i in mains)
        bx1 = max(fboxes[i - 1][2] for i in mains); by1 = max(fboxes[i - 1][3] for i in mains); g = int(0.02 * S)
        drop = []
        for row in rows:
            rx0 = min(fboxes[i][0] for i in row); ry0 = min(fboxes[i][1] for i in row)
            rx1 = max(fboxes[i][2] for i in row); ry1 = max(fboxes[i][3] for i in row)
            if rx1 < bx0 - g or rx0 > bx1 + g or ry1 < by0 - g or ry0 > by1 + g: drop += [i + 1 for i in row]
        for i, (x0, y0, x1, y1) in enumerate(fboxes):       # joined words outside the main part
            if glyph[i + 1] and i + 1 not in drop and (x1 < bx0 - g or x0 > bx1 + g or y1 < by0 - g or y0 > by1 + g): drop.append(i + 1)
        if drop:
            # and the crumbs around the dropped text (dots, accents) outside the main part
            for i, (x0, y0, x1, y1) in enumerate(fboxes):
                if i + 1 not in drop and fsizes[i] < 0.01 * fsizes.sum() and (x1 < bx0 - g or x0 > bx1 + g or y1 < by0 - g or y0 > by1 + g): drop.append(i + 1)
            dropped = np.isin(fl, drop)
            rest = fg & ~dropped
            if rest.sum() >= 0.15 * fg.sum():
                cutoff = ndimage.binary_dilation(dropped, iterations=2) & ~ndimage.binary_dilation(rest, iterations=1)
                notext = cut.copy(); notext[cutoff] = 0
    return dict(kind=model['kind'], bg=_rgb(model.get('main')), cut=_img(cut), all=_img(cut_all), notext=_img(notext), info=info)


def _rgb(v):
    return None if v is None else tuple(int(round(float(x))) for x in v[:3])


def _img(arr):
    return None if arr is None else Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGBA')
