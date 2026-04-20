// ekian.dev — Tools & Events (Part 2)

// ============ EVENTS SETUP ============
function setupEvents() {
    const vp = document.getElementById('canvas-viewport');

    vp.addEventListener('mousedown', onMouseDown);
    vp.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    vp.addEventListener('wheel', onWheel, { passive: false });
    vp.addEventListener('contextmenu', e => e.preventDefault());

    // Touch support
    vp.addEventListener('touchstart', e => { e.preventDefault(); const t = e.touches[0]; onMouseDown({ clientX: t.clientX, clientY: t.clientY, button: 0 }); });
    vp.addEventListener('touchmove', e => { e.preventDefault(); const t = e.touches[0]; onMouseMove({ clientX: t.clientX, clientY: t.clientY }); });
    vp.addEventListener('touchend', e => { onMouseUp({ button: 0 }); });
}

function onMouseDown(e) {
    const pos = canvasCoords(e);
    PF.lastX = pos.x; PF.lastY = pos.y;
    PF.startX = pos.x; PF.startY = pos.y;

    if (e.button === 1 || (e.button === 0 && PF.tool === 'hand') || (e.button === 0 && e.spaceKey)) {
        PF.isPanning = true;
        PF.panStartX = e.clientX - PF.panX;
        PF.panStartY = e.clientY - PF.panY;
        document.getElementById('canvas-viewport').classList.add('cursor-grabbing');
        return;
    }

    if (e.button !== 0) return;
    PF.isDrawing = true;

    const layer = getActiveLayer();
    if (!layer || layer.locked) return;

    switch (PF.tool) {
        case 'brush': case 'pencil': case 'eraser':
            beginStroke(pos); break;
        case 'fill':
            floodFill(Math.round(pos.x), Math.round(pos.y)); break;
        case 'eyedropper':
            pickColor(pos); break;
        case 'text':
            startTextEdit(pos); break;
        case 'rect-select': case 'ellipse-select': case 'lasso':
            startSelection(pos); break;
        case 'magic-wand':
            magicWandSelect(Math.round(pos.x), Math.round(pos.y)); break;
        case 'move':
            PF.moveStartData = { x: pos.x, y: pos.y, origX: getActiveLayer().x, origY: getActiveLayer().y }; break;
        case 'rect-shape': case 'ellipse-shape': case 'line-shape': case 'arrow-shape':
            PF.shapeStart = { x: pos.x, y: pos.y }; break;
        case 'gradient':
            PF.gradientStart = { x: pos.x, y: pos.y }; break;
        case 'crop':
            PF.cropStart = { x: pos.x, y: pos.y }; break;
        case 'transform':
            transformMouseDown(pos, e); break;
    }
}

function onMouseMove(e) {
    const pos = canvasCoords(e);
    document.getElementById('cursor-pos').textContent = Math.round(pos.x) + ', ' + Math.round(pos.y);

    if (PF.isPanning) {
        PF.panX = e.clientX - PF.panStartX;
        PF.panY = e.clientY - PF.panStartY;
        updateTransform(); drawRulers();
        return;
    }
    if (!PF.isDrawing) return;

    const layer = getActiveLayer();
    if (!layer || layer.locked) return;

    switch (PF.tool) {
        case 'brush': case 'pencil': case 'eraser':
            continueStroke(pos); break;
        case 'rect-select': case 'ellipse-select':
            updateRectSelection(pos); break;
        case 'lasso':
            continueLasso(pos); break;
        case 'move':
            moveLayer(pos); break;
        case 'rect-shape': case 'ellipse-shape': case 'line-shape': case 'arrow-shape':
            previewShape(pos); break;
        case 'gradient':
            previewGradient(pos); break;
        case 'crop':
            previewCrop(pos); break;
        case 'transform':
            transformMouseMove(pos); break;
    }
    PF.lastX = pos.x; PF.lastY = pos.y;
}

function onMouseUp(e) {
    if (PF.isPanning) {
        PF.isPanning = false;
        document.getElementById('canvas-viewport').classList.remove('cursor-grabbing');
        return;
    }
    if (!PF.isDrawing) return;
    PF.isDrawing = false;

    const pos = canvasCoords(e || { clientX: 0, clientY: 0 });

    switch (PF.tool) {
        case 'brush': case 'pencil': case 'eraser':
            endStroke(); break;
        case 'rect-shape': case 'ellipse-shape': case 'line-shape': case 'arrow-shape':
            commitShape(pos); break;
        case 'gradient':
            commitGradient(pos); break;
        case 'crop':
            commitCrop(pos); break;
        case 'move':
            if (PF.moveStartData) saveHistory('Move Layer');
            PF.moveStartData = null; break;
        case 'lasso':
            finishLasso(); break;
        case 'transform':
            transformMouseUp(pos); break;
    }
}

