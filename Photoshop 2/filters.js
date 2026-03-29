// ekian.dev — Filters, Modals, File I/O (Part 4)

// ============ MODALS ============
function showModal(title, bodyHTML, buttons) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    const footer = document.getElementById('modal-footer');
    footer.innerHTML = '';
    buttons.forEach(btn => {
        const b = document.createElement('button');
        b.textContent = btn.text;
        b.className = btn.primary ? 'btn-primary' : 'btn-secondary';
        b.addEventListener('click', () => { if (btn.action) btn.action(); if (btn.close !== false) closeModal(); });
        footer.appendChild(b);
    });
    document.getElementById('modal-overlay').classList.add('visible');
    document.getElementById('modal-close').onclick = closeModal;
}

function closeModal() { document.getElementById('modal-overlay').classList.remove('visible'); }

function showNewCanvasModal() {
    showModal('New Canvas', `
        <div class="modal-row"><div><label>Width (px)</label><input type="number" id="nc-w" value="1280" min="1" max="8000"></div>
        <div><label>Height (px)</label><input type="number" id="nc-h" value="720" min="1" max="8000"></div></div>
        <label>Name</label>
        <input type="text" id="nc-name" value="Untitled" placeholder="Project name">
        <div class="preset-buttons">
            <button class="preset-btn" onclick="document.getElementById('nc-w').value=1280;document.getElementById('nc-h').value=720">YT Thumbnail<br><span class="preset-size">1280×720</span></button>
            <button class="preset-btn" onclick="document.getElementById('nc-w').value=1920;document.getElementById('nc-h').value=1080">Full HD<br><span class="preset-size">1920×1080</span></button>
            <button class="preset-btn" onclick="document.getElementById('nc-w').value=1080;document.getElementById('nc-h').value=1080">Instagram<br><span class="preset-size">1080×1080</span></button>
            <button class="preset-btn" onclick="document.getElementById('nc-w').value=2560;document.getElementById('nc-h').value=1440">YT Banner<br><span class="preset-size">2560×1440</span></button>
        </div>
    `, [
        { text: 'Cancel' },
        { text: 'Create', primary: true, action: () => {
            const w = +document.getElementById('nc-w').value || 1280;
            const h = +document.getElementById('nc-h').value || 720;
            const name = document.getElementById('nc-name').value || 'Untitled';
            newCanvas(w, h, name);
        }}
    ]);
}

function showResizeModal(title, scaleContent) {
    showModal(title, `
        <div class="modal-row"><div><label>Width (px)</label><input type="number" id="rs-w" value="${PF.width}" min="1" max="8000"></div>
        <div><label>Height (px)</label><input type="number" id="rs-h" value="${PF.height}" min="1" max="8000"></div></div>
    `, [
        { text: 'Cancel' },
        { text: 'Apply', primary: true, action: () => {
            const nw = +document.getElementById('rs-w').value, nh = +document.getElementById('rs-h').value;
            if (scaleContent) resizeImage(nw, nh); else resizeCanvas(nw, nh);
        }}
    ]);
}

function resizeCanvas(nw, nh) {
    PF.layers.forEach(l => l.resize(nw, nh));
    setCanvasSize(nw, nh);
    fitToScreen(); renderAll(); saveHistory('Resize Canvas');
}

function resizeImage(nw, nh) {
    PF.layers.forEach(l => {
        const tmp = document.createElement('canvas');
        tmp.width = nw; tmp.height = nh;
        tmp.getContext('2d').drawImage(l.canvas, 0, 0, nw, nh);
        l.canvas.width = nw; l.canvas.height = nh;
        l.ctx.drawImage(tmp, 0, 0);
    });
    setCanvasSize(nw, nh);
    fitToScreen(); renderAll(); saveHistory('Resize Image');
}

function showExportJpegModal() {
    showModal('Export JPEG', `
        <label>Quality</label>
        <input type="range" id="jpeg-q" min="1" max="100" value="92">
        <span id="jpeg-q-val" style="color:#888;margin-left:8px">92%</span>
    `, [
        { text: 'Cancel' },
        { text: 'Export', primary: true, action: () => exportImage('jpeg', document.getElementById('jpeg-q').value / 100) }
    ]);
    setTimeout(() => {
        const slider = document.getElementById('jpeg-q');
        if (slider) slider.addEventListener('input', () => document.getElementById('jpeg-q-val').textContent = slider.value + '%');
    }, 50);
}

