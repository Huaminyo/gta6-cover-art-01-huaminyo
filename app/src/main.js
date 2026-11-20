// Midnight Vice Cover Studio — editor.
//
// Wires the DOM to the renderer: photo loading (samples, uploads, drag and
// drop), panel interaction (select, drag to pan, scroll to zoom,
// double-click to re-centre), face-aware crop, history, export, and the
// screenshot scenes (?scene=cover | cover-4x5 | cover-square | editor).

import { LAYOUTS, layoutById, panelRects } from "./layouts.js";
import { GRADES } from "./grades.js";
import { renderCover } from "./cover.js";

const SAMPLES = [
  { id: "hero", file: "samples/hero.jpg", name: "Hero", label: "Ocean Drive", callout: "13 years. One city." },
  { id: "skyline", file: "samples/skyline.jpg", name: "Skyline", label: "Downtown", callout: "The city never sleeps." },
  { id: "ride", file: "samples/ride.jpg", name: "Ride", label: "Coastal Hwy", callout: "He runs Vice City." },
  { id: "rider", file: "samples/rider.jpg", name: "Rider", label: "Neon Strip", callout: "Full throttle." },
  { id: "driver", file: "samples/driver.jpg", name: "Driver", label: "Midnight", callout: "No brakes." },
  { id: "boss", file: "samples/boss.jpg", name: "Boss", label: "Penthouse", callout: "The boss is back." },
  { id: "lookout", file: "samples/lookout.jpg", name: "Lookout", label: "The Pier", callout: "Watch the tide." },
];

const ASPECTS = {
  "16:9": { w: 1280, h: 720 },
  "4:5": { w: 1024, h: 1280 },
  "1:1": { w: 1024, h: 1024 },
};

const EXPORT_SIZES = {
  "16:9": { w: 1920, h: 1080, file: "midnight-vice-16x9.png" },
  "4:5": { w: 1080, h: 1350, file: "midnight-vice-4x5.png" },
  "1:1": { w: 1080, h: 1080, file: "midnight-vice-1x1.png" },
};

const HISTORY_LIMIT = 60;

function defaultPanels(layoutId) {
  const count = panelRects(layoutId, 1200, 675).length;
  return Array.from({ length: count }, (_, i) => {
    const s = SAMPLES[i % SAMPLES.length];
    return { photoId: s.id, panX: 0, panY: 0, zoom: 1, callout: s.callout, label: s.label, anchor: null };
  });
}

function defaultState() {
  return {
    layout: "midnight-hero",
    grade: "neon-night",
    strength: 80,
    contrast: 100,
    saturation: 100,
    grain: 35,
    vignette: 45,
    halftone: false,
    title: "MIDNIGHT RUN",
    subtitle: "a Leonida story",
    quote: "The city never sleeps. Neither do you.",
    quoteSource: "VICE TIMES",
    tagline: "WELCOME TO LEONIDA",
    seed: "midnight-vice",
    aspect: "16:9",
    panels: defaultPanels("midnight-hero"),
  };
}

const state = defaultState();
const photos = new Map(); // id -> { img, name }
let selected = 0;
let undoStack = [];
let redoStack = [];
let renderQueued = false;
let faceDetector = null;

const $ = (id) => document.getElementById(id);
const canvas = $("stage-canvas");
const ctx = canvas.getContext("2d");

// --- history ----------------------------------------------------------

function snapshot() {
  return JSON.stringify(state);
}

function commit() {
  undoStack.push(snapshot());
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack = [];
  updateHistoryButtons();
}

function restore(json) {
  const next = JSON.parse(json);
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, next);
  selected = Math.min(selected, state.panels.length - 1);
  syncControls();
  requestRender();
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  restore(undoStack.pop());
  updateHistoryButtons();
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  restore(redoStack.pop());
  updateHistoryButtons();
}

function updateHistoryButtons() {
  $("btn-undo").disabled = undoStack.length === 0;
  $("btn-redo").disabled = redoStack.length === 0;
}

// --- rendering --------------------------------------------------------

function requestRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    const size = ASPECTS[state.aspect];
    if (canvas.width !== size.w || canvas.height !== size.h) {
      canvas.width = size.w;
      canvas.height = size.h;
    }
    renderCover(canvas, state, photos);
    drawSelection();
  });
}

function drawSelection() {
  const rects = panelRects(state.layout, canvas.width, canvas.height);
  const r = rects[selected];
  if (!r || document.body.classList.contains("scene")) return;
  ctx.save();
  ctx.strokeStyle = "#ff2e88";
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 6]);
  ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
  ctx.restore();
}

