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
    autoFitWidth: true,  // 自动适应宽度
    isEditMode: false    // 编辑模式
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
    
    // 初始化编辑对话框
    initializeEditDialog();
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
        themeToggle.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
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
    
    // 编辑模式切换
    document.getElementById('toggleEditMode').addEventListener('click', () => {
        toggleEditMode();
    });
    
    // 保存JSON
    document.getElementById('saveJson').addEventListener('click', () => {
        saveJsonData();
    });
    
    // 添加类别
    document.getElementById('addCategory').addEventListener('click', () => {
        addNewCategory();
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
        
        // 自动构建并加载PDF
        await autoLoadPdfFromDoi(data);
        
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

/**
 * 根据DOI自动查找并加载PDF
 */
async function autoLoadPdfFromDoi(data) {
    const pdfViewer = document.getElementById('pdfViewer');
    
    // 1. 首先尝试从JSON中读取显式指定的pdf_path
    let pdfPath = data.pdf_path || data.meta_info?.pdf_path || data.metadata?.pdf_path;
    
    // 2. 如果没有显式路径，尝试从DOI构建路径
    if (!pdfPath) {
        const doi = data.doi || data.meta_info?.doi || data.metadata?.doi;
        
        if (doi) {
            console.log('从DOI构建PDF路径:', doi);
            
            // 清理DOI - 将所有非字母数字和点号的字符替换为下划线
            const cleanDoi = sanitizeDoiForFilename(doi);
            
            // 构建可能的PDF文件名（按优先级排序）
            const possibleFilenames = [
                `${cleanDoi}.pdf`,                     // 完整清理后的DOI
                `${doi.split('/').pop()}.pdf`,         // DOI的最后部分（原样）
                sanitizeDoiForFilename(doi.split('/').pop()) + '.pdf', // DOI最后部分清理后
                `${doi.replace(/\//g, '_')}.pdf`,      // 简单替换斜杠（向后兼容）
                `${doi.replace(/\//g, '-')}.pdf`,      // 替换斜杠为连字符（向后兼容）
            ];
            
            // 去重
            const uniqueFilenames = [...new Set(possibleFilenames)];
            
            console.log('尝试的文件名:', uniqueFilenames);
            
            // 尝试查找存在的PDF文件
            for (const filename of uniqueFilenames) {
                const testPath = `./src/papers/${filename}`;
                const exists = await checkPdfExists(testPath);
                if (exists) {
                    pdfPath = testPath;
                    console.log('找到PDF文件:', testPath);
                    break;
                }
            }
            
            if (!pdfPath) {
                console.warn('未找到PDF文件，尝试的文件名:', uniqueFilenames);
            }
        }
    }
    
    // 3. 加载PDF或显示提示
    if (pdfPath) {
        await loadPdf(pdfPath);
    } else {
        pdfViewer.innerHTML = `
            <div class="placeholder">
                <div class="placeholder-icon"><i class="fas fa-file-pdf" style="font-size:48px;color:#adb5bd;"></i></div>
                <p>未找到PDF文件</p>
                <small>在 ./src/papers/ 目录中未找到对应的PDF</small>
                <button class="btn-primary" style="margin-top:12px;" onclick="document.getElementById('loadPdfBtn').click()">手动加载PDF</button>
            </div>
        `;
    }
}

/**
 * 检查PDF文件是否存在
 */
async function checkPdfExists(path) {
    try {
        const response = await fetch(path, { method: 'HEAD' });
        return response.ok;
    } catch (error) {
        return false;
    }
}

/**
 * 清理DOI字符串，使其成为有效的文件名
 * 将所有非字母数字、点号、连字符的字符替换为下划线
 */
function sanitizeDoiForFilename(doi) {
    if (!doi) return '';
    
    // 将所有非字母数字、点号、连字符的字符替换为下划线
    // 保留: a-z, A-Z, 0-9, ., -
    // 替换: / : ? # [ ] @ ! $ & ' ( ) * + , ; = % 空格等
    let sanitized = doi.replace(/[^a-zA-Z0-9.\-]/g, '_');
    
    // 移除连续的下划线
    sanitized = sanitized.replace(/_+/g, '_');
    
    // 移除开头和结尾的下划线
    sanitized = sanitized.replace(/^_+|_+$/g, '');
    
    return sanitized;
}

function renderJsonData(data, viewMode = 'hierarchical') {
    const dataDisplay = document.getElementById('dataDisplay');
    dataDisplay.innerHTML = '';
    
    if (viewMode === 'edit') {
        renderEditView(data, dataDisplay);
    } else if (viewMode === 'hierarchical') {
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
        'pdf_path': '<i class="fas fa-file-pdf"></i> PDF路径',
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
        'limitations': '<i class="fas fa-exclamation-circle"></i> 局限性',
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
                            <td class="field-value">${formatValue(value, key)}</td>
                        </tr>
                    </table>
                </div>
            `;
            container.appendChild(simpleSection);
            renderMath(simpleSection);
        }
    }
    
    // 如果没有找到任何内容，显示原始数据
    if (container.children.length === 0) {
        const section = createSection('<i class="fas fa-database"></i> 数据内容', data);
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
        renderMath(span);
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
        valueCell.dataset.fieldKey = key;
        
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
                const valueSpan = document.createElement('span');
                valueSpan.innerHTML = formatValue(value.value, key);
                valueCell.appendChild(valueSpan);
                renderMath(valueSpan);
                
                // 如果有配对的_loc字段，添加内联链接
                if (hasLocField) {
                    const locLink = createEvidenceLinks(obj[locKey]);
                    if (locLink) {
                        valueSpan.innerHTML += ' ' + locLink;
                    }
                }
            }
            
            // 显示evidence字段
            if (value.evidence) {
                const evidenceSpan = document.createElement('div');
                evidenceSpan.style.marginTop = '2px';
                evidenceSpan.innerHTML = createEvidenceLinks(value.evidence);
                valueCell.appendChild(evidenceSpan);
                renderMath(evidenceSpan);
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
                valueCell.innerHTML = formatValue(value, key);
                renderMath(valueCell);
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
            const valueSpan = document.createElement('span');
            valueSpan.innerHTML = formatValue(value, key);
            valueCell.appendChild(valueSpan);
            
            // 如果有_loc字段，添加内联跳转链接
            if (hasLocField) {
                const locLink = createEvidenceLinks(obj[locKey]);
                if (locLink) {
                    valueSpan.innerHTML += ' ' + locLink;
                }
            }
            renderMath(valueSpan);
        }
        
        row.appendChild(keyCell);
        row.appendChild(valueCell);
        
        // 添加双击编辑功能
        valueCell.style.cursor = 'pointer';
        valueCell.title = '双击编辑';
        valueCell.addEventListener('dblclick', () => {
            openEditDialog(key, value, obj, locKey);
        });
        
        table.appendChild(row);
    }
    
    container.appendChild(table);
}

// ========================================
// 编辑视图渲染
// ========================================

/**
 * 统一数据结构：
 * {
 *   "meta_info": { ... },
 *   "categories": [
 *     {
 *       "id": "did_design_setup",
 *       "title": "DID设计",
 *       "icon": "fas fa-flask",
 *       "items": [
 *         {
 *           "key": "model_type",
 *           "label": "模型类型",
 *           "value": "Staggered DID",
 *           "pdf_location": {
 *             "page_label": "2044",
 *             "pdf_page_index": 7,
 *             "pdf_open_params": "#page=7",
 *             "quote": "observe the implementation year..."
 *           }
 *         }
 *       ]
 *     }
 *   ]
 * }
 */

function renderEditView(data, container) {
    container.innerHTML = '';
    
    // 标准化数据结构
    const normalizedData = normalizeDataStructure(data);
    
    // 创建编辑容器
    const editContainer = document.createElement('div');
    editContainer.className = 'edit-container';
    editContainer.id = 'editContainer';
    
    // 渲染元信息
    if (normalizedData.meta_info) {
        const metaSection = createEditableSection('meta_info', '元信息', normalizedData.meta_info, true);
        editContainer.appendChild(metaSection);
    }
    
    // 渲染类别
    if (normalizedData.categories && normalizedData.categories.length > 0) {
        normalizedData.categories.forEach((category, index) => {
            const categorySection = createEditableCategory(category, index);
            editContainer.appendChild(categorySection);
        });
    }
    
    container.appendChild(editContainer);
    
    // 保存标准化数据到AppState
    AppState.normalizedData = normalizedData;
}

/**
 * 标准化数据结构 - 将旧格式转换为新格式
 */
function normalizeDataStructure(data) {
    // 如果已经是标准化格式
    if (data.categories && Array.isArray(data.categories)) {
        return data;
    }
    
    const normalized = {
        meta_info: data.meta_info || {},
        categories: []
    };
    
    // 类别映射
    const categoryMapping = {
        'did_design_setup': { title: 'DID设计', icon: 'fas fa-flask' },
        'data_metrics': { title: '数据指标', icon: 'fas fa-database' },
        'robustness_checks': { title: '稳健性检验', icon: 'fas fa-check-circle' },
        'key_findings': { title: '关键发现', icon: 'fas fa-star' },
        'identification_strategy': { title: '识别策略', icon: 'fas fa-bullseye' },
        'methodology': { title: '研究方法', icon: 'fas fa-cogs' },
        'results': { title: '研究结果', icon: 'fas fa-chart-line' }
    };
    
    // 遍历数据，提取类别
    for (const [key, value] of Object.entries(data)) {
        if (key === 'meta_info' || key === 'categories') continue;
        
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            const categoryInfo = categoryMapping[key] || { 
                title: formatKey(key), 
                icon: 'fas fa-folder' 
            };
            
            const items = [];
            
            // 提取items
            for (const [itemKey, itemValue] of Object.entries(value)) {
                if (itemKey.endsWith('_loc')) continue;
                
                const locKey = itemKey + '_loc';
                const pdfLocation = value[locKey] || null;
                
                items.push({
                    key: itemKey,
                    label: formatKey(itemKey),
                    value: typeof itemValue === 'object' ? JSON.stringify(itemValue) : itemValue,
                    pdf_location: pdfLocation
                });
            }
            
            normalized.categories.push({
                id: key,
                title: categoryInfo.title,
                icon: categoryInfo.icon,
                items: items
            });
        }
    }
    
    return normalized;
}

/**
 * 创建可编辑的类别区块
 */
function createEditableCategory(category, categoryIndex) {
    const section = document.createElement('div');
    section.className = 'edit-section';
    section.dataset.categoryId = category.id;
    section.dataset.categoryIndex = categoryIndex;
    
    // 类别标题栏
    const header = document.createElement('div');
    header.className = 'edit-section-header';
    header.innerHTML = `
        <div class="edit-section-title">
            <i class="${category.icon}"></i>
            <input type="text" class="category-title-input" value="${category.title}" data-field="title" />
        </div>
        <div class="edit-section-actions">
            <button class="btn-icon btn-add-item" title="添加项目"><i class="fas fa-plus"></i></button>
            <button class="btn-icon btn-delete-category" title="删除类别"><i class="fas fa-trash"></i></button>
        </div>
    `;
    
    // 类别内容
    const content = document.createElement('div');
    content.className = 'edit-section-content';
    
    // 渲染所有items
    category.items.forEach((item, itemIndex) => {
        const itemElement = createEditableItem(item, categoryIndex, itemIndex);
        content.appendChild(itemElement);
    });
    
    // 绑定事件
    header.querySelector('.btn-add-item').addEventListener('click', () => {
        addItemToCategory(categoryIndex);
    });
    
    header.querySelector('.btn-delete-category').addEventListener('click', () => {
        deleteCategory(categoryIndex);
    });
    
    header.querySelector('.category-title-input').addEventListener('change', (e) => {
        updateCategoryTitle(categoryIndex, e.target.value);
    });
    
    section.appendChild(header);
    section.appendChild(content);
    
    return section;
}

/**
 * 创建可编辑的项目
 */
function createEditableItem(item, categoryIndex, itemIndex) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'edit-item';
    itemDiv.dataset.itemIndex = itemIndex;
    
    const pdfLoc = item.pdf_location || {};
    
    itemDiv.innerHTML = `
        <div class="edit-item-header">
            <div class="edit-item-label">
                <input type="text" class="item-label-input" value="${escapeHtml(item.label)}" placeholder="标签" />
                <span class="item-key-display">(${item.key})</span>
            </div>
            <button class="btn-icon btn-delete-item" title="删除项目"><i class="fas fa-times"></i></button>
        </div>
        <div class="edit-item-body">
            <div class="edit-field">
                <label>Key:</label>
                <input type="text" class="item-key-input" value="${escapeHtml(item.key)}" placeholder="字段key" />
            </div>
            <div class="edit-field">
                <label>Value:</label>
                <textarea class="item-value-input" rows="2" placeholder="值">${escapeHtml(item.value || '')}</textarea>
            </div>
            <div class="edit-field-group">
                <div class="edit-field edit-field-small">
                    <label>页码标签:</label>
                    <input type="text" class="item-page-label-input" value="${escapeHtml(pdfLoc.page_label || '')}" placeholder="2044" />
                </div>
                <div class="edit-field edit-field-small">
                    <label>页面索引:</label>
                    <input type="number" class="item-page-index-input" value="${pdfLoc.pdf_page_index || ''}" placeholder="7" />
                </div>
            </div>
            <div class="edit-field">
                <label>引用文本:</label>
                <textarea class="item-quote-input" rows="2" placeholder="PDF中的引用文本">${escapeHtml(pdfLoc.quote || '')}</textarea>
            </div>
            ${pdfLoc.pdf_page_index ? `<a href="#" class="evidence-link pdf-icon-link" data-page-index="${pdfLoc.pdf_page_index}" data-quote="${escapeHtml(pdfLoc.quote || '')}" title="跳转到PDF"><i class="fas fa-file-pdf"></i> 预览</a>` : ''}
        </div>
    `;
    
    // 绑定删除按钮
    itemDiv.querySelector('.btn-delete-item').addEventListener('click', () => {
        deleteItem(categoryIndex, itemIndex);
    });
    
    // 绑定所有输入框的change事件
    itemDiv.querySelectorAll('input, textarea').forEach(input => {
        input.addEventListener('change', (e) => {
            updateItemData(categoryIndex, itemIndex, e.target);
        });
    });
    
    return itemDiv;
}

/**
 * 创建可编辑的区块（用于meta_info）
 */
function createEditableSection(id, title, data, isMetaInfo = false) {
    const section = document.createElement('div');
    section.className = 'edit-section';
    section.dataset.sectionId = id;
    
    const header = document.createElement('div');
    header.className = 'edit-section-header';
    header.innerHTML = `
        <div class="edit-section-title">
            <i class="fas fa-info-circle"></i>
            <span>${title}</span>
        </div>
    `;
    
    const content = document.createElement('div');
    content.className = 'edit-section-content';
    
    const table = document.createElement('table');
    table.className = 'edit-meta-table';
    
    for (const [key, value] of Object.entries(data)) {
        if (key.endsWith('_loc')) continue;
        
        const row = document.createElement('tr');
        
        const locKey = key + '_loc';
        const hasLoc = data[locKey];
        
        let displayValue = value;
        if (typeof value === 'object' && value !== null) {
            displayValue = JSON.stringify(value, null, 2);
        }
        
        row.innerHTML = `
            <td class="meta-key">${formatKey(key)}</td>
            <td class="meta-value">
                <input type="text" class="meta-value-input" value="${escapeHtml(displayValue)}" data-key="${key}" />
                ${hasLoc ? `<a href="#" class="evidence-link pdf-icon-link" data-page-index="${hasLoc.pdf_page_index}" data-quote="${escapeHtml(hasLoc.quote || '')}" title="跳转到PDF"><i class="fas fa-file-pdf"></i></a>` : ''}
            </td>
        `;
        
        table.appendChild(row);
    }
    
    content.appendChild(table);
    section.appendChild(header);
    section.appendChild(content);
    
    // 绑定输入框事件
    section.querySelectorAll('.meta-value-input').forEach(input => {
        input.addEventListener('change', (e) => {
            updateMetaInfo(e.target.dataset.key, e.target.value);
        });
    });
    
    return section;
}

// ========================================
// 编辑操作函数
// ========================================

function toggleEditMode() {
    AppState.isEditMode = !AppState.isEditMode;
    
    const toggleBtn = document.getElementById('toggleEditMode');
    const saveBtn = document.getElementById('saveJson');
    const addCategoryBtn = document.getElementById('addCategory');
    const viewMode = document.getElementById('viewMode');
    
    if (AppState.isEditMode) {
        toggleBtn.style.background = '#4caf50';
        toggleBtn.style.color = 'white';
        toggleBtn.title = '退出编辑模式';
        saveBtn.style.display = 'inline-block';
        addCategoryBtn.style.display = 'inline-block';
        viewMode.value = 'edit';
        
        if (AppState.currentJsonData) {
            renderJsonData(AppState.currentJsonData, 'edit');
        }
    } else {
        toggleBtn.style.background = '';
        toggleBtn.style.color = '';
        toggleBtn.title = '切换编辑模式';
        saveBtn.style.display = 'none';
        addCategoryBtn.style.display = 'none';
        viewMode.value = 'hierarchical';
        
        if (AppState.currentJsonData) {
            renderJsonData(AppState.currentJsonData, 'hierarchical');
        }
    }
}

function updateMetaInfo(key, value) {
    if (!AppState.normalizedData) return;
    
    try {
        // 尝试解析JSON
        AppState.normalizedData.meta_info[key] = JSON.parse(value);
    } catch {
        // 如果不是JSON，直接存储字符串
        AppState.normalizedData.meta_info[key] = value;
    }
    
    console.log('更新meta_info:', key, value);
}

function updateCategoryTitle(categoryIndex, newTitle) {
    if (!AppState.normalizedData || !AppState.normalizedData.categories[categoryIndex]) return;
    
    AppState.normalizedData.categories[categoryIndex].title = newTitle;
    console.log('更新类别标题:', categoryIndex, newTitle);
}

function updateItemData(categoryIndex, itemIndex, inputElement) {
    if (!AppState.normalizedData || !AppState.normalizedData.categories[categoryIndex]) return;
    
    const category = AppState.normalizedData.categories[categoryIndex];
    if (!category.items[itemIndex]) return;
    
    const item = category.items[itemIndex];
    const className = inputElement.className;
    
    if (className.includes('item-label-input')) {
        item.label = inputElement.value;
    } else if (className.includes('item-key-input')) {
        item.key = inputElement.value;
        // 更新key显示
        const itemDiv = inputElement.closest('.edit-item');
        const keyDisplay = itemDiv.querySelector('.item-key-display');
        if (keyDisplay) keyDisplay.textContent = `(${inputElement.value})`;
    } else if (className.includes('item-value-input')) {
        item.value = inputElement.value;
    } else if (className.includes('item-page-label-input')) {
        if (!item.pdf_location) item.pdf_location = {};
        item.pdf_location.page_label = inputElement.value;
    } else if (className.includes('item-page-index-input')) {
        if (!item.pdf_location) item.pdf_location = {};
        item.pdf_location.pdf_page_index = parseInt(inputElement.value) || null;
        item.pdf_location.pdf_open_params = `#page=${inputElement.value}`;
    } else if (className.includes('item-quote-input')) {
        if (!item.pdf_location) item.pdf_location = {};
        item.pdf_location.quote = inputElement.value;
    }
    
    console.log('更新项目数据:', categoryIndex, itemIndex, item);
}

function addNewCategory() {
    if (!AppState.normalizedData) {
        AppState.normalizedData = { meta_info: {}, categories: [] };
    }
    
    if (!AppState.normalizedData.categories) {
        AppState.normalizedData.categories = [];
    }
    
    const newCategory = {
        id: `category_${Date.now()}`,
        title: '新类别',
        icon: 'fas fa-folder',
        items: []
    };
    
    AppState.normalizedData.categories.push(newCategory);
    
    // 重新渲染
    renderJsonData(AppState.normalizedData, 'edit');
}

function addItemToCategory(categoryIndex) {
    if (!AppState.normalizedData || !AppState.normalizedData.categories[categoryIndex]) return;
    
    const newItem = {
        key: `new_field_${Date.now()}`,
        label: '新字段',
        value: '',
        pdf_location: null
    };
    
    AppState.normalizedData.categories[categoryIndex].items.push(newItem);
    
    // 重新渲染
    renderJsonData(AppState.normalizedData, 'edit');
}

function deleteCategory(categoryIndex) {
    if (!AppState.normalizedData || !AppState.normalizedData.categories[categoryIndex]) return;
    
    if (confirm('确定要删除这个类别吗？')) {
        AppState.normalizedData.categories.splice(categoryIndex, 1);
        renderJsonData(AppState.normalizedData, 'edit');
    }
}

function deleteItem(categoryIndex, itemIndex) {
    if (!AppState.normalizedData || !AppState.normalizedData.categories[categoryIndex]) return;
    
    const category = AppState.normalizedData.categories[categoryIndex];
    if (!category.items[itemIndex]) return;
    
    if (confirm('确定要删除这个项目吗？')) {
        category.items.splice(itemIndex, 1);
        renderJsonData(AppState.normalizedData, 'edit');
    }
}

async function saveJsonData() {
    if (!AppState.normalizedData || !AppState.currentJsonFile) {
        alert('没有数据可保存');
        return;
    }
    
    // 转换回原始格式
    const originalFormat = convertToOriginalFormat(AppState.normalizedData);
    
    try {
        const response = await fetch('/api/save-json', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filename: AppState.currentJsonFile,
                data: originalFormat
            })
        });
        
        if (!response.ok) {
            throw new Error(`保存失败: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            alert('保存成功！');
            // 更新当前数据
            AppState.currentJsonData = originalFormat;
        } else {
            alert('保存失败: ' + (result.error || '未知错误'));
        }
    } catch (error) {
        console.error('保存JSON失败:', error);
        alert('保存失败: ' + error.message);
    }
}

/**
 * 将标准化格式转换回原始格式
 */
function convertToOriginalFormat(normalizedData) {
    const original = {
        meta_info: normalizedData.meta_info || {}
    };
    
    // 转换categories回原始结构
    if (normalizedData.categories) {
        normalizedData.categories.forEach(category => {
            const categoryData = {};
            
            category.items.forEach(item => {
                categoryData[item.key] = item.value;
                
                if (item.pdf_location && item.pdf_location.pdf_page_index) {
                    categoryData[item.key + '_loc'] = item.pdf_location;
                }
            });
            
            original[category.id] = categoryData;
        });
    }
    
    return original;
}

// ========================================
// 双击编辑对话框功能
// ========================================

let currentEditContext = null;

/**
 * 打开编辑对话框
 */
function openEditDialog(key, value, parentObj, locKey) {
    const dialog = document.getElementById('editDialog');
    const fieldNameDisplay = dialog.querySelector('.field-name-display');
    const valueInput = document.getElementById('dialogValueInput');
    const pageLabelInput = document.getElementById('dialogPageLabel');
    const pageIndexInput = document.getElementById('dialogPageIndex');
    const quoteInput = document.getElementById('dialogQuote');
    
    // 保存编辑上下文
    currentEditContext = {
        key: key,
        parentObj: parentObj,
        locKey: locKey
    };
    
    // 填充当前值
    fieldNameDisplay.textContent = formatKey(key);
    
    // 处理value
    let displayValue = value;
    if (typeof value === 'object' && value !== null) {
        if (value.value !== undefined) {
            displayValue = value.value;
        } else {
            displayValue = JSON.stringify(value, null, 2);
        }
    }
    valueInput.value = displayValue || '';
    
    // 填充PDF位置信息
    const locData = parentObj[locKey];
    if (locData && typeof locData === 'object') {
        pageLabelInput.value = locData.page_label || '';
        pageIndexInput.value = locData.pdf_page_index || '';
        quoteInput.value = locData.quote || '';
    } else {
        pageLabelInput.value = '';
        pageIndexInput.value = '';
        quoteInput.value = '';
    }
    
    // 显示对话框
    dialog.style.display = 'flex';
    valueInput.focus();
    valueInput.select();
}

/**
 * 关闭编辑对话框
 */
function closeEditDialog() {
    const dialog = document.getElementById('editDialog');
    dialog.style.display = 'none';
    currentEditContext = null;
}

/**
 * 保存对话框中的编辑
 */
async function saveDialogEdit() {
    if (!currentEditContext) return;
    
    const valueInput = document.getElementById('dialogValueInput');
    const pageLabelInput = document.getElementById('dialogPageLabel');
    const pageIndexInput = document.getElementById('dialogPageIndex');
    const quoteInput = document.getElementById('dialogQuote');
    
    const { key, parentObj, locKey } = currentEditContext;
    
    // 更新值
    const newValue = valueInput.value.trim();
    try {
        // 尝试解析JSON
        parentObj[key] = JSON.parse(newValue);
    } catch {
        // 如果不是JSON，直接存储字符串
        parentObj[key] = newValue;
    }
    
    // 更新或创建_loc字段
    const pageIndex = parseInt(pageIndexInput.value);
    const pageLabel = pageLabelInput.value.trim();
    const quote = quoteInput.value.trim();
    
    if (pageIndex && pageLabel) {
        parentObj[locKey] = {
            page_label: pageLabel,
            pdf_page_index: pageIndex,
            pdf_open_params: `#page=${pageIndex}`,
            quote: quote
        };
    } else if (parentObj[locKey]) {
        // 如果清空了必需字段，删除_loc
        if (!pageIndex && !pageLabel) {
            delete parentObj[locKey];
        }
    }
    
    // 关闭对话框
    closeEditDialog();
    
    // 自动保存
    await autoSaveJsonData();
    
    // 重新渲染当前视图
    const viewMode = document.getElementById('viewMode').value;
    if (AppState.currentJsonData) {
        renderJsonData(AppState.currentJsonData, viewMode);
    }
}

