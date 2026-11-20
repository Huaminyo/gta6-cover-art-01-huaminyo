// cover.js — the cover engine for Midnight Vice Cover Studio.
// Renders a GTA-style multi-panel poster onto a canvas at any post size:
// graded photo panels, striped chrome lettering, a neon script subtitle,
// cast role tags, a press quote, a gold seal, a tagline strip, a billing
// block and a barcode. Everything is drawn in code; no image is borrowed.
import { gradeById } from './grades.js';
import { layoutById } from './layouts.js';

export const SIZES = {
  '16x9': { w: 1920, h: 1080, label: '16:9 · 1920 x 1080' },
  '1x1': { w: 1080, h: 1080, label: '1:1 · 1080 x 1080' },
  '4x5': { w: 1080, h: 1350, label: '4:5 · 1080 x 1350' },
};

const HEADER_H = 0.055; // header band, fraction of height
const STRIP_TOP = 0.858; // tagline strip top, fraction of height
const STRIP_H = 0.062; // tagline strip height
const BILL_TOP = 0.925; // billing block top

let noiseTile = null;

export async function ensureCoverFonts() {
  try {
    await Promise.all([
      document.fonts.load('100px Anton'),
      document.fonts.load('60px Pacifico'),
      document.fonts.load('40px "Bebas Neue"'),
    ]);
    await document.fonts.ready;
  } catch (_) {
    /* fonts fall back to system sans; the render still works */
  }
}

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Cover-fit a photo into a panel rect, with the panel's crop state.
function coverFitRect(img, rect, crop) {
  const zoom = crop.zoom || 1;
  const scale = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = rect.x + (rect.w - dw) / 2 + (crop.dx || 0) * rect.w;
  const dy = rect.y + (rect.h - dh) / 2 + (crop.dy || 0) * rect.h;
  return { dx, dy, dw, dh };
}

function panelPath(ctx, rect, W) {
  const shear = (rect.shear || 0) * W;
  ctx.beginPath();
  ctx.moveTo(rect.x + shear, rect.y);
  ctx.lineTo(rect.x + rect.w + shear, rect.y);
  ctx.lineTo(rect.x + rect.w - shear, rect.y + rect.h);
  ctx.lineTo(rect.x - shear, rect.y + rect.h);
  ctx.closePath();
}

// Draw one graded photo panel: the photo, its grade, frame and role tag.
export function drawPhotoPanel(ctx, panel, photo, crop, grade, W, H, opts) {
  const rect = {
    x: panel.x * W,
    y: panel.y * H,
    w: panel.w * W,
    h: panel.h * H,
  };
  let drawRect = rect;
  if (panel.popout) {
    const ex = rect.w * 0.09;
    const ey = rect.h * 0.05;
    drawRect = { x: rect.x - ex, y: rect.y - ey, w: rect.w + ex * 2, h: rect.h + ey * 2 };
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = W * 0.02;
    ctx.shadowOffsetY = H * 0.012;
    ctx.fillStyle = grade.frame;
    ctx.fillRect(drawRect.x, drawRect.y, drawRect.w, drawRect.h);
    ctx.restore();
  }
  ctx.save();
  panelPath(ctx, { x: drawRect.x, y: drawRect.y, w: drawRect.w, h: drawRect.h, shear: panel.shear }, W);
  ctx.clip();
  if (photo && photo.img && photo.img.naturalWidth) {
    const fit = coverFitRect(photo.img, drawRect, crop);
    ctx.filter = grade.filter;
    if (crop.flip) {
      ctx.translate(drawRect.x + drawRect.w / 2, 0);
      ctx.scale(-1, 1);
      ctx.translate(-(drawRect.x + drawRect.w / 2), 0);
    }
    ctx.drawImage(photo.img, fit.dx, fit.dy, fit.dw, fit.dh);
    ctx.filter = 'none';
  } else {
    const g = ctx.createLinearGradient(drawRect.x, drawRect.y, drawRect.x, drawRect.y + drawRect.h);
    g.addColorStop(0, '#3b2a5d');
    g.addColorStop(1, '#160a2e');
    ctx.fillStyle = g;
    ctx.fillRect(drawRect.x, drawRect.y, drawRect.w, drawRect.h);
  }
  // Gradient-map tint over the photo.
  const tint = ctx.createLinearGradient(drawRect.x, drawRect.y, drawRect.x + drawRect.w, drawRect.y + drawRect.h);
  tint.addColorStop(0, grade.tint[0]);
  tint.addColorStop(0.55, grade.tint[1]);
  tint.addColorStop(1, grade.tint[2]);
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = tint;
  ctx.fillRect(drawRect.x, drawRect.y, drawRect.w, drawRect.h);
  ctx.globalCompositeOperation = 'source-over';
  // Inner shadow for depth.
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = Math.max(2, W * 0.002);
  ctx.strokeRect(drawRect.x + 1, drawRect.y + 1, drawRect.w - 2, drawRect.h - 2);
  ctx.restore();
  // Frame: dark edge plus a thin light inner line so panels read apart.
  ctx.save();
  ctx.strokeStyle = grade.frame;
  ctx.lineWidth = Math.max(3, W * 0.0035);
  panelPath(ctx, { x: drawRect.x, y: drawRect.y, w: drawRect.w, h: drawRect.h, shear: panel.shear }, W);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.30)';
  ctx.lineWidth = Math.max(1, W * 0.001);
  ctx.stroke();
  if (opts.selected) {
    ctx.strokeStyle = grade.accent;
    ctx.lineWidth = Math.max(3, W * 0.003);
    ctx.setLineDash([W * 0.012, W * 0.008]);
    ctx.stroke();
  }
  ctx.restore();
  return drawRect;
}