// --- photos -----------------------------------------------------------

function loadPhoto(id, src, name) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      photos.set(id, { img, name });
      detectFace(id, img);
      resolve(true);
    };
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

async function detectFace(id, img) {
  if (!("FaceDetector" in window)) return;
  try {
    if (!faceDetector) faceDetector = new FaceDetector({ fastMode: true });
    const faces = await faceDetector.detect(img);
    if (faces && faces.length) {
      const box = faces[0].boundingBox;
      const anchor = {
        x: (box.x + box.width / 2) / img.naturalWidth,
        y: (box.y + box.height / 2) / img.naturalHeight,
      };
      for (const p of state.panels) {
        if (p.photoId === id && !p.anchor) p.anchor = anchor;
      }
      requestRender();
    }
  } catch {
    // Face detection is a bonus; the upper-third fallback stays.
  }
}

async function loadSamples() {
  await Promise.all(SAMPLES.map((s) => loadPhoto(s.id, s.file, s.name)));
  syncPanelControls();
  requestRender();
}

function addUploads(files) {
  const images = [...files].filter((f) => f.type.startsWith("image/"));
  if (!images.length) return;
  commit();
  images.forEach((file, i) => {
    const id = "up-" + Date.now().toString(36) + "-" + i;
    const url = URL.createObjectURL(file);
    loadPhoto(id, url, file.name.replace(/\.[^.]+$/, "")).then(() => {
      const slot = (selected + i) % state.panels.length;
      state.panels[slot].photoId = id;
      state.panels[slot].anchor = null;
      addPhotoChip(id, file.name);
      requestRender();
    });
  });
}

function addPhotoChip(id, name) {
  const tray = $("photo-tray");
  const chip = document.createElement("button");
  chip.className = "photo-chip";
  chip.type = "button";
  chip.textContent = name;
  chip.draggable = true;
  chip.dataset.photoId = id;
  chip.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/photo-id", id);
  });
  chip.addEventListener("click", () => {
    commit();
    state.panels[selected].photoId = id;
    state.panels[selected].anchor = null;
    requestRender();
  });
  tray.appendChild(chip);
}

// --- controls ---------------------------------------------------------

function buildOptionButtons() {
  const layoutList = $("layout-list");
  for (const l of LAYOUTS) {
    const b = document.createElement("button");
    b.className = "opt-btn";
    b.type = "button";
    b.dataset.layout = l.id;
    b.innerHTML = `<span class="opt-name">${l.name}</span><span class="opt-blurb">${l.blurb}</span>`;
    b.addEventListener("click", () => {
      if (state.layout === l.id) return;
      commit();
      const old = state.panels;
      state.layout = l.id;
      const next = defaultPanels(l.id);
      next.forEach((p, i) => {
        if (old[i]) {
          p.photoId = old[i].photoId;
          p.anchor = old[i].anchor;
        }
      });
      state.panels = next;
      selected = 0;
      syncControls();
      requestRender();
    });
    layoutList.appendChild(b);
  }
  const gradeList = $("grade-list");
  for (const g of GRADES) {
    const b = document.createElement("button");
    b.className = "opt-btn grade-btn";
    b.type = "button";
    b.dataset.grade = g.id;
    b.innerHTML = `<span class="opt-name">${g.name}</span><span class="opt-blurb">${g.blurb}</span>`;
    b.addEventListener("click", () => {
      if (state.grade === g.id) return;
      commit();
      state.grade = g.id;
      syncControls();
      requestRender();
    });
    gradeList.appendChild(b);
  }
  const tray = $("photo-tray");
  for (const s of SAMPLES) {
    const chip = document.createElement("button");
    chip.className = "photo-chip";
    chip.type = "button";
    chip.draggable = true;
    chip.dataset.photoId = s.id;
    chip.innerHTML = `<img src="${s.file}" alt="${s.name}"><span>${s.name}</span>`;
    chip.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/photo-id", s.id);
    });
    chip.addEventListener("click", () => {
      commit();
      state.panels[selected].photoId = s.id;
      state.panels[selected].anchor = null;
      state.panels[selected].callout = s.callout;
      state.panels[selected].label = s.label;
      requestRender();
    });
    tray.appendChild(chip);
  }
}

function bindSlider(id, key) {
  const el = $(id);
  const out = $(id + "-val");
  el.addEventListener("input", () => {
    state[key] = Number(el.value);
    out.textContent = el.value;
    requestRender();
  });
  el.addEventListener("change", commit);
}

