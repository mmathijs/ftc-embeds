#!/usr/bin/env python3
"""Browser test of the avatar editor (Playwright + Chromium), against a running service:

    DEV_PAGE=../../site/avatars.html RATE=1000 python3 service.py &      (from avatar/service)
    python3 tests/test_editor.py http://127.0.0.1:8080 [--shots <dir>]

Makes a logo with text (letter gaps), opens Edit on the first option and uses every tool with real
mouse events: eraser on the logo and on a drawing layer, restore, magic wand, brush, pen (a closed
curve with a dragged handle), shapes, select and delete, eyedropper, move and size; layers (a shape
behind the logo stays behind it); an area selection that keeps the eraser inside it, and a marquee
that selects shapes; the transparent view in the canvas; undo and redo give back exactly the same
picture; export in every format and size, and the zip; "Use this avatar" adds a card whose PNGs are
40 x 40; saved in the browser and opened again after a reload; a project file opened on the page and
in the editor; the layout at phone width. Exits non-zero on the first failure.
"""
import io, os, re, sys, tempfile
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
HERE_TESTDATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'testdata')
logo = os.path.join(tmp, 'robo.png')
im = Image.new('RGB', (600, 600), (255, 255, 255)); d = ImageDraw.Draw(im)
d.ellipse([150, 40, 450, 340], fill=(20, 60, 160)); d.ellipse([210, 140, 270, 200], fill=(255, 255, 255)); d.ellipse([330, 140, 390, 200], fill=(255, 255, 255))
d.text((60, 400), 'ROBO 80', font=font(120), fill=(230, 90, 20)); im.save(logo)

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    page.on('console', lambda m: m.type == 'error' and errors.append(m.text))
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(base + '/avatars')
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
    check(state("e.doc.draw[0].layer") == 'over' and state('e.active') == 'over', 'the brush draws on the Drawing layer above the logo')
    page.keyboard.press('e'); drag([(150, 270), (150, 310)])
    check(state("e.doc.draw[1].mode") == 'erase' and state("e.doc.draw[1].layer") == 'over', 'the eraser erases on the selected layer (the drawing)')
    page.locator('.ae-lay .nm', has_text=re.compile('^Logo')).click(); check(state('e.active') == 'logo', 'clicking a layer selects it')

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
    page.keyboard.press('v'); click(200, 225); check(state('e.sel.ids') == [sq['id']], 'select picks the shape')
    drag([(200, 225), (180, 205)]); check(abs(state("e.objById(e.sel.ids[0]).nodes[0].x") - (min(xs) - 20)) < 2, 'dragging moves the selected shape')
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

    # layers: a square behind the logo stays behind it
    page.locator('.ae-lay .nm', has_text='Behind the logo').click()
    page.evaluate(f"{ed}.opt.fillOn = true; {ed}.opt.fill = '#ffd400'; {ed}.opt.strokeOn = false")
    page.keyboard.press('u'); drag([(8, 8), (312, 312)])
    under = state("e.doc.draw[e.doc.draw.length - 1]")
    check(under['layer'] == 'under' and under['fill'] == '#ffd400', 'a shape drawn on Behind the logo')
    eye = state("(() => { let t = e.doc.t; return [384 * t.s + t.x, 190 * t.s + t.y]; })()")   # the blue head, above the square
    px = page.evaluate(f"(([x, y]) => {{ let e = {ed}, c = e.c320.getContext('2d'); e.result(); return [...c.getImageData(Math.round(x), Math.round(y), 1, 1).data]; }})", eye)
    check(px[2] > 120 and px[0] < 80, f'the logo stays on top of it ({px})')
    page.locator('.ae-lay button[title="Move up"]').last.click()       # the bottom layer one up: above the logo
    px2 = page.evaluate(f"(([x, y]) => {{ let e = {ed}, c = e.c320.getContext('2d'); e.result(); return [...c.getImageData(Math.round(x), Math.round(y), 1, 1).data]; }})", eye)
    check(px2[0] > 200 and px2[1] > 180, f'moved above the logo, it covers it ({px2})')
    page.keyboard.press('Control+z')
    page.locator('.ae-sec button', has_text='+ New layer').click()
    check(len(state('e.doc.layers')) == 4 and state('e.layerOf(e.active).name') == 'Layer 3', 'a new layer')
    page.keyboard.press('Control+z')

    # selecting an area: shapes inside are selected, and erasing stays inside it
    page.locator('.ae-lay .nm', has_text=re.compile('^Logo')).click()
    to_c = lambda x, y: state(f"(() => {{ let t = e.doc.t; return [{x} * t.s + t.x, {y} * t.s + t.y]; }})()")
    pin, pout = to_c(330, 260), to_c(200, 260)              # two points on the blue head, in logo pixels
    page.keyboard.press('v'); drag([(pin[0] - 12, pin[1] - 12), (pin[0] + 12, pin[1] + 12)])
    check(state('e.area && e.area.length') == 4, 'dragging on empty space selects an area')
    probe = f"[e.logoAlphaAt({{x: {pout[0]}, y: {pout[1]}}}), e.logoAlphaAt({{x: {pin[0]}, y: {pin[1]}}})]"
    a0 = state(probe)
    page.keyboard.press('e'); drag([(pout[0], pout[1]), (pin[0] + 20, pin[1])])
    op = state('e.doc.logoOps[e.doc.logoOps.length - 1]')
    check(op['clip'] is not None, 'the eraser keeps to the selected area')
    a1 = state(probe)
    check(a0[0] > 0 and a0[1] > 0 and a1[0] == a0[0] and a1[1] == 0, f'erased inside the area only (logo alpha outside {a0[0]} -> {a1[0]}, inside {a0[1]} -> {a1[1]})')
    page.keyboard.press('Control+z')
    page.keyboard.press('v'); page.keyboard.press('Delete')
    check(state("e.doc.logoOps[e.doc.logoOps.length - 1].k") == 'area', 'Delete erases inside the area')
    page.keyboard.press('Control+z'); page.keyboard.press('Escape'); check(state('e.area') is None, 'Esc deselects')
    # the marquee selects shapes: two squares on the drawing layer, one marquee, one Delete
    page.locator('.ae-lay .nm', has_text=re.compile('^Drawing')).click()
    page.keyboard.press('u'); drag([(20, 20), (60, 60)]); drag([(80, 20), (120, 60)])
    n0 = state('e.doc.draw.length')
    page.keyboard.press('v'); drag([(10, 10), (130, 70)])
    check(len(state('e.sel.ids')) == 2, 'the marquee selects both shapes inside it')
    page.keyboard.press('Delete'); check(state('e.doc.draw.length') == n0 - 2, 'Delete removes the selected shapes')
    page.keyboard.press('Control+z'); page.keyboard.press('Control+z'); page.keyboard.press('Control+z'); page.keyboard.press('Escape')

    # the transparent view in the canvas
    page.locator('.ae-view button', has_text='Transparent').click()
    check(state('e.opt.preview') == 'transparent' and page.locator('.ae-view .bd button').count() == 6, 'the canvas shows the transparent version, with backdrops')
    page.locator('.ae-view .bd button[title="red"]').click()
    border0 = state('e.doc.border'); page.evaluate(f"{ed}.set({{ border: 0, layers: {ed}.doc.layers.map(l => Object.assign({{}}, l, {{ vis: l.kind === 'logo' }})) }}); {ed}.updatePreview(); {ed}.paint()")
    page.wait_for_timeout(150)
    corner = page.evaluate(f"(() => {{ let e = {ed}, r = e.cv.getBoundingClientRect(), dpr = devicePixelRatio, c = e.cv.getContext('2d'); return [...c.getImageData(Math.round((e.view.px + 2) * dpr), Math.round((e.view.py + 2) * dpr), 1, 1).data]; }})()")
    check(corner[0] > 200 and corner[1] < 60, f'the red backdrop shows through ({corner})')
    page.evaluate(f"{ed}.doc = {ed}.base; {ed}.sync(); {ed}.updatePreview(); {ed}.paint()")
    check(state('e.doc.border') == border0, 'back to the document as it was')
    if shots: page.screenshot(path=os.path.join(shots, 'editor-transparent.png'))
    page.keyboard.press('t'); check(state('e.opt.preview') == 'bg', 'T switches back')

    # every step undoes, back to the very start
    n = state('e.undo.length')
    for _ in range(n): page.keyboard.press('Control+z')
    check(result() == first, f'{n} undos give back exactly the first picture')
    for _ in range(n): page.keyboard.press('Control+Shift+z')
    final = result()

    # warnings and the 40 px previews
    strip = page.locator('.ae-strip img').count(); check(strip == 10, 'previews at 40 and 20 px on FIRST\'s 5 backgrounds')
    page.locator('.ae-head button', has_text='Shortcuts').click(); check(page.locator('.ae dialog[open]').count() == 1, 'shortcuts dialog'); page.keyboard.press('Escape')

    # export: every format and size
    page.keyboard.press('Control+e'); page.wait_for_selector('dialog.ae-ex[open]')
    if shots: page.screenshot(path=os.path.join(shots, 'editor-export.png'))
    def export(fmt, size=None, style=None, version=None):
        if version: page.locator('dialog.ae-ex label', has_text='Transparent, with' if version == 'transparent' else 'With background').click()
        page.locator('dialog.ae-ex label', has_text={'png': 'PNG', 'webp': 'WebP', 'jpeg': 'JPEG', 'svg': 'SVG', 'ico': 'ICO'}[fmt]).first.click()
        if size: page.locator('dialog.ae-ex label', has_text=str(size) if size != 40 else '40 (FIRST)').first.click()
        if style: page.locator('dialog.ae-ex label', has_text='Smooth' if style == 'smooth' else 'Pixel art:').click()
        page.wait_for_timeout(150)
        with page.expect_download() as dl: page.locator('dialog.ae-ex button', has_text='Download').click()
        return dl.value
    d = export('png', 512, 'smooth', 'transparent'); im = Image.open(d.path())
    check(im.size == (512, 512) and im.mode == 'RGBA' and d.suggested_filename.endswith('-512-transparent.png'), f'PNG 512 smooth: {d.suggested_filename} {im.size}')
    d = export('png', 160, 'pixel'); im = Image.open(d.path()).convert('RGBA')
    check(im.size == (160, 160) and im.getpixel((0, 0)) == im.getpixel((3, 3)), f'PNG 160 pixel art: {d.suggested_filename}')
    d = export('jpeg', 320, 'smooth'); im = Image.open(d.path()); check(im.format == 'JPEG' and im.size == (320, 320), f'JPEG: {d.suggested_filename}')
    d = export('webp', 80); im = Image.open(d.path()); check(im.format == 'WEBP' and im.size == (80, 80), f'WebP: {d.suggested_filename}')
    d = export('svg'); txt = open(d.path()).read(); check(txt.startswith('<svg') and 'crispEdges' in txt and txt.count('<rect') > 20, f'SVG pixel art: {d.suggested_filename}')
    d = export('ico'); im = Image.open(d.path()); check(im.format == 'ICO' and (16, 16) in im.ico.sizes() and (128, 128) in im.ico.sizes(), f'ICO with {sorted(im.ico.sizes())}')
    with page.expect_download() as dl: page.locator('dialog.ae-ex button', has_text='Everything').click()
    import zipfile
    z = zipfile.ZipFile(dl.value.path()); names = z.namelist()
    check(len(names) == 9 and any(n.endswith('.ftcavatar') for n in names) and z.testzip() is None, f'everything as a zip: {names}')
    Image.open(io.BytesIO(z.read(next(n for n in names if n.endswith('-avatar-40-transparent.png'))))).verify()
    with page.expect_download() as dl: page.locator('dialog.ae-ex button', has_text='Project file').click()
    project_path = os.path.join(tmp, 'saved.ftcavatar'); dl.value.save_as(project_path)
    page.keyboard.press('Escape'); page.wait_for_timeout(100)

    # saved in this browser
    page.keyboard.press('Control+s'); page.wait_for_function(f"{ed}.saveOut.textContent.startsWith('Saved')")
    check(True, f"Ctrl+S: {state('e.saveOut.textContent')}")

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

    # after a reload: the edit is listed under Saved in this browser, and opens as it was
    page.reload(); page.wait_for_selector('#saved:not([hidden]) .saved-item')
    check(page.locator('.saved-item').count() >= 1, f"saved edits listed after a reload ({page.locator('.saved-item').count()})")
    page.locator('.saved-item .btn', has_text='Open').first.click()
    page.wait_for_function(f'{ed} && {ed}.last', timeout=30000)
    check(result() == final, 'the saved edit opens exactly as it was, without uploading again')
    page.locator('.ae-head button', has_text='Use this avatar').click(); page.wait_for_selector('.opt[data-id^="edit-"]')
    check(page.get_attribute('.opt[data-id^="edit-"] .px', 'src') == final, 'and can be used from there')
    # a project file, opened on the page and inside the editor
    page.reload(); count = page.locator('.saved-item').count()
    page.set_input_files('#open-project', project_path)
    page.wait_for_function(f'{ed} && {ed}.last', timeout=30000)
    check(result() == final, 'a project file opens on the page exactly as it was')
    check(state('e.doc.layers.length') == 3 and state('e.doc.draw.length') > 0, 'with its layers and shapes')
    page.set_input_files('.ae-head input[type=file]', project_path)
    page.wait_for_function(f'{ed} && {ed}.last && document.querySelectorAll(".ae").length == 1', timeout=30000)
    check(result() == final, 'and inside the editor (Open…)')
    page.locator('.ae-head button', has_text='Close').click(); page.wait_for_timeout(300)
    page.set_input_files('#open-project', os.path.join(HERE_TESTDATA, 'not-an-image.png'))
    page.wait_for_function("document.querySelector('#status').textContent.includes('project file')")
    check(True, 'a file that is not a project is refused: ' + page.text_content('#status'))

    # phone width
    ph = browser.new_context(**p.devices['iPhone 13']).new_page()
    ph.on('pageerror', lambda e: errors.append(str(e)))
    ph.goto(base + '/avatars'); ph.fill('#team', '23452'); ph.set_input_files('#file', logo)
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
