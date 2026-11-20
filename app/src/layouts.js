// Midnight Vice Cover Studio — panel layouts.
//
// Every layout is drawn on a 12 x 12 grid so one definition adapts to
// landscape, portrait and square output. A panel is { x, y, w, h } in grid
// units, plus an optional slant (horizontal shear of the top edge, in grid
// units) and an optional bleed (how far the panel spills past the canvas
// edge on the left / top, for the pop-out hero look).
//
// Wide rects are used for landscape output; tall rects for portrait and
// square output, where a side column would squeeze the panels too thin.

export const GRID = 12;

export const LAYOUTS = [
  {
    id: "midnight-hero",
    name: "Midnight Hero",
    blurb: "One dominant panel, three supporting shots.",
    wide: [
      { x: 0, y: 0, w: 7, h: 12, bleed: { l: 0.45, t: 0.45 } },
      { x: 7.25, y: 0, w: 4.75, h: 3.9 },
      { x: 7.25, y: 4.05, w: 4.75, h: 3.9 },
      { x: 7.25, y: 8.1, w: 4.75, h: 3.9 },
    ],
    tall: [
      { x: 0, y: 0, w: 12, h: 6.9, bleed: { l: 0.45, t: 0.45 } },
      { x: 0, y: 7.15, w: 3.9, h: 4.85 },
      { x: 4.05, y: 7.15, w: 3.9, h: 4.85 },
      { x: 8.1, y: 7.15, w: 3.9, h: 4.85 },
    ],
  },
  {
    id: "neon-slash",
    name: "Neon Slash",
    blurb: "Diagonal comic-book cuts, three tall strips.",
    wide: [
      { x: 0, y: 0, w: 4.4, h: 12, slant: 0.9 },
      { x: 3.95, y: 0, w: 4.4, h: 12, slant: 0.9 },
      { x: 7.9, y: 0, w: 4.1, h: 12, slant: 0.9 },
    ],
    tall: [
      { x: 0, y: 0, w: 4.4, h: 12, slant: 0.9 },
      { x: 3.95, y: 0, w: 4.4, h: 12, slant: 0.9 },
      { x: 7.9, y: 0, w: 4.1, h: 12, slant: 0.9 },
    ],
  },
  {
    id: "nine-grid",
    name: "Nine Grid",
    blurb: "Three by three equal frames.",
    wide: [
      { x: 0, y: 0, w: 3.9, h: 3.9 }, { x: 4.05, y: 0, w: 3.9, h: 3.9 }, { x: 8.1, y: 0, w: 3.9, h: 3.9 },
      { x: 0, y: 4.05, w: 3.9, h: 3.9 }, { x: 4.05, y: 4.05, w: 3.9, h: 3.9 }, { x: 8.1, y: 4.05, w: 3.9, h: 3.9 },
      { x: 0, y: 8.1, w: 3.9, h: 3.9 }, { x: 4.05, y: 8.1, w: 3.9, h: 3.9 }, { x: 8.1, y: 8.1, w: 3.9, h: 3.9 },
    ],
    tall: [
      { x: 0, y: 0, w: 3.9, h: 3.9 }, { x: 4.05, y: 0, w: 3.9, h: 3.9 }, { x: 8.1, y: 0, w: 3.9, h: 3.9 },
      { x: 0, y: 4.05, w: 3.9, h: 3.9 }, { x: 4.05, y: 4.05, w: 3.9, h: 3.9 }, { x: 8.1, y: 4.05, w: 3.9, h: 3.9 },
      { x: 0, y: 8.1, w: 3.9, h: 3.9 }, { x: 4.05, y: 8.1, w: 3.9, h: 3.9 }, { x: 8.1, y: 8.1, w: 3.9, h: 3.9 },
    ],
  },
  {
    id: "solo-frame",
    name: "Solo Frame",
    blurb: "One photo edge to edge, poster style.",
    wide: [{ x: 0, y: 0, w: 12, h: 12 }],
    tall: [{ x: 0, y: 0, w: 12, h: 12 }],
  },
  {
    id: "double-take",
    name: "Double Take",
    blurb: "Two panels, lead and echo.",
    wide: [
      { x: 0, y: 0, w: 7, h: 12, bleed: { l: 0.3, t: 0.3 } },
      { x: 7.25, y: 0, w: 4.75, h: 12 },
    ],
    tall: [
      { x: 0, y: 0, w: 12, h: 6.9, bleed: { l: 0.3, t: 0.3 } },
      { x: 0, y: 7.15, w: 12, h: 4.85 },
    ],
  },
  {
    id: "four-corners",
    name: "Four Corners",
    blurb: "Two by two, an ensemble sheet.",
    wide: [
      { x: 0, y: 0, w: 5.9, h: 5.9 }, { x: 6.1, y: 0, w: 5.9, h: 5.9 },
      { x: 0, y: 6.1, w: 5.9, h: 5.9 }, { x: 6.1, y: 6.1, w: 5.9, h: 5.9 },
    ],
    tall: [
      { x: 0, y: 0, w: 5.9, h: 5.9 }, { x: 6.1, y: 0, w: 5.9, h: 5.9 },
      { x: 0, y: 6.1, w: 5.9, h: 5.9 }, { x: 6.1, y: 6.1, w: 5.9, h: 5.9 },
    ],
  },
];

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) || LAYOUTS[0];
}

// Pixel rects for a canvas of w x h. `tall` is true for portrait/square
// output (aspect below 1.2). A rect is { x, y, w, h, slantPx, bleed } in
// pixels; slantPx shears the top edge right by that many pixels.
export function panelRects(layoutId, w, h) {
  const layout = layoutById(layoutId);
  const tall = w / h < 1.2;
  const defs = tall ? layout.tall : layout.wide;
  const gx = w / GRID;
  const gy = h / GRID;
  return defs.map((p) => {
    const bleed = p.bleed || { l: 0, t: 0 };
    return {
      x: (p.x - bleed.l) * gx,
      y: (p.y - bleed.t) * gy,
      w: (p.w + bleed.l) * gx,
      h: (p.h + bleed.t) * gy,
      slantPx: (p.slant || 0) * gx,
      bleed: bleed.l > 0 || bleed.t > 0,
    };
  });
}

// Clip path for one panel rect: a parallelogram when slanted, a plain
// rectangle otherwise. The shear leans the top edge right.
export function clipPanel(ctx, r) {
  ctx.beginPath();
  if (r.slantPx) {
    const s = r.slantPx;
    ctx.moveTo(r.x + s, r.y);
    ctx.lineTo(r.x + r.w + s, r.y);
    ctx.lineTo(r.x + r.w, r.y + r.h);
    ctx.lineTo(r.x, r.y + r.h);
  } else {
    ctx.rect(r.x, r.y, r.w, r.h);
  }
  ctx.closePath();
  ctx.clip();
}

// The title zone: the bottom band where the big lettering sits. Panels
// whose label chip would land inside it skip the chip.
export function titleZone(w, h) {
  return { x: 0, y: h * 0.7, w: w * 0.62, h: h * 0.3 };
}