function onWheel(e) {
    e.preventDefault();
    const vp = document.getElementById('canvas-viewport');
    const rect = vp.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const oldZoom = PF.zoom;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    PF.zoom = Math.max(0.05, Math.min(32, PF.zoom * delta));

    PF.panX = mx - (mx - PF.panX) * (PF.zoom / oldZoom);
    PF.panY = my - (my - PF.panY) * (PF.zoom / oldZoom);

    updateTransform(); drawRulers();
}

// ============ BRUSH / PENCIL / ERASER ============
let strokeCanvas = null, strokeCtx = null;
let preStrokeBackup = null;

function beginStroke(pos) {
    const layer = getActiveLayer();
    // Save a backup of the layer before we start drawing
    preStrokeBackup = document.createElement('canvas');
    preStrokeBackup.width = layer.canvas.width;
    preStrokeBackup.height = layer.canvas.height;
    preStrokeBackup.getContext('2d').drawImage(layer.canvas, 0, 0);

    // Create stroke buffer to accumulate all brush marks
    strokeCanvas = document.createElement('canvas');
    strokeCanvas.width = layer.canvas.width;
    strokeCanvas.height = layer.canvas.height;
    strokeCtx = strokeCanvas.getContext('2d');

    drawDot(pos);
}

function drawDot(pos) {
    const layer = getActiveLayer();
    const size = PF.brushSize;
    const opacity = PF.brushOpacity / 100;

    // Draw onto the stroke buffer, not the layer
    strokeCtx.fillStyle = PF.fgColor;
    strokeCtx.strokeStyle = PF.fgColor;
    strokeCtx.lineWidth = size;
    strokeCtx.lineCap = 'round';
    strokeCtx.lineJoin = 'round';
    strokeCtx.globalAlpha = 1;

    strokeCtx.save();
    strokeCtx.translate(-layer.x, -layer.y);

    if (PF.tool === 'pencil') {
        strokeCtx.fillRect(Math.round(pos.x - size / 2), Math.round(pos.y - size / 2), size, size);
    } else {
        strokeCtx.beginPath();
        strokeCtx.arc(pos.x, pos.y, size / 2, 0, Math.PI * 2);
        strokeCtx.fill();
    }
    strokeCtx.restore();

    // Composite the stroke onto the layer for live preview
    compositeStrokePreview();
}

function continueStroke(pos) {
    const layer = getActiveLayer();
    const size = PF.brushSize;

    strokeCtx.fillStyle = PF.fgColor;
    strokeCtx.strokeStyle = PF.fgColor;
    strokeCtx.lineWidth = size;
    strokeCtx.lineCap = 'round';
    strokeCtx.lineJoin = 'round';
    strokeCtx.globalAlpha = 1;

    strokeCtx.save();
    strokeCtx.translate(-layer.x, -layer.y);

    if (PF.tool === 'pencil') {
        const dx = Math.abs(pos.x - PF.lastX), dy = Math.abs(pos.y - PF.lastY);
        const sx = PF.lastX < pos.x ? 1 : -1, sy = PF.lastY < pos.y ? 1 : -1;
        let err = dx - dy, cx = PF.lastX, cy = PF.lastY;
        for (let i = 0; i < 1000; i++) {
            strokeCtx.fillRect(Math.round(cx - size / 2), Math.round(cy - size / 2), size, size);
            if (Math.abs(cx - pos.x) < 1 && Math.abs(cy - pos.y) < 1) break;
            const e2 = err * 2;
            if (e2 > -dy) { err -= dy; cx += sx; }
            if (e2 < dx) { err += dx; cy += sy; }
        }
    } else {
        strokeCtx.beginPath();
        strokeCtx.moveTo(PF.lastX, PF.lastY);
        strokeCtx.lineTo(pos.x, pos.y);
        strokeCtx.stroke();
    }
    strokeCtx.restore();

    compositeStrokePreview();
}