// A small cast tag pinned to a panel corner: "THE DRIVER".
// Corner: bl (default), br, tl, tr.
export function drawRoleTag(ctx, rect, role, grade, W, H, corner = 'bl') {
  if (!role) return;
  const u = Math.min(W, H) / 100;
  const fs = Math.max(13, u * 1.7);
  ctx.save();
  ctx.font = `${fs}px "Bebas Neue", sans-serif`;
  const label = role.toUpperCase();
  const tw = ctx.measureText(label).width;
  const padX = fs * 0.55;
  const padY = fs * 0.28;
  const bw = tw + padX * 2 + fs * 0.5;
  const bh = fs + padY * 2;
  let bx = rect.x + W * 0.008;
  let by = rect.y + rect.h - bh - H * 0.012;
  if (corner === 'br' || corner === 'tr') bx = rect.x + rect.w - bw - W * 0.008;
  if (corner === 'tl' || corner === 'tr') by = rect.y + H * 0.012;
  ctx.fillStyle = 'rgba(5,2,12,0.88)';
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx + bw, by);
  ctx.lineTo(bx + bw - fs * 0.4, by + bh);
  ctx.lineTo(bx, by + bh);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = grade.accent;
  ctx.fillRect(bx, by, fs * 0.22, bh);
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, bx + padX + fs * 0.28, by + bh / 2 + fs * 0.04);
  ctx.restore();
}

// Pick a tag corner the panels drawn after this one do not cover, and
// the gold seal does not sit on.
function tagCornerFor(rect, role, index, drawn, W, H) {
  const u = Math.min(W, H) / 100;
  const fs = Math.max(13, u * 1.7);
  const bw = role.length * fs * 0.52 + fs * 1.6;
  const bh = fs * 1.6;
  const sealX = W * (H > W ? 0.86 : 0.925);
  const sealY = H * (H > W ? 0.815 : 0.79);
  const sealR = Math.min(W, H) * 0.052 + bw * 0.4;
  const corners = [
    { c: 'bl', x: rect.x + W * 0.008, y: rect.y + rect.h - bh - H * 0.012 },
    { c: 'br', x: rect.x + rect.w - bw - W * 0.008, y: rect.y + rect.h - bh - H * 0.012 },
    { c: 'tl', x: rect.x + W * 0.008, y: rect.y + H * 0.012 },
    { c: 'tr', x: rect.x + rect.w - bw - W * 0.008, y: rect.y + H * 0.012 },
  ];
  for (const cand of corners) {
    const cx = cand.x + bw / 2;
    const cy = cand.y + bh / 2;
    const covered = drawn.some(
      (other, j) => j > index && cx >= other.x && cx <= other.x + other.w && cy >= other.y && cy <= other.y + other.h,
    );
    const onSeal = Math.hypot(cx - sealX, cy - sealY) < sealR;
    if (!covered && !onSeal) return cand.c;
  }
  return 'bl';
}

