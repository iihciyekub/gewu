// Import PDF.js (不再需要，使用iframe加载viewer)

class PaperReviewerApp {
    constructor() {
        this.currentFile = null;
        this.currentData = null;
        this.currentPdfUrl = null;
        this.currentPdfPath = null; // 记录PDF相对于项目的路径
        this.currentPdfViewerUrl = null;
        this.editingPath = null;
        this.isReorderMode = false; // 表格拖拽重排模式
        this.isCollapseAll = false; // 折叠全部开关
        this.reorderSelected = null; // { path: [], key }
        this.lastPasteBackup = null; // { file, data }
        this.hasUnsavedChanges = false;
        this.tempDataCache = {}; // 临时数据缓存 {filename: data}
        this.currentQuoteIndex = {}; // 跟踪每个字段当前显示的quote索引 {valuePath: index}
        this.lastSearchText = null; // 跟踪上次搜索的文本
        this.lastSearchValuePath = null; // 跟踪上次搜索的字段路径
        this.searchMatchCount = 0; // 当前搜索的匹配数量
        this.currentMatchIndex = 0; // 当前显示的匹配索引
        this.previewHoverTimer = null; // 类预览悬停防抖
        this.currentMarkdownText = '';
        this.currentMarkdownFile = '';
        this.markdownParser = null;
        this.currentMarkdownExists = false;
        this.isMarkdownEditing = false;
        this.saveMdEndpoint = '/save-md';

        // 项目管理
        this.currentProject = null; // { name, path }
        this.recentProjects = [];

        this.init();
    }

    async init() {
        // 先加载项目配置
        this.loadProjectConfig();
        
        // 如果没有当前项目，显示项目选择器
        if (!this.currentProject) {
            this.showProjectSelector();
        } else {
            // 有项目则正常初始化
            await this.initializeProject();
        }
        
        this.setupEventListeners();
        this.setupResizers();
        this.setupDraggableModal();
    }

    async initializeProject() {
        // 更新UI显示当前项目
        this.updateProjectDisplay();
        
        // 加载文件列表
        await this.loadFileList();
    }
    
    // 加载项目配置
    loadProjectConfig() {
        try {
            const config = localStorage.getItem('reviewerProjectConfig');
            if (config) {
                const data = JSON.parse(config);
                this.currentProject = data.currentProject;
                this.recentProjects = data.recentProjects || [];
            }
        } catch (error) {
            console.error('Failed to load project config:', error);
        }
    }
    
    // 保存项目配置
    saveProjectConfig() {
        try {
            const config = {
                currentProject: this.currentProject,
                recentProjects: this.recentProjects
            };
            localStorage.setItem('reviewerProjectConfig', JSON.stringify(config));
        } catch (error) {
            console.error('Failed to save project config:', error);
        }
    }
    
