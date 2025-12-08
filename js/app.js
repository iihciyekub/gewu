// ========================================
// PDF文献分析管理工具 - 主应用逻辑
// ========================================

import * as pdfjsLib from './pdfjs/build/pdf.mjs';

// 配置PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = './js/pdfjs/build/pdf.worker.mjs';

// ========================================
// 全局状态管理
// ========================================

const AppState = {
    currentJsonFile: null,
    currentJsonData: null,
    currentPdfPath: null,
    pdfDocument: null,
    currentPage: 1,
    totalPages: 0,
    scale: 1.5,  // 提高默认缩放比例
    jsonFiles: [],
    renderTask: null,
    autoFitWidth: true  // 自动适应宽度
};

// ========================================
// 初始化应用
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    console.log('初始化PDF文献分析管理工具...');
    
    // 初始化主题
    initializeTheme();
    
    // 初始化拖拽调整大小功能
    initializeResizers();
    
    // 加载JSON文件列表
    loadJsonFileList();
    
    // 绑定事件监听器
    bindEventListeners();
}

// ========================================
// 主题管理
// ========================================

function initializeTheme() {
    // 从 localStorage 读取主题设置
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    // 更新按钮图标
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
        themeToggle.title = theme === 'dark' ? '切换到白天模式' : '切换到黑暗模式';
    }
}

// ========================================
// 事件监听器绑定
// ========================================

function bindEventListeners() {
    // 主题切换
    document.getElementById('themeToggle').addEventListener('click', () => {
        toggleTheme();
    });
    
    // PDF控制按钮
    document.getElementById('prevPage').addEventListener('click', () => {
        if (AppState.currentPage > 1) {
            AppState.currentPage--;
            renderPdfPage(AppState.currentPage);
        }
    });
    
    document.getElementById('nextPage').addEventListener('click', () => {
        if (AppState.currentPage < AppState.totalPages) {
            AppState.currentPage++;
            renderPdfPage(AppState.currentPage);
        }
    });
    
    document.getElementById('zoomIn').addEventListener('click', () => {
        AppState.scale = Math.min(AppState.scale + 0.2, 3.0);
        renderPdfPage(AppState.currentPage);
        updateZoomLevel();
    });
    
    document.getElementById('zoomOut').addEventListener('click', () => {
        AppState.scale = Math.max(AppState.scale - 0.2, 0.5);
        renderPdfPage(AppState.currentPage);
        updateZoomLevel();
    });
    
    // 适应宽度切换
    document.getElementById('fitWidth').addEventListener('click', () => {
        AppState.autoFitWidth = !AppState.autoFitWidth;
        const btn = document.getElementById('fitWidth');
        if (AppState.autoFitWidth) {
            btn.style.background = '#4caf50';
            btn.style.color = 'white';
            btn.title = '适应宽度: 开启';
        } else {
            btn.style.background = '';
            btn.style.color = '';
            btn.title = '适应宽度: 关闭';
        }
        if (AppState.pdfDocument) {
            renderPdfPage(AppState.currentPage);
        }
    });
    
    // PDF文件手动加载
    document.getElementById('loadPdfBtn').addEventListener('click', () => {
        document.getElementById('pdfFileInput').click();
    });
    
    document.getElementById('pdfFileInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && file.type === 'application/pdf') {
            loadPdfFromFile(file);
        } else {
            alert('请选择有效的PDF文件');
        }
    });
    
    // 刷新文件列表
    document.getElementById('refreshFiles').addEventListener('click', () => {
        loadJsonFileList();
    });
    
    // 视图模式切换
    document.getElementById('viewMode').addEventListener('change', (e) => {
        if (AppState.currentJsonData) {
            renderJsonData(AppState.currentJsonData, e.target.value);
        }
    });
}

// ========================================
// 面板大小调整功能
// ========================================

function initializeResizers() {
    const resizer1 = document.getElementById('resizer1');
    const resizer2 = document.getElementById('resizer2');
    const panelLeft = document.getElementById('panelLeft');
    const panelMiddle = document.getElementById('panelMiddle');
    const panelRight = document.getElementById('panelRight');
    const container = document.querySelector('.container');
    
    let isResizing = false;
    let currentResizer = null;
    
    [resizer1, resizer2].forEach(resizer => {
        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            currentResizer = resizer;
            resizer.classList.add('active');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        
        const containerRect = container.getBoundingClientRect();
        const mouseX = e.clientX - containerRect.left;
        const containerWidth = containerRect.width;
        
        if (currentResizer === resizer1) {
            // 调整左侧面板宽度
            const newLeftWidth = (mouseX / containerWidth) * 100;
            if (newLeftWidth > 10 && newLeftWidth < 40) {
                panelLeft.style.width = `${newLeftWidth}%`;
                panelLeft.style.flexShrink = '0';
            }
        } else if (currentResizer === resizer2) {
            // 调整中间面板宽度
            const leftWidth = panelLeft.getBoundingClientRect().width;
            const resizer1Width = 4;
            const newMiddleWidth = ((mouseX - leftWidth - resizer1Width) / containerWidth) * 100;
            
            if (newMiddleWidth > 20 && newMiddleWidth < 70) {
                panelMiddle.style.width = `${newMiddleWidth}%`;
                panelMiddle.style.flex = 'none';
                // 右侧面板自动填充剩余空间
                const rightWidth = 100 - ((leftWidth + resizer1Width + 4) / containerWidth * 100) - newMiddleWidth;
                panelRight.style.width = `${rightWidth}%`;
                panelRight.style.flex = 'none';
            }
        }
    });
    
    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            currentResizer?.classList.remove('active');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
}