// The big striped chrome title with a 3D extrusion.
export function drawChromeTitle(ctx, title, cx, baselineY, maxW, maxSize, grade) {
  const lines = wrapTitle(ctx, title.toUpperCase(), maxW, maxSize);
  const size = lines.size;
  ctx.save();
  ctx.font = `${size}px Anton, "Arial Black", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const lineH = size * 0.98;
  const totalH = lineH * lines.text.length;
  let y = baselineY - totalH / 2 + size * 0.42;
  for (const line of lines.text) {
    // Extrusion: dark copies stepping down-right, tight enough to read as
    // a bevel rather than a shadow blob.
    const steps = Math.max(3, Math.round(size / 38));
    for (let i = steps; i >= 1; i--) {
      ctx.fillStyle = grade.titleOutline;
      ctx.fillText(line, cx + i * (size * 0.028), y + i * (size * 0.028));
    }
    // Striped chrome fill: hard gradient bands down the glyphs.
    const grad = ctx.createLinearGradient(0, y - size * 0.78, 0, y + size * 0.22);
    const stops = grade.titleStops;
    const bands = 5;
    for (let b = 0; b < bands; b++) {
      const c = stops[b % stops.length];
      const t0 = b / bands;
      const t1 = (b + 1) / bands;
      grad.addColorStop(t0, c);
      grad.addColorStop(Math.min(1, t1 - 0.015), c);
    }
    ctx.lineWidth = size * 0.075;
    ctx.strokeStyle = grade.titleOutline;
    ctx.lineJoin = 'round';
    ctx.strokeText(line, cx, y);
    ctx.fillStyle = grad;
    ctx.fillText(line, cx, y);
    y += lineH;
  }
  ctx.restore();
  return { size, height: totalH };
}

function wrapTitle(ctx, title, maxW, maxSize) {
  let size = maxSize;
  ctx.font = `${size}px Anton, "Arial Black", sans-serif`;
  if (ctx.measureText(title).width <= maxW) return { text: [title], size };
  while (size > maxSize * 0.55) {
    size -= 2;
    ctx.font = `${size}px Anton, "Arial Black", sans-serif`;
    if (ctx.measureText(title).width <= maxW) return { text: [title], size };
  }
  // Two lines, balanced by words.
  const words = title.split(/\s+/);
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const wa = ctx.measureText(a).width;
    const wb = ctx.measureText(b).width;
    const score = Math.max(wa, wb) + Math.abs(wa - wb) * 0.2;
    if (!best || score < best.score) best = { text: [a, b], score };
  }
  size = maxSize * 0.82;
  ctx.font = `${size}px Anton, "Arial Black", sans-serif`;
  while (size > maxSize * 0.45) {
    const w = Math.max(...best.text.map((t) => ctx.measureText(t).width));
    if (w <= maxW) break;
    size -= 2;
    ctx.font = `${size}px Anton, "Arial Black", sans-serif`;
  }
  return { text: best.text, size };
}

// Neon script subtitle under the title.
export function drawScriptSubtitle(ctx, text, cx, y, size, grade) {
  if (!text) return;
  ctx.save();
  ctx.translate(cx, y);
  ctx.rotate(-0.03);
  ctx.font = `${size}px Pacifico, cursive`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = grade.script;
  ctx.shadowBlur = size * 0.45;
  ctx.fillStyle = grade.script;
  ctx.fillText(text, 0, 0);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.85;
  ctx.font = `${size * 0.96}px Pacifico, cursive`;
  ctx.fillText(text, 0, -size * 0.03);
  ctx.restore();
}

// Header band: stars, press quote, edition tag.
export function drawHeaderBand(ctx, state, grade, W, H) {
  const u = Math.min(W, H) / 100;
  const hh = H * HEADER_H;
  ctx.save();
  ctx.fillStyle = grade.frame;
  ctx.fillRect(0, 0, W, hh);
  const fs = Math.max(12, u * 1.9);
  ctx.font = `${fs}px "Bebas Neue", sans-serif`;
  ctx.textBaseline = 'middle';
  let x = W * 0.014;
  const cy = hh / 2 + fs * 0.05;
  if (state.show.stars) {
    ctx.fillStyle = '#ffd319';
    ctx.fillText('★ ★ ★ ★ ★', x, cy);
    x += ctx.measureText('★ ★ ★ ★ ★  ').width;
  }
  if (state.quote) {
    ctx.fillStyle = '#ffffff';
    const q = `“${state.quote.toUpperCase()}”`;
    ctx.fillText(q, x, cy);
    x += ctx.measureText(q + '  ').width;
    ctx.fillStyle = grade.accent;
    if (state.quoteSource) ctx.fillText(`— ${state.quoteSource.toUpperCase()}`, x, cy);
  }
  if (state.editionTag) {
    const label = state.editionTag.toUpperCase();
    const tw = ctx.measureText(label).width;
    const bw = tw + fs * 1.2;
    const bh = hh * 0.62;
    const bx = W - bw - W * 0.012;
    const by = (hh - bh) / 2;
    ctx.fillStyle = '#ffd319';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#14060a';
    ctx.textAlign = 'center';
    ctx.fillText(label, bx + bw / 2, cy);
  }
  ctx.restore();
}

// Tagline ribbon: a sunset strip with palm silhouettes and the tagline.
export function drawTaglineStrip(ctx, state, grade, W, H) {
  const y0 = H * STRIP_TOP;
  const h = H * STRIP_H;
  const u = Math.min(W, H) / 100;
  ctx.save();
  const g = ctx.createLinearGradient(0, y0, W, y0);
  g.addColorStop(0, grade.strip[0]);
  g.addColorStop(0.5, grade.strip[1]);
  g.addColorStop(1, grade.strip[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, W, h);
  // Sun disc.
  ctx.fillStyle = 'rgba(255,240,180,0.9)';
  ctx.beginPath();
  ctx.arc(W * 0.5, y0 + h * 0.98, h * 0.62, Math.PI, 0);
  ctx.fill();
  // Palm silhouettes at both ends.
  ctx.fillStyle = 'rgba(10,2,18,0.85)';
  drawPalm(ctx, W * 0.045, y0 + h, h * 0.95);
  drawPalm(ctx, W * 0.085, y0 + h, h * 0.7);
  drawPalm(ctx, W * 0.955, y0 + h, h * 0.95);
  drawPalm(ctx, W * 0.915, y0 + h, h * 0.7);
  if (state.tagline) {
    const fs = Math.max(13, u * 2.1);
    ctx.font = `${fs}px "Bebas Neue", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = u * 0.4;
    let text = state.tagline.toUpperCase();
    while (ctx.measureText(text).width > W * 0.78 && fs > 10) {
      ctx.font = `${--fs}px "Bebas Neue", sans-serif`;
    }
    ctx.fillText(text, W * 0.5, y0 + h / 2 + fs * 0.06);
  }
  ctx.restore();
}

