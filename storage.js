// ekian.dev — Project Storage (IndexedDB)
'use strict';

const ProjectStore = {
    dbName: 'ekian-projects',
    dbVersion: 1,
    db: null,

    async init() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.dbName, this.dbVersion);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('projects')) {
                    const store = db.createObjectStore('projects', { keyPath: 'id' });
                    store.createIndex('updatedAt', 'updatedAt', { unique: false });
                }
            };
            req.onsuccess = (e) => { this.db = e.target.result; resolve(); };
            req.onerror = (e) => reject(e.target.error);
        });
    },

    async saveProject(project) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('projects', 'readwrite');
            const store = tx.objectStore('projects');
            project.updatedAt = Date.now();
            store.put(project);
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    },

    async getProject(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('projects', 'readonly');
            const store = tx.objectStore('projects');
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    },

    async getAllProjects() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('projects', 'readonly');
            const store = tx.objectStore('projects');
            const req = store.getAll();
            req.onsuccess = () => {
                const projects = req.result || [];
                projects.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
                resolve(projects);
            };
            req.onerror = (e) => reject(e.target.error);
        });
    },

    async deleteProject(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('projects', 'readwrite');
            const store = tx.objectStore('projects');
            store.delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    },

    async duplicateProject(id) {
        const project = await this.getProject(id);
        if (!project) return;
        const newProject = { ...project, id: generateId(), name: project.name + ' (copy)', createdAt: Date.now(), updatedAt: Date.now() };
        await this.saveProject(newProject);
        return newProject;
    },

    generateThumbnail(canvas, maxSize = 300) {
        const scale = Math.min(maxSize / canvas.width, maxSize / canvas.height, 1);
        const tmp = document.createElement('canvas');
        tmp.width = canvas.width * scale;
        tmp.height = canvas.height * scale;
        tmp.getContext('2d').drawImage(canvas, 0, 0, tmp.width, tmp.height);
        return tmp.toDataURL('image/jpeg', 0.7);
    }
};

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function formatDate(ts) {
    if (!ts) return 'Unknown';
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return diffMin + 'm ago';
    if (diffHr < 24) return diffHr + 'h ago';
    if (diffDay < 7) return diffDay + 'd ago';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function formatSize(w, h) {
    return w + ' × ' + h;
}