function compositeStrokePreview() {
    const layer = getActiveLayer();
    const ctx = layer.ctx;
    const opacity = PF.brushOpacity / 100;

    // Restore layer to pre-stroke state
    ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
    ctx.drawImage(preStrokeBackup, 0, 0);

    // Build a masked copy of the stroke buffer
    const masked = document.createElement('canvas');
    masked.width = layer.canvas.width;
    masked.height = layer.canvas.height;
    const mctx = masked.getContext('2d');
    mctx.drawImage(strokeCanvas, 0, 0);

    // Clip to selection mask if active
    if (PF.selection) {
        mctx.globalCompositeOperation = 'destination-in';
        mctx.drawImage(PF.selectionCanvas, -layer.x, -layer.y);
        mctx.globalCompositeOperation = 'source-over';
    }

    // Composite onto the layer
    ctx.globalAlpha = opacity;
    ctx.globalCompositeOperation = PF.tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.drawImage(masked, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    renderAll();
}

function endStroke() {
    // The layer already has the final composited result from compositeStrokePreview
    preStrokeBackup = null;
    strokeCanvas = null; strokeCtx = null;
    saveHistory(PF.tool === 'eraser' ? 'Erase' : PF.tool === 'pencil' ? 'Pencil' : 'Brush');
}

// ============ SELECTION TOOLS ============
function clearSelectionCanvas() {
    PF.sctx.clearRect(0, 0, PF.width, PF.height);
}

function startSelection(pos) {
    if (PF.tool === 'lasso') {
        PF.lassoPoints = [{ x: pos.x, y: pos.y }];
    }
}

function updateRectSelection(pos) {
    const x = Math.min(PF.startX, pos.x), y = Math.min(PF.startY, pos.y);
    const w = Math.abs(pos.x - PF.startX), h = Math.abs(pos.y - PF.startY);
    PF.selection = { type: 'raster' };
    
    clearSelectionCanvas();
    PF.sctx.fillStyle = '#fff';
    if (PF.tool === 'rect-select') {
        PF.sctx.fillRect(x, y, w, h);
    } else {
        PF.sctx.beginPath();
        PF.sctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
        PF.sctx.fill();
    }
    renderOverlay();
}

function continueLasso(pos) {
    if (!PF.lassoPoints) return;
    PF.lassoPoints.push({ x: pos.x, y: pos.y });
    PF.selection = { type: 'lasso', points: PF.lassoPoints };
    renderOverlay();
}

function finishLasso() {
    if (PF.lassoPoints && PF.lassoPoints.length > 2) {
        PF.selection = { type: 'raster' };
        clearSelectionCanvas();
        PF.sctx.fillStyle = '#fff';
        PF.sctx.beginPath();
        PF.lassoPoints.forEach((p, i) => i === 0 ? PF.sctx.moveTo(p.x, p.y) : PF.sctx.lineTo(p.x, p.y));
        PF.sctx.fill();
    }
    PF.lassoPoints = null;
    renderOverlay();
}

function magicWandSelect(px, py) {
    const layer = getActiveLayer();
    const lx = Math.round(px - layer.x);
    const ly = Math.round(py - layer.y);
    if (lx < 0 || ly < 0 || lx >= layer.canvas.width || ly >= layer.canvas.height) return;

    const imgData = layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
    const data = imgData.data;
    const idx = (ly * layer.canvas.width + lx) * 4;
    const tr = data[idx], tg = data[idx + 1], tb = data[idx + 2], ta = data[idx + 3];
    const tol = PF.wandTolerance;
    const visited = new Uint8Array(layer.canvas.width * layer.canvas.height);
    const stack = [lx, ly];
    
    // Write directly to selection canvas
    clearSelectionCanvas();
    const selData = PF.sctx.getImageData(0, 0, PF.width, PF.height);
    const sData = selData.data;

    while (stack.length > 0) {
        const cy = stack.pop(), cx = stack.pop();
        if (cx < 0 || cy < 0 || cx >= layer.canvas.width || cy >= layer.canvas.height) continue;
        const vi = cy * layer.canvas.width + cx;
        if (visited[vi]) continue;
        const ci = vi * 4;
        if (Math.abs(data[ci] - tr) > tol || Math.abs(data[ci + 1] - tg) > tol || Math.abs(data[ci + 2] - tb) > tol || Math.abs(data[ci + 3] - ta) > tol) continue;
        visited[vi] = 1;
        
        // Write to selection canvas which operates in global coordinates
        const gx = cx + layer.x;
        const gy = cy + layer.y;
        if (gx >= 0 && gx < PF.width && gy >= 0 && gy < PF.height) {
            const si = (gy * PF.width + gx) * 4;
            sData[si] = 255; sData[si + 1] = 255; sData[si + 2] = 255; sData[si + 3] = 255;
        }

        stack.push(cx + 1, cy, cx - 1, cy, cx, cy + 1, cx, cy - 1);
    }
    
    PF.sctx.putImageData(selData, 0, 0);
    PF.selection = { type: 'raster' };
    renderOverlay();
}

// ============ FLOOD FILL ============
function floodFill(px, py) {
    const layer = getActiveLayer();
    const lx = Math.round(px - layer.x);
    const ly = Math.round(py - layer.y);
    if (lx < 0 || ly < 0 || lx >= layer.canvas.width || ly >= layer.canvas.height) return;
    
    // Copy original in case of selection masking
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = layer.canvas.width; tmpCanvas.height = layer.canvas.height;
    const tctx = tmpCanvas.getContext('2d');
    tctx.drawImage(layer.canvas, 0, 0);

    const imgData = tctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
    const data = imgData.data;
    const idx = (ly * layer.canvas.width + lx) * 4;
    const tr = data[idx], tg = data[idx + 1], tb = data[idx + 2], ta = data[idx + 3];
    const fc = hexToRgb(PF.fgColor);
    if (tr === fc.r && tg === fc.g && tb === fc.b && ta === 255) return;
    const tol = PF.fillTolerance;
    const stack = [lx, ly];

    while (stack.length > 0) {
        const cy = stack.pop(), cx = stack.pop();
        if (cx < 0 || cy < 0 || cx >= layer.canvas.width || cy >= layer.canvas.height) continue;
        const ci = (cy * layer.canvas.width + cx) * 4;
        if (Math.abs(data[ci] - tr) > tol || Math.abs(data[ci + 1] - tg) > tol || Math.abs(data[ci + 2] - tb) > tol || Math.abs(data[ci + 3] - ta) > tol) continue;
        data[ci] = fc.r; data[ci + 1] = fc.g; data[ci + 2] = fc.b; data[ci + 3] = 255;
        stack.push(cx + 1, cy, cx - 1, cy, cx, cy + 1, cx, cy - 1);
    }
    tctx.putImageData(imgData, 0, 0);
    
    layer.clear();
    layer.ctx.drawImage(tmpCanvas, 0, 0);
    
    // Apply selection mask
    if (PF.selection) {
        // Redraw the original unmodified layer first
        layer.clear();
        layer.ctx.drawImage(PF.history[PF.historyIndex].layers[PF.activeLayerIndex].canvas, 0, 0);
        
        // Draw the filled portion restricted by the mask
        const maskedCanvas = document.createElement('canvas');
        maskedCanvas.width = layer.canvas.width; maskedCanvas.height = layer.canvas.height;
        const mctx = maskedCanvas.getContext('2d');
        mctx.drawImage(tmpCanvas, 0, 0);
        mctx.globalCompositeOperation = 'destination-in';
        mctx.drawImage(PF.selectionCanvas, -layer.x, -layer.y);
        
        layer.ctx.drawImage(maskedCanvas, 0, 0);
    }

    renderAll();
    saveHistory('Fill');
}

// ============ EYEDROPPER ============
function pickColor(pos) {
    const px = Math.round(pos.x), py = Math.round(pos.y);
    if (px < 0 || py < 0 || px >= PF.width || py >= PF.height) return;
    const data = PF.ctx.getImageData(px, py, 1, 1).data;
    PF.fgColor = rgbToHex(data[0], data[1], data[2]);
    document.getElementById('fg-color-swatch').style.background = PF.fgColor;
    updateColorPickerFromHex(PF.fgColor);
}

// ============ MOVE ============
function moveLayer(pos) {
    if (!PF.moveStartData) return;
    const layer = getActiveLayer();
    const dx = pos.x - PF.moveStartData.x;
    const dy = pos.y - PF.moveStartData.y;
    layer.x = PF.moveStartData.origX + dx;
    layer.y = PF.moveStartData.origY + dy;
    renderAll();
}

// ============ SHAPES ============
function previewShape(pos) {
    PF.octx.clearRect(0, 0, PF.width, PF.height);
    if (PF.selection) drawSelection();
    const s = PF.shapeStart;
    PF.octx.strokeStyle = PF.fgColor;
    PF.octx.fillStyle = PF.fgColor;
    PF.octx.lineWidth = PF.shapeStrokeWidth;
    PF.octx.globalAlpha = 0.7;

    if (PF.tool === 'rect-shape') {
        if (PF.shapeFill) PF.octx.fillRect(s.x, s.y, pos.x - s.x, pos.y - s.y);
        if (PF.shapeStrokeWidth > 0) PF.octx.strokeRect(s.x, s.y, pos.x - s.x, pos.y - s.y);
    } else if (PF.tool === 'ellipse-shape') {
        const cx = (s.x + pos.x) / 2, cy = (s.y + pos.y) / 2;
        const rx = Math.abs(pos.x - s.x) / 2, ry = Math.abs(pos.y - s.y) / 2;
        PF.octx.beginPath();
        PF.octx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        if (PF.shapeFill) PF.octx.fill();
        if (PF.shapeStrokeWidth > 0) PF.octx.stroke();
    } else if (PF.tool === 'line-shape' || PF.tool === 'arrow-shape') {
        PF.octx.beginPath();
        PF.octx.moveTo(s.x, s.y);
        PF.octx.lineTo(pos.x, pos.y);
        PF.octx.stroke();
        if (PF.tool === 'arrow-shape') drawArrowHead(PF.octx, s.x, s.y, pos.x, pos.y, 15);
    }
    PF.octx.globalAlpha = 1;
}

function drawArrowHead(ctx, x1, y1, x2, y2, size) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - size * Math.cos(angle - Math.PI / 6), y2 - size * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - size * Math.cos(angle + Math.PI / 6), y2 - size * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
}