function drawPalm(ctx, x, baseY, s) {
  ctx.save();
  ctx.translate(x, baseY);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(s * 0.08, -s * 0.55, s * 0.02, -s * 0.95);
  ctx.lineTo(-s * 0.03, -s * 0.95);
  ctx.quadraticCurveTo(-s * 0.02, -s * 0.5, -s * 0.05, 0);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * (0.15 + (i / 5) * 0.7);
    const tx = Math.cos(a) * s * 0.55;
    const ty = -s * 0.95 - Math.sin(a) * s * 0.3;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.92);
    ctx.quadraticCurveTo(tx * 0.5, ty - s * 0.18, tx, ty + s * 0.22);
    ctx.quadraticCurveTo(tx * 0.5, ty - s * 0.05, 0, -s * 0.88);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// Billing block + barcode + release line at the very bottom.
export function drawBillingBlock(ctx, state, grade, W, H) {
  const y0 = H * BILL_TOP;
  const h = H - y0;
  const u = Math.min(W, H) / 100;
  ctx.save();
  ctx.fillStyle = '#0b0614';
  ctx.fillRect(0, y0, W, h);
  const fs = Math.max(10, u * 1.25);
  ctx.font = `${fs}px "Bebas Neue", sans-serif`;
  ctx.textBaseline = 'middle';
  if (state.releaseLine) {
    ctx.fillStyle = grade.script;
    ctx.textAlign = 'left';
    ctx.fillText(state.releaseLine.toUpperCase(), W * 0.014, y0 + h / 2);
  }
  if (state.show.billing && state.billing) {
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.textAlign = 'center';
    const lines = state.billing.split('\n').slice(0, 2);
    lines.forEach((line, i) => {
      ctx.fillText(line.toUpperCase(), W * 0.5, y0 + h * (0.32 + i * 0.36));
    });
  }
  // Barcode, deterministic from the title.
  const seed = hashString(state.title + state.editionTag);
  let rnd = seed;
  const next = () => {
    rnd = (Math.imul(rnd, 1664525) + 1013904223) >>> 0;
    return rnd / 4294967296;
  };
  const bw = W * 0.055;
  const bh = h * 0.62;
  const bx = W - bw - W * 0.012;
  const by = y0 + (h - bh) / 2;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = '#000000';
  let x = bx + bw * 0.06;
  while (x < bx + bw * 0.94) {
    const wBar = (0.5 + next() * 2.2) * Math.max(1, W * 0.0011);
    if (next() > 0.45) ctx.fillRect(x, by + bh * 0.08, wBar, bh * 0.72);
    x += wBar + Math.max(1, W * 0.0011);
  }
  ctx.font = `${Math.max(8, u * 0.9)}px "Bebas Neue", sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(String(seed % 100000000).padStart(8, '0'), bx + bw / 2, by + bh * 0.92);
  ctx.restore();
}

// Gold rosette seal.
export function drawGoldSeal(ctx, state, grade, W, H) {
  if (!state.show.seal) return;
  const u = Math.min(W, H) / 100;
  const cx = W * (H > W ? 0.86 : 0.925);
  const cy = H * (H > W ? 0.815 : 0.79);
  const r = Math.min(W, H) * 0.052;
  ctx.save();
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#fff7ae');
  g.addColorStop(0.55, '#f5c542');
  g.addColorStop(1, '#b8860b');
  ctx.fillStyle = g;
  ctx.beginPath();
  const teeth = 18;
  for (let i = 0; i < teeth * 2; i++) {
    const rr = i % 2 ? r * 0.92 : r;
    const a = (i / (teeth * 2)) * Math.PI * 2 - Math.PI / 2;
    const px = cx + Math.cos(a) * rr;
    const py = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#7a5c00';
  ctx.lineWidth = Math.max(1, u * 0.12);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.74, 0, Math.PI * 2);
  ctx.fillStyle = '#fff8d6';
  ctx.fill();
  ctx.strokeStyle = '#b8860b';
  ctx.stroke();
  ctx.fillStyle = '#4a3200';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${r * 0.34}px Anton, sans-serif`;
  ctx.fillText('★', cx, cy - r * 0.38);
  const words = (state.sealText || 'ORIGINAL COVER ART').toUpperCase().split(/\s+/);
  const fs = Math.max(9, r * 0.19);
  ctx.font = `${fs}px "Bebas Neue", sans-serif`;
  const mid = Math.ceil(words.length / 2);
  ctx.fillText(words.slice(0, mid).join(' '), cx, cy + r * 0.02);
  ctx.fillText(words.slice(mid).join(' '), cx, cy + r * 0.3);
  ctx.restore();
}

