// ekian.dev — UI, Filters, File I/O, Keyboard (Part 3)

// ============ MENU SETUP ============
function setupMenus() {
    document.querySelectorAll('.menu-dropdown button').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            executeAction(action);
            // Close menu
            document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('open'));
        });
    });
}

function executeAction(action) {
    switch (action) {
        case 'new-canvas': showNewCanvasModal(); break;
        case 'open-file': openFile(); break;
        case 'back-home': autoSaveProject().then(() => window.location.href = 'index.html'); break;
        case 'save-project': autoSaveProject(); break;
        case 'load-project': loadProject(); break;
        case 'export-png': exportImage('png'); break;
        case 'export-jpeg': showExportJpegModal(); break;
        case 'undo': undo(); break;
        case 'redo': redo(); break;
        case 'select-all': PF.selection = { type: 'rect', x: 0, y: 0, w: PF.width, h: PF.height }; renderOverlay(); break;
        case 'deselect': PF.selection = null; renderOverlay(); break;
        case 'copy-selection': copySelection(); break;
        case 'paste-clipboard': pasteClipboard(); break;
        case 'cut-selection': cutSelection(); break;
        case 'clear-canvas': getActiveLayer().clear(); renderAll(); saveHistory('Clear'); break;
        case 'resize-canvas': showResizeModal('Canvas Size', false); break;
        case 'resize-image': showResizeModal('Image Size', true); break;
        case 'flip-h': flipLayer('h'); break;
        case 'flip-v': flipLayer('v'); break;
        case 'rotate-cw': rotateLayer(90); break;
        case 'rotate-ccw': rotateLayer(-90); break;
        case 'filter-brightness': showFilterModal('Brightness / Contrast', filterBrightnessContrast); break;
        case 'filter-hsl': showFilterModal('Hue / Saturation', filterHSL); break;
        case 'filter-levels': showFilterModal('Levels', filterLevels); break;
        case 'filter-blur': showFilterModal('Gaussian Blur', filterBlur); break;
        case 'filter-sharpen': filterSharpen(); break;
        case 'filter-noise': showFilterModal('Add Noise', filterNoise); break;
        case 'filter-invert': filterInvert(); break;
        case 'filter-grayscale': filterGrayscale(); break;
        case 'filter-sepia': filterSepia(); break;
        case 'filter-dropshadow': showFilterModal('Drop Shadow', filterDropShadow); break;
        case 'filter-outerglow': showFilterModal('Outer Glow', filterOuterGlow); break;
        case 'filter-chromakey': showFilterModal('Chroma Key', filterChromaKey); break;
        case 'filter-smoothcolors': showFilterModal('Smooth Colors', filterSmoothColors); break;
        case 'zoom-in': PF.zoom = Math.min(32, PF.zoom * 1.25); updateTransform(); drawRulers(); break;
        case 'zoom-out': PF.zoom = Math.max(0.05, PF.zoom / 1.25); updateTransform(); drawRulers(); break;
        case 'zoom-fit': fitToScreen(); break;
        case 'zoom-100': PF.zoom = 1; updateTransform(); drawRulers(); break;
        case 'toggle-rulers': PF.showRulers = !PF.showRulers; drawRulers(); break;
        case 'toggle-grid': PF.showGrid = !PF.showGrid; renderAll(); break;
        case 'template-yt-thumbnail': newCanvas(1280, 720, 'YouTube Thumbnail'); break;
        case 'template-yt-banner': newCanvas(2560, 1440, 'YouTube Banner'); break;
        case 'template-instagram': newCanvas(1080, 1080, 'Instagram Post'); break;
        case 'template-twitter': newCanvas(1500, 500, 'Twitter Header'); break;
        case 'template-1080p': newCanvas(1920, 1080, 'Full HD'); break;
    }
}

