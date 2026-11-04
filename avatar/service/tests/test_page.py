#!/usr/bin/env python3
"""Browser test of the upload page against a running service (Playwright + Chromium).

    DEV_PAGE=../../site/avatars.html RATE=1000 python3 service.py &      (from avatar/service)
    python3 tests/test_page.py http://127.0.0.1:8080 tests/logos/*.png [--shots <dir>]

Checks: the form's own errors (no team, no logo, no consent, a file that isn't an image), an
SVG rasterised in the browser, every logo given, the option downloads and the zip, an offline
service (a mocked 502), Caddy's 413, the team lookup (404 and 500 mocked), and the layout at
phone width. Exits non-zero on the first failure. Needs Chromium: python3 -m playwright install chromium
"""
import io, os, sys, zipfile
from PIL import Image
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
args = sys.argv[1:]
shots = None
if '--shots' in args:
    i = args.index('--shots'); shots = args[i + 1]; del args[i:i + 2]; os.makedirs(shots, exist_ok=True)
base, logos = args[0].rstrip('/'), args[1:]
svg, junk = os.path.join(HERE, 'testdata/robot.svg'), os.path.join(HERE, 'testdata/not-an-image.png')
errors = []

def check(cond, what):
    print(('ok   ' if cond else 'FAIL ') + what)
    if not cond: sys.exit(1)

def make(page, team, path, consent=True):
    page.fill('#team', str(team))
    page.set_input_files('#file', path)
    if path != junk:
        page.wait_for_function("name => document.querySelector('#drop-text').textContent.startsWith(name)", arg=os.path.basename(path))
    if consent: page.check('#own')
    else: page.uncheck('#own')
    page.click('#make')

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1280, 'height': 900})
    page.on('console', lambda m: m.type == 'error' and errors.append(m.text))
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(base + '/avatars')

    # the form's own checks, before anything is sent
    page.click('#make'); check('team number' in page.text_content('#status'), 'asks for a team number')
    page.fill('#team', '23452'); page.click('#make'); check('logo first' in page.text_content('#status'), 'asks for a logo')
    page.set_input_files('#file', junk); page.wait_for_function("document.querySelector('#status').classList.contains('bad') && document.querySelector('#status').textContent.includes('open')")
    check("can't open this file" in page.text_content('#status'), 'refuses a file that is not an image')
    make(page, 23452, svg, consent=False); check('own logo' in page.text_content('#status'), 'asks to confirm it is their own logo')

    # an SVG without width and height, drawn at 1024 px in the browser
    page.check('#own'); page.click('#make')
    page.wait_for_selector('#results:not([hidden]) .opt', timeout=60000)
    n = page.locator('.opt').count(); check(n >= 2, f'SVG logo: {n} option cards')

    # every logo given
    for path in logos:
        make(page, 23452, path)
        page.wait_for_function("!document.querySelector('#make').disabled", timeout=60000)
        st = page.text_content('#status')
        n = page.locator('.opt').count()
        first = page.get_attribute('.opt:not(.current) .px', 'src')   # the first option, not the current avatar
        check(st == '' and n >= 1 and first != globals().get('last_first'), f'{os.path.basename(path)}: {n} option cards {st!r}')
        globals()['last_first'] = first
        if shots:
            page.screenshot(path=os.path.join(shots, f'desktop-{os.path.basename(path)}.png'), full_page=True)

    # downloads: one option PNG and the zip
    with page.expect_download() as d:
        page.locator('.opt .dl a').first.click()
    im = Image.open(d.value.path())
    check(im.size == (40, 40) and im.format == 'PNG' and d.value.suggested_filename.endswith('-avatar-40.png'), f'option download {d.value.suggested_filename} is a 40 x 40 PNG')
    with page.expect_download() as d:
        page.click('#zip')
    names = zipfile.ZipFile(d.value.path()).namelist()
    check(any(x.endswith('-options.png') for x in names) and 'HOW-TO-UPLOAD.txt' in names, f'zip {d.value.suggested_filename}: {len(names)} files')

    # the service is down: the proxy answers 502 with an HTML page; and Caddy's own 413
    page.route('**/api/avatar/options*', lambda r: r.fulfill(status=502, body='<html>Bad gateway</html>', content_type='text/html'))
    page.click('#make'); page.wait_for_function("!document.querySelector('#make').disabled")
    check('offline' in page.text_content('#status'), 'says the service is offline on a 502')
    page.unroute('**/api/avatar/options*')
    page.route('**/api/avatar/options*', lambda r: r.fulfill(status=413, body='', content_type='text/plain'))
    page.click('#make'); page.wait_for_function("!document.querySelector('#make').disabled")
    check('too large' in page.text_content('#status'), "says the file is too large on Caddy's 413")
    page.unroute('**/api/avatar/options*')

    # the team lookup: FTCScout doesn't know the number (404) / FTCScout has trouble (500)
    answer = lambda code: (lambda route: route.fulfill(status=code, body='{}', content_type='application/json'))
    for code, expect in ((404, "doesn't know"), (500, '')):
        page.route('**/teams/*/card', answer(code))
        page.fill('#team', ''); page.fill('#team', '99999'); page.wait_for_timeout(1200)
        hint = page.text_content('#team-hint')
        check((expect in hint) if expect else hint == '', f'team lookup answered {code}: hint {hint!r}')
        page.unroute('**/teams/*/card')

    # phone width
    phone = browser.new_context(**p.devices['iPhone 13']).new_page()
    phone.on('pageerror', lambda e: errors.append(str(e)))
    phone.goto(base + '/avatars')
    make(phone, 23452, logos[0] if logos else svg)
    phone.wait_for_selector('#results:not([hidden]) .opt', timeout=60000)
    wide = phone.evaluate('document.documentElement.scrollWidth > window.innerWidth')
    check(not wide, 'no sideways scrolling at phone width')
    if shots:
        phone.screenshot(path=os.path.join(shots, 'phone.png'), full_page=True)
    browser.close()

# config.js only exists on the real site, and the team lookup can't reach FTCScout from a sandbox
real = [e for e in errors if 'config.js' not in e and 'Failed to load resource' not in e and 'ERR_' not in e]
check(not real, f'no script errors {real}')
