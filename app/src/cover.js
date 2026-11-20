// cover.js — the cover renderer of Midnight Vice Cover Studio.
//
// renderCover() draws a whole GTA-style poster onto a canvas: clipped
// photo panels in the chosen layout, the striped chrome title, the neon
// script subtitle, role tags, per-panel callouts, the press quote with
// five stars, the WANTED heat meter, the gold seal with circular ring
// text, the tagline strip with palm silhouettes, the billing block and a
// deterministic barcode — then film grain, vignette and halftone ink.
// Everything scales from the cover height, so one renderer serves the
// live preview and all three export sizes.

import { gradeById } from './grades.js';
import { layoutById, panelRects } from './layouts.js';

export const COVER_SIZES = {
  '16x9': { w: 1920, h: 1080, label: '1920 × 1080' },
  '4x5': { w: 1080, h: 1350, label: '1080 × 1350' },
  '1x1': { w: 1080, h: 1080, label: '1080 × 1080' },
};

export function coverSize(id) {
  return COVER_SIZES[id] ?? COVER_SIZES['16x9'];
}

// FNV-1a hash — deterministic seeds for the barcode and the grain.
export function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fitFont(ctx, text, family, startPx, maxW, weight = '') {
  let px = startPx;
  ctx.font = `${weight} ${px}px ${family}`;
  while (px > 8 && ctx.measureText(text).width > maxW) {
    px -= 2;
    ctx.font = `${weight} ${px}px ${family}`;
  }
  return px;
}

function panelPath(ctx, r) {
  ctx.beginPath();
  if (r.slant) {
    ctx.moveTo(r.x + r.slant, r.y);
    ctx.lineTo(r.x + r.w, r.y);
    ctx.lineTo(r.x + r.w - r.slant, r.y + r.h);
    ctx.lineTo(r.x, r.y + r.h);
  } else {
    ctx.rect(r.x, r.y, r.w, r.h);
  }
  ctx.closePath();
}

// Cover-fit source rect for an image inside a panel, with the user's
// pan/zoom crop and an optional face anchor (0..1 in image space) that
// pulls the crop toward the face.
export function coverSourceRect(img, rect, crop) {
  const panelAspect = rect.w / rect.h;
  const imgAspect = img.naturalWidth / img.naturalHeight;
  let sw;
  let sh;
  if (imgAspect > panelAspect) {
    sh = img.naturalHeight;
    sw = sh * panelAspect;
  } else {
    sw = img.naturalWidth;
    sh = sw / panelAspect;
  }
  const zoom = Math.max(1, crop.zoom || 1);
  sw /= zoom;
  sh /= zoom;
  const anchorX = crop.face ? crop.face.fx : 0.5;
  const anchorY = crop.face ? crop.face.fy : 0.38;
  const slackX = img.naturalWidth - sw;
  const slackY = img.naturalHeight - sh;
  const ox = (crop.ox || 0) * 0.5 + 0.5;
  const oy = (crop.oy || 0) * 0.5 + 0.5;
  const sx = Math.min(Math.max(anchorX * slackX + (ox - 0.5) * slackX, 0), slackX);
  const sy = Math.min(Math.max(anchorY * slackY + (oy - 0.5) * slackY, 0), slackY);
  return { sx, sy, sw, sh };
}

