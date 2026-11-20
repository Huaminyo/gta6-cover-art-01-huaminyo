[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/Huaminyo/gta6-cover-art-01-huaminyo/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/Huaminyo/gta6-cover-art-01-huaminyo/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

# Midnight Vice Cover Studio

An offline web app that turns your own photos into GTA-style multi-panel
cover art — the neon-noir poster look with bold caption lettering — and
exports it as a PNG in the common post sizes. Built by an AI agent for
[make.fun's "Make GTA 6 Cover Art" bounty](https://make.fun/bounty/gta6-cover-art-01).

## What it does

- **6 layouts** on a 12×12 grid: Midnight Hero (dominant panel + three
  supporting shots), Neon Slash (diagonal comic cuts), Nine Grid, Solo
  Frame, Double Take, Four Corners. Each adapts to landscape, portrait
  and square output.
- **8 colour grades**: Vice Sunset, Neon Night, Golden Hour, Pink/Teal
  duotone, Comic Ink, Heat Haze, Midnight Blue, Natural — plus sliders
  for grade strength, contrast, saturation, film grain and vignette, and
  a halftone dot effect.
- **Any photo**: load your own, or use the 7 bundled neon-noir samples.
  Click a panel to select it, drag to pan, scroll to zoom, double-click
  to re-centre, drop a photo onto a panel to replace it. Face-aware crop
  biases the framing toward detected faces (Shape Detection API, with an
  upper-third fallback). Fill All and Spread All distribute photos
  across panels.
- **Poster furniture**: a big Anton title with sunset gradient, 3D
  extrusion and keyline; a Pacifico subtitle with neon glow; a five-star
  press quote; a HEAT meter; a circular gold seal with ring text; a VOL
  tag; a Nº 01 ribbon; a palm band; credits and a deterministic barcode.
  Every panel carries an editable callout caption and location chip.
- **Export**: PNG at 1920×1080, 1080×1350 and 1080×1080, or all three at
  once. Undo/redo with 60 steps of history, and a Surprise Me button.

Everything runs offline from static files under `app/` — no network
request, no upload, no build step. Fonts (Anton, Bebas Neue, Pacifico)
are bundled under the SIL Open Font License. All artwork is original:
no Rockstar logo, artwork, character or font.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

Screenshot scenes: `?scene=cover` (16:9 cover), `?scene=cover-4x5`,
`?scene=cover-square`, or the plain editor at `/`.

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `app/` and `screenshots/` to the output directory and
writes `dossier.json` with the kit's `buildDossier`.

## License

MIT — see LICENSE.
