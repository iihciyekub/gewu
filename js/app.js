// Import PDF.js (不再需要，使用iframe加载viewer)

class PaperReviewerApp {
    constructor() {
        this.currentFile = null;
        this.currentData = null;
        this.currentPdfUrl = null;
        this.editingPath = null;
        this.hasUnsavedChanges = false;
        this.tempDataCache = {}; // 临时数据缓存 {filename: data}
        this.currentQuoteIndex = {}; // 跟踪每个字段当前显示的quote索引 {valuePath: index}
        this.lastSearchText = null; // 跟踪上次搜索的文本
        this.lastSearchValuePath = null; // 跟踪上次搜索的字段路径
        this.searchMatchCount = 0; // 当前搜索的匹配数量
        this.currentMatchIndex = 0; // 当前显示的匹配索引
        
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

        // 粘贴事件监听
        document.addEventListener('paste', (e) => this.handlePaste(e));
        
        // 全屏横向连续阅读模式
        const btnFullscreen = document.getElementById('btnFullscreenRead');
        console.log('🔘 全屏按钮元素:', btnFullscreen);
        if (btnFullscreen) {
            btnFullscreen.addEventListener('click', () => {
                console.log('🖱️ 全屏按钮被点击');
                this.openFullscreenReader();
            });
        }
        
        document.getElementById('btnReaderClose').addEventListener('click', () => this.closeFullscreenReader());
        document.getElementById('btnReaderZoomIn').addEventListener('click', () => this.adjustReaderZoom(1.02));  // 2%步进
        document.getElementById('btnReaderZoomOut').addEventListener('click', () => this.adjustReaderZoom(0.98)); // 2%步进
        document.getElementById('btnReaderFitHeight').addEventListener('click', () => this.fitToHeight());
        document.getElementById('btnReaderFitWidth').addEventListener('click', () => this.fitToWidth());
        
        // ESC键退出全屏
        document.addEventListener('keydown', (e) => {
            const fullscreenReader = document.getElementById('fullscreenReader');
            const isFullscreen = fullscreenReader && fullscreenReader.classList.contains('active');
            
            if (isFullscreen && e.key === 'Escape') {
                this.closeFullscreenReader();
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
                <div class="recent-project-info">
                    <div class="recent-project-name">${this.escapeHtml(project.name)}</div>
                    <div class="recent-project-path">${this.escapeHtml(project.path)}</div>
                </div>
            `;
            item.addEventListener('click', () => {
                this.switchProject(project);
            });
            container.appendChild(item);
        });
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
            path: projectPath
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
        this.recentProjects = this.recentProjects.filter(p => p.path !== project.path);
        
        // 添加到开头
        this.recentProjects.unshift(project);
        
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
            const filename = item.querySelector('span').textContent;
            existingItems.set(filename, item);
        });
        
        // 按文件名排序
        const sortedFiles = [...files].sort();
        
        // 创建新的文件列表结构
        const newFileListEl = document.createElement('div');
        
        sortedFiles.forEach((file, index) => {
            let fileItem;
            
            // 复用现有的DOM元素
            if (existingItems.has(file)) {
                fileItem = existingItems.get(file);
                existingItems.delete(file); // 标记为已使用
            } else {
                // 创建新元素
                fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                fileItem.innerHTML = `
                    <i class="fas fa-file-alt"></i>
                    <span>${file}</span>
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
                e.preventDefault();
                
                // 询问文件名
                const filename = prompt('检测到有效的JSON数据！\n请输入文件名:', 'pasted_data.json');
                if (!filename) return;
                
                const finalFilename = filename.endsWith('.json') ? filename : filename + '.json';
                
                // 保存JSON文件
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
            const row = document.createElement('tr');
            const toggleCell = document.createElement('td');
            const keyCell = document.createElement('td');
            const valueCell = document.createElement('td');

            // 判断是否是_loc字段
            const isLocField = key.endsWith('_loc');
            
            // _loc字段默认隐藏，添加特殊样式
            if (isLocField) {
                row.classList.add('loc-field-row', 'collapsed');
            }

            // 检查是否有对应的 location 信息
            const locKey = key + '_loc';
            const locationInfo = (!isLocField && obj[locKey]) ? obj[locKey] : null;

            // 第一列：展开/折叠按钮（如果有对应的_loc字段）
            toggleCell.className = 'toggle-cell';
            if (!isLocField && obj[locKey]) {
                const toggleBtn = document.createElement('button');
                toggleBtn.className = 'loc-toggle-btn';
                toggleBtn.innerHTML = '<i class="fas fa-chevron-down"></i>';
                toggleBtn.title = '显示/隐藏位置信息';
                toggleBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleLocField(table, key);
                });
                toggleCell.appendChild(toggleBtn);
            }

            // 第二列：Key可编辑
            const keyDisplay = isLocField 
                ? `<span class="editable-key loc-key" data-path="${basePath.join('.')}" data-key="${key}">
                     <i class="fas fa-info-circle"></i> ${this.formatKey(key)}
                   </span>`
                : `<span class="editable-key" data-path="${basePath.join('.')}" data-key="${key}">${this.formatKey(key)}</span>`;
            
            keyCell.innerHTML = keyDisplay;
            const currentPath = [...basePath, key];

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
        
        // 特殊处理: DOI 字段，添加 Web of Science 链接
        if (key === 'doi' && typeof value === 'string' && value.trim()) {
            const wosUrl = this.generateWosUrl(value.trim());
            return `<a href="${wosUrl}" target="_blank" class="doi-link" title="在 Web of Science 中查看">
                <i class="fas fa-external-link-alt"></i> ${this.escapeHtml(displayValue)}
            </a>`;
        }
        
        const rawValueAttr = this.escapeHtml(displayValue);
        let html = `<span class="editable-value" data-path="${path.join('.')}" data-raw-value="${rawValueAttr}">${this.escapeHtml(displayValue)}</span>`;
        
        if (location) {
            const page = location.pdf_page_index || 1;
            const quotes = location.quote || [];
            const valuePath = path.join('.');
            
            // 如果quote是数组，为每个quote创建一个引用图标
            if (Array.isArray(quotes) && quotes.length > 0) {
                const validQuotes = quotes.filter(q => q && q.trim());
                validQuotes.forEach((quote, index) => {
                    // 所有图标使用相同valuePath，通过点击处理器循环切换
                    html += `<a href="#" class="location-link" 
                        data-page="${page}" 
                        data-value-path="${valuePath}"
                        data-quote-index="${index}"
                        title="跳转到 PDF 第 ${page} 页并高亮 (循环 ${index + 1}/${validQuotes.length})">
                        <i class="fa-solid fa-quote-right"></i>
                    </a>`;
                });
            } else if (typeof quotes === 'string' && quotes.trim()) {
                // 兼容旧的字符串格式
                html += `<a href="#" class="location-link" 
                    data-page="${page}" 
                    data-value-path="${valuePath}"
                    data-quote-index="0"
                    title="跳转到 PDF 第 ${page} 页并高亮文本">
                    <i class="fa-solid fa-quote-right"></i>
                </a>`;
            } else {
                // 没有quote，只显示页码图标
                html += `<a href="#" class="location-link" 
                    data-page="${page}" 
                    data-value-path="${valuePath}"
                    title="跳转到 PDF 第 ${page} 页">
                    <i class="fa-solid fa-quote-right"></i>
                </a>`;
            }
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
            
            // 监听iframe加载完成（如需自定义滚动行为，可在此扩展）
            pdfViewer.onload = () => {
                // 保持空实现，避免自动设置滚动动画
            };
            
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
        
        document.getElementById('editModal').classList.add('active');
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
            if (pageNumber || quotes.length > 0) {
                const locKey = key + '_loc';
                if (!this.currentData[locKey]) {
                    this.currentData[locKey] = [];
                }
                this.currentData[locKey].push({
                    pdf_page_index: pageNumber ? parseInt(pageNumber) : null,
                    page_label: pageNumber ? pageNumber.toString() : '',
                    pdf_open_params: pageNumber ? `#page=${pageNumber}` : '',
                    quote: quotes
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

    // ==================== 全屏横向连续阅读模式 ====================
    
    initFullscreenReader() {
        this.fullscreenState = {
            pdfDoc: null,
            currentStartPage: 1,
            totalPages: 0,
            baseScale: 1.0,  // 基础渲染缩放（页面渲染时使用）
            viewScale: 1.0,   // 视图缩放（CSS transform）
            isLoading: false
        };
        
        // 初始化页面导航监听器
        this.setupPageNavigationListeners();
    }

    async openFullscreenReader() {
        console.log('🚀 打开全屏阅读器');
        console.log('当前PDF URL:', this.currentPdfUrl);
        
        if (!this.currentPdfUrl) {
            this.showNotification('请先选择一个PDF文件', 'error');
            return;
        }

        const fullscreenReader = document.getElementById('fullscreenReader');
        fullscreenReader.classList.add('active');
        console.log('✓ 全屏容器已激活');
        
        // 尝试从 iframe 获取当前页码
        let startPage = 1;
        try {
            const iframe = document.getElementById('pdfViewer');
            if (iframe && iframe.contentWindow && iframe.contentWindow.PDFViewerApplication) {
                startPage = iframe.contentWindow.PDFViewerApplication.page || 1;
                console.log('✓ 从iframe获取页码:', startPage);
            }
        } catch (e) {
            console.log('无法获取当前页码，从第1页开始');
        }

        this.fullscreenState.currentStartPage = startPage;
        
        // 设置手势支持
        this.setupFullscreenGestures();
        
        // 加载PDF
        await this.loadFullscreenPDF();
    }

    async loadFullscreenPDF() {
        if (this.fullscreenState.isLoading) {
            console.log('⚠️ 已在加载中，跳过');
            return;
        }
        
        this.fullscreenState.isLoading = true;
        const container = document.getElementById('continuousPages');
        console.log('📦 容器元素:', container);
        
        // 显示加载状态
        container.innerHTML = `
            <div class="fullscreen-loading">
                <div class="spinner"></div>
                <div>正在加载PDF...</div>
            </div>
        `;
        console.log('✓ 加载提示已显示');

        try {
            // 动态加载 PDF.js (使用ES6 import)
            console.log('📚 开始加载PDF.js库...');
            if (!this.pdfjsLib) {
                this.pdfjsLib = await import('/js/pdfjs/build/pdf.mjs');
                this.pdfjsLib.GlobalWorkerOptions.workerSrc = '/js/pdfjs/build/pdf.worker.mjs';
                console.log('✓ PDF.js库加载成功');
            }

            // 加载 PDF 文档
            console.log('📄 开始加载PDF文档:', this.currentPdfUrl);
            const loadingTask = this.pdfjsLib.getDocument(this.currentPdfUrl);
            this.fullscreenState.pdfDoc = await loadingTask.promise;
            this.fullscreenState.totalPages = this.fullscreenState.pdfDoc.numPages;

            console.log(`✓ PDF加载成功，共 ${this.fullscreenState.totalPages} 页`);

            // 渲染页面
            console.log('🎨 开始渲染页面...');
            await this.renderContinuousPages();
            console.log('✓ 渲染完成');
            
        } catch (error) {
            console.error('❌ 加载PDF失败:', error);
            console.error('错误详情:', error.stack);
            container.innerHTML = `
                <div class="fullscreen-loading">
                    <i class="fas fa-exclamation-triangle" style="font-size: 40px; color: #ff6b6b;"></i>
                    <div>加载失败: ${error.message}</div>
                </div>
            `;
        } finally {
            this.fullscreenState.isLoading = false;
            console.log('🏁 加载流程结束');
        }
    }

    async renderContinuousPages(keepPage = null) {
        const container = document.getElementById('continuousPages');
        console.log('🎯 开始渲染连续页面');

        const startPage = keepPage || this.fullscreenState.currentStartPage;
        const totalPages = this.fullscreenState.totalPages;
        const pdfDoc = this.fullscreenState.pdfDoc;

        // 渲染所有页面
        const pagesToRender = [];
        for (let i = 1; i <= totalPages; i++) {
            pagesToRender.push(i);
        }

        console.log(`📑 渲染所有页面: 1-${totalPages} (起始页: ${startPage})`);

        // 显示加载进度
        container.innerHTML = `
            <div class="fullscreen-loading">
                <div class="spinner"></div>
                <div>正在加载页面 <span id="loadProgress">0/${totalPages}</span></div>
            </div>
        `;

        // 批量渲染所有页面
        for (let i = 0; i < pagesToRender.length; i++) {
            const pageNum = pagesToRender[i];
            
            // 更新进度
            const progressEl = document.getElementById('loadProgress');
            if (progressEl) {
                progressEl.textContent = `${i + 1}/${totalPages}`;
            }
            
            await this.renderPage(pageNum, container);
        }
        
        // 移除加载提示
        const loadingEl = container.querySelector('.fullscreen-loading');
        if (loadingEl) {
            loadingEl.remove();
        }

        console.log('✓ 所有页面渲染完成');

        // 应用CSS transform缩放
        container.style.transform = `scale(${this.fullscreenState.viewScale})`;
        container.style.transformOrigin = 'center center';

        // 滚动到起始页
        const targetCanvas = container.querySelector(`[data-page="${startPage}"]`);
        if (targetCanvas) {
            console.log(`📍 滚动到第 ${startPage} 页`);
            targetCanvas.scrollIntoView({ block: 'center', inline: 'center' });
        } else {
            console.warn(`⚠️ 未找到第 ${startPage} 页的canvas元素`);
        }
    }

    async renderPage(pageNum, container) {
        try {
            const page = await this.fullscreenState.pdfDoc.getPage(pageNum);
            const canvas = document.createElement('canvas');
            canvas.dataset.page = pageNum;
            const ctx = canvas.getContext('2d');

            // 使用baseScale作为渲染缩放比例
            const viewport = page.getViewport({ scale: 1.0 });
            const scale = this.fullscreenState.baseScale;
            const scaledViewport = page.getViewport({ scale });

            // 支持高清屏
            const dpr = window.devicePixelRatio || 1;
            canvas.width = scaledViewport.width * dpr;
            canvas.height = scaledViewport.height * dpr;
            canvas.style.width = scaledViewport.width + 'px';
            canvas.style.height = scaledViewport.height + 'px';

            ctx.scale(dpr, dpr);

            const renderContext = {
                canvasContext: ctx,
                viewport: scaledViewport
            };

            // 将canvas添加到容器（在加载提示之后）
            const loadingEl = container.querySelector('.fullscreen-loading');
            if (loadingEl) {
                container.insertBefore(canvas, loadingEl);
            } else {
                container.appendChild(canvas);
            }
            
            await page.render(renderContext).promise;
            // console.log(`    ✓ 第 ${pageNum} 页渲染完成`); // 减少日志输出

        } catch (error) {
            console.error(`❌ 渲染第 ${pageNum} 页失败:`, error);
        }
    }

    closeFullscreenReader() {
        const fullscreenReader = document.getElementById('fullscreenReader');
        fullscreenReader.classList.remove('active');
        
        // 清理定时器
        if (this.pageNavTimer) {
            clearTimeout(this.pageNavTimer);
            this.pageNavTimer = null;
        }
        if (this.pageNavInterval) {
            clearInterval(this.pageNavInterval);
            this.pageNavInterval = null;
        }
        
        // 清理PDF
        document.getElementById('continuousPages').innerHTML = '';
        if (this.fullscreenState.pdfDoc) {
            this.fullscreenState.pdfDoc.destroy();
            this.fullscreenState.pdfDoc = null;
        }
    }

    navigateFullscreenPage(direction) {
        const container = document.getElementById('continuousPages');
        const contentEl = document.getElementById('fullscreenContent');
        if (!container || !contentEl) return;

        const allCanvases = Array.from(container.querySelectorAll('canvas[data-page]'));
        if (allCanvases.length === 0) return;

        // 获取当前视口中心的页面
        const scrollLeft = contentEl.scrollLeft;
        const viewportCenter = scrollLeft + (contentEl.clientWidth / 2);

        let currentPageIndex = 0;
        let minDistance = Infinity;

        allCanvases.forEach((canvas, index) => {
            const canvasLeft = canvas.offsetLeft;
            const canvasCenter = canvasLeft + (canvas.offsetWidth / 2);
            const distance = Math.abs(canvasCenter - viewportCenter);

            if (distance < minDistance) {
                minDistance = distance;
                currentPageIndex = index;
            }
        });

        // 计算目标页面
        let targetIndex = currentPageIndex + direction;
        targetIndex = Math.max(0, Math.min(allCanvases.length - 1, targetIndex));

        if (targetIndex === currentPageIndex && direction !== 0) return;

        const targetCanvas = allCanvases[targetIndex];
        const targetLeft = targetCanvas.offsetLeft - (contentEl.clientWidth - targetCanvas.offsetWidth) / 2;
        contentEl.scrollLeft = targetLeft;
    }

    setupPageNavigationListeners() {
        document.addEventListener('keydown', (e) => {
            const fullscreenReader = document.getElementById('fullscreenReader');
            const isFullscreen = fullscreenReader && fullscreenReader.classList.contains('active');
            
            if (!isFullscreen) return;
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            if (e.repeat) return;

            e.preventDefault();
            
            const direction = e.key === 'ArrowLeft' ? -1 : 1;
            this.navigateFullscreenPage(direction);
            
            // 设置长按连续翻页 - 更快的响应速度
            this.pageNavTimer = setTimeout(() => {
                this.pageNavInterval = setInterval(() => {
                    this.navigateFullscreenPage(direction);
                }, 80);  // 从100ms改为80ms，速度更快
            }, 200);  // 从300ms改为200ms，更快触发连续翻页
        });

        document.addEventListener('keyup', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                if (this.pageNavTimer) {
                    clearTimeout(this.pageNavTimer);
                    this.pageNavTimer = null;
                }
                if (this.pageNavInterval) {
                    clearInterval(this.pageNavInterval);
                    this.pageNavInterval = null;
                }
            }
        });
    }

    getCurrentVisiblePage() {
        // 获取当前视口中最可见的页码
        const container = document.getElementById('continuousPages');
        const contentEl = document.getElementById('fullscreenContent');
        
        if (!container || !contentEl) {
            return this.fullscreenState.currentStartPage || 1;
        }
        
        const allCanvases = Array.from(container.querySelectorAll('canvas[data-page]'));
        if (allCanvases.length === 0) {
            return this.fullscreenState.currentStartPage || 1;
        }
        
        // 获取视口中心点
        const viewportCenterX = contentEl.scrollLeft + contentEl.clientWidth / 2;
        const viewportCenterY = contentEl.scrollTop + contentEl.clientHeight / 2;
        
        // 找到最接近视口中心的页面
        let closestPage = 1;
        let minDistance = Infinity;
        
        allCanvases.forEach(canvas => {
            const rect = canvas.getBoundingClientRect();
            const containerRect = contentEl.getBoundingClientRect();
            
            // 计算canvas相对于容器的中心点
            const canvasCenterX = contentEl.scrollLeft + (rect.left - containerRect.left) + rect.width / 2;
            const canvasCenterY = contentEl.scrollTop + (rect.top - containerRect.top) + rect.height / 2;
            
            // 计算到视口中心的距离
            const distance = Math.sqrt(
                Math.pow(canvasCenterX - viewportCenterX, 2) + 
                Math.pow(canvasCenterY - viewportCenterY, 2)
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                closestPage = parseInt(canvas.dataset.page);
            }
        });
        
        return closestPage;
    }

    async adjustReaderZoom(factor) {
        // 限制缩放范围 0.5x - 3.0x
        const newScale = this.fullscreenState.viewScale * factor;
        if (newScale < 0.5 || newScale > 3.0) {
            console.log(`⚠️ 缩放超出范围: ${newScale.toFixed(2)}`);
            return;
        }
        
        this.fullscreenState.viewScale = newScale;
        
        // 更新缩放显示
        const totalZoom = this.fullscreenState.baseScale * this.fullscreenState.viewScale;
        const zoomPercent = Math.round(totalZoom * 100);
        document.getElementById('zoomIndicator').textContent = `${zoomPercent}%`;
        
        // 直接使用CSS transform缩放，不重新渲染
        const container = document.getElementById('continuousPages');
        if (container) {
            container.style.transform = `scale(${this.fullscreenState.viewScale})`;
            container.style.transformOrigin = 'center center';
        }
    }
    
    async fitToHeight() {
        // 适配高度：使PDF页面高度适配屏幕高度
        if (!this.fullscreenState.pdfDoc) return;
        
        // 保存当前可见页码
        const currentPage = this.getCurrentVisiblePage();
        
        const page = await this.fullscreenState.pdfDoc.getPage(1);
        const viewport = page.getViewport({ scale: 1.0 });
        
        // 获取内容区域高度（扣除工具栏）
        const toolbar = document.querySelector('.fullscreen-floating-toolbar');
        const toolbarHeight = toolbar ? toolbar.offsetHeight : 0;
        const contentHeight = window.innerHeight - toolbarHeight - 40; // 40px为上下间距
        
        // 计算适配缩放比例
        const fitZoom = contentHeight / viewport.height;
        
        // 限制在合理范围内
        this.fullscreenState.baseScale = Math.max(0.5, Math.min(3.0, fitZoom));
        this.fullscreenState.viewScale = 1.0; // 重置viewScale
        
        // 更新显示
        const zoomPercent = Math.round(this.fullscreenState.baseScale * 100);
        document.getElementById('zoomIndicator').textContent = `${zoomPercent}%`;
        
        // 重新渲染
        await this.renderContinuousPages(currentPage);
    }
    
    async fitToWidth() {
        // 适配宽度：使PDF页面宽度适配屏幕宽度
        if (!this.fullscreenState.pdfDoc) return;
        
        // 保存当前可见页码
        const currentPage = this.getCurrentVisiblePage();
        
        const page = await this.fullscreenState.pdfDoc.getPage(1);
        const viewport = page.getViewport({ scale: 1.0 });
        
        // 获取内容区域宽度（扣除左右间距）
        const contentWidth = window.innerWidth - 40; // 40px为左右间距
        
        // 计算适配缩放比例
        const fitZoom = contentWidth / viewport.width;
        
        // 限制在合理范围内
        this.fullscreenState.baseScale = Math.max(0.5, Math.min(3.0, fitZoom));
        this.fullscreenState.viewScale = 1.0; // 重置viewScale
        
        // 更新显示
        const zoomPercent = Math.round(this.fullscreenState.baseScale * 100);
        document.getElementById('zoomIndicator').textContent = `${zoomPercent}%`;
        
        // 重新渲染
        await this.renderContinuousPages(currentPage);
    }
    
    setupFullscreenGestures() {
        const content = document.getElementById('fullscreenContent');
        if (!content) return;
        
        // 双指缩放手势支持
        let initialDistance = 0;
        let initialZoom = 1.0;
        
        content.addEventListener('wheel', (e) => {
            // 检测触控板双指缩放 (Ctrl + wheel 或 metaKey + wheel)
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                
                // deltaY < 0 = 放大, deltaY > 0 = 缩小
                const delta = -e.deltaY;
                const zoomFactor = 1 + (delta * 0.002); // 精细调整
                
                this.adjustReaderZoom(zoomFactor);
            }
        }, { passive: false });
        
        // 触摸屏双指缩放
        content.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                initialDistance = Math.hypot(
                    touch2.clientX - touch1.clientX,
                    touch2.clientY - touch1.clientY
                );
                initialZoom = this.fullscreenState.zoom;
            }
        }, { passive: false });
        
        content.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const currentDistance = Math.hypot(
                    touch2.clientX - touch1.clientX,
                    touch2.clientY - touch1.clientY
                );
                
                if (initialDistance > 0) {
                    const scale = currentDistance / initialDistance;
                    const newZoom = initialZoom * scale;
                    
                    // 限制范围
                    if (newZoom >= 0.5 && newZoom <= 3.0) {
                        this.fullscreenState.zoom = newZoom;
                        const zoomPercent = Math.round(newZoom * 100);
                        document.getElementById('zoomIndicator').textContent = `${zoomPercent}%`;
                    }
                }
            }
        }, { passive: false });
        
        content.addEventListener('touchend', async (e) => {
            if (e.touches.length < 2 && initialDistance > 0) {
                // 双指松开，重新渲染
                initialDistance = 0;
                if (this.fullscreenState.pdfDoc) {
                    await this.renderContinuousPages();
                }
            }
        });
    }

    // ==================== 结束全屏阅读模式 ====================

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
    
    // 初始化全屏阅读器
    app.initFullscreenReader();
    
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
