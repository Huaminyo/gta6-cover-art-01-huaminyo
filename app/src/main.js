// main.js — the editor of Midnight Vice Cover Studio.
//
// Owns the app state (layout, grade, size, captions, the photo list with
// a crop per photo), the live canvas preview, every control in the side
// panel, undo/redo, shuffle, the portrait-aware auto-fill, drag & drop
// and paste for the user's own photos, face-anchored cropping, and the
// three-size PNG export. It also reads the ?shot= URL parameters the
// screenshot run uses (cover vs editor, size, layout, grade, title).

import { GRADES, gradeById } from './grades.js';
import { LAYOUTS, layoutById, panelRects } from './layouts.js';
import { renderCover, coverSize, hashSeed } from './cover.js';

const SAMPLE_PHOTOS = [
  { id: 'hero', src: 'samples/hero.jpg', role: 'HERO', callout: '13 YEARS. ONE CITY.' },
  { id: 'driver', src: 'samples/driver.jpg', role: 'DRIVER', callout: '' },
  { id: 'lookout', src: 'samples/lookout.jpg', role: 'LOOKOUT', callout: '' },
  { id: 'rider', src: 'samples/rider.jpg', role: 'RIDER', callout: '' },
  { id: 'boss', src: 'samples/boss.jpg', role: 'BOSS', callout: 'HE RUNS VICE CITY.' },
  { id: 'ride', src: 'samples/ride.jpg', role: 'RIDE', callout: '' },
  { id: 'city', src: 'samples/skyline.jpg', role: 'CITY', callout: '' },
];

function freshCrop() {
  return { ox: 0, oy: 0, zoom: 1, flip: false, face: null };
}

function defaultState() {
  return {
    layout: 'mosaic',
    grade: 'neon-night',
    size: '16x9',
    title: 'MIDNIGHT RUN',
    subtitle: 'Vice City, USA',
    tagline: 'EVERY SUNSET HAS A PRICE',
    quote: 'A NEON MASTERPIECE',
    quoteSource: 'VICE DAILY',
    edition: 'DELUXE EDITION',
    location: 'LEONIDA  •  6:47 PM',
    sealText: 'VICE CERTIFIED',
    heat: 4,
    grain: true,
    vignette: true,
    halftone: false,
    selectedPanel: 0,
    photos: SAMPLE_PHOTOS.map((p) => ({ ...p, crop: freshCrop() })),
  };
}

const state = defaultState();
const images = {}; // photo id -> loaded HTMLImageElement
const canvas = document.getElementById('cover-canvas');
const fileInput = document.getElementById('photo-file');

let undoStack = [];
let redoStack = [];
let renderQueued = false;

function snapshot() {
  return JSON.stringify(state);
}

function pushUndo() {
  undoStack.push(snapshot());
  if (undoStack.length > 60) undoStack.shift();
  redoStack = [];
  updateUndoButtons();
}

function restore(json) {
  const parsed = JSON.parse(json);
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, parsed);
  syncControls();
  queueRender();
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  restore(undoStack.pop());
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  restore(redoStack.pop());
}

function updateUndoButtons() {
  const u = document.getElementById('btn-undo');
  const r = document.getElementById('btn-redo');
  if (u) u.disabled = undoStack.length === 0;
  if (r) r.disabled = redoStack.length === 0;
}

function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    try {
      renderCover(canvas, state, images);
    } catch (err) {
      console.error('render failed', err);
    }
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Face anchor: when the browser ships the Shape Detection API, find the
// biggest face and aim the panel crop at it; otherwise fall back to the
// upper-third bias the renderer already applies.
async function detectFaceAnchor(img) {
  if (typeof window.FaceDetector === 'undefined') return null;
  try {
    const detector = new window.FaceDetector({ fastMode: true });
    const faces = await detector.detect(img);
    if (!faces.length) return null;
    const box = faces[0].boundingBox;
    return {
      fx: (box.x + box.width / 2) / img.naturalWidth,
      fy: (box.y + box.height / 2) / img.naturalHeight,
    };
  } catch {
    return null;
  }
}

async function loadSamples() {
  await Promise.all(
    state.photos.map(async (photo) => {
      try {
        const img = await loadImage(photo.src);
        images[photo.id] = img;
        photo.crop.face = await detectFaceAnchor(img);
      } catch {
        console.warn('sample failed to load', photo.src);
      }
    }),
  );
  queueRender();
}

async function addUserPhotos(files) {
  const list = [...files].filter((f) => f.type.startsWith('image/'));
  if (!list.length) return;
  pushUndo();
  for (const file of list) {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      const id = `user-${hashSeed(file.name + file.size + Date.now())}`;
      const role = `GUEST ${state.photos.length + 1}`;
      state.photos.push({ id, src: url, role, callout: '', crop: freshCrop() });
      images[id] = img;
      state.photos[state.photos.length - 1].crop.face = await detectFaceAnchor(img);
    } catch {
      URL.revokeObjectURL(url);
    }
  }
  buildPhotoList();
  queueRender();
}

