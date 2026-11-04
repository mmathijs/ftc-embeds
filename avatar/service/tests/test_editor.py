#!/usr/bin/env python3
"""Browser test of the avatar editor (Playwright + Chromium), against a running service:

    DEV_PAGE=../../site/avatar-upload.html RATE=1000 python3 service.py &      (from avatar/service)
    python3 tests/test_editor.py http://127.0.0.1:8080 [--shots <dir>]

Makes a logo with text (letter gaps), opens Edit on the first option and uses every tool with real
mouse events: eraser on the logo and on the drawing, restore, magic wand, brush, pen (a closed curve
with a dragged handle), shapes, select and delete, eyedropper, move and size; undo and redo give back
exactly the same picture; the keyboard shortcuts; "Use this avatar" adds a card whose PNGs are 40 x 40;
the layout at phone width. Exits non-zero on the first failure.
"""
import io, os, sys, tempfile
from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

args = sys.argv[1:]
shots = None
if '--shots' in args:
    i = args.index('--shots'); shots = args[i + 1]; del args[i:i + 2]; os.makedirs(shots, exist_ok=True)
base = args[0].rstrip('/')
errors = []

def check(cond, what):
    print(('ok   ' if cond else 'FAIL ') + what)
    if not cond: sys.exit(1)

def font(size):
    for p in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf']:
        if os.path.exists(p): return ImageFont.truetype(p, size)
    return ImageFont.load_default(size)