// WANTED heat pill with 0-5 stars.
export function drawHeatPill(ctx, state, grade, W, H) {
  if (!state.show.heat) return;
  const u = Math.min(W, H) / 100;
  const fs = Math.max(12, u * 1.7);
  ctx.save();
  ctx.font = `${fs}px "Bebas Neue", sans-serif`;
  const stars = '★'.repeat(state.heat) + '☆'.repeat(5 - state.heat);
  const label = `WANTED ${stars}`;
  const tw = ctx.measureText(label).width;
  const bw = tw + fs * 1.4;
  const bh = fs * 1.7;
  const bx = W * 0.988 - bw;
  const by = H * 0.068;
  ctx.fillStyle = 'rgba(5,2,12,0.88)';
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, bh / 2);
  ctx.fill();
  ctx.strokeStyle = grade.accent;
  ctx.lineWidth = Math.max(1.5, u * 0.14);
  ctx.stroke();
  ctx.fillStyle = '#ffd319';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, bx + fs * 0.7, by + bh / 2 + fs * 0.04);
  ctx.restore();
}

// Location + time ticket stamp.
export function drawLocationStamp(ctx, state, grade, W, H) {
  if (!state.show.location || !state.location) return;
  const u = Math.min(W, H) / 100;
  const fs = Math.max(12, u * 1.7);
  ctx.save();
  ctx.translate(W * 0.02, H * 0.068);
  ctx.rotate(-0.025);
  ctx.font = `${fs}px "Bebas Neue", sans-serif`;
  const label = state.location.toUpperCase();
  const tw = ctx.measureText(label).width;
  const bw = tw + fs * 1.2;
  const bh = fs * 1.7;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, bw, bh);
  ctx.fillStyle = '#14060a';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, fs * 0.6, bh / 2 + fs * 0.04);
  ctx.restore();
}

