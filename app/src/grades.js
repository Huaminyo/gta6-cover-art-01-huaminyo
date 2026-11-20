// Midnight Vice Cover Studio — colour grades.
//
// A grade is two things at once: a CSS filter applied to each photo as it
// is drawn (contrast / saturation / brightness / hue / sepia / grayscale),
// and one or two translucent gradient overlays painted over the whole
// cover with a blend mode. The strength slider (0..100) scales both: at
// strength 0 the photo is ungraded, at 100 the grade is at full power.
// The contrast and saturation sliders then bend the filter further.

export const GRADES = [
  {
    id: "vice-sunset",
    name: "Vice Sunset",
    blurb: "Warm pink-orange dusk.",
    filter: { contrast: 1.08, saturate: 1.25, brightness: 1.03 },
    overlays: [
      { kind: "linear", angle: 180, stops: [[0, "#ff5e8a"], [1, "#ffb35c"]], blend: "soft-light", alpha: 0.4 },
    ],
  },
  {
    id: "neon-night",
    name: "Neon Night",
    blurb: "Dark streets, neon soak.",
    filter: { contrast: 1.15, saturate: 1.4, brightness: 0.92, hue: -10 },
    overlays: [
      { kind: "radial", stops: [[0, "#ff2e88"], [1, "#00e5ff"]], blend: "screen", alpha: 0.22 },
      { kind: "linear", angle: 180, stops: [[0, "#12082e"], [1, "#2b0a4a"]], blend: "multiply", alpha: 0.3 },
    ],
  },
  {
    id: "golden-hour",
    name: "Golden Hour",
    blurb: "Warm low sun, honey light.",
    filter: { contrast: 1.05, saturate: 1.2, brightness: 1.06, sepia: 0.16 },
    overlays: [
      { kind: "linear", angle: 160, stops: [[0, "#ffd76a"], [1, "#ff9a3c"]], blend: "overlay", alpha: 0.32 },
    ],
  },
  {
    id: "pink-teal",
    name: "Pink / Teal",
    blurb: "Duotone split, pink highs teal lows.",
    filter: { contrast: 1.2, saturate: 0.9, grayscale: 0.55 },
    overlays: [
      { kind: "linear", angle: 180, stops: [[0, "#ff5fa2"], [1, "#17c3b2"]], blend: "color", alpha: 0.55 },
    ],
  },
  {
    id: "comic-ink",
    name: "Comic Ink",
    blurb: "High-contrast inked print.",
    filter: { contrast: 1.5, saturate: 1.3, brightness: 1.0 },
    overlays: [
      { kind: "linear", angle: 180, stops: [[0, "#ffffff"], [1, "#000000"]], blend: "overlay", alpha: 0.22 },
    ],
  },
  {
    id: "heat-haze",
    name: "Heat Haze",
    blurb: "Washed out, hot afternoon.",
    filter: { contrast: 0.9, saturate: 0.85, brightness: 1.1 },
    overlays: [
      { kind: "linear", angle: 180, stops: [[0, "#fff3d6"], [1, "#ffd9a0"]], blend: "screen", alpha: 0.28 },
    ],
  },
  {
    id: "midnight-blue",
    name: "Midnight Blue",
    blurb: "Cold blue night patrol.",
    filter: { contrast: 1.1, saturate: 1.1, brightness: 0.9, hue: 15 },
    overlays: [
      { kind: "linear", angle: 180, stops: [[0, "#0a1e4a"], [1, "#123a6b"]], blend: "multiply", alpha: 0.28 },
      { kind: "linear", angle: 0, stops: [[0, "#35d5ff"], [1, "#35d5ff"]], blend: "screen", alpha: 0.12 },
    ],
  },
  {
    id: "natural",
    name: "Natural",
    blurb: "Clean, ungraded.",
    filter: {},
    overlays: [],
  },
];

export function gradeById(id) {
  return GRADES.find((g) => g.id === id) || GRADES[0];
}

// Blend one filter knob toward its neutral value by strength t (0..1).
function mixKnob(value, neutral, t) {
  return neutral + (value - neutral) * t;
}

// The CSS filter string for a photo: the grade's filter at the given
// strength, bent by the user's contrast / saturation sliders (percent).
export function photoFilter(gradeId, strength, contrastPct, saturationPct) {
  const g = gradeById(gradeId);
  const t = strength / 100;
  const f = g.filter;
  const parts = [];
  const contrast = mixKnob(f.contrast ?? 1, 1, t) * (contrastPct / 100);
  const saturate = mixKnob(f.saturate ?? 1, 1, t) * (saturationPct / 100);
  const brightness = mixKnob(f.brightness ?? 1, 1, t);
  const hue = mixKnob(f.hue ?? 0, 0, t);
  const sepia = mixKnob(f.sepia ?? 0, 0, t);
  const grayscale = mixKnob(f.grayscale ?? 0, 0, t);
  if (Math.abs(contrast - 1) > 0.005) parts.push(`contrast(${contrast.toFixed(3)})`);
  if (Math.abs(saturate - 1) > 0.005) parts.push(`saturate(${saturate.toFixed(3)})`);
  if (Math.abs(brightness - 1) > 0.005) parts.push(`brightness(${brightness.toFixed(3)})`);
  if (Math.abs(hue) > 0.5) parts.push(`hue-rotate(${hue.toFixed(1)}deg)`);
  if (sepia > 0.005) parts.push(`sepia(${sepia.toFixed(3)})`);
  if (grayscale > 0.005) parts.push(`grayscale(${grayscale.toFixed(3)})`);
  return parts.length ? parts.join(" ") : "none";
}

// Paint the grade's overlays over the whole cover. Each overlay is a
// gradient filled with its blend mode at alpha scaled by strength.
export function paintGradeOverlays(ctx, w, h, gradeId, strength) {
  const g = gradeById(gradeId);
  const t = strength / 100;
  for (const o of g.overlays) {
    const alpha = o.alpha * t;
    if (alpha <= 0.004) continue;
    let grad;
    if (o.kind === "radial") {
      grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.75);
    } else {
      const rad = ((o.angle ?? 180) * Math.PI) / 180;
      const dx = Math.sin(rad);
      const dy = -Math.cos(rad);
      grad = ctx.createLinearGradient(
        w / 2 - dx * w / 2, h / 2 - dy * h / 2,
        w / 2 + dx * w / 2, h / 2 + dy * h / 2,
      );
    }
    for (const [pos, color] of o.stops) grad.addColorStop(pos, color);
    ctx.save();
    ctx.globalCompositeOperation = o.blend;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}
