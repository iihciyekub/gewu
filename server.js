#!/usr/bin/env node
/**
 * Simple HTTP Server with JSON save support
 * 支持直接保存JSON文件到 user/data/ 目录
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT ? Number(process.env.PORT) : 8000;
const ROOT_DIR = path.resolve(__dirname);
const PROMPT_ROOT = path.join(ROOT_DIR, 'src', 'prompts');
const TOOLS_ROOTS = [
    path.join(ROOT_DIR, 'src', 'tools'),
    path.join(ROOT_DIR, 'tools')
];
const CUSTOM_MANIFEST_PATH = path.join(ROOT_DIR, 'manifest.json');
const FILE_ORDER_NAME = '.file_order.json';
let promptManifestCache = null;

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

function buildDefaultMarkdown(baseName) {
    return `# ${baseName}\n\n> 自动创建的 Markdown 笔记文件。\n\n- 可添加章节、要点、引用等。\n- 与 JSON 同名，便于版本记录。\n`;
}

function resolveProjectDirs(projectPath) {
    const { fullPath } = normalizeProjectPath(projectPath);
    const baseName = path.basename(fullPath);
    const projectRoot = (baseName === 'data' || baseName === 'papers')
        ? path.dirname(fullPath)
        : fullPath;
    return {
        projectRoot,
        dataDir: path.join(projectRoot, 'data'),
        papersDir: path.join(projectRoot, 'papers')
    };
}

// Build manifest once at startup
ensurePromptManifest();

// 路径规范化，返回安全的 projectKey 以及完整路径
function normalizeProjectPath(projectPath = 'user') {
    const raw = (projectPath || 'user').trim() || 'user';
    const normalizedInput = raw.replace(/^[/\\]+/, '');
    const candidate = path.isAbsolute(raw)
        ? path.normalize(raw)
        : path.resolve(ROOT_DIR, normalizedInput);

    const relative = path.relative(ROOT_DIR, candidate);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error('Invalid project path');
    }

    // 如果选择了项目根，默认使用 user 目录
    const projectKey = !relative || relative === '.' ? 'user' : relative;
    const fullPath = projectKey === 'user' ? path.join(ROOT_DIR, 'user') : candidate;
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
                
                // 验证项目结构并规范路径
                const { projectKey, fullPath } = normalizeProjectPath(projectPath);
                const dataDir = path.join(fullPath, 'data');
                const papersDir = path.join(fullPath, 'papers');
                
                if (!fs.existsSync(fullPath)) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        valid: false, 
                        message: '项目路径不存在' 
                    }));
                    return;
                }
                
                // 检查是否有data和papers文件夹（如果不存在则创建）
                if (!fs.existsSync(dataDir)) {
                    fs.mkdirSync(dataDir, { recursive: true });
                }
                if (!fs.existsSync(papersDir)) {
                    fs.mkdirSync(papersDir, { recursive: true });
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    valid: true,
                    message: '项目结构有效',
                    dataDir: dataDir,
                    papersDir: papersDir,
                    projectKey
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
                const { projectPath = 'user', filename, content } = data;
                
                if (!filename || !content) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Missing filename or content' }));
                    return;
                }
                
                const { projectKey, fullPath } = normalizeProjectPath(projectPath);
                // 保存到指定项目的 data/ 目录
                const filePath = path.join(fullPath, 'data', filename);
                
                // 确保目录存在
                const dir = path.dirname(filePath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                
                // 写入文件
                fs.writeFileSync(filePath, content, 'utf8');
                
                console.log(`✓ Saved: ${filePath}`);
                
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

    // 处理Markdown保存/创建请求
    if (req.method === 'POST' && pathname === '/save-md') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { projectPath = 'user', filename, content = '' } = data;
                if (!filename) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Missing filename' }));
                    return;
                }
                const { fullPath } = normalizeProjectPath(projectPath);
                const filePath = path.join(fullPath, 'data', filename);
                const dir = path.dirname(filePath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
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
                const { projectPath = 'user', oldFilename, newFilename } = data;
                
                if (!oldFilename || !newFilename) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Missing oldFilename or newFilename' }));
                    return;
                }
                
                const { projectKey, fullPath } = normalizeProjectPath(projectPath);
                // 构建文件路径
                const oldPath = path.join(fullPath, 'data', oldFilename);
                const newPath = path.join(fullPath, 'data', newFilename);
                
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

    // 处理JSON删除请求
    if (req.method === 'POST' && pathname === '/delete-json') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { projectPath = 'user', filename } = data;
                
                if (!filename) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Missing filename' }));
                    return;
                }
                
                const { projectKey, fullPath } = normalizeProjectPath(projectPath);
                // 构建文件路径
                const filePath = path.join(fullPath, 'data', filename);
                
                // 检查文件是否存在
                if (!fs.existsSync(filePath)) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'File not found' }));
                    return;
                }
                
                // 删除文件
                fs.unlinkSync(filePath);

                // 若是 .json，同步删除同名 .md（忽略不存在的情况）
                let mdDeleted = false;
                if (filename.toLowerCase().endsWith('.json')) {
                    const mdPath = path.join(fullPath, 'data', filename.replace(/\.json$/i, '.md'));
                    if (fs.existsSync(mdPath)) {
                        try {
                            fs.unlinkSync(mdPath);
                            mdDeleted = true;
                        } catch (err) {
                            console.warn('Delete markdown failed:', mdPath, err);
                        }
                    }
                }

                console.log(`✓ Deleted: ${filename}${mdDeleted ? ' (+md)' : ''}`);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: `File deleted successfully`,
                    filename,
                    mdDeleted,
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

    // 处理获取文件列表请求
    if (req.method === 'POST' && pathname === '/list-json-files') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { projectPath = 'user' } = data;
                
                const { projectKey, fullPath } = normalizeProjectPath(projectPath);
                const dataDir = path.join(fullPath, 'data');
                
                // 确保目录存在
                if (!fs.existsSync(dataDir)) {
                    fs.mkdirSync(dataDir, { recursive: true });
                }
                
                // 读取目录中的所有.json文件
                const files = fs.readdirSync(dataDir)
                    .filter(file => file.endsWith('.json'))
                    .sort();
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    files: files,
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

    // 获取JSON文件列表
    if (req.method === 'GET' && pathname === '/list-json-files') {
        try {
            const dataDir = path.join(ROOT_DIR, 'user', 'data');
            
            // 确保目录存在
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            
            // 读取目录中的所有JSON文件
            const files = fs.readdirSync(dataDir)
                .filter(file => file.endsWith('.json'))
                .sort(); // 按文件名排序
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                files: files,
                count: files.length,
                projectKey: 'user'
            }));
            
        } catch (error) {
            console.error('✗ Error listing files:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: false, 
                error: error.message 
            }));
        }
        
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

    // 读取/保存文件排序
    if (req.method === 'POST' && pathname === '/file-order') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = body ? JSON.parse(body) : {};
                const projectPath = data.projectPath || 'user';
                const action = data.action || 'get';
                const order = Array.isArray(data.order) ? data.order : [];
                const { projectRoot } = resolveProjectDirs(projectPath);
                const orderFile = path.join(projectRoot, FILE_ORDER_NAME);

                if (action === 'set') {
                    fs.writeFileSync(orderFile, JSON.stringify({ order }, null, 2), 'utf8');
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

    // 扫描 papers/ 并在 data/ 创建同名空 JSON/MD
    if (req.method === 'POST' && pathname === '/sync-pdfs') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = body ? JSON.parse(body) : {};
                const projectPath = data.projectPath || 'user';
                const { projectRoot, dataDir, papersDir } = resolveProjectDirs(projectPath);

                // 确保基础目录存在
                if (!fs.existsSync(dataDir)) {
                    fs.mkdirSync(dataDir, { recursive: true });
                }
                if (!fs.existsSync(papersDir)) {
                    fs.mkdirSync(papersDir, { recursive: true });
                }

                const pdfFiles = collectPdfFiles(papersDir);
                const createdJson = [];
                const createdMd = [];

                pdfFiles.forEach((pdfPath) => {
                    const baseName = path.basename(pdfPath, path.extname(pdfPath));
                    const pdfFileName = path.basename(pdfPath);
                    const jsonPath = path.join(dataDir, `${baseName}.json`);
                    const mdPath = path.join(dataDir, `${baseName}.md`);

                    if (!fs.existsSync(jsonPath)) {
                        const tpl = {
                            schema_version: formatDate(),
                            lastupdate: formatDateTime(),
                            meta_info: {
                                paper_id: baseName,
                                title: '',
                                pdf_path: pdfFileName
                            }
                        };
                        fs.writeFileSync(jsonPath, JSON.stringify(tpl, null, 2), 'utf8');
                        createdJson.push(path.relative(projectRoot, jsonPath));
                    }
                    if (!fs.existsSync(mdPath)) {
                        fs.writeFileSync(mdPath, buildDefaultMarkdown(baseName), 'utf8');
                        createdMd.push(path.relative(projectRoot, mdPath));
                    }
                });

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    createdJson,
                    createdMd,
                    scanned: pdfFiles.length,
                    message: pdfFiles.length ? '完成扫描' : '未找到 PDF，已确保目录存在'
                }));
            } catch (error) {
                console.error('✗ Error syncing pdfs:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
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

server.listen(PORT, () => {
    console.log('🚀 Server running at http://localhost:' + PORT + '/');
    console.log('📁 Serving files from: ' + __dirname);
    console.log('💾 JSON operations supported:');
    console.log('   - POST /validate-project (validate project structure)');
    console.log('   - POST /list-json-files (list all JSON files)');
    console.log('   - POST /save-json (create/update)');
    console.log('   - POST /rename-json (rename)');
    console.log('   - POST /delete-json (delete)');
    console.log('Press Ctrl+C to stop\n');
});