// Portrait-aware auto-fill: tall photos go to tall panels, wide photos
// to wide ones, so no panel wastes its frame on the wrong orientation.
function autoFill() {
  pushUndo();
  const layout = layoutById(state.layout);
  const rects = panelRects(layout, 1000, 1000);
  const slots = rects.map((r, i) => ({ i, tall: r.h > r.w * 1.15, wide: r.w > r.h * 1.15 }));
  const pool = [...state.photos];
  const placed = new Array(state.photos.length).fill(null);
  const aspectOf = (photo) => {
    const img = images[photo.id];
    if (!img) return 1;
    return img.naturalWidth / img.naturalHeight;
  };
  slots.forEach((slot) => {
    let best = -1;
    let bestScore = -Infinity;
    pool.forEach((photo, j) => {
      if (!photo) return;
      const a = aspectOf(photo);
      let score = -Math.abs(Math.log(a));
      if (slot.tall && a < 0.9) score += 2;
      if (slot.wide && a > 1.4) score += 2;
      if (slot.tall && a > 1.4) score -= 2;
      if (slot.wide && a < 0.9) score -= 2;
      if (score > bestScore) {
        bestScore = score;
        best = j;
      }
    });
    if (best >= 0) {
      placed[slot.i] = pool[best];
      pool[best] = null;
    }
  });
  const leftovers = pool.filter(Boolean);
  const ordered = placed.filter(Boolean).concat(leftovers);
  state.photos = ordered;
  buildPhotoList();
  queueRender();
}

function shuffleLook() {
  pushUndo();
  state.layout = LAYOUTS[Math.floor(Math.random() * LAYOUTS.length)].id;
  state.grade = GRADES[Math.floor(Math.random() * GRADES.length)].id;
  state.photos = [...state.photos].sort(() => Math.random() - 0.5);
  syncControls();
  buildPhotoList();
  queueRender();
}

function swapPhotos(a, b) {
  if (a === b || a < 0 || b < 0 || a >= state.photos.length || b >= state.photos.length) return;
  pushUndo();
  const tmp = state.photos[a];
  state.photos[a] = state.photos[b];
  state.photos[b] = tmp;
  buildPhotoList();
  queueRender();
}

// ---- controls -----------------------------------------------------------

function el(id) {
  return document.getElementById(id);
}

function buildLayoutButtons() {
  const wrap = el('layout-row');
  wrap.innerHTML = '';
  LAYOUTS.forEach((layout) => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = layout.name;
    b.title = layout.blurb;
    b.dataset.layout = layout.id;
    b.addEventListener('click', () => {
      if (state.layout === layout.id) return;
      pushUndo();
      state.layout = layout.id;
      syncControls();
      queueRender();
    });
    wrap.appendChild(b);
  });
}

function buildGradeSwatches() {
  const wrap = el('grade-row');
  wrap.innerHTML = '';
  GRADES.forEach((grade) => {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.title = grade.name;
    b.dataset.grade = grade.id;
    b.style.background = `linear-gradient(135deg, ${grade.titleStops[0]}, ${grade.titleStops[2]}, ${grade.titleStops[3]})`;
    b.addEventListener('click', () => {
      if (state.grade === grade.id) return;
      pushUndo();
      state.grade = grade.id;
      syncControls();
      queueRender();
    });
    wrap.appendChild(b);
  });
}

function buildSizeButtons() {
  const wrap = el('size-row');
  wrap.innerHTML = '';
  Object.entries({
    '16x9': '16:9 · 1920×1080',
    '4x5': '4:5 · 1080×1350',
    '1x1': '1:1 · 1080×1080',
  }).forEach(([id, label]) => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = label;
    b.dataset.size = id;
    b.addEventListener('click', () => {
      if (state.size === id) return;
      pushUndo();
      state.size = id;
      syncControls();
      queueRender();
    });
    wrap.appendChild(b);
  });
}

