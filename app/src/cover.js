// Midnight Vice Cover Studio — the cover renderer.
//
// renderCover(canvas, state, photos) paints one finished cover onto any
// canvas at any size. Everything is deterministic for a given state: grain
// and the barcode come from a seeded generator, so the same inputs always
// give the same PNG.
//
// state:
//   layout, grade, strength, contrast, saturation, grain, vignette,
//   halftone, title, subtitle, quote, quoteSource, seed,
//   panels: [{ photoId, panX, panY, zoom, callout, label, anchor }]
// photos: Map of photoId -> { img, w, h }

import { panelRects, clipPanel, titleZone } from "./layouts.js";
import { photoFilter, paintGradeOverlays } from "./grades.js";

// Seeded PRNG (mulberry32) — deterministic grain and barcode.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Fit a photo into a panel rect with pan / zoom and a face anchor.
// anchor is { x, y } in 0..1 image coords, or null (falls back to an
// upper-third bias, where faces usually sit in a portrait).
function photoSourceRect(img, rect, view) {
  const zoom = view.zoom || 1;
  const scale = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * zoom;
  const sw = rect.w / scale;
  const sh = rect.h / scale;
  const anchor = view.anchor || { x: 0.5, y: 0.35 };
  const baseX = img.naturalWidth * (0.5 + (anchor.x - 0.5) * 0.65);
  const baseY = img.naturalHeight * (0.5 + (anchor.y - 0.5) * 0.65);
  const spanX = Math.max(0, (img.naturalWidth - sw) / 2);
  const spanY = Math.max(0, (img.naturalHeight - sh) / 2);
  let cx = baseX + (view.panX || 0) * spanX;
  let cy = baseY + (view.panY || 0) * spanY;
  cx = Math.min(Math.max(cx, sw / 2), img.naturalWidth - sw / 2);
  cy = Math.min(Math.max(cy, sh / 2), img.naturalHeight - sh / 2);
  return { sx: cx - sw / 2, sy: cy - sh / 2, sw, sh };
}

function drawPhoto(ctx, rect, photo, view, filter) {
  const img = photo.img;
  const src = photoSourceRect(img, rect, view);
  if (rect.bleed) {
    // Pop-out hero: a soft drop shadow on its right and bottom edges,
    // painted on the canvas before the clipped photo covers it.
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = rect.w * 0.04;
    ctx.shadowOffsetX = rect.w * 0.015;
    ctx.shadowOffsetY = rect.h * 0.015;
    ctx.fillStyle = "#000";
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  }
  ctx.save();
  clipPanel(ctx, rect);
  ctx.filter = filter;
  ctx.drawImage(img, src.sx, src.sy, src.sw, src.sh, rect.x, rect.y, rect.w, rect.h);
  ctx.filter = "none";
  ctx.restore();
  // Thin neon edge between panels.
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = Math.max(1, rect.w * 0.004);
  clipPanel(ctx, rect);
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

function drawGrain(ctx, w, h, amount, seed) {
  if (amount <= 0) return;
  const rnd = mulberry32(seed);
  const count = Math.floor(((w * h) / 240) * (amount / 100));
  ctx.save();
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rnd() * w);
    const y = Math.floor(rnd() * h);
    const light = rnd() > 0.5;
    ctx.fillStyle = light ? `rgba(255,255,255,${0.05 + rnd() * 0.12})` : `rgba(0,0,0,${0.05 + rnd() * 0.14})`;
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  ctx.restore();
}