function commitShape(pos) {
    const layer = getActiveLayer();
    const s = PF.shapeStart;
    if (!s) return;
    
    // Draw onto layer
    layer.ctx.save();
    layer.ctx.translate(-layer.x, -layer.y);
    layer.ctx.strokeStyle = PF.fgColor;
    layer.ctx.fillStyle = PF.fgColor;
    layer.ctx.lineWidth = PF.shapeStrokeWidth;

    if (PF.tool === 'rect-shape') {
        if (PF.shapeFill) layer.ctx.fillRect(s.x, s.y, pos.x - s.x, pos.y - s.y);
        if (PF.shapeStrokeWidth > 0) layer.ctx.strokeRect(s.x, s.y, pos.x - s.x, pos.y - s.y);
    } else if (PF.tool === 'ellipse-shape') {
        const cx = (s.x + pos.x) / 2, cy = (s.y + pos.y) / 2;
        const rx = Math.abs(pos.x - s.x) / 2, ry = Math.abs(pos.y - s.y) / 2;
        layer.ctx.beginPath();
        layer.ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        if (PF.shapeFill) layer.ctx.fill();
        if (PF.shapeStrokeWidth > 0) layer.ctx.stroke();
    } else if (PF.tool === 'line-shape' || PF.tool === 'arrow-shape') {
        layer.ctx.beginPath();
        layer.ctx.moveTo(s.x, s.y);
        layer.ctx.lineTo(pos.x, pos.y);
        layer.ctx.stroke();
        if (PF.tool === 'arrow-shape') drawArrowHead(layer.ctx, s.x, s.y, pos.x, pos.y, 15);
    }
    
    // Masking
    if (PF.selection) {
        layer.ctx.globalCompositeOperation = 'destination-in';
        layer.ctx.globalAlpha = 1;
        layer.ctx.setTransform(1, 0, 0, 1, 0, 0);
        layer.ctx.drawImage(PF.selectionCanvas, -layer.x, -layer.y);
    }
    
    layer.ctx.restore();

    PF.shapeStart = null;
    renderAll();
    saveHistory('Shape');
}