function buildPhotoList() {
  const wrap = el('photo-list');
  wrap.innerHTML = '';
  state.photos.forEach((photo, i) => {
    const card = document.createElement('div');
    card.className = 'photo-card';
    if (state.selectedPanel === i) card.classList.add('selected');
    card.dataset.index = i;

    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = i + 1;
    badge.draggable = true;
    badge.title = 'Drag onto another photo to swap panels';
    badge.addEventListener('dragstart', (ev) => {
      ev.dataTransfer.setData('text/plain', String(i));
    });
    card.addEventListener('dragover', (ev) => ev.preventDefault());
    card.addEventListener('drop', (ev) => {
      ev.preventDefault();
      const from = Number(ev.dataTransfer.getData('text/plain'));
      swapPhotos(from, i);
    });

    const thumb = document.createElement('img');
    thumb.src = photo.src;
    thumb.alt = photo.role;
    thumb.draggable = false;

    const fields = document.createElement('div');
    fields.className = 'photo-fields';
    const roleInput = document.createElement('input');
    roleInput.value = photo.role;
    roleInput.placeholder = 'Role tag';
    roleInput.setAttribute('aria-label', 'Role tag');
    roleInput.addEventListener('change', () => {
      pushUndo();
      photo.role = roleInput.value.toUpperCase().slice(0, 14);
      queueRender();
    });
    const calloutInput = document.createElement('input');
    calloutInput.value = photo.callout;
    calloutInput.placeholder = 'Callout (optional)';
    calloutInput.setAttribute('aria-label', 'Panel callout');
    calloutInput.addEventListener('change', () => {
      pushUndo();
      photo.callout = calloutInput.value.slice(0, 42);
      queueRender();
    });
    fields.append(roleInput, calloutInput);

    const flipBtn = document.createElement('button');
    flipBtn.className = 'mini';
    flipBtn.textContent = 'Flip';
    flipBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      pushUndo();
      photo.crop.flip = !photo.crop.flip;
      queueRender();
    });

    card.append(badge, thumb, fields, flipBtn);
    card.addEventListener('click', () => {
      state.selectedPanel = i;
      buildPhotoList();
      queueRender();
    });
    wrap.appendChild(card);
  });
}

function bindTextInputs() {
  const map = {
    'in-title': 'title',
    'in-subtitle': 'subtitle',
    'in-tagline': 'tagline',
    'in-quote': 'quote',
    'in-source': 'quoteSource',
    'in-edition': 'edition',
    'in-location': 'location',
    'in-seal': 'sealText',
  };
  Object.entries(map).forEach(([id, key]) => {
    const input = el(id);
    if (!input) return;
    input.addEventListener('input', () => {
      state[key] = input.value;
      queueRender();
    });
    input.addEventListener('change', () => pushUndo());
  });
}

function bindToggles() {
  const map = { 'fx-grain': 'grain', 'fx-vignette': 'vignette', 'fx-halftone': 'halftone' };
  Object.entries(map).forEach(([id, key]) => {
    const box = el(id);
    if (!box) return;
    box.addEventListener('change', () => {
      pushUndo();
      state[key] = box.checked;
      queueRender();
    });
  });
  const heat = el('in-heat');
  if (heat) {
    heat.addEventListener('input', () => {
      state.heat = Number(heat.value);
      el('heat-value').textContent = `${state.heat} / 5`;
      queueRender();
    });
    heat.addEventListener('change', () => pushUndo());
  }
}

function syncControls() {
  document.querySelectorAll('#layout-row .chip').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === state.layout);
  });
  document.querySelectorAll('#grade-row .swatch').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === state.grade);
  });
  document.querySelectorAll('#size-row .chip').forEach((b) => {
    b.classList.toggle('active', b.dataset.size === state.size);
  });
  const values = {
    'in-title': state.title,
    'in-subtitle': state.subtitle,
    'in-tagline': state.tagline,
    'in-quote': state.quote,
    'in-source': state.quoteSource,
    'in-edition': state.edition,
    'in-location': state.location,
    'in-seal': state.sealText,
  };
  Object.entries(values).forEach(([id, v]) => {
    const input = el(id);
    if (input && document.activeElement !== input) input.value = v;
  });
  const heat = el('in-heat');
  if (heat) heat.value = state.heat;
  const heatValue = el('heat-value');
  if (heatValue) heatValue.textContent = `${state.heat} / 5`;
  const gradeName = el('grade-name');
  if (gradeName) gradeName.textContent = gradeById(state.grade).name;
  const layoutName = el('layout-name');
  if (layoutName) layoutName.textContent = layoutById(state.layout).name;
  ['fx-grain', 'fx-vignette', 'fx-halftone'].forEach((id) => {
    const box = el(id);
    if (box) box.checked = state[id.replace('fx-', '')];
  });
  updateUndoButtons();
}

// ---- canvas interaction: pick a panel, drag to pan, scroll to zoom ------

function canvasPoint(ev) {
  const box = canvas.getBoundingClientRect();
  const scaleX = canvas.width / box.width;
  const scaleY = canvas.height / box.height;
  return { x: (ev.clientX - box.left) * scaleX, y: (ev.clientY - box.top) * scaleY };
}

