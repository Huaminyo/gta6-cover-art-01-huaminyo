// main.js — the Midnight Vice Cover Studio editor.
// Owns the editor state (photos, panels, caption, look), wires every
// control, drives the live canvas preview, and exports PNGs. Photos never
// leave the machine: uploads stay as local object URLs and the app makes
// no network request.
import { GRADES, gradeById } from './grades.js';
import { LAYOUTS, layoutById } from './layouts.js';
import { SIZES, renderCover, exportCoverPNG, ensureCoverFonts } from './cover.js';

const SAMPLES = [
  { id: 'sample-hero', name: 'Hero — Neon Row', src: 'samples/hero.jpg', role: 'THE QUEEN' },
  { id: 'sample-driver', name: 'Driver — Boulevard', src: 'samples/driver.jpg', role: 'THE DRIVER' },
  { id: 'sample-rider', name: 'Rider — Coast Road', src: 'samples/rider.jpg', role: 'THE RIDER' },
  { id: 'sample-boss', name: 'Boss — Rooftop', src: 'samples/boss.jpg', role: 'THE BOSS' },
  { id: 'sample-lookout', name: 'Lookout — Bonfire', src: 'samples/lookout.jpg', role: 'THE LOOKOUT' },
  { id: 'sample-ride', name: 'Ride — Pink Coupe', src: 'samples/ride.jpg', role: 'THE GETAWAY' },
  { id: 'sample-skyline', name: 'Skyline — Dusk', src: 'samples/skyline.jpg', role: 'VICE CITY' },
];

const ROLES = ['THE QUEEN', 'THE DRIVER', 'THE RIDER', 'THE BOSS', 'THE LOOKOUT', 'THE FIXER', 'THE INSIDER', 'THE WILDCARD'];
const SHUFFLE_TITLES = [
  ['MIDNIGHT RUN', 'chasing the last light'],
  ['NEON HEIST', 'one crew. one night. no witnesses.'],
  ['VELVET HEAT', 'the city never sleeps, neither do we'],
  ['LAST LIGHT CLUB', 'every sunset is a getaway'],
  ['CHROME TIDE', 'ride the neon, own the night'],
];

function defaultCrop() {
  // Portrait-aware default: bias the crop toward the upper third,
  // where a face usually sits, so people stay in frame.
  return { photoId: null, zoom: 1, dx: 0, dy: -0.06, flip: false };
}

function defaultState() {
  return {
    size: '16x9',
    layoutId: 'mosaic',
    gradeId: 'neon-night',
    photos: [],
    panels: [],
    title: 'MIDNIGHT RUN',
    script: 'chasing the last light',
    tagline: 'SEVEN LIVES · ONE NIGHT · NO WAY HOME',
    quote: 'A NEON-NOIR JOYRIDE',
    quoteSource: 'THE NIGHT DESK',
    billing: 'A MIDNIGHT VICE PICTURE\nMIDNIGHT RUN · STARRING THE NIGHT CREW · NO WAY HOME',
    sealText: 'ORIGINAL COVER ART',
    releaseLine: 'COMING SOON',
    editionTag: 'VOL. 01',
    location: 'NEON ROW · 11:47 PM',
    heat: 5,
    ink: 0.5,
    show: { stars: true, seal: true, tags: true, billing: true, heat: true, location: true, grain: true, vignette: true },
    selectedPanel: 0,
    interactive: true,
  };
}

const state = defaultState();
const imageCache = new Map(); // photo id -> HTMLImageElement
let lastDrawn = []; // panel rects of the last render, in canvas pixels
let undoStack = [];
let redoStack = [];
let renderQueued = false;
let samplesLoaded = false;

const $ = (id) => document.getElementById(id);
const canvas = $('previewCanvas');
const badgeLayer = $('badgeLayer');

function snapshot() {
  return JSON.stringify({
    size: state.size,
    layoutId: state.layoutId,
    gradeId: state.gradeId,
    photos: state.photos.map((p) => ({ id: p.id, name: p.name, src: p.src, role: p.role })),
    panels: state.panels,
    title: state.title,
    script: state.script,
    tagline: state.tagline,
    quote: state.quote,
    quoteSource: state.quoteSource,
    billing: state.billing,
    sealText: state.sealText,
    releaseLine: state.releaseLine,
    editionTag: state.editionTag,
    location: state.location,
    heat: state.heat,
    ink: state.ink,
    show: state.show,
    selectedPanel: state.selectedPanel,
  });
}