// ============ FILTERS ============
function showFilterModal(title, applyFn) {
    let body = '';
    switch (title) {
        case 'Brightness / Contrast':
            body = `<label>Brightness</label><input type="range" id="f-bright" min="-100" max="100" value="0"><span id="f-bright-v" style="color:#888">0</span>
                    <label>Contrast</label><input type="range" id="f-contrast" min="-100" max="100" value="0"><span id="f-contrast-v" style="color:#888">0</span>`; break;
        case 'Hue / Saturation':
            body = `<label>Hue</label><input type="range" id="f-hue" min="-180" max="180" value="0"><span id="f-hue-v" style="color:#888">0</span>
                    <label>Saturation</label><input type="range" id="f-sat" min="-100" max="100" value="0"><span id="f-sat-v" style="color:#888">0</span>
                    <label>Lightness</label><input type="range" id="f-light" min="-100" max="100" value="0"><span id="f-light-v" style="color:#888">0</span>`; break;
        case 'Levels':
            body = `<label>Input Black</label><input type="range" id="f-lvl-b" min="0" max="255" value="0"><span id="f-lvl-b-v" style="color:#888">0</span>
                    <label>Input White</label><input type="range" id="f-lvl-w" min="0" max="255" value="255"><span id="f-lvl-w-v" style="color:#888">255</span>
                    <label>Gamma</label><input type="range" id="f-lvl-g" min="10" max="300" value="100"><span id="f-lvl-g-v" style="color:#888">1.0</span>`; break;
        case 'Gaussian Blur':
            body = `<label>Radius</label><input type="range" id="f-blur" min="1" max="50" value="5"><span id="f-blur-v" style="color:#888">5</span>`; break;
        case 'Add Noise':
            body = `<label>Amount</label><input type="range" id="f-noise" min="1" max="100" value="20"><span id="f-noise-v" style="color:#888">20</span>`; break;
        case 'Drop Shadow':
            body = `<label>Offset X</label><input type="range" id="f-ds-x" min="-50" max="50" value="5"><span id="f-ds-x-v" style="color:#888">5</span>
                    <label>Offset Y</label><input type="range" id="f-ds-y" min="-50" max="50" value="5"><span id="f-ds-y-v" style="color:#888">5</span>
                    <label>Blur</label><input type="range" id="f-ds-b" min="0" max="50" value="10"><span id="f-ds-b-v" style="color:#888">10</span>
                    <label>Color</label><input type="color" id="f-ds-c" value="#000000">`; break;
        case 'Outer Glow':
            body = `<label>Spread</label><input type="range" id="f-og-s" min="1" max="50" value="10"><span id="f-og-s-v" style="color:#888">10</span>
                    <label>Color</label><input type="color" id="f-og-c" value="#ffff00">`; break;
        case 'Chroma Key':
            body = `<label>Target Color</label><input type="color" id="f-ck-c" value="#00ff00">
                    <label>Tolerance</label><input type="range" id="f-ck-t" min="1" max="150" value="50"><span id="f-ck-t-v" style="color:#888">50</span>`; break;
        case 'Smooth Colors':
            body = `<label>Radius</label><input type="range" id="f-sc-r" min="1" max="20" value="5"><span id="f-sc-r-v" style="color:#888">5</span>
                    <label>Tolerance</label><input type="range" id="f-sc-t" min="1" max="150" value="40"><span id="f-sc-t-v" style="color:#888">40</span>
                    <label>Strength</label><input type="range" id="f-sc-s" min="1" max="100" value="80"><span id="f-sc-s-v" style="color:#888">80%</span>`; break;
    }
    showModal(title, body, [
        { text: 'Cancel' },
        { text: 'Apply', primary: true, action: () => applyFn() }
    ]);
    // Wire up value displays
    setTimeout(() => {
        document.querySelectorAll('.modal-body input[type="range"]').forEach(inp => {
            const vSpan = inp.nextElementSibling;
            if (vSpan && vSpan.tagName === 'SPAN') {
                inp.addEventListener('input', () => {
                    let val = inp.value;
                    if (inp.id === 'f-lvl-g') val = (inp.value / 100).toFixed(1);
                    vSpan.textContent = val;
                });
            }
        });
    }, 50);
}

function filterBrightnessContrast() {
    const bright = +document.getElementById('f-bright').value;
    const contrast = +document.getElementById('f-contrast').value;
    applyPixelFilter((r, g, b, a) => {
        let nr = r + bright, ng = g + bright, nb = b + bright;
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
        nr = factor * (nr - 128) + 128;
        ng = factor * (ng - 128) + 128;
        nb = factor * (nb - 128) + 128;
        return [clamp(nr), clamp(ng), clamp(nb), a];
    });
    saveHistory('Brightness/Contrast');
}