    // 更新项目显示
    updateProjectDisplay() {
        const nameEl = document.getElementById('currentProjectName');
        
        if (this.currentProject) {
            nameEl.textContent = this.currentProject.name;
            nameEl.title = this.currentProject.path; // 显示完整路径作为tooltip
        } else {
            nameEl.textContent = '未加载项目';
            nameEl.title = '';
        }
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchView(e.target.closest('.tab-btn')));
        });
        const createMdBtn = document.getElementById('createMarkdownBtn');
        if (createMdBtn) {
            createMdBtn.addEventListener('click', () => this.createMarkdownFile());
        }
        const editMdBtn = document.getElementById('editMarkdownBtn');
        if (editMdBtn) {
            editMdBtn.addEventListener('click', () => this.toggleMarkdownEdit(true));
        }
        const saveMdBtn = document.getElementById('saveMarkdownBtn');
        if (saveMdBtn) {
            saveMdBtn.addEventListener('click', () => this.saveMarkdownFromEditor());
        }

        // Modal controls
        document.getElementById('cancelEdit').addEventListener('click', () => this.closeEditModal());
        document.getElementById('saveEdit').addEventListener('click', () => this.saveEditedValue());
        document.getElementById('deleteEdit').addEventListener('click', () => this.deleteCurrentField());
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
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                // 同键切换：重排模式 + 折叠/展开全局开关
                this.isReorderMode = !this.isReorderMode;
                this.isCollapseAll = !this.isCollapseAll;
                this.reorderSelected = null;
                this.renderStructuredView();
                this.setupEditableListeners();
                this.updateAllSectionsCollapseState(this.isCollapseAll);
                const msg = [
                    this.isReorderMode ? '排序模式开启（拖动左侧列调整顺序）' : '排序模式关闭',
                    this.isCollapseAll ? '已折叠全部' : '已展开全部'
                ].join(' | ');
                this.showNotification(msg, 'info');
                return;
            }
            if (this.isReorderMode && this.reorderSelected && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                e.preventDefault();
                const offset = e.key === 'ArrowUp' ? -1 : 1;
                this.moveKey(this.reorderSelected.path, this.reorderSelected.key, offset);
            }
            if (e.key === 'Escape') {
                this.closeEditModal();
                this.closeProjectSelector();
            }
        });

        // 项目选择器事件
        document.getElementById('projectFolderInput').addEventListener('change', (e) => {
            const files = e.target.files;
            if (files.length > 0) {
                const folderPath = files[0].webkitRelativePath.split('/')[0];
                const fullPath = files[0].path ? files[0].path.replace(/\/[^/]+$/, '') : folderPath;
                document.getElementById('projectPathInput').value = fullPath;
            }
        });

        document.getElementById('loadProjectBtn').addEventListener('click', () => {
            this.loadSelectedProject();
        });

        // 复制 wosAide.js 源码
        const copyWosAideBtn = document.getElementById('copyWosAideBtn');
        if (copyWosAideBtn) {
            copyWosAideBtn.addEventListener('click', () => this.copyWosAideSource());
        }
        const undoPasteBtn = document.getElementById('undoPasteBtn');
        if (undoPasteBtn) {
            undoPasteBtn.addEventListener('click', () => this.undoLastPaste());
        }

        // 粘贴事件监听
        document.addEventListener('paste', (e) => this.handlePaste(e));

        // PDF.js 内置全屏模式快捷入口
        const pdfFullscreenBtn = document.getElementById('btnPdfJsFullscreen');
        if (pdfFullscreenBtn) {
            pdfFullscreenBtn.addEventListener('click', () => this.enterPdfJsFullscreen());
        }

        // PDF.js 内置下载快捷入口
        const pdfDownloadBtn = document.getElementById('btnPdfJsDownload');
        if (pdfDownloadBtn) {
            pdfDownloadBtn.addEventListener('click', () => this.downloadCurrentPdf());
        }
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

        // 绑定拖动事件，点击resizer-toggle时不触发拖动
        leftResizer.addEventListener('mousedown', (e) => {
            if (e.target.closest('.resizer-toggle')) return; // 点击toggle时不拖动
            startResize(e, leftResizer);
        });
        middleResizer.addEventListener('mousedown', (e) => {
            if (e.target.closest('.resizer-toggle')) return;
            startResize(e, middleResizer);
        });

        // 只在点击图标时触发隐藏/显示，采用width收缩/展开方式
        let lastLeftWidth = leftPanel.getBoundingClientRect().width || 200;
        let lastRightWidth = rightPanel.getBoundingClientRect().width || 320;
        const leftToggle = leftResizer.querySelector('.resizer-toggle');
        if (leftToggle) {
            leftToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const icon = leftToggle.querySelector('i');
                if (leftPanel.classList.contains('panel-collapsed')) {
                    leftPanel.classList.remove('panel-collapsed');
                    leftPanel.style.width = lastLeftWidth + 'px';
                    leftToggle.title = '点击隐藏左侧面板';
                    if (icon) icon.style.transform = 'rotate(0deg)';
                } else {
                    lastLeftWidth = leftPanel.getBoundingClientRect().width;
                    leftPanel.classList.add('panel-collapsed');
                    leftPanel.style.width = '';
                    leftToggle.title = '点击显示左侧面板';
                    if (icon) icon.style.transform = 'rotate(180deg)';
                }
            });
        }
        const middleToggle = middleResizer.querySelector('.resizer-toggle');
        if (middleToggle) {
            middleToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const icon = middleToggle.querySelector('i');
                if (rightPanel.classList.contains('panel-collapsed')) {
                    rightPanel.classList.remove('panel-collapsed');
                    // 若之前宽度为0，默认恢复为容器宽度的33%
                    if (!lastRightWidth || lastRightWidth <= 1) {
                        const containerWidth = container?.getBoundingClientRect().width || window.innerWidth;
                        lastRightWidth = Math.max(200, Math.floor(containerWidth * 0.33));
                    }
                    rightPanel.style.width = lastRightWidth + 'px';
                    middleToggle.title = '点击隐藏右侧面板';
                    if (icon) icon.style.transform = 'rotate(0deg)';
                } else {
                    lastRightWidth = rightPanel.getBoundingClientRect().width;
                    rightPanel.classList.add('panel-collapsed');
                    rightPanel.style.width = '';
                    middleToggle.title = '点击显示右侧面板';
                    if (icon) icon.style.transform = 'rotate(180deg)';
                }
            });
        }
        
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

    // ========== 项目管理方法 ==========
    
    showProjectSelector() {
        this.renderRecentProjects();
        document.getElementById('projectSelectorModal').classList.add('active');
    }
    
    closeProjectSelector() {
        document.getElementById('projectSelectorModal').classList.remove('active');
    }
    
    renderRecentProjects() {
        const container = document.getElementById('recentProjectsContent');
        
        if (this.recentProjects.length === 0) {
            container.innerHTML = `
                <div class="empty-recent-projects">
                    <i class="fas fa-folder-open"></i>
                    <p>暂无最近使用的项目</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = '';
        this.recentProjects.forEach(project => {
            const item = document.createElement('div');
            item.className = 'recent-project-item';
            item.innerHTML = `
                <i class="fas fa-folder"></i>
                <a class="recent-project-path" href="file://${this.escapeHtml(project.path)}" target="_blank" title="打开项目目录（本机）">
                    ${this.escapeHtml(project.path)}
                </a>
            `;
            item.addEventListener('click', () => {
                if (confirm(`切换到项目: ${project.path} ?`)) {
                    this.switchProject(project);
                }
            });
            // 阻止子链接触发切换
            const link = item.querySelector('.recent-project-path');
            if (link) {
                link.addEventListener('click', (e) => e.stopPropagation());
            }
            container.appendChild(item);
        });
    }

    setupDraggableModal() {
        const modal = document.getElementById('editModal');
        const content = modal?.querySelector('.modal-content');
        const handle = modal?.querySelector('.modal-header');
        if (!modal || !content || !handle) return;

        const onMouseDown = (e) => {
            e.preventDefault();
            const rect = content.getBoundingClientRect();
            let startX = e.clientX;
            let startY = e.clientY;
            let startLeft = rect.left;
            let startTop = rect.top;

            content.style.position = 'fixed';
            content.style.transform = 'none';
            content.style.left = `${startLeft}px`;
            content.style.top = `${startTop}px`;

            const onMouseMove = (evt) => {
                const dx = evt.clientX - startX;
                const dy = evt.clientY - startY;
                content.style.left = `${startLeft + dx}px`;
                content.style.top = `${startTop + dy}px`;
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        handle.addEventListener('mousedown', onMouseDown);
    }
    
    async loadSelectedProject() {
        const pathInput = document.getElementById('projectPathInput');
        const projectPath = pathInput.value.trim();
        
        if (!projectPath) {
            this.showNotification('✗ 请选择项目文件夹', 'error');
            return;
        }
        
        // 提取项目名称（最后一个文件夹名）
        const pathParts = projectPath.replace(/\\/g, '/').split('/').filter(p => p);
        const projectName = pathParts[pathParts.length - 1];
        
            const project = {
                name: projectName,
                path: this.normalizeProjectPathString(projectPath)
            };
        
        await this.switchProject(project);
    }
    
    async switchProject(project) {
        try {
            // 验证项目结构
            const response = await fetch('/validate-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectPath: project.path })
            });
            
            if (!response.ok) {
                throw new Error('项目验证失败');
            }
            
            const result = await response.json();
            
            if (!result.valid) {
                this.showNotification(`✗ 无效的项目结构: ${result.message}`, 'error');
                return;
            }
            
            // 保存当前项目
            this.currentProject = project;
            
            // 更新最近项目列表
            this.updateRecentProjects(project);
            
            // 保存配置
            this.saveProjectConfig();
            
            // 更新UI
            this.updateProjectDisplay();
            
            // 关闭选择器
            this.closeProjectSelector();
            
            // 清空当前状态
            this.currentFile = null;
            this.currentData = null;
            this.currentPdfUrl = null;
            this.hasUnsavedChanges = false;
            this.tempDataCache = {};
            
            // 重新加载文件列表
            await this.loadFileList();
            
            this.showNotification(`✓ 已加载项目: ${project.name}`, 'success');
        } catch (error) {
            console.error('Error switching project:', error);
            this.showNotification(`✗ 加载项目失败: ${error.message}`, 'error');
        }
    }
    
    updateRecentProjects(project) {
        // 移除已存在的相同项目
        const normalizedPath = this.normalizeProjectPathString(project.path);
        const normalizedProject = { ...project, path: normalizedPath };

        this.recentProjects = this.recentProjects.filter(
            p => this.normalizeProjectPathString(p.path) !== normalizedPath
        );
        
        // 添加到开头
        this.recentProjects.unshift(normalizedProject);
        
        // 最多保留5个
        if (this.recentProjects.length > 5) {
            this.recentProjects = this.recentProjects.slice(0, 5);
        }
    }

    async loadFileList(keepSelection = false) {
        const fileListEl = document.getElementById('fileList');
        const currentSelected = this.currentFile; // 保存当前选中的文件
        
        // 检查是否有当前项目
        if (!this.currentProject) {
            fileListEl.innerHTML = '<div class="empty-state"><p>请先加载项目</p></div>';
            return;
        }
        
        if (!keepSelection) {
            fileListEl.innerHTML = '<div class="loading"><div class="spinner"></div>Loading files...</div>';
        }

        try {
            // 获取文件列表 API，传递项目路径
            const response = await fetch('/list-json-files', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectPath: this.currentProject.path })
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch file list');
            }
            
            const data = await response.json();
            const files = data.files || [];
            
            this.renderFileList(files, keepSelection ? currentSelected : null);
        } catch (error) {
            console.error('Error loading file list:', error);
            this.showNotification('✗ 加载文件列表失败', 'error');
            fileListEl.innerHTML = '<div class="empty-state"><p>加载失败，请检查服务器</p></div>';
        }
    }

    renderFileList(files, keepSelected = null) {
        const fileListEl = document.getElementById('fileList');
        
        if (files.length === 0) {
            fileListEl.innerHTML = '<div class="empty-state"><p>暂无JSON文件</p></div>';
            return;
        }

        // 获取当前已存在的文件项
        const existingItems = new Map();
        Array.from(fileListEl.querySelectorAll('.file-item')).forEach(item => {
            const filename = item.dataset.filename;
            if (filename) existingItems.set(filename, item);
        });
        
        // 按文件名排序
        const sortedFiles = [...files].sort();
        
        // 创建新的文件列表结构
        const newFileListEl = document.createElement('div');
        
        sortedFiles.forEach((file, index) => {
            let fileItem;
            const displayName = file.replace(/\.[^.]+$/, '');
            
            // 复用现有的DOM元素
            if (existingItems.has(file)) {
                fileItem = existingItems.get(file);
                existingItems.delete(file); // 标记为已使用
                const span = fileItem.querySelector('span');
                if (span) span.textContent = displayName;
                fileItem.dataset.filename = file;
            } else {
                // 创建新元素
                fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                fileItem.dataset.filename = file;
                fileItem.innerHTML = `
                    <i class="fas fa-file-alt"></i>
                    <span>${displayName}</span>
                `;
                
                // 左键点击加载文件
                fileItem.addEventListener('click', function() {
                    window.paperReviewerApp.loadFile(file, this);
                });
                
                // 右键菜单
                fileItem.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    window.paperReviewerApp.showFileContextMenu(e, file, fileItem);
                });
            }
            
            // 保持或恢复选中状态
            if (keepSelected && file === keepSelected) {
                fileItem.classList.add('active');
            } else if (!keepSelected && index === 0 && !this.currentFile) {
                // 首次加载，自动选择第一个文件
                setTimeout(() => {
                    window.paperReviewerApp.loadFile(file, fileItem);
                }, 100);
            }
            
            newFileListEl.appendChild(fileItem);
        });
        
        // 一次性替换整个列表（最小化重排）
        fileListEl.innerHTML = '';
        fileListEl.appendChild(newFileListEl);
    }

    // 显示文件右键菜单
    showFileContextMenu(e, filename, fileItem) {
        // 移除旧菜单
        const oldMenu = document.querySelector('.context-menu');
        if (oldMenu) oldMenu.remove();
        
        // 创建菜单
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = `${e.pageX}px`;
        menu.style.top = `${e.pageY}px`;
        menu.innerHTML = `
            <div class="context-menu-item" data-action="rename">
                <i class="fas fa-edit"></i> 重命名
            </div>
            <div class="context-menu-item" data-action="delete">
                <i class="fas fa-trash"></i> 删除
            </div>
        `;
        
        document.body.appendChild(menu);
        
        // 菜单项点击事件
        menu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                menu.remove();
                
                if (action === 'rename') {
                    this.renameFile(filename, fileItem);
                } else if (action === 'delete') {
                    this.deleteFile(filename, fileItem);
                }
            });
        });
        
        // 点击其他地方关闭菜单
        setTimeout(() => {
            document.addEventListener('click', function closeMenu() {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            });
        }, 0);
    }

    // 重命名文件
    async renameFile(oldFilename, fileItem) {
        const newFilename = prompt('请输入新文件名:', oldFilename);
        if (!newFilename || newFilename === oldFilename) return;
        
        // 确保文件名以.json结尾
        const finalFilename = newFilename.endsWith('.json') ? newFilename : newFilename + '.json';
        
        try {
            const response = await fetch('/rename-json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectPath: this.currentProject ? this.currentProject.path : 'user',
                    oldFilename: oldFilename,
                    newFilename: finalFilename
                })
            });
            
            if (!response.ok) throw new Error('重命名失败');
            
            this.showNotification(`✓ 已重命名为 ${finalFilename}`, 'success');
            
            // 如果当前打开的是这个文件，更新当前文件名
            if (this.currentFile === oldFilename) {
                this.currentFile = finalFilename;
            }
            
            // 优雅更新：只更新文件名显示，保持选中状态
            const span = fileItem.querySelector('span');
            if (span) {
                span.textContent = finalFilename;
            }
            
            // 更新点击事件处理中的文件名引用（重新绑定）
            const newFileItem = fileItem.cloneNode(true);
            newFileItem.addEventListener('click', function() {
                window.paperReviewerApp.loadFile(finalFilename, this);
            });
            newFileItem.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                window.paperReviewerApp.showFileContextMenu(e, finalFilename, newFileItem);
            });
            fileItem.replaceWith(newFileItem);
            
            // 重新加载文件列表以更新排序，但保持选中状态
            await this.loadFileList(true);
            
        } catch (error) {
            console.error('Error renaming file:', error);
            this.showNotification('✗ 重命名失败', 'error');
        }
    }

    // 删除文件
    async deleteFile(filename, fileItem) {
        if (!confirm(`确定要删除 "${filename}" 吗？此操作无法撤销！`)) return;
        
        try {
            const response = await fetch('/delete-json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    projectPath: this.currentProject ? this.currentProject.path : 'user',
                    filename: filename 
                })
            });
            
            if (!response.ok) throw new Error('删除失败');
            
            this.showNotification(`✓ 已删除 ${filename}`, 'success');
            
            // 优雅移除：淡出动画
            fileItem.style.transition = 'opacity 0.3s ease';
            fileItem.style.opacity = '0';
            
            setTimeout(() => {
                fileItem.remove();
                
                // 如果删除的是当前文件，清空显示并加载第一个文件
                if (this.currentFile === filename) {
                    this.currentFile = null;
                    this.currentData = null;
                    this.hasUnsavedChanges = false;
                    delete this.tempDataCache[filename];
                    
                    const firstFile = document.querySelector('.file-item');
                    if (firstFile) {
                        const firstFilename = firstFile.querySelector('span').textContent;
                        this.loadFile(firstFilename, firstFile);
                    } else {
                        this.showLoading();
                    }
                }
            }, 300);
            
        } catch (error) {
            console.error('Error deleting file:', error);
            this.showNotification('✗ 删除失败', 'error');
        }
    }

    // 处理粘贴事件
    async handlePaste(e) {
        try {
            // 如果在输入框中粘贴，不处理
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            
            const clipboardData = e.clipboardData || window.clipboardData;
            const pastedText = clipboardData.getData('text');
            
            if (!pastedText) return;
            
            console.log('📋 检测到粘贴内容，尝试解析JSON...');
            
            // 尝试提取并解析JSON
            const jsonData = this.extractJSON(pastedText);
            
            if (jsonData) {
                const inLeftPanel = !!e.target.closest('.left-panel');
                const inCenterPanel = !!e.target.closest('.middle-panel');

                // 中间表格：合并/更新当前JSON
                if (inCenterPanel && this.currentData) {
                    e.preventDefault();
                    if (typeof jsonData !== 'object' || Array.isArray(jsonData)) {
                        this.showNotification('粘贴内容不是对象，无法合并', 'error');
                        return;
                    }
                    const updated = this.mergeIntoCurrentData(jsonData, true);
                    if (updated) {
                        this.hasUnsavedChanges = true;
                        this.tempDataCache[this.currentFile] = this.currentData;
                        this.updateSaveButtonState();
                        this.renderStructuredView();
                        this.renderFlatView();
                        this.setupEditableListeners();
                        this.updateUndoButtonState();
                        this.showNotification('已合并粘贴内容到当前文件', 'success');
                    } else {
                        this.showNotification('未检测到可合并的字段', 'info');
                    }
                    return;
                }

                // 左侧文件区域：校验结构并新建文件
                if (inLeftPanel) {
                    e.preventDefault();
                    const required = ['schema_version', 'meta_info'];
                    const missing = required.filter(k => !jsonData.hasOwnProperty(k));
                    if (missing.length) {
                        this.showNotification(`JSON 缺少关键字段: ${missing.join(', ')}`, 'error');
                        return;
                    }
                    const defaultName = jsonData.meta_info?.paper_id
                        ? `${jsonData.meta_info.paper_id}.json`
                        : 'pasted_data.json';
                    
                    const filename = prompt('检测到有效的JSON数据！\n请输入文件名:', defaultName);
                    if (!filename) return;
                    const finalFilename = filename.endsWith('.json') ? filename : filename + '.json';
                    await this.saveNewJSONFile(finalFilename, jsonData);
                    this.lastPasteBackup = null;
                    this.updateUndoButtonState();
                    return;
                }

                // 其它区域保持默认创建逻辑
                e.preventDefault();
                const filename = prompt('检测到有效的JSON数据！\n请输入文件名:', 'pasted_data.json');
                if (!filename) return;
                const finalFilename = filename.endsWith('.json') ? filename : filename + '.json';
                await this.saveNewJSONFile(finalFilename, jsonData);
            }
        } catch (error) {
            console.error('Error handling paste:', error);
        }
    }

    // 提取JSON数据
    extractJSON(text) {
        try {
            // 尝试直接解析
            return JSON.parse(text);
        } catch (e) {
            // 尝试提取代码块中的JSON
            const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (codeBlockMatch) {
                try {
                    return JSON.parse(codeBlockMatch[1].trim());
                } catch (e2) {
                    console.warn('代码块中的JSON解析失败');
                }
            }
            
            // 尝试提取{}或[]包裹的内容
            const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[1]);
                } catch (e3) {
                    console.warn('提取的JSON解析失败');
                }
            }
            
            return null;
        }
    }

    // 保存新的JSON文件
    async saveNewJSONFile(filename, jsonData) {
        try {
            const jsonString = JSON.stringify(jsonData, null, 2);
            
            const response = await fetch('/save-json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectPath: this.currentProject ? this.currentProject.path : 'user',
                    filename: filename,
                    content: jsonString
                })
            });
            
            if (!response.ok) throw new Error('保存失败');
            
            this.showNotification(`✓ 已创建文件 ${filename}`, 'success');
            
            // 保存当前文件名，加载列表后恢复选中
            const tempCurrentFile = this.currentFile;
            this.currentFile = filename; // 设置为新文件，以便加载后选中
            
            // 重新加载文件列表，保持选中状态
            await this.loadFileList(true);
            
            // 自动加载新创建的文件
            setTimeout(() => {
                const newFileItem = Array.from(document.querySelectorAll('.file-item'))
                    .find(item => item.querySelector('span').textContent === filename);
                if (newFileItem) {
                    this.loadFile(filename, newFileItem);
                }
            }, 200);
            
        } catch (error) {
            console.error('Error saving new JSON file:', error);
            this.showNotification(`✗ 保存失败: ${error.message}`, 'error');
        }
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
                // Fetch JSON file，使用项目路径
                const projectPath = this.currentProject ? this.currentProject.path : 'user';
                const response = await fetch(`${projectPath}/data/${filename}`);
                if (!response.ok) throw new Error('Failed to load file');
                this.currentData = await response.json();
                this.hasUnsavedChanges = false;
            }
            this.ensureSchemaVersion();
            this.ensureLastUpdate();
            
            this.currentFile = filename;

            // 更新UI状态
            this.updateSaveButtonState();
            this.updateSchemaBadge();
            this.updateUndoButtonState();

            // Render data
            this.renderStructuredView();
            await this.loadMarkdownForCurrentFile();

            // Load PDF if available
            if (this.currentData.meta_info && this.currentData.meta_info.pdf_path) {
                const pdfPath = this.currentData.meta_info.pdf_path;
                // Convert path like "src/papers/joom.1169.pdf" to "user/papers/joom.1169.pdf"
                const projectPath = this.currentProject ? this.currentProject.path : 'user';
                const pdfFile = pdfPath.split('/').pop();
                await this.loadPDF(`${projectPath}/papers/${pdfFile}`);
            }
        } catch (error) {
            console.error('Error loading file:', error);
            alert(`Failed to load file: ${error.message}`);
        }
    }

    showLoading() {
        const structuredView = document.getElementById('structuredContent') || document.getElementById('structuredView');
        const markdownView = document.getElementById('markdownRender');
        
        structuredView.innerHTML = '<div class="loading"><div class="spinner"></div>Loading data...</div>';
        if (markdownView) {
            markdownView.innerHTML = '<div class="loading"><div class="spinner"></div>Loading markdown...</div>';
        }
    }

    renderStructuredView() {
        // 清理悬浮预览
        this.hideSectionPreview();
        const container = document.getElementById('structuredContent') || document.getElementById('structuredView');
        container.innerHTML = '';

        // Iterate through top-level sections with collapsible support
        for (const [sectionKey, sectionValue] of Object.entries(this.currentData)) {
            // Skip aux fields that should not render in table
            if (sectionKey.endsWith('_loc') || sectionKey === 'schema_version' || sectionKey === 'lastupdate') continue;
            
            const section = this.createCollapsibleSection(sectionKey, sectionValue, [sectionKey]);
            container.appendChild(section);
        }

        // 统一应用折叠/展开状态
        this.updateAllSectionsCollapseState(this.isCollapseAll);

        if (this.isReorderMode) {
            this.restoreReorderSelection();
        }

        // 渲染完成后触发MathJax
        this.renderMath();
    }

    createCollapsibleSection(title, data, path) {
        const wrapper = document.createElement('div');
        wrapper.className = 'collapsible-section';
        wrapper.dataset.sectionKey = title;
        wrapper.draggable = this.isReorderMode;
        
        // Header with toggle
        const header = document.createElement('div');
        header.className = 'collapsible-header';
        if (!this.isCollapseAll) {
            header.classList.add('active');
        }
        header.innerHTML = `
            <i class="fas fa-chevron-right collapsible-toggle" title="展开/折叠"></i>
            <span class="collapsible-title">${this.formatKey(title)}</span>
            <i class="fas fa-plus header-add" title="在此类下添加子条目"></i>
            <i class="fas fa-trash header-delete" title="删除该字段"></i>
        `;
        
        // Content
        const content = document.createElement('div');
        content.className = 'collapsible-content';
        if (!this.isCollapseAll) {
            content.classList.add('active');
        }
        
        const table = document.createElement('table');
        table.className = 'json-table';
        table.dataset.path = path.join('.');
        if (this.isReorderMode) {
            table.classList.add('reorder-mode');
        }
        this.renderObject(data, table, path);
        content.appendChild(table);
        
        // Toggle functionality / Reorder selection / Delete
        if (this.isReorderMode) {
            header.addEventListener('click', (e) => {
                e.preventDefault();
                this.setReorderSelection([], title);
            });
        } else {
            // 双击类名编辑（重命名）- 仅作用于标题文本，避免误触折叠
            const titleEl = header.querySelector('.collapsible-title');
            if (titleEl) {
                titleEl.addEventListener('dblclick', (e) => {
                    e.preventDefault();
                    this.openEditKeyModal([], title);
                });
            }
            // 双击标题栏空白处，编辑整个类对象
            header.addEventListener('dblclick', (e) => {
                if (e.target.closest('.collapsible-toggle') || e.target.closest('.header-delete') || e.target.closest('.header-add') || e.target.closest('.collapsible-title')) {
                    return;
                }
                const valueForEdit = JSON.stringify(data, null, 2);
                this.openEditModal([title], valueForEdit);
            });
        }

        // 删除按钮
        const deleteBtn = header.querySelector('.header-delete');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const firstConfirm = confirm(`确定删除整个字段 "${title}" 及其所有内容？`);
                if (!firstConfirm) return;
                const secondConfirm = confirm('再次确认：删除后不可恢复，是否继续？');
                if (!secondConfirm) return;
                this.deleteField([], title);
            });
        }
        // 添加子条目按钮
        const addBtn = header.querySelector('.header-add');
        if (addBtn) {
            addBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.addChildField(title);
            });
        }
        // 折叠/展开按钮
        const toggleBtn = header.querySelector('.collapsible-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isActive = header.classList.toggle('active');
                content.classList.toggle('active');
            });
        }

        // Section拖拽排序
        if (this.isReorderMode) {
            wrapper.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', title);
                e.dataTransfer.effectAllowed = 'move';
                wrapper.classList.add('dragging');
            });
            wrapper.addEventListener('dragend', () => {
                wrapper.classList.remove('dragging');
            });
            wrapper.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                wrapper.classList.add('drag-over');
            });
            wrapper.addEventListener('dragleave', () => {
                wrapper.classList.remove('drag-over');
            });
            wrapper.addEventListener('drop', (e) => {
                e.preventDefault();
                wrapper.classList.remove('drag-over');
                const fromKey = e.dataTransfer.getData('text/plain');
                const toKey = title;
                this.reorderKeys([], fromKey, toKey);
            });
        }
        
        wrapper.appendChild(header);
        wrapper.appendChild(content);
        
        return wrapper;
    }

    renderObject(obj, table, basePath) {
        for (const [key, value] of Object.entries(obj)) {
            // 跳过 *_loc 字段，使其不渲染到表格
            if (key.endsWith('_loc')) continue;

            const row = document.createElement('tr');
            row.dataset.key = key;
            row.draggable = this.isReorderMode;
            const toggleCell = document.createElement('td');
            const keyCell = document.createElement('td');
            const valueCell = document.createElement('td');

            // 检查是否有对应的 location 信息
            const locKey = key + '_loc';
            const locationInfo = obj[locKey] || null;

            // 第一列：保留占位但不放置可点击的展开按钮
            toggleCell.className = 'toggle-cell';
            if (this.isReorderMode) {
                toggleCell.innerHTML = `<i class="fas fa-up-down-left-right edit-cell-icon" title="拖动调整顺序"></i>`;
            } else {
                toggleCell.innerHTML = `<i class="fas fa-pen-to-square edit-cell-icon" title="点击编辑"></i>`;
                toggleCell.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const currentPath = [...basePath, key];
                    let valueForEdit = value;
                    if (typeof value === 'object' && value !== null) {
                        valueForEdit = Array.isArray(value) ? JSON.stringify(value) : JSON.stringify(value, null, 2);
                    }
                    this.openEditModal(currentPath, valueForEdit);
                });
            }

            // 第二列：Key可编辑
            const keyDisplay = `<span class="editable-key" data-path="${basePath.join('.')}" data-key="${key}">${this.formatKey(key)}</span>`;

            keyCell.innerHTML = keyDisplay;
            const currentPath = [...basePath, key];

            // 拖拽排序事件
            if (this.isReorderMode) {
                row.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.setReorderSelection(basePath, key);
                });
                row.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', key);
                    e.dataTransfer.effectAllowed = 'move';
                    row.classList.add('dragging');
                });
                row.addEventListener('dragend', () => {
                    row.classList.remove('dragging');
                });
                row.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    row.classList.add('drag-over');
                });
                row.addEventListener('dragleave', () => {
                    row.classList.remove('drag-over');
                });
                row.addEventListener('drop', (e) => {
                    e.preventDefault();
                    row.classList.remove('drag-over');
                    const fromKey = e.dataTransfer.getData('text/plain');
                    const toKey = key;
                    const tablePath = table.dataset.path ? table.dataset.path.split('.').filter(Boolean) : [];
                    this.reorderKeys(tablePath, fromKey, toKey);
                });
                // 点击左列，上移/下移
                toggleCell.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const tablePath = table.dataset.path ? table.dataset.path.split('.').filter(Boolean) : [];
                    if (e.shiftKey) {
                        this.moveKey(tablePath, key, 1); // 下移
                    } else {
                        this.moveKey(tablePath, key, -1); // 上移
                    }
                });
            }

            // 第三列：Value值的显示
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

            row.appendChild(toggleCell);
            row.appendChild(keyCell);
            row.appendChild(valueCell);
            table.appendChild(row);
        }
    }
    
    // 切换_loc字段的显示/隐藏
    toggleLocField(table, baseKey) {
        const locKey = baseKey + '_loc';
        const locRows = Array.from(table.querySelectorAll('tr.loc-field-row')).filter(row => {
            const keySpan = row.querySelector('.editable-key');
            return keySpan && keySpan.dataset.key === locKey;
        });
        
        locRows.forEach(row => {
            row.classList.toggle('collapsed');
        });
        
        // 更新按钮图标 - 现在按钮在独立的toggle-cell中
        const toggleBtn = Array.from(table.querySelectorAll('.loc-toggle-btn')).find(btn => {
            const toggleCell = btn.parentElement;
            const row = toggleCell.parentElement;
            const keyCell = row.querySelector('td:nth-child(2)'); // 第二列是key列
            const keySpan = keyCell?.querySelector('.editable-key');
            return keySpan && keySpan.dataset.key === baseKey;
        });
        
        if (toggleBtn) {
            const icon = toggleBtn.querySelector('i');
            if (locRows[0]?.classList.contains('collapsed')) {
                icon.className = 'fas fa-chevron-down';
            } else {
                icon.className = 'fas fa-chevron-up';
            }
        }
    }

    createEditableValue(value, path, location = null, key = null) {
        const displayValue = typeof value === 'string' ? value : JSON.stringify(value);
        
        const keyLower = (key || '').toLowerCase();
        // 特殊处理: DOI 字段，添加 Web of Science 链接
        if (keyLower === 'doi' && typeof value === 'string' && value.trim()) {
            const wosUrl = this.generateWosUrl(value.trim());
            return `<a href="${wosUrl}" target="_blank" class="doi-link" title="View on Web of Science">
                <i class="fas fa-external-link-alt"></i> ${this.escapeHtml(displayValue)}
            </a>`;
        }
        // 特殊处理: WOSID 字段，跳转 Web of Science Full Record
        if (keyLower.includes('wos') && typeof value === 'string') {
            const trimmed = value.trim();
            const match = trimmed.match(/WOS:[^\\s]+/i);
            const wosId = match ? match[0] : trimmed;
            if (wosId) {
                const url = `https://www.webofscience.com/wos/woscc/full-record/${encodeURIComponent(wosId)}`;
                return `<a href="${url}" target="_blank" class="doi-link" title="View full record on Web of Science">
                    <i class="fas fa-external-link-alt"></i> ${this.escapeHtml(displayValue)}
                </a>`;
            }
        }
        
        const rawValueAttr = this.escapeHtml(displayValue);
        const isMath = this.containsMathSyntax(displayValue);
        const isLongMath = isMath && displayValue.length > 120;
        let valueContent = this.escapeHtml(displayValue);

        // 对超长公式使用图标占位，避免表格横向撑开
        if (isLongMath) {
            valueContent = `<span class="math-placeholder" title="Click to view/edit formula"><i class="fas fa-square-root-variable"></i></span>`;
        }

        let html = `<span class="editable-value${isLongMath ? ' math-collapsed' : ''}" data-path="${path.join('.')}" data-raw-value="${rawValueAttr}">${valueContent}</span>`;
        
        if (location) {
            const page = location.pdf_page_index || 1;
            const quotes = location.quote || [];
            const valuePath = path.join('.');
            
            // 如果quote是数组，为每个quote创建一个引用图标
            if (Array.isArray(quotes) && quotes.length > 0) {
                const validQuotes = quotes.filter(q => q && q.trim());
                if (validQuotes.length > 0) {
                    const links = validQuotes.map((quote, index) => {
                        return `<a href="#" class="location-link" 
                            data-page="${page}" 
                            data-value-path="${valuePath}"
                            data-quote-index="${index}"
                            title="Jump to PDF page ${page} (cycle ${index + 1}/${validQuotes.length})">
                            <i class="fa-solid fa-quote-right"></i>
                        </a>`;
                    }).join('');
                    html += `<span class="location-links">${links}</span>`;
                }
            } else if (typeof quotes === 'string' && quotes.trim()) {
                // 兼容旧的字符串格式
                html += `<a href="#" class="location-link" 
                    data-page="${page}" 
                    data-value-path="${valuePath}"
                    data-quote-index="0"
                    title="Jump to PDF page ${page}">
                    <i class="fa-solid fa-quote-right"></i>
                </a>`;
            } // 无有效引用文本则不显示跳转图标
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

    normalizeProjectPathString(pathStr) {
        if (!pathStr) return '';
        return pathStr.replace(/\\/g, '/').replace(/\/+$/, '');
    }

    mergeIntoCurrentData(sourceObj, backup = false) {
        if (backup) {
            this.lastPasteBackup = {
                file: this.currentFile,
                data: JSON.parse(JSON.stringify(this.currentData || {}))
            };
        }
        let changed = false;
        Object.entries(sourceObj).forEach(([key, value]) => {
            if (key === 'schema_version') {
                this.currentData.schema_version = value || this.currentData.schema_version || this.generateSchemaVersion();
                changed = true;
                return;
            }
            if (this.currentData.hasOwnProperty(key) && this.isPlainObject(this.currentData[key]) && this.isPlainObject(value)) {
                this.deepMerge(this.currentData[key], value);
            } else {
                this.currentData[key] = value;
                // 若存在对应 _loc，且源也有 _loc，则合并
                const locKey = `${key}_loc`;
                if (sourceObj.hasOwnProperty(locKey)) {
                    if (!this.currentData[locKey]) {
                        this.currentData[locKey] = {};
                    }
                    if (this.isPlainObject(sourceObj[locKey]) && this.isPlainObject(this.currentData[locKey])) {
                        this.deepMerge(this.currentData[locKey], sourceObj[locKey]);
                    } else {
                        this.currentData[locKey] = sourceObj[locKey];
                    }
                }
            }
            changed = true;
        });
        return changed;
    }

    isPlainObject(obj) {
        return Object.prototype.toString.call(obj) === '[object Object]';
    }

    deepMerge(target, source) {
        Object.entries(source).forEach(([k, v]) => {
            if (this.isPlainObject(v) && this.isPlainObject(target[k])) {
                this.deepMerge(target[k], v);
            } else {
                target[k] = v;
            }
        });
    }

    undoLastPaste() {
        if (!this.lastPasteBackup || !this.currentFile || this.lastPasteBackup.file !== this.currentFile) {
            this.showNotification('没有可撤销的粘贴', 'error');
            return;
        }
        this.currentData = JSON.parse(JSON.stringify(this.lastPasteBackup.data));
        this.hasUnsavedChanges = true;
        this.tempDataCache[this.currentFile] = this.currentData;
        this.updateSaveButtonState();
        this.renderStructuredView();
        this.renderFlatView();
        this.setupEditableListeners();
        this.updateUndoButtonState();
        this.showNotification('已撤销上次粘贴合并', 'success');
    }

    ensureSchemaVersion() {
        if (!this.currentData) return;
        if (!this.currentData.schema_version) {
            this.currentData.schema_version = this.generateSchemaVersion();
            this.hasUnsavedChanges = true;
            if (this.currentFile) {
                this.tempDataCache[this.currentFile] = this.currentData;
            }
            this.updateSaveButtonState();
        }
    }

    ensureLastUpdate() {
        if (!this.currentData) return;
        if (!this.currentData.lastupdate) {
            this.currentData.lastupdate = this.generateLastUpdate();
            this.hasUnsavedChanges = true;
            if (this.currentFile) {
                this.tempDataCache[this.currentFile] = this.currentData;
            }
            this.updateSaveButtonState();
        }
    }

    generateSchemaVersion() {
        const d = new Date();
        const pad = (n) => n.toString().padStart(2, '0');
        return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    }

    generateLastUpdate() {
        const d = new Date();
        const pad = (n) => n.toString().padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    updateSchemaBadge() {
        const badge = document.getElementById('schemaVersionBadge');
        if (!badge) return;
        const version = this.currentData?.schema_version;
        badge.textContent = version || '-';
        badge.title = `schema_version: ${version || '未定义（保存时将自动生成日期版本）'}`;
    }

    updateUndoButtonState() {
        const undoBtn = document.getElementById('undoPasteBtn');
        if (!undoBtn) return;
        const canUndo = this.lastPasteBackup && this.lastPasteBackup.file === this.currentFile;
        undoBtn.style.display = canUndo ? 'inline-block' : 'none';
    }

    reorderKeys(pathArray, fromKey, toKey) {
        if (!fromKey || !toKey || fromKey === toKey) return;

        // 获取目标对象
        let parent = this.currentData;
        for (const segment of pathArray) {
            if (segment && parent && typeof parent === 'object') {
                parent = parent[segment];
            }
        }
        if (!parent || typeof parent !== 'object') return;

        const keys = Object.keys(parent).filter(k => !k.endsWith('_loc'));
        const fromIndex = keys.indexOf(fromKey);
        const toIndex = keys.indexOf(toKey);
        if (fromIndex === -1 || toIndex === -1) return;

        // 重新排序主键列表
        keys.splice(fromIndex, 1);
        keys.splice(toIndex, 0, fromKey);

        // 构建新的有序对象（保留 _loc 紧跟其对应字段之后）
        const newObj = {};
        keys.forEach(k => {
            newObj[k] = parent[k];
            const locKey = k + '_loc';
            if (parent.hasOwnProperty(locKey)) {
                newObj[locKey] = parent[locKey];
            }
        });
        // 追加其它未包含的键（安全兜底）
        Object.keys(parent).forEach(k => {
            if (!newObj.hasOwnProperty(k)) {
                newObj[k] = parent[k];
            }
        });

        // 替换原对象的属性顺序
        Object.keys(parent).forEach(k => delete parent[k]);
        Object.entries(newObj).forEach(([k, v]) => {
            parent[k] = v;
        });

        this.hasUnsavedChanges = true;
        this.tempDataCache[this.currentFile] = this.currentData;
        this.updateSaveButtonState();
        this.renderStructuredView();
        this.setupEditableListeners();
        this.restoreReorderSelection();
    }

    moveKey(pathArray, key, offset) {
        if (!key || offset === 0) return;
        let parent = this.currentData;
        for (const segment of pathArray) {
            if (segment && parent && typeof parent === 'object') {
                parent = parent[segment];
            }
        }
        if (!parent || typeof parent !== 'object') return;

        const keys = Object.keys(parent).filter(k => !k.endsWith('_loc'));
        const index = keys.indexOf(key);
        if (index === -1) return;

        let targetIndex = index + offset;
        targetIndex = Math.max(0, Math.min(keys.length - 1, targetIndex));
        if (targetIndex === index) return;

        keys.splice(index, 1);
        keys.splice(targetIndex, 0, key);

        const newObj = {};
        keys.forEach(k => {
            newObj[k] = parent[k];
            const locKey = k + '_loc';
            if (parent.hasOwnProperty(locKey)) {
                newObj[locKey] = parent[locKey];
            }
        });
        Object.keys(parent).forEach(k => delete parent[k]);
        Object.entries(newObj).forEach(([k, v]) => {
            parent[k] = v;
        });

        this.hasUnsavedChanges = true;
        this.tempDataCache[this.currentFile] = this.currentData;
        this.updateSaveButtonState();
        this.renderStructuredView();
        this.setupEditableListeners();
        this.restoreReorderSelection();
    }

    deleteField(pathArray, key) {
        let parent = this.currentData;
        for (const segment of pathArray) {
            if (segment && parent && typeof parent === 'object') {
                parent = parent[segment];
            }
        }
        if (!parent || typeof parent !== 'object') return;
        if (!parent.hasOwnProperty(key)) return;

        delete parent[key];
        const locKey = key + '_loc';
        if (parent.hasOwnProperty(locKey)) {
            delete parent[locKey];
        }

        this.hasUnsavedChanges = true;
        this.tempDataCache[this.currentFile] = this.currentData;
        this.updateSaveButtonState();
        this.renderStructuredView();
        this.renderFlatView();
        this.setupEditableListeners();
        this.restoreReorderSelection();
        this.showNotification(`已删除字段: ${key}`, 'info');
    }

    updateAllSectionsCollapseState(collapsed) {
        const headers = document.querySelectorAll('.collapsible-header');
        const contents = document.querySelectorAll('.collapsible-content');
        headers.forEach(h => h.classList.toggle('active', !collapsed));
        contents.forEach(c => c.classList.toggle('active', !collapsed));
    }

    setReorderSelection(pathArray, key) {
        this.reorderSelected = { path: [...pathArray], key };
        document.querySelectorAll('.reorder-selected').forEach(el => el.classList.remove('reorder-selected'));
        this.highlightSelectionElement();
    }

    highlightSelectionElement() {
        if (!this.reorderSelected) return;
        const { path, key } = this.reorderSelected;
        let target = null;
        if (path.length === 0) {
            target = document.querySelector(`.collapsible-section[data-section-key="${CSS.escape(key)}"]`);
        } else {
            const tablePath = path.join('.');
            target = document.querySelector(`table.json-table[data-path="${CSS.escape(tablePath)}"] tr[data-key="${CSS.escape(key)}"]`);
        }
        if (target) target.classList.add('reorder-selected');
    }

    restoreReorderSelection() {
        document.querySelectorAll('.reorder-selected').forEach(el => el.classList.remove('reorder-selected'));
        this.highlightSelectionElement();
    }

    async copyWosAideSource() {
        try {
            const response = await fetch('/wosAide.js');
            if (!response.ok) throw new Error(`读取失败: ${response.statusText}`);
            const text = await response.text();

            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                // 兼容方案
                const textarea = document.createElement('textarea');
                textarea.value = text;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                textarea.remove();
            }

            this.showNotification('已复制 wosAide.js 源码到剪贴板', 'success');
        } catch (error) {
            console.error('复制 wosAide.js 失败:', error);
            this.showNotification(`复制失败: ${error.message}`, 'error');
        }
    }

    renderFlatView() {
        const container = document.getElementById('flatView');
        if (!container) return;
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
    
    getMarkdownParser() {
        if (!this.markdownParser && window.markdownit) {
            const md = window.markdownit({
                html: false,
                linkify: true,
                typographer: true,
                breaks: true
            });
            if (window.markdownitFootnote) md.use(window.markdownitFootnote);
            if (window.markdownitDeflist) md.use(window.markdownitDeflist);
            if (window.markdownitSub) md.use(window.markdownitSub);
            if (window.markdownitSup) md.use(window.markdownitSup);
            this.markdownParser = md;
        }
        return this.markdownParser;
    }

    getMarkdownFilename(jsonFilename) {
        if (!jsonFilename) return '';
        return jsonFilename.replace(/\.json$/i, '') + '.md';
    }

    async persistMarkdown(filename, content) {
        const projectPath = this.currentProject ? this.currentProject.path : 'user';
        const payload = {
            projectPath,
            filename,
            content
        };

        // 优先尝试 /save-md，404 时回退到 /save-json（与 JSON 保存逻辑一致，保证兼容旧服务）
        const trySave = async (url) => {
            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!resp.ok) {
                const text = await resp.text();
                const err = new Error(text || `请求失败: ${resp.status}`);
                err.status = resp.status;
                throw err;
            }
            return resp;
        };

        try {
            await trySave(this.saveMdEndpoint);
        } catch (err) {
            if (err.status === 404) {
                // 回退到已有的 JSON 保存接口，保证在老版本 server.js 上也能工作
                await trySave('/save-json');
            } else {
                throw err;
            }
        }
    }

    buildDefaultMarkdown() {
        const base = this.currentFile ? this.currentFile.replace(/\.json$/i, '') : 'notes';
        return `# ${base}\n\n> 自动创建的 Markdown 笔记文件。\n\n- 可添加章节、要点、引用等。\n- 与 JSON 同名，便于版本记录。\n`;
    }

    updateMarkdownToolbar() {
        const createBtn = document.getElementById('createMarkdownBtn');
        const editBtn = document.getElementById('editMarkdownBtn');
        const saveBtn = document.getElementById('saveMarkdownBtn');
        const statusEl = document.getElementById('markdownStatus');
        const editor = document.getElementById('markdownEditor');
        const render = document.getElementById('markdownRender');
        if (!createBtn || !editBtn || !saveBtn || !statusEl) return;

        createBtn.style.display = this.currentMarkdownExists ? 'none' : 'inline-flex';
        editBtn.disabled = !this.currentMarkdownExists;
        saveBtn.disabled = !this.currentMarkdownExists;
        statusEl.textContent = this.currentFile
            ? (this.currentMarkdownExists ? `已加载: ${this.currentMarkdownFile}` : '未找到同名 MD，点击创建')
            : '未加载文件';

        if (this.isMarkdownEditing) {
            if (editor) editor.style.display = 'block';
            if (render) render.style.display = 'none';
            editBtn.disabled = true;
        } else {
            if (editor) editor.style.display = 'none';
            if (render) render.style.display = 'block';
        }
    }

    async loadMarkdownForCurrentFile() {
        if (!this.currentFile) {
            this.currentMarkdownExists = false;
            this.currentMarkdownText = '';
            this.currentMarkdownFile = '';
            this.renderMarkdownView('');
            this.updateMarkdownToolbar();
            return;
        }
        const mdFilename = this.getMarkdownFilename(this.currentFile);
        const projectPath = this.currentProject ? this.currentProject.path : 'user';
        const mdUrl = `${projectPath}/data/${mdFilename}`;
        const render = document.getElementById('markdownRender');
        if (render) {
            render.innerHTML = '<div class="loading"><div class="spinner"></div>Loading markdown...</div>';
        }
        try {
            let text = '';
            const resp = await fetch(mdUrl, { cache: 'no-store' });
            if (resp.ok) {
                text = await resp.text();
                this.currentMarkdownExists = true;
            } else if (resp.status === 404) {
                this.currentMarkdownExists = false;
                text = '';
            } else {
                throw new Error(`加载失败：${resp.status}`);
            }
            this.currentMarkdownFile = mdFilename;
            this.currentMarkdownText = text;
            this.isMarkdownEditing = false;
            this.renderMarkdownView(text);
        } catch (err) {
            console.warn('Markdown load error:', err);
            if (render) {
                render.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Markdown 加载失败</h3><p>${err.message}</p></div>`;
            }
        } finally {
            this.updateMarkdownToolbar();
        }
    }

    renderMarkdownView(text) {
        const render = document.getElementById('markdownRender');
        const textarea = document.getElementById('markdownTextarea');
        if (textarea) textarea.value = text || this.buildDefaultMarkdown();
        if (!render) return;
        if (!text) {
            render.innerHTML = '<div class="empty-state"><i class="fas fa-file-alt"></i><h3>No Markdown</h3><p>未找到同名 Markdown，点击上方按钮创建</p></div>';
            return;
        }
        const md = this.getMarkdownParser();
        if (!md) {
            render.innerHTML = '<div class="empty-state"><i class="fas fa-file-alt"></i><h3>Markdown 引擎不可用</h3></div>';
            return;
        }
        const html = md.render(text);
        render.innerHTML = `<article class="markdown-body">${html}</article>`;
        this.renderMath();
        const statusEl = document.getElementById('markdownStatus');
        if (statusEl) statusEl.textContent = this.currentMarkdownExists ? `已加载: ${this.currentMarkdownFile}` : '未找到同名 MD';
    }

    async createMarkdownFile() {
        if (!this.currentFile) return;
        const mdFilename = this.getMarkdownFilename(this.currentFile);
        const projectPath = this.currentProject ? this.currentProject.path : 'user';
        const content = this.buildDefaultMarkdown();
        try {
            await this.persistMarkdown(mdFilename, content);
            this.currentMarkdownExists = true;
            this.currentMarkdownFile = mdFilename;
            this.currentMarkdownText = content;
            this.isMarkdownEditing = true;
            this.renderMarkdownView(content);
            this.updateMarkdownToolbar();
            const statusEl = document.getElementById('markdownStatus');
            if (statusEl) statusEl.textContent = `已创建: ${mdFilename}`;
        } catch (err) {
            console.error('创建 Markdown 失败:', err);
            this.showNotification(`创建 Markdown 失败: ${err.message}`, 'error');
        }
    }

    toggleMarkdownEdit(editing) {
        if (!this.currentMarkdownExists) return;
        this.isMarkdownEditing = editing;
        const textarea = document.getElementById('markdownTextarea');
        if (textarea && editing) {
            textarea.value = this.currentMarkdownText || this.buildDefaultMarkdown();
        }
        this.updateMarkdownToolbar();
    }

    async saveMarkdownFromEditor() {
        if (!this.currentFile || !this.currentMarkdownExists) return;
        const textarea = document.getElementById('markdownTextarea');
        if (!textarea) return;
        const content = textarea.value;
        const mdFilename = this.getMarkdownFilename(this.currentFile);
        try {
            await this.persistMarkdown(mdFilename, content);
            this.currentMarkdownText = content;
            this.isMarkdownEditing = false;
            this.currentMarkdownExists = true;
            this.renderMarkdownView(content);
            this.updateMarkdownToolbar();
            this.showNotification(`✓ Markdown 已保存: ${mdFilename}`, 'success');
            const statusEl = document.getElementById('markdownStatus');
            if (statusEl) statusEl.textContent = `已保存: ${mdFilename}`;
        } catch (err) {
            console.error('保存 Markdown 失败:', err);
            this.showNotification(`保存 Markdown 失败: ${err.message}`, 'error');
        }
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
        const markdown = document.getElementById('markdownView');
        if (markdown) markdown.classList.remove('active');

        if (view === 'structured') {
            document.getElementById('structuredView').classList.add('active');
        } else if (view === 'markdown') {
            if (markdown) markdown.classList.add('active');
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

    getValueByPath(pathArr) {
        let cur = this.currentData;
        for (const seg of pathArr) {
            if (cur && Object.prototype.hasOwnProperty.call(cur, seg)) {
                cur = cur[seg];
            } else {
                return null;
            }
        }
        return cur;
    }

    showSectionPreviewInline() {
        if (!this.currentData) return;
        if (document.getElementById('previewSectionGhost')) return; // 已存在预览，避免重复创建
        const container = document.getElementById('structuredContent') || document.getElementById('structuredView');
        if (!container) return;
        this.hideSectionPreview();

        const preview = document.createElement('div');
        preview.className = 'collapsible-section preview-section';
        preview.id = 'previewSectionGhost';
        preview.innerHTML = `
            <div class="collapsible-header active">
                <i class="fas fa-chevron-right collapsible-toggle"></i>
                <span class="collapsible-title">New Section (preview)</span>
                <i class="fas fa-plus header-add"></i>
                <i class="fas fa-trash header-delete"></i>
            </div>
            <div class="collapsible-content active">
                <table class="json-table preview-table">
                    <tr>
                        <td class="toggle-cell"><i class="fas fa-pen-to-square edit-cell-icon"></i></td>
                        <td>${this.formatKey('placeholder_field')}</td>
                        <td class="preview-dim">value</td>
                    </tr>
                    <tr>
                        <td class="toggle-cell"></td>
                        <td>${this.formatKey('placeholder_field_loc')}</td>
                        <td class="preview-dim">{ page_label:"", pdf_page_index:null }</td>
                    </tr>
                </table>
            </div>
        `;
        const rect = container.getBoundingClientRect();
        preview.style.position = 'fixed';
        preview.style.left = `${rect.left}px`;
        preview.style.top = `${rect.bottom + 6}px`;
        preview.style.width = `${rect.width}px`;
        document.body.appendChild(preview);
    }

    hideSectionPreview() {
        const ghost = document.getElementById('previewSectionGhost');
        if (ghost) {
            ghost.remove();
        }
    }

    containsMathSyntax(text) {
        if (!text) return false;
        // 支持 $$...$$ 块、\( \) 或 \[ \]，以及单行 $...$
        return (
            /\$\$[\s\S]+?\$\$/.test(text) ||
            /\\\(.+?\\\)/.test(text) ||
            /\\\[([\s\S]+?)\\\]/.test(text) ||
            /(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/.test(text)
        );
    }

    getMathPreviewElement() {
        let el = document.querySelector('.math-preview');
        if (!el) {
            el = document.createElement('div');
            el.className = 'math-preview';
            el.innerHTML = '<div class="math-preview-content"></div>';
            document.body.appendChild(el);
        }
        return el;
    }

    showMathPreview(text, anchorEl) {
        try {
            const preview = this.getMathPreviewElement();
            const content = preview.querySelector('.math-preview-content');
            if (!content) return;
            content.textContent = text;
            preview.classList.add('active');

            // 位置：默认锚点下方，超出则调整
            const rect = anchorEl.getBoundingClientRect();
            const padding = 8;
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const maxWidth = Math.floor(vw * 0.9);
            let top = rect.bottom + padding;
            let left = rect.left;
            preview.style.maxWidth = `${maxWidth}px`;
            preview.style.visibility = 'hidden';
            preview.style.display = 'block';
            const preRect = preview.getBoundingClientRect();
            if (left + preRect.width > vw - padding) {
                left = Math.max(padding, vw - preRect.width - padding);
            }
            if (top + preRect.height > vh - padding) {
                top = rect.top - preRect.height - padding;
            }
            preview.style.left = `${left}px`;
            preview.style.top = `${top}px`;
            preview.style.visibility = 'visible';

            if (window.MathJax && window.MathJax.typesetPromise) {
                MathJax.typesetPromise([preview]).catch(err => console.warn('MathJax render failed:', err));
            }
        } catch (err) {
            console.warn('Math preview error:', err);
        }
    }

    hideMathPreview() {
        const preview = document.querySelector('.math-preview');
        if (preview) {
            preview.classList.remove('active');
            preview.style.display = 'none';
        }
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
            
            // 监听iframe加载完成（如需自定义滚动行为，可在此扩展）
            pdfViewer.onload = () => {
                try {
                    const win = pdfViewer.contentWindow;
                    if (win) {
                        // 禁用 PDF.js 内部的 alert/confirm/prompt 弹窗
                        win.alert = () => {};
                        win.confirm = () => true;
                        win.prompt = () => null;
                        // 部分 overlay 弹窗（如删除时的提示）直接关闭
                        if (win.PDFViewerApplication?.overlayManager?.closeAll) {
                            win.PDFViewerApplication.overlayManager.closeAll();
                        }
                    }
                } catch (err) {
                    console.warn('Suppress PDF.js prompts failed:', err);
                }
            };
            
            this.showNotification('PDF 加载完成', 'success');
        } catch (error) {
            console.error('Error loading PDF:', error);
            this.showNotification(`PDF 加载失败: ${error.message}`, 'error');
        }
    }

    enterPdfJsFullscreen() {
        try {
            const iframe = document.getElementById('pdfViewer');
            const pdfApp = iframe?.contentWindow?.PDFViewerApplication;

            if (!pdfApp) {
                this.showNotification('PDF 尚未加载完成', 'error');
                return;
            }

            if (typeof pdfApp.requestPresentationMode === 'function') {
                pdfApp.requestPresentationMode();
            } else if (pdfApp.pdfViewer?.requestPresentationMode) {
                pdfApp.pdfViewer.requestPresentationMode();
            } else if (pdfApp.eventBus) {
                pdfApp.eventBus.dispatch('presentationmode', { source: window });
            } else {
                this.showNotification('当前 PDF 版本不支持全屏模式', 'error');
                return;
            }

            this.showNotification('正在切换到 PDF 全屏模式', 'success');
        } catch (error) {
            console.error('PDF 全屏切换失败:', error);
            this.showNotification(`全屏失败: ${error.message}`, 'error');
        }
    }

    async downloadCurrentPdf() {
        try {
            const iframe = document.getElementById('pdfViewer');
            const pdfApp = iframe?.contentWindow?.PDFViewerApplication;
            const pdfUrl = this.currentPdfUrl;

            if (!pdfApp) {
                this.showNotification('PDF 尚未加载完成', 'error');
                return;
            }

            // 解析文件名，缺失时兜底
            const filename = this.getPdfFilename(pdfUrl);

            // 获取包含用户标注/高亮的PDF数据
            const annotatedBlob = await this.buildPdfBlobWithAnnotations(pdfApp);

            // 优先使用本地文件保存选择器（允许用户自定义保存路径）
            if (window.showSaveFilePicker && annotatedBlob) {
                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: filename,
                        types: [{
                            description: 'PDF 文件',
                            accept: { 'application/pdf': ['.pdf'] }
                        }]
                    });

                    const writable = await handle.createWritable();
                    await writable.write(annotatedBlob);
                    await writable.close();

                    this.showNotification(`已保存到: ${handle.name}`, 'success');
                    return;
                } catch (pickerError) {
                    // 用户取消不提示；其他错误则回退到 PDF.js 下载
                    if (pickerError && pickerError.name === 'AbortError') return;
                    console.warn('文件保存对话框失败，回退到默认下载:', pickerError);
                }
            }

            // 如果获取到了带标注的Blob，直接触发下载
            if (annotatedBlob) {
                this.triggerBlobDownload(annotatedBlob, filename);
                this.showNotification('开始下载 PDF（包含标注）', 'success');
                return;
            }

            // 回退: 使用 PDF.js 内置下载
            if (typeof pdfApp.download === 'function') {
                pdfApp.download({ source: pdfApp.pdfDocument, url: pdfUrl, filename });
            } else if (pdfApp.eventBus) {
                // 触发 PDF.js 自带的下载事件，携带文件名和路径
                pdfApp.eventBus.dispatch('download', { source: window, url: pdfUrl, filename });
            } else if (pdfApp.toolbar?.downloadButton?.click) {
                // 兜底直接点击工具栏按钮
                pdfApp.toolbar.downloadButton.click();
            } else {
                this.showNotification('当前 PDF 版本不支持下载', 'error');
                return;
            }

            this.showNotification('开始下载 PDF', 'success');
        } catch (error) {
            console.error('PDF 下载失败:', error);
            this.showNotification(`下载失败: ${error.message}`, 'error');
        }
    }

    getPdfFilename(pdfUrl) {
        if (!pdfUrl) return 'document.pdf';
        try {
            const urlObj = new URL(pdfUrl, window.location.href);
            const pathname = urlObj.pathname;
            const lastSegment = pathname.split('/').filter(Boolean).pop();
            return lastSegment || 'document.pdf';
        } catch (_e) {
            const parts = pdfUrl.split(/[\\/]/);
            return parts[parts.length - 1] || 'document.pdf';
        }
    }

    async buildPdfBlobWithAnnotations(pdfApp) {
        try {
            const pdfDocument = pdfApp?.pdfDocument;
            if (!pdfDocument) return null;

            if (typeof pdfDocument.saveDocument === 'function') {
                const data = await pdfDocument.saveDocument();
                if (data) return new Blob([data], { type: 'application/pdf' });
            }

            if (typeof pdfDocument.getData === 'function') {
                const data = await pdfDocument.getData();
                if (data) return new Blob([data], { type: 'application/pdf' });
            }
        } catch (error) {
            console.warn('构建带标注的PDF失败，回退到默认下载:', error);
        }
        return null;
    }

    triggerBlobDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
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
    jumpToPage(page, searchText = '', valuePath = null) {
        const pdfViewer = document.getElementById('pdfViewer');
        if (!pdfViewer || !this.currentPdfUrl) return;
        
        try {
            const cleanText = searchText ? searchText.trim() : '';
            
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
                this.executeSearchAndScroll(pdfApp, cleanText, valuePath);
            } else if (page) {
                // 如果没有搜索文本，丝滑跳转到页码
                this.smoothScrollToPage(pdfApp, parseInt(page));
            }
            
        } catch (error) {
            console.error('Error in search:', error);
            this.showNotification('❌ 操作失败', 'error');
        }
    }
    
    // 丝滑滚动到指定页码
    smoothScrollToPage(pdfApp, targetPage) {
        try {
            console.log(`🎯 开始丝滑滚动到第 ${targetPage} 页`);
            
            // 获取PDF iframe
            const pdfIframe = document.querySelector('#pdfViewer');
            if (!pdfIframe || !pdfIframe.contentWindow) {
                console.warn('⚠️ 找不到PDF iframe');
                return;
            }
            
            const pdfWindow = pdfIframe.contentWindow;
            const pdfDoc = pdfWindow.document;
            
            // 查找viewerContainer（PDF.js的滚动容器）
            const viewerContainer = pdfDoc.querySelector('#viewerContainer');
            
            if (!viewerContainer) {
                console.warn('⚠️ 找不到viewerContainer，尝试使用PDF.js API跳转');
                pdfApp.page = targetPage;
                this.showNotification(`📄 第 ${targetPage} 页`, 'info');
                return;
            }
            
            console.log('✅ 找到viewerContainer');
            
            // 确保设置了平滑滚动（以防未设置）
            if (viewerContainer.style.scrollBehavior !== 'smooth') {
                viewerContainer.style.scrollBehavior = 'smooth';
                console.log('🔧 已设置viewerContainer平滑滚动');
            }
            
            // 获取目标页面元素
            const pageElement = pdfDoc.querySelector(`[data-page-number="${targetPage}"]`);
            
            if (pageElement) {
                console.log(`📍 找到目标页面元素，准备滚动...`);
                
                // 获取页面位置
                const pageRect = pageElement.getBoundingClientRect();
                const containerRect = viewerContainer.getBoundingClientRect();
                
                // 计算目标滚动位置（页面顶部对齐到视口顶部，留点边距）
                const targetScrollTop = viewerContainer.scrollTop + pageRect.top - containerRect.top - 20;
                
                console.log(`📊 滚动信息:`, {
                    当前滚动位置: viewerContainer.scrollTop,
                    页面相对位置: pageRect.top - containerRect.top,
                    目标滚动位置: targetScrollTop,
                    页面高度: pageRect.height
                });
                
                // 丝滑滚动
                viewerContainer.scrollTo({
                    top: Math.max(0, targetScrollTop),
                    behavior: 'smooth'
                });
                
                // 同时更新PDF.js的当前页码（延迟避免冲突）
                setTimeout(() => {
                    pdfApp.page = targetPage;
                    console.log(`✅ PDF.js页码已更新为 ${targetPage}`);
                }, 500);
                
                this.showNotification(`📄 第 ${targetPage} 页`, 'info');
                console.log('✅ 已触发丝滑页面跳转动画');
            } else {
                console.warn(`⚠️ 找不到页面${targetPage}的DOM元素，可能还未渲染`);
                console.log('📋 尝试查找所有页面元素...');
                const allPages = pdfDoc.querySelectorAll('[data-page-number]');
                console.log(`📋 共找到 ${allPages.length} 个页面元素`);
                
                // 使用PDF.js API跳转
                pdfApp.page = targetPage;
                this.showNotification(`📄 第 ${targetPage} 页`, 'info');
            }
        } catch (error) {
            console.error('❌ 丝滑滚动失败，使用默认跳转:', error);
            pdfApp.page = targetPage;
            this.showNotification(`📄 第 ${targetPage} 页`, 'info');
        }
    }

    // 执行搜索并滚动到第一个结果（独立方法）
    executeSearchAndScroll(pdfApp, searchText, valuePath = null) {
        if (!pdfApp || !pdfApp.eventBus) {
            console.error('❌ EventBus不可用');
            return;
        }
        
        // 检查是否是相同的搜索文本和字段（不管quoteIndex）
        const isSameSearch = this.lastSearchText === searchText && this.lastSearchValuePath === valuePath;
        
        if (isSameSearch && this.searchMatchCount > 1) {
            // 相同的搜索，且PDF中有多个匹配，循环查找下一个
            this.currentMatchIndex = (this.currentMatchIndex + 1) % this.searchMatchCount;
            
            pdfApp.eventBus.dispatch('find', {
                source: window,
                type: 'again',
                query: searchText,
                phraseSearch: true,
                caseSensitive: false,
                highlightAll: true,
                findPrevious: false
            });
            
            setTimeout(() => {
                this.scrollToCurrentMatch(pdfApp);
            }, 300);
            return;
        } else if (isSameSearch && this.searchMatchCount === 1) {
            // 相同搜索但只有1个匹配，直接跳转到那个位置
            setTimeout(() => {
                this.scrollToCurrentMatch(pdfApp);
            }, 100);
            return;
        }
        
        // 新的搜索文本或不同字段，重置状态
        this.lastSearchText = searchText;
        this.lastSearchValuePath = valuePath;
        this.searchMatchCount = 0;
        this.currentMatchIndex = 0;
        
        // 用于跟踪搜索结果
        let searchResult = {
            found: false,
            total: 0,
            notified: false
        };
        
        // 监听搜索状态
        const resultListener = (evt) => {
            if (evt.state === 1) { // FOUND
                searchResult.found = true;
                
                // 搜索成功后，延迟滚动到第一个高亮文本中央
                setTimeout(() => {
                    this.scrollToCurrentMatch(pdfApp);
                }, 600);
            } else if (evt.state === 3) { // NOT_FOUND
                searchResult.found = false;
            }
        };
        
        // 监听匹配数量
        const matchListener = (evt) => {
            if (evt.matchesCount && evt.matchesCount.total > 0) {
                searchResult.total = evt.matchesCount.total;
                searchResult.found = true;
                this.searchMatchCount = evt.matchesCount.total;
                searchResult.notified = true;
            } else if (evt.matchesCount && evt.matchesCount.total === 0) {
                searchResult.total = 0;
                searchResult.found = false;
                this.searchMatchCount = 0;
            }
        };
        
        pdfApp.eventBus.on('updatefindcontrolstate', resultListener);
        pdfApp.eventBus.on('updatefindmatchescount', matchListener);
        
        // 清除旧搜索
        pdfApp.eventBus.dispatch('findbarclose');
        
        // 执行新搜索（搜索整个文档）
        setTimeout(() => {
            pdfApp.eventBus.dispatch('find', {
                source: window,
                type: 'find',
                query: searchText,
                phraseSearch: true,        // 完整短语搜索
                caseSensitive: false,      // 不区分大小写
                highlightAll: true,        // 高亮所有匹配
                findPrevious: false        // 从前往后搜索
            });
            
            // 10秒后清理监听器
            setTimeout(() => {
                pdfApp.eventBus.off('updatefindcontrolstate', resultListener);
                pdfApp.eventBus.off('updatefindmatchescount', matchListener);
            }, 10000);
        }, 200);
    }

    // 滚动到当前匹配结果的中央（丝滑动画）
    scrollToCurrentMatch(pdfApp) {
        try {
            console.log('🎯 开始查找并滚动到第一个匹配结果...');
            
            const pdfViewer = pdfApp.pdfViewer;
            if (!pdfViewer) {
                console.warn('⚠️ pdfViewer不可用');
                return;
            }
            
            // 获取PDF iframe和其内部的文档
            const pdfIframe = document.querySelector('#pdfViewer');
            if (!pdfIframe || !pdfIframe.contentWindow) {
                console.warn('⚠️ 找不到PDF iframe');
                return;
            }
            
            const pdfWindow = pdfIframe.contentWindow;
            const pdfDoc = pdfWindow.document;
            const viewerContainer = pdfDoc.querySelector('#viewerContainer');
            
            if (!viewerContainer) {
                console.warn('⚠️ 找不到viewerContainer');
                return;
            }
            
            console.log('✅ 找到viewerContainer，查找高亮元素...');
            
            // 确保设置了平滑滚动（以防未设置）
            if (viewerContainer.style.scrollBehavior !== 'smooth') {
                viewerContainer.style.scrollBehavior = 'smooth';
                console.log('🔧 已设置viewerContainer平滑滚动');
            }
            
            // 查找第一个高亮元素（PDF.js的高亮class）
            const highlighted = viewerContainer.querySelector('.highlight.selected') || 
                               viewerContainer.querySelector('.highlight.begin') ||
                               viewerContainer.querySelector('.highlight');
            
            if (highlighted) {
                console.log('📍 找到第一个匹配，准备丝滑滚动到中央...');
                
                // 获取元素在容器中的位置
                const elementRect = highlighted.getBoundingClientRect();
                const containerRect = viewerContainer.getBoundingClientRect();
                
                // 计算元素中心相对于容器顶部的位置
                const elementCenterY = elementRect.top - containerRect.top + viewerContainer.scrollTop + elementRect.height / 2;
                
                // 计算视口中心位置
                const viewportCenterY = containerRect.height / 2;
                
                // 目标滚动位置：让元素中心对齐视口中心
                const targetScrollTop = elementCenterY - viewportCenterY;
                
                console.log(`📊 滚动信息:`, {
                    当前滚动位置: viewerContainer.scrollTop,
                    元素位置: elementRect.top - containerRect.top,
                    元素高度: elementRect.height,
                    视口高度: containerRect.height,
                    目标滚动位置: targetScrollTop
                });
                
                // 丝滑滚动动画 - 滚动到元素中央
                viewerContainer.scrollTo({
                    top: Math.max(0, targetScrollTop),
                    behavior: 'smooth'
                });
                
                console.log('✅ 已触发丝滑滚动动画（元素居中）');
            } else {
                console.warn('⚠️ 未找到高亮元素，可能还在渲染中');
                // 如果第一次没找到，再重试一次
                setTimeout(() => {
                    console.log('🔄 重试查找高亮元素...');
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
    // 编辑字段名（双击key时调用）
    openEditKeyModal(parentPath, oldKey) {
        const newKey = prompt(`编辑字段名称:`, oldKey);
        if (!newKey || newKey === oldKey || !newKey.trim()) return;

        // 导航到父对象
        let parent = this.currentData;
        for (const p of parentPath) {
            if (p && parent.hasOwnProperty(p)) {
                parent = parent[p];
            }
        }

        if (!parent || typeof parent !== 'object') {
            this.showNotification('✗ 无法找到父对象', 'error');
            return;
        }

        // 检查新key是否已存在
        if (parent.hasOwnProperty(newKey)) {
            this.showNotification('✗ 字段名已存在', 'error');
            return;
        }

        // 重命名key：复制值到新key，删除旧key
        parent[newKey] = parent[oldKey];
        delete parent[oldKey];

        // 如果有对应的_loc字段，也需要重命名
        const oldLocKey = oldKey + '_loc';
        const newLocKey = newKey + '_loc';
        if (parent.hasOwnProperty(oldLocKey)) {
            parent[newLocKey] = parent[oldLocKey];
            delete parent[oldLocKey];
        }

        // 标记为有未保存的修改
        this.hasUnsavedChanges = true;
        this.tempDataCache[this.currentFile] = this.currentData;
        this.updateSaveButtonState();

        // 重新渲染
        this.renderStructuredView();
        this.renderFlatView();
        this.setupEditableListeners();

        this.showNotification(`✓ 字段已重命名: ${oldKey} → ${newKey}`, 'success');
    }

    openEditModal(path, currentValue) {
        this.editingPath = path;
        const lastKey = path[path.length - 1];
        document.getElementById('modalTitle').textContent = `编辑: ${this.formatKey(lastKey)}`;
        const keyInput = document.getElementById('editKeyInput');
        if (keyInput) {
            keyInput.value = lastKey;
        }
        document.getElementById('editTextarea').value = currentValue;
        
        // 检查是否有对应的_loc字段
        const locSection = document.getElementById('locationEditSection');
        const pageInput = document.getElementById('editPageNumber');
        
        // 获取当前字段所在的父对象
        let current = this.currentData;
        for (let i = 0; i < path.length - 1; i++) {
            current = current[path[i]];
        }
        
        const locKey = lastKey + '_loc';
        
        // 🔧 检查并自动创建 _loc 字段（如果不存在）
        if (current && !current[locKey]) {
            // 初始化标准的 _loc 结构，所有值允许为空
            current[locKey] = {
                "page_label": "",
                "pdf_page_index": null,
                "pdf_open_params": "",
                "quote": []
            };
            
            // 标记数据已修改
            this.hasUnsavedChanges = true;
            this.tempDataCache[this.currentFile] = this.currentData;
            this.updateSaveButtonState();
            
            console.log(`✓ 已自动创建 ${locKey} 字段`);
        }
        
        if (current && current[locKey]) {
            // 有location数据，显示编辑区
            locSection.style.display = 'block';
            pageInput.value = current[locKey].pdf_page_index || '';
            
            // 初始化引用标签页
            const quotes = current[locKey].quote;
            this.initQuoteTabs(quotes);
        } else {
            // 无location数据，隐藏编辑区
            locSection.style.display = 'none';
            pageInput.value = '';
            this.initQuoteTabs([]);
        }
        
        const modal = document.getElementById('editModal');
        const content = modal.querySelector('.modal-content');
        // 重新居中并显示
        content.style.left = '50%';
        content.style.top = '50%';
        content.style.transform = 'translate(-50%, -50%)';
        modal.classList.add('active');
    }

    // 初始化引用标签页
    initQuoteTabs(quotes) {
        const quotesArray = Array.isArray(quotes) ? quotes : (quotes ? [quotes] : []);
        const tabsContainer = document.getElementById('quoteTabs');
        const panelsContainer = document.getElementById('quotePanels');
        
        tabsContainer.innerHTML = '';
        panelsContainer.innerHTML = '';
        
        if (quotesArray.length === 0) {
            // 显示空状态
            panelsContainer.innerHTML = `
                <div class="quote-empty-state">
                    <i class="fas fa-quote-right"></i>
                    <p>暂无引用文本</p>
                    <p style="font-size: 10px; color: #bbb;">点击上方"添加引用"按钮添加</p>
                </div>
            `;
        } else {
            // 创建标签页
            quotesArray.forEach((quote, index) => {
                this.addQuoteTab(quote, index, index === 0);
            });
        }
        
        // 绑定添加按钮
        const btnAdd = document.getElementById('btnAddQuote');
        btnAdd.onclick = () => this.addQuoteTab('', tabsContainer.children.length, true);

        // 绑定一键整理按钮
        const btnFlatten = document.getElementById('btnFlattenQuote');
        if (btnFlatten) {
            btnFlatten.onclick = () => this.flattenActiveQuote();
        }

        // 绑定测试搜索按钮：使用当前选中引用文本，执行PDF搜索并跳转
        const btnTestSearch = document.getElementById('btnTestSearch');
        if (btnTestSearch) {
            btnTestSearch.onclick = () => this.testSearchFromActiveQuote();
        }
    }

    // 添加引用标签页
    addQuoteTab(content = '', index = 0, setActive = false) {
        const tabsContainer = document.getElementById('quoteTabs');
        const panelsContainer = document.getElementById('quotePanels');
        
        // 移除空状态
        const emptyState = panelsContainer.querySelector('.quote-empty-state');
        if (emptyState) {
            emptyState.remove();
        }
        
        // 创建标签
        const tab = document.createElement('div');
        tab.className = 'quote-tab' + (setActive ? ' active' : '');
        tab.dataset.index = index;
        tab.innerHTML = `
            <span>引用 ${index + 1}</span>
            <i class="fas fa-times tab-remove" title="删除"></i>
        `;
        
        // 创建面板
        const panel = document.createElement('div');
        panel.className = 'quote-panel' + (setActive ? ' active' : '');
        panel.dataset.index = index;
        const placeholderText = '在此粘贴从PDF复制的引用文本...\n\n提示：可以包含关键词、段落或公式\n支持多行文本';
        panel.innerHTML = `
            <textarea placeholder="${placeholderText}">${this.escapeHtml(content)}</textarea>
        `;
        
        // 点击标签切换
        tab.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-remove')) {
                this.removeQuoteTab(index);
            } else {
                this.switchQuoteTab(index);
            }
        });
        
        tabsContainer.appendChild(tab);
        panelsContainer.appendChild(panel);
        
        if (setActive) {
            this.switchQuoteTab(index);
        }
    }

    // 将当前引用文本整理为单行，并修正因换行产生的连字符
    flattenActiveQuote() {
        const activeTextarea = document.querySelector('.quote-panel.active textarea');
        if (!activeTextarea) {
            this.showNotification('未找到可整理的引用文本', 'error');
            return;
        }

        const raw = activeTextarea.value || '';
        // 处理跨行的连字符单词（例如 "exam-\nple" => "example"）
        const noHyphenBreaks = raw.replace(/-\s*\n\s*/g, '');
        // 将换行统一为空格并压缩多余空格
        const singleLine = noHyphenBreaks.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
        activeTextarea.value = singleLine;
        this.showNotification('已整理为单行并修正连字符断行', 'success');
    }

    // 从当前引用文本触发PDF搜索并跳转
    testSearchFromActiveQuote() {
        const activeTextarea = document.querySelector('.quote-panel.active textarea');
        if (!activeTextarea) {
            this.showNotification('未找到引用文本', 'error');
            return;
        }

        const text = (activeTextarea.value || '').trim();
        if (!text) {
            this.showNotification('引用文本为空，无法搜索', 'error');
            return;
        }

        // 使用现有搜索逻辑，跳转到找到的第一个匹配
        const pdfViewer = document.getElementById('pdfViewer');
        if (!pdfViewer || !this.currentPdfUrl) {
            this.showNotification('PDF 未加载', 'error');
            return;
        }

        const pdfWindow = pdfViewer.contentWindow;
        const pdfApp = pdfWindow?.PDFViewerApplication;
        if (!pdfApp) {
            this.showNotification('PDF.js 未初始化', 'error');
            return;
        }

        this.executeSearchAndScroll(pdfApp, text, null);
        this.showNotification('已发起PDF搜索', 'info');
    }

    // 切换标签页
    switchQuoteTab(index) {
        const tabs = document.querySelectorAll('.quote-tab');
        const panels = document.querySelectorAll('.quote-panel');
        
        tabs.forEach(tab => tab.classList.remove('active'));
        panels.forEach(panel => panel.classList.remove('active'));
        
        const targetTab = document.querySelector(`.quote-tab[data-index="${index}"]`);
        const targetPanel = document.querySelector(`.quote-panel[data-index="${index}"]`);
        
        if (targetTab) targetTab.classList.add('active');
        if (targetPanel) {
            targetPanel.classList.add('active');
            
            // 自动聚焦到文本输入框
            const textarea = targetPanel.querySelector('textarea');
            if (textarea) {
                setTimeout(() => {
                    textarea.focus();
                    // 将光标移动到文本末尾
                    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
                }, 100);
            }
        }
    }

    // 删除标签页
    removeQuoteTab(index) {
        const tabsContainer = document.getElementById('quoteTabs');
        const panelsContainer = document.getElementById('quotePanels');
        
        const tab = document.querySelector(`.quote-tab[data-index="${index}"]`);
        const panel = document.querySelector(`.quote-panel[data-index="${index}"]`);
        
        if (tab) tab.remove();
        if (panel) panel.remove();
        
        // 重新索引
        const remainingTabs = tabsContainer.querySelectorAll('.quote-tab');
        const remainingPanels = panelsContainer.querySelectorAll('.quote-panel');
        
        if (remainingTabs.length === 0) {
            // 显示空状态
            panelsContainer.innerHTML = `
                <div class="quote-empty-state">
                    <i class="fas fa-quote-right"></i>
                    <p>暂无引用文本</p>
                    <p style="font-size: 10px; color: #bbb;">点击上方"添加引用"按钮添加</p>
                </div>
            `;
        } else {
            // 重新编号
            remainingTabs.forEach((tab, newIndex) => {
                tab.dataset.index = newIndex;
                tab.querySelector('span').textContent = `引用 ${newIndex + 1}`;
            });
            remainingPanels.forEach((panel, newIndex) => {
                panel.dataset.index = newIndex;
            });
            
            // 激活第一个标签
            this.switchQuoteTab(0);
        }
    }

    closeEditModal() {
        document.getElementById('editModal').classList.remove('active');
        this.editingPath = null;
    }

    async saveEditedValue() {
        if (!this.editingPath) return;

        const newValue = document.getElementById('editTextarea').value;
        const pageNumber = document.getElementById('editPageNumber').value;
        const keyInput = document.getElementById('editKeyInput');
        const inputKey = keyInput ? keyInput.value.trim() : '';
        
        // 从标签页收集所有引用文本
        const quotePanels = document.querySelectorAll('.quote-panel textarea');
        const quotes = Array.from(quotePanels)
            .map(textarea => textarea.value.trim())
            .filter(q => q.length > 0);
        
        // Update data
        let current = this.currentData;
        for (let i = 0; i < this.editingPath.length - 1; i++) {
            current = current[this.editingPath[i]];
        }
        
        let lastKey = this.editingPath[this.editingPath.length - 1];

        // 如果用户修改了字段名，进行重命名（含 _loc）
        if (inputKey && inputKey !== lastKey) {
            if (current.hasOwnProperty(inputKey)) {
                this.showNotification(`字段名已存在: ${inputKey}`, 'error');
                return;
            }
            const oldLocKey = lastKey + '_loc';
            const newLocKey = inputKey + '_loc';
            current[inputKey] = current[lastKey];
            delete current[lastKey];
            if (current.hasOwnProperty(oldLocKey)) {
                current[newLocKey] = current[oldLocKey];
                delete current[oldLocKey];
            }
            lastKey = inputKey;
            this.editingPath[this.editingPath.length - 1] = inputKey;
        }
        
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

        // 特殊处理：如果编辑的是"类"字段（不区分大小写），同步到所有可能的变体
        const keyLower = lastKey.toLowerCase();
        if (keyLower === 'class' || keyLower === '类' || keyLower === 'type' || keyLower === 'category') {
            // 查找所有可能的"类"字段变体并统一更新
            for (const k in current) {
                const kLower = k.toLowerCase();
                if (kLower === 'class' || kLower === '类' || kLower === 'type' || kLower === 'category') {
                    current[k] = current[lastKey];
                }
            }
        }

        // Update location数据
        const locKey = lastKey + '_loc';
        
        // 确保 _loc 字段存在（如果不存在则创建标准结构）
        if (!current[locKey]) {
            current[locKey] = {
                "page_label": "",
                "pdf_page_index": null,
                "pdf_open_params": "",
                "quote": []
            };
        }
        
        // 更新 _loc 字段的值
        if (pageNumber) {
            const pageIndex = parseInt(pageNumber);
            current[locKey].pdf_page_index = pageIndex;
            // 同步更新 page_label 和 pdf_open_params
            current[locKey].page_label = pageIndex.toString();
            current[locKey].pdf_open_params = `#page=${pageIndex}`;
        }
        
        // 保存引用数组
        current[locKey].quote = quotes;

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
        this.updateUndoButtonState();

        this.closeEditModal();
        
        // 提示已暂存
        this.showNotification('✓ 修改已暂存（未保存到文件）', 'info');
    }

    deleteCurrentField() {
        if (!this.editingPath) return;
        const lastKey = this.editingPath[this.editingPath.length - 1];
        const parentPath = this.editingPath.slice(0, -1);
        if (confirm(`确定删除字段 "${lastKey}" 及其 _loc 信息？`)) {
            this.deleteField(parentPath, lastKey);
            this.closeEditModal();
        }
    }

    updateSaveButtonState() {
        const saveBtn = document.getElementById('saveBtn');
        const lastUpdateEl = document.getElementById('lastUpdateDisplay');
        
        if (saveBtn) {
            if (this.hasUnsavedChanges) {
                saveBtn.style.display = 'inline-block';
                saveBtn.innerHTML = '<i class="fas fa-save"></i> 保存修改';
            } else {
                saveBtn.style.display = 'none';
            }
        }
        
        const addSectionBtn = document.getElementById('addSectionBtn');
        if (addSectionBtn) {
            addSectionBtn.style.display = this.currentData ? 'inline-flex' : 'none';
            addSectionBtn.onclick = () => {
                this.hideSectionPreview();
                this.createEmptySectionTemplate();
            };
            addSectionBtn.addEventListener('mouseenter', () => {
                if (this.previewHoverTimer) clearTimeout(this.previewHoverTimer);
                this.previewHoverTimer = setTimeout(() => this.showSectionPreviewInline(), 120);
            });
            addSectionBtn.addEventListener('mouseleave', () => {
                if (this.previewHoverTimer) {
                    clearTimeout(this.previewHoverTimer);
                    this.previewHoverTimer = null;
                }
                this.hideSectionPreview();
            });
        }
        
        // 更新文件名显示，标记未保存状态
        if (lastUpdateEl) {
            const ts = this.currentData?.lastupdate ? this.currentData.lastupdate : '-';
            const unsavedIcon = this.hasUnsavedChanges
                ? `<i class="fas fa-exclamation-triangle unsaved-icon" title="Unsaved changes"></i>`
                : '';
            lastUpdateEl.innerHTML = `Last update: ${ts} ${unsavedIcon}`.trim();
            lastUpdateEl.classList.toggle('unsaved-state', !!this.hasUnsavedChanges);
        }
    }

    // 添加新条目功能
    openAddItemModal() {
        // 重置表单
        document.getElementById('itemCategory').value = '';
        document.getElementById('customKey').value = '';
        document.getElementById('itemContent').value = '';
        document.getElementById('itemPageNumber').value = '';
        document.getElementById('customKeyGroup').style.display = 'none';
        
        // 初始化引用标签页（空状态）
        this.initQuoteTabsForItem([]);
        
        document.getElementById('addItemModal').classList.add('active');
    }

    // 初始化添加条目的引用标签页
    initQuoteTabsForItem(quotes) {
        const quotesArray = Array.isArray(quotes) ? quotes : (quotes ? [quotes] : []);
        const tabsContainer = document.getElementById('quoteTabsItem');
        const panelsContainer = document.getElementById('quotePanelsItem');
        
        tabsContainer.innerHTML = '';
        panelsContainer.innerHTML = '';
        
        if (quotesArray.length === 0) {
            // 显示空状态
            panelsContainer.innerHTML = `
                <div class="quote-empty-state">
                    <i class="fas fa-quote-right"></i>
                    <p>暂无引用文本</p>
                    <p style="font-size: 10px; color: #bbb;">点击上方“添加引用”按钮添加</p>
                </div>
            `;
        } else {
            // 创建标签页
            quotesArray.forEach((quote, index) => {
                this.addQuoteTabForItem(quote, index, index === 0);
            });
        }
        
        // 绑定添加按钮
        const btnAdd = document.getElementById('btnAddQuoteItem');
        btnAdd.onclick = () => this.addQuoteTabForItem('', tabsContainer.children.length, true);
    }

    // 添加条目的引用标签页
    addQuoteTabForItem(content = '', index = 0, setActive = false) {
        const tabsContainer = document.getElementById('quoteTabsItem');
        const panelsContainer = document.getElementById('quotePanelsItem');
        
        // 移除空状态
        const emptyState = panelsContainer.querySelector('.quote-empty-state');
        if (emptyState) {
            emptyState.remove();
        }
        
        // 创建标签
        const tab = document.createElement('div');
        tab.className = 'quote-tab' + (setActive ? ' active' : '');
        tab.dataset.index = index;
        tab.innerHTML = `
            <span>引用 ${index + 1}</span>
            <i class="fas fa-times tab-remove" title="删除"></i>
        `;
        
        // 创建面板
        const panel = document.createElement('div');
        panel.className = 'quote-panel' + (setActive ? ' active' : '');
        panel.dataset.index = index;
        const placeholderText = '在此粘贴从PDF复制的引用文本...\n\n提示：可以包含关键词、段落或公式\n支持多行文本';
        panel.innerHTML = `
            <textarea placeholder="${placeholderText}">${this.escapeHtml(content)}</textarea>
        `;
        
        // 点击标签切换
        tab.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-remove')) {
                this.removeQuoteTabForItem(index);
            } else {
                this.switchQuoteTabForItem(index);
            }
        });
        
        tabsContainer.appendChild(tab);
        panelsContainer.appendChild(panel);
        
        if (setActive) {
            this.switchQuoteTabForItem(index);
        }
    }

    // 切换添加条目的标签页
    switchQuoteTabForItem(index) {
        const tabs = document.querySelectorAll('#quoteTabsItem .quote-tab');
        const panels = document.querySelectorAll('#quotePanelsItem .quote-panel');
        
        tabs.forEach(tab => tab.classList.remove('active'));
        panels.forEach(panel => panel.classList.remove('active'));
        
        const targetTab = document.querySelector(`#quoteTabsItem .quote-tab[data-index="${index}"]`);
        const targetPanel = document.querySelector(`#quotePanelsItem .quote-panel[data-index="${index}"]`);
        
        if (targetTab) targetTab.classList.add('active');
        if (targetPanel) {
            targetPanel.classList.add('active');
            
            // 自动聚焦到文本输入框
            const textarea = targetPanel.querySelector('textarea');
            if (textarea) {
                setTimeout(() => {
                    textarea.focus();
                    // 将光标移动到文本末尾
                    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
                }, 100);
            }
        }
    }

    // 删除添加条目的标签页
    removeQuoteTabForItem(index) {
        const tabsContainer = document.getElementById('quoteTabsItem');
        const panelsContainer = document.getElementById('quotePanelsItem');
        
        const tab = document.querySelector(`#quoteTabsItem .quote-tab[data-index="${index}"]`);
        const panel = document.querySelector(`#quotePanelsItem .quote-panel[data-index="${index}"]`);
        
        if (tab) tab.remove();
        if (panel) panel.remove();
        
        // 重新索引
        const remainingTabs = tabsContainer.querySelectorAll('.quote-tab');
        const remainingPanels = panelsContainer.querySelectorAll('.quote-panel');
        
        if (remainingTabs.length === 0) {
            // 显示空状态
            panelsContainer.innerHTML = `
                <div class="quote-empty-state">
                    <i class="fas fa-quote-right"></i>
                    <p>暂无引用文本</p>
                    <p style="font-size: 10px; color: #bbb;">点击上方“添加引用”按钮添加</p>
                </div>
            `;
        } else {
            // 重新编号
            remainingTabs.forEach((tab, newIndex) => {
                tab.dataset.index = newIndex;
                tab.querySelector('span').textContent = `引用 ${newIndex + 1}`;
            });
            remainingPanels.forEach((panel, newIndex) => {
                panel.dataset.index = newIndex;
            });
            
            // 激活第一个标签
            this.switchQuoteTabForItem(0);
        }
    }

    closeAddItemModal() {
        document.getElementById('addItemModal').classList.remove('active');
    }

    saveNewItem() {
        const category = document.getElementById('itemCategory').value;
        const customKey = document.getElementById('customKey').value;
        const content = document.getElementById('itemContent').value;
        const pageNumber = document.getElementById('itemPageNumber').value;
        
        // 从标签页收集所有引用文本
        const quotePanels = document.querySelectorAll('#quotePanelsItem .quote-panel textarea');
        const quotes = Array.from(quotePanels)
            .map(textarea => textarea.value.trim())
            .filter(q => q.length > 0);

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

        const newItem = content.trim();
        const locPayload = {
            pdf_page_index: pageNumber ? parseInt(pageNumber) : null,
            page_label: pageNumber ? pageNumber.toString() : '',
            pdf_open_params: pageNumber ? `#page=${pageNumber}` : '',
            quote: quotes
        };

        // 处理不同数据形态：如果已有数组则push；如果不存在则按字符串+loc对象；如果已有非数组则直接覆盖
        if (Array.isArray(this.currentData[key])) {
            this.currentData[key].push(newItem);
            if (pageNumber || quotes.length > 0) {
                const locKey = key + '_loc';
                if (!Array.isArray(this.currentData[locKey])) {
                    this.currentData[locKey] = [];
                }
                this.currentData[locKey].push(locPayload);
            }
        } else if (this.currentData[key] === undefined) {
            // 新建为标量字段，loc为对象
            this.currentData[key] = newItem;
            const locKey = key + '_loc';
            this.currentData[locKey] = locPayload;
        } else {
            // 已存在但不是数组：覆盖现有值及loc
            this.currentData[key] = newItem;
            const locKey = key + '_loc';
            this.currentData[locKey] = locPayload;
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
    
    // 创建一个空的类字段模板，便于用户快速编辑
    createEmptySectionTemplate() {
        if (!this.currentData) {
            this.showNotification('请先加载一个JSON文件', 'error');
            return;
        }

        let sectionName = prompt('请输入新类字段名称（顶级键）:', 'new_section');
        if (!sectionName) return;
        sectionName = sectionName.trim();
        if (!sectionName) return;

        if (this.currentData.hasOwnProperty(sectionName)) {
            this.showNotification(`字段 "${sectionName}" 已存在`, 'error');
            return;
        }

        // 提供一个可编辑的占位结构，包含loc信息
        const template = {
            placeholder_field: '',
            placeholder_field_loc: {
                page_label: '',
                pdf_page_index: null,
                pdf_open_params: '',
                quote: []
            }
        };

        this.currentData[sectionName] = template;

        this.hasUnsavedChanges = true;
        this.tempDataCache[this.currentFile] = this.currentData;
        this.updateSaveButtonState();
        this.renderStructuredView();
        this.renderFlatView();
        this.setupEditableListeners();
        this.showNotification(`已创建类字段 "${sectionName}"，可双击键或值进行编辑`, 'success');
    }

    // 在指定类下添加子条目（带_loc占位）
    addChildField(sectionKey) {
        if (!this.currentData || !this.currentData[sectionKey] || typeof this.currentData[sectionKey] !== 'object') {
            this.showNotification('当前类不可用，无法添加条目', 'error');
            return;
        }

        const parent = this.currentData[sectionKey];
        let key = prompt(`在 "${sectionKey}" 下添加子字段，输入字段名:`, 'new_field');
        if (!key) return;
        key = key.trim();
        if (!key) return;

        // 若存在同名，自动追加序号
        let finalKey = key;
        let idx = 1;
        while (parent.hasOwnProperty(finalKey) || parent.hasOwnProperty(finalKey + '_loc')) {
            finalKey = `${key}_${idx++}`;
        }

        parent[finalKey] = '';
        parent[finalKey + '_loc'] = {
            page_label: '',
            pdf_page_index: null,
            pdf_open_params: '',
            quote: []
        };

        this.hasUnsavedChanges = true;
        this.tempDataCache[this.currentFile] = this.currentData;
        this.updateSaveButtonState();
        this.renderStructuredView();
        this.renderFlatView();
        this.setupEditableListeners();
        this.showNotification(`已添加子字段 "${finalKey}"，可双击编辑`, 'success');
    }

    // 快速插入稳健性检查模板
    createRobustnessTemplate() {
        if (!this.currentData) {
            this.showNotification('请先加载一个JSON文件', 'error');
            return;
        }

        const tplKey = 'robustness_checks';
        if (this.currentData[tplKey]) {
            if (!confirm('已存在 robustness_checks，是否覆盖现有内容？')) return;
        }

        this.currentData[tplKey] = {
            endogeneity_method: '',
            endogeneity_method_loc: {
                page_label: '',
                pdf_page_index: null,
                pdf_open_params: '',
                quote: []
            },
            parallel_trend_check: '',
            parallel_trend_check_loc: {
                page_label: '',
                pdf_page_index: null,
                pdf_open_params: '',
                quote: []
            }
        };

        this.hasUnsavedChanges = true;
        this.tempDataCache[this.currentFile] = this.currentData;
        this.updateSaveButtonState();
        this.renderStructuredView();
        this.renderFlatView();
        this.setupEditableListeners();
        this.showNotification('已添加稳健性检查模板，可直接编辑字段', 'success');
    }

    setupEditableListeners() {
        // 使用事件委托，监听整个文档的双击事件，更稳健
        // 移除之前可能存在的监听器，避免重复绑定
        if (this._editableClickHandler) {
            document.removeEventListener('dblclick', this._editableClickHandler);
        }
        
        this._editableClickHandler = (e) => {
            const target = e.target;
            
            // 处理双击 editable-key（编辑字段名）
            if (target.classList.contains('editable-key') || target.closest('.editable-key')) {
                const el = target.classList.contains('editable-key') ? target : target.closest('.editable-key');
                const parentPath = el.dataset.path ? el.dataset.path.split('.').filter(p => p) : [];
                const oldKey = el.dataset.key;
                this.openEditKeyModal(parentPath, oldKey);
                return;
            }
            
            // 处理双击 editable-value（编辑值）
            if (target.classList.contains('editable-value') || target.closest('.editable-value')) {
                const el = target.classList.contains('editable-value') ? target : target.closest('.editable-value');
                const path = el.dataset.path.split('.');
                const value = el.dataset.rawValue !== undefined ? el.dataset.rawValue : el.textContent;
                this.openEditModal(path, value);
                return;
            }
        };
        
        // 使用事件委托，绑定到document
        document.addEventListener('dblclick', this._editableClickHandler);
        
        // 处理 location-link 点击事件（也使用事件委托）
        if (this._locationLinkHandler) {
            document.removeEventListener('click', this._locationLinkHandler);
        }
        
        this._locationLinkHandler = (e) => {
            const target = e.target;
            const link = target.classList.contains('location-link') ? target : target.closest('.location-link');
            
            if (link) {
                e.preventDefault();
                const page = parseInt(link.dataset.page);
                const valuePath = link.dataset.valuePath;
                const quoteIndex = link.dataset.quoteIndex !== undefined ? parseInt(link.dataset.quoteIndex) : 0;
                
                // 直接跳转，让executeSearchAndScroll处理循环逻辑
                this.jumpToPageWithQuote(page, valuePath, quoteIndex);
            }
        };
        
        document.addEventListener('click', this._locationLinkHandler);

        // 右键删除字段
        if (this._fieldContextHandler) {
            document.removeEventListener('contextmenu', this._fieldContextHandler);
        }
        this._fieldContextHandler = (e) => {
            const row = e.target.closest('tr[data-key]');
            const section = e.target.closest('.collapsible-section');
            if (!this.isReorderMode) return;

            // 行删除
            if (row) {
                e.preventDefault();
                const table = row.closest('table');
                const tablePath = table?.dataset.path ? table.dataset.path.split('.').filter(Boolean) : [];
                const key = row.dataset.key;
                if (!key) return;
                if (confirm(`删除字段 "${key}" 及其 _loc 信息？`)) {
                    this.deleteField(tablePath, key);
                }
                return;
            }

            // 章节删除
            if (section) {
                e.preventDefault();
                const secKey = section.dataset.sectionKey;
                if (!secKey) return;
                if (confirm(`删除类 "${secKey}" 及其内容？`)) {
                    this.deleteField([], secKey);
                }
            }
        };
        document.addEventListener('contextmenu', this._fieldContextHandler);

        // 数学公式预览
        if (this._mathHoverHandler) {
            document.removeEventListener('mouseover', this._mathHoverHandler);
        }
        this._mathHoverHandler = (e) => {
            const el = e.target.closest('.editable-value');
            if (!el) return;
            const text = el.dataset.rawValue !== undefined ? el.dataset.rawValue : el.textContent;
            if (!this.containsMathSyntax(text)) return;
            this.showMathPreview(text, el);
        };
        document.addEventListener('mouseover', this._mathHoverHandler);

        if (this._mathLeaveHandler) {
            document.removeEventListener('mouseout', this._mathLeaveHandler);
        }
        this._mathLeaveHandler = (e) => {
            const el = e.target.closest('.editable-value');
            const related = e.relatedTarget;
            if (el && related && related.closest && related.closest('.math-preview')) {
                return;
            }
            this.hideMathPreview();
        };
        document.addEventListener('mouseout', this._mathLeaveHandler);
    }

    // 获取指定字段的quote数量
    getQuoteCount(valuePath) {
        if (!valuePath) return 0;
        
        const pathArray = valuePath.split('.');
        let current = this.currentData;
        
        // 导航到字段所在的父对象
        for (let i = 0; i < pathArray.length - 1; i++) {
            if (current && current.hasOwnProperty(pathArray[i])) {
                current = current[pathArray[i]];
            } else {
                return 0;
            }
        }
        
        if (current) {
            const lastKey = pathArray[pathArray.length - 1];
            const locKey = lastKey + '_loc';
            
            if (current[locKey] && current[locKey].quote) {
                const quotes = current[locKey].quote;
                if (Array.isArray(quotes)) {
                    return quotes.filter(q => q && q.trim()).length;
                } else if (typeof quotes === 'string' && quotes.trim()) {
                    return 1;
                }
            }
        }
        
        return 0;
    }

    // 跳转到页面并高亮指定的quote
    jumpToPageWithQuote(page, valuePath, quoteIndex = null) {
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
                
                // 从 _loc.quote 获取搜索文本
                if (current[locKey] && current[locKey].quote) {
                    const quotes = current[locKey].quote;
                    
                    if (Array.isArray(quotes)) {
                        // 如果是数组，获取指定索引的quote
                        if (quoteIndex !== null && quoteIndex >= 0 && quoteIndex < quotes.length) {
                            searchText = this.cleanQuoteForSearch(quotes[quoteIndex]);
                            console.log(`🔍 从 quote[${quoteIndex}] 获取搜索文本:`, searchText);
                        } else if (quotes.length > 0) {
                            // 默认使用第一个
                            searchText = this.cleanQuoteForSearch(quotes[0]);
                            console.log('🔍 从 quote[0] 获取搜索文本:', searchText);
                        }
                    } else if (typeof quotes === 'string') {
                        // 兼容旧的字符串格式
                        searchText = this.cleanQuoteForSearch(quotes);
                        console.log('🔍 从 quote 字符串获取搜索文本:', searchText);
                    }
                }
                
                // 如果没有 quote，使用字段值本身
                if (!searchText) {
                    const fieldValue = current[lastKey];
                    if (fieldValue !== null && fieldValue !== undefined) {
                        searchText = typeof fieldValue === 'string' ? fieldValue : JSON.stringify(fieldValue);
                        console.log('🔍 从字段值获取搜索文本:', searchText);
                    }
                }
            }
        }
        
        if (page && searchText) {
            this.jumpToPage(page, searchText, valuePath);
        } else if (page) {
            this.jumpToPage(page, '', valuePath);
        }
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
        // Only save when there are pending changes; avoid touching lastupdate otherwise
        if (!this.hasUnsavedChanges) {
            this.showNotification('No changes to save', 'info');
            return;
        }

        try {
            // 更新最后保存时间戳
            this.currentData.lastupdate = this.generateLastUpdate();
            const jsonString = JSON.stringify(this.currentData, null, 2);
            
            // 发送POST请求到服务器保存文件
            const response = await fetch('/save-json', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    projectPath: this.currentProject ? this.currentProject.path : 'user',
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
