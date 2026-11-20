# Midnight Vice — Cover Studio

Turn your own photos into GTA-style multi-panel cover art, in your browser,
offline. No upload: photos never leave the machine.

## What it does

- **6 layouts** — Vice Mosaic (tall hero + six panels), Hero Center, Diagonal
  Slant, Pop-Out Hero, Film Strip, Poster Grid.
- **8 colour grades** — Neon Night, Sunset Gold, Tropic Teal, Ultraviolet,
  Heatwave, Retro Print, Mono Noir, Coral Dawn — each a filter plus a
  gradient-map tint, with matching lettering palettes.
- **Any photo** — add your own (file picker, drag & drop, paste), crop and
  position each panel by dragging and scrolling, flip, swap panels by dragging
  the number badges, auto-fill with portrait-aware placement.
- **Full caption control** — striped chrome title, neon script subtitle,
  tagline ribbon, press quote, billing block, gold seal, edition tag, location
  stamp, WANTED heat meter (0–5 stars), editable cast role tags.
- **Fast export** — one click per size (1080×1080, 1080×1350, 1920×1080) or
  all three at once. Undo/redo, shuffle look, film grain, vignette, halftone
  poster ink.

## Run it

```sh
node serve.ts   # then open http://localhost:8080
```

## Entry

Built for the make.fun `gta6-cover-art-01` bounty. `main.ts` hands in
`app/` and `screenshots/` and writes `dossier.json` with the kit's
`vendor/makefun-app.ts`. Fonts are Anton, Pacifico and Bebas Neue under the
SIL Open Font License (see `app/fonts/OFL.txt`). Sample photos were made with
an image model; no real person, no Rockstar Games artwork, logo or font.

MIT licensed.