function filterHSL() {
    const hueShift = +document.getElementById('f-hue').value;
    const satShift = +document.getElementById('f-sat').value;
    const lightShift = +document.getElementById('f-light').value;
    applyPixelFilter((r, g, b, a) => {
        const hsl = rgbToHsl(r, g, b);
        hsl.h = (hsl.h + hueShift + 360) % 360;
        hsl.s = clamp(hsl.s + satShift, 0, 100);
        hsl.l = clamp(hsl.l + lightShift, 0, 100);
        const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
        return [rgb.r, rgb.g, rgb.b, a];
    });
    saveHistory('Hue/Saturation');
}

function filterLevels() {
    const inBlack = +document.getElementById('f-lvl-b').value;
    const inWhite = +document.getElementById('f-lvl-w').value;
    const gamma = (+document.getElementById('f-lvl-g').value) / 100;
    applyPixelFilter((r, g, b, a) => {
        const adjust = v => {
            v = (v - inBlack) / Math.max(1, inWhite - inBlack);
            v = Math.max(0, Math.min(1, v));
            v = Math.pow(v, 1 / gamma);
            return clamp(v * 255);
        };
        return [adjust(r), adjust(g), adjust(b), a];
    });
    saveHistory('Levels');
}

function filterBlur() {
    const radius = +document.getElementById('f-blur').value;
    const layer = getActiveLayer();
    const imgData = layer.ctx.getImageData(0, 0, PF.width, PF.height);
    const result = boxBlur(imgData, PF.width, PF.height, radius);
    layer.ctx.putImageData(result, 0, 0);
    renderAll(); saveHistory('Blur');
}

function boxBlur(imgData, w, h, r) {
    const data = imgData.data;
    const out = new ImageData(w, h);
    const o = out.data;
    // Horizontal pass
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let rr = 0, gg = 0, bb = 0, aa = 0, count = 0;
            for (let dx = -r; dx <= r; dx++) {
                const nx = Math.min(w - 1, Math.max(0, x + dx));
                const i = (y * w + nx) * 4;
                rr += data[i]; gg += data[i + 1]; bb += data[i + 2]; aa += data[i + 3]; count++;
            }
            const i = (y * w + x) * 4;
            o[i] = rr / count; o[i + 1] = gg / count; o[i + 2] = bb / count; o[i + 3] = aa / count;
        }
    }
    // Vertical pass
    const temp = new Uint8ClampedArray(o);
    for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
            let rr = 0, gg = 0, bb = 0, aa = 0, count = 0;
            for (let dy = -r; dy <= r; dy++) {
                const ny = Math.min(h - 1, Math.max(0, y + dy));
                const i = (ny * w + x) * 4;
                rr += temp[i]; gg += temp[i + 1]; bb += temp[i + 2]; aa += temp[i + 3]; count++;
            }
            const i = (y * w + x) * 4;
            o[i] = rr / count; o[i + 1] = gg / count; o[i + 2] = bb / count; o[i + 3] = aa / count;
        }
    }
    return out;
}

function filterSharpen() {
    const layer = getActiveLayer();
    const imgData = layer.ctx.getImageData(0, 0, PF.width, PF.height);
    const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
    const result = convolve(imgData, PF.width, PF.height, kernel);
    layer.ctx.putImageData(result, 0, 0);
    renderAll(); saveHistory('Sharpen');
}

function convolve(imgData, w, h, kernel) {
    const data = imgData.data;
    const out = new ImageData(w, h);
    const o = out.data;
    const ks = Math.sqrt(kernel.length) | 0;
    const half = ks >> 1;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let r = 0, g = 0, b = 0;
            for (let ky = 0; ky < ks; ky++) {
                for (let kx = 0; kx < ks; kx++) {
                    const py = Math.min(h - 1, Math.max(0, y + ky - half));
                    const px = Math.min(w - 1, Math.max(0, x + kx - half));
                    const i = (py * w + px) * 4;
                    const kv = kernel[ky * ks + kx];
                    r += data[i] * kv; g += data[i + 1] * kv; b += data[i + 2] * kv;
                }
            }
            const i = (y * w + x) * 4;
            o[i] = clamp(r); o[i + 1] = clamp(g); o[i + 2] = clamp(b); o[i + 3] = data[i + 3];
        }
    }
    return out;
}