function commit() {
  undoStack.push(snapshot());
  if (undoStack.length > 50) undoStack.shift();
  redoStack = [];
  updateUndoButtons();
}

function restore(json) {
  const s = JSON.parse(json);
  Object.assign(state, s);
  state.photos = s.photos.map((p) => ({ ...p, img: imageCache.get(p.id) || null }));
  state.photos.forEach((p) => {
    if (!p.img) loadImageFor(p);
  });
  syncControls();
  queueRender();
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  restore(undoStack.pop());
  updateUndoButtons();
  setStatus('Undone.');
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  restore(redoStack.pop());
  updateUndoButtons();
  setStatus('Redone.');
}

function updateUndoButtons() {
  $('undoBtn').disabled = !undoStack.length;
  $('redoBtn').disabled = !redoStack.length;
}

function setStatus(msg) {
  $('status').textContent = msg;
}

function panelCount() {
  const size = SIZES[state.size];
  return layoutById(state.layoutId).panels(size.w, size.h).length;
}

function ensurePanels() {
  const n = panelCount();
  while (state.panels.length < n) {
    state.panels.push(defaultCrop());
  }
  state.panels.length = n;
  if (state.selectedPanel >= n) state.selectedPanel = 0;
}

// Assign photos to panels, aspect-aware: each panel takes the unused
// photo whose aspect ratio best matches the panel's, so a portrait hero
// never lands in a wide strip (and vice versa). Falls back to cycling.
export function autoFillPanels() {
  ensurePanels();
  const photos = state.photos;
  if (!photos.length) return;
  const size = SIZES[state.size];
  const rects = layoutById(state.layoutId).panels(size.w, size.h);
  const aspect = (p) => (p.img && p.img.naturalHeight ? p.img.naturalWidth / p.img.naturalHeight : 1);
  const unused = [...photos];
  state.panels.forEach((panel, i) => {
    const rect = rects[i];
    const panelAspect = (rect.w * size.w) / (rect.h * size.h);
    let pick = 0;
    if (unused.length) {
      let best = Infinity;
      unused.forEach((photo, j) => {
        const diff = Math.abs(Math.log(aspect(photo) / panelAspect));
        if (diff < best) {
          best = diff;
          pick = j;
        }
      });
      panel.photoId = unused.splice(pick, 1)[0].id;
    } else {
      panel.photoId = photos[i % photos.length].id;
    }
    panel.zoom = 1;
    panel.dx = 0;
    panel.dy = -0.06;
    panel.flip = false;
  });
  queueRender();
}

function loadImageFor(photo) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      photo.img = img;
      imageCache.set(photo.id, img);
      queueRender();
      resolve(true);
    };
    img.onerror = () => resolve(false);
    img.src = photo.src;
  });
}

async function loadSamples() {
  if (samplesLoaded) return;
  samplesLoaded = true;
  state.photos = SAMPLES.map((s) => ({ ...s, img: null }));
  await Promise.all(state.photos.map((p) => loadImageFor(p)));
  autoFillPanels();
  renderPhotoList();
  renderRoleList();
  queueRender();
}

function addUserPhotos(files) {
  const imgs = [...files].filter((f) => f.type.startsWith('image/'));
  if (!imgs.length) {
    setStatus('No images in that drop.');
    return;
  }
  commit();
  imgs.forEach((file) => {
    const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const photo = { id, name: file.name.replace(/\.[^.]+$/, ''), src: URL.createObjectURL(file), img: null, role: ROLES[state.photos.length % ROLES.length] };
    state.photos.push(photo);
    loadImageFor(photo);
  });
  autoFillPanels();
  renderPhotoList();
  setStatus(`${imgs.length} photo${imgs.length > 1 ? 's' : ''} added and placed into panels.`);
}

