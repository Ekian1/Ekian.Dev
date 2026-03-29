// ekian.dev — Core Engine (Part 1: State, Layers, History, Rendering)
'use strict';

const PF = {
    canvas: null, ctx: null, overlay: null, octx: null,
    width: 1280, height: 720,
    layers: [], activeLayerIndex: 0,
    zoom: 1, panX: 0, panY: 0,
    tool: 'move',
    fgColor: '#000000', bgColor: '#ffffff', fgAlpha: 1,
    history: [], historyIndex: -1, maxHistory: 50,
    selection: null, // {x, y, w, h} or path
    clipboard: null,
    isDrawing: false, isPanning: false,
    lastX: 0, lastY: 0,
    showRulers: true, showGrid: false,
    brushSize: 10, brushOpacity: 100, brushHardness: 80,
    textFont: 'Impact', textSize: 72, textWeight: '700', textItalic: false,
    textOutline: 0, textOutlineColor: '#000000',
    textShadow: false, textShadowColor: '#000000',
    textGlow: false, textGlowColor: '#ffff00',
    shapeFill: true, shapeStrokeWidth: 2,
    fillTolerance: 32, wandTolerance: 32,
    gradientType: 'linear', gradientColor2: '#ffffff',
};

// ============ LAYER CLASS ============
class Layer {
    constructor(name, w, h) {
        this.name = name;
        this.canvas = document.createElement('canvas');
        this.canvas.width = w; this.canvas.height = h;
        this.ctx = this.canvas.getContext('2d');
        this.visible = true;
        this.locked = false;
        this.opacity = 1;
        this.blendMode = 'source-over';
    }
    clone() {
        const l = new Layer(this.name + ' copy', this.canvas.width, this.canvas.height);
        l.ctx.drawImage(this.canvas, 0, 0);
        l.opacity = this.opacity;
        l.blendMode = this.blendMode;
        l.visible = this.visible;
        return l;
    }
    clear() { this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }
    resize(w, h) {
        const tmp = document.createElement('canvas');
        tmp.width = this.canvas.width; tmp.height = this.canvas.height;
        tmp.getContext('2d').drawImage(this.canvas, 0, 0);
        this.canvas.width = w; this.canvas.height = h;
        this.ctx.drawImage(tmp, 0, 0);
    }
}

// ============ INIT ============
let currentProjectId = null;
let autoSaveTimer = null;

async function init() {
    PF.canvas = document.getElementById('main-canvas');
    PF.ctx = PF.canvas.getContext('2d');
    PF.overlay = document.getElementById('overlay-canvas');
    PF.octx = PF.overlay.getContext('2d');

    await ProjectStore.init();

    // Check URL for project ID
    const params = new URLSearchParams(window.location.search);
    currentProjectId = params.get('project');

    if (currentProjectId) {
        const project = await ProjectStore.getProject(currentProjectId);
        if (project) {
            setCanvasSize(project.width, project.height);
            document.title = project.name + ' — ekian.dev';
            if (project.layers && project.layers.length > 0) {
                PF.layers = [];
                let loaded = 0;
                const total = project.layers.length;
                for (const ld of project.layers) {
                    const layer = new Layer(ld.name, project.width, project.height);
                    layer.visible = ld.visible !== false;
                    layer.locked = ld.locked || false;
                    layer.opacity = ld.opacity !== undefined ? ld.opacity : 1;
                    layer.blendMode = ld.blendMode || 'source-over';
                    if (ld.data) {
                        await new Promise(resolve => {
                            const img = new Image();
                            img.onload = () => { layer.ctx.drawImage(img, 0, 0); resolve(); };
                            img.onerror = resolve;
                            img.src = ld.data;
                        });
                    }
                    PF.layers.push(layer);
                }
                PF.activeLayerIndex = project.activeLayerIndex || 0;
            } else {
                addLayer('Background', true);
            }
        } else {
            setCanvasSize(1280, 720);
            addLayer('Background', true);
        }
    } else {
        setCanvasSize(PF.width, PF.height);
        addLayer('Background', true);
    }

    saveHistory('Open');
    setupEvents();
    setupMenus();
    setupToolbar();
    setupToolOptions();
    setupColorPicker();
    setupLayerPanel();
    setupPanelToggles();
    setupDragDrop();
    setupKeyboard();
    fitToScreen();
    renderAll();
    updateLayerList();
}

function newCanvas(w, h, name) {
    // Create a new project and navigate to it
    const id = generateId();
    const project = {
        id, name: name || 'Untitled',
        width: w, height: h,
        layers: [], activeLayerIndex: 0,
        createdAt: Date.now(), updatedAt: Date.now(),
        thumbnail: null,
    };
    ProjectStore.saveProject(project).then(() => {
        window.location.href = 'editor.html?project=' + id;
    });
}