function filterNoise() {
    const amount = +document.getElementById('f-noise').value;
    applyPixelFilter((r, g, b, a) => {
        const n = (Math.random() - 0.5) * amount * 2;
        return [clamp(r + n), clamp(g + n), clamp(b + n), a];
    });
    saveHistory('Noise');
}

function filterInvert() {
    applyPixelFilter((r, g, b, a) => [255 - r, 255 - g, 255 - b, a]);
    saveHistory('Invert');
}

function filterGrayscale() {
    applyPixelFilter((r, g, b, a) => {
        const v = 0.299 * r + 0.587 * g + 0.114 * b;
        return [v, v, v, a];
    });
    saveHistory('Grayscale');
}

function filterSepia() {
    applyPixelFilter((r, g, b, a) => [
        clamp(r * 0.393 + g * 0.769 + b * 0.189),
        clamp(r * 0.349 + g * 0.686 + b * 0.168),
        clamp(r * 0.272 + g * 0.534 + b * 0.131), a
    ]);
    saveHistory('Sepia');
}

function filterDropShadow() {
    const ox = +document.getElementById('f-ds-x').value;
    const oy = +document.getElementById('f-ds-y').value;
    const blur = +document.getElementById('f-ds-b').value;
    const color = document.getElementById('f-ds-c').value;
    const layer = getActiveLayer();
    layer.ctx.shadowColor = color;
    layer.ctx.shadowBlur = blur;
    layer.ctx.shadowOffsetX = ox;
    layer.ctx.shadowOffsetY = oy;
    const tmp = document.createElement('canvas');
    tmp.width = PF.width; tmp.height = PF.height;
    tmp.getContext('2d').drawImage(layer.canvas, 0, 0);
    layer.ctx.drawImage(tmp, 0, 0);
    layer.ctx.shadowColor = 'transparent';
    layer.ctx.shadowBlur = 0; layer.ctx.shadowOffsetX = 0; layer.ctx.shadowOffsetY = 0;
    renderAll(); saveHistory('Drop Shadow');
}

function filterOuterGlow() {
    const spread = +document.getElementById('f-og-s').value;
    const color = document.getElementById('f-og-c').value;
    const layer = getActiveLayer();
    layer.ctx.shadowColor = color;
    layer.ctx.shadowBlur = spread;
    layer.ctx.shadowOffsetX = 0; layer.ctx.shadowOffsetY = 0;
    const tmp = document.createElement('canvas');
    tmp.width = PF.width; tmp.height = PF.height;
    tmp.getContext('2d').drawImage(layer.canvas, 0, 0);
    for (let i = 0; i < 3; i++) layer.ctx.drawImage(tmp, 0, 0);
    layer.ctx.shadowColor = 'transparent'; layer.ctx.shadowBlur = 0;
    renderAll(); saveHistory('Outer Glow');
}

function filterChromaKey() {
    const targetColor = hexToRgb(document.getElementById('f-ck-c').value);
    const tolerance = +document.getElementById('f-ck-t').value;
    applyPixelFilter((r, g, b, a) => {
        const dist = Math.sqrt((r - targetColor.r) ** 2 + (g - targetColor.g) ** 2 + (b - targetColor.b) ** 2);
        if (dist < tolerance) return [r, g, b, 0];
        if (dist < tolerance * 1.5) {
            const fade = (dist - tolerance) / (tolerance * 0.5);
            return [r, g, b, clamp(a * fade)];
        }
        return [r, g, b, a];
    });
    saveHistory('Chroma Key');
}