function removePhoto(id) {
  commit();
  const photo = state.photos.find((p) => p.id === id);
  state.photos = state.photos.filter((p) => p.id !== id);
  if (photo && photo.src.startsWith('blob:')) URL.revokeObjectURL(photo.src);
  state.panels.forEach((panel) => {
    if (panel.photoId === id) panel.photoId = state.photos[0] ? state.photos[0].id : null;
  });
  renderPhotoList();
  queueRender();
}

function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderPreview();
  });
}

function renderPreview() {
  const size = SIZES[state.size];
  if (canvas.width !== size.w || canvas.height !== size.h) {
    canvas.width = size.w;
    canvas.height = size.h;
  }
  ensurePanels();
  const out = renderCover(canvas, state);
  lastDrawn = out.drawn;
  positionBadges();
  $('sizeLabel').textContent = size.label;
  $('panelLabel').textContent = `Panel ${state.selectedPanel + 1} of ${state.panels.length}`;
}

function canvasCssScale() {
  const rect = canvas.getBoundingClientRect();
  return { sx: rect.width / canvas.width, sy: rect.height / canvas.height, rect };
}

function positionBadges() {
  const { sx, sy } = canvasCssScale();
  badgeLayer.innerHTML = '';
  lastDrawn.forEach((rect, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'panel-badge' + (i === state.selectedPanel ? ' selected' : '');
    b.textContent = String(i + 1);
    b.style.left = `${rect.x * sx + 6}px`;
    b.style.top = `${rect.y * sy + 6}px`;
    b.dataset.panel = String(i);
    b.setAttribute('aria-label', `Select panel ${i + 1}`);
    b.addEventListener('pointerdown', (ev) => startBadgeDrag(ev, i, b));
    b.addEventListener('click', () => {
      if (badgeDragMoved) return;
      state.selectedPanel = i;
      syncPanelBar();
      queueRender();
    });
    badgeLayer.appendChild(b);
  });
}

let badgeDragMoved = false;
function startBadgeDrag(ev, index, el) {
  badgeDragMoved = false;
  const startX = ev.clientX;
  const startY = ev.clientY;
  el.setPointerCapture(ev.pointerId);
  const move = (e) => {
    if (Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) > 8) badgeDragMoved = true;
  };
  const up = (e) => {
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    if (!badgeDragMoved) return;
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const badge = target && target.closest ? target.closest('.panel-badge') : null;
    if (badge && Number(badge.dataset.panel) !== index) {
      commit();
      const j = Number(badge.dataset.panel);
      const a = state.panels[index].photoId;
      state.panels[index].photoId = state.panels[j].photoId;
      state.panels[j].photoId = a;
      setStatus(`Swapped panels ${index + 1} and ${j + 1}.`);
      queueRender();
    }
  };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
}

// Canvas pointer: click to select a panel, drag to pan its photo.
let drag = null;
canvas.addEventListener('pointerdown', (ev) => {
  const { sx, sy, rect } = canvasCssScale();
  const x = (ev.clientX - rect.left) / sx;
  const y = (ev.clientY - rect.top) / sy;
  const hit = lastDrawn.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  if (hit < 0) return;
  state.selectedPanel = hit;
  syncPanelBar();
  queueRender();
  drag = { panel: hit, lastX: ev.clientX, lastY: ev.clientY, moved: false };
  canvas.setPointerCapture(ev.pointerId);
});
canvas.addEventListener('pointermove', (ev) => {
  if (!drag) return;
  const panel = state.panels[drag.panel];
  const rect = lastDrawn[drag.panel];
  if (!panel || !rect) return;
  const { sx, sy } = canvasCssScale();
  const dx = ((ev.clientX - drag.lastX) / sx / rect.w) * (panel.flip ? -1 : 1);
  const dy = (ev.clientY - drag.lastY) / sy / rect.h;
  if (Math.abs(ev.clientX - drag.lastX) + Math.abs(ev.clientY - drag.lastY) > 2) drag.moved = true;
  panel.dx = clamp(panel.dx + dx, -0.6, 0.6);
  panel.dy = clamp(panel.dy + dy, -0.6, 0.6);
  drag.lastX = ev.clientX;
  drag.lastY = ev.clientY;
  queueRender();
});
canvas.addEventListener('pointerup', () => {
  if (drag && drag.moved) commit();
  drag = null;
});
canvas.addEventListener('wheel', (ev) => {
  ev.preventDefault();
  const panel = state.panels[state.selectedPanel];
  if (!panel) return;
  panel.zoom = clamp(panel.zoom * (ev.deltaY < 0 ? 1.12 : 1 / 1.12), 1, 3);
  syncPanelBar();
  queueRender();
}, { passive: false });

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function syncPanelBar() {
  const panel = state.panels[state.selectedPanel];
  if (!panel) return;
  $('zoomRange').value = String(panel.zoom);
  $('zoomLabel').textContent = `${panel.zoom.toFixed(2)}x`;
}