// ============ GRADIENT ============
function previewGradient(pos) {
    PF.octx.clearRect(0, 0, PF.width, PF.height);
    drawGradientTo(PF.octx, PF.gradientStart, pos, 0.6);
}

function drawGradientTo(ctx, from, to, alpha) {
    ctx.globalAlpha = alpha || 1;
    let grad;
    if (PF.gradientType === 'radial') {
        const r = Math.hypot(to.x - from.x, to.y - from.y);
        grad = ctx.createRadialGradient(from.x, from.y, 0, from.x, from.y, r);
    } else {
        grad = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
    }
    grad.addColorStop(0, PF.fgColor);
    grad.addColorStop(1, PF.gradientColor2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, PF.width, PF.height);
    ctx.globalAlpha = 1;
}

function commitGradient(pos) {
    if (!PF.gradientStart) return;
    const layer = getActiveLayer();
    layer.ctx.save();
    layer.ctx.translate(-layer.x, -layer.y);
    drawGradientTo(layer.ctx, PF.gradientStart, pos, PF.brushOpacity / 100);
    
    if (PF.selection) {
        layer.ctx.globalCompositeOperation = 'destination-in';
        layer.ctx.globalAlpha = 1;
        layer.ctx.setTransform(1, 0, 0, 1, 0, 0);
        layer.ctx.drawImage(PF.selectionCanvas, -layer.x, -layer.y);
    }
    layer.ctx.restore();

    PF.gradientStart = null;
    renderAll();
    saveHistory('Gradient');
}