function drawPanelPhoto(ctx, img, rect, crop, grade) {
  const src = coverSourceRect(img, rect, crop);
  ctx.save();
  panelPath(ctx, rect);
  ctx.clip();
  ctx.filter = grade.filter;
  if (crop.flip) {
    ctx.translate(rect.x + rect.w / 2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(rect.x + rect.w / 2), 0);
  }
  ctx.drawImage(img, src.sx, src.sy, src.sw, src.sh, rect.x, rect.y, rect.w, rect.h);
  ctx.filter = 'none';
  const wash = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  grade.tint.forEach((c, i) => wash.addColorStop(i / (grade.tint.length - 1 || 1), c));
  ctx.fillStyle = wash;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

function drawPanelFrame(ctx, rect, grade, u, selected) {
  ctx.save();
  panelPath(ctx, rect);
  ctx.strokeStyle = selected ? grade.accent : grade.frame;
  ctx.lineWidth = (selected ? 5 : 3.5) * u;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1 * u;
  ctx.stroke();
  ctx.restore();
}

function drawChromeTitle(ctx, text, cx, baselineY, maxW, grade, u) {
  const px = fitFont(ctx, text, 'Anton, sans-serif', 115 * u, maxW);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  // 3D extrusion: dark copies stepping down-right.
  ctx.fillStyle = grade.titleOutline;
  const depth = Math.max(2, 6 * u);
  for (let i = 5; i >= 1; i--) {
    ctx.fillText(text, cx + (depth * i) / 5, baselineY + (depth * i) / 5);
  }
  // Gradient body.
  const grad = ctx.createLinearGradient(0, baselineY - px, 0, baselineY);
  grade.titleStops.forEach((c, i) =>
    grad.addColorStop(i / (grade.titleStops.length - 1), c),
  );
  ctx.fillStyle = grad;
  ctx.fillText(text, cx, baselineY);
  // Horizontal chrome stripes clipped to the letterforms.
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  const stripeH = Math.max(1.5, 2.2 * u);
  const gap = px / 7;
  for (let y = baselineY - px + gap * 0.5; y < baselineY; y += gap) {
    ctx.fillRect(cx - maxW / 2, y, maxW, stripeH);
  }
  ctx.restore();
  // Dark outline so the title reads over any photo.
  ctx.lineWidth = Math.max(1.5, 3 * u);
  ctx.strokeStyle = grade.titleOutline;
  ctx.strokeText(text, cx, baselineY);
  ctx.restore();
  return px;
}

function drawNeonScript(ctx, text, cx, y, grade, u) {
  if (!text) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const px = fitFont(ctx, text, 'Pacifico, cursive', 44 * u, 0.9 * ctx.canvas.width);
  ctx.shadowColor = grade.script;
  ctx.shadowBlur = 18 * u;
  ctx.fillStyle = grade.script;
  ctx.fillText(text, cx, y);
  ctx.restore();
  return px;
}

function drawRoleTag(ctx, label, x, y, grade, u) {
  if (!label) return;
  ctx.save();
  const px = Math.max(11, 17 * u);
  ctx.font = `${px}px "Bebas Neue", sans-serif`;
  const w = ctx.measureText(label).width + 18 * u;
  const h = px * 1.7;
  ctx.fillStyle = grade.tag;
  ctx.globalAlpha = 0.92;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = grade.accent;
  ctx.lineWidth = 1.2 * u;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + 9 * u, y + h / 2 + 1);
  ctx.restore();
}

// A callout: a caption bar along its panel's bottom edge.
function drawCallout(ctx, text, panelRect, grade, u) {
  if (!text) return;
  ctx.save();
  const px = Math.max(11, 17 * u);
  const h = px * 2.0;
  const y = panelRect.y + panelRect.h - h;
  ctx.fillStyle = 'rgba(8, 4, 18, 0.82)';
  ctx.fillRect(panelRect.x, y, panelRect.w, h);
  ctx.fillStyle = grade.accent;
  ctx.fillRect(panelRect.x, y, panelRect.w, 2 * u);
  ctx.font = `italic ${px}px "Bebas Neue", sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, panelRect.x + 10 * u, y + h / 2 + 1, panelRect.w - 20 * u);
  ctx.restore();
}

function drawStarShape(ctx, cx, cy, r, filled) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  if (filled) ctx.fill();
  else {
    ctx.globalAlpha = 0.4;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// The press quote as one line — five stars, the quote, the source —
// set on the panels' bottom edge so it never fights the title.
function drawQuoteLine(ctx, quote, source, cx, baselineY, u) {
  if (!quote) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const line = `\u2605\u2605\u2605\u2605\u2605  \u201C${quote}\u201D${source ? `  —  ${source}` : ''}`;
  fitFont(ctx, line, '"Bebas Neue", sans-serif', 30 * u, 0.86 * ctx.canvas.width);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 7 * u;
  ctx.fillText(line, cx, baselineY);
  ctx.restore();
}

function drawWantedMeter(ctx, heat, x, y, grade, u) {
  ctx.save();
  const px = Math.max(12, 19 * u);
  ctx.font = `${px}px Anton, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'right';
  ctx.fillText('WANTED', x, y);
  const starSize = 12 * u;
  for (let i = 0; i < 5; i++) {
    const sx = x - (4 - i) * starSize * 1.6;
    ctx.fillStyle = i < heat ? '#ffd319' : 'rgba(255,255,255,0.25)';
    drawStarShape(ctx, sx, y + starSize * 1.9, starSize, i < heat);
  }
  ctx.restore();
}

