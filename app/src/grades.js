// grades.js — the eight colour grades of Midnight Vice Cover Studio.
//
// A grade is a complete look: the canvas filter applied to every panel
// photo, the tint washes laid over the panels, and the palette the
// lettering, frames and furniture draw from. Grades are the app's own
// invention — no palette is taken from any game's artwork.

export const GRADES = [
  {
    id: 'neon-night',
    name: 'Neon Night',
    filter: 'saturate(1.45) contrast(1.14) brightness(0.96) hue-rotate(-12deg)',
    tint: [
      'rgba(12, 4, 40, 0.30)',
      'rgba(236, 72, 153, 0.12)',
      'rgba(34, 211, 238, 0.10)',
    ],
    frame: '#0d0620',
    titleStops: ['#a5f3fc', '#f0abfc', '#fbbf24', '#ec4899'],
    titleOutline: '#0a0318',
    script: '#f9a8d4',
    accent: '#22d3ee',
    strip: ['#1e1045', '#be185d', '#f59e0b'],
    tag: '#0a0518',
  },
  {
    id: 'sunset-gold',
    name: 'Sunset Gold',
    filter: 'sepia(0.34) saturate(1.5) contrast(1.08) brightness(1.03)',
    tint: [
      'rgba(255, 140, 0, 0.18)',
      'rgba(219, 39, 119, 0.10)',
      'rgba(40, 0, 30, 0.14)',
    ],
    frame: '#2b0e18',
    titleStops: ['#fef9c3', '#fde047', '#f97316', '#db2777'],
    titleOutline: '#1c060e',
    script: '#fb7185',
    accent: '#facc15',
    strip: ['#431407', '#ea580c', '#facc15'],
    tag: '#17030a',
  },
  {
    id: 'tropic-teal',
    name: 'Tropic Teal',
    filter: 'saturate(1.4) hue-rotate(18deg) contrast(1.06) brightness(1.04)',
    tint: [
      'rgba(0, 105, 95, 0.22)',
      'rgba(45, 212, 191, 0.10)',
      'rgba(8, 20, 55, 0.12)',
    ],
    frame: '#04211d',
    titleStops: ['#ccfbf1', '#5eead4', '#0d9488', '#e879f9'],
    titleOutline: '#02110e',
    script: '#f0abfc',
    accent: '#2dd4bf',
    strip: ['#042f2e', '#0d9488', '#facc15'],
    tag: '#02100d',
  },
  {
    id: 'ultraviolet',
    name: 'Ultraviolet',
    filter: 'saturate(1.6) hue-rotate(48deg) contrast(1.12) brightness(0.97)',
    tint: [
      'rgba(76, 29, 149, 0.28)',
      'rgba(217, 70, 239, 0.12)',
      'rgba(2, 6, 44, 0.16)',
    ],
    frame: '#1a0430',
    titleStops: ['#f5f3ff', '#d8b4fe', '#9333ea', '#e879f9'],
    titleOutline: '#0f0120',
    script: '#e879f9',
    accent: '#a855f7',
    strip: ['#2e1065', '#7e22ce', '#d946ef'],
    tag: '#0f011d',
  },
  {
    id: 'heatwave',
    name: 'Heatwave',
    filter: 'saturate(1.7) contrast(1.16) brightness(1.02) hue-rotate(-24deg)',
    tint: [
      'rgba(220, 38, 38, 0.16)',
      'rgba(249, 115, 22, 0.12)',
      'rgba(30, 0, 0, 0.14)',
    ],
    frame: '#2a0605',
    titleStops: ['#fef3c7', '#fcd34d', '#f97316', '#dc2626'],
    titleOutline: '#1a0303',
    script: '#fca5a5',
    accent: '#fb923c',
    strip: ['#450a0a', '#dc2626', '#f97316'],
    tag: '#160202',
  },
  {
    id: 'retro-print',
    name: 'Retro Print',
    filter: 'sepia(0.55) saturate(0.85) contrast(0.96) brightness(1.05)',
    tint: [
      'rgba(120, 85, 20, 0.20)',
      'rgba(180, 120, 40, 0.10)',
      'rgba(30, 20, 5, 0.16)',
    ],
    frame: '#241a08',
    titleStops: ['#fef3c7', '#fde68a', '#d97706', '#92400e'],
    titleOutline: '#160f02',
    script: '#d97706',
    accent: '#b45309',
    strip: ['#292524', '#a16207', '#f59e0b'],
    tag: '#141005',
  },
  {
    id: 'mono-noir',
    name: 'Mono Noir',
    filter: 'grayscale(1) contrast(1.22) brightness(0.98)',
    tint: [
      'rgba(0, 0, 0, 0.28)',
      'rgba(255, 255, 255, 0.06)',
      'rgba(0, 0, 0, 0.12)',
    ],
    frame: '#0a0a0a',
    titleStops: ['#ffffff', '#d4d4d4', '#a3a3a3', '#525252'],
    titleOutline: '#000000',
    script: '#e5e5e5',
    accent: '#fafafa',
    strip: ['#171717', '#404040', '#a3a3a3'],
    tag: '#050505',
  },
  {
    id: 'coral-dawn',
    name: 'Coral Dawn',
    filter: 'saturate(1.35) contrast(1.05) brightness(1.06) hue-rotate(-30deg)',
    tint: [
      'rgba(255, 127, 127, 0.16)',
      'rgba(255, 183, 153, 0.10)',
      'rgba(60, 10, 40, 0.10)',
    ],
    frame: '#2e0d1a',
    titleStops: ['#fff1f2', '#fda4af', '#fb7185', '#f472b6'],
    titleOutline: '#1d0610',
    script: '#fda4af',
    accent: '#fda4af',
    strip: ['#4c0519', '#e11d48', '#fb923c'],
    tag: '#170510',
  },
];

export function gradeById(id) {
  return GRADES.find((g) => g.id === id) ?? GRADES[0];
}