function cyclePanelPhoto(dir) {
  if (!state.photos.length) return;
  commit();
  const panel = state.panels[state.selectedPanel];
  const idx = state.photos.findIndex((p) => p.id === panel.photoId);
  const next = state.photos[(idx + dir + state.photos.length) % state.photos.length];
  panel.photoId = next.id;
  panel.zoom = 1;
  panel.dx = 0;
  panel.dy = -0.06;
  queueRender();
}

function renderPhotoList() {
  const list = $('photoList');
  list.innerHTML = '';
  state.photos.forEach((photo, i) => {
    const item = document.createElement('div');
    item.className = 'photo-thumb';
    const img = document.createElement('img');
    img.src = photo.src;
    img.alt = photo.name;
    const num = document.createElement('span');
    num.className = 'photo-num';
    num.textContent = String(i + 1);
    const name = document.createElement('span');
    name.className = 'photo-name';
    name.textContent = photo.name;
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'photo-del';
    del.textContent = '×';
    del.setAttribute('aria-label', `Remove ${photo.name}`);
    del.addEventListener('click', () => removePhoto(photo.id));
    item.append(img, num, name, del);
    item.addEventListener('click', (ev) => {
      if (ev.target === del) return;
      commit();
      const panel = state.panels[state.selectedPanel];
      if (panel) {
        panel.photoId = photo.id;
        panel.zoom = 1;
        panel.dx = 0;
        panel.dy = -0.06;
      }
      setStatus(`${photo.name} placed into panel ${state.selectedPanel + 1}.`);
      queueRender();
    });
    list.appendChild(item);
  });
  $('photoCount').textContent = `${state.photos.length} photo${state.photos.length === 1 ? '' : 's'}`;
}

function renderLayoutList() {
  const list = $('layoutList');
  list.innerHTML = '';
  LAYOUTS.forEach((layout) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'option-card' + (layout.id === state.layoutId ? ' active' : '');
    b.innerHTML = `<span class="option-title">${layout.name}</span><span class="option-hint">${layout.hint}</span>`;
    b.addEventListener('click', () => {
      if (state.layoutId === layout.id) return;
      commit();
      state.layoutId = layout.id;
      ensurePanels();
      autoFillPanels();
      renderLayoutList();
      renderRoleList();
      setStatus(`Layout: ${layout.name}.`);
    });
    list.appendChild(b);
  });
}

function renderGradeList() {
  const list = $('gradeList');
  list.innerHTML = '';
  GRADES.forEach((grade) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'grade-swatch' + (grade.id === state.gradeId ? ' active' : '');
    b.style.background = `linear-gradient(135deg, ${grade.titleStops[0]}, ${grade.titleStops[1]} 45%, ${grade.titleStops[3]})`;
    b.title = grade.name;
    b.setAttribute('aria-label', `Grade ${grade.name}`);
    const label = document.createElement('span');
    label.textContent = grade.name;
    b.appendChild(label);
    b.addEventListener('click', () => {
      if (state.gradeId === grade.id) return;
      commit();
      state.gradeId = grade.id;
      renderGradeList();
      setStatus(`Grade: ${grade.name}.`);
      queueRender();
    });
    list.appendChild(b);
  });
}

function renderRoleList() {
  const list = $('roleList');
  list.innerHTML = '';
  state.photos.forEach((photo, i) => {
    const row = document.createElement('label');
    row.className = 'role-row';
    row.innerHTML = `<span class="role-num">${i + 1}</span>`;
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 24;
    input.value = photo.role || '';
    input.placeholder = 'THE ROLE';
    input.setAttribute('aria-label', `Role tag for ${photo.name}`);
    input.addEventListener('input', () => {
      photo.role = input.value;
      queueRender();
    });
    input.addEventListener('change', () => commit());
    row.appendChild(input);
    list.appendChild(row);
  });
}

