# Avatar maker (`ftc-embeds.com/avatars`)

Makes a FIRST Tech Challenge team's FIRST avatar from its logo: up to eight 40 × 40 options, each as a PNG with a background and a transparent PNG, checked against FIRST's rules (40 × 40 PNG, at most 20 kB, no colours near lime or magenta, which video overlays key out) and shown at 40 and 20 px on FIRST's backgrounds. An editor (eraser, restore brush, magic wand, brush, pen, shapes, layers, versions) finishes any of them. Nothing is stored: the browser sends the logo once and the server answers the options; edits stay in the browser, or in a [project file](avatar-format.md).

The options are made by the service in `avatar/service` of this repository (see its README for how it judges backgrounds, letter gaps and text); none of it is in the npm package.

## Links

| Link | |
| --- | --- |
| `/avatars?team=23452` | fills in the team number (names the files, shows the team's current avatar) |
| `/avatars?logo=<address>` | loads the logo from that address (PNG, JPEG, WebP, GIF or SVG) |
| `/avatars?open=<address>` | opens a `.ftcavatar` project file from that address in the editor |

The browser fetches `logo` and `open` itself, so they work from sites that allow it: GitHub (`raw.githubusercontent.com`), most image hosts and CDNs. The visitor still ticks "This is our team's own logo" before anything is made. For example: [/avatars?open=https://ftc-embeds.com/docs/example.ftcavatar](https://ftc-embeds.com/avatars?open=https://ftc-embeds.com/docs/example.ftcavatar).

## API

`POST https://ftc-embeds.com/api/avatar/options?team=<number>` with the logo as the raw body (PNG, JPEG, WebP or GIF, at most 10 MB and 25 megapixels; the page sends a PNG of at most 1024 px). `team` is optional. At most 10 uploads per visitor in 10 minutes.

```bash
curl -s --data-binary @logo.png -H 'Content-Type: image/png' 'https://ftc-embeds.com/api/avatar/options?team=23452&images=none'
curl -s --data-binary @logo.png -H 'Content-Type: image/png' -o avatars.zip 'https://ftc-embeds.com/api/avatar/options?team=23452&format=zip'
```

| Parameter | |
| --- | --- |
| `team` | the team number: its name and current avatar from FTCScout, and file names like `23452-tiewraps-…` |
| `format=zip` | the zip itself (every PNG, a comparison sheet, HOW-TO-UPLOAD.txt) instead of JSON |
| `images=none` | the JSON without the images: a few kB instead of 100 to 500 kB |
| `layers=only` | the editor's layers instead of options: `{ w, h, kind, bg, layers }`, about 1.5 MB (see [the format](avatar-format.md)) |

The JSON answer:

```json
{
  "team": 23452, "name": "TieWraps", "base": "23452-tiewraps",
  "current": "data:image/png;base64,…", "currentSha256": "9f2c…", "currentPixelSha256": "5c38…",
  "kind": "flat", "flat": true, "info": { "gaps_removed": 6, "gaps_kept": 2, "text_rows": 1, "kept": ["eyes"] },
  "options": [{
    "id": "whole", "label": "Whole logo", "note": "Background removed in the transparent version, kept as a thin border",
    "bg": "#000000", "opaque": "data:image/png;base64,…", "transparent": "data:image/png;base64,…",
    "bytes": [2741, 3466], "sha256": ["3b1a…", "c07e…"], "pixelSha256": ["a460…", "77d2…"],
    "warnings": ["There's an empty band of 7 px on the left."],
    "files": ["23452-tiewraps-whole-avatar-40.png", "23452-tiewraps-whole-avatar-40-transparent.png"],
    "edit": { "src": "cut", "s": 0.41, "x": 12.5, "y": 8, "bg": "#000000", "border": 1.1 }
  }],
  "zip": "data:application/zip;base64,…", "ms": 640
}
```

`current` is the team's current FIRST avatar (from FTCScout). With `images=none`, `current`, `opaque`, `transparent` and `zip` are left out and `hasCurrent` says whether the team has an avatar. `warnings` are notes worth a look, not errors: the options all follow FIRST's file rules unless a note says otherwise. Errors are `{ "error": "<a sentence>" }` with 400, 413, 415, 429 or 503.

### Hashes

Every PNG comes with two SHA-256 hashes, so comparing avatars needs no images:

- `sha256`, `currentSha256`: of the file.
- `pixelSha256`, `currentPixelSha256`: of the pixels: the image decoded to 8-bit RGBA, row by row from the top left, with fully transparent pixels as 0, 0, 0, 0. A file saved again by another program (other chunks, compression or colour type) keeps it. FIRST's avatars look re-saved (they carry none of the chunks editors write), so to see whether a team uploaded one of these avatars, compare `pixelSha256`.

### Which teams use an avatar

`GET https://ftcscout-api.mmathijs.nl/rest/embeds/v1/events/{season}/{code}/avatars` lists every team at an event with its current FIRST avatar (FTCScout's copy) and the same two hashes:

```json
{ "data": {
  "event": { "season": 2025, "code": "NLHAQ", "name": "Qualifier Hasselt" }, "withAvatar": 8,
  "teams": [
    { "teamNumber": 19444, "name": "Lorentz Engineering", "versions": 1,
      "avatar": { "url": "https://ftcscout-api.mmathijs.nl/avatars/19444_9c51….png", "season": 2025, "since": "2026-11-05T11:11:56Z",
                  "stored": true, "deleted": false, "bytes": 3655, "sha256": "8d02…", "pixelSha256": "5f21…" } },
    { "teamNumber": 14183, "name": "The Dukes of Brabant", "versions": 0, "avatar": null }
  ] } }
```

A team whose `avatar.pixelSha256` equals one of the files you made uploaded that file. `since` is when FTCScout first saw that version (it checks FIRST every 12 hours; FTCScout started keeping versions on 5 November 2026, so avatars it already had show that day), `versions` how many avatars the team has had over every season, and `stored` is false (with no hashes) until FTCScout has its copy of a new avatar. An unknown event answers `"event": null`.

### Checking a finished avatar

`POST https://ftc-embeds.com/api/avatar/check` with any image as the body (at most 1 MB; 120 checks per visitor in 10 minutes) answers FIRST's rules, the notes the editor gives, and both hashes:

```json
{
  "format": "PNG", "width": 40, "height": 40, "bytes": 3466, "transparent": true,
  "firstRules": { "png": true, "size40": true, "under20kB": true, "noLimeOrMagenta": true }, "followsFirstRules": true,
  "notes": ["3 fully transparent pixels still have a colour."],
  "sha256": "c07e…", "pixelSha256": "77d2…"
}
```

The notes: not a still PNG, not 40 × 40, over 20 kB, colours near lime or magenta, colours hidden under fully transparent pixels, half-transparent pixels inside the avatar, an empty avatar, a logo that uses too little of the square or leaves an empty band.

## For AI agents

The page offers its steps and its editor as tools: through [WebMCP](https://github.com/webmachinelearning/webmcp) (`navigator.modelContext`) where the browser or an extension provides it, and always as `window.ftcEmbedsAgent` (`list()`, `call(name, input)`) for agents that can run JavaScript in the page. They return JSON, and images (8× zoomed, so the pixels show) where there's something to look at.

| Tool | |
| --- | --- |
| `avatar_maker_status` | the team, the logo, the options shown, the edits saved in this browser |
| `avatar_set_logo` | the logo from a web address (or a `.ftcavatar` to open) |
| `avatar_make_options` | make the options; `ownLogoConfirmed` ticks the own-logo box, only when the user said so |
| `avatar_get_option` | one option as images, with its hashes (`current`: the team's current avatar); `dataUris: true` adds the PNGs |
| `avatar_download` | save an option's PNG, its transparent PNG, or the zip |
| `avatar_open_editor` | edit an option, or a saved edit |
| `avatar_render_project` | render a `.ftcavatar` (address or JSON) without opening it; `dataUris: true` adds the PNGs |
| `avatar_check_png` | check any finished avatar (address or data URI) against FIRST's rules, with its hashes |
| `avatar_event_fingerprints` | every team at an event with its current avatar's hashes, marked where it matches an option on the page |
| `avatar_editor_state` | everything about the open editor, with the result as images |
| `avatar_editor_set` | background, border, edges, shrinking (smooth or pixel art), logo source and size, frame, brightness, contrast, saturation, colours |
| `avatar_editor_place`, `avatar_editor_move` | fit, fill, centre or cut at the bottom; move by avatar pixels |
| `avatar_editor_wand`, `avatar_editor_erase` | cut out an area of one colour; erase (or restore) a rectangle or ellipse |
| `avatar_editor_draw_shape`, `avatar_editor_draw_line`, `avatar_editor_delete_shapes` | draw and remove shapes and brush strokes |
| `avatar_editor_layers`, `avatar_editor_history` | add, change, clear and pick layers; undo, redo, start over |
| `avatar_editor_colour_at` | the colour of the result and of the logo at a point |
| `avatar_editor_save`, `avatar_editor_export`, `avatar_editor_close` | save (and keep a version), get the PNGs or the project file (`includeJson: true` returns its JSON too), close (and use the edit) |

Positions are in avatar pixels: 0 to 40 from the top left of the result.

```js
await ftcEmbedsAgent.call("avatar_set_logo", { url: "https://raw.githubusercontent.com/…/logo.png" });
const { options } = await ftcEmbedsAgent.call("avatar_make_options", { team: "23452", ownLogoConfirmed: true });
await ftcEmbedsAgent.call("avatar_open_editor", { id: options[0].id });
await ftcEmbedsAgent.call("avatar_editor_set", { background: "#16264a", border: 1.2 });
await ftcEmbedsAgent.call("avatar_editor_wand", { x: 20.5, y: 18 });
const { dataUri } = await ftcEmbedsAgent.call("avatar_editor_export", { kind: "transparent" });
```

To check a project file without a page of your own, `AvatarEditor.render(project)` gives the two PNGs exactly as the editor makes them ([rendering without the editor](avatar-format.md#rendering-without-the-editor)).

## Upload it to FIRST

1. Lead Mentor 1 or 2 logs in at [ftc-scoring.firstinspires.org](https://ftc-scoring.firstinspires.org).
2. Choose **Team Avatar**, then **Upload New Avatar**, and pick one PNG.
3. Upload at least 2 weeks before your event. Changes can take up to 24 hours to show.
4. One submission at a time, and FIRST may not review more than three a season. See [FIRST's avatar rules](https://www.firstinspires.org/community-blog/team-avatars).