function bindText(id, key) {
  const el = $(id);
  el.addEventListener("input", () => {
    state[key] = el.value;
    requestRender();
  });
  el.addEventListener("change", commit);
}

function syncControls() {
  document.querySelectorAll("#layout-list .opt-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.layout === state.layout);
  });
  document.querySelectorAll("#grade-list .opt-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.grade === state.grade);
  });
  for (const [id, key] of [["sl-strength", "strength"], ["sl-contrast", "contrast"], ["sl-saturation", "saturation"], ["sl-grain", "grain"], ["sl-vignette", "vignette"]]) {
    $(id).value = state[key];
    $(id + "-val").textContent = state[key];
  }
  $("chk-halftone").checked = state.halftone;
  $("in-title").value = state.title;
  $("in-subtitle").value = state.subtitle;
  $("in-quote").value = state.quote;
  $("in-source").value = state.quoteSource;
  $("in-tagline").value = state.tagline;
  $("aspect-select").value = state.aspect;
  syncPanelControls();
}

function syncPanelControls() {
  const p = state.panels[selected];
  $("in-callout").value = p ? p.callout : "";
  $("in-label").value = p ? p.label : "";
  const photo = p && photos.get(p.photoId);
  $("panel-hint").textContent = p
    ? `Panel ${selected + 1} of ${state.panels.length} — ${photo ? photo.name : "empty"}. Drag to pan, scroll to zoom, double-click to re-centre.`
    : "No panel selected.";
}

// --- canvas interaction -----------------------------------------------

function canvasPoint(e) {
  const box = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - box.left) * (canvas.width / box.width),
    y: (e.clientY - box.top) * (canvas.height / box.height),
  };
}

function hitPanel(x, y) {
  const rects = panelRects(state.layout, canvas.width, canvas.height);
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

let drag = null;

function bindCanvas() {
  canvas.addEventListener("pointerdown", (e) => {
    const pt = canvasPoint(e);
    const idx = hitPanel(pt.x, pt.y);
    if (idx < 0) return;
    selected = idx;
    syncPanelControls();
    drag = { startX: pt.x, startY: pt.y, panX: state.panels[idx].panX, panY: state.panels[idx].panY, moved: false };
    canvas.setPointerCapture(e.pointerId);
    requestRender();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const pt = canvasPoint(e);
    const dx = pt.x - drag.startX;
    const dy = pt.y - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    const p = state.panels[selected];
    const rects = panelRects(state.layout, canvas.width, canvas.height);
    const r = rects[selected];
    p.panX = Math.max(-1, Math.min(1, drag.panX + (dx / r.w) * 2));
    p.panY = Math.max(-1, Math.min(1, drag.panY + (dy / r.h) * 2));
    requestRender();
  });
  const endDrag = () => {
    if (drag && drag.moved) commit();
    drag = null;
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", () => { drag = null; });
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const pt = canvasPoint(e);
    const idx = hitPanel(pt.x, pt.y);
    if (idx < 0) return;
    selected = idx;
    const p = state.panels[idx];
    p.zoom = Math.max(1, Math.min(3.5, p.zoom * Math.exp(-e.deltaY * 0.0012)));
    syncPanelControls();
    requestRender();
  }, { passive: false });
  canvas.addEventListener("dblclick", (e) => {
    const pt = canvasPoint(e);
    const idx = hitPanel(pt.x, pt.y);
    if (idx < 0) return;
    commit();
    state.panels[idx].panX = 0;
    state.panels[idx].panY = 0;
    state.panels[idx].zoom = 1;
    requestRender();
  });
  canvas.addEventListener("dragover", (e) => e.preventDefault());
  canvas.addEventListener("drop", (e) => {
    e.preventDefault();
    const photoId = e.dataTransfer.getData("text/photo-id");
    const pt = canvasPoint(e);
    const idx = hitPanel(pt.x, pt.y);
    if (photoId && idx >= 0 && photos.has(photoId)) {
      commit();
      selected = idx;
      state.panels[idx].photoId = photoId;
      state.panels[idx].anchor = null;
      syncPanelControls();
      requestRender();
      return;
    }
    if (e.dataTransfer.files && e.dataTransfer.files.length) {
      if (idx >= 0) selected = idx;
      addUploads(e.dataTransfer.files);
    }
  });
}

// --- actions ----------------------------------------------------------

function renderToSize(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  renderCover(c, state, photos);
  return c;
}