// ============ TOOLBAR SETUP ============
function setupToolbar() {
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
        btn.addEventListener('click', () => selectTool(btn.dataset.tool));
    });
    document.querySelector('.swap-colors').addEventListener('click', () => {
        [PF.fgColor, PF.bgColor] = [PF.bgColor, PF.fgColor];
        document.getElementById('fg-color-swatch').style.background = PF.fgColor;
        document.getElementById('bg-color-swatch').style.background = PF.bgColor;
        updateColorPickerFromHex(PF.fgColor);
    });
    document.getElementById('fg-color-swatch').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'color'; input.value = PF.fgColor;
        input.addEventListener('input', () => {
            PF.fgColor = input.value;
            document.getElementById('fg-color-swatch').style.background = PF.fgColor;
            updateColorPickerFromHex(PF.fgColor);
        });
        input.click();
    });
    document.getElementById('bg-color-swatch').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'color'; input.value = PF.bgColor;
        input.addEventListener('input', () => {
            PF.bgColor = input.value;
            document.getElementById('bg-color-swatch').style.background = PF.bgColor;
        });
        input.click();
    });
}

function selectTool(tool) {
    if (PF.tool === 'transform' && tool !== 'transform' && typeof tfState !== 'undefined' && tfState) {
        commitTransform();
    }
    if (PF.tool === 'text' && tool !== 'text') {
        const overlay = document.getElementById('text-edit-overlay');
        if (overlay && overlay.style.display === 'block') commitText(overlay);
    }
    PF.tool = tool;
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.tool-btn[data-tool="${tool}"]`);
    if (btn) btn.classList.add('active');
    updateToolOptions();
    // Set cursor
    const vp = document.getElementById('canvas-viewport');
    vp.className = '';
    if (tool === 'hand') vp.classList.add('cursor-grab');
    else if (tool === 'move') vp.classList.add('cursor-move');
    else if (tool === 'text') vp.classList.add('cursor-text');
    else if (tool === 'eyedropper') vp.classList.add('cursor-eyedropper');
}

// ============ TOOL OPTIONS ============
function setupToolOptions() {
    const bs = document.getElementById('brush-size');
    const bo = document.getElementById('brush-opacity');
    const bh = document.getElementById('brush-hardness');
    bs.addEventListener('input', () => { PF.brushSize = +bs.value; document.getElementById('brush-size-val').textContent = bs.value; });
    bo.addEventListener('input', () => { PF.brushOpacity = +bo.value; document.getElementById('brush-opacity-val').textContent = bo.value + '%'; });
    bh.addEventListener('input', () => { PF.brushHardness = +bh.value; document.getElementById('brush-hardness-val').textContent = bh.value + '%'; });

    document.getElementById('text-font').addEventListener('change', e => PF.textFont = e.target.value);
    document.getElementById('text-size').addEventListener('change', e => PF.textSize = +e.target.value);
    document.getElementById('text-weight').addEventListener('change', e => PF.textWeight = e.target.value);
    document.getElementById('text-italic').addEventListener('click', e => {
        PF.textItalic = !PF.textItalic;
        e.currentTarget.classList.toggle('active', PF.textItalic);
    });
    document.getElementById('text-outline').addEventListener('change', e => PF.textOutline = +e.target.value);
    document.getElementById('text-outline-color').addEventListener('input', e => PF.textOutlineColor = e.target.value);
    document.getElementById('text-shadow-toggle').addEventListener('change', e => PF.textShadow = e.target.checked);
    document.getElementById('text-shadow-color').addEventListener('input', e => PF.textShadowColor = e.target.value);
    document.getElementById('text-glow-toggle').addEventListener('change', e => PF.textGlow = e.target.checked);
    document.getElementById('text-glow-color').addEventListener('input', e => PF.textGlowColor = e.target.value);

    document.getElementById('shape-fill-toggle').addEventListener('change', e => PF.shapeFill = e.target.checked);
    const ssw = document.getElementById('shape-stroke-width');
    ssw.addEventListener('input', () => { PF.shapeStrokeWidth = +ssw.value; document.getElementById('shape-stroke-val').textContent = ssw.value + 'px'; });

    const ft = document.getElementById('fill-tolerance');
    ft.addEventListener('input', () => { PF.fillTolerance = +ft.value; document.getElementById('fill-tolerance-val').textContent = ft.value; });

    const wt = document.getElementById('wand-tolerance');
    wt.addEventListener('input', () => { PF.wandTolerance = +wt.value; document.getElementById('wand-tolerance-val').textContent = wt.value; });

    document.getElementById('gradient-type').addEventListener('change', e => PF.gradientType = e.target.value);
    document.getElementById('gradient-color2').addEventListener('input', e => PF.gradientColor2 = e.target.value);

    updateToolOptions();
}

function updateToolOptions() {
    document.querySelectorAll('.tool-option-group').forEach(g => {
        const tools = (g.dataset.for || '').split(' ');
        g.classList.toggle('visible', tools.includes(PF.tool));
    });
}

// ============ COLOR PICKER ============
let cpHue = 0, cpSat = 100, cpVal = 100;

function setupColorPicker() {
    renderHueBar();
    renderAlphaBar();
    renderSVPicker();

    const svCanvas = document.getElementById('color-picker-sv');
    const hueCanvas = document.getElementById('color-picker-hue');

    svCanvas.addEventListener('mousedown', e => { pickSV(e); const move = ev => pickSV(ev); const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); }; window.addEventListener('mousemove', move); window.addEventListener('mouseup', up); });
    hueCanvas.addEventListener('mousedown', e => { pickHue(e); const move = ev => pickHue(ev); const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); }; window.addEventListener('mousemove', move); window.addEventListener('mouseup', up); });

    document.getElementById('color-hex').addEventListener('change', e => {
        let v = e.target.value;
        if (!v.startsWith('#')) v = '#' + v;
        if (/^#[0-9a-fA-F]{6}$/.test(v)) { PF.fgColor = v; document.getElementById('fg-color-swatch').style.background = v; updateColorPickerFromHex(v); }
    });
    ['color-r', 'color-g', 'color-b'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            const r = +document.getElementById('color-r').value;
            const g = +document.getElementById('color-g').value;
            const b = +document.getElementById('color-b').value;
            PF.fgColor = rgbToHex(r, g, b);
            document.getElementById('fg-color-swatch').style.background = PF.fgColor;
            updateColorPickerFromHex(PF.fgColor);
        });
    });
    const alphaSlider = document.getElementById('color-alpha');
    alphaSlider.addEventListener('input', () => {
        PF.fgAlpha = alphaSlider.value / 100;
        document.getElementById('color-alpha-val').textContent = alphaSlider.value + '%';
    });
}

function renderHueBar() {
    const c = document.getElementById('color-picker-hue');
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, c.width, 0);
    for (let i = 0; i <= 360; i += 30) grad.addColorStop(i / 360, `hsl(${i},100%,50%)`);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, c.width, c.height);
}

function renderAlphaBar() {
    const c = document.getElementById('color-picker-alpha');
    const ctx = c.getContext('2d');
    // Checkerboard
    for (let x = 0; x < c.width; x += 8) {
        for (let y = 0; y < c.height; y += 8) {
            ctx.fillStyle = (x / 8 + y / 8) % 2 === 0 ? '#ccc' : '#fff';
            ctx.fillRect(x, y, 8, 8);
        }
    }
    const grad = ctx.createLinearGradient(0, 0, c.width, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, PF.fgColor);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, c.width, c.height);
}

function renderSVPicker() {
    const c = document.getElementById('color-picker-sv');
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    // White to hue horizontal
    const gradH = ctx.createLinearGradient(0, 0, w, 0);
    gradH.addColorStop(0, '#fff');
    gradH.addColorStop(1, `hsl(${cpHue},100%,50%)`);
    ctx.fillStyle = gradH; ctx.fillRect(0, 0, w, h);
    // Black vertical
    const gradV = ctx.createLinearGradient(0, 0, 0, h);
    gradV.addColorStop(0, 'rgba(0,0,0,0)');
    gradV.addColorStop(1, '#000');
    ctx.fillStyle = gradV; ctx.fillRect(0, 0, w, h);
}

function pickSV(e) {
    const c = document.getElementById('color-picker-sv');
    const rect = c.getBoundingClientRect();
    cpSat = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    cpVal = Math.max(0, Math.min(100, 100 - ((e.clientY - rect.top) / rect.height) * 100));
    updateColorFromHSV();
}

function pickHue(e) {
    const c = document.getElementById('color-picker-hue');
    const rect = c.getBoundingClientRect();
    cpHue = Math.max(0, Math.min(360, ((e.clientX - rect.left) / rect.width) * 360));
    renderSVPicker();
    updateColorFromHSV();
}

function updateColorFromHSV() {
    const { r, g, b } = hsvToRgb(cpHue, cpSat, cpVal);
    PF.fgColor = rgbToHex(r, g, b);
    document.getElementById('fg-color-swatch').style.background = PF.fgColor;
    document.getElementById('color-hex').value = PF.fgColor;
    document.getElementById('color-r').value = r;
    document.getElementById('color-g').value = g;
    document.getElementById('color-b').value = b;
    renderAlphaBar();
}

function updateColorPickerFromHex(hex) {
    const rgb = hexToRgb(hex);
    const { h, s, v } = rgbToHsv(rgb.r, rgb.g, rgb.b);
    cpHue = h; cpSat = s; cpVal = v;
    renderSVPicker();
    renderAlphaBar();
    document.getElementById('color-hex').value = hex;
    document.getElementById('color-r').value = rgb.r;
    document.getElementById('color-g').value = rgb.g;
    document.getElementById('color-b').value = rgb.b;
}

function hsvToRgb(h, s, v) {
    s /= 100; v /= 100;
    const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    let r, g, b;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}

function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0, s = max === 0 ? 0 : d / max, v = max;
    if (d !== 0) {
        switch (max) {
            case r: h = 60 * (((g - b) / d) % 6); break;
            case g: h = 60 * (((b - r) / d) + 2); break;
            case b: h = 60 * (((r - g) / d) + 4); break;
        }
    }
    if (h < 0) h += 360;
    return { h: Math.round(h), s: Math.round(s * 100), v: Math.round(v * 100) };
}

// ============ LAYER PANEL ============
function setupLayerPanel() {
    document.getElementById('btn-add-layer').addEventListener('click', () => { addLayer(); saveHistory('New Layer'); });
    document.getElementById('btn-duplicate-layer').addEventListener('click', duplicateLayer);
    document.getElementById('btn-delete-layer').addEventListener('click', deleteLayer);
    document.getElementById('btn-merge-down').addEventListener('click', mergeDown);
    document.getElementById('btn-move-layer-up').addEventListener('click', moveLayerUp);
    document.getElementById('btn-move-layer-down').addEventListener('click', moveLayerDown);
    document.getElementById('blend-mode').addEventListener('change', e => {
        getActiveLayer().blendMode = e.target.value; renderAll();
    });
    document.getElementById('layer-opacity').addEventListener('input', e => {
        getActiveLayer().opacity = e.target.value / 100;
        document.getElementById('layer-opacity-val').textContent = e.target.value + '%';
        renderAll();
    });
}

function updateLayerList() {
    const list = document.getElementById('layer-list');
    list.innerHTML = '';
    PF.layers.forEach((layer, i) => {
        const el = document.createElement('div');
        el.className = 'layer-item' + (i === PF.activeLayerIndex ? ' active' : '');
        el.innerHTML = `
            <div class="layer-thumb"><canvas width="36" height="28"></canvas></div>
            <span class="layer-name">${layer.name}</span>
            <button class="layer-visibility ${layer.visible ? '' : 'hidden'}" title="Toggle Visibility">${layer.visible ? '👁' : '○'}</button>
            <button class="layer-lock ${layer.locked ? 'locked' : ''}" title="Toggle Lock">${layer.locked ? '🔒' : '🔓'}</button>
        `;
        // Thumbnail
        const thumbCanvas = el.querySelector('canvas');
        const tctx = thumbCanvas.getContext('2d');
        tctx.drawImage(layer.canvas, 0, 0, 36, 28);

        el.addEventListener('click', (e) => {
            if (e.target.closest('.layer-visibility') || e.target.closest('.layer-lock')) return;
            PF.activeLayerIndex = i;
            updateLayerList();
            document.getElementById('blend-mode').value = layer.blendMode;
            document.getElementById('layer-opacity').value = Math.round(layer.opacity * 100);
            document.getElementById('layer-opacity-val').textContent = Math.round(layer.opacity * 100) + '%';
        });
        el.querySelector('.layer-visibility').addEventListener('click', () => {
            layer.visible = !layer.visible; renderAll(); updateLayerList();
        });
        el.querySelector('.layer-lock').addEventListener('click', () => {
            layer.locked = !layer.locked; updateLayerList();
        });
        // Double-click to rename
        el.querySelector('.layer-name').addEventListener('dblclick', (e) => {
            const span = e.target;
            const input = document.createElement('input');
            input.value = layer.name;
            span.innerHTML = '';
            span.appendChild(input);
            input.focus();
            input.addEventListener('blur', () => { layer.name = input.value || layer.name; updateLayerList(); });
            input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') input.blur(); });
        });
        list.appendChild(el);
    });
}

function duplicateLayer() {
    const l = getActiveLayer().clone();
    PF.layers.splice(PF.activeLayerIndex, 0, l);
    renderAll(); updateLayerList(); saveHistory('Duplicate Layer');
}

function deleteLayer() {
    if (PF.layers.length <= 1) return;
    PF.layers.splice(PF.activeLayerIndex, 1);
    PF.activeLayerIndex = Math.min(PF.activeLayerIndex, PF.layers.length - 1);
    renderAll(); updateLayerList(); saveHistory('Delete Layer');
}

function mergeDown() {
    if (PF.activeLayerIndex >= PF.layers.length - 1) return;
    const upper = PF.layers[PF.activeLayerIndex];
    const lower = PF.layers[PF.activeLayerIndex + 1];
    lower.ctx.globalAlpha = upper.opacity;
    lower.ctx.globalCompositeOperation = upper.blendMode;
    lower.ctx.drawImage(upper.canvas, 0, 0);
    lower.ctx.globalAlpha = 1;
    lower.ctx.globalCompositeOperation = 'source-over';
    PF.layers.splice(PF.activeLayerIndex, 1);
    renderAll(); updateLayerList(); saveHistory('Merge Down');
}

function moveLayerUp() {
    if (PF.activeLayerIndex <= 0) return;
    [PF.layers[PF.activeLayerIndex], PF.layers[PF.activeLayerIndex - 1]] = [PF.layers[PF.activeLayerIndex - 1], PF.layers[PF.activeLayerIndex]];
    PF.activeLayerIndex--;
    renderAll(); updateLayerList();
}

function moveLayerDown() {
    if (PF.activeLayerIndex >= PF.layers.length - 1) return;
    [PF.layers[PF.activeLayerIndex], PF.layers[PF.activeLayerIndex + 1]] = [PF.layers[PF.activeLayerIndex + 1], PF.layers[PF.activeLayerIndex]];
    PF.activeLayerIndex++;
    renderAll(); updateLayerList();
}

// ============ PANEL TOGGLES ============
function setupPanelToggles() {
    document.querySelectorAll('.panel-header').forEach(header => {
        header.addEventListener('click', () => {
            const panel = header.closest('.panel');
            panel.classList.toggle('collapsed');
            header.querySelector('.panel-toggle').textContent = panel.classList.contains('collapsed') ? '+' : '−';
        });
    });
}

// ============ DRAG & DROP ============
function setupDragDrop() {
    const dz = document.getElementById('drop-zone');
    let dragCounter = 0;
    document.addEventListener('dragenter', e => { e.preventDefault(); dragCounter++; dz.classList.add('visible'); });
    document.addEventListener('dragleave', e => { e.preventDefault(); dragCounter--; if (dragCounter <= 0) { dz.classList.remove('visible'); dragCounter = 0; } });
    document.addEventListener('dragover', e => e.preventDefault());
    document.addEventListener('drop', e => {
        e.preventDefault(); dragCounter = 0; dz.classList.remove('visible');
        const files = e.dataTransfer.files;
        if (files.length > 0) loadImageFile(files[0]);
    });
}

function loadImageFile(file) {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const layer = new Layer(file.name || 'Image', PF.width, PF.height);
            // Center the image on the layer
            const scale = Math.min(PF.width / img.width, PF.height / img.height, 1);
            const w = img.width * scale, h = img.height * scale;
            const x = (PF.width - w) / 2, y = (PF.height - h) / 2;
            layer.ctx.drawImage(img, x, y, w, h);
            PF.layers.unshift(layer);
            PF.activeLayerIndex = 0;
            renderAll(); updateLayerList(); saveHistory('Import Image');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// ============ KEYBOARD SHORTCUTS ============
let spaceDown = false;
function setupKeyboard() {
    window.addEventListener('keydown', e => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

        if (e.key === ' ') { spaceDown = true; e.preventDefault(); return; }

        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'z': e.preventDefault(); e.shiftKey ? redo() : undo(); break;
                case 'n': e.preventDefault(); showNewCanvasModal(); break;
                case 'o': e.preventDefault(); openFile(); break;
                case 's': e.preventDefault(); saveProject(); break;
                case 'e': if (e.shiftKey) { e.preventDefault(); exportImage('png'); } break;
                case 'a': e.preventDefault(); executeAction('select-all'); break;
                case 'd': e.preventDefault(); executeAction('deselect'); break;
                case 'c': e.preventDefault(); copySelection(); break;
                case 'v': e.preventDefault(); pasteClipboard(); break;
                case 'x': e.preventDefault(); cutSelection(); break;
                case 't': e.preventDefault(); selectTool('transform'); if (typeof activateTransform === 'function') activateTransform(); break;
                case '=': case '+': e.preventDefault(); executeAction('zoom-in'); break;
                case '-': e.preventDefault(); executeAction('zoom-out'); break;
                case '0': e.preventDefault(); fitToScreen(); break;
                case '1': e.preventDefault(); PF.zoom = 1; updateTransform(); drawRulers(); break;
            }
            return;
        }

        const toolKeys = { v: 'move', h: 'hand', m: 'rect-select', l: 'lasso', w: 'magic-wand', c: 'crop', b: 'brush', p: 'pencil', e: 'eraser', t: 'text', u: 'rect-shape', g: 'fill', i: 'eyedropper' };
        if (toolKeys[e.key.toLowerCase()]) selectTool(toolKeys[e.key.toLowerCase()]);
        if (e.key.toLowerCase() === 'x') {
            [PF.fgColor, PF.bgColor] = [PF.bgColor, PF.fgColor];
            document.getElementById('fg-color-swatch').style.background = PF.fgColor;
            document.getElementById('bg-color-swatch').style.background = PF.bgColor;
            updateColorPickerFromHex(PF.fgColor);
        }
        if (e.key === 'Delete') { getActiveLayer().clear(); renderAll(); saveHistory('Clear Layer'); }
        if (e.key === '[') { PF.brushSize = Math.max(1, PF.brushSize - 2); document.getElementById('brush-size').value = PF.brushSize; document.getElementById('brush-size-val').textContent = PF.brushSize; }
        if (e.key === ']') { PF.brushSize = Math.min(200, PF.brushSize + 2); document.getElementById('brush-size').value = PF.brushSize; document.getElementById('brush-size-val').textContent = PF.brushSize; }
        if (e.key === 'Enter' && PF.tool === 'transform' && typeof commitTransform === 'function') { commitTransform(); }
        if (e.key === 'Escape' && PF.tool === 'transform' && typeof cancelTransform === 'function') { cancelTransform(); }
    });
    window.addEventListener('keyup', e => {
        if (e.key === ' ') spaceDown = false;
    });
}

// ============ CLIPBOARD ============
function copySelection() {
    const s = PF.selection;
    if (!s || s.type !== 'rect') return;
    const layer = getActiveLayer();
    PF.clipboard = layer.ctx.getImageData(s.x, s.y, s.w, s.h);
}

function cutSelection() {
    copySelection();
    if (!PF.selection || PF.selection.type !== 'rect') return;
    const s = PF.selection;
    getActiveLayer().ctx.clearRect(s.x, s.y, s.w, s.h);
    renderAll(); saveHistory('Cut');
}

function pasteClipboard() {
    // Try system clipboard first (images copied from other apps / screenshots)
    if (navigator.clipboard && navigator.clipboard.read) {
        navigator.clipboard.read().then(items => {
            for (const item of items) {
                const imageType = item.types.find(t => t.startsWith('image/'));
                if (imageType) {
                    item.getType(imageType).then(blob => pasteImageBlob(blob));
                    return;
                }
            }
            // No image in system clipboard, fall back to internal
            pasteInternal();
        }).catch(() => pasteInternal());
    } else {
        pasteInternal();
    }
}

function pasteInternal() {
    if (!PF.clipboard) return;
    const layer = new Layer('Pasted', PF.width, PF.height);
    layer.ctx.putImageData(PF.clipboard, 0, 0);
    PF.layers.unshift(layer);
    PF.activeLayerIndex = 0;
    PF.selection = null;
    renderAll(); updateLayerList(); saveHistory('Paste');
}

function pasteImageBlob(blob) {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
        const layer = new Layer('Pasted Image', PF.width, PF.height);
        // Fit image to canvas, centered
        const scale = Math.min(PF.width / img.width, PF.height / img.height, 1);
        const w = img.width * scale, h = img.height * scale;
        const x = (PF.width - w) / 2, y = (PF.height - h) / 2;
        layer.ctx.drawImage(img, x, y, w, h);
        PF.layers.unshift(layer);
        PF.activeLayerIndex = 0;
        PF.selection = null;
        renderAll(); updateLayerList(); saveHistory('Paste Image');
        URL.revokeObjectURL(url);
    };
    img.src = url;
}

// Listen for paste events globally (handles Ctrl+V paste of images from clipboard)
document.addEventListener('paste', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (const item of items) {
        if (item.type.startsWith('image/')) {
            e.preventDefault();
            const blob = item.getAsFile();
            if (blob) pasteImageBlob(blob);
            return;
        }
    }
});

// ============ TRANSFORM ============
function flipLayer(dir) {
    const layer = getActiveLayer();
    const tmp = document.createElement('canvas');
    tmp.width = PF.width; tmp.height = PF.height;
    const tctx = tmp.getContext('2d');
    tctx.translate(dir === 'h' ? PF.width : 0, dir === 'v' ? PF.height : 0);
    tctx.scale(dir === 'h' ? -1 : 1, dir === 'v' ? -1 : 1);
    tctx.drawImage(layer.canvas, 0, 0);
    layer.clear();
    layer.ctx.drawImage(tmp, 0, 0);
    renderAll(); saveHistory('Flip ' + (dir === 'h' ? 'Horizontal' : 'Vertical'));
}

function rotateLayer(deg) {
    const layer = getActiveLayer();
    const tmp = document.createElement('canvas');
    if (Math.abs(deg) === 90) {
        tmp.width = PF.height; tmp.height = PF.width;
    } else {
        tmp.width = PF.width; tmp.height = PF.height;
    }
    const tctx = tmp.getContext('2d');
    tctx.translate(tmp.width / 2, tmp.height / 2);
    tctx.rotate(deg * Math.PI / 180);
    tctx.drawImage(layer.canvas, -PF.width / 2, -PF.height / 2);
    // Resize all layers
    const newW = tmp.width, newH = tmp.height;
    PF.layers.forEach(l => {
        const ltmp = document.createElement('canvas');
        ltmp.width = newW; ltmp.height = newH;
        const lctx = ltmp.getContext('2d');
        lctx.translate(newW / 2, newH / 2);
        lctx.rotate(deg * Math.PI / 180);
        lctx.drawImage(l.canvas, -PF.width / 2, -PF.height / 2);
        l.canvas.width = newW; l.canvas.height = newH;
        l.ctx.drawImage(ltmp, 0, 0);
    });
    setCanvasSize(newW, newH);
    fitToScreen(); renderAll(); saveHistory('Rotate ' + deg + '°');
}
