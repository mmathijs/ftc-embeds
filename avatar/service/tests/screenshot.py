#!/usr/bin/env python3
"""Makes the homepage screenshot of the avatar editor, site/img/avatar-editor.webp, against a
running service (Playwright + Chromium). Uses the made-up robot in tests/testdata, never a team's logo.

    DEV_PAGE=../../site/avatars.html python3 service.py &        (from avatar/service)
    python3 tests/screenshot.py http://127.0.0.1:8080
"""
import io, math, os, re, sys, tempfile
from PIL import Image
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(HERE, '../../../site/img/avatar-editor.webp')
base = sys.argv[1].rstrip('/')

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1440, 'height': 900}, color_scheme='light')
    page.goto(base + '/avatars')
    # only the robot's head: no body, no lettering
    svg = re.sub(r'<text[^>]*>.*?</text>', '', open(os.path.join(HERE, 'testdata/robot.svg')).read(), flags=re.S)
    svg = re.sub(r'<rect x="30" y="130"[^>]*/>', '', svg)
    logo = os.path.join(tempfile.mkdtemp(), 'robot.svg'); open(logo, 'w').write(svg)
    page.fill('#team', '23452'); page.set_input_files('#file', logo)
    page.wait_for_function("document.querySelector('#drop-text').textContent.startsWith('robot')")
    page.check('#own'); page.click('#make')
    page.wait_for_selector('#results:not([hidden]) .opt', timeout=60000)
    page.locator('.opt .dl button', has_text='Edit').first.click()
    ed = 'window.AvatarEditor.current'
    page.wait_for_function(f'{ed} && {ed}.last', timeout=60000)
    # teal, the head big and a little low, so the star shows around it; no hint box
    page.evaluate(f"{ed}.setSize(0.68); {ed}.set({{ bg: '#00626e', t: Object.assign({{}}, {ed}.doc.t, {{ y: {ed}.doc.t.y + 0 }}) }}); {ed}.commit()")
    page.add_style_tag(content='.ae-hint p { visibility: hidden !important; }')
    DY = 24
    at = lambda x, y: page.evaluate(f"([x, y]) => {{ let e = {ed}, r = e.cv.getBoundingClientRect(); return [r.left + e.view.px + x * e.view.k, r.top + e.view.py + y * e.view.k]; }}", [x, y])
    # a yellow star behind the logo, drawn with the pen: sharp outer points (clicks) and curved
    # inner points (dragged), so the curve handles show
    page.locator('.ae-lay .nm', has_text='Behind the logo').click()
    page.evaluate(f"Object.assign({ed}.opt, {{ fillOn: true, fill: '#ffc93c', strokeOn: false }})")
    page.keyboard.press('p')
    cx, cy, R, r, H = 160, 178, 156, 92, 44
    pts = []
    for k in range(10):
        a = math.radians(-90 + 36 * k); rad = R if k % 2 == 0 else r
        pts.append((cx + rad * math.cos(a), cy + rad * math.sin(a), a, k % 2 == 1))
    for x, y, a, curved in pts:
        sx, sy = at(x, y)
        if curved:      # drag along the direction of travel: a smooth point with mirrored handles
            page.mouse.move(sx, sy); page.mouse.down(); page.mouse.move(*at(x - H * math.sin(a), y + H * math.cos(a)), steps=4); page.mouse.up()
        else:
            page.mouse.click(sx, sy)
    pts = [(x, y) for x, y, _, _ in pts]
    page.mouse.click(*at(*pts[0]))                  # close the shape
    page.mouse.move(*at(300, 40))
    page.evaluate("document.querySelector('.ae-side').scrollTop = 0")
    page.wait_for_function(f"{ed}.saveOut.textContent.startsWith('Saved')", timeout=10000)
    page.wait_for_timeout(300)
    png = page.screenshot()
    browser.close()
Image.open(io.BytesIO(png)).convert('RGB').save(out, 'WEBP', quality=82, method=6)
print(out, os.path.getsize(out), 'bytes')