// Text set along a circle — the gold seal's ring legend.
export function drawCircularText(ctx, text, cx, cy, radius, startAngle, flip, px) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const chars = [...text];
  const step = (Math.PI * 2) / Math.max(chars.length * 1.35, 1);
  const dir = flip ? -1 : 1;
  chars.forEach((ch, i) => {
    const a = startAngle + dir * (i - (chars.length - 1) / 2) * step;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
    ctx.rotate(a + (flip ? -Math.PI / 2 : Math.PI / 2));
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });
  ctx.restore();
}

function drawGoldSeal(ctx, cx, cy, r, ringText, centerText, u) {
  ctx.save();
  const gold = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  gold.addColorStop(0, '#fef08a');
  gold.addColorStop(0.55, '#eab308');
  gold.addColorStop(1, '#854d0e');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = gold;
  ctx.fill();
  ctx.lineWidth = 2 * u;
  ctx.strokeStyle = '#fef9c3';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
  ctx.lineWidth = 1.2 * u;
  ctx.strokeStyle = 'rgba(120, 53, 15, 0.7)';
  ctx.stroke();
  ctx.fillStyle = '#451a03';
  ctx.font = `${Math.max(9, 12 * u)}px Anton, sans-serif`;
  drawCircularText(ctx, ringText, cx, cy, r * 0.86, -Math.PI / 2, false, 12 * u);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.max(12, 20 * u)}px Anton, sans-serif`;
  ctx.fillText(centerText, cx, cy - 4 * u);
  ctx.font = `${Math.max(9, 11 * u)}px "Bebas Neue", sans-serif`;
  ctx.fillText('★ ★ ★', cx, cy + 14 * u);
  ctx.restore();
}

function drawPalm(ctx, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  // Trunk: a gentle curve.
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(6, -34, 2, -58);
  ctx.lineTo(-4, -58);
  ctx.quadraticCurveTo(-2, -30, -6, 0);
  ctx.closePath();
  ctx.fill();
  // Fronds: seven arcs fanning from the crown.
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * 0.15 - (i * Math.PI) / 8;
    const len = 42 - Math.abs(i - 3) * 5;
    ctx.beginPath();
    ctx.moveTo(0, -58);
    ctx.quadraticCurveTo(
      Math.cos(a) * len * 0.6,
      -58 + Math.sin(a) * len * 0.5 - 8,
      Math.cos(a) * len,
      -58 + Math.sin(a) * len + 14,
    );
    ctx.quadraticCurveTo(
      Math.cos(a) * len * 0.6,
      -58 + Math.sin(a) * len * 0.5 + 2,
      0,
      -58,
    );
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawTaglineStrip(ctx, tagline, y, W, H, grade, u) {
  const h = 36 * u;
  const grad = ctx.createLinearGradient(0, y, W, y);
  grade.strip.forEach((c, i) => grad.addColorStop(i / (grade.strip.length - 1), c));
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, y, W, h);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, y + h - 3 * u, W, 3 * u);
  drawPalm(ctx, 30 * u, y + h - 4 * u, 0.9 * u, 'rgba(0,0,0,0.55)');
  drawPalm(ctx, W - 30 * u, y + h - 4 * u, 0.9 * u, 'rgba(0,0,0,0.55)');
  if (tagline) {
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitFont(ctx, tagline, '"Bebas Neue", sans-serif', 30 * u, W * 0.8);
    ctx.fillText(tagline, W / 2, y + h / 2 + 1);
  }
  ctx.restore();
  return h;
}

function drawBillingBlock(ctx, lines, cx, y, W, u) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.62)';
  const px = Math.max(9, 12.5 * u);
  ctx.font = `${px}px "Bebas Neue", sans-serif`;
  lines.forEach((line, i) => {
    ctx.fillText(line, cx, y + i * px * 1.5);
  });
  ctx.restore();
}

function drawBarcode(ctx, seedText, x, y, w, h, u) {
  const rand = mulberry32(hashSeed(seedText));
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 6 * u, y - 6 * u, w + 12 * u, h + 16 * u);
  ctx.fillStyle = '#111111';
  let cx = x;
  while (cx < x + w - 4 * u) {
    const bw = (1 + Math.floor(rand() * 3)) * 1.6 * u;
    if (rand() > 0.45) ctx.fillRect(cx, y, bw, h);
    cx += bw + 1.6 * u;
  }
  ctx.font = `${Math.max(9, 11 * u)}px "Bebas Neue", sans-serif`;
  ctx.textAlign = 'center';
  const digits = String(hashSeed(seedText)).padStart(10, '0').slice(0, 12);
  ctx.fillText(`${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8)}`, x + w / 2, y + h + 11 * u);
  ctx.restore();
}

function applyGrain(ctx, W, H, seed, amount) {
  const rand = mulberry32(seed);
  const dots = Math.floor(W * H * 0.00012 * amount);
  ctx.save();
  for (let i = 0; i < dots; i++) {
    const v = rand() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${v},${v},${v},${0.05 + rand() * 0.06})`;
    ctx.fillRect(rand() * W, rand() * H, 1.4, 1.4);
  }
  ctx.restore();
}

