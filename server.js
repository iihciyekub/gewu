#!/usr/bin/env node
/**
 * Simple HTTP Server with JSON/MD/PDF support (new layout only)
 * Layout: json/<view>/*, md/*, pdf/*, DRAFT.md (project root)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const os = require('os');
const { execFileSync } = require('child_process');
const { spawn } = require('child_process');
const { handleBibDownload } = require('./server/api/bib-download');
const { handleGroupByFields } = require('./server/api/groupby-fields');
const { handleJsonQuery } = require('./server/api/json-query');

const PORT = process.env.PORT ? Number(process.env.PORT) : 8000;
const HOST = process.env.HOST || '127.0.0.1';
const ROOT_DIR = path.resolve(__dirname);
const PROMPT_ROOT = path.join(ROOT_DIR, 'src', 'prompts');
const TOOLS_ROOTS = [
    path.join(ROOT_DIR, 'src', 'tools'),
    path.join(ROOT_DIR, 'tools')
];
const CUSTOM_MANIFEST_PATH = path.join(ROOT_DIR, 'manifest.json');
const FILE_ORDER_NAME = '.file_order.json';
let promptManifestCache = null;
const deleteJobs = new Map();
const DELETE_JOB_TTL_MS = 5 * 60 * 1000;
const DELETE_GROUP_SCAN_YIELD = 20;
const ALLOWED_ROOTS = (() => {
    const fsRoot = path.parse(process.cwd()).root || path.sep;
    const envRoots = (process.env.ALLOWED_ROOTS || '')
        .split(/[;,]/)
        .map(s => s.trim())
        .filter(Boolean)
        .map(p => path.resolve(p));
    const defaults = [ROOT_DIR, os.homedir(), fsRoot].filter(Boolean);
    const roots = envRoots.length ? envRoots : defaults;
    return Array.from(new Set(roots));
})();

function normalizeBasePath(basePath = '') {
    const clean = String(basePath || '').trim() || '/';
    if (clean.startsWith('/')) return clean.endsWith('/') ? clean : `${clean}/`;
    return `/${clean.replace(/^[/\\]+/, '')}${clean.endsWith('/') ? '' : '/'}`;
}

function groupsFromManifestJson(data) {
    // 支持新结构：{ src: { prompts: {...}, tools: {...}, ... } }
    const groups = {};
    if (!data || typeof data !== 'object') return groups;
    const src = data.src || data.groups || {};
    // 如果已经是旧的扁平 groups 结构，直接返回
    if (!data.src && data.groups) {
        return data.groups;
    }
    const categories = Object.keys(src || {});
    categories.forEach((category) => {
        const catGroups = src[category] || {};
        Object.entries(catGroups).forEach(([name, info]) => {
            if (!info || !Array.isArray(info.files)) return;
            const key = `${category}:${name}`;
            groups[key] = {
                files: info.files,
                basePath: normalizeBasePath(info.basePath || `/src/${category}/${name}/`),
                category,
                name,
                label: `${category} / ${name}`
            };
        });
    });
    return groups;
}

function resolvePromptDir(group) {
    if (!group) return null;
    const candidates = [group, group.replace(/[_-]/g, '')].filter(Boolean);
    for (const key of candidates) {
        const dir = path.join(PROMPT_ROOT, key);
        if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
            return { dir, key };
        }
    }
    return null;
}

function buildPromptManifest() {
    const groups = {};
    // prompt groups
    if (fs.existsSync(PROMPT_ROOT)) {
        const items = fs.readdirSync(PROMPT_ROOT, { withFileTypes: true });
        items.filter(entry => entry.isDirectory()).forEach((entry) => {
            const dir = path.join(PROMPT_ROOT, entry.name);
            const files = fs.readdirSync(dir)
                .filter(name => name.toLowerCase().endsWith('.md'))
                .sort();
            const key = `prompts:${entry.name}`;
            groups[key] = {
                files,
                basePath: `/src/prompts/${entry.name}/`,
                category: 'prompts',
                name: entry.name,
                label: `prompts / ${entry.name}`
            };
        });
    }
    // tools group (js files)
    for (const root of TOOLS_ROOTS) {
        if (fs.existsSync(root) && fs.statSync(root).isDirectory()) {
            const files = fs.readdirSync(root, { withFileTypes: true })
                .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.js'))
                .map(entry => entry.name)
                .sort();
            if (files.length) {
                const rel = path.relative(ROOT_DIR, root).split(path.sep).join('/');
                const key = 'tools:aide';
                groups[key] = {
                    files,
                    basePath: `/${rel}/`,
                    category: 'tools',
                    name: 'aide',
                    label: 'tools / aide'
                };
            }
            break; // prefer first existing root
        }
    }
    return groups;
}

function ensurePromptManifest() {
    // 优先使用自定义 manifest.json（新结构）
    if (fs.existsSync(CUSTOM_MANIFEST_PATH)) {
        try {
            const raw = fs.readFileSync(CUSTOM_MANIFEST_PATH, 'utf8');
            const parsed = JSON.parse(raw);
            const groups = groupsFromManifestJson(parsed);
            if (Object.keys(groups).length) {
                promptManifestCache = groups;
                return;
            }
        } catch (err) {
            console.error('✗ Failed to read custom manifest.json:', err);
        }
    }

    // fallback 自动扫描
    promptManifestCache = buildPromptManifest();

    // 写出自动生成的 manifest 供前端静态兜底使用
    try {
        const payload = JSON.stringify({ success: true, groups: promptManifestCache }, null, 2);
        fs.writeFileSync(CUSTOM_MANIFEST_PATH, payload, 'utf8');
    } catch (err) {
        console.error('✗ Failed to write prompt manifest:', err);
    }
}

function collectPdfFiles(dir) {
    const result = [];
    if (!fs.existsSync(dir)) return result;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    entries.forEach((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            result.push(...collectPdfFiles(full));
        } else if (entry.isFile() && /\.pdf$/i.test(entry.name)) {
            result.push(full);
        }
    });
    return result;
}

function normalizeGroupList(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) {
        return raw.map((item, idx) => {
            const id = item && (item.id || item.name || `group-${idx + 1}`);
            const name = item && (item.name || id || `分组 ${idx + 1}`);
            const files = Array.isArray(item?.files) ? item.files.map(String) : [];
            const collapsed = typeof item?.collapsed === 'boolean' ? item.collapsed : false;
            return { id: String(id), name: String(name), files, collapsed };
        });
    }
    if (raw && typeof raw === 'object') {
        return Object.entries(raw).map(([key, value]) => {
            const files = Array.isArray(value) ? value.map(String) : [];
            const collapsed = typeof value?.collapsed === 'boolean' ? value.collapsed : false;
            return { id: key, name: key, files, collapsed };
        });
    }
    return [];
}

function formatDate() {
    const d = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function formatDateTime() {
    const d = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function copyFileToSystemClipboard(absPath) {
    try {
        if (process.platform === 'darwin') {
            const script = `set the clipboard to (POSIX file "${absPath.replace(/"/g, '\\"')}")`;
            execFileSync('osascript', ['-e', script], { stdio: 'ignore' });
            return true;
        }
        return false;
    } catch (err) {
        console.error('copyFileToSystemClipboard failed:', err);
        return false;
    }
}

function buildDefaultMarkdown(baseName) {
    return `# ${baseName}\n\n> 自动创建的 Markdown 笔记文件。\n\n- 可添加章节、要点、引用等。\n- 与 JSON 同名，便于版本记录。\n`;
}

function ensureProjectStructure(fullPath) {
    const jsonDir = path.join(fullPath, 'json', 'view1');
    const mdDir = path.join(fullPath, 'md');
    const pdfDir = path.join(fullPath, 'pdf');
    fs.mkdirSync(jsonDir, { recursive: true });
    fs.mkdirSync(mdDir, { recursive: true });
    fs.mkdirSync(pdfDir, { recursive: true });
    return { jsonDir, mdDir, pdfDir };
}

function ensureProjectMarker(fullPath) {
    const projectMarker = path.join(fullPath, '.project');
    if (fs.existsSync(projectMarker)) return false;
    fs.writeFileSync(projectMarker, JSON.stringify({
        name: path.basename(fullPath),
        created: new Date().toISOString(),
        version: '1.0'
    }, null, 2), 'utf8');
    return true;
}

function getJsonTargetPath(fullPath, filename) {
    const safeName = String(filename || '').replace(/^[/\\]+/, '');
    if (!safeName) throw new Error('Missing filename');
    if (safeName.startsWith('json/')) return path.join(fullPath, safeName);
    return path.join(fullPath, 'json', 'view1', safeName);
}

function getMdTargetPath(fullPath, filename) {
    const safeName = String(filename || '').replace(/^[/\\]+/, '');
    if (!safeName) throw new Error('Missing filename');
    const lower = safeName.toLowerCase();
    if (lower === 'draft.md') return path.join(fullPath, safeName);
    if (safeName.startsWith('md/')) return path.join(fullPath, safeName);
    return path.join(fullPath, 'md', safeName);
}

function resolvePdfDeleteTarget(fullPath, filename) {
    const clean = String(filename || '').trim();
    if (!clean) throw new Error('Missing filename');
    const safeName = clean.includes('/') || clean.includes('\\')
        ? path.normalize(clean).replace(/^[/\\]+/, '')
        : clean;
    const candidates = [
        path.join(fullPath, safeName),
        path.join(fullPath, 'pdf', safeName),
        path.join(fullPath, 'papers', safeName)
    ];
    return candidates.find(p => fs.existsSync(p)) || null;
}

function ensurePathInsideProject(fullPath, targetPath) {
    const rel = path.relative(fullPath, targetPath);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
        throw new Error('Invalid path');
    }
}

async function buildDeleteTargetsForBases(fullPath, bases, job) {
    const targets = [];
    const jsonRoot = path.join(fullPath, 'json');
    let viewDirs = [];
    try {
        const entries = await fs.promises.readdir(jsonRoot, { withFileTypes: true });
        viewDirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    } catch (_err) {
        viewDirs = [];
    }

    job.scanTotal = bases.length;
    job.scanProcessed = 0;
    job.targetsFound = 0;
    for (let i = 0; i < bases.length; i += 1) {
        const base = String(bases[i] || '').trim();
        if (!base) {
            job.scanProcessed += 1;
            continue;
        }
        const baseFile = `${base}.json`;
        viewDirs.forEach((dir) => {
            const jsonPath = path.join(jsonRoot, dir, baseFile);
            if (fs.existsSync(jsonPath)) {
                targets.push({ type: 'json', path: path.join('json', dir, baseFile).split(path.sep).join('/') });
            }
        });

        const mdPath = path.join(fullPath, 'md', `${base}.md`);
        if (fs.existsSync(mdPath)) {
            targets.push({ type: 'md', path: path.join('md', `${base}.md`).split(path.sep).join('/') });
        }

        const pdfCandidates = [
            path.join(fullPath, 'pdf', `${base}.pdf`),
            path.join(fullPath, 'papers', `${base}.pdf`),
            path.join(fullPath, `${base}.pdf`)
        ];
        const pdfTarget = pdfCandidates.find(p => fs.existsSync(p));
        if (pdfTarget) {
            const rel = path.relative(fullPath, pdfTarget).split(path.sep).join('/');
            targets.push({ type: 'pdf', path: rel });
        }

        job.targetsFound = targets.length;
        job.scanProcessed += 1;
        if (job.scanProcessed % DELETE_GROUP_SCAN_YIELD === 0) {
            await new Promise(resolve => setImmediate(resolve));
        }
    }
    return targets;
}

// Build manifest once at startup
ensurePromptManifest();

// 路径规范化，返回安全的 projectKey 以及完整路径（限定在 ALLOWED_ROOTS 内）
function normalizeProjectPath(projectPath) {
    const raw = String(projectPath || '').trim();
    if (!raw) {
        throw new Error('Missing projectPath');
    }
    const normalizedInput = raw.replace(/^[/\\]+/, '');
    const candidate = path.isAbsolute(raw)
        ? path.normalize(raw)
        : path.resolve(ROOT_DIR, normalizedInput);

    const allowedRoot = ALLOWED_ROOTS.find((root) => {
        const rel = path.relative(root, candidate);
        return !rel.startsWith('..') && !path.isAbsolute(rel);
    });
    if (!allowedRoot) {
        throw new Error('Invalid project path: outside allowed roots');
    }

    const relToRoot = path.relative(allowedRoot, candidate);
    const projectKey = relToRoot && relToRoot !== '.'
        ? relToRoot.split(path.sep).join('/')
        : (path.basename(candidate) || 'user');
    const fullPath = candidate;
    return { projectKey, fullPath };
}

// MIME类型映射
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.md': 'text/markdown',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.pdf': 'application/pdf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.wasm': 'application/wasm'
};

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.query || {};

    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 处理OPTIONS预检请求
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // 提供环境信息（用于前端路径占位符和默认值）
    if (req.method === 'GET' && pathname === '/env-info') {
        const homeDir = os.homedir();
        const desktopCandidate = path.join(homeDir, 'Desktop');
        const desktopDir = fs.existsSync(desktopCandidate) ? desktopCandidate : '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            homeDir,
            desktopDir,
            rootDir: ROOT_DIR,
            allowedRoots: ALLOWED_ROOTS,
            platform: process.platform
        }));
        return;
    }

    // 创建新项目
    if (req.method === 'POST' && pathname === '/create-project') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const projectPath = (data.projectPath || '').trim();

                if (!projectPath) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: '项目路径不能为空' }));
                    return;
                }

                // 规范化路径
                const { projectKey, fullPath } = normalizeProjectPath(projectPath);

                let created = false;
                let dirsInitialized = false;
                if (fs.existsSync(fullPath)) {
                    if (!fs.statSync(fullPath).isDirectory()) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: '项目路径不是文件夹' }));
                        return;
                    }
                } else {
                    fs.mkdirSync(fullPath, { recursive: true });
                    created = true;
                }

                const hasJson = fs.existsSync(path.join(fullPath, 'json'));
                const hasMd = fs.existsSync(path.join(fullPath, 'md'));
                const hasPdf = fs.existsSync(path.join(fullPath, 'pdf'));
                if (!hasJson || !hasMd || !hasPdf) dirsInitialized = true;

                // 创建项目根目录和三个必须的子目录
                const { jsonDir, mdDir, pdfDir } = ensureProjectStructure(fullPath);

                // 创建一个 .project 标记文件（可选，用于识别项目根目录）
                ensureProjectMarker(fullPath);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    projectKey,
                    projectPath: fullPath,
                    message: (created || dirsInitialized)
                        ? `项目 "${path.basename(fullPath)}" 创建成功`
                        : `项目 "${path.basename(fullPath)}" 已存在`,
                    dirs: {
                        json: path.relative(ROOT_DIR, jsonDir),
                        md: path.relative(ROOT_DIR, mdDir),
                        pdf: path.relative(ROOT_DIR, pdfDir)
                    },
                    created,
                    dirsInitialized
                }));
            } catch (error) {
                console.error('✗ Error creating project:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // 处理项目验证请求
    if (req.method === 'POST' && pathname === '/validate-project') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { projectPath } = data;

                if (!projectPath) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Missing projectPath' }));
                    return;
                }

                const { projectKey, fullPath } = normalizeProjectPath(projectPath);

                let created = false;
                let markerCreated = false;
                let dirsInitialized = false;

                if (!fs.existsSync(fullPath)) {
                    fs.mkdirSync(fullPath, { recursive: true });
                    created = true;
                } else if (!fs.statSync(fullPath).isDirectory()) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        valid: false,
                        message: '项目路径不是文件夹'
                    }));
                    return;
                }

                const hasJson = fs.existsSync(path.join(fullPath, 'json'));
                const hasMd = fs.existsSync(path.join(fullPath, 'md'));
                const hasPdf = fs.existsSync(path.join(fullPath, 'pdf'));
                if (!hasJson || !hasMd || !hasPdf) dirsInitialized = true;

                // 确保必须的目录存在（json/view1、md、pdf）
                const dirs = ensureProjectStructure(fullPath);
                markerCreated = ensureProjectMarker(fullPath);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    valid: true,
                    message: (created || dirsInitialized) ? '已初始化空项目结构' : '项目结构有效',
                    dirs,
                    projectKey,
                    created,
                    markerCreated
                }));

            } catch (error) {
                console.error('✗ Error validating project:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    valid: false,
                    error: error.message
                }));
            }
        });

        return;
    }

    // 处理JSON保存请求
    if (req.method === 'POST' && pathname === '/save-json') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { projectPath, filename, content } = data;

                if (!projectPath) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Missing projectPath' }));
                    return;
                }
                if (!filename || typeof content === 'undefined') {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Missing filename or content' }));
                    return;
                }

                const { projectKey, fullPath } = normalizeProjectPath(projectPath);
                ensureProjectStructure(fullPath);

                const filePath = getJsonTargetPath(fullPath, filename);
                fs.mkdirSync(path.dirname(filePath), { recursive: true });
                fs.writeFileSync(filePath, content, 'utf8');

                console.log(`✓ Saved JSON: ${filePath}`);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: `File ${filename} saved successfully`,
                    path: filePath,
                    projectKey
                }));

            } catch (error) {
                console.error('✗ Error saving file:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: error.message
                }));
            }
        });

        return;
    }

    // Download BibTeX file for DOI list
    if (req.method === 'POST' && pathname === '/bib-download') {
        handleBibDownload(req, res, { formatDate });
        return;
    }

    // Group by fields for JSON view
    if (req.method === 'POST' && pathname === '/groupby-fields') {
        handleGroupByFields(req, res, {
            normalizeProjectPath,
            ensureProjectStructure,
            normalizeGroupList,
            fileOrderName: FILE_ORDER_NAME
        });
        return;
    }

    // Open Codex CLI in terminal at project path
    if (req.method === 'POST' && pathname === '/open-codex-cli') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = body ? JSON.parse(body) : {};
                const { projectPath } = data;
                if (!projectPath) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Missing projectPath' }));
                    return;
                }
                const { fullPath } = normalizeProjectPath(projectPath);
                if (!fs.existsSync(fullPath)) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Project path not found' }));
                    return;
                }

                if (process.platform === 'darwin') {
                    const script = [
                        'tell application "Terminal"',
                        'activate',
                        `do script "cd ${fullPath.replace(/"/g, '\\"')} && codex"`,
                        'end tell'
                    ].join('\n');
                    execFileSync('osascript', ['-e', script], { stdio: 'ignore' });
                } else if (process.platform === 'win32') {
                    spawn('cmd', ['/c', 'start', 'cmd', '/k', `cd /d "${fullPath}" && codex`], { detached: true });
                } else {
                    spawn('bash', ['-lc', `cd "${fullPath.replace(/"/g, '\\"')}" && codex`], { detached: true });
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (error) {
                console.error('✗ open-codex-cli failed:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // Query JSON items by fields
    if (req.method === 'POST' && pathname === '/json-query') {
        handleJsonQuery(req, res, {
            normalizeProjectPath,
            ensureProjectStructure,
            normalizeGroupList,
            fileOrderName: FILE_ORDER_NAME
        });
        return;
    }

    // 处理Markdown保存/创建请求
    if (req.method === 'POST' && pathname === '/save-md') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { projectPath, filename, content = '' } = data;
                if (!projectPath) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Missing projectPath' }));
                    return;
                }
                if (!filename) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Missing filename' }));
                    return;
                }
                const { fullPath } = normalizeProjectPath(projectPath);
                ensureProjectStructure(fullPath);
                const filePath = getMdTargetPath(fullPath, filename);
                fs.mkdirSync(path.dirname(filePath), { recursive: true });
                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`✓ Saved Markdown: ${filePath}`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, path: filePath }));
            } catch (error) {
                console.error('✗ Error saving markdown:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // 处理JSON重命名请求
    if (req.method === 'POST' && pathname === '/rename-json') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { projectPath, oldFilename, newFilename } = data;

                if (!projectPath) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Missing projectPath' }));
                    return;
                }
                if (!oldFilename || !newFilename) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Missing oldFilename or newFilename' }));
                    return;
                }

                const { projectKey, fullPath } = normalizeProjectPath(projectPath);
                ensureProjectStructure(fullPath);
                const resolveTarget = (name) => {
                    const lower = String(name).toLowerCase();
                    return lower.endsWith('.md')
                        ? getMdTargetPath(fullPath, name)
                        : getJsonTargetPath(fullPath, name);
                };
                const oldPath = resolveTarget(oldFilename);
                const newPath = resolveTarget(newFilename);

                // 检查旧文件是否存在
                if (!fs.existsSync(oldPath)) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'File not found' }));
                    return;
                }

                // 检查新文件名是否已存在
                if (fs.existsSync(newPath)) {
                    res.writeHead(409, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'File with new name already exists' }));
                    return;
                }

                // 重命名文件
                fs.renameSync(oldPath, newPath);

                console.log(`✓ Renamed: ${oldFilename} → ${newFilename}`);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: `File renamed successfully`,
                    oldFilename,
                    newFilename,
                    projectKey
                }));

            } catch (error) {
                console.error('✗ Error renaming file:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: error.message
                }));
            }
        });

        return;
    }

    // 处理批量删除请求（后台任务）
    if (req.method === 'POST' && pathname === '/delete-batch') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body || '{}');
                const { projectPath, targets } = data;
                if (!projectPath) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Missing projectPath' }));
                    return;
                }
                if (!Array.isArray(targets) || !targets.length) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Missing targets' }));
                    return;
                }

                const { fullPath } = normalizeProjectPath(projectPath);
                const jobId = `del_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
                const job = {
                    id: jobId,
                    total: targets.length,
                    processed: 0,
                    deleted: 0,
                    failed: 0,
                    done: false,
                    startedAt: Date.now()
                };
                deleteJobs.set(jobId, job);

                res.writeHead(202, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, jobId }));

                const queue = targets.filter(t => t && t.path && t.type);
                job.total = queue.length;
                if (!queue.length) {
                    job.done = true;
                    job.finishedAt = Date.now();
                    return;
                }

                const concurrency = 8;
                let index = 0;
                const worker = async () => {
                    while (index < queue.length) {
                        const item = queue[index++];
                        try {
                            let targetPath = null;
                            if (item.type === 'pdf') {
                                targetPath = resolvePdfDeleteTarget(fullPath, item.path);
                                if (!targetPath) throw new Error('PDF not found');
                            } else if (item.type === 'md') {
                                targetPath = getMdTargetPath(fullPath, item.path);
                            } else if (item.type === 'json') {
                                targetPath = getJsonTargetPath(fullPath, item.path);
                            } else {
                                throw new Error('Unknown type');
                            }
                            ensurePathInsideProject(fullPath, targetPath);
                            if (!fs.existsSync(targetPath)) {
                                job.failed += 1;
                            } else {
                                fs.unlinkSync(targetPath);
                                job.deleted += 1;
                            }
                        } catch (_err) {
                            job.failed += 1;
                        } finally {
                            job.processed += 1;
                        }
                    }
                };

                Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()))
                    .then(() => {
                        job.done = true;
                        job.finishedAt = Date.now();
                        setTimeout(() => deleteJobs.delete(jobId), DELETE_JOB_TTL_MS);
                    })
                    .catch(() => {
                        job.done = true;
                        job.finishedAt = Date.now();
                        setTimeout(() => deleteJobs.delete(jobId), DELETE_JOB_TTL_MS);
                    });
            } catch (error) {
                console.error('✗ Error starting delete batch:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    if (req.method === 'GET' && pathname === '/delete-batch-status') {
        const jobId = String(query.jobId || '').trim();
        if (!jobId || !deleteJobs.has(jobId)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Job not found' }));
            return;
        }
        const job = deleteJobs.get(jobId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, job }));
        return;
    }

    if (req.method === 'POST' && pathname === '/delete-group-start') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body || '{}');
                const { projectPath, bases } = data;
                if (!projectPath) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Missing projectPath' }));
                    return;
                }
                if (!Array.isArray(bases) || !bases.length) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Missing bases' }));
                    return;
                }

                const { fullPath } = normalizeProjectPath(projectPath);
                const jobId = `gdel_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
                const job = {
                    id: jobId,
                    phase: 'scanning',
                    scanTotal: bases.length,
                    scanProcessed: 0,
                    targetsFound: 0,
                    total: 0,
                    processed: 0,
                    deleted: 0,
                    failed: 0,
                    done: false,
                    startedAt: Date.now()
                };
                deleteJobs.set(jobId, job);

                res.writeHead(202, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, jobId }));

                (async () => {
                    try {
                        const targets = await buildDeleteTargetsForBases(fullPath, bases, job);
                        job.phase = 'deleting';
                        job.total = targets.length;
                        job.processed = 0;
                        job.deleted = 0;
                        job.failed = 0;
                        if (!targets.length) {
                            job.done = true;
                            job.finishedAt = Date.now();
                            setTimeout(() => deleteJobs.delete(jobId), DELETE_JOB_TTL_MS);
                            return;
                        }

                        const queue = targets;
                        let index = 0;
                        const concurrency = 8;
                        const worker = async () => {
                            while (index < queue.length) {
                                const item = queue[index++];
                                try {
                                    let targetPath = null;
                                    if (item.type === 'pdf') {
                                        targetPath = resolvePdfDeleteTarget(fullPath, item.path);
                                        if (!targetPath) throw new Error('PDF not found');
                                    } else if (item.type === 'md') {
                                        targetPath = getMdTargetPath(fullPath, item.path);
                                    } else if (item.type === 'json') {
                                        targetPath = getJsonTargetPath(fullPath, item.path);
                                    } else {
                                        throw new Error('Unknown type');
                                    }
                                    ensurePathInsideProject(fullPath, targetPath);
                                    if (!fs.existsSync(targetPath)) {
                                        job.failed += 1;
                                    } else {
                                        fs.unlinkSync(targetPath);
                                        job.deleted += 1;
                                    }
                                } catch (_err) {
                                    job.failed += 1;
                                } finally {
                                    job.processed += 1;
                                }
                            }
                        };

                        await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()));
                        job.done = true;
                        job.finishedAt = Date.now();
                        setTimeout(() => deleteJobs.delete(jobId), DELETE_JOB_TTL_MS);
                    } catch (_err) {
                        job.done = true;
                        job.failed += 1;
                        job.finishedAt = Date.now();
                        setTimeout(() => deleteJobs.delete(jobId), DELETE_JOB_TTL_MS);
                    }
                })();
            } catch (error) {
                console.error('✗ Error starting group delete:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    if (req.method === 'GET' && pathname === '/delete-group-status') {
        const jobId = String(query.jobId || '').trim();
        if (!jobId || !deleteJobs.has(jobId)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Job not found' }));
            return;
        }
        const job = deleteJobs.get(jobId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, job }));
        return;
    }

    // 处理JSON删除请求
    if (req.method === 'POST' && pathname === '/delete-json') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { projectPath, filename } = data;

                if (!projectPath) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Missing projectPath' }));
                    return;
                }
                if (!filename) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Missing filename' }));
                    return;
                }

                const { projectKey, fullPath } = normalizeProjectPath(projectPath);
                ensureProjectStructure(fullPath);
                const lower = filename.toLowerCase();
                const filePath = lower.endsWith('.md')
                    ? getMdTargetPath(fullPath, filename)
                    : getJsonTargetPath(fullPath, filename);

                // 检查文件是否存在
                if (!fs.existsSync(filePath)) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'File not found' }));
                    return;
                }

                // 删除文件
                fs.unlinkSync(filePath);

                console.log(`✓ Deleted: ${filename}`);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: `File deleted successfully`,
                    filename,
                    projectKey
                }));

            } catch (error) {
                console.error('✗ Error deleting file:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: error.message
                }));
            }
        });

        return;
    }

    // 处理读取文件请求（支持任意项目路径）
    if (req.method === 'POST' && pathname === '/read-file') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { projectPath, filePath: relativeFilePath } = data;

                if (!projectPath) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Missing projectPath' }));
                    return;
                }


                const { projectKey, fullPath } = normalizeProjectPath(projectPath);
                const targetFile = path.join(fullPath, relativeFilePath);

                // 安全检查：确保目标文件在项目目录内
                const relativePath = path.relative(fullPath, targetFile);
                if (relativePath.startsWith('..')) {
                    throw new Error('访问被拒绝：文件必须在项目目录内');
                }

                console.log('📍 读取文件:', targetFile);

                if (!fs.existsSync(targetFile)) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        error: '文件不存在'
                    }));
                    return;
                }

                const content = fs.readFileSync(targetFile, 'utf-8');
                const ext = path.extname(targetFile).toLowerCase();

                // 如果是 JSON 文件，解析并返回
                if (ext === '.json') {
                    try {
                        const jsonData = JSON.parse(content);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(jsonData));
                    } catch (parseError) {
                        res.writeHead(200, { 'Content-Type': 'text/plain' });
                        res.end(content);
                    }
                } else {
                    // 其他文件类型，返回纯文本
                    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
                    res.end(content);
                }


            } catch (error) {
                console.error('✗ 读取文件错误:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: error.message
                }));
            }
        });

        return;
    }

    if (req.method === 'POST' && pathname === '/file-exists') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const data = JSON.parse(body || '{}');
                const { projectPath, filePath: relativeFilePath } = data;
                if (!projectPath) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Missing projectPath' }));
                    return;
                }
                if (!relativeFilePath) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Missing filePath' }));
                    return;
                }

                const { fullPath } = normalizeProjectPath(projectPath);
                const targetFile = path.join(fullPath, relativeFilePath);
                const relativePath = path.relative(fullPath, targetFile);
                if (relativePath.startsWith('..')) {
                    throw new Error('访问被拒绝：文件必须在项目目录内');
                }
                const exists = fs.existsSync(targetFile);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, exists }));
            } catch (error) {
                console.error('✗ Error checking file exists:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // 处理 ensure-dir 请求（确保目录存在）
    if (req.method === 'POST' && pathname === '/ensure-dir') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { path: dirPath } = data;

                if (!dirPath) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Missing path' }));
                    return;
                }

                // 解析路径
                const absolutePath = path.isAbsolute(dirPath) ? dirPath : path.resolve(ROOT_DIR, dirPath);

                // 创建目录
                fs.mkdirSync(absolutePath, { recursive: true });

                console.log(`✓ Ensured directory: ${absolutePath}`);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    path: absolutePath
                }));

            } catch (error) {
                console.error('✗ Error ensuring directory:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: error.message
                }));
            }
        });

        return;
    }

    // 处理 read-json 请求（读取 JSON 文件）
    if (req.method === 'GET' && pathname === '/read-json') {
        try {
            const parsedUrl = url.parse(req.url, true);
            const filePath = parsedUrl.query.file;

            if (!filePath) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing file parameter' }));
                return;
            }

            const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(ROOT_DIR, filePath);

            if (!fs.existsSync(absolutePath)) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'File not found' }));
                return;
            }

            const content = fs.readFileSync(absolutePath, 'utf-8');
            const data = JSON.parse(content);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));

        } catch (error) {
            console.error('✗ Error reading JSON:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }

        return;
    }

    // 处理 save-json API（保存 JSON 到指定路径）
    if (req.method === 'POST' && pathname === '/save-json-api') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const payload = JSON.parse(body);
                const { file: filePath, data: jsonData } = payload;

                if (!filePath || typeof jsonData === 'undefined') {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Missing file or data' }));
                    return;
                }

                const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(ROOT_DIR, filePath);

                // 确保目录存在
                fs.mkdirSync(path.dirname(absolutePath), { recursive: true });

                // 写入文件
                const content = JSON.stringify(jsonData, null, 2);
                fs.writeFileSync(absolutePath, content, 'utf-8');

                console.log(`✓ Saved JSON to: ${absolutePath}`);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    path: absolutePath
                }));

            } catch (error) {
                console.error('✗ Error saving JSON:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: error.message
                }));
            }
        });

        return;
    }

    // 处理 delete-file 请求（删除文件）
    if (req.method === 'POST' && pathname === '/delete-file') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { file: filePath } = data;

                if (!filePath) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Missing file' }));
                    return;
                }

                const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(ROOT_DIR, filePath);

                if (!fs.existsSync(absolutePath)) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'File not found' }));
                    return;
                }

                fs.unlinkSync(absolutePath);

                console.log(`✓ Deleted file: ${absolutePath}`);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    path: absolutePath
                }));

            } catch (error) {
                console.error('✗ Error deleting file:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: error.message
                }));
            }
        });

        return;
    }

    // 处理获取PDF文件请求（支持任意项目路径）
    if ((req.method === 'GET' || req.method === 'HEAD') && pathname === '/get-pdf') {
        try {
            const query = new URL(req.url, `http://${req.headers.host}`).searchParams;
            const projectPath = query.get('projectPath');
            const pdfFile = query.get('file') || '';
            if (!projectPath) {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('Missing projectPath');
                return;
            }

            console.log('📄 PDF请求:', { projectPath, pdfFile });

            const { projectKey, fullPath } = normalizeProjectPath(projectPath);

            // 构建PDF文件路径
            let targetFile;
            if (pdfFile.includes('/') || pdfFile.includes('\\')) {
                // 包含路径分隔符，视为相对路径
                targetFile = path.join(fullPath, pdfFile);
            } else {
                // 纯文件名，在pdf目录中查找
                targetFile = path.join(fullPath, 'pdf', pdfFile);
            }

            // 安全检查：确保目标文件在项目目录内
            const relativePath = path.relative(fullPath, targetFile);
            if (relativePath.startsWith('..')) {
                throw new Error('访问被拒绝：文件必须在项目目录内');
            }

            console.log('📍 读取PDF:', targetFile);

            if (!fs.existsSync(targetFile)) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('PDF file not found');
                return;
            }

            const stat = fs.statSync(targetFile);
            const fileSize = stat.size;
            const range = req.headers.range;
            const mtime = stat.mtime.toUTCString();
            const etag = `"${stat.size}-${stat.mtimeMs}"`;

            const ifNoneMatch = req.headers['if-none-match'];
            const ifModifiedSince = req.headers['if-modified-since'];
            if (!range && ((ifNoneMatch && ifNoneMatch === etag) || (ifModifiedSince && ifModifiedSince === mtime))) {
                res.writeHead(304, {
                    'ETag': etag,
                    'Last-Modified': mtime,
                    'Accept-Ranges': 'bytes'
                });
                res.end();
                return;
            }

            if (req.method === 'HEAD') {
                res.writeHead(200, {
                    'Content-Type': 'application/pdf',
                    'Content-Length': fileSize,
                    'Accept-Ranges': 'bytes',
                    'ETag': etag,
                    'Last-Modified': mtime,
                    'Cache-Control': 'public, max-age=0'
                });
                res.end();
                return;
            }

            if (range) {
                const match = /bytes=(\d*)-(\d*)/.exec(range);
                if (!match) {
                    res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` });
                    res.end();
                    return;
                }
                let start = match[1] ? parseInt(match[1], 10) : 0;
                let end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
                if (Number.isNaN(start)) start = 0;
                if (Number.isNaN(end)) end = fileSize - 1;
                if (start > end || start >= fileSize) {
                    res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` });
                    res.end();
                    return;
                }
                end = Math.min(end, fileSize - 1);
                const chunkSize = end - start + 1;
                res.writeHead(206, {
                    'Content-Type': 'application/pdf',
                    'Content-Length': chunkSize,
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'ETag': etag,
                    'Last-Modified': mtime,
                    'Cache-Control': 'public, max-age=0'
                });
                fs.createReadStream(targetFile, { start, end }).pipe(res);
                return;
            }

            res.writeHead(200, {
                'Content-Type': 'application/pdf',
                'Content-Length': fileSize,
                'Accept-Ranges': 'bytes',
                'ETag': etag,
                'Last-Modified': mtime,
                'Cache-Control': 'public, max-age=0'
            });
            fs.createReadStream(targetFile).pipe(res);

            console.log('✅ PDF读取成功');

        } catch (error) {
            console.error('✗ 读取PDF错误:', error);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end(`Error: ${error.message}`);
        }

        return;
    }

    // 获取PDF文件所在目录
    if (req.method === 'POST' && pathname === '/get-pdf-dir') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const { projectPath, file } = JSON.parse(body);

                console.log('📁 获取PDF目录:', { projectPath, file });

                const { projectKey, fullPath } = normalizeProjectPath(projectPath);

                // 构建PDF文件路径
                let targetFile;
                if (file.includes('/') || file.includes('\\')) {
                    targetFile = path.join(fullPath, file);
                } else {
                    targetFile = path.join(fullPath, 'pdf', file);
                }

                // 安全检查
                const relativePath = path.relative(fullPath, targetFile);
                if (relativePath.startsWith('..')) {
                    throw new Error('访问被拒绝：文件必须在项目目录内');
                }

                // 获取文件所在目录
                const directory = path.dirname(targetFile);

                console.log('✅ PDF目录:', directory);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ directory }));

            } catch (error) {
                console.error('✗ 获取PDF目录错误:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });

        return;
    }

    // 直接保存PDF到项目pdf目录
    if (req.method === 'POST' && pathname === '/save-pdf-to-project') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const { projectPath, filename, data } = JSON.parse(body);

                console.log('💾 保存PDF到项目pdf目录:', { projectPath, filename });

                const { projectKey, fullPath } = normalizeProjectPath(projectPath);

                // 始终保存到项目的pdf目录
                const targetDir = path.join(fullPath, 'pdf');

                // 完整的保存路径
                const savePath = path.join(targetDir, filename);

                // 安全检查
                const relativePath = path.relative(fullPath, savePath);
                if (relativePath.startsWith('..')) {
                    throw new Error('访问被拒绝：文件必须在项目目录内');
                }

                // 确保pdf目录存在
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                    console.log('📁 创建pdf目录:', targetDir);
                }

                // 将Base64解码并写入文件
                const buffer = Buffer.from(data, 'base64');
                fs.writeFileSync(savePath, buffer);

                console.log('✅ PDF已保存到项目pdf目录:', savePath);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, path: savePath }));

            } catch (error) {
                console.error('✗ 保存PDF错误:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });

        return;
    }

    // 上传 PDF 文件到项目 pdf 目录（防覆盖）
    if (req.method === 'POST' && pathname === '/upload-pdf') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body || '{}');
                const projectPath = data.projectPath;
                const filename = String(data.filename || '').trim();
                const base64 = String(data.content || '').trim();

                if (!projectPath) {
                    throw new Error('Missing projectPath');
                }
                if (!filename.toLowerCase().endsWith('.pdf')) {
                    throw new Error('仅支持 PDF 文件');
                }
                if (!base64) {
                    throw new Error('缺少文件内容');
                }

                const { fullPath } = normalizeProjectPath(projectPath);
                const safeName = path.basename(filename);
                const pdfDir = path.join(fullPath, 'pdf');
                const target = path.join(pdfDir, safeName);

                if (!fs.existsSync(pdfDir)) {
                    fs.mkdirSync(pdfDir, { recursive: true });
                }

                if (fs.existsSync(target)) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, skipped: true, message: 'PDF already exists' }));
                    return;
                }

                const buffer = Buffer.from(base64, 'base64');
                fs.writeFileSync(target, buffer);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, skipped: false, path: path.relative(fullPath, target).split(path.sep).join('/') }));
            } catch (error) {
                console.error('✗ 上传PDF错误:', error);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // 删除项目 pdf 目录下的 PDF 文件
    if (req.method === 'POST' && pathname === '/delete-pdf') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body || '{}');
                const projectPath = data.projectPath;
                const filename = String(data.filename || '').trim();
                if (!projectPath) {
                    throw new Error('Missing projectPath');
                }
                if (!filename.toLowerCase().endsWith('.pdf')) {
                    throw new Error('仅支持删除 PDF 文件');
                }

                const { fullPath } = normalizeProjectPath(projectPath);
                const safeName = filename.includes('/') || filename.includes('\\')
                    ? path.normalize(filename).replace(/^[/\\]+/, '')
                    : filename;

                const candidates = [
                    path.join(fullPath, safeName),
                    path.join(fullPath, 'pdf', safeName),
                    path.join(fullPath, 'papers', safeName)
                ];

                const target = candidates.find(p => fs.existsSync(p));

                if (!target) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'PDF not found' }));
                    return;
                }

                // 安全检查，确保仍在项目内
                const rel = path.relative(fullPath, target);
                if (rel.startsWith('..') || path.isAbsolute(rel)) {
                    throw new Error('非法路径');
                }

                fs.unlinkSync(target);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (error) {
                console.error('✗ 删除PDF错误:', error);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // 处理复制PDF文件到剪贴板请求
    if (req.method === 'POST' && pathname === '/copy-pdf-to-clipboard') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { projectPath, pdfFile } = data;

                if (!projectPath) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Missing projectPath' }));
                    return;
                }
                if (!pdfFile) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'PDF file name is required' }));
                    return;
                }

                console.log('📋 复制PDF到剪贴板:', { projectPath, pdfFile });

                const { projectKey, fullPath } = normalizeProjectPath(projectPath);

                // 构建PDF文件路径
                let targetFile;
                if (pdfFile.includes('/') || pdfFile.includes('\\')) {
                    // 包含路径分隔符，视为相对路径
                    targetFile = path.join(fullPath, pdfFile);
                } else {
                    // 纯文件名，在pdf目录中查找
                    targetFile = path.join(fullPath, 'pdf', pdfFile);
                }

                // 安全检查：确保目标文件在项目目录内
                const relativePath = path.relative(fullPath, targetFile);
                if (relativePath.startsWith('..')) {
                    throw new Error('访问被拒绝：文件必须在项目目录内');
                }

                console.log('📍 复制文件:', targetFile);

                if (!fs.existsSync(targetFile)) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: '文件不存在' }));
                    return;
                }

                // 根据操作系统选择合适的命令
                const platform = os.platform();
                const absolutePath = path.resolve(targetFile);

                try {
                    if (platform === 'darwin') {
                        // macOS: 使用 osascript 通过 Finder 将文件复制到剪贴板
                        // 这是复制文件（而非内容）的正确方法
                        const escapedPath = absolutePath.replace(/"/g, '\\"');
                        const script = `
                        tell application "Finder"
                            set the clipboard to (POSIX file "${escapedPath}") as «class furl»
                        end tell
                        `;
                        execFileSync('osascript', ['-e', script], {
                            encoding: 'utf8',
                            stdio: 'pipe',
                            timeout: 5000
                        });
                    } else if (platform === 'win32') {
                        // Windows: 使用 PowerShell 和 Set-Clipboard 复制文件路径
                        const escapedPath = absolutePath.replace(/"/g, '""');
                        const psCmd = `
                        Add-Type -Assembly System.Windows.Forms
                        [System.Windows.Forms.Clipboard]::SetFileDropList([System.Collections.Specialized.StringCollection]@('${escapedPath}'))
                        `;
                        execFileSync('powershell.exe', ['-Command', psCmd], {
                            encoding: 'utf8',
                            stdio: 'pipe',
                            timeout: 5000
                        });
                    } else if (platform === 'linux') {
                        // Linux: 使用 xclip 复制文件 URI
                        const fileUri = `file://${absolutePath}`;
                        execFileSync('xclip', ['-selection', 'clipboard', '-t', 'text/uri-list'], {
                            input: fileUri,
                            encoding: 'utf8',
                            stdio: ['pipe', 'pipe', 'pipe'],
                            timeout: 5000
                        });
                    } else {
                        throw new Error(`不支持的操作系统: ${platform}`);
                    }

                    console.log('✅ 文件已复制到剪贴板:', absolutePath);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: '文件已复制到剪贴板' }));
                } catch (execError) {
                    console.error('执行复制命令失败:', execError.message, execError);
                    throw new Error(`复制失败: ${execError.message}`);
                }

            } catch (error) {
                console.error('✗ 复制PDF到剪贴板错误:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: error.message
                }));
            }
        });

        return;
    }

    // 处理获取文件列表请求（仅新结构 json/<view>/ + md/）
    if (req.method === 'POST' && pathname === '/list-json-files') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { projectPath } = data;

                if (!projectPath) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Missing projectPath' }));
                    return;
                }

                const { projectKey, fullPath } = normalizeProjectPath(projectPath);
                console.log(`\n📥 /list-json-files 请求 - 项目路径: ${projectPath}`);
                console.log(`   ➜ fullPath: ${fullPath}`);
                console.log(`   ➜ projectKey: ${projectKey}`);
                ensureProjectStructure(fullPath);

                const files = [];

                const collectFiles = (dir, kind, category) => {
                    if (!fs.existsSync(dir)) return [];
                    const entries = fs.readdirSync(dir, { withFileTypes: true });
                    return entries
                        .filter(ent => ent.isFile() && ((kind === 'json' && ent.name.toLowerCase().endsWith('.json')) || (kind === 'md' && ent.name.toLowerCase().endsWith('.md'))))
                        .map(ent => ({
                            name: ent.name,
                            path: path.relative(fullPath, path.join(dir, ent.name)).split(path.sep).join('/'),
                            kind,
                            category
                        }));
                };

                // 新结构：json/viewX
                const jsonRoot = path.join(fullPath, 'json');
                if (fs.existsSync(jsonRoot)) {
                    const entries = fs.readdirSync(jsonRoot, { withFileTypes: true });
                    // 直接在 json/ 目录下的 .json 文件
                    files.push(...collectFiles(jsonRoot, 'json', 'json'));
                    const subDirs = entries.filter(ent => ent.isDirectory());
                    subDirs.forEach(viewDir => {
                        const viewName = viewDir.name;
                        const viewPath = path.join(jsonRoot, viewName);
                        files.push(...collectFiles(viewPath, 'json', `json.${viewName}`));
                    });
                }

                // md/
                files.push(...collectFiles(path.join(fullPath, 'md'), 'md', 'md'));
                // root DRAFT.md (special)
                const draftPath = path.join(fullPath, 'DRAFT.md');
                if (fs.existsSync(draftPath)) {
                    files.push({
                        name: 'DRAFT.md',
                        path: 'DRAFT.md',
                        kind: 'md',
                        category: 'md'
                    });
                }

                // pdf/ - 添加 PDF 文件列表
                const pdfDir = path.join(fullPath, 'pdf');
                console.log(`   📂 PDF目录路径: ${pdfDir}`);
                if (fs.existsSync(pdfDir)) {
                    console.log(`   ✓ PDF目录存在`);
                    const pdfEntries = fs.readdirSync(pdfDir, { withFileTypes: true });
                    const pdfFiles = pdfEntries.filter(ent => ent.isFile() && /\.pdf$/i.test(ent.name));
                    console.log(`   ✓ 找到 ${pdfFiles.length} 个PDF文件`);
                    pdfFiles.forEach(ent => {
                        const pdfPath = path.relative(fullPath, path.join(pdfDir, ent.name)).split(path.sep).join('/');
                        console.log(`      - ${ent.name}`);
                        files.push({
                            name: ent.name,
                            path: pdfPath,
                            kind: 'pdf',
                            category: 'pdf'
                        });
                    });
                } else {
                    console.log(`   ✗ PDF目录不存在`);
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    files: files.sort((a, b) => a.path.localeCompare(b.path)),
                    projectKey
                }));

            } catch (error) {
                console.error('✗ Error listing files:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: error.message
                }));
            }
        });

        return;
    }

    // 处理 prompt / tools 文件列表请求（从 manifest 或自动扫描）
    if (req.method === 'GET' && pathname === '/prompt-files') {
        try {
            ensurePromptManifest();
            const groups = promptManifestCache || {};

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, groups }));
        } catch (error) {
            console.error('✗ Error reading prompts:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: error.message
            }));
        }
        return;
    }

    // 处理 prompt / tools 单文件读取请求
    if (req.method === 'GET' && pathname === '/prompt-file') {
        try {
            ensurePromptManifest();
            const query = parsedUrl.query || {};
            const group = query.group;
            const file = query.file;

            if (!group) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Invalid group' }));
                return;
            }
            if (!file) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Missing file' }));
                return;
            }

            const groupInfo = (promptManifestCache && promptManifestCache[group]) ? promptManifestCache[group] : null;
            if (!groupInfo) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Group not found' }));
                return;
            }

            const basePath = groupInfo.basePath || `/src/prompts/${group}/`;
            const safeDir = path.normalize(basePath).replace(/^[/\\]+/, '');
            const dir = path.resolve(ROOT_DIR, safeDir);
            const safeName = path.basename(file);
            const fullPath = path.join(dir, safeName);
            const resolvedDir = path.resolve(dir);
            const resolvedFile = path.resolve(fullPath);
            if (!resolvedFile.startsWith(resolvedDir)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Invalid path' }));
                return;
            }
            if (!fs.existsSync(resolvedFile)) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'File not found' }));
                return;
            }
            const content = fs.readFileSync(resolvedFile, 'utf8');
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(content);
        } catch (error) {
            console.error('✗ Error reading prompt file:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message }));
        }
        return;
    }

    // 列出项目目录下的文件（支持目录过滤）
    if (req.method === 'POST' && pathname === '/list-files') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = body ? JSON.parse(body) : {};
                const projectPath = data.projectPath;
                const subDir = data.subDir || ''; // 可选：指定子目录如 'md'
                if (!projectPath) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Missing projectPath' }));
                    return;
                }
                const { fullPath } = normalizeProjectPath(projectPath);

                const targetDir = subDir ? path.join(fullPath, subDir) : fullPath;

                if (!fs.existsSync(targetDir)) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Directory not found' }));
                    return;
                }

                const entries = fs.readdirSync(targetDir, { withFileTypes: true });
                const files = entries
                    .filter(entry => entry.isFile())
                    .map(entry => entry.name);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, files }));
            } catch (error) {
                console.error('✗ Error listing files:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // 读取/保存文件排序
    if (req.method === 'POST' && pathname === '/file-order') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = body ? JSON.parse(body) : {};
                const projectPath = data.projectPath;
                const action = data.action || 'get';
                const order = Array.isArray(data.order) ? data.order : [];
                const groups = normalizeGroupList(data.groups);
                if (!projectPath) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Missing projectPath' }));
                    return;
                }
                const { fullPath } = normalizeProjectPath(projectPath);
                ensureProjectStructure(fullPath);
                const orderFile = path.join(fullPath, FILE_ORDER_NAME);

                if (action === 'set') {
                    const payload = { order };
                    if (groups.length) payload.groups = groups;
                    fs.writeFileSync(orderFile, JSON.stringify(payload, null, 2), 'utf8');
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                    return;
                }

                // 默认 get
                let stored = [];
                if (fs.existsSync(orderFile)) {
                    try {
                        const content = fs.readFileSync(orderFile, 'utf8');
                        const parsed = JSON.parse(content);
                        if (Array.isArray(parsed.order)) stored = parsed.order;
                        if (parsed.groups) {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true, order: stored, groups: normalizeGroupList(parsed.groups) }));
                            return;
                        }
                    } catch (err) {
                        console.warn('Read order file failed:', err);
                    }
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, order: stored }));
            } catch (err) {
                console.error('✗ Error handling file-order:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
        });
        return;
    }

    // 列出 tools 目录下的脚本（仅 .js）
    if (req.method === 'GET' && pathname === '/tools-list') {
        try {
            let toolsDir = '';
            let files = [];
            for (const root of TOOLS_ROOTS) {
                if (fs.existsSync(root) && fs.statSync(root).isDirectory()) {
                    toolsDir = root;
                    files = fs.readdirSync(root, { withFileTypes: true })
                        .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.js'))
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(entry => {
                            const rel = path.relative(ROOT_DIR, path.join(root, entry.name)).split(path.sep).join('/');
                            return {
                                name: entry.name,
                                path: `/${rel}`
                            };
                        });
                    break;
                }
            }
            const exists = !!toolsDir;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, exists, files }));
        } catch (error) {
            console.error('✗ Error listing tools scripts:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message }));
        }
        return;
    }

    // 处理静态文件请求（解码URL，支持空格等字符）
    let safePathname = pathname;
    try {
        safePathname = decodeURIComponent(pathname);
    } catch (_e) {
        safePathname = pathname;
    }
    let filePath = '.' + safePathname;
    if (filePath === './') {
        filePath = './index.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // 文件不存在
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - File Not Found</h1>', 'utf-8');
            } else {
                // 服务器错误
                res.writeHead(500);
                res.end(`Server Error: ${error.code}`, 'utf-8');
            }
        } else {
            // 成功返回文件
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`✗ Port ${PORT} is already in use. Set PORT env or stop the other server.`);
    } else {
        console.error('✗ Server error:', err);
    }
    process.exit(1);
});

server.listen(PORT, HOST, () => {
    const hostLabel = HOST === '0.0.0.0' ? 'localhost' : HOST;
    console.log('🚀 Server running at http://' + hostLabel + ':' + PORT + '/');
    console.log('📁 Serving files from: ' + __dirname);
    console.log('💾 Project operations:');
    console.log('   - POST /create-project (create new project with json/md/pdf dirs)');
    console.log('   - POST /validate-project (validate project structure)');
    console.log('💾 JSON operations supported:');
    console.log('   - POST /list-json-files (list all JSON files)');
    console.log('   - POST /save-json (create/update)');
    console.log('   - POST /rename-json (rename)');
    console.log('   - POST /delete-json (delete)');
    console.log('   - POST /delete-batch (delete)');
    console.log('   - GET  /delete-batch-status (delete)');
    console.log('   - POST /delete-group-start (delete)');
    console.log('   - GET  /delete-group-status (delete)');
    console.log('   - POST /file-exists');
    console.log('   - POST /bib-download (download BibTeX by DOI list)');
    console.log('   - POST /groupby-fields (aggregate field values by view)');
    console.log('   - POST /json-query (query JSON items by fields)');
    console.log('   - POST /open-codex-cli (open Codex CLI at project path)');
    console.log('Press Ctrl+C to stop\n');
});