function panelAt(x, y) {
  const { w, h } = coverSize(state.size);
  const rects = panelRects(layoutById(state.layout), w, h);
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

function bindCanvas() {
  let dragging = null;
  canvas.addEventListener('pointerdown', (ev) => {
    const p = canvasPoint(ev);
    const idx = panelAt(p.x, p.y);
    if (idx < 0) return;
    pushUndo();
    state.selectedPanel = idx;
    buildPhotoList();
    dragging = { idx, startX: ev.clientX, startY: ev.clientY, ox: state.photos[idx].crop.ox, oy: state.photos[idx].crop.oy };
    canvas.setPointerCapture(ev.pointerId);
    queueRender();
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (!dragging) return;
    const box = canvas.getBoundingClientRect();
    const crop = state.photos[dragging.idx].crop;
    crop.ox = Math.max(-1, Math.min(1, dragging.ox + ((ev.clientX - dragging.startX) / box.width) * 2));
    crop.oy = Math.max(-1, Math.min(1, dragging.oy + ((ev.clientY - dragging.startY) / box.height) * 2));
    queueRender();
  });
  canvas.addEventListener('pointerup', () => {
    dragging = null;
  });
  canvas.addEventListener('wheel', (ev) => {
    const p = canvasPoint(ev);
    const idx = panelAt(p.x, p.y);
    if (idx < 0) return;
    ev.preventDefault();
    pushUndo();
    const crop = state.photos[idx].crop;
    const factor = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
    crop.zoom = Math.max(1, Math.min(4, crop.zoom * factor));
    queueRender();
  }, { passive: false });
}

// ---- export -------------------------------------------------------------

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function exportPNG(sizeId) {
  const off = document.createElement('canvas');
  const previousSize = state.size;
  state.size = sizeId;
  renderCover(off, state, images);
  state.size = previousSize;
  queueRender();
  const blob = await new Promise((resolve) => off.toBlob(resolve, 'image/png'));
  const slug = (state.title || 'cover').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  downloadBlob(blob, `${slug}-${sizeId}.png`);
  return blob;
}

async function exportAll() {
  for (const sizeId of ['16x9', '4x5', '1x1']) {
    // eslint-disable-next-line no-await-in-loop
    await exportPNG(sizeId);
  }
}

function bindButtons() {
  el('btn-undo').addEventListener('click', undo);
  el('btn-redo').addEventListener('click', redo);
  el('btn-shuffle').addEventListener('click', shuffleLook);
  el('btn-autofill').addEventListener('click', autoFill);
  el('btn-add-photo').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    addUserPhotos(fileInput.files);
    fileInput.value = '';
  });
  el('btn-export-16x9').addEventListener('click', () => exportPNG('16x9'));
  el('btn-export-4x5').addEventListener('click', () => exportPNG('4x5'));
  el('btn-export-1x1').addEventListener('click', () => exportPNG('1x1'));
  el('btn-export-all').addEventListener('click', exportAll);

  document.addEventListener('keydown', (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z' && !ev.shiftKey) {
      ev.preventDefault();
      undo();
    } else if ((ev.ctrlKey || ev.metaKey) && (ev.key.toLowerCase() === 'y' || (ev.key.toLowerCase() === 'z' && ev.shiftKey))) {
      ev.preventDefault();
      redo();
    }
  });

  document.addEventListener('paste', (ev) => {
    const files = [...(ev.clipboardData?.files ?? [])];
    if (files.length) addUserPhotos(files);
  });
  const stage = el('stage');
  stage.addEventListener('dragover', (ev) => {
    ev.preventDefault();
    stage.classList.add('drop-ready');
  });
  stage.addEventListener('dragleave', () => stage.classList.remove('drop-ready'));
  stage.addEventListener('drop', (ev) => {
    ev.preventDefault();
    stage.classList.remove('drop-ready');
    addUserPhotos(ev.dataTransfer.files);
  });
}

// ---- URL parameters (screenshot runs) -----------------------------------

function applyUrlParams() {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot');
  if (q.get('size') && coverSize(q.get('size'))) state.size = q.get('size');
  if (q.get('layout')) state.layout = q.get('layout');
  if (q.get('grade')) state.grade = q.get('grade');
  if (q.get('title')) state.title = q.get('title');
  if (q.get('subtitle')) state.subtitle = q.get('subtitle');
  if (shot === 'cover') document.body.classList.add('shot-cover');
  if (shot === 'editor') document.body.classList.add('shot-editor');
}

// ---- boot ---------------------------------------------------------------

window.__studio = { state, images, renderCover, exportPNG, autoFill, shuffleLook, undo, redo };

async function boot() {
  applyUrlParams();
  buildLayoutButtons();
  buildGradeSwatches();
  buildSizeButtons();
  buildPhotoList();
  bindTextInputs();
  bindToggles();
  bindButtons();
  bindCanvas();
  syncControls();
  try {
    await document.fonts.ready;
  } catch {
    // Fonts are local files; if the ready promise fails, render anyway.
  }
  await loadSamples();
  queueRender();
  document.body.classList.add('ready');
}

boot();