// ============ CROP ============
function previewCrop(pos) {
    PF.octx.clearRect(0, 0, PF.width, PF.height);
    const x = Math.min(PF.cropStart.x, pos.x), y = Math.min(PF.cropStart.y, pos.y);
    const w = Math.abs(pos.x - PF.cropStart.x), h = Math.abs(pos.y - PF.cropStart.y);
    // Darken outside
    PF.octx.fillStyle = 'rgba(0,0,0,0.5)';
    PF.octx.fillRect(0, 0, PF.width, PF.height);
    PF.octx.clearRect(x, y, w, h);
    PF.octx.strokeStyle = '#fff';
    PF.octx.lineWidth = 1;
    PF.octx.setLineDash([4, 4]);
    PF.octx.strokeRect(x + 0.5, y + 0.5, w, h);
    PF.octx.setLineDash([]);
}

function commitCrop(pos) {
    if (!PF.cropStart) return;
    const x = Math.round(Math.min(PF.cropStart.x, pos.x));
    const y = Math.round(Math.min(PF.cropStart.y, pos.y));
    const w = Math.round(Math.abs(pos.x - PF.cropStart.x));
    const h = Math.round(Math.abs(pos.y - PF.cropStart.y));
    if (w < 2 || h < 2) { PF.cropStart = null; renderOverlay(); return; }

    PF.layers.forEach(l => {
        const tmp = document.createElement('canvas');
        tmp.width = w; tmp.height = h;
        tmp.getContext('2d').drawImage(l.canvas, -x, -y);
        l.canvas.width = w; l.canvas.height = h;
        l.ctx.drawImage(tmp, 0, 0);
    });
    setCanvasSize(w, h);
    PF.cropStart = null;
    fitToScreen();
    renderAll();
    saveHistory('Crop');
}

// ============ TEXT ============
function startTextEdit(pos) {
    const overlay = document.getElementById('text-edit-overlay');
    if (overlay.style.display === 'block') {
        commitText(overlay);
    }
    const sc = screenCoords(pos.x, pos.y);
    overlay.style.left = sc.x + 'px';
    overlay.style.top = sc.y + 'px';
    overlay.style.fontSize = (PF.textSize * PF.zoom) + 'px';
    overlay.style.fontFamily = PF.textFont;
    overlay.style.fontWeight = PF.textWeight;
    overlay.style.fontStyle = PF.textItalic ? 'italic' : 'normal';
    overlay.style.color = PF.fgColor;
    overlay.style.display = 'block';
    overlay.value = '';
    setTimeout(() => {
        overlay.focus();
    }, 10);
    overlay._pos = pos;

    overlay.onblur = () => { commitText(overlay); };
    overlay.onkeydown = (e) => { if (e.key === 'Escape') { overlay.style.display = 'none'; overlay.onblur = null; } };
}

