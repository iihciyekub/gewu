#!/usr/bin/env node
/**
 * Simple HTTP Server with JSON save support
 * 支持直接保存JSON文件到 user/data/ 目录
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 8000;

// MIME类型映射
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
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
                
                // 验证项目结构
                const fullPath = path.join(__dirname, projectPath);
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
                    papersDir: papersDir
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
                
                // 保存到指定项目的 data/ 目录
                const filePath = path.join(__dirname, projectPath, 'data', filename);
                
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
                    path: filePath
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
                
                // 构建文件路径
                const oldPath = path.join(__dirname, projectPath, 'data', oldFilename);
                const newPath = path.join(__dirname, projectPath, 'data', newFilename);
                
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
                    newFilename
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
                
                // 构建文件路径
                const filePath = path.join(__dirname, projectPath, 'data', filename);
                
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
                    filename
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
                
                const dataDir = path.join(__dirname, projectPath, 'data');
                
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
                    files: files
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
            const dataDir = path.join(__dirname, 'user', 'data');
            
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
                count: files.length
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

    // 处理静态文件请求
    let filePath = '.' + pathname;
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