function bindText(id, key, { multiline = false } = {}) {
  const el = $(id);
  el.addEventListener('input', () => {
    state[key] = el.value;
    queueRender();
  });
  el.addEventListener('change', () => commit());
}

function bindToggle(id, key) {
  $(id).addEventListener('change', () => {
    commit();
    state.show[key] = $(id).checked;
    queueRender();
  });
}

function syncControls() {
  $('titleInput').value = state.title;
  $('scriptInput').value = state.script;
  $('taglineInput').value = state.tagline;
  $('quoteInput').value = state.quote;
  $('quoteSourceInput').value = state.quoteSource;
  $('billingInput').value = state.billing;
  $('sealTextInput').value = state.sealText;
  $('releaseInput').value = state.releaseLine;
  $('editionInput').value = state.editionTag;
  $('locationInput').value = state.location;
  $('heatRange').value = String(state.heat);
  $('heatLabel').textContent = `${state.heat} / 5`;
  $('inkRange').value = String(state.ink);
  $('inkLabel').textContent = `${Math.round(state.ink * 100)}%`;
  for (const key of Object.keys(state.show)) {
    const el = $(`tgl${key[0].toUpperCase()}${key.slice(1)}`);
    if (el) el.checked = state.show[key];
  }
  document.querySelectorAll('#sizeTabs button').forEach((b) => {
    b.classList.toggle('active', b.dataset.size === state.size);
  });
  renderLayoutList();
  renderGradeList();
  renderRoleList();
  renderPhotoList();
  syncPanelBar();
}

function shuffleLook() {
  commit();
  const layout = LAYOUTS[Math.floor(Math.random() * LAYOUTS.length)];
  const grade = GRADES[Math.floor(Math.random() * GRADES.length)];
  const [title, script] = SHUFFLE_TITLES[Math.floor(Math.random() * SHUFFLE_TITLES.length)];
  state.layoutId = layout.id;
  state.gradeId = grade.id;
  state.title = title;
  state.script = script;
  state.heat = 3 + Math.floor(Math.random() * 3);
  ensurePanels();
  autoFillPanels();
  syncControls();
  setStatus(`Shuffled: ${layout.name} + ${grade.name}.`);
}

async function exportCurrent() {
  const size = SIZES[state.size];
  setStatus(`Exporting ${size.label}…`);
  const blob = await exportCoverPNG(state, state.size);
  downloadBlob(blob, `midnight-vice-${state.size}.png`);
  setStatus(`Exported ${size.label} PNG.`);
}

async function exportAll() {
  for (const sizeId of ['16x9', '1x1', '4x5']) {
    const size = SIZES[sizeId];
    setStatus(`Exporting ${size.label}…`);
    const blob = await exportCoverPNG(state, sizeId);
    downloadBlob(blob, `midnight-vice-${sizeId}.png`);
    await new Promise((r) => setTimeout(r, 350));
  }
  setStatus('Exported all 3 PNG sizes.');
}

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

function initShotMode() {
  const q = new URLSearchParams(location.search);
  const shot = q.get('shot');
  if (!shot) return false;
  if (q.get('size') && SIZES[q.get('size')]) state.size = q.get('size');
  if (q.get('layout')) state.layoutId = q.get('layout');
  if (q.get('grade')) state.gradeId = q.get('grade');
  if (q.get('title')) state.title = q.get('title');
  if (q.get('script')) state.script = q.get('script');
  if (q.get('tagline')) state.tagline = q.get('tagline');
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    state.interactive = false;
  }
  return true;
}

