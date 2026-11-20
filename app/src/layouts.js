// layouts.js — panel geometry for Midnight Vice Cover Studio.
// Every layout is a function of the canvas size that returns panel rects
// as fractions of the canvas (x, y, w, h in 0..1), plus per-panel flags:
//   shear  — horizontal offset of the panel's top edge (slanted dividers)
//   popout — the panel is drawn larger than its cell, overflowing the frame
// The header band (quote + stars) lives above the art area and the tagline
// strip + billing block below it, so panels stay inside the art area.

const ART = { top: 0.058, bottom: 0.858 }; // art area as fractions of height

function grid(x0, y0, x1, y1, cols, rows, gx, gy) {
  const out = [];
  const cw = (x1 - x0 - gx * (cols - 1)) / cols;
  const ch = (y1 - y0 - gy * (rows - 1)) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push({
        x: x0 + c * (cw + gx),
        y: y0 + r * (ch + gy),
        w: cw,
        h: ch,
      });
    }
  }
  return out;
}

// Vice Mosaic: a tall hero panel on one side, six small panels beside it.
function mosaicPanels(W, H) {
  const gx = 0.008;
  const gy = 0.008;
  const top = ART.top;
  const bot = ART.bottom;
  if (H > W) {
    // Portrait: hero on top, 3x2 grid below.
    const heroH = (bot - top) * 0.44;
    const hero = [{ x: 0.012, y: top, w: 0.976, h: heroH }];
    return hero.concat(grid(0.012, top + heroH + gy, 0.988, bot, 3, 2, gx, gy));
  }
  const heroW = 0.292;
  const hero = [{ x: 0.012, y: top, w: heroW, h: bot - top }];
  return hero.concat(grid(0.012 + heroW + gx, top, 0.988, bot, 3, 2, gx, gy));
}

// Hero Center: one big centre panel, four corners, two bottom strips.
function centerPanels(W, H) {
  const gx = 0.008;
  const gy = 0.008;
  const top = ART.top;
  const bot = ART.bottom;
  const mid = top + (bot - top) * 0.62;
  if (H > W) {
    const hero = [{ x: 0.14, y: top + 0.02, w: 0.72, h: (bot - top) * 0.5 }];
    const corners = grid(0.012, top, 0.988, top + (bot - top) * 0.24, 2, 1, gx, gy);
    const bottom = grid(0.012, mid + 0.06, 0.988, bot, 2, 1, gx, gy);
    return [corners[0], corners[1], hero[0], bottom[0], bottom[1]].concat(
      grid(0.012, top + (bot - top) * 0.26, 0.14, mid + 0.04, 1, 1, gx, gy),
      grid(0.86, top + (bot - top) * 0.26, 0.988, mid + 0.04, 1, 1, gx, gy),
    );
  }
  const hero = [{ x: 0.285, y: top, w: 0.43, h: mid - top }];
  const tl = [{ x: 0.012, y: top, w: 0.265, h: mid - top }];
  const tr = [{ x: 0.723, y: top, w: 0.265, h: mid - top }];
  const bottom = grid(0.012, mid + gy, 0.988, bot, 4, 1, gx, gy);
  return [tl[0], hero[0], tr[0]].concat(bottom);
}

// Diagonal Slant: five panels with slanted dividers.
function slantPanels(W, H) {
  const top = ART.top;
  const bot = ART.bottom;
  const shear = 0.035; // top edge shifted right by 3.5% of width
  if (H > W) {
    const rows = grid(0.012, top, 0.988, bot, 1, 5, 0, 0.008);
    return rows.map((p, i) => ({ ...p, shear: i % 2 ? -shear : shear }));
  }
  const cols = grid(0.012, top, 0.988, bot, 5, 1, 0.008, 0);
  return cols.map((p, i) => ({ ...p, shear: i % 2 ? -shear : shear }));
}

// Pop-Out Hero: four panels behind, one hero overflowing its cell.
function popoutPanels(W, H) {
  const gx = 0.008;
  const gy = 0.008;
  const top = ART.top;
  const bot = ART.bottom;
  const back = grid(0.012, top, 0.988, bot, 2, 2, gx, gy);
  const hero =
    H > W
      ? { x: 0.2, y: top + (bot - top) * 0.22, w: 0.6, h: (bot - top) * 0.56, popout: true }
      : { x: 0.335, y: top + (bot - top) * 0.06, w: 0.33, h: (bot - top) * 0.88, popout: true };
  return back.concat([hero]);
}

// Film Strip: a row of five panels on top, two wide panels below.
function stripPanels(W, H) {
  const gx = 0.008;
  const gy = 0.008;
  const top = ART.top;
  const bot = ART.bottom;
  const split = top + (bot - top) * 0.52;
  if (H > W) {
    const upper = grid(0.012, top, 0.988, split, 2, 2, gx, gy);
    const lower = grid(0.012, split + gy, 0.988, bot, 1, 3, gx, gy);
    return upper.concat(lower);
  }
  const upper = grid(0.012, top, 0.988, split, 5, 1, gx, gy);
  const lower = grid(0.012, split + gy, 0.988, bot, 2, 1, gx, gy);
  return upper.concat(lower);
}

// Poster Grid: six equal panels, 3x2 (2x3 in portrait).
function posterPanels(W, H) {
  const gx = 0.008;
  const gy = 0.008;
  if (H > W) return grid(0.012, ART.top, 0.988, ART.bottom, 2, 3, gx, gy);
  return grid(0.012, ART.top, 0.988, ART.bottom, 3, 2, gx, gy);
}

export const LAYOUTS = [
  { id: 'mosaic', name: 'Vice Mosaic', panels: mosaicPanels, hint: 'Tall hero + six panels' },
  { id: 'center', name: 'Hero Center', panels: centerPanels, hint: 'Big centre hero' },
  { id: 'slant', name: 'Diagonal Slant', panels: slantPanels, hint: 'Slanted comic dividers' },
  { id: 'popout', name: 'Pop-Out Hero', panels: popoutPanels, hint: 'Hero breaks the frame' },
  { id: 'strip', name: 'Film Strip', panels: stripPanels, hint: 'Five up top, two below' },
  { id: 'poster', name: 'Poster Grid', panels: posterPanels, hint: 'Six equal panels' },
];

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) || LAYOUTS[0];
}

export function artArea() {
  return { ...ART };
}
