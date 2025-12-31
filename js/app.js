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
        this.currentMarkdownBaselineText = '';
        this.markdownParser = null;
        this.currentMarkdownExists = false;
        this.isMarkdownEditing = false;
        this.hasUnsavedMarkdownChanges = false;
        this.saveMdEndpoint = '/save-md';
        this.blankDragImage = null;
        this.keywordTooltipEl = null;
        this.selectedItem = null; // { type: 'row' | 'section', path: string[], key: string }
        this.isMiddleActive = false; // 鼠标是否在中间栏，用于键盘上下移动的激活判定
        this.fileFilter = '';
        this.fileFilterVisible = false;
        this.debugEnabled = this.loadDebugEnabled();
        try {
            this.currentView = localStorage.getItem('lastViewMode') || 'structured';
        } catch (_e) {
            this.currentView = 'structured';
        }
        this.qaTitleMap = {}; // { filename: {index: title} }
        this.pendingQaTitle = null; // { file, title }
        this.lastMarkdownPasteBackup = null;
        this.qaCollapsedStateByProject = this.loadQaCollapsedState();
        this.lastLeftWidth = 0;
        this.lastRightWidth = 0;
        this.dragPlaceholder = null;
        this.placeholderState = { scope: null, target: null, after: false };
        this.gotoEditResolver = null;
        this.promptPanelVisible = false;
        this.promptDataLoaded = false;
        this.promptGroups = {};
        this.promptPanelPos = this.loadPromptPanelPos();
        this.promptSelectedByGroup = this.loadPromptSelectedByGroup();
        this.isEditLocked = this.loadEditLockState();
        this.citationCache = {}; // 缓存 cite/citep 渲染结果 {text, fallback}
        this.citationMetaCache = {}; // 缓存 DOI -> CSL
        this.citationMetaStoreKey = 'paperReviewerCitationMeta';
        this.projectInfoVisible = false;
        this.projectInfoLoaded = false;
        this.shortcutsVisible = false;
        this.shortcutsLoaded = false;
        this.jsonMenuVisible = false;
        this.mdMenuVisible = false;
        this.rawJsonParseOk = true;
        this.rawJsonParseError = '';
        this.rawJsonParseTimer = null;
        this.currentLoadToken = 0;
        this.sectionExpandedStateByProject = this.loadSectionExpandedState();
        this.lastSelectedFileByProject = this.loadLastSelectedFileByProject();

        // 项目管理
        this.currentProject = null; // { name, path }
        this.recentProjects = [];
        this.fileOrders = {}; // { projectPath: [filename1, filename2, ...] }
        this.fileGroups = {}; // { projectPath: { groups: [{id, name, files: []}] } }
        this.currentFileList = [];
        this.draggingFile = null; // { filename, fromGroupId }
        this.currentFileDragState = null; // { targetFilename, targetGroupId, placeAfter }
        this.dragPreviewEl = null;
        this.selectedFiles = new Set();
        this.lastFileSelectionAnchor = null;
        this.visibleFileOrder = [];
        this.groupMenuState = null; // { menuEl, groups, index }
        this.currentPdfLoadToken = 0;
        this.lastPdfLoadedUrl = '';
        this.pendingPdfUrl = null;
        this.pdfPlaceholderEl = null;
        this.settingsMenuVisible = false;
        this.autoLoadPdf = false;
        this.metaDefaultsPatched = false;
        this.addSectionShowTimer = null;
        this.addSectionHoverCleanup = null;
        this.theme = this.loadTheme();

        this.init();
    }

    loadDebugEnabled() {
        try {
            const qs = new URLSearchParams(window.location.search || '');
            if (qs.get('debug') === '1') return true;
            return localStorage.getItem('paperReviewerDebug') === '1';
        } catch (_e) {
            return false;
        }
    }

    debugLog(...args) {
        if (!this.debugEnabled) return;
        console.log(...args);
    }

    loadTheme() {
        try {
            const saved = localStorage.getItem('reviewerTheme');
            if (saved === 'dark' || saved === 'light') return saved;
        } catch (_e) {
            // ignore
        }
        return 'light';
    }

    persistTheme() {
        try {
            localStorage.setItem('reviewerTheme', this.theme);
        } catch (_e) {
            // ignore
        }
    }

    applyTheme() {
        const isDark = this.theme === 'dark';
        document.body.classList.toggle('theme-dark', isDark);
        document.body.classList.toggle('theme-vscode', isDark);
        this.updateThemeToggleButton(isDark);
    }

    toggleTheme() {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        this.applyTheme();
        this.persistTheme();
        // 同步到项目配置，方便重载后保持一致
        try {
            this.saveProjectConfig();
        } catch (_e) {
            // ignore
        }
        // 重新加载已打开的 PDF，使其采用对应主题
        if (this.currentPdfUrl) {
            this.lastPdfLoadedUrl = '';
            this.loadPDF(this.currentPdfUrl);
        }
    }

    updateThemeToggleButton(isDark) {
        const btn = document.getElementById('themeToggleBtn');
        if (!btn) return;
        const icon = btn.querySelector('i');
        btn.title = isDark ? '切换到日间模式' : '切换到夜间模式';
        if (icon) icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    }

    loadPromptSelectedByGroup() {
        try {
            const raw = localStorage.getItem('promptSelectedByGroup');
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (_e) {
            return {};
        }
    }

    loadPromptPanelPos() {
        try {
            const raw = localStorage.getItem('promptQuickPanelPos');
            if (!raw) return null;
            const pos = JSON.parse(raw);
            if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') {
                return pos;
            }
        } catch (_e) {
            return null;
        }
        return null;
    }

    loadEditLockState() {
        try {
            return localStorage.getItem('reviewerEditLocked') === '1';
        } catch (_e) {
            return false;
        }
    }

    persistEditLockState() {
        try {
            localStorage.setItem('reviewerEditLocked', this.isEditLocked ? '1' : '0');
        } catch (_e) {
            // ignore
        }
    }

    savePromptPanelPos(pos) {
        if (!pos || typeof pos.left !== 'number' || typeof pos.top !== 'number') return;
        try {
            localStorage.setItem('promptQuickPanelPos', JSON.stringify(pos));
        } catch (_e) {
            // ignore
        }
    }

    persistPromptSelectedByGroup() {
        try {
            localStorage.setItem('promptSelectedByGroup', JSON.stringify(this.promptSelectedByGroup || {}));
        } catch (_e) {
            // ignore
        }
    }

    setPromptActive(groupKey, file) {
        if (!groupKey) return;
        const normalized = (file || '').trim();
        if (!normalized) return;
        this.promptSelectedByGroup[groupKey] = normalized;
        this.persistPromptSelectedByGroup();

        const esc = (window.CSS && typeof window.CSS.escape === 'function')
            ? window.CSS.escape(groupKey)
            : String(groupKey).replace(/"/g, '\\"');
        const row = document.querySelector(`.prompt-button-row[data-group-key="${esc}"]`);
        if (!row) return;
        row.querySelectorAll('.prompt-chip').forEach(btn => {
            const isActive = (btn.dataset.file || '') === normalized;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', String(isActive));
        });
    }

    loadQaCollapsedState() {
        try {
            const raw = localStorage.getItem('qaCollapsedStateByProject');
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (_e) {
            return {};
        }
    }

    persistQaCollapsedState() {
        try {
            localStorage.setItem('qaCollapsedStateByProject', JSON.stringify(this.qaCollapsedStateByProject || {}));
        } catch (_e) {
            // ignore
        }
    }

    getQaCollapsedStateMap() {
        const key = this.getProjectKey();
        if (!this.qaCollapsedStateByProject[key]) this.qaCollapsedStateByProject[key] = {};
        return this.qaCollapsedStateByProject[key];
    }

    normalizeQaTitleKey(title) {
        return (title || '').trim();
    }

    getQaTitleFromBlock(block) {
        if (!block) return '';
        const titleEl = block.querySelector('.qa-title');
        // 以渲染后的 textContent 为准（bindQaTitles / setQaTitleForIndex 会更新它）
        const title = titleEl?.textContent || titleEl?.dataset?.qaTitle || '';
        return (title || '').trim();
    }

    getQaCollapsedForTitle(title) {
        const t = this.normalizeQaTitleKey(title);
        if (!t) return null;
        const map = this.getQaCollapsedStateMap();
        if (map && Object.prototype.hasOwnProperty.call(map, t)) return !!map[t];
        return null;
    }

    setQaCollapsedForTitle(title, collapsed) {
        const t = this.normalizeQaTitleKey(title);
        if (!t) return;
        const map = this.getQaCollapsedStateMap();
        map[t] = !!collapsed;
        this.persistQaCollapsedState();
    }

    loadSectionExpandedState() {
        try {
            const raw = localStorage.getItem('sectionExpandedStateByProject');
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (_e) {
            return {};
        }
    }

    loadLastSelectedFileByProject() {
        try {
            const raw = localStorage.getItem('lastSelectedFileByProject');
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (_e) {
            return {};
        }
    }

    persistLastSelectedFileByProject() {
        try {
            localStorage.setItem('lastSelectedFileByProject', JSON.stringify(this.lastSelectedFileByProject || {}));
        } catch (_e) {
            // ignore
        }
    }

    getLastSelectedFile() {
        try {
            const key = this.getProjectKey();
            const map = this.lastSelectedFileByProject || {};
            return map && Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null;
        } catch (_e) {
            return null;
        }
    }

    setLastSelectedFile(filename) {
        if (!filename) return;
        const key = this.getProjectKey();
        if (!this.lastSelectedFileByProject) this.lastSelectedFileByProject = {};
        this.lastSelectedFileByProject[key] = filename;
        this.persistLastSelectedFileByProject();
    }

    persistSectionExpandedState() {
        try {
            localStorage.setItem('sectionExpandedStateByProject', JSON.stringify(this.sectionExpandedStateByProject || {}));
        } catch (_e) {
            // ignore
        }
    }

    getProjectKey() {
        return this.currentProject ? this.normalizeProjectPathString(this.currentProject.path) : 'user';
    }

    normalizeFileGroups(raw) {
        if (!raw) return [];
        if (Array.isArray(raw)) {
            return raw.map((g, idx) => ({
                id: g?.id ? String(g.id) : `group-${idx + 1}`,
                name: g?.name ? String(g.name) : (g?.id ? String(g.id) : `分组 ${idx + 1}`),
                files: Array.isArray(g?.files) ? g.files.map(String) : [],
                collapsed: !!g?.collapsed
            }));
        }
        if (typeof raw === 'object') {
            return Object.entries(raw).map(([key, value]) => ({
                id: key,
                name: key,
                files: Array.isArray(value) ? value.map(String) : [],
                collapsed: !!value?.collapsed
            }));
        }
        return [];
    }

    ensureDefaultGroup(groups = []) {
        const list = Array.isArray(groups) ? [...groups] : [];
        if (!list.length) {
            list.push({ id: 'group-default', name: '未分组', files: [], collapsed: false });
            return list;
        }
        if (!list[0].id) list[0].id = 'group-default';
        if (!list[0].name) list[0].name = '未分组';
        if (!Array.isArray(list[0].files)) list[0].files = [];
        if (typeof list[0].collapsed !== 'boolean') list[0].collapsed = false;
        return list;
    }

    setAutoLoadPdf(enabled) {
        this.autoLoadPdf = !!enabled;
        this.saveProjectConfig();
        this.updateAutoLoadMenuState();
        if (this.autoLoadPdf && this.pendingPdfUrl) {
            this.ensurePdfLoaded();
        }
    }

    cloneFileGroups(groups = []) {
        return groups.map(g => ({
            id: g.id,
            name: g.name,
            files: Array.isArray(g.files) ? [...g.files] : [],
            collapsed: !!g.collapsed
        }));
    }

    flattenGroupFiles(groups = []) {
        return groups.reduce((acc, g) => {
            if (Array.isArray(g.files)) acc.push(...g.files);
            return acc;
        }, []);
    }

    dedupeFiles(files = []) {
        const seen = new Set();
        return (files || []).filter(f => {
            if (!f || seen.has(f)) return false;
            seen.add(f);
            return true;
        });
    }

    getSelectedFilesArray() {
        return Array.from(this.selectedFiles || []);
    }

    findNextFileAfterSelection(selected = []) {
        if (!selected || !selected.length) return null;
        const groups = this.getCurrentGroups();
        const moved = new Set(selected);
        let source = null;
        groups.forEach(g => {
            if (source) return;
            if ((g.files || []).some(f => moved.has(f))) source = g;
        });
        if (!source) return null;
        const indices = [];
        let minIdx = Number.POSITIVE_INFINITY;
        (source.files || []).forEach((f, idx) => {
            if (moved.has(f)) {
                indices.push(idx);
                if (idx < minIdx) minIdx = idx;
            }
        });
        if (!indices.length) return null;
        const maxIdx = Math.max(...indices);
        for (let i = maxIdx + 1; i < (source.files || []).length; i++) {
            const f = source.files[i];
            if (!moved.has(f)) return f;
        }
        for (let i = 0; i < minIdx; i++) {
            const f = source.files[i];
            if (!moved.has(f)) return f;
        }
        return null;
    }

    setSelectedFiles(files = [], anchor = null) {
        const list = Array.isArray(files) ? files : Array.from(files || []);
        this.selectedFiles = new Set(list);
        const anchorValue = anchor || (list.length ? list[list.length - 1] : null);
        this.lastFileSelectionAnchor = anchorValue;
        this.updateFileSelectionDom();
    }

    updateFileSelectionDom() {
        const selected = this.selectedFiles || new Set();
        document.querySelectorAll('.file-item').forEach(el => {
            const fname = el.dataset.filename;
            el.classList.toggle('active', selected.has(fname));
        });
    }

    toggleGroupCollapse(groupId) {
        const groups = this.getCurrentGroups();
        const target = groups.find(g => g.id === groupId);
        if (!target) return;
        target.collapsed = !target.collapsed;
        this.persistGroupsAndRender(groups, this.currentFile);
    }

    deleteGroup(groupId) {
        const groups = this.getCurrentGroups();
        if (!groups.length) return;
        if (groups.length <= 1) {
            this.showNotification('至少保留一个分组，无法删除。', 'warning');
            return;
        }
        const target = groups.find(g => g.id === groupId);
        if (!target) return;
        const defaultGroup = groups[0];
        if (target.id === defaultGroup.id) {
            this.showNotification('默认分组不可删除。', 'warning');
            return;
        }
        const filesToMove = Array.isArray(target.files) ? [...target.files] : [];
        if (filesToMove.length) {
            const ok = window.confirm(`该分组包含 ${filesToMove.length} 个文件，删除后将移动到默认分组「${defaultGroup.name}」。确定删除吗？`);
            if (!ok) return;
            filesToMove.forEach(f => {
                if (!defaultGroup.files.includes(f)) defaultGroup.files.push(f);
            });
        }
        const filtered = groups.filter(g => g.id !== target.id);
        this.persistGroupsAndRender(filtered, this.currentFile);
        this.saveProjectConfig();
        this.showNotification('分组已删除', 'info');
    }

    updateFilenameInGroups(oldName, newName) {
        if (!oldName || !newName) return;
        const groups = this.getCurrentGroups();
        let touched = false;
        groups.forEach(g => {
            const idx = g.files.indexOf(oldName);
            if (idx >= 0) {
                g.files[idx] = newName;
                touched = true;
            }
        });
        if (!touched) return;
        const order = (this.currentFileList || []).map(f => (f === oldName ? newName : f));
        this.fileGroups[this.getProjectKey()] = { groups };
        this.currentFileList = order;
        this.fileOrders[this.getProjectKey()] = [...order];
        this.saveFileOrderForProject(order, groups);
        if (this.selectedFiles.has(oldName)) {
            this.selectedFiles.delete(oldName);
            this.selectedFiles.add(newName);
            this.updateFileSelectionDom();
        }
        if (this.lastFileSelectionAnchor === oldName) {
            this.lastFileSelectionAnchor = newName;
        }
    }

    removeFilenameFromGroups(filename) {
        if (!filename) return;
        const groups = this.getCurrentGroups();
        let touched = false;
        groups.forEach(g => {
            const before = g.files.length;
            g.files = g.files.filter(f => f !== filename);
            if (g.files.length !== before) touched = true;
        });
        if (!touched) return;
        const order = (this.currentFileList || []).filter(f => f !== filename);
        this.fileGroups[this.getProjectKey()] = { groups };
        this.currentFileList = order;
        this.fileOrders[this.getProjectKey()] = [...order];
        this.saveFileOrderForProject(order, groups);
        if (this.selectedFiles.has(filename)) {
            this.selectedFiles.delete(filename);
            this.updateFileSelectionDom();
        }
        if (this.lastFileSelectionAnchor === filename) {
            this.lastFileSelectionAnchor = null;
        }
    }

    getCurrentGroups() {
        const key = this.getProjectKey();
        const stored = this.fileGroups[key]?.groups || [];
        return this.ensureDefaultGroup(this.cloneFileGroups(this.normalizeFileGroups(stored)));
    }

    syncGroupsWithFiles(files = [], baseGroups = null) {
        const key = this.getProjectKey();
        const sourceGroups = baseGroups
            ? this.ensureDefaultGroup(this.cloneFileGroups(baseGroups))
            : this.getCurrentGroups();
        const fileSet = new Set(files);
        const used = new Set();
        const cleaned = sourceGroups.map((g, idx) => {
            const id = g.id || `group-${idx + 1}`;
            const name = g.name || id || `分组 ${idx + 1}`;
            const collapsed = !!g.collapsed;
            const uniqueFiles = [];
            (g.files || []).forEach(f => {
                if (fileSet.has(f) && !used.has(f)) {
                    uniqueFiles.push(f);
                    used.add(f);
                }
            });
            return { id, name, files: uniqueFiles, collapsed };
        });
        if (!cleaned.length) cleaned.push({ id: 'group-default', name: '未分组', files: [], collapsed: false });
        const defaultGroup = cleaned[0];
        files.forEach(f => {
            if (!used.has(f)) {
                defaultGroup.files.push(f);
                used.add(f);
            }
        });
        defaultGroup.files = this.dedupeFiles(defaultGroup.files);
        this.fileGroups[key] = { groups: cleaned };
        this.currentFileList = this.flattenGroupFiles(cleaned);
        this.fileOrders[key] = [...this.currentFileList];
        return cleaned;
    }

    persistGroupsAndRender(groups = [], keepSelected = null) {
        const cleaned = this.ensureDefaultGroup(this.cloneFileGroups(groups));
        this.fileGroups[this.getProjectKey()] = { groups: cleaned };
        const flat = this.flattenGroupFiles(cleaned);
        this.currentFileList = flat;
        this.saveFileOrderForProject(flat, cleaned);
        this.renderFileList(flat, keepSelected || this.currentFile, true, cleaned);
    }

    getSectionExpandedStateMap() {
        const key = this.getProjectKey();
        if (!this.sectionExpandedStateByProject[key]) this.sectionExpandedStateByProject[key] = {};
        return this.sectionExpandedStateByProject[key];
    }

    getSectionExpanded(sectionKey) {
        const map = this.getSectionExpandedStateMap();
        if (map && Object.prototype.hasOwnProperty.call(map, sectionKey)) {
            return !!map[sectionKey];
        }
        return !this.isCollapseAll;
    }

    setSectionExpanded(sectionKey, expanded) {
        const map = this.getSectionExpandedStateMap();
        map[sectionKey] = !!expanded;
        this.persistSectionExpandedState();
    }

    getDragPlaceholder() {
        if (!this.dragPlaceholder) {
            const ph = document.createElement('div');
            ph.className = 'drag-placeholder';
            this.dragPlaceholder = ph;
        }
        return this.dragPlaceholder;
    }

    clearDragPlaceholder() {
        if (this.dragPlaceholder && this.dragPlaceholder.parentElement) {
            this.dragPlaceholder.parentElement.removeChild(this.dragPlaceholder);
        }
        this.placeholderState = { scope: null, target: null, after: false };
    }

    insertSectionPlaceholder(targetWrapper, placeAfter = false) {
        const ph = this.getDragPlaceholder();
        const parent = targetWrapper?.parentElement;
        if (!parent) return;
        const targetKey = targetWrapper.dataset.sectionKey;
        const { scope, target, after } = this.placeholderState;
        if (scope === 'section' && target === targetKey && after === placeAfter && ph.parentElement === parent) return;
        if (ph.parentElement !== parent) this.clearDragPlaceholder();
        parent.insertBefore(ph, placeAfter ? targetWrapper.nextElementSibling : targetWrapper);
        this.placeholderState = { scope: 'section', target: targetKey, after: placeAfter };
    }

    insertRowPlaceholder(row, placeAfter = false) {
        const ph = this.getDragPlaceholder();
        const parent = row?.parentElement;
        if (!parent) return;
        const targetKey = row.dataset.key;
        const { scope, target, after } = this.placeholderState;
        if (scope === 'row' && target === targetKey && after === placeAfter && ph.parentElement === parent) return;
        if (ph.parentElement !== parent) this.clearDragPlaceholder();
        parent.insertBefore(ph, placeAfter ? row.nextElementSibling : row);
        this.placeholderState = { scope: 'row', target: targetKey, after: placeAfter };
    }

    getBlankDragImage() {
        if (this.blankDragImage) return this.blankDragImage;
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        this.blankDragImage = canvas;
        return canvas;
    }

    createDragPreview(label) {
        if (!label) return null;
        this.removeDragPreview();
        const el = document.createElement('div');
        el.className = 'file-drag-preview';
        el.textContent = label;
        document.body.appendChild(el);
        // 放到视图外，避免闪烁
        el.style.position = 'absolute';
        el.style.left = '-9999px';
        el.style.top = '-9999px';
        this.dragPreviewEl = el;
        return el;
    }

    removeDragPreview() {
        if (this.dragPreviewEl && this.dragPreviewEl.parentElement) {
            this.dragPreviewEl.parentElement.removeChild(this.dragPreviewEl);
        }
        this.dragPreviewEl = null;
    }

    applyRawJsonChanges() {
        const textarea = document.getElementById('jsonEditorTextarea');
        if (!textarea) return;
        const text = textarea.value;
        try {
            const parsed = JSON.parse(text);
            this.currentData = parsed;
            this.hasUnsavedChanges = true;
            this.tempDataCache[this.currentFile] = this.currentData;
            this.ensureSchemaVersion();
            this.ensureLastUpdate();
            this.renderStructuredView();
            this.renderMath();
            this.updateSaveButtonState();
            this.updateUndoButtonState();
            this.showNotification('JSON 已应用到内存，记得保存到文件', 'success');
        } catch (err) {
            this.showNotification(`JSON 解析失败: ${err.message}`, 'error');
        }
    }

    formatRawJson() {
        const textarea = document.getElementById('jsonEditorTextarea');
        if (!textarea) return;
        try {
            const parsed = JSON.parse(textarea.value);
            textarea.value = JSON.stringify(parsed, null, 2);
            this.showNotification('JSON 已格式化', 'success');
        } catch (err) {
            this.showNotification(`JSON 格式化失败: ${err.message}`, 'error');
        }
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
        this.updateJsonMenuState();
        this.updateAutoLoadMenuState();
        this.updateMarkdownToolbar();
        this.updateMarkdownMenuState();
        this.applyEditLockState();
        this.applyTheme();
        this.setupResizers();
        this.setupDraggableModal();
        this.loadPromptShortcuts();
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
                this.fileOrders = data.fileOrders || {};
                this.fileGroups = data.fileGroups || {};
                if (data.theme) this.theme = data.theme;
                if (typeof data.autoLoadPdf === 'boolean') this.autoLoadPdf = data.autoLoadPdf;
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
                recentProjects: this.recentProjects,
                fileOrders: this.fileOrders,
                fileGroups: this.fileGroups,
                theme: this.theme,
                autoLoadPdf: this.autoLoadPdf
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
        // 快捷键：Cmd/Ctrl + E 切换表格/Markdown
        document.addEventListener('keydown', (e) => {
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const mod = isMac ? e.metaKey : e.ctrlKey;
            if (mod && e.key.toLowerCase() === 'e') {
                e.preventDefault();
                this.toggleTableMarkdownView();
                return;
            }
            if (mod && e.key === '/') {
                e.preventDefault();
                if (this.currentView !== 'markdown') {
                    this.switchToView('markdown');
                }
                if (!this.currentMarkdownExists) {
                    this.showNotification('No markdown file. Create it first.', 'info');
                    return;
                }
                const newState = !this.isMarkdownEditing;
                this.toggleMarkdownEdit(newState);
                if (newState) {
                    document.getElementById('markdownTextarea')?.focus();
                }
            }
        });
        // JSON 菜单：表格视图 / JSON 代码 / JSON 保存
        const jsonMenuToggleBtn = document.getElementById('jsonMenuToggleBtn');
        const jsonMenu = document.getElementById('jsonMenu');
        const jsonViewStructuredItem = document.getElementById('jsonViewStructuredItem');
        const jsonViewFlatItem = document.getElementById('jsonViewFlatItem');
        const jsonFormatItem = document.getElementById('jsonFormatItem');
        const jsonSaveItem = document.getElementById('jsonSaveItem');
        const jsonMenuDropdown = document.getElementById('jsonMenuDropdown');
        if (jsonMenuToggleBtn && jsonMenu) {
            jsonMenuToggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleJsonMenu();
            });
            jsonMenu.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            document.addEventListener('click', (e) => {
                if (!this.jsonMenuVisible) return;
                if (jsonMenuDropdown && jsonMenuDropdown.contains(e.target)) return;
                this.toggleJsonMenu(false);
            });
        }
        if (jsonViewStructuredItem) {
            jsonViewStructuredItem.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.switchToView('structured');
                this.toggleJsonMenu(false);
            });
        }
        if (jsonViewFlatItem) {
            jsonViewFlatItem.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.goToJsonSource();
                this.toggleJsonMenu(false);
            });
        }
        if (jsonFormatItem) {
            jsonFormatItem.addEventListener('click', (e) => {
                e.preventDefault();
                // 仅在 JSON 代码视图可用；在其它视图下不做任何事
                if ((this.currentView || 'structured') !== 'flat') return;
                this.formatRawJson();
                // 格式化后同步解析状态与保存状态
                this.applyRawJsonFromTextarea({ notifyOnError: false, updateStatus: true });
                this.toggleJsonMenu(false);
            });
        }
        if (jsonSaveItem) {
            jsonSaveItem.addEventListener('click', async (e) => {
                e.preventDefault();
                // 在 JSON 代码视图内：先尝试解析并应用 textarea 内容，再保存
                if ((this.currentView || 'structured') === 'flat') {
                    const ok = this.applyRawJsonFromTextarea({ notifyOnError: true, updateStatus: true });
                    if (!ok) return;
                }
                if (!this.hasUnsavedChanges) return;
                await this.saveToFile();
                this.toggleJsonMenu(false);
            });
        }

        // Markdown 菜单：MD 渲染 / MD 源码 / MD 保存
        const mdMenuToggleBtn = document.getElementById('mdMenuToggleBtn');
        const mdMenu = document.getElementById('mdMenu');
        const mdRenderItem = document.getElementById('mdRenderItem');
        const mdSourceItem = document.getElementById('mdSourceItem');
        const mdSaveItem = document.getElementById('mdSaveItem');
        const mdCiteRenderItem = document.getElementById('mdCiteRenderItem');
        const mdClearCiteCacheCurrentItem = document.getElementById('mdClearCiteCacheCurrentItem');
        const mdClearCiteCacheItem = document.getElementById('mdClearCiteCacheItem');
        const mdMenuDropdown = document.getElementById('mdMenuDropdown');
        if (mdMenuToggleBtn && mdMenu) {
            mdMenuToggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleMdMenu();
            });
            mdMenu.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            document.addEventListener('click', (e) => {
                if (!this.mdMenuVisible) return;
                if (mdMenuDropdown && mdMenuDropdown.contains(e.target)) return;
                this.toggleMdMenu(false);
            });
        }
        if (mdRenderItem) {
            mdRenderItem.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.switchToView('markdown');
                if (this.isMarkdownEditing) this.toggleMarkdownEdit(false, { skipConfirm: true });
                // 确保渲染刷新
                this.renderMarkdownView(this.currentMarkdownText || '');
                this.toggleMdMenu(false);
            });
        }
        if (mdSourceItem) {
            mdSourceItem.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.goToMarkdownSource();
                this.toggleMdMenu(false);
            });
        }
        if (mdCiteRenderItem) {
            mdCiteRenderItem.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.generateReferencesFromMarkdown();
                this.toggleMdMenu(false);
            });
        }
        if (mdClearCiteCacheItem) {
            mdClearCiteCacheItem.addEventListener('click', (e) => {
                e.preventDefault();
                this.clearCitationCache();
                this.toggleMdMenu(false);
            });
        }
        if (mdClearCiteCacheCurrentItem) {
            mdClearCiteCacheCurrentItem.addEventListener('click', (e) => {
                e.preventDefault();
                this.clearCurrentMarkdownCitationCache();
                this.toggleMdMenu(false);
            });
        }
        if (mdSaveItem) {
            mdSaveItem.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.saveMarkdownFromEditor();
                this.toggleMdMenu(false);
            });
        }
        const mdTextarea = document.getElementById('markdownTextarea');
        if (mdTextarea) {
            mdTextarea.addEventListener('input', () => this.onMarkdownEditorInput());
        }
        const editLockToggleBtn = document.getElementById('editLockToggleBtn');
        if (editLockToggleBtn) {
            editLockToggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleEditLock();
            });
        }
        const gotoCancelBtn = document.getElementById('gotoEditCancel');
        const gotoSaveBtn = document.getElementById('gotoEditSave');
        const gotoModal = document.getElementById('gotoEditModal');
        if (gotoCancelBtn) gotoCancelBtn.addEventListener('click', () => this.closeGotoEditModal(false));
        if (gotoSaveBtn) gotoSaveBtn.addEventListener('click', () => this.closeGotoEditModal(true));
        if (gotoModal) {
            gotoModal.addEventListener('click', (e) => {
                if (e.target === gotoModal) this.closeGotoEditModal(false);
            });
        }

        // 中间栏激活检测（鼠标进入/离开）
        const middlePanel = document.querySelector('.middle-panel');
        if (middlePanel) {
            middlePanel.addEventListener('mouseenter', () => { this.isMiddleActive = true; });
            middlePanel.addEventListener('mouseleave', () => { this.isMiddleActive = false; });
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
            const mod = e.metaKey || e.ctrlKey;
            const key = (e.key || '').toLowerCase();
            if (mod && !e.shiftKey && key === 's') {
                e.preventDefault();
                this.handleSaveShortcut();
                return;
            }
            if (mod && e.shiftKey && key === 'e') {
                e.preventDefault();
                this.toggleJsonMdSource();
                return;
            }
            // 锁定时，仅当鼠标在中间栏时才拦截结构区的排序/移动
            const middleActive = !!this.isMiddleActive;
            if (this.isEditLocked && middleActive && (key === 'k' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                // 锁定时禁止排序模式切换和上下移动
                if (mod && !e.shiftKey && key === 'k') {
                    e.preventDefault();
                    this.showLockedNotification('调整顺序');
                } else if (this.isReorderMode || this.selectedItem) {
                    e.preventDefault();
                    this.showLockedNotification('调整顺序');
                }
                return;
            }
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'g') {
                e.preventDefault();
                this.togglePromptPanel();
                return;
            }
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
                e.preventDefault();
                this.toggleRightPanelVisibility();
                return;
            }
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 's') {
                e.preventDefault();
                this.toggleLeftPanelVisibility();
                return;
            }
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                if ((this.currentView || 'structured') !== 'structured') return;
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
            if (this.isReorderMode && this.reorderSelected && middleActive && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                // 调整顺序需按下 Cmd/Ctrl + 上/下，且鼠标需在中间栏
                if (!mod) return;
                e.preventDefault();
                const offset = e.key === 'ArrowUp' ? -1 : 1;
                this.moveKey(this.reorderSelected.path, this.reorderSelected.key, offset);
            } else if (!this.isReorderMode && this.selectedItem && middleActive && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                // 调整选中项顺序需 Cmd/Ctrl + 上/下，且鼠标需在中间栏
                if (!mod) return;
                if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) return;
                if (!this.isMiddleActive) return; // 仅当鼠标在中间栏时允许键盘上下移动
                e.preventDefault();
                const offset = e.key === 'ArrowUp' ? -1 : 1;
                this.moveSelectedItem(offset);
            } else if (!middleActive && !mod && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                // 全局上下键控制左侧文件列表（无需鼠标悬停）
                if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) return;
                if (this.groupMenuState) return;
                const order = this.visibleFileOrder || [];
                if (!order.length) return;
                const selected = this.getSelectedFilesArray();
                const anchor = selected.length ? selected[selected.length - 1] : (this.currentFile || order[0]);
                let idx = order.indexOf(anchor);
                if (idx < 0) idx = 0;
                e.preventDefault();
                idx += e.key === 'ArrowDown' ? 1 : -1;
                if (idx < 0) idx = 0;
                if (idx >= order.length) idx = order.length - 1;
                const fname = order[idx];
                const listEl = document.getElementById('fileList');
                const target = fname && listEl ? listEl.querySelector(`.file-item[data-filename="${fname}"]`) : null;
                if (fname && target) {
                    this.setSelectedFiles([fname], fname);
                    target.scrollIntoView({ block: 'nearest' });
                    this.loadFile(fname, target);
                }
            }
            if (e.key === 'Escape') {
                this.closeEditModal();
                this.closeGotoEditModal(false);
                this.closeProjectSelector();
                this.clearPdfHighlights();
                this.togglePromptPanel(false);
                this.toggleProjectInfoPanel(false, { skipClose: true });
                this.toggleShortcutsPanel(false, { skipClose: true });
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

        // 工具面板按钮（打开 Cmd+Shift+G 面板）
        const aideCopyToggleBtn = document.getElementById('aideCopyToggleBtn');
        if (aideCopyToggleBtn) {
            aideCopyToggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.togglePromptPanel();
            });
        }
        const projectInfoBtn = document.getElementById('projectInfoBtn');
        if (projectInfoBtn) {
            projectInfoBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleProjectInfoPanel();
            });
        }
        const shortcutsInfoBtn = document.getElementById('shortcutsInfoBtn');
        if (shortcutsInfoBtn) {
            shortcutsInfoBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleShortcutsPanel();
            });
        }
        const importJsonBtn = document.getElementById('importJsonBtn');
        const importJsonFolderInput = document.getElementById('importJsonFolderInput');
        if (importJsonBtn && importJsonFolderInput) {
            importJsonBtn.addEventListener('click', (e) => {
                e.preventDefault();
                importJsonFolderInput.value = '';
                importJsonFolderInput.click();
            });
            importJsonFolderInput.addEventListener('change', (e) => this.handleJsonFolderImport(e));
        }
        const syncPdfBtn = document.getElementById('syncPdfBtn');
        if (syncPdfBtn) {
            syncPdfBtn.addEventListener('click', () => this.createEmptyFilesFromPdfs());
        }
        const promptCloseBtn = document.getElementById('promptPanelClose');
        if (promptCloseBtn) {
            promptCloseBtn.addEventListener('click', () => this.togglePromptPanel(false));
        }
        this.bindPromptPanelDrag();

        // 左侧文件列表：鼠标激活后可用上下键快速切换
        const fileListEl = document.getElementById('fileList');
        if (fileListEl) {
            fileListEl.tabIndex = 0;
            fileListEl.addEventListener('mouseenter', () => {
                fileListEl.focus({ preventScroll: true });
            });
            fileListEl.addEventListener('keydown', (e) => {
                if (this.groupMenuState) return;
                if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
                if ((e.metaKey || e.ctrlKey) && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                    e.preventDefault();
                    this.openGroupMoveMenu();
                    return;
                }
                const order = this.visibleFileOrder || [];
                if (!order.length) return;
                const selected = this.getSelectedFilesArray();
                const anchor = selected.length ? selected[selected.length - 1] : (this.currentFile || order[0]);
                let idx = order.indexOf(anchor);
                if (idx < 0) idx = 0;

                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    idx += e.key === 'ArrowDown' ? 1 : -1;
                    if (idx < 0) idx = 0;
                    if (idx >= order.length) idx = order.length - 1;
                    const fname = order[idx];
                    const target = fname ? fileListEl.querySelector(`.file-item[data-filename="${fname}"]`) : null;
                    if (fname && target) {
                        this.setSelectedFiles([fname], fname);
                        target.scrollIntoView({ block: 'nearest' });
                        this.loadFile(fname, target);
                    }
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    e.preventDefault();
                    const filename = anchor;
                    if (!filename) return;
                    const offset = e.key === 'ArrowLeft' ? -1 : 1;
                    this.reorderFileItem(filename, offset);
                }
            });
        }

        // 文件过滤
        const fileFilterInput = document.getElementById('fileFilterInput');
        if (fileFilterInput) {
            fileFilterInput.value = this.fileFilter;
            fileFilterInput.addEventListener('input', (e) => {
                this.fileFilter = (e.target.value || '').trim();
                this.renderFileList(this.currentFileList || [], this.currentFile, true);
            });
        }
        const fileFilterToggleBtn = document.getElementById('fileFilterToggleBtn');
        if (fileFilterToggleBtn) {
            fileFilterToggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleFileFilter();
            });
        }
        const addGroupBtn = document.getElementById('addGroupBtn');
        if (addGroupBtn) {
            addGroupBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.createGroup();
            });
        }
        const themeToggleBtn = document.getElementById('themeToggleBtn');
        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', () => this.toggleTheme());
            this.updateThemeToggleButton(this.theme === 'dark');
        }
        const settingsToggleBtn = document.getElementById('settingsToggleBtn');
        const settingsMenu = document.getElementById('settingsMenu');
        const settingsDropdown = document.getElementById('settingsDropdown');
        const autoLoadOnItem = document.getElementById('autoLoadOnItem');
        const autoLoadOffItem = document.getElementById('autoLoadOffItem');
        if (settingsToggleBtn && settingsMenu) {
            settingsToggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleSettingsMenu();
            });
            settingsMenu.addEventListener('click', (e) => e.stopPropagation());
            document.addEventListener('click', (e) => {
                if (!this.settingsMenuVisible) return;
                if (settingsDropdown && settingsDropdown.contains(e.target)) return;
                this.toggleSettingsMenu(false);
            });
        }
        if (autoLoadOnItem) {
            autoLoadOnItem.addEventListener('click', () => {
                this.setAutoLoadPdf(true);
                this.toggleSettingsMenu(false);
            });
        }
        if (autoLoadOffItem) {
            autoLoadOffItem.addEventListener('click', () => {
                this.setAutoLoadPdf(false);
                this.toggleSettingsMenu(false);
            });
        }

        // 粘贴事件监听
        document.addEventListener('paste', (e) => this.handlePaste(e));

        // PDF.js 内置全屏模式快捷入口
        const pdfFullscreenBtn = document.getElementById('btnPdfJsFullscreen');
        if (pdfFullscreenBtn) {
            pdfFullscreenBtn.addEventListener('click', async () => {
                await this.ensurePdfLoaded();
                this.enterPdfJsFullscreen();
            });
        }

        // PDF.js 内置下载快捷入口
        const pdfDownloadBtn = document.getElementById('btnPdfJsDownload');
        if (pdfDownloadBtn) {
            pdfDownloadBtn.addEventListener('click', async () => {
                await this.ensurePdfLoaded();
                this.downloadCurrentPdf();
            });
        }

        const rightPanel = document.querySelector('.right-panel');
        if (rightPanel) {
            rightPanel.addEventListener('mousedown', () => this.ensurePdfLoaded());
        }

        this.pdfPlaceholderEl = document.getElementById('pdfPlaceholder');
        if (this.pdfPlaceholderEl) {
            const btn = this.pdfPlaceholderEl.querySelector('.pdf-placeholder-btn');
            if (btn) {
                btn.addEventListener('click', async () => {
                    await this.ensurePdfLoaded();
                });
            }
            this.pdfPlaceholderEl.addEventListener('click', async () => {
                await this.ensurePdfLoaded();
            });
        }
    }

    setupResizers() {
        const leftResizer = document.getElementById('leftResizer');
        const middleResizer = document.getElementById('middleResizer');
        const leftPanel = document.querySelector('.left-panel');
        const middlePanel = document.querySelector('.middle-panel');
        const rightPanel = document.querySelector('.right-panel');
        const container = document.querySelector('.container');

        // 从本地存储恢复面板宽度与折叠状态
        const panelState = this.restorePanelWidths(leftPanel, rightPanel);

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
        this.lastLeftWidth = panelState.lastLeftWidth || leftPanel.getBoundingClientRect().width || 200;
        this.lastRightWidth = panelState.lastRightWidth || rightPanel.getBoundingClientRect().width || 320;
        const leftToggle = leftResizer.querySelector('.resizer-toggle');
        const rightToggle = middleResizer.querySelector('.resizer-toggle');
        const updateLeftToggleTitle = (collapsed) => {
            if (!leftToggle) return;
            leftToggle.title = collapsed
                ? 'Show file list (Cmd+Shift+S / Ctrl+Shift+S)'
                : 'Hide file list (Cmd+Shift+S / Ctrl+Shift+S)';
        };
        const updateRightToggleTitle = (collapsed) => {
            if (!rightToggle) return;
            rightToggle.title = collapsed
                ? 'Show PDF preview (Cmd+Shift+F / Ctrl+Shift+F)'
                : 'Hide PDF preview (Cmd+Shift+F / Ctrl+Shift+F)';
        };
        updateLeftToggleTitle(leftPanel.classList.contains('panel-collapsed'));
        updateRightToggleTitle(rightPanel.classList.contains('panel-collapsed'));
        if (leftToggle) {
            leftToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const icon = leftToggle.querySelector('i');
                if (leftPanel.classList.contains('panel-collapsed')) {
                    leftPanel.classList.remove('panel-collapsed');
                    leftPanel.style.width = this.lastLeftWidth + 'px';
                    updateLeftToggleTitle(false);
                    if (icon) icon.style.transform = 'rotate(0deg)';
                    this.savePanelWidths(leftPanel, rightPanel, { collapsedLeft: false, lastLeftWidth: this.lastLeftWidth, lastRightWidth: this.lastRightWidth });
                } else {
                    this.lastLeftWidth = leftPanel.getBoundingClientRect().width;
                    leftPanel.classList.add('panel-collapsed');
                    leftPanel.style.width = '';
                    updateLeftToggleTitle(true);
                    if (icon) icon.style.transform = 'rotate(180deg)';
                    this.savePanelWidths(leftPanel, rightPanel, { collapsedLeft: true, lastLeftWidth: this.lastLeftWidth, lastRightWidth: this.lastRightWidth });
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
                    if (!this.lastRightWidth || this.lastRightWidth <= 1) {
                        const containerWidth = container?.getBoundingClientRect().width || window.innerWidth;
                        this.lastRightWidth = Math.max(200, Math.floor(containerWidth * 0.33));
                    }
                    rightPanel.style.width = this.lastRightWidth + 'px';
                    middleToggle.title = 'Hide PDF preview (Cmd+Shift+F / Ctrl+Shift+F)';
                    if (icon) icon.style.transform = 'rotate(0deg)';
                    this.savePanelWidths(leftPanel, rightPanel, { collapsedRight: false, lastLeftWidth: this.lastLeftWidth, lastRightWidth: this.lastRightWidth });
                } else {
                    this.lastRightWidth = rightPanel.getBoundingClientRect().width;
                    rightPanel.classList.add('panel-collapsed');
                    rightPanel.style.width = '';
                    middleToggle.title = 'Show PDF preview (Cmd+Shift+F / Ctrl+Shift+F)';
                    if (icon) icon.style.transform = 'rotate(180deg)';
                    this.savePanelWidths(leftPanel, rightPanel, { collapsedRight: true, lastLeftWidth: this.lastLeftWidth, lastRightWidth: this.lastRightWidth });
                }
                updateRightToggleTitle(rightPanel.classList.contains('panel-collapsed'));
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

    applyFileOrder(files = []) {
        const projectKey = this.currentProject ? this.normalizeProjectPathString(this.currentProject.path) : 'user';
        const stored = this.fileOrders?.[projectKey] || [];
        const inStored = [];
        const seen = new Set();
        stored.forEach(f => {
            if (files.includes(f) && !seen.has(f)) {
                inStored.push(f);
                seen.add(f);
            }
        });
        const remaining = files.filter(f => !seen.has(f)).sort();
        return [...inStored, ...remaining];
    }

    saveFileOrderForProject(order = [], groups = null) {
        const projectKey = this.currentProject ? this.normalizeProjectPathString(this.currentProject.path) : 'user';
        this.fileOrders[projectKey] = [...order];
        if (groups) {
            this.fileGroups[projectKey] = { groups: this.cloneFileGroups(groups) };
        }
        const groupsToSave = groups || this.fileGroups[projectKey]?.groups || null;
        this.persistFileOrder(order, groupsToSave).catch(err => console.warn('save order failed:', err));
    }

    async fetchFileOrder() {
        const projectPath = this.currentProject ? this.currentProject.path : 'user';
        try {
            const resp = await fetch('/file-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectPath, action: 'get' })
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            if (data && Array.isArray(data.order)) {
                const key = this.normalizeProjectPathString(projectPath);
                this.fileOrders[key] = data.order;
                if (data.groups) {
                    this.fileGroups[key] = { groups: this.normalizeFileGroups(data.groups) };
                }
            }
        } catch (err) {
            console.warn('fetch file order failed:', err);
        }
    }

    async persistFileOrder(order = [], groups = null) {
        const projectPath = this.currentProject ? this.currentProject.path : 'user';
        const payload = { projectPath, action: 'set', order };
        if (groups && Array.isArray(groups)) {
            payload.groups = groups;
        }
        const resp = await fetch('/file-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    }

    reorderFileItem(filename, offset = 0) {
        if (!offset) return;
        const groups = this.getCurrentGroups();
        let targetGroup = null;
        groups.forEach(g => {
            if (g.files?.includes(filename)) targetGroup = g;
        });
        if (!targetGroup) return;
        const idx = targetGroup.files.indexOf(filename);
        const next = idx + offset;
        if (next < 0 || next >= targetGroup.files.length) return;
        const newFiles = [...targetGroup.files];
        const [removed] = newFiles.splice(idx, 1);
        newFiles.splice(next, 0, removed);
        targetGroup.files = newFiles;
        this.persistGroupsAndRender(groups, filename);
    }

    // 保存面板宽度到本地存储
    savePanelWidths(leftPanel, rightPanel, extras = {}) {
        try {
            const widths = {
                left: leftPanel.getBoundingClientRect().width,
                right: rightPanel.getBoundingClientRect().width,
                timestamp: Date.now(),
                collapsedLeft: extras.collapsedLeft ?? leftPanel.classList.contains('panel-collapsed'),
                collapsedRight: extras.collapsedRight ?? rightPanel.classList.contains('panel-collapsed'),
                lastLeftWidth: extras.lastLeftWidth ?? leftPanel.getBoundingClientRect().width,
                lastRightWidth: extras.lastRightWidth ?? rightPanel.getBoundingClientRect().width
            };
            localStorage.setItem('panelWidths', JSON.stringify(widths));
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
                this.lastLeftWidth = widths.lastLeftWidth || widths.left || this.lastLeftWidth || 200;
                this.lastRightWidth = widths.lastRightWidth || widths.right || this.lastRightWidth || 320;
                if (widths.left) {
                    leftPanel.style.width = `${widths.left}px`;
                    leftPanel.style.flexShrink = '0';
                    leftPanel.style.flexGrow = '0';
                }
                if (widths.right) {
                    rightPanel.style.width = `${widths.right}px`;
                    rightPanel.style.flexShrink = '0';
                    rightPanel.style.flexGrow = '0';
                }
                if (widths.collapsedLeft) {
                    leftPanel.classList.add('panel-collapsed');
                }
                if (widths.collapsedRight) {
                    rightPanel.classList.add('panel-collapsed');
                }
                this.debugLog('✅ 面板宽度已恢复:', widths);
                return widths;
            }
        } catch (error) {
            console.error('恢复面板宽度失败:', error);
        }
        return { collapsedLeft: false, collapsedRight: false };
    }

    toggleLeftPanelVisibility() {
        const leftPanel = document.querySelector('.left-panel');
        const rightPanel = document.querySelector('.right-panel');
        const leftToggle = document.querySelector('#leftResizer .resizer-toggle');
        if (!leftPanel) return;
        const icon = leftToggle?.querySelector('i');
        if (leftPanel.classList.contains('panel-collapsed')) {
            leftPanel.classList.remove('panel-collapsed');
            if (!this.lastLeftWidth || this.lastLeftWidth <= 1) {
                this.lastLeftWidth = Math.max(180, leftPanel.getBoundingClientRect().width || 200);
            }
            leftPanel.style.width = this.lastLeftWidth + 'px';
            if (icon) icon.style.transform = 'rotate(0deg)';
            this.savePanelWidths(leftPanel, rightPanel, { collapsedLeft: false, lastLeftWidth: this.lastLeftWidth, lastRightWidth: this.lastRightWidth });
        } else {
            this.lastLeftWidth = leftPanel.getBoundingClientRect().width;
            leftPanel.classList.add('panel-collapsed');
            leftPanel.style.width = '';
            if (icon) icon.style.transform = 'rotate(180deg)';
            this.savePanelWidths(leftPanel, rightPanel, { collapsedLeft: true, lastLeftWidth: this.lastLeftWidth, lastRightWidth: this.lastRightWidth });
        }
    }

    toggleRightPanelVisibility() {
        const leftPanel = document.querySelector('.left-panel');
        const rightPanel = document.querySelector('.right-panel');
        const middleToggle = document.querySelector('#middleResizer .resizer-toggle');
        const container = document.querySelector('.container');
        if (!rightPanel) return;
        const icon = middleToggle?.querySelector('i');
        if (rightPanel.classList.contains('panel-collapsed')) {
            rightPanel.classList.remove('panel-collapsed');
            if (!this.lastRightWidth || this.lastRightWidth <= 1) {
                const containerWidth = container?.getBoundingClientRect().width || window.innerWidth;
                this.lastRightWidth = Math.max(200, Math.floor(containerWidth * 0.33));
            }
            rightPanel.style.width = this.lastRightWidth + 'px';
            if (icon) icon.style.transform = 'rotate(0deg)';
            if (middleToggle) middleToggle.title = 'Hide PDF preview (Cmd+Shift+F / Ctrl+Shift+F)';
            this.savePanelWidths(leftPanel, rightPanel, { collapsedRight: false, lastLeftWidth: this.lastLeftWidth, lastRightWidth: this.lastRightWidth });
        } else {
            this.lastRightWidth = rightPanel.getBoundingClientRect().width;
            rightPanel.classList.add('panel-collapsed');
            rightPanel.style.width = '';
            if (icon) icon.style.transform = 'rotate(180deg)';
            if (middleToggle) middleToggle.title = 'Show PDF preview (Cmd+Shift+F / Ctrl+Shift+F)';
            this.savePanelWidths(leftPanel, rightPanel, { collapsedRight: true, lastLeftWidth: this.lastLeftWidth, lastRightWidth: this.lastRightWidth });
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
            this.currentFileList = [];
            
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
            this.selectedFiles = new Set();
            this.lastFileSelectionAnchor = null;
            
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
            // 读取服务器排序
            await this.fetchFileOrder();
            // 应用自定义排序（若有），否则按字母排序
            const ordered = this.applyFileOrder(files);
            const groups = this.syncGroupsWithFiles(ordered);
            // 避免在加载列表时批量创建/检查 Markdown，以减少切换文件时的卡顿。
            // Markdown 的存在校验改为按需在 loadFile 阶段处理。
            this.renderFileList(this.currentFileList, keepSelection ? currentSelected : null, true, groups);
        } catch (error) {
            console.error('Error loading file list:', error);
            this.showNotification('✗ 加载文件列表失败', 'error');
            fileListEl.innerHTML = '<div class="empty-state"><p>加载失败，请检查服务器</p></div>';
        }
    }

    renderFileList(files, keepSelected = null, alreadyOrdered = false, groupsOverride = null) {
        const fileListEl = document.getElementById('fileList');
        
        if (files.length === 0) {
            this.visibleFileOrder = [];
            this.selectedFiles = new Set();
            fileListEl.innerHTML = '<div class="empty-state"><p>暂无JSON文件</p></div>';
            return;
        }

        const baseOrder = alreadyOrdered ? [...files] : [...files].sort();
        const groups = this.syncGroupsWithFiles(baseOrder, groupsOverride);
        const filterText = (this.fileFilter || '').toLowerCase();
        const groupsView = groups.map(g => {
            const filtered = filterText
                ? (g.files || []).filter(f => f.toLowerCase().includes(filterText))
                : [...(g.files || [])];
            const visible = g.collapsed ? [] : filtered;
            return {
                ...g,
                collapsed: !!g.collapsed,
                filteredCount: filtered.length,
                visible
            };
        });
        const flatVisible = groupsView.reduce((arr, g) => {
            arr.push(...(g.visible || []));
            return arr;
        }, []);
        this.visibleFileOrder = [...flatVisible];

        const selectedBefore = Array.from(this.selectedFiles || []);
        let nextSelection = selectedBefore.filter(f => flatVisible.includes(f));
        if (!nextSelection.length) {
            const candidates = [
                keepSelected,
                this.currentFile,
                this.getLastSelectedFile(),
                flatVisible[0]
            ].filter(f => f && flatVisible.includes(f));
            if (candidates.length) nextSelection = [candidates[0]];
        }
        this.selectedFiles = new Set(nextSelection);
        this.lastFileSelectionAnchor = nextSelection.length ? nextSelection[nextSelection.length - 1] : null;

        // 创建新的文件列表结构
        const newFileListEl = document.createElement('div');

        let visibleCounter = 0;
        const autoLoadTarget = (!this.currentFile || !flatVisible.includes(this.currentFile)) && nextSelection.length
            ? nextSelection[0]
            : null;

        groupsView.forEach((group, gIndex) => {
            const groupEl = document.createElement('div');
            groupEl.className = 'file-group';
            groupEl.dataset.groupId = group.id;
            if (group.collapsed) {
                groupEl.classList.add('collapsed');
            }

            const header = document.createElement('div');
            header.className = 'file-group-header';
            header.addEventListener('click', (ev) => {
                if (ev.target.closest('.file-group-title')) return;
                this.toggleGroupCollapse(group.id);
            });
            header.addEventListener('dragover', (e) => this.handleGroupDragOver(e, group.id));
            header.addEventListener('drop', (e) => this.handleGroupDrop(e, group.id));
            header.addEventListener('dragleave', () => this.clearAllFileDragHighlights());

            const toggle = document.createElement('span');
            toggle.className = 'file-group-toggle';
            toggle.innerHTML = '<i class="fas fa-chevron-down"></i>';
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleGroupCollapse(group.id);
            });
            const title = document.createElement('span');
            title.className = 'file-group-title';
            title.textContent = group.name || `分组 ${gIndex + 1}`;
            title.title = '双击重命名分组';
            title.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.renameGroup(group.id);
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'file-group-delete';
            deleteBtn.title = '删除分组';
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteGroup(group.id);
            });

            const count = document.createElement('span');
            count.className = 'file-group-count';
            const totalCount = (group.files || []).length;
            count.textContent = `${totalCount}`;

            header.appendChild(toggle);
            header.appendChild(title);
            header.appendChild(count);
            header.appendChild(deleteBtn);
            groupEl.appendChild(header);

            const body = document.createElement('div');
            body.className = 'file-group-body';
            body.dataset.groupId = group.id;
            body.addEventListener('dragover', (e) => this.handleGroupDragOver(e, group.id));
            body.addEventListener('drop', (e) => this.handleGroupDrop(e, group.id));
            body.addEventListener('dragleave', () => this.clearAllFileDragHighlights());

            if (!group.visible || group.visible.length === 0) {
                const placeholder = document.createElement('div');
                placeholder.className = 'file-group-empty';
                placeholder.textContent = this.fileFilter ? '无匹配文件' : '拖拽文件到此分组';
                body.appendChild(placeholder);
            } else {
                group.visible.forEach((file) => {
                    const displayName = file.replace(/\.[^.]+$/, '');
                    const number = visibleCounter + 1;
                    const fileItem = document.createElement('div');
                    fileItem.className = 'file-item';
                    fileItem.dataset.filename = file;
                    fileItem.dataset.groupId = group.id;
                    fileItem.draggable = true;
                    this.setFileItemContent(fileItem, displayName, number);

                    fileItem.addEventListener('click', (e) => this.handleFileClick(e, file, fileItem));

                    fileItem.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        window.paperReviewerApp.showFileContextMenu(e, file, fileItem);
                    });

                    fileItem.addEventListener('dragstart', (e) => this.handleFileDragStart(e, file, group.id, fileItem));
                    fileItem.addEventListener('dragover', (e) => this.handleFileDragOver(e, file, group.id, fileItem));
                    fileItem.addEventListener('dragleave', () => this.clearFileDragHighlights(fileItem));
                    fileItem.addEventListener('drop', (e) => this.handleFileDropOnItem(e, file, group.id));
                    fileItem.addEventListener('dragend', () => {
                        this.draggingFile = null;
                        this.currentFileDragState = null;
                        this.clearAllFileDragHighlights();
                        fileItem.classList.remove('dragging');
                    });

                    if (this.selectedFiles.has(file)) {
                        fileItem.classList.add('active');
                    }

                    visibleCounter += 1;
                    body.appendChild(fileItem);
                });
            }

            groupEl.appendChild(body);
            newFileListEl.appendChild(groupEl);
        });

        fileListEl.innerHTML = '';
        fileListEl.appendChild(newFileListEl);
        this.updateFileSelectionDom();
        if (autoLoadTarget) {
            const autoEl = fileListEl.querySelector(`.file-item[data-filename="${autoLoadTarget}"]`);
            if (autoEl) {
                setTimeout(() => this.loadFile(autoLoadTarget, autoEl), 30);
            }
        }
    }

    handleFileDragStart(e, filename, groupId, itemEl = null) {
        const selected = this.getSelectedFilesArray();
        const inSelection = selected.includes(filename);
        const dragFiles = inSelection && selected.length > 1 ? selected : [filename];
        this.draggingFile = { filename, fromGroupId: groupId, files: dragFiles };
        this.currentFileDragState = null;
        const targetEl = itemEl || e?.target;
        if (targetEl?.classList) targetEl.classList.add('dragging');

        const count = dragFiles.length;
        const label = count > 1 ? `移动 ${count} 个文件` : filename.replace(/\.[^.]+$/, '');
        const preview = this.createDragPreview(label);

        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', filename);
            if (preview) e.dataTransfer.setDragImage(preview, -10, -10);
        }
    }

    handleFileDragOver(e, targetFilename, targetGroupId, targetEl) {
        if (!this.draggingFile) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        if (this.draggingFile.files && this.draggingFile.files.length > 1) {
            this.markFileDragPosition(targetEl, false);
            return;
        }
        const before = e.offsetY < (targetEl?.clientHeight || 0) / 2;
        this.currentFileDragState = { targetFilename, targetGroupId, placeAfter: !before };
        this.markFileDragPosition(targetEl, before);
    }

    handleFileDropOnItem(e, targetFilename, targetGroupId) {
        if (!this.draggingFile) return;
        if (this.draggingFile.filename === targetFilename) {
            this.clearAllFileDragHighlights();
            return;
        }
        e.preventDefault();
        if (this.draggingFile.files && this.draggingFile.files.length > 1) {
            this.moveSelectedFilesToGroup(targetGroupId, { placeBottom: true });
        } else {
            const placeAfter = this.currentFileDragState?.targetFilename === targetFilename
                ? !!this.currentFileDragState.placeAfter
                : (e.offsetY >= (e.currentTarget?.clientHeight || 0) / 2);
            this.moveFileBetweenGroups(this.draggingFile.filename, targetGroupId, targetFilename, placeAfter);
        }
        this.draggingFile = null;
        this.currentFileDragState = null;
        this.clearAllFileDragHighlights();
    }

    handleGroupDragOver(e, groupId) {
        if (!this.draggingFile) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        const body = e.currentTarget;
        if (body && body.classList) {
            body.classList.add('file-group-drop');
        }
    }

    handleGroupDrop(e, groupId) {
        if (!this.draggingFile) return;
        e.preventDefault();
        e.stopPropagation();
        if (this.draggingFile.files && this.draggingFile.files.length > 1) {
            this.moveSelectedFilesToGroup(groupId, { placeBottom: true });
        } else {
            this.moveFileBetweenGroups(this.draggingFile.filename, groupId);
        }
        this.draggingFile = null;
        this.currentFileDragState = null;
        this.clearAllFileDragHighlights();
    }

    markFileDragPosition(targetEl, before) {
        if (!targetEl) return;
        targetEl.classList.add('dragging-over');
        targetEl.classList.toggle('drag-over-before', before);
        targetEl.classList.toggle('drag-over-after', !before);
    }

    clearFileDragHighlights(targetEl) {
        if (targetEl?.classList) {
            targetEl.classList.remove('dragging-over', 'drag-over-before', 'drag-over-after');
        }
    }

    clearAllFileDragHighlights() {
        document.querySelectorAll('.file-item').forEach(el => {
            this.clearFileDragHighlights(el);
            el.classList.remove('dragging');
        });
        document.querySelectorAll('.file-group-body').forEach(el => el.classList.remove('file-group-drop'));
        document.querySelectorAll('.file-group-header').forEach(el => el.classList.remove('file-group-drop'));
        this.removeDragPreview();
    }

    openGroupMoveMenu() {
        const groups = this.getCurrentGroups();
        if (!groups.length) return;
        this.closeGroupMoveMenu();
        const menu = document.createElement('div');
        menu.className = 'group-move-menu';
        groups.forEach((g, idx) => {
            const item = document.createElement('div');
            item.className = 'group-move-item';
            item.dataset.groupId = g.id;
            item.textContent = g.name || `分组 ${idx + 1}`;
            if (idx === 0) item.classList.add('active');
            item.addEventListener('click', () => {
                this.applyGroupMoveFromMenu(g.id);
            });
            menu.appendChild(item);
        });
        document.body.appendChild(menu);
        const anchorFile = this.getSelectedFilesArray()[0] || this.currentFile;
        const anchorEl = anchorFile ? document.querySelector(`.file-item[data-filename="${anchorFile}"]`) : null;
        if (anchorEl) {
            const rect = anchorEl.getBoundingClientRect();
            const margin = 8;
            const maxLeft = window.innerWidth - menu.offsetWidth - margin;
            const maxTop = window.innerHeight - menu.offsetHeight - margin;
            const left = Math.min(Math.max(rect.right + margin, margin), Math.max(maxLeft, margin));
            const top = Math.min(Math.max(rect.top, margin), Math.max(maxTop, margin));
            menu.style.left = `${left}px`;
            menu.style.top = `${top}px`;
            menu.style.transform = 'translate(0, 0)';
        }
        this.groupMenuState = { menuEl: menu, groups, index: 0 };

        const keyHandler = (e) => {
            if (!this.groupMenuState || !this.groupMenuState.menuEl) return;
            if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)) {
                e.preventDefault();
                if (e.key === 'Escape') {
                    this.closeGroupMoveMenu();
                    return;
                }
                if (e.key === 'Enter') {
                    const target = this.groupMenuState.groups[this.groupMenuState.index];
                    if (target) this.applyGroupMoveFromMenu(target.id);
                    return;
                }
                const delta = e.key === 'ArrowUp' ? -1 : 1;
                let next = this.groupMenuState.index + delta;
                if (next < 0) next = this.groupMenuState.groups.length - 1;
                if (next >= this.groupMenuState.groups.length) next = 0;
                this.groupMenuState.index = next;
                this.refreshGroupMoveMenuActive();
            }
        };
        const clickOutside = (e) => {
            if (!menu.contains(e.target)) this.closeGroupMoveMenu();
        };
        menu._keyHandler = keyHandler;
        menu._clickHandler = clickOutside;
        document.addEventListener('keydown', keyHandler);
        document.addEventListener('mousedown', clickOutside);
    }

    refreshGroupMoveMenuActive() {
        if (!this.groupMenuState?.menuEl) return;
        const items = Array.from(this.groupMenuState.menuEl.querySelectorAll('.group-move-item'));
        items.forEach((el, idx) => el.classList.toggle('active', idx === this.groupMenuState.index));
    }

    closeGroupMoveMenu() {
        const menu = this.groupMenuState?.menuEl;
        if (menu) {
            if (menu._keyHandler) document.removeEventListener('keydown', menu._keyHandler);
            if (menu._clickHandler) document.removeEventListener('mousedown', menu._clickHandler);
            menu.remove();
        }
        this.groupMenuState = null;
    }

    applyGroupMoveFromMenu(groupId) {
        this.closeGroupMoveMenu();
        if (!groupId) return;
        let files = this.getSelectedFilesArray();
        if (!files.length && this.currentFile) {
            this.setSelectedFiles([this.currentFile], this.currentFile);
            files = [this.currentFile];
        }
        const nextFocus = this.findNextFileAfterSelection(files);
        this.moveSelectedFilesToGroup(groupId, { placeBottom: true });
        if (nextFocus) {
            this.setSelectedFiles([nextFocus], nextFocus);
            const el = document.querySelector(`.file-item[data-filename="${nextFocus}"]`);
            if (el) this.loadFile(nextFocus, el);
        }
    }

    moveFileBetweenGroups(filename, targetGroupId, beforeFile = null, placeAfter = false) {
        const groups = this.syncGroupsWithFiles(this.currentFileList || []);
        const target = groups.find(g => g.id === targetGroupId) || groups[0];
        if (!target) return;
        if (!Array.isArray(target.files)) target.files = [];
        groups.forEach(g => {
            g.files = (g.files || []).filter(f => f !== filename);
        });
        const insertIdx = beforeFile ? target.files.indexOf(beforeFile) : -1;
        const position = insertIdx >= 0 ? insertIdx + (placeAfter ? 1 : 0) : target.files.length;
        target.files.splice(position, 0, filename);
        this.lastFileSelectionAnchor = filename;
        this.persistGroupsAndRender(groups, filename);
    }

    moveSelectedFilesToGroup(targetGroupId, opts = {}) {
        const placeBottom = opts.placeBottom !== false;
        const files = this.getSelectedFilesArray();
        if (!files.length) return;
        const groups = this.syncGroupsWithFiles(this.currentFileList || []);
        const target = groups.find(g => g.id === targetGroupId) || groups[0];
        if (!target) return;
        if (!Array.isArray(target.files)) target.files = [];

        // 如果已经在目标组且顺序一致，则不做任何调整
        const existingInTarget = target.files.filter(f => files.includes(f));
        const alreadyAllHere = existingInTarget.length === files.length;
        const sameOrder = alreadyAllHere && files.every((f, idx) => existingInTarget[idx] === f);
        if (sameOrder) {
            this.lastFileSelectionAnchor = files[files.length - 1] || null;
            this.persistGroupsAndRender(groups, files[files.length - 1]);
            return;
        }

        groups.forEach(g => {
            g.files = (g.files || []).filter(f => !files.includes(f));
        });
        if (placeBottom) {
            files.forEach(f => {
                if (!target.files.includes(f)) target.files.push(f);
            });
        } else {
            files.forEach(f => {
                if (!target.files.includes(f)) target.files.push(f);
            });
        }
        this.lastFileSelectionAnchor = files[files.length - 1] || null;
        this.persistGroupsAndRender(groups, files[files.length - 1]);
    }

    handleFileClick(e, filename, fileItem) {
        const order = this.visibleFileOrder || [];
        const meta = e.metaKey || e.ctrlKey;
        const shift = e.shiftKey;
        let nextSelection = new Set(this.selectedFiles || []);
        if (shift && order.length) {
            const selected = this.getSelectedFilesArray();
            const anchor = (this.lastFileSelectionAnchor && order.includes(this.lastFileSelectionAnchor))
                ? this.lastFileSelectionAnchor
                : (selected.length ? selected[selected.length - 1] : filename);
            const start = order.indexOf(anchor);
            const end = order.indexOf(filename);
            if (end >= 0) {
                const [s, eidx] = start <= end ? [start, end] : [end, start];
                nextSelection = new Set(order.slice(s, eidx + 1));
            } else {
                nextSelection = new Set([filename]);
            }
        } else if (meta) {
            if (nextSelection.has(filename)) nextSelection.delete(filename);
            else nextSelection.add(filename);
            if (!nextSelection.size) nextSelection.add(filename);
        } else {
            nextSelection = new Set([filename]);
        }
        this.selectedFiles = nextSelection;
        this.lastFileSelectionAnchor = filename;
        this.updateFileSelectionDom();
        this.setLastSelectedFile(filename);
        this.loadFile(filename, fileItem);
    }

    renameGroup(groupId) {
        if (!groupId) return;
        const groups = this.getCurrentGroups();
        const target = groups.find(g => g.id === groupId);
        if (!target) return;
        const nextName = prompt('输入分组名称', target.name || '');
        if (!nextName) return;
        target.name = nextName.trim();
        this.persistGroupsAndRender(groups, this.currentFile);
    }

    createGroup() {
        const name = prompt('输入新分组名称', '新分组');
        if (!name) return;
        const groups = this.getCurrentGroups();
        const id = `group-${Date.now()}`;
        groups.push({ id, name: name.trim(), files: [], collapsed: false });
        this.persistGroupsAndRender(groups, this.currentFile);
    }

    setFileItemContent(fileItem, displayName, number) {
        const numText = `${number}`;
        const iconHtml = '<i class="fas fa-file-alt"></i>';
        fileItem.innerHTML = `
            <span class="file-index">${numText}</span>
            ${iconHtml}
            <span class="file-name">${this.escapeHtml(displayName)}</span>
        `;
    }

    // 显示文件右键菜单
    showFileContextMenu(e, filename, fileItem) {
        // 移除旧菜单
        const oldMenu = document.querySelector('.context-menu');
        if (oldMenu) oldMenu.remove();

        const alreadySelected = this.selectedFiles.has(filename);
        if (!alreadySelected) {
            const existing = this.getSelectedFilesArray();
            if (e.metaKey || e.ctrlKey) {
                this.setSelectedFiles([...existing, filename], filename);
            } else if (existing.length) {
                // keep existing multi-selection; only add the target
                this.setSelectedFiles([...existing, filename], filename);
            } else {
                this.setSelectedFiles([filename], filename);
            }
        }
        
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
            <div class="context-menu-item" data-action="copyPdfFile">
                <i class="fas fa-copy"></i> 复制 PDF 文件
            </div>
        `;

        const groups = this.getCurrentGroups();
        if (groups && groups.length) {
            const divider = document.createElement('div');
            divider.className = 'context-menu-divider';
            menu.appendChild(divider);
            groups.forEach(g => {
                const item = document.createElement('div');
                item.className = 'context-menu-item';
                item.dataset.action = 'moveToGroup';
                item.dataset.groupId = g.id;
                item.innerHTML = `<i class="fas fa-layer-group"></i> 移动到: ${this.escapeHtml(g.name || g.id)}`;
                menu.appendChild(item);
            });
        }
        
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
                } else if (action === 'copyPdfFile') {
                    this.copyPdfFileToClipboard(filename);
                } else if (action === 'moveToGroup') {
                    const gid = item.dataset.groupId;
                    if (gid) this.moveSelectedFilesToGroup(gid);
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

    async copyPdfNameToClipboard(jsonFilename) {
        try {
            const base = (jsonFilename || '').replace(/\.[^.]+$/, '');
            const pdfName = `${base}.pdf`;
            await this.writeTextToClipboard(pdfName);
            this.showNotification(`已复制: ${pdfName}`, 'success');
        } catch (err) {
            console.error('复制 PDF 文件名失败:', err);
            this.showNotification(`复制失败: ${err.message}`, 'error');
        }
    }

    async copyPdfFileToClipboard(jsonFilename) {
        try {
            const pdfFile = await this.getPdfFilenameForJson(jsonFilename);
            if (!pdfFile) {
                throw new Error('未找到对应的 PDF 文件名');
            }
            try {
                await this.copyPdfFileWithBrowserClipboard(pdfFile);
                this.showNotification(`已复制 PDF: ${pdfFile}`, 'success');
                return;
            } catch (browserErr) {
                console.warn('Browser clipboard write failed, try server:', browserErr);
            }
            await this.copyPdfFileViaServer(pdfFile);
            this.showNotification(`已通过系统剪贴板复制 PDF: ${pdfFile}`, 'success');
        } catch (err) {
            console.error('复制 PDF 文件失败:', err);
            this.showNotification(`复制失败: ${err.message}`, 'error');
        }
    }

    async copyPdfFileWithBrowserClipboard(pdfFile) {
        await this.ensureClipboardFileWriteSupported();
        const pdfPath = this.getPdfUrl(pdfFile);
        const resp = await fetch(pdfPath, { cache: 'no-store' });
        if (!resp.ok) throw new Error(`读取 PDF 失败 (${resp.status})`);
        const blob = await resp.blob();
        const typedBlob = blob.type ? blob : new Blob([await blob.arrayBuffer()], { type: 'application/pdf' });
        const type = typedBlob.type || 'application/pdf';
        const item = new ClipboardItem({ [type]: typedBlob });
        await navigator.clipboard.write([item]);
    }

    async ensureClipboardFileWriteSupported() {
        if (!window.isSecureContext) {
            throw new Error('当前页面非安全上下文（需 https 或 localhost）');
        }
        if (!navigator.clipboard || typeof navigator.clipboard.write !== 'function' || typeof window.ClipboardItem === 'undefined') {
            throw new Error('当前环境不支持文件写入剪贴板（需要安全上下文和新版本浏览器）');
        }
        try {
            const perm = navigator.permissions && navigator.permissions.query
                ? await navigator.permissions.query({ name: 'clipboard-write' })
                : null;
            if (perm && perm.state === 'denied') {
                throw new Error('浏览器已拒绝剪贴板写入权限，请在设置中允许');
            }
        } catch (_e) {
            // 忽略权限查询失败，后续写入会再提示
        }
    }

    async copyPdfFileViaServer(pdfFile) {
        const projectPath = this.currentProject ? this.currentProject.path : 'user';
        const resp = await fetch('/copy-pdf-to-clipboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectPath, pdfFile })
        });
        if (!resp.ok) {
            const text = await resp.text().catch(() => '');
            throw new Error(text || `服务器复制失败 (${resp.status})`);
        }
        const result = await resp.json().catch(() => ({}));
        if (!result.success) {
            throw new Error(result.error || '服务器复制失败');
        }
    }

    async getPdfFilenameForJson(jsonFilename) {
        const fallback = `${(jsonFilename || '').replace(/\.[^.]+$/, '')}.pdf`;
        // 如果当前文件已加载且是目标文件，直接取内存中的 meta_info
        if (this.currentFile === jsonFilename && this.currentData?.meta_info) {
            const val = this.normalizePdfPathValue(this.currentData.meta_info.pdf_path);
            if (val) return val;
        }
        // 否则从文件读取 meta_info
        try {
            const response = await fetch(this.getDataUrl(jsonFilename), { cache: 'no-store' });
            if (!response.ok) throw new Error(`读取失败 (${response.status})`);
            const data = await response.json();
            const val = data?.meta_info ? this.normalizePdfPathValue(data.meta_info.pdf_path) : '';
            return val || fallback;
        } catch (err) {
            console.warn('读取 meta_info.pdf_path 失败，使用默认文件名:', err);
            return fallback;
        }
    }

    getPdfUrl(pdfFile) {
        const projectPath = this.currentProject ? this.currentProject.path : 'user';
        const segments = `${projectPath}/papers/${pdfFile}`.split('/').filter(Boolean).map(encodeURIComponent);
        return `/${segments.join('/')}`;
    }

    // 重命名文件
    async renameFile(oldFilename, fileItem) {
        const newFilename = prompt('请输入新文件名:', oldFilename);
        if (!newFilename || newFilename === oldFilename) return;
        
        // 确保文件名以.json结尾
        const finalFilename = newFilename.endsWith('.json') ? newFilename : newFilename + '.json';
        const projectPath = this.currentProject ? this.currentProject.path : 'user';
        
        try {
            const response = await fetch('/rename-json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectPath,
                    oldFilename: oldFilename,
                    newFilename: finalFilename
                })
            });
            
            if (!response.ok) throw new Error('重命名失败');
            
            // 如果存在同名 Markdown，则同步重命名
            const oldMd = this.getMarkdownFilename(oldFilename);
            const newMd = this.getMarkdownFilename(finalFilename);
            if (oldMd !== newMd) {
                let mdExists = false;
                try {
                    const mdCheck = await fetch(this.getDataUrl(oldMd), { method: 'GET', cache: 'no-store' });
                    mdExists = mdCheck.ok;
                } catch (checkErr) {
                    console.warn('Check markdown existence failed:', checkErr);
                }

                if (mdExists) {
                    try {
                        const mdResp = await fetch('/rename-json', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                projectPath,
                                oldFilename: oldMd,
                                newFilename: newMd
                            })
                        });
                        if (!mdResp.ok) {
                            const msg = await mdResp.text();
                            throw new Error(msg || 'Markdown rename failed');
                        }
                        this.showNotification(`✓ 同步重命名笔记为 ${newMd}`, 'success');
                    } catch (mdErr) {
                        console.warn('Markdown rename failed:', mdErr);
                        this.showNotification('⚠️ Markdown 重命名失败，请手动检查', 'info');
                    }
                } else {
                    console.info('No markdown to rename for', oldMd);
                }
            }

            this.showNotification(`✓ 已重命名为 ${finalFilename}`, 'success');
            this.updateFilenameInGroups(oldFilename, finalFilename);
            
            // 如果当前打开的是这个文件，更新当前文件名
            if (this.currentFile === oldFilename) {
                this.currentFile = finalFilename;
                this.currentMarkdownFile = this.getMarkdownFilename(finalFilename);
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
        if (!confirm(`确定要删除 "${filename}" 及其同名 Markdown 吗？此操作无法撤销！`)) return;
        
        const projectPath = this.currentProject ? this.currentProject.path : 'user';
        const mdName = this.getMarkdownFilename(filename);
        let deletedMd = false;

        try {
            const response = await fetch('/delete-json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    projectPath,
                    filename: filename 
                })
            });
            
            if (!response.ok) throw new Error('删除失败');

            const result = await response.json().catch(() => ({}));
            deletedMd = !!result.mdDeleted;

            // 如果服务端未删除 md，再尝试一次客户端删除（兼容旧返回）
            if (!deletedMd) {
                try {
                    const mdResp = await fetch('/delete-json', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            projectPath,
                            filename: mdName
                        })
                    });
                    if (mdResp.ok) deletedMd = true;
                } catch (mdErr) {
                    console.warn('删除同名 markdown 失败:', mdErr);
                }
            }
            
            this.showNotification(`✓ 已删除 ${filename}${deletedMd ? `，笔记 ${mdName}` : ''}`, 'success');
            this.removeFilenameFromGroups(filename);
            
            // 刷新列表，确保不加载已删除文件
            await this.loadFileList(true);

            // 如果删除的是当前文件，清空状态并加载第一个文件
            if (this.currentFile === filename) {
                this.currentFile = null;
                this.currentData = null;
                this.hasUnsavedChanges = false;
                delete this.tempDataCache[filename];
                delete this.tempDataCache[mdName];

                const nextFile = (this.currentFileList || [])[0];
                if (nextFile) {
                    const nextEl = document.querySelector(`.file-item[data-filename="${nextFile}"]`);
                    this.loadFile(nextFile, nextEl);
                } else {
                    this.showLoading();
                }
            }
            
            // 移除节点动画
            if (fileItem && fileItem.remove) {
                fileItem.style.transition = 'opacity 0.3s ease';
                fileItem.style.opacity = '0';
                setTimeout(() => fileItem.remove(), 300);
            }
            
        } catch (error) {
            console.error('Error deleting file:', error);
            this.showNotification('✗ 删除失败', 'error');
        }
    }

    // 处理粘贴事件
    async handlePaste(e) {
        try {
            // Markdown 编辑器特殊处理：粘贴 QA 代码块时插入并渲染
            // 如果在输入框中粘贴，不处理
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            // 在 Markdown 渲染区域粘贴 QA 代码块：尾部追加，提示标题，可撤销
            if ((this.currentView || 'structured') === 'markdown' && !this.isMarkdownEditing) {
                const inMarkdownRender = !!e.target.closest('#markdownRender');
                if (inMarkdownRender) {
                    const clipboardData = e.clipboardData || window.clipboardData;
                    const pastedText = clipboardData.getData('text') || '';
                    if (this.tryHandleMarkdownQaPasteRendered(pastedText)) {
                        e.preventDefault();
                        return;
                    }
                }
            }
            
            const clipboardData = e.clipboardData || window.clipboardData;
            const pastedText = clipboardData.getData('text');
            
            if (!pastedText) return;
            
            this.debugLog('📋 检测到粘贴内容，尝试解析JSON...');
            
            // 尝试提取并解析JSON
            const jsonData = this.extractJSON(pastedText);
            if (!jsonData) {
                this.showNotification('未检测到有效 JSON，可能格式有误', 'error');
                return;
            }
            
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
        } catch (error) {
            console.error('Error handling paste:', error);
        }
    }

    // 提取JSON数据
    extractJSON(text) {
        // 0) 尝试 jsonrepair 库（如已加载）
        if (typeof jsonrepair === 'function') {
            try {
                const repaired = jsonrepair(text);
                const parsed = this.tryParseJson(repaired);
                if (parsed) return parsed;
            } catch (e) {
                console.warn('jsonrepair failed:', e);
            }
        }

        // 1) 直接解析
        const direct = this.tryParseJson(text);
        if (direct) return direct;

        // 2) 代码块内
        const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
            const parsed = this.tryParseJson(codeBlockMatch[1].trim());
            if (parsed) return parsed;
        }

        // 3) 提取 {} 或 [] 包裹的内容
        const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        if (jsonMatch) {
            const parsed = this.tryParseJson(jsonMatch[1]);
            if (parsed) return parsed;
        }

        // 4) 试着修复常见格式错误并重新解析
        const repaired = this.repairJsonText(text);
        if (repaired) {
            const parsed = this.tryParseJson(repaired);
            if (parsed) return parsed;
        }

        // 5) 逐个提取对象，跳过坏项（数组场景常见）
        const salvaged = this.salvageJsonObjects(text);
        if (salvaged && salvaged.length) return salvaged;

        return null;
    }

    tryParseJson(text) {
        try {
            return JSON.parse(text);
        } catch (_err) {
            if (typeof jsonrepair === 'function') {
                try {
                    const repaired = jsonrepair(text);
                    return JSON.parse(repaired);
                } catch (_err2) {
                    return null;
                }
            }
            return null;
        }
    }

    repairJsonText(text) {
        if (!text) return '';
        let s = text.replace(/^\uFEFF/, '');
        // 去掉注释
        s = s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n\r]*/g, '');
        // 去掉控制字符（保留换行制表）
        s = s.replace(/[\u0000-\u001F]+/g, (m) => {
            return m.replace(/\r|\n|\t/g, '');
        });
        // 去掉尾逗号
        s = s.replace(/,\s*([}\]])/g, '$1');
        // 尝试给未加引号的键补引号
        s = s.replace(/([{,\s])(['"])?([A-Za-z0-9_]+)\2\s*:/g, '$1"$3":');
        return s;
    }

    salvageJsonObjects(text) {
        if (!text) return [];
        const out = [];
        const matches = text.match(/\{[\s\S]*?\}/g) || [];
        matches.forEach((m) => {
            const cleaned = this.repairJsonText(m);
            const parsed = this.tryParseJson(cleaned);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                out.push(parsed);
            }
        });
        return out;
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
        const loadId = ++this.currentLoadToken;
        const hadTempCacheBefore = !!this.tempDataCache[filename];
        try {
            if (!this.selectedFiles.has(filename)) {
                this.setSelectedFiles([filename], filename);
            }
            // 如果当前 Markdown 有未保存修改，提示用户
            if (this.hasUnsavedMarkdownChanges && this.currentFile && this.currentMarkdownExists) {
                const mdFilename = this.getMarkdownFilename(this.currentFile);
                const shouldSave = confirm(`Markdown "${mdFilename}" 有未保存的修改，是否保存？`);
                if (shouldSave) {
                    await this.saveCurrentMarkdownSilently();
                } else {
                    this.discardCurrentMarkdownChanges();
                }
            }

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

            // Show loading state
            this.showLoading();

            // 优先从临时缓存加载，否则从文件加载
            if (this.tempDataCache[filename]) {
                this.currentData = this.tempDataCache[filename];
                this.hasUnsavedChanges = true;
            } else {
                // Fetch JSON file，使用项目路径
                const projectPath = this.currentProject ? this.currentProject.path : 'user';
                const response = await fetch(this.getDataUrl(filename), { cache: 'no-store' });
                if (!response.ok) throw new Error('Failed to load file');
                const data = await response.json();
                // 若在加载过程中用户切换了文件，放弃应用结果
                if (loadId !== this.currentLoadToken) return;
                this.currentData = data;
                this.hasUnsavedChanges = false;
            }
            if (loadId !== this.currentLoadToken) return;

            this.currentFile = filename;
            const metaChanged = this.ensureMetaInfoDefaultsOnLoad(filename);
            this.setLastSelectedFile(filename);
            this.updateFileMeta();

            // 更新UI状态
            this.updateSaveButtonState();
            this.updateSchemaBadge();
            this.updateUndoButtonState();

            // Render data
            this.renderStructuredView();
            this.renderFlatView();
            await this.ensureMarkdownExistsForFile(filename);
            // 再次确认未切换文件
            if (loadId !== this.currentLoadToken) return;
            await this.loadMarkdownForCurrentFile();
            // 自动保存因默认 meta 补全产生的更改，避免频繁提示
            if (metaChanged && !hadTempCacheBefore) {
                await this.autoSaveMetaDefaults();
            }

            // 准备 PDF，但懒加载，先不实际加载
            if (this.currentData.meta_info && this.currentData.meta_info.pdf_path) {
                const rawPdfPath = this.currentData.meta_info.pdf_path;
                const pdfFile = this.normalizePdfPathValue(rawPdfPath);
                // 若发现带路径的值，自动规范化为仅文件名，提示需要保存
                if (pdfFile && rawPdfPath !== pdfFile) {
                    this.currentData.meta_info.pdf_path = pdfFile;
                    this.hasUnsavedChanges = true;
                    this.tempDataCache[this.currentFile] = this.currentData;
                    this.updateSaveButtonState();
                }
                const projectPath = this.currentProject ? this.currentProject.path : 'user';
                if (loadId === this.currentLoadToken) {
                    const resolvedUrl = `${projectPath}/papers/${pdfFile}`;
                    this.currentPdfUrl = resolvedUrl;
                    this.pendingPdfUrl = resolvedUrl;
                    // bump token to invalidate any previous PDF onload callbacks
                    this.currentPdfLoadToken++;
                    const pdfViewer = document.getElementById('pdfViewer');
                    if (pdfViewer) {
                        pdfViewer.onload = null;
                        pdfViewer.removeAttribute('src');
                        pdfViewer.classList.remove('pdf-loaded');
                        delete pdfViewer.dataset.pdfSig;
                    }
                    this.lastPdfLoadedUrl = '';
                    this.lastPdfLoadedKey = '';
                    this.updatePdfPlaceholder('pending');
                    if (this.autoLoadPdf) {
                        await this.ensurePdfLoaded();
                    }
                }
            } else {
                this.currentPdfUrl = null;
                this.pendingPdfUrl = null;
                this.currentPdfLoadToken++;
                const pdfViewer = document.getElementById('pdfViewer');
                if (pdfViewer) {
                    pdfViewer.onload = null;
                    pdfViewer.removeAttribute('src');
                    pdfViewer.classList.remove('pdf-loaded');
                    delete pdfViewer.dataset.pdfSig;
                }
                this.updatePdfPlaceholder('empty');
                this.lastPdfLoadedUrl = '';
                this.lastPdfLoadedKey = '';
            }
            this.applyCurrentView();
        } catch (error) {
            console.error('Error loading file:', error);
            const spaceHint = /\s/.test(filename) ? ' (提示: 文件名包含空格，请去掉空格后重试)' : '';
            alert(`Failed to load file: ${error.message}${spaceHint}`);
            this.showNotification(`✗ Failed to load file${spaceHint}`, 'error');
        }
    }

    showLoading() {
        const structuredView = document.getElementById('structuredContent') || document.getElementById('structuredView');
        const markdownView = document.getElementById('markdownRender');
        const flatView = document.getElementById('flatView');
        
        // 保持空白，不再显示“Loading”提示
        structuredView.innerHTML = '';
        if (markdownView) markdownView.innerHTML = '';
        if (flatView) flatView.innerHTML = '';
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

        // 恢复已选中元素的高亮
        this.highlightSelectedItem();

        if (this.isReorderMode) {
            this.restoreReorderSelection();
        }

        // 渲染完成后触发MathJax
        this.renderMath(container);
        this.deferShowAddSectionButton();
        this.attachAddSectionHover();
    }

    createCollapsibleSection(title, data, path) {
        const wrapper = document.createElement('div');
        wrapper.className = 'collapsible-section';
        wrapper.dataset.sectionKey = title;
        wrapper.draggable = false;
        
        // Header with toggle
        const header = document.createElement('div');
        header.className = 'collapsible-header';
        if (this.getSectionExpanded(title)) {
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
        if (this.getSectionExpanded(title)) {
            content.classList.add('active');
        }
        
        const table = document.createElement('table');
        table.className = 'json-table';
        table.dataset.path = path.join('.');
        if (this.isReorderMode) {
            table.classList.add('reorder-mode');
        }
        // 点击表格空白区域时，选中对应的类条目
        table.addEventListener('click', (e) => {
            if (e.target.closest('tr')) return;
            this.setSelectedItem({ type: 'section', path: [], key: title });
        });
        this.renderObject(data, table, path);
        content.appendChild(table);
        
        // Toggle functionality / Reorder selection / Delete
        if (!this.isReorderMode) {
            // 双击重命名/整体编辑已取消，避免误触
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
                if (e.shiftKey) {
                    // Shift+点击：折叠全部 section
                    this.isCollapseAll = true;
                    this.updateAllSectionsCollapseState(true);
                    return;
                }
                const isActive = header.classList.toggle('active');
                content.classList.toggle('active');
                this.setSectionExpanded(title, isActive);
            });
        }
        // 点击标题区域：选中该类，便于键盘上下移动
        header.addEventListener('click', (e) => {
            if (e.target.closest('.header-delete') || e.target.closest('.header-add') || e.target.closest('.collapsible-toggle')) {
                return;
            }
            this.setSelectedItem({ type: 'section', path: [], key: title });
        });

        // Section拖拽排序逻辑已移除，改为点击选中 + 键盘上下调整

        // 悬停700ms自动选中该类，便于键盘上下移动
        let hoverTimer = null;
        header.addEventListener('mouseenter', () => {
            hoverTimer = setTimeout(() => {
                this.setSelectedItem({ type: 'section', path: [], key: title });
            }, 700);
        });
        header.addEventListener('mouseleave', () => {
            if (hoverTimer) {
                clearTimeout(hoverTimer);
                hoverTimer = null;
            }
        });

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
            row.dataset.path = basePath.join('.');
            row.draggable = false;
            const toggleCell = document.createElement('td');
            const keyCell = document.createElement('td');
            const valueCell = document.createElement('td');

            // 检查是否有对应的 location 信息
            const locKey = key + '_loc';
            const locationInfo = obj[locKey] || null;

            // 第一列：保留占位但不放置可点击的展开按钮
            toggleCell.className = 'toggle-cell';
            toggleCell.innerHTML = `
                <i class="fa-solid fa-circle-check row-select-indicator" title="点击选择，已选中可上下移动"></i>
            `;

            // 第二列：Key可编辑
            const isNestedIndex = table.classList.contains('nested-table') && /^\d+$/.test(key);
            const displayKey = isNestedIndex ? `#${parseInt(key, 10) + 1}` : this.formatKey(key);
            const keyDisplay = `<span class="editable-key" data-path="${basePath.join('.')}" data-key="${key}">${displayKey}</span>`;

            keyCell.innerHTML = keyDisplay;
            const currentPath = [...basePath, key];

            // 点击左列：仅切换选中状态（不再触发移动）
            toggleCell.addEventListener('click', (e) => {
                e.stopPropagation();
                const tablePath = table.dataset.path ? table.dataset.path.split('.').filter(Boolean) : [];
                const isSameSelected = this.selectedItem && this.selectedItem.type === 'row' &&
                    this.selectedItem.key === key &&
                    JSON.stringify(this.selectedItem.path || []) === JSON.stringify(tablePath);
                if (isSameSelected) {
                    this.setSelectedItem(null);
                } else {
                    this.setSelectedItem({ type: 'row', path: tablePath, key });
                }
            });
            // 单击行：仅选中；双击行：打开完整编辑弹窗
            row.addEventListener('click', (e) => {
                const tablePath = table.dataset.path ? table.dataset.path.split('.').filter(Boolean) : [];
                this.setSelectedItem({ type: 'row', path: tablePath, key });
            });
            row.addEventListener('dblclick', (e) => {
                const tablePath = table.dataset.path ? table.dataset.path.split('.').filter(Boolean) : [];
                const valuePath = [...tablePath, key];
                this.setSelectedItem({ type: 'row', path: tablePath, key });
                if (e.target.closest('a')) return; // 跳过链接跳转但保留选中状态
                if (e.target.closest('.editable-value')) return; // 点击值区域仅选中，不触发编辑弹窗

                const fullValue = this.getValueByPath(valuePath);
                let raw = '';
                if (typeof fullValue === 'object') {
                    try {
                        raw = JSON.stringify(fullValue, null, 2);
                    } catch (_err) {
                        raw = '';
                    }
                } else if (fullValue !== undefined && fullValue !== null) {
                    raw = fullValue;
                }

                this.openEditModal(valuePath, raw);
            });

            // 第三列：Value值的显示
            if (typeof value === 'object' && value !== null) {
                // 对数组长度为1的情况进行特殊处理：直接展开其元素，而不是显示 #1 索引
                if (Array.isArray(value)) {
                    if (value.length === 1) {
                        const sole = value[0];
                        if (sole && typeof sole === 'object') {
                            valueCell.innerHTML = '';
                            const subTable = document.createElement('table');
                            subTable.className = 'json-table nested-table';
                            const solePath = [...currentPath, '0'];
                            subTable.dataset.path = solePath.join('.');
                            this.renderObject(sole, subTable, solePath);
                            valueCell.appendChild(subTable);
                        } else {
                            // 单元素原始值，直接以索引0为路径进行编辑
                            valueCell.innerHTML = this.createEditableValue(sole, [...currentPath, '0'], locationInfo, key);
                        }
                    } else {
                        valueCell.innerHTML = '';
                        const subTable = document.createElement('table');
                        subTable.className = 'json-table nested-table';
                        subTable.dataset.path = currentPath.join('.');
                        const objValue = Object.fromEntries(value.map((v, i) => [i, v]));
                        this.renderObject(objValue, subTable, currentPath);
                        valueCell.appendChild(subTable);
                    }
                } else {
                    valueCell.innerHTML = '';
                    const subTable = document.createElement('table');
                    subTable.className = 'json-table nested-table';
                    subTable.dataset.path = currentPath.join('.');
                    this.renderObject(value, subTable, currentPath);
                    valueCell.appendChild(subTable);
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
        // 特殊处理: keywords 字段，解析为数组并为每个关键词生成 WoS 链接（AK=）
        if (keyLower === 'keywords' && value) {
            let keywordsArr = [];
            if (Array.isArray(value)) {
                keywordsArr = value.filter(v => typeof v === 'string' && v.trim()).map(v => v.trim());
            } else if (typeof value === 'string') {
                try {
                    const parsed = JSON.parse(value);
                    if (Array.isArray(parsed)) {
                        keywordsArr = parsed.filter(v => typeof v === 'string' && v.trim()).map(v => v.trim());
                    }
                } catch (_err) {
                    // 非 JSON 字符串，尝试分隔
                    keywordsArr = value.split(/[,;|]+/).map(v => v.trim()).filter(Boolean);
                }
            }
            if (keywordsArr.length) {
                const links = keywordsArr.map(kw => {
                    const url = this.generateWosKeywordUrl(kw);
                    const tip = this.escapeHtml(kw);
                    return `<a href="${url}" target="_blank" class="doi-link keyword-tip" data-tip="${tip}">
                        <i class="fas fa-external-link-alt"></i>
                    </a>`;
                }).join('<span class="keyword-sep"> </span>');
                return `<span class="keyword-links">${links}</span>`;
            }
        }
        // 特殊处理: authors 字段，解析为数组并为每个作者生成 WoS 链接（AU=）
        if (keyLower === 'authors' && value) {
            let authorsArr = [];
            if (Array.isArray(value)) {
                authorsArr = value.filter(v => typeof v === 'string' && v.trim()).map(v => v.trim());
            } else if (typeof value === 'string') {
                try {
                    const parsed = JSON.parse(value);
                    if (Array.isArray(parsed)) {
                        authorsArr = parsed.filter(v => typeof v === 'string' && v.trim()).map(v => v.trim());
                    }
                } catch (_err) {
                    authorsArr = value.split(/[,;|]+/).map(v => v.trim()).filter(Boolean);
                }
            }
            if (authorsArr.length) {
                const links = authorsArr.map(author => {
                    const url = this.generateWosAuthorUrl(author);
                    const tip = this.escapeHtml(author);
                    return `<a href="${url}" target="_blank" class="doi-link keyword-tip" data-tip="${tip}">
                        <i class="fas fa-external-link-alt"></i>
                    </a>`;
                }).join('<span class="keyword-sep"> </span>');
                return `<span class="keyword-links">${links}</span>`;
            }
        }
        // 特殊处理: Journal 字段，按 SO 查询 Web of Science
        if (keyLower === 'journal' && typeof value === 'string' && value.trim()) {
            const wosUrl = this.generateWosJournalUrl(value.trim());
            return `<a href="${wosUrl}" target="_blank" class="doi-link" title="View journal on Web of Science">
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
        const apaTextAttr = this.escapeHtml(displayValue || '');

        // 对超长公式使用图标占位，避免表格横向撑开
        if (isLongMath) {
            valueContent = `<span class="math-placeholder" title="Click to view/edit formula"><i class="fas fa-square-root-variable"></i></span>`;
        }

        // 渲染 goto{...} 为 PDF 跳转图标
        valueContent = this.renderGotoLinks(displayValue, path.join('.')) || valueContent;

        let html = `<span class="editable-value${isLongMath ? ' math-collapsed' : ''}" data-path="${path.join('.')}" data-raw-value="${rawValueAttr}">${valueContent}</span>`;
        if (keyLower === 'apa') {
            const doi = this.findFirstDoiInCurrentData();
            const doiAttr = this.escapeHtml(doi || '');
            const disabled = doi ? '' : ' data-disabled="1"';
            const btnTitle = doi ? `根据 DOI: ${doi} 生成 APA 并复制` : '未找到 DOI，无法生成 APA';
            const btn = `<button class="apa-fetch-btn" data-doi="${doiAttr}" data-apa-text="${apaTextAttr}" title="${btnTitle}"${disabled}><i class="fas fa-quote-left"></i><span>APA</span></button>`;
            const hint = doi ? `<span class="apa-doi-hint" title="使用的 DOI">${doiAttr}</span>` : `<span class="apa-doi-hint muted">无 DOI</span>`;
            html += `<span class="apa-actions">${btn}${hint}</span>`;
        }
        
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

    generateWosJournalUrl(journal) {
        if (!journal) return '';
        const query = [{
            rowText: `SO=${journal}`
        }];
        const jsonStr = encodeURIComponent(JSON.stringify(query));
        return `https://www.webofscience.com/wos/woscc/general-summary?queryJson=${jsonStr}`;
    }

    generateWosKeywordUrl(keyword) {
        if (!keyword) return '';
        const query = [{
            rowText: `AK=${keyword}`
        }];
        const jsonStr = encodeURIComponent(JSON.stringify(query));
        return `https://www.webofscience.com/wos/woscc/general-summary?queryJson=${jsonStr}`;
    }

    generateWosAuthorUrl(author) {
        if (!author) return '';
        const query = [{
            rowText: `AU=${author}`
        }];
        const jsonStr = encodeURIComponent(JSON.stringify(query));
        return `https://www.webofscience.com/wos/woscc/general-summary?queryJson=${jsonStr}`;
    }

    findFirstDoiInCurrentData() {
        const regex = /10\.\d{4,9}\/\S+/i;
        const seen = new Set();
        const stack = [this.currentData];
        while (stack.length) {
            const cur = stack.pop();
            if (!cur || typeof cur !== 'object') continue;
            if (seen.has(cur)) continue;
            seen.add(cur);
            const values = Array.isArray(cur) ? cur : Object.values(cur);
            for (const val of values) {
                if (typeof val === 'string') {
                    const m = val.match(regex);
                    if (m) return m[0];
                } else if (val && typeof val === 'object') {
                    stack.push(val);
                }
            }
        }
        return '';
    }

    getKeywordTooltipEl() {
        if (!this.keywordTooltipEl) {
            const el = document.createElement('div');
            el.className = 'keyword-tooltip';
            el.style.display = 'none';
            document.body.appendChild(el);
            this.keywordTooltipEl = el;
        }
        return this.keywordTooltipEl;
    }

    positionKeywordTooltip(e) {
        const tooltip = this.getKeywordTooltipEl();
        const offset = 12;
        let x = e.clientX + offset;
        let y = e.clientY + offset;
        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
        const rect = tooltip.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        if (rect.right > vw - 8) {
            x = vw - rect.width - 8;
        }
        if (rect.bottom > vh - 8) {
            y = vh - rect.height - 8;
        }
        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
    }

    normalizeProjectPathString(pathStr) {
        if (!pathStr) return '';
        return pathStr.replace(/\\/g, '/').replace(/\/+$/, '');
    }

    normalizePdfPathValue(pathStr) {
        if (!pathStr) return '';
        const parts = pathStr.split(/[/\\]+/).filter(Boolean);
        return parts.length ? parts[parts.length - 1] : pathStr;
    }

    getApaTooltipEl() {
        if (!this._apaTooltipEl) {
            const el = document.createElement('div');
            el.className = 'apa-tooltip';
            el.style.position = 'fixed';
            el.style.zIndex = '9999';
            el.style.maxWidth = '360px';
            el.style.padding = '10px';
            el.style.background = 'rgba(0,0,0,0.85)';
            el.style.color = '#fff';
            el.style.borderRadius = '6px';
            el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';
            el.style.fontSize = '12px';
            el.style.lineHeight = '1.4';
            el.style.display = 'none';
            el.style.whiteSpace = 'pre-wrap';
            el.style.pointerEvents = 'none';
            document.body.appendChild(el);
            this._apaTooltipEl = el;
        }
        return this._apaTooltipEl;
    }

    showApaTooltip(btn, text) {
        const el = this.getApaTooltipEl();
        el.textContent = text;
        const rect = btn.getBoundingClientRect();
        const padding = 8;
        let left = rect.left;
        let top = rect.bottom + padding;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        el.style.display = 'block';
        el.style.visibility = 'hidden';
        const tRect = el.getBoundingClientRect();
        if (left + tRect.width > vw - padding) {
            left = Math.max(padding, vw - tRect.width - padding);
        }
        if (top + tRect.height > vh - padding) {
            top = rect.top - tRect.height - padding;
        }
        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
        el.style.visibility = 'visible';
    }

    hideApaTooltip() {
        if (this._apaTooltipEl) {
            this._apaTooltipEl.style.display = 'none';
        }
    }

    ensureMetaInfoDefaultsOnLoad(filename = '') {
        if (!this.currentData) return false;
        if (!this.currentData.meta_info || typeof this.currentData.meta_info !== 'object') {
            this.currentData.meta_info = {};
        }
        const meta = this.currentData.meta_info;
        let changed = false;
        if (!Object.prototype.hasOwnProperty.call(meta, 'pdf_path')) {
            const base = filename ? filename.replace(/\.[^.]+$/, '') : (meta.paper_id || 'unknown');
            meta.pdf_path = `${this.normalizePdfPathValue(base)}.pdf`.replace(/\.pdf\.pdf$/i, '.pdf');
            changed = true;
        }
        if (!Object.prototype.hasOwnProperty.call(meta, 'apa')) {
            meta.apa = '';
            changed = true;
        }
        if (changed) {
            // 仅记录默认值被填充，避免提示用户未保存
            this.metaDefaultsPatched = true;
        }
        return changed;
    }

    async autoSaveMetaDefaults() {
        if (!this.currentFile || !this.currentData) return;
        if (!this.metaDefaultsPatched && !this.hasUnsavedChanges) return;
        if (this.isAutoSavingMeta) return;
        this.isAutoSavingMeta = true;
        try {
            await this.saveToFile({ silent: true });
        } catch (err) {
            console.warn('自动保存 meta 默认值失败:', err);
        } finally {
            this.isAutoSavingMeta = false;
            this.metaDefaultsPatched = false;
        }
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

    // 从用户选择的目录批量合并同名 JSON，新增字段合并，冲突字段用导入值覆盖
    async handleJsonFolderImport(event) {
        const input = event?.target;
        const files = Array.from(input?.files || []);
        if (input) input.value = '';
        if (!files.length) return;
        if (!this.currentProject) {
            this.showNotification('请先加载项目后再导入 JSON', 'error');
            return;
        }
        if (this.hasUnsavedChanges || this.hasUnsavedMarkdownChanges) {
            const proceed = confirm('当前文件存在未保存的修改，导入外部 JSON 可能覆盖，是否继续？');
            if (!proceed) return;
        }

        const jsonFiles = files.filter(file => (file.name || '').toLowerCase().endsWith('.json'));
        if (!jsonFiles.length) {
            this.showNotification('所选目录未找到 JSON 文件', 'info');
            return;
        }

        if (!this.currentFileList || !this.currentFileList.length) {
            await this.loadFileList(true);
        }
        const existingNames = new Set((this.currentFileList || []).map(name => name.toLowerCase()));
        const summary = { merged: [], skipped: [], failed: [] };

        for (const file of jsonFiles) {
            if (!existingNames.has(file.name.toLowerCase())) {
                summary.skipped.push(file.name);
                continue;
            }
            try {
                const incomingText = await file.text();
                const incomingData = JSON.parse(incomingText);
                const resp = await fetch(this.getDataUrl(file.name), { cache: 'no-store' });
                if (!resp.ok) throw new Error('读取项目内同名文件失败');
                const currentData = await resp.json();
                const merged = JSON.parse(JSON.stringify(currentData || {}));
                this.deepMerge(merged, incomingData || {});
                if (!merged.schema_version) {
                    merged.schema_version = this.generateSchemaVersion();
                }
                merged.lastupdate = this.generateLastUpdate();
                const saveResp = await fetch('/save-json', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projectPath: this.currentProject ? this.currentProject.path : 'user',
                        filename: file.name,
                        content: JSON.stringify(merged, null, 2)
                    })
                });
                if (!saveResp.ok) {
                    const text = await saveResp.text();
                    throw new Error(text || '保存失败');
                }
                summary.merged.push(file.name);

                if (this.currentFile === file.name) {
                    this.currentData = merged;
                    this.hasUnsavedChanges = false;
                    delete this.tempDataCache[file.name];
                    this.updateSaveButtonState();
                    this.updateSchemaBadge();
                    this.renderStructuredView();
                    this.renderFlatView();
                    this.setupEditableListeners();
                    this.applyCurrentView();
                }
            } catch (err) {
                console.error('合并 JSON 失败:', file.name, err);
                summary.failed.push({ name: file.name, reason: err.message || '未知错误' });
            }
        }

        const mergedMsg = `合并 ${summary.merged.length} 个文件`;
        const skippedMsg = summary.skipped.length ? `，跳过未匹配 ${summary.skipped.length}` : '';
        const failedMsg = summary.failed.length ? `，失败 ${summary.failed.length}` : '';
        const type = summary.failed.length ? 'error' : (summary.merged.length ? 'success' : 'info');
        this.showNotification(`导入完成：${mergedMsg}${skippedMsg}${failedMsg}`, type);
        if (summary.failed.length) {
            console.warn('JSON 导入失败详情:', summary.failed);
        }
    }

    async createEmptyFilesFromPdfs() {
        try {
            const resp = await fetch('/sync-pdfs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectPath: this.currentProject ? this.currentProject.path : 'user'
                })
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            if (!data.success) throw new Error(data.error || '同步失败');
            const jsonCount = data.createdJson?.length || 0;
            const mdCount = data.createdMd?.length || 0;
            const msg = data.message || '扫描完成';
            this.showNotification(`${msg}：新建 JSON ${jsonCount} 个，MD ${mdCount} 个`, 'success');
            await this.loadFileList();
        } catch (error) {
            console.error('同步 PDF 生成空文件失败:', error);
            this.showNotification(`同步失败: ${error.message}`, 'error');
        }
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
        this.updateJsonMenuState();
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
        if (this.isEditLocked) {
            this.showLockedNotification('调整顺序');
            return null;
        }
        if (!key || offset === 0) return null;
        let parent = this.currentData;
        for (const segment of pathArray) {
            if (segment && parent && typeof parent === 'object') {
                parent = parent[segment];
            }
        }
        if (!parent || typeof parent !== 'object') return null;

        // 数组类型：按索引移动元素
        if (Array.isArray(parent)) {
            const index = parseInt(key, 10);
            if (Number.isNaN(index) || index < 0 || index >= parent.length) return null;
            let targetIndex = index + offset;
            targetIndex = Math.max(0, Math.min(parent.length - 1, targetIndex));
            if (targetIndex === index) return index;
            const [item] = parent.splice(index, 1);
            parent.splice(targetIndex, 0, item);

            this.hasUnsavedChanges = true;
            this.tempDataCache[this.currentFile] = this.currentData;
            this.updateSaveButtonState();
            this.renderStructuredView();
            this.setupEditableListeners();
            this.restoreReorderSelection();
            return targetIndex;
        }

        const keys = Object.keys(parent).filter(k => !k.endsWith('_loc'));
        const index = keys.indexOf(key);
        if (index === -1) return null;

        let targetIndex = index + offset;
        targetIndex = Math.max(0, Math.min(keys.length - 1, targetIndex));
        if (targetIndex === index) return key;

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
        return key;
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
        const headers = document.querySelectorAll('.collapsible-section .collapsible-header');
        const contents = document.querySelectorAll('.collapsible-section .collapsible-content');
        headers.forEach(h => h.classList.toggle('active', !collapsed));
        contents.forEach(c => c.classList.toggle('active', !collapsed));

        // 持久化“已出现的类字段”的折叠状态，便于跨文件复用
        const sections = document.querySelectorAll('.collapsible-section');
        sections.forEach((sec) => {
            const key = sec.dataset.sectionKey;
            if (!key) return;
            this.setSectionExpanded(key, !collapsed);
        });
    }

    setReorderSelection(pathArray, key) {
        this.reorderSelected = { path: [...pathArray], key };
        document.querySelectorAll('.reorder-selected').forEach(el => el.classList.remove('reorder-selected'));
        this.highlightSelectionElement();
    }

    setSelectedItem(item) {
        this.selectedItem = item ? { ...item, path: [...(item.path || [])] } : null;
        this.highlightSelectedItem();
    }

    /**
     * 根据任意子元素找到所在的表格行并选中高亮
     */
    selectRowFromElement(element) {
        if (!element) return;
        const row = element.closest('tr[data-key]');
        const table = row?.closest('table.json-table');
        if (!row || !table) return;
        const tablePath = table.dataset.path ? table.dataset.path.split('.').filter(Boolean) : [];
        const key = row.dataset.key;
        if (!key) return;
        this.setSelectedItem({ type: 'row', path: tablePath, key });
    }

    highlightSelectedItem() {
        document.querySelectorAll('.row-selected').forEach(el => el.classList.remove('row-selected'));
        document.querySelectorAll('.section-selected').forEach(el => el.classList.remove('section-selected'));
        if (!this.selectedItem) return;
        const { type, path, key } = this.selectedItem;
        if (type === 'section') {
            const sectionEl = document.querySelector(`.collapsible-section[data-section-key="${CSS.escape(key)}"]`);
            if (sectionEl) {
                sectionEl.classList.add('section-selected');
            }
        } else if (type === 'row') {
            const tablePath = path.join('.');
            const rowEl = document.querySelector(`table.json-table[data-path="${CSS.escape(tablePath)}"] tr[data-key="${CSS.escape(key)}"]`);
            if (rowEl) {
                rowEl.classList.add('row-selected');
                const sectionEl = rowEl.closest('.collapsible-section');
                if (sectionEl) {
                    sectionEl.classList.add('section-selected');
                }
            }
        }
    }

    moveSelectedItem(offset) {
        if (this.isEditLocked) {
            this.showLockedNotification('调整顺序');
            return;
        }
        if (!this.selectedItem || !offset) return;
        if (this.selectedItem.type === 'row') {
            const pathArr = [...(this.selectedItem.path || [])];
            const key = this.selectedItem.key;
            const newKey = this.moveKey(pathArr, key, offset);
            // 保持选中
            const nextKey = (typeof newKey === 'number') ? String(newKey) : (newKey || key);
            this.setSelectedItem({ type: 'row', path: pathArr, key: nextKey });
            setTimeout(() => this.highlightSelectedItem(), 0);
        } else if (this.selectedItem.type === 'section') {
            const key = this.selectedItem.key;
            this.moveSection(key, offset);
            this.setSelectedItem({ type: 'section', path: [], key });
            setTimeout(() => this.highlightSelectedItem(), 0);
        }
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

    moveSection(key, offset) {
        if (this.isEditLocked) {
            this.showLockedNotification('调整顺序');
            return;
        }
        if (!key || !this.currentData) return;
        const keys = Object.keys(this.currentData).filter(k => !k.endsWith('_loc') && k !== 'schema_version' && k !== 'lastupdate');
        const idx = keys.indexOf(key);
        if (idx === -1) return;
        let target = idx + offset;
        target = Math.max(0, Math.min(keys.length - 1, target));
        if (target === idx) return;
        keys.splice(idx, 1);
        keys.splice(target, 0, key);
        const newObj = {};
        keys.forEach(k => {
            newObj[k] = this.currentData[k];
            const locKey = k + '_loc';
            if (this.currentData.hasOwnProperty(locKey)) {
                newObj[locKey] = this.currentData[locKey];
            }
        });
        // append remaining fields such as schema_version / lastupdate
        Object.keys(this.currentData).forEach(k => {
            if (!newObj.hasOwnProperty(k)) newObj[k] = this.currentData[k];
        });
        Object.keys(this.currentData).forEach(k => delete this.currentData[k]);
        Object.entries(newObj).forEach(([k, v]) => {
            this.currentData[k] = v;
        });
        this.hasUnsavedChanges = true;
        if (this.currentFile) this.tempDataCache[this.currentFile] = this.currentData;
        this.updateSaveButtonState();
        this.renderStructuredView();
        this.setupEditableListeners();
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

    async copyChatgptAideSource() {
        try {
            const response = await fetch('/chatgptAide.js');
            if (!response.ok) throw new Error(`读取失败: ${response.statusText}`);
            const text = await response.text();
            await this.writeTextToClipboard(text);
            this.showNotification('已复制 chatgptAide.js 源码到剪贴板', 'success');
        } catch (error) {
            console.error('复制 chatgptAide.js 失败:', error);
            this.showNotification(`复制失败: ${error.message}`, 'error');
        }
    }

    async goToJsonSource() {
        await this.switchToView('flat');
    }

    async goToMarkdownSource() {
        await this.switchToView('markdown');
        if (!this.currentFile) {
            this.showNotification('请选择文件后查看 Markdown 源码', 'info');
            return;
        }
        if (!this.currentMarkdownExists) {
            try {
                await this.createMarkdownFile();
            } catch (_err) {}
        }
        if (!this.currentMarkdownExists) {
            this.showNotification('未找到同名 Markdown', 'info');
            return;
        }
        this.toggleMarkdownEdit(true);
        const mdTextarea = document.getElementById('markdownTextarea');
        if (mdTextarea) mdTextarea.focus();
    }

    async toggleJsonMdSource() {
        const view = this.currentView || 'structured';
        if (view === 'flat') {
            await this.goToMarkdownSource();
            return;
        }
        if (view === 'markdown') {
            if (this.isMarkdownEditing) {
                await this.goToJsonSource();
            } else {
                await this.goToMarkdownSource();
            }
            return;
        }
        await this.goToJsonSource();
    }

    toggleMdMenu(forceVisible) {
        const menu = document.getElementById('mdMenu');
        if (!menu) return;
        const next = typeof forceVisible === 'boolean' ? forceVisible : !this.mdMenuVisible;
        if (next) this.closeHeaderMenus('md');
        this.mdMenuVisible = next;
        menu.classList.toggle('visible', next);
    }

    toggleSettingsMenu(forceVisible) {
        const menu = document.getElementById('settingsMenu');
        if (!menu) return;
        const next = typeof forceVisible === 'boolean' ? forceVisible : !this.settingsMenuVisible;
        if (next) this.closeHeaderMenus('settings');
        this.settingsMenuVisible = next;
        menu.classList.toggle('visible', next);
    }

    toggleJsonMenu(forceVisible) {
        const menu = document.getElementById('jsonMenu');
        if (!menu) return;
        const next = typeof forceVisible === 'boolean' ? forceVisible : !this.jsonMenuVisible;
        if (next) this.closeHeaderMenus('json');
        this.jsonMenuVisible = next;
        menu.classList.toggle('visible', next);
    }

    toggleEditLock(forceLocked) {
        const next = typeof forceLocked === 'boolean' ? forceLocked : !this.isEditLocked;
        this.isEditLocked = next;
        this.persistEditLockState();
        this.applyEditLockState();
        this.showNotification(next ? '编辑已锁定' : '编辑已解锁', next ? 'info' : 'success');
    }

    applyEditLockState() {
        const lockBtn = document.getElementById('editLockToggleBtn');
        if (lockBtn) {
            lockBtn.classList.toggle('active', this.isEditLocked);
            const icon = lockBtn.querySelector('i');
            if (icon) icon.className = this.isEditLocked ? 'fas fa-lock' : 'fas fa-lock-open';
            lockBtn.title = this.isEditLocked ? '编辑已锁定' : '编辑未锁定';
            lockBtn.setAttribute('aria-pressed', String(this.isEditLocked));
        }
        const jsonTextarea = document.getElementById('jsonEditorTextarea');
        if (jsonTextarea) {
            jsonTextarea.readOnly = this.isEditLocked;
            jsonTextarea.classList.toggle('locked', this.isEditLocked);
        }
        const mdTextarea = document.getElementById('markdownTextarea');
        if (mdTextarea) {
            mdTextarea.readOnly = this.isEditLocked;
            mdTextarea.classList.toggle('locked', this.isEditLocked);
        }
        const addSectionBtn = document.getElementById('addSectionBtn');
        if (addSectionBtn) {
            addSectionBtn.disabled = this.isEditLocked;
        }
        this.updateJsonMenuState();
        this.updateMarkdownMenuState();
    }

    showLockedNotification(action = '操作') {
        this.showNotification(`已锁定，无法${action}`, 'info');
    }

    async handleSaveShortcut() {
        if (this.isEditLocked) {
            this.showLockedNotification('保存');
            return;
        }
        const view = this.currentView || 'structured';
        if (view === 'markdown') {
            if (!this.currentMarkdownExists) return;
            if (this.isMarkdownEditing) {
                await this.saveMarkdownFromEditor();
            } else if (this.hasUnsavedMarkdownChanges) {
                await this.saveCurrentMarkdownSilently();
                this.renderMarkdownView(this.currentMarkdownText || '');
            }
            return;
        }

        // JSON 视图
        if (view === 'flat') {
            const ok = this.applyRawJsonFromTextarea({ notifyOnError: true });
            if (!ok) return;
        }
        if (this.hasUnsavedChanges) {
            await this.saveToFile();
            this.renderStructuredView();
            this.renderFlatView();
        }
    }

    toggleFileFilter(forceVisible) {
        const box = document.getElementById('fileFilterContainer');
        const btn = document.getElementById('fileFilterToggleBtn');
        const input = document.getElementById('fileFilterInput');
        const next = typeof forceVisible === 'boolean' ? forceVisible : !this.fileFilterVisible;
        this.fileFilterVisible = next;
        if (box) box.classList.toggle('visible', next);
        if (btn) btn.classList.toggle('active', next);
        if (next && input) {
            setTimeout(() => input.focus({ preventScroll: true }), 0);
        }
    }

    closeHeaderMenus(except = '') {
        const keep = String(except || '').toLowerCase();
        if (keep !== 'json' && this.jsonMenuVisible) this.toggleJsonMenu(false);
        if (keep !== 'md' && this.mdMenuVisible) this.toggleMdMenu(false);
        if (keep !== 'settings' && this.settingsMenuVisible) this.toggleSettingsMenu(false);
        if (keep !== 'prompt' && this.promptPanelVisible) this.togglePromptPanel(false, { skipClose: true });
        if (keep !== 'info' && this.projectInfoVisible) this.toggleProjectInfoPanel(false, { skipClose: true });
        if (keep !== 'shortcuts' && this.shortcutsVisible) this.toggleShortcutsPanel(false, { skipClose: true });
    }

    applyRawJsonFromTextarea(opts = {}) {
        const notifyOnError = !!opts.notifyOnError;
        const textarea = document.getElementById('jsonEditorTextarea');
        if (!textarea) return false;
        const text = textarea.value;
        try {
            const parsed = JSON.parse(text);
            this.rawJsonParseOk = true;
            this.rawJsonParseError = '';
            const currentText = this.currentData ? JSON.stringify(this.currentData, null, 2) : '';
            const isSameAsCurrent = (String(text || '').trim() === String(currentText || '').trim());
            if (!isSameAsCurrent) {
                this.currentData = parsed;
                this.hasUnsavedChanges = true;
                if (this.currentFile) {
                    this.tempDataCache[this.currentFile] = this.currentData;
                }
            }
            this.updateSaveButtonState();
            return true;
        } catch (err) {
            this.rawJsonParseOk = false;
            this.rawJsonParseError = err?.message ? String(err.message) : '解析失败';
            this.updateSaveButtonState();
            if (notifyOnError) this.showNotification(`JSON 解析失败: ${this.rawJsonParseError}`, 'error');
            return false;
        }
    }

    updateJsonMenuState() {
        const dropdown = document.getElementById('jsonMenuDropdown');
        const structuredItem = document.getElementById('jsonViewStructuredItem');
        const flatItem = document.getElementById('jsonViewFlatItem');
        const formatItem = document.getElementById('jsonFormatItem');
        const saveItem = document.getElementById('jsonSaveItem');
        if (!dropdown || !structuredItem || !flatItem || !formatItem || !saveItem) return;

        const hasFile = !!this.currentFile;
        dropdown.style.display = 'inline-flex';
        const view = this.currentView || 'structured';
        structuredItem.disabled = view === 'structured';
        flatItem.disabled = view === 'flat';
        formatItem.disabled = !(hasFile && view === 'flat');
        const inFlat = view === 'flat';
        const canSave = hasFile && this.hasUnsavedChanges && (!inFlat || this.rawJsonParseOk);
        saveItem.disabled = !canSave;
        if (!hasFile && this.jsonMenuVisible) this.toggleJsonMenu(false);
    }

    updateMarkdownMenuState() {
        const dropdown = document.getElementById('mdMenuDropdown');
        const renderItem = document.getElementById('mdRenderItem');
        const sourceItem = document.getElementById('mdSourceItem');
        const saveItem = document.getElementById('mdSaveItem');
        if (!dropdown || !renderItem || !sourceItem || !saveItem) return;

        const hasFile = !!this.currentFile;
        dropdown.style.display = 'inline-flex';
        if (!hasFile && this.mdMenuVisible) this.toggleMdMenu(false);

        const inMarkdownView = (this.currentView || 'structured') === 'markdown';
        renderItem.disabled = !hasFile || (inMarkdownView && !this.isMarkdownEditing);
        sourceItem.disabled = !hasFile || (inMarkdownView && this.isMarkdownEditing) || !this.currentMarkdownExists;
        saveItem.disabled = !hasFile || !inMarkdownView || !this.currentMarkdownExists || !this.hasUnsavedMarkdownChanges;
    }

    updateAutoLoadMenuState() {
        const onItem = document.getElementById('autoLoadOnItem');
        const offItem = document.getElementById('autoLoadOffItem');
        if (onItem) onItem.classList.toggle('checked', !!this.autoLoadPdf);
        if (offItem) offItem.classList.toggle('checked', !this.autoLoadPdf);
    }

    async loadPromptShortcuts() {
        try {
            const response = await fetch('/prompt-files');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            this.promptGroups = this.normalizePromptGroups(data);
            this.promptDataLoaded = true;

            this.renderPromptShortcuts();
        } catch (error) {
            console.error('加载 prompt 文件失败:', error);
            // fallback: 尝试从静态 manifest 读取
            const ok = await this.loadPromptManifestFallback();
            if (!ok) {
                this.showNotification(`加载 prompt 列表失败: ${error.message}`, 'error');
            }
        }
    }

    async loadPromptManifestFallback() {
        try {
            const tryFetch = async (url) => {
                const resp = await fetch(url);
                if (!resp.ok) return null;
                const data = await resp.json();
                return data;
            };
            let data = await tryFetch('/manifest.json');
            if (!data || typeof data !== 'object') return false;
            this.promptGroups = this.normalizePromptGroups(data);
            this.promptDataLoaded = true;
            this.renderPromptShortcuts();
            this.showNotification('使用静态 manifest 加载成功', 'info');
            return true;
        } catch (err) {
            console.error('加载静态 prompt 清单失败:', err);
            return false;
        }
    }

    renderPromptShortcuts() {
        const container = document.getElementById('promptGroupsContainer');
        if (!container) return;
        container.innerHTML = '';

        const keys = Object.keys(this.promptGroups || {}).sort();
        if (!keys.length) {
            const empty = document.createElement('div');
            empty.className = 'prompt-empty';
            empty.textContent = '未找到 prompt 目录';
            container.appendChild(empty);
            return;
        }

        keys.forEach((key) => {
            const groupEl = document.createElement('div');
            groupEl.className = 'prompt-group';
            const info = this.promptGroups[key] || {};
            const label = document.createElement('div');
            label.className = 'prompt-group-label';
            label.textContent = info.label || key;
            groupEl.appendChild(label);

            const row = document.createElement('div');
            row.className = 'prompt-button-row';
            row.dataset.groupKey = key;
            groupEl.appendChild(row);

            container.appendChild(groupEl);
            this.renderPromptRow(row, key);
        });
    }

    renderPromptRow(container, groupKey) {
        if (!container) return;
        container.innerHTML = '';

        const groupData = this.promptGroups[groupKey] || {};
        const files = groupData?.files || [];
        const activeFile = (this.promptSelectedByGroup && this.promptSelectedByGroup[groupKey]) ? this.promptSelectedByGroup[groupKey] : '';
        if (!files.length) {
            const empty = document.createElement('span');
            empty.className = 'prompt-empty';
            empty.textContent = '无文件';
            container.appendChild(empty);
            return;
        }

        files.forEach((file) => {
            const btn = document.createElement('button');
            btn.className = 'prompt-chip';
            btn.textContent = file.replace(/\.[^/.]+$/, '');
            btn.title = file;
            btn.dataset.file = file;
            const isActive = activeFile && activeFile === file;
            if (isActive) btn.classList.add('active');
            btn.setAttribute('aria-pressed', String(!!isActive));
            btn.addEventListener('click', () => {
                this.setPromptActive(groupKey, file);
                this.copyPromptFile(groupKey, file);
            });
            container.appendChild(btn);
        });
    }

    togglePromptPanel(forceVisible, opts = {}) {
        const panel = document.getElementById('promptQuickPanel');
        if (!panel) return;
        if (!this.promptDataLoaded) {
            this.loadPromptShortcuts();
        }
        const nextState = typeof forceVisible === 'boolean' ? forceVisible : !this.promptPanelVisible;
        if (nextState && !opts.skipClose) {
            this.closeHeaderMenus('prompt');
        }
        this.promptPanelVisible = nextState;
        if (nextState) {
            this.applyPromptPanelPos();
        }
        panel.classList.toggle('visible', nextState);
    }

    async toggleProjectInfoPanel(forceVisible, opts = {}) {
        const panel = document.getElementById('projectInfoPanel');
        const body = document.getElementById('projectInfoBody');
        if (!panel || !body) return;
        const next = typeof forceVisible === 'boolean' ? forceVisible : !this.projectInfoVisible;
        if (next && !opts.skipClose) this.closeHeaderMenus('info');
        this.projectInfoVisible = next;
        panel.classList.toggle('visible', next);
        if (next && !this.projectInfoLoaded) {
            body.textContent = '加载中...';
            try {
                const res = await fetch('/js-info.md');
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const text = await res.text();
                const parser = this.getMarkdownParser();
                body.innerHTML = parser ? parser.render(text) : text;
                this.applyProjectInfoIcons(body);
                this.projectInfoLoaded = true;
            } catch (err) {
                console.error('加载项目说明失败', err);
                body.textContent = `加载失败: ${err.message}`;
            }
        }
    }

    async toggleShortcutsPanel(forceVisible, opts = {}) {
        const panel = document.getElementById('shortcutsInfoPanel');
        const body = document.getElementById('shortcutsInfoBody');
        if (!panel || !body) return;
        const next = typeof forceVisible === 'boolean' ? forceVisible : !this.shortcutsVisible;
        if (next && !opts.skipClose) this.closeHeaderMenus('shortcuts');
        this.shortcutsVisible = next;
        panel.classList.toggle('visible', next);
        if (next && !this.shortcutsLoaded) {
            body.textContent = '加载中...';
            try {
                const res = await fetch('/shortcuts.md');
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const text = await res.text();
                const parser = this.getMarkdownParser();
                body.innerHTML = parser ? parser.render(text) : text;
                this.shortcutsLoaded = true;
            } catch (err) {
                console.error('加载快捷键说明失败', err);
                body.textContent = `加载失败: ${err.message}`;
            }
        }
    }

    normalizePromptGroups(raw) {
        if (!raw) return {};
        if (raw.groups && typeof raw.groups === 'object') return raw.groups;
        const src = raw.src || {};
        const groups = {};
        Object.keys(src).forEach((category) => {
            const catGroups = src[category] || {};
            Object.entries(catGroups).forEach(([name, info]) => {
                if (!info || !Array.isArray(info.files)) return;
                const key = `${category}:${name}`;
                const base = info.basePath || `/src/${category}/${name}/`;
                const basePath = base.endsWith('/') ? base : `${base}/`;
                groups[key] = {
                    files: info.files,
                    basePath,
                    category,
                    name,
                    label: info.label || `${category} / ${name}`
                };
            });
        });
        return groups;
    }

    applyPromptPanelPos() {
        const panel = document.getElementById('promptQuickPanel');
        if (!panel) return;
        const pos = this.promptPanelPos;
        if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') {
            panel.style.left = `${pos.left}px`;
            panel.style.top = `${pos.top}px`;
            panel.style.transform = 'translate(0, 0)';
        } else {
            panel.style.left = '50%';
            panel.style.top = '10px';
            panel.style.transform = 'translateX(-50%)';
        }
    }

    bindPromptPanelDrag() {
        const panel = document.getElementById('promptQuickPanel');
        const header = document.querySelector('#promptQuickPanel .prompt-quick-header');
        if (!panel || !header) return;
        let dragging = false;
        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let startTop = 0;

        const onMouseMove = (e) => {
            if (!dragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            const left = startLeft + dx;
            const top = startTop + dy;
            panel.style.left = `${left}px`;
            panel.style.top = `${top}px`;
            panel.style.transform = 'translate(0, 0)';
        };

        const onMouseUp = () => {
            if (!dragging) return;
            dragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            const rect = panel.getBoundingClientRect();
            this.promptPanelPos = { left: rect.left, top: rect.top };
            this.savePromptPanelPos(this.promptPanelPos);
        };

        header.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            dragging = true;
            const rect = panel.getBoundingClientRect();
            startX = e.clientX;
            startY = e.clientY;
            startLeft = rect.left;
            startTop = rect.top;
            panel.style.transform = 'translate(0, 0)';
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    async copyPromptFile(groupKey, file) {
        try {
            const params = new URLSearchParams({ group: groupKey, file });
            const response = await fetch(`/prompt-file?${params.toString()}`);
            if (!response.ok) throw new Error(`读取失败 (${response.status})`);
            const text = await response.text();
            await this.writeTextToClipboard(text);
            this.showNotification(`${file || '文件'} 已复制到剪贴板`, 'success');
        } catch (error) {
            console.warn('API 复制失败，尝试静态读取:', error);
            const fallbackOk = await this.copyPromptFileStatic(groupKey, file);
            if (!fallbackOk) {
                console.error('复制 prompt 失败:', error);
                this.showNotification(`复制失败: ${error.message}`, 'error');
            }
        }
    }

    async copyPromptFileStatic(groupKey, file) {
        try {
            const groupData = this.promptGroups[groupKey] || {};
            const base = groupData.basePath || `/src/prompts/${groupData.name || groupKey}/`;
            const url = `${base}${file}`;
            const response = await fetch(url);
            if (!response.ok) return false;
            const text = await response.text();
            await this.writeTextToClipboard(text);
            this.showNotification(`${file || '文件'} 已复制到剪贴板 (静态)`, 'success');
            return true;
        } catch (err) {
            console.error('静态复制失败:', err);
            return false;
        }
    }

    async writeTextToClipboard(text) {
        // 优先用异步剪贴板，失败则回退到 execCommand
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                return;
            } catch (err) {
                console.warn('navigator.clipboard 写入失败，改用回退方案:', err);
            }
        }

        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const ok = document.execCommand('copy');
        textarea.remove();
        if (!ok) throw new Error('回退复制失败');
    }

    renderFlatView() {
        const container = document.getElementById('flatView');
        if (!container) return;
        container.innerHTML = `
            <div class="flat-editor">
                <textarea id="jsonEditorTextarea" spellcheck="false"></textarea>
            </div>
        `;

        const textarea = document.getElementById('jsonEditorTextarea');
        if (textarea) {
            textarea.value = JSON.stringify(this.currentData, null, 2);
            textarea.addEventListener('input', () => {
                if (this.isEditLocked) {
                    this.showLockedNotification('编辑 JSON');
                    textarea.value = JSON.stringify(this.currentData, null, 2);
                    return;
                }
                if (this.rawJsonParseTimer) {
                    clearTimeout(this.rawJsonParseTimer);
                    this.rawJsonParseTimer = null;
                }
                this.rawJsonParseTimer = setTimeout(() => {
                    this.applyRawJsonFromTextarea({ notifyOnError: false });
                }, 350);
            });
            // 初次渲染时同步一次解析状态
            this.applyRawJsonFromTextarea({ notifyOnError: false });
            this.applyEditLockState();
        }
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
            if (window.markdownItGithubAlerts) {
                md.use(window.markdownItGithubAlerts);
            }
            // 支持 goto{...} 内联跳转图标 & cite/citep 渲染占位
            const gotoPlugin = (mdInstance) => {
                const defaultText = mdInstance.renderer.rules.text || ((tokens, idx) => md.utils.escapeHtml(tokens[idx].content));
                const renderMathText = (txt = '') => {
                    const re = /\\\[[\s\S]+?\\\]|\$\$[\s\S]+?\$\$|\\\([\s\S]+?\\\)|\$(?!\s)[^$]+?\$(?!\d)/g;
                    let out = '';
                    let last = 0;
                    let m;
                    while ((m = re.exec(txt)) !== null) {
                        if (m.index > last) {
                            out += md.utils.escapeHtml(txt.slice(last, m.index));
                        }
                        const raw = m[0];
                        const isDisplay = raw.startsWith('\\[') || raw.startsWith('$$');
                        out += `<span class="math-${isDisplay ? 'display' : 'inline'}">${raw}</span>`;
                        last = re.lastIndex;
                    }
                    if (last < txt.length) {
                        out += md.utils.escapeHtml(txt.slice(last));
                    }
                    return out;
                };
                const hasMath = (s = '') => /\\\(|\\\[|\$\$|\$(?!\s)/.test(s);
                const citeRe = /(citep?\{[^}]+\})/g;
                const renderCitations = (txt = '') => {
                    let out = '';
                    let last = 0;
                    let m;
                    while ((m = citeRe.exec(txt)) !== null) {
                        if (m.index > last) {
                            out += renderMathText(txt.slice(last, m.index));
                        }
                        const raw = m[0];
                        const isP = raw.startsWith('citep');
                        const inside = raw.slice(raw.indexOf('{') + 1, -1);
                        const dois = inside.split(/[,，;]+/).map(d => d.trim()).filter(Boolean);
                        const app = window.paperReviewerApp;
                        out += app?.renderCitationPlaceholder(dois, isP ? 'citep' : 'cite') || md.utils.escapeHtml(raw);
                        last = citeRe.lastIndex;
                    }
                    if (last < txt.length) {
                        out += renderMathText(txt.slice(last));
                    }
                    return out;
                };
                mdInstance.renderer.rules.text = (tokens, idx, options, env, self) => {
                    const token = tokens[idx];
                    const content = token.content || '';
                    const containsGoto = content.includes('goto{');
                    const containsCitation = /citep?\{/.test(content);
                    const containsMath = hasMath(content);
                    if (!containsGoto && !containsMath && !containsCitation) return defaultText(tokens, idx, options, env, self);
                    const segments = containsGoto ? content.split(/(goto\{[^}]+\})/g).filter(Boolean) : [content];
                    const rendered = segments.map(seg => {
                        const match = seg.match(/^goto\{([^}]+)\}$/);
                        if (match) {
                            const q = match[1].trim();
                            if (!q) return md.utils.escapeHtml(seg);
                            const esc = md.utils.escapeHtml(q).replace(/`/g, '&#96;');
                            return `<a href="#" class="location-link goto-link" data-page="" data-quote-text="${esc}" data-open-params="" data-quote-index="0" data-value-path="" title="跳转PDF搜索"><i class="fa-solid fa-quote-right"></i></a>`;
                        }
                        return renderCitations(seg);
                    }).join('');
                    return rendered;
                };
            };
            md.use(gotoPlugin);
            // contentReference inline渲染
            const contentRefPlugin = (mdInstance) => {
                mdInstance.core.ruler.after('inline', 'content-ref', (state) => {
                    const re = /:contentReference\[(.+?)\]\{index=(\d+)\}/g;
                    state.tokens.forEach((blk) => {
                        if (blk.type !== 'inline' || !blk.children) return;
                        const newChildren = [];
                        blk.children.forEach((child) => {
                            if (child.type !== 'text') {
                                newChildren.push(child);
                                return;
                            }
                            const text = child.content;
                            let lastIndex = 0;
                            let m;
                            while ((m = re.exec(text)) !== null) {
                                if (m.index > lastIndex) {
                                    const t = new state.Token('text', '', 0);
                                    t.content = text.slice(lastIndex, m.index);
                                    newChildren.push(t);
                                }
                                // Skip rendering :contentReference[...] completely (output empty)
                                lastIndex = re.lastIndex;
                            }
                            if (lastIndex < text.length) {
                                const t = new state.Token('text', '', 0);
                                t.content = text.slice(lastIndex);
                                newChildren.push(t);
                            }
                        });
                        blk.children = newChildren;
                    });
                });
            };
            md.use(contentRefPlugin);
            // 自定义 QA / goto 代码块渲染
            const qaPlugin = (mdInstance) => {
                const defaultFence = mdInstance.renderer.rules.fence || mdInstance.renderer.renderToken;
                const escapeHtml = (str = '') => str
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
                const escapeAttr = (str = '') => escapeHtml(str).replace(/`/g, '&#96;');

                const parseQaContent = (content = '') => {
                    const lines = content.split('\n');
                    const items = [];
                    let current = null;
                    let mode = null; // 'q' | 'a' | 'cite'

                    const parseCites = (rawLines = []) => {
                        const rawText = rawLines.join('\n').trim();
                        if (!rawText) return { cites: [], rawText: '' };
                        let normalized = rawText
                            .replace(/[\u201c\u201d]/g, '"')
                            .replace(/[\u2018\u2019]/g, "'")
                            .replace(/：/g, ':')
                            .replace(/，/g, ',')
                            .replace(/,\s*([}\]])/g, '$1');
                        // 补全未带引号的键
                        normalized = normalized.replace(/([A-Za-z0-9_]+)\s*:/g, '"$1":');
                        const tryParse = (txt) => {
                            try {
                                return JSON.parse(txt);
                            } catch (_err) {
                                return null;
                            }
                        };
                        let parsed = tryParse(normalized);
                        if (!parsed) {
                            // 如果缺少数组包裹，尝试包裹 []
                            parsed = tryParse(`[${normalized}]`);
                        }
                        if (parsed && !Array.isArray(parsed)) parsed = [parsed];
                        if (!parsed || !Array.isArray(parsed)) {
                            console.warn('QA cite parse failed, raw:', rawText);
                            return { cites: [], rawText };
                        }
                        return { cites: parsed, rawText };
                    };

                const flush = () => {
                    if (current && current.q) {
                            if (current.a) current.a = current.a.replace(/,+\s*$/, '').trim();
                            const parsed = parseCites(current.citeRaw);
                            current.cites = parsed.cites;
                            current.citeRawText = parsed.rawText;
                            delete current.citeRaw;
                            items.push(current);
                        }
                        current = null;
                        mode = null;
                    };

                    for (const raw of lines) {
                        const line = raw.trim();
                        if (!line || line === '{' || line === '}') continue;
                        if (/^---+$/.test(line)) {
                            flush();
                            continue;
                        }

                        const qMatch = line.match(/^q\d*\s*:\s*(.*)$/i);
                        const aMatch = line.match(/^a\d*\s*:\s*(.*)$/i);
                        const citeMatch = line.match(/^cite\s*:\s*(.*)$/i);
                        if (qMatch) {
                            flush();
                            current = { q: qMatch[1] || '', a: '', citeRaw: [] };
                            mode = 'q';
                            continue;
                        }
                        if (aMatch) {
                            if (!current) current = { q: '', a: '', citeRaw: [] };
                            current.a = aMatch[1] || '';
                            mode = 'a';
                            continue;
                        }
                        if (citeMatch) {
                            if (!current) current = { q: '', a: '', citeRaw: [] };
                            mode = 'cite';
                            const rest = citeMatch[1] || '';
                            if (rest) current.citeRaw.push(rest);
                            continue;
                        }

                        if (current && mode === 'q') {
                            current.q = `${current.q}\n${line}`;
                        } else if (current && mode === 'a') {
                            current.a = `${current.a}\n${line}`;
                        } else if (current && mode === 'cite') {
                            current.citeRaw.push(raw);
                        }
                    }
                    flush();
                    return items;
                };

                mdInstance.renderer.rules.fence = (tokens, idx, options, env, self) => {
                    const token = tokens[idx];
                    const infoRaw = (token.info || '').trim();
                    const infoLower = infoRaw.toLowerCase();
                    if (infoLower === 'goto') {
                        const q = token.content.trim();
                        if (!q) return '';
                        const esc = escapeAttr(q);
                        return `<div class="goto-block"><a href="#" class="location-link goto-link" data-page="" data-quote-text="${esc}" data-open-params="" data-quote-index="0" data-value-path="" title="跳转PDF搜索"><i class="fa-solid fa-quote-right"></i>${escapeHtml(q)}</a></div>`;
                    }
                    // 避免嵌套渲染导致递归
                    if (env && env.__qaRendering) {
                        return defaultFence(tokens, idx, options, env, self);
                    }
                    if (infoLower.startsWith('qa')) {
                        const infoTitleMatch = infoRaw.match(/^qa@(.+)$/i);
                        const qaTitle = (infoTitleMatch ? infoTitleMatch[1] : 'Q&A').trim() || 'Q&A';
                        const items = parseQaContent(token.content || '');
                        if (!items.length) return '';
                        const renderBlock = (text) => mdInstance.render(text, { ...(env || {}), __qaRendering: true });
                        const renderSectioned = (raw = '') => {
                            const lines = (raw || '').split('\n');
                            const sections = [];
                            let cur = { title: null, body: [] };
                            const pushCur = () => {
                                if (cur.title !== null || cur.body.length) sections.push(cur);
                                cur = { title: null, body: [] };
                            };
                            lines.forEach((line) => {
                                const m = line.match(/^\s*\[(.+?)\]\s*$/);
                                if (m) {
                                    pushCur();
                                    cur.title = m[1].trim();
                                } else {
                                    cur.body.push(line);
                                }
                            });
                            pushCur();
                            const hasSectionTitle = sections.some(s => s.title);
                            if (!hasSectionTitle || (sections.length === 1 && !sections[0].title)) {
                                return renderBlock(raw);
                            }
                            return sections.map((section, idxSection) => {
                                const title = section.title || `Section ${idxSection + 1}`;
                                const bodyText = (section.body || []).join('\n').trim();
                                const bodyHtml = bodyText ? renderBlock(bodyText) : '';
                                return `
                                    <div class="qa-section">
                                        <div class="qa-section-header">
                                            <button class="qa-section-toggle" type="button" aria-expanded="true" title="Click to toggle section">
                                                <i class="fas fa-chevron-up"></i>
                                            </button>
                                            <span class="qa-section-title">${escapeHtml(title)}</span>
                                        </div>
                                        <div class="qa-section-body">${bodyHtml}</div>
                                    </div>
                                `;
                            }).join('');
                        };
                        const inner = items.map(({ q, a }, i) => {
                            return `
                                <div class="qa-item">
                                    <div class="qa-q"><span class="qa-label qa-label-q" title="Question"><i class="fa-solid fa-circle-question"></i></span><div class="qa-bubble">${renderSectioned(q)}</div></div>
                                    <div class="qa-a"><span class="qa-label qa-label-a" title="Answer"><i class="fa-solid fa-circle-check"></i></span><div class="qa-bubble">${renderSectioned(a)}</div></div>
                                </div>
                            `;
                        }).join('');
                        return `
                            <div class="qa-block" data-collapsible="qa">
                                <div class="qa-block-header">
                                    <button class="qa-toggle" type="button" aria-expanded="true" title="Click to toggle. Hold Shift to toggle all QAs on page.">
                                        <i class="fas fa-chevron-up"></i>
                                    </button>
                                    <span class="qa-title" data-qa-index="${idx}" data-qa-title="${escapeAttr(qaTitle)}">${escapeHtml(qaTitle)}</span>
                                </div>
                                <div class="qa-items">${inner}</div>
                            </div>
                        `;
                    }
                    return defaultFence(tokens, idx, options, env, self);
                };
            };
            md.use(qaPlugin);
            this.markdownParser = md;
        }
        return this.markdownParser;
    }

    applyProjectInfoIcons(rootEl) {
        if (!rootEl || !rootEl.querySelectorAll) return;
        rootEl.querySelectorAll('li').forEach((li) => {
            if (li.dataset.iconized === '1') return;
            const icon = document.createElement('i');
            icon.className = 'fa-brands fa-node-js';
            icon.style.marginRight = '6px';
            icon.style.fontSize = '16px';
            icon.setAttribute('aria-hidden', 'true');
            li.insertBefore(icon, li.firstChild);
            li.dataset.iconized = '1';
        });
    }

    tryHandleMarkdownQaPasteRendered(pastedText) {
        if (!pastedText || !this.currentMarkdownExists) return false;
        const qaMatch = pastedText.match(/```qa[\s\S]*?```/i);
        if (!qaMatch) return false;

        // 如果 qa fence 已携带 @title，则直接使用，不弹窗
        let heading = '';
        let hasInlineTitle = false;
        const fenceLine = qaMatch[0].match(/```qa([^\n]*)/i);
        if (fenceLine && fenceLine[1]) {
            const inline = fenceLine[1].trim();
            const atMatch = inline.match(/^@(.+)$/);
            heading = (atMatch ? atMatch[1] : inline).trim();
            hasInlineTitle = !!heading;
        }

        if (!heading) {
            const title = prompt('检测到 QA 代码块，输入标题（可留空）：', 'Q&A');
            if (title === null) return true; // 用户取消
            heading = (title || '').trim();
        }

        let snippet = '';
        if (hasInlineTitle) {
            // 保留原有 fence（包含 @ 信息），不额外添加 heading
            const rawBlock = qaMatch[0].trim();
            snippet = `${this.currentMarkdownText?.trimEnd() || ''}\n\n${rawBlock}\n`;
        } else {
            const qaContent = qaMatch[0]
                .replace(/^```qa[^\n]*\n?/i, '')
                .replace(/```$/i, '')
                .trim();
            snippet = `${this.currentMarkdownText?.trimEnd() || ''}\n\n${heading ? `### ${heading}\n` : ''}\`\`\`qa\n${qaContent}\n\`\`\`\n`;
        }

        // 备份以便撤销
        this.lastMarkdownPasteBackup = {
            file: this.currentFile,
            content: this.currentMarkdownText || ''
        };

        this.currentMarkdownText = snippet;
        this.hasUnsavedMarkdownChanges = this.currentMarkdownText !== (this.currentMarkdownBaselineText || '');
        this.pendingQaTitle = hasInlineTitle ? null : { file: this.currentFile, title: heading || 'Q&A' };
        const textarea = document.getElementById('markdownTextarea');
        if (textarea) {
            textarea.value = this.currentMarkdownText;
        }
        this.renderMarkdownView(this.currentMarkdownText);
        this.updateMarkdownToolbar();
        this.updateMarkdownDirtyUI();
        this.showNotification('已追加 QA 片段，记得保存 Markdown', 'success');
        return true;
    }

    undoLastMarkdownPaste() {
        if (!this.lastMarkdownPasteBackup || this.lastMarkdownPasteBackup.file !== this.currentFile) {
            this.showNotification('没有可撤销的 Markdown 粘贴', 'info');
            return;
        }
        this.currentMarkdownText = this.lastMarkdownPasteBackup.content;
        this.hasUnsavedMarkdownChanges = this.currentMarkdownText !== (this.currentMarkdownBaselineText || '');
        const textarea = document.getElementById('markdownTextarea');
        if (textarea) {
            textarea.value = this.currentMarkdownText;
        }
        this.renderMarkdownView(this.currentMarkdownText);
        this.updateMarkdownToolbar();
        this.updateMarkdownDirtyUI();
        this.lastMarkdownPasteBackup = null;
        this.showNotification('已撤销上次 QA 粘贴', 'success');
    }

    getMarkdownFilename(jsonFilename) {
        if (!jsonFilename) return '';
        return jsonFilename.replace(/\.json$/i, '') + '.md';
    }

    getDataUrl(filename) {
        const projectPath = this.currentProject ? this.currentProject.path : 'user';
        const segments = `${projectPath}/data/${filename}`.split('/').filter(Boolean).map(encodeURIComponent);
        return `/${segments.join('/')}`;
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

    async ensureMarkdownForFiles(files = []) {
        const tasks = files.map(async (file) => {
            const mdFilename = this.getMarkdownFilename(file);
            const url = this.getDataUrl(mdFilename);
            try {
                const resp = await fetch(url, { method: 'GET', cache: 'no-store' });
                if (!resp.ok) {
                    await this.persistMarkdown(mdFilename, this.buildDefaultMarkdownForFilename(file));
                }
            } catch (err) {
                console.warn('Ensure markdown fetch failed, try create:', mdFilename, err);
                try {
                    await this.persistMarkdown(mdFilename, this.buildDefaultMarkdownForFilename(file));
                } catch (err2) {
                    console.warn('Ensure markdown create failed:', mdFilename, err2);
                }
            }
        });
        await Promise.all(tasks);
    }

    buildDefaultMarkdown() {
        const base = this.currentFile ? this.currentFile.replace(/\.json$/i, '') : 'notes';
        return `# ${base}\n\n> 自动创建的 Markdown 笔记文件。\n\n- 可添加章节、要点、引用等。\n- 与 JSON 同名，便于版本记录。\n`;
    }

    buildDefaultMarkdownForFilename(jsonFilename) {
        const base = jsonFilename ? jsonFilename.replace(/\.json$/i, '') : 'notes';
        return `# ${base}\n\n> 自动创建的 Markdown 笔记文件。\n\n- 可添加章节、要点、引用等。\n- 与 JSON 同名，便于版本记录。\n`;
    }

    async ensureMarkdownExistsForFile(jsonFilename) {
        if (!jsonFilename) return;
        const mdFilename = this.getMarkdownFilename(jsonFilename);
        const projectPath = this.currentProject ? this.currentProject.path : 'user';
        const mdUrl = this.getDataUrl(mdFilename);
        try {
            const resp = await fetch(mdUrl, { method: 'GET', cache: 'no-store' });
            if (resp.ok) return;
            if (resp.status === 404) {
                await this.persistMarkdown(mdFilename, this.buildDefaultMarkdownForFilename(jsonFilename));
            }
        } catch (err) {
            console.warn('ensureMarkdownExistsForFile failed:', jsonFilename, err);
        }
    }

    updateMarkdownToolbar() {
        const statusEl = document.getElementById('markdownStatus');
        const editor = document.getElementById('markdownEditor');
        const render = document.getElementById('markdownRender');
        const inMarkdownView = (this.currentView || 'structured') === 'markdown';

        if (statusEl) {
            statusEl.textContent = this.hasUnsavedMarkdownChanges ? '• unsaved' : '';
        }

        // 编辑器显示控制仍然沿用旧逻辑：Markdown 视图内根据 isMarkdownEditing 切换 editor/render
        if (!inMarkdownView) {
            if (editor) editor.style.display = 'none';
            if (render) render.style.display = 'block';
            return;
        }

        if (this.isMarkdownEditing) {
            if (editor) editor.style.display = 'flex';
            if (render) render.style.display = 'none';
        } else {
            if (editor) editor.style.display = 'none';
            if (render) render.style.display = 'block';
        }

        this.updateMarkdownMenuState();
    }

    async loadMarkdownForCurrentFile() {
        if (!this.currentFile) {
            this.currentMarkdownExists = false;
            this.currentMarkdownText = '';
            this.currentMarkdownFile = '';
            this.currentMarkdownBaselineText = '';
            this.renderMarkdownView('');
            this.updateMarkdownToolbar();
            this.updateMarkdownDirtyUI();
            return;
        }
        const mdFilename = this.getMarkdownFilename(this.currentFile);
        const projectPath = this.currentProject ? this.currentProject.path : 'user';
        const mdUrl = `${projectPath}/data/${encodeURIComponent(mdFilename)}`;
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
                // 自动创建空的同名 Markdown 文件，保证渲染流程正常
                try {
                    await this.persistMarkdown(mdFilename, '');
                    this.currentMarkdownExists = true;
                    text = '';
                } catch (errCreate) {
                    console.warn('自动创建空 Markdown 失败:', errCreate);
                    this.currentMarkdownExists = false;
                    text = '';
                }
            } else {
                throw new Error(`加载失败：${resp.status}`);
            }
            this.currentMarkdownFile = mdFilename;
            this.currentMarkdownText = text;
            this.currentMarkdownBaselineText = text;
            this.isMarkdownEditing = false;
            this.hasUnsavedMarkdownChanges = false;
            this.renderMarkdownView(text);
        } catch (err) {
            console.warn('Markdown load error:', err);
            if (render) {
                render.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Markdown 加载失败</h3><p>${err.message}</p></div>`;
            }
        } finally {
            this.updateMarkdownToolbar();
            this.updateMarkdownDirtyUI();
        }
    }

    renderMarkdownView(text) {
        const render = document.getElementById('markdownRender');
        const textarea = document.getElementById('markdownTextarea');
        const sourceText = this.isMarkdownEditing && textarea ? (textarea.value || text) : text;
        if (textarea) textarea.value = sourceText || this.buildDefaultMarkdown();
        if (!render) return;
        if (!sourceText) {
            render.innerHTML = '<div class="empty-state"><i class="fas fa-file-alt"></i><h3>No Markdown</h3><p>未找到同名 Markdown，点击上方按钮创建</p></div>';
            this.applyEditLockState();
            return;
        }
        const md = this.getMarkdownParser();
        if (!md) {
            render.innerHTML = '<div class="empty-state"><i class="fas fa-file-alt"></i><h3>Markdown 引擎不可用</h3></div>';
            this.applyEditLockState();
            return;
        }
        const normalizeMath = (src = '') => {
            // 将 \( \) 与 \[ \] 转换为 $...$ 与 $$...$$，便于 MathJax 识别
            let out = src;
            out = out.replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (m, inner) => `$$${inner}$$`);
            out = out.replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, (m, inner) => `$${inner}$`);
            return out;
        };
        const html = md.render(normalizeMath(sourceText));
        render.innerHTML = `<article class="markdown-body">${html}</article>`;
        this.bindQaTitles(render);
        this.applyPendingQaTitle(render);
        this.applyQaCollapsedState(render);
        this.bindQaCollapsibles(render);
        this.renderMath(render);
        this.highlightCodeBlocks(render);
        this.applyCitationRendering(render);
        this.adjustReferenceFont(render);
        this.updateMarkdownUndoButtonState();
        this.applyEditLockState();
    }

    renderCitationPlaceholder(dois = [], type = 'citep') {
        const list = (dois || []).map(d => this.normalizeDoiString(d)).filter(Boolean);
        const label = list.length ? list.join('; ') : 'citation';
        const cls = type === 'cite' ? 'citation-narrative' : 'citation-parenthetical';
        const escLabel = this.escapeHtml(label);
        const escDois = this.escapeHtml(list.join(','));
        return `<span class="citation-inline ${cls}" data-citation-type="${type}" data-citation-dois="${escDois}">[${escLabel}]</span>`;
    }

    async applyCitationRendering(renderRoot) {
        if (!renderRoot) return;
        const spans = Array.from(renderRoot.querySelectorAll('.citation-inline'));
        if (!spans.length) return;
        await Promise.allSettled(spans.map(async (span) => {
            const type = span.dataset.citationType === 'cite' ? 'cite' : 'citep';
            const dois = (span.dataset.citationDois || '').split(',').map(d => d.trim()).filter(Boolean);
            if (!dois.length) return;
            try {
                const text = await this.formatCitation(dois, type);
                const links = this.buildCitationLinks(text, dois);
                span.innerHTML = links;
                span.title = text;
            } catch (err) {
                console.warn('渲染引文失败:', err);
                span.textContent = `[${dois.join('; ')}]`;
                span.title = `渲染失败: ${err.message}`;
            }
        }));
    }

    normalizeDoiString(raw = '') {
        return (raw || '')
            .trim()
            .replace(/^[({\[]+/, '')
            .replace(/[)}\].,;]+$/, '')
            .replace(/^doi:/i, '')
            .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
            .replace(/_/g, '/');
    }

    buildCitationLinks(text, dois = []) {
        const labels = (text || '').split(/;\s*/).filter(Boolean);
        const safeLabel = this.escapeHtml(text || '');
        const parts = [];
        dois.forEach((doi, idx) => {
            const label = this.escapeHtml(labels[idx] || safeLabel || this.normalizeDoiString(doi));
            const href = `https://doi.org/${encodeURIComponent(this.normalizeDoiString(doi))}`;
            parts.push(`<a class="citation-link" href="${href}" target="_blank" rel="noopener">${label}</a>`);
        });
        return parts.join('; ');
    }

    async formatCitation(dois = [], mode = 'citep') {
        const clean = (dois || []).map(d => this.normalizeDoiString(d)).filter(Boolean);
        const key = `${mode}:${clean.slice().sort().join(',')}`;
        const storedMeta = this.loadCitationMetaFromStorage();
        const hasMeta = clean.every(d => this.hasUsefulMeta(this.citationMetaCache[d] || storedMeta[d]));
        if (this.citationCache[key]) {
            const entry = this.citationCache[key];
            if (!entry.fallback || hasMeta) {
                return entry.text;
            }
        }

        const fallback = this.formatCitationFallback(clean, mode);
        try {
            const { Cite, items } = await this.resolveCslItems(clean);
            if (!Cite) throw new Error('citation-js 未加载');
            const cite = new Cite(items);
            let text = cite.format('citation', { template: 'apa', lang: 'en-US' });
            if (Array.isArray(text)) text = text.join('; ');
            if (!text || /n\.d\./i.test(text)) {
                this.citationCache[key] = { text: fallback, fallback: true };
                return fallback;
            }
            if (mode === 'cite') {
                text = text.replace(/^\(\s*/, '').replace(/\s*\)$/, '');
            }
            this.citationCache[key] = { text, fallback: false };
            return text;
        } catch (err) {
            console.warn('Citation render fallback:', err);
            this.citationCache[key] = { text: fallback, fallback: true };
            return fallback;
        }
    }

    async ensureCiteLib() {
        if (this.citeLib) return this.citeLib;
        let Cite = window.Cite || globalThis.Cite || null;
        const req = (typeof window.require === 'function') ? window.require : null;
        if (!Cite && req) {
            try {
                const mod = req('citation-js');
                Cite = mod?.Cite || mod?.default || mod || Cite;
            } catch (_err) {
                // ignore
            }
        }
        if (!Cite && req) {
            try {
                const core = req('@citation-js/core');
                Cite = core?.Cite || core?.default || core || Cite;
            } catch (_err) {
                // ignore
            }
        }
        if (!Cite) {
            await this.loadCitationScript();
            Cite = window.Cite || globalThis.Cite || null;
        }
        if (Cite) this.citeLib = Cite;
        return Cite;
    }

    loadCitationScript() {
        return new Promise((resolve, reject) => {
            const existing = document.querySelector('script[src*="js/core/citation.js"]');
            if (existing) {
                if (existing.dataset.loaded === '1' || existing.readyState === 'complete' || existing.readyState === 'loaded') {
                    return resolve();
                }
                existing.addEventListener('load', () => resolve(), { once: true });
                existing.addEventListener('error', (e) => reject(e), { once: true });
                return;
            }
            const script = document.createElement('script');
            script.src = 'js/core/citation.js';
            script.defer = true;
            script.dataset.loaded = '1';
            script.onload = () => resolve();
            script.onerror = (e) => reject(e);
            document.head.appendChild(script);
        });
    }

    extractDoisFromMarkdown(text = '') {
        const dois = new Set();
        const citeRe = /citep?\{([^}]+)\}/g;
        let m;
        while ((m = citeRe.exec(text)) !== null) {
            const inside = m[1] || '';
            inside.split(/[,，;]+/).map(d => d.trim()).filter(Boolean).forEach(d => dois.add(this.normalizeDoiString(d)));
        }
        const doiRe = /10\.\d{4,9}[^\s"'\)>\]},;]+/gi;
        while ((m = doiRe.exec(text)) !== null) {
            dois.add(this.normalizeDoiString(m[0]));
        }
        return Array.from(dois).filter(Boolean);
    }

    async buildReferenceList(dois = []) {
        if (!dois.length) throw new Error('未找到 DOI');
        try {
            const { Cite, items } = await this.resolveCslItems(dois);
            if (!Cite) throw new Error('citation-js 未加载');
            const cite = new Cite(items);
            let bib = cite.format('bibliography', {
                template: 'apa',
                lang: 'en-US',
                format: 'text'
            });
            if (Array.isArray(bib)) {
                bib = bib.join('\n');
            }
            if (bib) {
                const lines = String(bib || '').split(/\n+/).map(l => l.trim()).filter(Boolean);
                const mdLines = lines.map(line => `- ${line}`);
                return `## References\n\n${mdLines.join('\n')}`;
            }
        } catch (err) {
            console.warn('Reference render fallback:', err);
        }
        // fallback: simple DOI list
        const mdLines = dois.map(d => `- DOI: https://doi.org/${d}`);
        return `## References\n\n${mdLines.join('\n')}`;
    }

    async resolveCslItems(dois = []) {
        const clean = (dois || []).map(d => this.normalizeDoiString(d)).filter(Boolean);
        const Cite = await this.ensureCiteLib();
        const items = [];
        const stored = this.loadCitationMetaFromStorage();
        for (const doi of clean) {
            if (this.hasUsefulMeta(this.citationMetaCache[doi])) {
                items.push(this.citationMetaCache[doi]);
                continue;
            }
            if (this.hasUsefulMeta(stored[doi])) {
                this.citationMetaCache[doi] = stored[doi];
                items.push(stored[doi]);
                continue;
            }
            let item = { DOI: doi };
            try {
                if (Cite && typeof Cite.async === 'function') {
                    const res = await Cite.async(doi);
                    const csl = Array.isArray(res) ? res[0] : res;
                    if (csl && typeof csl === 'object') {
                        csl.DOI = csl.DOI || doi;
                        item = csl;
                    }
                }
                // 兜底：若 async 拉取失败，尝试手动 fetch
                if (!this.hasUsefulMeta(item)) {
                    const resp = await fetch(`https://doi.org/${encodeURIComponent(doi)}`, {
                        headers: { Accept: 'application/citeproc+json' }
                    });
                    if (resp.ok) {
                        const json = await resp.json();
                        if (json && typeof json === 'object') {
                            json.DOI = json.DOI || doi;
                            item = json;
                        }
                    }
                }
                // 再兜底：尝试 Crossref transform
                if (!this.hasUsefulMeta(item)) {
                    const cr = await this.fetchCslFromCrossref(doi);
                    if (cr) {
                        cr.DOI = cr.DOI || doi;
                        item = cr;
                    }
                }
                if (this.hasUsefulMeta(item)) {
                    this.citationMetaCache[doi] = item;
                    stored[doi] = item;
                    this.saveCitationMetaToStorage(stored);
                }
            } catch (err) {
                console.warn('Fetch DOI metadata failed:', doi, err);
            }
            items.push(item);
        }
        return { Cite, items };
    }

    loadCitationMetaFromStorage() {
        try {
            const raw = localStorage.getItem(this.citationMetaStoreKey);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            const obj = parsed && typeof parsed === 'object' ? parsed : {};
            // 过滤无效元数据，避免污染
            const cleaned = {};
            Object.entries(obj).forEach(([doi, meta]) => {
                if (this.hasUsefulMeta(meta)) {
                    cleaned[doi] = meta;
                }
            });
            if (Object.keys(cleaned).length !== Object.keys(obj).length) {
                this.saveCitationMetaToStorage(cleaned);
            }
            return cleaned;
        } catch (_e) {
            return {};
        }
    }

    saveCitationMetaToStorage(data = {}) {
        try {
            localStorage.setItem(this.citationMetaStoreKey, JSON.stringify(data));
        } catch (_e) {
            // ignore storage errors
        }
    }

    hasUsefulMeta(meta) {
        if (!meta || typeof meta !== 'object') return false;
        const keys = Object.keys(meta || {});
        if (keys.length <= 1) return false; // only DOI is not useful
        const hasAuthor = Array.isArray(meta.author) && meta.author.length > 0;
        const hasTitle = !!meta.title;
        const hasDate = !!(meta.issued || meta.issued_raw || meta.published || meta['container-title']);
        return hasAuthor || hasTitle || hasDate;
    }

    clearCitationCache(showToast = true) {
        this.citationCache = {};
        this.citationMetaCache = {};
        try {
            localStorage.removeItem(this.citationMetaStoreKey);
        } catch (_e) {
            // ignore
        }
        if (showToast) {
            this.showNotification('已清除引文缓存与本地元数据', 'success');
        }
    }

    clearCurrentMarkdownCitationCache() {
        const source = this.isMarkdownEditing
            ? (document.getElementById('markdownTextarea')?.value || '')
            : (this.currentMarkdownText || '');
        if (!source) {
            this.showNotification('当前无 Markdown 内容可清除', 'info');
            return;
        }
        const dois = this.extractDoisFromMarkdown(source);
        if (!dois.length) {
            this.showNotification('当前 Markdown 未找到 DOI', 'info');
            return;
        }
        const set = new Set(dois.map(d => this.normalizeDoiString(d)));
        // 清 citationCache
        Object.keys(this.citationCache || {}).forEach((k) => {
            const parts = k.split(':')[1] || '';
            const list = (parts.split(',') || []).map(x => x.trim());
            if (list.some(d => set.has(d))) {
                delete this.citationCache[k];
            }
        });
        // 清内存 meta cache
        Object.keys(this.citationMetaCache || {}).forEach((doi) => {
            if (set.has(doi)) delete this.citationMetaCache[doi];
        });
        // 清 localStorage meta
        const stored = this.loadCitationMetaFromStorage();
        let touched = false;
        Object.keys(stored).forEach((doi) => {
            if (set.has(doi)) {
                delete stored[doi];
                touched = true;
            }
        });
        if (touched) this.saveCitationMetaToStorage(stored);
        this.showNotification(`已清除当前文档 ${dois.length} 条 DOI 缓存`, 'success');
    }

    adjustReferenceFont(renderRoot) {
        if (!renderRoot) return;
        const headings = renderRoot.querySelectorAll('h1, h2, h3, h4');
        headings.forEach(h => {
            if ((h.textContent || '').trim().toLowerCase() === 'references') {
                let sib = h.nextElementSibling;
                while (sib && sib.tagName && sib.tagName.toLowerCase() === 'p' && !(sib.textContent || '').trim()) {
                    sib = sib.nextElementSibling;
                }
                if (sib && sib.style) {
                    sib.style.fontSize = '0.85em';
                }
            }
        });
    }

    async fetchCslFromCrossref(doi) {
        try {
            const url = `https://api.crossref.org/v1/works/${encodeURIComponent(doi)}/transform/application/citeproc+json`;
            const resp = await fetch(url, { method: 'GET' });
            if (!resp.ok) return null;
            const json = await resp.json();
            return (json && typeof json === 'object') ? json : null;
        } catch (err) {
            console.warn('Crossref CSL fetch failed:', doi, err);
            return null;
        }
    }

    formatCitationFallback(dois = [], mode = 'citep') {
        const list = (dois || []).map(d => this.normalizeDoiString(d)).filter(Boolean);
        if (!list.length) return mode === 'cite' ? '' : '()';
        const joined = list.join('; ');
        return mode === 'cite' ? joined : `(${joined})`;
    }

    appendAutoReferenceSection(text = '', refMd = '') {
        const cleaned = text.replace(/\n?## References[\s\S]*$/i, '').trimEnd();
        const parts = [cleaned];
        if (refMd.trim()) {
            parts.push(refMd.trim());
        }
        return parts.filter(Boolean).join('\n\n') + '\n';
    }

    async generateReferencesFromMarkdown() {
        const source = this.isMarkdownEditing ? (document.getElementById('markdownTextarea')?.value || '') : (this.currentMarkdownText || '');
        if (!source) {
            this.showNotification('当前无 Markdown 内容', 'info');
            return;
        }
        const dois = this.extractDoisFromMarkdown(source);
        if (!dois.length) {
            this.showNotification('未在 Markdown 中找到 DOI', 'info');
            return;
        }
        try {
            const refSection = await this.buildReferenceList(dois);
            const updated = this.appendAutoReferenceSection(source, refSection);
            this.currentMarkdownText = updated;
            this.hasUnsavedMarkdownChanges = true;
            const textarea = document.getElementById('markdownTextarea');
            if (textarea) textarea.value = updated;
            this.renderMarkdownView(updated);
            this.updateMarkdownToolbar();
            this.updateMarkdownDirtyUI();
            this.showNotification(`已生成参考文献 (${dois.length} 篇)`, 'success');
        } catch (err) {
            console.error('生成参考文献失败:', err);
            this.showNotification(`生成参考文献失败: ${err.message}`, 'error');
        }
    }

    applyQaCollapsedState(renderRoot) {
        if (!renderRoot) return;
        const setBlockCollapsed = (block, collapsed) => {
            const toggleBtn = block.querySelector('.qa-toggle');
            block.classList.toggle('qa-collapsed', collapsed);
            if (toggleBtn) {
                toggleBtn.setAttribute('aria-expanded', String(!collapsed));
                const icon = toggleBtn.querySelector('i');
                if (icon) icon.className = collapsed ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
            }
        };

        renderRoot.querySelectorAll('.qa-block').forEach(block => {
            const title = this.getQaTitleFromBlock(block);
            const stored = this.getQaCollapsedForTitle(title);
            if (stored === null) return;
            setBlockCollapsed(block, stored);
        });
    }

    updateMarkdownUndoButtonState() {
        const undoItem = document.getElementById('markdownUndoPasteItem');
        if (!undoItem) return;
        const inMarkdownView = (this.currentView || 'structured') === 'markdown';
        const canUndo = this.lastMarkdownPasteBackup && this.lastMarkdownPasteBackup.file === this.currentFile;
        undoItem.style.display = inMarkdownView && canUndo ? 'inline-flex' : 'none';
        undoItem.disabled = !inMarkdownView || !canUndo;
    }

    bindQaCollapsibles(renderRoot) {
        if (!renderRoot) return;
        const setBlockCollapsed = (block, collapsed) => {
            const toggleBtn = block.querySelector('.qa-toggle');
            block.classList.toggle('qa-collapsed', collapsed);
            if (toggleBtn) {
                toggleBtn.setAttribute('aria-expanded', String(!collapsed));
                const icon = toggleBtn.querySelector('i');
                if (icon) icon.className = collapsed ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
            }
        };

        const setCollapsedByTitle = (title, collapsed) => {
            const key = this.normalizeQaTitleKey(title);
            if (!key) return;
            renderRoot.querySelectorAll('.qa-block').forEach(b => {
                const t = this.normalizeQaTitleKey(this.getQaTitleFromBlock(b));
                if (t === key) setBlockCollapsed(b, collapsed);
            });
            this.setQaCollapsedForTitle(key, collapsed);
        };

        const toggleBlock = (block, targetCollapsed) => {
            if (!block) return;
            const nextCollapsed = typeof targetCollapsed === 'boolean'
                ? targetCollapsed
                : !block.classList.contains('qa-collapsed');
            const title = this.getQaTitleFromBlock(block);
            if (title) {
                setCollapsedByTitle(title, nextCollapsed);
                return;
            }
            setBlockCollapsed(block, nextCollapsed);
        };

        renderRoot.querySelectorAll('.qa-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const block = btn.closest('.qa-block');
                if (!block) return;
                if (e.shiftKey) {
                    // Shift+点击：对当前页面所有 QA 同步折叠/展开
                    const targetCollapsed = !block.classList.contains('qa-collapsed');
                    renderRoot.querySelectorAll('.qa-block').forEach(b => toggleBlock(b, targetCollapsed));
                } else {
                    toggleBlock(block);
                }
            });
        });

        // 点击标题也可折叠/展开（双击仍可编辑标题）
        const titleClickTimers = new WeakMap();
        renderRoot.querySelectorAll('.qa-title').forEach(titleEl => {
            titleEl.addEventListener('click', (e) => {
                if (e.shiftKey) e.preventDefault();
                const block = titleEl.closest('.qa-block');
                if (!block) return;
                // 延迟触发，若用户双击则取消，避免双击编辑时误触发折叠
                if (titleClickTimers.has(titleEl)) {
                    clearTimeout(titleClickTimers.get(titleEl));
                }
                const t = setTimeout(() => {
                    titleClickTimers.delete(titleEl);
                    if (e.shiftKey) {
                        const targetCollapsed = !block.classList.contains('qa-collapsed');
                        renderRoot.querySelectorAll('.qa-block').forEach(b => toggleBlock(b, targetCollapsed));
                    } else {
                        toggleBlock(block);
                    }
                }, 220);
                titleClickTimers.set(titleEl, t);
            });
            titleEl.addEventListener('dblclick', () => {
                if (!titleClickTimers.has(titleEl)) return;
                clearTimeout(titleClickTimers.get(titleEl));
                titleClickTimers.delete(titleEl);
            });
        });

        const setSectionCollapsed = (section, collapsed) => {
            section.classList.toggle('qa-section-collapsed', collapsed);
            const toggleBtn = section.querySelector('.qa-section-toggle');
            if (toggleBtn) {
                toggleBtn.setAttribute('aria-expanded', String(!collapsed));
                const icon = toggleBtn.querySelector('i');
                if (icon) icon.className = collapsed ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
            }
        };

        renderRoot.querySelectorAll('.qa-section-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = btn.closest('.qa-section');
                if (!section) return;
                if (e.shiftKey) {
                    const targetCollapsed = !section.classList.contains('qa-section-collapsed');
                    renderRoot.querySelectorAll('.qa-section').forEach(sec => setSectionCollapsed(sec, targetCollapsed));
                } else {
                    const collapsed = section.classList.toggle('qa-section-collapsed');
                    btn.setAttribute('aria-expanded', String(!collapsed));
                    const icon = btn.querySelector('i');
                    if (icon) icon.className = collapsed ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
                }
            });
        });

        // 点击问号标签折叠/展开对应回答；Shift+点击全局折叠/展开回答
        renderRoot.querySelectorAll('.qa-label-qa, .qa-label-q').forEach(label => {
            label.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const qaItem = label.closest('.qa-item');
                if (!qaItem) return;
                if (e.shiftKey) {
                    const anyCollapsed = Array.from(renderRoot.querySelectorAll('.qa-item')).some(item => item.classList.contains('qa-answer-collapsed'));
                    renderRoot.querySelectorAll('.qa-item').forEach(item => {
                        item.classList.toggle('qa-answer-collapsed', !anyCollapsed);
                    });
                } else {
                    qaItem.classList.toggle('qa-answer-collapsed');
                }
            });
        });
    }

    bindQaTitles(renderRoot) {
        if (!renderRoot || !this.currentFile) return;
        const blocks = renderRoot.querySelectorAll('.qa-block');
        const titleMap = this.qaTitleMap[this.currentFile] || {};
        blocks.forEach((block, idx) => {
            block.dataset.qaIndex = idx;
            const titleEl = block.querySelector('.qa-title');
            if (!titleEl) return;
            const dataTitle = titleEl.dataset.qaTitle || titleEl.textContent || 'Q&A';
            const storedTitle = titleMap.hasOwnProperty(idx) ? titleMap[idx] : null;
            // 如果 Markdown 中的 title 已变更，则以最新 dataTitle 为准并回写 map
            const finalTitle = storedTitle && storedTitle.trim() !== dataTitle.trim()
                ? dataTitle
                : (storedTitle || dataTitle);
            titleEl.textContent = finalTitle;
            titleEl.dataset.qaTitle = finalTitle;
            if (!this.qaTitleMap[this.currentFile]) this.qaTitleMap[this.currentFile] = {};
            this.qaTitleMap[this.currentFile][idx] = finalTitle;
            titleEl.title = '双击编辑标题';
            titleEl.addEventListener('dblclick', () => {
                const current = titleEl.textContent || '';
                const next = prompt('编辑 QA 标题（可留空）:', current);
                if (next === null) return;
                const newTitle = next.trim();
                const finalTitle = newTitle || 'Q&A';
                titleEl.textContent = finalTitle;
                titleEl.dataset.qaTitle = finalTitle;
                this.setQaTitleForIndex(idx, finalTitle);
            });
        });
    }

    applyPendingQaTitle(renderRoot) {
        if (!this.pendingQaTitle || !renderRoot || this.pendingQaTitle.file !== this.currentFile) return;
        const blocks = renderRoot.querySelectorAll('.qa-block');
        if (!blocks.length) return;
        const targetIdx = blocks.length - 1;
        const finalTitle = (this.pendingQaTitle.title || 'Q&A').trim() || 'Q&A';
        this.setQaTitleForIndex(targetIdx, finalTitle, true);
        this.pendingQaTitle = null;
    }

    setQaTitleForIndex(index, newTitle, skipRenderUpdate = false) {
        if (index === undefined || index === null || index < 0) return;
        const finalTitle = (newTitle || 'Q&A').trim() || 'Q&A';
        if (!this.qaTitleMap[this.currentFile]) this.qaTitleMap[this.currentFile] = {};
        this.qaTitleMap[this.currentFile][index] = finalTitle;

        // 更新当前 Markdown 文本中的对应 qa fence 信息
        if (this.currentMarkdownText) {
            let replaced = false;
            const lines = this.currentMarkdownText.split('\n');
            let qaCount = 0;
            for (let i = 0; i < lines.length; i++) {
                const match = lines[i].match(/^```qa[^\n]*$/i);
                if (match) {
                    if (qaCount === index) {
                        lines[i] = `\`\`\`qa${finalTitle ? `@${finalTitle}` : ''}`;
                        replaced = true;
                        break;
                    }
                    qaCount++;
                }
            }
            if (replaced) {
                this.currentMarkdownText = lines.join('\n');
                const textarea = document.getElementById('markdownTextarea');
                if (textarea) {
                    textarea.value = this.currentMarkdownText;
                }
                if (!skipRenderUpdate) {
                    this.renderMarkdownView(this.currentMarkdownText);
                }
                this.hasUnsavedMarkdownChanges = this.currentMarkdownText !== (this.currentMarkdownBaselineText || '');
                this.updateMarkdownToolbar();
                this.updateMarkdownDirtyUI();
            }
        }

        // 更新当前已渲染的标题文字（不强制触发重新渲染）
        const render = document.getElementById('markdownRender');
        if (render) {
            const blocks = render.querySelectorAll('.qa-block');
            const block = blocks[index];
            const titleEl = block?.querySelector('.qa-title');
            if (titleEl) {
                titleEl.textContent = finalTitle;
                titleEl.dataset.qaTitle = finalTitle;
            }
            if (block) {
                // 标题变更时，将当前折叠状态写入新标题键，确保同标题一致恢复
                const collapsed = block.classList.contains('qa-collapsed');
                const existing = this.getQaCollapsedForTitle(finalTitle);
                if (existing === null) {
                    this.setQaCollapsedForTitle(finalTitle, collapsed);
                }
            }
        }
    }

    updateMarkdownDirtyUI() {
        const statusEl = document.getElementById('markdownStatus');
        if (!statusEl) return;
        if (this.hasUnsavedMarkdownChanges && this.currentMarkdownExists) {
            statusEl.style.display = 'inline';
            const mdFilename = this.currentFile ? this.getMarkdownFilename(this.currentFile) : (this.currentMarkdownFile || 'Markdown');
            statusEl.innerHTML = ` | ${mdFilename} <i class="fas fa-exclamation-triangle unsaved-icon" title="Markdown 未保存"></i>`;
        } else {
            statusEl.style.display = 'none';
            statusEl.textContent = '';
        }

        // header 按钮启用状态依赖 dirty 状态
        this.updateHeaderControls();
    }

    onMarkdownEditorInput() {
        if (!this.currentMarkdownExists) return;
        const textarea = document.getElementById('markdownTextarea');
        if (!textarea) return;
        if (this.isEditLocked) {
            textarea.value = this.currentMarkdownText || this.buildDefaultMarkdown();
            this.showLockedNotification('编辑 Markdown');
            return;
        }
        const nextDirty = textarea.value !== (this.currentMarkdownBaselineText || '');
        if (nextDirty === this.hasUnsavedMarkdownChanges) return;
        this.hasUnsavedMarkdownChanges = nextDirty;
        this.updateMarkdownToolbar();
        this.updateMarkdownDirtyUI();
    }

    async saveCurrentMarkdownSilently() {
        if (!this.currentFile || !this.currentMarkdownExists) return;
        const textarea = document.getElementById('markdownTextarea');
        const content = (this.isMarkdownEditing && textarea) ? textarea.value : (this.currentMarkdownText || '');
        const mdFilename = this.getMarkdownFilename(this.currentFile);
        await this.persistMarkdown(mdFilename, content);
        this.currentMarkdownText = content;
        this.currentMarkdownBaselineText = content;
        this.isMarkdownEditing = false;
        this.hasUnsavedMarkdownChanges = false;
        this.updateMarkdownToolbar();
        this.updateMarkdownDirtyUI();
    }

    discardCurrentMarkdownChanges() {
        const baseline = this.currentMarkdownBaselineText || '';
        this.currentMarkdownText = baseline;
        this.isMarkdownEditing = false;
        this.hasUnsavedMarkdownChanges = false;
        const textarea = document.getElementById('markdownTextarea');
        if (textarea) textarea.value = baseline;
        this.renderMarkdownView(baseline);
        this.updateMarkdownToolbar();
        this.updateMarkdownDirtyUI();
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
            this.currentMarkdownBaselineText = content;
            this.isMarkdownEditing = true;
            this.hasUnsavedMarkdownChanges = false;
            this.renderMarkdownView(content);
            this.updateMarkdownToolbar();
            this.updateMarkdownDirtyUI();
        } catch (err) {
            console.error('创建 Markdown 失败:', err);
            this.showNotification(`创建 Markdown 失败: ${err.message}`, 'error');
        }
    }

    toggleMarkdownEdit(editing, opts = {}) {
        if (!this.currentMarkdownExists) return;
        if (editing && this.isEditLocked) {
            this.showLockedNotification('编辑 Markdown');
        }
        const skipConfirm = !!opts.skipConfirm;
        // 退出编辑时，如有未保存修改，给出提示
        if (!skipConfirm && !editing && this.isMarkdownEditing && this.hasUnsavedMarkdownChanges) {
            const mdFilename = this.currentFile ? this.getMarkdownFilename(this.currentFile) : (this.currentMarkdownFile || 'Markdown');
            const shouldSave = confirm(`Markdown "${mdFilename}" 有未保存的修改，是否保存？`);
            if (shouldSave) {
                this.saveMarkdownFromEditor();
                return;
            }
        }
        this.isMarkdownEditing = editing;
        const textarea = document.getElementById('markdownTextarea');
        if (textarea) {
            if (editing) {
                textarea.value = this.currentMarkdownText || this.buildDefaultMarkdown();
                this.onMarkdownEditorInput();
            } else {
                // 退出编辑时同步当前文本到内存，便于渲染新内容
                this.currentMarkdownText = textarea.value;
            }
        }
        this.updateMarkdownToolbar();
        this.updateMarkdownDirtyUI();
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
            this.currentMarkdownBaselineText = content;
            this.currentMarkdownExists = true;
            this.hasUnsavedMarkdownChanges = false;
            // 先退出编辑态，再渲染，确保用户立刻回到渲染视图
            this.toggleMarkdownEdit(false, { skipConfirm: true });
            this.renderMarkdownView(content);
            this.showNotification(`✓ Markdown 已保存: ${mdFilename}`, 'success');
        } catch (err) {
            console.error('保存 Markdown 失败:', err);
            this.showNotification(`保存 Markdown 失败: ${err.message}`, 'error');
        }
    }

    highlightCodeBlocks(container) {
        try {
            if (!window.hljs || !container) return;
            container.querySelectorAll('pre code').forEach((block) => {
                window.hljs.highlightElement(block);
                this.injectCopyButton(block);
            });
        } catch (err) {
            console.warn('Highlight failed:', err);
        }
    }

    injectCopyButton(codeBlock) {
        const pre = codeBlock.closest('pre');
        if (!pre || pre.querySelector('.code-copy-btn')) return;

        const btn = document.createElement('button');
        btn.className = 'code-copy-btn';
        btn.innerHTML = '<i class="fas fa-copy"></i> Copy';
        btn.title = 'Copy code';
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const text = codeBlock.innerText;
            navigator.clipboard.writeText(text).then(() => {
                this.showNotification('Code copied', 'success');
            }).catch((err) => {
                console.warn('Copy failed:', err);
                this.showNotification('Copy failed', 'error');
            });
        });

        pre.style.position = 'relative';
        pre.appendChild(btn);
    }


    // 触发MathJax渲染数学公式
    renderMath(rootEl = null) {
        try {
            if (window.MathJax && window.MathJax.typesetPromise) {
                const targets = rootEl ? [rootEl] : undefined;
                MathJax.typesetPromise(targets).catch((err) => {
                    console.error('MathJax rendering error:', err);
                });
            }
        } catch (err) {
            console.error('MathJax render failed:', err);
        }
    }

    async switchView(btn) {
        const nextView = btn?.dataset?.view;
        return this.setView(nextView, btn);
    }

    async switchToView(view) {
        const target = String(view || '').trim();
        if (!target) return;
        const btn = document.querySelector(`.tab-btn[data-view="${target}"]`);
        if (btn) return this.switchView(btn);
        return this.setView(target, null);
    }

    async setView(nextView, btn = null) {
        const viewName = String(nextView || '').trim();
        if (!viewName) return;
        const prevView = this.currentView || 'structured';
        // 离开 Markdown 视图时：若有未保存修改，提示保存；并退出编辑态，避免 UI/按钮残留
        if (prevView === 'markdown' && viewName !== 'markdown') {
            if (this.hasUnsavedMarkdownChanges && this.currentFile && this.currentMarkdownExists) {
                const mdFilename = this.getMarkdownFilename(this.currentFile);
                const shouldSave = confirm(`Markdown "${mdFilename}" 有未保存的修改，是否保存？`);
                try {
                    if (shouldSave) {
                        await this.saveCurrentMarkdownSilently();
                    } else {
                        this.discardCurrentMarkdownChanges();
                    }
                } catch (err) {
                    console.error('切换视图时保存 Markdown 失败:', err);
                    this.showNotification(`保存 Markdown 失败: ${err.message}`, 'error');
                }
            } else if (this.isMarkdownEditing) {
                this.isMarkdownEditing = false;
                this.updateMarkdownToolbar();
            }
        }

        // 在 Markdown 视图内再次点击 Markdown tab：强制从编辑态切回渲染态并渲染最新内容
        if (prevView === 'markdown' && viewName === 'markdown') {
            if (this.currentMarkdownExists) {
                const textarea = document.getElementById('markdownTextarea');
                const content = (this.isMarkdownEditing && textarea) ? textarea.value : (this.currentMarkdownText || '');
                this.currentMarkdownText = content;
                this.hasUnsavedMarkdownChanges = content !== (this.currentMarkdownBaselineText || '');
                if (this.isMarkdownEditing) {
                    this.toggleMarkdownEdit(false, { skipConfirm: true });
                }
                this.renderMarkdownView(content);
            }
        }

        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        if (btn) {
            btn.classList.add('active');
        } else {
            const match = document.querySelector(`.tab-btn[data-view="${viewName}"]`);
            if (match) match.classList.add('active');
        }

        // Switch views
        const view = viewName;
        this.currentView = view;
        try {
            localStorage.setItem('lastViewMode', view);
        } catch (_e) {}
        const structured = document.getElementById('structuredView');
        const markdown = document.getElementById('markdownView');
        const flat = document.getElementById('flatView');
        if (structured) structured.classList.remove('active');
        if (markdown) markdown.classList.remove('active');
        if (flat) flat.classList.remove('active');

        if (view === 'structured' && structured) {
            structured.classList.add('active');
        } else if (view === 'markdown' && markdown) {
            markdown.classList.add('active');
        } else if (view === 'flat' && flat) {
            flat.classList.add('active');
        }

        this.updateHeaderControls();
        this.updateMarkdownToolbar();
        this.updateMarkdownDirtyUI();
        this.updateJsonMenuState();
        this.updateMarkdownMenuState();

        // 切换到 Markdown 视图时，确保渲染区域为最新内容（尤其是从编辑态进入）
        if (view === 'markdown' && this.currentMarkdownExists) {
            const textarea = document.getElementById('markdownTextarea');
            const content = (this.isMarkdownEditing && textarea) ? textarea.value : (this.currentMarkdownText || '');
            if (this.isMarkdownEditing) {
                this.currentMarkdownText = content;
                this.hasUnsavedMarkdownChanges = content !== (this.currentMarkdownBaselineText || '');
                this.toggleMarkdownEdit(false, { skipConfirm: true });
            }
            this.renderMarkdownView(content);
            this.updateMarkdownToolbar();
            this.updateMarkdownDirtyUI();
        }
        this.applyEditLockState();
    }

    applyCurrentView() {
        const view = this.currentView || 'structured';
        this.switchToView(view);
    }

    toggleTableMarkdownView() {
        const current = this.currentView || 'structured';
        let targetView = 'structured';
        if (current === 'structured' || current === 'flat') {
            targetView = 'markdown';
        } else {
            targetView = 'structured';
        }
        this.switchToView(targetView);
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

    escapeAttr(text) {
        return this.escapeHtml(text || '').replace(/`/g, '&#96;');
    }

    renderGotoLinks(rawText, valuePath = '') {
        if (!rawText) return '';
        const re = /goto\{([^}]+)\}/g;
        let lastIndex = 0;
        let out = '';
        let m;
        while ((m = re.exec(rawText)) !== null) {
            const pre = rawText.slice(lastIndex, m.index);
            const query = (m[1] || '').trim();
            out += this.escapeHtml(pre);
            if (query) {
                out += `<a href="#" class="location-link goto-link" data-page="" data-quote-text="${this.escapeAttr(query)}" data-open-params="" data-quote-index="0" data-value-path="${this.escapeAttr(valuePath)}" title="跳转PDF搜索"><i class="fa-solid fa-quote-right"></i></a>`;
            } else {
                out += this.escapeHtml(m[0]);
            }
            lastIndex = re.lastIndex;
        }
        out += this.escapeHtml(rawText.slice(lastIndex));
        return out;
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

    setValueByPath(pathArr, value) {
        if (!pathArr || !pathArr.length) return;
        let cur = this.currentData;
        for (let i = 0; i < pathArr.length - 1; i++) {
            const seg = pathArr[i];
            if (!cur || typeof cur !== 'object') return;
            const isIndex = /^\d+$/.test(seg);
            if (!Object.prototype.hasOwnProperty.call(cur, seg)) {
                cur[seg] = isIndex ? [] : {};
            }
            if (isIndex && Array.isArray(cur)) {
                const idx = parseInt(seg, 10);
                if (!Array.isArray(cur[idx]) && typeof cur[idx] !== 'object') {
                    cur[idx] = {};
                }
            }
            cur = cur[seg];
        }
        const last = pathArr[pathArr.length - 1];
        cur[last] = value;
    }

    updateGotoText(pathStr, newText, targetIndex = 0) {
        if (!pathStr || !this.currentData) return;
        const pathArr = pathStr.split('.').filter(Boolean);
        const oldVal = this.getValueByPath(pathArr);
        if (typeof oldVal !== 'string') {
            this.showNotification('目标字段不是文本，无法更新引用', 'error');
            return;
        }
        let count = 0;
        const updated = oldVal.replace(/goto\{[^}]*\}/g, (m) => {
            if (count === targetIndex) {
                count++;
                return `goto{${newText}}`;
            }
            count++;
            return m;
        });
        if (updated === oldVal) {
            this.showNotification('未找到可更新的 goto 引用', 'info');
            return;
        }
        this.setValueByPath(pathArr, updated);
        this.hasUnsavedChanges = true;
        if (this.currentFile) this.tempDataCache[this.currentFile] = this.currentData;
        this.updateSaveButtonState();
        this.renderStructuredView();
        this.renderFlatView();
        if (this.currentMarkdownExists && typeof this.currentMarkdownText === 'string') {
            this.renderMarkdownView(this.currentMarkdownText);
        }
        this.setupEditableListeners();
        this.showNotification('引用文本已更新', 'success');
    }

    async updateMarkdownGotoText(oldText = '', newText, targetIndex = 0) {
        if (!this.currentMarkdownExists || typeof this.currentMarkdownText !== 'string') return;
        const reAll = /goto\{([^}]*?)\}/g;
        const matches = [...this.currentMarkdownText.matchAll(reAll)];
        if (!matches.length) {
            this.showNotification('未在 Markdown 中找到可更新的 goto 引用', 'info');
            return;
        }
        const escapeReg = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let updatedText = this.currentMarkdownText;
        let replaced = false;

        if (oldText) {
            const reg = new RegExp(`goto\\{${escapeReg(oldText.trim())}\\}`, 'g');
            let count = 0;
            updatedText = updatedText.replace(reg, (m) => {
                if (!replaced && count === targetIndex) {
                    replaced = true;
                    count++;
                    return `goto{${newText}}`;
                }
                count++;
                return m;
            });
        }

        if (!replaced) {
            let count = 0;
            updatedText = updatedText.replace(reAll, (m) => {
                if (count === targetIndex && !replaced) {
                    replaced = true;
                    count++;
                    return `goto{${newText}}`;
                }
                count++;
                return m;
            });
        }

        if (!replaced) {
            this.showNotification('未在 Markdown 中找到可更新的 goto 引用', 'info');
            return;
        }

        this.currentMarkdownText = updatedText;
        const textarea = document.getElementById('markdownTextarea');
        if (textarea) {
            textarea.value = this.currentMarkdownText;
        }
        this.isMarkdownEditing = false;
        try {
            const mdFilename = this.getMarkdownFilename(this.currentFile);
            await this.persistMarkdown(mdFilename, this.currentMarkdownText);
            this.showNotification('Markdown 引用已更新并保存', 'success');
        } catch (err) {
            this.showNotification(`Markdown 保存失败: ${err.message}`, 'error');
        }
        this.renderMarkdownView(this.currentMarkdownText);
        this.updateMarkdownToolbar();
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
                        <td class="toggle-cell"><i class="fa-solid fa-circle-check row-select-indicator"></i></td>
                        <td class="preview-key">${this.formatKey('placeholder_field')}</td>
                        <td class="preview-dim">value</td>
                    </tr>
                    <tr>
                        <td class="toggle-cell"></td>
                        <td class="preview-key">${this.formatKey('placeholder_field_loc')}</td>
                        <td class="preview-dim">{ page_label:"", pdf_page_index:null, quote: [] }</td>
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
        const loadToken = ++this.currentPdfLoadToken;
        try {
            const pdfViewer = document.getElementById('pdfViewer');
            this.currentPdfUrl = url;
            this.pendingPdfUrl = url;
            this.setPdfSidebarPrefClosed();
            if (pdfViewer) {
                pdfViewer.classList.remove('pdf-loaded');
            }

            // 同一路径已加载，直接复用现有渲染
            if (this.lastPdfLoadedUrl === url) {
                if (pdfViewer) {
                    pdfViewer.classList.add('pdf-loaded');
                }
                return;
            }

            // 使用PDF.js的web viewer
            // viewer.html在 js/pdfjs/web/ 目录，需要3个../才能回到根目录
            const viewerUrl = `js/pdfjs/web/viewer.html?file=${encodeURIComponent('../../../' + url)}&theme=${this.theme === 'dark' ? 'dark' : 'light'}#zoom=80`;
            pdfViewer.src = viewerUrl;
            
            // 监听iframe加载完成（如需自定义滚动行为，可在此扩展）
            pdfViewer.onload = () => {
                if (loadToken !== this.currentPdfLoadToken) return;
                try {
                    const win = pdfViewer.contentWindow;
                    if (win) {
                        const pdfDoc = win.document;
                        // 缩小 PDF.js 整体 UI / 预览尺寸
                        const styleId = 'paperReviewerPdfScaleStyle';
                        if (!pdfDoc.getElementById(styleId)) {
                            const styleEl = pdfDoc.createElement('style');
                            styleEl.id = styleId;
                            // 统一将 PDF.js 的主容器缩放到 80%，无需依赖浏览器的 zoom 兼容性
                            styleEl.textContent = `
                                :root { --pr-pdf-scale: 0.8; }
                                #outerContainer {
                                    transform: scale(var(--pr-pdf-scale));
                                    transform-origin: top left;
                                    width: calc(100% / var(--pr-pdf-scale));
                                    height: calc(100% / var(--pr-pdf-scale));
                                }
                            `;
                            pdfDoc.head.appendChild(styleEl);
                        }
                        // 禁用 PDF.js 内部的 alert/confirm/prompt 弹窗
                        win.alert = () => {};
                        win.confirm = () => true;
                        win.prompt = () => null;
                        // 部分 overlay 弹窗（如删除时的提示）直接关闭
                        if (win.PDFViewerApplication?.overlayManager?.closeAll) {
                            win.PDFViewerApplication.overlayManager.closeAll();
                        }
                        // 用户点击 PDF 时清除搜索高亮，减少干扰
                        const bindClickClear = () => {
                            const viewerContainer = pdfDoc?.querySelector('#viewerContainer');
                            if (viewerContainer && !viewerContainer.dataset.clearHighlightBound) {
                                viewerContainer.addEventListener('click', () => this.clearPdfHighlights());
                                viewerContainer.dataset.clearHighlightBound = '1';
                            }
                        };
                        bindClickClear();
                        setTimeout(bindClickClear, 300);

                        // 默认收起侧边栏，但保留按钮可用
                        const tryCloseSidebar = () => {
                            const pdfApp = win.PDFViewerApplication;
                            if (pdfApp?.pdfSidebar?.isOpen) {
                                pdfApp.pdfSidebar?.close();
                            }
                        };
                        tryCloseSidebar();
                        setTimeout(tryCloseSidebar, 120);

                        requestAnimationFrame(() => {
                            if (loadToken !== this.currentPdfLoadToken) return;
                            pdfViewer.classList.add('pdf-loaded');
                            this.lastPdfLoadedUrl = url;
                            this.pendingPdfUrl = url;
                            this.updatePdfPlaceholder('loaded');
                        });
                    }
                } catch (err) {
                    console.warn('Suppress PDF.js prompts failed:', err);
                }
            };
        } catch (error) {
            console.error('Error loading PDF:', error);
            this.showNotification(`PDF 加载失败: ${error.message}`, 'error');
        }
    }

    async ensurePdfLoaded() {
        const url = this.pendingPdfUrl || this.currentPdfUrl;
        if (!url) {
            this.updatePdfPlaceholder('empty');
            return;
        }
        if (this.lastPdfLoadedUrl === url) {
            this.updatePdfPlaceholder('loaded');
            return;
        }
        this.updatePdfPlaceholder('pending');
        await this.loadPDF(url);
    }

    updatePdfPlaceholder(state) {
        if (!this.pdfPlaceholderEl) return;
        const textEl = this.pdfPlaceholderEl.querySelector('.pdf-placeholder-text');
        const btn = this.pdfPlaceholderEl.querySelector('.pdf-placeholder-btn');
        if (state === 'loaded') {
            this.pdfPlaceholderEl.classList.remove('show');
            return;
        }
        this.pdfPlaceholderEl.classList.add('show');
        if (btn) btn.style.display = state === 'pending' ? 'inline-flex' : 'none';
        if (textEl) {
            if (state === 'pending') textEl.textContent = '点击加载 PDF';
            else textEl.textContent = '无可用 PDF';
        }
    }

    setPdfSidebarPrefClosed() {
        try {
            // 让 PDF.js viewer 默认不展开侧边栏，避免初始闪烁
            localStorage.setItem('pdfjs.sidebarViewOnLoad', '0');
        } catch (_e) {
            // ignore
        }
    }

    deferShowAddSectionButton() {
        if (this.addSectionShowTimer) {
            clearTimeout(this.addSectionShowTimer);
            this.addSectionShowTimer = null;
        }
        this.addSectionShowTimer = setTimeout(() => {
            const addSectionBtn = document.getElementById('addSectionBtn');
            if (addSectionBtn && this.currentData) {
                addSectionBtn.style.display = 'inline-flex';
                addSectionBtn.style.opacity = '0';
                addSectionBtn.style.pointerEvents = 'none';
            }
        }, 120);
    }

    attachAddSectionHover() {
        if (this.addSectionHoverCleanup) {
            this.addSectionHoverCleanup();
            this.addSectionHoverCleanup = null;
        }
        const container = document.getElementById('structuredView') || document.getElementById('structuredContent');
        const btn = document.getElementById('addSectionBtn');
        if (!container || !btn) return;
        const onMove = (e) => {
            const rect = container.getBoundingClientRect();
            const nearBottom = (rect.bottom - e.clientY) <= 60;
            if (nearBottom && this.currentData) {
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
            } else {
                btn.style.opacity = '0';
                btn.style.pointerEvents = 'none';
            }
        };
        const onLeave = () => {
            btn.style.opacity = '0';
            btn.style.pointerEvents = 'none';
        };
        container.addEventListener('mousemove', onMove);
        container.addEventListener('mouseleave', onLeave);
        this.addSectionHoverCleanup = () => {
            container.removeEventListener('mousemove', onMove);
            container.removeEventListener('mouseleave', onLeave);
        };
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
            this.debugLog(`🎯 开始丝滑滚动到第 ${targetPage} 页`);
            
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
            
            this.debugLog('✅ 找到viewerContainer');
            
            // 确保设置了平滑滚动（以防未设置）
            if (viewerContainer.style.scrollBehavior !== 'smooth') {
                viewerContainer.style.scrollBehavior = 'smooth';
                this.debugLog('🔧 已设置viewerContainer平滑滚动');
            }
            
            // 获取目标页面元素
            const pageElement = pdfDoc.querySelector(`[data-page-number="${targetPage}"]`);
            
            if (pageElement) {
                
                // 获取页面位置
                const pageRect = pageElement.getBoundingClientRect();
                const containerRect = viewerContainer.getBoundingClientRect();
                
                // 计算目标滚动位置（页面顶部对齐到视口顶部，留点边距）
                const targetScrollTop = viewerContainer.scrollTop + pageRect.top - containerRect.top - 20;
                
                this.debugLog(`📊 滚动信息:`, {
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
                }, 500);
                
                this.showNotification(`📄 第 ${targetPage} 页`, 'info');
            } else {
                console.warn(`⚠️ 找不到页面${targetPage}的DOM元素，可能还未渲染`);
                const allPages = pdfDoc.querySelectorAll('[data-page-number]');
                
                // 使用PDF.js API跳转
                pdfApp.page = targetPage;
                this.showNotification(`📄 第 ${targetPage} 页`, 'info');
            }
        } catch (error) {
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
            
            this.debugLog('✅ 找到viewerContainer，查找高亮元素...');
            
            // 确保设置了平滑滚动（以防未设置）
            if (viewerContainer.style.scrollBehavior !== 'smooth') {
                viewerContainer.style.scrollBehavior = 'smooth';
            }
            
            // 查找第一个高亮元素（PDF.js的高亮class）
            const highlighted = viewerContainer.querySelector('.highlight.selected') || 
                               viewerContainer.querySelector('.highlight.begin') ||
                               viewerContainer.querySelector('.highlight');
            
            if (highlighted) {
                
                // 获取元素在容器中的位置
                const elementRect = highlighted.getBoundingClientRect();
                const containerRect = viewerContainer.getBoundingClientRect();
                
                // 计算元素中心相对于容器顶部的位置
                const elementCenterY = elementRect.top - containerRect.top + viewerContainer.scrollTop + elementRect.height / 2;
                
                // 计算视口中心位置
                const viewportCenterY = containerRect.height / 2;
                
                // 目标滚动位置：让元素中心对齐视口中心
                const targetScrollTop = elementCenterY - viewportCenterY;
                
                this.debugLog(`📊 滚动信息:`, {
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
                
            } else {
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

            this.debugLog(`🔍 在第 ${pageNumber} 页搜索:`, cleanText);

            // 尝试多次，确保PDF.js已初始化
            let attempts = 0;
            const maxAttempts = 8;
            
            const trySearch = () => {
                attempts++;
                
                try {
                    const pdfApp = pdfWindow.PDFViewerApplication;
                    
                    if (!pdfApp || !pdfApp.pdfViewer) {
                        if (attempts < maxAttempts) {
                            this.debugLog(`⏳ 等待PDF.js初始化... (${attempts}/${maxAttempts})`);
                            setTimeout(trySearch, 400);
                        } else {
                            console.error('❌ PDF.js初始化超时');
                        }
                        return;
                    }
                    
                    this.debugLog('✅ PDF.js已就绪');
                    this.debugLog('当前页:', pdfApp.page || pdfApp.pdfViewer.currentPageNumber);
                    this.debugLog('FindController:', !!pdfApp.findController);
                    this.debugLog('EventBus:', !!pdfApp.eventBus);
                    
                    // 方法1: 使用EventBus（更可靠）
                    if (pdfApp.eventBus) {
                        this.debugLog('🎯 使用EventBus API搜索');
                        
                        // 设置搜索结果监听器
                        let resultListener = null;
                        let matchListener = null;
                        
                        resultListener = (evt) => {
                            this.debugLog('📊 搜索状态更新:', evt);
                            if (evt.state === 1) { // FOUND
                                this.debugLog('✅ 找到匹配');
                            } else if (evt.state === 3) { // NOT_FOUND
                                this.debugLog('⚠️ 未找到匹配');
                            }
                        };
                        
                        matchListener = (evt) => {
                            this.debugLog('📈 匹配数量:', evt.matchesCount);
                        };
                        
                        // 监听搜索结果
                        pdfApp.eventBus.on('updatefindcontrolstate', resultListener);
                        pdfApp.eventBus.on('updatefindmatchescount', matchListener);
                        
                        // 先关闭之前的搜索
                        try {
                            pdfApp.eventBus.dispatch('findbarclose');
                        } catch (e) {
                            this.debugLog('清除旧搜索');
                        }
                        
                        // 延迟执行新搜索
                        setTimeout(() => {
                            this.debugLog('🔍 执行搜索命令...');
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
                            
                            this.debugLog('✅ 搜索命令已发送');
                            
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
                        this.debugLog('🎯 使用FindController搜索');
                        
                        try {
                            pdfApp.findController.executeCommand('find', {
                                query: cleanText,
                                phraseSearch: true,
                                caseSensitive: false,
                                entireWord: false,
                                highlightAll: true,
                                findPrevious: false
                            });
                            
                            this.debugLog('✅ FindController搜索已执行');
                            
                            // 检查搜索状态
                            setTimeout(() => {
                                if (pdfApp.findController.state) {
                                    this.debugLog('搜索状态:', pdfApp.findController.state);
                                }
                                if (pdfApp.findController.matchesCount) {
                                    this.debugLog('匹配数量:', pdfApp.findController.matchesCount);
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
        if (this.isEditLocked) {
            this.showLockedNotification('编辑字段名');
            return;
        }
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
        if (this.isEditLocked) {
            this.showLockedNotification('编辑字段');
            return;
        }
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
            
            this.debugLog(`✓ 已自动创建 ${locKey} 字段`);
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

    openGotoEditModal(initialText = '') {
        return new Promise((resolve) => {
            const modal = document.getElementById('gotoEditModal');
            const textarea = document.getElementById('gotoEditTextarea');
            if (!modal || !textarea) {
                const fallback = prompt('Edit reference text', initialText);
                resolve(fallback === null ? null : fallback);
                return;
            }
            this.gotoEditResolver = resolve;
            textarea.value = initialText || '';
            modal.classList.add('active');
            setTimeout(() => textarea.focus(), 50);
        });
    }

    closeGotoEditModal(commit = false) {
        const modal = document.getElementById('gotoEditModal');
        const textarea = document.getElementById('gotoEditTextarea');
        if (modal) modal.classList.remove('active');
        if (this.gotoEditResolver) {
            const val = commit && textarea ? textarea.value : null;
            this.gotoEditResolver(val);
            this.gotoEditResolver = null;
        }
    }

    async saveEditedValue() {
        if (this.isEditLocked) {
            this.showLockedNotification('保存字段');
            return;
        }
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
        let shouldReloadPdf = false;
        let nextPdfFile = null;
        try {
            if (newValue.trim().startsWith('{') || newValue.trim().startsWith('[')) {
                current[lastKey] = JSON.parse(newValue);
            } else {
                current[lastKey] = newValue;
            }
            // 规范化 pdf_path 仅保留文件名
            if (lastKey.toLowerCase() === 'pdf_path') {
                current[lastKey] = this.normalizePdfPathValue(current[lastKey]);
                const parentIsMeta = this.editingPath.length >= 2 && this.editingPath[this.editingPath.length - 2].toLowerCase() === 'meta_info';
                if (parentIsMeta) {
                    shouldReloadPdf = true;
                    nextPdfFile = current[lastKey];
                }
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

        // 如果更新了 meta_info.pdf_path，则立即按新路径加载 PDF
        if (shouldReloadPdf && nextPdfFile) {
            const projectPath = this.currentProject ? this.currentProject.path : 'user';
            const pdfUrl = `${projectPath}/papers/${nextPdfFile}`;
            try {
                await this.loadPDF(pdfUrl);
            } catch (err) {
                console.warn('重新加载PDF失败:', err);
            }
        }
    }

    deleteCurrentField() {
        if (this.isEditLocked) {
            this.showLockedNotification('删除字段');
            return;
        }
        if (!this.editingPath) return;
        const lastKey = this.editingPath[this.editingPath.length - 1];
        const parentPath = this.editingPath.slice(0, -1);
        if (confirm(`确定删除字段 "${lastKey}" 及其 _loc 信息？`)) {
            this.deleteField(parentPath, lastKey);
            this.closeEditModal();
        }
    }

    updateFileMeta() {
        const lastUpdateEl = document.getElementById('lastUpdateDisplay');
        if (lastUpdateEl) {
            const ts = this.currentData?.lastupdate ? this.currentData.lastupdate : '-';
            lastUpdateEl.textContent = `Last update: ${ts}`;
        }
    }

    updateHeaderControls() {
        this.updateJsonMenuState();
        this.updateMarkdownMenuState();
    }

    updateSaveButtonState() {
        this.updateFileMeta();
        const lastUpdateEl = document.getElementById('lastUpdateDisplay');
        this.updateJsonMenuState();
        
        const addSectionBtn = document.getElementById('addSectionBtn');
        if (addSectionBtn) {
            addSectionBtn.style.display = 'none';
            if (!addSectionBtn.dataset.inited) {
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
                addSectionBtn.dataset.inited = '1';
            }
        }

        this.updateAutoLoadMenuState();
        
        // 更新文件名显示，标记未保存状态
        if (lastUpdateEl) {
            const ts = this.currentData?.lastupdate ? this.currentData.lastupdate : '-';
            const unsavedIcon = this.hasUnsavedChanges
                ? `<i class="fas fa-exclamation-triangle unsaved-icon" title="Unsaved changes"></i>`
                : '';
            lastUpdateEl.innerHTML = `Last update: ${ts} ${unsavedIcon}`.trim();
            lastUpdateEl.classList.toggle('unsaved-state', !!this.hasUnsavedChanges);
        }

        this.updateHeaderControls();
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
        
        // 取消双击字段名的编辑入口，改为单击行打开完整编辑
        if (this._editableClickHandler) {
            document.removeEventListener('dblclick', this._editableClickHandler);
        }
        this._editableClickHandler = null;

        // 单击 editable-value（编辑值）
        if (this._editableValueClickHandler) {
            document.removeEventListener('click', this._editableValueClickHandler);
        }
        // 取消单击值的编辑入口，改为单击整行
        this._editableValueClickHandler = null;

        // 处理 location-link 点击事件（也使用事件委托）
        if (this._locationLinkHandler) {
            document.removeEventListener('click', this._locationLinkHandler);
        }
        if (this._locationLinkDblHandler) {
            document.removeEventListener('dblclick', this._locationLinkDblHandler);
        }
        if (this._apaBtnHandler) {
            document.removeEventListener('click', this._apaBtnHandler);
        }
        if (this._apaBtnHoverHandler) {
            document.removeEventListener('mouseover', this._apaBtnHoverHandler);
        }
        if (this._apaBtnLeaveHandler) {
            document.removeEventListener('mouseout', this._apaBtnLeaveHandler);
        }
        
        this._locationLinkHandler = (e) => {
            const target = e.target;
            if (!target || typeof target.closest !== 'function') return;
            const link = target.classList.contains('location-link') ? target : target.closest('.location-link');
            
            if (link) {
                e.preventDefault();
                const pageRaw = link.dataset.page || '';
                const valuePath = link.dataset.valuePath;
                const quoteIndex = link.dataset.quoteIndex !== undefined ? parseInt(link.dataset.quoteIndex) : 0;
                const quoteText = link.dataset.quoteText || '';
                const openParams = link.dataset.openParams || '';
                const pageFromParams = this.extractPageFromParams(openParams);
                const pageNum = pageRaw ? parseInt(pageRaw, 10) : null;
                const targetPage = pageFromParams ?? (isNaN(pageNum) ? null : pageNum);
                
                // 直接跳转，让executeSearchAndScroll处理循环逻辑
                this.jumpToPageWithQuote(targetPage, valuePath, isNaN(quoteIndex) ? null : quoteIndex, quoteText, openParams);
            }
        };
        this._locationLinkDblHandler = async (e) => {
            const target = e.target;
            if (!target || typeof target.closest !== 'function') return;
            const link = target.classList.contains('location-link') ? target : target.closest('.location-link');
            if (!link) return;
            e.preventDefault();
            const current = link.dataset.quoteText || (link.textContent || '').trim() || '';
            const valuePath = link.dataset.valuePath || '';
            const allGotoLinks = Array.from(document.querySelectorAll('.goto-link'));
            const samePathLinks = allGotoLinks.filter(l => (l.dataset.valuePath || '') === valuePath);
            const idxInPath = samePathLinks.indexOf(link);
            const idx = idxInPath >= 0 ? idxInPath : (link.dataset.quoteIndex !== undefined ? parseInt(link.dataset.quoteIndex, 10) : 0);
            const next = await this.openGotoEditModal(current);
            if (next === null) return;
            if (valuePath) {
                await this.updateGotoText(valuePath, next, isNaN(idx) ? 0 : idx);
            } else {
                await this.updateMarkdownGotoText(current, next, isNaN(idx) ? 0 : idx);
            }
        };
        this._apaBtnHandler = async (e) => {
            const btn = e.target.closest('.apa-fetch-btn');
            if (!btn) return;
            e.preventDefault();
            if (btn.dataset.disabled === '1') {
                this.showNotification('未找到 DOI，无法生成 APA', 'error');
                return;
            }
            const doi = btn.dataset.doi || this.findFirstDoiInCurrentData();
            if (!doi) {
                this.showNotification('未找到 DOI，无法生成 APA', 'error');
                return;
            }
            btn.disabled = true;
            btn.classList.add('loading');
            try {
                const citeFn = window.citeDoiToApa;
                const text = citeFn ? await citeFn(doi) : null;
                if (!text) throw new Error('未得到 APA 文本');
                await this.writeTextToClipboard(text);
                this.showNotification('APA 引用已复制到剪贴板', 'success');
                // 写回 meta_info.apa，便于展示与保存
                if (!this.currentData.meta_info || typeof this.currentData.meta_info !== 'object') {
                    this.currentData.meta_info = {};
                }
                this.currentData.meta_info.apa = text;
                this.hasUnsavedChanges = true;
                if (this.currentFile) {
                    this.tempDataCache[this.currentFile] = this.currentData;
                }
                // 立刻刷新按钮的悬浮内容
                btn.setAttribute('data-apa-text', text);
                // 重渲染视图以展示 APA 文本
                this.updateSaveButtonState();
                this.renderStructuredView();
                this.renderFlatView();
                this.setupEditableListeners();
                this.updateUndoButtonState();
            } catch (err) {
                console.error('APA 生成失败:', err);
                this.showNotification(`APA 生成失败: ${err.message}`, 'error');
            } finally {
                btn.disabled = false;
                btn.classList.remove('loading');
            }
        };
        this._apaBtnHoverHandler = (e) => {
            const btn = e.target.closest('.apa-fetch-btn');
            if (!btn) return;
            const text = (btn.dataset.apaText || this.currentData?.meta_info?.apa || '').trim();
            if (!text.trim()) return;
            this.showApaTooltip(btn, text);
        };
        this._apaBtnLeaveHandler = (e) => {
            const btn = e.target.closest('.apa-fetch-btn');
            if (!btn) return;
            this.hideApaTooltip();
        };
        
        document.addEventListener('click', this._locationLinkHandler);
        document.addEventListener('dblclick', this._locationLinkDblHandler);
        document.addEventListener('click', this._apaBtnHandler);
        document.addEventListener('mouseover', this._apaBtnHoverHandler);
        document.addEventListener('mouseout', this._apaBtnLeaveHandler);
        document.addEventListener('click', (e) => {
            if (this.projectInfoVisible) {
                const panel = document.getElementById('projectInfoPanel');
                const btn = document.getElementById('projectInfoBtn');
                if (panel && !panel.contains(e.target) && !(btn && btn.contains(e.target))) {
                    this.toggleProjectInfoPanel(false, { skipClose: true });
                }
            }
            if (this.shortcutsVisible) {
                const panel = document.getElementById('shortcutsInfoPanel');
                const btn = document.getElementById('shortcutsInfoBtn');
                if (panel && !panel.contains(e.target) && !(btn && btn.contains(e.target))) {
                    this.toggleShortcutsPanel(false, { skipClose: true });
                }
            }
        });
        document.addEventListener('click', (e) => {
            if (!this.projectInfoVisible) return;
            const panel = document.getElementById('projectInfoPanel');
            const btn = document.getElementById('projectInfoBtn');
            if (!panel) return;
            const insidePanel = panel.contains(e.target);
            const fromBtn = btn && btn.contains(e.target);
            if (!insidePanel && !fromBtn) {
                this.toggleProjectInfoPanel(false, { skipClose: true });
            }
        });

        // 关键词悬停提示
        if (this._keywordTipEnterHandler) {
            document.removeEventListener('mouseenter', this._keywordTipEnterHandler, true);
        }
        if (this._keywordTipMoveHandler) {
            document.removeEventListener('mousemove', this._keywordTipMoveHandler, true);
        }
        if (this._keywordTipLeaveHandler) {
            document.removeEventListener('mouseleave', this._keywordTipLeaveHandler, true);
        }

        this._keywordTipEnterHandler = (e) => {
            const target = e.target;
            if (!target || typeof target.closest !== 'function') return;
            const link = target.closest('.keyword-tip');
            if (!link) return;
            const tip = link.dataset.tip || '';
            if (!tip) return;
            const tooltip = this.getKeywordTooltipEl();
            tooltip.textContent = tip;
            tooltip.style.display = 'block';
            this.positionKeywordTooltip(e);
        };

        this._keywordTipMoveHandler = (e) => {
            if (!this.keywordTooltipEl || this.keywordTooltipEl.style.display !== 'block') return;
            this.positionKeywordTooltip(e);
        };

        this._keywordTipLeaveHandler = (e) => {
            const target = e.target;
            if (!target || typeof target.closest !== 'function') return;
            if (target.closest('.keyword-tip')) {
                const tooltip = this.getKeywordTooltipEl();
                tooltip.style.display = 'none';
            }
        };

        document.addEventListener('mouseenter', this._keywordTipEnterHandler, true);
        document.addEventListener('mousemove', this._keywordTipMoveHandler, true);
        document.addEventListener('mouseleave', this._keywordTipLeaveHandler, true);

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
    jumpToPageWithQuote(page, valuePath, quoteIndex = null, quoteText = '', openParams = '') {
        let searchText = quoteText ? this.cleanQuoteForSearch(quoteText) : '';
        let targetPage = this.extractPageFromParams(openParams) ?? page;
        
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
                if (!searchText && current[locKey] && current[locKey].quote) {
                    const quotes = current[locKey].quote;
                    
                    if (Array.isArray(quotes)) {
                        // 如果是数组，获取指定索引的quote
                        if (quoteIndex !== null && quoteIndex >= 0 && quoteIndex < quotes.length) {
                            searchText = this.cleanQuoteForSearch(quotes[quoteIndex]);
                            this.debugLog(`🔍 从 quote[${quoteIndex}] 获取搜索文本:`, searchText);
                        } else if (quotes.length > 0) {
                            // 默认使用第一个
                            searchText = this.cleanQuoteForSearch(quotes[0]);
                            this.debugLog('🔍 从 quote[0] 获取搜索文本:', searchText);
                        }
                    } else if (typeof quotes === 'string') {
                        // 兼容旧的字符串格式
                        searchText = this.cleanQuoteForSearch(quotes);
                        this.debugLog('🔍 从 quote 字符串获取搜索文本:', searchText);
                    }
                }
                
                if (!targetPage && current[locKey] && current[locKey].pdf_page_index) {
                    targetPage = current[locKey].pdf_page_index;
                }

                // 如果没有 quote，使用字段值本身
                if (!searchText) {
                    const fieldValue = current[lastKey];
                    if (fieldValue !== null && fieldValue !== undefined) {
                        searchText = typeof fieldValue === 'string' ? fieldValue : JSON.stringify(fieldValue);
                        this.debugLog('🔍 从字段值获取搜索文本:', searchText);
                    }
                }
            }
        }

        if (targetPage || searchText) {
            this.jumpToPage(targetPage, searchText, valuePath);
        }
    }

    extractPageFromParams(openParams) {
        if (!openParams || typeof openParams !== 'string') return null;
        const m = openParams.match(/page=(\d+)/i);
        if (m) {
            const n = parseInt(m[1], 10);
            return isNaN(n) ? null : n;
        }
        return null;
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
        
        
        // 如果文本太长，截取前200个字符（保持完整单词）
        if (cleanText.length > 200) {
            const truncated = cleanText.substring(0, 200);
            const lastSpace = truncated.lastIndexOf(' ');
            cleanText = lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated;
            this.debugLog('✂️ 文本过长，截取前', cleanText.length, '个字符');
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
            
            this.debugLog('Searching for location:', { pathString, locKey, hasLoc: !!current[locKey] });
            
            if (current[locKey] && current[locKey].quote) {
                const searchText = this.cleanQuoteForSearch(current[locKey].quote);
                this.debugLog('Found quote:', searchText);
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

            this.debugLog('尝试在PDF中搜索文本:', cleanText);

            // 方法1: 使用window.find() API (适用于大多数浏览器)
            try {
                // 先清除之前的搜索
                if (pdfWindow.getSelection) {
                    pdfWindow.getSelection().removeAllRanges();
                }

                // 执行搜索 (参数: searchText, caseSensitive, backwards, wrapAround, wholeWord, searchInFrames, showDialog)
                const found = pdfWindow.find(cleanText, false, false, true, false, true, false);
                
                if (found) {
                    this.debugLog('✅ 文本搜索成功');
                } else {
                    console.warn('⚠️ 未找到匹配文本');
                    // 尝试搜索部分文本（取前20个字符）
                    if (cleanText.length > 20) {
                        const partialText = cleanText.substring(0, 20);
                        this.debugLog('尝试搜索部分文本:', partialText);
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
                    this.debugLog('使用PDF.js搜索功能');
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

    clearPdfHighlights() {
        try {
            const iframe = document.getElementById('pdfViewer');
            const pdfApp = iframe?.contentWindow?.PDFViewerApplication;
            if (pdfApp?.eventBus) {
                pdfApp.eventBus.dispatch('findbarclose');
            }
            const pdfDoc = iframe?.contentWindow?.document;
            if (pdfDoc?.getSelection) {
                pdfDoc.getSelection().removeAllRanges();
            }
            if (pdfDoc) {
                pdfDoc.querySelectorAll('.highlight').forEach(el => {
                    el.classList.remove('highlight', 'selected', 'begin', 'end', 'middle');
                });
            }
        } catch (err) {
            console.warn('清除 PDF 高亮失败:', err);
        }
    }

    showNotification(message, type = 'info') {
        this.debugLog(`${type.toUpperCase()}: ${message}`);
        
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

    async saveToFile(options = {}) {
        const { silent = false } = options;
        if (!this.currentFile || !this.currentData) return;
        // Only save when there are pending changes; avoid touching lastupdate otherwise
        if (!this.hasUnsavedChanges) {
            if (!silent) {
                this.showNotification('No changes to save', 'info');
            }
            return;
        }

        try {
            // 确保 schema_version 存在（仅在保存时补全，避免加载即标记为脏）
            if (!this.currentData.schema_version) {
                this.currentData.schema_version = this.generateSchemaVersion();
            }
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
            this.updateFileMeta();

            // 成功通知
            if (!silent) {
                this.showNotification(`✓ ${this.currentFile} 已保存`, 'success');
            }
            this.debugLog('File saved:', result);
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
    window.testCite = async (dois, mode = 'citep') => {
        const list = Array.isArray(dois) ? dois : [dois];
        return app.formatCitation(list, mode === 'cite' ? 'cite' : 'citep');
    };
    window.clearCitationCache = () => app.clearCitationCache();

    // 全局 DOI -> APA 测试方法：在控制台调用 citeDoiToApa('10.xxxx/yyy')
    const loadCiteLib = async () => {
        const pickCite = () => {
            let Cite = window.Cite || globalThis.Cite || null;
            const req = (typeof window.require === 'function') ? window.require : null;
            if (!Cite && req) {
                try {
                    const mod = req('citation-js');
                    Cite = mod?.Cite || mod?.default || mod || Cite;
                } catch (err) {
                    console.warn('[citeDoiToApa] require("citation-js") 失败', err);
                }
            }
            if (!Cite && req) {
                try {
                    const core = req('@citation-js/core');
                    Cite = core?.Cite || core?.default || core || Cite;
                } catch (err) {
                    console.warn('[citeDoiToApa] require("@citation-js/core") 失败', err);
                }
            }
            return Cite;
        };

        let cite = pickCite();
        if (cite) return cite;

        const loadScript = () => new Promise((resolve, reject) => {
            const existing = document.querySelector('script[src*="js/core/citation.js"]');
            const script = existing || document.createElement('script');
            script.src = 'js/core/citation.js';
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('citation.js 加载失败'));
            if (!existing) document.head.appendChild(script);
        });
        await loadScript();
        cite = pickCite();
        if (!cite) {
            console.error('[citeDoiToApa] 未能从 js/core/citation.js 取得 Cite，请确认文件暴露 window.Cite');
        }
        return cite;
    };

    window.citeDoiToApa = async (doi) => {
        if (!doi) {
            console.warn('请传入 DOI，例如 citeDoiToApa(\"10.xxxx/yyy\")');
            return null;
        }
        try {
            const Cite = await loadCiteLib();
            if (!Cite || typeof Cite.async !== 'function') {
                console.error('Cite 未就绪或不支持 async');
                return null;
            }
            console.debug('[citeDoiToApa] start', doi);
            const data = await Cite.async(doi);
            const result = data.format('bibliography', {
                template: 'apa',
                format: 'text',
                lang: 'en-US'
            });
            const text = Array.isArray(result) ? result.filter(Boolean).join('\n') : String(result || '');
            console.log('[citeDoiToApa] APA result:', text);
            return text;
        } catch (err) {
            console.error('[citeDoiToApa] 失败', err);
            return null;
        }
    };

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
            
            app.debugLog(`🎯 在第 ${page} 页搜索: "${text}"`);
            
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
                    app.debugLog('📊 搜索状态:', evt);
                    if (evt.state === 1) app.debugLog('✅ 找到匹配');
                    else if (evt.state === 3) app.debugLog('⚠️ 未找到匹配');
                };
                const matchListener = (evt) => {
                    app.debugLog('📈 匹配数量:', evt.matchesCount);
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
            
            app.debugLog('🔍 直接调用EventBus搜索:', text);
            
            // 监听器
            const resultListener = (evt) => {
                app.debugLog('📊 搜索状态:', evt);
            };
            const matchListener = (evt) => {
                app.debugLog('📈 匹配数量:', evt.matchesCount);
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
    
    
    // Setup editable listeners after initial render
    setTimeout(() => {
        app.setupEditableListeners();
    }, 500);
    
    // 页面关闭/刷新前提示保存
    window.addEventListener('beforeunload', (e) => {
        if (app.hasUnsavedChanges || app.hasUnsavedMarkdownChanges) {
            e.preventDefault();
            e.returnValue = '您有未保存的修改（JSON/Markdown），确定要离开吗？';
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
