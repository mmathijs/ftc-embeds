# Avatar project files (`.ftcavatar`)

The [avatar maker](avatar-maker.md)'s editor saves a project as a `.ftcavatar` file: JSON with the logo's layers (PNG data URIs) and everything done to them, so the same 40 × 40 avatar can be made again, on any computer. Open one on [ftc-embeds.com/avatars](https://ftc-embeds.com/avatars) (the button, a drop on the page, or `/avatars?open=<address of the file>`), or render it without the editor with [`AvatarEditor.render`](#rendering-without-the-editor).

A small complete file: [example.ftcavatar](example.ftcavatar) (open it: [ftc-embeds.com/avatars?open=https://ftc-embeds.com/docs/example.ftcavatar](https://ftc-embeds.com/avatars?open=https://ftc-embeds.com/docs/example.ftcavatar)). The JSON Schema: [ftcavatar.schema.json](ftcavatar.schema.json).

## Units

- **Source pixels**: the pixels of the layers (`layers.w` × `layers.h`, at most 768 on the long side when the server made them). The logo edits (`doc.logoOps`) use these.
- **Canvas units**: the editor draws on a 320 × 320 canvas, 8 × 8 units for every pixel of the 40 × 40 result. `doc.t` places the logo on it (canvas = source × `s` + (`x`, `y`)), and the drawings (`doc.draw`) and the frame's radius use these.
- **Avatar pixels**: `doc.border` and `frame.ringWidth` are in pixels of the 40 × 40 result (one avatar pixel is 8 canvas units).
- Colours are `#rrggbb`.

## The file

| Field | |
| --- | --- |
| `format` | `"ftc-embeds-avatar"` |
| `version` | `1`. The editor refuses files with a higher version. |
| `saved` | when it was saved, ISO 8601 |
| `label` | the option it started from ("Whole logo") or a name |
| `team` | the team number as typed (a string), or `null` |
| `base` | the start of the file names: `23452-tiewraps-whole` gives `23452-tiewraps-whole-avatar-40.png` |
| `preset` | where the server's option started (`src`, `s`, `x`, `y`, `bg`, `border`, and `frame` and `adjust` when it used them): what **Start over** goes back to. May be `null`. |
| `layers` | the logo as the server prepared it: `{ w, h, kind, bg, layers }` |
| `doc` | the avatar: see below |
| `active` | the id of the layer that was selected |
| `versions` | saved versions: `[{ id, name, time, doc, active, op, tr }]` with `doc` a JSON string of a `doc`, `time` in ms since 1970, and `op` / `tr` the 40 × 40 PNGs (data URIs) at the time |

`layers.layers` has a PNG data URI for every source, all `w` × `h`: `logo` (the original, always there), `cut` (the background and letter gaps cut out), and when the server found them `all` (every enclosed gap cut out), `main` (the main part only) and `notext` (without the rows of text). `layers.kind` is the background the server found (`alpha`, `flat`, `palette`, `gradient` or `none`) and `layers.bg` its colour, or `null`.

## The avatar (`doc`)

| Field | |
| --- | --- |
| `src` | which of `layers.layers` the logo layer starts from |
| `t` | `{ s, x, y }`: the logo's place on the canvas (canvas units = source pixels × `s` + (`x`, `y`)) |
| `bg` | the opaque version's background |
| `border` | the transparent version's border around the logo, 0 to 3 avatar pixels (0: none) |
| `borderColour` | the border's colour; `""` means `bg` |
| `edges` | the transparent version's edges: `"smooth"` (default) or `"pixel"` (no half-transparent pixels; older files may say `"crisp"`, which is the same) |
| `filter` | how the canvas becomes 40 × 40: absent for smooth (Lanczos-3, for logos and photos), `"box"` for pixel art (each 8 × 8 block averaged, so drawings on the grid come out as drawn) |
| `frame` | `{ "type": "none" }`; `{ "type": "circle", r, ring, ringWidth, fill }`: a circle badge of radius `r` (canvas units) filled with `fill`, in a ring of colour `ring`, `ringWidth` avatar pixels wide, the logo clipped to the circle; or `{ "type": "rounded" }`: the transparent version as a tile in `bg` with corners of 4 avatar pixels |
| `adjust` | `{ brightness, contrast, saturate, colours }`: 1, 1, 1 and 0 change nothing; `colours` 2 to 32 limits the logo to that many flat colours |
| `logoOps` | the edits of the logo layer, in order, in source pixels (below) |
| `draw` | the drawings, in canvas units (below) |
| `layers` | the layers, bottom first: `[{ id, name, kind, vis, opacity }]` with `kind` `"logo"` (exactly one) or `"draw"`. New documents have `under` (Behind the logo), `logo` and `over` (Drawing). |

### Logo edits (`logoOps`)

Applied to the `src` layer one after the other. `clip`, when there, is a polygon `[[x, y], …]` (source pixels) the edit stays inside.

| `k` | Fields | |
| --- | --- | --- |
| `"erase"` | `pts`, `r`, `clip` | a round brush of radius `r` along the points `[[x, y], …]`: transparent there |
| `"restore"` | `pts`, `r`, `clip` | the same brush, painting the original `logo` layer back |
| `"wand"` | `mode`, `x`, `y`, `tol`, `contig`, `clip` | the magic wand at the integer pixel (`x`, `y`): the pixels of the **original** logo within `tol` (RGB distance) of its colour, only the connected ones when `contig`. `mode` `"erase"` cuts them out (and takes that colour out of the pixels along the cut, so no fringe stays); `"restore"` brings them back |
| `"area"` | `poly`, `invert`, `restore` | inside the polygon (outside it with `invert`) transparent, or with `restore` the original logo back inside it |

### Drawings (`draw`)

Each has an `id` (a number), the `layer` it's on (a `"draw"` layer's id) and maybe a `clip` polygon (canvas units).

| `k` | Fields | |
| --- | --- | --- |
| `"stroke"` | `mode`, `pts`, `w`, `colour` | a brush stroke `w` wide through `pts`, with round ends and joins (smoothed through the points' midpoints). `mode` `"paint"` draws in `colour`; `"erase"` removes what's under it on this layer |
| `"path"` | `nodes`, `closed`, `stroke`, `fill`, `w`, `radius`, `shape`, `box`, `params` | a Bézier path: from one node to the next with the control points (`ox`, `oy`) of the first and (`ix`, `iy`) of the next; a corner has its handles on its own point. `fill` (closed paths) and `stroke` (`w` wide) are colours or `null`. `radius` rounds the corners. `shape`, `box` and `params` say which shape tool drew it, so the editor can draw it again with other settings; without them it's a free path |
| `"image"` | `src`, `iw`, `ih`, `s`, `x`, `y` | a part of the logo lifted with Select: a PNG data URI of `iw` × `ih` source pixels, drawn at (`x`, `y`) scaled by `s` |
| `"area"` | `poly`, `invert` | removes what's on this layer inside the polygon (outside it with `invert`) |

## How the 40 × 40 PNGs are made

1. On the 320 × 320 canvas: the opaque version starts with `bg`; a circle frame draws its ring and its inside and clips what follows to the circle; a rounded frame (transparent version only) fills a rounded square with `bg`.
2. The layers, bottom first, each with its `opacity` and skipped when `vis` is false: the logo layer is the `src` layer with its `logoOps` and `adjust`, placed by `t`; a drawing layer is its drawings in order.
3. The transparent version gets its border: a soft round outline of `border` avatar pixels around everything drawn, in `borderColour` (or `bg`), under it.
4. Both are shrunk to 40 × 40 with premultiplied alpha (Lanczos-3, or the 8 × 8 average with `filter: "box"`). In the transparent one, pixels under 20/255 alpha become fully transparent, and with smooth edges every pixel inside the shape becomes solid.

## Rendering without the editor

On any page that loads `https://ftc-embeds.com/avatar-editor.js` (in a browser, or a headless one):

```js
const project = await (await fetch("https://ftc-embeds.com/docs/example.ftcavatar")).json();
const { opaque, transparent, warnings, bytes } = await AvatarEditor.render(project);           // data URIs
const older = await AvatarEditor.render(project, { version: "Version 1" });                      // a saved version
```

`render` takes the parsed object, its JSON text or the file itself, and gives exactly the PNGs the editor would download, with its notes (`warnings`: FIRST's limits, lime or magenta pixels, half-transparent pixels, empty bands). On ftc-embeds.com/avatars an agent can do the same with the `avatar_render_project` tool.

## Making files yourself

A file needs at least `format`, `version`, `layers` (with `layers.logo`) and `doc`. Leave out `versions` and `preset` if you have none. Keep drawings meant to be pixel art on the grid (multiples of 8 canvas units) and set `filter: "box"`. Fields whose names start with `_` are never saved (the editor keeps caches there).