async function autoSaveProject() {
    if (!currentProjectId) return;
    const project = await ProjectStore.getProject(currentProjectId);
    if (!project) return;
    project.width = PF.width;
    project.height = PF.height;
    project.activeLayerIndex = PF.activeLayerIndex;
    project.layers = PF.layers.map(l => ({
        name: l.name,
        visible: l.visible, locked: l.locked,
        opacity: l.opacity, blendMode: l.blendMode,
        data: l.canvas.toDataURL('image/png'),
    }));
    // Generate thumbnail
    project.thumbnail = ProjectStore.generateThumbnail(PF.canvas, 300);
    project.updatedAt = Date.now();
    await ProjectStore.saveProject(project);
}

function setCanvasSize(w, h) {
    PF.width = w; PF.height = h;
    PF.canvas.width = w; PF.canvas.height = h;
    PF.overlay.width = w; PF.overlay.height = h;
    const container = document.getElementById('canvas-container');
    container.style.width = w + 'px';
    container.style.height = h + 'px';
    document.getElementById('canvas-size-display').textContent = w + ' × ' + h;
}

function addLayer(name, fillWhite) {
    const layer = new Layer(name || 'Layer ' + (PF.layers.length + 1), PF.width, PF.height);
    if (fillWhite) { layer.ctx.fillStyle = '#ffffff'; layer.ctx.fillRect(0, 0, PF.width, PF.height); }
    PF.layers.unshift(layer); // add on top
    PF.activeLayerIndex = 0;
    renderAll(); updateLayerList();
}

function getActiveLayer() { return PF.layers[PF.activeLayerIndex]; }

// ============ RENDER ============
function renderAll() {
    PF.ctx.clearRect(0, 0, PF.width, PF.height);
    for (let i = PF.layers.length - 1; i >= 0; i--) {
        const l = PF.layers[i];
        if (!l.visible) continue;
        PF.ctx.globalAlpha = l.opacity;
        PF.ctx.globalCompositeOperation = l.blendMode;
        PF.ctx.drawImage(l.canvas, 0, 0);
    }
    PF.ctx.globalAlpha = 1;
    PF.ctx.globalCompositeOperation = 'source-over';
    renderOverlay();
    updateTransform();
    drawRulers();
}

function renderOverlay() {
    PF.octx.clearRect(0, 0, PF.width, PF.height);
    if (PF.selection) drawSelection();
}

function updateTransform() {
    const container = document.getElementById('canvas-container');
    container.style.transform = `translate(${PF.panX}px, ${PF.panY}px) scale(${PF.zoom})`;
    document.getElementById('zoom-display').textContent = Math.round(PF.zoom * 100) + '%';
}

function fitToScreen() {
    const vp = document.getElementById('canvas-viewport');
    const vw = vp.clientWidth - 40;
    const vh = vp.clientHeight - 40;
    PF.zoom = Math.min(vw / PF.width, vh / PF.height, 1);
    PF.panX = (vp.clientWidth - PF.width * PF.zoom) / 2;
    PF.panY = (vp.clientHeight - PF.height * PF.zoom) / 2;
    updateTransform();
}

// ============ HISTORY ============
function saveHistory(label) {
    // Remove future states
    PF.history = PF.history.slice(0, PF.historyIndex + 1);
    const snapshot = PF.layers.map(l => {
        const c = document.createElement('canvas');
        c.width = l.canvas.width; c.height = l.canvas.height;
        c.getContext('2d').drawImage(l.canvas, 0, 0);
        return { name: l.name, canvas: c, visible: l.visible, locked: l.locked, opacity: l.opacity, blendMode: l.blendMode };
    });
    PF.history.push({ label, layers: snapshot, activeIndex: PF.activeLayerIndex, w: PF.width, h: PF.height });
    if (PF.history.length > PF.maxHistory) PF.history.shift();
    PF.historyIndex = PF.history.length - 1;
    updateHistoryPanel();
    // Debounced auto-save to IndexedDB
    if (currentProjectId) {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(() => autoSaveProject(), 2000);
    }
}

function undo() {
    if (PF.historyIndex <= 0) return;
    PF.historyIndex--;
    restoreHistory();
}

function redo() {
    if (PF.historyIndex >= PF.history.length - 1) return;
    PF.historyIndex++;
    restoreHistory();
}

function restoreHistory() {
    const state = PF.history[PF.historyIndex];
    if (state.w !== PF.width || state.h !== PF.height) setCanvasSize(state.w, state.h);
    PF.layers = state.layers.map(s => {
        const l = new Layer(s.name, s.canvas.width, s.canvas.height);
        l.ctx.drawImage(s.canvas, 0, 0);
        l.visible = s.visible; l.locked = s.locked; l.opacity = s.opacity; l.blendMode = s.blendMode;
        return l;
    });
    PF.activeLayerIndex = state.activeIndex;
    renderAll(); updateLayerList(); updateHistoryPanel();
}