/**
 * 自动保存JSON数据
 */
async function autoSaveJsonData() {
    if (!AppState.currentJsonData || !AppState.currentJsonFile) {
        console.warn('没有数据可保存');
        return;
    }
    
    try {
        const response = await fetch('/api/save-json', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filename: AppState.currentJsonFile,
                data: AppState.currentJsonData
            })
        });
        
        if (!response.ok) {
            throw new Error(`保存失败: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            // 显示保存成功提示
            showToast('保存成功', 'success');
            console.log('自动保存成功:', AppState.currentJsonFile);
        } else {
            showToast('保存失败: ' + (result.error || '未知错误'), 'error');
        }
    } catch (error) {
        console.error('自动保存失败:', error);
        showToast('保存失败: ' + error.message, 'error');
    }
}

/**
 * 显示Toast提示
 */
function showToast(message, type = 'info') {
    // 移除旧的toast
    const oldToast = document.querySelector('.toast-message');
    if (oldToast) oldToast.remove();
    
    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    // 触发动画
    setTimeout(() => toast.classList.add('show'), 10);
    
    // 3秒后移除
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// 绑定对话框事件
function initializeEditDialog() {
    const dialog = document.getElementById('editDialog');
    if (!dialog) return;
    
    // 关闭按钮
    dialog.querySelector('.btn-close-dialog').addEventListener('click', closeEditDialog);
    dialog.querySelector('.btn-cancel-dialog').addEventListener('click', closeEditDialog);
    
    // 保存按钮
    dialog.querySelector('.btn-save-dialog').addEventListener('click', saveDialogEdit);
    
    // 点击遮罩关闭
    dialog.querySelector('.edit-dialog-overlay').addEventListener('click', closeEditDialog);
    
    // ESC键关闭
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && dialog.style.display === 'flex') {
            closeEditDialog();
        }
    });
    
    // Ctrl+Enter保存
    dialog.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey && dialog.style.display === 'flex') {
            saveDialogEdit();
        }
    });
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
        valueCell.innerHTML = formatValue(item.value, item.key);
        renderMath(valueCell);
        
        const evidenceCell = document.createElement('td');
        evidenceCell.style.fontSize = '11px';
        evidenceCell.innerHTML = item.evidence ? createEvidenceLinks(item.evidence) : '-';
        renderMath(evidenceCell);
        
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

/**
 * 生成 Web of Science 查询链接
 * @param {string} doi - DOI 标识符
 * @returns {string} Web of Science 查询 URL
 */
function generateWosUrl(doi) {
    if (!doi) return '';
    
    const query = [{
        rowText: `DO=${doi}`
    }];
    const jsonStr = encodeURIComponent(JSON.stringify(query));
    return `https://www.webofscience.com/wos/woscc/general-summary?queryJson=${jsonStr}`;
}

/**
 * 将 DOI 渲染为可点击的链接
 * @param {string} doi - DOI 标识符
 * @returns {string} HTML 链接字符串
 */
function renderDoiLink(doi) {
    if (!doi) return '<span style="color: #adb5bd;">-</span>';
    
    const wosUrl = generateWosUrl(doi);
    return `<a href="${wosUrl}" target="_blank" class="doi-link" title="在 Web of Science 中查看">
        <i class="fas fa-external-link-alt"></i> ${escapeHtml(doi)}
    </a>`;
}

function formatKey(key) {
    return key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

function formatValue(value, key = null) {
    if (value === null || value === undefined) {
        return '<span style="color: #adb5bd;">-</span>';
    }
    
    // 特殊处理: 如果 key 是 doi，渲染为 WoS 链接
    if (key === 'doi' && typeof value === 'string') {
        return renderDoiLink(value);
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
            const title = `跳转到第${pageLabel || pageIndex}页${quote ? '\n' + quote : ''}`;
            return `<a href="#" class="evidence-link pdf-icon-link" data-page-index="${pageIndex}" data-quote="${escapeHtml(quote)}" title="${escapeHtml(title)}"><i class="fas fa-file-pdf"></i></a>`;
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

/**
 * 渲染元素中的 LaTeX 数学公式
 * @param {HTMLElement} element - 需要渲染数学公式的元素
 */
function renderMath(element) {
    if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([element]).catch((err) => {
            console.warn('MathJax 渲染失败:', err);
        });
    }
}

/**
 * 渲染整个页面的数学公式
 */
function renderAllMath() {
    if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise().catch((err) => {
            console.warn('MathJax 渲染失败:', err);
        });
    }
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
        
        // 清空pdfViewer内容
        pdfViewer.innerHTML = '';
        
        // 创建连续页面容器
        const pagesContainer = document.createElement('div');
        pagesContainer.id = 'pdfPagesContainer';
        pagesContainer.style.display = 'flex';
        pagesContainer.style.flexDirection = 'column';
        pagesContainer.style.alignItems = 'center';
        pagesContainer.style.gap = '20px';
        pagesContainer.style.padding = '20px 0';
        pdfViewer.appendChild(pagesContainer);
        
        // 渲染所有页面
        await renderAllPages();
        
    } catch (error) {
        console.error('加载PDF失败:', error);
        pdfViewer.innerHTML = `
            <div class="placeholder">
                <div class="placeholder-icon"><i class="fas fa-exclamation-triangle" style="font-size:48px;color:#e74c3c;"></i></div>
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
            
            // 清空pdfViewer内容
            pdfViewer.innerHTML = '';
            
            // 创建连续页面容器
            const pagesContainer = document.createElement('div');
            pagesContainer.id = 'pdfPagesContainer';
            pagesContainer.style.display = 'flex';
            pagesContainer.style.flexDirection = 'column';
            pagesContainer.style.alignItems = 'center';
            pagesContainer.style.gap = '20px';
            pagesContainer.style.padding = '20px 0';
            pdfViewer.appendChild(pagesContainer);
            
            // 渲染所有页面
            await renderAllPages();
        };
        
        fileReader.onerror = function() {
            throw new Error('文件读取失败');
        };
        
        fileReader.readAsArrayBuffer(file);
        
    } catch (error) {
        console.error('加载PDF文件失败:', error);
        pdfViewer.innerHTML = `
            <div class="placeholder">
                <div class="placeholder-icon"><i class="fas fa-exclamation-triangle" style="font-size:48px;color:#e74c3c;"></i></div>
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

/**
 * 渲染所有PDF页面（连续滚动模式）
 */
async function renderAllPages() {
    if (!AppState.pdfDocument) return;
    
    const pagesContainer = document.getElementById('pdfPagesContainer');
    if (!pagesContainer) return;
    
    const pdfViewer = document.getElementById('pdfViewer');
    const viewerWidth = pdfViewer.clientWidth - 40;
    
    try {
        for (let pageNum = 1; pageNum <= AppState.totalPages; pageNum++) {
            const page = await AppState.pdfDocument.getPage(pageNum);
            
            // 计算缩放比例
            let scale = AppState.scale;
            if (AppState.autoFitWidth) {
                const viewport = page.getViewport({ scale: 1.0 });
                const scaleToFit = viewerWidth / viewport.width;
                scale = Math.min(scaleToFit, AppState.scale);
            }
            
            const viewport = page.getViewport({ scale: scale });
            
            // 创建页面容器
            const pageContainer = document.createElement('div');
            pageContainer.className = 'pdf-page-container';
            pageContainer.dataset.pageNumber = pageNum;
            pageContainer.style.position = 'relative';
            pageContainer.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
            pageContainer.style.background = 'white';
            
            // 创建canvas
            const canvas = document.createElement('canvas');
            canvas.className = 'pdf-page-canvas';
            canvas.dataset.pageNumber = pageNum;
            
            const context = canvas.getContext('2d');
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
            
            await page.render(renderContext).promise;
            
            // 添加页码标签
            const pageLabel = document.createElement('div');
            pageLabel.className = 'pdf-page-label';
            pageLabel.textContent = `第 ${pageNum} / ${AppState.totalPages} 页`;
            pageLabel.style.position = 'absolute';
            pageLabel.style.top = '5px';
            pageLabel.style.right = '5px';
            pageLabel.style.background = 'rgba(0,0,0,0.6)';
            pageLabel.style.color = 'white';
            pageLabel.style.padding = '2px 8px';
            pageLabel.style.borderRadius = '3px';
            pageLabel.style.fontSize = '11px';
            pageLabel.style.pointerEvents = 'none';
            
            pageContainer.appendChild(canvas);
            pageContainer.appendChild(pageLabel);
            pagesContainer.appendChild(pageContainer);
        }
    } catch (error) {
        console.error('渲染PDF页面失败:', error);
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
    
    // 在连续滚动模式下，滚动到对应页面
    const pageContainer = document.querySelector(`[data-page-number="${pageNum}"]`);
    if (pageContainer) {
        pageContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        // 显示跳转高亮指示器
        await showJumpIndicator(quote, pageNum, pageContainer);
    }
    
    updatePageInfo();
    
    return true;
}

// ========================================
// 证据链接点击处理
// ========================================

document.addEventListener('click', (e) => {
    // 查找最近的 evidence-link 元素（处理点击图标的情况）
    const link = e.target.closest('.evidence-link');
    
    if (link) {
        e.preventDefault();
        
        // 优先使用pdf_page_index（从1开始）
        let pageNum = parseInt(link.dataset.pageIndex);
        
        // 如果没有pageIndex，使用page（页码标签）
        if (!pageNum || isNaN(pageNum)) {
            pageNum = parseInt(link.dataset.page);
        }
        
        if (pageNum && !isNaN(pageNum)) {
            const quote = link.dataset.quote || null;
            
            if (!AppState.pdfDocument) {
                console.warn('PDF未加载，尝试自动加载PDF');
                // 尝试自动查找并加载PDF
                autoLoadPdfFromDoi(AppState.currentJsonData).then(() => {
                    if (AppState.pdfDocument) {
                        jumpToPdfPage(pageNum, true, quote);
                    } else {
                        alert('未找到关联的PDF文件，请点击右上角📁按钮手动加载');
                    }
                });
                return;
            }
            
            jumpToPdfPage(pageNum, true, quote);
            
            // 高亮链接并滚动到视图
            link.style.backgroundColor = '#ffeb3b';
            setTimeout(() => {
                link.style.backgroundColor = '';
            }, 1000);
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
async function showJumpIndicator(quote = null, pageNum = null, pageContainer = null) {
    const pdfViewer = document.getElementById('pdfViewer');
    if (!pdfViewer) {
        console.warn('PDF查看器容器未找到');
        return;
    }
    
    // 移除之前的指示器（如果存在）
    const oldIndicators = pdfViewer.querySelectorAll('.pdf-jump-indicator');
    oldIndicators.forEach(ind => ind.remove());
    
    // 如果没有传入pageContainer，尝试找到它
    if (!pageContainer && pageNum) {
        pageContainer = document.querySelector(`.pdf-page-container[data-page-number="${pageNum}"]`);
    }
    
    if (!pageContainer) {
        console.warn('未找到页面容器');
        return;
    }
    
    // 如果有quote，尝试在PDF页面中搜索文本位置
    if (quote && pageNum && AppState.pdfDocument) {
        try {
            const page = await AppState.pdfDocument.getPage(pageNum);
            const textContent = await page.getTextContent();
            const canvas = pageContainer.querySelector('canvas');
            if (!canvas) return;
            
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
                    
                    // 创建高亮指示器（相对于pageContainer定位）
                    const indicator = document.createElement('div');
                    indicator.className = 'pdf-jump-indicator';
                    indicator.style.position = 'absolute';
                    // 相对于pageContainer定位，需要加上canvas的偏移
                    const canvasOffsetLeft = canvas.offsetLeft;
                    const canvasOffsetTop = canvas.offsetTop;
                    indicator.style.left = `${canvasOffsetLeft + displayX}px`;
                    indicator.style.top = `${canvasOffsetTop + displayY - 50}px`; // 在文本上方50px
                    indicator.style.transform = 'translate(-50%, 0)';
                    indicator.innerHTML = '<i class="fas fa-location-dot"></i> 这里';
                    
                    pageContainer.style.position = 'relative';
                    pageContainer.appendChild(indicator);
                    
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
    indicator.innerHTML = '<i class="fas fa-location-dot"></i> 已跳转到此页';
    
    pageContainer.style.position = 'relative';
    pageContainer.appendChild(indicator);
    
    // 2秒后自动移除指示器
    setTimeout(() => {
        if (indicator.parentElement) {
            indicator.remove();
        }
    }, 2000);
}

console.log('应用脚本已加载');