function commitText(overlay) {
    if (overlay.style.display !== 'block') return;
    const text = overlay.value.trim();
    overlay.style.display = 'none';
    if (!text) return;

    const layer = getActiveLayer();
    const ctx = layer.ctx;
    const pos = overlay._pos;
    const lines = text.split('\n');
    const lineHeight = PF.textSize * 1.2;

    lines.forEach((line, i) => {
        const y = pos.y + PF.textSize + i * lineHeight;
        ctx.font = `${PF.textItalic ? 'italic ' : ''}${PF.textWeight} ${PF.textSize}px "${PF.textFont}"`;
        ctx.textBaseline = 'alphabetic';
        
        ctx.save();
        ctx.translate(-layer.x, -layer.y);

        // Glow
        if (PF.textGlow) {
            ctx.shadowColor = PF.textGlowColor;
            ctx.shadowBlur = 20;
            ctx.fillStyle = PF.textGlowColor;
            ctx.fillText(line, pos.x, y);
            ctx.fillText(line, pos.x, y);
            ctx.shadowBlur = 0;
        }

        // Shadow
        if (PF.textShadow) {
            ctx.shadowColor = PF.textShadowColor;
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 3;
            ctx.shadowOffsetY = 3;
        }

        // Outline
        if (PF.textOutline > 0) {
            ctx.strokeStyle = PF.textOutlineColor;
            ctx.lineWidth = PF.textOutline * 2;
            ctx.lineJoin = 'round';
            ctx.strokeText(line, pos.x, y);
        }

        // Fill
        ctx.fillStyle = PF.fgColor;
        ctx.fillText(line, pos.x, y);

        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        ctx.restore();
    });
    
    // Selection masking
    if (PF.selection) {
        ctx.globalCompositeOperation = 'destination-in';
        ctx.globalAlpha = 1;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(PF.selectionCanvas, -layer.x, -layer.y);
        ctx.globalCompositeOperation = 'source-over';
    }

    renderAll();
    saveHistory('Text');
}

// ============ FREE TRANSFORM ============
// State for the transform tool
let tfState = null; // { bounds, handle, origImageData, startBounds }

function activateTransform() {
    const layer = getActiveLayer();
    if (!layer) return;
    // Find the bounding box of non-transparent pixels
    const bounds = getContentBounds(layer);
    if (!bounds) return; // empty layer
    // Save original image data for the content region
    const origCanvas = document.createElement('canvas');
    origCanvas.width = bounds.w;
    origCanvas.height = bounds.h;
    origCanvas.getContext('2d').drawImage(layer.canvas, bounds.x - layer.x, bounds.y - layer.y, bounds.w, bounds.h, 0, 0, bounds.w, bounds.h);
    tfState = {
        bounds: { ...bounds },
        startBounds: { ...bounds },
        origCanvas: origCanvas,
        handle: null,
        dragging: false,
        dragStartX: 0, dragStartY: 0,
        boundsAtDragStart: null,
    };
    drawTransformOverlay();
}

