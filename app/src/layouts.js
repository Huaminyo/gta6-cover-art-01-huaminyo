// layouts.js — the six panel layouts of Midnight Vice Cover Studio.
//
// Every layout is a set of panels in unit coordinates (0..1 across the
// cover), each with the cast role it is meant to hold. The renderer turns
// these rects into clipped photo panels; `slant` shears a panel into a
// parallelogram for the Diagonal Slant layout, and `popout` marks the hero
// panel that overflows its frame in the Pop-Out Hero layout.

export const LAYOUTS = [
  {
    id: 'mosaic',
    name: 'Vice Mosaic',
    blurb: 'Tall hero on the left, six panels stacked on the right.',
    titleZone: { y: 0.8, align: 'left', width: 0.96 },
    panels: [
      { x: 0.015, y: 0.02, w: 0.4, h: 0.76, role: 'HERO', hero: true },
      { x: 0.425, y: 0.02, w: 0.28, h: 0.245, role: 'DRIVER' },
      { x: 0.715, y: 0.02, w: 0.27, h: 0.245, role: 'LOOKOUT' },
      { x: 0.425, y: 0.275, w: 0.28, h: 0.245, role: 'RIDER' },
      { x: 0.715, y: 0.275, w: 0.27, h: 0.245, role: 'BOSS' },
      { x: 0.425, y: 0.53, w: 0.28, h: 0.25, role: 'RIDE' },
      { x: 0.715, y: 0.53, w: 0.27, h: 0.25, role: 'CITY' },
    ],
  },
  {
    id: 'hero-center',
    name: 'Hero Center',
    blurb: 'One big hero in the middle, three panels on each side.',
    titleZone: { y: 0.8, align: 'center', width: 0.96 },
    panels: [
      { x: 0.3, y: 0.02, w: 0.4, h: 0.76, role: 'HERO', hero: true },
      { x: 0.015, y: 0.02, w: 0.275, h: 0.245, role: 'DRIVER' },
      { x: 0.015, y: 0.275, w: 0.275, h: 0.245, role: 'LOOKOUT' },
      { x: 0.015, y: 0.53, w: 0.275, h: 0.25, role: 'RIDE' },
      { x: 0.71, y: 0.02, w: 0.275, h: 0.245, role: 'RIDER' },
      { x: 0.71, y: 0.275, w: 0.275, h: 0.245, role: 'BOSS' },
      { x: 0.71, y: 0.53, w: 0.275, h: 0.25, role: 'CITY' },
    ],
  },
  {
    id: 'diagonal',
    name: 'Diagonal Slant',
    blurb: 'Five slanted bands slicing the cover corner to corner.',
    titleZone: { y: 0.82, align: 'left', width: 0.96 },
    panels: [
      { x: 0.015, y: 0.02, w: 0.3, h: 0.78, role: 'HERO', hero: true, slant: 0.06 },
      { x: 0.27, y: 0.02, w: 0.2, h: 0.78, role: 'DRIVER', slant: 0.06 },
      { x: 0.44, y: 0.02, w: 0.2, h: 0.78, role: 'RIDER', slant: 0.06 },
      { x: 0.61, y: 0.02, w: 0.2, h: 0.78, role: 'BOSS', slant: 0.06 },
      { x: 0.78, y: 0.02, w: 0.205, h: 0.78, role: 'CITY', slant: 0.06 },
    ],
  },
  {
    id: 'popout',
    name: 'Pop-Out Hero',
    blurb: 'The hero breaks out of the frame, over the title below.',
    titleZone: { y: 0.8, align: 'left', width: 0.96 },
    panels: [
      { x: 0.03, y: 0.03, w: 0.38, h: 0.72, role: 'HERO', hero: true, popout: true },
      { x: 0.425, y: 0.02, w: 0.28, h: 0.245, role: 'DRIVER' },
      { x: 0.715, y: 0.02, w: 0.27, h: 0.245, role: 'LOOKOUT' },
      { x: 0.425, y: 0.275, w: 0.28, h: 0.245, role: 'RIDER' },
      { x: 0.715, y: 0.275, w: 0.27, h: 0.245, role: 'BOSS' },
      { x: 0.425, y: 0.53, w: 0.28, h: 0.25, role: 'RIDE' },
      { x: 0.715, y: 0.53, w: 0.27, h: 0.25, role: 'CITY' },
    ],
  },
  {
    id: 'filmstrip',
    name: 'Film Strip',
    blurb: 'A sprocket-holed strip of five frames under the title.',
    titleZone: { y: 0.03, align: 'center', width: 0.96 },
    panels: [
      { x: 0.015, y: 0.24, w: 0.188, h: 0.5, role: 'HERO', hero: true },
      { x: 0.211, y: 0.24, w: 0.188, h: 0.5, role: 'DRIVER' },
      { x: 0.407, y: 0.24, w: 0.188, h: 0.5, role: 'RIDER' },
      { x: 0.603, y: 0.24, w: 0.188, h: 0.5, role: 'BOSS' },
      { x: 0.799, y: 0.24, w: 0.186, h: 0.5, role: 'CITY' },
      { x: 0.015, y: 0.76, w: 0.97, h: 0.14, role: 'RIDE', wide: true },
    ],
  },
  {
    id: 'poster-grid',
    name: 'Poster Grid',
    blurb: 'Six equal posters in a three-by-two grid.',
    titleZone: { y: 0.8, align: 'center', width: 0.96 },
    panels: [
      { x: 0.015, y: 0.02, w: 0.32, h: 0.37, role: 'HERO', hero: true },
      { x: 0.345, y: 0.02, w: 0.32, h: 0.37, role: 'DRIVER' },
      { x: 0.675, y: 0.02, w: 0.31, h: 0.37, role: 'LOOKOUT' },
      { x: 0.015, y: 0.4, w: 0.32, h: 0.38, role: 'RIDER' },
      { x: 0.345, y: 0.4, w: 0.32, h: 0.38, role: 'BOSS' },
      { x: 0.675, y: 0.4, w: 0.31, h: 0.38, role: 'CITY' },
    ],
  },
];

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}

// Panel rects in pixels for a cover of W x H.
export function panelRects(layout, W, H) {
  return layout.panels.map((p) => ({
    x: p.x * W,
    y: p.y * H,
    w: p.w * W,
    h: p.h * H,
    role: p.role,
    hero: !!p.hero,
    popout: !!p.popout,
    wide: !!p.wide,
    slant: (p.slant ?? 0) * W,
  }));
}
