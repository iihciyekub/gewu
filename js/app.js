// Import PDF.js (不再需要，使用iframe加载viewer)

class PaperReviewerApp {
    constructor() {
        this.currentFile = null;
        this.currentData = null;
        this.currentPdfUrl = null;
        this.editingPath = null;
        this.hasUnsavedChanges = false;
        this.tempDataCache = {}; // 临时数据缓存 {filename: data}

        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupResizers();
        await this.loadFileList();
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchView(e.target.closest('.tab-btn')));
        });

        // Modal controls
        document.getElementById('cancelEdit').addEventListener('click', () => this.closeEditModal());
        document.getElementById('saveEdit').addEventListener('click', () => this.saveEditedValue());
        document.getElementById('editModal').addEventListener('click', (e) => {
            if (e.target.id === 'editModal') this.closeEditModal();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                if (this.hasUnsavedChanges) this.saveToFile();
            }
            if (e.key === 'Escape') {
                this.closeEditModal();
            }
        });
    }

    setupResizers() {
        const leftResizer = document.getElementById('leftResizer');
        const middleResizer = document.getElementById('middleResizer');
        const leftPanel = document.querySelector('.left-panel');
        const middlePanel = document.querySelector('.middle-panel');
        const rightPanel = document.querySelector('.right-panel');
        const container = document.querySelector('.container');

        // 状态管理
        let state = {
            isResizing: false,
            currentResizer: null,
            startX: 0,
            startLeftWidth: 0,
            startRightWidth: 0,
            startMiddleWidth: 0,
            rafId: null,
            lastX: 0
        };

        // 最小宽度约束（像素）
        const MIN_PANEL_WIDTH = 100;

        const startResize = (e, resizer) => {
            // 阻止默认行为
            e.preventDefault();
            e.stopPropagation();
            
            state.isResizing = true;
            state.currentResizer = resizer;
            state.startX = e.clientX;
            state.lastX = e.clientX;
            
            // 记录初始宽度
            state.startLeftWidth = leftPanel.getBoundingClientRect().width;
            state.startMiddleWidth = middlePanel.getBoundingClientRect().width;
            state.startRightWidth = rightPanel.getBoundingClientRect().width;
            
            // 设置全局样式
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            document.body.style.webkitUserSelect = 'none';
            
            // 添加遮罩层防止 iframe 干扰
            container.classList.add('resizing');
        };

        const stopResize = () => {
            if (!state.isResizing) return;
            
            state.isResizing = false;
            state.currentResizer = null;
            
            // 取消待处理的动画帧
            if (state.rafId) {
                cancelAnimationFrame(state.rafId);
                state.rafId = null;
            }
            
            // 恢复样式
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.body.style.webkitUserSelect = '';
            container.classList.remove('resizing');
        };

        const performResize = (clientX) => {
            const delta = clientX - state.startX;
            const containerWidth = container.getBoundingClientRect().width;
            
            if (state.currentResizer === leftResizer) {
                // 调整左侧面板
                let newLeftWidth = state.startLeftWidth + delta;
                
                // 边界检查
                newLeftWidth = Math.max(MIN_PANEL_WIDTH, newLeftWidth);
                newLeftWidth = Math.min(containerWidth - MIN_PANEL_WIDTH * 2 - 10, newLeftWidth);
                
                leftPanel.style.width = `${newLeftWidth}px`;
                leftPanel.style.flexShrink = '0';
                leftPanel.style.flexGrow = '0';
                
            } else if (state.currentResizer === middleResizer) {
                // 调整右侧面板（反向）
                let newRightWidth = state.startRightWidth - delta;
                
                // 边界检查
                newRightWidth = Math.max(MIN_PANEL_WIDTH, newRightWidth);
                const maxRightWidth = containerWidth - state.startLeftWidth - MIN_PANEL_WIDTH - 10;
                newRightWidth = Math.min(maxRightWidth, newRightWidth);
                
                rightPanel.style.width = `${newRightWidth}px`;
                rightPanel.style.flexShrink = '0';
                rightPanel.style.flexGrow = '0';
                middlePanel.style.flex = '1';
                middlePanel.style.minWidth = '0';
            }
        };

        const resize = (e) => {
            if (!state.isResizing) return;
            
            // 防止重复的动画帧
            if (state.rafId) return;
            
            state.lastX = e.clientX;
            
            // 使用 requestAnimationFrame 确保流畅的 60fps
            state.rafId = requestAnimationFrame(() => {
                performResize(state.lastX);
                state.rafId = null;
            });
        };

        // 绑定事件
        leftResizer.addEventListener('mousedown', (e) => startResize(e, leftResizer));
        middleResizer.addEventListener('mousedown', (e) => startResize(e, middleResizer));
        
        document.addEventListener('mousemove', resize);
        document.addEventListener('mouseup', stopResize);
        
        // 防止文本选择
        [leftResizer, middleResizer].forEach(resizer => {
            resizer.addEventListener('selectstart', e => e.preventDefault());
            resizer.addEventListener('dragstart', e => e.preventDefault());
        });
        
        // 处理鼠标离开窗口的情况
        document.addEventListener('mouseleave', stopResize);
    }

    async loadFileList() {
        const fileListEl = document.getElementById('fileList');
        fileListEl.innerHTML = '<div class="loading"><div class="spinner"></div>Loading files...</div>';

        try {
            // Fetch the list of JSON files from user/data directory
            const response = await fetch('user/data/');
            const text = await response.text();
            
            // Parse directory listing (this is a simple approach, may need adjustment based on server)
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            const links = Array.from(doc.querySelectorAll('a'))
                .map(a => a.getAttribute('href'))
                .filter(href => href && href.endsWith('.json'));

            if (links.length === 0) {
                // Fallback: try known file
                const knownFiles = ['paper_1_data.json'];
                this.renderFileList(knownFiles);
            } else {
                this.renderFileList(links);
            }
        } catch (error) {
            console.error('Error loading file list:', error);
            // Fallback to known files
            const knownFiles = ['paper_1_data.json'];
            this.renderFileList(knownFiles);
        }
    }

    renderFileList(files) {
        const fileListEl = document.getElementById('fileList');
        fileListEl.innerHTML = '';

        if (files.length === 0) {
            fileListEl.innerHTML = '<div class="empty-state"><p>No JSON files found</p></div>';
            return;
        }

        files.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <i class="fas fa-file-alt"></i>
                <span>${file}</span>
            `;
            fileItem.addEventListener('click', function() {
                window.paperReviewerApp.loadFile(file, this);
            });
            fileListEl.appendChild(fileItem);

            // Auto-load first file
            if (index === 0) {
                setTimeout(() => {
                    window.paperReviewerApp.loadFile(file, fileItem);
                }, 100);
            }
        });
    }

    async loadFile(filename, clickedElement = null) {
        try {
            // 如果当前文件有未保存的修改，提示用户
            if (this.hasUnsavedChanges && this.currentFile) {
                const shouldSave = confirm(`文件 "${this.currentFile}" 有未保存的修改，是否保存？`);
                if (shouldSave) {
                    await this.saveToFile();
                } else {
                    // 放弃修改，清除临时缓存
                    delete this.tempDataCache[this.currentFile];
                }
            }

            // Remove active class from all items
            document.querySelectorAll('.file-item').forEach(item => {
                item.classList.remove('active');
            });

            // Add active class to clicked item
            if (clickedElement) {
                clickedElement.classList.add('active');
            }

            // Show loading state
            this.showLoading();

            // 优先从临时缓存加载，否则从文件加载
            if (this.tempDataCache[filename]) {
                this.currentData = this.tempDataCache[filename];
                this.hasUnsavedChanges = true;
            } else {
                // Fetch JSON file
                const response = await fetch(`user/data/${filename}`);
                if (!response.ok) throw new Error('Failed to load file');
                this.currentData = await response.json();
                this.hasUnsavedChanges = false;
            }
            
            this.currentFile = filename;

            // 更新UI状态
            this.updateSaveButtonState();

            // Render data
            this.renderStructuredView();
            this.renderFlatView();

            // Load PDF if available
            if (this.currentData.meta_info && this.currentData.meta_info.pdf_path) {
                const pdfPath = this.currentData.meta_info.pdf_path;
                // Convert path like "src/papers/joom.1169.pdf" to "user/papers/joom.1169.pdf"
                const pdfFile = pdfPath.split('/').pop();
                await this.loadPDF(`user/papers/${pdfFile}`);
            }
        } catch (error) {
            console.error('Error loading file:', error);
            alert(`Failed to load file: ${error.message}`);
        }
    }

    showLoading() {
        const structuredView = document.getElementById('structuredView');
        const flatView = document.getElementById('flatView');
        
        structuredView.innerHTML = '<div class="loading"><div class="spinner"></div>Loading data...</div>';
        flatView.innerHTML = '<div class="loading"><div class="spinner"></div>Loading data...</div>';
    }

    renderStructuredView() {
        const container = document.getElementById('structuredView');
        container.innerHTML = '';

        // Iterate through top-level sections
        for (const [sectionKey, sectionValue] of Object.entries(this.currentData)) {
            const section = this.createSection(sectionKey, sectionValue, [sectionKey]);
            container.appendChild(section);
        }
        
        // 渲染完成后触发MathJax
        this.renderMath();
    }

    createSection(title, data, path) {
        const section = document.createElement('div');
        section.className = 'json-section';

        const titleEl = document.createElement('div');
        titleEl.className = 'section-title';
        titleEl.textContent = this.formatKey(title);
        section.appendChild(titleEl);

        const table = document.createElement('table');
        table.className = 'json-table';

        this.renderObject(data, table, path);
        section.appendChild(table);

        return section;
    }

    renderObject(obj, table, basePath) {
        for (const [key, value] of Object.entries(obj)) {
            // 跳过 _loc 字段，它们会随主字段一起显示
            if (key.endsWith('_loc')) {
                continue;
            }

            const row = document.createElement('tr');
            const keyCell = document.createElement('td');
            const valueCell = document.createElement('td');

            keyCell.textContent = this.formatKey(key);
            const currentPath = [...basePath, key];

            // 检查是否有对应的 location 信息
            const locKey = key + '_loc';
            const locationInfo = obj[locKey] || null;

            // 处理值的显示
            if (typeof value === 'object' && value !== null) {
                if (Array.isArray(value)) {
                    // 数组：显示为 JSON 字符串
                    valueCell.innerHTML = this.createEditableValue(JSON.stringify(value), currentPath, locationInfo);
                } else {
                    // 嵌套对象：显示为格式化的 JSON
                    valueCell.innerHTML = this.createEditableValue(JSON.stringify(value, null, 2), currentPath, locationInfo);
                }
            } else {
                // 简单值（字符串、数字等）
                valueCell.innerHTML = this.createEditableValue(value, currentPath, locationInfo);
            }

            row.appendChild(keyCell);
            row.appendChild(valueCell);
            table.appendChild(row);
        }
    }

    createEditableValue(value, path, location = null) {
        const displayValue = typeof value === 'string' ? value : JSON.stringify(value);
        let html = `<span class="editable-value" data-path="${path.join('.')}">${this.escapeHtml(displayValue)}</span>`;
        
        if (location) {
            const page = location.pdf_page_index || 1;
            
            // 保存路径，点击时动态获取最新值作为搜索文本
            html += `<a href="#" class="location-link" 
                data-page="${page}" 
                data-value-path="${path.join('.')}"
                title="跳转到 PDF 第 ${page} 页并高亮文本">
                <i class="fa-regular fa-file-pdf"></i>
            </a>`;
        }

        return html;
    }

    renderFlatView() {
        const container = document.getElementById('flatView');
        container.innerHTML = '<div id="jsonViewer"></div>';

        // Use jQuery json-viewer
        $('#jsonViewer').jsonViewer(this.currentData, {
            collapsed: false,
            withQuotes: true,
            withLinks: true
        });
        
        // 渲染完成后触发MathJax
        this.renderMath();
    }
    
    // 触发MathJax渲染数学公式
    renderMath() {
        if (window.MathJax) {
            MathJax.typesetPromise().catch((err) => {
                console.error('MathJax rendering error:', err);
            });
        }
    }

    switchView(btn) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Switch views
        const view = btn.dataset.view;
        document.getElementById('structuredView').classList.remove('active');
        document.getElementById('flatView').classList.remove('active');

        if (view === 'structured') {
            document.getElementById('structuredView').classList.add('active');
        } else {
            document.getElementById('flatView').classList.add('active');
        }
    }

    formatKey(key) {
        return key
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // PDF Functions - 使用iframe加载完整的PDF.js viewer
    async loadPDF(url) {
        try {
            const pdfViewer = document.getElementById('pdfViewer');
            this.currentPdfUrl = url;
            
            // 使用PDF.js的web viewer
            // viewer.html在 js/pdfjs/web/ 目录，需要3个../才能回到根目录
            const viewerUrl = `js/pdfjs/web/viewer.html?file=${encodeURIComponent('../../../' + url)}`;
            pdfViewer.src = viewerUrl;
            
            this.showNotification('PDF 加载完成', 'success');
        } catch (error) {
            console.error('Error loading PDF:', error);
            this.showNotification(`PDF 加载失败: ${error.message}`, 'error');
        }
    }

    // 跳转到指定页面
    jumpToPage(page, searchText = '') {
        const pdfViewer = document.getElementById('pdfViewer');
        if (!pdfViewer || !this.currentPdfUrl) return;
        
        try {
            // 清理搜索文本
            const cleanText = searchText ? searchText.trim() : '';
            
            // 构建URL - 如果有搜索文本，添加到hash中
            let viewerUrl = `js/pdfjs/web/viewer.html?file=${encodeURIComponent('../../../' + this.currentPdfUrl)}#page=${page}`;
            
            if (cleanText) {
                // 使用PDF.js的search参数
                viewerUrl += `&search=${encodeURIComponent(cleanText)}`;
                console.log('🔍 跳转并搜索:', cleanText);
            }
            
            console.log('PDF URL:', viewerUrl);
            
            // 更新iframe URL
            pdfViewer.src = viewerUrl;
            
            // 高亮右侧面板
            const rightPanel = document.querySelector('.right-panel');
            if (rightPanel) {
                rightPanel.classList.remove('panel-highlight');
                void rightPanel.offsetWidth;
                rightPanel.classList.add('panel-highlight');
                
                setTimeout(() => {
                    rightPanel.classList.remove('panel-highlight');
                }, 800);
            }
            
            // 显示通知
            if (cleanText) {
                this.showNotification(`📄 跳转到第 ${page} 页并搜索文本`, 'info');
            } else {
                this.showNotification(`📄 跳转到第 ${page} 页`, 'info');
            }
            
        } catch (error) {
            console.error('Error jumping to page:', error);
            this.showNotification('❌ 跳转失败', 'error');
        }
    }

    // Edit Functions
    openEditModal(path, currentValue) {
        this.editingPath = path;
        document.getElementById('modalTitle').textContent = `Edit: ${this.formatKey(path[path.length - 1])}`;
        document.getElementById('editTextarea').value = currentValue;
        document.getElementById('editModal').classList.add('active');
    }

    closeEditModal() {
        document.getElementById('editModal').classList.remove('active');
        this.editingPath = null;
    }

    async saveEditedValue() {
        if (!this.editingPath) return;

        const newValue = document.getElementById('editTextarea').value;
        
        // Update data
        let current = this.currentData;
        for (let i = 0; i < this.editingPath.length - 1; i++) {
            current = current[this.editingPath[i]];
        }
        
        const lastKey = this.editingPath[this.editingPath.length - 1];
        
        // Try to parse as JSON if it looks like JSON
        try {
            if (newValue.trim().startsWith('{') || newValue.trim().startsWith('[')) {
                current[lastKey] = JSON.parse(newValue);
            } else {
                current[lastKey] = newValue;
            }
        } catch (e) {
            current[lastKey] = newValue;
        }

        // 标记为有未保存的修改
        this.hasUnsavedChanges = true;
        
        // 保存到临时缓存
        this.tempDataCache[this.currentFile] = this.currentData;
        
        // 显示保存按钮
        this.updateSaveButtonState();

        // Re-render views
        this.renderStructuredView();
        this.renderFlatView();
        this.setupEditableListeners();

        this.closeEditModal();
        
        // 提示已暂存
        this.showNotification('✓ 修改已暂存（未保存到文件）', 'info');
    }

    updateSaveButtonState() {
        const saveBtn = document.getElementById('saveBtn');
        const fileNameEl = document.getElementById('currentFileName');
        
        if (saveBtn) {
            if (this.hasUnsavedChanges) {
                saveBtn.style.display = 'inline-block';
                saveBtn.innerHTML = '<i class="fas fa-save"></i> 保存修改';
            } else {
                saveBtn.style.display = 'none';
            }
        }
        
        // 更新文件名显示，标记未保存状态
        if (fileNameEl && this.currentFile) {
            fileNameEl.textContent = this.currentFile + (this.hasUnsavedChanges ? ' *' : '');
        }
    }

    setupEditableListeners() {
        // Add double-click listeners to editable values
        document.querySelectorAll('.editable-value').forEach(el => {
            el.addEventListener('dblclick', () => {
                const path = el.dataset.path.split('.');
                const value = el.textContent;
                this.openEditModal(path, value);
            });
        });

        // Add click listeners to location links
        document.querySelectorAll('.location-link').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                const page = parseInt(el.dataset.page);
                const valuePath = el.dataset.valuePath;
                
                // 动态从当前数据中获取最新的字段值作为搜索文本
                let searchText = '';
                if (valuePath) {
                    const pathArray = valuePath.split('.');
                    let current = this.currentData;
                    
                    for (let key of pathArray) {
                        if (current && current.hasOwnProperty(key)) {
                            current = current[key];
                        } else {
                            current = null;
                            break;
                        }
                    }
                    
                    // 获取到最新的值
                    if (current !== null && current !== undefined) {
                        searchText = typeof current === 'string' ? current : JSON.stringify(current);
                        console.log('🔍 从路径获取最新搜索文本:', valuePath, '->', searchText);
                    }
                }
                
                if (page) {
                    this.jumpToPage(page, searchText);
                }
            });
        });
    }

    // 根据路径从当前数据中获取location的quote
    getSearchTextFromPath(pathString) {
        if (!pathString) {
            console.warn('getSearchTextFromPath: pathString is empty');
            return '';
        }
        
        const pathArray = pathString.split('.');
        
        try {
            // 获取对应的_loc字段
            let current = this.currentData;
            for (let i = 0; i < pathArray.length - 1; i++) {
                current = current[pathArray[i]];
                if (!current) {
                    console.warn(`Path not found at: ${pathArray.slice(0, i+1).join('.')}`);
                    return '';
                }
            }
            
            const lastKey = pathArray[pathArray.length - 1];
            const locKey = lastKey + '_loc';
            
            console.log('Searching for location:', { pathString, locKey, hasLoc: !!current[locKey] });
            
            if (current[locKey] && current[locKey].quote) {
                let searchText = current[locKey].quote
                    .replace(/\.\.\./g, '')  // 移除所有省略号
                    .replace(/\s+/g, ' ')    // 多个空格合并
                    .trim();
                
                console.log('Found quote:', searchText);
                return searchText;
            }
            
            console.warn('No quote found in location');
            return '';
        } catch (error) {
            console.error('Error getting search text:', error);
            return '';
        }
    }

    highlightTextInPDF(pdfFrame, searchText) {
        try {
            const pdfWindow = pdfFrame.contentWindow;
            if (!pdfWindow) {
                console.warn('无法访问PDF iframe窗口');
                return;
            }

            // 清理搜索文本
            const cleanText = searchText.trim();
            if (!cleanText) {
                return;
            }

            console.log('尝试在PDF中搜索文本:', cleanText);

            // 方法1: 使用window.find() API (适用于大多数浏览器)
            try {
                // 先清除之前的搜索
                if (pdfWindow.getSelection) {
                    pdfWindow.getSelection().removeAllRanges();
                }

                // 执行搜索 (参数: searchText, caseSensitive, backwards, wrapAround, wholeWord, searchInFrames, showDialog)
                const found = pdfWindow.find(cleanText, false, false, true, false, true, false);
                
                if (found) {
                    console.log('✅ 文本搜索成功');
                } else {
                    console.warn('⚠️ 未找到匹配文本');
                    // 尝试搜索部分文本（取前20个字符）
                    if (cleanText.length > 20) {
                        const partialText = cleanText.substring(0, 20);
                        console.log('尝试搜索部分文本:', partialText);
                        pdfWindow.find(partialText, false, false, true, false, true, false);
                    }
                }
            } catch (findError) {
                console.warn('window.find() 失败:', findError);
            }

            // 方法2: 尝试使用PDF.js自带的搜索功能
            try {
                const pdfViewerApp = pdfWindow.PDFViewerApplication;
                if (pdfViewerApp && pdfViewerApp.findController) {
                    console.log('使用PDF.js搜索功能');
                    pdfViewerApp.findController.executeCommand('find', {
                        query: cleanText,
                        caseSensitive: false,
                        highlightAll: true,
                        findPrevious: false
                    });
                }
            } catch (pdfError) {
                console.warn('PDF.js搜索失败:', pdfError);
            }

        } catch (error) {
            console.error('搜索高亮失败:', error);
        }
    }

    showNotification(message, type = 'info') {
        console.log(`${type.toUpperCase()}: ${message}`);
        
        // 创建美化的通知元素
        const notification = document.createElement('div');
        notification.className = `notification-toast ${type}`;
        
        // 添加图标
        let icon = 'fa-info-circle';
        if (type === 'success') icon = 'fa-check-circle';
        if (type === 'error') icon = 'fa-exclamation-circle';
        
        notification.innerHTML = `
            <i class="fas ${icon}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        // 自动移除
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    async saveToFile() {
        if (!this.currentFile || !this.currentData) return;

        try {
            const jsonString = JSON.stringify(this.currentData, null, 2);
            
            // 发送POST请求到服务器保存文件
            const response = await fetch('/save-json', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    filename: this.currentFile,
                    content: jsonString
                })
            });

            if (!response.ok) {
                throw new Error(`保存失败: ${response.statusText}`);
            }

            const result = await response.json();
            
            // 清除未保存标记和临时缓存
            this.hasUnsavedChanges = false;
            delete this.tempDataCache[this.currentFile];
            
            // 更新按钮状态
            this.updateSaveButtonState();

            // 成功通知
            this.showNotification(`✓ ${this.currentFile} 已保存`, 'success');
            console.log('File saved:', result);
        } catch (error) {
            console.error('Error saving file:', error);
            this.showNotification(`✗ 保存失败: ${error.message}`, 'error');
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new PaperReviewerApp();
    
    // Make app globally accessible for debugging
    window.paperReviewerApp = app;
    
    // Setup editable listeners after initial render
    setTimeout(() => {
        app.setupEditableListeners();
    }, 500);
    
    // 页面关闭/刷新前提示保存
    window.addEventListener('beforeunload', (e) => {
        if (app.hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = '您有未保存的修改，确定要离开吗？';
            return e.returnValue;
        }
    });
});

// Re-setup listeners when view changes
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('tab-btn')) {
        setTimeout(() => {
            window.paperReviewerApp.setupEditableListeners();
        }, 100);
    }
});