function downloadCanvas(c, filename) {
  return new Promise((resolve) => {
    c.toBlob((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      resolve();
    }, "image/png");
  });
}

async function exportSize(aspect) {
  const size = EXPORT_SIZES[aspect];
  await downloadCanvas(renderToSize(size.w, size.h), size.file);
}

async function exportAll() {
  for (const aspect of ["16:9", "4:5", "1:1"]) {
    await exportSize(aspect);
    await new Promise((r) => setTimeout(r, 350));
  }
}

function surprise() {
  commit();
  const rnd = Math.random;
  state.layout = LAYOUTS[Math.floor(rnd() * LAYOUTS.length)].id;
  state.grade = GRADES[Math.floor(rnd() * GRADES.length)].id;
  state.strength = 55 + Math.floor(rnd() * 45);
  state.grain = 15 + Math.floor(rnd() * 50);
  const order = [...SAMPLES].sort(() => rnd() - 0.5);
  const next = defaultPanels(state.layout);
  next.forEach((p, i) => {
    const s = order[i % order.length];
    p.photoId = s.id;
    p.callout = s.callout;
    p.label = s.label;
    p.anchor = null;
  });
  state.panels = next;
  selected = 0;
  syncControls();
  requestRender();
}

function fillAll() {
  commit();
  const src = state.panels[selected];
  state.panels.forEach((p, i) => {
    p.photoId = src.photoId;
    p.anchor = src.anchor;
    p.zoom = 1.15;
    p.panX = ((i * 0.7) % 1) * 1.4 - 0.7;
    p.panY = ((i * 0.45) % 1) * 1.2 - 0.6;
  });
  requestRender();
}

function spreadAll() {
  commit();
  const ids = [...photos.keys()];
  if (!ids.length) return;
  state.panels.forEach((p, i) => {
    p.photoId = ids[i % ids.length];
    p.anchor = null;
    p.zoom = 1;
    p.panX = 0;
    p.panY = 0;
  });
  requestRender();
}

// --- scenes -----------------------------------------------------------

function applyScene() {
  const scene = new URLSearchParams(location.search).get("scene") || "editor";
  if (scene === "editor") return;
  document.body.classList.add("scene");
  if (scene === "cover-4x5") state.aspect = "4:5";
  else if (scene === "cover-square") state.aspect = "1:1";
  else state.aspect = "16:9";
  document.body.dataset.scene = scene;
}

// --- boot -------------------------------------------------------------

function bindActions() {
  $("btn-undo").addEventListener("click", undo);
  $("btn-redo").addEventListener("click", redo);
  $("btn-surprise").addEventListener("click", surprise);
  $("btn-fill").addEventListener("click", fillAll);
  $("btn-spread").addEventListener("click", spreadAll);
  $("btn-export-16x9").addEventListener("click", () => exportSize("16:9"));
  $("btn-export-4x5").addEventListener("click", () => exportSize("4:5"));
  $("btn-export-1x1").addEventListener("click", () => exportSize("1:1"));
  $("btn-export-all").addEventListener("click", exportAll);
  $("upload-input").addEventListener("change", (e) => {
    addUploads(e.target.files);
    e.target.value = "";
  });
  $("aspect-select").addEventListener("change", (e) => {
    commit();
    state.aspect = e.target.value;
    requestRender();
  });
  $("chk-halftone").addEventListener("change", (e) => {
    commit();
    state.halftone = e.target.checked;
    requestRender();
  });
  $("in-callout").addEventListener("input", (e) => {
    state.panels[selected].callout = e.target.value;
    requestRender();
  });
  $("in-callout").addEventListener("change", commit);
  $("in-label").addEventListener("input", (e) => {
    state.panels[selected].label = e.target.value;
    requestRender();
  });
  $("in-label").addEventListener("change", commit);
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
      e.preventDefault();
      redo();
    }
  });
}

applyScene();
buildOptionButtons();
bindSlider("sl-strength", "strength");
bindSlider("sl-contrast", "contrast");
bindSlider("sl-saturation", "saturation");
bindSlider("sl-grain", "grain");
bindSlider("sl-vignette", "vignette");
bindText("in-title", "title");
bindText("in-subtitle", "subtitle");
bindText("in-quote", "quote");
bindText("in-source", "quoteSource");
bindText("in-tagline", "tagline");
bindCanvas();
bindActions();
syncControls();
updateHistoryButtons();
loadSamples();
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => requestRender());
}
requestRender();