function filterSmoothColors() {
    const radius = +document.getElementById('f-sc-r').value;
    const tolerance = +document.getElementById('f-sc-t').value;
    const strength = +document.getElementById('f-sc-s').value / 100;
    const layer = getActiveLayer();
    const imgData = layer.ctx.getImageData(0, 0, PF.width, PF.height);
    const src = imgData.data;
    const out = new ImageData(PF.width, PF.height);
    const dst = out.data;
    const w = PF.width, h = PF.height;
    const tolSq = tolerance * tolerance;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const ci = (y * w + x) * 4;
            const cr = src[ci], cg = src[ci + 1], cb = src[ci + 2], ca = src[ci + 3];
            let sumR = 0, sumG = 0, sumB = 0, sumA = 0, weight = 0;

            for (let dy = -radius; dy <= radius; dy++) {
                const ny = y + dy;
                if (ny < 0 || ny >= h) continue;
                for (let dx = -radius; dx <= radius; dx++) {
                    const nx = x + dx;
                    if (nx < 0 || nx >= w) continue;
                    const ni = (ny * w + nx) * 4;
                    const dr = src[ni] - cr, dg = src[ni + 1] - cg, db = src[ni + 2] - cb;
                    const colorDistSq = dr * dr + dg * dg + db * db;
                    if (colorDistSq <= tolSq) {
                        // Weight by spatial distance too (closer = more weight)
                        const spatialDist = Math.sqrt(dx * dx + dy * dy);
                        const w_s = Math.max(0, 1 - spatialDist / (radius + 1));
                        const w_c = 1 - colorDistSq / (tolSq + 1);
                        const wt = w_s * w_c;
                        sumR += src[ni] * wt;
                        sumG += src[ni + 1] * wt;
                        sumB += src[ni + 2] * wt;
                        sumA += src[ni + 3] * wt;
                        weight += wt;
                    }
                }
            }

            if (weight > 0) {
                dst[ci]     = Math.round(cr + (sumR / weight - cr) * strength);
                dst[ci + 1] = Math.round(cg + (sumG / weight - cg) * strength);
                dst[ci + 2] = Math.round(cb + (sumB / weight - cb) * strength);
                dst[ci + 3] = Math.round(ca + (sumA / weight - ca) * strength);
            } else {
                dst[ci] = cr; dst[ci + 1] = cg; dst[ci + 2] = cb; dst[ci + 3] = ca;
            }
        }
    }

    layer.ctx.putImageData(out, 0, 0);
    renderAll();
    saveHistory('Smooth Colors');
}

function applyPixelFilter(fn) {
    const layer = getActiveLayer();
    const imgData = layer.ctx.getImageData(0, 0, PF.width, PF.height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
        const [r, g, b, a] = fn(d[i], d[i + 1], d[i + 2], d[i + 3]);
        d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;
    }
    layer.ctx.putImageData(imgData, 0, 0);
    renderAll();
}

function clamp(v, min = 0, max = 255) { return Math.max(min, Math.min(max, Math.round(v))); }

// ============ FILE I/O ============
function openFile() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.addEventListener('change', () => { if (input.files[0]) loadImageFile(input.files[0]); });
    input.click();
}

function exportImage(fmt, quality) {
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = PF.width; tmpCanvas.height = PF.height;
    const tctx = tmpCanvas.getContext('2d');
    // Flatten
    for (let i = PF.layers.length - 1; i >= 0; i--) {
        const l = PF.layers[i];
        if (!l.visible) continue;
        tctx.globalAlpha = l.opacity;
        tctx.globalCompositeOperation = l.blendMode;
        tctx.drawImage(l.canvas, 0, 0);
    }
    const mime = fmt === 'jpeg' ? 'image/jpeg' : 'image/png';
    const url = tmpCanvas.toDataURL(mime, quality || 0.92);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ekian-export.' + (fmt === 'jpeg' ? 'jpg' : 'png');
    a.click();
}

function saveProject() {
    const project = {
        width: PF.width, height: PF.height,
        layers: PF.layers.map(l => ({
            name: l.name, visible: l.visible, locked: l.locked,
            opacity: l.opacity, blendMode: l.blendMode,
            data: l.canvas.toDataURL('image/png')
        })),
        activeLayerIndex: PF.activeLayerIndex
    };
    const blob = new Blob([JSON.stringify(project)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'ekian-project.pfp';
    a.click();
    URL.revokeObjectURL(url);
}

function loadProject() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.pfp,.json';
    input.addEventListener('change', () => {
        if (!input.files[0]) return;
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const project = JSON.parse(e.target.result);
                setCanvasSize(project.width, project.height);
                PF.layers = [];
                let loaded = 0;
                project.layers.forEach((ld, idx) => {
                    const img = new Image();
                    img.onload = () => {
                        const layer = new Layer(ld.name, project.width, project.height);
                        layer.ctx.drawImage(img, 0, 0);
                        layer.visible = ld.visible; layer.locked = ld.locked;
                        layer.opacity = ld.opacity; layer.blendMode = ld.blendMode;
                        PF.layers[idx] = layer;
                        loaded++;
                        if (loaded === project.layers.length) {
                            PF.activeLayerIndex = project.activeLayerIndex || 0;
                            PF.history = []; PF.historyIndex = -1;
                            saveHistory('Load Project');
                            fitToScreen(); renderAll(); updateLayerList();
                        }
                    };
                    img.src = ld.data;
                });
            } catch (err) { alert('Failed to load project: ' + err.message); }
        };
        reader.readAsText(input.files[0]);
    });
    input.click();
}
