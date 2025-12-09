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

        // Add Item Modal controls
        document.getElementById('cancelAddItem').addEventListener('click', () => this.closeAddItemModal());
        document.getElementById('saveAddItem').addEventListener('click', () => this.saveNewItem());
        document.getElementById('addItemModal').addEventListener('click', (e) => {
            if (e.target.id === 'addItemModal') this.closeAddItemModal();
        });
        
        // Item category change
        document.getElementById('itemCategory').addEventListener('change', (e) => {
            const customGroup = document.getElementById('customKeyGroup');
            customGroup.style.display = e.target.value === 'custom' ? 'block' : 'none';
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

        // 从本地存储恢复面板宽度
        this.restorePanelWidths(leftPanel, rightPanel);

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
            
            // 保存面板宽度到本地存储
            this.savePanelWidths(leftPanel, rightPanel);
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

    // 保存面板宽度到本地存储
    savePanelWidths(leftPanel, rightPanel) {
        try {
            const widths = {
                left: leftPanel.getBoundingClientRect().width,
                right: rightPanel.getBoundingClientRect().width,
                timestamp: Date.now()
            };
            localStorage.setItem('panelWidths', JSON.stringify(widths));
            console.log('💾 面板宽度已保存:', widths);
        } catch (error) {
            console.error('保存面板宽度失败:', error);
        }
    }

    // 从本地存储恢复面板宽度
    restorePanelWidths(leftPanel, rightPanel) {
        try {
            const saved = localStorage.getItem('panelWidths');
            if (saved) {
                const widths = JSON.parse(saved);
                
                // 应用保存的宽度
                leftPanel.style.width = `${widths.left}px`;
                leftPanel.style.flexShrink = '0';
                leftPanel.style.flexGrow = '0';
                
                rightPanel.style.width = `${widths.right}px`;
                rightPanel.style.flexShrink = '0';
                rightPanel.style.flexGrow = '0';
                
                console.log('✅ 面板宽度已恢复:', widths);
            }
        } catch (error) {
            console.error('恢复面板宽度失败:', error);
        }
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

        // Iterate through top-level sections with collapsible support
        for (const [sectionKey, sectionValue] of Object.entries(this.currentData)) {
            // 跳过_loc字段
            if (sectionKey.endsWith('_loc')) continue;
            
            const section = this.createCollapsibleSection(sectionKey, sectionValue, [sectionKey]);
            container.appendChild(section);
        }
        
        // 渲染完成后触发MathJax
        this.renderMath();
    }

    createCollapsibleSection(title, data, path) {
        const wrapper = document.createElement('div');
        wrapper.className = 'collapsible-section';

        // Header with toggle
        const header = document.createElement('div');
        header.className = 'collapsible-header active';
        header.innerHTML = `
            <span class="collapsible-title">${this.formatKey(title)}</span>
            <i class="fas fa-chevron-right collapsible-toggle"></i>
        `;
        
        // Content
        const content = document.createElement('div');
        content.className = 'collapsible-content active';
        
        const table = document.createElement('table');
        table.className = 'json-table';
        this.renderObject(data, table, path);
        content.appendChild(table);
        
        // Toggle functionality
        header.addEventListener('click', () => {
            const isActive = header.classList.toggle('active');
            content.classList.toggle('active');
        });
        
        wrapper.appendChild(header);
        wrapper.appendChild(content);
        
        return wrapper;
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
                    valueCell.innerHTML = this.createEditableValue(JSON.stringify(value), currentPath, locationInfo, key);
                } else {
                    // 嵌套对象：显示为格式化的 JSON
                    valueCell.innerHTML = this.createEditableValue(JSON.stringify(value, null, 2), currentPath, locationInfo, key);
                }
            } else {
                // 简单值（字符串、数字等）
                valueCell.innerHTML = this.createEditableValue(value, currentPath, locationInfo, key);
            }

            row.appendChild(keyCell);
            row.appendChild(valueCell);
            table.appendChild(row);
        }
    }

    createEditableValue(value, path, location = null, key = null) {
        const displayValue = typeof value === 'string' ? value : JSON.stringify(value);
        
        // 特殊处理: DOI 字段，添加 Web of Science 链接
        if (key === 'doi' && typeof value === 'string' && value.trim()) {
            const wosUrl = this.generateWosUrl(value.trim());
            return `<a href="${wosUrl}" target="_blank" class="doi-link" title="在 Web of Science 中查看">
                <i class="fas fa-external-link-alt"></i> ${this.escapeHtml(displayValue)}
            </a>`;
        }
        
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

    // 生成 Web of Science 查询链接
    generateWosUrl(doi) {
        if (!doi) return '';
        
        const query = [{
            rowText: `DO=${doi}`
        }];
        const jsonStr = encodeURIComponent(JSON.stringify(query));
        return `https://www.webofscience.com/wos/woscc/general-summary?queryJson=${jsonStr}`;
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

    // 获取当前PDF页码（用于调试）
    getCurrentPDFPage() {
        try {
            const pdfViewer = document.getElementById('pdfViewer');
            const pdfApp = pdfViewer?.contentWindow?.PDFViewerApplication;
            return pdfApp?.page || pdfApp?.pdfViewer?.currentPageNumber || 1;
        } catch (error) {
            console.error('Error getting current page:', error);
            return 1;
        }
    }

    // 跳转到指定页面并搜索（简化版：直接搜索全文，滚动到第一个结果）
    jumpToPage(page, searchText = '') {
        const pdfViewer = document.getElementById('pdfViewer');
        if (!pdfViewer || !this.currentPdfUrl) return;
        
        try {
            const cleanText = searchText ? searchText.trim() : '';
            
            console.log(`🔍 搜索文本并滚动到结果:`, cleanText);
            
            // 高亮右侧面板
            const rightPanel = document.querySelector('.right-panel');
            if (rightPanel) {
                rightPanel.classList.remove('panel-highlight');
                void rightPanel.offsetWidth;
                rightPanel.classList.add('panel-highlight');
                setTimeout(() => rightPanel.classList.remove('panel-highlight'), 800);
            }
            
            // 直接在iframe中搜索全文档
            const pdfWindow = pdfViewer.contentWindow;
            if (!pdfWindow || !pdfWindow.PDFViewerApplication) {
                console.error('❌ PDF.js未初始化');
                return;
            }
            
            const pdfApp = pdfWindow.PDFViewerApplication;
            
            // 如果有搜索文本，执行全文搜索并滚动
            if (cleanText) {
                this.executeSearchAndScroll(pdfApp, cleanText);
            } else if (page) {
                // 如果没有搜索文本，只跳转页码
                pdfApp.page = parseInt(page);
                this.showNotification(`📄 第 ${page} 页`, 'info');
            }
            
        } catch (error) {
            console.error('Error in search:', error);
            this.showNotification('❌ 操作失败', 'error');
        }
    }

    // 执行搜索并滚动到第一个结果（独立方法）
    executeSearchAndScroll(pdfApp, searchText) {
        if (!pdfApp || !pdfApp.eventBus) {
            console.error('❌ EventBus不可用');
            return;
        }
        
        console.log('🔍 全文搜索:', searchText);
        
        // 用于跟踪搜索结果
        let searchResult = {
            found: false,
            total: 0,
            notified: false
        };
        
        // 监听搜索状态
        const resultListener = (evt) => {
            console.log('📊 搜索状态:', evt);
            
            if (evt.state === 1) { // FOUND
                console.log('✅ 找到匹配');
                searchResult.found = true;
                
                // 搜索成功后，延迟滚动到第一个高亮文本中央
                setTimeout(() => {
                    this.scrollToFirstMatch(pdfApp);
                }, 400);
            } else if (evt.state === 3) { // NOT_FOUND
                console.log('⚠️ 未找到匹配');
                searchResult.found = false;
                // 不显示通知，只在控制台记录
            }
        };
        
        // 监听匹配数量
        const matchListener = (evt) => {
            console.log('📈 匹配数量:', evt.matchesCount);
            
            if (evt.matchesCount && evt.matchesCount.total > 0) {
                searchResult.total = evt.matchesCount.total;
                searchResult.found = true;
                
                // 找到匹配且还没显示过通知时才提示
                if (!searchResult.notified) {
                    searchResult.notified = true;
                    this.showNotification(`✅ 找到 ${evt.matchesCount.total} 处匹配`, 'success');
                }
            } else if (evt.matchesCount && evt.matchesCount.total === 0) {
                searchResult.total = 0;
                searchResult.found = false;
                // 不显示通知
            }
        };
        
        pdfApp.eventBus.on('updatefindcontrolstate', resultListener);
        pdfApp.eventBus.on('updatefindmatchescount', matchListener);
        
        // 清除旧搜索
        pdfApp.eventBus.dispatch('findbarclose');
        
        // 执行新搜索（搜索整个文档）
        setTimeout(() => {
            console.log('🔍 执行搜索命令...');
            pdfApp.eventBus.dispatch('find', {
                source: window,
                type: 'find',
                query: searchText,
                phraseSearch: true,        // 完整短语搜索
                caseSensitive: false,      // 不区分大小写
                highlightAll: true,        // 高亮所有匹配
                findPrevious: false        // 从前往后搜索
            });
            
            console.log('✅ 搜索命令已发送');
            
            // 10秒后清理监听器
            setTimeout(() => {
                pdfApp.eventBus.off('updatefindcontrolstate', resultListener);
                pdfApp.eventBus.off('updatefindmatchescount', matchListener);
            }, 10000);
        }, 200);
    }

    // 滚动到第一个匹配结果的中央（丝滑动画）
    scrollToFirstMatch(pdfApp) {
        try {
            const pdfViewer = pdfApp.pdfViewer;
            if (!pdfViewer) {
                console.warn('⚠️ pdfViewer不可用');
                return;
            }
            
            // 获取viewer容器（在iframe内部）
            const pdfWindow = pdfApp.eventBus._listeners ? 
                              document.querySelector('#pdfViewer').contentWindow : window;
            const viewerContainer = pdfWindow.document.querySelector('#viewerContainer');
            
            if (!viewerContainer) {
                console.warn('⚠️ 找不到viewerContainer');
                return;
            }
            
            // 查找第一个高亮元素（PDF.js的高亮class）
            const highlighted = viewerContainer.querySelector('.highlight.selected') || 
                               viewerContainer.querySelector('.highlight.begin') ||
                               viewerContainer.querySelector('.highlight');
            
            if (highlighted) {
                console.log('📍 找到第一个匹配，丝滑滚动到中央...');
                
                // 获取元素在容器中的位置
                const elementRect = highlighted.getBoundingClientRect();
                const containerRect = viewerContainer.getBoundingClientRect();
                
                // 计算元素中心相对于容器顶部的位置
                const elementCenterY = elementRect.top - containerRect.top + viewerContainer.scrollTop + elementRect.height / 2;
                
                // 计算视口中心位置
                const viewportCenterY = containerRect.height / 2;
                
                // 目标滚动位置：让元素中心对齐视口中心
                const targetScrollTop = elementCenterY - viewportCenterY;
                
                console.log(`📐 滚动参数: 当前=${viewerContainer.scrollTop}, 目标=${targetScrollTop}`);
                
                // 丝滑滚动动画
                viewerContainer.scrollTo({
                    top: Math.max(0, targetScrollTop),
                    behavior: 'smooth'
                });
                
                console.log('✅ 已触发丝滑滚动动画');
            } else {
                console.warn('⚠️ 未找到高亮元素，可能还在渲染中');
                // 如果第一次没找到，再重试一次
                setTimeout(() => {
                    this.scrollToFirstMatch(pdfApp);
                }, 300);
            }
        } catch (error) {
            console.error('❌ 滚动失败:', error);
        }
    }

    // 在当前页搜索文本（使用PDF.js API）
    searchInCurrentPage(pdfFrame, searchText, pageNumber) {
        try {
            const pdfWindow = pdfFrame.contentWindow;
            if (!pdfWindow) {
                console.warn('⚠️ 无法访问PDF iframe');
                return;
            }

            const cleanText = searchText.trim();
            if (!cleanText) return;

            console.log(`🔍 在第 ${pageNumber} 页搜索:`, cleanText);

            // 尝试多次，确保PDF.js已初始化
            let attempts = 0;
            const maxAttempts = 8;
            
            const trySearch = () => {
                attempts++;
                
                try {
                    const pdfApp = pdfWindow.PDFViewerApplication;
                    
                    if (!pdfApp || !pdfApp.pdfViewer) {
                        if (attempts < maxAttempts) {
                            console.log(`⏳ 等待PDF.js初始化... (${attempts}/${maxAttempts})`);
                            setTimeout(trySearch, 400);
                        } else {
                            console.error('❌ PDF.js初始化超时');
                        }
                        return;
                    }
                    
                    console.log('✅ PDF.js已就绪');
                    console.log('当前页:', pdfApp.page || pdfApp.pdfViewer.currentPageNumber);
                    console.log('FindController:', !!pdfApp.findController);
                    console.log('EventBus:', !!pdfApp.eventBus);
                    
                    // 方法1: 使用EventBus（更可靠）
                    if (pdfApp.eventBus) {
                        console.log('🎯 使用EventBus API搜索');
                        
                        // 设置搜索结果监听器
                        let resultListener = null;
                        let matchListener = null;
                        
                        resultListener = (evt) => {
                            console.log('📊 搜索状态更新:', evt);
                            if (evt.state === 1) { // FOUND
                                console.log('✅ 找到匹配');
                            } else if (evt.state === 3) { // NOT_FOUND
                                console.log('⚠️ 未找到匹配');
                            }
                        };
                        
                        matchListener = (evt) => {
                            console.log('📈 匹配数量:', evt.matchesCount);
                        };
                        
                        // 监听搜索结果
                        pdfApp.eventBus.on('updatefindcontrolstate', resultListener);
                        pdfApp.eventBus.on('updatefindmatchescount', matchListener);
                        
                        // 先关闭之前的搜索
                        try {
                            pdfApp.eventBus.dispatch('findbarclose');
                        } catch (e) {
                            console.log('清除旧搜索');
                        }
                        
                        // 延迟执行新搜索
                        setTimeout(() => {
                            console.log('🔍 执行搜索命令...');
                            pdfApp.eventBus.dispatch('find', {
                                source: window,
                                type: 'find',
                                query: cleanText,
                                phraseSearch: true,        // 完整短语搜索
                                caseSensitive: false,      // 不区分大小写
                                entireWord: false,         // 不要求完整单词
                                highlightAll: true,        // 高亮所有匹配
                                findPrevious: false        // 向前搜索
                            });
                            
                            console.log('✅ 搜索命令已发送');
                            
                            // 5秒后移除监听器
                            setTimeout(() => {
                                if (resultListener) {
                                    pdfApp.eventBus.off('updatefindcontrolstate', resultListener);
                                    pdfApp.eventBus.off('updatefindmatchescount', matchListener);
                                }
                            }, 5000);
                        }, 300);
                        
                        return;
                    }
                    
                    // 方法2: 使用FindController（备用）
                    if (pdfApp.findController) {
                        console.log('🎯 使用FindController搜索');
                        
                        try {
                            pdfApp.findController.executeCommand('find', {
                                query: cleanText,
                                phraseSearch: true,
                                caseSensitive: false,
                                entireWord: false,
                                highlightAll: true,
                                findPrevious: false
                            });
                            
                            console.log('✅ FindController搜索已执行');
                            
                            // 检查搜索状态
                            setTimeout(() => {
                                if (pdfApp.findController.state) {
                                    console.log('搜索状态:', pdfApp.findController.state);
                                }
                                if (pdfApp.findController.matchesCount) {
                                    console.log('匹配数量:', pdfApp.findController.matchesCount);
                                }
                            }, 1000);
                            
                        } catch (fcError) {
                            console.error('❌ FindController执行失败:', fcError);
                        }
                        
                        return;
                    }
                    
                    console.error('❌ 无可用的搜索API');
                    
                } catch (error) {
                    console.error('❌ 搜索执行失败:', error);
                }
            };
            
            // 开始尝试搜索
            trySearch();

        } catch (error) {
            console.error('❌ 搜索异常:', error);
        }
    }

    // Edit Functions
    openEditModal(path, currentValue) {
        this.editingPath = path;
        const lastKey = path[path.length - 1];
        document.getElementById('modalTitle').textContent = `编辑: ${this.formatKey(lastKey)}`;
        document.getElementById('editTextarea').value = currentValue;
        
        // 检查是否有对应的_loc字段
        const locSection = document.getElementById('locationEditSection');
        const pageInput = document.getElementById('editPageNumber');
        const quoteInput = document.getElementById('editQuote');
        
        // 获取location数据
        let current = this.currentData;
        for (let i = 0; i < path.length - 1; i++) {
            current = current[path[i]];
        }
        
        const locKey = lastKey + '_loc';
        if (current && current[locKey]) {
            // 有location数据，显示编辑区
            locSection.style.display = 'block';
            pageInput.value = current[locKey].pdf_page_index || '';
            quoteInput.value = current[locKey].quote || '';
        } else {
            // 无location数据，隐藏编辑区
            locSection.style.display = 'none';
            pageInput.value = '';
            quoteInput.value = '';
        }
        
        document.getElementById('editModal').classList.add('active');
    }

    closeEditModal() {
        document.getElementById('editModal').classList.remove('active');
        this.editingPath = null;
    }

    async saveEditedValue() {
        if (!this.editingPath) return;

        const newValue = document.getElementById('editTextarea').value;
        const pageNumber = document.getElementById('editPageNumber').value;
        const quote = document.getElementById('editQuote').value;
        
        // Update data
        let current = this.currentData;
        for (let i = 0; i < this.editingPath.length - 1; i++) {
            current = current[this.editingPath[i]];
        }
        
        const lastKey = this.editingPath[this.editingPath.length - 1];
        
        // Update主字段值
        try {
            if (newValue.trim().startsWith('{') || newValue.trim().startsWith('[')) {
                current[lastKey] = JSON.parse(newValue);
            } else {
                current[lastKey] = newValue;
            }
        } catch (e) {
            current[lastKey] = newValue;
        }

        // Update location数据（如果有输入）
        const locKey = lastKey + '_loc';
        if (pageNumber || quote) {
            if (!current[locKey]) {
                current[locKey] = {};
            }
            if (pageNumber) {
                current[locKey].pdf_page_index = parseInt(pageNumber);
            }
            if (quote) {
                current[locKey].quote = quote;
            }
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
        const addItemBtn = document.getElementById('addItemBtn');
        const fileNameEl = document.getElementById('currentFileName');
        
        if (saveBtn) {
            if (this.hasUnsavedChanges) {
                saveBtn.style.display = 'inline-block';
                saveBtn.innerHTML = '<i class="fas fa-save"></i> 保存修改';
            } else {
                saveBtn.style.display = 'none';
            }
        }
        
        // 显示/隐藏添加条目按钮
        if (addItemBtn) {
            addItemBtn.style.display = this.currentData ? 'inline-flex' : 'none';
        }
        
        // 更新文件名显示，标记未保存状态
        if (fileNameEl && this.currentFile) {
            fileNameEl.textContent = this.currentFile + (this.hasUnsavedChanges ? ' *' : '');
        }
    }

    // 添加新条目功能
    openAddItemModal() {
        // 重置表单
        document.getElementById('itemCategory').value = '';
        document.getElementById('customKey').value = '';
        document.getElementById('itemContent').value = '';
        document.getElementById('itemPageNumber').value = '';
        document.getElementById('itemQuote').value = '';
        document.getElementById('customKeyGroup').style.display = 'none';
        
        document.getElementById('addItemModal').classList.add('active');
    }

    closeAddItemModal() {
        document.getElementById('addItemModal').classList.remove('active');
    }

    saveNewItem() {
        const category = document.getElementById('itemCategory').value;
        const customKey = document.getElementById('customKey').value;
        const content = document.getElementById('itemContent').value;
        const pageNumber = document.getElementById('itemPageNumber').value;
        const quote = document.getElementById('itemQuote').value;

        if (!category) {
            this.showNotification('请选择分类', 'error');
            return;
        }

        if (category === 'custom' && !customKey) {
            this.showNotification('请输入自定义键名', 'error');
            return;
        }

        if (!content.trim()) {
            this.showNotification('请输入内容', 'error');
            return;
        }

        // 确定要使用的键名
        const key = category === 'custom' ? customKey : category;

        // 初始化数组（如果不存在）
        if (!this.currentData[key]) {
            this.currentData[key] = [];
        }

        // 构建新条目
        const newItem = content.trim();
        
        // 添加到数组
        if (Array.isArray(this.currentData[key])) {
            this.currentData[key].push(newItem);
            
            // 如果有页码或引用，添加location
            if (pageNumber || quote) {
                const locKey = key + '_loc';
                if (!this.currentData[locKey]) {
                    this.currentData[locKey] = [];
                }
                this.currentData[locKey].push({
                    pdf_page_index: pageNumber ? parseInt(pageNumber) : null,
                    quote: quote || ''
                });
            }
        } else {
            this.showNotification('该键已存在且不是数组类型', 'error');
            return;
        }

        // 标记为有未保存的修改
        this.hasUnsavedChanges = true;
        this.tempDataCache[this.currentFile] = this.currentData;
        this.updateSaveButtonState();

        // 重新渲染
        this.renderStructuredView();
        this.renderFlatView();
        this.setupEditableListeners();

        this.closeAddItemModal();
        this.showNotification(`✓ 已添加到 ${key}`, 'success');
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
                
                // 从 _loc 字段中获取 quote 作为搜索文本
                let searchText = '';
                if (valuePath) {
                    const pathArray = valuePath.split('.');
                    let current = this.currentData;
                    
                    // 导航到字段所在的父对象
                    for (let i = 0; i < pathArray.length - 1; i++) {
                        if (current && current.hasOwnProperty(pathArray[i])) {
                            current = current[pathArray[i]];
                        } else {
                            current = null;
                            break;
                        }
                    }
                    
                    if (current) {
                        const lastKey = pathArray[pathArray.length - 1];
                        const locKey = lastKey + '_loc';
                        
                        // 优先使用 _loc.quote 作为搜索文本
                        if (current[locKey] && current[locKey].quote) {
                            searchText = this.cleanQuoteForSearch(current[locKey].quote);
                            console.log('🔍 从 quote 获取搜索文本:', searchText);
                        } else {
                            // 如果没有 quote，使用字段值本身
                            const fieldValue = current[lastKey];
                            if (fieldValue !== null && fieldValue !== undefined) {
                                searchText = typeof fieldValue === 'string' ? fieldValue : JSON.stringify(fieldValue);
                                console.log('🔍 从字段值获取搜索文本:', searchText);
                            }
                        }
                    }
                }
                
                if (page && searchText) {
                    this.jumpToPage(page, searchText);
                } else if (page) {
                    // 只跳转，不搜索
                    this.jumpToPage(page, '');
                }
            });
        });
    }

    // 清理 quote 文本用于搜索
    cleanQuoteForSearch(quote) {
        if (!quote) return '';
        
        let cleanText = quote
            // 移除省略号
            .replace(/\.\.\./g, ' ')
            .replace(/…/g, ' ')
            // 移除换行符，合并为一行
            .replace(/[\r\n]+/g, ' ')
            // 移除多余的空白字符（tab、多个空格等）
            .replace(/\s+/g, ' ')
            // 移除首尾空格
            .trim()
            // 移除特殊的LaTeX或Markdown符号（如果有）
            .replace(/[\\${}]/g, '')
            // 标准化引号
            .replace(/[""]/g, '"')
            .replace(/['']/g, "'");
        
        console.log('📝 文本清理: 原文长度', quote.length, '→ 清理后长度', cleanText.length);
        
        // 如果文本太长，截取前200个字符（保持完整单词）
        if (cleanText.length > 200) {
            const truncated = cleanText.substring(0, 200);
            const lastSpace = truncated.lastIndexOf(' ');
            cleanText = lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated;
            console.log('✂️ 文本过长，截取前', cleanText.length, '个字符');
        }
        
        return cleanText;
    }
    
    // 根据路径从当前数据中获取location的quote（保留用于其他地方调用）
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
                const searchText = this.cleanQuoteForSearch(current[locKey].quote);
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
    
    // 暴露调试方法到全局
    window.debugPDFSearch = {
        // 直接搜索文本（在当前页）
        search: (text) => {
            const pdfViewer = document.getElementById('pdfViewer');
            if (!pdfViewer) {
                console.error('PDF viewer not found');
                return;
            }
            const currentPage = app.getCurrentPDFPage();
            app.searchInCurrentPage(pdfViewer, text, currentPage || 1);
        },
        
        // 跳转并搜索
        jumpAndSearch: (page, text) => {
            app.jumpToPage(page, text);
        },
        
        // 在指定页码搜索（不跳转，只搜索）
        searchAtPage: (page, text) => {
            const pdfApp = window.debugPDFSearch.getPDFApp();
            if (!pdfApp) {
                console.error('PDF.js not available');
                return;
            }
            
            console.log(`🎯 在第 ${page} 页搜索: "${text}"`);
            
            // 先跳转到指定页
            pdfApp.page = page;
            
            // 等待页面渲染后搜索
            setTimeout(() => {
                if (!pdfApp.eventBus) {
                    console.error('EventBus not available');
                    return;
                }
                
                // 监听器
                const resultListener = (evt) => {
                    console.log('📊 搜索状态:', evt);
                    if (evt.state === 1) console.log('✅ 找到匹配');
                    else if (evt.state === 3) console.log('⚠️ 未找到匹配');
                };
                const matchListener = (evt) => {
                    console.log('📈 匹配数量:', evt.matchesCount);
                };
                
                pdfApp.eventBus.on('updatefindcontrolstate', resultListener);
                pdfApp.eventBus.on('updatefindmatchescount', matchListener);
                
                // 清除旧搜索
                pdfApp.eventBus.dispatch('findbarclose');
                
                // 执行搜索
                setTimeout(() => {
                    pdfApp.eventBus.dispatch('find', {
                        source: window,
                        type: 'find',
                        query: text,
                        phraseSearch: true,
                        caseSensitive: false,
                        highlightAll: true,
                        findPrevious: false
                    });
                    
                    // 5秒后清理
                    setTimeout(() => {
                        pdfApp.eventBus.off('updatefindcontrolstate', resultListener);
                        pdfApp.eventBus.off('updatefindmatchescount', matchListener);
                    }, 5000);
                }, 300);
            }, 800);
        },
        
        // 获取PDF.js应用对象
        getPDFApp: () => {
            const pdfViewer = document.getElementById('pdfViewer');
            if (!pdfViewer) return null;
            return pdfViewer.contentWindow?.PDFViewerApplication;
        },
        
        // 直接调用EventBus搜索（在当前页）
        eventBusSearch: (text) => {
            const pdfApp = window.debugPDFSearch.getPDFApp();
            if (!pdfApp || !pdfApp.eventBus) {
                console.error('PDF.js EventBus not available');
                return;
            }
            
            console.log('🔍 直接调用EventBus搜索:', text);
            
            // 监听器
            const resultListener = (evt) => {
                console.log('📊 搜索状态:', evt);
            };
            const matchListener = (evt) => {
                console.log('📈 匹配数量:', evt.matchesCount);
            };
            
            pdfApp.eventBus.on('updatefindcontrolstate', resultListener);
            pdfApp.eventBus.on('updatefindmatchescount', matchListener);
            
            // 清除旧搜索
            pdfApp.eventBus.dispatch('findbarclose');
            
            // 执行搜索
            setTimeout(() => {
                pdfApp.eventBus.dispatch('find', {
                    source: window,
                    type: 'find',
                    query: text,
                    phraseSearch: true,
                    caseSensitive: false,
                    highlightAll: true,
                    findPrevious: false
                });
                
                // 5秒后清理
                setTimeout(() => {
                    pdfApp.eventBus.off('updatefindcontrolstate', resultListener);
                    pdfApp.eventBus.off('updatefindmatchescount', matchListener);
                }, 5000);
            }, 300);
        },
        
        // 获取当前页码
        getCurrentPage: () => {
            const pdfApp = window.debugPDFSearch.getPDFApp();
            return pdfApp?.page || pdfApp?.pdfViewer?.currentPageNumber || null;
        }
    };
    
    console.log('🔧 调试工具已加载，使用方法:');
    console.log('  debugPDFSearch.search("文本")              - 在当前页搜索');
    console.log('  debugPDFSearch.searchAtPage(3, "文本")    - 在第3页搜索（会先跳转）');
    console.log('  debugPDFSearch.jumpAndSearch(3, "文本")   - 跳转到第3页并搜索');
    console.log('  debugPDFSearch.eventBusSearch("文本")     - 直接调用EventBus（当前页）');
    console.log('  debugPDFSearch.getCurrentPage()           - 获取当前页码');
    console.log('  debugPDFSearch.getPDFApp()                - 获取PDF.js对象');
    
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