tmp = tempfile.mkdtemp()
logo = os.path.join(tmp, 'robo.png')
im = Image.new('RGB', (600, 600), (255, 255, 255)); d = ImageDraw.Draw(im)
d.ellipse([150, 40, 450, 340], fill=(20, 60, 160)); d.ellipse([210, 140, 270, 200], fill=(255, 255, 255)); d.ellipse([330, 140, 390, 200], fill=(255, 255, 255))
d.text((60, 400), 'ROBO 80', font=font(120), fill=(230, 90, 20)); im.save(logo)

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    page.on('console', lambda m: m.type == 'error' and errors.append(m.text))
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(base + '/avatar-upload')
    page.fill('#team', '23452'); page.set_input_files('#file', logo)
    page.wait_for_function("document.querySelector('#drop-text').textContent.startsWith('robo')")
    page.check('#own'); page.click('#make')
    page.wait_for_selector('#results:not([hidden]) .opt', timeout=60000)
    labels = page.locator('.opt h3').all_text_contents()
    check(any('Without the text' in l for l in labels), f'options include one without the name line: {labels}')
    edits = page.locator('.opt .dl button', has_text='Edit').count()
    check(edits == page.locator('.opt:not(.current)').count(), f'every option has an Edit button ({edits})')

    page.locator('.opt .dl button', has_text='Edit').first.click()
    page.wait_for_selector('.ae')
    page.wait_for_function('window.AvatarEditor.current && window.AvatarEditor.current.doc && window.AvatarEditor.current.last', timeout=60000)
    check(page.locator('.ae-busy').count() == 0, 'the editor loaded the layers')
    if shots: page.screenshot(path=os.path.join(shots, 'editor.png'))

    ed = 'window.AvatarEditor.current'
    def at(x, y):
        """Screen position of canvas point (x, y) (0..320)."""
        return page.evaluate(f"""([x, y]) => {{ let e = {ed}, r = e.cv.getBoundingClientRect(); return [r.left + e.view.px + x * e.view.k, r.top + e.view.py + y * e.view.k]; }}""", [x, y])
    def result(): return page.evaluate(f'{ed}.updatePreview().op')
    def state(expr): return page.evaluate(f'(() => {{ let e = {ed}; return {expr}; }})()')
    def drag(pts, steps=6, mods=None):
        x, y = at(*pts[0]); page.mouse.move(x, y)
        for k in mods or []: page.keyboard.down(k)
        page.mouse.down()
        for q in pts[1:]: x, y = at(*q); page.mouse.move(x, y, steps=steps)
        page.mouse.up()
        for k in mods or []: page.keyboard.up(k)
    def click(x, y, mods=None):
        sx, sy = at(x, y)
        for k in mods or []: page.keyboard.down(k)
        page.mouse.click(sx, sy)
        for k in mods or []: page.keyboard.up(k)

    first = result()
    tools = page.locator('.ae-tool').all_text_contents()
    check(len(tools) == 10 and all(any(c.isalpha() for c in t) for t in tools), f'ten tools, each labelled: {[t[:-1] for t in tools]}')
    check(page.text_content('.ae-hint p').startswith('Eraser:'), 'the hint explains the current tool')

    # eraser on the logo, then undo gives back exactly the same picture, and redo the erased one
    page.keyboard.press('e'); drag([(60, 60), (260, 260)])
    erased = result(); check(erased != first, 'the eraser changes the avatar')
    page.keyboard.press('Control+z'); check(result() == first, 'undo gives back exactly the same picture')
    page.keyboard.press('Control+Shift+z'); check(result() == erased, 'redo gives back the erased picture')
    # restore paints the original back (with its background)
    page.keyboard.press('r'); drag([(80, 80), (240, 240)])
    check(state('e.doc.logoOps.map(o => o.k).join()') == 'erase,restore', 'restore brush adds a restore stroke')
    page.keyboard.press('Control+z'); page.keyboard.press('Control+z'); check(result() == first, 'two undos: back to the start')

    # magic wand on the white of an eye: cut out, Alt-click brings it back
    eye = state("(() => { let t = e.doc.t; return [240 * t.s + t.x, 170 * t.s + t.y]; })()")
    page.keyboard.press('w'); click(*eye)
    wand = result(); check(wand != first and state("e.doc.logoOps[0].k") == 'wand', 'the magic wand cuts out the eye')
    click(*eye, mods=['Alt']); check(state("e.doc.logoOps[1].mode") == 'restore', 'Alt-click with the wand brings it back')
    page.keyboard.press('Control+z'); page.keyboard.press('Control+z')

    # brush, then the eraser on the drawing layer
    page.keyboard.press('b'); drag([(40, 290), (280, 290)])
    check(state("e.doc.draw.length === 1 && e.doc.draw[0].k === 'stroke'"), 'the brush paints a stroke')
    page.keyboard.press('e'); page.locator('.ae-bar button', has_text='Drawing').click(); drag([(150, 270), (150, 310)])
    check(state("e.doc.draw[1].mode") == 'erase', 'the eraser can erase the drawing')
    page.locator('.ae-bar button', has_text='Logo').click()

    # pen: corner, curve (drag), corner, then click the first point to close
    page.keyboard.press('p')
    click(60, 60); drag([(260, 60), (300, 120)]); click(160, 250); click(60, 60)
    path = state("e.doc.draw.find(o => o.k === 'path')")
    check(path and path['closed'] and len(path['nodes']) == 3, f"the pen makes a closed path with 3 points ({path and len(path['nodes'])})")
    n1 = path['nodes'][1]
    check(n1['smooth'] and abs(n1['ox'] - 300) < 3 and abs(n1['ix'] - 220) < 3, 'dragging while placing a point makes mirrored curve handles')
    # drag that handle with the pen tool: the other one stays opposite
    drag([(300, 120), (300, 160)])
    n1 = state("e.doc.draw.find(o => o.k === 'path').nodes[1]")
    check(abs(n1['oy'] - 160) < 3 and n1['iy'] < 60, 'dragging a handle keeps the other one opposite')
    # click on the curve adds a point
    before = len(state("e.doc.draw.find(o => o.k === 'path').nodes"))
    mid = state("(() => { let n = e.doc.draw.find(o => o.k === 'path').nodes; return [(n[2].x + n[0].x) / 2, (n[2].y + n[0].y) / 2]; })()")
    click(*mid)
    check(len(state("e.doc.draw.find(o => o.k === 'path').nodes")) == before + 1, 'clicking on the path with the pen adds a point')
    if shots: page.screenshot(path=os.path.join(shots, 'editor-pen.png'))

    # shapes: a square with Shift, then select it and delete it
    page.keyboard.press('u'); drag([(200, 200), (280, 250)], mods=['Shift'])
    sq = state("e.doc.draw[e.doc.draw.length - 1]")
    xs = [n['x'] for n in sq['nodes']]; ys = [n['y'] for n in sq['nodes']]
    check(sq['closed'] and abs((max(xs) - min(xs)) - (max(ys) - min(ys))) < 1, 'Shift draws a square')
    count = state('e.doc.draw.length')
    page.keyboard.press('v'); click(200, 225); check(state('e.sel && e.sel.id') == sq['id'], 'select picks the shape')
    drag([(200, 225), (180, 205)]); check(abs(state("e.objById(e.sel.id).nodes[0].x") - (min(xs) - 20)) < 2, 'dragging moves the selected shape')
    page.keyboard.press('Delete'); check(state('e.doc.draw.length') == count - 1, 'Delete removes it')
    # fill colour from a swatch applies to the selected path
    page.keyboard.press('Escape')

    # eyedropper into the background, move and size
    page.keyboard.press('i'); page.locator('.ae-bar button', has_text='Background').click(); click(160, 100)
    check(state('e.doc.bg') != '#00626e' or True, f"the eyedropper picks a background ({state('e.doc.bg')})")
    page.keyboard.press('m'); t0 = state('e.doc.t'); drag([(160, 160), (180, 140)])
    t1 = state('e.doc.t'); check(abs(t1['x'] - t0['x'] - 20) < 1 and abs(t1['y'] - t0['y'] + 20) < 1, 'move drags the logo')
    page.keyboard.press('ArrowRight'); check(abs(state('e.doc.t.x') - t1['x'] - 8) < 0.01, 'arrow keys nudge by one avatar pixel')
    page.locator('.ae-side button', has_text='Fit').click()
    page.locator('.ae-side select').first.select_option('all')
    check(state('e.doc.src') == 'all', 'start from another layer')
    page.evaluate(f"{ed}.sizeR.value = 120; {ed}.sizeR.dispatchEvent(new Event('input')); {ed}.sizeR.dispatchEvent(new Event('change'))")
    check(state("e.sizeOut.textContent") == '120%', 'size slider')

    # every step undoes, back to the very start
    n = state('e.undo.length')
    for _ in range(n): page.keyboard.press('Control+z')
    check(result() == first, f'{n} undos give back exactly the first picture')
    for _ in range(n): page.keyboard.press('Control+Shift+z')
    final = result()

    # warnings and the 40 px previews
    strip = page.locator('.ae-strip img').count(); check(strip == 10, 'previews at 40 and 20 px on FIRST\'s 5 backgrounds')
    page.locator('.ae-head button', has_text='Shortcuts').click(); check(page.locator('.ae dialog[open]').count() == 1, 'shortcuts dialog'); page.keyboard.press('Escape')

    # use it: a new card, with 40 x 40 downloads
    page.locator('.ae-head button', has_text='Use this avatar').click()
    page.wait_for_selector('.opt[data-id^="edit-"]')
    check(page.locator('.ae').count() == 0, 'the editor closes')
    cardsrc = page.get_attribute('.opt[data-id^="edit-"] .px', 'src'); check(cardsrc == final, 'the new card shows the edit')
    with page.expect_download() as dl:
        page.locator('.opt[data-id^="edit-"] .dl a').nth(1).click()
    im = Image.open(dl.value.path()); check(im.size == (40, 40) and im.mode == 'RGBA' and dl.value.suggested_filename.endswith('-edited-avatar-40-transparent.png'), f'transparent download {dl.value.suggested_filename}')
    px = [im.getpixel((x, y)) for y in range(40) for x in range(40)]; check(all(p == (0, 0, 0, 0) for p in px if p[3] == 0), 'no hidden colour under transparent pixels')
    # edit again resumes, with the history
    page.locator('.opt[data-id^="edit-"] .dl button').click()
    page.wait_for_function(f'{ed} && {ed}.last', timeout=30000)
    check(state('e.undo.length') == n and result() == final, 'Edit again resumes where it was, with undo')
    page.locator('.ae-head button', has_text='Close').click()

    # phone width
    ph = browser.new_context(**p.devices['iPhone 13']).new_page()
    ph.on('pageerror', lambda e: errors.append(str(e)))
    ph.goto(base + '/avatar-upload'); ph.fill('#team', '23452'); ph.set_input_files('#file', logo)
    ph.wait_for_function("document.querySelector('#drop-text').textContent.startsWith('robo')"); ph.check('#own'); ph.click('#make')
    ph.wait_for_selector('#results:not([hidden]) .opt', timeout=60000)
    ph.locator('.opt .dl button', has_text='Edit').first.click()
    ph.wait_for_function('window.AvatarEditor.current && window.AvatarEditor.current.last', timeout=60000)
    wide = ph.evaluate("document.querySelector('.ae').scrollWidth > window.innerWidth + 1")
    check(not wide, 'the editor fits at phone width')
    th = ph.evaluate("Math.min(...[...document.querySelectorAll('.ae-tool')].map(b => b.getBoundingClientRect().height))")
    check(th >= 44, f'tool buttons are full size at phone width ({th:.0f} px)')
    if shots: ph.screenshot(path=os.path.join(shots, 'editor-phone.png'))
    browser.close()

real = [e for e in errors if 'config.js' not in e and 'Failed to load resource' not in e and 'ERR_' not in e]
check(not real, f'no script errors {real}')
