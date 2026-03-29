// ekian.dev — Home Page Logic
'use strict';

let ctxMenuProject = null;

async function initHome() {
    await ProjectStore.init();
    loadProjects();
    setupTemplates();
    setupButtons();
    setupContextMenu();
    updateStorageInfo();
}

// ============ LOAD & RENDER PROJECTS ============
async function loadProjects() {
    const projects = await ProjectStore.getAllProjects();
    const grid = document.getElementById('projects-grid');
    const empty = document.getElementById('empty-state');
    const count = document.getElementById('project-count');

    grid.innerHTML = '';
    if (projects.length === 0) {
        empty.style.display = 'block';
        count.textContent = 'No projects saved';
        return;
    }
    empty.style.display = 'none';
    count.textContent = projects.length + ' project' + (projects.length !== 1 ? 's' : '');

    projects.forEach(p => {
        const card = document.createElement('div');
        card.className = 'project-card';
        card.dataset.id = p.id;

        const thumbHtml = p.thumbnail
            ? `<img class="project-thumb" src="${p.thumbnail}" alt="${p.name}">`
            : `<div class="project-thumb-empty">No preview</div>`;

        card.innerHTML = `
            ${thumbHtml}
            <div class="project-info">
                <div class="project-name">${escHtml(p.name)}</div>
                <div class="project-meta">
                    <span>${formatSize(p.width, p.height)}</span>
                    <span>${formatDate(p.updatedAt)}</span>
                </div>
            </div>
            <div class="project-actions">
                <button class="proj-menu-btn" title="More options">⋯</button>
            </div>
        `;

        card.addEventListener('click', (e) => {
            if (e.target.closest('.proj-menu-btn') || e.target.closest('.project-actions')) return;
            openProject(p.id);
        });

        card.querySelector('.proj-menu-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            showContextMenu(e, p.id);
        });

        card.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showContextMenu(e, p.id);
        });

        grid.appendChild(card);
    });
}

// ============ TEMPLATES ============
function setupTemplates() {
    document.querySelectorAll('.template-card').forEach(card => {
        card.addEventListener('click', () => {
            const w = +card.dataset.w;
            const h = +card.dataset.h;
            if (w === 0 && h === 0) {
                showCustomSizeModal();
            } else {
                createAndOpenProject(card.querySelector('.template-name').textContent, w, h);
            }
        });
    });
}

// ============ BUTTONS ============
function setupButtons() {
    document.getElementById('btn-new-project').addEventListener('click', () => {
        showCustomSizeModal();
    });
    document.getElementById('btn-import-image').addEventListener('click', () => {
        document.getElementById('file-input').click();
    });
    document.getElementById('file-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        importImageAsProject(file);
        e.target.value = '';
    });
}

// ============ PROJECT OPERATIONS ============
async function createAndOpenProject(name, w, h) {
    const project = {
        id: generateId(),
        name: name || 'Untitled',
        width: w,
        height: h,
        layers: [],
        activeLayerIndex: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        thumbnail: null,
    };
    await ProjectStore.saveProject(project);
    openProject(project.id);
}

function openProject(id) {
    window.location.href = 'editor.html?project=' + id;
}

