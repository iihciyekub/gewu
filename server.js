#!/usr/bin/env node
/**
 * Simple HTTP Server with JSON save support
 * 支持直接保存JSON文件到 user/data/ 目录
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { execFileSync } = require('child_process');

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

// Build manifest once at startup
ensurePromptManifest();

// 路径规范化，返回安全的 projectKey 以及完整路径
function normalizeProjectPath(projectPath = 'user') {
    const raw = (projectPath || 'user').trim() || 'user';
    
    // 如果是绝对路径，直接使用
    if (path.isAbsolute(raw)) {
        const fullPath = path.normalize(raw);
        // 使用绝对路径作为 projectKey，方便识别
        const projectKey = fullPath;
        return { projectKey, fullPath };
    }
    
    // 相对路径：相对于项目根目录
    const normalizedInput = raw.replace(/^[/\\]+/, '');
    const candidate = path.resolve(ROOT_DIR, normalizedInput);
    const relative = path.relative(ROOT_DIR, candidate);
    
    // 检查是否试图访问项目根目录之外（仅对相对路径）
    if (relative.startsWith('..')) {
        throw new Error('相对路径不能访问项目根目录之外的位置');
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
                
                // 检查项目是否已存在
                if (fs.existsSync(fullPath)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: '项目目录已存在' }));
                    return;
                }
                
                // 创建项目根目录和三个必须的子目录
                fs.mkdirSync(fullPath, { recursive: true });
                const jsonDir = path.join(fullPath, 'json');
                const mdDir = path.join(fullPath, 'md');
                const pdfDir = path.join(fullPath, 'pdf');
                
                fs.mkdirSync(jsonDir, { recursive: true });
                fs.mkdirSync(mdDir, { recursive: true });
                fs.mkdirSync(pdfDir, { recursive: true });
                
                // 创建一个 .project 标记文件（可选，用于识别项目根目录）
                const projectMarker = path.join(fullPath, '.project');
                fs.writeFileSync(projectMarker, JSON.stringify({
                    name: path.basename(fullPath),
                    created: new Date().toISOString(),
                    version: '1.0'
                }, null, 2), 'utf8');
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    projectKey,
                    projectPath: fullPath,
                    message: `项目 "${path.basename(fullPath)}" 创建成功`,
                    dirs: {
                        json: path.relative(ROOT_DIR, jsonDir),
                        md: path.relative(ROOT_DIR, mdDir),
                        pdf: path.relative(ROOT_DIR, pdfDir)
                    }
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
                
                // 验证项目结构并规范路径
                const { projectKey, fullPath } = normalizeProjectPath(projectPath);
                
                if (!fs.existsSync(fullPath)) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        valid: false, 
                        message: '项目路径不存在' 
                    }));
                    return;
                }
                
                // 检查新的目录结构 (json, md, pdf) - 这是必需的
                const jsonDir = path.join(fullPath, 'json');
                const mdDir = path.join(fullPath, 'md');
                const pdfDir = path.join(fullPath, 'pdf');
                
                // 创建必要的目录
                if (!fs.existsSync(jsonDir)) {
                    fs.mkdirSync(jsonDir, { recursive: true });
                }
                if (!fs.existsSync(mdDir)) {
                    fs.mkdirSync(mdDir, { recursive: true });
                }
                if (!fs.existsSync(pdfDir)) {
                    fs.mkdirSync(pdfDir, { recursive: true });
                }
                
                // 检查旧结构是否存在（用于兼容性）
                const dataDir = path.join(fullPath, 'data');
                const papersDir = path.join(fullPath, 'papers');
                const hasOldStructure = fs.existsSync(dataDir) || fs.existsSync(papersDir);
                
                // 如果是旧项目，确保这些目录存在
                if (hasOldStructure) {
                    if (!fs.existsSync(dataDir)) {
                        fs.mkdirSync(dataDir, { recursive: true });
                    }
                    if (!fs.existsSync(papersDir)) {
                        fs.mkdirSync(papersDir, { recursive: true });
                    }
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    valid: true,
                    message: '项目结构有效',
                    dataDir: dataDir,
                    papersDir: papersDir,
                    jsonDir: jsonDir,
                    mdDir: mdDir,
                    pdfDir: pdfDir,
                    projectKey,
                    hasOldStructure
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
                // 保存到指定项目目录（新结构优先：json/... 或 md/...；旧结构兼容 data/...）
                const safeName = filename.replace(/^[/\\]+/, '');
                const usesNewLayout = safeName.startsWith('json/') || safeName.startsWith('md/');
                const filePath = usesNewLayout
                    ? path.join(fullPath, safeName)
                    : path.join(fullPath, 'data', safeName);
                
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
                const safeName = filename.replace(/^[/\\]+/, '');
                const usesNewLayout = safeName.startsWith('json/') || safeName.startsWith('md/');
                const filePath = usesNewLayout
                    ? path.join(fullPath, safeName)
                    : path.join(fullPath, 'data', safeName);
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
                const fix = (name) => {
                    const safe = name.replace(/^[/\\]+/, '');
                    if (safe.startsWith('json/') || safe.startsWith('md/')) return path.join(fullPath, safe);
                    return path.join(fullPath, 'data', safe);
                };
                // 构建文件路径
                const oldPath = fix(oldFilename);
                const newPath = fix(newFilename);
                
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
                const safe = filename.replace(/^[/\\]+/, '');
                const filePath = safe.startsWith('json/') || safe.startsWith('md/')
                    ? path.join(fullPath, safe)
                    : path.join(fullPath, 'data', safe);
                
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

    // 处理读取文件请求（支持任意项目路径）
    if (req.method === 'POST' && pathname === '/read-file') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { projectPath = 'user', filePath: relativeFilePath } = data;
                
                console.log('📖 读取文件请求:', { projectPath, relativeFilePath });
                
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
                
                console.log('✅ 文件读取成功');
                
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

    // 处理获取PDF文件请求（支持任意项目路径）
    if (req.method === 'GET' && pathname === '/get-pdf') {
        try {
            const query = new URL(req.url, `http://${req.headers.host}`).searchParams;
            const projectPath = query.get('projectPath') || 'user';
            const pdfFile = query.get('file') || '';
            
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
            
            const content = fs.readFileSync(targetFile);
            res.writeHead(200, { 
                'Content-Type': 'application/pdf',
                'Content-Length': content.length
            });
            res.end(content);
            
            console.log('✅ PDF读取成功');
            
        } catch (error) {
            console.error('✗ 读取PDF错误:', error);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end(`Error: ${error.message}`);
        }
        
        return;
    }

    // 处理获取文件列表请求（新结构 json/<view>/ + md/ + 兼容 data/ 旧结构）
    if (req.method === 'POST' && pathname === '/list-json-files') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { projectPath = 'user' } = data;
                
                console.log('📂 收到文件列表请求，项目路径:', projectPath);
                const { projectKey, fullPath } = normalizeProjectPath(projectPath);
                console.log('📍 规范化后的完整路径:', fullPath);
                const dataDir = path.join(fullPath, 'data');
                
                const collectFiles = (dir, kind, category) => {
                    console.log(`  扫描目录: ${dir} (存在: ${fs.existsSync(dir)})`);
                    if (!fs.existsSync(dir)) return [];
                    const entries = fs.readdirSync(dir, { withFileTypes: true });
                    const collected = entries
                        .filter(ent => ent.isFile() && ((kind === 'json' && ent.name.toLowerCase().endsWith('.json')) || (kind === 'md' && ent.name.toLowerCase().endsWith('.md'))))
                        .map(ent => ({
                            name: ent.name,
                            path: path.relative(fullPath, path.join(dir, ent.name)).split(path.sep).join('/'),
                            kind,
                            category
                        }));
                    console.log(`  找到 ${collected.length} 个 ${kind} 文件`);
                    return collected;
                };

                const files = [];
                
                // 新结构（优先）：json/view1, json/view2 等
                const jsonRoot = path.join(fullPath, 'json');
                console.log('🔍 检查 json/ 目录:', jsonRoot);
                if (fs.existsSync(jsonRoot)) {
                    const entries = fs.readdirSync(jsonRoot, { withFileTypes: true });
                    console.log(`  json/ 目录下有 ${entries.length} 个条目`);
                    // 直接在 json/ 目录下的 .json 文件（作为 json.view1）
                    entries.filter(ent => ent.isFile() && ent.name.toLowerCase().endsWith('.json')).forEach(ent => {
                        files.push({
                            name: ent.name,
                            path: path.relative(fullPath, path.join(jsonRoot, ent.name)).split(path.sep).join('/'),
                            kind: 'json',
                            category: 'json.view1'
                        });
                    });
                    // 或者在 json/<view>/ 子目录下
                    const subDirs = entries.filter(ent => ent.isDirectory());
                    console.log(`  找到 ${subDirs.length} 个子目录:`, subDirs.map(d => d.name));
                    subDirs.forEach(viewDir => {
                        const viewName = viewDir.name;
                        const viewPath = path.join(jsonRoot, viewName);
                        console.log(`  扫描子目录: ${viewPath}`);
                        const jsonFiles = fs.readdirSync(viewPath, { withFileTypes: true })
                            .filter(f => f.isFile() && f.name.toLowerCase().endsWith('.json'));
                        console.log(`    找到 ${jsonFiles.length} 个 JSON 文件`);
                        jsonFiles.forEach(f => {
                            files.push({
                                name: f.name,
                                path: path.relative(fullPath, path.join(viewPath, f.name)).split(path.sep).join('/'),
                                kind: 'json',
                                category: `json.${viewName}`
                            });
                        });
                    });
                }
                
                // 新结构：md/
                console.log('🔍 检查 md/ 目录');
                files.push(...collectFiles(path.join(fullPath, 'md'), 'md', 'md'));
                
                // 兼容旧结构 data/（用于向后兼容）
                console.log('🔍 检查 data/ 目录（旧结构）');
                if (fs.existsSync(dataDir)) {
                    files.push(...collectFiles(path.join(dataDir, 'json.checklist'), 'json', 'json.checklist'));
                    files.push(...collectFiles(path.join(dataDir, 'json.qa'), 'json', 'json.qa'));
                    files.push(...collectFiles(dataDir, 'json', 'json.root'));
                    files.push(...collectFiles(path.join(dataDir, 'md'), 'md', 'md'));
                }
                
                console.log(`✅ 总共找到 ${files.length} 个文件`);
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
                const groups = normalizeGroupList(data.groups);
                const { projectRoot } = resolveProjectDirs(projectPath);
                const orderFile = path.join(projectRoot, FILE_ORDER_NAME);

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

    // 扫描 papers/ 并在 data/ 创建同名空 JSON/MD
    if (req.method === 'POST' && pathname === '/sync-pdfs') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = body ? JSON.parse(body) : {};
                const projectPath = data.projectPath || 'user';
                const mode = data.mode || 'new-only'; // 'new-only' 或 'all'
                
                console.log('📄 同步PDF请求，项目路径:', projectPath, '模式:', mode);
                const { projectKey, fullPath } = normalizeProjectPath(projectPath);
                
                // 新目录结构
                const pdfDir = path.join(fullPath, 'pdf');
                const jsonDir = path.join(fullPath, 'json');
                const mdDir = path.join(fullPath, 'md');
                
                console.log('📍 PDF目录:', pdfDir);
                console.log('📍 JSON目录:', jsonDir);
                console.log('📍 MD目录:', mdDir);

                // 确保基础目录存在
                if (!fs.existsSync(pdfDir)) {
                    fs.mkdirSync(pdfDir, { recursive: true });
                    console.log('✅ 创建PDF目录');
                }
                if (!fs.existsSync(jsonDir)) {
                    fs.mkdirSync(jsonDir, { recursive: true });
                    console.log('✅ 创建JSON目录');
                }
                if (!fs.existsSync(mdDir)) {
                    fs.mkdirSync(mdDir, { recursive: true });
                    console.log('✅ 创建MD目录');
                }

                // 扫描PDF目录（包括子目录）
                const pdfFiles = collectPdfFiles(pdfDir);
                console.log(`🔍 找到 ${pdfFiles.length} 个PDF文件`);
                
                const createdJson = [];
                const createdMd = [];
                const updatedJson = [];

                pdfFiles.forEach((pdfPath) => {
                    const baseName = path.basename(pdfPath, path.extname(pdfPath));
                    const pdfFileName = path.basename(pdfPath);
                    
                    // 在json目录下创建JSON文件（扁平结构，不保留子目录）
                    const jsonPath = path.join(jsonDir, `${baseName}.json`);
                    const mdPath = path.join(mdDir, `${baseName}.md`);

                    const jsonExists = fs.existsSync(jsonPath);
                    const mdExists = fs.existsSync(mdPath);
                    
                    // 根据模式决定是否处理已存在的文件
                    if (mode === 'new-only' && jsonExists && mdExists) {
                        // 仅更新pdf_path
                        try {
                            const raw = fs.readFileSync(jsonPath, 'utf8');
                            const parsed = JSON.parse(raw);
                            if (!parsed.meta_info || typeof parsed.meta_info !== 'object') {
                                parsed.meta_info = {};
                            }
                            if (parsed.meta_info.pdf_path !== pdfFileName) {
                                parsed.meta_info.pdf_path = pdfFileName;
                                fs.writeFileSync(jsonPath, JSON.stringify(parsed, null, 2), 'utf8');
                                updatedJson.push(`json/${baseName}.json`);
                                console.log(`  ✅ 更新PDF路径: ${baseName}.json`);
                            }
                        } catch (err) {
                            console.warn('  ⚠️ 更新meta_info.pdf_path失败:', baseName, err);
                        }
                        return;
                    }

                    // 创建或覆盖JSON文件
                    if (!jsonExists || mode === 'all') {
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
                        if (jsonExists) {
                            updatedJson.push(`json/${baseName}.json`);
                            console.log(`  ✅ 覆盖JSON: ${baseName}.json`);
                        } else {
                            createdJson.push(`json/${baseName}.json`);
                            console.log(`  ✅ 创建JSON: ${baseName}.json`);
                        }
                    } else {
                        // 更新现有JSON的pdf_path
                        try {
                            const raw = fs.readFileSync(jsonPath, 'utf8');
                            const parsed = JSON.parse(raw);
                            if (!parsed.meta_info || typeof parsed.meta_info !== 'object') {
                                parsed.meta_info = {};
                            }
                            if (parsed.meta_info.pdf_path !== pdfFileName) {
                                parsed.meta_info.pdf_path = pdfFileName;
                                fs.writeFileSync(jsonPath, JSON.stringify(parsed, null, 2), 'utf8');
                                updatedJson.push(`json/${baseName}.json`);
                                console.log(`  ✅ 更新PDF路径: ${baseName}.json`);
                            }
                        } catch (err) {
                            console.warn('  ⚠️ 更新meta_info.pdf_path失败:', baseName, err);
                        }
                    }
                    
                    // 创建或覆盖MD文件
                    if (!mdExists || mode === 'all') {
                        fs.writeFileSync(mdPath, buildDefaultMarkdown(baseName), 'utf8');
                        if (mdExists) {
                            console.log(`  ✅ 覆盖MD: ${baseName}.md`);
                        } else {
                            createdMd.push(`md/${baseName}.md`);
                            console.log(`  ✅ 创建MD: ${baseName}.md`);
                        }
                    }
                });

                const message = pdfFiles.length
                    ? `完成扫描（新建 ${createdJson.length} 个，更新 ${updatedJson.length} 个）`
                    : '未找到 PDF 文件，已确保目录存在';
                
                console.log(`✅ ${message}`);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    createdJson,
                    createdMd,
                    updatedJson,
                    scanned: pdfFiles.length,
                    message
                }));
            } catch (error) {
                console.error('✗ Error syncing pdfs:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // 将指定 PDF 复制到系统剪贴板（仅支持本机、macOS）
    if (req.method === 'POST' && pathname === '/copy-pdf-to-clipboard') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = body ? JSON.parse(body) : {};
                const projectPath = data.projectPath || 'user';
                const pdfFile = data.pdfFile || '';
                const { papersDir } = resolveProjectDirs(projectPath);
                const safeName = path.basename(pdfFile);
                const pdfPath = path.join(papersDir, safeName);
                const resolvedPapersDir = path.resolve(papersDir);
                const resolvedPdf = path.resolve(pdfPath);
                if (!resolvedPdf.startsWith(resolvedPapersDir)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Invalid path' }));
                    return;
                }
                if (!safeName.toLowerCase().endsWith('.pdf')) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: '仅支持 PDF 文件' }));
                    return;
                }
                if (!fs.existsSync(resolvedPdf)) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'PDF 不存在' }));
                    return;
                }
                const ok = copyFileToSystemClipboard(resolvedPdf);
                if (!ok) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: '当前系统不支持复制文件到剪贴板（需要 macOS）' }));
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (error) {
                console.error('✗ Error copying pdf to clipboard:', error);
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

server.listen(PORT, '127.0.0.1', () => {
    console.log('🚀 Server running at http://localhost:' + PORT + '/');
    console.log('📁 Serving files from: ' + __dirname);
    console.log('💾 Project operations:');
    console.log('   - POST /create-project (create new project with json/md/pdf dirs)');
    console.log('   - POST /validate-project (validate project structure)');
    console.log('💾 JSON operations supported:');
    console.log('   - POST /list-json-files (list all JSON files)');
    console.log('   - POST /save-json (create/update)');
    console.log('   - POST /rename-json (rename)');
    console.log('   - POST /delete-json (delete)');
    console.log('Press Ctrl+C to stop\n');
});