function drawVignette(ctx, w, h, amount) {
  if (amount <= 0) return;
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.78);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${(amount / 100) * 0.55})`);
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

let halftonePattern = null;
function drawHalftone(ctx, w, h) {
  if (!halftonePattern) {
    const c = document.createElement("canvas");
    c.width = 12;
    c.height = 12;
    const d = c.getContext("2d");
    d.fillStyle = "rgba(0,0,0,0.5)";
    d.beginPath();
    d.arc(3, 3, 1.6, 0, Math.PI * 2);
    d.arc(9, 9, 1.6, 0, Math.PI * 2);
    d.fill();
    halftonePattern = ctx.createPattern(c, "repeat");
  }
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = halftonePattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

// --- poster furniture -------------------------------------------------

function drawPalmShape(ctx, x, y, s, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1, 2.4 * s);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + 3 * s, y - 12 * s, x + 1 * s, y - 22 * s);
  ctx.stroke();
  for (let k = 0; k < 5; k++) {
    const a = Math.PI * (0.15 + 0.7 * (k / 4));
    const ex = x + 1 * s + Math.cos(a) * 13 * s;
    const ey = y - 22 * s + Math.sin(a) * 7 * s + 5 * s;
    ctx.beginPath();
    ctx.moveTo(x + 1 * s, y - 22 * s);
    ctx.quadraticCurveTo(x + 1 * s + Math.cos(a) * 7 * s, y - 26 * s, ex, ey);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPalmBand(ctx, w, h, tagline) {
  const bh = h * 0.034;
  ctx.save();
  ctx.fillStyle = "rgba(6,3,16,0.88)";
  ctx.fillRect(0, 0, w, bh);
  ctx.fillStyle = "#ffd76a";
  ctx.fillRect(0, bh - 1, w, 1);
  ctx.font = `${Math.round(bh * 0.52)}px "Bebas Neue", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffe9b0";
  const spaced = tagline.toUpperCase().split("").join(" ");
  ctx.fillText(spaced, w / 2, bh / 2 + 1);
  drawPalmShape(ctx, w * 0.045, bh * 0.92, bh * 0.045, "#ff5fa2");
  drawPalmShape(ctx, w * 0.955, bh * 0.92, bh * 0.045, "#ff5fa2");
  ctx.restore();
}

function drawVolTag(ctx, w, h) {
  const s = w / 100;
  const x = s * 2;
  const y = h * 0.034 + s * 1.2;
  ctx.save();
  ctx.font = `bold ${Math.round(s * 1.7)}px "Bebas Neue", sans-serif`;
  ctx.textBaseline = "middle";
  const label = "VOL. 01";
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = "rgba(6,3,16,0.8)";
  ctx.fillRect(x, y, tw + s * 1.6, s * 2.6);
  ctx.strokeStyle = "#ffd76a";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, tw + s * 1.6, s * 2.6);
  ctx.fillStyle = "#ffd76a";
  ctx.textAlign = "left";
  ctx.fillText(label, x + s * 0.8, y + s * 1.35);
  ctx.restore();
}

function drawHeatMeter(ctx, w, h) {
  const s = w / 100;
  const segs = 5;
  const lit = 4;
  const segW = s * 2.4;
  const segH = s * 1.5;
  const gap = s * 0.5;
  const total = segs * segW + (segs - 1) * gap;
  const x = w - s * 2 - total;
  const y = h * 0.034 + s * 1.2;
  ctx.save();
  ctx.font = `bold ${Math.round(s * 1.5)}px "Bebas Neue", sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.fillText("HEAT", x - s, y + segH / 2);
  for (let i = 0; i < segs; i++) {
    const sx = x + i * (segW + gap);
    if (i < lit) {
      const g = ctx.createLinearGradient(sx, y, sx, y + segH);
      g.addColorStop(0, "#ffd76a");
      g.addColorStop(1, "#ff2e63");
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.22)";
    }
    ctx.fillRect(sx, y, segW, segH);
  }
  ctx.restore();
}

function drawRibbon(ctx, w, h) {
  const s = w / 100;
  const rx = w * 0.74;
  const rw = s * 4.4;
  const rh = h * 0.085;
  ctx.save();
  ctx.fillStyle = "#ff2e63";
  ctx.beginPath();
  ctx.moveTo(rx, 0);
  ctx.lineTo(rx + rw, 0);
  ctx.lineTo(rx + rw, rh);
  ctx.lineTo(rx + rw / 2, rh - s * 1.4);
  ctx.lineTo(rx, rh);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `bold ${Math.round(s * 1.5)}px "Bebas Neue", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Nº 01", rx + rw / 2, rh * 0.42);
  ctx.restore();
}