function getNoiseTile() {
  if (noiseTile) return noiseTile;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const nctx = c.getContext('2d');
  const img = nctx.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  nctx.putImageData(img, 0, 0);
  noiseTile = c;
  return c;
}

export function drawGrainAndVignette(ctx, state, W, H) {
  if (state.show.grain) {
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(getNoiseTile(), 'repeat');
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  if (state.ink > 0) {
    // Halftone dots grow with the ink slider.
    ctx.save();
    ctx.globalAlpha = state.ink * 0.10;
    ctx.fillStyle = '#000000';
    const step = Math.max(6, W * 0.006);
    for (let y = step / 2; y < H; y += step) {
      for (let x = step / 2; x < W; x += step) {
        const edge = Math.min(x / W, 1 - x / W, y / H, 1 - y / H);
        if (edge < 0.12) {
          ctx.beginPath();
          ctx.arc(x, y, step * 0.16, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }
  if (state.show.vignette) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}

// The full render: panels, lettering, furniture, finish.
export function renderCover(canvas, state) {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext('2d');
  const grade = gradeById(state.gradeId);
  const layout = layoutById(state.layoutId);
  const u = Math.min(W, H) / 100;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = grade.frame;
  ctx.fillRect(0, 0, W, H);

  const panels = layout.panels(W, H);
  const photoById = new Map(state.photos.map((p) => [p.id, p]));
  const drawn = [];
  panels.forEach((panel, i) => {
    const crop = state.panels[i] || {};
    const photo = photoById.get(crop.photoId);
    const rect = drawPhotoPanel(ctx, panel, photo, crop, grade, W, H, {
      selected: state.interactive && state.selectedPanel === i,
    });
    drawn.push(rect);
  });
  // Role tags after all panels, so they sit on top. The tag follows the
  // photo, not the panel, so a cast member keeps their role in any layout.
  if (state.show.tags) {
    panels.forEach((panel, i) => {
      const crop = state.panels[i] || {};
      const photo = photoById.get(crop.photoId);
      const role = photo ? photo.role : '';
      drawRoleTag(ctx, drawn[i], role, grade, W, H, tagCornerFor(drawn[i], role || '', i, drawn, W, H));
    });
  }

  drawHeaderBand(ctx, state, grade, W, H);
  drawLocationStamp(ctx, state, grade, W, H);
  drawHeatPill(ctx, state, grade, W, H);

  // Title + script subtitle across the middle-lower art, clear of the
  // bottom-row role tags. Smaller on portrait/square so it stops slicing
  // through faces.
  const titleMaxW = W * (H > W ? 0.94 : 0.92);
  const titleMax = u * (H > W ? 11.5 : W === H ? 13 : 15.5);
  const titleY = H * (H > W ? 0.6 : W === H ? 0.66 : 0.6);
  const t = drawChromeTitle(ctx, state.title || 'UNTITLED', W / 2, titleY, titleMaxW, titleMax, grade);
  drawScriptSubtitle(ctx, state.script, W / 2, titleY + t.height / 2 + u * 2.6, u * 4.6, grade);

  drawTaglineStrip(ctx, state, grade, W, H);
  drawBillingBlock(ctx, state, grade, W, H);
  drawGoldSeal(ctx, state, grade, W, H);
  drawGrainAndVignette(ctx, state, W, H);
  return { panels, drawn };
}

// Render the cover at full export resolution into a fresh canvas.
export function renderCoverToCanvas(state, sizeId) {
  const size = SIZES[sizeId] || SIZES['16x9'];
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  renderCover(canvas, { ...state, interactive: false, selectedPanel: -1 });
  return canvas;
}

export function exportCoverPNG(state, sizeId) {
  return new Promise((resolve) => {
    renderCoverToCanvas(state, sizeId).toBlob((blob) => resolve(blob), 'image/png');
  });
}