// ========================================
// JSON文件列表加载
// ========================================

async function loadJsonFileList() {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '<div style="padding: 12px; color: #6c757d; font-size: 12px;">正在加载文件列表...</div>';
    
    try {
        // 扫描src目录下的JSON文件
        const response = await fetch('./src/');
        const text = await response.text();
        
        // 简单的HTML解析获取.json文件
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        const links = doc.querySelectorAll('a');
        
        const jsonFiles = [];
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (href && href.endsWith('.json')) {
                jsonFiles.push(href);
            }
        });
        
        if (jsonFiles.length === 0) {
            // 如果自动扫描失败，使用已知文件
            jsonFiles.push('paper_1_data.json');
        }
        
        AppState.jsonFiles = jsonFiles;
        renderFileList(jsonFiles);
        
    } catch (error) {
        console.error('加载文件列表失败:', error);
        // 降级处理：使用已知文件
        AppState.jsonFiles = ['paper_1_data.json'];
        renderFileList(AppState.jsonFiles);
    }
}

function renderFileList(files) {
    const fileList = document.getElementById('fileList');
    
    if (files.length === 0) {
        fileList.innerHTML = '<div style="padding: 12px; color: #6c757d; font-size: 12px;">未找到JSON文件</div>';
        return;
    }
    
    fileList.innerHTML = '';
    
    files.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.textContent = file.replace('.json', '');
        fileItem.dataset.filename = file;
        
        fileItem.addEventListener('click', () => {
            // 移除其他文件的active状态
            document.querySelectorAll('.file-item').forEach(item => {
                item.classList.remove('active');
            });
            
            // 添加active状态
            fileItem.classList.add('active');
            
            // 加载JSON数据
            loadJsonFile(file);
        });
        
        fileList.appendChild(fileItem);
    });
}

// ========================================
// JSON数据加载与渲染
// ========================================