function getContentBounds(layer) {
    const imgData = layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
    const d = imgData.data;
    let minX = layer.canvas.width, minY = layer.canvas.height, maxX = 0, maxY = 0;
    for (let y = 0; y < layer.canvas.height; y++) {
        for (let x = 0; x < layer.canvas.width; x++) {
            if (d[(y * layer.canvas.width + x) * 4 + 3] > 0) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }
    if (maxX < minX) return null;
    return { x: minX + layer.x, y: minY + layer.y, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function getBoundsFromCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;
    let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
    for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
            if (d[(y * canvas.width + x) * 4 + 3] > 0) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }
    if (maxX < minX) return null;
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function drawTransformOverlay() {
    if (!tfState) return;
    PF.octx.clearRect(0, 0, PF.width, PF.height);
    const b = tfState.bounds;
    const hs = 6 / PF.zoom; // handle size in canvas coords
    // Draw border
    PF.octx.save();
    PF.octx.strokeStyle = '#4a90ff';
    PF.octx.lineWidth = 1.5 / PF.zoom;
    PF.octx.setLineDash([]);
    PF.octx.strokeRect(b.x, b.y, b.w, b.h);
    // Draw 8 handles
    PF.octx.fillStyle = '#ffffff';
    PF.octx.strokeStyle = '#4a90ff';
    PF.octx.lineWidth = 1.5 / PF.zoom;
    const handles = getTransformHandles(b, hs);
    handles.forEach(h => {
        PF.octx.fillRect(h.x - hs / 2, h.y - hs / 2, hs, hs);
        PF.octx.strokeRect(h.x - hs / 2, h.y - hs / 2, hs, hs);
    });
    // Dimensions label
    PF.octx.fillStyle = 'rgba(74,144,255,0.85)';
    const lw = Math.max(60 / PF.zoom, 10);
    const lh = 16 / PF.zoom;
    PF.octx.fillRect(b.x + b.w / 2 - lw / 2, b.y - lh - 4 / PF.zoom, lw, lh);
    PF.octx.fillStyle = '#fff';
    PF.octx.font = `${11 / PF.zoom}px Inter`;
    PF.octx.textAlign = 'center';
    PF.octx.textBaseline = 'middle';
    PF.octx.fillText(`${Math.round(b.w)}×${Math.round(b.h)}`, b.x + b.w / 2, b.y - lh / 2 - 4 / PF.zoom);
    PF.octx.restore();
}

function getTransformHandles(b, hs) {
    return [
        { id: 'tl', x: b.x, y: b.y },
        { id: 'tc', x: b.x + b.w / 2, y: b.y },
        { id: 'tr', x: b.x + b.w, y: b.y },
        { id: 'ml', x: b.x, y: b.y + b.h / 2 },
        { id: 'mr', x: b.x + b.w, y: b.y + b.h / 2 },
        { id: 'bl', x: b.x, y: b.y + b.h },
        { id: 'bc', x: b.x + b.w / 2, y: b.y + b.h },
        { id: 'br', x: b.x + b.w, y: b.y + b.h },
    ];
}

function hitTestHandle(pos) {
    if (!tfState) return null;
    const hs = 8 / PF.zoom;
    const handles = getTransformHandles(tfState.bounds, hs);
    for (const h of handles) {
        if (Math.abs(pos.x - h.x) <= hs && Math.abs(pos.y - h.y) <= hs) return h.id;
    }
    // Check if inside bounds (for move)
    const b = tfState.bounds;
    if (pos.x >= b.x && pos.x <= b.x + b.w && pos.y >= b.y && pos.y <= b.y + b.h) return 'move';
    return null;
}

function transformMouseDown(pos, e) {
    if (!tfState) {
        activateTransform();
        PF.isDrawing = false;
        return;
    }
    const handle = hitTestHandle(pos);
    if (!handle) {
        // Clicked outside — commit transform
        commitTransform();
        PF.isDrawing = false;
        return;
    }
    tfState.handle = handle;
    tfState.dragging = true;
    tfState.dragStartX = pos.x;
    tfState.dragStartY = pos.y;
    tfState.boundsAtDragStart = { ...tfState.bounds };
}

function transformMouseMove(pos) {
    if (!tfState || !tfState.dragging) return;
    const dx = pos.x - tfState.dragStartX;
    const dy = pos.y - tfState.dragStartY;
    const ob = tfState.boundsAtDragStart;
    const b = tfState.bounds;

    switch (tfState.handle) {
        case 'move':
            b.x = ob.x + dx; b.y = ob.y + dy; break;
        case 'br':
            b.w = Math.max(4, ob.w + dx); b.h = Math.max(4, ob.h + dy); break;
        case 'bl':
            b.x = ob.x + dx; b.w = Math.max(4, ob.w - dx); b.h = Math.max(4, ob.h + dy); break;
        case 'tr':
            b.y = ob.y + dy; b.w = Math.max(4, ob.w + dx); b.h = Math.max(4, ob.h - dy); break;
        case 'tl':
            b.x = ob.x + dx; b.y = ob.y + dy; b.w = Math.max(4, ob.w - dx); b.h = Math.max(4, ob.h - dy); break;
        case 'tc':
            b.y = ob.y + dy; b.h = Math.max(4, ob.h - dy); break;
        case 'bc':
            b.h = Math.max(4, ob.h + dy); break;
        case 'ml':
            b.x = ob.x + dx; b.w = Math.max(4, ob.w - dx); break;
        case 'mr':
            b.w = Math.max(4, ob.w + dx); break;
    }

    // Live preview: redraw the layer with the transformed content
    const layer = getActiveLayer();
    layer.clear();
    layer.ctx.drawImage(tfState.origCanvas, 0, 0, tfState.origCanvas.width, tfState.origCanvas.height, b.x - layer.x, b.y - layer.y, b.w, b.h);
    renderAll();
    drawTransformOverlay();
}

function transformMouseUp(pos) {
    if (!tfState) return;
    tfState.dragging = false;
    tfState.handle = null;
}

function commitTransform() {
    if (!tfState) return;
    // The layer already has the transformed content drawn on it
    PF.octx.clearRect(0, 0, PF.width, PF.height);
    tfState = null;
    renderAll();
    saveHistory('Transform');
}

function cancelTransform() {
    if (!tfState) return;
    // Restore original content
    const layer = getActiveLayer();
    layer.clear();
    const ob = tfState.startBounds;
    layer.ctx.drawImage(tfState.origCanvas, ob.x - layer.x, ob.y - layer.y);
    PF.octx.clearRect(0, 0, PF.width, PF.height);
    tfState = null;
    renderAll();
}

// ============ COLOR UTILS ============
function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

function hslToRgb(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
}

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
            case g: h = ((b - r) / d + 2) * 60; break;
            case b: h = ((r - g) / d + 4) * 60; break;
        }
    }
    return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}