async function boot() {
  const shotMode = initShotMode();
  bindText('titleInput', 'title');
  bindText('scriptInput', 'script');
  bindText('taglineInput', 'tagline');
  bindText('quoteInput', 'quote');
  bindText('quoteSourceInput', 'quoteSource');
  bindText('billingInput', 'billing', { multiline: true });
  bindText('sealTextInput', 'sealText');
  bindText('releaseInput', 'releaseLine');
  bindText('editionInput', 'editionTag');
  bindText('locationInput', 'location');
  for (const key of ['stars', 'seal', 'tags', 'billing', 'heat', 'location', 'grain', 'vignette']) {
    bindToggle(`tgl${key[0].toUpperCase()}${key.slice(1)}`, key);
  }
  $('heatRange').addEventListener('input', () => {
    state.heat = Number($('heatRange').value);
    $('heatLabel').textContent = `${state.heat} / 5`;
    queueRender();
  });
  $('heatRange').addEventListener('change', () => commit());
  $('inkRange').addEventListener('input', () => {
    state.ink = Number($('inkRange').value);
    $('inkLabel').textContent = `${Math.round(state.ink * 100)}%`;
    queueRender();
  });
  $('inkRange').addEventListener('change', () => commit());
  $('zoomRange').addEventListener('input', () => {
    const panel = state.panels[state.selectedPanel];
    if (!panel) return;
    panel.zoom = Number($('zoomRange').value);
    $('zoomLabel').textContent = `${panel.zoom.toFixed(2)}x`;
    queueRender();
  });
  $('zoomRange').addEventListener('change', () => commit());
  $('flipBtn').addEventListener('click', () => {
    commit();
    const panel = state.panels[state.selectedPanel];
    if (panel) panel.flip = !panel.flip;
    queueRender();
  });
  $('prevPhotoBtn').addEventListener('click', () => cyclePanelPhoto(-1));
  $('nextPhotoBtn').addEventListener('click', () => cyclePanelPhoto(1));
  $('resetCropBtn').addEventListener('click', () => {
    commit();
    const panel = state.panels[state.selectedPanel];
    if (panel) Object.assign(panel, { zoom: 1, dx: 0, dy: -0.06, flip: false });
    syncPanelBar();
    queueRender();
  });
  $('addPhotos').addEventListener('change', (ev) => {
    addUserPhotos(ev.target.files);
    ev.target.value = '';
  });
  $('loadSamples').addEventListener('click', async () => {
    samplesLoaded = false;
    commit();
    await loadSamples();
    setStatus('Sample crew loaded.');
  });
  $('autoFillBtn').addEventListener('click', () => {
    commit();
    autoFillPanels();
    setStatus('Panels auto-filled.');
  });
  $('undoBtn').addEventListener('click', undo);
  $('redoBtn').addEventListener('click', redo);
  $('shuffleBtn').addEventListener('click', shuffleLook);
  $('exportBtn').addEventListener('click', exportCurrent);
  $('exportAllBtn').addEventListener('click', exportAll);
  document.querySelectorAll('#sizeTabs button').forEach((b) => {
    b.addEventListener('click', () => {
      if (state.size === b.dataset.size) return;
      commit();
      state.size = b.dataset.size;
      syncControls();
      queueRender();
    });
  });
  // Drag & drop and paste anywhere on the page.
  const dropZone = document.body;
  dropZone.addEventListener('dragover', (ev) => {
    ev.preventDefault();
    dropZone.classList.add('dragging');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'));
  dropZone.addEventListener('drop', (ev) => {
    ev.preventDefault();
    dropZone.classList.remove('dragging');
    if (ev.dataTransfer.files.length) addUserPhotos(ev.dataTransfer.files);
  });
  document.addEventListener('paste', (ev) => {
    const files = [...(ev.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
    if (files.length) addUserPhotos(files);
  });
  document.addEventListener('keydown', (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z' && !ev.shiftKey) {
      ev.preventDefault();
      undo();
    } else if ((ev.ctrlKey || ev.metaKey) && (ev.key.toLowerCase() === 'y' || (ev.key.toLowerCase() === 'z' && ev.shiftKey))) {
      ev.preventDefault();
      redo();
    }
  });

  ensurePanels();
  syncControls();
  updateUndoButtons();
  await ensureCoverFonts();
  await loadSamples();
  queueRender();
  // Signal for screenshots: the cover is fully drawn with samples + fonts.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  window.__coverReady = true;
  if (!shotMode) setStatus('Sample crew loaded. Add your own photos to make it yours.');
}

boot();