function drawStar(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCircularText(ctx, text, cx, cy, radius, font) {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const chars = [...text];
  const total = chars.reduce((sum, ch) => sum + ctx.measureText(ch).width, 0);
  let angle = -Math.PI / 2 - total / radius / 2;
  for (const ch of chars) {
    const wch = ctx.measureText(ch).width;
    angle += wch / 2 / radius;
    ctx.save();
    ctx.translate(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    angle += wch / 2 / radius;
  }
  ctx.restore();
}

function drawSeal(ctx, w, h) {
  const s = w / 100;
  const r = s * 4.8;
  const cx = w - s * 2 - r;
  const cy = h - s * 8.2 - r;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.1);
  const gold = ctx.createLinearGradient(-r, -r, r, r);
  gold.addColorStop(0, "#ffe9a8");
  gold.addColorStop(0.5, "#d4a017");
  gold.addColorStop(1, "#fff3c4");
  ctx.fillStyle = gold;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#7a5200";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r - 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.68, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#4a2f00";
  drawCircularText(ctx, "VICE CERTIFIED • LEONIDA • ", 0, 0, r * 0.84, `bold ${Math.round(r * 0.2)}px "Bebas Neue", sans-serif`);
  ctx.font = `${Math.round(r * 0.34)}px Anton, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#4a2f00";
  ctx.fillText("LEONIDA", 0, -r * 0.08);
  drawStar(ctx, 0, r * 0.32, r * 0.14, "#4a2f00");
  ctx.restore();
}

function drawBarcode(ctx, w, h, seed) {
  const s = w / 100;
  const bw = s * 10;
  const bh = s * 2.6;
  const x = w - s * 2 - bw;
  const y = h - s * 3.4;
  const rnd = mulberry32(seed ^ 0x9e3779b9);
  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.fillRect(x, y, bw, bh);
  let px = x + s * 0.5;
  while (px < x + bw - s * 0.5) {
    const bar = 1 + Math.floor(rnd() * 3) * (s * 0.09);
    ctx.fillStyle = "#111";
    ctx.fillRect(px, y + s * 0.25, bar, bh - s * 0.7);
    px += bar + (1 + rnd() * 3) * (s * 0.09);
  }
  ctx.font = `${Math.round(s * 0.9)}px "Bebas Neue", sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText("MIDNIGHT VICE STUDIO • 2026", x + bw, y - s * 1.5);
  ctx.restore();
}

// Split a title into lines that fit maxWidth at the given font.
function wrapTitle(ctx, text, maxWidth) {
  const words = text.toUpperCase().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width <= maxWidth || !line) {
      line = test;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawTitleBlock(ctx, w, h, state) {
  const s = w / 100;
  const aspect = w / h;
  const titleSize = aspect >= 1.2 ? s * 11.2 : aspect >= 0.95 ? s * 9.4 : s * 9.8;
  const margin = s * 2.4;
  const quoteH = s * 3.2;
  const maxW = w * 0.74;
  ctx.save();
  ctx.font = `${Math.round(titleSize)}px Anton, sans-serif`;
  const lines = wrapTitle(ctx, state.title || "MIDNIGHT RUN", maxW);
  const lineH = titleSize * 0.94;
  const blockH = lines.length * lineH;
  let baseline = h - quoteH - s * 1.2;
  const top = baseline - blockH + lineH * 0.2;
  // Subtitle script above the title, neon glow.
  if (state.subtitle) {
    ctx.save();
    ctx.font = `${Math.round(titleSize * 0.42)}px Pacifico, cursive`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.shadowColor = "#ff2e88";
    ctx.shadowBlur = titleSize * 0.28;
    ctx.fillStyle = "#ffd7ec";
    ctx.fillText(state.subtitle, margin + s * 0.4, top - s * 1.9);
    ctx.restore();
  }
  // 3D extrusion: dark copies stepped down-right.
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const depth = Math.max(2, Math.round(titleSize * 0.055));
  ctx.fillStyle = "#2b0a4a";
  for (let d = depth; d >= 1; d--) {
    lines.forEach((line, i) => {
      ctx.fillText(line, margin + d, baseline - (lines.length - 1 - i) * lineH + d);
    });
  }
  // Sunset gradient face with a white keyline.
  const grad = ctx.createLinearGradient(0, top, 0, baseline + titleSize * 0.2);
  grad.addColorStop(0, "#ffe9a8");
  grad.addColorStop(0.45, "#ffb35c");
  grad.addColorStop(0.75, "#ff5e8a");
  grad.addColorStop(1, "#c44dff");
  lines.forEach((line, i) => {
    const y = baseline - (lines.length - 1 - i) * lineH;
    ctx.lineWidth = Math.max(1.5, titleSize * 0.045);
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.strokeText(line, margin, y);
    ctx.fillStyle = grad;
    ctx.fillText(line, margin, y);
  });
  ctx.restore();
  return { titleTop: top, quoteY: h - quoteH };
}

function drawQuoteLine(ctx, w, h, state) {
  const s = w / 100;
  const y = h - s * 1.7;
  const margin = s * 2.4;
  ctx.save();
  ctx.textBaseline = "middle";
  let x = margin;
  for (let i = 0; i < 5; i++) {
    drawStar(ctx, x + s * 0.7, y, s * 0.75, "#ffd76a");
    x += s * 1.9;
  }
  x += s * 0.6;
  const quote = `“${state.quote}” — ${state.quoteSource}`;
  let size = s * 1.9;
  ctx.font = `${Math.round(size)}px "Bebas Neue", sans-serif`;
  const maxW = w * 0.6 - x;
  while (ctx.measureText(quote).width > maxW && size > s * 1.1) {
    size *= 0.94;
    ctx.font = `${Math.round(size)}px "Bebas Neue", sans-serif`;
  }
  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  ctx.fillText(quote, x, y);
  ctx.restore();
}

function drawCalloutsAndLabels(ctx, rects, state) {
  const zone = titleZone(rects.w, rects.h);
  rects.list.forEach((r, i) => {
    const panel = state.panels[i];
    if (!panel) return;
    const s = rects.w / 100;
    // Location chip, top-left of the panel — skipped in the title zone
    // and on top-row panels, where the palm band would cover it.
    if (panel.label && r.y >= s * 4.5) {
      const chipX = r.x + s * 0.9;
      const chipY = r.y + s * 0.9;
      const inTitleZone = chipX < zone.x + zone.w && chipY > zone.y;
      if (!inTitleZone) {
        ctx.save();
        ctx.font = `bold ${Math.round(Math.max(11, s * 1.35))}px "Bebas Neue", sans-serif`;
        const tw = ctx.measureText(panel.label.toUpperCase()).width;
        ctx.fillStyle = "rgba(6,3,16,0.78)";
        ctx.fillRect(chipX, chipY, tw + s * 1.1, s * 2.1);
        ctx.fillStyle = "#7ef3ff";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(panel.label.toUpperCase(), chipX + s * 0.55, chipY + s * 1.08);
        ctx.restore();
      }
    }
    // Callout caption bar along the panel's bottom edge. The bleed hero
    // carries none — its bar would sit under the title and press quote —
    // and neither does a panel whose bottom edge is the cover's bottom
    // edge, where the press quote owns the strip.
    if (panel.callout && !r.bleed && r.y + r.h < rects.h - 1) {
      const barH = Math.max(18, rects.h * 0.038);
      ctx.save();
      ctx.fillStyle = "rgba(6,3,16,0.72)";
      ctx.fillRect(r.x, r.y + r.h - barH, r.w, barH);
      ctx.font = `${Math.round(barH * 0.52)}px "Bebas Neue", sans-serif`;
      ctx.fillStyle = "#ffe9b0";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      let text = panel.callout.toUpperCase();
      while (ctx.measureText(text).width > r.w - s * 1.6 && text.length > 4) {
        text = text.slice(0, -1);
      }
      ctx.fillText(text, r.x + s * 0.8, r.y + r.h - barH / 2 + 1);
      ctx.restore();
    }
  });
}

// --- main entry -------------------------------------------------------

export function renderCover(canvas, state, photos) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const seed = hashSeed(state.seed || "midnight-vice");
  ctx.save();
  ctx.fillStyle = "#0b0718";
  ctx.fillRect(0, 0, w, h);
  const rects = panelRects(state.layout, w, h);
  const filter = photoFilter(state.grade, state.strength, state.contrast, state.saturation);
  rects.forEach((r, i) => {
    const panel = state.panels[i];
    const photo = panel && photos.get(panel.photoId);
    if (photo && photo.img.complete && photo.img.naturalWidth > 0) {
      drawPhoto(ctx, r, photo, panel, filter);
    } else {
      ctx.save();
      clipPanel(ctx, r);
      const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
      g.addColorStop(0, "#241239");
      g.addColorStop(1, "#12081f");
      ctx.fillStyle = g;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.restore();
    }
  });
  paintGradeOverlays(ctx, w, h, state.grade, state.strength);
  // Bottom scrim so the lettering always reads.
  const scrim = ctx.createLinearGradient(0, h * 0.55, 0, h);
  scrim.addColorStop(0, "rgba(5,2,12,0)");
  scrim.addColorStop(1, "rgba(5,2,12,0.62)");
  ctx.fillStyle = scrim;
  ctx.fillRect(0, h * 0.55, w, h * 0.45);
  drawGrain(ctx, w, h, state.grain, seed);
  if (state.halftone) drawHalftone(ctx, w, h);
  drawCalloutsAndLabels(ctx, { list: rects, w, h }, state);
  drawPalmBand(ctx, w, h, state.tagline || "WELCOME TO LEONIDA");
  drawVolTag(ctx, w, h);
  drawHeatMeter(ctx, w, h);
  drawRibbon(ctx, w, h);
  drawTitleBlock(ctx, w, h, state);
  drawQuoteLine(ctx, w, h, state);
  drawSeal(ctx, w, h);
  drawBarcode(ctx, w, h, seed);
  drawVignette(ctx, w, h, state.vignette);
  ctx.restore();
}