function updateHistoryPanel() {
    const list = document.getElementById('history-list');
    list.innerHTML = '';
    PF.history.forEach((h, i) => {
        const el = document.createElement('div');
        el.className = 'history-item' + (i === PF.historyIndex ? ' active' : '') + (i > PF.historyIndex ? ' future' : '');
        el.textContent = h.label;
        el.onclick = () => { PF.historyIndex = i; restoreHistory(); };
        list.appendChild(el);
    });
    list.scrollTop = list.scrollHeight;
}

// ============ RULERS ============
function drawRulers() {
    if (!PF.showRulers) { document.getElementById('ruler-h').innerHTML = ''; document.getElementById('ruler-v').innerHTML = ''; return; }
    drawRulerH(); drawRulerV();
}

function drawRulerH() {
    const el = document.getElementById('ruler-h');
    el.innerHTML = '';
    const c = document.createElement('canvas');
    c.width = el.clientWidth; c.height = 20;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#1a1a22'; ctx.fillRect(0, 0, c.width, 20);
    ctx.fillStyle = '#555566'; ctx.font = '9px Inter';
    const step = PF.zoom < 0.5 ? 100 : PF.zoom < 1 ? 50 : PF.zoom < 3 ? 25 : 10;
    for (let px = 0; px <= PF.width; px += step) {
        const sx = PF.panX + px * PF.zoom;
        if (sx < 0 || sx > c.width) continue;
        ctx.fillRect(sx, 14, 1, 6);
        if (px % (step * 2) === 0) ctx.fillText(px, sx + 2, 12);
    }
    el.appendChild(c);
}

function drawRulerV() {
    const el = document.getElementById('ruler-v');
    el.innerHTML = '';
    const c = document.createElement('canvas');
    c.width = 20; c.height = el.clientHeight;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#1a1a22'; ctx.fillRect(0, 0, 20, c.height);
    ctx.fillStyle = '#555566'; ctx.font = '9px Inter';
    const step = PF.zoom < 0.5 ? 100 : PF.zoom < 1 ? 50 : PF.zoom < 3 ? 25 : 10;
    for (let py = 0; py <= PF.height; py += step) {
        const sy = PF.panY + py * PF.zoom;
        if (sy < 0 || sy > c.height) continue;
        ctx.fillRect(14, sy, 6, 1);
        if (py % (step * 2) === 0) { ctx.save(); ctx.translate(10, sy + 2); ctx.rotate(-Math.PI / 2); ctx.fillText(py, 0, 0); ctx.restore(); }
    }
    el.appendChild(c);
}

// ============ SELECTION ============
function drawSelection() {
    if (!PF.selection) return;
    const s = PF.selection;
    PF.octx.save();
    PF.octx.strokeStyle = '#fff';
    PF.octx.lineWidth = 1;
    PF.octx.setLineDash([6, 6]);
    PF.octx.lineDashOffset = -(Date.now() / 50 % 12);
    if (s.type === 'rect') {
        PF.octx.strokeRect(s.x + 0.5, s.y + 0.5, s.w, s.h);
    } else if (s.type === 'ellipse') {
        PF.octx.beginPath();
        PF.octx.ellipse(s.x + s.w / 2, s.y + s.h / 2, Math.abs(s.w / 2), Math.abs(s.h / 2), 0, 0, Math.PI * 2);
        PF.octx.stroke();
    } else if (s.type === 'lasso' && s.points) {
        PF.octx.beginPath();
        s.points.forEach((p, i) => i === 0 ? PF.octx.moveTo(p.x, p.y) : PF.octx.lineTo(p.x, p.y));
        PF.octx.closePath(); PF.octx.stroke();
    }
    PF.octx.restore();
}

// Animate marching ants
setInterval(() => { if (PF.selection) renderOverlay(); }, 100);

// ============ COORDINATE HELPERS ============
function canvasCoords(e) {
    const vp = document.getElementById('canvas-viewport');
    const rect = vp.getBoundingClientRect();
    const x = (e.clientX - rect.left - PF.panX) / PF.zoom;
    const y = (e.clientY - rect.top - PF.panY) / PF.zoom;
    return { x, y };
}

function screenCoords(cx, cy) {
    const vp = document.getElementById('canvas-viewport');
    const rect = vp.getBoundingClientRect();
    return { x: cx * PF.zoom + PF.panX + rect.left, y: cy * PF.zoom + PF.panY + rect.top };
}

document.addEventListener('DOMContentLoaded', init);