function applyVignette(ctx, W, H) {
  const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.72);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function applyHalftone(ctx, W, H, u) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  const step = 7 * u;
  for (let y = step / 2; y < H; y += step) {
    for (let x = step / 2 + ((Math.floor(y / step) % 2) * step) / 2; x < W; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, 1.1 * u, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// The main entry: draw the whole cover onto `canvas` at the size the
// state's size id names. `images` maps photo ids to loaded HTMLImageElements.
export function renderCover(canvas, state, images) {
  const { w: W, h: H } = coverSize(state.size);
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }
  const ctx = canvas.getContext('2d');
  const grade = gradeById(state.grade);
  const layout = layoutById(state.layout);
  const u = H / 1000;
  const rects = panelRects(layout, W, H);

  ctx.fillStyle = grade.frame;
  ctx.fillRect(0, 0, W, H);

  // Panels: photos first, frames on top.
  rects.forEach((rect, i) => {
    const photo = state.photos[i % state.photos.length];
    const img = photo && images[photo.id];
    if (img) {
      drawPanelPhoto(ctx, img, rect, photo.crop, grade);
    } else {
      ctx.fillStyle = '#1b1b22';
      panelPath(ctx, rect);
      ctx.fill();
    }
  });
  rects.forEach((rect, i) => {
    drawPanelFrame(ctx, rect, grade, u, state.selectedPanel === i);
  });

  // Pop-Out Hero: redraw the hero bigger, breaking the frame with a shadow.
  const heroIndex = rects.findIndex((r) => r.popout);
  if (heroIndex >= 0) {
    const rect = rects[heroIndex];
    const photo = state.photos[heroIndex % state.photos.length];
    const img = photo && images[photo.id];
    const big = {
      x: rect.x - 30 * u,
      y: rect.y - 20 * u,
      w: rect.w + 44 * u,
      h: rect.h + 40 * u,
      slant: 0,
    };
    if (img) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.65)';
      ctx.shadowBlur = 26 * u;
      ctx.shadowOffsetY = 10 * u;
      drawPanelPhoto(ctx, img, big, photo.crop, grade);
      ctx.restore();
      drawPanelFrame(ctx, big, grade, u, state.selectedPanel === heroIndex);
    }
  }

  // Role tags ride on their panels.
  rects.forEach((rect, i) => {
    const photo = state.photos[i % state.photos.length];
    const label = (photo && photo.role) || rect.role;
    drawRoleTag(ctx, label, rect.x + 8 * u, rect.y + 8 * u, grade, u);
  });

  // Callouts run as caption bars along their panels' bottom edge.
  rects.forEach((rect, i) => {
    const photo = state.photos[i % state.photos.length];
    if (photo && photo.callout) {
      drawCallout(ctx, photo.callout, rect, grade, u);
    }
  });

  // Title block. The title sits in the band the panels leave free: under
  // the panels for most layouts, above them for Film Strip. The quote
  // rides on the panels' bottom edge (or the gap above them), so the
  // title, subtitle and furniture never collide.
  const zone = layout.titleZone;
  const titleCx = W / 2;
  const panelsBottom = Math.max(...rects.map((r) => r.y + r.h));
  const topTitle = zone.y < 0.5;
  const titleBaseline = topTitle ? zone.y * H + 100 * u : panelsBottom + 100 * u;
  const titlePx = drawChromeTitle(
    ctx,
    state.title || 'MIDNIGHT RUN',
    titleCx,
    titleBaseline,
    zone.width * W,
    grade,
    u,
  );
  const subtitleTop = titleBaseline + 6 * u;
  drawNeonScript(ctx, state.subtitle, titleCx, subtitleTop, grade, u);
  const quoteBaseline = topTitle ? subtitleTop + 70 * u : panelsBottom - 46 * u;
  drawQuoteLine(ctx, state.quote, state.quoteSource, titleCx, quoteBaseline, u);

  // Edition badge under the WANTED meter, top-right; WANTED meter first.
  drawWantedMeter(ctx, state.heat ?? 4, W - 14 * u, 26 * u, grade, u);
  if (state.edition) {
    ctx.save();
    const px = Math.max(11, 16 * u);
    ctx.font = `${px}px Anton, sans-serif`;
    const w = ctx.measureText(state.edition).width + 22 * u;
    const bx = W - 14 * u - w;
    const by = 84 * u;
    ctx.fillStyle = grade.accent;
    ctx.fillRect(bx, by, w, px * 1.9);
    ctx.fillStyle = '#0a0a0a';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.edition, bx + 11 * u, by + px * 0.95);
    ctx.restore();
  }

  // Gold seal stamped on the bottom-right panel's corner.
  const sealR = 52 * u;
  drawGoldSeal(
    ctx,
    W - sealR - 20 * u,
    panelsBottom - sealR - 20 * u,
    sealR,
    state.sealText || 'VICE CERTIFIED',
    'LEONIDA',
    u,
  );

  // Location stamp, bottom-left above the strip.
  if (state.location) {
    ctx.save();
    ctx.font = `${Math.max(11, 16 * u)}px "Bebas Neue", sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textBaseline = 'bottom';
    ctx.fillText(state.location, 14 * u, H - 108 * u);
    ctx.restore();
  }

  // Tagline strip, billing line and barcode along the bottom.
  const stripY = H - 70 * u;
  const stripH = drawTaglineStrip(ctx, state.tagline, stripY, W, H, grade, u);
  drawBillingBlock(
    ctx,
    ['MIDNIGHT VICE STUDIOS  •  A LEONIDA STORY  •  NOT AFFILIATED WITH ROCKSTAR GAMES'],
    W / 2,
    stripY + stripH + 13 * u,
    W,
    u,
  );
  drawBarcode(ctx, state.title || 'MIDNIGHT RUN', 14 * u, H - 44 * u, 120 * u, 20 * u, u);

  // Print effects last.
  if (state.halftone) applyHalftone(ctx, W, H, u);
  if (state.grain !== false) applyGrain(ctx, W, H, hashSeed(state.title || 'x'), 1);
  if (state.vignette !== false) applyVignette(ctx, W, H);
  return { W, H, titlePx };
}