async function importImageAsProject(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        const img = new Image();
        img.onload = async () => {
            const w = img.width, h = img.height;
            // Create a temp canvas to generate thumbnail
            const tc = document.createElement('canvas');
            tc.width = w; tc.height = h;
            tc.getContext('2d').drawImage(img, 0, 0);
            const thumbScale = Math.min(300 / w, 300 / h, 1);
            const thumbC = document.createElement('canvas');
            thumbC.width = w * thumbScale; thumbC.height = h * thumbScale;
            thumbC.getContext('2d').drawImage(img, 0, 0, thumbC.width, thumbC.height);
            const thumbnail = thumbC.toDataURL('image/jpeg', 0.7);

            const project = {
                id: generateId(),
                name: file.name.replace(/\.[^.]+$/, '') || 'Imported Image',
                width: w, height: h,
                layers: [{
                    name: 'Background',
                    visible: true, locked: false,
                    opacity: 1, blendMode: 'source-over',
                    data: tc.toDataURL('image/png'),
                }],
                activeLayerIndex: 0,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                thumbnail: thumbnail,
            };
            await ProjectStore.saveProject(project);
            openProject(project.id);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// ============ CONTEXT MENU ============
function setupContextMenu() {
    const menu = document.getElementById('context-menu');
    document.addEventListener('click', () => menu.classList.remove('visible'));
    menu.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!ctxMenuProject) return;
            const action = btn.dataset.action;
            const id = ctxMenuProject;
            menu.classList.remove('visible');

            switch (action) {
                case 'open': openProject(id); break;
                case 'duplicate':
                    await ProjectStore.duplicateProject(id);
                    loadProjects();
                    break;
                case 'rename':
                    const p = await ProjectStore.getProject(id);
                    if (p) showRenameModal(p);
                    break;
                case 'export':
                    const proj = await ProjectStore.getProject(id);
                    if (proj && proj.thumbnail) {
                        const a = document.createElement('a');
                        a.href = proj.thumbnail;
                        a.download = proj.name + '.png';
                        a.click();
                    }
                    break;
                case 'delete':
                    if (confirm('Delete this project? This cannot be undone.')) {
                        await ProjectStore.deleteProject(id);
                        loadProjects();
                        updateStorageInfo();
                    }
                    break;
            }
            ctxMenuProject = null;
        });
    });
}

function showContextMenu(e, projectId) {
    const menu = document.getElementById('context-menu');
    ctxMenuProject = projectId;
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    menu.classList.add('visible');
    // Keep within viewport
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 8) + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 8) + 'px';
}

// ============ MODALS ============
function showModal(title, bodyHtml, onConfirm) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    const footer = document.getElementById('modal-footer');
    footer.innerHTML = `<button class="btn-cancel">Cancel</button><button class="btn-confirm">Create</button>`;
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.add('visible');

    document.getElementById('modal-close').onclick = () => overlay.classList.remove('visible');
    footer.querySelector('.btn-cancel').onclick = () => overlay.classList.remove('visible');
    footer.querySelector('.btn-confirm').onclick = () => { onConfirm(); overlay.classList.remove('visible'); };
}

function showCustomSizeModal() {
    showModal('New Project', `
        <label>Project Name</label>
        <input type="text" id="np-name" value="Untitled" placeholder="My Project">
        <div class="row">
            <div><label>Width (px)</label><input type="number" id="np-w" value="1280" min="1" max="8000"></div>
            <div><label>Height (px)</label><input type="number" id="np-h" value="720" min="1" max="8000"></div>
        </div>
    `, () => {
        const name = document.getElementById('np-name').value || 'Untitled';
        const w = +document.getElementById('np-w').value || 1280;
        const h = +document.getElementById('np-h').value || 720;
        createAndOpenProject(name, w, h);
    });
}

function showRenameModal(project) {
    showModal('Rename Project', `
        <label>Project Name</label>
        <input type="text" id="rn-name" value="${escHtml(project.name)}">
    `, async () => {
        project.name = document.getElementById('rn-name').value || project.name;
        await ProjectStore.saveProject(project);
        loadProjects();
    });
    document.querySelector('.modal-footer .btn-confirm').textContent = 'Rename';
}

// ============ STORAGE INFO ============
async function updateStorageInfo() {
    if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        const used = (est.usage / 1024 / 1024).toFixed(1);
        const quota = (est.quota / 1024 / 1024 / 1024).toFixed(1);
        document.getElementById('storage-info').textContent = `${used} MB used`;
    }
}

// ============ HELPERS ============
function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Drop support on home page
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('image/')) importImageAsProject(file);
    }
});

document.addEventListener('DOMContentLoaded', initHome);