async function loadJsonFile(filename) {
    const dataDisplay = document.getElementById('dataDisplay');
    dataDisplay.innerHTML = '<div class="placeholder"><div class="loading"></div><p>正在加载数据...</p></div>';
    
    try {
        const response = await fetch(`./src/${filename}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        AppState.currentJsonFile = filename;
        AppState.currentJsonData = data;
        
        // 渲染JSON数据
        const viewMode = document.getElementById('viewMode').value;
        renderJsonData(data, viewMode);
        
        // 如果有PDF路径，加载PDF - 支持多种JSON结构
        const pdfPath = data.pdf_path || data.meta_info?.pdf_path || data.metadata?.pdf_path;
        if (pdfPath) {
            loadPdf(pdfPath);
        } else {
            // 没有PDF路径，显示提示
            const pdfViewer = document.getElementById('pdfViewer');
            pdfViewer.innerHTML = `
                <div class="placeholder">
                    <div class="placeholder-icon">📄</div>
                    <p>未找到PDF路径</p>
                    <button class="btn-primary" style="margin-top:12px;" onclick="document.getElementById('loadPdfBtn').click()">手动加载PDF</button>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('加载JSON文件失败:', error);
        dataDisplay.innerHTML = `
            <div class="placeholder">
                <div class="placeholder-icon">⚠️</div>
                <p>加载失败: ${error.message}</p>
            </div>
        `;
    }
}

function renderJsonData(data, viewMode = 'hierarchical') {
    const dataDisplay = document.getElementById('dataDisplay');
    dataDisplay.innerHTML = '';
    
    if (viewMode === 'hierarchical') {
        renderHierarchicalView(data, dataDisplay);
    } else {
        renderFlatView(data, dataDisplay);
    }
}

// ========================================
// 分层视图渲染
// ========================================

function renderHierarchicalView(data, container) {
    // 动态识别所有顶层字段，自动生成分区
    const sectionMapping = {
        'doi': '🔖 文献标识',
        'pdf_path': '📄 PDF路径',
        'literature_meta': '📚 文献元数据',
        'basic_info': '📖 基本信息',
        'research_context': '🎯 研究背景',
        'data_architecture': '💾 数据架构',
        'did_identification_strategy': '🔬 DID识别策略',
        'identification_strategy': '🔬 识别策略',
        'empirical_findings': '📊 实证结果',
        'results': '📊 研究结果',
        'methodology': '🔧 研究方法',
        'conclusion': '✅ 结论',
        'limitations': '⚠️ 局限性',
        'references': '📚 参考文献'
    };
    
    // 遍历所有顶层字段
    for (const [key, value] of Object.entries(data)) {
        if (value === null || value === undefined) continue;
        
        // 跳过简单的字符串字段（如doi, pdf_path），除非它们是唯一的顶层字段
        if (typeof value === 'string' && Object.keys(data).length > 3) {
            continue;
        }
        
        // 如果是对象或数组，创建一个分区
        if (typeof value === 'object') {
            const sectionTitle = sectionMapping[key] || `📋 ${formatKey(key)}`;
            const section = createSection(sectionTitle, value);
            container.appendChild(section);
        } else {
            // 简单字段也显示
            const simpleSection = document.createElement('div');
            simpleSection.className = 'data-section';
            simpleSection.innerHTML = `
                <div class="section-title">${sectionMapping[key] || formatKey(key)}</div>
                <div class="section-content">
                    <table class="data-table">
                        <tr>
                            <td class="field-label">${formatKey(key)}</td>
                            <td class="field-value">${formatValue(value)}</td>
                        </tr>
                    </table>
                </div>
            `;
            container.appendChild(simpleSection);
        }
    }
    
    // 如果没有找到任何内容，显示原始数据
    if (container.children.length === 0) {
        const section = createSection('📄 数据内容', data);
        container.appendChild(section);
    }
}

function createSection(title, data) {
    const section = document.createElement('div');
    section.className = 'data-section';
    
    const titleDiv = document.createElement('div');
    titleDiv.className = 'section-title';
    titleDiv.textContent = title;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'section-content';
    
    // 递归渲染数据
    renderObject(data, contentDiv);
    
    // 折叠功能
    titleDiv.addEventListener('click', () => {
        titleDiv.classList.toggle('collapsed');
        contentDiv.classList.toggle('collapsed');
    });
    
    section.appendChild(titleDiv);
    section.appendChild(contentDiv);
    
    return section;
}

function renderObject(obj, container, level = 0) {
    if (!obj || typeof obj !== 'object') {
        const span = document.createElement('span');
        span.innerHTML = formatValue(obj);
        container.appendChild(span);
        return;
    }
    
    // 检测是否为空对象
    if (Object.keys(obj).length === 0) {
        const empty = document.createElement('span');
        empty.style.color = '#adb5bd';
        empty.textContent = '(空)';
        container.appendChild(empty);
        return;
    }
    
    const table = document.createElement('table');
    table.className = 'data-table';
    
    for (const [key, value] of Object.entries(obj)) {
        // 跳过_loc字段，因为它们会和主字段一起显示
        if (key.endsWith('_loc')) {
            continue;
        }
        
        const row = document.createElement('tr');
        
        const keyCell = document.createElement('td');
        keyCell.className = 'field-label';
        keyCell.textContent = formatKey(key);
        
        const valueCell = document.createElement('td');
        valueCell.className = 'field-value';
        
        // 检查是否有配对的_loc字段
        const locKey = key + '_loc';
        const hasLocField = obj[locKey] && typeof obj[locKey] === 'object';
        
        // 处理null和undefined
        if (value === null || value === undefined) {
            valueCell.innerHTML = '<span style="color: #adb5bd;">-</span>';
        }
        // 处理带value/evidence结构的对象
        else if (value && typeof value === 'object' && !Array.isArray(value) && ('value' in value || 'evidence' in value)) {
            // 显示value字段
            if ('value' in value) {
                valueCell.innerHTML = formatValue(value.value);
            }
            
            // 显示evidence字段
            if (value.evidence) {
                const evidenceSpan = document.createElement('div');
                evidenceSpan.style.marginTop = '2px';
                evidenceSpan.innerHTML = createEvidenceLinks(value.evidence);
                valueCell.appendChild(evidenceSpan);
            }
            
            // 检查是否有配对的_loc字段
            if (hasLocField) {
                const locSpan = document.createElement('div');
                locSpan.style.marginTop = '2px';
                locSpan.innerHTML = createEvidenceLinks(obj[locKey]);
                valueCell.appendChild(locSpan);
            }
            
            // 显示其他字段（如reasoning, description等）
            const otherFields = Object.keys(value).filter(k => k !== 'value' && k !== 'evidence');
            if (otherFields.length > 0) {
                const otherDiv = document.createElement('div');
                otherDiv.className = 'nested-table';
                otherDiv.style.marginTop = '4px';
                const otherData = {};
                otherFields.forEach(k => otherData[k] = value[k]);
                renderObject(otherData, otherDiv, level + 1);
                valueCell.appendChild(otherDiv);
            }
        }
        // 处理数组
        else if (Array.isArray(value)) {
            if (value.length === 0) {
                valueCell.innerHTML = '<span style="color: #adb5bd;">[]</span>';
            } else if (value.every(v => typeof v === 'string' || typeof v === 'number' || v === null)) {
                // 简单值数组
                valueCell.innerHTML = formatValue(value);
            } else {
                // 复杂对象数组
                const nestedDiv = document.createElement('div');
                nestedDiv.className = 'nested-table';
                value.forEach((item, index) => {
                    const itemDiv = document.createElement('div');
                    itemDiv.style.marginBottom = '4px';
                    itemDiv.style.paddingBottom = '4px';
                    itemDiv.style.borderBottom = index < value.length - 1 ? '1px solid #e9ecef' : 'none';
                    
                    const itemTitle = document.createElement('div');
                    itemTitle.innerHTML = `<strong style="color: #495057; font-size: 11px;">Item ${index + 1}</strong>`;
                    itemTitle.style.marginBottom = '2px';
                    itemDiv.appendChild(itemTitle);
                    
                    renderObject(item, itemDiv, level + 1);
                    nestedDiv.appendChild(itemDiv);
                });
                valueCell.appendChild(nestedDiv);
            }
        }
        // 处理嵌套对象
        else if (typeof value === 'object') {
            const nestedDiv = document.createElement('div');
            nestedDiv.className = 'nested-table';
            renderObject(value, nestedDiv, level + 1);
            valueCell.appendChild(nestedDiv);
        }
        // 处理原始值
        else {
            valueCell.innerHTML = formatValue(value);
            
            // 如果有_loc字段，添加跳转链接
            if (hasLocField) {
                const locSpan = document.createElement('div');
                locSpan.style.marginTop = '2px';
                locSpan.innerHTML = createEvidenceLinks(obj[locKey]);
                valueCell.appendChild(locSpan);
            }
        }
        
        row.appendChild(keyCell);
        row.appendChild(valueCell);
        table.appendChild(row);
    }
    
    container.appendChild(table);
}

// ========================================
// 扁平视图渲染
// ========================================

function renderFlatView(data, container) {
    const allItems = [];
    
    function flatten(obj, prefix = '', depth = 0) {
        // 防止过深的递归
        if (depth > 10) return;
        
        if (!obj || typeof obj !== 'object') {
            return;
        }
        
        for (const [key, value] of Object.entries(obj)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            
            // 跳过null和undefined
            if (value === null || value === undefined) {
                allItems.push({
                    key: fullKey,
                    value: null,
                    evidence: null,
                    type: 'null'
                });
                continue;
            }
            
            // 处理带value/evidence结构的对象
            if (typeof value === 'object' && !Array.isArray(value) && ('value' in value || 'evidence' in value)) {
                allItems.push({
                    key: fullKey,
                    value: value.value ?? value,
                    evidence: value.evidence || null,
                    type: 'structured'
                });
                
                // 如果有其他字段，继续展开
                const otherFields = Object.keys(value).filter(k => k !== 'value' && k !== 'evidence');
                if (otherFields.length > 0) {
                    const otherData = {};
                    otherFields.forEach(k => otherData[k] = value[k]);
                    flatten(otherData, fullKey, depth + 1);
                }
            }
            // 处理数组
            else if (Array.isArray(value)) {
                if (value.length === 0) {
                    allItems.push({
                        key: fullKey,
                        value: '[]',
                        evidence: null,
                        type: 'array'
                    });
                } else if (value.every(v => typeof v === 'string' || typeof v === 'number' || v === null)) {
                    // 简单数组
                    allItems.push({
                        key: fullKey,
                        value: value,
                        evidence: null,
                        type: 'simple-array'
                    });
                } else {
                    // 复杂数组，展开每个元素
                    value.forEach((item, index) => {
                        if (typeof item === 'object') {
                            flatten(item, `${fullKey}[${index}]`, depth + 1);
                        } else {
                            allItems.push({
                                key: `${fullKey}[${index}]`,
                                value: item,
                                evidence: null,
                                type: 'array-item'
                            });
                        }
                    });
                }
            }
            // 处理嵌套对象
            else if (typeof value === 'object') {
                flatten(value, fullKey, depth + 1);
            }
            // 处理原始值
            else {
                allItems.push({
                    key: fullKey,
                    value: value,
                    evidence: null,
                    type: 'primitive'
                });
            }
        }
    }
    
    flatten(data);
    
    if (allItems.length === 0) {
        container.innerHTML = '<div class="placeholder"><p>无数据显示</p></div>';
        return;
    }
    
    const table = document.createElement('table');
    table.className = 'data-table';
    
    // 表头
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th style="width: 35%">字段路径</th>
            <th style="width: 45%">值</th>
            <th style="width: 20%">证据链接</th>
        </tr>
    `;
    table.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    allItems.forEach(item => {
        const row = document.createElement('tr');
        
        const keyCell = document.createElement('td');
        keyCell.className = 'field-label';
        keyCell.style.fontFamily = 'var(--font-mono)';
        keyCell.style.fontSize = '11px';
        keyCell.textContent = item.key;
        
        const valueCell = document.createElement('td');
        valueCell.className = 'field-value';
        valueCell.innerHTML = formatValue(item.value);
        
        const evidenceCell = document.createElement('td');
        evidenceCell.style.fontSize = '11px';
        evidenceCell.innerHTML = item.evidence ? createEvidenceLinks(item.evidence) : '-';
        
        row.appendChild(keyCell);
        row.appendChild(valueCell);
        row.appendChild(evidenceCell);
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    container.appendChild(table);
}

// ========================================
// 工具函数
// ========================================

function formatKey(key) {
    return key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

function formatValue(value) {
    if (value === null || value === undefined) {
        return '<span style="color: #adb5bd;">-</span>';
    }
    
    if (Array.isArray(value)) {
        if (value.every(v => typeof v === 'string' || typeof v === 'number')) {
            return value.join(', ');
        }
        return JSON.stringify(value, null, 2);
    }
    
    if (typeof value === 'object') {
        return JSON.stringify(value, null, 2);
    }
    
    const strValue = String(value);
    
    // 检测LaTeX公式
    if (strValue.includes('\\') && (strValue.includes('_{') || strValue.includes('^{'))) {
        return `<div class="latex-formula">${escapeHtml(strValue)}</div>`;
    }
    
    return escapeHtml(strValue);
}

function createEvidenceLinks(evidence, pdfPageIndex = null) {
    if (!evidence) return '';
    
    // 如果evidence是对象（包含pdf_page_index等信息）
    if (typeof evidence === 'object') {
        const pageIndex = evidence.pdf_page_index;
        const pageLabel = evidence.page_label;
        const quote = evidence.quote || '';
        
        if (pageIndex !== undefined) {
            const displayText = pageLabel ? `📄 p.${pageLabel}` : `📄 Page ${pageIndex}`;
            return `<a href="#" class="evidence-link" data-page-index="${pageIndex}" data-quote="${escapeHtml(quote)}" title="${escapeHtml(quote)}">${displayText}</a>`;
        }
        
        // 如果是包含其他信息的对象，转为字符串处理
        evidence = JSON.stringify(evidence);
    }
    
    const evidenceStr = String(evidence);
    let html = escapeHtml(evidenceStr);
    
    // 如果直接传入了pdf_page_index参数
    if (pdfPageIndex !== null) {
        return `<a href="#" class="evidence-link" data-page-index="${pdfPageIndex}">${html}</a>`;
    }
    
    // 匹配各种页码格式
    const patterns = [
        { regex: /Page\s+(\d+)(?:-(\d+))?/gi, type: 'page' },           // "Page 2038", "Page 2041-2042"
        { regex: /p\.?\s*(\d+)/gi, type: 'page' },                       // "p.123", "p 123"
        { regex: /pp\.?\s*(\d+)(?:-(\d+))?/gi, type: 'page' },          // "pp.123-125"
        { regex: /页\s*(\d+)/g, type: 'page' },                          // "页123"
        { regex: /第\s*(\d+)\s*页/g, type: 'page' }                     // "第123页"
    ];
    
    patterns.forEach(pattern => {
        const matches = [...evidenceStr.matchAll(pattern.regex)];
        matches.forEach(match => {
            const fullMatch = match[0];
            const pageNum = match[1];
            if (pageNum) {
                const link = `<a href="#" class="evidence-link" data-page="${pageNum}">${fullMatch}</a>`;
                html = html.replace(fullMatch, link);
            }
        });
    });
    
    return html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========================================
// PDF加载与渲染
// ========================================

async function loadPdf(pdfPath) {
    const pdfViewer = document.getElementById('pdfViewer');
    pdfViewer.innerHTML = '<div class="placeholder"><div class="loading"></div><p>正在加载PDF...</p></div>';
    
    try {
        // 验证PDF路径
        if (!pdfPath || typeof pdfPath !== 'string') {
            throw new Error('无效的PDF路径');
        }
        
        // 规范化路径
        let normalizedPath = pdfPath.trim();
        if (!normalizedPath.startsWith('http') && !normalizedPath.startsWith('./') && !normalizedPath.startsWith('/')) {
            normalizedPath = './' + normalizedPath;
        }
        
        // 取消之前的渲染任务
        if (AppState.renderTask) {
            AppState.renderTask.cancel();
        }
        
        AppState.currentPdfPath = normalizedPath;
        
        const loadingTask = pdfjsLib.getDocument(normalizedPath);
        const pdf = await loadingTask.promise;
        
        AppState.pdfDocument = pdf;
        AppState.totalPages = pdf.numPages;
        AppState.currentPage = 1;
        
        updatePageInfo();
        updatePdfFileName(pdfPath);
        
        // 创建canvas
        const canvas = document.createElement('canvas');
        canvas.id = 'pdfCanvas';
        pdfViewer.innerHTML = '';
        pdfViewer.appendChild(canvas);
        
        // 渲染第一页
        await renderPdfPage(1);
        
    } catch (error) {
        console.error('加载PDF失败:', error);
        pdfViewer.innerHTML = `
            <div class="placeholder">
                <div class="placeholder-icon">⚠️</div>
                <p>PDF加载失败</p>
                <small>${escapeHtml(error.message || '未知错误')}</small>
                <small style="display:block; margin-top:8px; color:#adb5bd;">路径: ${escapeHtml(pdfPath || 'N/A')}</small>
                <button class="btn-primary" style="margin-top:12px;" onclick="document.getElementById('loadPdfBtn').click()">手动加载PDF</button>
            </div>
        `;
    }
}

async function loadPdfFromFile(file) {
    const pdfViewer = document.getElementById('pdfViewer');
    pdfViewer.innerHTML = '<div class="placeholder"><div class="loading"></div><p>正在加载PDF...</p></div>';
    
    try {
        // 取消之前的渲染任务
        if (AppState.renderTask) {
            AppState.renderTask.cancel();
        }
        
        const fileReader = new FileReader();
        
        fileReader.onload = async function() {
            const typedarray = new Uint8Array(this.result);
            
            const loadingTask = pdfjsLib.getDocument(typedarray);
            const pdf = await loadingTask.promise;
            
            AppState.pdfDocument = pdf;
            AppState.totalPages = pdf.numPages;
            AppState.currentPage = 1;
            AppState.currentPdfPath = file.name;
            
            updatePageInfo();
            updatePdfFileName(file.name);
            
            // 创建canvas
            const canvas = document.createElement('canvas');
            canvas.id = 'pdfCanvas';
            pdfViewer.innerHTML = '';
            pdfViewer.appendChild(canvas);
            
            // 渲染第一页
            await renderPdfPage(1);
        };
        
        fileReader.onerror = function() {
            throw new Error('文件读取失败');
        };
        
        fileReader.readAsArrayBuffer(file);
        
    } catch (error) {
        console.error('加载PDF文件失败:', error);
        pdfViewer.innerHTML = `
            <div class="placeholder">
                <div class="placeholder-icon">⚠️</div>
                <p>PDF文件加载失败</p>
                <small>${escapeHtml(error.message || '未知错误')}</small>
            </div>
        `;
    }
}

function updatePdfFileName(path) {
    const fileNameSpan = document.getElementById('pdfFileName');
    if (path) {
        const fileName = path.split('/').pop();
        fileNameSpan.textContent = fileName;
        fileNameSpan.style.display = 'inline-block';
        fileNameSpan.title = path;
    } else {
        fileNameSpan.style.display = 'none';
    }
}

async function renderPdfPage(pageNum) {
    if (!AppState.pdfDocument) return;
    
    try {
        const page = await AppState.pdfDocument.getPage(pageNum);
        const canvas = document.getElementById('pdfCanvas');
        const context = canvas.getContext('2d');
        const pdfViewer = document.getElementById('pdfViewer');
        
        // 计算合适的缩放比例
        let scale = AppState.scale;
        
        if (AppState.autoFitWidth) {
            const viewerWidth = pdfViewer.clientWidth - 32; // 减去padding
            const viewport = page.getViewport({ scale: 1.0 });
            const scaleToFit = viewerWidth / viewport.width;
            scale = Math.min(scaleToFit, AppState.scale); // 不超过用户设置的缩放
        }
        
        const viewport = page.getViewport({ scale: scale });
        
        // 使用devicePixelRatio提高渲染质量
        const outputScale = window.devicePixelRatio || 1;
        
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = Math.floor(viewport.width) + 'px';
        canvas.style.height = Math.floor(viewport.height) + 'px';
        
        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;
        
        const renderContext = {
            canvasContext: context,
            viewport: viewport,
            transform: transform
        };
        
        // 取消之前的渲染
        if (AppState.renderTask) {
            AppState.renderTask.cancel();
        }
        
        AppState.renderTask = page.render(renderContext);
        await AppState.renderTask.promise;
        AppState.renderTask = null;
        
        updatePageInfo();
        
        // 滚动到顶部
        canvas.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
    } catch (error) {
        if (error.name !== 'RenderingCancelledException') {
            console.error('渲染PDF页面失败:', error);
        }
    }
}

function updatePageInfo() {
    const pageInfo = document.getElementById('pageInfo');
    pageInfo.textContent = `${AppState.currentPage} / ${AppState.totalPages}`;
}

function updateZoomLevel() {
    const zoomLevel = document.getElementById('zoomLevel');
    zoomLevel.textContent = `${Math.round(AppState.scale * 100)}%`;
}

// ========================================
// PDF页面跳转辅助函数
// ========================================

/**
 * 跳转到指定的PDF页面
 * @param {number|string} pageIdentifier - 页码（可以是页面索引或页面标签）
 * @param {boolean} isIndex - 是否为页面索引（从1开始），默认false表示页面标签
 * @param {string} quote - 要高亮的文本引用（可选）
 */
async function jumpToPdfPage(pageIdentifier, isIndex = true, quote = null) {
    if (!AppState.pdfDocument) {
        console.warn('PDF未加载');
        return false;
    }
    
    let pageNum = parseInt(pageIdentifier);
    if (!pageNum || isNaN(pageNum)) {
        console.warn('无效的页码:', pageIdentifier);
        return false;
    }
    
    // 确保页码在有效范围内
    pageNum = Math.min(Math.max(1, pageNum), AppState.totalPages);
    
    AppState.currentPage = pageNum;
    await renderPdfPage(pageNum);
    
    // 显示跳转高亮指示器，如果有quote则尝试定位文本
    await showJumpIndicator(quote, pageNum);
    
    return true;
}

// ========================================
// 证据链接点击处理
// ========================================

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('evidence-link')) {
        e.preventDefault();
        
        // 优先使用pdf_page_index（从1开始）
        let pageNum = parseInt(e.target.dataset.pageIndex);
        
        // 如果没有pageIndex，使用page（页码标签）
        if (!pageNum || isNaN(pageNum)) {
            pageNum = parseInt(e.target.dataset.page);
        }
        
        if (pageNum && !isNaN(pageNum)) {
            const quote = e.target.dataset.quote || null;
            
            if (!AppState.pdfDocument) {
                console.warn('PDF未加载，尝试从当前JSON数据加载PDF');
                // 尝试从当前数据加载PDF - 支持多种结构
                const pdfPath = AppState.currentJsonData?.pdf_path || 
                               AppState.currentJsonData?.meta_info?.pdf_path || 
                               AppState.currentJsonData?.metadata?.pdf_path;
                if (pdfPath) {
                    loadPdf(pdfPath).then(() => {
                        if (AppState.pdfDocument) {
                            jumpToPdfPage(pageNum, true, quote);
                        }
                    });
                } else {
                    alert('未找到关联的PDF文件，请点击右上角📁按钮手动加载');
                }
                return;
            }
            
            jumpToPdfPage(pageNum, true, quote);
            
            // 高亮链接并滚动到视图
            e.target.style.backgroundColor = '#ffeb3b';
            setTimeout(() => {
                e.target.style.backgroundColor = '';
            }, 1000);
            
            // 将PDF面板滚动到顶部
            const pdfViewer = document.getElementById('pdfViewer');
            pdfViewer.scrollTop = 0;
        }
    }
});

// ========================================
// 窗口大小调整时重新渲染PDF
// ========================================

let resizeTimer;
window.addEventListener('resize', () => {
    if (AppState.pdfDocument && AppState.autoFitWidth) {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            renderPdfPage(AppState.currentPage);
        }, 300);
    }
});

// ========================================
// 键盘快捷键
// ========================================

document.addEventListener('keydown', (e) => {
    if (!AppState.pdfDocument) return;
    
    switch(e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
            if (AppState.currentPage > 1) {
                AppState.currentPage--;
                renderPdfPage(AppState.currentPage);
            }
            e.preventDefault();
            break;
            
        case 'ArrowRight':
        case 'ArrowDown':
            if (AppState.currentPage < AppState.totalPages) {
                AppState.currentPage++;
                renderPdfPage(AppState.currentPage);
            }
            e.preventDefault();
            break;
            
        case '+':
        case '=':
            AppState.scale = Math.min(AppState.scale + 0.2, 3.0);
            renderPdfPage(AppState.currentPage);
            updateZoomLevel();
            e.preventDefault();
            break;
            
        case '-':
        case '_':
            AppState.scale = Math.max(AppState.scale - 0.2, 0.5);
            renderPdfPage(AppState.currentPage);
            updateZoomLevel();
            e.preventDefault();
            break;
    }
});

/**
 * 显示PDF跳转高亮指示器
 * @param {string} quote - 要搜索和高亮的文本（可选）
 * @param {number} pageNum - 当前页码
 */
async function showJumpIndicator(quote = null, pageNum = null) {
    const pdfViewer = document.getElementById('pdfViewer');
    if (!pdfViewer) {
        console.warn('PDF查看器容器未找到');
        return;
    }
    
    // 移除之前的指示器（如果存在）
    const oldIndicators = pdfViewer.querySelectorAll('.pdf-jump-indicator');
    oldIndicators.forEach(ind => ind.remove());
    
    // 如果有quote，尝试在PDF页面中搜索文本位置
    if (quote && pageNum && AppState.pdfDocument) {
        try {
            const page = await AppState.pdfDocument.getPage(pageNum);
            const textContent = await page.getTextContent();
            const canvas = document.getElementById('pdfCanvas');
            if (!canvas) {
                console.warn('Canvas未找到');
                return;
            }
            
            // 获取当前视图的scale
            const viewport = page.getViewport({ scale: AppState.scale });
            
            // 清理quote文本（移除多余空格和换行）
            const cleanQuote = quote.replace(/\s+/g, ' ').trim().toLowerCase();
            const quoteWords = cleanQuote.split(' ').filter(w => w.length > 2);
            
            console.log('搜索文本:', cleanQuote);
            
            // 构建完整文本和位置映射
            let fullText = '';
            const itemPositions = [];
            
            textContent.items.forEach((item, idx) => {
                const startPos = fullText.length;
                const itemText = item.str;
                fullText += itemText + ' ';
                itemPositions.push({
                    startPos,
                    endPos: startPos + itemText.length,
                    transform: item.transform,
                    width: item.width,
                    height: item.height,
                    text: itemText
                });
            });
            
            const fullTextLower = fullText.toLowerCase();
            
            // 尝试精确匹配
            let matchIndex = fullTextLower.indexOf(cleanQuote);
            
            // 如果精确匹配失败，尝试模糊匹配（匹配前3个关键词）
            if (matchIndex === -1 && quoteWords.length > 0) {
                for (let i = Math.min(3, quoteWords.length); i > 0; i--) {
                    const searchPhrase = quoteWords.slice(0, i).join(' ');
                    matchIndex = fullTextLower.indexOf(searchPhrase);
                    if (matchIndex !== -1) {
                        console.log('模糊匹配成功:', searchPhrase);
                        break;
                    }
                }
            } else if (matchIndex !== -1) {
                console.log('精确匹配成功');
            }
            
            if (matchIndex !== -1) {
                // 找到匹配的文本项
                const matchedItem = itemPositions.find(item => 
                    matchIndex >= item.startPos && matchIndex < item.endPos
                );
                
                if (matchedItem) {
                    // PDF.js的transform格式: [a, b, c, d, e, f]
                    // e = x坐标, f = y坐标 (PDF坐标系，原点在左下角)
                    const [a, b, c, d, e, f] = matchedItem.transform;
                    
                    // 转换到canvas显示坐标系（原点在左上角）
                    // 使用canvas.style的宽高（显示尺寸），而不是canvas.width/height（实际像素）
                    const canvasDisplayWidth = parseFloat(canvas.style.width);
                    const canvasDisplayHeight = parseFloat(canvas.style.height);
                    
                    // PDF坐标转换为显示坐标
                    const displayX = e * AppState.scale;
                    const displayY = canvasDisplayHeight - (f * AppState.scale);
                    
                    console.log('匹配文本:', matchedItem.text);
                    console.log('PDF坐标:', { x: e, y: f });
                    console.log('显示坐标:', { x: displayX, y: displayY });
                    console.log('Canvas显示尺寸:', { width: canvasDisplayWidth, height: canvasDisplayHeight });
                    
                    // 创建高亮指示器（相对于canvas定位）
                    const indicator = document.createElement('div');
                    indicator.className = 'pdf-jump-indicator';
                    indicator.style.position = 'absolute';
                    // 相对于pdfViewer定位，需要加上canvas的偏移
                    const canvasOffsetLeft = canvas.offsetLeft;
                    const canvasOffsetTop = canvas.offsetTop;
                    indicator.style.left = `${canvasOffsetLeft + displayX}px`;
                    indicator.style.top = `${canvasOffsetTop + displayY - 50}px`; // 在文本上方50px
                    indicator.style.transform = 'translate(-50%, 0)';
                    indicator.innerHTML = '📍 这里';
                    
                    pdfViewer.style.position = 'relative';
                    pdfViewer.appendChild(indicator);
                    
                    // 2.5秒后移除
                    setTimeout(() => {
                        if (indicator.parentElement) {
                            indicator.remove();
                        }
                    }, 2500);
                    
                    return;
                }
            } else {
                console.warn('未找到匹配文本，尝试的搜索词:', quoteWords);
            }
        } catch (error) {
            console.error('文本定位失败:', error);
        }
    }
    
    // 如果没有quote或文本搜索失败，显示在中央
    const indicator = document.createElement('div');
    indicator.className = 'pdf-jump-indicator';
    indicator.innerHTML = '📍 已跳转到此页';
    
    pdfViewer.style.position = 'relative';
    pdfViewer.appendChild(indicator);
    
    // 2秒后自动移除指示器
    setTimeout(() => {
        if (indicator.parentElement) {
            indicator.remove();
        }
    }, 2000);
}

console.log('应用脚本已加载');
