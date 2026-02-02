class PaperStatsApp {
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
        this.lastSearchText = null; // 跟踪上次搜索的文本
        this.lastSearchValuePath = null; // 跟踪上次搜索的字段路径
        this.searchMatchCount = 0; // 当前搜索的匹配数量
        this.currentMatchIndex = 0; // 当前显示的匹配索引
        this.previewHoverTimer = null; // 类预览悬停防抖
        this.currentMarkdownText = '';
        this.currentMarkdownFile = '';
        this.currentMarkdownBaselineText = '';
        this.markdownParser = null;
        this.frontMatterParser = null;
        this.currentMarkdownMetadata = {}; // 存储当前 Markdown 的 metadata
        this.currentMarkdownExists = false;
        this.isMarkdownEditing = false;
        this.hasUnsavedMarkdownChanges = false;
        this.isDraftViewActive = false;
        this.isSwitchingView = false;
        this.pendingViewSwitch = null;
        this.fileMarkdownState = null;
        this.draftMarkdownState = null;
        this.saveMdEndpoint = '/save-md';
        this.blankDragImage = null;
        this.keywordTooltipEl = null;
        this.selectedItem = null; // { type: 'row' | 'section', path: string[], key: string }
        this.activePanel = null; // left | middle | right | null
        this.isMiddleActive = false; // 中间栏是否激活，用于键盘上下移动的激活判定
        this.isLeftActive = false; // 左侧栏是否激活，用于键盘左右移动文件顺序
        this.isRightActive = false; // 右侧栏是否激活
        this.fileFilterField = '';
        this.fileFilterValue = '';
        this.fileFilterMatches = null;
        this.fileFilterComputeToken = 0;
        this.fileFilterAutocomplete = null;
        this.fileFilter = '';
        this.fileFilterVisible = false;
        this.fileFilterConditions = [];
        this.fileFilterConditionId = 0;
        this.fileFilterFieldAutocompletes = new Map();
        this.fileFilterHistory = [];
        this.createGroupVisible = false;
        this.autoSaveConfigVisible = false;
        this.settingsPanelsStateKey = '';
        this.queryExportVisible = false;
        this.debugEnabled = this.loadDebugEnabled();
        try {
            const storedView = localStorage.getItem('lastViewMode');
            if (storedView) {
                if (storedView === 'draft') {
                    this.currentView = 'markdown';
                    this.isDraftViewActive = true;
                } else {
                    this.currentView = storedView;
                }
            } else {
                const defaultView = document.querySelector('.tab-btn.active')?.dataset?.view;
                if (defaultView === 'draft') {
                    this.currentView = 'markdown';
                    this.isDraftViewActive = true;
                } else {
                    this.currentView = defaultView || 'structured';
                }
            }
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
        this.envInfo = { homeDir: '', desktopDir: '', rootDir: '', platform: '' };
        this.defaultProjectPathExample = '/path/to/project';
        this.isEditLocked = this.loadEditLockState();
        this.citationCache = {}; // 缓存 cite/citep 渲染结果 {text, fallback}
        this.citationMetaCache = {}; // 缓存 DOI -> CSL
        this.citationMetaStoreKey = 'paperReviewerCitationMeta';
        this.projectInfoVisible = false;
        this.thirdPartyInfoVisible = false;
        this.thirdPartyInfoLoaded = false;
        this.shortcutsVisible = false;
        this.shortcutsLoaded = false;
        this.autoSaveManager = null;
        this.autoSaveConfigUI = null;
        this.jsonMenuVisible = false;
        this.mdMenuVisible = false;
        this.rawJsonParseOk = true;
        this.rawJsonParseError = '';
        this.rawJsonParseTimer = null;
        this.currentLoadToken = 0;
        this._eventListenersBound = false;
        this.sectionExpandedStateByProject = this.loadSectionExpandedState();
        this.lastSelectedFileByProject = this.loadLastSelectedFileByProject();
        this.uiPreferences = {};
        this.markdownEditMode = { draft: true, markdown: false };
        this.importMenuVisible = false;
        this._statusProgressEls = null;
        this._statusProgressState = { text: '', percent: 0 };
        this._statusProgressTagTimer = null;
        this.groupSortState = {};
        this.mdChatQueryFields = new Set();
        this.mdChatFieldOptions = [];
        this.mdChatSuggestIndex = -1;
        this.mdChatHistory = [];
        this.mdChatHistoryIndex = -1;
        this.mdChatHistoryDraft = '';

        // 项目管理
        this.currentProject = null; // { name, path }
        this.recentProjects = [];
        this.fileOrders = {}; // { projectPath: [filename1, filename2, ...] }
        this.fileGroups = {}; // { projectPath: { groups: [{id, name, files: []}] } }
        this.currentFileList = [];
        this.draggingFile = null; // { filename, fromGroupId }
        this.currentFileDragState = null; // { targetFilename, targetGroupId, placeAfter }
        this.draggingGroup = null; // { groupId }
        this.currentGroupDragState = null; // { targetGroupId, placeAfter }
        this.dragPreviewEl = null;
        this.selectedFiles = new Set();
        this.lastFileSelectionAnchor = null;
        this.visibleFileOrder = [];
        this.currentGroupId = null; // 当前选中文件所在的分组ID
        this.groupMenuState = null; // { menuEl, groups, index }
        this.currentPdfLoadToken = 0;
        this.lastPdfLoadedUrl = '';
        this.pendingPdfUrl = null;
        this.pendingPdfFallback = null;
        this.pdfPlaceholderEl = null;
        this.settingsMenuVisible = false;
        this.autoLoadPdf = false;
        this.apiSettingsVisible = false;
        this.autoSaveConfigVisible = false;
        this.pdfPopupWindow = null;
        this.isPdfPopupMode = false;
        this.pdfPopupFocusInterval = null;
        this.pdfViewModeRestored = false; // 标记是否已经恢复过PDF窗口模式
        this.pdfPopupAutoCollapsed = false;
        this.pdfPopupRightWasCollapsed = false;
        this._pdfPrewarmCache = new Map();
        this.metaDefaultsPatched = false;
        this.addSectionShowTimer = null;
        this.addSectionHoverCleanup = null;
        this.theme = this.loadTheme();
        this.queryFieldOptions = [];
        this.queryFieldOptionsView = '';
        this.queryFieldSelected = new Set();
        this.queryFieldsLoading = false;
        this.importingExternal = false;
        this.importJsonMode = 'join'; // 导入模式：join(仅匹配并更新交集), union(并集更新)
        this.importJsonTargetPath = 'json/imported';
        this.jsonTargetCallback = null;
        this.importModeCallback = null;
        this.wosFieldTagsByTag = {};
        this.wosFieldTagsByKey = {};
        this.wosFieldPtValueMap = {};
        this.selectedJsonTargetPath = null;
        this.fileMetaByPath = {};
        this.fileMetaByBase = {};
        this.availableJsonViews = [];
        this.currentJsonView = '';
        this.queryDoiOrderText = '';
        this.lastJsonViewByProject = this.loadLastJsonViewByProject();
        this.doiAutoNumberStart = null;
        this.lastGotoLink = null;
        this.lastGotoAttemptText = '';
        this.globalSettings = this.loadGlobalSettings();
        this.syncGlobalSettingsGlobals();
        this.completeGroupsForCurrentProject = null; // 存储完整的、未被view过滤的分组结构
        this.virtualGroupState = {};
        this.visibleFilePositions = {};
        this.virtualListConfig = {
            overscan: 6,
            defaultItemHeight: 22
        };
        this._virtualResizeBound = false;

        // 搜索防抖和互斥控制
        this._isSearching = false;
        this._lastClickedLink = null;
        this._lastClickTime = 0;
        this._lastClickTimer = null;
        this._currentSearchAbortController = null;

        // PDF标注数据缓存
        this._pdfAnnotationsCache = {};
        this._pdfHighlightTimer = null;
        this._pdfHighlightClickHandler = null;
        this._pdfHighlightBoundWindow = null;

        // 跟踪鼠标是否在pdfViewer上（用于ESC键判断）
        this._isMouseOverPdfViewer = false;

        // 初始化管理器
        this.specialSyntaxManager = null; // 延迟初始化
        this.projectStorage = null; // 延迟初始化
        this.autoSaveManager = null; // 自动保存管理器
        this.autoSaveConfigUI = null; // 自动保存配置界面

        // 🔑 立即清理可能遗留的独立PDF窗口
        this.cleanupOrphanedPdfWindows();

        this.init();
    }

    // 清理可能遗留的独立PDF窗口
    cleanupOrphanedPdfWindows() {
        try {
            // 方法1: 通过localStorage发送关闭信号
            try {
                // 检查是否有活动的PDF窗口标记
                const hasActiveWindow = localStorage.getItem('pdfPopupWindowActive');
                if (hasActiveWindow) {
                    localStorage.setItem('closePdfPopupWindow', 'true');
                    // 等待一小段时间让窗口接收信号
                    setTimeout(() => {
                        localStorage.removeItem('closePdfPopupWindow');
                        localStorage.removeItem('pdfPopupWindowActive');
                    }, 1000);
                }
            } catch (e) {
                console.warn('⚠️ 无法使用localStorage发送关闭信号:', e);
            }

            // 方法2: 检查是否有之前打开的窗口引用
            if (this.pdfPopupWindow && !this.pdfPopupWindow.closed) {
                this.pdfPopupWindow.close();
                this.pdfPopupWindow = null;
            }

            // 注意：移除了 window.open('', 'PDFViewer') 的方法3
            // 因为它会在每次页面重载时创建一个空白窗口，导致用户体验问题
            // localStorage信号和窗口引用的方法已经足够处理大多数情况

            this.isPdfPopupMode = false;
            this.updatePdfPopupButtonState();
            this.clearPdfPopupCloseSignal();
        } catch (err) {
            // 忽略清理错误
            console.warn('⚠️ 清理遗留PDF窗口时出错:', err);
        }
    }

    closeAllModals(exceptId = '') {
        const modals = document.querySelectorAll('.modal');
        modals.forEach((m) => {
            if (!exceptId || m.id !== exceptId) {
                m.classList.remove('active');
            }
        });
    }

    activateModal(modalId) {
        if (!modalId) return;
        this.closeAllModals(modalId);
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('active');
    }

    async sortGroupByMetaNo(groupId) {
        const view = this.currentJsonView || '';
        const groups = this.getCurrentGroups();
        const target = groups.find(g => g.id === groupId);
        if (!target) return;
        const files = (target.files || []).slice();
        if (!files.length) return;

        const fetchNo = async (base) => {
            const path = this.getViewPathForBase(base, view);
            if (!path) return { no: Number.MAX_SAFE_INTEGER, base };
            try {
                const data = await this.readProjectFile(path);
                const meta = data?.meta_info || {};
                const noVal = meta.No ?? meta.no ?? meta.NO ?? meta.No;
                const parsed = typeof noVal === 'number' ? noVal : Number(String(noVal).trim());
                const no = Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
                return { no: Number.isFinite(no) ? no : Number.MAX_SAFE_INTEGER, base };
            } catch (err) {
                console.warn('sortGroupByMetaNo fetch failed for', base, err);
                return { no: Number.MAX_SAFE_INTEGER, base };
            }
        };

        const results = await Promise.all(files.map(f => fetchNo(f)));
        const order = results
            .sort((a, b) => a.no - b.no || a.base.localeCompare(b.base))
            .map(r => r.base);

        target.files = order;
        this.persistGroupsAndRender(groups, this.currentFile);
        this.showNotification(`Sorted by No completed (${target.name})`, 'success');

    }

    async sortGroupByPublicationYear(groupId) {
        const view = this.currentJsonView || '';
        const groups = this.getCurrentGroups();
        const target = groups.find(g => g.id === groupId);
        if (!target) return;
        const files = (target.files || []).slice();
        if (!files.length) return;

        const prev = this.groupSortState[groupId]?.year || 'asc';
        const nextDir = prev === 'asc' ? 'desc' : 'asc';
        this.groupSortState[groupId] = { ...(this.groupSortState[groupId] || {}), year: nextDir };

        const fetchYear = async (base) => {
            const path = this.getViewPathForBase(base, view);
            if (!path) return { year: null, base };
            try {
                const data = await this.readProjectFile(path);
                const wos = data?.wos_data || {};
                const raw = wos.publication_year ?? wos.publicationYear ?? wos.pub_year ?? wos.year;
                const val = Array.isArray(raw) ? raw[0] : raw;
                const parsed = val !== undefined && val !== null ? Number(String(val).trim()) : NaN;
                const year = Number.isFinite(parsed) ? parsed : null;
                return { year, base };
            } catch (err) {
                console.warn('sortGroupByPublicationYear fetch failed for', base, err);
                return { year: null, base };
            }
        };

        const results = await Promise.all(files.map(f => fetchYear(f)));
        const dir = nextDir === 'asc' ? 1 : -1;
        const order = results
            .sort((a, b) => {
                const aMissing = !Number.isFinite(a.year);
                const bMissing = !Number.isFinite(b.year);
                if (aMissing && bMissing) return a.base.localeCompare(b.base);
                if (aMissing) return 1;
                if (bMissing) return -1;
                return (a.year - b.year) * dir || a.base.localeCompare(b.base);
            })
            .map(r => r.base);

        target.files = order;
        this.persistGroupsAndRender(groups, this.currentFile);
        const label = nextDir === 'asc' ? 'ascending' : 'descending';
        this.showNotification(`Sorted by publication year (${label})`, 'success');
    }


    async sortGroupBySourceTitle(groupId) {
        const view = this.currentJsonView || '';
        const groups = this.getCurrentGroups();
        const target = groups.find(g => g.id === groupId);
        if (!target) return;
        const files = (target.files || []).slice();
        if (!files.length) return;

        const prev = this.groupSortState[groupId]?.sourceTitle || 'asc';
        const nextDir = prev === 'asc' ? 'desc' : 'asc';
        this.groupSortState[groupId] = { ...(this.groupSortState[groupId] || {}), sourceTitle: nextDir };

        const fetchTitle = async (base) => {
            const path = this.getViewPathForBase(base, view);
            if (!path) return { title: '', base };
            try {
                const data = await this.readProjectFile(path);
                const wos = data?.wos_data || {};
                const raw = wos.source_title ?? wos.sourceTitle ?? wos.journal ?? wos.SO;
                const val = Array.isArray(raw) ? raw[0] : raw;
                const title = val ? String(val).trim() : '';
                return { title, base };
            } catch (err) {
                console.warn('sortGroupBySourceTitle fetch failed for', base, err);
                return { title: '', base };
            }
        };

        const results = await Promise.all(files.map(f => fetchTitle(f)));
        const dir = nextDir === 'asc' ? 1 : -1;
        const order = results
            .sort((a, b) => {
                const aMissing = !a.title;
                const bMissing = !b.title;
                if (aMissing && bMissing) return a.base.localeCompare(b.base);
                if (aMissing) return 1;
                if (bMissing) return -1;
                return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) * dir
                    || a.base.localeCompare(b.base);
            })
            .map(r => r.base);

        target.files = order;
        this.persistGroupsAndRender(groups, this.currentFile);
        const label = nextDir === 'asc' ? 'A→Z' : 'Z→A';
        this.showNotification(`Sorted by journal (${label})`, 'success');
    }

    async sortGroupByTimesCitedWos(groupId) {
        const view = this.currentJsonView || '';
        const groups = this.getCurrentGroups();
        const target = groups.find(g => g.id === groupId);
        if (!target) return;
        const files = (target.files || []).slice();
        if (!files.length) return;

        const prev = this.groupSortState[groupId]?.timesCitedWos || 'desc';
        const nextDir = prev === 'asc' ? 'desc' : 'asc';
        this.groupSortState[groupId] = { ...(this.groupSortState[groupId] || {}), timesCitedWos: nextDir };

        const fetchCited = async (base) => {
            const path = this.getViewPathForBase(base, view);
            if (!path) return { cited: null, base };
            try {
                const data = await this.readProjectFile(path);
                const wos = data?.wos_data || {};
                const raw = wos.times_cited_wos ?? wos.timesCitedWos ?? wos.times_cited;
                const val = Array.isArray(raw) ? raw[0] : raw;
                const parsed = val !== undefined && val !== null ? Number(String(val).trim()) : NaN;
                const cited = Number.isFinite(parsed) ? parsed : null;
                return { cited, base };
            } catch (err) {
                console.warn('sortGroupByTimesCitedWos fetch failed for', base, err);
                return { cited: null, base };
            }
        };

        const results = await Promise.all(files.map(f => fetchCited(f)));
        const dir = nextDir === 'asc' ? 1 : -1;
        const order = results
            .sort((a, b) => {
                const aMissing = !Number.isFinite(a.cited);
                const bMissing = !Number.isFinite(b.cited);
                if (aMissing && bMissing) return a.base.localeCompare(b.base);
                if (aMissing) return 1;
                if (bMissing) return -1;
                return (a.cited - b.cited) * dir || a.base.localeCompare(b.base);
            })
            .map(r => r.base);

        target.files = order;
        this.persistGroupsAndRender(groups, this.currentFile);
        const label = nextDir === 'asc' ? 'ascending' : 'descending';
        this.showNotification(`Sorted by times_cited_wos (${label})`, 'success');
    }

    async sortGroupByTimesCitedAll(groupId) {
        const view = this.currentJsonView || '';
        const groups = this.getCurrentGroups();
        const target = groups.find(g => g.id === groupId);
        if (!target) return;
        const files = (target.files || []).slice();
        if (!files.length) return;

        const prev = this.groupSortState[groupId]?.timesCitedAll || 'desc';
        const nextDir = prev === 'asc' ? 'desc' : 'asc';
        this.groupSortState[groupId] = { ...(this.groupSortState[groupId] || {}), timesCitedAll: nextDir };

        const fetchCited = async (base) => {
            const path = this.getViewPathForBase(base, view);
            if (!path) return { cited: null, base };
            try {
                const data = await this.readProjectFile(path);
                const wos = data?.wos_data || {};
                const raw = wos.times_cited_all_databases ?? wos.timesCitedAllDatabases ?? wos.times_cited_all;
                const val = Array.isArray(raw) ? raw[0] : raw;
                const parsed = val !== undefined && val !== null ? Number(String(val).trim()) : NaN;
                const cited = Number.isFinite(parsed) ? parsed : null;
                return { cited, base };
            } catch (err) {
                console.warn('sortGroupByTimesCitedAll fetch failed for', base, err);
                return { cited: null, base };
            }
        };

        const results = await Promise.all(files.map(f => fetchCited(f)));
        const dir = nextDir === 'asc' ? 1 : -1;
        const order = results
            .sort((a, b) => {
                const aMissing = !Number.isFinite(a.cited);
                const bMissing = !Number.isFinite(b.cited);
                if (aMissing && bMissing) return a.base.localeCompare(b.base);
                if (aMissing) return 1;
                if (bMissing) return -1;
                return (a.cited - b.cited) * dir || a.base.localeCompare(b.base);
            })
            .map(r => r.base);

        target.files = order;
        this.persistGroupsAndRender(groups, this.currentFile);
        const label = nextDir === 'asc' ? 'ascending' : 'descending';
        this.showNotification(`Sorted by times_cited_all_databases (${label})`, 'success');
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

    getGlobalSettingsKey() {
        return 'globalAppSettings';
    }

    loadGlobalSettings() {
        const defaults = {
            wosSid: '',
            easychoralApi: '',
            openaiApi: ''
        };
        try {
            const raw = localStorage.getItem(this.getGlobalSettingsKey());
            if (!raw) return { ...defaults };
            const parsed = JSON.parse(raw);
            return { ...defaults, ...(parsed || {}) };
        } catch (_err) {
            return { ...defaults };
        }
    }

    saveGlobalSettings() {
        try {
            localStorage.setItem(this.getGlobalSettingsKey(), JSON.stringify(this.globalSettings || {}));
        } catch (_err) {
            // ignore
        }
        this.syncGlobalSettingsGlobals();
    }

    syncGlobalSettingsGlobals() {
        const payload = { ...(this.globalSettings || {}) };
        window.appSettings = payload;
        window.APP_SETTINGS = payload;
        window.OPENAI_API = payload.openaiApi || '';
    }

    maskApiValue(value = '') {
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (raw.length <= 4) return `${raw[0]}****`;
        if (raw.length <= 8) return `${raw.slice(0, 2)}****${raw.slice(-2)}`;
        return `${raw.slice(0, 4)}****${raw.slice(-4)}`;
    }

    applyApiSettingsInputs() {
        const openaiInput = document.getElementById('openaiApiInput');
        const setMasked = (input, raw) => {
            if (!input) return;
            const clean = String(raw || '');
            input.dataset.raw = clean;
            if (!clean) {
                input.dataset.masked = '0';
                input.value = '';
                return;
            }
            input.dataset.masked = '1';
            input.value = this.maskApiValue(clean);
        };
        setMasked(openaiInput, this.globalSettings?.openaiApi || '');
    }

    bindApiSettingsInputs() {
        const openaiInput = document.getElementById('openaiApiInput');
        if (!openaiInput) return;

        const handleMaskedFocus = (input) => {
            if (input.dataset.masked === '1') {
                input.value = input.dataset.raw || '';
                input.dataset.masked = '0';
            }
        };

        const handleMaskedBlur = (key, input) => {
            const raw = String(input.value || '').trim();
            this.globalSettings[key] = raw;
            this.saveGlobalSettings();
            this.applyApiSettingsInputs();
        };

        openaiInput.addEventListener('focus', () => handleMaskedFocus(openaiInput));
        openaiInput.addEventListener('blur', () => handleMaskedBlur('openaiApi', openaiInput));

        this.applyApiSettingsInputs();
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

    refreshMermaidTheme() {
        // 刷新所有已渲染的 mermaid 图表以应用新主题
        if (!window.mermaid) return;

        try {
            const mermaidElements = document.querySelectorAll('.mermaid[data-processed="true"]');
            mermaidElements.forEach((element) => {
                // 保存原始代码
                const originalCode = element.getAttribute('data-mermaid-code') || element.textContent;

                // 移除渲染结果
                element.removeAttribute('data-processed');
                element.innerHTML = '';
                element.textContent = originalCode;

                // 保存代码以便重新渲染
                element.setAttribute('data-mermaid-code', originalCode);
            });

            // 重新渲染所有 mermaid 图表
            const elementsToRender = document.querySelectorAll('.mermaid:not([data-processed])');
            if (elementsToRender.length > 0) {
                if (typeof window.mermaid.run === 'function') {
                    window.mermaid.run({ nodes: elementsToRender });
                } else {
                    window.mermaid.init(undefined, elementsToRender);
                }
            }
        } catch (err) {
            console.warn('Mermaid theme refresh failed:', err);
        }
    }

    initMermaid() {
        if (window.mermaid) {
            try {
                const isDark = this.theme === 'dark';
                // 使用 neutral 主题（黑白学术风格）
                window.mermaid.initialize({
                    startOnLoad: false,
                    theme: 'neutral',
                    themeVariables: {
                        // 学术黑白配色 - 通用变量
                        fontFamily: 'Georgia, "Times New Roman", serif',
                        fontSize: '14px',

                        // 背景透明
                        background: 'transparent',
                        mainBkg: 'transparent',

                        // 文字颜色 - 根据主题调整
                        primaryTextColor: isDark ? '#e5e7eb' : '#1f2937',
                        secondaryTextColor: isDark ? '#d1d5db' : '#374151',
                        tertiaryTextColor: isDark ? '#9ca3af' : '#4b5563',

                        // 边框和线条 - 灰度
                        primaryBorderColor: isDark ? '#6b7280' : '#4b5563',
                        secondaryBorderColor: isDark ? '#4b5563' : '#6b7280',
                        tertiaryBorderColor: isDark ? '#374151' : '#9ca3af',

                        // 节点填充 - 浅灰
                        primaryColor: isDark ? '#374151' : '#f9fafb',
                        secondaryColor: isDark ? '#2d3741' : '#f3f4f6',
                        tertiaryColor: isDark ? '#1f2937' : '#e5e7eb',

                        // 线条颜色
                        lineColor: isDark ? '#9ca3af' : '#6b7280',

                        // 标签背景
                        edgeLabelBackground: isDark ? '#1f2937' : '#ffffff',
                        labelBackground: isDark ? '#1f2937' : '#ffffff',
                        labelTextColor: isDark ? '#e5e7eb' : '#1f2937',

                        // 序列图
                        actorBkg: isDark ? '#374151' : '#f9fafb',
                        actorBorder: isDark ? '#6b7280' : '#4b5563',
                        actorTextColor: isDark ? '#e5e7eb' : '#1f2937',
                        actorLineColor: isDark ? '#9ca3af' : '#6b7280',
                        signalColor: isDark ? '#e5e7eb' : '#1f2937',
                        signalTextColor: isDark ? '#e5e7eb' : '#1f2937',

                        // 类图
                        classText: isDark ? '#e5e7eb' : '#1f2937',

                        // 状态图
                        labelColor: isDark ? '#e5e7eb' : '#1f2937',

                        // 甘特图
                        gridColor: isDark ? '#4b5563' : '#d1d5db',
                        todayLineColor: isDark ? '#9ca3af' : '#6b7280',

                        // Git 图
                        git0: isDark ? '#4b5563' : '#e5e7eb',
                        git1: isDark ? '#6b7280' : '#d1d5db',
                        git2: isDark ? '#9ca3af' : '#9ca3af',
                        git3: isDark ? '#6b7280' : '#6b7280',
                        git4: isDark ? '#4b5563' : '#4b5563',

                        // 紧凑间距设置
                        nodePadding: 8,
                        padding: 10,
                        boxPadding: 6,
                        edgeLabelPadding: 5
                    },
                    flowchart: {
                        useMaxWidth: true,
                        htmlLabels: true,
                        curve: 'basis',
                        padding: 10,
                        nodeSpacing: 40,
                        rankSpacing: 40,
                        diagramPadding: 10
                    },
                    sequence: {
                        useMaxWidth: true,
                        wrap: true,
                        diagramMarginX: 10,
                        diagramMarginY: 10,
                        boxMargin: 8,
                        boxTextMargin: 4,
                        noteMargin: 8,
                        messageMargin: 30,
                        mirrorActors: false
                    },
                    gantt: {
                        useMaxWidth: true,
                        leftPadding: 50,
                        gridLineStartPadding: 20,
                        fontSize: 11,
                        sectionFontSize: 11
                    },
                    class: {
                        padding: 8
                    },
                    state: {
                        padding: 8
                    }
                });
            } catch (err) {
                console.warn('Mermaid initialization failed:', err);
            }
        }
    }

    toggleTheme() {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        this.applyTheme();
        this.initMermaid(); // 重新初始化 mermaid 以应用新主题
        this.persistTheme();
        // 同步到项目配置，方便重载后保持一致
        try {
            this.saveProjectConfig();
        } catch (_e) {
            // ignore
        }
        // 重新渲染当前 markdown 以更新 mermaid 图表主题
        this.refreshMermaidTheme();
        if (this.currentFile && this.view === 'markdown') {
            this.renderMarkdown();
        }
        // 重新加载已打开的 PDF，使其采用对应主题
        // 只有在autoLoadPdf开启或PDF已经显示时才重新加载
        if (this.currentPdfUrl && (this.autoLoadPdf || this.lastPdfLoadedUrl)) {
            this.lastPdfLoadedUrl = '';
            this.ensurePdfLoaded();
        }
    }

    updateThemeToggleButton(isDark) {
        const btn = document.getElementById('themeToggleBtn');
        if (!btn) return;
        const icon = btn.querySelector('i');
        btn.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
        if (icon) icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    }

    updateViewSwitchButton() {
        const btn = document.getElementById('viewSwitchBtn');
        if (!btn) return;
        const icon = btn.querySelector('i');
        const view = this.currentView || 'structured';
        if (view === 'markdown') {
            btn.title = 'Switch to JSON view';
            if (icon) icon.className = 'fas fa-table';
        } else {
            btn.title = 'Switch to Markdown view';
            if (icon) icon.className = 'fa-brands fa-markdown';
        }
    }

    renderJsonViewSelector() {
        const sel = document.getElementById('jsonViewSelect');
        if (!sel) return;
        const views = this.availableJsonViews || [];
        const current = this.currentJsonView || (views[0] || '');
        sel.innerHTML = views.map(v => `<option value="${this.escapeAttr(v)}"${v === current ? ' selected' : ''}>${this.escapeHtml(v)}</option>`).join('') || '<option value=\"\">(no views)</option>';
        this.currentJsonView = current;
    }

    loadLastJsonViewByProject() {
        try {
            const raw = localStorage.getItem('lastJsonViewByProject');
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (_e) {
            return {};
        }
    }

    persistLastJsonViewByProject() {
        try {
            localStorage.setItem('lastJsonViewByProject', JSON.stringify(this.lastJsonViewByProject || {}));
        } catch (_e) {
            // ignore
        }
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
        const key = this.getProjectKey();
        const payload = (this.qaCollapsedStateByProject && this.qaCollapsedStateByProject[key])
            ? this.qaCollapsedStateByProject[key]
            : {};
        if (this.projectStorage && this.currentProject) {
            this.projectStorage.update('qa-states', payload);
            return;
        }
        try {
            localStorage.setItem('qaCollapsedStateByProject', JSON.stringify({ [key]: payload }));
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
        const key = this.getProjectKey();
        const payload = (this.sectionExpandedStateByProject && this.sectionExpandedStateByProject[key])
            ? this.sectionExpandedStateByProject[key]
            : {};
        if (this.projectStorage && this.currentProject) {
            this.projectStorage.update('section-states', payload);
            return;
        }
        try {
            localStorage.setItem('sectionExpandedStateByProject', JSON.stringify({ [key]: payload }));
        } catch (_e) {
            // ignore
        }
    }

    async loadUiPreferencesFromStorage() {
        let stored = null;
        let fromProjectStorage = false;
        if (this.projectStorage && this.currentProject) {
            try {
                stored = await this.projectStorage.load('ui-preferences');
                fromProjectStorage = !!stored;
            } catch (_e) {
                stored = null;
            }
        }
        if (!stored) {
            const fallbackView = localStorage.getItem('lastViewMode');
            if (fallbackView) {
                stored = { lastViewMode: fallbackView };
            }
        }
        const sanitized = this.sanitizeUiPreferences(stored);
        if (!sanitized) return;
        this.uiPreferences = { ...(this.uiPreferences || {}), ...sanitized };
        const lastViewMode = sanitized.lastViewMode;
        if (lastViewMode) {
            if (lastViewMode === 'draft') {
                this.currentView = 'markdown';
                this.isDraftViewActive = true;
            } else {
                this.currentView = lastViewMode;
                this.isDraftViewActive = false;
            }
        }
        if (typeof sanitized.draftMarkdownEditing === 'boolean') {
            this.markdownEditMode.draft = sanitized.draftMarkdownEditing;
        }
        if (typeof sanitized.markdownEditing === 'boolean') {
            this.markdownEditMode.markdown = sanitized.markdownEditing;
        }
        if (this.projectStorage && this.currentProject && (!fromProjectStorage || JSON.stringify(stored) !== JSON.stringify(sanitized))) {
            await this.projectStorage.save('ui-preferences', this.uiPreferences);
        }
    }

    async loadProjectViewStatesFromStorage() {
        const key = this.getProjectKey();
        let qaState = null;
        let sectionState = null;
        if (this.projectStorage && this.currentProject) {
            try {
                qaState = await this.projectStorage.load('qa-states');
            } catch (_e) {
                qaState = null;
            }
            try {
                sectionState = await this.projectStorage.load('section-states');
            } catch (_e) {
                sectionState = null;
            }
        }
        const fallbackQa = this.loadQaCollapsedState();
        const fallbackSection = this.loadSectionExpandedState();
        const pickEntry = (map) => {
            if (!map || typeof map !== 'object') return {};
            return Object.prototype.hasOwnProperty.call(map, key) ? (map[key] || {}) : {};
        };
        this.qaCollapsedStateByProject = { [key]: qaState && typeof qaState === 'object' ? qaState : pickEntry(fallbackQa) };
        this.sectionExpandedStateByProject = { [key]: sectionState && typeof sectionState === 'object' ? sectionState : pickEntry(fallbackSection) };
        if (this.projectStorage && this.currentProject) {
            const sanitizedQa = this.qaCollapsedStateByProject[key] || {};
            const sanitizedSection = this.sectionExpandedStateByProject[key] || {};
            await this.projectStorage.save('qa-states', sanitizedQa);
            await this.projectStorage.save('section-states', sanitizedSection);
        }
    }

    updateUiPreferences(partial = {}) {
        if (!partial || typeof partial !== 'object') return;
        const merged = { ...(this.uiPreferences || {}), ...partial };
        this.uiPreferences = this.sanitizeUiPreferences(merged) || {};
        if (this.projectStorage && this.currentProject) {
            this.projectStorage.update('ui-preferences', this.uiPreferences);
        }
    }

    async saveUiPreferencesNow() {
        if (!this.projectStorage || !this.currentProject) return;
        try {
            await this.projectStorage.save('ui-preferences', this.uiPreferences || {});
        } catch (_e) {
            // ignore persistence errors
        }
    }

    sanitizeUiPreferences(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const cleaned = {};
        const projectKey = this.getProjectKey();
        if (raw.lastViewMode) cleaned.lastViewMode = raw.lastViewMode;
        if (raw.theme) cleaned.theme = raw.theme;
        if (typeof raw.editLocked !== 'undefined') cleaned.editLocked = !!raw.editLocked;
        if (typeof raw.debug !== 'undefined') cleaned.debug = raw.debug;
        if (typeof raw.draftMarkdownEditing === 'boolean') cleaned.draftMarkdownEditing = raw.draftMarkdownEditing;
        if (typeof raw.markdownEditing === 'boolean') cleaned.markdownEditing = raw.markdownEditing;
        if (typeof raw.lastJsonView !== 'undefined') {
            if (raw.lastJsonView && typeof raw.lastJsonView === 'object') {
                const view = raw.lastJsonView[projectKey];
                if (typeof view === 'string') cleaned.lastJsonView = view;
            } else if (typeof raw.lastJsonView === 'string') {
                cleaned.lastJsonView = raw.lastJsonView;
            }
        }
        if (typeof raw.lastSelectedFile !== 'undefined') {
            if (raw.lastSelectedFile && typeof raw.lastSelectedFile === 'object') {
                const file = raw.lastSelectedFile[projectKey];
                if (typeof file === 'string') cleaned.lastSelectedFile = file;
            } else if (typeof raw.lastSelectedFile === 'string') {
                cleaned.lastSelectedFile = raw.lastSelectedFile;
            }
        }
        return cleaned;
    }

    getMarkdownEditPreference(isDraft) {
        return isDraft ? !!this.markdownEditMode.draft : !!this.markdownEditMode.markdown;
    }

    setMarkdownEditPreference(isDraft, editing) {
        if (isDraft) {
            this.markdownEditMode.draft = !!editing;
        } else {
            this.markdownEditMode.markdown = !!editing;
        }
        this.updateUiPreferences({
            draftMarkdownEditing: !!this.markdownEditMode.draft,
            markdownEditing: !!this.markdownEditMode.markdown
        });
    }

    getProjectKey() {
        if (!this.currentProject) {
            return '';
        }
        // 直接返回规范化的路径，服务端会正确处理绝对路径和相对路径
        return this.normalizeProjectPathString(this.currentProject.path || '');
    }

    getRequiredProjectPath() {
        const projectPath = this.getProjectKey();
        if (!projectPath) {
            this.showNotification('Please load a project first', 'error');
            return '';
        }
        return projectPath;
    }

    normalizeFileGroups(raw) {
        if (!raw) return [];
        if (Array.isArray(raw)) {
            return raw.map((g, idx) => ({
                id: g?.id ? String(g.id) : `group-${idx + 1}`,
                name: g?.name ? String(g.name) : (g?.id ? String(g.id) : `group ${idx + 1}`),
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
            list.push({ id: 'init', name: 'init', files: [], collapsed: false });
            return list;
        }
        if (!list[0].id) list[0].id = 'init';
        if (!list[0].name) list[0].name = 'init';
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

    jumpFileSelectionToEdge(direction = 'start', extend = false) {
        const fullOrder = this.visibleFileOrder || [];
        if (!fullOrder.length) return;
        let order = fullOrder;
        const selected = this.getSelectedFilesArray();
        const anchor = (this.lastFileSelectionAnchor && fullOrder.includes(this.lastFileSelectionAnchor))
            ? this.lastFileSelectionAnchor
            : (selected.length ? selected[selected.length - 1] : (this.currentFile || fullOrder[0]));
        if (anchor) {
            const groups = this.getCurrentGroups();
            const group = groups.find(g => (g.files || []).includes(anchor));
            if (group && Array.isArray(group.files)) {
                const groupSet = new Set(group.files);
                const scoped = fullOrder.filter(f => groupSet.has(f));
                if (scoped.length) order = scoped;
            }
        }
        if (!order.length) return;
        const targetIndex = direction === 'end' ? order.length - 1 : 0;
        const target = order[targetIndex];
        if (!target) return;
        let nextSelection = [target];
        if (extend) {
            const resolvedAnchor = (anchor && order.includes(anchor))
                ? anchor
                : ((this.lastFileSelectionAnchor && order.includes(this.lastFileSelectionAnchor))
                    ? this.lastFileSelectionAnchor
                    : (selected.length ? selected[selected.length - 1] : (this.currentFile || target)));
            const startIdx = order.indexOf(resolvedAnchor);
            if (startIdx >= 0) {
                const [s, e] = startIdx <= targetIndex ? [startIdx, targetIndex] : [targetIndex, startIdx];
                nextSelection = order.slice(s, e + 1);
            }
        }
        this.setSelectedFiles(nextSelection, target);
        this.scrollFileIntoView(target, { align: direction === 'end' ? 'end' : 'start' });
        const targetEl = this.getRenderedFileItem(target);
        this.loadFile(target, targetEl);
    }

    updateFileSelectionDom() {
        const selected = this.selectedFiles || new Set();
        document.querySelectorAll('.file-item').forEach(el => {
            const fname = el.dataset.filename;
            el.classList.toggle('active', selected.has(fname));
        });
    }

    toggleGroupCollapse(groupId, opts = {}) {
        // Use the complete, unfiltered groups that were saved during last renderFileList
        const groups = this.completeGroupsForCurrentProject
            ? this.cloneFileGroups(this.completeGroupsForCurrentProject)
            : this.getCurrentGroups();
        const target = groups.find(g => g.id === groupId);
        if (!target) return;
        if (opts.collapseAll) {
            groups.forEach(g => {
                g.collapsed = true;
            });
        } else {
            target.collapsed = !target.collapsed;
        }
        this.persistGroupsAndRender(groups, this.currentFile);
    }

    deleteGroup(groupId) {
        // 'init' group cannot be deleted
        if (groupId === 'init') {
            this.showNotification('Default group "init" cannot be deleted.', 'warning');
            return;
        }
        const groups = this.getCurrentGroups();
        if (!groups.length) return;
        if (groups.length <= 1) {
            this.showNotification('At least one group must remain, cannot delete.', 'warning');
            return;
        }
        const target = groups.find(g => g.id === groupId);
        if (!target) return;
        const defaultGroup = groups[0]; // 'init' group
        const filesToMove = Array.isArray(target.files) ? [...target.files] : [];
        if (filesToMove.length) {
            const ok = window.confirm(`This group contains ${filesToMove.length} file(s). After deletion, they will be moved to the default group "${defaultGroup.name}". Confirm deletion?`);
            if (!ok) return;
            filesToMove.forEach(f => {
                if (!defaultGroup.files.includes(f)) defaultGroup.files.push(f);
            });
        }
        const filtered = groups.filter(g => g.id !== target.id);
        this.persistGroupsAndRender(filtered, this.currentFile);
        this.saveProjectConfig();
        this.showNotification('Group deleted', 'info');
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
            const name = g.name || id || `group ${idx + 1}`;
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
        if (!cleaned.length) cleaned.push({ id: 'init', name: 'init', files: [], collapsed: false });
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
            this.showNotification('JSON has been applied to memory, remember to save to file', 'success');


        } catch (err) {
            this.showNotification(`Failed to parse JSON: ${err.message}`, 'error');
        }
    }

    formatRawJson() {
        const textarea = document.getElementById('jsonEditorTextarea');
        if (!textarea) return;
        try {
            const parsed = JSON.parse(textarea.value);
            textarea.value = JSON.stringify(parsed, null, 2);
            this.showNotification('JSON has been formatted', 'success');
        } catch (err) {
            this.showNotification(`Failed to format JSON: ${err.message}`, 'error');
        }
    }

    async init() {
        // 初始化管理器
        this.specialSyntaxManager = new SpecialSyntaxManager(this);
        this.projectStorage = new ProjectStorageManager(this);
        this.doiCacheManager = new DoiCacheManager(this);

        // 初始化 DOI 缓存的 IndexedDB
        try {
            await this.doiCacheManager.init();
        } catch (err) {
            console.error('Failed to initialize DOI cache:', err);
        }

        // 加载环境信息（用于占位符和默认路径），不阻塞主流程
        this.loadEnvInfo();
        this.loadWosFieldTags();
        this.loadStatusVersion();

        // 先加载项目配置
        this.loadProjectConfig();

        // 如果没有当前项目，显示项目选择器
        if (!this.currentProject) {
            this.showProjectSelector();
            const fileListEl = document.getElementById('fileList');
            if (fileListEl) {
                fileListEl.innerHTML = '<div class="empty-state"><p>Please load a project first</p></div>';
            }
        } else {
            // 有项目则正常初始化
            await this.initializeProject();
        }

        this.setupEventListeners();
        this.bindApiSettingsInputs();
        this.updateJsonMenuState();
        this.updateAutoLoadMenuState();
        this.updateMarkdownToolbar();
        this.updateMarkdownMenuState();
        this.applyEditLockState();
        this.applyTheme();
        this.restoreStatusBarState();
        this.initMermaid();
        this.setupResizers();
        this.setupDraggableModal();
    }

    async loadStatusVersion() {
        const labelEl = document.getElementById('statusVersion');
        if (!labelEl) return;
        try {
            const resp = await fetch('manifest.json', { cache: 'no-store' });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            const version = String(data?.version || '').trim();
            if (!version) return;
            const label = `Enlightenkey ${version}`;
            labelEl.textContent = label;
            const iconLink = document.querySelector('.status-version-icon');
            if (iconLink) {
                iconLink.title = `Docker Hub: ${label}`;
                iconLink.setAttribute('aria-label', `Docker Hub: ${label}`);
            }
        } catch (err) {
            console.warn('Failed to load manifest version:', err);
        }
    }

    async loadWosFieldTags() {
        try {
            const resp = await fetch('src/schema/WosFieldTags.json', { cache: 'no-store' });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            const byTag = {};
            const byKey = {};
            const ptMap = data?.PT_value_map && typeof data.PT_value_map === 'object' ? data.PT_value_map : {};
            Object.entries(data || {}).forEach(([tag, info]) => {
                if (tag === 'PT_value_map') return;
                if (!info || typeof info !== 'object') return;
                const normalized = info.normalized_key || '';
                if (!normalized) return;
                byTag[tag] = { full_name: info.full_name || '', normalized_key: normalized };
                byKey[normalized] = { full_name: info.full_name || '', source_tag: tag };
            });
            this.wosFieldTagsByTag = byTag;
            this.wosFieldTagsByKey = byKey;
            this.wosFieldPtValueMap = ptMap;
        } catch (err) {
            console.warn('Failed to load WOS field tags:', err);
            this.wosFieldTagsByTag = {};
            this.wosFieldTagsByKey = {};
            this.wosFieldPtValueMap = {};
        }
    }

    async initializeProject() {
        // 🔑 优先关闭独立PDF窗口（如果存在）
        this.forceEmbeddedPdfMode();

        // 更新UI显示当前项目
        this.updateProjectDisplay();

        // 尝试迁移数据到项目存储
        if (this.projectStorage && this.currentProject) {
            try {
                const citationMeta = await this.projectStorage.load('citation-meta');
                if (!citationMeta) {
                    // 首次加载项目，进行迁移
                    await this.projectStorage.migrateFromLocalStorage();
                    this.showNotification('Data has been migrated to project directory', 'success');
                }

                // 加载 citation 元数据到内存
                const meta = await this.loadCitationMetaAsync();
                Object.assign(this.citationMetaCache, meta);
            } catch (error) {
                console.warn('Failed to migrate or load project data:', error);
            }
        }

        await this.loadUiPreferencesFromStorage();
        await this.loadProjectViewStatesFromStorage();
        this.updateViewTabs();
        await this.loadFileFilterHistory();
        this.renderFileFilterHistory();
        this.applySettingsPanelsState(this.loadSettingsPanelsState(), { skipView: true });

        // 加载文件列表
        await this.loadFileList();
        await this.applyCurrentView();
        this.setupEditableListeners();

        // 构建 DOI 缓存（异步，不阻塞主流程）
        if (this.doiCacheManager) {
            this.doiCacheManager.getCacheData().then(() => {
                console.log('DOI cache ready for autocomplete');
            }).catch(err => {
                console.error('Failed to build DOI cache:', err);
            });
        }
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
            const pathText = this.currentProject.path || this.currentProject.name;
            nameEl.textContent = pathText;
            nameEl.title = pathText;
        } else {
            nameEl.textContent = 'Click to create or switch project';
            nameEl.title = 'Click to create or switch project';
        }
    }

    setActivePanel(panel) {
        if (this.activePanel === panel) return;
        this.activePanel = panel;
        this.isLeftActive = panel === 'left';
        this.isMiddleActive = panel === 'middle';
        this.isRightActive = panel === 'right';
        const leftPanel = document.querySelector('.left-panel');
        const middlePanel = document.querySelector('.middle-panel');
        const rightPanel = document.querySelector('.right-panel');
        if (leftPanel) leftPanel.classList.toggle('panel-active', this.isLeftActive);
        if (middlePanel) middlePanel.classList.toggle('panel-active', this.isMiddleActive);
        if (rightPanel) rightPanel.classList.toggle('panel-active', this.isRightActive);
    }

    setupEventListeners() {
        if (this._eventListenersBound) return;
        this._eventListenersBound = true;
        // 跟踪鼠标是否悬停在pdfViewer上（用于ESC键判断）
        const setupPdfViewerHover = () => {
            const pdfViewer = document.getElementById('pdfViewer');
            if (pdfViewer && !pdfViewer.dataset.hoverBound) {
                pdfViewer.addEventListener('mouseenter', () => {
                    this._isMouseOverPdfViewer = true;
                });
                pdfViewer.addEventListener('mouseleave', () => {
                    this._isMouseOverPdfViewer = false;
                });
                pdfViewer.dataset.hoverBound = '1';
            }
        };
        // 立即尝试设置
        setupPdfViewerHover();
        // 延迟再次尝试（防止元素还未加载）
        setTimeout(setupPdfViewerHover, 500);

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchView(e.target.closest('.tab-btn')));
        });
        if (!this._virtualResizeBound) {
            this._virtualResizeBound = true;
            window.addEventListener('resize', () => {
                this.renderAllVirtualGroups(true);
            });
        }
        const statusSaveBtn = document.getElementById('statusSaveBtn');
        if (statusSaveBtn) {
            statusSaveBtn.addEventListener('click', () => this.handleSaveShortcut());
        }
        const statusToggleSourceBtn = document.getElementById('statusToggleSourceBtn');
        if (statusToggleSourceBtn) {
            statusToggleSourceBtn.addEventListener('click', () => this.toggleJsonMdSource());
        }
        // CLI Menu
        const cliMenuDropdown = document.getElementById('cliMenuDropdown');
        const cliMenuToggleBtn = document.getElementById('cliMenuToggleBtn');
        const cliMenu = document.getElementById('cliMenu');
        const openCodexCliMenuItem = document.getElementById('openCodexCliMenuItem');
        const openClaudeCliMenuItem = document.getElementById('openClaudeCliMenuItem');

        if (cliMenuToggleBtn && cliMenu) {
            cliMenuToggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleCliMenu();
            });
            cliMenu.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            document.addEventListener('click', (e) => {
                if (!this.cliMenuVisible) return;
                if (cliMenuDropdown && cliMenuDropdown.contains(e.target)) return;
                this.toggleCliMenu(false);
            });
        }
        if (openCodexCliMenuItem) {
            openCodexCliMenuItem.addEventListener('click', () => {
                this.openCodexCli();
                this.toggleCliMenu(false);
            });
        }
        if (openClaudeCliMenuItem) {
            openClaudeCliMenuItem.addEventListener('click', () => {
                this.openClaudeCli();
                this.toggleCliMenu(false);
            });
        }
        this.initMarkdownChatPanel();
        // 快捷键：Cmd/Ctrl + E 正向切换（JSON/MD/Draft），Cmd/Ctrl + Shift + E 反向切换
        document.addEventListener('keydown', (e) => {
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const mod = isMac ? e.metaKey : e.ctrlKey;

            if (mod && e.key.toLowerCase() === 'e') {
                e.preventDefault();
                this.toggleTableMarkdownView(e.shiftKey);
                return;
            }
            if (mod && e.key === ',') {
                e.preventDefault();
                this.switchToView('settings');
                return;
            }
            if (mod && e.key === '/') {
                e.preventDefault();
                if ((this.currentView || 'structured') === 'settings') {
                    this.switchToView('draft');
                    return;
                }
                this.toggleJsonMdSource();
            }
        });
        // JSON 菜单：表格视图 / JSON 代码 / JSON 保存
        const jsonMenuToggleBtn = document.getElementById('jsonMenuToggleBtn');
        const jsonMenu = document.getElementById('jsonMenu');
        const jsonViewStructuredItem = document.getElementById('jsonViewStructuredItem');
        const jsonViewFlatItem = document.getElementById('jsonViewFlatItem');
        const jsonFormatItem = document.getElementById('jsonFormatItem');
        const jsonAddFieldItem = document.getElementById('jsonAddFieldItem');
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
        if (jsonAddFieldItem) {
            jsonAddFieldItem.addEventListener('click', async (e) => {
                e.preventDefault();
                if (this.isEditLocked) {
                    this.showLockedNotification('添加字段');
                    return;
                }
                if (!this.currentFile || !this.currentData) {
                    this.showNotification('Please load a JSON file first', 'error');
                    return;
                }
                if ((this.currentView || 'structured') !== 'structured') {
                    await this.switchToView('structured');
                }
                this.hideSectionPreview();
                this.createEmptySectionTemplate();
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
                if (!this.hasUnsavedChanges && !(this.currentFile && this.tempDataCache[this.currentFile])) return;
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
                if (this.isDraftViewActive) {
                    if (this.isMarkdownEditing) this.toggleMarkdownEdit(false, { skipConfirm: true });
                    this.renderMarkdownView(this.currentMarkdownText || '');
                } else {
                    await this.switchToView('markdown');
                    if (this.isMarkdownEditing) this.toggleMarkdownEdit(false, { skipConfirm: true });
                    // 确保渲染刷新
                    this.renderMarkdownView(this.currentMarkdownText || '');
                }
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
            mdClearCiteCacheItem.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.clearAllProjectCitationCache();
                this.toggleMdMenu(false);
            });
        }
        if (mdClearCiteCacheCurrentItem) {
            mdClearCiteCacheCurrentItem.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.clearCurrentMarkdownCitationCache();
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
        const mdDeleteItem = document.getElementById('mdDeleteItem');
        if (mdDeleteItem) {
            mdDeleteItem.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.deleteCurrentMarkdownFile();
                this.toggleMdMenu(false);
            });
        }
        const mdTextarea = document.getElementById('markdownTextarea');
        if (mdTextarea) {
            mdTextarea.addEventListener('input', () => this.onMarkdownEditorInput());

            // 初始化自动补全功能
            if (typeof AutocompleteManager !== 'undefined') {
                this.autocompleteManager = new AutocompleteManager(mdTextarea, {
                    triggerChar: '\\',
                    minChars: 0,
                    maxSuggestions: 0,
                    pathProvider: {
                        getSuggestions: (context) => this.getJsonPathAutocompleteSuggestions(context)
                    },
                    doiProvider: {
                        getSuggestions: (context) => this.getDoiAutocompleteSuggestions(context)
                    }
                });
                console.log('✓ Autocomplete initialized for markdown editor');
            }
        }

        const jsonViewSelect = document.getElementById('jsonViewSelect');
        if (jsonViewSelect) {
            // 始终回到表格视图，即便选择当前项
            jsonViewSelect.addEventListener('change', async (e) => {
                const val = e.target.value;
                const changed = val && val !== this.currentJsonView;
                if (val) {
                    this.currentJsonView = val;
                    const key = this.getProjectKey();
                    this.lastJsonViewByProject[key] = val;
                    this.persistLastJsonViewByProject();
                }
                await this.switchToView('structured');
                this.renderJsonViewSelector();

                // Re-render file list with filtering applied to current view
                // Use allProjectFiles instead of currentFileList to get all files, then filter by view
                const filesToRender = this.allProjectFiles || [];
                // Ensure all files are assigned to groups, especially files that appear in the new view
                const ensuredGroups = this.ensureInitGroupExists(filesToRender);
                this.renderFileList(filesToRender, this.currentFileBase || null, true, ensuredGroups);
                this.refreshQueryFieldOptions().catch(() => { });
                if (this.fileFilterVisible) {
                    this.renderFileFilterConditions();
                }

                // If the current file doesn't exist in the new view, clear it and show the view
                if (changed && this.currentFileBase) {
                    const entry = this.fileMetaByBase?.[this.currentFileBase];
                    const hasInCurrentView = !!(entry?.views && entry.views[this.currentJsonView]);
                    if (!hasInCurrentView) {
                        // Current file doesn't exist in new view, clear it
                        this.currentFile = null;
                        this.currentFileBase = null;
                        this.currentData = null;
                        const middleContent = document.getElementById('middleContent');
                        if (middleContent) {
                            const structuredView = middleContent.querySelector('.structured-view');
                            if (structuredView) {
                                structuredView.innerHTML = '<div class="empty-state"><i class="fas fa-code"></i><h3>No File Selected</h3><p>Select a JSON file from the left panel to view data</p></div>';
                            }
                        }
                    } else {
                        // File exists in new view, reload it
                        this.loadFile(this.currentFileBase);
                    }
                }
            });
            jsonViewSelect.addEventListener('click', async () => {
                if (this.currentView !== 'structured') {
                    await this.switchToView('structured');
                }
            });
        }
        // 编辑锁定功能已移到设置菜单中
        const gotoCancelBtn = document.getElementById('gotoEditCancel');
        const gotoSaveBtn = document.getElementById('gotoEditSave');
        const gotoTestBtn = document.getElementById('gotoEditTest');
        const gotoModal = document.getElementById('gotoEditModal');
        if (gotoCancelBtn) gotoCancelBtn.addEventListener('click', () => this.closeGotoEditModal(false));
        if (gotoSaveBtn) gotoSaveBtn.addEventListener('click', () => this.closeGotoEditModal(true));
        if (gotoTestBtn) gotoTestBtn.addEventListener('click', () => this.testGotoSearch());
        if (gotoModal) {
            gotoModal.addEventListener('click', (e) => {
                if (e.target === gotoModal) this.closeGotoEditModal(false);
            });
        }

        // 面板激活状态（点击左/中/右）
        const middlePanel = document.querySelector('.middle-panel');
        if (middlePanel) {
            middlePanel.addEventListener('mousedown', () => this.setActivePanel('middle'));
        }
        const leftPanel = document.querySelector('.left-panel');
        if (leftPanel) {
            leftPanel.addEventListener('mousedown', () => this.setActivePanel('left'));
        }
        const rightPanelEl = document.querySelector('.right-panel');
        if (rightPanelEl) {
            rightPanelEl.addEventListener('mousedown', () => this.setActivePanel('right'));
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
        const queryExportBtn = document.getElementById('queryExportBtn');
        if (queryExportBtn) {
            queryExportBtn.addEventListener('click', () => {
                this.toggleQueryExportPanel();
            });
        }
        const queryCancelBtn = document.getElementById('queryCancelBtn');
        if (queryCancelBtn) {
            queryCancelBtn.addEventListener('click', () => this.closeQueryExportModal());
        }
        const queryExportRunBtn = document.getElementById('queryExportRunBtn');
        if (queryExportRunBtn) {
            queryExportRunBtn.addEventListener('click', () => this.exportQueryData());
        }
        const queryUpdateNoBtn = document.getElementById('queryUpdateNoBtn');
        if (queryUpdateNoBtn) {
            queryUpdateNoBtn.addEventListener('click', () => this.updateDoiSequenceNumbers());
        }
        const querySelectAllBtn = document.getElementById('querySelectAllBtn');
        if (querySelectAllBtn) {
            querySelectAllBtn.addEventListener('click', () => {
                this.queryFieldOptions.forEach(f => this.queryFieldSelected.add(f));
                this.renderQueryFieldList();
            });
        }
        const queryClearAllBtn = document.getElementById('queryClearAllBtn');
        if (queryClearAllBtn) {
            queryClearAllBtn.addEventListener('click', () => {
                this.queryFieldSelected.clear();
                this.renderQueryFieldList();
            });
        }
        const queryClearSelectedBtn = document.getElementById('queryClearSelectedBtn');
        if (queryClearSelectedBtn) {
            queryClearSelectedBtn.addEventListener('click', () => {
                this.queryFieldSelected.clear();
                this.renderQueryFieldList();
            });
        }
        const queryRefreshFieldsBtn = document.getElementById('queryRefreshFieldsBtn');
        if (queryRefreshFieldsBtn) {
            queryRefreshFieldsBtn.addEventListener('click', () => this.refreshQueryFieldOptions());
        }
        const queryFieldFilterInput = document.getElementById('queryFieldFilterInput');
        if (queryFieldFilterInput) {
            queryFieldFilterInput.addEventListener('input', () => {
                this.renderQueryFieldList(queryFieldFilterInput.value || '');
            });
        }
        const queryDoiOrderInput = document.getElementById('queryDoiOrderInput');
        if (queryDoiOrderInput) {
            queryDoiOrderInput.addEventListener('input', (e) => {
                this.queryDoiOrderText = e.target.value || '';
                this.updateDoiStats();
            });
        }

        // Item category change
        document.getElementById('itemCategory').addEventListener('change', (e) => {
            const customGroup = document.getElementById('customKeyGroup');
            customGroup.style.display = e.target.value === 'custom' ? 'block' : 'none';
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            const mod = e.metaKey || e.ctrlKey;
            const key = (e.key || '').toLowerCase();
            if (mod && e.code === 'Space') {
                e.preventDefault();
                const btn = document.getElementById('mdChatToggleBtn');
                if (btn) {
                    btn.click();
                }
                return;
            }
            if (mod && !e.shiftKey && key === 'f' && this.isLeftActive) {
                e.preventDefault();
                this.toggleFileFilter();
                return;
            }
            if (mod && !e.shiftKey && key === 'i') {
                e.preventDefault();
                this.openCodexCli();
                return;
            }
            if (mod && !e.shiftKey && key === 'o') {
                e.preventDefault();
                this.showProjectSelector();
                return;
            }
            if (mod && !e.shiftKey && key === 'u') {
                e.preventDefault();
                this.toggleTheme();
                return;
            }
            if (mod && !e.shiftKey && key === 'j') {
                e.preventDefault();
                console.log('[Shortcut] Cmd/Ctrl + J triggered, switching to structured view');
                this.switchToView('structured').catch(err => console.error('[Shortcut] Error switching to structured:', err));
                return;
            }
            if (mod && !e.shiftKey && key === 'm') {
                e.preventDefault();
                console.log('[Shortcut] Cmd/Ctrl + M triggered, switching to markdown view');
                this.switchToView('markdown').catch(err => console.error('[Shortcut] Error switching to markdown:', err));
                return;
            }
            if (mod && !e.shiftKey && key === 'd') {
                if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) return;
                e.preventDefault();
                e.stopPropagation();
                console.log('[Shortcut] Cmd/Ctrl + D triggered, switching to draft view');
                this.switchToView('draft').catch(err => console.error('[Shortcut] Error switching to draft:', err));
                return;
            }
            if (mod && (e.key === 'Delete' || e.key === 'Backspace') && this.isLeftActive) {
                if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) return;
                if (this.groupMenuState) return;
                const selected = this.getSelectedFilesArray();
                const single = selected.length ? selected[selected.length - 1] : this.currentFile;
                if (!selected.length && !single) return;
                e.preventDefault();
                if (selected.length > 1) {
                    this.deleteSelectedFilesAll();
                } else if (single) {
                    const fileItem = this.getRenderedFileItem(single);
                    this.deleteFile(single, fileItem, true);
                }
                return;
            }
            if (mod && !e.shiftKey && key === 's') {
                e.preventDefault();
                this.handleSaveShortcut();
                return;
            }
            if (key === 'escape') {
                // 如果PDF在独立窗口模式，只有当鼠标悬停在pdfViewer上才切换回内嵌模式
                if (this.isPdfPopupMode && this._isMouseOverPdfViewer) {
                    e.preventDefault();
                    this.togglePdfPopup().catch(err => console.error('Toggle PDF popup failed:', err));
                    return;
                }
                if (this.handleSettingsPanelEscape()) {
                    e.preventDefault();
                    return;
                }
                if ((this.currentView || '') === 'settings') {
                    return;
                }
                this.closeQueryExportModal();
                this.closeImportModeDialog();
                this.closeSyncModeDialog();
                this.closeJsonTargetDialog();
                this.closeCreateGroupDialog();
            }
            // 锁定时，仅当鼠标在中间栏时才拦截结构区的排序/移动
            const middleActive = !!this.isMiddleActive;
            const leftActive = !!this.isLeftActive;
            if (this.isEditLocked && middleActive && (key === 'k' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                // 锁定时禁止排序模式切换和上下移动
                if (mod && !e.shiftKey && key === 'k') {
                    e.preventDefault();
                    this.showLockedNotification('Adjust order');

                } else if (this.isReorderMode || this.selectedItem) {
                    e.preventDefault();
                    this.showLockedNotification('Adjust order');
                }
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
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'x') {
                e.preventDefault();
                this.toggleStatusBarVisibility();
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
                    this.isReorderMode ? 'Reorder mode enabled (drag left column to adjust order)' : 'Reorder mode disabled',
                    this.isCollapseAll ? 'All collapsed' : 'All expanded'
                ].join(' | ');
                this.showNotification(msg, 'info');
                return;
            }
            if (leftActive && !mod && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) return;
                if (this.groupMenuState) return;
                const selected = this.getSelectedFilesArray();
                if (!selected.length) return;
                e.preventDefault();
                const offset = e.key === 'ArrowLeft' ? -1 : 1;
                const target = selected[selected.length - 1];
                this.reorderFileItem(target, offset);
                return;
            }
            if (this.isReorderMode && this.reorderSelected && middleActive && mod && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                // 调整顺序需按下 Cmd/Ctrl + 上/下，且鼠标需在中间栏
                e.preventDefault();
                const offset = e.key === 'ArrowUp' ? -1 : 1;
                this.moveKey(this.reorderSelected.path, this.reorderSelected.key, offset);
            } else if (!this.isReorderMode && this.selectedItem && middleActive && mod && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                // 调整选中项顺序需 Cmd/Ctrl + 上/下，且鼠标需在中间栏
                if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) return;
                if (!this.isMiddleActive) return; // 仅当中间栏激活时允许键盘上下移动
                e.preventDefault();
                const offset = e.key === 'ArrowUp' ? -1 : 1;
                this.moveSelectedItem(offset);
            } else if (!this.isReorderMode && middleActive && !mod && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) return;
                if ((this.currentView || 'structured') !== 'structured') return;
                const offset = e.key === 'ArrowUp' ? -1 : 1;
                this.moveSectionSelection(offset);
                e.preventDefault();
            } else if (!middleActive && leftActive && mod && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) return;
                if (this.groupMenuState) return;
                e.preventDefault();
                const direction = e.key === 'ArrowUp' ? 'start' : 'end';
                const extend = !!e.shiftKey;
                this.jumpFileSelectionToEdge(direction, extend);
            } else if (!middleActive && leftActive && !mod && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                // 仅当左侧栏激活时，允许上下键控制左侧文件列表
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
                if (fname && listEl) {
                    this.setSelectedFiles([fname], fname);
                    this.scrollFileIntoView(fname, { align: 'center' });
                    const target = this.getRenderedFileItem(fname);
                    this.loadFile(fname, target);
                }
            }
            if (middleActive && !mod && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) return;
                if (this.isReorderMode) return;
                if (!this.selectedItem || this.selectedItem.type !== 'section') return;
                const shouldExpand = e.key === 'ArrowRight';
                this.toggleSectionByKey(this.selectedItem.key, shouldExpand);
                e.preventDefault();
                return;
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
        // 浏览项目目录
        const folderBrowser = document.getElementById('projectFolderBrowser');
        if (folderBrowser) {
            folderBrowser.addEventListener('change', (e) => {
                this.handleBrowserSelection(e);
            });
        }

        document.getElementById('loadProjectBtn').addEventListener('click', () => {
            this.loadSelectedProject();
        });
        document.getElementById('initProjectBtn')?.addEventListener('click', () => {
            this.initProjectFromPath();
        });

        // 创建新项目按钮
        document.getElementById('createProjectBtn').addEventListener('click', () => {
            this.handleCreateProject();
        });

        const thirdPartyInfoBtn = document.getElementById('thirdPartyInfoBtn');
        if (thirdPartyInfoBtn) {
            thirdPartyInfoBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.settingsMenuVisible) {
                    this.toggleSettingsMenu(false);
                }
                this.toggleThirdPartyInfoPanel();
            });
        }
        const projectNameBtn = document.getElementById('currentProjectName');
        if (projectNameBtn) {
            projectNameBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.projectInfoVisible) {
                    this.toggleProjectInfoPanel(false, { skipClose: true });
                    return;
                }
                this.showProjectDetailsPanel();
            });
        }

        // 点击文件夹图标也可以打开项目面板
        const folderIcon = document.querySelector('.status-left-icon');
        if (folderIcon) {
            folderIcon.style.cursor = 'pointer';
            folderIcon.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.projectInfoVisible) {
                    this.toggleProjectInfoPanel(false, { skipClose: true });
                    return;
                }
                this.showProjectDetailsPanel();
            });
        }

        const statusProject = document.querySelector('.status-project');
        if (statusProject && projectNameBtn) {
            statusProject.addEventListener('click', (e) => {
                if (e.target.closest('#currentProjectName')) return;
                e.preventDefault();
                e.stopPropagation();
                projectNameBtn.click();
            });
            statusProject.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showStatusProjectContextMenu(e);
            });
        }
        const shortcutsInfoBtn = document.getElementById('shortcutsInfoBtn');
        if (shortcutsInfoBtn) {
            shortcutsInfoBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.settingsMenuVisible) {
                    this.toggleSettingsMenu(false);
                }
                this.toggleShortcutsPanel();
            });
        }
        const importJsonFolderInput = document.getElementById('importJsonFolderInput');
        const importJsonFileInput = document.getElementById('importJsonFileInput');
        const importPdfInput = document.getElementById('importPdfInput');
        const importWosInput = document.getElementById('importWosInput');
        const importMenuToggleBtn = document.getElementById('importMenuToggleBtn');
        const importMenu = document.getElementById('importMenu');
        const importMenuDropdown = document.getElementById('importMenuDropdown');
        const importDoiMenuItem = document.getElementById('importDoiMenuItem');
        const importJsonMenuItem = document.getElementById('importJsonMenuItem');
        const importJsonFileMenuItem = document.getElementById('importJsonFileMenuItem');
        const importPdfMenuItem = document.getElementById('importPdfMenuItem');
        const importWosMenuItem = document.getElementById('importWosMenuItem');
        const apiSettingsMenuItem = document.getElementById('apiSettingsMenuItem');
        if (importJsonFolderInput) {
            importJsonFolderInput.addEventListener('change', (e) => this.handleJsonFolderImport(e));
        }
        if (importJsonFileInput) {
            importJsonFileInput.addEventListener('change', (e) => this.handleJsonFileImport(e));
        }
        if (importPdfInput) {
            importPdfInput.addEventListener('change', (e) => this.handlePdfImportInput(e));
        }
        if (importWosInput) {
            importWosInput.addEventListener('change', (e) => this.handleWosTxtImport(e));
        }
        if (importMenuToggleBtn && importMenu) {
            importMenuToggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleImportMenu();
                this.constrainDropdownMenu(importMenu, importMenuDropdown);
            });
            importMenu.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            document.addEventListener('click', (e) => {
                if (!this.importMenuVisible) return;
                if (importMenuDropdown && importMenuDropdown.contains(e.target)) return;
                this.toggleImportMenu(false);
            });
        }
        if (importJsonMenuItem && importJsonFolderInput) {
            importJsonMenuItem.addEventListener('click', (e) => {
                e.preventDefault();
                this.startImportJsonFlow(importJsonFolderInput);
                this.toggleImportMenu(false);
            });
        }
        if (importJsonFileMenuItem && importJsonFileInput) {
            importJsonFileMenuItem.addEventListener('click', (e) => {
                e.preventDefault();
                importJsonFileInput.click();
                this.toggleImportMenu(false);
            });
        }
        if (importDoiMenuItem) {
            importDoiMenuItem.addEventListener('click', (e) => {
                e.preventDefault();
                this.openDoiModal();
                this.toggleImportMenu(false);
            });
        }
        if (importPdfMenuItem && importPdfInput) {
            importPdfMenuItem.addEventListener('click', (e) => {
                e.preventDefault();
                importPdfInput.click();
                this.toggleImportMenu(false);
            });
        }
        if (importWosMenuItem && importWosInput) {
            importWosMenuItem.addEventListener('click', (e) => {
                e.preventDefault();
                importWosInput.click();
                this.toggleImportMenu(false);
            });
        }
        if (apiSettingsMenuItem) {
            apiSettingsMenuItem.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleApiSettingsPanel(true);
                this.toggleSettingsMenu(false);
            });
        }
        const autoSaveSettingsMenuItem = document.getElementById('autoSaveSettingsMenuItem');
        if (autoSaveSettingsMenuItem) {
            autoSaveSettingsMenuItem.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleAutoSavePanel(); // 切换显示/隐藏
                this.toggleSettingsMenu(false);
            });
        }
        // 左侧文件列表：鼠标激活后可用上下键快速切换
        const fileListEl = document.getElementById('fileList');
        if (fileListEl) {
            fileListEl.tabIndex = 0;
            fileListEl.addEventListener('mouseenter', () => {
                fileListEl.focus({ preventScroll: true });
            });
        }

        // 文件过滤
        const fileFilterInput = document.getElementById('fileFilterInput');
        if (fileFilterInput) {
            fileFilterInput.value = this.fileFilter || '';
            fileFilterInput.addEventListener('input', (e) => {
                const val = (e.target.value || '').trim();
                this.fileFilter = val;
            });
            fileFilterInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.runFileFilter();
                }
            });
        }
        const fileFilterAddConditionBtn = document.getElementById('fileFilterAddConditionBtn');
        if (fileFilterAddConditionBtn) {
            fileFilterAddConditionBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.addFileFilterCondition();
            });
        }
        const fileFilterHistoryClearBtn = document.getElementById('fileFilterHistoryClearBtn');
        if (fileFilterHistoryClearBtn) {
            fileFilterHistoryClearBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.clearFileFilterHistory();
            });
        }
        this.ensureFileFilterConditions();
        this.renderFileFilterConditions();
        this.renderFileFilterHistory();
        const fileFilterToggleBtn = document.getElementById('fileFilterToggleBtn');
        if (fileFilterToggleBtn) {
            fileFilterToggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleFileFilter();
            });
        }
        const fileFilterRunBtn = document.getElementById('fileFilterRunBtn');
        if (fileFilterRunBtn) {
            fileFilterRunBtn.addEventListener('click', () => this.runFileFilter());
        }
        const addGroupBtn = document.getElementById('addGroupBtn');
        if (addGroupBtn) {
            addGroupBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleCreateGroupPanel();
            });
        }
        // 绑定自动保存配置按钮
        const autoSaveConfigToggleBtn = document.getElementById('autoSaveConfigToggleBtn');
        if (autoSaveConfigToggleBtn) {
            autoSaveConfigToggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleAutoSaveConfigPanel();
            });
        }
        // 绑定创建分组确认按钮
        const confirmCreateGroupBtn = document.getElementById('confirmCreateGroupBtn');
        if (confirmCreateGroupBtn) {
            confirmCreateGroupBtn.addEventListener('click', () => {
                this.handleConfirmCreateGroups();
            });
        }
        const themeToggleBtn = document.getElementById('themeToggleBtn');
        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', () => this.toggleTheme());
            this.updateThemeToggleButton(this.theme === 'dark');
        }
        const statusBarPositionToggleBtn = document.getElementById('statusBarPositionToggleBtn');
        if (statusBarPositionToggleBtn) {
            statusBarPositionToggleBtn.addEventListener('click', () => this.toggleStatusBarPosition());
        }
        const settingsToggleBtn = document.getElementById('settingsToggleBtn');
        const settingsMenu = document.getElementById('settingsMenu');
        const settingsDropdown = document.getElementById('settingsDropdown');
        const autoLoadOnItem = document.getElementById('autoLoadOnItem');
        const autoLoadOffItem = document.getElementById('autoLoadOffItem');
        const fixAllMdDoisBtn = document.getElementById('fixAllMdDoisBtn');
        const fixAllJsonDoisBtn = document.getElementById('fixAllJsonDoisBtn');
        const refreshDoiCacheBtn = document.getElementById('refreshDoiCacheBtn');
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
        // 编辑锁定菜单项
        const editLockOnItem = document.getElementById('editLockOnItem');
        const editLockOffItem = document.getElementById('editLockOffItem');
        if (editLockOnItem) {
            editLockOnItem.addEventListener('click', () => {
                this.setEditLock(true);
                this.toggleSettingsMenu(false);
            });
        }
        if (editLockOffItem) {
            editLockOffItem.addEventListener('click', () => {
                this.setEditLock(false);
                this.toggleSettingsMenu(false);
            });
        }
        if (fixAllMdDoisBtn) {
            fixAllMdDoisBtn.addEventListener('click', async () => {
                this.toggleSettingsMenu(false);
                if (confirm('Are you sure you want to batch fix DOIs in all MD files?\n\nThis will correct the DOI field in the frontmatter of all MD files to only include the filename (removing the path portion).')) {
                    await this.fixAllMarkdownDois();
                }
            });
        }
        if (fixAllJsonDoisBtn) {
            fixAllJsonDoisBtn.addEventListener('click', async () => {
                this.toggleSettingsMenu(false);
                if (confirm('Are you sure you want to batch fix meta_info.doi in all JSON files?\n\nThis will extract a valid DOI via regex and normalize the field.')) {
                    await this.fixAllJsonDois();
                }
            });
        }
        if (refreshDoiCacheBtn) {
            refreshDoiCacheBtn.addEventListener('click', async () => {
                this.toggleSettingsMenu(false);
                if (!this.doiCacheManager) {
                    this.showNotification('DOI Cache Manager not initialized', 'error');
                    return;
                }
                try {
                    await this.doiCacheManager.clearCache();
                    const data = await this.doiCacheManager.buildCache({ notify: true });
                    this.showNotification(`DOI cache refreshed: ${data.length} entries`, 'success');
                } catch (err) {
                    console.error('Failed to refresh DOI cache:', err);
                    this.showNotification(`Failed to refresh DOI cache: ${err.message}`, 'error');
                }
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

        // PDF 自动加载开关
        const pdfAutoLoadBtn = document.getElementById('btnPdfAutoLoad');
        if (pdfAutoLoadBtn) {
            pdfAutoLoadBtn.addEventListener('click', () => {
                this.setAutoLoadPdf(!this.autoLoadPdf);
            });
            this.updatePdfAutoLoadButtonState();
        }

        // PDF 独立窗口按钮
        const btnPdfPopup = document.getElementById('btnPdfPopup');
        if (btnPdfPopup) {
            btnPdfPopup.addEventListener('click', async () => await this.togglePdfPopup());
            this.updatePdfPopupButtonState();
        }

        const rightPanel = document.querySelector('.right-panel');
        if (rightPanel) {
            rightPanel.addEventListener('mousedown', () => this.ensurePdfLoaded());
            rightPanel.addEventListener('dragover', (e) => this.handlePdfPanelDragOver(e));
            rightPanel.addEventListener('dragenter', (e) => this.handlePdfPanelDragOver(e));
            rightPanel.addEventListener('drop', (e) => this.handlePdfPanelDrop(e));
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

        const doiExtractBtn = document.getElementById('doiExtractBtn');
        if (doiExtractBtn) {
            doiExtractBtn.addEventListener('click', () => this.formatDoiInput());
        }
        const doiCreateBtn = document.getElementById('doiCreateBtn');
        if (doiCreateBtn) {
            doiCreateBtn.addEventListener('click', () => this.createJsonFromDoiList());
        }
        const doiInput = document.getElementById('doiInput');
        if (doiInput) {
            doiInput.addEventListener('input', () => this.updateDoiCount());
        }
        const doiAutonumBtn = document.getElementById('doiAutonumBtn');
        if (doiAutonumBtn) {
            doiAutonumBtn.addEventListener('click', () => this.applyDoiAutoNumberFromInput());
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
                this.fitPdfViewerToWidth();
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
                if (this.isPdfPopupMode) {
                    this.togglePdfPopup().catch(err => console.error('Toggle PDF popup failed:', err));
                    return;
                }
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
        const projectKey = this.getProjectKey();
        if (!projectKey) return files;
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
        const projectKey = this.getProjectKey();
        if (!projectKey) return;
        this.fileOrders[projectKey] = [...order];
        if (groups) {
            this.fileGroups[projectKey] = { groups: this.cloneFileGroups(groups) };
        }
        const groupsToSave = groups || this.fileGroups[projectKey]?.groups || null;
        this.persistFileOrder(order, groupsToSave).catch(err => console.warn('save order failed:', err));
    }

    async fetchFileOrder() {
        const projectPath = this.getProjectKey();
        if (!projectPath) return;
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
        const projectPath = this.getProjectKey();
        if (!projectPath) return;
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
            console.error('Failed to save panel widths:', error);

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
                this.debugLog('Panel widths have been restored:', widths);

                return widths;
            }
        } catch (error) {
            console.error('Failed to restore panel widths:', error);
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

    toggleStatusBarVisibility() {
        const statusBar = document.getElementById('statusBar');
        if (!statusBar) return;
        statusBar.classList.toggle('status-bar-hidden');

        // 保存隐藏/显示状态
        const isHidden = statusBar.classList.contains('status-bar-hidden');
        try {
            localStorage.setItem('statusBarHidden', isHidden ? 'true' : 'false');
        } catch (e) {
            console.warn('Failed to save status bar visibility state:', e);
        }
    }

    toggleStatusBarPosition() {
        const statusBar = document.getElementById('statusBar');
        if (!statusBar) return;
        statusBar.classList.toggle('status-bar-top');

        // 保存位置状态
        const isTop = statusBar.classList.contains('status-bar-top');
        try {
            localStorage.setItem('statusBarPosition', isTop ? 'top' : 'bottom');
        } catch (e) {
            console.warn('Failed to save status bar position state:', e);
        }
    }

    restoreStatusBarState() {
        const statusBar = document.getElementById('statusBar');
        if (!statusBar) return;

        try {
            // 恢复位置状态
            const position = localStorage.getItem('statusBarPosition');
            if (position === 'top') {
                statusBar.classList.add('status-bar-top');
            } else {
                statusBar.classList.remove('status-bar-top');
            }

            // 恢复隐藏/显示状态
            const isHidden = localStorage.getItem('statusBarHidden');
            if (isHidden === 'true') {
                statusBar.classList.add('status-bar-hidden');
            } else {
                statusBar.classList.remove('status-bar-hidden');
            }
        } catch (e) {
            console.warn('Failed to restore status bar state:', e);
        }
    }

    collapseRightPanelForPdfPopup() {
        const rightPanel = document.querySelector('.right-panel');
        const middleToggle = document.querySelector('#middleResizer .resizer-toggle');
        if (!rightPanel) return;
        this.pdfPopupRightWasCollapsed = rightPanel.classList.contains('panel-collapsed');
        if (this.pdfPopupRightWasCollapsed) {
            this.pdfPopupAutoCollapsed = false;
            return;
        }
        this.pdfPopupAutoCollapsed = true;
        this.lastRightWidth = rightPanel.getBoundingClientRect().width || this.lastRightWidth;
        rightPanel.classList.add('panel-collapsed');
        rightPanel.style.width = '';
        if (middleToggle) middleToggle.title = 'Show PDF preview (Cmd+Shift+F / Ctrl+Shift+F)';
        const icon = middleToggle?.querySelector('i');
        if (icon) icon.style.transform = 'rotate(180deg)';
    }

    restoreRightPanelAfterPdfPopup() {
        if (!this.pdfPopupAutoCollapsed) return;
        this.pdfPopupAutoCollapsed = false;
        const rightPanel = document.querySelector('.right-panel');
        const middleToggle = document.querySelector('#middleResizer .resizer-toggle');
        const container = document.querySelector('.container');
        if (!rightPanel || !rightPanel.classList.contains('panel-collapsed')) return;
        rightPanel.classList.remove('panel-collapsed');
        if (!this.lastRightWidth || this.lastRightWidth <= 1) {
            const containerWidth = container?.getBoundingClientRect().width || window.innerWidth;
            this.lastRightWidth = Math.max(200, Math.floor(containerWidth * 0.33));
        }
        rightPanel.style.width = this.lastRightWidth + 'px';
        if (middleToggle) middleToggle.title = 'Hide PDF preview (Cmd+Shift+F / Ctrl+Shift+F)';
        const icon = middleToggle?.querySelector('i');
        if (icon) icon.style.transform = 'rotate(0deg)';
    }

    // ========== 项目管理方法 ==========

    showImportModeDialog(callback) {
        this.importModeCallback = callback;
        this.activateModal('importModeModal');
    }

    closeImportModeDialog() {
        this.closeAllModals();
        if (this.importModeCallback) {
            this.importModeCallback(null);
            this.importModeCallback = null;
        }
    }

    selectImportMode(mode) {
        this.closeAllModals();
        if (this.importModeCallback) {
            this.importModeCallback(mode);
            this.importModeCallback = null;
        }
    }

    async startImportJsonFlow(importJsonFolderInput) {
        if (!this.currentProject) {
            this.showNotification('Please load a project before importing JSON', 'error');
            return;
        }

        const target = await this.waitForJsonTargetSelection();
        if (!target) return;

        const mode = await this.waitForImportModeSelection();
        if (!mode) return;

        this.importJsonTargetPath = target;
        this.importJsonMode = mode;
        if (importJsonFolderInput) {
            importJsonFolderInput.value = '';
            importJsonFolderInput.click();
        }
    }

    async waitForImportModeSelection() {
        return new Promise((resolve) => {
            this.showImportModeDialog((mode) => resolve(mode));
        });
    }

    async waitForJsonTargetSelection() {
        // 确保已有文件列表以获取子目录，如果没有则加载
        if (!this.currentFileList || !this.currentFileList.length) {
            await this.loadFileList(true);
        }
        return new Promise((resolve) => {
            this.showJsonTargetDialog((selected) => resolve(selected));
        });
    }

    // JSON 子目录选择对话框
    showJsonTargetDialog(callback) {
        this.jsonTargetCallback = callback;
        this.selectedJsonTargetPath = null;
        this.populateJsonTargetOptions();
        const input = document.getElementById('jsonTargetInput');
        if (input) input.value = '';
        this.activateModal('jsonTargetModal');
    }

    closeJsonTargetDialog() {
        this.closeAllModals();
        if (this.jsonTargetCallback) {
            this.jsonTargetCallback(null);
            this.jsonTargetCallback = null;
        }
        this.selectedJsonTargetPath = null;
    }

    selectJsonTarget(path) {
        const normalized = this.normalizeJsonTargetPath(path || 'json/imported');
        document.getElementById('jsonTargetModal').classList.remove('active');
        if (this.jsonTargetCallback) {
            this.jsonTargetCallback(normalized);
            this.jsonTargetCallback = null;
        }
        this.selectedJsonTargetPath = null;
    }

    populateJsonTargetOptions() {
        const listEl = document.getElementById('jsonTargetList');
        if (!listEl) return;

        const subdirs = this.collectJsonSubdirs();
        const preferred = this.currentJsonView ? [`json/${this.currentJsonView}`] : [];
        const unique = Array.from(new Set([...preferred, ...subdirs]));
        // 默认值保证至少有一个
        if (!unique.length) {
            unique.push('json/imported');
        }
        // 确保根目录选项
        if (!unique.includes('json')) {
            unique.unshift('json');
        }

        // 默认选中第一个
        this.selectedJsonTargetPath = this.normalizeJsonTargetPath(unique[0]);

        listEl.innerHTML = unique.map(dir => {
            const normalized = this.normalizeJsonTargetPath(dir);
            const display = normalized.replace(/^json\/?/, '') || '(root directory)';
            const isSelected = normalized === this.selectedJsonTargetPath;
            return `
                <div class="json-target-option ${isSelected ? 'selected' : ''}" data-path="${this.escapeHtml(normalized)}">
                    <div class="json-target-path">
                        <i class="fas fa-folder"></i>
                        <span>${this.escapeHtml(normalized)}</span>
                    </div>
                    <span class="json-target-badge">${display || '(root directory)'}</span>
                </div>
            `;
        }).join('');

        listEl.querySelectorAll('.json-target-option').forEach(opt => {
            opt.addEventListener('click', () => {
                listEl.querySelectorAll('.json-target-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                this.selectedJsonTargetPath = this.normalizeJsonTargetPath(opt.getAttribute('data-path') || 'json/imported');
            });
        });

        const confirmBtn = document.getElementById('confirmJsonTargetBtn');
        if (confirmBtn) {
            const handler = () => {
                const input = document.getElementById('jsonTargetInput');
                const custom = input ? input.value.trim() : '';
                const chosen = custom ? this.normalizeJsonTargetPath(custom) : (this.selectedJsonTargetPath || 'json/imported');
                this.selectJsonTarget(chosen);
            };
            confirmBtn.onclick = handler;
        }
    }

    normalizeJsonTargetPath(pathStr = 'json/imported') {
        let p = (pathStr || '').trim();
        p = p.replace(/^\/+/, '').replace(/^json\//, '');
        if (!p) return 'json';
        return `json/${p}`.replace(/\/+$/, '');
    }

    collectJsonSubdirs() {
        const set = new Set();
        const meta = this.fileMetaByPath || {};
        Object.keys(meta).forEach((p) => {
            if (!p.toLowerCase().startsWith('json/')) return;
            const parts = p.split('/');
            if (parts.length <= 2) {
                set.add('json');
                return;
            }
            const dir = parts.slice(0, parts.length - 1).join('/');
            set.add(dir);
        });
        return Array.from(set);
    }

    showProjectSelector() {
        this.renderRecentProjects();
        this.activateModal('projectSelectorModal');
    }

    closeProjectSelector() {
        this.closeAllModals();
    }

    renderRecentProjects() {
        const container = document.getElementById('recentProjectsContent');

        if (this.recentProjects.length === 0) {
            container.innerHTML = `
                <div class="empty-recent-projects">
                    <i class="fas fa-folder-open"></i>
                    <p>No recent projects</p>
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
                <a class="recent-project-path" href="file://${this.escapeHtml(project.path)}" target="_blank" title="Open project folder (local)">
                    ${this.escapeHtml(project.path)}
                </a>
            `;
            item.addEventListener('click', () => {
                if (confirm(`Switch to project: ${project.path}?`)) {
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
        const applyDraggable = (modalId) => {
            const modal = document.getElementById(modalId);
            const content = modal?.querySelector('.modal-content');
            const handle = modal?.querySelector('.modal-header');
            if (!modal || !content || !handle) return;

            const onMouseDown = (e) => {
                if (e.target.closest('button')) return;
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
        };

        applyDraggable('editModal');
    }

    async loadSelectedProject() {
        const pathInput = document.getElementById('projectPathInput');
        const projectPath = pathInput.value.trim();

        if (!projectPath) {
            this.showNotification('✗ Please choose a project folder', 'error');
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

    async initProjectFromPath() {
        const pathInput = document.getElementById('projectPathInput');
        const projectPath = pathInput ? pathInput.value.trim() : '';
        if (!projectPath) {
            this.showNotification('Please choose a project folder', 'error');
            return;
        }
        const pathParts = projectPath.replace(/\\/g, '/').split('/').filter(p => p);
        const projectName = pathParts[pathParts.length - 1] || 'project';
        const project = {
            name: projectName,
            path: this.normalizeProjectPathString(projectPath)
        };
        await this.switchProject(project);
    }

    // 触发浏览对话框
    async browseAndFillPath() {
        // 优先使用现代 File System Access API，它可以正确处理空目录
        if ('showDirectoryPicker' in window) {
            try {
                const dirHandle = await window.showDirectoryPicker();
                // 尝试获取完整路径
                if (dirHandle.name) {
                    // 在某些环境中可能无法获取完整路径，需要用户手动输入
                    await this.loadEnvInfo();
                    const userPath = prompt(
                        `Selected folder: "${dirHandle.name}"\nPlease enter the full absolute path:`,
                        this.buildSuggestedPath(dirHandle.name) || ''
                    );
                    const detectedPath = (userPath || '').trim();

                    if (detectedPath) {
                        const input = document.getElementById('projectPathInput');
                        if (input) {
                            input.value = detectedPath;
                        }
                        this.showNotification('Path set', 'success');
                        await this.initProjectFromPath();
                    }
                }
                return;
            } catch (err) {
                // 用户取消或 API 不支持，回退到传统方法
                if (err.name !== 'AbortError') {
                    console.log('Directory picker error:', err);
                }
            }
        }

        // 回退到传统的 input file 方法
        const browser = document.getElementById('projectFolderBrowser');
        if (browser) {
            browser.click();
        }
    }

    // 处理浏览器目录选择
    async handleBrowserSelection(e) {
        await this.fillPathFromBrowserEvent(e, 'projectPathInput');
    }

    async fillPathFromBrowserEvent(e, targetInputId) {
        const files = e.target.files;

        // 处理空目录的情况
        if (!files || files.length === 0) {
            await this.loadEnvInfo();
            const userPath = prompt(
                'The selected directory appears to be empty.\nPlease enter the absolute path to the folder:',
                this.buildSuggestedPath('my_project') || ''
            );
            const detectedPath = (userPath || '').trim();

            if (detectedPath) {
                const input = document.getElementById(targetInputId);
                if (input) {
                    input.value = detectedPath;
                }
                this.showNotification('Path set', 'success');
                if (targetInputId === 'projectPathInput') {
                    await this.initProjectFromPath();
                }
            } else {
                this.showNotification('✗ Path not set', 'error');
            }

            e.target.value = '';
            return;
        }

        const firstFile = files[0];
        const relativePath = firstFile.webkitRelativePath;
        const absolutePath = firstFile.path || '';
        const folderName = relativePath ? relativePath.split('/')[0] : '';

        let detectedPath = absolutePath
            ? absolutePath.replace(/\\/g, '/').replace(/\/[^/]+$/, '')
            : '';

        if (!detectedPath) {
            await this.loadEnvInfo();
            const suggested = this.buildSuggestedPath(folderName || 'my_project');
            const userPath = prompt(
                'Please enter the absolute path to the selected folder:',
                suggested || ''
            );
            detectedPath = (userPath || '').trim();
        }

        if (detectedPath) {
            const input = document.getElementById(targetInputId);
            if (input) {
                input.value = detectedPath;
            }
            this.showNotification('Path set', 'success');
            if (targetInputId === 'projectPathInput') {
                await this.initProjectFromPath();
            }
        } else {
            this.showNotification('✗ Path not set', 'error');
        }

        // 清空input，允许重复选择
        e.target.value = '';
    }

    openDoiModal() {
        if (!this.currentProject) {
            this.showNotification('Please load a project first', 'error');
            return;
        }
        const modal = document.getElementById('doiModal');
        const textarea = document.getElementById('doiInput');
        if (textarea) {
            textarea.value = '';
        }
        this.doiAutoNumberStart = null;
        if (modal) modal.classList.add('active');
        this.updateDoiCount();
    }

    closeDoiModal() {
        const modal = document.getElementById('doiModal');
        if (modal) modal.classList.remove('active');
    }

    normalizeDoi(doi = '') {
        return (doi || '')
            .trim()
            .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
            .replace(/[\s<>]+/g, '')
            .replace(/[.]+$/g, '');
    }

    getDoiKeyVariants(doi = '') {
        const base = this.normalizeDoi(doi).trim().toLowerCase();
        if (!base) return [];
        const set = new Set([base, base.replace(/\//g, '_'), base.replace(/_/g, '/')]);
        return Array.from(set).filter(Boolean);
    }

    extractDoisFromText(text = '') {
        const regex = /10\.\d{4,9}\/[^\s"<>{}]+/gi;
        const matches = (text || '').match(regex) || [];
        const seen = new Set();
        const out = [];
        matches.forEach((raw) => {
            let clean = this.normalizeDoi(raw);
            clean = clean.replace(/[)\]]+$/, '').replace(/[.,;]+$/, '');
            if (!clean) return;
            if (seen.has(clean)) return;
            seen.add(clean);
            out.push(clean);
        });
        return out;
    }

    updateDoiCount() {
        const textarea = document.getElementById('doiInput');
        const display = document.getElementById('doiCountDisplay');
        if (!textarea || !display) return;
        const dois = this.extractDoisFromText(textarea.value);
        const count = dois.length;
        display.textContent = `${count} ${count === 1 ? 'DOI' : 'DOIs'}`;
    }

    async applyDoiAutoNumberFromInput() {
        if (!this.currentProject) {
            this.showNotification('Please load a project first', 'error');
            return;
        }
        const textarea = document.getElementById('doiInput');
        if (!textarea) return;
        const rawDois = this.extractDoisFromText(textarea.value);
        const order = [];
        const seenKeys = new Set();
        rawDois.forEach((d) => {
            const keys = this.getDoiKeyVariants(d);
            if (!keys.length) return;
            const dup = keys.some(k => seenKeys.has(k));
            if (dup) return;
            keys.forEach(k => seenKeys.add(k));
            order.push(d);
        });
        if (!order.length) {
            this.showNotification('No DOIs detected', 'info');

            return;
        }
        try {
            const result = await this.reassignDoiSequence(order, { view: this.currentJsonView || '' });
            if (Number.isFinite(result?.nextNo)) {
                this.doiAutoNumberStart = result.nextNo;
            }
        } catch (err) {
            console.error('Failed to auto-number:', err);
            this.showNotification(`Failed to auto-number: ${err.message}`, 'error');
        }
    }

    async getMaxMetaNo() {
        const files = this.currentFileList || [];
        const view = this.currentJsonView || 'view1';
        let maxNo = 0;
        for (const base of files) {
            const path = this.getViewPathForBase(base, view);
            if (!path) continue;
            try {
                const data = await this.readProjectFile(path);
                const meta = data?.meta_info || {};
                const raw = meta.No ?? meta.no ?? meta.NO ?? meta.No;
                const num = Number(String(raw ?? '').trim());
                if (Number.isFinite(num)) {
                    maxNo = Math.max(maxNo, num);
                }
            } catch (_e) {
                // ignore read errors
            }
        }
        return maxNo;
    }

    formatDoiInput() {
        const textarea = document.getElementById('doiInput');
        if (!textarea) return;
        const dois = this.extractDoisFromText(textarea.value);
        if (!dois.length) {
            this.showNotification('No DOIs detected', 'info');
            this.updateDoiCount();
            return;
        }
        textarea.value = dois.join('\n');
        this.updateDoiCount();
        this.showNotification('Extracted and formatted DOIs', 'success');
    }

    doiToFilenameBase(doi) {
        const clean = this.normalizeDoi(doi);
        const safe = clean.replace(/[^a-zA-Z0-9._-]+/g, '_');
        return safe || 'doi_item';
    }

    buildDoiJsonTemplate(doi) {
        const clean = this.normalizeDoi(doi);
        return {
            schema_version: '1.0',
            meta_info: {
                doi: clean,
                No: null
            }
        };
    }

    async saveJsonPayload(filename, jsonData) {
        const jsonString = JSON.stringify(jsonData, null, 2);
        const projectPath = this.getRequiredProjectPath();
        if (!projectPath) {
            throw new Error('Project not selected');
        }
        const response = await fetch('/save-json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectPath,
                filename,
                content: jsonString
            })
        });
        if (!response.ok) {
            const msg = await response.text().catch(() => '');
            throw new Error(msg || 'Save failed');
        }
    }

    async createJsonFromDoiList() {
        if (!this.currentProject) {
            this.showNotification('Please load a project first', 'error');
            return;
        }
        let nextNo = Number.isFinite(this.doiAutoNumberStart) ? this.doiAutoNumberStart : null;
        const textarea = document.getElementById('doiInput');
        const modal = document.getElementById('doiModal');
        const view = this.currentJsonView || 'view1';
        if (!textarea) return;
        const inputDois = this.extractDoisFromText(textarea.value);
        // 去重（同一个 DOI 的不同写法也去重）
        const seenKeys = new Set();
        const dois = [];
        inputDois.forEach((d) => {
            const keys = this.getDoiKeyVariants(d);
            const dup = keys.some(k => seenKeys.has(k));
            if (dup) return;
            keys.forEach(k => seenKeys.add(k));
            dois.push(d);
        });
        if (!dois.length) {
            this.showNotification('No DOIs detected', 'info');
            return;
        }
        if (nextNo === null) {
            try {
                const maxNo = await this.getMaxMetaNo();
                nextNo = (Number.isFinite(maxNo) ? maxNo : 0) + 1;
            } catch (err) {
                console.warn('Failed to initialize auto-numbering, continuing without numbering', err);
            }
        }

        const created = [];
        const existing = [];
        for (const doi of dois) {
            const base = this.doiToFilenameBase(doi);
            const already = this.fileMetaByBase?.[base]?.views?.[view];
            if (already) {
                existing.push(already);
                continue;
            }
            const filename = `json/${view}/${base}.json`;
            const payload = this.buildDoiJsonTemplate(doi);
            if (Number.isFinite(nextNo)) {
                payload.meta_info.No = nextNo;
                nextNo += 1;
            }
            try {
                await this.saveJsonPayload(filename, payload);
                created.push(filename);
            } catch (err) {
                console.error('Create DOI file failed:', err);
                this.showNotification(`Failed to create ${filename}: ${err.message}`, 'error');
            }
        }

        // 刷新列表并打开首个目标
        await this.loadFileList(true);
        const target = created[0] || existing[0];
        if (target) {
            const targetBase = target.split('/').pop()?.replace(/\.json$/i, '') || target;
            setTimeout(() => {
                this.scrollFileIntoView(targetBase, { align: 'center' });
                const item = this.getRenderedFileItem(targetBase);
                if (item) this.loadFile(targetBase, item);
            }, 100);
        }

        if (modal) modal.classList.remove('active');

        if (created.length && existing.length) {
            this.showNotification(`Created ${created.length}, already exists ${existing.length}`, 'success');
        } else if (created.length) {
            this.showNotification(`Created ${created.length} DOI file${created.length > 1 ? 's' : ''}`, 'success');
        } else {
            this.showNotification(`${existing.length} DOI file${existing.length > 1 ? 's' : ''} already exist${existing.length > 1 ? '' : 's'}, no need to create`, 'info');
        }

        // 记录下一个可用编号
        if (Number.isFinite(nextNo)) {
            this.doiAutoNumberStart = nextNo;
        }
    }

    async switchProject(project) {
        try {
            // 🔑 切换项目前先保存标注并关闭独立PDF窗口
            const hadPopupWindow = this.isPdfPopupMode && this.pdfPopupWindow && !this.pdfPopupWindow.closed;

            if (this.isPdfPopupMode) {
                await this.savePdfAnnotationsFromPopup();
            }
            this.forceEmbeddedPdfMode();

            // 如果关闭了独立窗口，给予提示
            if (hadPopupWindow) {
                this.showNotification('🔄 Closed detached PDF window', 'info');
            }

            // 验证项目结构
            console.log('Validating project path:', project.path);
            const response = await fetch('/validate-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectPath: project.path })
            });

            console.log('Response status:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Response error:', errorText);
                throw new Error('Project validation failed');
            }

            let result = null;
            try {
                result = await response.json();
            } catch (_err) {
                result = null;
            }

            if (result && result.success === false) {
                throw new Error(result.error || 'Save failed');
            }
            console.log('Validation result:', result);

            if (!result.valid) {
                console.error('Invalid project:', result.message);
                this.showNotification(`Invalid project structure: ${result.message}`, 'error');
                return;
            }

            // 显示初始化或验证成功的消息
            if (result.created || result.dirsInitialized) {
                this.showNotification(`✓ ${result.message || 'Project initialized'}`, 'success');
            }

            // 保存当前项目
            this.currentProject = project;
            this.currentFileList = [];
            // 确保当前项目记录中存在默认分组
            this.ensureInitGroupExists();

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
            this.currentPdfPath = null;
            this.pendingPdfUrl = null;
            this.pendingPdfFallback = null;
            this.lastPdfLoadedUrl = '';
            this.currentPdfLoadToken++;
            this.currentLoadToken++;
            this.hasUnsavedChanges = false;
            this.tempDataCache = {};
            this.selectedFiles = new Set();
            this.lastFileSelectionAnchor = null;
            this.currentFileList = [];
            this.visibleFileOrder = [];
            this.currentMarkdownText = '';
            this.currentMarkdownFile = '';
            this.currentMarkdownBaselineText = '';
            this.currentMarkdownExists = false;
            this.isMarkdownEditing = false;
            this.hasUnsavedMarkdownChanges = false;

            // 关闭独立PDF窗口并强制使用内嵌模式
            this.forceEmbeddedPdfMode();

            // 清空UI
            const fileListEl = document.getElementById('fileList');
            if (fileListEl) {
                fileListEl.innerHTML = '<div class="loading"><div class="spinner"></div>Loading...</div>';
            }
            this.resetMainPanelsForProject();

            // 重新加载文件列表
            await this.loadFileList();

            this.showNotification(`✓ Project loaded: ${project.name}`, 'success');
        } catch (error) {
            console.error('Error switching project:', error);
            this.showNotification(`Failed to load project: ${error.message}`, 'error');
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

    async handleCreateProject() {
        // 第一步：触发目录选择
        const browser = document.getElementById('createProjectBrowser');
        if (!browser) {
            // 如果没有浏览器元素，创建一个临时的
            const tempBrowser = document.createElement('input');
            tempBrowser.type = 'file';
            tempBrowser.id = 'createProjectBrowser';
            tempBrowser.webkitdirectory = true;
            tempBrowser.style.display = 'none';
            document.body.appendChild(tempBrowser);

            tempBrowser.addEventListener('change', (e) => {
                this.handleCreateProjectSelection(e);
            });

            tempBrowser.click();
        } else {
            browser.click();
        }
    }

    // 处理创建项目的目录选择
    async handleCreateProjectSelection(e) {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        // 第二步：让用户输入父目录路径
        const exampleBase = this.buildSuggestedPath();
        const parentPath = prompt(
            `Enter the parent directory where the project should be created:\n\nExample:\n${exampleBase}`,
            this.getDefaultParentDir() || '/path/to'
        );

        if (!parentPath || !parentPath.trim()) {
            this.showNotification('✗ Project creation cancelled', 'info');
            e.target.value = '';
            return;
        }

        // 第三步：让用户输入项目名称
        const projectName = prompt(
            'Enter the new project name:\n\n(A folder with this name will be created in the selected directory)',
            'my_project'
        );

        if (!projectName || !projectName.trim()) {
            this.showNotification('✗ Project name is required', 'error');
            e.target.value = '';
            return;
        }

        // 组合完整路径
        const fullPath = `${parentPath.trim().replace(/\/$/, '')}/${projectName.trim()}`;

        try {
            const response = await fetch('/create-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectPath: fullPath })
            });

            const result = await response.json();

            if (!result.success) {
                this.showNotification(`✗ Failed to create project: ${result.error}`, 'error');
                e.target.value = '';
                return;
            }

            // 先退出旧项目
            if (this.currentProject) {
                this.currentProject = null;
                this.currentFile = null;
                this.currentData = null;
                this.currentPdfUrl = null;
                this.currentPdfPath = null;
                this.currentFileList = [];
                this.fileMetaByBase = {};
                this.fileMetaByPath = {};
                this.hasUnsavedChanges = false;
                this.tempDataCache = {};
                this.selectedFiles = new Set();
                this.lastFileSelectionAnchor = null;
                this.visibleFileOrder = [];
            }

            // 自动加载新创建的项目
            const newProject = {
                name: projectName.trim(),
                path: fullPath
            };

            this.currentProject = newProject;
            this.currentFileList = [];
            // 新建项目也要保证默认分组存在
            this.ensureInitGroupExists();
            this.updateRecentProjects(newProject);
            this.saveProjectConfig();
            this.updateProjectDisplay();
            this.closeProjectSelector();

            // 清空当前状态
            this.currentFile = null;
            this.currentData = null;
            this.currentPdfUrl = null;
            this.currentPdfPath = null;
            this.hasUnsavedChanges = false;
            this.tempDataCache = {};
            this.selectedFiles = new Set();
            this.lastFileSelectionAnchor = null;
            this.visibleFileOrder = [];

            // 清空UI
            const fileListEl = document.getElementById('fileList');
            if (fileListEl) {
                fileListEl.innerHTML = '<div class="loading"><div class="spinner"></div>Loading...</div>';
            }
            const middleContentEl = document.getElementById('middleContent');
            if (middleContentEl) {
                middleContentEl.innerHTML = '';
            }
            const rightPanelEl = document.getElementById('rightPanel');
            if (rightPanelEl) {
                rightPanelEl.innerHTML = '';
            }
            const editorEl = document.getElementById('editor');
            if (editorEl) {
                editorEl.innerHTML = '';
            }
            const pdfContainerEl = document.getElementById('pdfContainer');
            if (pdfContainerEl) {
                pdfContainerEl.innerHTML = '';
            }

            // 调用统一的面板重置函数
            this.resetMainPanelsForProject();

            // 重新加载文件列表
            await this.loadFileList();

            this.showNotification(`✓ Project "${projectName.trim()}" created at: ${fullPath}`, 'success');
        } catch (error) {
            console.error('Error creating project:', error);
            this.showNotification(`✗ Project creation failed: ${error.message}`, 'error');
        }

        // 清空input，允许重复创建
        e.target.value = '';
    }

    async loadFileList(keepSelection = false) {
        const fileListEl = document.getElementById('fileList');
        const currentSelected = this.currentFileBase || (this.currentFile ? this.currentFile.split('/').pop()?.replace(/\.[^.]+$/, '') : null); // 保存当前选中的文件（基名）
        const loadId = ++this.currentLoadToken;
        this._doiIndex = null;
        this._doiIndexBuilding = null;

        // 检查是否有当前项目
        if (!this.currentProject) {
            fileListEl.innerHTML = '<div class="empty-state"><p>Please load a project first</p></div>';
            return;
        }

        if (!keepSelection) {
            fileListEl.innerHTML = '<div class="loading"><div class="spinner"></div>Loading files...</div>';
        }

        try {
            // 先从服务器拿到所有 json/md 文件，动态视图列表
            const { bases, views } = await this.loadFileBasesFromServer();
            if (loadId !== this.currentLoadToken || !this.currentProject) {
                return;
            }
            this.availableJsonViews = views;
            const projectKey = this.getProjectKey();
            const savedView = this.lastJsonViewByProject?.[projectKey];
            if (savedView && views.includes(savedView)) {
                this.currentJsonView = savedView;
            }
            if (!this.currentJsonView || !views.includes(this.currentJsonView)) {
                this.currentJsonView = views[0] || 'view1';
            }
            this.lastJsonViewByProject[projectKey] = this.currentJsonView;
            this.persistLastJsonViewByProject();
            // 按文件配置/排序记录应用顺序
            const orderedBases = await this.applyFileListOrdering(bases);
            this.renderJsonViewSelector();
            // 读取服务器排序（基于基名）
            await this.fetchFileOrder();
            const ordered = this.applyFileOrder(orderedBases);
            // 确保存在 init 默认分组，并补齐缺失的文件
            const ensuredGroups = this.ensureInitGroupExists(ordered);
            // Store all files for reference, but renderFileList will filter them
            this.allProjectFiles = ordered;
            // renderFileList will handle filtering and grouping
            this.renderFileList(ordered, keepSelection ? currentSelected : null, true, ensuredGroups);
        } catch (error) {
            if (loadId !== this.currentLoadToken || !this.currentProject) {
                return;
            }
            console.error('Error loading file list:', error);
            this.showNotification('Failed to load file list', 'error');
            fileListEl.innerHTML = '<div class="empty-state"><p>Failed to load, please check server</p></div>';
        }
    }

    // Ensure 'init' group exists in the current project; optionally fill with provided files
    ensureInitGroupExists(allFiles = null) {
        const key = this.getProjectKey();
        const prevGroups = this.fileGroups[key]?.groups || [];
        const prevSerialized = JSON.stringify(prevGroups);
        const stored = this.cloneFileGroups(prevGroups);
        const initIndex = stored.findIndex(g => g.id === 'init');
        let groups = stored;

        if (initIndex === -1) {
            groups = [{ id: 'init', name: 'init', files: [], collapsed: false }, ...stored];
        } else if (initIndex !== 0) {
            // 确保默认分组位于首位
            const initGroup = stored[initIndex];
            const others = stored.filter((_, idx) => idx !== initIndex);
            groups = [initGroup, ...others];
        }

        if (Array.isArray(allFiles) && allFiles.length) {
            const assigned = new Set();
            groups.forEach(g => (g.files || []).forEach(f => assigned.add(f)));
            const missing = allFiles.filter(f => !assigned.has(f));
            if (missing.length) {
                const initGroup = groups.find(g => g.id === 'init') || groups[0];
                initGroup.files = this.dedupeFiles([...(initGroup.files || []), ...missing]);
            }
        }

        const cleanedGroups = this.ensureDefaultGroup(groups);
        const newSerialized = JSON.stringify(cleanedGroups);
        this.fileGroups[key] = { groups: cleanedGroups };
        if (newSerialized !== prevSerialized) {
            const flatFiles = this.flattenGroupFiles(cleanedGroups);
            this.saveFileOrderForProject(flatFiles, cleanedGroups);
        }
        return cleanedGroups;
    }

    async loadFileBasesFromServer() {
        const projectKey = this.getProjectKey();
        console.log('Loading file list, project path:', projectKey);
        const response = await fetch('/list-json-files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectPath: projectKey })
        });
        console.log('Server response status:', response.status, response.statusText);
        if (!response.ok) throw new Error('Failed to fetch file list');
        const data = await response.json();
        console.log('Received file data:', data);
        const rawFiles = data.files || [];
        console.log('Raw file count:', rawFiles.length);
        this.fileMetaByBase = {};
        this.fileMetaByPath = {};
        const viewSet = new Set();
        rawFiles.forEach((f) => {
            if (typeof f !== 'object') return;
            const rawName = f.name || f.path || '';
            const isMd = (rawName || '').toLowerCase().endsWith('.md');
            const isPdf = (rawName || '').toLowerCase().endsWith('.pdf');
            const kind = f.kind || (isMd ? 'md' : isPdf ? 'pdf' : 'json');
            const pathVal = f.path || f.name || '';
            const category = f.category || (isMd ? 'md' : isPdf ? 'pdf' : 'json.root');

            // Store in fileMetaByPath (all files are stored)
            this.fileMetaByPath[pathVal] = { name: rawName, path: pathVal, kind, category };

            // Only process JSON and MD files, not PDF
            if (isPdf) return;

            const base = rawName.split('/').pop()?.replace(/\.(json|md)$/i, '') || rawName;
            if (!base) return;
            if (!this.fileMetaByBase[base]) {
                this.fileMetaByBase[base] = { base, views: {}, mdPath: null, legacyJson: null };
            }
            if (kind === 'md' || category === 'md') {
                this.fileMetaByBase[base].mdPath = pathVal;
            } else if (category.startsWith('json.')) {
                const viewName = category.split('.').slice(1).join('.') || 'view1';
                viewSet.add(viewName);
                this.fileMetaByBase[base].views[viewName] = pathVal;
            } else {
                this.fileMetaByBase[base].legacyJson = pathVal;
            }
        });
        const bases = Object.keys(this.fileMetaByBase).sort();
        const views = Array.from(viewSet).sort();
        return { bases, views: views.length ? views : ['view1'] };
    }

    async applyFileListOrdering(bases = []) {
        // Legacy file_list.json support removed; rely on .file_order.json via /file-order
        return [...bases];
    }

    // Filter files to show only those that exist in the current JSON view
    filterFilesByCurrentView(files) {
        const currentView = this.currentJsonView || 'view1';
        const filtered = files.filter(base => {
            const entry = this.fileMetaByBase?.[base];
            if (!entry) return false;
            const hasView = !!(entry.views && entry.views[currentView]);
            return hasView;
        });
        return filtered;
    }

    // Apply view filtering to groups while preserving group structure globally
    getFilteredGroupsForCurrentView(groups = []) {
        const currentView = this.currentJsonView || 'view1';
        return groups.map(g => ({
            ...g,
            files: (g.files || []).filter(base => {
                const entry = this.fileMetaByBase?.[base];
                if (!entry) return false;
                return !!(entry.views && entry.views[currentView]);
            })
        }));
    }

    renderFileList(files, keepSelected = null, alreadyOrdered = false, groupsOverride = null) {
        const fileListEl = document.getElementById('fileList');

        // Get global groups (either override or from storage)
        const sourceGroups = groupsOverride
            ? this.cloneFileGroups(groupsOverride)
            : this.getCurrentGroups();

        // Save the complete, unfiltered groups for later use (e.g., when toggling collapse)
        this.completeGroupsForCurrentProject = this.cloneFileGroups(sourceGroups);

        // Apply view filtering to groups - preserves group structure, filters files within groups
        const groups = this.getFilteredGroupsForCurrentView(sourceGroups);

        // Only update fileGroups if groupsOverride was provided (explicit save)
        // This prevents accidentally resetting fileGroups from getCurrentGroups
        if (groupsOverride) {
            const key = this.getProjectKey();
            this.fileGroups[key] = { groups: sourceGroups };
        }

        // Calculate flattened visible files for this view
        const filterText = (this.fileFilter || '').toLowerCase();
        const shouldFieldFilter = this.hasActiveFileFilterConditions();
        if (shouldFieldFilter && !this.fileFilterMatches) {
            this.updateFieldFilterMatches();
        }
        const filterSet = this.fileFilterMatches instanceof Set ? this.fileFilterMatches : null;
        const groupsView = groups.map(g => {
            let filtered = [...(g.files || [])];
            if (filterText) {
                filtered = filtered.filter(f => f.toLowerCase().includes(filterText));
            }
            if (shouldFieldFilter && filterSet) {
                filtered = filtered.filter(f => filterSet.has(f));
            }
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

        // Update currentFileList with all files in current view (used for search/filter)
        const allFilesInView = groupsView.reduce((arr, g) => {
            arr.push(...(g.files || []));
            return arr;
        }, []);
        this.currentFileList = allFilesInView;

        // Handle empty state only when the project truly has no files for this view
        const hasAnyFile = allFilesInView.length > 0;
        const hasAnyGroup = groupsView.length > 0;
        if (flatVisible.length === 0 && !hasAnyFile && !hasAnyGroup) {
            this.visibleFileOrder = [];
            this.selectedFiles = new Set();
            const msg = `No files in current view "${this.currentJsonView}"`;
            fileListEl.innerHTML = `<div class="empty-state"><p>${msg}</p></div>`;
            return;
        }

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

        // Build visible position map for virtual scroll targeting
        this.visibleFilePositions = {};
        groupsView.forEach(group => {
            (group.visible || []).forEach((file, idx) => {
                this.visibleFilePositions[file] = { groupId: group.id, index: idx };
            });
        });

        // Create new file list structure
        const newFileListEl = document.createElement('div');
        this.virtualGroupState = {};

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
            header.draggable = true;
            header.addEventListener('click', (ev) => {
                if (ev.target.closest('.file-group-title')) return;
                // 更新当前选中的分组
                this.currentGroupId = group.id;
                this.toggleGroupCollapse(group.id, { collapseAll: ev.shiftKey });
            });
            header.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showGroupContextMenu(e, group);
            });
            header.addEventListener('dragstart', (e) => this.handleGroupDragStart(e, group, header));
            header.addEventListener('dragover', (e) => {
                if (this.draggingGroup) {
                    this.handleGroupOrderDragOver(e, group, header);
                } else {
                    this.handleGroupDragOver(e, group.id);
                }
            });
            header.addEventListener('drop', (e) => {
                if (this.draggingGroup) {
                    this.handleGroupOrderDrop(e, group);
                } else {
                    this.handleGroupDrop(e, group.id);
                }
            });
            header.addEventListener('dragleave', () => this.clearAllFileDragHighlights());
            header.addEventListener('dragend', () => this.handleGroupDragEnd());

            const toggle = document.createElement('span');
            toggle.className = 'file-group-toggle';
            toggle.innerHTML = '<i class="fas fa-chevron-down"></i>';
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleGroupCollapse(group.id, { collapseAll: e.shiftKey });
            });
            const title = document.createElement('span');
            title.className = 'file-group-title';
            title.textContent = group.name || `group ${gIndex + 1}`;
            title.title = group.id === 'init' ? 'Default group, cannot be deleted' : 'Double-click to rename group';
            title.addEventListener('dblclick', (e) => {
                if (group.id !== 'init') {
                    e.stopPropagation();
                    this.renameGroup(group.id);
                }
            });

            const sortBtn = document.createElement('button');
            sortBtn.className = 'file-group-sort';
            sortBtn.title = 'Sort by meta_info.No (ascending)';
            sortBtn.innerHTML = '<i class="fas fa-sort-numeric-down-alt"></i>';
            sortBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const rect = sortBtn.getBoundingClientRect();
                const menuEvt = {
                    pageX: rect.left + rect.width / 2,
                    pageY: rect.bottom + 6,
                    preventDefault: () => { }
                };
                this.showGroupContextMenu(menuEvt, group);
            });

            const count = document.createElement('span');
            count.className = 'file-group-count';
            const totalCount = (group.files || []).length;
            const filteredCount = (group.filteredCount ?? (group.visible || []).length ?? totalCount);
            const hasFilter = !!(this.fileFilter || this.hasActiveFileFilterConditions());
            count.textContent = hasFilter ? `${filteredCount}/${totalCount}` : `${totalCount}`;

            header.appendChild(toggle);
            header.appendChild(title);
            header.appendChild(count);
            header.appendChild(sortBtn);
            groupEl.appendChild(header);

            const body = document.createElement('div');
            body.className = 'file-group-body';
            body.dataset.groupId = group.id;

            if (!group.visible || group.visible.length === 0) {
                body.addEventListener('dragover', (e) => this.handleGroupDragOver(e, group.id));
                body.addEventListener('drop', (e) => this.handleGroupDrop(e, group.id));
                body.addEventListener('dragleave', () => this.clearAllFileDragHighlights());
                const placeholder = document.createElement('div');
                placeholder.className = 'file-group-empty';
                const hasFilter = !!(this.fileFilter || this.hasActiveFileFilterConditions());
                placeholder.textContent = hasFilter ? 'No matching files' : 'Drag files/pdf onto this group';
                body.appendChild(placeholder);
            } else {
                this.setupVirtualGroupBody(body, group, group.visible);
            }

            groupEl.appendChild(body);
            newFileListEl.appendChild(groupEl);
        });

        fileListEl.innerHTML = '';
        fileListEl.appendChild(newFileListEl);
        this.renderAllVirtualGroups(true);
        this.updateFileSelectionDom();
        if (autoLoadTarget) {
            this.scrollFileIntoView(autoLoadTarget, { align: 'center' });
            const autoEl = this.getRenderedFileItem(autoLoadTarget);
            setTimeout(() => this.loadFile(autoLoadTarget, autoEl), 30);
        }
    }

    setupVirtualGroupBody(body, group, files) {
        body.innerHTML = '';
        body.classList.add('file-group-virtual');
        const spacer = document.createElement('div');
        spacer.className = 'file-virtual-spacer';
        const inner = document.createElement('div');
        inner.className = 'file-virtual-inner';
        body.appendChild(spacer);
        body.appendChild(inner);
        const state = {
            groupId: group.id,
            body,
            spacer,
            inner,
            files: Array.isArray(files) ? files : [],
            itemHeight: this.virtualListConfig.defaultItemHeight,
            overscan: this.virtualListConfig.overscan,
            startIndex: -1,
            endIndex: -1,
            needsMeasure: true,
            scrollRaf: null
        };
        this.virtualGroupState[group.id] = state;

        body.addEventListener('click', (e) => {
            const item = e.target.closest('.file-item');
            if (!item) return;
            this.handleFileClick(e, item.dataset.filename, item);
        });
        body.addEventListener('contextmenu', (e) => {
            const item = e.target.closest('.file-item');
            if (!item) return;
            e.preventDefault();
            window.paperStats.showFileContextMenu(e, item.dataset.filename, item);
        });
        body.addEventListener('dragstart', (e) => {
            const item = e.target.closest('.file-item');
            if (!item) return;
            this.handleFileDragStart(e, item.dataset.filename, group.id, item);
        });
        body.addEventListener('dragover', (e) => {
            const item = e.target.closest('.file-item');
            if (item) {
                this.handleFileDragOver(e, item.dataset.filename, group.id, item);
            } else {
                this.handleGroupDragOver(e, group.id);
            }
        });
        body.addEventListener('dragleave', (e) => {
            const item = e.target.closest('.file-item');
            if (item) this.clearFileDragHighlights(item);
        });
        body.addEventListener('drop', (e) => {
            const item = e.target.closest('.file-item');
            if (item) {
                this.handleFileDropOnItem(e, item.dataset.filename, group.id);
            } else {
                this.handleGroupDrop(e, group.id);
            }
        });
        body.addEventListener('dragend', (e) => {
            const item = e.target.closest('.file-item');
            if (!item) return;
            this.draggingFile = null;
            this.currentFileDragState = null;
            this.clearAllFileDragHighlights();
            item.classList.remove('dragging');
        });
        body.addEventListener('scroll', () => this.scheduleVirtualGroupRender(group.id));
    }

    scheduleVirtualGroupRender(groupId) {
        const state = this.virtualGroupState[groupId];
        if (!state || state.scrollRaf) return;
        state.scrollRaf = requestAnimationFrame(() => {
            state.scrollRaf = null;
            this.renderVirtualGroup(groupId);
        });
    }

    renderAllVirtualGroups(force = false) {
        Object.keys(this.virtualGroupState || {}).forEach(groupId => {
            this.renderVirtualGroup(groupId, force);
        });
    }

    measureVirtualItemHeight(state) {
        if (!state?.body) return;
        const sample = document.createElement('div');
        sample.className = 'file-item';
        sample.style.visibility = 'hidden';
        sample.textContent = 'Sample';
        state.body.appendChild(sample);
        const rect = sample.getBoundingClientRect();
        const styles = window.getComputedStyle(sample);
        const marginTop = parseFloat(styles.marginTop) || 0;
        const marginBottom = parseFloat(styles.marginBottom) || 0;
        sample.remove();
        const height = rect.height + marginTop + marginBottom;
        state.itemHeight = height || this.virtualListConfig.defaultItemHeight;
        state.needsMeasure = false;
    }

    renderVirtualGroup(groupId, force = false) {
        const state = this.virtualGroupState[groupId];
        if (!state || !state.body || !state.inner || !state.spacer) return;
        if (state.needsMeasure) this.measureVirtualItemHeight(state);
        if (!state.itemHeight || !Number.isFinite(state.itemHeight)) {
            state.itemHeight = this.virtualListConfig.defaultItemHeight;
        }
        const total = state.files.length;
        if (!total) {
            state.spacer.style.height = '0px';
            state.inner.innerHTML = '';
            return;
        }
        const viewportHeight = state.body.clientHeight || 0;
        const itemsPerView = Math.ceil(viewportHeight / state.itemHeight) || 1;
        const start = Math.max(0, Math.floor(state.body.scrollTop / state.itemHeight) - state.overscan);
        const end = Math.min(total, start + itemsPerView + state.overscan * 2);
        if (!force && start === state.startIndex && end === state.endIndex) return;
        state.startIndex = start;
        state.endIndex = end;
        state.spacer.style.height = `${total * state.itemHeight}px`;
        state.inner.style.transform = `translateY(${start * state.itemHeight}px)`;
        state.inner.innerHTML = '';
        for (let i = start; i < end; i += 1) {
            const file = state.files[i];
            const number = i + 1;
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.dataset.filename = file;
            fileItem.dataset.groupId = groupId;
            fileItem.draggable = true;
            this.setFileItemContent(fileItem, file, number);
            if (this.selectedFiles.has(file)) {
                fileItem.classList.add('active');
            }
            state.inner.appendChild(fileItem);
        }
    }

    normalizeFileBase(name) {
        if (!name) return '';
        const base = name.split('/').pop() || name;
        return base.replace(/\.json$/i, '');
    }

    getRenderedFileItem(filename) {
        const base = this.normalizeFileBase(filename);
        if (!base) return null;
        return document.querySelector(`.file-item[data-filename="${base}"]`);
    }

    scrollFileIntoView(filename, opts = {}) {
        const base = this.normalizeFileBase(filename);
        if (!base) return null;
        const pos = this.visibleFilePositions?.[base];
        if (!pos) return null;
        const state = this.virtualGroupState?.[pos.groupId];
        if (!state || !state.body) return null;
        if (state.needsMeasure) this.measureVirtualItemHeight(state);
        const align = opts.align || 'center';
        const targetTop = pos.index * state.itemHeight;
        let scrollTop = targetTop;
        if (align === 'center') {
            scrollTop = Math.max(0, targetTop - state.body.clientHeight / 2 + state.itemHeight / 2);
        } else if (align === 'end') {
            scrollTop = Math.max(0, targetTop - state.body.clientHeight + state.itemHeight);
        }
        state.body.scrollTop = scrollTop;
        this.renderVirtualGroup(pos.groupId, true);
        return this.getRenderedFileItem(base);
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
        const label = count > 1 ? `Moving ${count} files` : filename.replace(/\.[^.]+$/, '');
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
        if (!e) return;
        const hasPdf = Array.from(e.dataTransfer?.items || []).some(item => {
            if (item.kind !== 'file') return false;
            const type = (item.type || '').toLowerCase();
            const name = (item.getAsFile?.()?.name || '').toLowerCase();
            return type.includes('pdf') || name.endsWith('.pdf');
        });
        if (!this.draggingFile && !hasPdf) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) e.dataTransfer.dropEffect = hasPdf ? 'copy' : 'move';
        const body = e.currentTarget;
        if (body && body.classList) {
            body.classList.add('file-group-drop');
        }
    }

    handleGroupDragStart(e, group, headerEl) {
        if (!group || group.id === 'init') {
            if (e?.dataTransfer) e.dataTransfer.effectAllowed = 'none';
            return;
        }
        if (e?.target?.closest('button')) {
            e.preventDefault();
            return;
        }
        this.draggingGroup = { groupId: group.id };
        this.currentGroupDragState = null;
        if (headerEl?.classList) headerEl.classList.add('dragging');
        const label = group.name || 'group';
        const preview = this.createDragPreview(`Group: ${label}`);
        if (e?.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', group.id);
            if (preview) e.dataTransfer.setDragImage(preview, -10, -10);
        }
    }

    handleGroupOrderDragOver(e, group, headerEl) {
        if (!this.draggingGroup || !group || !headerEl) return;
        if (this.draggingGroup.groupId === group.id) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        const before = e.offsetY < (headerEl.clientHeight || 0) / 2;
        this.currentGroupDragState = { targetGroupId: group.id, placeAfter: !before };
        this.markGroupDragPosition(headerEl, before);
    }

    handleGroupOrderDrop(e, group) {
        if (!this.draggingGroup || !group) return;
        e.preventDefault();
        e.stopPropagation();
        const sourceId = this.draggingGroup.groupId;
        const targetId = group.id;
        if (!sourceId || !targetId || sourceId === targetId) {
            this.clearAllFileDragHighlights();
            this.draggingGroup = null;
            this.currentGroupDragState = null;
            return;
        }
        const placeAfter = this.currentGroupDragState?.targetGroupId === targetId
            ? !!this.currentGroupDragState.placeAfter
            : (e.offsetY >= (e.currentTarget?.clientHeight || 0) / 2);
        this.reorderGroups(sourceId, targetId, placeAfter);
        this.draggingGroup = null;
        this.currentGroupDragState = null;
        this.clearAllFileDragHighlights();
    }

    handleGroupDragEnd() {
        this.draggingGroup = null;
        this.currentGroupDragState = null;
        this.clearAllFileDragHighlights();
    }

    markGroupDragPosition(targetEl, before) {
        if (!targetEl) return;
        targetEl.classList.add('group-dragging-over');
        targetEl.classList.toggle('group-drag-over-before', before);
        targetEl.classList.toggle('group-drag-over-after', !before);
    }

    reorderGroups(sourceId, targetId, placeAfter) {
        if (!sourceId || !targetId || sourceId === targetId) return;
        if (sourceId === 'init') {
            this.showNotification('Default group cannot be moved', 'info');
            return;
        }
        const baseGroups = this.completeGroupsForCurrentProject
            ? this.cloneFileGroups(this.completeGroupsForCurrentProject)
            : this.getCurrentGroups();
        const sourceIdx = baseGroups.findIndex(g => g.id === sourceId);
        const targetIdx = baseGroups.findIndex(g => g.id === targetId);
        if (sourceIdx < 0 || targetIdx < 0) return;
        const [moving] = baseGroups.splice(sourceIdx, 1);
        let insertIdx = targetIdx + (placeAfter ? 1 : 0);
        if (sourceIdx < targetIdx) insertIdx -= 1;
        baseGroups.splice(insertIdx, 0, moving);
        const initIdx = baseGroups.findIndex(g => g.id === 'init');
        if (initIdx > 0) {
            const [initGroup] = baseGroups.splice(initIdx, 1);
            baseGroups.unshift(initGroup);
        }
        this.persistGroupsAndRender(baseGroups, this.currentFile);
    }

    async handleGroupDrop(e, groupId) {
        if (!e) return;
        const droppedFiles = Array.from(e.dataTransfer?.files || []);
        const pdfFiles = droppedFiles.filter(f => this.isPdfFile(f));
        if (pdfFiles.length) {
            e.preventDefault();
            e.stopPropagation();
            await this.handlePdfDropCreateEntries(pdfFiles, groupId);
            this.clearAllFileDragHighlights();
            return;
        }
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
        document.querySelectorAll('.file-group-header').forEach(el => {
            el.classList.remove('dragging', 'group-dragging-over', 'group-drag-over-before', 'group-drag-over-after');
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
            item.textContent = g.name || `group ${idx + 1}`;
            if (idx === 0) item.classList.add('active');
            item.addEventListener('click', () => {
                this.applyGroupMoveFromMenu(g.id);
            });
            menu.appendChild(item);
        });
        document.body.appendChild(menu);
        const anchorFile = this.getSelectedFilesArray()[0] || this.currentFile;
        const anchorBase = anchorFile ? anchorFile.split('/').pop()?.replace(/\.json$/i, '') || anchorFile : null;
        let anchorEl = null;
        if (anchorBase) {
            this.scrollFileIntoView(anchorBase, { align: 'center' });
            anchorEl = this.getRenderedFileItem(anchorBase);
        }
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
        } else {
            menu.style.left = '50%';
            menu.style.top = '30%';
            menu.style.transform = 'translate(-50%, -50%)';
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
            this.scrollFileIntoView(nextFocus, { align: 'center' });
            const el = this.getRenderedFileItem(nextFocus);
            this.loadFile(nextFocus, el);
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

    moveFilesToGroup(files = [], targetGroupId, opts = {}) {
        const list = Array.isArray(files) ? files.filter(Boolean) : [];
        if (!list.length) return;
        const groups = this.syncGroupsWithFiles(this.currentFileList || []);
        const target = groups.find(g => g.id === targetGroupId) || groups[0];
        if (!target) return;
        if (!Array.isArray(target.files)) target.files = [];
        const set = new Set(list);
        groups.forEach(g => {
            g.files = (g.files || []).filter(f => !set.has(f));
        });
        list.forEach(f => {
            if (!target.files.includes(f)) target.files.push(f);
        });
        this.lastFileSelectionAnchor = list[list.length - 1] || null;
        this.persistGroupsAndRender(groups, list[list.length - 1]);
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
        const nextName = prompt('Enter group name', target.name || '');
        if (!nextName) return;
        target.name = nextName.trim();
        this.persistGroupsAndRender(groups, this.currentFile);
    }

    createGroup() {
        const name = prompt('Enter new group name', 'New Group');
        if (!name) return;
        const groups = this.getCurrentGroups();
        const id = `group-${Date.now()}`;
        groups.push({ id, name: name.trim(), files: [], collapsed: false });
        this.persistGroupsAndRender(groups, this.currentFile);
    }

    showCreateGroupDialog() {
        // 直接调用 toggleCreateGroupPanel，事件监听器已在 setupEventListeners 中绑定
        this.toggleCreateGroupPanel(true);
    }

    closeCreateGroupDialog() {
        this.toggleCreateGroupPanel(false);
        const input = document.getElementById('groupNamesInput');
        if (input) {
            input.value = '';
        }
        this.updateGroupPreview();
    }

    updateGroupPreview() {
        const input = document.getElementById('groupNamesInput');
        const preview = document.getElementById('groupPreview');
        const previewList = document.getElementById('groupPreviewList');

        if (!input || !preview || !previewList) return;

        const text = input.value;
        const lines = text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        if (lines.length === 0) {
            preview.style.display = 'none';
            return;
        }

        preview.style.display = 'block';
        previewList.innerHTML = lines.map((name, index) => `
            <div class="group-preview-item">
                <i class="fas fa-layer-group"></i>
                <span class="group-preview-name">${this.escapeHtml(name)}</span>
                <span class="group-preview-badge">group ${index + 1}</span>
            </div>
        `).join('');
    }
    handleConfirmCreateGroups() {
        const input = document.getElementById('groupNamesInput');
        if (!input) return;

        const text = input.value;
        const names = text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        if (names.length === 0) {
            this.showNotification('Please enter at least one group name', 'error');
            return;
        }

        const groups = this.getCurrentGroups();
        const existingNames = new Set(groups.map(g => g.name.toLowerCase()));
        const created = [];
        const skipped = [];

        names.forEach(name => {
            const trimmedName = name.trim();
            // Prevent creating group named 'init' (reserved for default group)
            if (trimmedName.toLowerCase() === 'init') {
                skipped.push(`"${trimmedName}" (reserved name)`);
            } else if (existingNames.has(trimmedName.toLowerCase())) {
                skipped.push(trimmedName);
            } else {
                const id = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                groups.push({ id, name: trimmedName, files: [], collapsed: false });
                existingNames.add(trimmedName.toLowerCase());
                created.push(trimmedName);
            }
        });

        if (created.length > 0) {
            this.persistGroupsAndRender(groups, this.currentFile);
        }

        this.closeCreateGroupDialog();

        // Display result notification
        const createdMsg = created.length ? `Created ${created.length} group${created.length > 1 ? 's' : ''}` : '';
        const skippedMsg = skipped.length ? `Skipped ${skipped.length} duplicate${skipped.length > 1 ? 's' : ''}` : '';
        const parts = [createdMsg, skippedMsg].filter(s => s);
        const type = created.length > 0 ? 'success' : 'info';
        this.showNotification(`✓ ${parts.join(', ')}`, type);

        if (skipped.length > 0) {
            console.log('Skipped duplicate group names:', skipped);
        }
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
        // Initial position
        menu.style.left = `${e.pageX}px`;
        menu.style.top = `${e.pageY}px`;

        const selectedCount = this.selectedFiles.size;
        let menuHtml = `
            <div class="context-menu-item" data-action="rename">
            <i class="fas fa-edit"></i> Rename
            </div>
            <div class="context-menu-item" data-action="delete">
            <i class="fas fa-trash"></i> Delete Current View <span class="context-menu-hint">(Cmd/Ctrl + Delete)</span>
            </div>
            <div class="context-menu-item" data-action="deleteAll">
            <i class="fas fa-trash-alt"></i> Delete All Files
            </div>
            <div class="context-menu-item" data-action="copyPdfFile">
            <i class="fas fa-copy"></i> Copy PDF File
            </div>
        `;

        // Add copy DOI menu item when at least one file is selected
        if (selectedCount > 0) {
            menuHtml += `
            <div class="context-menu-divider"></div>
            <div class="context-menu-item" data-action="copySelectedFilesDois">
            <i class="fas fa-link"></i> Copy DOIs of Selected Files <span class="context-menu-hint">(${selectedCount} files)</span>
            </div>
            <div class="context-menu-item" data-action="downloadSelectedFilesBib">
            <i class="fas fa-book"></i> Download BibTeX from DOIs <span class="context-menu-hint">(${selectedCount} files)</span>
            </div>
            `;
        }

        menu.innerHTML = menuHtml;

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
                item.innerHTML = `<i class="fas fa-layer-group"></i> Move to: ${this.escapeHtml(g.name || g.id)}`;
                menu.appendChild(item);
            });
        }

        document.body.appendChild(menu);

        // 约束菜单不超出可视区域
        const margin = 8;
        const rect = menu.getBoundingClientRect();
        const maxLeft = window.innerWidth - rect.width - margin;
        const maxTop = window.innerHeight - rect.height - margin;
        const nextLeft = Math.max(margin, Math.min(e.pageX, maxLeft));
        const nextTop = Math.max(margin, Math.min(e.pageY, maxTop));
        menu.style.left = `${nextLeft}px`;
        menu.style.top = `${nextTop}px`;

        // 菜单项点击事件
        menu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                menu.remove();

                if (action === 'rename') {
                    this.renameFile(filename, fileItem);
                } else if (action === 'delete') {
                    if (this.selectedFiles.size > 1) {
                        this.deleteSelectedFilesCurrentView();
                    } else {
                        this.deleteFile(filename, fileItem, false);
                    }
                } else if (action === 'deleteAll') {
                    if (this.selectedFiles.size > 1) {
                        this.deleteSelectedFilesAll();
                    } else {
                        this.deleteFile(filename, fileItem, true);
                    }
                } else if (action === 'copyPdfFile') {
                    this.copyPdfFileToClipboard(filename);
                } else if (action === 'copySelectedFilesDois') {
                    this.copySelectedFilesDois();
                } else if (action === 'downloadSelectedFilesBib') {
                    this.downloadSelectedFilesBib();
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

    showGroupContextMenu(e, group) {
        // Remove old menu
        const oldMenu = document.querySelector('.context-menu');
        if (oldMenu) oldMenu.remove();

        // Create menu
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = `${e.pageX}px`;
        menu.style.top = `${e.pageY}px`;
        const canEdit = group && group.id !== 'init';
        const yearDir = this.groupSortState?.[group?.id]?.year || 'asc';
        const yearIcon = yearDir === 'asc' ? 'fa-sort-amount-down-alt' : 'fa-sort-amount-up-alt';
        const titleDir = this.groupSortState?.[group?.id]?.sourceTitle || 'asc';
        const titleIcon = titleDir === 'asc' ? 'fa-sort-alpha-down' : 'fa-sort-alpha-up';
        const citedWosDir = this.groupSortState?.[group?.id]?.timesCitedWos || 'desc';
        const citedWosIcon = citedWosDir === 'asc' ? 'fa-sort-amount-down-alt' : 'fa-sort-amount-up-alt';
        const citedAllDir = this.groupSortState?.[group?.id]?.timesCitedAll || 'desc';
        const citedAllIcon = citedAllDir === 'asc' ? 'fa-sort-amount-down-alt' : 'fa-sort-amount-up-alt';
        menu.innerHTML = `
            <div class="context-menu-item" data-action="sortGroupByNo">
                <i class="fas fa-sort-numeric-down-alt"></i> Sort by No
            </div>
            <div class="context-menu-item" data-action="sortGroupByYear">
                <i class="fas ${yearIcon}"></i> Sort by Publication Year
            </div>
            <div class="context-menu-item" data-action="sortGroupBySourceTitle">
                <i class="fas ${titleIcon}"></i> Sort by Journal
            </div>
            <div class="context-menu-item" data-action="sortGroupByTimesCitedWos">
                <i class="fas ${citedWosIcon}"></i> Sort by times_cited_wos
            </div>
            <div class="context-menu-item" data-action="sortGroupByTimesCitedAll">
                <i class="fas ${citedAllIcon}"></i> Sort by times_cited_all_databases
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item" data-action="copyGroupDois">
                <i class="fas fa-copy"></i> Copy All DOIs from Group
            </div>
            <div class="context-menu-item" data-action="downloadGroupBib">
                <i class="fas fa-book"></i> Export Group DOIs to BibTeX
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item" data-action="updateGroupFromWos">
                <i class="fas fa-cloud-download-alt"></i> Submit to Chrome Extension
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item danger" data-action="deleteGroupFiles">
                <i class="fas fa-trash-alt"></i> Delete All Files in Group (JSON/MD/PDF)
            </div>
            ${canEdit ? '<div class="context-menu-divider"></div>' : ''}
            ${canEdit ? `
            <div class="context-menu-item" data-action="renameGroup">
                <i class="fas fa-i-cursor"></i> Rename Group
            </div>
            <div class="context-menu-item" data-action="deleteGroup">
                <i class="fas fa-trash"></i> Delete Group
            </div>
            ` : ''}
        `;

        document.body.appendChild(menu);

        // 约束菜单不超出可视区域
        const margin = 8;
        const rect = menu.getBoundingClientRect();
        const maxLeft = window.innerWidth - rect.width - margin;
        const maxTop = window.innerHeight - rect.height - margin;
        const nextLeft = Math.max(margin, Math.min(e.pageX, maxLeft));
        const nextTop = Math.max(margin, Math.min(e.pageY, maxTop));
        menu.style.left = `${nextLeft}px`;
        menu.style.top = `${nextTop}px`;

        // 菜单项点击事件
        menu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', async () => {
                const action = item.dataset.action;
                menu.remove();

                if (action === 'copyGroupDois') {
                    await this.copyGroupDois(group);
                } else if (action === 'downloadGroupBib') {
                    await this.downloadGroupBib(group);
                } else if (action === 'sortGroupByNo') {
                    await this.sortGroupByMetaNo(group.id);
                } else if (action === 'sortGroupByYear') {
                    await this.sortGroupByPublicationYear(group.id);
                } else if (action === 'sortGroupBySourceTitle') {
                    await this.sortGroupBySourceTitle(group.id);
                } else if (action === 'sortGroupByTimesCitedWos') {
                    await this.sortGroupByTimesCitedWos(group.id);
                } else if (action === 'sortGroupByTimesCitedAll') {
                    await this.sortGroupByTimesCitedAll(group.id);
                } else if (action === 'updateGroupFromWos') {
                    await this.updateGroupFromWos(group);
                } else if (action === 'deleteGroupFiles') {
                    await this.deleteAllFilesInGroup(group);
                } else if (action === 'renameGroup') {
                    this.renameGroup(group.id);
                } else if (action === 'deleteGroup') {
                    this.deleteGroup(group.id);
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

    async copyGroupDois(group) {
        try {
            const uniqueDois = await this.collectGroupDois(group);
            if (uniqueDois.length === 0) {
                this.showNotification('No DOI found in this group', 'warning');
                return;
            }
            const doisText = uniqueDois.join('\n');
            await this.writeTextToClipboard(doisText);
            this.showNotification(`Copied ${uniqueDois.length} DOIs`, 'success');
        } catch (err) {
            console.error('Failed to copy group DOIs:', err);
            this.showNotification(`Copy failed: ${err.message}`, 'error');
        }
    }

    async deleteAllFilesInGroup(group) {
        const projectPath = this.getRequiredProjectPath();
        if (!projectPath) return;
        const files = Array.isArray(group?.files) ? group.files : [];
        const bases = files.map(f => (f || '').replace(/\.json$/i, '')).filter(Boolean);
        const uniqueBases = Array.from(new Set(bases));
        if (!uniqueBases.length) {
            this.showNotification('No files in this group', 'warning');
            return;
        }

        const groupName = group?.name || group?.id || 'group';
        const ok = window.confirm(
            `Delete all files in group "${groupName}"?\n` +
            `This action cannot be undone!`
        );
        if (!ok) return;

        const tracker = this.createStatusProgressTracker('Delete group files');
        let job = null;
        try {
            tracker.update('Scanning group files... 0/0', 4);
            const startResp = await fetch('/delete-group-start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectPath, bases: uniqueBases })
            });
            if (!startResp.ok) {
                throw new Error('Failed to start batch delete');
            }
            const startData = await startResp.json();
            const jobId = startData.jobId;

            job = await new Promise((resolve) => {
                const poll = async () => {
                    try {
                        const statusResp = await fetch(`/delete-group-status?jobId=${encodeURIComponent(jobId)}`);
                        if (!statusResp.ok) throw new Error('Status not available');
                        const statusData = await statusResp.json();
                        const jobData = statusData.job || {};
                        const phase = jobData.phase || 'scanning';
                        if (phase === 'scanning') {
                            const scanTotal = Number(jobData.scanTotal || uniqueBases.length || 0);
                            const scanProcessed = Number(jobData.scanProcessed || 0);
                            const found = Number(jobData.targetsFound || 0);
                            const percent = scanTotal ? Math.round((scanProcessed / scanTotal) * 30) : 8;
                            tracker.update(`Scanning files... ${scanProcessed}/${scanTotal} | found ${found}`, percent);
                        } else {
                            const processed = Number(jobData.processed || 0);
                            const totalCount = Number(jobData.total || 0);
                            const percent = totalCount ? 30 + Math.round((processed / totalCount) * 70) : 30;
                            tracker.update(`Deleting files... ${processed}/${totalCount}`, percent);
                        }
                        if (jobData.done) {
                            resolve(jobData);
                            return;
                        }
                        setTimeout(poll, 700);
                    } catch (_err) {
                        setTimeout(poll, 1000);
                    }
                };
                poll();
            });
        } catch (err) {
            tracker.fail(`Delete failed: ${err.message}`);
            this.showNotification(`Delete failed: ${err.message}`, 'error');
            return;
        }

        uniqueBases.forEach((base) => {
            this.removeFilenameFromGroups(base);
            delete this.tempDataCache[`${base}.json`];
            delete this.tempDataCache[`md/${base}.md`];
        });

        const currentBase = (this.currentFileBase || this.currentFile || '').split('/').pop()?.replace(/\.json$/i, '');
        if (currentBase && uniqueBases.includes(currentBase)) {
            this.currentFile = null;
            this.currentData = null;
            this.hasUnsavedChanges = false;
        }

        const deletedCount = Number(job.deleted || 0);
        const failedCount = Number(job.failed || 0);
        const tail = failedCount ? `, failed ${failedCount}` : '';
        tracker.finish('Finalizing...', 800);
        this.showNotification(`✓ Deleted ${deletedCount} file(s) from "${groupName}"${tail}`, failedCount ? 'error' : 'success');
        await this.loadFileList(true);
        if (!this.currentFile && (this.currentFileList || []).length) {
            const nextFile = this.currentFileList[0];
            this.scrollFileIntoView(nextFile, { align: 'center' });
            const nextEl = this.getRenderedFileItem(nextFile);
            if (nextEl) this.loadFile(nextFile, nextEl);
        }
    }

    async downloadGroupBib(group) {
        const tracker = this.createStatusProgressTracker('Export BibTeX');
        try {
            const files = group?.files || [];
            if (files.length === 0) {
                this.showNotification('No files in this group', 'warning');
                return;
            }
            tracker.update(`Collecting DOIs... 0/${files.length}`, 5);
            const uniqueDois = await this.collectGroupDois(group, {
                onProgress: (done, total) => {
                    const percent = total ? Math.round((done / total) * 35) : 10;
                    tracker.update(`Collecting DOIs... ${done}/${total}`, percent);
                }
            });
            if (uniqueDois.length === 0) {
                tracker.finish('No DOI found', 800);
                this.showNotification('No DOI found in this group', 'warning');
                return;
            }
            tracker.update(`Fetching BibTeX... 0/${uniqueDois.length}`, 40);
            const bibtex = await this.formatBibliography(uniqueDois, {
                onProgress: (done, total) => {
                    const percent = total ? 40 + Math.round((done / total) * 55) : 60;
                    tracker.update(`Fetching BibTeX... ${done}/${total}`, Math.min(95, percent));
                }
            });
            const groupName = String(group?.name || 'group').trim();
            const safeGroup = groupName.replace(/[^a-zA-Z0-9._-]+/g, '_') || 'group';
            const filename = `${safeGroup}_${Date.now()}.bib`;
            this.triggerBlobDownload(new Blob([bibtex], { type: 'text/plain' }), filename);
            tracker.finish('BibTeX ready', 800);
            this.showNotification(`Downloaded BibTeX (${uniqueDois.length} DOIs)`, 'success');
        } catch (err) {
            console.error('Failed to download BibTeX for group:', err);
            tracker.fail(`Export failed: ${err.message}`);
            this.showNotification(`Download failed: ${err.message}`, 'error');
        }
    }

    async collectGroupDois(group, opts = {}) {
        const dois = [];
        const files = group?.files || [];
        const total = files.length;
        let done = 0;
        for (const filename of files) {
            try {
                const base = filename;
                const paths = this.getPathsForBase(base);
                const jsonPath = paths?.json || base;
                const data = await this.readProjectFile(jsonPath);
                if (data) {
                    let doi = (data.meta_info && data.meta_info.doi) ||
                        this.findFirstDoiInData(data);
                    if (doi) {
                        doi = String(doi).trim();
                        if (doi) {
                            dois.push(doi);
                        }
                    }
                }
            } catch (err) {
                console.warn(`Failed to read file ${filename}:`, err);
            } finally {
                done += 1;
                if (typeof opts.onProgress === 'function') {
                    opts.onProgress(done, total);
                }
            }
        }
        return [...new Set(dois)];
    }

    async copySelectedFilesDois() {
        try {
            const { dois, selectedFiles } = await this.getSelectedFilesDois();

            if (selectedFiles.length === 0) {
                this.showNotification('No files selected', 'warning');
                return;
            }

            if (dois.length === 0) {
                this.showNotification('No DOI found in selected files', 'warning');
                return;
            }

            // Remove duplicates
            const uniqueDois = [...new Set(dois)];
            const doisText = uniqueDois.join('\n');

            await this.writeTextToClipboard(doisText);
            this.showNotification(`Copied ${uniqueDois.length} DOIs (from ${selectedFiles.length} files)`, 'success');
        } catch (err) {
            console.error('Failed to copy DOIs from selected files:', err);
            this.showNotification(`Copy failed: ${err.message}`, 'error');
        }
    }

    async getSelectedFilesDois() {
        const selectedFiles = this.getSelectedFilesArray();
        const dois = [];
        if (selectedFiles.length === 0) {
            return { dois, selectedFiles };
        }
        for (const filename of selectedFiles) {
            try {
                const base = filename;
                const paths = this.getPathsForBase(base);
                const jsonPath = paths?.json || base;
                const data = await this.readProjectFile(jsonPath);
                if (data) {
                    let doi = (data.meta_info && data.meta_info.doi) ||
                        this.findFirstDoiInData(data);
                    if (doi) {
                        doi = String(doi).trim();
                        if (doi) {
                            dois.push(doi);
                        }
                    }
                }
            } catch (err) {
                console.warn(`Failed to read file ${filename}:`, err);
            }
        }
        return { dois, selectedFiles };
    }

    async downloadSelectedFilesBib() {
        try {
            const { dois, selectedFiles } = await this.getSelectedFilesDois();
            if (selectedFiles.length === 0) {
                this.showNotification('No files selected', 'warning');
                return;
            }
            if (dois.length === 0) {
                this.showNotification('No DOI found in selected files', 'warning');
                return;
            }
            const uniqueDois = [...new Set(dois)];
            const bibtex = await this.formatBibliography(uniqueDois);
            const filename = uniqueDois.length === 1
                ? `${this.normalizeDoiString(uniqueDois[0]).replace(/[^a-zA-Z0-9._-]+/g, '_') || 'reference'}.bib`
                : `references_${Date.now()}.bib`;
            this.triggerBlobDownload(new Blob([bibtex], { type: 'text/plain' }), filename);
            this.showNotification(`Downloaded BibTeX (${uniqueDois.length} DOIs)`, 'success');
        } catch (err) {
            console.error('Failed to download BibTeX for selected files:', err);
            this.showNotification(`Download failed: ${err.message}`, 'error');
        }
    }

    async copyPdfNameToClipboard(jsonFilename) {
        try {
            const base = (jsonFilename || '').replace(/\.[^.]+$/, '');
            const pdfName = `${base}.pdf`;
            await this.writeTextToClipboard(pdfName);
            this.showNotification(`Copied: ${pdfName}`, 'success');
        } catch (err) {
            console.error('Failed to copy PDF filename:', err);
            this.showNotification(`Copy failed: ${err.message}`, 'error');
        }
    }

    async copyPdfFileToClipboard(jsonFilename) {
        try {
            const pdfFile = await this.getPdfFilenameForJson(jsonFilename);
            if (!pdfFile) {
                throw new Error('PDF filename not found');
            }
            try {
                await this.copyPdfFileWithBrowserClipboard(pdfFile);
                this.showNotification(`PDF copied: ${pdfFile}`, 'success');
                return;
            } catch (browserErr) {
                console.warn('Browser clipboard write failed, try server:', browserErr);
            }
            await this.copyPdfFileViaServer(pdfFile);
            this.showNotification(`PDF copied via system clipboard: ${pdfFile}`, 'success');
        } catch (err) {
            console.error('Failed to copy PDF file:', err);
            this.showNotification(`Copy failed: ${err.message}`, 'error');
        }
    }

    async copyPdfFileWithBrowserClipboard(pdfFile) {
        await this.ensureClipboardFileWriteSupported();
        const pdfPath = this.getPdfUrl(pdfFile);
        const resp = await fetch(pdfPath, { cache: 'no-store' });
        if (!resp.ok) throw new Error(`Failed to read PDF (${resp.status})`);
        const blob = await resp.blob();
        const typedBlob = blob.type ? blob : new Blob([await blob.arrayBuffer()], { type: 'application/pdf' });
        const type = typedBlob.type || 'application/pdf';
        const item = new ClipboardItem({ [type]: typedBlob });
        await navigator.clipboard.write([item]);
    }

    async ensureClipboardFileWriteSupported() {
        if (!window.isSecureContext) {
            throw new Error('Current page is not in a secure context (requires https or localhost)');
        }
        if (!navigator.clipboard || typeof navigator.clipboard.write !== 'function' || typeof window.ClipboardItem === 'undefined') {
            throw new Error('Current environment does not support file write to clipboard (requires secure context and modern browser)');
        }
        try {
            const perm = navigator.permissions && navigator.permissions.query
                ? await navigator.permissions.query({ name: 'clipboard-write' })
                : null;
            if (perm && perm.state === 'denied') {
                throw new Error('Browser has denied clipboard write permission, please allow it in settings');
            }
        } catch (_e) {
            // Ignore permission query failure, subsequent write will prompt again
        }
    }

    async copyPdfFileViaServer(pdfFile) {
        const projectPath = this.getRequiredProjectPath();
        if (!projectPath) {
            throw new Error('Project not selected');
        }
        const resp = await fetch('/copy-pdf-to-clipboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectPath, pdfFile })
        });
        if (!resp.ok) {
            const text = await resp.text().catch(() => '');
            throw new Error(text || `Server copy failed (${resp.status})`);
        }
        const result = await resp.json().catch(() => ({}));
        if (!result.success) {
            throw new Error(result.error || 'Server copy failed');
        }
    }

    async copyPdfFileByName(pdfFile) {
        const clean = this.normalizePdfPathValue(pdfFile);
        if (!clean) throw new Error('PDF filename is empty');
        try {
            await this.copyPdfFileWithBrowserClipboard(clean);
            this.showNotification(`PDF copied: ${clean}`, 'success');
            return;
        } catch (browserErr) {
            console.warn('Browser copy failed, fallback server:', browserErr);
        }
        await this.copyPdfFileViaServer(clean);
        this.showNotification(`PDF copied via system clipboard: ${clean}`, 'success');
    }

    async deletePdfFileByName(pdfFile) {
        const clean = this.normalizePdfPathValue(pdfFile);
        if (!clean) throw new Error('PDF filename is empty');
        const projectPath = this.getRequiredProjectPath();
        if (!projectPath) {
            throw new Error('Project not selected');
        }
        const resp = await fetch('/delete-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectPath, filename: clean })
        });
        if (!resp.ok) {
            const text = await resp.text().catch(() => '');
            throw new Error(text || `Delete failed (${resp.status})`);
        }
        const result = await resp.json().catch(() => ({}));
        if (!result.success) {
            throw new Error(result.error || 'Delete failed');
        }
        // Update cached file metadata
        const key = `pdf/${clean}`;
        if (this.fileMetaByPath && this.fileMetaByPath[key]) {
            delete this.fileMetaByPath[key];
        }
        // If currently displaying this PDF, reset preview
        const currentName = this.normalizePdfPathValue(this.currentData?.meta_info?.pdf_path || '');
        if (currentName === clean) {
            this.currentPdfUrl = null;
            this.pendingPdfUrl = null;
            this.pendingPdfFallback = null;
            this.resetPdfViewerFrame();
            this.updatePdfPlaceholder('empty');
        }
    }

    async getPdfFilenameForJson(jsonFilename) {
        const view = this.currentJsonView || 'view1';
        const baseName = (jsonFilename || '').split('/').pop()?.replace(/\.json$/i, '') || (jsonFilename || '');
        const jsonPath = (jsonFilename && jsonFilename.includes('/'))
            ? jsonFilename
            : (this.getViewPathForBase(baseName, view) || `json/${view}/${baseName}.json`);
        const fallback = `${baseName}.pdf`;
        // If current file is loaded and is the target file, directly get from memory meta_info
        if ((this.currentFile === jsonFilename || this.currentFile === jsonPath) && this.currentData?.meta_info) {
            const val = this.normalizePdfPathValue(this.currentData.meta_info.pdf_path);
            if (val) return val;
        }
        // Otherwise read meta_info from file
        try {
            const data = await this.readProjectFile(jsonPath);
            const val = data?.meta_info ? this.normalizePdfPathValue(data.meta_info.pdf_path) : '';
            return val || fallback;
        } catch (err) {
            console.warn('Failed to read meta_info.pdf_path, using default filename:', err);
            return fallback;
        }
    }

    getPdfUrl(pdfFile) {
        const projectPath = this.getProjectKey();
        const clean = (pdfFile || '').replace(/^\.?[\\/]+/, '');

        // 使用新的 /get-pdf API endpoint (支持外部项目)
        // 手动构建URL避免双重编码问题
        const encodedProjectPath = encodeURIComponent(projectPath);
        const encodedFile = encodeURIComponent(clean);
        return `/get-pdf?projectPath=${encodedProjectPath}&file=${encodedFile}`;
    }

    // 重命名文件
    async renameFile(oldFilename, fileItem) {
        const newFilename = prompt('Enter new filename:', oldFilename);
        if (!newFilename || newFilename === oldFilename) return;

        // Ensure filename ends with .json
        const finalFilename = newFilename.endsWith('.json') ? newFilename : newFilename + '.json';
        const projectPath = this.getRequiredProjectPath();
        if (!projectPath) return;

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

            if (!response.ok) throw new Error('Rename failed');

            // If a markdown file with the same name exists, rename it synchronously
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
                        this.showNotification(`✓ Markdown renamed to ${newMd}`, 'success');
                    } catch (mdErr) {
                        console.warn('Markdown rename failed:', mdErr);
                        this.showNotification('⚠️ Markdown rename failed, please check manually', 'info');
                    }
                } else {
                    console.info('No markdown to rename for', oldMd);
                }
            }

            this.showNotification(`✓ Renamed to ${finalFilename}`, 'success');
            this.updateFilenameInGroups(oldFilename, finalFilename);

            // If the current file is being renamed, update the current filename
            if (this.currentFile === oldFilename) {
                this.currentFile = finalFilename;
                this.currentMarkdownFile = this.getMarkdownFilename(finalFilename);
            }

            // Elegant update: only update the filename display, keep selection state
            const span = fileItem.querySelector('span');
            if (span) {
                span.textContent = finalFilename;
            }

            // Update filename reference in click event handler (rebind)
            const newFileItem = fileItem.cloneNode(true);
            newFileItem.addEventListener('click', function () {
                window.paperStats.loadFile(finalFilename, this);
            });
            newFileItem.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                window.paperStats.showFileContextMenu(e, finalFilename, newFileItem);
            });
            fileItem.replaceWith(newFileItem);

            // Reload file list to update sorting, but keep selection state
            await this.loadFileList(true);

        } catch (error) {
            console.error('Error renaming file:', error);
            this.showNotification('Rename failed', 'error');
        }
    }

    // 删除文件
    async deleteFile(filename, fileItem, deleteAll = false) {
        const projectPath = this.getRequiredProjectPath();
        if (!projectPath) return;
        const base = (filename || '').replace(/\.json$/i, '');

        let targets = [];
        let pdfPath = null;

        if (deleteAll) {
            // Delete all files with the same name: all JSON views, MD, PDF
            targets = this.getAllPathsForDelete(base);

            // Add PDF file path
            const pdfInMeta = Object.entries(this.fileMetaByPath || {}).find(([path, meta]) => {
                const baseName = path.split('/').pop()?.replace(/\.(pdf|JSON|md)$/i, '');
                return baseName === base && meta.kind === 'pdf';
            });
            if (pdfInMeta) {
                pdfPath = pdfInMeta[0];
                targets.push({ path: pdfPath, type: 'pdf' });
            } else {
                // Fallback: delete pdf/<base>.pdf even if metadata is missing
                const fallbackPdf = `pdf/${base}.pdf`;
                targets.push({ path: fallbackPdf, type: 'pdf' });
            }

            const jsonCount = targets.filter(t => t.type === 'json').length;
            const mdCount = targets.filter(t => t.type === 'md').length;
            const pdfCount = targets.filter(t => t.type === 'pdf').length;
            const ok = window.confirm(
                `Are you sure you want to delete all files for "${base}"?\n` +
                `JSON: ${jsonCount} file(s)\n` +
                `Markdown: ${mdCount} file(s)\n` +
                `PDF: ${pdfCount} file(s)\n` +
                `This action cannot be undone!`
            );
            if (!ok) return;
        } else {
            // Only delete JSON file in current view and associated MD
            const currentView = this.currentJsonView || 'view1';
            const jsonPath = `json/${currentView}/${base}.json`;
            targets.push({ path: jsonPath, type: 'json' });
            targets.push({ path: `md/${base}.md`, type: 'md' });

            const ok = window.confirm(`Are you sure you want to delete JSON and Markdown files for "${base}" in current view (${currentView})? This action cannot be undone!`);
            if (!ok) return;
        }

        if (!targets.length) {
            this.showNotification('No files found to delete', 'error');
            return;
        }

        let deletedCount = 0;
        let deletedMd = false;
        try {
            for (const t of targets) {
                try {
                    const endpoint = t.type === 'pdf' ? '/delete-pdf' : '/delete-json';
                    const resp = await fetch(endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            projectPath,
                            filename: t.path
                        })
                    });
                    if (!resp.ok) continue;
                    deletedCount++;
                    if (t.type === 'md') deletedMd = true;
                } catch (err) {
                    console.warn('Delete failed', t.path, err);
                }
            }

            const msg = deleteAll
                ? `✓ Deleted all files for "${base}" (${deletedCount} file(s))`
                : `✓ Deleted ${deletedCount} file(s)`;
            this.showNotification(msg, 'success');
            this.removeFilenameFromGroups(base);

            // Refresh list to ensure deleted files are not loaded
            await this.loadFileList(true);

            // If current file was deleted, clear state and load first file
            if (this.currentFile === filename || this.currentFile === `${base}.json`) {
                this.currentFile = null;
                this.currentData = null;
                this.hasUnsavedChanges = false;
                delete this.tempDataCache[filename];
                delete this.tempDataCache[`${base}.json`];
                delete this.tempDataCache[`md/${base}.md`];

                const nextFile = (this.currentFileList || [])[0];
                if (nextFile) {
                    this.scrollFileIntoView(nextFile, { align: 'center' });
                    const nextEl = this.getRenderedFileItem(nextFile);
                    this.loadFile(nextFile, nextEl);
                } else {
                    this.showLoading();
                }
            }

            // Remove node with animation
            if (fileItem && fileItem.remove) {
                fileItem.style.transition = 'opacity 0.3s ease';
                fileItem.style.opacity = '0';
                setTimeout(() => fileItem.remove(), 300);
            }

        } catch (error) {
            console.error('Error deleting file:', error);
            this.showNotification('Delete failed', 'error');
        }
    }

    async deleteSelectedFilesAll() {
        const projectPath = this.getRequiredProjectPath();
        if (!projectPath) return;
        const bases = this.getSelectedFilesArray().map(f => (f || '').replace(/\.json$/i, '')).filter(Boolean);
        const uniqueBases = Array.from(new Set(bases));
        if (!uniqueBases.length) {
            this.showNotification('No files selected', 'warning');
            return;
        }
        const targetMap = new Map();
        uniqueBases.forEach((base) => {
            const targets = this.getAllPathsForDelete(base);
            const pdfInMeta = Object.entries(this.fileMetaByPath || {}).find(([path, meta]) => {
                const baseName = path.split('/').pop()?.replace(/\.(pdf|JSON|md)$/i, '');
                return baseName === base && meta.kind === 'pdf';
            });
            if (pdfInMeta) {
                targets.push({ path: pdfInMeta[0], type: 'pdf' });
            } else {
                targets.push({ path: `pdf/${base}.pdf`, type: 'pdf' });
            }
            targets.forEach(t => {
                if (!t?.path) return;
                const key = `${t.type}:${t.path}`;
                if (!targetMap.has(key)) targetMap.set(key, t);
            });
        });
        const targets = Array.from(targetMap.values());
        const jsonCount = targets.filter(t => t.type === 'json').length;
        const mdCount = targets.filter(t => t.type === 'md').length;
        const pdfCount = targets.filter(t => t.type === 'pdf').length;
        const ok = window.confirm(
            `Are you sure you want to delete all files for ${uniqueBases.length} selection(s)?\n` +
            `JSON: ${jsonCount} file(s)\n` +
            `Markdown: ${mdCount} file(s)\n` +
            `PDF: ${pdfCount} file(s)\n` +
            `This action cannot be undone!`
        );
        if (!ok) return;

        let deletedCount = 0;
        for (const t of targets) {
            try {
                const endpoint = t.type === 'pdf' ? '/delete-pdf' : '/delete-json';
                const resp = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projectPath,
                        filename: t.path
                    })
                });
                if (!resp.ok) continue;
                deletedCount++;
            } catch (err) {
                console.warn('Delete failed', t.path, err);
            }
        }

        uniqueBases.forEach((base) => {
            this.removeFilenameFromGroups(base);
            delete this.tempDataCache[`${base}.json`];
            delete this.tempDataCache[`md/${base}.md`];
        });

        const currentBase = (this.currentFileBase || this.currentFile || '').split('/').pop()?.replace(/\.json$/i, '');
        if (currentBase && uniqueBases.includes(currentBase)) {
            this.currentFile = null;
            this.currentData = null;
            this.hasUnsavedChanges = false;
        }

        this.showNotification(`✓ Deleted ${deletedCount} file(s)`, 'success');
        await this.loadFileList(true);
        if (!this.currentFile && (this.currentFileList || []).length) {
            const nextFile = this.currentFileList[0];
            this.scrollFileIntoView(nextFile, { align: 'center' });
            const nextEl = this.getRenderedFileItem(nextFile);
            if (nextEl) this.loadFile(nextFile, nextEl);
        }
    }

    async deleteSelectedFilesCurrentView() {
        const projectPath = this.getRequiredProjectPath();
        if (!projectPath) return;
        const bases = this.getSelectedFilesArray().map(f => (f || '').replace(/\.json$/i, '')).filter(Boolean);
        const uniqueBases = Array.from(new Set(bases));
        if (!uniqueBases.length) {
            this.showNotification('No files selected', 'warning');
            return;
        }
        const currentView = this.currentJsonView || 'view1';
        const targets = [];
        uniqueBases.forEach((base) => {
            targets.push({ path: `json/${currentView}/${base}.json`, type: 'json' });
            targets.push({ path: `md/${base}.md`, type: 'md' });
        });
        const ok = window.confirm(
            `Are you sure you want to delete JSON and Markdown files for ${uniqueBases.length} selection(s) in current view (${currentView})? This action cannot be undone!`
        );
        if (!ok) return;

        let deletedCount = 0;
        for (const t of targets) {
            try {
                const resp = await fetch('/delete-json', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projectPath,
                        filename: t.path
                    })
                });
                if (!resp.ok) continue;
                deletedCount++;
            } catch (err) {
                console.warn('Delete failed', t.path, err);
            }
        }

        uniqueBases.forEach((base) => {
            delete this.tempDataCache[`${base}.json`];
            delete this.tempDataCache[`md/${base}.md`];
        });

        const currentBase = (this.currentFileBase || this.currentFile || '').split('/').pop()?.replace(/\.json$/i, '');
        if (currentBase && uniqueBases.includes(currentBase)) {
            this.currentFile = null;
            this.currentData = null;
            this.hasUnsavedChanges = false;
        }

        this.showNotification(`✓ Deleted ${deletedCount} file(s)`, 'success');
        await this.loadFileList(true);
        if (!this.currentFile && (this.currentFileList || []).length) {
            const nextFile = this.currentFileList[0];
            this.scrollFileIntoView(nextFile, { align: 'center' });
            const nextEl = this.getRenderedFileItem(nextFile);
            if (nextEl) this.loadFile(nextFile, nextEl);
        }
    }

    handlePdfPanelDragOver(e) {
        if (!e?.dataTransfer) return;
        const hasPdf = Array.from(e.dataTransfer.items || []).some(item => {
            if (item.kind !== 'file') return false;
            const type = (item.type || '').toLowerCase();
            const name = (item.getAsFile?.()?.name || '').toLowerCase();
            return type.includes('pdf') || name.endsWith('.pdf');
        });
        if (!hasPdf) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    }

    handlePdfPanelDrop(e) {
        if (!e?.dataTransfer) return;
        const files = Array.from(e.dataTransfer.files || []);
        const pdfFiles = files.filter(f => this.isPdfFile(f));
        if (!pdfFiles.length) return;
        e.preventDefault();
        e.stopPropagation();
        this.handlePdfDropOrPaste(pdfFiles, 'drop').catch(err => {
            console.error('PDF drop failed:', err);
        });
    }

    async handlePdfDropOrPaste(files = [], source = 'drop') {
        const pdfFile = (files || []).find(f => this.isPdfFile(f));
        if (!pdfFile) return;

        const baseName = this.currentFileBase
            || (this.currentFile ? this.currentFile.split('/').pop()?.replace(/\.json$/i, '') : '');
        if (!this.currentProject || !baseName) {
            this.showNotification('Please select a JSON file before pasting/dropping PDF', 'warning');
            return;
        }

        const targetName = `${baseName}.pdf`;
        const pdfPathKey = `pdf/${targetName}`;
        const isReplacing = !!(this.fileMetaByPath?.[pdfPathKey]);

        try {
            const dataUrl = await this.readFileAsDataUrl(pdfFile);
            const base64 = (String(dataUrl).split(',')[1] || '').trim();
            if (!base64) throw new Error('Unable to read PDF content');

            const resp = await fetch('/upload-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectPath: this.currentProject.path,
                    filename: targetName,
                    content: base64,
                    overwrite: true  // 允许覆盖已存在的PDF
                })
            });
            const result = await resp.json();
            if (!resp.ok || !result.success) {
                throw new Error(result.error || 'Upload failed');
            }

            if (!this.fileMetaByPath) this.fileMetaByPath = {};
            this.fileMetaByPath[pdfPathKey] = { name: targetName, path: pdfPathKey, kind: 'pdf', category: 'pdf' };

            // If current meta_info has no pdf_path set, auto-fill it
            if (this.currentData?.meta_info && !this.currentData.meta_info.pdf_path) {
                this.currentData.meta_info.pdf_path = targetName;
                this.hasUnsavedChanges = true;
                this.tempDataCache[this.currentFile] = this.currentData;
                this.updateSaveButtonState();
            }

            const action = isReplacing ? 'updated' : 'saved';
            this.showNotification(`PDF ${action} as ${targetName}`, 'success');

            // Refresh current PDF preview
            this.currentPdfUrl = this.getPdfUrl(targetName);
            this.pendingPdfUrl = this.currentPdfUrl;
            this.pendingPdfFallback = null;
            this.currentPdfLoadToken++;

            // 清除PDF可用性缓存，确保能够检测到新上传的PDF
            if (this._pdfAvailabilityCache) {
                this._pdfAvailabilityCache.delete(this.currentPdfUrl);
            }

            // 跳过可用性检查，直接加载刚上传的PDF
            this._skipPdfAvailabilityCheck = true;

            this.resetPdfViewerFrame();
            await this.ensurePdfLoaded();
        } catch (error) {
            console.error('PDF processing failed:', error);
            this.showNotification(`PDF processing failed: ${error.message}`, 'error');
        }
    }

    async handlePdfDropCreateEntries(files = [], targetGroupId = null) {
        if (!this.currentProject) {
            this.showNotification('Please load a project first', 'warning');
            return;
        }
        const pdfFiles = (files || []).filter(f => this.isPdfFile(f));
        if (!pdfFiles.length) return;
        const tracker = this.createStatusProgressTracker('PDF import');

        let nextNo = null;
        try {
            const maxNo = await this.getMaxMetaNo();
            nextNo = (Number.isFinite(maxNo) ? maxNo : 0) + 1;
        } catch (err) {
            console.warn('Failed to init auto-numbering for PDF drop:', err);
        }

        const view = this.currentJsonView || 'view1';
        const created = [];
        const updated = [];
        const moved = [];
        const skipped = [];
        const failed = [];
        const seenBases = new Set();
        const total = pdfFiles.length;
        let processed = 0;
        const notifyStep = Math.max(1, Math.floor(total / 10));
        tracker.update(`PDF import: 0/${total}`, 5);

        for (const pdfFile of pdfFiles) {
            try {
                const doi = await this.extractDoiFromPdfFile(pdfFile);
                if (!doi) {
                    skipped.push({ file: pdfFile.name, reason: 'No DOI found' });
                    continue;
                }
                const base = this.doiToFilenameBase(doi);
                if (!base) {
                    skipped.push({ file: pdfFile.name, reason: 'Invalid DOI' });
                    continue;
                }

                // 检查是否在当前批次中已处理
                if (seenBases.has(base)) {
                    skipped.push({ file: pdfFile.name, reason: 'Duplicate in batch' });
                    continue;
                }

                // 在所有分组中查找是否已存在该文件
                const groups = this.getCurrentGroups();
                let foundInGroup = null;
                for (const group of groups) {
                    if (group.files && group.files.includes(base)) {
                        foundInGroup = group;
                        break;
                    }
                }

                seenBases.add(base);

                const pdfTargetName = `${base}.pdf`;
                const pdfPathKey = `pdf/${pdfTargetName}`;
                const pdfAlreadyExists = this.fileMetaByPath?.[pdfPathKey];

                // 如果文件已存在于某个分组
                if (foundInGroup) {
                    // 检查是否已有 PDF 文件
                    if (pdfAlreadyExists) {
                        // PDF 已存在，只处理移动逻辑
                        if (targetGroupId && foundInGroup.id !== targetGroupId) {
                            moved.push(base);
                        } else {
                            skipped.push({ file: pdfFile.name, reason: `Already in ${foundInGroup.name || foundInGroup.id}` });
                        }
                        continue;
                    }
                    // PDF 不存在，需要上传 PDF 并更新 JSON
                    // 继续执行后续的 PDF 上传逻辑
                } else {
                    // 新文件，检查 PDF 是否已存在
                    if (pdfAlreadyExists) {
                        skipped.push({ file: pdfFile.name, reason: 'PDF already exists' });
                        continue;
                    }
                }

                const dataUrl = await this.readFileAsDataUrl(pdfFile);
                const base64 = (String(dataUrl).split(',')[1] || '').trim();
                if (!base64) throw new Error('Unable to read PDF content');

                const resp = await fetch('/upload-pdf', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projectPath: this.currentProject.path,
                        filename: pdfTargetName,
                        content: base64
                    })
                });
                const result = await resp.json();
                if (!resp.ok || !result.success) {
                    throw new Error(result.error || 'Upload failed');
                }

                // 如果文件已存在，更新现有 JSON；否则创建新文件
                if (foundInGroup) {
                    // 文件已存在，只需更新 PDF 路径
                    const existingMeta = this.fileMetaByBase?.[base];
                    if (existingMeta?.views?.[view]) {
                        const jsonFilename = existingMeta.views[view];
                        try {
                            const existingPayload = await this.readProjectFile(jsonFilename);
                            if (existingPayload) {
                                existingPayload.meta_info = existingPayload.meta_info || {};
                                existingPayload.meta_info.pdf_path = pdfTargetName;
                                await this.saveJsonPayload(jsonFilename, existingPayload);
                                updated.push(base);
                            }
                        } catch (err) {
                            console.warn('Failed to update existing JSON with PDF path:', err);
                        }
                    }
                    // 标记为移动（如果需要）
                    if (targetGroupId && foundInGroup.id !== targetGroupId) {
                        moved.push(base);
                    }
                } else {
                    // 创建新文件
                    const jsonFilename = `json/${view}/${base}.json`;
                    const payload = this.buildDoiJsonTemplate(doi);
                    payload.meta_info.pdf_path = pdfTargetName;
                    if (Number.isFinite(nextNo)) {
                        payload.meta_info.No = nextNo;
                        nextNo += 1;
                    }
                    await this.saveJsonPayload(jsonFilename, payload);
                    await this.ensureMarkdownExistsForFile(jsonFilename);
                    created.push(base);
                }
            } catch (err) {
                console.error('PDF drop create failed:', pdfFile?.name, err);
                failed.push({ file: pdfFile?.name || 'PDF', reason: err.message || 'Unknown error' });
            } finally {
                processed += 1;
                if (processed % notifyStep === 0 || processed === total) {
                    const percent = total ? Math.round((processed / total) * 90) : 90;
                    tracker.update(`PDF import: ${processed}/${total}`, Math.min(95, percent));
                }
            }
        }

        // 重新加载文件列表以包含新创建/更新的文件
        if (created.length || updated.length) {
            await this.loadFileList(true);
        }
        const moveTargets = targetGroupId ? [...new Set([...created, ...updated, ...moved])] : [];
        if (moveTargets.length) {
            this.moveFilesToGroup(moveTargets, targetGroupId);
        }

        // 标记即将加载的文件需要强制加载PDF（即使autoLoadPdf=false）
        this._forceLoadPdfOnNextFile = true;

        if (created.length) {
            const targetBase = created[0];
            setTimeout(() => {
                this.scrollFileIntoView(targetBase, { align: 'center' });
                const item = this.getRenderedFileItem(targetBase);
                if (item) this.loadFile(targetBase, item);
            }, 120);
        } else if (updated.length) {
            const targetBase = updated[0];
            setTimeout(() => {
                this.scrollFileIntoView(targetBase, { align: 'center' });
                const item = this.getRenderedFileItem(targetBase);
                if (item) this.loadFile(targetBase, item);
            }, 120);
        }

        const parts = [];
        if (created.length) parts.push(`created ${created.length}`);
        if (updated.length) parts.push(`updated ${updated.length}`);
        if (moved.length) parts.push(`moved ${moved.length}`);
        if (skipped.length) parts.push(`skipped ${skipped.length}`);
        if (failed.length) parts.push(`failed ${failed.length}`);
        const type = failed.length ? 'error' : ((created.length || updated.length) ? 'success' : 'info');
        if (parts.length) {
            tracker.finish('PDF import: finalizing...', 800);
            this.showNotification(`PDF import: ${parts.join(', ')}`, type);
        } else {
            tracker.finish('PDF import: done', 600);
        }
    }

    async handlePdfImportInput(e) {
        const input = e?.target;
        const files = Array.from(input?.files || []);
        if (!files.length) return;
        try {
            await this.handlePdfDropCreateEntries(files, null);
        } finally {
            if (input) input.value = '';
        }
    }

    // 处理粘贴事件
    async handlePaste(e) {
        try {
            // Special handling for Markdown editor: insert and render QA code blocks when pasting
            // Skip processing if pasting in input fields
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            // Paste PDF file in right panel PDF area
            const clipboardFiles = Array.from((e.clipboardData && e.clipboardData.files) || []);
            const inRightPanel = !!e.target.closest('.right-panel');
            const pdfFiles = clipboardFiles.filter(f => this.isPdfFile(f));
            if (inRightPanel && pdfFiles.length) {
                e.preventDefault();
                await this.handlePdfDropOrPaste(pdfFiles, 'paste');
                return;
            }

            // Paste QA code block in Markdown render area: append to end, prompt for title, allow undo
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

            this.debugLog('📋 Detected paste content, attempting to parse JSON...');

            // Try to extract and parse JSON
            const jsonData = this.extractJSON(pastedText);
            if (!jsonData) {
                this.showNotification('No valid JSON detected, format may be incorrect', 'error');
                return;
            }

            const inLeftPanel = !!e.target.closest('.left-panel');
            const inCenterPanel = !!e.target.closest('.middle-panel');

            // Center table: merge/update current JSON
            if (inCenterPanel && this.currentData) {
                e.preventDefault();
                if (typeof jsonData !== 'object' || Array.isArray(jsonData)) {
                    this.showNotification('Pasted content is not an object, cannot merge', 'error');
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
                    this.showNotification('Merged pasted content into current file', 'success');
                } else {
                    this.showNotification('No mergeable fields detected', 'info');
                }
                return;
            }

            // Left file area: validate structure and create new file
            if (inLeftPanel) {
                e.preventDefault();
                const required = ['schema_version', 'meta_info'];
                const missing = required.filter(k => !jsonData.hasOwnProperty(k));
                if (missing.length) {
                    this.showNotification(`JSON missing required fields: ${missing.join(', ')}`, 'error');
                    return;
                }
                const defaultName = jsonData.meta_info?.paper_id
                    ? `${jsonData.meta_info.paper_id}.json`
                    : 'pasted_data.json';

                const filename = prompt('Valid JSON data detected!\nPlease enter filename:', defaultName);
                if (!filename) return;
                const finalFilename = filename.endsWith('.json') ? filename : filename + '.json';
                await this.saveNewJSONFile(finalFilename, jsonData);
                this.lastPasteBackup = null;
                this.updateUndoButtonState();
                return;
            }

            // Other areas: maintain default creation logic
            e.preventDefault();
            const filename = prompt('Valid JSON data detected!\nPlease enter filename:', 'pasted_data.json');
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
    getPathsForBase(base) {
        const clean = (base || '').replace(/\.json$/i, '');
        const entry = this.fileMetaByBase?.[clean];
        const jsonPath = entry?.views?.[this.currentJsonView] || entry?.views?.[Object.keys(entry?.views || {})[0]] || `json/view1/${clean}.json`;
        const mdPath = entry?.mdPath || `md/${clean}.md`;
        return {
            json: jsonPath,
            md: mdPath,
            pdf: `pdf/${clean}.pdf`
        };
    }

    getAllPathsForDelete(base) {
        const clean = (base || '').replace(/\.json$/i, '');
        const entry = this.fileMetaByBase?.[clean];
        const paths = [];
        if (entry?.views && typeof entry.views === 'object') {
            Object.values(entry.views).forEach(p => { if (p) paths.push({ path: p, type: 'json' }); });
        }
        if (entry?.legacyJson) paths.push({ path: entry.legacyJson, type: 'json' });
        const mdPath = entry?.mdPath || `md/${clean}.md`;
        if (mdPath) paths.push({ path: mdPath, type: 'md' });

        // 去重
        const seen = new Set();
        return paths.filter(({ path }) => {
            const key = path;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    getViewPathForBase(base, view) {
        const clean = (base || '').replace(/\.json$/i, '');
        const entry = this.fileMetaByBase?.[clean];
        if (entry && entry.views && entry.views[view]) return entry.views[view];
        if (view) return `json/${view}/${clean}.json`;
        if (entry && entry.views) {
            const first = Object.values(entry.views)[0];
            if (first) return first;
        }
        return null;
    }

    getAllJsonPathsForBase(base) {
        const clean = (base || '').replace(/\.json$/i, '');
        const entry = this.fileMetaByBase?.[clean];
        const paths = new Set();
        if (entry?.views && typeof entry.views === 'object') {
            Object.values(entry.views).forEach((p) => { if (p) paths.add(p); });
        }
        if (entry?.legacyJson) paths.add(entry.legacyJson);
        return Array.from(paths);
    }

    async saveNewJSONFile(filename, jsonData) {
        try {
            const jsonString = JSON.stringify(jsonData, null, 2);
            const projectPath = this.getRequiredProjectPath();
            if (!projectPath) return;

            const response = await fetch('/save-json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectPath,
                    filename: filename,
                    content: jsonString
                })
            });

            if (!response.ok) throw new Error('Save failed');

            this.showNotification(`File created: ${filename}`, 'success');

            // 保存当前文件名，加载列表后恢复选中
            const tempCurrentFile = this.currentFile;
            this.currentFile = filename; // 设置为新文件，以便加载后选中

            // 重新加载文件列表，保持选中状态
            await this.loadFileList(true);

            // 自动加载新创建的文件
            setTimeout(() => {
                const base = filename.split('/').pop()?.replace(/\.json$/i, '') || filename;
                this.scrollFileIntoView(base, { align: 'center' });
                const newFileItem = this.getRenderedFileItem(base);
                if (newFileItem) this.loadFile(base, newFileItem);
            }, 200);

        } catch (error) {
            console.error('Error saving new JSON file:', error);
            this.showNotification(`Save failed: ${error.message}`, 'error');
        }
    }

    coalesceRecordValue(record = {}, tag) {
        const val = record?.[tag];
        if (Array.isArray(val)) return val.join(' ').trim();
        return val ? String(val).trim() : '';
    }

    ensureGroupByName(name) {
        const groups = this.getCurrentGroups();
        let target = groups.find(g => (g.name || '').toLowerCase() === name.toLowerCase());
        if (!target) {
            const id = `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            target = { id, name, files: [], collapsed: false };
            groups.push(target);
            this.persistGroupsAndRender(groups, this.currentFile);
        }
        return target.id;
    }

    async loadFile(identifier, clickedElement = null) {
        const base = (identifier || '').split('/').pop()?.replace(/\.json$/i, '') || identifier;
        const paths = this.getPathsForBase(base);
        const filename = paths.json;
        const loadId = ++this.currentLoadToken;
        const hadTempCacheBefore = !!this.tempDataCache[filename];
        try {
            if (!this.selectedFiles.has(base)) {
                this.setSelectedFiles([base], base);
            }
            
            // 更新当前文件所在的分组ID
            const groups = this.getCurrentGroups();
            this.currentGroupId = null;
            for (const g of groups) {
                if ((g.files || []).includes(base)) {
                    this.currentGroupId = g.id;
                    break;
                }
            }
            
            // 如果当前 Markdown 有未保存修改，提示用户
            if (this.hasUnsavedMarkdownChanges && this.currentMarkdownExists) {
                const mdFilename = this.getActiveMarkdownFilename();
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
                // Fetch JSON file，使用新的 API（支持外部项目）
                const data = await this.readProjectFile(filename);
                // 若在加载过程中用户切换了文件，放弃应用结果
                if (loadId !== this.currentLoadToken) return;
                this.currentData = data;
                this.hasUnsavedChanges = false;
            }
            if (loadId !== this.currentLoadToken) return;

            this.currentFile = filename;
            this.currentFileBase = base;
            const metaChanged = this.ensureMetaInfoDefaultsOnLoad(filename);
            this.setLastSelectedFile(base);
            this.updateFileMeta();

            // 更新UI状态
            this.updateSaveButtonState();
            this.updateSchemaBadge();
            this.updateUndoButtonState();

            // Render data
            this.renderStructuredView();
            this.renderFlatView();
            this.updateMdChatFieldOptionsFromCurrentData();
            this.runMdChatFieldQuery();
            // 再次确认未切换文件
            if (loadId !== this.currentLoadToken) return;
            if (!this.isDraftViewActive) {
                await this.loadMarkdownForCurrentFile();
            }
            // 自动保存因默认 meta 补全产生的更改，避免频繁提示
            if (metaChanged && !hadTempCacheBefore) {
                await this.autoSaveMetaDefaults();
            }

            // 准备 PDF，但懒加载，先不实际加载
            const { relPath, fileName } = this.normalizePdfRel(this.currentData?.meta_info?.pdf_path || '');
            const pdfName = fileName || (paths.pdf.split('/').pop() || '');
            if (pdfName || relPath) {
                const projectPath = this.getProjectKey();
                const primaryUrl = relPath
                    ? `/${projectPath}/${relPath}`
                    : this.getPdfUrl(pdfName);
                const fallbackUrl = relPath ? null : `/${projectPath}/papers/${pdfName}`;
                this.currentPdfUrl = primaryUrl;
                this.pendingPdfUrl = primaryUrl;
                this.pendingPdfFallback = fallbackUrl;
                this.currentPdfLoadToken++;
                this.lastPdfLoadedKey = '';
                this.updatePdfPlaceholder('pending');
                this.prewarmPdf(primaryUrl);
                // 如果autoLoadPdf开启，或者有强制加载标志，则自动加载PDF
                const shouldForceLoad = this._forceLoadPdfOnNextFile;
                if (shouldForceLoad) {
                    this._forceLoadPdfOnNextFile = false; // 清除标志
                    // 刚导入的PDF，跳过可用性检查直接加载
                    this._skipPdfAvailabilityCheck = true;
                }
                if (this.autoLoadPdf || shouldForceLoad) {
                    await this.ensurePdfLoaded();
                }
            } else {
                this.currentPdfUrl = null;
                this.pendingPdfUrl = null;
                this.pendingPdfFallback = null;
                this.currentPdfLoadToken++;
                this.resetPdfViewerFrame();
                this.updatePdfPlaceholder('empty');
                this.lastPdfLoadedUrl = '';
                this.lastPdfLoadedKey = '';
                // 清除强制加载标志（如果有）
                this._forceLoadPdfOnNextFile = false;
            }
            if (!(this.isDraftViewActive && (this.currentView === 'markdown' || this.currentView === 'draft'))) {
                await this.applyCurrentView();
            }
        } catch (error) {
            console.error('Error loading file:', error);
            const spaceHint = /\s/.test(filename) ? ' (Hint: Filename contains spaces, please remove them and try again)' : '';
            alert(`Failed to load file: ${error.message}${spaceHint}`);
            this.showNotification(`Failed to load file${spaceHint}`, 'error');
        }
    }

    resetMainPanelsForProject() {
        const structuredView = document.getElementById('structuredContent') || document.getElementById('structuredView');
        if (structuredView) {
            structuredView.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-file-alt"></i>
                    <h3>No File Selected</h3>
                    <p>Select a JSON file from the left panel to start editing</p>
                </div>
            `;
        }

        const markdownView = document.getElementById('markdownRender');
        if (markdownView) {
            markdownView.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-file-alt"></i>
                    <h3>No File Selected</h3>
                    <p>选择左侧 JSON 文件以查看对应的 Markdown 笔记</p>
                </div>
            `;
        }

        const markdownEditor = document.getElementById('markdownEditor');
        if (markdownEditor) markdownEditor.style.display = 'none';
        const markdownTextarea = document.getElementById('markdownTextarea');
        if (markdownTextarea) markdownTextarea.value = '';

        const flatView = document.getElementById('flatView');
        if (flatView) {
            flatView.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-code"></i>
                    <h3>No File Selected</h3>
                    <p>选择左侧 JSON 查看原始 JSON</p>
                </div>
            `;
        }

        this.resetPdfViewerFrame();
        this.updatePdfPlaceholder('empty');

        // Reset complete groups cache when project changes
        this.completeGroupsForCurrentProject = null;

        // Clear view selector state when no project is active
        this.availableJsonViews = [];
        this.currentJsonView = '';
        this.renderJsonViewSelector();
    }

    showLoading() {
        const structuredView = document.getElementById('structuredContent') || document.getElementById('structuredView');
        const markdownView = document.getElementById('markdownRender');
        const flatView = document.getElementById('flatView');

        // 保持空白，不再显示“Loading”提示
        structuredView.innerHTML = '';
        if (markdownView && !this.isDraftViewActive) markdownView.innerHTML = '';
        if (flatView) flatView.innerHTML = '';
    }

    renderStructuredView() {
        // 清理悬浮预览
        this.hideSectionPreview();
        const container = document.getElementById('structuredContent') || document.getElementById('structuredView');
        container.innerHTML = '';

        // Iterate through top-level sections with collapsible support (meta_info always first)
        const topEntries = Object.entries(this.currentData);
        const orderedEntries = [
            ...topEntries.filter(([k]) => k === 'meta_info'),
            ...topEntries.filter(([k]) => k !== 'meta_info')
        ];

        for (const [sectionKey, sectionValue] of orderedEntries) {
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
            <i class="fas fa-chevron-right collapsible-toggle" title="Expand/Collapse"></i>
            <span class="collapsible-title">${this.formatKey(title)}</span>
            <i class="fas fa-plus header-add" title="Add child item under this section"></i>
            <i class="fas fa-trash header-delete" title="Delete this field"></i>
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
        // Click table blank area to select the corresponding section
        table.addEventListener('click', (e) => {
            if (e.target.closest('tr')) return;
            this.setSelectedItem({ type: 'section', path: [], key: title });
            // 激活中间栏，使得键盘上下键可以工作
            this.setActivePanel('middle');
        });
        this.renderObject(data, table, path, null);
        content.appendChild(table);

        // Toggle functionality / Reorder selection / Delete
        if (!this.isReorderMode) {
            // Double-click rename/edit removed to avoid accidental triggers
        }

        // Delete button
        const deleteBtn = header.querySelector('.header-delete');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const firstConfirm = confirm(`Are you sure to delete the entire field "${title}" and all its contents?`);
                if (!firstConfirm) return;
                const secondConfirm = confirm('Confirm again: deletion cannot be undone, continue?');
                if (!secondConfirm) return;
                this.deleteField([], title);
            });
        }
        // Add child item button
        const addBtn = header.querySelector('.header-add');
        if (addBtn) {
            addBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.addChildField(title);
            });
        }
        // Collapse/Expand button
        const toggleBtn = header.querySelector('.collapsible-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (e.shiftKey) {
                    // Shift+click: collapse all sections
                    this.isCollapseAll = true;
                    this.updateAllSectionsCollapseState(true);
                    return;
                }
                const isActive = header.classList.toggle('active');
                content.classList.toggle('active');
                this.setSectionExpanded(title, isActive);
            });
        }
        // Click title area: select this section for keyboard up/down navigation
        header.addEventListener('click', (e) => {
            if (e.target.closest('.header-delete') || e.target.closest('.header-add') || e.target.closest('.collapsible-toggle')) {
                return;
            }
            if (e.shiftKey) {
                this.isCollapseAll = true;
                this.updateAllSectionsCollapseState(true);
            } else {
                const isActive = header.classList.toggle('active');
                content.classList.toggle('active');
                this.setSectionExpanded(title, isActive);
            }
            this.setSelectedItem({ type: 'section', path: [], key: title });
            // 激活中间栏，使得键盘上下键可以工作
            this.setActivePanel('middle');
        });

        // Section drag sorting logic removed, changed to click selection + keyboard up/down adjustment

        wrapper.appendChild(header);
        wrapper.appendChild(content);

        return wrapper;
    }

    renderObject(obj, table, basePath, parentLocation = null) {
        const entries = this.getOrderedEntriesForObject(obj, basePath);
        for (const [key, value] of entries) {
            // Skip *_loc fields to prevent rendering in table
            if (key.endsWith('_loc')) continue;

            const row = document.createElement('tr');
            row.dataset.key = key;
            row.dataset.path = basePath.join('.');
            row.draggable = false;
            const toggleCell = document.createElement('td');
            const keyCell = document.createElement('td');
            const valueCell = document.createElement('td');

            // First column: Keep placeholder but don't place clickable expand button
            toggleCell.className = 'toggle-cell';
            toggleCell.innerHTML = `
                <i class="fa-solid fa-circle-check row-select-indicator" title="Click to select, selected items can be moved up/down"></i>
            `;

            // Second column: Editable Key
            const isNestedIndex = table.classList.contains('nested-table') && /^\d+$/.test(key);
            const displayKey = isNestedIndex ? `#${parseInt(key, 10)}` : this.formatKey(key);
            const wosHint = this.wosFieldTagsByKey?.[key]?.full_name || '';
            const keyTitle = wosHint ? ` title="${this.escapeAttr(wosHint)}"` : '';
            const keyDisplay = `<span class="editable-key" data-path="${basePath.join('.')}" data-key="${key}"${keyTitle}>${displayKey}</span>`;

            keyCell.innerHTML = keyDisplay;
            const currentPath = [...basePath, key];

            // Click left column: Only toggle selection state (no longer triggers movement)
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
            // Single click row: Only select; Double click row: Open full edit modal
            row.addEventListener('click', (e) => {
                const tablePath = table.dataset.path ? table.dataset.path.split('.').filter(Boolean) : [];
                this.setSelectedItem({ type: 'row', path: tablePath, key });
                // 激活中间栏，使得键盘上下键可以工作
                this.setActivePanel('middle');
            });
            row.addEventListener('dblclick', (e) => {
                const tablePath = table.dataset.path ? table.dataset.path.split('.').filter(Boolean) : [];
                const valuePath = [...tablePath, key];
                this.setSelectedItem({ type: 'row', path: tablePath, key });
                // 激活中间栏
                this.setActivePanel('middle');
                if (e.target.closest('a')) return; // Skip link navigation but keep selection state
                if (e.target.closest('.editable-value')) return; // Clicking value area only selects, doesn't trigger edit modal

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

            // Third column: Value display
            if (typeof value === 'object' && value !== null) {
                // Special handling for arrays with length 1: directly expand its element instead of showing #1 index
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
                            // Single element primitive value, directly edit with path index 0
                            valueCell.innerHTML = this.createEditableValue(sole, [...currentPath, '0'], null, key);
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
                // Simple values (strings, numbers, etc.)
                valueCell.innerHTML = this.createEditableValue(value, currentPath, null, key);
            }

            row.appendChild(toggleCell);
            row.appendChild(keyCell);
            row.appendChild(valueCell);
            table.appendChild(row);
        }
    }

    getOrderedEntriesForObject(obj, basePath = []) {
        const entries = Object.entries(obj || {});
        if (!Array.isArray(basePath) || !basePath.includes('wos_data')) return entries;
        const preferred = ['title', 'doi', 'wos_id', 'citations', 'references', 'related', 'source_title', 'issn', 'eissn', 'authors'];
        const keys = entries.map(([k]) => k);
        const seen = new Set();
        const ordered = [];
        preferred.forEach((k) => {
            if (keys.includes(k)) {
                ordered.push(k);
                seen.add(k);
            }
        });
        keys.forEach((k) => {
            if (!seen.has(k)) ordered.push(k);
        });
        return ordered.map(k => [k, obj[k]]);
    }

    createEditableValue(value, path, location = null, key = null) {
        const displayValue = typeof value === 'string' ? value : JSON.stringify(value);

        const keyLower = (key || '').toLowerCase();
        // 特殊处理: ORCID 字段，渲染跳转链接
        if ((keyLower === 'orcid' || keyLower === 'orcid_id') && value) {
            const rawList = Array.isArray(value) ? value : String(value).split(';');
            const entries = rawList.map(v => String(v || '').trim()).filter(Boolean);
            if (entries.length) {
                const links = entries.map((entry) => {
                    const parts = entry.split('/').map(p => p.trim()).filter(Boolean);
                    const name = parts[0] || '';
                    const rawId = parts[1] || parts[0] || '';
                    const clean = rawId.replace(/^https?:\/\/orcid\.org\//i, '').trim();
                    const url = `https://orcid.org/${encodeURIComponent(clean)}`;
                    const label = name || clean;
                    return `<a href="${url}" target="_blank" class="doi-link" title="Open ORCID: ${this.escapeHtml(clean)}">
                        <i class="fa-brands fa-orcid"></i> ${this.escapeHtml(label)}
                    </a>`;
                }).join('<span class="keyword-sep"> </span>');
                return `<span class="keyword-links">${links}</span>`;
            }
        }
        // 特殊处理: WOS 相关链接字段
        if (['citations', 'references', 'related'].includes(keyLower) && typeof value === 'string' && value.trim()) {
            const labelMap = {
                citations: 'Citations',
                references: 'References',
                related: 'Related Records'
            };
            const label = labelMap[keyLower] || 'WOS Link';
            return `<a href="${this.escapeAttr(value)}" target="_blank" class="doi-link" title="Open ${label} on Web of Science">
                <i class="fas fa-external-link-alt"></i> ${label}
            </a>`;
        }
        // 特殊处理: ISSN/eISSN 字段，跳转 Web of Science
        if ((keyLower === 'issn' || keyLower === 'eissn') && typeof value === 'string' && value.trim()) {
            const issnVal = value.trim();
            const wosUrl = this.generateWosIssnUrl(issnVal);
            return `<a href="${wosUrl}" target="_blank" class="doi-link" title="View ISSN on Web of Science">
                <i class="fas fa-external-link-alt"></i> ${this.escapeHtml(displayValue)}
            </a>`;
        }
        // 特殊处理: DOI 字段，添加 Web of Science 链接和复制按钮
        if (keyLower === 'doi' && typeof value === 'string' && value.trim()) {
            const wosUrl = this.generateWosUrl(value.trim());
            const doiUrl = this.normalizeDoiUrl(value.trim());
            const escapedDoi = this.escapeHtml(displayValue);
            const copyBtnId = `doi-copy-btn-${Math.random().toString(36).substr(2, 9)}`;
            const wosBtnId = `wos-btn-${Math.random().toString(36).substr(2, 9)}`;
            const doiUrlBtnId = `doi-url-btn-${Math.random().toString(36).substr(2, 9)}`;
            return `<span class="doi-with-copy">
                <span class="doi-text">${escapedDoi}</span>
                <button class="doi-copy-btn" id="${copyBtnId}" data-doi="${this.escapeAttr(value.trim())}" title="Copy DOI">
                    <i class="fas fa-copy"></i>
                </button>
                <button class="apa-fetch-btn" id="${wosBtnId}" data-wos-url="${this.escapeAttr(wosUrl)}" title="View on Web of Science">
                    <i class="fas fa-external-link-alt"></i><span>view WoS</span>
                </button>
                <button class="apa-fetch-btn" id="${doiUrlBtnId}" data-doi-url="${this.escapeAttr(doiUrl)}" title="Open DOI URL">
                    <i class="fas fa-link"></i><span>view DOI</span>
                </button>
            </span>`;
        }
        // 特殊处理: pdf_path 字段，增加复制/删除按钮
        if (keyLower === 'pdf_path' && typeof value === 'string' && value.trim()) {
            const clean = this.normalizePdfPathValue(value);
            const copyId = `pdf-copy-btn-${Math.random().toString(36).substr(2, 9)}`;
            const deleteId = `pdf-delete-btn-${Math.random().toString(36).substr(2, 9)}`;
            return `<span class="pdf-path-with-actions">
                <span class="pdf-path-text">${this.escapeHtml(clean)}</span>
                <button class="apa-fetch-btn" id="${copyId}" data-pdf="${this.escapeAttr(clean)}" title="Copy PDF file">
                    <i class="fas fa-copy"></i><span>copy pdf file</span>
                </button>
                <button class="pdf-path-delete-btn" id="${deleteId}" data-pdf="${this.escapeAttr(clean)}" title="删除 PDF 文件">
                    <i class="fas fa-trash"></i>
                </button>
            </span>`;
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
        // 特殊处理: Journal 字段，按 SO 查询 Web of Science
        if (keyLower === 'journal' && typeof value === 'string' && value.trim()) {
            const wosUrl = this.generateWosJournalUrl(value.trim());
            return `<a href="${wosUrl}" target="_blank" class="doi-link" title="View journal on Web of Science">
                <i class="fas fa-external-link-alt"></i> ${this.escapeHtml(displayValue)}
            </a>`;
        }
        // 特殊处理: WOSID 字段，跳转 Web of Science Full Record
        if (typeof value === 'string') {
            const trimmed = value.trim();
            const hasWosPrefix = /^WOS:/i.test(trimmed);
            const isWosIdKey = keyLower === 'wosid' || keyLower === 'wos_id';
            if (hasWosPrefix || isWosIdKey) {
                const match = trimmed.match(/WOS:[^\\s]+/i);
                const rawId = match ? match[0] : trimmed;
                const wosId = this.normalizeWosIdPrefix(rawId);
                if (wosId) {
                    const url = `https://www.webofscience.com/wos/woscc/full-record/${encodeURIComponent(wosId)}`;
                    return `<a href="${url}" target="_blank" class="doi-link" title="View full record on Web of Science">
                        <i class="fas fa-external-link-alt"></i> ${this.escapeHtml(displayValue)}
                    </a>`;
                }
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
            const btnTitle = doi ? `Generate APA from DOI: ${doi} and copy` : 'No DOI found, cannot generate APA';
            const btn = `<button class="apa-fetch-btn" data-doi="${doiAttr}" data-apa-text="${apaTextAttr}" title="${btnTitle}"${disabled}><i class="fas fa-quote-left"></i><span>APA</span></button>`;
            const hint = doi ? `<span class="apa-doi-hint" title="DOI used">${doiAttr}</span>` : `<span class="apa-doi-hint muted">No DOI</span>`;
            html += `<span class="apa-actions">${btn}${hint}</span>`;
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

    generateWosIssnUrl(issn) {
        if (!issn) return '';
        const query = [{
            rowText: `IS=${issn}`
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
        return this.findFirstDoiInData(this.currentData);
    }

    findFirstDoiInData(data) {
        const regex = /10\.\d{4,9}\/\S+/i;
        const seen = new Set();
        const stack = [data];
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

    async loadEnvInfo() {
        try {
            const res = await fetch('/env-info');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            this.envInfo = data || {};
            this.defaultProjectPathExample = this.buildSuggestedPath('my_project');
            this.applyProjectPathPlaceholder(this.defaultProjectPathExample);
        } catch (err) {
            console.warn('Failed to load env info:', err);
            this.envInfo = { homeDir: '', desktopDir: '', rootDir: '', platform: '' };
            this.defaultProjectPathExample = '/path/to/project';
            this.applyProjectPathPlaceholder(this.defaultProjectPathExample);
        }
    }

    applyProjectPathPlaceholder(examplePath) {
        const input = document.getElementById('projectPathInput');
        if (input && examplePath) {
            input.placeholder = `Enter full path, e.g.: ${examplePath}`;
        }
    }

    getDefaultParentDir() {
        const env = this.envInfo || {};
        return env.desktopDir || env.homeDir || '';
    }

    buildSuggestedPath(folderName = '') {
        const base = this.getDefaultParentDir() || '/path/to';
        const cleanBase = base.replace(/[\\/]+$/, '');
        const suffix = folderName ? `/${folderName}` : '/my_project';
        return `${cleanBase}${suffix}`;
    }

    normalizePdfPathValue(pathStr) {
        if (!pathStr) return '';
        const trimmed = String(pathStr).trim();
        if (!trimmed) return '';
        const parts = trimmed.split(/[/\\]+/).filter(Boolean);
        return parts.length ? parts[parts.length - 1] : trimmed;
    }

    normalizePdfRel(pathStr) {
        if (!pathStr) return { relPath: '', fileName: '' };
        const trimmed = (pathStr || '').replace(/^\.?[\\/]+/, '');
        const cleaned = trimmed.split(/[/\\]+/).filter(Boolean).join('/');
        const parts = cleaned.split('/');
        const fileName = parts.length ? parts[parts.length - 1] : cleaned;
        const relPath = parts.length > 1 ? cleaned : '';
        return { relPath, fileName };
    }

    normalizeDoiUrl(doi = '') {
        const clean = String(doi || '').trim();
        if (!clean) return '';
        if (/^https?:\/\//i.test(clean)) return clean;
        return `https://doi.org/${encodeURIComponent(clean)}`;
    }

    isPdfFile(file) {
        if (!file) return false;
        const name = (file.name || '').toLowerCase();
        const type = (file.type || '').toLowerCase();
        return name.endsWith('.pdf') || type.includes('pdf');
    }

    async loadPdfJsLib() {
        if (this._pdfjsLib) return this._pdfjsLib;
        const mod = await import('/js/pdfjs/build/pdf.mjs');
        const pdfjsLib = mod?.default || mod;
        if (pdfjsLib?.GlobalWorkerOptions) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = '/js/pdfjs/build/pdf.worker.mjs';
        }
        this._pdfjsLib = pdfjsLib;
        return pdfjsLib;
    }

    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = (err) => reject(err);
            reader.readAsArrayBuffer(file);
        });
    }

    readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
        });
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = (err) => reject(err);
            reader.readAsText(file);
        });
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = (err) => reject(err);
            reader.readAsText(file);
        });
    }

    async extractPdfTextFirstPages(file, maxPages = 2) {
        const pdfjsLib = await this.loadPdfJsLib();
        const data = file?.arrayBuffer ? await file.arrayBuffer() : await this.readFileAsArrayBuffer(file);
        const loadingTask = pdfjsLib.getDocument({ data });
        const pdf = await loadingTask.promise;
        const pages = Math.min(maxPages, pdf.numPages);
        let text = '';
        for (let i = 1; i <= pages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(it => it.str).join(' ') + '\n';
        }
        return text;
    }

    async extractDoiFromPdfFile(file) {
        const text = await this.extractPdfTextFirstPages(file, 2);
        const dois = this.extractDoisFromText(text);
        return dois[0] || null;
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
        const baseName = (filename || '').split('/').pop()?.replace(/\.json$/i, '') || '';
        const defaultDoi = baseName ? baseName.replace(/_/g, '/') : (this.findFirstDoiInData(this.currentData) || '');
        if (!Object.prototype.hasOwnProperty.call(meta, 'doi') || !meta.doi) {
            meta.doi = defaultDoi;
            changed = true;
        }
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
            await this.saveToFile({ silent: true, force: true });
        } catch (err) {
            console.warn('Failed to auto-save meta defaults:', err);

        } finally {
            this.isAutoSavingMeta = false;
            this.metaDefaultsPatched = false;
        }
    }

    /* -------------------- Query & Export (DOI keyed) -------------------- */
    openQueryExportModal() {
        this.toggleQueryExportPanel(true);
    }

    closeQueryExportModal() {
        this.toggleQueryExportPanel(false);
    }

    getFieldUnionFromData(data) {
        const set = new Set();
        const walk = (node, prefix = '', depth = 0) => {
            if (!node || typeof node !== 'object' || depth > 4) return;
            const entries = Array.isArray(node) ? node.entries() : Object.entries(node);
            for (const [rawKey, rawVal] of entries) {
                const key = String(rawKey);
                if (key.endsWith('_loc') || key === 'schema_version' || key === 'lastupdate') continue;
                const isArray = Array.isArray(rawVal);
                const path = prefix ? `${prefix}.${isArray ? key + '[]' : key}` : (isArray ? key + '[]' : key);
                set.add(path);
                if (isArray) {
                    const first = rawVal.find(v => v && typeof v === 'object');
                    if (first) {
                        walk(first, `${path}`, depth + 1);
                    }
                } else if (rawVal && typeof rawVal === 'object') {
                    walk(rawVal, path, depth + 1);
                }
            }
        };
        walk(data, '', 0);
        return set;
    }

    async refreshQueryFieldOptions() {
        if (this.queryFieldsLoading) return;
        this.queryFieldsLoading = true;
        const files = this.currentFileList || [];
        const union = new Set();
        const prevSelected = new Set(this.queryFieldSelected);
        for (const filename of files) {
            const paths = this.getPathsForBase(filename);
            const jsonPath = paths?.json || filename;
            try {
                const data = await this.readProjectFile(jsonPath);
                if (!data) continue;
                this.getFieldUnionFromData(data).forEach(f => union.add(f));
            } catch (err) {
                console.warn('refreshQueryFieldOptions failed for', filename, err);
            }
        }
        this.queryFieldOptions = Array.from(union).sort();
        this.queryFieldOptionsView = this.currentJsonView || '';
        // 保留仍存在的选择
        this.queryFieldSelected = new Set([...prevSelected].filter(f => union.has(f)));
        this.renderQueryFieldList();
        this.queryFieldsLoading = false;
    }

    renderQueryFieldList(filterText = '') {
        const container = document.getElementById('queryFieldList');
        if (!container) return;
        container.innerHTML = '';
        const filterInput = document.getElementById('queryFieldFilterInput');
        const filter = ((filterText !== null && filterText !== undefined) ? filterText : (filterInput ? filterInput.value : '')).toLowerCase();
        const options = filter
            ? this.queryFieldOptions.filter(f => f.toLowerCase().includes(filter))
            : this.queryFieldOptions;
        if (!options.length) {
            container.innerHTML = '<p>No fields detected. Load project/files first.</p>';
            this.renderQuerySelectedChips();
            return;
        }
        const frag = document.createDocumentFragment();
        options.forEach((field) => {
            const id = `qf-${field.replace(/[^a-z0-9_-]/gi, '-')}`;
            const wrapper = document.createElement('label');
            wrapper.className = 'query-field-item';
            wrapper.htmlFor = id;
            wrapper.innerHTML = `
                <input type="checkbox" id="${id}" data-field="${this.escapeAttr(field)}" ${this.queryFieldSelected.has(field) ? 'checked' : ''}>
                <span>${this.escapeHtml(field)}</span>
            `;
            wrapper.querySelector('input').addEventListener('change', (e) => {
                const f = e.target.dataset.field;
                if (e.target.checked) this.queryFieldSelected.add(f);
                else this.queryFieldSelected.delete(f);
                this.renderQuerySelectedChips();
            });
            frag.appendChild(wrapper);
        });
        container.appendChild(frag);
        this.renderQuerySelectedChips();
    }

    renderQuerySelectedChips() {
        const container = document.getElementById('querySelectedSummary');
        if (!container) return;
        container.innerHTML = '';
        const selected = Array.from(this.queryFieldSelected);
        if (!selected.length) {
            container.innerHTML = '<span style="color:#888;">No fields selected</span>';
            return;
        }
        const filterInput = document.getElementById('queryFieldFilterInput');
        const currentFilter = filterInput ? filterInput.value || '' : '';
        selected.forEach((field) => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'chip-btn';
            chip.textContent = field;
            chip.title = 'Click to remove';
            chip.classList.add('query-chip');
            chip.addEventListener('click', () => {
                this.queryFieldSelected.delete(field);
                this.renderQueryFieldList(currentFilter);
            });
            container.appendChild(chip);
        });
    }

    parseDoiOrderInput(text = '') {
        return (text || '')
            .split(/\r?\n/)
            .map(s => s.trim())
            .filter(Boolean);
    }

    dedupeDoiOrder(order = []) {
        const seen = new Set();
        const out = [];
        let dupCount = 0;
        order.forEach((raw) => {
            const key = (raw || '').trim().toLowerCase();
            if (!key) return;
            if (seen.has(key)) {
                dupCount++;
                return;
            }
            seen.add(key);
            out.push(raw);
        });
        return { list: out, dupCount };
    }

    updateDoiStats() {
        const statsEl = document.getElementById('queryDoiStats');
        if (!statsEl) return;
        const input = document.getElementById('queryDoiOrderInput');
        const { list, dupCount } = this.dedupeDoiOrder(this.parseDoiOrderInput(input ? input.value : this.queryDoiOrderText));
        statsEl.textContent = `${list.length} unique | ${dupCount} duplicates`;
    }

    async exportQueryData(options = {}) {
        // 支持两种导出模式：
        // 1. 用户选择的字段（默认）
        // 2. 固定的4个核心字段用于 DOI 自动补全缓存
        const exportForAutocomplete = options.forAutocomplete === true;

        const files = this.visibleFileOrder && this.visibleFileOrder.length ? this.visibleFileOrder : (this.currentFileList || []);
        if (!files.length) {
            this.showNotification('No files to export', 'info');
            return;
        }
        let rows = [];
        for (const filename of files) {
            const base = filename;
            const paths = this.getPathsForBase(base);
            const jsonPath = paths?.json || base;
            const altJsonPaths = this.getAllJsonPathsForBase(base).filter(p => p && p !== jsonPath);
            const fetchJson = async (path) => {
                try {
                    return await this.readProjectFile(path);
                } catch (err) {
                    console.warn('exportQueryData fetch failed for', path, err);
                    return null;
                }
            };

            let data = await fetchJson(jsonPath);
            let doi = data ? (this.findFirstDoiInData(data) || (data.meta_info && data.meta_info.doi)) : '';
            if (!doi && altJsonPaths.length) {
                for (const altPath of altJsonPaths) {
                    const altData = await fetchJson(altPath);
                    if (!altData) continue;
                    if (!data) data = altData; // 备用数据用于字段提取
                    doi = this.findFirstDoiInData(altData) || (altData.meta_info && altData.meta_info.doi);
                    if (doi) break;
                }
            }
            try {
                if (!doi) continue;

                if (exportForAutocomplete) {
                    // 导出固定的4个核心字段用于自动补全
                    const extractField = (fieldPaths) => {
                        for (const path of fieldPaths) {
                            const parts = path.split('.');
                            let value = data;
                            for (const part of parts) {
                                if (value && typeof value === 'object' && part in value) {
                                    value = value[part];
                                } else {
                                    value = null;
                                    break;
                                }
                            }
                            if (value !== null && value !== undefined && value !== '') {
                                if (Array.isArray(value)) return value.join('; ');
                                return String(value);
                            }
                        }
                        return '';
                    };

                    const title = extractField(['wos_data.title', 'meta_info.title', 'title', 'TI']);
                    const authors = extractField(['wos_data.author_full_names', 'wos_data.authors', 'meta_info.authors', 'authors', 'AF', 'AU']);
                    const year = extractField(['wos_data.publication_year', 'meta_info.publication_year', 'year', 'PY']);

                    rows.push({
                        doi: doi,
                        title: title,
                        authors: authors,
                        publication_year: year
                    });
                } else {
                    // 导出用户选择的字段
                    const meta = data && data.meta_info ? data.meta_info : {};
                    const row = {
                        doi,
                        'meta_info.No': typeof meta.No === 'number' ? meta.No : (meta.No || 0)
                    };
                    const fieldsToUse = this.queryFieldSelected.size ? Array.from(this.queryFieldSelected) : [];
                    fieldsToUse.forEach((field) => {
                        if (field === 'doi') return;
                        const val = data ? this.getFieldValueForQuery(data, field) : undefined;
                        if (val !== undefined) {
                            row[field] = val;
                        }
                    });
                    rows.push(row);
                }
            } catch (err) {
                console.warn('exportQueryData skip', filename, err);
            }
        }
        const doiInput = document.getElementById('queryDoiOrderInput');
        const { list: doiOrder, dupCount } = this.dedupeDoiOrder(this.parseDoiOrderInput(doiInput ? doiInput.value : this.queryDoiOrderText));
        if (dupCount > 0) {
            this.showNotification(`Detected and ignored ${dupCount} duplicate DOI entries`, 'info');
        }
        if (doiOrder.length) {
            const rowMap = new Map();
            rows.forEach((r) => {
                const key = (r.doi || '').trim().toLowerCase();
                if (key && !rowMap.has(key)) {
                    rowMap.set(key, r);
                }
            });
            const orderedRows = [];
            doiOrder.forEach((raw) => {
                const key = raw.trim().toLowerCase();
                if (!key) return;
                const row = rowMap.get(key);
                if (row) orderedRows.push(row);
            });
            rows = orderedRows;
            if (!rows.length) {
                this.showNotification('No matching DOI data found for export', 'info');
                return;
            }
        }
        if (!rows.length) {
            this.showNotification('No DOI found in files', 'info');
            return;
        }
        const payload = JSON.stringify(rows, null, 2);
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `query_export_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        this.showNotification(`Exported ${rows.length} records`, 'success');
        this.closeQueryExportModal();
    }

    async reassignDoiSequence(doiList = [], opts = {}) {
        const view = typeof opts.view === 'string' ? opts.view : (this.currentJsonView || '');
        const files = Array.isArray(opts.files) && opts.files.length
            ? opts.files
            : (this.visibleFileOrder && this.visibleFileOrder.length ? this.visibleFileOrder : (this.currentFileList || []));
        if (!files.length) {
            if (opts.notify !== false) this.showNotification('No files to update', 'info');
            return { saved: 0, nextNo: 1, processed: 0 };
        }
        // 去重 DOI 顺序（同一 DOI 的不同写法只保留一次）
        const order = [];
        const seenKeys = new Set();
        (doiList || []).forEach((raw) => {
            const keys = this.getDoiKeyVariants(raw);
            if (!keys.length) return;
            const dup = keys.some(k => seenKeys.has(k));
            if (dup) return;
            keys.forEach(k => seenKeys.add(k));
            order.push(raw);
        });

        const items = [];
        const skipped = [];
        for (const base of files) {
            const primaryPath = this.getViewPathForBase(base, view);
            const fallbackPath = this.getPathsForBase(base)?.json || base;
            const jsonPath = primaryPath || fallbackPath;
            if (!jsonPath) {
                skipped.push(base);
                console.warn('skip update No: no path for base', base, view);
                continue;
            }
            try {
                const data = await this.readProjectFile(jsonPath);
                if (!data) throw new Error('Empty data');
                const rawMeta = data.meta_info;
                const meta = (rawMeta && typeof rawMeta === 'object' && !Array.isArray(rawMeta)) ? rawMeta : {};
                if (meta !== rawMeta) data.meta_info = meta; // keep existing meta fields, just add No
                meta.No = null; // 重置，稍后按 DOI 排序重新赋值
                // 只使用basename（去掉路径）来生成DOI
                const baseName = (base || '').split('/').pop() || base;
                const baseDoi = baseName.replace(/_/g, '/');
                const doi = this.findFirstDoiInData(data) || (meta && meta.doi) || baseDoi || '';
                if (!meta.doi && doi) meta.doi = doi; // backfill for missing meta.doi
                items.push({
                    base,
                    path: jsonPath,
                    data,
                    meta,
                    doiKey: (doi || '').trim().toLowerCase(),
                    changed: true
                });
            } catch (err) {
                console.warn('reassignDoiSequence load failed for', base, err);
            }
        }
        const buckets = new Map();
        items.forEach((item) => {
            if (!item.doiKey) return;
            this.getDoiKeyVariants(item.doiKey).forEach((k) => {
                if (!buckets.has(k)) buckets.set(k, []);
                buckets.get(k).push(item);
            });
        });
        const numberedItems = [];
        order.forEach((raw) => {
            const keys = this.getDoiKeyVariants(raw);
            if (!keys.length) return;
            let target = null;
            for (const key of keys) {
                const bucket = buckets.get(key);
                if (bucket && bucket.length) {
                    target = bucket.shift();
                    break;
                }
            }
            if (target) {
                numberedItems.push(target);
            }
        });
        let seq = 1;
        numberedItems.forEach((item) => {
            item.meta.No = seq++;
        });

        let saved = 0;
        for (const item of items) {
            if (!item || !item.data) continue;
            if (!item.data.schema_version) {
                item.data.schema_version = this.generateSchemaVersion();
            }
            item.data.lastupdate = this.generateLastUpdate();
            const payload = JSON.stringify(item.data, null, 2);
            try {
                const projectPath = this.getRequiredProjectPath();
                if (!projectPath) return;
                const resp = await fetch('/save-json', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projectPath,
                        filename: item.path,
                        content: payload
                    })
                });
                if (!resp.ok) {
                    console.warn('save failed for', item.path, await resp.text());
                    continue;
                }
                saved++;
                if (this.currentFile === item.path) {
                    this.currentData = item.data;
                    this.hasUnsavedChanges = false;
                    delete this.tempDataCache[this.currentFile];
                    this.updateSaveButtonState();
                    this.updateSchemaBadge();
                    this.renderStructuredView();
                    this.renderFlatView();
                }
            } catch (err) {
                console.warn('reassignDoiSequence save failed for', item.path, err);
            }
        }
        const numbered = numberedItems.length;
        if (order.length && !numbered) {
            if (opts.notify !== false) this.showNotification('No matching DOI data found to number', 'info');
            return { saved, nextNo: seq, processed: items.length };
        }
        const totalInput = (doiList || []).length;
        const uniqueInput = order.length;
        const summary = `Updated No for ${saved}/${items.length} files (numbered ${numbered}${skipped.length ? `, skipped ${skipped.length}` : ''}) | input DOI ${totalInput}, unique ${uniqueInput}, matched ${numbered}`;
        if (opts.notify !== false) this.showNotification(summary, saved ? 'success' : 'info');
        return { saved, nextNo: seq, processed: items.length, numbered, totalInput, uniqueInput };
    }

    async updateDoiSequenceNumbers() {
        const doiInput = document.getElementById('queryDoiOrderInput');
        const rawList = this.parseDoiOrderInput(doiInput ? doiInput.value : this.queryDoiOrderText);
        const { list, dupCount } = this.dedupeDoiOrder(rawList);
        if (dupCount > 0) {
            this.showNotification(`Detected and ignored ${dupCount} duplicate DOI entries`, 'info');
        }
        const result = await this.reassignDoiSequence(list, { view: this.currentJsonView || '' });
        if (Number.isFinite(result?.nextNo)) {
            this.doiAutoNumberStart = result.nextNo;
        }
    }

    getFieldValueForQuery(data, field) {
        if (!data || typeof data !== 'object') return undefined;
        if (field === 'doi') {
            return this.findFirstDoiInData(data) || '';
        }
        const segments = field.split('.').filter(Boolean);
        const walk = (node, idx) => {
            if (node === undefined || node === null) return undefined;
            if (idx >= segments.length) return node;
            const seg = segments[idx];
            const isArraySeg = seg.endsWith('[]');
            const key = isArraySeg ? seg.slice(0, -2) : seg;
            const next = node[key];
            if (isArraySeg) {
                if (!Array.isArray(next)) return undefined;
                return next.map(item => walk(item, idx + 1)).filter(v => v !== undefined);
            }
            return walk(next, idx + 1);
        };
        return walk(data, 0);
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

    // 仅更新目标中已存在的键，忽略新键
    mergeIntersection(target, source) {
        Object.entries(target).forEach(([k, v]) => {
            if (!Object.prototype.hasOwnProperty.call(source, k)) return;
            const incoming = source[k];
            if (this.isPlainObject(v) && this.isPlainObject(incoming)) {
                this.mergeIntersection(v, incoming);
            } else {
                target[k] = incoming;
            }
        });
    }

    undoLastPaste() {
        if (!this.lastPasteBackup || !this.currentFile || this.lastPasteBackup.file !== this.currentFile) {
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
    }

    // 从用户选择的目录批量合并同名 JSON，新增字段合并，冲突字段用导入值覆盖
    async handleJsonFolderImport(event) {
        const input = event?.target;
        const files = Array.from(input?.files || []);
        if (input) input.value = '';
        if (!files.length) return;
        if (!this.currentProject) {
            this.showNotification('Please load a project before importing JSON', 'error');
            return;
        }
        if (this.hasUnsavedChanges || this.hasUnsavedMarkdownChanges) {
            const proceed = confirm('Current file has unsaved changes. Importing external JSON may overwrite them. Continue?');
            if (!proceed) return;
        }

        const jsonFiles = files.filter(file => (file.name || '').toLowerCase().endsWith('.json'));
        if (!jsonFiles.length) {
            this.showNotification('No JSON files found in selected directory', 'info');
            return;
        }

        if (!this.currentFileList || !this.currentFileList.length) {
            await this.loadFileList(true);
        }
        const targetPath = this.normalizeJsonTargetPath(this.importJsonTargetPath || 'json/imported');
        const existingJsonPaths = Object.keys(this.fileMetaByPath || {}).filter(p => p.toLowerCase().endsWith('.json'));
        const existingNames = new Set(existingJsonPaths.map(p => p.toLowerCase()));
        let mode = this.importJsonMode || 'join'; // join / union
        // Compatible with old mode naming
        if (mode === 'match') mode = 'join';
        if (mode === 'all' || mode === 'match-and-new') mode = 'union';
        const summary = { merged: [], imported: [], skipped: [], failed: [] };

        for (const file of jsonFiles) {
            const targetFilename = `${targetPath.replace(/\/+$/, '')}/${file.name}`.replace(/\+/g, '/');
            const targetKey = targetFilename.toLowerCase();
            const isExisting = existingNames.has(targetKey);

            // Decide whether to process this file based on mode
            if (mode === 'join' && !isExisting) {
                summary.skipped.push(targetFilename);
                continue;
            }

            try {
                const incomingText = await file.text();
                const incomingData = JSON.parse(incomingText);

                // If file doesn't exist and mode allows creating new files
                if (!isExisting && mode === 'union') {
                    // Save as new file directly
                    if (!incomingData.schema_version) {
                        incomingData.schema_version = this.generateSchemaVersion();
                    }
                    incomingData.lastupdate = this.generateLastUpdate();
                    const projectPath = this.getRequiredProjectPath();
                    if (!projectPath) return;

                    const saveResp = await fetch('/save-json', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            projectPath,
                            filename: targetFilename,
                            content: JSON.stringify(incomingData, null, 2)
                        })
                    });
                    if (!saveResp.ok) {
                        const text = await saveResp.text();
                        throw new Error(text || 'Save failed');
                    }
                    summary.imported.push(targetFilename);
                    continue;
                }

                // Merge existing file
                const resp = await fetch(this.getDataUrl(targetFilename), { cache: 'no-store' });
                if (!resp.ok) throw new Error('Failed to read same-named file in project');
                const currentData = await resp.json();
                const merged = JSON.parse(JSON.stringify(currentData || {}));
                if (mode === 'join') {
                    this.mergeIntersection(merged, incomingData || {});
                } else {
                    this.deepMerge(merged, incomingData || {});
                }
                if (!merged.schema_version) {
                    merged.schema_version = this.generateSchemaVersion();
                }
                merged.lastupdate = this.generateLastUpdate();
                const projectPath = this.getRequiredProjectPath();
                if (!projectPath) return;
                const saveResp = await fetch('/save-json', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projectPath,
                        filename: targetFilename,
                        content: JSON.stringify(merged, null, 2)
                    })
                });
                if (!saveResp.ok) {
                    const text = await saveResp.text();
                    throw new Error(text || 'Save failed');
                }
                summary.merged.push(targetFilename);

                if (this.currentFile === targetFilename || this.currentFile === file.name) {
                    this.currentData = merged;
                    this.hasUnsavedChanges = false;
                    delete this.tempDataCache[targetFilename];
                    this.updateSaveButtonState();
                    this.updateSchemaBadge();
                    this.renderStructuredView();
                    this.renderFlatView();
                    this.setupEditableListeners();
                    await this.applyCurrentView();
                }
            } catch (err) {
                console.error('Failed to merge JSON:', file.name, err);
                summary.failed.push({ name: file.name, reason: err.message || 'Unknown error' });
            }
        }

        const mergedMsg = summary.merged.length ? `merged ${summary.merged.length}` : '';
        const importedMsg = summary.imported.length ? `imported ${summary.imported.length}` : '';
        const skippedMsg = summary.skipped.length ? `skipped ${summary.skipped.length}` : '';
        const failedMsg = summary.failed.length ? `failed ${summary.failed.length}` : '';
        const parts = [mergedMsg, importedMsg, skippedMsg, failedMsg].filter(s => s);
        const type = summary.failed.length ? 'error' : ((summary.merged.length || summary.imported.length) ? 'success' : 'info');
        this.showNotification(`Import completed: ${parts.join(', ')}`, type);
        if (summary.failed.length) {
            console.warn('JSON import failure details:', summary.failed);
        }
        if (summary.merged.length || summary.imported.length) {
            await this.loadFileList();
        }
    }

    // 导入单个 JSON 文件，根据 DOI 合并到项目内对应文件
    async handleJsonFileImport(event) {
        const input = event?.target;
        const files = Array.from(input?.files || []);
        if (input) input.value = '';
        if (!files.length) return;
        if (!this.currentProject) {
            this.showNotification('Please load a project before importing JSON', 'error');
            return;
        }
        if (this.hasUnsavedChanges || this.hasUnsavedMarkdownChanges) {
            const proceed = confirm('Current file has unsaved changes. Importing external JSON may overwrite them. Continue?');
            if (!proceed) return;
        }

        const file = files.find(f => (f.name || '').toLowerCase().endsWith('.json'));
        if (!file) {
            this.showNotification('Please select a JSON file', 'info');
            return;
        }

        try {
            if (!this.currentFileList || !this.currentFileList.length) {
                await this.loadFileList(true);
            }
            const incomingText = await file.text();
            const incomingData = JSON.parse(incomingText);
            const rawDoi = (incomingData?.meta_info && incomingData.meta_info.doi) || '';
            const doiCandidates = this.extractDoisFromText(String(rawDoi || ''));
            const doi = this.normalizeDoiString(doiCandidates[0] || rawDoi);
            const view = this.currentJsonView || 'view1';
            const baseFromFilename = (file.name || '').replace(/\.json$/i, '').replace(/[^a-zA-Z0-9._-]+/g, '_') || 'imported_json';
            const hasDoiField = !!rawDoi;

            if (doi) {
                if (!incomingData.meta_info || typeof incomingData.meta_info !== 'object') {
                    incomingData.meta_info = {};
                }
                incomingData.meta_info.doi = doi;
            }

            const baseByDoi = doi ? doi.replace(/\//g, '_') : '';
            const hasDoiBaseInView = baseByDoi
                ? ((this.currentFileList || []).includes(baseByDoi) || (this.fileMetaByBase?.[baseByDoi]?.views?.[view]))
                : false;
            const hasFilenameBaseInView = (this.currentFileList || []).includes(baseFromFilename)
                || (this.fileMetaByBase?.[baseFromFilename]?.views?.[view]);

            const targetBase = hasDoiBaseInView
                ? baseByDoi
                : (hasDoiField ? baseByDoi : (hasFilenameBaseInView ? baseFromFilename : baseFromFilename));
            if (!targetBase) {
                this.showNotification('No DOI or valid filename base found in selected JSON', 'warning');
                return;
            }

            const targetFilename = this.getViewPathForBase(targetBase, view);
            if (!targetFilename) {
                this.showNotification('No JSON file path for import target', 'warning');
                return;
            }

            let merged = null;
            let hasExistingFile = hasDoiBaseInView || (!hasDoiField && hasFilenameBaseInView);
            if (hasExistingFile) {
                try {
                    const currentData = await this.readProjectFile(targetFilename);
                    merged = JSON.parse(JSON.stringify(currentData || {}));
                    this.deepMerge(merged, incomingData || {});
                } catch (_err) {
                    merged = null;
                }
            }
            if (!merged) {
                merged = JSON.parse(JSON.stringify(incomingData || {}));
            }
            if (!merged.schema_version) {
                merged.schema_version = this.generateSchemaVersion();
            }
            merged.lastupdate = this.generateLastUpdate();
            const projectPath = this.getRequiredProjectPath();
            if (!projectPath) return;

            const saveResp = await fetch('/save-json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectPath,
                    filename: targetFilename,
                    content: JSON.stringify(merged, null, 2)
                })
            });
            if (!saveResp.ok) {
                const text = await saveResp.text();
                throw new Error(text || 'Save failed');
            }

            if (this.currentFile === targetFilename || this.currentFileBase === targetBase) {
                this.currentData = merged;
                this.hasUnsavedChanges = false;
                delete this.tempDataCache[targetFilename];
                this.updateSaveButtonState();
                this.updateSchemaBadge();
                this.renderStructuredView();
                this.renderFlatView();
                this.setupEditableListeners();
                await this.applyCurrentView();
            }
            this.showNotification(`Import completed: ${hasExistingFile ? 'merged 1' : 'created 1'}`, 'success');
            
            // 如果是新文件，添加到当前选中的分组
            if (!hasExistingFile) {
                const groups = this.getCurrentGroups();
                let targetGroup = null;
                
                // 使用当前分组ID查找目标分组
                if (this.currentGroupId) {
                    targetGroup = groups.find(g => g.id === this.currentGroupId);
                }
                
                // 如果没有找到目标分组，使用默认分组
                if (!targetGroup) {
                    targetGroup = groups[0];
                }
                
                // 如果文件还不在该分组中，添加它
                if (targetGroup && !targetGroup.files.includes(targetBase)) {
                    const currentBase = this.currentFileBase || this.currentFile;
                    // 如果当前文件在该分组中，在其后插入新文件；否则追加到末尾
                    if (currentBase && targetGroup.files.includes(currentBase)) {
                        const idx = targetGroup.files.indexOf(currentBase);
                        targetGroup.files.splice(idx + 1, 0, targetBase);
                    } else {
                        targetGroup.files.push(targetBase);
                    }
                    
                    // 保存分组配置
                    this.persistGroupsAndRender(groups, targetBase);
                }
            }
            
            await this.loadFileList();
            await new Promise(resolve => setTimeout(resolve, 30));
            await this.loadFile(targetBase);
            this.scrollFileIntoView(targetBase, { align: 'center' });
        } catch (err) {
            console.error('Failed to import JSON file:', err);
            this.showNotification(`Import failed: ${err.message || 'Unknown error'}`, 'error');
        }
    }

    async createEmptyFilesFromPdfs(mode = 'new-only') {
        this.showNotification('Current version no longer supports one-click PDF sync. Please add pdf/json/md files manually.', 'info');
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
        badge.title = `schema_version: ${version || 'Undefined (will auto-generate date version on save)'}`;

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
            this.showLockedNotification('Adjust order');
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
        this.showNotification(`Field deleted: ${key}`, 'info');
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

    moveSectionSelection(offset = 0) {
        if (!offset) return;
        const sections = Array.from(document.querySelectorAll('.collapsible-section'));
        if (!sections.length) return;
        let selectedKey = this.selectedItem?.type === 'section' ? this.selectedItem.key : null;
        if (!selectedKey && this.selectedItem?.type === 'row') {
            const tablePath = (this.selectedItem.path || []).join('.');
            const rowEl = document.querySelector(`table.json-table[data-path="${CSS.escape(tablePath)}"] tr[data-key="${CSS.escape(this.selectedItem.key)}"]`);
            const sectionEl = rowEl?.closest('.collapsible-section');
            selectedKey = sectionEl?.dataset?.sectionKey || null;
        }
        let idx = selectedKey ? sections.findIndex(sec => sec.dataset.sectionKey === selectedKey) : -1;
        if (idx < 0) {
            idx = offset > 0 ? -1 : sections.length;
        }
        idx += offset;
        if (idx < 0) idx = 0;
        if (idx >= sections.length) idx = sections.length - 1;
        const next = sections[idx];
        if (!next) return;
        const key = next.dataset.sectionKey;
        if (!key) return;
        this.setSelectedItem({ type: 'section', path: [], key });
        next.scrollIntoView({ block: 'nearest' });
    }

    toggleSectionByKey(key, expand) {
        if (!key) return;
        const sectionEl = document.querySelector(`.collapsible-section[data-section-key="${CSS.escape(key)}"]`);
        if (!sectionEl) return;
        const header = sectionEl.querySelector('.collapsible-header');
        const content = sectionEl.querySelector('.collapsible-content');
        if (!header || !content) return;
        const shouldExpand = typeof expand === 'boolean' ? expand : !header.classList.contains('active');
        header.classList.toggle('active', shouldExpand);
        content.classList.toggle('active', shouldExpand);
        this.setSectionExpanded(key, shouldExpand);
    }

    moveSelectedItem(offset) {
        if (this.isEditLocked) {
            this.showLockedNotification('Adjust order');
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
            this.showLockedNotification('Adjust order');
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

    async goToJsonSource() {
        await this.switchToView('flat');
    }

    async goToMarkdownSource() {
        if (this.isDraftViewActive) {
            if (!this.currentMarkdownExists) {
                await this.loadDraftMarkdownFile();
            }
            this.toggleMarkdownEdit(true);
            const mdTextarea = document.getElementById('markdownTextarea');
            if (mdTextarea) mdTextarea.focus();
            return;
        }
        await this.switchToView('markdown');
        if (!this.currentFile) {
            this.showNotification('Please select a file to view Markdown source', 'info');
            return;
        }
        if (!this.currentMarkdownExists) {
            try {
                await this.createMarkdownFile();
            } catch (_err) { }
        }
        if (!this.currentMarkdownExists) {
            this.showNotification('No matching Markdown found', 'info');
            return;
        }
        this.toggleMarkdownEdit(true);
        const mdTextarea = document.getElementById('markdownTextarea');
        if (mdTextarea) mdTextarea.focus();
    }

    async goToDraftSource() {
        // Draft 视图的源码切换逻辑与 Markdown 视图相同
        // goToMarkdownSource 已经通过 isDraftViewActive 处理了 Draft 视图
        await this.goToMarkdownSource();
    }

    async toggleJsonMdSource() {
        const view = this.currentView || 'structured';
        if (view === 'settings') {
            await this.switchToView('draft');
            if ((this.currentView || 'structured') === 'settings') return;
            await this.toggleJsonMdSource();
            return;
        }
        // JSON 视图：表格/源码之间切换
        if (view === 'flat') {
            await this.switchToView('structured');
            return;
        }
        if (view === 'structured') {
            await this.goToJsonSource();
            return;
        }
        // Markdown 视图：渲染/源码之间切换
        if (view === 'markdown') {
            if (this.isMarkdownEditing) {
                this.toggleMarkdownEdit(false);
                return;
            }
            await this.goToMarkdownSource();
            return;
        }
        // Draft 视图：渲染/源码之间切换
        if (view === 'draft') {
            if (this.isMarkdownEditing) {
                this.toggleMarkdownEdit(false);
                return;
            }
            await this.goToDraftSource();
        }
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

    toggleImportMenu(forceVisible) {
        const menu = document.getElementById('importMenu');
        if (!menu) return;
        const next = typeof forceVisible === 'boolean' ? forceVisible : !this.importMenuVisible;
        if (next) this.closeHeaderMenus('import');
        this.importMenuVisible = next;
        menu.classList.toggle('visible', next);
    }

    toggleCliMenu(forceVisible) {
        const menu = document.getElementById('cliMenu');
        if (!menu) return;
        const next = typeof forceVisible === 'boolean' ? forceVisible : !this.cliMenuVisible;
        if (next) this.closeHeaderMenus('cli');
        this.cliMenuVisible = next;
        menu.classList.toggle('visible', next);
    }

    constrainDropdownMenu(menuEl, dropdownEl) {
        if (!menuEl || !dropdownEl) return;
        const margin = 8;
        const anchor = dropdownEl.getBoundingClientRect();
        menuEl.style.position = 'fixed';
        menuEl.style.right = '';
        menuEl.style.left = '';
        menuEl.style.top = `${anchor.bottom + 6}px`;
        const rect = menuEl.getBoundingClientRect();
        let left = anchor.right - rect.width;
        if (left + rect.width > window.innerWidth - margin) {
            left = window.innerWidth - rect.width - margin;
        }
        if (left < margin) {
            left = margin;
        }
        menuEl.style.left = `${left}px`;
        const bottom = rect.top + rect.height;
        if (bottom > window.innerHeight - margin) {
            menuEl.style.maxHeight = `${Math.max(120, window.innerHeight - rect.top - margin)}px`;
            menuEl.style.overflowY = 'auto';
        } else {
            menuEl.style.maxHeight = '';
            menuEl.style.overflowY = '';
        }
    }

    setEditLock(locked) {
        this.isEditLocked = !!locked;
        this.persistEditLockState();
        this.applyEditLockState();
        this.showNotification(locked ? 'Editing locked' : 'Editing unlocked', locked ? 'info' : 'success');
    }

    toggleEditLock(forceLocked) {
        const next = typeof forceLocked === 'boolean' ? forceLocked : !this.isEditLocked;
        this.setEditLock(next);
    }

    applyEditLockState() {
        // 更新设置菜单中的编辑锁定选项状态
        const editLockOnItem = document.getElementById('editLockOnItem');
        const editLockOffItem = document.getElementById('editLockOffItem');
        if (editLockOnItem) {
            const checkIcon = editLockOnItem.querySelector('i[data-check="on"]');
            if (checkIcon) checkIcon.style.opacity = this.isEditLocked ? '1' : '0';
        }
        if (editLockOffItem) {
            const checkIcon = editLockOffItem.querySelector('i[data-check="off"]');
            if (checkIcon) checkIcon.style.opacity = this.isEditLocked ? '0' : '1';
        }

        // 应用锁定状态到编辑器
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

    showLockedNotification(action = 'operation') {
        this.showNotification(`Locked, unable to ${action}`, 'info');
    }

    async handleSaveShortcut() {
        if (this.isEditLocked) {
            this.showLockedNotification('save');
            return;
        }
        const view = this.currentView || 'structured';
        if (view === 'markdown') {
            if (this.isMarkdownEditing) {
                await this.saveMarkdownFromEditor();
                return;
            }
            if (!this.currentMarkdownExists) return;
            if (this.hasUnsavedMarkdownChanges) {
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
        if (this.hasUnsavedChanges || (this.currentFile && this.tempDataCache[this.currentFile])) {
            await this.saveToFile();
            this.renderStructuredView();
            this.renderFlatView();
        }
    }

    toggleFileFilter(forceVisible) {
        const panel = document.getElementById('fileFilterSettingsPanel');
        const btn = document.getElementById('fileFilterToggleBtn');
        const input = document.getElementById('fileFilterInput');
        const next = typeof forceVisible === 'boolean' ? forceVisible : !this.fileFilterVisible;
        this.fileFilterVisible = next;
        if (panel) panel.classList.toggle('is-visible', next);
        if (btn) btn.classList.toggle('active', next);
        if (next) this.moveSettingsPanelToEnd(panel);
        this.updateSettingsPanelsVisibility();
        this.saveSettingsPanelsState();
        if (next) {
            this.switchToView('settings');
            if (!this.queryFieldOptions.length) {
                this.refreshQueryFieldOptions().catch(() => { });
            }
            this.renderFileFilterConditions();
            if (input) {
                setTimeout(() => input.focus({ preventScroll: true }), 0);
            }
        }
    }

    toggleCreateGroupPanel(forceVisible) {
        const panel = document.getElementById('createGroupSettingsPanel');
        const btn = document.getElementById('addGroupBtn');
        const input = document.getElementById('groupNamesInput');
        const next = typeof forceVisible === 'boolean' ? forceVisible : !this.createGroupVisible;
        this.createGroupVisible = next;
        if (panel) panel.classList.toggle('is-visible', next);
        if (btn) btn.classList.toggle('active', next);
        if (next) this.moveSettingsPanelToEnd(panel);
        this.updateSettingsPanelsVisibility();
        this.saveSettingsPanelsState();
        if (next) {
            this.switchToView('settings');
            if (input) {
                input.value = '';
                setTimeout(() => input.focus({ preventScroll: true }), 0);
                // 绑定输入实时预览（使用一次性监听避免重复绑定）
                if (!input.dataset.previewBound) {
                    input.addEventListener('input', () => this.updateGroupPreview());
                    input.dataset.previewBound = 'true';
                }
            }
            this.updateGroupPreview();
        }
    }

    toggleApiSettingsPanel(forceVisible) {
        const panel = document.getElementById('apiSettingsPanel');
        const next = typeof forceVisible === 'boolean' ? forceVisible : !this.apiSettingsVisible;
        this.apiSettingsVisible = next;
        if (panel) panel.classList.toggle('is-visible', next);
        if (next) this.moveSettingsPanelToEnd(panel);
        this.updateSettingsPanelsVisibility();
        this.saveSettingsPanelsState();
        if (next) {
            this.switchToView('settings');
            this.applyApiSettingsInputs();
            const openaiInput = document.getElementById('openaiApiInput');
            if (openaiInput) setTimeout(() => openaiInput.focus({ preventScroll: true }), 0);
        }
    }

    toggleAutoSavePanel(forceVisible) {
        const panel = document.getElementById('autoSaveConfigPanel');
        const next = typeof forceVisible === 'boolean' ? forceVisible : !this.autoSaveConfigVisible;
        this.autoSaveConfigVisible = next;
        if (panel) panel.classList.toggle('is-visible', next);
        if (next) this.moveSettingsPanelToEnd(panel);
        this.updateSettingsPanelsVisibility();
        this.saveSettingsPanelsState();
        if (next) {
            this.switchToView('settings');
            // 初始化内联配置 UI（延迟确保 DOM 已准备好）
            setTimeout(() => {
                if (this.autoSaveConfigUI) {
                    const container = document.getElementById('autoSaveConfigBody');
                    if (container) {
                        // 总是渲染（即使已经是内联模式，也重新渲染以确保内容存在）
                        if (!this.autoSaveConfigUI.isInlineMode || container.innerHTML.trim() === '') {
                            this.autoSaveConfigUI.renderInline(container);
                            console.log('[AutoSave] 配置 UI 已渲染到容器');
                        } else {
                            // 已经渲染过，只需要重新加载设置
                            this.autoSaveConfigUI.loadCurrentSettings();
                        }
                    } else {
                        console.warn('[AutoSave] 容器元素未找到: autoSaveConfigBody');
                    }
                }
            }, 50);
        }
    }

    // 添加别名方法以兼容 HTML 中的 onclick
    toggleAutoSaveConfigPanel(forceVisible) {
        this.toggleAutoSavePanel(forceVisible);
    }

    updateSettingsPanelsVisibility() {
        const settingsContent = document.getElementById('settingsContent');
        const hasAny = !!(this.fileFilterVisible || this.createGroupVisible || this.projectInfoVisible || this.thirdPartyInfoVisible || this.shortcutsVisible || this.queryExportVisible || this.apiSettingsVisible || this.autoSaveConfigVisible);
        if (settingsContent) settingsContent.classList.toggle('is-empty', !hasAny);
    }

    moveSettingsPanelToEnd(panel) {
        const settingsContent = document.getElementById('settingsContent');
        if (!panel || !settingsContent) return;
        settingsContent.appendChild(panel);
    }

    handleSettingsPanelEscape() {
        if ((this.currentView || '') !== 'settings') return false;
        const candidates = [
            { id: 'autoSaveConfigPanel', flag: 'autoSaveConfigVisible' },
            { id: 'queryExportPanel', flag: 'queryExportVisible' },
            { id: 'apiSettingsPanel', flag: 'apiSettingsVisible' },
            { id: 'shortcutsInfoPanel', flag: 'shortcutsVisible' },
            { id: 'thirdPartyInfoPanel', flag: 'thirdPartyInfoVisible' },
            { id: 'projectInfoPanel', flag: 'projectInfoVisible' },
            { id: 'createGroupSettingsPanel', flag: 'createGroupVisible' },
            { id: 'fileFilterSettingsPanel', flag: 'fileFilterVisible' }
        ];
        for (const item of candidates) {
            if (!this[item.flag]) continue;
            const panel = document.getElementById(item.id);
            if (panel) {
                panel.classList.remove('is-visible');
            }
            this[item.flag] = false;
            const btnMap = {
                fileFilterVisible: 'fileFilterToggleBtn',
                createGroupVisible: 'addGroupBtn',
                queryExportVisible: 'queryExportBtn'
            };
            const btnId = btnMap[item.flag];
            if (btnId) {
                const btn = document.getElementById(btnId);
                if (btn) btn.classList.remove('active');
            }
            this.updateSettingsPanelsVisibility();
            this.saveSettingsPanelsState();
            return true;
        }
        return false;
    }

    toggleAutoSaveConfigPanel(forceVisible) {
        const panel = document.getElementById('autoSaveConfigPanel');
        const next = typeof forceVisible === 'boolean' ? forceVisible : !this.autoSaveConfigVisible;
        this.autoSaveConfigVisible = next;
        if (panel) panel.classList.toggle('is-visible', next);
        if (next) this.moveSettingsPanelToEnd(panel);
        this.updateSettingsPanelsVisibility();
        this.saveSettingsPanelsState();
        if (next) {
            this.switchToView('settings');
            // 在inline模式中渲染自动保存配置UI
            if (this.autoSaveManager && this.autoSaveConfigUI) {
                const containerElement = document.getElementById('autoSaveConfigBody');
                if (containerElement) {
                    this.autoSaveConfigUI.renderInline(containerElement);
                }
            }
        }
    }

    toggleQueryExportPanel(forceVisible) {
        const panel = document.getElementById('queryExportPanel');
        const btn = document.getElementById('queryExportBtn');
        const queryDoiOrderInput = document.getElementById('queryDoiOrderInput');
        const next = typeof forceVisible === 'boolean' ? forceVisible : !this.queryExportVisible;
        this.queryExportVisible = next;
        if (panel) panel.classList.toggle('is-visible', next);
        if (btn) btn.classList.toggle('active', next);
        if (next) this.moveSettingsPanelToEnd(panel);
        this.updateSettingsPanelsVisibility();
        this.saveSettingsPanelsState();
        if (next) {
            this.switchToView('settings');
            if (queryDoiOrderInput) {
                queryDoiOrderInput.value = this.queryDoiOrderText || '';
            }
            this.refreshQueryFieldOptions();
            this.updateDoiStats();
        }
    }

    getSettingsPanelsStateKey() {
        const projectKey = this.getProjectKey();
        return projectKey ? `settingsPanelsState:${projectKey}` : '';
    }

    loadSettingsPanelsState() {
        const key = this.getSettingsPanelsStateKey();
        if (!key) return {};
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : {};
        } catch (_err) {
            return {};
        }
    }

    saveSettingsPanelsState() {
        const key = this.getSettingsPanelsStateKey();
        if (!key) return;
        const payload = {
            fileFilterVisible: !!this.fileFilterVisible,
            createGroupVisible: !!this.createGroupVisible,
            projectInfoVisible: !!this.projectInfoVisible,
            thirdPartyInfoVisible: !!this.thirdPartyInfoVisible,
            shortcutsVisible: !!this.shortcutsVisible,
            queryExportVisible: !!this.queryExportVisible,
            apiSettingsVisible: !!this.apiSettingsVisible
            // autoSaveConfigVisible 不持久化保存，每次加载时默认关闭
        };
        try {
            localStorage.setItem(key, JSON.stringify(payload));
        } catch (_err) {
            // ignore
        }
    }

    applySettingsPanelsState(state = {}, opts = {}) {
        const skipView = !!opts.skipView;
        this.fileFilterVisible = !!state.fileFilterVisible;
        this.createGroupVisible = !!state.createGroupVisible;
        this.projectInfoVisible = !!state.projectInfoVisible;
        this.thirdPartyInfoVisible = !!state.thirdPartyInfoVisible;
        this.shortcutsVisible = !!state.shortcutsVisible;
        this.queryExportVisible = !!state.queryExportVisible;
        this.apiSettingsVisible = !!state.apiSettingsVisible;
        // autoSaveConfigVisible 不从 state 恢复，始终从构造函数的默认值 false 开始

        const fileFilterPanel = document.getElementById('fileFilterSettingsPanel');
        const createGroupPanel = document.getElementById('createGroupSettingsPanel');
        const projectInfoPanel = document.getElementById('projectInfoPanel');
        const thirdPartyPanel = document.getElementById('thirdPartyInfoPanel');
        const shortcutsPanel = document.getElementById('shortcutsInfoPanel');
        const queryExportPanel = document.getElementById('queryExportPanel');
        const apiSettingsPanel = document.getElementById('apiSettingsPanel');
        const autoSaveConfigPanel = document.getElementById('autoSaveConfigPanel');
        const fileFilterBtn = document.getElementById('fileFilterToggleBtn');
        const addGroupBtn = document.getElementById('addGroupBtn');
        const queryExportBtn = document.getElementById('queryExportBtn');

        if (fileFilterPanel) fileFilterPanel.classList.toggle('is-visible', this.fileFilterVisible);
        if (createGroupPanel) createGroupPanel.classList.toggle('is-visible', this.createGroupVisible);
        if (projectInfoPanel) projectInfoPanel.classList.toggle('is-visible', this.projectInfoVisible);
        if (thirdPartyPanel) thirdPartyPanel.classList.toggle('is-visible', this.thirdPartyInfoVisible);
        if (shortcutsPanel) shortcutsPanel.classList.toggle('is-visible', this.shortcutsVisible);
        if (queryExportPanel) queryExportPanel.classList.toggle('is-visible', this.queryExportVisible);
        if (apiSettingsPanel) apiSettingsPanel.classList.toggle('is-visible', this.apiSettingsVisible);
        // autoSaveConfigPanel 默认不显示（使用构造函数中的默认值 false）
        if (autoSaveConfigPanel) autoSaveConfigPanel.classList.remove('is-visible');
        if (fileFilterBtn) fileFilterBtn.classList.toggle('active', this.fileFilterVisible);
        if (addGroupBtn) addGroupBtn.classList.toggle('active', this.createGroupVisible);
        if (queryExportBtn) queryExportBtn.classList.toggle('active', this.queryExportVisible);

        this.updateSettingsPanelsVisibility();
        if (this.fileFilterVisible) {
            if (!this.queryFieldOptions.length) {
                this.refreshQueryFieldOptions().catch(() => { });
            }
            this.renderFileFilterConditions();
            this.renderFileFilterHistory();
        }
        if (this.projectInfoVisible) {
            this.renderProjectInfoPanelContent();
        }
        if (this.thirdPartyInfoVisible) {
            this.loadThirdPartyInfoContent();
        }
        if (this.shortcutsVisible) {
            this.loadShortcutsInfoContent();
        }
        if (this.queryExportVisible) {
            const queryDoiOrderInput = document.getElementById('queryDoiOrderInput');
            if (queryDoiOrderInput) {
                queryDoiOrderInput.value = this.queryDoiOrderText || '';
            }
            this.refreshQueryFieldOptions();
            this.updateDoiStats();
        }
        if (this.apiSettingsVisible) {
            this.applyApiSettingsInputs();
        }
        if (this.autoSaveConfigVisible) {
            // 渲染自动保存配置内容
            setTimeout(() => {
                if (this.autoSaveConfigUI) {
                    const container = document.getElementById('autoSaveConfigBody');
                    if (container && container.innerHTML.trim() === '') {
                        this.autoSaveConfigUI.renderInline(container);
                    }
                }
            }, 100);
        }
        if (!skipView && (this.fileFilterVisible || this.createGroupVisible || this.projectInfoVisible || this.thirdPartyInfoVisible || this.shortcutsVisible || this.queryExportVisible || this.apiSettingsVisible || this.autoSaveConfigVisible)) {
            this.switchToView('settings');
        }
    }

    async loadFileFilterHistory() {
        const key = this.getProjectKey();
        if (!key) {
            this.fileFilterHistory = [];
            return;
        }
        if (this.projectStorage && this.currentProject) {
            try {
                const stored = await this.projectStorage.load('file-filter-history');
                if (Array.isArray(stored)) {
                    this.fileFilterHistory = stored;
                    return;
                }
                const legacy = localStorage.getItem(`fileFilterHistory:${key}`);
                if (legacy) {
                    const parsed = JSON.parse(legacy);
                    this.fileFilterHistory = Array.isArray(parsed) ? parsed : [];
                    await this.projectStorage.save('file-filter-history', this.fileFilterHistory);
                    localStorage.removeItem(`fileFilterHistory:${key}`);
                    return;
                }
            } catch (_err) {
                this.fileFilterHistory = [];
                return;
            }
        }
        this.fileFilterHistory = [];
    }

    saveFileFilterHistory() {
        const key = this.getProjectKey();
        if (!key) return;
        if (this.projectStorage && this.currentProject) {
            this.projectStorage.update('file-filter-history', this.fileFilterHistory || []);
            return;
        }
    }

    buildFileFilterSnapshot() {
        const quick = (this.fileFilter || '').trim();
        const conditions = (this.fileFilterConditions || []).map((cond) => ({
            logic: cond.logic || 'AND',
            field: String(cond.field || '').trim(),
            value: String(cond.value || '').trim(),
            match: cond.match || 'contains'
        })).filter(c => c.field && c.value);
        if (!quick && !conditions.length) return null;
        return {
            id: `ff_${Date.now()}`,
            ts: Date.now(),
            quick,
            conditions
        };
    }

    saveFileFilterSnapshot() {
        const snapshot = this.buildFileFilterSnapshot();
        if (!snapshot) return;
        const history = Array.isArray(this.fileFilterHistory) ? this.fileFilterHistory : [];
        const last = history[0];
        if (last) {
            const lastSig = JSON.stringify({ quick: last.quick || '', conditions: last.conditions || [] });
            const nextSig = JSON.stringify({ quick: snapshot.quick || '', conditions: snapshot.conditions || [] });
            if (lastSig === nextSig) return;
        }
        history.unshift(snapshot);
        this.fileFilterHistory = history.slice(0, 20);
        this.saveFileFilterHistory();
        this.renderFileFilterHistory();
    }

    clearFileFilterHistory() {
        this.fileFilterHistory = [];
        this.saveFileFilterHistory();
        this.renderFileFilterHistory();
    }

    applyFileFilterSnapshot(snapshot) {
        if (!snapshot) return;
        this.fileFilter = snapshot.quick || '';
        const input = document.getElementById('fileFilterInput');
        if (input) input.value = this.fileFilter;
        const conditions = Array.isArray(snapshot.conditions) ? snapshot.conditions : [];
        this.fileFilterConditions = conditions.length
            ? conditions.map((cond) => ({
                id: `cond_${++this.fileFilterConditionId}`,
                logic: cond.logic || 'AND',
                field: cond.field || '',
                value: cond.value || '',
                match: cond.match || 'contains'
            }))
            : [this.createFileFilterCondition()];
        this.fileFilterMatches = null;
        this.renderFileFilterConditions();
        this.runFileFilter();
    }

    renderFileFilterHistory() {
        const list = document.getElementById('fileFilterHistoryList');
        const empty = document.getElementById('fileFilterHistoryEmpty');
        if (!list || !empty) return;
        list.innerHTML = '';
        const history = Array.isArray(this.fileFilterHistory) ? this.fileFilterHistory : [];
        if (!history.length) {
            empty.style.display = 'block';
            return;
        }
        empty.style.display = 'none';
        history.forEach((item) => {
            const row = document.createElement('div');
            row.className = 'file-filter-history-item';
            const quick = item.quick ? `Quick: ${item.quick}` : '';
            const conditions = Array.isArray(item.conditions) ? item.conditions : [];
            const condCount = conditions.length;
            const condPreview = conditions.slice(0, 2).map((cond) => {
                const field = cond.field || '';
                const value = cond.value || '';
                const op = cond.match === 'regex' ? '~=' : 'contains';
                return `${field} ${op} ${value}`;
            }).filter(Boolean).join(' ; ');
            const more = condCount > 2 ? ` +${condCount - 2}` : '';
            const condLabel = condCount ? `Conditions: ${condPreview}${more}` : '';
            const label = [quick, condLabel].filter(Boolean).join(' | ');
            const text = document.createElement('span');
            text.className = 'file-filter-history-text';
            text.textContent = label || 'Saved filter';
            text.title = label || 'Saved filter';
            const actions = document.createElement('div');
            actions.className = 'file-filter-history-actions';
            const applyBtn = document.createElement('button');
            applyBtn.type = 'button';
            applyBtn.className = 'file-filter-history-btn';
            applyBtn.title = 'Restore';
            applyBtn.innerHTML = '<i class="fas fa-rotate-left"></i>';
            applyBtn.addEventListener('click', () => this.applyFileFilterSnapshot(item));
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'file-filter-history-btn';
            deleteBtn.title = 'Delete';
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.addEventListener('click', () => {
                this.fileFilterHistory = this.fileFilterHistory.filter(h => h.id !== item.id);
                this.saveFileFilterHistory();
                this.renderFileFilterHistory();
            });
            actions.appendChild(applyBtn);
            actions.appendChild(deleteBtn);
            row.appendChild(text);
            row.appendChild(actions);
            list.appendChild(row);
        });
    }

    updateFileFilterUi() {
        this.renderFileFilterConditions();
    }

    runFileFilter() {
        if (this.hasActiveFileFilterConditions()) {
            this.saveFileFilterSnapshot();
            this.updateFieldFilterMatches();
            return;
        }
        if ((this.fileFilter || '').trim()) {
            this.saveFileFilterSnapshot();
        }
        this.fileFilterMatches = null;
        this.renderFileList(this.currentFileList || [], this.currentFile, true);
    }

    ensureFileFilterConditions() {
        if (!Array.isArray(this.fileFilterConditions) || !this.fileFilterConditions.length) {
            this.fileFilterConditions = [this.createFileFilterCondition()];
        }
    }

    createFileFilterCondition() {
        this.fileFilterConditionId += 1;
        return {
            id: `cond_${this.fileFilterConditionId}`,
            logic: 'AND',
            field: '',
            value: '',
            match: 'contains'
        };
    }

    addFileFilterCondition() {
        this.fileFilterConditions.push(this.createFileFilterCondition());
        this.fileFilterMatches = null;
        this.renderFileFilterConditions();
    }

    removeFileFilterCondition(id) {
        this.fileFilterConditions = (this.fileFilterConditions || []).filter(c => c.id !== id);
        this.fileFilterFieldAutocompletes.delete(id);
        if (!this.fileFilterConditions.length) {
            this.fileFilterConditions.push(this.createFileFilterCondition());
        }
        this.fileFilterMatches = null;
        this.renderFileFilterConditions();
    }

    getActiveFileFilterConditions() {
        return (this.fileFilterConditions || []).filter(c => {
            const field = String(c.field || '').trim();
            const value = String(c.value || '').trim();
            return field && value;
        });
    }

    hasActiveFileFilterConditions() {
        return this.getActiveFileFilterConditions().length > 0;
    }

    renderFileFilterConditions() {
        const container = document.getElementById('fileFilterConditions');
        if (!container) return;
        this.ensureFileFilterConditions();
        container.innerHTML = '';
        (this.fileFilterConditions || []).forEach((cond, idx) => {
            const row = document.createElement('div');
            row.className = 'file-filter-condition';
            row.dataset.id = cond.id;

            if (idx === 0) {
                const placeholder = document.createElement('span');
                placeholder.className = 'file-filter-logic-placeholder';
                placeholder.textContent = 'IF';
                row.appendChild(placeholder);
            } else {
                const logicSelect = document.createElement('select');
                logicSelect.className = 'file-filter-logic';
                ['AND', 'OR'].forEach((opt) => {
                    const option = document.createElement('option');
                    option.value = opt;
                    option.textContent = opt;
                    if (cond.logic === opt) option.selected = true;
                    logicSelect.appendChild(option);
                });
                logicSelect.addEventListener('change', (e) => {
                    cond.logic = e.target.value;
                    this.fileFilterMatches = null;
                });
                row.appendChild(logicSelect);
            }

            const fieldInput = document.createElement('input');
            fieldInput.type = 'text';
            fieldInput.className = 'file-filter-field-input';
            fieldInput.placeholder = 'Field';
            fieldInput.value = cond.field || '';
            fieldInput.addEventListener('input', (e) => {
                cond.field = e.target.value;
                this.fileFilterMatches = null;
            });
            fieldInput.addEventListener('focus', () => {
                if (!this.queryFieldOptions.length) {
                    this.refreshQueryFieldOptions().catch(() => { });
                }
            });
            row.appendChild(fieldInput);

            if (window.AutocompleteManager) {
                const auto = new AutocompleteManager(fieldInput, {
                    minChars: 0,
                    maxSuggestions: 12,
                    pathProvider: {
                        getSuggestions: (context) => this.getFileFilterPathSuggestions(context)
                    }
                });
                this.fileFilterFieldAutocompletes.set(cond.id, auto);
            }

            const matchSelect = document.createElement('select');
            matchSelect.className = 'file-filter-match';
            [
                { value: 'contains', label: 'Contains' },
                { value: 'regex', label: 'Regex' }
            ].forEach((opt) => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.label;
                if ((cond.match || 'contains') === opt.value) option.selected = true;
                matchSelect.appendChild(option);
            });
            matchSelect.addEventListener('change', (e) => {
                cond.match = e.target.value;
                this.fileFilterMatches = null;
            });
            row.appendChild(matchSelect);

            const valueInput = document.createElement('input');
            valueInput.type = 'text';
            valueInput.className = 'file-filter-value-input';
            valueInput.placeholder = 'Value';
            valueInput.value = cond.value || '';
            valueInput.addEventListener('input', (e) => {
                cond.value = e.target.value;
                this.fileFilterMatches = null;
            });
            valueInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.runFileFilter();
                }
            });
            row.appendChild(valueInput);

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'file-filter-remove-btn';
            removeBtn.title = 'Remove condition';
            removeBtn.innerHTML = '<i class="fas fa-times"></i>';
            removeBtn.addEventListener('click', () => this.removeFileFilterCondition(cond.id));
            row.appendChild(removeBtn);

            container.appendChild(row);
        });
    }

    getFileFilterFieldOptions() {
        if ((this.queryFieldOptionsView || '') !== (this.currentJsonView || '')) {
            this.refreshQueryFieldOptions().catch(() => { });
        }
        const options = new Set();
        (this.queryFieldOptions || []).forEach(f => options.add(String(f)));
        Object.keys(this.wosFieldTagsByKey || {}).forEach((f) => {
            const key = String(f);
            options.add(key);
            options.add(`wos_data.${key}`);
        });
        return Array.from(options).sort();
    }

    getFileFilterPathSuggestions(context) {
        if (!context) return [];
        const options = this.getFileFilterFieldOptions();
        const basePath = context.basePath || '';
        const prefix = context.prefix || '';
        const prefixLower = prefix.toLowerCase();
        const baseLower = basePath.toLowerCase();
        const seen = new Map();

        options.forEach((path) => {
            const clean = String(path || '');
            if (!clean) return;
            if (basePath) {
                if (!clean.toLowerCase().startsWith(`${baseLower}.`)) return;
                const remainder = clean.slice(basePath.length + 1);
                const seg = remainder.split('.')[0];
                if (!seg) return;
                if (prefix && !seg.toLowerCase().startsWith(prefixLower)) return;
                if (!seen.has(seg)) {
                    seen.set(seg, `${basePath}.${seg}`);
                }
                return;
            }
            const seg = clean.split('.')[0];
            if (!seg) return;
            if (prefix && !seg.toLowerCase().startsWith(prefixLower)) return;
            if (!seen.has(seg)) {
                seen.set(seg, seg);
            }
        });

        return Array.from(seen.entries()).map(([seg, fullPath]) => ({
            label: seg,
            insertText: seg,
            detail: fullPath
        }));
    }

    selectFileFilterField(field) {
        const raw = String(field || '').trim().replace(/^[\]\.\s]+/, '').replace(/[.\s]+$/, '');
        if (!raw) return;
        this.ensureFileFilterConditions();
        const target = this.fileFilterConditions[0];
        if (target) {
            target.field = raw;
            target.value = '';
        }
        this.fileFilterMatches = null;
        this.renderFileList(this.currentFileList || [], this.currentFile, true);
        this.updateFileFilterUi();
    }

    clearFileFilterField() {
        this.fileFilterConditions = [this.createFileFilterCondition()];
        this.fileFilterMatches = null;
        this.renderFileList(this.currentFileList || [], this.currentFile, true);
        this.updateFileFilterUi();
    }

    async updateFieldFilterMatches() {
        const activeConditions = this.getActiveFileFilterConditions();
        if (!activeConditions.length) {
            this.fileFilterMatches = null;
            this.renderFileList(this.currentFileList || [], this.currentFile, true);
            return;
        }
        const conditions = activeConditions.map((cond) => {
            const raw = String(cond.field || '').trim().replace(/^[\]\.\s]+/, '').replace(/[.\s]+$/, '');
            const keyOnly = raw && !raw.includes('.') ? raw : '';
            const expanded = keyOnly && this.wosFieldTagsByKey?.[keyOnly] ? `wos_data.${keyOnly}` : raw;
            const matchMode = cond.match || 'contains';
            return {
                logic: cond.logic || 'AND',
                field: expanded,
                value: String(cond.value || '').trim(),
                match: matchMode
            };
        }).filter(c => c.field && c.value);

        if (!conditions.length) {
            this.fileFilterMatches = null;
            this.renderFileList(this.currentFileList || [], this.currentFile, true);
            return;
        }

        const compiledConditions = [];
        for (const cond of conditions) {
            if (cond.match === 'regex') {
                try {
                    const regex = new RegExp(cond.value, 'i');
                    compiledConditions.push({ ...cond, regex });
                } catch (_err) {
                    this.showNotification?.(`Invalid regex: ${cond.value}`, 'warning');
                    this.fileFilterMatches = null;
                    this.renderFileList(this.currentFileList || [], this.currentFile, true);
                    return;
                }
            } else {
                compiledConditions.push({ ...cond, value: cond.value.toLowerCase() });
            }
        }

        const token = ++this.fileFilterComputeToken;
        const bases = Array.isArray(this.currentFileList) ? this.currentFileList : [];
        const view = this.currentJsonView || 'view1';
        const matches = new Set();
        const tracker = (typeof this.createStatusProgressTracker === 'function')
            ? this.createStatusProgressTracker('Filtering files')
            : null;
        if (tracker) tracker.update('Filtering files (0%)', 0);

        let cursor = 0;
        const limit = Math.min(8, bases.length || 0) || 1;
        let processed = 0;
        const worker = async () => {
            while (cursor < bases.length) {
                const base = bases[cursor];
                cursor += 1;
                if (token !== this.fileFilterComputeToken) return;
                const path = this.getViewPathForBase(base, view);
                if (!path) continue;
                let data = this.tempDataCache[path];
                if (!data) {
                    try {
                        data = await this.readProjectFile(path);
                    } catch (_err) {
                        continue;
                    }
                }
                let result = null;
                compiledConditions.forEach((cond, idx) => {
                    if (result === false && cond.logic === 'AND') {
                        return;
                    }
                    const values = this.getFieldValuesForFilter(data, cond.field);
                    const found = values && values.length
                        ? values.some(v => {
                            const text = String(v || '');
                            if (cond.match === 'regex' && cond.regex) {
                                return cond.regex.test(text);
                            }
                            return text.toLowerCase().includes(cond.value);
                        })
                        : false;
                    if (idx === 0) {
                        result = found;
                    } else if (cond.logic === 'OR') {
                        result = (result || false) || found;
                    } else {
                        result = (result || false) && found;
                    }
                });
                if (result) {
                    matches.add(base);
                }
                processed += 1;
                if (tracker) {
                    const percent = bases.length ? Math.round((processed / bases.length) * 100) : 100;
                    tracker.update(`Filtering files (${processed}/${bases.length})`, percent);
                }
            }
        };

        const workers = Array.from({ length: limit }, () => worker());
        try {
            await Promise.all(workers);
            if (tracker) tracker.finish('Filtering files done');
        } catch (err) {
            if (tracker) tracker.fail('Filtering files failed');
            throw err;
        }

        if (token !== this.fileFilterComputeToken) return;
        this.fileFilterMatches = matches;
        this.renderFileList(this.currentFileList || [], this.currentFile, true);
    }

    getFieldValuesForFilter(data, fieldPath) {
        if (!fieldPath) return [];
        const normalizedPath = String(fieldPath || '').trim().replace(/^[\]\.\s]+/, '');
        if (!normalizedPath) return [];
        if (!normalizedPath.includes('[]')) {
            if (typeof this.extractFieldValuesFromData === 'function') {
                return this.extractFieldValuesFromData(data, normalizedPath);
            }
            return [];
        }
        const parts = normalizedPath.split('.').filter(Boolean);
        const collect = (node, idx) => {
            if (idx >= parts.length) return [node];
            const part = parts[idx];
            const isArrayKey = part.endsWith('[]');
            const key = isArrayKey ? part.slice(0, -2) : part;
            if (!node || typeof node !== 'object') return [];
            if (!Object.prototype.hasOwnProperty.call(node, key)) return [];
            const nextVal = node[key];
            if (isArrayKey) {
                if (!Array.isArray(nextVal)) return [];
                const out = [];
                nextVal.forEach((item) => {
                    collect(item, idx + 1).forEach(v => out.push(v));
                });
                return out;
            }
            return collect(nextVal, idx + 1);
        };
        const raw = collect(data, 0).flatMap((val) => Array.isArray(val) ? val : [val]);
        if (typeof this.normalizeFieldValues === 'function') {
            return this.normalizeFieldValues(raw);
        }
        return raw
            .filter(v => v !== undefined && v !== null)
            .map(v => (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') ? String(v).trim() : '')
            .filter(Boolean);
    }

    closeHeaderMenus(except = '') {
        const keep = String(except || '').toLowerCase();
        if (keep !== 'json' && this.jsonMenuVisible) this.toggleJsonMenu(false);
        if (keep !== 'md' && this.mdMenuVisible) this.toggleMdMenu(false);
        if (keep !== 'settings' && this.settingsMenuVisible) this.toggleSettingsMenu(false);
        if (keep !== 'import' && this.importMenuVisible) this.toggleImportMenu(false);
        if (keep !== 'cli' && this.cliMenuVisible) this.toggleCliMenu(false);
        if (keep !== 'info' && this.projectInfoVisible) {
            const panel = document.getElementById('projectInfoPanel');
            if (!(panel && panel.classList.contains('settings-panel'))) {
                this.toggleProjectInfoPanel(false, { skipClose: true });
            }
        }
        if (keep !== 'thirdparty' && this.thirdPartyInfoVisible) {
            const panel = document.getElementById('thirdPartyInfoPanel');
            if (!(panel && panel.classList.contains('settings-panel'))) {
                this.toggleThirdPartyInfoPanel(false, { skipClose: true });
            }
        }
        if (keep !== 'shortcuts' && this.shortcutsVisible) {
            const panel = document.getElementById('shortcutsInfoPanel');
            if (!(panel && panel.classList.contains('settings-panel'))) {
                this.toggleShortcutsPanel(false, { skipClose: true });
            }
        }
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
            this.rawJsonParseError = err?.message ? String(err.message) : 'Parse failed';
            this.updateSaveButtonState();
            if (notifyOnError) this.showNotification(`JSON parse failed: ${this.rawJsonParseError}`, 'error');
            return false;
        }
    }

    updateJsonMenuState() {
        const dropdown = document.getElementById('jsonMenuDropdown');
        const structuredItem = document.getElementById('jsonViewStructuredItem');
        const flatItem = document.getElementById('jsonViewFlatItem');
        const formatItem = document.getElementById('jsonFormatItem');
        const addFieldItem = document.getElementById('jsonAddFieldItem');
        const saveItem = document.getElementById('jsonSaveItem');
        if (!dropdown || !structuredItem || !flatItem || !formatItem || !saveItem || !addFieldItem) return;

        const hasFile = !!this.currentFile;
        dropdown.style.display = 'inline-flex';
        const view = this.currentView || 'structured';
        structuredItem.disabled = view === 'structured';
        flatItem.disabled = view === 'flat';
        formatItem.disabled = !(hasFile && view === 'flat');
        addFieldItem.disabled = !(hasFile && !this.isEditLocked);
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

        const view = this.currentView || 'structured';
        const inMarkdownView = view === 'markdown';
        const isSourceMode = (view === 'flat') || (inMarkdownView && this.isMarkdownEditing);
        const setMdToggleIcon = (btnId) => {
            const toggleBtn = document.getElementById(btnId);
            if (!toggleBtn) return;
            const icon = toggleBtn.querySelector('i');
            if (!icon) return;
            icon.className = isSourceMode
                ? 'fa-solid fa-pen-to-square'
                : 'fa-solid fa-person-chalkboard';
        };
        setMdToggleIcon('statusToggleSourceBtn');

        const hasFile = this.isDraftViewActive ? true : !!this.currentFile;
        dropdown.style.display = 'inline-flex';
        if (!hasFile && this.mdMenuVisible) this.toggleMdMenu(false);

        renderItem.disabled = !hasFile || (inMarkdownView && !this.isMarkdownEditing);
        sourceItem.disabled = !hasFile || (inMarkdownView && this.isMarkdownEditing) || !this.currentMarkdownExists;
        saveItem.disabled = !hasFile || !inMarkdownView || !this.currentMarkdownExists || !this.hasUnsavedMarkdownChanges;
    }

    updateAutoLoadMenuState() {
        const onItem = document.getElementById('autoLoadOnItem');
        const offItem = document.getElementById('autoLoadOffItem');
        if (onItem) onItem.classList.toggle('checked', !!this.autoLoadPdf);
        if (offItem) offItem.classList.toggle('checked', !this.autoLoadPdf);
        this.updatePdfAutoLoadButtonState();
    }

    updatePdfAutoLoadButtonState() {
        const btn = document.getElementById('btnPdfAutoLoad');
        if (!btn) return;
        const icon = btn.querySelector('i');
        const isOn = !!this.autoLoadPdf;
        btn.classList.toggle('is-on', isOn);
        btn.setAttribute('aria-pressed', String(isOn));
        btn.title = isOn ? 'Auto-load PDF: On' : 'Auto-load PDF: Off';
        if (icon) {
            icon.className = isOn ? 'fas fa-toggle-on' : 'fas fa-toggle-off';
        }
    }

    showProjectDetailsPanel() {
        if (!this.currentProject) {
            // 未加载项目时，打开项目选择器
            this.showProjectSelector();
            return;
        }

        const panel = document.getElementById('projectInfoPanel');
        const body = document.getElementById('projectInfoBody');
        if (!panel || !body) return;

        this.renderProjectInfoPanelContent();
        if (this._projectInfoEscHandler) {
            document.removeEventListener('keydown', this._projectInfoEscHandler);
        }
        this._projectInfoEscHandler = (ev) => {
            if (ev.key !== 'Escape') return;
            const panelEl = document.getElementById('projectInfoPanel');
            if (panelEl && panelEl.classList.contains('settings-panel')) {
                return;
            }
            ev.preventDefault();
            this.toggleProjectInfoPanel(false, { skipClose: true });
        };
        document.addEventListener('keydown', this._projectInfoEscHandler);
        this.projectInfoVisible = true;
        panel.classList.add('is-visible');
        this.moveSettingsPanelToEnd(panel);
        this.updateSettingsPanelsVisibility();
        this.switchToView('settings');
        this.closeHeaderMenus('info');
    }

    renderProjectInfoPanelContent() {
        const body = document.getElementById('projectInfoBody');
        if (!body) return;
        if (!this.currentProject) {
            body.textContent = 'No project loaded';
            return;
        }

        const projectPath = this.currentProject.path || '';
        const projectName = this.currentProject.name || 'Unknown Project';

        let jsonCount = 0;
        let mdCount = 0;
        let pdfCount = 0;

        if (this.fileMetaByBase && typeof this.fileMetaByBase === 'object') {
            Object.values(this.fileMetaByBase).forEach(meta => {
                if ((meta.views && Object.keys(meta.views).length > 0) || meta.legacyJson) {
                    jsonCount++;
                }
                if (meta.mdPath) {
                    mdCount++;
                }
            });
        }

        if (this.fileMetaByPath && typeof this.fileMetaByPath === 'object') {
            Object.values(this.fileMetaByPath).forEach(meta => {
                if (meta && meta.kind === 'pdf') {
                    pdfCount++;
                }
            });
        }

        const html = `
            <div class="project-details">
            <div class="detail-section">
                <div class="detail-item">
                <label>Project Path:</label>
                <span class="detail-value detail-path" title="${this.escapeAttr(projectPath)}">${this.escapeHtml(projectPath)}</span>
                <button class="detail-copy-btn" type="button" title="Copy Project Path" aria-label="Copy Project Path" onclick="window.paperStats.copyProjectPathToClipboard()">
                    <i class="fas fa-copy"></i>
                </button>
                </div>
            </div>
            
            <div class="detail-section">
                <div class="detail-stats">
                <div class="stat-item">
                    <span class="stat-label">JSON Files</span>
                    <span class="stat-value">${jsonCount}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Markdown Files</span>
                    <span class="stat-value">${mdCount}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">PDF Files</span>
                    <span class="stat-value">${pdfCount}</span>
                </div>
                </div>
            </div>

            <div class="detail-section">
                <div class="detail-actions">
                <button class="detail-action-btn" onclick="window.paperStats.openProjectModal()">
                    <i class="fas fa-exchange-alt"></i> Create or Switch Project
                </button>
                <button class="detail-action-btn detail-action-btn-danger" onclick="window.paperStats.exitProject()">
                    <i class="fas fa-sign-out-alt"></i> Exit Project
                </button>
                </div>
            </div>
            </div>
        `;

        body.innerHTML = html;
    }

    copyProjectPathToClipboard() {
        if (!this.currentProject || !this.currentProject.path) {
            this.showNotification('Project path unavailable', 'error');
            return;
        }
        this.writeTextToClipboard(this.currentProject.path)
            .then(() => this.showNotification('Project path copied to clipboard', 'success'))
            .catch(err => this.showNotification(`Copy failed: ${err.message}`, 'error'));
    }

    initMarkdownChatPanel() {
        if (this._mdChatPanelBound) return;
        const panel = document.getElementById('mdChatPanel');
        const resizer = document.getElementById('mdChatResizer');
        const shell = panel?.querySelector('.md-chat-shell');
        const body = panel?.querySelector('.md-chat-body');
        const input = panel?.querySelector('.md-chat-input');
        const top = panel?.querySelector('.md-chat-top');
        const textarea = panel?.querySelector('.md-chat-input-text');
        const collapseBtn = null;
        const dockSideBtn = panel?.querySelector('#mdChatDockSideBtn');
        const closeBtn = panel?.querySelector('.md-chat-btn[title="Close"]');
        const editorContainer = document.querySelector('.editor-container');
        const chatToggleBtn = document.getElementById('mdChatToggleBtn');
        if (!panel || !resizer) return;
        this._mdChatPanelBound = true;

        const minHeight = 140;
        const collapseThreshold = 150;
        const dockMinWidth = 220;
        const stored = Number(localStorage.getItem('mdChatHeight'));
        const storedDockWidth = Number(localStorage.getItem('mdChatDockWidth'));
        if (Number.isFinite(stored) && stored > 80) {
            panel.style.height = `${stored}px`;
        }
        const storedHidden = localStorage.getItem('mdChatHidden') === '1';
        const storedDocked = localStorage.getItem('mdChatDocked') === '1';
        const storedCollapsed = localStorage.getItem('mdChatCollapsed') === '1';
        const storedDockSide = localStorage.getItem('mdChatDockSide') === 'left' ? 'left' : 'right';
        const storedDockPos = localStorage.getItem('mdChatDockPos');
        let dockSide = storedDockSide;
        const updateDockButton = () => {
            if (!dockSideBtn) return;
            const icon = dockSideBtn.querySelector('i');
            if (!icon) return;
            if (!panel.classList.contains('is-docked')) {
                icon.className = 'fa-solid fa-arrow-right-from-bracket fa-flip-horizontal';
                dockSideBtn.title = 'Dock position';
                return;
            }
            icon.className = dockSide === 'left'
                ? 'fa-solid fa-right-left fa-rotate-180'
                : 'fa-solid fa-right-left';
            dockSideBtn.title = dockSide === 'left'
                ? 'Docked left'
                : 'Docked right';
        };
        const applyDockSide = (side) => {
            dockSide = side === 'left' ? 'left' : 'right';
            localStorage.setItem('mdChatDockSide', dockSide);
            if (editorContainer) {
                editorContainer.classList.toggle('chat-docked-left', dockSide === 'left' && panel.classList.contains('is-docked'));
            }
            updateDockButton();
        };
        applyDockSide(dockSide);
        if (storedHidden) {
            panel.classList.add('is-hidden');
        }
        if (storedDocked) {
            panel.classList.add('is-docked');
        }
        const applyDockedLayout = () => {
            if (!panel || !editorContainer) return;
            editorContainer.classList.add('chat-docked');
            applyDockSide(dockSide);
            panel.style.height = '100%';
            if (shell) shell.style.height = '100%';
            if (Number.isFinite(storedDockWidth) && storedDockWidth > 180) {
                panel.style.width = `${storedDockWidth}px`;
            }
        };
        if (editorContainer && storedDocked && !storedHidden) {
            applyDockedLayout();
        }
        if (!storedDocked && storedDockPos === 'bottom') {
            const container = panel.parentElement;
            const baseHeight = container ? container.getBoundingClientRect().height : window.innerHeight;
            const targetHeight = Math.max(minHeight, Math.round(baseHeight * 0.5));
            panel.style.height = `${targetHeight}px`;
            if (shell) shell.style.height = '';
        }
        updateDockButton();

        const updateCollapsedHeight = () => {
            if (!panel || !shell) return;
            const target = getCollapsedTargetHeight();
            panel.style.height = `${target}px`;
            shell.style.height = `${target - 8}px`;
        };
        const getCollapsedTargetHeight = () => {
            const inputHeight = input?.getBoundingClientRect().height || 60;
            return Math.max(0, Math.round(inputHeight + 8));
        };
        const setCollapsedState = (collapsed) => {
            if (!shell || !body || !top) return;
            shell.classList.toggle('is-collapsed', collapsed);
            body.style.display = collapsed ? 'none' : '';
            top.style.display = collapsed ? 'none' : '';
            const icon = collapseBtn?.querySelector('i');
            if (icon) icon.className = collapsed ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
            if (collapsed) {
                updateCollapsedHeight();
            }
            localStorage.setItem('mdChatCollapsed', collapsed ? '1' : '0');
        };
        if (!storedHidden && !storedDocked) {
            setCollapsedState(false);
        }
        const onMouseDown = (e) => {
            e.preventDefault();
            panel.classList.add('is-dragging');
            const startY = e.clientY;
            const startHeight = panel.getBoundingClientRect().height;
            const container = panel.parentElement;
            const maxHeight = container ? Math.max(minHeight, container.getBoundingClientRect().height - 120) : 480;

            const onMove = (evt) => {
                const delta = evt.clientY - startY;
                const next = Math.max(minHeight, Math.min(maxHeight, Math.round(startHeight - delta)));
                if (panel.classList.contains('is-docked') && next <= collapseThreshold) {
                    setCollapsedState(true);
                    updateCollapsedHeight();
                    return;
                }
                setCollapsedState(false);
                panel.style.height = `${next}px`;
                if (shell) shell.style.height = '';
            };

            const onUp = () => {
                const height = Math.round(panel.getBoundingClientRect().height);
                localStorage.setItem('mdChatHeight', String(height));
                panel.classList.remove('is-dragging');
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        };

        resizer.addEventListener('mousedown', onMouseDown);
        resizer.addEventListener('dblclick', (e) => {
            e.preventDefault();
            if (!panel.classList.contains('is-docked')) return;
            if (!shell || !body || !top) return;
            const isCollapsed = shell.classList.contains('is-collapsed');
            if (isCollapsed) {
                setCollapsedState(false);
                const prevHeight = Number(panel.dataset.prevHeight);
                const nextHeight = Number.isFinite(prevHeight) && prevHeight > 0
                    ? Math.max(prevHeight, minHeight * 1.6)
                    : Math.round(minHeight * 1.8);
                panel.style.height = `${nextHeight}px`;
                if (shell) shell.style.height = '';
            } else {
                panel.dataset.prevHeight = String(Math.round(panel.getBoundingClientRect().height));
                setCollapsedState(true);
                const target = getCollapsedTargetHeight();
                panel.style.height = `${target}px`;
                if (shell) shell.style.height = `${target - 8}px`;
            }
            localStorage.setItem('mdChatHeight', String(Math.round(panel.getBoundingClientRect().height)));
        });

        // Collapse button removed; collapse/expand is controlled via drag/dblclick on the resizer.

        if (editorContainer && panel) {
            let dockResizer = editorContainer.querySelector('.md-chat-dock-resizer');
            if (!dockResizer) {
                dockResizer = document.createElement('div');
                dockResizer.className = 'md-chat-dock-resizer';
                editorContainer.insertBefore(dockResizer, panel);
            }
            dockResizer.addEventListener('mousedown', (e) => {
                if (!panel.classList.contains('is-docked')) return;
                e.preventDefault();
                const startX = e.clientX;
                const startWidth = panel.getBoundingClientRect().width;
                const containerWidth = editorContainer.getBoundingClientRect().width || 1;
                const maxWidth = Math.max(dockMinWidth, Math.round(containerWidth * 0.7));
                const onMove = (evt) => {
                    const delta = evt.clientX - startX;
                    const side = localStorage.getItem('mdChatDockSide') === 'left' ? 'left' : 'right';
                    const raw = side === 'left' ? (startWidth + delta) : (startWidth - delta);
                    const next = Math.max(dockMinWidth, Math.min(maxWidth, Math.round(raw)));
                    panel.style.width = `${next}px`;
                };
                const onUp = () => {
                    const next = Math.round(panel.getBoundingClientRect().width);
                    localStorage.setItem('mdChatDockWidth', String(next));
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
        }

        const setDockState = (nextState) => {
            if (!panel || !editorContainer) return;
            if (nextState === 'bottom') {
                panel.classList.remove('is-docked');
                editorContainer.classList.remove('chat-docked');
                setCollapsedState(false);
                const container = panel.parentElement;
                const baseHeight = container ? container.getBoundingClientRect().height : window.innerHeight;
                const targetHeight = Math.max(minHeight, Math.round(baseHeight * 0.5));
                panel.style.height = `${targetHeight}px`;
                if (shell) shell.style.height = '';
                panel.style.width = '';
                localStorage.setItem('mdChatDocked', '0');
                localStorage.setItem('mdChatDockPos', 'bottom');
                editorContainer.classList.remove('chat-docked-left');
                updateDockButton();
                return;
            }
            panel.classList.add('is-docked');
            editorContainer.classList.add('chat-docked');
            applyDockSide(nextState);
            setCollapsedState(false);
            panel.dataset.prevHeight = String(Math.round(panel.getBoundingClientRect().height));
            panel.style.height = '100%';
            if (shell) shell.style.height = '100%';
            const width = Number(localStorage.getItem('mdChatDockWidth'));
            if (Number.isFinite(width) && width > 180) {
                panel.style.width = `${width}px`;
            }
            localStorage.setItem('mdChatDocked', '1');
            localStorage.setItem('mdChatDockPos', nextState);
            updateDockButton();
        };

        if (dockSideBtn) {
            dockSideBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const currentState = panel.classList.contains('is-docked')
                    ? (dockSide === 'left' ? 'left' : 'right')
                    : 'bottom';
                const nextState = currentState === 'bottom'
                    ? 'left'
                    : currentState === 'left'
                        ? 'right'
                        : 'bottom';
                setDockState(nextState);
            });
        }

        if (panel && closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                panel.classList.add('is-hidden');
                if (editorContainer) editorContainer.classList.remove('chat-docked');
                localStorage.setItem('mdChatHidden', '1');
            });
        }

        if (panel && chatToggleBtn) {
            chatToggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const isHidden = panel.classList.toggle('is-hidden');
                if (editorContainer) {
                    if (isHidden) {
                        editorContainer.classList.remove('chat-docked');
                    } else if (panel.classList.contains('is-docked')) {
                        applyDockedLayout();
                    } else {
                        setCollapsedState(false);
                    }
                }
                localStorage.setItem('mdChatHidden', isHidden ? '1' : '0');
                // 当面板显示时自动聚焦输入框
                if (!isHidden && textarea) {
                    setTimeout(() => textarea.focus(), 0);
                }
            });
        }

        if (textarea) {
            this._mdChatBody = body;
            this._mdChatTextarea = textarea;
            this._mdChatShell = shell;
            const inputStack = document.createElement('div');
            inputStack.className = 'md-chat-input-stack';
            const chipRow = document.createElement('div');
            chipRow.className = 'md-chat-field-chips';
            const suggestBox = document.createElement('div');
            suggestBox.className = 'md-chat-suggest';
            suggestBox.style.display = 'none';
            if (textarea.parentElement && !textarea.parentElement.classList.contains('md-chat-input-stack')) {
                textarea.parentElement.insertBefore(inputStack, textarea);
                inputStack.appendChild(chipRow);
                inputStack.appendChild(textarea);
                inputStack.appendChild(suggestBox);
            }

            const resizeInput = () => {
                const minHeight = 24;
                const maxHeight = 96;
                if (!textarea.value) {
                    textarea.style.height = `${minHeight}px`;
                    textarea.style.overflowY = 'hidden';
                    if (shell?.classList.contains('is-collapsed')) {
                        updateCollapsedHeight();
                    }
                    return;
                }
                textarea.style.height = 'auto';
                const next = Math.min(maxHeight, textarea.scrollHeight);
                textarea.style.height = `${Math.max(minHeight, next)}px`;
                textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
                if (shell?.classList.contains('is-collapsed')) {
                    updateCollapsedHeight();
                }
            };

            const renderSuggestions = (value = '') => {
                if (!suggestBox) return;
                const query = (value || '').trim().toLowerCase();
                this.mdChatSuggestIndex = -1;
                if (!query) {
                    suggestBox.style.display = 'none';
                    suggestBox.innerHTML = '';
                    return;
                }
                const options = (this.mdChatFieldOptions || []).filter(f => f.toLowerCase().includes(query)).slice(0, 8);
                if (!options.length) {
                    suggestBox.style.display = 'none';
                    suggestBox.innerHTML = '';
                    return;
                }
                suggestBox.innerHTML = options.map((opt, idx) => (
                    `<button type="button" class="md-chat-suggest-item" data-idx="${idx}" data-value="${this.escapeAttr(opt)}">${this.escapeHtml(opt)}</button>`
                )).join('');
                suggestBox.style.display = 'block';
            };

            const addFieldFromInput = (raw) => {
                const field = (raw || '').trim();
                if (!field) return false;
                this.addMdChatQueryField(field);
                this.mdChatHistoryDraft = '';
                this.mdChatHistoryIndex = -1;
                if (Array.isArray(this.mdChatHistory)) {
                    const existingIdx = this.mdChatHistory.indexOf(field);
                    if (existingIdx >= 0) this.mdChatHistory.splice(existingIdx, 1);
                    this.mdChatHistory.push(field);
                    if (this.mdChatHistory.length > 50) {
                        this.mdChatHistory = this.mdChatHistory.slice(-50);
                    }
                } else {
                    this.mdChatHistory = [field];
                }
                textarea.value = '';
                renderSuggestions('');
                resizeInput();
                return true;
            };

            const applySuggestionToInput = (value) => {
                const next = (value || '').trim();
                if (!next) return;
                textarea.value = next;
                renderSuggestions(next);
                resizeInput();
                textarea.focus();
            };

            suggestBox.addEventListener('click', (e) => {
                const btn = e.target.closest('.md-chat-suggest-item');
                if (!btn) return;
                applySuggestionToInput(btn.dataset.value || '');
            });

            textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (this.mdChatSuggestIndex >= 0 && suggestBox?.children?.length) {
                        const btn = suggestBox.children[this.mdChatSuggestIndex];
                        if (btn?.dataset?.value) {
                            applySuggestionToInput(btn.dataset.value);
                            return;
                        }
                    }
                    addFieldFromInput(textarea.value);
                    return;
                }
                if (e.key === 'Tab') {
                    if (!suggestBox || suggestBox.style.display === 'none') return;
                    const items = Array.from(suggestBox.querySelectorAll('.md-chat-suggest-item'));
                    if (!items.length) return;
                    e.preventDefault();
                    const idx = this.mdChatSuggestIndex >= 0 ? this.mdChatSuggestIndex : 0;
                    const btn = items[idx];
                    if (btn?.dataset?.value) {
                        applySuggestionToInput(btn.dataset.value);
                    }
                    return;
                }
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    if (suggestBox && suggestBox.style.display !== 'none') {
                        e.preventDefault();
                        const items = Array.from(suggestBox.querySelectorAll('.md-chat-suggest-item'));
                        if (!items.length) return;
                        const delta = e.key === 'ArrowDown' ? 1 : -1;
                        let next = this.mdChatSuggestIndex + delta;
                        if (next < 0) next = items.length - 1;
                        if (next >= items.length) next = 0;
                        this.mdChatSuggestIndex = next;
                        items.forEach((el, idx) => el.classList.toggle('active', idx === this.mdChatSuggestIndex));
                        return;
                    }
                    if (!textarea.value && !this.mdChatHistory.length) return;
                    e.preventDefault();
                    if (this.mdChatHistoryIndex === -1) {
                        this.mdChatHistoryDraft = textarea.value;
                    }
                    const lastIdx = this.mdChatHistory.length - 1;
                    if (e.key === 'ArrowUp') {
                        this.mdChatHistoryIndex = this.mdChatHistoryIndex < 0 ? lastIdx : Math.max(0, this.mdChatHistoryIndex - 1);
                    } else {
                        if (this.mdChatHistoryIndex < 0) return;
                        this.mdChatHistoryIndex = Math.min(lastIdx + 1, this.mdChatHistoryIndex + 1);
                    }
                    if (this.mdChatHistoryIndex > lastIdx) {
                        textarea.value = this.mdChatHistoryDraft || '';
                        this.mdChatHistoryIndex = -1;
                    } else {
                        textarea.value = this.mdChatHistory[this.mdChatHistoryIndex] || '';
                    }
                    renderSuggestions(textarea.value);
                    resizeInput();
                }
            });

            textarea.addEventListener('input', () => {
                renderSuggestions(textarea.value);
            });

            textarea.addEventListener('input', resizeInput);
            resizeInput();
            this.renderMdChatQueryChips();
            // Auto-focus input if panel is visible on initialization
            if (!storedHidden && textarea) {
                setTimeout(() => textarea.focus(), 100);
            }
        }
    }

    updateMdChatFieldOptionsFromCurrentData() {
        if (!this.currentData || typeof this.currentData !== 'object') {
            this.mdChatFieldOptions = [];
            return;
        }
        this.mdChatFieldOptions = Array.from(this.getFieldUnionFromData(this.currentData)).sort();
    }

    showStatusProjectContextMenu(e) {
        const oldMenu = document.querySelector('.context-menu');
        if (oldMenu) oldMenu.remove();

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = `${e.pageX}px`;
        menu.style.top = `${e.pageY}px`;
        menu.innerHTML = `
            <div class="context-menu-item" data-action="copyProjectPath">
                <i class="fas fa-copy"></i> Copy Project Path
            </div>
        `;

        document.body.appendChild(menu);

        const margin = 8;
        const rect = menu.getBoundingClientRect();
        const maxLeft = window.innerWidth - rect.width - margin;
        const maxTop = window.innerHeight - rect.height - margin;
        const nextLeft = Math.max(margin, Math.min(e.pageX, maxLeft));
        const nextTop = Math.max(margin, Math.min(e.pageY, maxTop));
        menu.style.left = `${nextLeft}px`;
        menu.style.top = `${nextTop}px`;

        menu.addEventListener('click', (ev) => {
            const item = ev.target.closest('.context-menu-item');
            if (!item) return;
            const action = item.dataset.action;
            if (action === 'copyProjectPath') {
                this.copyProjectPathToClipboard();
            }
            menu.remove();
        });

        setTimeout(() => {
            document.addEventListener('click', function closeMenu() {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            });
        }, 0);
    }

    openProjectModal({ openCreate = false } = {}) {
        document.getElementById('projectSelectorModal')?.classList.add('active');
        this.projectInfoVisible = false;
        document.getElementById('projectInfoPanel')?.classList.remove('is-visible');
        this.updateSettingsPanelsVisibility();
        this.saveSettingsPanelsState();
        if (openCreate) {
            document.getElementById('createProjectBtn')?.click();
        }
    }

    openProjectSelector() {
        this.openProjectModal();
    }

    async openCodexCli() {
        if (this._openCodexCliPending) return;
        const projectPath = this.getRequiredProjectPath();
        if (!projectPath) return;
        this._openCodexCliPending = true;
        const btn = document.getElementById('openCodexCliMenuItem');
        if (btn) {
            btn.disabled = true;
            btn.classList.add('is-busy');
        }
        try {
            const response = await fetch('/open-codex-cli', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectPath })
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || `HTTP ${response.status}`);
            }
            this.showNotification('Codex CLI opened', 'success');
        } catch (err) {
            this.showNotification(`Failed to open Codex CLI: ${err.message}`, 'error');
        } finally {
            setTimeout(() => {
                this._openCodexCliPending = false;
                if (btn) {
                    btn.disabled = false;
                    btn.classList.remove('is-busy');
                }
            }, 1200);
        }
    }

    async openClaudeCli() {
        if (this._openClaudeCliPending) return;
        const projectPath = this.getRequiredProjectPath();
        if (!projectPath) return;
        this._openClaudeCliPending = true;
        const btn = document.getElementById('openClaudeCliMenuItem');
        if (btn) {
            btn.disabled = true;
            btn.classList.add('is-busy');
        }
        try {
            const response = await fetch('/open-claude-cli', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectPath })
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || `HTTP ${response.status}`);
            }
            this.showNotification('Claude CLI opened', 'success');
        } catch (err) {
            this.showNotification(`Failed to open Claude CLI: ${err.message}`, 'error');
        } finally {
            setTimeout(() => {
                this._openClaudeCliPending = false;
                if (btn) {
                    btn.disabled = false;
                    btn.classList.remove('is-busy');
                }
            }, 1200);
        }
    }
    openCreateProjectDialog() {
        this.openProjectModal({ openCreate: true });
    }

    exitProject() {
        if (!this.currentProject) return;
        const confirmed = confirm(`Exit project "${this.currentProject.name}"?`);
        if (!confirmed) return;

        // 清除所有项目相关状态
        this.currentProject = null;
        this.currentFile = null;
        this.currentData = null;
        this.currentPdfUrl = null;
        this.currentPdfPath = null;
        this.pendingPdfUrl = null;
        this.pendingPdfFallback = null;
        this.lastPdfLoadedUrl = '';
        this.currentPdfLoadToken++;
        this.currentLoadToken++;
        this.currentFileList = [];
        this.fileMetaByBase = {};
        this.fileMetaByPath = {};
        this.hasUnsavedChanges = false;
        this.tempDataCache = {};
        this.fileFilterHistory = [];
        this.selectedFiles = new Set();
        this.lastFileSelectionAnchor = null;
        this.visibleFileOrder = [];
        this.currentMarkdownText = '';
        this.currentMarkdownFile = '';
        this.currentMarkdownBaselineText = '';
        this.currentMarkdownExists = false;
        this.isMarkdownEditing = false;
        this.hasUnsavedMarkdownChanges = false;

        // 清除UI - 文件列表
        const fileListEl = document.getElementById('fileList');
        if (fileListEl) {
            fileListEl.innerHTML = '<div class="empty-state"><p>Please load a project first</p></div>';
        }

        // 清除UI - 主面板
        this.resetMainPanelsForProject();
        this.renderFileFilterHistory();

        // 保存配置
        this.saveProjectConfig();

        // 隐藏项目信息面板
        this.projectInfoVisible = false;
        document.getElementById('projectInfoPanel')?.classList.remove('is-visible');
        this.updateSettingsPanelsVisibility();
        this.saveSettingsPanelsState();

        // 更新显示
        this.updateProjectDisplay();

        // 显示提示
        this.showNotification('Exited project', 'success');

    }

    async toggleProjectInfoPanel(forceVisible, opts = {}) {
        const panel = document.getElementById('projectInfoPanel');
        const body = document.getElementById('projectInfoBody');
        if (!panel || !body) return;
        const next = typeof forceVisible === 'boolean' ? forceVisible : !this.projectInfoVisible;
        if (next && !opts.skipClose) this.closeHeaderMenus('info');
        this.projectInfoVisible = next;
        panel.classList.toggle('is-visible', next);
        if (next) this.moveSettingsPanelToEnd(panel);
        this.updateSettingsPanelsVisibility();
        if (!next && this._projectInfoEscHandler) {
            document.removeEventListener('keydown', this._projectInfoEscHandler);
            this._projectInfoEscHandler = null;
        }
        if (next) {
            this.switchToView('settings');
        }
        this.saveSettingsPanelsState();
    }

    async toggleThirdPartyInfoPanel(forceVisible, opts = {}) {
        const panel = document.getElementById('thirdPartyInfoPanel');
        const body = document.getElementById('thirdPartyInfoBody');
        if (!panel || !body) return;
        const next = typeof forceVisible === 'boolean' ? forceVisible : !this.thirdPartyInfoVisible;
        if (next && !opts.skipClose) this.closeHeaderMenus('thirdparty');
        this.thirdPartyInfoVisible = next;
        panel.classList.toggle('is-visible', next);
        if (next) this.moveSettingsPanelToEnd(panel);
        this.updateSettingsPanelsVisibility();
        if (next) {
            this.switchToView('settings');
        }
        if (next) {
            await this.loadThirdPartyInfoContent();
        }
        this.saveSettingsPanelsState();
    }

    async loadThirdPartyInfoContent() {
        const body = document.getElementById('thirdPartyInfoBody');
        if (!body || this.thirdPartyInfoLoaded) return;
        body.textContent = 'Loading...';
        try {
            const res = await fetch('/js-info.md');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const text = await res.text();
            const parser = this.getMarkdownParser();
            body.innerHTML = parser ? parser.render(text) : text;
            this.applyProjectInfoIcons(body);
            this.thirdPartyInfoLoaded = true;
        } catch (err) {
            console.error('Failed to load third-party JS info', err);
            body.textContent = `Load failed: ${err.message}`;
        }
    }

    async toggleShortcutsPanel(forceVisible, opts = {}) {
        const panel = document.getElementById('shortcutsInfoPanel');
        const body = document.getElementById('shortcutsInfoBody');
        if (!panel || !body) return;
        const next = typeof forceVisible === 'boolean' ? forceVisible : !this.shortcutsVisible;
        if (next && !opts.skipClose) this.closeHeaderMenus('shortcuts');
        this.shortcutsVisible = next;
        panel.classList.toggle('is-visible', next);
        if (next) this.moveSettingsPanelToEnd(panel);
        this.updateSettingsPanelsVisibility();
        if (next) {
            this.switchToView('settings');
        }
        if (next) {
            await this.loadShortcutsInfoContent();
        }
        this.saveSettingsPanelsState();
    }

    async loadShortcutsInfoContent() {
        const body = document.getElementById('shortcutsInfoBody');
        if (!body || this.shortcutsLoaded) return;
        body.textContent = 'Loading...';
        try {
            const res = await fetch('/shortcuts.md');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const text = await res.text();
            const parser = this.getMarkdownParser();
            body.innerHTML = parser ? parser.render(text) : text;
            this.shortcutsLoaded = true;
        } catch (err) {
            console.error('Failed to load shortcuts info', err);
            body.textContent = `Load failed: ${err.message}`;
        }
    }

    async writeTextToClipboard(text) {
        // 优先用异步剪贴板，失败则回退到 execCommand
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                return;
            } catch (err) {
                console.warn('navigator.clipboard write failed, falling back to execCommand:', err);
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
        if (!ok) throw new Error('Fallback copy failed');
    }

    flashCopyButton(btn, label = 'Copied', duration = 3000) {
        if (!btn) return;
        if (!btn.dataset.originalHtml) {
            btn.dataset.originalHtml = btn.innerHTML;
        }
        if (btn._copyFlashTimer) {
            clearTimeout(btn._copyFlashTimer);
        }
        btn.innerHTML = `<i class="fas fa-check"></i><span>${label}</span>`;
        btn._copyFlashTimer = setTimeout(() => {
            btn.innerHTML = btn.dataset.originalHtml || btn.innerHTML;
        }, duration);
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
                const citeRe = /(\\citep?\{[\s\S]+?\}|\\bib\{[\s\S]+?\})/g;
                const renderCitations = (txt = '') => {
                    let out = '';
                    let last = 0;
                    let m;
                    while ((m = citeRe.exec(txt)) !== null) {
                        if (m.index > last) {
                            out += renderMathText(txt.slice(last, m.index));
                        }
                        const raw = m[0];
                        const app = window.paperStats;
                        if (raw.startsWith('\\bib{')) {
                            // 处理 \bib{} - 只创建容器，实际渲染由 applyBibliographyRendering 完成
                            const inside = raw.slice(5, -1);
                            const normalized = app?.parseDoiListFromLatex?.(inside) || [];
                            const escDois = app?.escapeHtml(normalized.join(',')) || '';
                            out += `<span class="bibliography-inline" data-bib-dois="${escDois}"></span>`;
                        } else {
                            // 处理 \cite/\citep
                            const isP = raw.startsWith('\\citep');
                            const inside = raw.slice(raw.indexOf('{') + 1, -1);
                            const dois = app?.parseDoiListFromLatex?.(inside) || [];
                            out += app?.renderCitationPlaceholder(dois, isP ? 'citep' : 'cite') || md.utils.escapeHtml(raw);
                        }
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
                    const containsGoto = content.includes('\\goto{');
                    const containsCitation = /\\citep?\{|\\bib\{/.test(content);
                    const containsMath = hasMath(content);
                    if (!containsGoto && !containsMath && !containsCitation) return defaultText(tokens, idx, options, env, self);
                    const segments = containsGoto ? content.split(/(\\goto\{[\s\S]*?\})/g).filter(Boolean) : [content];
                    const rendered = segments.map(seg => {
                        const match = seg.match(/^\\goto\{([\s\S]*?)\}$/);
                        if (match) {
                            const q = match[1].replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
                            if (!q) return md.utils.escapeHtml(seg);
                            const esc = md.utils.escapeHtml(q).replace(/`/g, '&#96;');
                            return `<a href="#" class="location-link goto-link" data-page="" data-quote-text="${esc}" data-open-params="" data-quote-index="0" data-value-path="" title="Jump to PDF search"><i class="fa-solid fa-quote-right"></i></a>`;
                        }
                        return renderCitations(seg);
                    }).join('');
                    return rendered;
                };
            };
            md.use(gotoPlugin);

            // 添加 \doi{} 的 inline 规则处理
            const specialLinkPlugin = (mdInstance) => {
                // 定义 inline rule 来识别 \doi{}
                const doiRule = (state, silent) => {
                    const max = state.posMax;
                    const start = state.pos;

                    // 检查是否以 \doi{ 开始
                    if (state.src.charCodeAt(start) !== 0x5C /* \ */) return false;
                    if (state.src.slice(start, start + 5) !== '\\doi{') return false;

                    // 找到匹配的 }
                    let pos = start + 5;
                    while (pos < max && state.src.charCodeAt(pos) !== 0x7D /* } */) {
                        pos++;
                    }
                    if (pos >= max) return false;

                    const doi = state.src.slice(start + 5, pos).trim();
                    if (!doi) return false;

                    if (!silent) {
                        const token = state.push('doi_link', '', 0);
                        token.content = doi;
                    }

                    state.pos = pos + 1;
                    return true;
                };

                // 注册 inline rules
                mdInstance.inline.ruler.before('escape', 'doi_link', doiRule);

                // 添加 renderers
                mdInstance.renderer.rules.doi_link = (tokens, idx) => {
                    const doi = tokens[idx].content;
                    const escDoi = md.utils.escapeHtml(doi);
                    const doiUrl = `https://doi.org/${encodeURIComponent(doi)}`;
                    return `<a href="${doiUrl}" target="_blank" class="doi-link" title="Open DOI: ${escDoi}"><i class="fa-solid fa-external-link-alt"></i> DOI</a>`;
                };
            };
            md.use(specialLinkPlugin);

            // 添加 \groupby{}{} 的 inline 规则处理
            const groupByPlugin = (mdInstance) => {
                const groupByRule = (state, silent) => {
                    const max = state.posMax;
                    const start = state.pos;
                    const prefix = '\\groupby{';
                    if (state.src.charCodeAt(start) !== 0x5C /* \ */) return false;
                    if (state.src.slice(start, start + prefix.length) !== prefix) return false;

                    let pos = start + prefix.length;
                    while (pos < max && state.src.charCodeAt(pos) !== 0x7D /* } */) {
                        pos++;
                    }
                    if (pos >= max) return false;
                    if (pos + 1 >= max || state.src.charCodeAt(pos + 1) !== 0x7B /* { */) return false;

                    const groups = state.src.slice(start + prefix.length, pos);
                    let pos2 = pos + 2;
                    while (pos2 < max && state.src.charCodeAt(pos2) !== 0x7D /* } */) {
                        pos2++;
                    }
                    if (pos2 >= max) return false;

                    const fields = state.src.slice(pos + 2, pos2);
                    if (!silent) {
                        const token = state.push('groupby_inline', '', 0);
                        token.meta = { groups, fields };
                    }

                    state.pos = pos2 + 1;
                    return true;
                };

                mdInstance.inline.ruler.before('escape', 'groupby_inline', groupByRule);
                mdInstance.renderer.rules.groupby_inline = (tokens, idx) => {
                    const meta = tokens[idx].meta || {};
                    const app = window.paperStats;
                    if (app && typeof app.renderGroupByPlaceholder === 'function') {
                        return app.renderGroupByPlaceholder(meta.groups || '', meta.fields || '');
                    }
                    const fallback = `\\groupby{${meta.groups || ''}}{${meta.fields || ''}}`;
                    return mdInstance.utils.escapeHtml(fallback);
                };
            };
            md.use(groupByPlugin);

            // 添加 \query{}{}{} 的 inline 规则处理
            const queryPlugin = (mdInstance) => {
                const queryRule = (state, silent) => {
                    const max = state.posMax;
                    const start = state.pos;
                    const prefix = '\\query{';
                    if (state.src.charCodeAt(start) !== 0x5C /* \ */) return false;
                    if (state.src.slice(start, start + prefix.length) !== prefix) return false;

                    let pos = start + prefix.length;
                    while (pos < max && state.src.charCodeAt(pos) !== 0x7D /* } */) pos++;
                    if (pos >= max) return false;
                    if (pos + 1 >= max || state.src.charCodeAt(pos + 1) !== 0x7B /* { */) return false;
                    const groups = state.src.slice(start + prefix.length, pos);

                    let pos2 = pos + 2;
                    while (pos2 < max && state.src.charCodeAt(pos2) !== 0x7D /* } */) pos2++;
                    if (pos2 >= max) return false;
                    if (pos2 + 1 >= max || state.src.charCodeAt(pos2 + 1) !== 0x7B /* { */) return false;
                    const fields = state.src.slice(pos + 2, pos2);

                    let pos3 = pos2 + 2;
                    while (pos3 < max && state.src.charCodeAt(pos3) !== 0x7D /* } */) pos3++;
                    if (pos3 >= max) return false;
                    const value = state.src.slice(pos2 + 2, pos3);

                    if (!silent) {
                        const token = state.push('query_inline', '', 0);
                        token.meta = { groups, fields, value };
                    }
                    state.pos = pos3 + 1;
                    return true;
                };
                mdInstance.inline.ruler.before('escape', 'query_inline', queryRule);
                mdInstance.renderer.rules.query_inline = (tokens, idx) => {
                    const meta = tokens[idx].meta || {};
                    const app = window.paperStats;
                    if (app && typeof app.renderQueryPlaceholder === 'function') {
                        return app.renderQueryPlaceholder(meta.groups || '', meta.fields || '', meta.value || '');
                    }
                    const fallback = `\\query{${meta.groups || ''}}{${meta.fields || ''}}{${meta.value || ''}}`;
                    return mdInstance.utils.escapeHtml(fallback);
                };
            };
            md.use(queryPlugin);

            // 添加 \json{}{} 的 inline 规则处理
            const jsonQueryPlugin = (mdInstance) => {
                const jsonRule = (state, silent) => {
                    const max = state.posMax;
                    const start = state.pos;
                    const prefix = '\\json{';
                    if (state.src.charCodeAt(start) !== 0x5C /* \ */) return false;
                    if (state.src.slice(start, start + prefix.length) !== prefix) return false;

                    let pos = start + prefix.length;
                    while (pos < max && state.src.charCodeAt(pos) !== 0x7D /* } */) pos++;
                    if (pos >= max) return false;
                    if (pos + 1 >= max || state.src.charCodeAt(pos + 1) !== 0x7B /* { */) return false;
                    const groups = state.src.slice(start + prefix.length, pos);

                    let pos2 = pos + 2;
                    while (pos2 < max && state.src.charCodeAt(pos2) !== 0x7D /* } */) pos2++;
                    if (pos2 >= max) return false;
                    const fields = state.src.slice(pos + 2, pos2);

                    if (!silent) {
                        const token = state.push('json_inline', '', 0);
                        token.meta = { groups, fields };
                    }
                    state.pos = pos2 + 1;
                    return true;
                };
                mdInstance.inline.ruler.before('escape', 'json_inline', jsonRule);
                mdInstance.renderer.rules.json_inline = (tokens, idx) => {
                    const meta = tokens[idx].meta || {};
                    const app = window.paperStats;
                    if (app && typeof app.renderJsonQueryPlaceholder === 'function') {
                        return app.renderJsonQueryPlaceholder(meta.groups || '', meta.fields || '');
                    }
                    const fallback = `\\json{${meta.groups || ''}}{${meta.fields || ''}}`;
                    return mdInstance.utils.escapeHtml(fallback);
                };
            };
            md.use(jsonQueryPlugin);

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
                        return `<div class="goto-block"><a href="#" class="location-link goto-link" data-page="" data-quote-text="${esc}" data-open-params="" data-quote-index="0" data-value-path="" title="Jump to PDF search"><i class="fa-solid fa-quote-right"></i>${escapeHtml(q)}</a></div>`;
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
            const title = prompt('Detected QA code block, enter a title (optional):', 'Q&A');

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
        this.showNotification('QA snippet appended, remember to save Markdown', 'success');
        return true;
    }

    undoLastMarkdownPaste() {
        if (!this.lastMarkdownPasteBackup || this.lastMarkdownPasteBackup.file !== this.currentFile) {
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
        this.showNotification('Last QA paste undone', 'success');
    }

    getMarkdownFilename(jsonFilename) {
        if (!jsonFilename) return '';
        const base = jsonFilename.split('/').pop()?.replace(/\.json$/i, '') || jsonFilename.replace(/\.json$/i, '');
        return `md/${base}.md`;
    }

    getDraftFilename() {
        return 'DRAFT.md';
    }

    getActiveMarkdownFilename(isDraftOverride = null) {
        const isDraft = typeof isDraftOverride === 'boolean' ? isDraftOverride : this.isDraftViewActive;
        if (isDraft) return this.getDraftFilename();
        if (this.currentFile) return this.getMarkdownFilename(this.currentFile);
        return this.currentMarkdownFile || 'Markdown';
    }

    cacheFileMarkdownState() {
        this.fileMarkdownState = {
            exists: this.currentMarkdownExists,
            file: this.currentMarkdownFile,
            text: this.currentMarkdownText,
            baseline: this.currentMarkdownBaselineText,
            isEditing: this.isMarkdownEditing,
            hasUnsaved: this.hasUnsavedMarkdownChanges
        };
    }

    cacheDraftMarkdownState() {
        this.draftMarkdownState = {
            exists: this.currentMarkdownExists,
            file: this.currentMarkdownFile || this.getDraftFilename(),
            text: this.currentMarkdownText,
            baseline: this.currentMarkdownBaselineText,
            isEditing: this.isMarkdownEditing,
            hasUnsaved: this.hasUnsavedMarkdownChanges
        };
    }

    applyMarkdownState(state, { render = false } = {}) {
        if (!state) return;
        this.currentMarkdownExists = !!state.exists;
        this.currentMarkdownFile = state.file || '';
        this.currentMarkdownText = state.text || '';
        this.currentMarkdownBaselineText = state.baseline || '';
        this.isMarkdownEditing = !!state.isEditing;
        this.hasUnsavedMarkdownChanges = !!state.hasUnsaved;
        if (render) {
            this.renderMarkdownView(this.currentMarkdownText || '', { forceText: true });
        }
        this.updateMarkdownToolbar();
        this.updateMarkdownDirtyUI();
    }

    getDataUrl(filename) {
        const projectPath = this.getProjectKey();
        const safe = (filename || '').replace(/^\/+/, '');
        const segments = `${projectPath}/${safe}`.split('/').filter(Boolean).map(encodeURIComponent);
        return `/${segments.join('/')}`;
    }

    // 新方法：通过 API 读取文件（支持外部项目）
    async readProjectFile(filename, opts = {}) {
        const projectPath = this.getRequiredProjectPath();
        if (!projectPath) {
            throw new Error('Project not selected');
        }
        const response = await fetch('/read-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectPath: projectPath,
                filePath: filename
            }),
            cache: 'no-store'
        });

        if (!response.ok) {
            if (response.status === 404 && opts.allowNotFound) {
                return null;
            }
            throw new Error(`Failed to read file: ${response.status}`);
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        } else {
            return await response.text();
        }
    }

    async projectFileExists(filename) {
        const projectPath = this.getRequiredProjectPath();
        if (!projectPath) {
            throw new Error('Project not selected');
        }
        const response = await fetch('/file-exists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectPath: projectPath,
                filePath: filename
            }),
            cache: 'no-store'
        });
        if (!response.ok) {
            throw new Error(`Failed to check file: ${response.status}`);
        }
        const data = await response.json();
        return !!data.exists;
    }

    async persistMarkdown(filename, content) {
        const projectPath = this.getRequiredProjectPath();
        if (!projectPath) {
            throw new Error('Project not selected');
        }
        const normalized = (() => {
            const name = String(filename || '').replace(/^[/\\]+/, '');
            const lower = name.toLowerCase();
            if (lower === 'draft.md') return 'DRAFT.md';
            if (name.startsWith('md/')) return name;
            return `md/${name}`;
        })();
        const payload = {
            projectPath,
            filename: normalized,
            content
        };

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

        await trySave(this.saveMdEndpoint);
    }

    async ensureMarkdownForFiles(files = []) {
        const tasks = files.map(async (file) => {
            const mdFilename = this.getMarkdownFilename(file);
            try {
                const text = await this.readProjectFile(mdFilename);
                // 文件存在，无需创建
                return;
            } catch (err) {
                // 404或其他错误，创建默认MD文件
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
        // 从文件名提取basename（去掉路径），再将_转换为/
        let base = this.currentFile ? this.currentFile.replace(/\.json$/i, '') : 'notes';
        // 如果包含路径分隔符，只取最后的文件名部分
        base = base.split('/').pop() || base;
        const doi = base.replace(/_/g, '/');
        // 获取当前日期时间（精确到秒）
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const date = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        return `---\ndoi: ${doi}\ndate: ${date}\n---\n\n`;
    }

    buildDefaultMarkdownForFilename(jsonFilename) {
        // 从文件名提取basename（去掉路径），再将_转换为/
        let base = jsonFilename ? jsonFilename.replace(/\.json$/i, '') : 'notes';
        // 如果包含路径分隔符，只取最后的文件名部分
        base = base.split('/').pop() || base;
        const doi = base.replace(/_/g, '/');
        // 获取当前日期时间（精确到秒）
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const date = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        return `---\ndoi: ${doi}\ndate: ${date}\n---\n\n`;
    }

    async ensureMarkdownExistsForFile(jsonFilename) {
        if (!jsonFilename) return;
        const mdFilename = this.getMarkdownFilename(jsonFilename);
        try {
            const exists = await this.projectFileExists(mdFilename);
            if (exists) return;
            await this.persistMarkdown(mdFilename, this.buildDefaultMarkdownForFilename(jsonFilename));
        } catch (err) {
            console.warn('Failed to ensure markdown:', err);
        }
    }

    // 修复MD文件中的DOI（去除路径部分）
    async fixMarkdownDoi(mdFilename, jsonFilename) {
        try {
            // 读取MD文件内容
            const content = await this.readProjectFile(mdFilename);

            // 解析frontmatter
            const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
            const match = content.match(frontmatterRegex);

            if (!match) {
                console.warn('Frontmatter not found:', mdFilename);
                return false;
            }

            const frontmatter = match[1];
            const doiMatch = frontmatter.match(/^doi:\s*(.+)$/m);

            if (!doiMatch) {
                console.warn('DOI field not found:', mdFilename);
                return false;
            }

            const currentDoi = doiMatch[1].trim();

            // 从JSON文件名生成正确的DOI
            let base = jsonFilename.replace(/\.json$/i, '');
            base = base.split('/').pop() || base; // 只取basename
            const correctDoi = base.replace(/_/g, '/');

            // 检查是否需要修复
            if (currentDoi === correctDoi) {
                return false;
            }

            // 替换DOI
            const newFrontmatter = frontmatter.replace(
                /^doi:\s*(.+)$/m,
                `doi: ${correctDoi}`
            );
            const newContent = content.replace(frontmatterRegex, `---\n${newFrontmatter}\n---`);

            // 保存修复后的内容
            await this.persistMarkdown(mdFilename, newContent);

            return true;
        } catch (err) {
            return false;
        }
    }

    // 批量修复所有MD文件的DOI
    async fixAllMarkdownDois() {
        if (!this.currentFileList || this.currentFileList.length === 0) {
            this.showNotification('No files to fix', 'info');
            return;
        }

        let fixed = 0;
        let skipped = 0;
        let errors = 0;

        for (const jsonFile of this.currentFileList) {
            const mdFile = this.getMarkdownFilename(jsonFile);

            try {
                const result = await this.fixMarkdownDoi(mdFile, jsonFile);
                if (result) {
                    fixed++;
                } else {
                    skipped++;
                }
            } catch (err) {
                errors++;
                console.error('Processing failed:', jsonFile, err);
            }
        }

        const message = `Fix completed! Fixed: ${fixed}, Skipped: ${skipped}, Errors: ${errors}`;
        this.showNotification(message, fixed > 0 ? 'success' : 'info');

        // 如果当前文件的MD被修复了，重新加载
        if (fixed > 0 && this.currentFile) {
            await this.loadMarkdownForCurrentFile();
        }
    }

    // 批量修复所有 JSON 文件的 meta_info.doi
    async fixAllJsonDois() {
        if (!this.currentProject) {
            this.showNotification('Please load a project first', 'warning');
            return;
        }
        if (!this.fileMetaByBase || !Object.keys(this.fileMetaByBase).length) {
            await this.loadFileList(true);
        }

        const bases = Object.keys(this.fileMetaByBase || {});
        const jsonPaths = new Set();
        bases.forEach((base) => {
            this.getAllJsonPathsForBase(base).forEach((p) => jsonPaths.add(p));
        });
        if (!jsonPaths.size) {
            this.showNotification('No JSON files to fix', 'info');
            return;
        }

        let fixed = 0;
        let skipped = 0;
        let errors = 0;
        const tracker = (typeof this.createStatusProgressTracker === 'function')
            ? this.createStatusProgressTracker('Fix JSON DOI')
            : null;
        if (tracker) tracker.update('Fixing JSON DOI (0%)', 0);

        const paths = Array.from(jsonPaths);
        for (let i = 0; i < paths.length; i++) {
            const path = paths[i];
            try {
                const data = await this.readProjectFile(path);
                if (!data || typeof data !== 'object') {
                    skipped++;
                    continue;
                }
                if (!data.meta_info || typeof data.meta_info !== 'object') {
                    skipped++;
                    continue;
                }
                const raw = data.meta_info.doi;
                const rawText = Array.isArray(raw) ? raw.join(' ') : (raw !== undefined && raw !== null ? String(raw) : '');
                const extracted = this.extractDoisFromText(rawText);
                if (!extracted.length) {
                    skipped++;
                    continue;
                }
                const normalized = this.normalizeDoi(extracted[0]);
                if (!normalized) {
                    skipped++;
                    continue;
                }
                const current = (rawText || '').trim();
                if (current === normalized) {
                    skipped++;
                    continue;
                }
                data.meta_info.doi = normalized;
                await this.saveJsonPayload(path, data);
                fixed++;
                if (path === this.currentFile) {
                    this.currentData = data;
                    this.hasUnsavedChanges = false;
                    delete this.tempDataCache[this.currentFile];
                    this.updateSaveButtonState();
                    this.renderStructuredView();
                    this.renderFlatView();
                }
            } catch (err) {
                errors++;
                console.error('Fix JSON DOI failed:', path, err);
            } finally {
                if (tracker) {
                    const percent = Math.round(((i + 1) / paths.length) * 100);
                    tracker.update(`Fixing JSON DOI (${i + 1}/${paths.length})`, percent);
                }
            }
        }
        if (tracker) tracker.finish('Fix JSON DOI done');

        const message = `Fix JSON DOI completed! Fixed: ${fixed}, Skipped: ${skipped}, Errors: ${errors}`;
        this.showNotification(message, fixed > 0 ? 'success' : 'info');
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
        this.updateViewTabs();
    }

    async loadDraftMarkdownFile() {
        const mdFilename = this.getDraftFilename();
        const render = document.getElementById('markdownRender');
        if (render) {
            render.innerHTML = '<div class="loading"><div class="spinner"></div>Loading draft...</div>';
        }
        try {
            let text = '';
            try {
                text = await this.readProjectFile(mdFilename);
                this.currentMarkdownExists = true;
            } catch (err) {
                try {
                    await this.persistMarkdown(mdFilename, '');
                    this.currentMarkdownExists = true;
                    text = '';
                } catch (errCreate) {
                    console.warn('自动创建草稿失败:', errCreate);
                    this.currentMarkdownExists = false;
                    text = '';
                }
            }
            this.currentMarkdownFile = mdFilename;
            this.currentMarkdownText = text;
            this.currentMarkdownBaselineText = text;
            this.isMarkdownEditing = this.getMarkdownEditPreference(true);
            this.hasUnsavedMarkdownChanges = false;
            const textarea = document.getElementById('markdownTextarea');
            if (textarea) {
                textarea.value = text;
            }
            this.renderMarkdownView(text);
        } catch (err) {
            console.warn('Draft load error:', err);
            if (render) {
                render.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Draft load failed</h3><p>${err.message}</p></div>`;
            }
        } finally {
            this.updateMarkdownToolbar();
            this.updateMarkdownDirtyUI();
        }
    }

    async loadMarkdownForCurrentFile() {
        if (this.isDraftViewActive) {
            if (!this.currentFile) return;
            const mdFilename = this.getMarkdownFilename(this.currentFile);
            try {
                let text = '';
                let exists = false;
                try {
                    text = await this.readProjectFile(mdFilename);
                    exists = true;
                } catch (err) {
                    exists = false;
                    text = '';
                }
                this.fileMarkdownState = {
                    exists,
                    file: mdFilename,
                    text,
                    baseline: text,
                    isEditing: this.getMarkdownEditPreference(false),
                    hasUnsaved: false
                };
            } catch (err) {
                console.warn('Markdown load error (draft mode):', err);
            }
            return;
        }
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
        const render = document.getElementById('markdownRender');
        if (render) {
            render.innerHTML = '<div class="loading"><div class="spinner"></div>Loading markdown...</div>';
        }
        try {
            let text = '';
            try {
                text = await this.readProjectFile(mdFilename);
                this.currentMarkdownExists = true;
            } catch (err) {
                // 404或读取失败：不自动创建文件
                this.currentMarkdownExists = false;
                text = '';
            }
            this.currentMarkdownFile = mdFilename;
            this.currentMarkdownText = text;
            this.currentMarkdownBaselineText = text;
            this.isMarkdownEditing = this.getMarkdownEditPreference(false);
            this.hasUnsavedMarkdownChanges = false;
            const textarea = document.getElementById('markdownTextarea');
            if (this.isMarkdownEditing && textarea) {
                textarea.value = text;
            }
            this.renderMarkdownView(text, { forceText: true });
        } catch (err) {
            console.warn('Markdown load error:', err);
            if (render) {
                render.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Markdown load failed</h3><p>${err.message}</p></div>`;
            }
        } finally {
            this.updateMarkdownToolbar();
            this.updateMarkdownDirtyUI();
        }
    }

    renderMarkdownView(text, opts = {}) {
        const render = document.getElementById('markdownRender');
        const textarea = document.getElementById('markdownTextarea');
        const forceText = !!opts.forceText;
        const sourceText = this.isMarkdownEditing && textarea && !forceText ? (textarea.value || text) : text;
        if (textarea) {
            const fallback = this.isDraftViewActive ? '' : this.buildDefaultMarkdown();
            textarea.value = sourceText || fallback;
        }
        if (!render) return;
        if (!sourceText) {
            render.innerHTML = '<div class="empty-state"><i class="fas fa-file-alt"></i><h3>No Markdown</h3><p>No matching Markdown found, click the button above to create one</p></div>';
            this.applyEditLockState();
            return;
        }
        const md = this.getMarkdownParser();
        if (!md) {
            render.innerHTML = '<div class="empty-state"><i class="fas fa-file-alt"></i><h3>Markdown Engine Unavailable</h3></div>';
            this.applyEditLockState();
            return;
        }

        // 解析 front matter
        if (!this.frontMatterParser && window.FrontMatterParser) {
            this.frontMatterParser = new window.FrontMatterParser();
        }

        let contentToRender = sourceText;
        let metadata = {};

        if (this.frontMatterParser) {
            const parsed = this.frontMatterParser.parse(sourceText);
            metadata = parsed.metadata;
            contentToRender = parsed.content;
            this.currentMarkdownMetadata = metadata;

            if (this.debugEnabled && parsed.hasFrontMatter) {
                console.log('Parsed Markdown metadata:', metadata);
            }
        }

        const normalizeMath = (src = '') => {
            // 将 \( \) 与 \[ \] 转换为 $...$ 与 $$...$$，便于 MathJax 识别
            let out = src;
            out = out.replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (m, inner) => `$$${inner}$$`);
            out = out.replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, (m, inner) => `$${inner}$`);
            return out;
        };
        const normalizeBibBlocks = (src = '') => {
            return src.replace(/\\bib\{([\s\S]*?)\}/g, (m, inner) => {
                const parts = inner
                    .split(/[\s,，;；]+/)
                    .map(d => d.trim())
                    .filter(Boolean);
                return `\\bib{${parts.join(',')}}`;
            });
        };
        const normalizeGotoBlocks = (src = '') => {
            return src.replace(/\\goto\{([\s\S]*?)\}/g, (m, inner) => {
                const merged = inner.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
                return `\\goto{${merged}}`;
            });
        };
        const html = md.render(normalizeMath(normalizeBibBlocks(normalizeGotoBlocks(contentToRender))));

        // 如果有 metadata，在内容前显示
        let metadataHtml = '';
        if (Object.keys(metadata).length > 0) {
            metadataHtml = this.renderMetadataSection(metadata);
        }

        render.innerHTML = `<article class="markdown-body">${metadataHtml}${html}</article>`;
        this.bindQaTitles(render);
        this.applyPendingQaTitle(render);
        this.applyQaCollapsedState(render);
        this.bindQaCollapsibles(render);
        this.bindMetadataCollapse(render);
        this.renderMath(render);
        // 确保 mermaid 使用当前主题配置
        this.initMermaid();
        this.highlightCodeBlocks(render);
        this.applyCitationRendering(render);
        this.applyBibliographyRendering(render);
        this.applyGroupByRendering(render);
        this.applyQueryRendering(render);
        this.applyJsonQueryRendering(render);
        this.adjustReferenceFont(render);
        this.updateMarkdownUndoButtonState();
        this.applyEditLockState();
    }

    renderMetadataSection(metadata) {
        if (!metadata || Object.keys(metadata).length === 0) {
            return '';
        }

        const entries = Object.entries(metadata).map(([key, value]) => {
            let displayValue = value;

            // 格式化值的显示
            if (Array.isArray(value)) {
                displayValue = value.join(', ');
            } else if (typeof value === 'object' && value !== null) {
                displayValue = JSON.stringify(value, null, 2);
            } else if (typeof value === 'boolean') {
                displayValue = value ? 'true' : 'false';
            } else if (value === null) {
                displayValue = 'null';
            }

            const escKey = this.escapeHtml(String(key));
            const escValue = this.escapeHtml(String(displayValue));

            return `<tr><td class="meta-key">${escKey}</td><td class="meta-value">${escValue}</td></tr>`;
        }).join('');

        return `
            <div class="markdown-metadata">
                <div class="metadata-header">
                    <i class="fas fa-chevron-down"></i>
                    <span>Metadata</span>
                </div>
                <table class="metadata-table">
                    <tbody>${entries}</tbody>
                </table>
            </div>
        `;
    }

    bindMetadataCollapse(renderRoot) {
        if (!renderRoot) return;
        const metadataEl = renderRoot.querySelector('.markdown-metadata');
        const headerEl = renderRoot.querySelector('.metadata-header');
        if (!metadataEl || !headerEl) return;

        // 读取折叠状态
        const storageKey = `metadataCollapsed_${this.currentMarkdownFile}`;
        const isCollapsed = localStorage.getItem(storageKey) === 'true';
        if (isCollapsed) {
            metadataEl.classList.add('collapsed');
        }

        // 绑定点击事件
        headerEl.addEventListener('click', () => {
            const collapsed = metadataEl.classList.toggle('collapsed');
            localStorage.setItem(storageKey, collapsed);
        });
    }

    renderCitationPlaceholder(dois = [], type = 'citep') {
        const list = [];
        const seen = new Set();
        (dois || []).forEach((d) => {
            const norm = this.normalizeDoiString(d);
            if (!norm || seen.has(norm)) return;
            seen.add(norm);
            list.push(norm);
        });
        const joiner = ', ';
        const label = list.length ? list.join(joiner) : 'citation';
        const cls = type === 'cite' ? 'citation-narrative' : 'citation-parenthetical';
        const escLabel = this.escapeHtml(label);
        const escDois = this.escapeHtml(list.join(','));
        return `<span class="citation-inline ${cls}" data-citation-type="${type}" data-citation-dois="${escDois}">[${escLabel}]</span>`;
    }

    renderGroupByPlaceholder(groups = '', fields = '') {
        const cleanGroups = String(groups || '').replace(/[\r\n]+/g, ' ').trim();
        const cleanFields = String(fields || '').replace(/[\r\n]+/g, ' ').trim();
        const escGroups = this.escapeAttr(cleanGroups);
        const escFields = this.escapeAttr(cleanFields);
        const groupLabel = cleanGroups || 'all';
        const title = `Groups: ${groupLabel}\nFields: ${cleanFields || '(none)'}`;
        const hint = cleanFields ? `await groupby (${groupLabel} → ${cleanFields})...` : `await groupby (${groupLabel})...`;
        return `<div class="groupby-inline" data-groupby-groups="${escGroups}" data-groupby-fields="${escFields}"><button class="bib-fetch-btn groupby-render-btn inline-syntax" type="button" title="${this.escapeAttr(title)}"><i class="fas fa-play"></i><span>${this.escapeHtml(hint)}</span></button></div>`;
    }

    renderQueryPlaceholder(groups = '', fields = '', value = '') {
        const cleanGroups = String(groups || '').replace(/[\r\n]+/g, ' ').trim();
        const cleanFields = String(fields || '').replace(/[\r\n]+/g, ' ').trim();
        const cleanValue = String(value || '').replace(/[\r\n]+/g, ' ').trim();
        const escGroups = this.escapeAttr(cleanGroups);
        const escFields = this.escapeAttr(cleanFields);
        const escValue = this.escapeAttr(cleanValue);
        const groupLabel = cleanGroups || 'all';
        const title = `Groups: ${groupLabel}\nFields: ${cleanFields || '(none)'}\nValue: ${cleanValue || '(none)'}`;
        const hint = `await query (${groupLabel} → ${cleanFields}${cleanValue ? ` = ${cleanValue}` : ''})...`;
        return `<div class="query-inline" data-query-groups="${escGroups}" data-query-fields="${escFields}" data-query-value="${escValue}"><button class="bib-fetch-btn query-render-btn inline-syntax" type="button" title="${this.escapeAttr(title)}"><i class="fas fa-play"></i><span>${this.escapeHtml(hint)}</span></button></div>`;
    }

    async applyCitationRendering(renderRoot) {
        if (!renderRoot) return;
        const spans = Array.from(renderRoot.querySelectorAll('.citation-inline'));
        if (!spans.length) return;

        // 创建进度跟踪器
        const tracker = (typeof this.createStatusProgressTracker === 'function')
            ? this.createStatusProgressTracker('Citation Rendering')
            : null;

        const total = spans.length;
        let completed = 0;

        if (tracker) {
            tracker.update(`Rendering citations (0/${total})`, 0);
        }

        await Promise.allSettled(spans.map(async (span, index) => {
            const type = span.dataset.citationType === 'cite' ? 'cite' : 'citep';
            const dois = (span.dataset.citationDois || '').split(',').map(d => d.trim()).filter(Boolean);
            if (!dois.length) {
                completed++;
                if (tracker) {
                    const progress = Math.round((completed / total) * 100);
                    tracker.update(`Rendering citations (${completed}/${total})`, progress);
                }
                return;
            }
            try {
                const text = await this.formatCitation(dois, type);
                const links = this.buildCitationLinks(text, dois);
                span.innerHTML = links;
                span.title = text;
                span.querySelectorAll('.citation-link').forEach((btn) => {
                    if (btn.dataset.bound === '1') return;
                    btn.dataset.bound = '1';
                    btn.addEventListener('click', async (e) => {
                        e.preventDefault();
                        const doi = btn.dataset.citationDoi || '';
                        if (!doi) return;
                        await this.openFileByCitationDoi(doi);
                    });
                });
            } catch (err) {
                console.warn('渲染引文失败:', err);
                span.textContent = `[${dois.join('; ')}]`;
                span.title = `渲染失败: ${err.message}`;
            } finally {
                completed++;
                if (tracker) {
                    const progress = Math.round((completed / total) * 100);
                    tracker.update(`Rendering citations (${completed}/${total})`, progress);
                }
            }
        }));

        // 完成后自动清除进度条（延迟800ms后消失）
        if (tracker) {
            tracker.finish(`Rendered ${total} citation(s)`, 800);
        }
    }

    async applyGroupByRendering(renderRoot) {
        if (!renderRoot) return;
        const blocks = Array.from(renderRoot.querySelectorAll('.groupby-inline'));
        if (!blocks.length) return;

        blocks.forEach((block) => {
            if (block.dataset.groupbyBound === '1') return;
            block.dataset.groupbyBound = '1';
            const btn = block.querySelector('.groupby-render-btn');
            if (btn) {
                btn.addEventListener('click', () => this.renderGroupByBlock(block));
            }
        });
    }

    async applyQueryRendering(renderRoot) {
        if (!renderRoot) return;
        const blocks = Array.from(renderRoot.querySelectorAll('.query-inline'));
        if (!blocks.length) return;
        blocks.forEach((block) => {
            if (block.dataset.queryBound === '1') return;
            block.dataset.queryBound = '1';
            const btn = block.querySelector('.query-render-btn');
            if (btn) {
                btn.addEventListener('click', () => this.renderQueryBlock(block));
            }
        });
    }

    parseGroupTokens(groupsRaw = '') {
        const raw = String(groupsRaw || '').trim();
        const tokens = raw.split(/[,，]+/).map(v => v.trim()).filter(Boolean);
        const useAll = !raw || raw.toLowerCase() === 'all';
        return { tokens, useAll };
    }

    getGroupsByTokens(tokens = [], useAll = false) {
        const groupsAll = (typeof this.getCurrentGroups === 'function') ? (this.getCurrentGroups() || []) : [];
        if (useAll || !tokens.length) return groupsAll;
        const lowerSet = new Set(tokens.map(t => t.toLowerCase()));
        return groupsAll.filter(g => lowerSet.has(String(g.name || '').toLowerCase())
            || lowerSet.has(String(g.id || '').toLowerCase()));
    }

    async queryDoisByFields({ groupsRaw = '', fieldsRaw = '', valueRaw = '' } = {}) {
        const { tokens, useAll } = this.parseGroupTokens(groupsRaw);
        const groups = this.getGroupsByTokens(tokens, useAll);
        const allowedBases = groups.length ? new Set(groups.flatMap(g => (g.files || []).map(String))) : null;
        const fields = String(fieldsRaw || '')
            .split(/[,，]+/)
            .map(v => v.trim())
            .filter(Boolean);
        const matchValue = String(valueRaw || '').trim().toLowerCase();
        if (!fields.length || !matchValue) {
            return { dois: [], total: 0, matched: 0 };
        }
        const view = this.currentJsonView || 'view1';
        const bases = Object.keys(this.fileMetaByBase || {}).filter((base) => {
            const entry = this.fileMetaByBase?.[base];
            const inView = !!(entry?.views && entry.views[view]);
            const inGroup = allowedBases ? allowedBases.has(base) : true;
            return inView && inGroup;
        });
        const dois = [];
        let matched = 0;
        const token = ++this.fileFilterComputeToken;
        const tracker = (typeof this.createStatusProgressTracker === 'function')
            ? this.createStatusProgressTracker('Query DOI')
            : null;
        if (tracker) tracker.update('Querying DOI (0%)', 0);

        let cursor = 0;
        const limit = Math.min(8, bases.length || 0) || 1;
        let processed = 0;
        const worker = async () => {
            while (cursor < bases.length) {
                const base = bases[cursor];
                cursor += 1;
                if (token !== this.fileFilterComputeToken) return;
                const path = this.getViewPathForBase(base, view);
                if (!path) continue;
                let data = this.tempDataCache[path];
                if (!data) {
                    try {
                        data = await this.readProjectFile(path);
                    } catch (_err) {
                        continue;
                    }
                }
                const doiRaw = data?.meta_info?.doi;
                const doi = doiRaw ? String(doiRaw).trim() : '';
                if (!doi) {
                    processed += 1;
                    continue;
                }
                const values = fields.flatMap((f) => this.getFieldValuesForFilter(data, f));
                const found = values.some(v => String(v).toLowerCase().includes(matchValue));
                if (found) {
                    matched += 1;
                    dois.push(doi);
                }
                processed += 1;
                if (tracker) {
                    const percent = bases.length ? Math.round((processed / bases.length) * 100) : 100;
                    tracker.update(`Querying DOI (${processed}/${bases.length})`, percent);
                }
            }
        };
        const workers = Array.from({ length: limit }, () => worker());
        await Promise.all(workers);
        if (tracker) tracker.finish('Query DOI done');
        return { dois, total: bases.length, matched };
    }

    async renderQueryBlock(block) {
        if (!block || block.dataset.queryRendered === '1') return;
        block.dataset.queryRendered = '1';
        const groupsRaw = (block.dataset.queryGroups || '').trim();
        const fieldsRaw = (block.dataset.queryFields || '').trim();
        const valueRaw = (block.dataset.queryValue || '').trim();
        const fields = fieldsRaw.split(/[,，]+/).map(v => v.trim()).filter(Boolean);
        if (!fields.length || !valueRaw) {
            block.innerHTML = '<div class="groupby-error">No fields/value specified for \\query{}{}{}.</div>';
            return;
        }
        block.innerHTML = '<div class="groupby-loading">Querying...</div>';
        const result = await this.queryDoisByFields({ groupsRaw, fieldsRaw, valueRaw });
        const dois = result?.dois || [];
        const list = dois.join('\n');
        const wrapper = document.createElement('div');
        wrapper.className = 'groupby-box';
        const header = document.createElement('div');
        header.className = 'groupby-header';
        const title = document.createElement('div');
        title.className = 'groupby-title';
        title.textContent = `Query (${dois.length} / ${result?.total || 0})`;
        const actions = document.createElement('div');
        actions.className = 'groupby-actions';
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'groupby-toggle-btn';
        toggleBtn.type = 'button';
        toggleBtn.setAttribute('aria-label', 'Collapse results');
        toggleBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
        const copyBtn = document.createElement('button');
        copyBtn.className = 'groupby-copy-btn';
        copyBtn.innerHTML = '<i class="fas fa-copy"></i><span>Copy DOI</span>';
        copyBtn.addEventListener('click', async () => {
            await this.writeTextToClipboard(list);
            this.flashCopyButton(copyBtn);
            this.showNotification('DOI list copied', 'success');
        });
        header.appendChild(toggleBtn);
        actions.appendChild(copyBtn);
        header.appendChild(title);
        header.appendChild(actions);
        wrapper.appendChild(header);
        const body = document.createElement('div');
        body.className = 'groupby-table';
        body.innerHTML = `<pre>${this.escapeHtml(list || '')}</pre>`;
        wrapper.appendChild(body);
        toggleBtn.addEventListener('click', () => {
            wrapper.classList.toggle('groupby-collapsed');
            const collapsed = wrapper.classList.contains('groupby-collapsed');
            toggleBtn.innerHTML = collapsed
                ? '<i class="fas fa-chevron-down"></i>'
                : '<i class="fas fa-chevron-up"></i>';
            toggleBtn.setAttribute('aria-label', collapsed ? 'Expand results' : 'Collapse results');
        });
        block.innerHTML = '';
        block.appendChild(wrapper);
    }

    async renderGroupByBlock(block) {
        if (!block || block.dataset.groupbyRendered === '1') return;
        block.dataset.groupbyRendered = '1';

        const groupsRaw = (block.dataset.groupbyGroups || '').trim();
        const fieldsRaw = (block.dataset.groupbyFields || '').trim();
        const fields = fieldsRaw.split(/[,，]+/).map(v => v.trim()).filter(Boolean);
        const groupTokens = groupsRaw.split(/[,，]+/).map(v => v.trim()).filter(Boolean);
        const useAllGroups = !groupsRaw || groupsRaw.toLowerCase() === 'all';
        const groupNames = useAllGroups ? null : groupTokens;

        if (!fields.length) {
            block.innerHTML = '<div class="groupby-error">No fields specified for \\groupby{}{}.</div>';
            return;
        }
        if (typeof this.groupByFields !== 'function') {
            block.innerHTML = '<div class="groupby-error">groupByFields() is unavailable.</div>';
            return;
        }

        block.innerHTML = '<div class="groupby-loading">Grouping...</div>';

        try {
            const result = await this.groupByFields({
                fields,
                groupNames,
                log: false,
                table: false,
                progress: true
            });
            if (!result) {
                block.innerHTML = '<div class="groupby-error">No data returned for groupby.</div>';
                return;
            }

            const tableData = this.buildGroupByTableData(result, fields);
            const mdTable = this.buildGroupByMarkdown(tableData.headers, tableData.rows);
            const csvTable = this.buildGroupByCsv(tableData.headers, tableData.rows);

            const wrapper = document.createElement('div');
            wrapper.className = 'groupby-box';

            const header = document.createElement('div');
            header.className = 'groupby-header';

            const actions = document.createElement('div');
            actions.className = 'groupby-actions';

            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'groupby-toggle-btn';
            toggleBtn.type = 'button';
            toggleBtn.setAttribute('aria-label', 'Collapse table');
            toggleBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
            header.appendChild(toggleBtn);

            const title = document.createElement('span');
            title.className = 'groupby-title';
            const groupLabel = result.groupLabel || (useAllGroups ? 'all' : groupTokens.join(','));
            title.textContent = `GroupBy: ${fields.join(', ')} (${groupLabel})`;
            header.appendChild(title);

            const mdBtn = document.createElement('button');
            mdBtn.className = 'groupby-copy-btn';
            mdBtn.type = 'button';
            mdBtn.innerHTML = '<i class="fas fa-copy"></i><span>Copy MD</span>';
            mdBtn.addEventListener('click', async () => {
                try {
                    await this.writeTextToClipboard(mdTable);
                    this.flashCopyButton(mdBtn);
                    this.showNotification('Markdown table copied', 'success');
                } catch (err) {
                    this.showNotification(`Copy failed: ${err.message}`, 'error');
                }
            });

            const csvBtn = document.createElement('button');
            csvBtn.className = 'groupby-copy-btn';
            csvBtn.type = 'button';
            csvBtn.innerHTML = '<i class="fas fa-file-csv"></i><span>Copy CSV</span>';
            csvBtn.addEventListener('click', async () => {
                try {
                    await this.writeTextToClipboard(csvTable);
                    this.flashCopyButton(csvBtn);
                    this.showNotification('CSV copied', 'success');
                } catch (err) {
                    this.showNotification(`Copy failed: ${err.message}`, 'error');
                }
            });

            actions.appendChild(mdBtn);
            actions.appendChild(csvBtn);
            header.appendChild(actions);
            wrapper.appendChild(header);

            const table = document.createElement('table');
            table.className = 'groupby-table';
            const thead = document.createElement('thead');
            const headRow = document.createElement('tr');
            tableData.headers.forEach((h) => {
                const th = document.createElement('th');
                th.textContent = h;
                headRow.appendChild(th);
            });
            thead.appendChild(headRow);
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            tableData.rows.forEach((row) => {
                const tr = document.createElement('tr');
                row.forEach((cell) => {
                    const td = document.createElement('td');
                    td.textContent = String(cell ?? '');
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);

            wrapper.appendChild(table);
            this.enableGroupByTableSort(table, tableData.headers, tableData.rows);
            this.enableGroupByTableResize(table);
            toggleBtn.addEventListener('click', () => {
                wrapper.classList.toggle('groupby-collapsed');
                const collapsed = wrapper.classList.contains('groupby-collapsed');
                toggleBtn.innerHTML = collapsed
                    ? '<i class="fas fa-chevron-down"></i>'
                    : '<i class="fas fa-chevron-up"></i>';
                toggleBtn.setAttribute('aria-label', collapsed ? 'Expand table' : 'Collapse table');
            });
            block.innerHTML = '';
            block.appendChild(wrapper);
        } catch (err) {
            console.warn('GroupBy render failed:', err);
            block.innerHTML = `<div class="groupby-error">GroupBy failed: ${this.escapeHtml(err.message || String(err))}</div>`;
        }
    }

    buildGroupByTableData(result, fields) {
        let headers = [];
        let rows = [];
        if (Array.isArray(result.groupedRows) && result.groupedRows.length) {
            headers = [...(result.groupedFields || fields), 'count'];
            rows = result.groupedRows.map((row) => headers.map(h => row[h] ?? ''));
        } else {
            const label = fields.length === 1 ? fields[0] : 'value';
            headers = [label, 'count'];
            rows = Object.keys(result.aggregated || {})
                .map(key => [key, result.aggregated[key]])
                .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0) || String(a[0]).localeCompare(String(b[0])));
        }

        if (rows.length) {
            const total = rows.reduce((sum, row) => sum + (Number(row[headers.length - 1]) || 0), 0);
            const totalRow = headers.map((_, idx) => {
                if (idx === headers.length - 1) return total;
                return idx === 0 ? 'TOTAL' : '';
            });
            rows.push(totalRow);
        }

        return { headers, rows };
    }

    buildGroupByMarkdown(headers, rows) {
        const safe = (val) => String(val ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
        const headLine = `| ${headers.map(safe).join(' | ')} |`;
        const sepLine = `| ${headers.map(() => '---').join(' | ')} |`;
        const body = rows.map(row => `| ${row.map(safe).join(' | ')} |`).join('\n');
        return [headLine, sepLine, body].filter(Boolean).join('\n');
    }

    buildGroupByCsv(headers, rows) {
        const delimiter = '\t';
        const lineBreak = '\r\n';
        const esc = (val) => {
            const text = String(val ?? '');
            if (/[\t"\r\n]/.test(text)) {
                return `"${text.replace(/"/g, '""')}"`;
            }
            return text;
        };
        const head = headers.map(esc).join(delimiter);
        const body = rows.map(row => row.map(esc).join(delimiter)).join(lineBreak);
        return [head, body].filter(Boolean).join(lineBreak);
    }

    enableGroupByTableResize(table) {
        if (!table) return;
        const headers = Array.from(table.querySelectorAll('th'));
        if (!headers.length) return;
        headers.forEach((th) => {
            if (th.querySelector('.groupby-col-resizer')) return;
            const resizer = document.createElement('div');
            resizer.className = 'groupby-col-resizer';
            th.appendChild(resizer);

            resizer.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const startX = e.clientX;
                const startWidth = th.getBoundingClientRect().width;

                const onMove = (evt) => {
                    const delta = evt.clientX - startX;
                    const next = Math.max(60, Math.round(startWidth + delta));
                    th.style.width = `${next}px`;
                };

                const onUp = () => {
                    document.body.style.cursor = '';
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                };

                document.body.style.cursor = 'col-resize';
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
        });
    }

    enableGroupByTableSort(table, headers, rows) {
        if (!table || !Array.isArray(headers) || !Array.isArray(rows)) return;
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');
        if (!thead || !tbody) return;
        const headCells = Array.from(thead.querySelectorAll('th'));
        if (!headCells.length) return;

        const originalRows = rows.map(row => row.slice());
        let sortState = { index: -1, dir: 'asc' };

        const renderRows = (nextRows) => {
            tbody.innerHTML = '';
            nextRows.forEach((row) => {
                const tr = document.createElement('tr');
                row.forEach((cell) => {
                    const td = document.createElement('td');
                    td.textContent = String(cell ?? '');
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
        };

        const getSortableValue = (value) => {
            const text = String(value ?? '').trim();
            const num = Number(text);
            return Number.isFinite(num) && text !== '' ? num : text.toLowerCase();
        };

        headCells.forEach((th, idx) => {
            th.classList.add('groupby-sortable');
            const label = headers[idx] || th.textContent || '';
            th.setAttribute('role', 'button');
            th.setAttribute('aria-label', `Sort by ${label}`);
            th.addEventListener('click', () => {
                const nextDir = (sortState.index === idx && sortState.dir === 'asc') ? 'desc' : 'asc';
                sortState = { index: idx, dir: nextDir };
                headCells.forEach((cell) => {
                    cell.classList.remove('is-sorted-asc', 'is-sorted-desc');
                });
                th.classList.add(nextDir === 'asc' ? 'is-sorted-asc' : 'is-sorted-desc');

                const totalRows = originalRows.filter(row => String(row[0] ?? '').toUpperCase() === 'TOTAL');
                const sortableRows = originalRows.filter(row => String(row[0] ?? '').toUpperCase() !== 'TOTAL');
                const sorted = sortableRows.slice().sort((a, b) => {
                    const va = getSortableValue(a[idx]);
                    const vb = getSortableValue(b[idx]);
                    if (va === vb) return 0;
                    if (typeof va === 'number' && typeof vb === 'number') {
                        return nextDir === 'asc' ? va - vb : vb - va;
                    }
                    if (typeof va === 'number') return nextDir === 'asc' ? -1 : 1;
                    if (typeof vb === 'number') return nextDir === 'asc' ? 1 : -1;
                    return nextDir === 'asc'
                        ? String(va).localeCompare(String(vb))
                        : String(vb).localeCompare(String(va));
                });
                renderRows(sorted.concat(totalRows));
            });
        });
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

    parseDoiListFromLatex(raw = '') {
        const normalized = (raw || '').replace(/[\r\n]+/g, ',');
        return normalized
            .split(/[,，;；\s]+/)
            .map(d => d.trim())
            .filter(Boolean)
            .map(d => this.normalizeDoiString(d))
            .filter(Boolean);
    }

    buildCitationLinks(text, dois = []) {
        const labels = (text || '').split(/;\s*/).filter(Boolean);
        const cleanDois = [];
        const seen = new Set();
        (dois || []).forEach((doi) => {
            const norm = this.normalizeDoiString(doi);
            if (!norm || seen.has(norm)) return;
            seen.add(norm);
            cleanDois.push(norm);
        });
        const useLabels = labels.length === cleanDois.length && labels.length > 0;
        const parts = [];
        cleanDois.forEach((doi, idx) => {
            const labelText = useLabels ? labels[idx] : (this.normalizeDoiString(doi) || 'citation');
            const label = this.escapeHtml(labelText);
            const escDoi = this.escapeAttr(doi);
            parts.push(`<button class="citation-link" type="button" data-citation-doi="${escDoi}" title="Open PDF for ${this.escapeAttr(doi)}">${label}</button>`);
        });
        return parts.join('; ');
    }

    async openFileByCitationDoi(rawDoi = '') {
        const doi = this.normalizeDoiString(rawDoi);
        if (!doi) {
            this.showNotification('Invalid DOI', 'warning');
            return;
        }
        const base = await this.findFileBaseByDoi(doi);
        if (!base) {
            this.showNotification(`No matching file for DOI: ${doi}`, 'warning');
            return;
        }
        await this.loadFile(base);
        const tryScroll = () => {
            const el = this.scrollFileIntoView(base, { align: 'center' });
            if (!el) {
                requestAnimationFrame(() => this.scrollFileIntoView(base, { align: 'center' }));
            }
        };
        tryScroll();

        // Only load PDF if the right panel is already expanded
        const rightPanel = document.querySelector('.right-panel');
        if (rightPanel && !rightPanel.classList.contains('panel-collapsed')) {
            await this.ensurePdfLoaded();
        }
    }

    async findFileBaseByDoi(rawDoi = '') {
        const doi = (rawDoi || '').trim().toLowerCase();
        if (!doi) return null;
        const index = await this.buildDoiIndex();
        if (!index) return null;
        const keys = this.getDoiKeyVariants(doi);
        for (const key of keys) {
            const hit = index.get(key);
            if (hit) return hit;
        }
        return null;
    }

    async buildDoiIndex() {
        if (this._doiIndex) return this._doiIndex;
        if (this._doiIndexBuilding) return this._doiIndexBuilding;
        this._doiIndexBuilding = (async () => {
            const index = new Map();
            if (!this.fileMetaByBase || !Object.keys(this.fileMetaByBase).length) {
                try {
                    await this.loadFileBasesFromServer();
                } catch (_err) {
                    // ignore and continue with whatever is available
                }
            }
            const bases = Object.keys(this.fileMetaByBase || {});
            const view = this.currentJsonView || 'view1';
            for (const base of bases) {
                let data = null;
                if (this.currentFileBase === base && this.currentData) {
                    data = this.currentData;
                } else {
                    const paths = [];
                    const primary = this.getViewPathForBase(base, view);
                    if (primary) paths.push(primary);
                    this.getAllJsonPathsForBase(base).forEach((p) => {
                        if (p && !paths.includes(p)) paths.push(p);
                    });
                    for (const path of paths) {
                        try {
                            const loaded = await this.readProjectFile(path);
                            if (loaded) {
                                data = loaded;
                                break;
                            }
                        } catch (err) {
                            continue;
                        }
                    }
                }
                if (!data) continue;
                const doiRaw = (data.meta_info && data.meta_info.doi) || this.findFirstDoiInData(data) || '';
                if (!doiRaw) continue;
                this.getDoiKeyVariants(doiRaw).forEach((key) => {
                    if (!index.has(key)) index.set(key, base);
                });
            }
            this._doiIndex = index;
            this._doiIndexBuilding = null;
            return index;
        })();
        return this._doiIndexBuilding;
    }

    async formatCitation(dois = [], mode = 'citep') {
        const clean = [];
        const seen = new Set();
        (dois || []).forEach((d) => {
            const norm = this.normalizeDoiString(d);
            if (!norm || seen.has(norm)) return;
            seen.add(norm);
            clean.push(norm);
        });
        const key = `${mode}:${clean.slice().sort().join(',')}`;

        // 优先从项目存储加载元数据
        let storedMeta = {};
        if (this.projectStorage && this.currentProject) {
            storedMeta = await this.loadCitationMetaAsync() || {};
        } else {
            storedMeta = this.loadCitationMetaFromStorage();
        }

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
            if (!Cite) throw new Error('citation-js not loaded');
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

        // 提取 \cite{} 和 \citep{} 中的 DOI (仅支持 LaTeX 格式)
        const citeRe = /\\citep?\{([\s\S]+?)\}/g;
        let m;
        while ((m = citeRe.exec(text)) !== null) {
            const inside = m[1] || '';
            this.parseDoiListFromLatex(inside).forEach(d => dois.add(d));
        }

        // 提取 \bib{} 中的 DOI (仅支持 LaTeX 格式)
        const bibRe = /\\bib\{([\s\S]+?)\}/g;
        while ((m = bibRe.exec(text)) !== null) {
            const inside = m[1] || '';
            this.parseDoiListFromLatex(inside).forEach(d => dois.add(d));
        }

        // 提取裸 DOI
        const doiRe = /10\.\d{4,9}[^\s"'\)>\]},;{]+/gi;
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

        // 优先从项目存储加载
        let stored = {};
        if (this.projectStorage && this.currentProject) {
            stored = await this.loadCitationMetaAsync() || {};
        } else {
            stored = this.loadCitationMetaFromStorage();
        }

        for (const doi of clean) {
            // 检查内存缓存
            if (this.hasUsefulMeta(this.citationMetaCache[doi])) {
                items.push(this.citationMetaCache[doi]);
                continue;
            }
            // 检查存储缓存
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
        // 优先使用项目存储
        if (this.projectStorage && this.currentProject) {
            // 返回 Promise 但这个方法应该是同步的，暂时返回空对象，异步加载
            return {};
        }

        // 回退到 localStorage
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

    async loadCitationMetaAsync() {
        if (this.projectStorage && this.currentProject) {
            try {
                const data = await this.projectStorage.load('citation-meta');
                return data || {};
            } catch (error) {
                console.warn('Failed to load citation meta from project storage:', error);
                return this.loadCitationMetaFromStorage();
            }
        }
        return this.loadCitationMetaFromStorage();
    }

    saveCitationMetaToStorage(data = {}) {
        // 优先保存到项目存储
        if (this.projectStorage && this.currentProject) {
            this.projectStorage.update('citation-meta', data);
            return;
        }

        // 回退到 localStorage
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

    async clearCitationCache(showToast = true) {
        this.citationCache = {};
        this.citationMetaCache = {};

        // 清除项目存储
        if (this.projectStorage && this.currentProject) {
            try {
                await this.projectStorage.delete('citation-meta');
            } catch (error) {
                console.warn('Failed to clear project citation cache:', error);
            }
        }

        // 清除 localStorage
        try {
            localStorage.removeItem(this.citationMetaStoreKey);
        } catch (_e) {
            // ignore
        }

        if (showToast) {
            this.showNotification('Citation cache and local metadata cleared', 'success');
        }
    }

    async clearCurrentMarkdownCitationCache() {
        const source = this.isMarkdownEditing
            ? (document.getElementById('markdownTextarea')?.value || '')
            : (this.currentMarkdownText || '');
        if (!source) {
            this.showNotification('No Markdown content to clear', 'info');
            return;
        }
        const dois = this.extractDoisFromMarkdown(source);
        if (!dois.length) {
            this.showNotification('No DOI found in current document', 'info');
            return;
        }
        const set = new Set(dois.map(d => this.normalizeDoiString(d)));

        // 清除内存缓存
        Object.keys(this.citationCache || {}).forEach((k) => {
            const parts = k.split(':')[1] || '';
            const list = (parts.split(',') || []).map(x => x.trim());
            if (list.some(d => set.has(d))) {
                delete this.citationCache[k];
            }
        });
        Object.keys(this.citationMetaCache || {}).forEach((doi) => {
            if (set.has(doi)) delete this.citationMetaCache[doi];
        });

        // 清除项目存储
        if (this.projectStorage && this.currentProject) {
            try {
                const stored = await this.projectStorage.load('citation-meta') || {};
                let touched = false;
                Object.keys(stored).forEach((doi) => {
                    if (set.has(doi)) {
                        delete stored[doi];
                        touched = true;
                    }
                });
                if (touched) {
                    await this.projectStorage.save('citation-meta', stored);
                }
            } catch (error) {
                console.warn('Failed to clear project storage:', error);
            }
        } else {
            // 回退到 localStorage
            const stored = this.loadCitationMetaFromStorage();
            let touched = false;
            Object.keys(stored).forEach((doi) => {
                if (set.has(doi)) {
                    delete stored[doi];
                    touched = true;
                }
            });
            if (touched) this.saveCitationMetaToStorage(stored);
        }

        this.showNotification(`Cleared ${dois.length} DOI cache from current document`, 'success');

        // 强制重新渲染当前 Markdown 以触发 cite{}/citep{} 重新查询
        if (this.currentView === 'markdown' && this.currentMarkdownText) {
            await this.renderMarkdownView(this.currentMarkdownText);
        }
    }

    async clearAllProjectCitationCache() {
        if (!this.currentProject) {
            this.showNotification('No project loaded', 'info');
            return;
        }

        try {
            // 获取项目下所有 md 文件
            const response = await fetch('/list-files', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectPath: this.currentProject.path,
                    subDir: 'md'
                })
            });

            if (!response.ok) {
                throw new Error('Failed to list files');
            }

            const result = await response.json();
            const mdFiles = (result.files || []).filter(f => f.toLowerCase().endsWith('.md'));

            if (!mdFiles.length) {
                this.showNotification('No Markdown files found in project', 'info');
                return;
            }

            // 收集所有 md 文件中的 DOI
            const allDois = new Set();
            for (const file of mdFiles) {
                try {
                    const fileResponse = await fetch('/read-file', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            projectPath: this.currentProject.path,
                            filePath: `md/${file}`
                        })
                    });

                    if (fileResponse.ok) {
                        const content = await fileResponse.text();
                        const dois = this.extractDoisFromMarkdown(content);
                        dois.forEach(doi => allDois.add(this.normalizeDoiString(doi)));
                    }
                } catch (error) {
                    console.warn(`Failed to read ${file}:`, error);
                }
            }

            if (!allDois.size) {
                this.showNotification('No DOI found in project Markdown files', 'info');
                return;
            }

            // 清除缓存
            Object.keys(this.citationCache || {}).forEach((k) => {
                const parts = k.split(':')[1] || '';
                const list = (parts.split(',') || []).map(x => x.trim());
                if (list.some(d => allDois.has(d))) {
                    delete this.citationCache[k];
                }
            });
            Object.keys(this.citationMetaCache || {}).forEach((doi) => {
                if (allDois.has(doi)) delete this.citationMetaCache[doi];
            });

            // 清除项目存储
            if (this.projectStorage) {
                const stored = await this.projectStorage.load('citation-meta') || {};
                let touched = false;
                Object.keys(stored).forEach((doi) => {
                    if (allDois.has(doi)) {
                        delete stored[doi];
                        touched = true;
                    }
                });
                if (touched) {
                    await this.projectStorage.save('citation-meta', stored);
                }
            } else {
                const stored = this.loadCitationMetaFromStorage();
                let touched = false;
                Object.keys(stored).forEach((doi) => {
                    if (allDois.has(doi)) {
                        delete stored[doi];
                        touched = true;
                    }
                });
                if (touched) this.saveCitationMetaToStorage(stored);
            }

            this.showNotification(`Cleared ${allDois.size} DOI cache from ${mdFiles.length} files`, 'success');

            // 强制重新渲染当前 Markdown 以触发 cite{}/citep{} 重新查询
            if (this.currentView === 'markdown' && this.currentMarkdownText) {
                await this.renderMarkdownView(this.currentMarkdownText);
            }
        } catch (error) {
            console.error('Failed to clear all project cache:', error);
            this.showNotification(`Failed to clear cache: ${error.message}`, 'error');
        }
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
            this.showNotification('No Markdown content available', 'info');

            return;
        }
        const dois = this.extractDoisFromMarkdown(source);
        if (!dois.length) {
            this.showNotification('No DOIs found in Markdown', 'info');
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
            this.showNotification(`References generated (${dois.length} items)`, 'success');
        } catch (err) {
            console.error('Failed to generate references:', err);
            this.showNotification(`Failed to generate references: ${err.message}`, 'error');
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
            const mdFilename = this.getActiveMarkdownFilename();
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

    normalizeCitationBlocks(text = '') {
        if (!text) return text;
        return text.replace(/\\citep?\{[\s\S]*?\}/g, (match) => {
            const start = match.indexOf('{');
            if (start < 0) return match;
            const inside = match.slice(start + 1, -1);
            const list = this.parseDoiListFromLatex(inside);
            if (!list.length) return match;
            const cmd = match.startsWith('\\citep') ? '\\citep' : '\\cite';
            return `${cmd}{${list.join(',')}}`;
        });
    }

    async saveCurrentMarkdownSilently() {
        if (!this.currentMarkdownExists) return;
        const textarea = document.getElementById('markdownTextarea');
        let content = (this.isMarkdownEditing && textarea) ? textarea.value : (this.currentMarkdownText || '');
        content = this.normalizeCitationBlocks(content);
        if (textarea && this.isMarkdownEditing) {
            textarea.value = content;
        }
        const mdFilename = this.getActiveMarkdownFilename();
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
        if (this.isDraftViewActive) {
            await this.loadDraftMarkdownFile();
            return;
        }
        if (!this.currentFile) return;
        const mdFilename = this.getMarkdownFilename(this.currentFile);
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
            this.showNotification(`Failed to create Markdown: ${err.message}`, 'error');
        }
    }

    async deleteCurrentMarkdownFile() {
        if (!this.currentMarkdownExists) {
            this.showNotification('No markdown file to delete', 'info');
            return;
        }

        const mdFilename = this.getActiveMarkdownFilename();
        const confirmed = window.confirm(`Delete markdown file "${mdFilename}"?\nThis action cannot be undone.`);
        if (!confirmed) return;

        const projectPath = this.getRequiredProjectPath();
        if (!projectPath) return;
        try {
            const resp = await fetch('/delete-json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectPath,
                    filename: mdFilename
                })
            });

            if (!resp.ok) {
                const text = await resp.text();
                throw new Error(text || 'Delete failed');
            }

            // 清空状态
            this.currentMarkdownExists = false;
            this.currentMarkdownFile = null;
            this.currentMarkdownText = '';
            this.currentMarkdownBaselineText = '';
            this.isMarkdownEditing = false;
            this.hasUnsavedMarkdownChanges = false;

            // 清空显示
            this.renderMarkdownView('');
            const textarea = document.getElementById('markdownTextarea');
            if (textarea) textarea.value = '';

            this.updateMarkdownToolbar();
            this.updateMarkdownDirtyUI();
            this.showNotification(`Deleted: ${mdFilename}`, 'success');
        } catch (err) {
            console.error('Failed to delete Markdown:', err);
            this.showNotification(`Failed to delete: ${err.message}`, 'error');
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
            const mdFilename = this.getActiveMarkdownFilename();
            const shouldSave = confirm(`Markdown "${mdFilename}" 有未保存的修改，是否保存？`);
            if (shouldSave) {
                this.saveMarkdownFromEditor();
                return;
            }
        }
        this.isMarkdownEditing = editing;
        this.setMarkdownEditPreference(this.isDraftViewActive, editing);
        const textarea = document.getElementById('markdownTextarea');
        if (textarea) {
            if (editing) {
                const fallback = this.isDraftViewActive ? '' : this.buildDefaultMarkdown();
                textarea.value = this.currentMarkdownText || fallback;
                this.onMarkdownEditorInput();
            } else {
                // 退出编辑时同步当前文本到内存，便于渲染新内容
                const normalized = this.normalizeCitationBlocks(textarea.value);
                this.currentMarkdownText = normalized;
                if (normalized !== textarea.value) {
                    textarea.value = normalized;
                }
            }
        }
        if (!editing && (this.currentView || 'structured') === 'markdown') {
            this.renderMarkdownView(this.currentMarkdownText || '');
        }
        this.updateMarkdownToolbar();
        this.updateMarkdownDirtyUI();
    }

    async saveMarkdownFromEditor() {
        const textarea = document.getElementById('markdownTextarea');
        if (!textarea) return;
        let content = textarea.value;
        content = this.normalizeCitationBlocks(content);
        if (content !== textarea.value) {
            textarea.value = content;
        }
        if (!this.isDraftViewActive && !this.currentFile && !this.currentMarkdownFile) return;
        const mdFilename = this.getActiveMarkdownFilename();
        if (!mdFilename) return;
        try {
            await this.persistMarkdown(mdFilename, content);
            this.currentMarkdownText = content;
            this.currentMarkdownBaselineText = content;
            this.currentMarkdownExists = true;
            this.hasUnsavedMarkdownChanges = false;
            if (this.isMarkdownEditing) {
                this.updateMarkdownToolbar();
                this.updateMarkdownDirtyUI();
                this.showNotification(`Markdown saved: ${mdFilename}`, 'success');
                return;
            }
            this.renderMarkdownView(content);
            this.showNotification(`Markdown saved: ${mdFilename}`, 'success');
        } catch (err) {
            console.error('Failed to save Markdown:', err);
            this.showNotification(`Failed to save Markdown: ${err.message}`, 'error');
        }
    }

    highlightCodeBlocks(container) {
        try {
            if (!container) return;

            // 处理 mermaid 代码块
            if (window.mermaid) {
                const mermaidBlocks = container.querySelectorAll('pre code.language-mermaid');
                const processedCount = { value: 0 };
                const totalBlocks = mermaidBlocks.length;

                mermaidBlocks.forEach((block, index) => {
                    const pre = block.closest('pre');
                    if (!pre || pre.classList.contains('mermaid-rendered')) return;

                    // 创建 mermaid 容器包裹器
                    const wrapper = document.createElement('div');
                    wrapper.className = 'mermaid-container';

                    // 创建 mermaid div
                    const mermaidDiv = document.createElement('div');
                    mermaidDiv.className = 'mermaid';
                    const mermaidCode = block.textContent;
                    mermaidDiv.textContent = mermaidCode;
                    mermaidDiv.dataset.zoom = '1';
                    // 保存原始代码以便主题切换时重新渲染
                    mermaidDiv.setAttribute('data-mermaid-code', mermaidCode);
                    // 添加唯一 ID 用于渲染
                    mermaidDiv.id = `mermaid-${Date.now()}-${index}`;

                    // 创建缩放控制
                    const controls = document.createElement('div');
                    controls.className = 'mermaid-zoom-controls';
                    controls.innerHTML = `
                        <button class="mermaid-zoom-btn" data-action="zoom-out" title="缩小">−</button>
                        <div class="mermaid-zoom-level">100%</div>
                        <button class="mermaid-zoom-btn" data-action="zoom-in" title="放大">+</button>
                        <button class="mermaid-zoom-btn" data-action="zoom-reset" title="重置">⟲</button>
                    `;

                    // 组装结构
                    wrapper.appendChild(mermaidDiv);
                    wrapper.appendChild(controls);

                    // 添加缩放事件
                    this.attachMermaidZoomHandlers(wrapper, mermaidDiv);

                    // 替换 pre
                    pre.replaceWith(wrapper);
                });

                // 使用 run() 方法渲染所有 mermaid 图表（更可靠）
                try {
                    const mermaidElements = container.querySelectorAll('.mermaid:not([data-processed])');
                    if (mermaidElements.length > 0) {
                        // 使用 run 方法（mermaid v9+）或回退到 init
                        if (typeof window.mermaid.run === 'function') {
                            window.mermaid.run({ nodes: mermaidElements });
                        } else {
                            window.mermaid.init(undefined, mermaidElements);
                        }
                    }
                } catch (mermaidErr) {
                    console.warn('Mermaid rendering failed:', mermaidErr);
                }
            }

            // 处理其他代码块的高亮
            if (window.hljs) {
                container.querySelectorAll('pre code').forEach((block) => {
                    // 跳过 mermaid 代码块
                    if (block.classList.contains('language-mermaid')) return;

                    window.hljs.highlightElement(block);
                    this.injectCopyButton(block);
                });
            }
        } catch (err) {
            console.warn('Highlight failed:', err);
        }
    }

    attachMermaidZoomHandlers(wrapper, mermaidDiv) {
        const zoomLevelEl = wrapper.querySelector('.mermaid-zoom-level');
        const controls = wrapper.querySelector('.mermaid-zoom-controls');

        const updateZoom = (zoom) => {
            zoom = Math.max(0.5, Math.min(3, zoom)); // 限制在 50% - 300%
            mermaidDiv.dataset.zoom = zoom;
            mermaidDiv.style.transform = `scale(${zoom})`;
            zoomLevelEl.textContent = Math.round(zoom * 100) + '%';
        };

        controls.addEventListener('click', (e) => {
            const btn = e.target.closest('.mermaid-zoom-btn');
            if (!btn) return;

            e.preventDefault();
            e.stopPropagation();

            const action = btn.dataset.action;
            let currentZoom = parseFloat(mermaidDiv.dataset.zoom) || 1;

            if (action === 'zoom-in') {
                updateZoom(currentZoom + 0.1);
            } else if (action === 'zoom-out') {
                updateZoom(currentZoom - 0.1);
            } else if (action === 'zoom-reset') {
                updateZoom(1);
            }
        });

        // 滚轮缩放
        wrapper.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                const currentZoom = parseFloat(mermaidDiv.dataset.zoom) || 1;
                updateZoom(currentZoom + delta);
            }
        }, { passive: false });
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
                this.showNotification('Failed to copy code', 'error');
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
        const requestedView = String(nextView || '').trim();
        if (!requestedView) return;
        if (this.isSwitchingView) {
            this.pendingViewSwitch = { view: requestedView, btn };
            return;
        }
        this.isSwitchingView = true;
        let switchError = null;
        try {
            const isDraftRequested = requestedView === 'draft';
            const viewName = isDraftRequested ? 'markdown' : requestedView;
            const prevView = this.currentView || 'structured';
            const wasDraft = this.isDraftViewActive;
            const shouldPromptDraft = wasDraft && !isDraftRequested;
            const shouldPromptFileMd = !wasDraft && isDraftRequested;
            // 离开 Markdown 视图时：若有未保存修改，提示保存；并退出编辑态，避免 UI/按钮残留
            if (prevView === 'markdown' && viewName !== 'markdown') {
                if (this.hasUnsavedMarkdownChanges && this.currentMarkdownExists) {
                    const mdFilename = this.getActiveMarkdownFilename(wasDraft);
                    const shouldSave = confirm(`Markdown "${mdFilename}" 有未保存的修改，是否保存？`);
                    try {
                        if (shouldSave) {
                            await this.saveCurrentMarkdownSilently();
                        } else {
                            this.discardCurrentMarkdownChanges();
                        }
                    } catch (err) {
                        this.showNotification(`Failed to save Markdown: ${err.message}`, 'error');
                    }
                } else if (this.isMarkdownEditing) {
                    this.isMarkdownEditing = false;
                    this.updateMarkdownToolbar();
                }
            }
            if (prevView === 'markdown' && viewName === 'markdown' && shouldPromptFileMd && this.hasUnsavedMarkdownChanges && this.currentMarkdownExists) {
                const mdFilename = this.getActiveMarkdownFilename(false);
                const shouldSave = confirm(`Markdown "${mdFilename}" 有未保存的修改，是否保存？`);
                try {
                    if (shouldSave) {
                        await this.saveCurrentMarkdownSilently();
                    } else {
                        this.discardCurrentMarkdownChanges();
                    }
                } catch (err) {
                    this.showNotification(`Failed to save Markdown: ${err.message}`, 'error');
                }
            }
            if (prevView === 'markdown' && viewName === 'markdown' && shouldPromptDraft && this.hasUnsavedMarkdownChanges && this.currentMarkdownExists) {
                const mdFilename = this.getActiveMarkdownFilename(true);
                const shouldSave = confirm(`Markdown "${mdFilename}" 有未保存的修改，是否保存？`);
                try {
                    if (shouldSave) {
                        await this.saveCurrentMarkdownSilently();
                    } else {
                        this.discardCurrentMarkdownChanges();
                    }
                } catch (err) {
                    this.showNotification(`Failed to save Markdown: ${err.message}`, 'error');
                }
            }

            // 在 Markdown 视图内再次点击 Markdown tab：强制从编辑态切回渲染态并渲染最新内容
            if (prevView === 'markdown' && viewName === 'markdown' && !isDraftRequested && !wasDraft) {
                if (this.currentMarkdownExists) {
                    const textarea = document.getElementById('markdownTextarea');
                    const content = (this.isMarkdownEditing && textarea) ? textarea.value : (this.currentMarkdownText || '');
                    this.currentMarkdownText = content;
                    this.hasUnsavedMarkdownChanges = content !== (this.currentMarkdownBaselineText || '');
                    const preferEditing = this.getMarkdownEditPreference(false);
                    if (this.isMarkdownEditing && !preferEditing) {
                        this.toggleMarkdownEdit(false, { skipConfirm: true });
                    }
                    this.renderMarkdownView(content);
                }
            }

            // Switch views
            const view = viewName;
            this.currentView = view;
            try {
                localStorage.setItem('lastViewMode', isDraftRequested ? 'draft' : view);
            } catch (_e) { }
            this.updateUiPreferences({ lastViewMode: isDraftRequested ? 'draft' : view });
            await this.saveUiPreferencesNow();
            const structured = document.getElementById('structuredView');
            const markdown = document.getElementById('markdownView');
            const flat = document.getElementById('flatView');
            const settings = document.getElementById('settingsView');
            if (structured) structured.classList.remove('active');
            if (markdown) markdown.classList.remove('active');
            if (flat) flat.classList.remove('active');
            if (settings) settings.classList.remove('active');

            if (view === 'structured' && structured) {
                structured.classList.add('active');
            } else if (view === 'markdown' && markdown) {
                markdown.classList.add('active');
            } else if (view === 'flat' && flat) {
                flat.classList.add('active');
            } else if (view === 'settings' && settings) {
                settings.classList.add('active');
            }

            this.updateHeaderControls();
            this.updateMarkdownToolbar();
            this.updateMarkdownDirtyUI();
            this.updateJsonMenuState();
            this.updateMarkdownMenuState();

            // 切换到 Markdown 视图时，确保渲染区域为最新内容（尤其是从编辑态进入）
            if (isDraftRequested) {
                if (!wasDraft) {
                    this.cacheFileMarkdownState();
                } else {
                    this.cacheDraftMarkdownState();
                }
                this.isDraftViewActive = true;
                await this.loadDraftMarkdownFile();
            } else if (wasDraft) {
                this.cacheDraftMarkdownState();
                this.isDraftViewActive = false;
                const expectedMd = this.currentFile ? this.getMarkdownFilename(this.currentFile) : '';
                if (this.fileMarkdownState && this.fileMarkdownState.file === expectedMd) {
                    this.applyMarkdownState(this.fileMarkdownState, { render: view === 'markdown' });
                } else if (view === 'markdown') {
                    await this.loadMarkdownForCurrentFile();
                }
            } else {
                this.isDraftViewActive = false;
            }

            if (!this.isDraftViewActive && view === 'markdown' && this.currentFile) {
                const expectedMd = this.getMarkdownFilename(this.currentFile);
                if (this.currentMarkdownFile !== expectedMd) {
                    await this.loadMarkdownForCurrentFile();
                }
            }

            if (view === 'markdown' && this.currentMarkdownExists && !isDraftRequested) {
                const textarea = document.getElementById('markdownTextarea');
                const content = (this.isMarkdownEditing && textarea) ? textarea.value : (this.currentMarkdownText || '');
                const preferEditing = this.getMarkdownEditPreference(false);
                if (this.isMarkdownEditing && !preferEditing) {
                    this.currentMarkdownText = content;
                    this.hasUnsavedMarkdownChanges = content !== (this.currentMarkdownBaselineText || '');
                    this.toggleMarkdownEdit(false, { skipConfirm: true });
                }
                this.renderMarkdownView(content);
                this.updateMarkdownToolbar();
                this.updateMarkdownDirtyUI();
            }
            this.updateViewTabs();
            this.applyEditLockState();
        } catch (err) {
            switchError = err;
        } finally {
            this.isSwitchingView = false;
        }
        const pending = this.pendingViewSwitch;
        this.pendingViewSwitch = null;
        if (pending && pending.view && pending.view !== requestedView) {
            await this.setView(pending.view, pending.btn);
        }
        if (switchError) throw switchError;
    }

    async applyCurrentView() {
        const view = this.currentView || 'structured';
        if (view === 'markdown' && this.isDraftViewActive) {
            await this.switchToView('draft');
            return;
        }
        await this.switchToView(view);
    }

    toggleTableMarkdownView(reverse = false) {
        const tabs = Array.from(document.querySelectorAll('#middleViewTabs .tab-btn'));
        const order = tabs.map(tab => tab.dataset.view).filter(v => v && v !== 'settings');
        const fallbackOrder = ['structured', 'markdown', 'draft'];
        const sequence = order.length ? order : fallbackOrder;
        
        // 如果当前在 settings 视图，默认跳到 draft
        if (this.currentView === 'settings') {
            this.switchToView('draft');
            return;
        }
        
        let currentKey = 'structured';
        if ((this.currentView || 'structured') === 'markdown') {
            currentKey = this.isDraftViewActive ? 'draft' : 'markdown';
        } else if (this.currentView === 'structured') {
            currentKey = 'structured';
        }
        let idx = sequence.indexOf(currentKey);
        if (idx < 0) idx = 0;
        const step = reverse ? -1 : 1;
        const nextView = sequence[(idx + step + sequence.length) % sequence.length];
        this.switchToView(nextView);
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

    getJsonNodeByPath(pathStr) {
        if (!pathStr) return this.currentData;
        const parts = String(pathStr).split('.').filter(Boolean);
        let current = this.currentData;
        for (const part of parts) {
            if (current === null || current === undefined) return null;
            if (Array.isArray(current)) {
                const idx = Number(part);
                if (!Number.isInteger(idx) || idx < 0 || idx >= current.length) {
                    return null;
                }
                current = current[idx];
                continue;
            }
            if (typeof current !== 'object') return null;
            if (!Object.prototype.hasOwnProperty.call(current, part)) {
                return null;
            }
            current = current[part];
        }
        return current;
    }

    getJsonPathAutocompleteSuggestions(context) {
        if (!context || !this.currentData) return [];
        const basePath = context.basePath || '';
        const prefix = context.prefix || '';
        const node = this.getJsonNodeByPath(basePath);
        if (!node || (typeof node !== 'object')) return [];

        let keys = [];
        if (Array.isArray(node)) {
            keys = node.map((_, idx) => String(idx));
        } else {
            keys = Object.keys(node);
        }

        const prefixLower = prefix.toLowerCase();
        const filtered = keys.filter((key) => key.toLowerCase().startsWith(prefixLower));
        return filtered.map((key) => {
            const fullPath = basePath ? `${basePath}.${key}` : key;
            return {
                label: key,
                insertText: key,
                detail: fullPath
            };
        });
    }

    /**
     * DOI 自动补全建议
     * 使用缓存管理器提供高效的 DOI 补全
     * 支持在 doi, title, authors, year 四个字段中进行模糊匹配
     */
    getDoiAutocompleteSuggestions(context) {
        if (!context) return [];

        // 如果缓存管理器未初始化，返回空列表
        if (!this.doiCacheManager) {
            console.warn('DOI Cache Manager not initialized');
            return [];
        }

        const searchText = (context.searchText || '').trim();

        // 使用异步方式搜索（立即返回空数组，通过回调更新）
        // 注意：这里我们需要同步返回，所以使用缓存的内存数据
        const cacheData = this.doiCacheManager.memoryCache;

        if (!cacheData || cacheData.length === 0) {
            // 如果缓存为空，触发异步构建（不阻塞当前调用）
            this.doiCacheManager.getCacheData().then(() => {
                // 缓存构建完成后，可以触发 UI 更新
                console.log('DOI cache built');
            }).catch(err => {
                console.error('Failed to build DOI cache:', err);
            });
            return [];
        }

        // 多条件组合查询：用空格分隔多个关键词
        // 例如：'2023 li the' 表示必须同时包含 2023、li 和 the
        const keywords = searchText
            .toLowerCase()
            .split(/\s+/)  // 按空格分割
            .map(k => k.trim())
            .filter(k => k.length > 0);  // 过滤空关键词

        // 多条件匹配：所有关键词都必须在某个字段中出现（AND 逻辑）
        const matches = cacheData.filter(item => {
            if (keywords.length === 0) return true;

            // 合并所有可搜索字段为一个字符串
            const searchableText = [
                item.doi.toLowerCase(),
                item.title.toLowerCase(),
                item.authors.toLowerCase(),
                item.year.toLowerCase()
            ].join(' ');

            // 所有关键词都必须出现在搜索文本中
            return keywords.every(keyword => searchableText.includes(keyword));
        });

        // 返回增强的建议列表
        // 格式：{ label, insertText, detail, year, authorDisplay, title }
        return matches.slice(0, 20).map(item => {
            // 构建显示详情
            const yearPart = item.year ? `(${item.year})` : '';
            const authorYearDisplay = item.authorDisplay && item.year
                ? `${item.authorDisplay} ${yearPart}`
                : (item.authorDisplay || yearPart);

            return {
                label: item.doi,
                insertText: item.doi,
                detail: authorYearDisplay || 'DOI',
                title: item.title ? item.title.substring(0, 80) + (item.title.length > 80 ? '...' : '') : '',
                year: item.year,
                authorDisplay: item.authorDisplay,
                isDoi: true // 标记为 DOI 类型的补全项
            };
        });
    }

    renderGotoLinks(rawText, valuePath = '') {
        if (!rawText) return '';
        const re = /goto\{([^}]+)\}/g;
        let lastIndex = 0;
        let out = '';
        const jsonPath = this.currentFile || '';
        let m;
        while ((m = re.exec(rawText)) !== null) {
            const pre = rawText.slice(lastIndex, m.index);
            const query = (m[1] || '').trim();
            out += this.escapeHtml(pre);
            if (query) {
                out += `<a href="#" class="location-link goto-link" data-page="" data-quote-text="${this.escapeAttr(query)}" data-open-params="" data-quote-index="0" data-value-path="${this.escapeAttr(valuePath)}" data-json-path="${this.escapeAttr(jsonPath)}" title="跳转PDF搜索"><i class="fa-solid fa-quote-right"></i></a>`;
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

    getValueByPathFromData(data, pathArr) {
        let cur = data;
        for (const seg of pathArr) {
            if (cur && Object.prototype.hasOwnProperty.call(cur, seg)) {
                cur = cur[seg];
            } else {
                return undefined;
            }
        }
        return cur;
    }

    setValueByPathOnData(data, pathArr, value) {
        if (!data || !pathArr || !pathArr.length) return;
        let cur = data;
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

    replaceGotoInValue(value, newText, targetIndex = 0) {
        const replaceInString = (text) => {
            let count = 0;
            let changed = false;
            const updated = text.replace(/goto\{[^}]*\}/g, (m) => {
                if (count === targetIndex && !changed) {
                    changed = true;
                    count++;
                    return `goto{${newText}}`;
                }
                count++;
                return m;
            });
            return { updated, changed, count };
        };
        if (typeof value === 'string') {
            const { updated, changed, count } = replaceInString(value);
            return { value: updated, replaced: changed, count };
        }
        if (Array.isArray(value)) {
            let globalCount = 0;
            let replaced = false;
            const next = value.map((item) => {
                const res = this.replaceGotoInValue(item, newText, targetIndex);
                if (res.count) globalCount += res.count;
                if (res.replaced) replaced = true;
                return res.value;
            });
            return { value: next, replaced, count: globalCount };
        }
        if (value && typeof value === 'object') {
            let globalCount = 0;
            let replaced = false;
            const next = Array.isArray(value) ? [] : {};
            Object.entries(value).forEach(([k, v]) => {
                const res = this.replaceGotoInValue(v, newText, targetIndex);
                if (res.count) globalCount += res.count;
                if (res.replaced) replaced = true;
                next[k] = res.value;
            });
            return { value: next, replaced, count: globalCount };
        }
        return { value, replaced: false, count: 0 };
    }

    replaceGotoByTextInValue(value, oldText, newText, state) {
        if (!state) return { value, replaced: false };
        if (typeof value === 'string') {
            if (state.replaced) return { value, replaced: false };
            const escapeReg = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const target = `goto{${oldText}}`;
            const reg = new RegExp(escapeReg(target), 'g');
            let replaced = false;
            const next = value.replace(reg, (m) => {
                if (!state.replaced && !replaced) {
                    replaced = true;
                    state.replaced = true;
                    return `goto{${newText}}`;
                }
                return m;
            });
            return { value: next, replaced };
        }
        if (Array.isArray(value)) {
            const next = value.map((item) => this.replaceGotoByTextInValue(item, oldText, newText, state).value);
            return { value: next, replaced: state.replaced };
        }
        if (value && typeof value === 'object') {
            const next = Array.isArray(value) ? [] : {};
            Object.entries(value).forEach(([k, v]) => {
                next[k] = this.replaceGotoByTextInValue(v, oldText, newText, state).value;
            });
            return { value: next, replaced: state.replaced };
        }
        return { value, replaced: false };
    }

    updateGotoText(pathStr, newText, targetIndex = 0) {
        if (!pathStr || !this.currentData) return false;
        const normalizedPath = String(pathStr || '').replace(/\[(\d+)\]/g, '.$1');
        const pathArr = normalizedPath.split('.').map(seg => seg.trim()).filter(Boolean);
        const oldVal = this.getValueByPath(pathArr);
        if (oldVal === undefined || oldVal === null) {
            this.showNotification(`Target field not found: ${pathArr.join('.')}`, 'error');
            return false;
        }

        let updatedValue = null;
        let replaced = false;
        if (typeof oldVal === 'string') {
            const res = this.replaceGotoInValue(oldVal, newText, targetIndex);
            updatedValue = res.value;
            replaced = res.replaced;
        } else if (oldVal && typeof oldVal === 'object') {
            const res = this.replaceGotoInValue(oldVal, newText, targetIndex);
            updatedValue = res.value;
            replaced = res.replaced;
        } else {
            this.showNotification('Target field is not text, cannot update reference', 'error');
            return false;
        }

        if (!replaced) {
            this.showNotification('No updatable goto references found', 'info');
            return false;
        }

        this.setValueByPath(pathArr, updatedValue);
        this.hasUnsavedChanges = true;
        if (this.currentFile) this.tempDataCache[this.currentFile] = this.currentData;
        this.updateSaveButtonState();
        this.renderStructuredView();
        this.renderFlatView();
        if (this.currentMarkdownExists && typeof this.currentMarkdownText === 'string') {
            this.renderMarkdownView(this.currentMarkdownText);
        }
        this.setupEditableListeners();
        this.showNotification('Reference text updated', 'success');
        // Fire-and-forget save to persist goto edits in JSON
        this.saveToFile({ silent: true, force: true }).catch((err) => {
            this.showNotification(`✗ Save failed: ${err.message}`, 'error');
        });
        return true;
    }

    async updateGotoTextInFile(jsonPath, valuePath, newText, targetIndex = 0, oldText = '') {
        if (!jsonPath || !valuePath) return false;
        try {
            const data = await this.readProjectFile(jsonPath);
            const normalizedPath = String(valuePath || '').replace(/\[(\d+)\]/g, '.$1');
            const pathArr = normalizedPath.split('.').map(seg => seg.trim()).filter(Boolean);
            const oldVal = this.getValueByPathFromData(data, pathArr);
            let replaced = false;
            if (oldVal !== undefined && oldVal !== null) {
                const res = this.replaceGotoInValue(oldVal, newText, targetIndex);
                if (res.replaced) {
                    this.setValueByPathOnData(data, pathArr, res.value);
                    replaced = true;
                }
            }

            if (!replaced && oldText) {
                const state = { replaced: false };
                const res = this.replaceGotoByTextInValue(data, oldText, newText, state);
                if (res.replaced) {
                    replaced = true;
                }
            }

            if (!replaced) {
                this.showNotification(`No updatable goto references found in ${jsonPath}`, 'info');
                return false;
            }

            await this.saveJsonPayload(jsonPath, data);
            if (jsonPath === this.currentFile) {
                this.currentData = data;
                this.hasUnsavedChanges = false;
                delete this.tempDataCache[this.currentFile];
                this.updateSaveButtonState();
                this.renderStructuredView();
                this.renderFlatView();
                if (this.currentMarkdownExists && typeof this.currentMarkdownText === 'string') {
                    this.renderMarkdownView(this.currentMarkdownText);
                }
                this.setupEditableListeners();
            }
            return true;
        } catch (err) {
            this.showNotification(`✗ Save failed: ${err.message}`, 'error');
            return false;
        }
    }

    async updateMarkdownGotoText(oldText = '', newText, targetIndex = 0, opts = {}) {
        if (!this.currentMarkdownExists || typeof this.currentMarkdownText !== 'string') return;
        const reAll = /goto\{([^}]*?)\}/g;
        const matches = [...this.currentMarkdownText.matchAll(reAll)];
        if (!matches.length) {
            this.showNotification('No updatable goto references found in Markdown', 'info');
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
            this.showNotification('No updatable goto references found in Markdown', 'info');
            return;
        }

        this.currentMarkdownText = updatedText;
        const textarea = document.getElementById('markdownTextarea');
        if (textarea) {
            textarea.value = this.currentMarkdownText;
        }
        this.isMarkdownEditing = false;
        try {
            const mdFilename = this.getActiveMarkdownFilename();
            await this.persistMarkdown(mdFilename, this.currentMarkdownText);
            this.showNotification('Markdown references updated and saved', 'success');
        } catch (err) {
            this.showNotification(`Failed to save Markdown: ${err.message}`, 'error');
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

    resetPdfViewerFrame() {
        const pdfViewer = document.getElementById('pdfViewer');
        if (!pdfViewer) return;
        pdfViewer.onload = null;
        pdfViewer.removeAttribute('src');
        pdfViewer.classList.remove('pdf-loaded');
        delete pdfViewer.dataset.pdfSig;
        // 清除已加载的PDF URL，确保下次能够重新加载
        this.lastPdfLoadedUrl = '';
    }

    fitPdfViewerToWidth() {
        const pdfViewer = document.getElementById('pdfViewer');
        const win = pdfViewer?.contentWindow;
        const pdfApp = win?.PDFViewerApplication;
        if (!pdfViewer || !win || !pdfApp?.pdfViewer) return;
        try {
            pdfApp.pdfViewer.currentScaleValue = 'page-width';
        } catch (err) {
            console.warn('PDF fit to width failed:', err);
        }
    }

    updatePdfPopupButtonState() {
        const btn = document.getElementById('btnPdfPopup');
        if (!btn) return;
        const icon = btn.querySelector('i');
        const isPopup = !!this.isPdfPopupMode;
        btn.classList.toggle('is-popup', isPopup);
        btn.setAttribute('aria-pressed', isPopup ? 'true' : 'false');
        btn.title = isPopup ? '切回内嵌 PDF 视图' : '弹出 PDF 到独立窗口';
        if (icon) {
            icon.className = isPopup ? 'fas fa-window-restore' : 'fas fa-up-right-from-square';
        }
    }

    clearPdfPopupCloseSignal() {
        try {
            localStorage.removeItem('closePdfPopupWindow');
        } catch (err) {
            console.warn('清理 PDF 关闭信号失败:', err);
        }
    }

    // PDF Functions - 使用iframe加载完整的PDF.js viewer
    async togglePdfPopup() {
        // 检查是否在独立窗口模式
        if (this.isPdfPopupMode) {
            // 在关闭前保存PDF标注数据
            await this.savePdfAnnotationsFromPopup();

            // 关闭独立窗口，回到嵌入模式
            if (this.pdfPopupWindow && !this.pdfPopupWindow.closed) {
                this.pdfPopupWindow.close();
            }
            // 清除聚焦定时器
            if (this.pdfPopupFocusInterval) {
                clearInterval(this.pdfPopupFocusInterval);
                this.pdfPopupFocusInterval = null;
            }
            // 保存当前PDF URL
            const urlToRestore = this.currentPdfUrl;
            // 立即设置状态为false，防止重复点击
            this.isPdfPopupMode = false;
            this.pdfPopupWindow = null;
            this.updatePdfPopupButtonState();
            this.restoreRightPanelAfterPdfPopup();
            // 标记用户已手动切换，禁止自动恢复
            this.pdfViewModeRestored = true;
            // 保存状态到localStorage
            this.savePdfViewMode();
            // 清除lastPdfLoadedUrl以强制重新加载
            this.lastPdfLoadedUrl = '';

            // 确保iframe已准备好
            const pdfViewer = document.getElementById('pdfViewer');
            if (pdfViewer) {
                pdfViewer.classList.remove('pdf-loaded');
            }

            // 立即同步加载PDF到iframe，不使用延迟
            if (urlToRestore) {
                this.loadPDF(urlToRestore);
            }
        } else {
            // 打开独立窗口
            this.openPdfInPopup();
        }
    }

    openPdfInPopup() {
        if (!this.currentPdfUrl) {
            this.showNotification('No PDF loaded', 'info');
            return;
        }

        // 确保没有残留的关闭信号导致新窗口被立即关闭
        this.clearPdfPopupCloseSignal();

        // 保存URL用于恢复
        const savedPdfUrl = this.currentPdfUrl;

        // 创建独立窗口 - 使用简化的查看器页面，URL更简洁
        const absoluteUrl = window.location.origin + this.currentPdfUrl;
        const viewerUrl = `pdf-popup-viewer.html?file=${encodeURIComponent(absoluteUrl)}&theme=${this.theme === 'dark' ? 'dark' : 'light'}`;

        const width = 1000;
        const height = 800;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;

        this.pdfPopupWindow = window.open(
            viewerUrl,
            'PDFViewer',
            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,location=no,menubar=no,toolbar=no,status=no,alwaysRaised=yes`
        );

        // 添加定期聚焦机制，让窗口保持在前面
        if (this.pdfPopupFocusInterval) {
            clearInterval(this.pdfPopupFocusInterval);
        }

        if (this.pdfPopupWindow) {
            // 使用 requestAnimationFrame 确保窗口完全打开后再处理
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    // 检查窗口是否真的打开了
                    if (!this.pdfPopupWindow || this.pdfPopupWindow.closed) {
                        // 窗口立即关闭或打开失败，保持内嵌模式
                        this.isPdfPopupMode = false;
                        this.pdfPopupWindow = null;
                        this.updatePdfPopupButtonState();
                        return;
                    }

                    // 窗口成功打开，现在可以设置状态并清空iframe
                    this.isPdfPopupMode = true;
                    this.updatePdfPopupButtonState();
                    // 保存状态到localStorage
                    this.savePdfViewMode();
                    this.collapseRightPanelForPdfPopup();

                    // 清空内嵌iframe
                    const pdfViewer = document.getElementById('pdfViewer');
                    if (pdfViewer) {
                        pdfViewer.removeAttribute('src');
                        pdfViewer.classList.remove('pdf-loaded');
                    }

                    // 监听窗口关闭
                    const checkClosed = setInterval(async () => {
                        if (this.pdfPopupWindow && this.pdfPopupWindow.closed) {
                            clearInterval(checkClosed);
                            // 清除聚焦定时器
                            if (this.pdfPopupFocusInterval) {
                                clearInterval(this.pdfPopupFocusInterval);
                                this.pdfPopupFocusInterval = null;
                            }
                            // 保存URL用于恢复
                            const urlToRestore = this.currentPdfUrl || savedPdfUrl;
                            // 重置状态
                            this.isPdfPopupMode = false;
                            this.pdfPopupWindow = null;
                            this.lastPdfLoadedUrl = '';
                            this.updatePdfPopupButtonState();
                            this.restoreRightPanelAfterPdfPopup();
                            // 保存状态到localStorage（窗口关闭=切换回嵌入模式）
                            this.savePdfViewMode();

                            // 确保iframe准备好
                            const pdfViewer = document.getElementById('pdfViewer');
                            if (pdfViewer) {
                                pdfViewer.classList.remove('pdf-loaded');
                            }

                            // 立即加载PDF到iframe
                            if (urlToRestore) {
                                this.loadPDF(urlToRestore);
                            }
                        }
                    }, 500);

                    // 设置定期聚焦，让窗口保持在前面（每3秒聚焦一次）
                    this.pdfPopupFocusInterval = setInterval(() => {
                        if (this.pdfPopupWindow && !this.pdfPopupWindow.closed) {
                            try {
                                this.pdfPopupWindow.focus();
                            } catch (e) {
                                // 忽略错误
                            }
                        } else {
                            clearInterval(this.pdfPopupFocusInterval);
                            this.pdfPopupFocusInterval = null;
                        }
                    }, 3000);
                });
            });
        } else {
            // 窗口打开失败（可能被浏览器拦截）
            this.isPdfPopupMode = false;
            this.updatePdfPopupButtonState();
            this.showNotification('Failed to open popup window. Please allow popups for this site.', 'error');
        }
    }

    // 保存PDF窗口模式到localStorage
    savePdfViewMode() {
        try {
            if (!this.currentProject || !this.currentProject.path) return;
            const key = `pdfViewMode_${this.currentProject.path}`;
            localStorage.setItem(key, this.isPdfPopupMode ? 'popup' : 'embedded');
            this.debugLog(`💾 保存PDF窗口模式: ${this.isPdfPopupMode ? 'popup' : 'embedded'} for project ${this.currentProject.name}`);
        } catch (e) {
            console.warn('Failed to save PDF view mode:', e);
        }
    }

    // 从 localStorage 加载PDF窗口模式
    loadPdfViewMode() {
        try {
            if (!this.currentProject || !this.currentProject.path) return 'embedded';
            const key = `pdfViewMode_${this.currentProject.path}`;
            const mode = localStorage.getItem(key) || 'embedded';
            this.debugLog(`📚 加载PDF窗口模式: ${mode} for project ${this.currentProject.name}`);
            return mode;
        } catch (e) {
            console.warn('Failed to load PDF view mode:', e);
            return 'embedded';
        }
    }

    // 强制切换到内嵌PDF模式
    forceEmbeddedPdfMode() {
        this.debugLog('🔄 强制切换为内嵌PDF模式...');

        // 关闭独立PDF窗口（多次尝试确保关闭）
        if (this.pdfPopupWindow) {
            try {
                if (!this.pdfPopupWindow.closed) {
                    this.debugLog('📌 关闭独立PDF窗口');
                    this.pdfPopupWindow.close();
                }
            } catch (err) {
                console.warn('⚠️ 关闭PDF窗口时出错:', err);
            }

            // 强制清空引用
            this.pdfPopupWindow = null;
        }

        // 清除聚焦定时器
        if (this.pdfPopupFocusInterval) {
            clearInterval(this.pdfPopupFocusInterval);
            this.pdfPopupFocusInterval = null;
        }

        // 重置状态
        this.isPdfPopupMode = false;
        this.pdfViewModeRestored = true; // 标记已处理，防止自动恢复
        this.updatePdfPopupButtonState();
        this.restoreRightPanelAfterPdfPopup();

        // 清除保存的popup模式状态
        try {
            if (this.currentProject && this.currentProject.path) {
                const key = `pdfViewMode_${this.currentProject.path}`;
                localStorage.setItem(key, 'embedded');
            }
        } catch (err) {
            console.warn('⚠️ 清除localStorage失败:', err);
        }

        this.debugLog('✅ 已重置为内嵌PDF模式');
    }

    // 恢复PDF窗口状态（已禁用自动恢复popup模式）
    restorePdfViewMode() {
        // 每次加载项目时都强制使用内嵌模式，不再自动恢复popup模式
        // 如果已经恢复过或用户已手动切换，则不再自动恢复
        if (this.pdfViewModeRestored) {
            return;
        }

        // 内嵌模式标记已恢复，避免后续被触发
        this.pdfViewModeRestored = true;
    }

    async loadPDF(url) {
        const loadToken = ++this.currentPdfLoadToken;
        try {
            this.currentPdfUrl = url;
            this.pendingPdfUrl = url;

            // 如果在独立窗口模式，更新独立窗口的PDF
            if (this.isPdfPopupMode && this.pdfPopupWindow && !this.pdfPopupWindow.closed) {
                const absoluteUrl = window.location.origin + url;
                const viewerUrl = `js/pdfjs/web/viewer.html?file=${encodeURIComponent(absoluteUrl)}&theme=${this.theme === 'dark' ? 'dark' : 'light'}#zoom=80`;
                this.pdfPopupWindow.location.href = viewerUrl;
                return;
            }

            const pdfViewer = document.getElementById('pdfViewer');
            this.setPdfSidebarPrefClosed();
            if (pdfViewer) {
                pdfViewer.classList.remove('pdf-loaded');
            }

            // 同一路径已加载，且iframe有src属性，直接复用现有渲染
            if (this.lastPdfLoadedUrl === url && pdfViewer && pdfViewer.src) {
                if (pdfViewer) {
                    pdfViewer.classList.add('pdf-loaded');
                }
                return;
            }

            // 使用PDF.js的web viewer
            // viewer.html在 js/pdfjs/web/ 目录
            // 使用完整的URL路径，确保iframe可以正确访问
            const absoluteUrl = window.location.origin + url;
            const themeParam = this.theme === 'dark' ? 'dark' : 'light';
            const viewerUrl = `js/pdfjs/web/viewer.html?file=${encodeURIComponent(absoluteUrl)}&theme=${themeParam}#zoom=80`;

            const tryReuseViewer = async () => {
                if (!pdfViewer || !pdfViewer.contentWindow) return false;
                if (pdfViewer.dataset.viewerTheme !== themeParam) return false;
                const win = pdfViewer.contentWindow;
                const app = win.PDFViewerApplication;
                if (!app || !app.initializedPromise) return false;
                try {
                    await app.initializedPromise;
                    if (loadToken !== this.currentPdfLoadToken) return true;
                    await app.open({ url: absoluteUrl });
                    pdfViewer.classList.add('pdf-loaded');
                    this.lastPdfLoadedUrl = url;
                    this.pendingPdfUrl = url;
                    this.updatePdfPlaceholder('loaded');
                    this.closePdfSidebarIfOpen(win);
                    await this.restorePdfAnnotations(url);
                    this.restorePdfViewMode();
                    return true;
                } catch (err) {
                    console.warn('PDF viewer reuse failed:', err);
                    return false;
                }
            };

            if (pdfViewer && pdfViewer.src && pdfViewer.dataset.viewerReady === '1') {
                const reused = await tryReuseViewer();
                if (reused) return;
            }

            if (pdfViewer) {
                delete pdfViewer.dataset.viewerReady;
            }
            pdfViewer.src = viewerUrl;

            // 监听iframe加载完成（如需自定义滚动行为，可在此扩展）
            pdfViewer.onload = async () => {
                if (loadToken !== this.currentPdfLoadToken) return;
                try {
                    const win = pdfViewer.contentWindow;
                    if (win) {
                        const pdfDoc = win.document;
                        try {
                            if (!pdfDoc.__panelActiveBound) {
                                pdfDoc.addEventListener('mousedown', () => this.setActivePanel('right'), { capture: true });
                                pdfDoc.__panelActiveBound = true;
                            }
                        } catch (err) {
                            console.warn('Failed to bind PDF panel activation:', err);
                        }
                        // 添加自定义样式：保持0.8缩放但修正标注层坐标
                        const styleId = 'paperReviewerPdfScaleStyle';
                        if (!pdfDoc.getElementById(styleId)) {
                            const styleEl = pdfDoc.createElement('style');
                            styleEl.id = styleId;
                            // 缩放容器到80%，并修正标注编辑层的坐标系统
                            styleEl.textContent = `
                                :root {
                                    --pr-pdf-scale: 0.85;
                                    --toolbar-height: 30px;
                                    --toolbar-vertical-padding: 2px;
                                    --toolbar-horizontal-padding: 1px;
                                }
                                #outerContainer {
                                    transform: scale(var(--pr-pdf-scale));
                                    transform-origin: top left;
                                    width: calc(100% / var(--pr-pdf-scale));
                                    height: calc(100% / var(--pr-pdf-scale));
                                }
                                /* 修正标注编辑层的坐标系统 */
                                .annotationEditorLayer {
                                    transform: scale(calc(1 / var(--pr-pdf-scale))) !important;
                                    transform-origin: top left !important;
                                    width: calc(100% * var(--pr-pdf-scale)) !important;
                                    height: calc(100% * var(--pr-pdf-scale)) !important;
                                }
                                .textLayer .highlight {
                                    background-color: rgba(255, 230, 90, 0.45) !important;
                                }
                                .textLayer .highlight.selected {
                                    background-color: rgba(255, 200, 60, 0.6) !important;
                                }
                            `;
                            pdfDoc.head.appendChild(styleEl);
                        }
                        // 禁用 PDF.js 内部的 alert/confirm/prompt 弹窗
                        win.alert = () => { };
                        win.confirm = () => true;
                        win.prompt = () => null;
                        // 部分 overlay 弹窗（如删除时的提示）直接关闭
                        if (win.PDFViewerApplication?.overlayManager?.closeAll) {
                            win.PDFViewerApplication.overlayManager.closeAll();
                        }
                        // 默认收起侧边栏，但保留按钮可用
                        const tryCloseSidebar = () => {
                            const pdfApp = win.PDFViewerApplication;
                            if (pdfApp?.pdfSidebar?.isOpen) {
                                pdfApp.pdfSidebar?.close();
                            }
                        };
                        tryCloseSidebar();
                        setTimeout(tryCloseSidebar, 120);

                        requestAnimationFrame(async () => {
                            if (loadToken !== this.currentPdfLoadToken) return;
                            pdfViewer.classList.add('pdf-loaded');
                            pdfViewer.dataset.viewerReady = '1';
                            pdfViewer.dataset.viewerTheme = themeParam;
                            this.lastPdfLoadedUrl = url;
                            this.pendingPdfUrl = url;
                            this.updatePdfPlaceholder('loaded');

                            // 恢复PDF标注数据
                            await this.restorePdfAnnotations(url);

                            // 恢复PDF窗口模式
                            this.restorePdfViewMode();
                        });
                    }
                } catch (err) {
                    console.warn('Suppress PDF.js prompts failed:', err);
                }
            };
        } catch (error) {
            this.showNotification(`Failed to load PDF: ${error.message}`, 'error');
        }
    }

    async checkPdfAvailable(url) {
        try {
            console.log('🔍 Checking PDF availability:', url);
            if (!this._pdfAvailabilityCache) this._pdfAvailabilityCache = new Map();
            const cached = this._pdfAvailabilityCache.get(url);
            const now = Date.now();
            if (cached && (now - cached.ts) < 180000) {
                console.log('📦 Using cached result:', cached.ok ? 'available' : 'not available');
                return cached.ok;
            }
            const headResp = await fetch(url, { method: 'HEAD', cache: 'no-store' });
            if (headResp.ok) {
                const type = (headResp.headers.get('content-type') || '').toLowerCase();
                const ok = !type || type.includes('application/pdf') || type.includes('pdf');
                this._pdfAvailabilityCache.set(url, { ok, ts: now });
                console.log('✅ HEAD request succeeded, content-type:', type, 'ok:', ok);
                return ok;
            }
            console.log('⚠️ HEAD request failed, trying GET with Range...');
            const resp = await fetch(url, {
                method: 'GET',
                headers: { Range: 'bytes=0-0' },
                cache: 'no-store'
            });
            const ok = resp.status === 206 || resp.status === 200;
            this._pdfAvailabilityCache.set(url, { ok, ts: now });
            console.log('📥 GET request result, status:', resp.status, 'ok:', ok);
            if (resp.body && typeof resp.body.cancel === 'function') {
                try {
                    resp.body.cancel();
                } catch (_e) {
                    // ignore cancel errors
                }
            }
            return ok;
        } catch (error) {
            console.warn('❌ PDF availability check failed:', error);
            return false;
        }
    }

    async resolvePdfUrl(url) {
        // 如果设置了跳过可用性检查的标志，直接返回URL（用于刚上传的PDF）
        if (this._skipPdfAvailabilityCheck) {
            this._skipPdfAvailabilityCheck = false;
            console.log('🔄 Skipping PDF availability check for newly uploaded PDF');
            return url || '';
        }

        const candidates = [];
        if (url) candidates.push(url);
        if (this.pendingPdfFallback && this.pendingPdfFallback !== url) {
            candidates.push(this.pendingPdfFallback);
        }

        for (const candidate of candidates) {
            const ok = await this.checkPdfAvailable(candidate);
            if (ok) return candidate;
        }
        return '';
    }

    async ensurePdfLoaded() {
        const url = this.pendingPdfUrl || this.currentPdfUrl;
        const loadToken = this.currentPdfLoadToken;
        console.log('🔍 ensurePdfLoaded called with URL:', url);
        if (!url) {
            console.log('❌ No PDF URL, showing empty placeholder');
            this.updatePdfPlaceholder('empty');
            return;
        }
        if (this.lastPdfLoadedUrl === url) {
            console.log('✅ PDF already loaded:', url);
            this.updatePdfPlaceholder('loaded');
            return;
        }
        const tracker = this.createStatusProgressTracker('Loading PDF');
        tracker.update('Loading PDF...', 10);
        this.updatePdfPlaceholder('pending');

        console.log('🔄 Resolving PDF URL...');
        const availableUrl = await this.resolvePdfUrl(url);
        if (loadToken !== this.currentPdfLoadToken) return;

        if (!availableUrl) {
            console.error('❌ PDF URL not available after resolution:', url);
            this.resetPdfViewerFrame();
            this.currentPdfUrl = null;
            this.pendingPdfUrl = null;
            this.pendingPdfFallback = null;
            this.lastPdfLoadedUrl = '';
            this.updatePdfPlaceholder('empty');
            tracker.fail('PDF not found');
            return;
        }

        console.log('✅ PDF URL resolved:', availableUrl);

        this.currentPdfUrl = availableUrl;
        this.pendingPdfUrl = availableUrl;
        tracker.update('Opening PDF...', 65);
        await this.loadPDF(availableUrl);
        tracker.finish('PDF ready');
    }

    prewarmPdf(url) {
        if (!url) return;
        const cache = this._pdfPrewarmCache || new Map();
        this._pdfPrewarmCache = cache;
        const now = Date.now();
        const cached = cache.get(url);
        if (cached && (now - cached) < 120000) return;
        cache.set(url, now);
        fetch(url, {
            method: 'GET',
            headers: { Range: 'bytes=0-2047' },
            cache: 'default'
        }).then((resp) => {
            if (resp.body && typeof resp.body.cancel === 'function') {
                try {
                    resp.body.cancel();
                } catch (_e) {
                    // ignore
                }
            }
        }).catch(() => {
            // ignore prewarm errors
        });
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
            if (state === 'pending') {
                textEl.textContent = 'Loading PDF...';
            } else {
                textEl.textContent = 'Drop or paste a PDF here to auto link and display.';
            }
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

    closePdfSidebarIfOpen(pdfWindow) {
        try {
            const pdfApp = pdfWindow?.PDFViewerApplication;
            if (pdfApp?.pdfSidebar?.isOpen) {
                pdfApp.pdfSidebar.close();
            }
        } catch (err) {
            console.warn('PDF sidebar close failed:', err);
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
            let pdfApp = null;

            // 检查是否在独立窗口模式
            if (this.isPdfPopupMode && this.pdfPopupWindow && !this.pdfPopupWindow.closed) {
                // 从独立窗口获取PDFViewerApplication
                try {
                    const popupIframe = this.pdfPopupWindow.document.getElementById('pdfFrame');
                    if (popupIframe && popupIframe.contentWindow) {
                        pdfApp = popupIframe.contentWindow.PDFViewerApplication;
                        this.debugLog('✅ 从独立窗口获取PDFViewerApplication成功');
                    } else {
                        console.warn('❌ 独立窗口中找不到pdfFrame iframe');
                    }
                } catch (e) {
                    console.warn('❌ 无法访问独立窗口的PDF:', e);
                }
            } else {
                // 从内嵌iframe获取PDFViewerApplication
                const iframe = document.getElementById('pdfViewer');
                if (iframe && iframe.contentWindow) {
                    pdfApp = iframe.contentWindow.PDFViewerApplication;
                    this.debugLog('✅ 从内嵌iframe获取PDFViewerApplication成功');
                }
            }

            if (!pdfApp) {
                this.showNotification('PDF not fully loaded', 'error');
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

            this.showNotification('Switching to PDF fullscreen mode', 'success');
        } catch (error) {
            this.showNotification(`Failed to enter fullscreen: ${error.message}`, 'error');
        }
    }

    async downloadCurrentPdf() {
        // 防止重复点击保存
        if (this._isSavingPdf) {
            this.showNotification('Saving in progress, please wait...', 'warning');
            return;
        }

        try {
            this._isSavingPdf = true;
            this.showNotification('Starting to save PDF...', 'info');

            let pdfApp = null;

            // 检查是否在独立窗口模式
            if (this.isPdfPopupMode && this.pdfPopupWindow && !this.pdfPopupWindow.closed) {
                // 从独立窗口获取PDFViewerApplication
                try {
                    const popupIframe = this.pdfPopupWindow.document.getElementById('pdfFrame');
                    if (popupIframe && popupIframe.contentWindow) {
                        pdfApp = popupIframe.contentWindow.PDFViewerApplication;
                        this.debugLog('✅ 从独立窗口获取PDFViewerApplication成功（下载）');
                    } else {
                        console.warn('❌ 独立窗口中找不到pdfFrame iframe');
                    }
                } catch (e) {
                    console.warn('❌ 无法访问独立窗口的PDF:', e);
                }
            } else {
                // 从内嵌iframe获取PDFViewerApplication
                const iframe = document.getElementById('pdfViewer');
                if (iframe && iframe.contentWindow) {
                    pdfApp = iframe.contentWindow.PDFViewerApplication;
                    this.debugLog('✅ 从内嵌iframe获取PDFViewerApplication成功（下载）');
                }
            }

            const pdfUrl = this.currentPdfUrl;

            if (!pdfApp) {
                this.showNotification('PDF not fully loaded', 'error');
                console.error('PDFViewerApplication not found');
                return;
            }

            // 等待PDF文档完全加载
            if (!pdfApp.pdfDocument || !pdfApp.pdfDocument.numPages) {
                this.showNotification('⏳ 等待PDF文档加载...', 'warning');
                await this.waitForPdfReady(pdfApp);
            }

            // 🔑 关键修复：在保存前确保所有标注已提交
            this.showNotification('Preparing annotation data...', 'info');
            await this.ensureAnnotationsCommitted(pdfApp);

            // 从URL中获取当前PDF的原始文件名（与pdf目录下的文件同名）
            let filename = this.getPdfFilename(pdfUrl);

            // 尝试从URL参数中获取更准确的文件名
            try {
                const urlObj = new URL(pdfUrl, window.location.href);
                const params = new URLSearchParams(urlObj.search);
                const fileParam = params.get('file');
                if (fileParam) {
                    // 提取文件名（去除路径）
                    const parts = fileParam.split(/[\\/]/);
                    const originalFilename = parts[parts.length - 1];
                    if (originalFilename) {
                        filename = originalFilename;
                        this.debugLog('📄 使用原始PDF文件名:', filename);
                    }
                }
            } catch (e) {
                console.warn('解析PDF文件名失败，使用默认名称:', e);
            }

            // 获取包含用户标注/高亮的PDF数据
            const annotatedBlob = await this.buildPdfBlobWithAnnotations(pdfApp);

            // 尝试直接保存到项目pdf目录（不弹出对话框）
            if (annotatedBlob) {
                try {
                    const savedPath = await this.savePdfToProjectDirectory(pdfUrl, filename, annotatedBlob);
                    if (savedPath) {
                        this.showNotification(`Saved to: ${savedPath}`, 'success');
                        return;
                    }
                } catch (saveError) {
                    console.warn('直接保存失败，尝试其他方式:', saveError);
                }
            }

            // 回退1: 使用文件保存选择器（让用户选择位置）
            if (window.showSaveFilePicker && annotatedBlob) {
                try {
                    // 尝试获取PDF的实际文件路径作为默认保存目录
                    const startIn = await this.getPdfDirectory(pdfUrl);

                    const options = {
                        suggestedName: filename,
                        types: [{
                            description: 'PDF 文件',
                            accept: { 'application/pdf': ['.pdf'] }
                        }]
                    };

                    // 如果获取到了目录句柄，设置为起始目录
                    if (startIn) {
                        options.startIn = startIn;
                    }

                    const handle = await window.showSaveFilePicker(options);

                    const writable = await handle.createWritable();
                    await writable.write(annotatedBlob);
                    await writable.close();

                    this.showNotification(`Saved to: ${handle.name}`, 'success');
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
                this.showNotification('Starting PDF download (with annotations)', 'success');
                return;
            }

            // Fallback: Use PDF.js built-in download   
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

            this.showNotification('Starting PDF download', 'success');
        } catch (error) {
            this.showNotification(`Save failed: ${error.message}`, 'error');
        } finally {
            // 释放保存锁
            this._isSavingPdf = false;
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

    async getPdfDirectory(pdfUrl) {
        try {
            if (!pdfUrl) return null;

            // 从URL中提取项目路径和文件路径
            const urlObj = new URL(pdfUrl, window.location.href);
            const params = new URLSearchParams(urlObj.search);
            const projectPath = params.get('projectPath');
            const file = params.get('file');

            if (!projectPath || !file) {
                this.debugLog('无法从URL获取PDF路径信息');
                return null;
            }

            // 请求服务器获取PDF的实际文件系统路径
            const response = await fetch('/get-pdf-dir', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectPath, file })
            });

            if (!response.ok) {
                console.warn('获取PDF目录失败:', response.statusText);
                return null;
            }

            const result = await response.json();
            if (result.directory) {
                this.debugLog('📁 PDF目录:', result.directory);
                // 返回目录路径，作为 startIn 选项
                // 注意：某些浏览器可能不支持字符串路径，需要DirectoryHandle
                return result.directory;
            }
        } catch (error) {
            console.warn('获取PDF目录失败:', error);
        }
        return null;
    }

    // 直接保存PDF到项目pdf目录（不弹出对话框）
    async savePdfToProjectDirectory(pdfUrl, filename, blob, retryCount = 0) {
        const maxRetries = 2;

        try {
            if (!filename || !blob) {
                console.warn('⚠️ 缺少文件名或blob数据');
                return null;
            }

            if (blob.size === 0) {
                console.warn('⚠️ Blob大小为0，可能标注未正确保存');
                return null;
            }

            // 使用当前项目路径
            const projectPath = this.getProjectKey();
            if (!projectPath) {
                console.warn('⚠️ 无法获取当前项目路径');
                return null;
            }

            this.debugLog(`Saving PDF to project pdf directory (${blob.size} bytes, attempt ${retryCount + 1}/${maxRetries + 1})...`);

            // 将Blob转换为ArrayBuffer
            const arrayBuffer = await blob.arrayBuffer();
            const base64Data = this.arrayBufferToBase64(arrayBuffer);

            this.debugLog(`Sending save request to server (${base64Data.length} chars base64)...`);

            // 请求服务器直接写入文件到项目pdf目录
            const response = await fetch('/save-pdf-to-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectPath,
                    filename,
                    data: base64Data
                })
            });

            if (!response.ok) {
                const error = await response.text();
                console.error('Server failed to save PDF:', error);

                // 如果还有重试次数，等待后重试
                if (retryCount < maxRetries) {
                    console.log(`Server save failed, retrying (${retryCount + 1}/${maxRetries})...`);
                    this.showNotification(`⏳ Retrying save (${retryCount + 1}/${maxRetries})...`, 'warning');
                    await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
                    return await this.savePdfToProjectDirectory(pdfUrl, filename, blob, retryCount + 1);
                }

                return null;
            }

            const result = await response.json();
            if (result.success && result.path) {
                this.debugLog('✅ PDF已保存到项目pdf目录:', result.path);
                return result.path;
            }

            console.warn('Server returned but did not confirm success:', result);
            return null;
        } catch (error) {
            console.error('Failed to save PDF to project directory:', error);

            // 如果还有重试次数，等待后重试
            if (retryCount < maxRetries) {
                console.log(`Retrying save (${retryCount + 1}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                return await this.savePdfToProjectDirectory(pdfUrl, filename, blob, retryCount + 1);
            }

            return null;
        }
    }

    // ArrayBuffer转Base64
    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    // 等待PDF完全加载
    async waitForPdfReady(pdfApp, maxWaitTime = 10000) {
        const startTime = Date.now();
        return new Promise((resolve, reject) => {
            const checkReady = () => {
                if (Date.now() - startTime > maxWaitTime) {
                    reject(new Error('PDF加载超时'));
                    return;
                }

                if (pdfApp.pdfDocument && pdfApp.pdfDocument.numPages && pdfApp.pdfViewer) {
                    this.debugLog('✅ PDF文档已完全加载');
                    resolve();
                } else {
                    setTimeout(checkReady, 100);
                }
            };
            checkReady();
        });
    }

    async buildPdfBlobWithAnnotations(pdfApp) {
        try {
            const pdfDocument = pdfApp?.pdfDocument;
            if (!pdfDocument) {
                console.warn('⚠️ pdfDocument不存在');
                return null;
            }

            // 🔑 关键修复：确保所有标注已提交并准备就绪
            await this.ensureAnnotationsCommitted(pdfApp);

            // 优先使用saveDocument（包含标注）
            if (typeof pdfDocument.saveDocument === 'function') {
                this.debugLog('📝 使用saveDocument方法保存（包含标注）');

                // 添加重试机制
                for (let attempt = 0; attempt < 3; attempt++) {
                    try {
                        // 每次尝试前都确保标注已提交
                        if (attempt > 0) {
                            this.debugLog(`🔄 重试保存 (${attempt + 1}/3)...`);
                            await this.ensureAnnotationsCommitted(pdfApp);
                            // 稍微等待一下
                            await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
                        }

                        const data = await pdfDocument.saveDocument();
                        if (data && data.byteLength > 0) {
                            this.debugLog(`✅ 成功获取PDF数据: ${data.byteLength} bytes (尝试 ${attempt + 1})`);
                            return new Blob([data], { type: 'application/pdf' });
                        }
                    } catch (saveError) {
                        console.warn(`saveDocument失败 (尝试 ${attempt + 1}/3):`, saveError);
                        if (attempt === 2) {
                            // 最后一次尝试失败，回退到getData
                            throw saveError;
                        }
                    }
                }
            }

            // 回退到getData
            if (typeof pdfDocument.getData === 'function') {
                this.debugLog('📝 使用getData方法保存（可能不含标注）');
                const data = await pdfDocument.getData();
                if (data && data.byteLength > 0) {
                    this.debugLog(`✅ 成功获取PDF数据: ${data.byteLength} bytes`);
                    return new Blob([data], { type: 'application/pdf' });
                }
            }

            console.warn('⚠️ 无法获取PDF数据');
        } catch (error) {
            console.error('❌ 构建带标注的PDF失败:', error);
        }
        return null;
    }

    // 🔑 确保所有标注已提交到annotationStorage
    async ensureAnnotationsCommitted(pdfApp) {
        try {
            if (!pdfApp) return;

            this.debugLog('🔄 检查并提交标注...');

            // 1. 等待所有页面渲染完成
            if (pdfApp.pdfViewer) {
                const numPages = pdfApp.pdfDocument?.numPages || 0;
                if (numPages > 0) {
                    // 确保至少当前可见页面已渲染
                    const currentPage = pdfApp.pdfViewer.currentPageNumber || 1;
                    for (let i = Math.max(1, currentPage - 2); i <= Math.min(numPages, currentPage + 2); i++) {
                        try {
                            const pageView = pdfApp.pdfViewer.getPageView(i - 1);
                            if (pageView && !pageView.renderingState) {
                                await pageView.draw();
                            }
                        } catch (e) {
                            // 忽略单个页面错误
                        }
                    }
                }
            }

            // 2. 触发标注编辑器的保存
            if (pdfApp.pdfDocument?.annotationStorage) {
                const storage = pdfApp.pdfDocument.annotationStorage;

                // 检查是否有未保存的标注
                if (storage.size > 0) {
                    this.debugLog(`📝 发现 ${storage.size} 个标注`);
                }

                // 触发编辑器提交
                if (pdfApp.annotationEditorUIManager) {
                    // 如果有活动的编辑器，先取消选中以触发保存
                    if (typeof pdfApp.annotationEditorUIManager.unselectAll === 'function') {
                        pdfApp.annotationEditorUIManager.unselectAll();
                    }

                    // 确保所有编辑器都已提交
                    if (typeof pdfApp.annotationEditorUIManager.commitAll === 'function') {
                        await pdfApp.annotationEditorUIManager.commitAll();
                    }
                }
            }

            // 3. 等待一小段时间确保提交完成
            await new Promise(resolve => setTimeout(resolve, 200));

            // 4. 触发eventBus的annotationeditorstateschanged事件以确保同步
            if (pdfApp.eventBus) {
                pdfApp.eventBus.dispatch('annotationeditorstateschanged', {
                    source: this,
                    details: { hasChanged: true }
                });
            }

            this.debugLog('✅ 标注提交完成');

        } catch (error) {
            console.warn('⚠️ 标注提交过程出现警告:', error);
            // 不抛出错误，继续保存流程
        }
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

    // 从独立窗口保存PDF标注数据
    async savePdfAnnotationsFromPopup() {
        try {
            if (!this.isPdfPopupMode || !this.pdfPopupWindow || this.pdfPopupWindow.closed) {
                return;
            }

            // 从独立窗口获取PDFViewerApplication
            const popupIframe = this.pdfPopupWindow.document.getElementById('pdfFrame');
            if (!popupIframe || !popupIframe.contentWindow) {
                console.warn('无法访问独立窗口的PDF iframe');
                return;
            }

            const pdfApp = popupIframe.contentWindow.PDFViewerApplication;
            if (!pdfApp || !pdfApp.pdfDocument) {
                console.warn('独立窗口中PDF未加载');
                return;
            }

            this.debugLog('🔄 正在从独立窗口保存PDF标注...');

            // 🔑 关键修复：确保标注已提交
            await this.ensureAnnotationsCommitted(pdfApp);

            // 使用saveDocument保存带标注的PDF数据 - 带重试机制
            let pdfData = null;
            if (typeof pdfApp.pdfDocument.saveDocument === 'function') {
                // 添加重试机制
                for (let attempt = 0; attempt < 3; attempt++) {
                    try {
                        if (attempt > 0) {
                            this.debugLog(`🔄 重试保存标注 (${attempt + 1}/3)...`);
                            await this.ensureAnnotationsCommitted(pdfApp);
                            await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
                        }
                        pdfData = await pdfApp.pdfDocument.saveDocument();
                        if (pdfData && pdfData.byteLength > 0) {
                            this.debugLog(`✅ 标注数据保存成功 (${pdfData.byteLength} bytes)`);
                            break;
                        }
                    } catch (err) {
                        console.warn(`标注保存失败 (尝试 ${attempt + 1}/3):`, err);
                        if (attempt === 2 && typeof pdfApp.pdfDocument.getData === 'function') {
                            pdfData = await pdfApp.pdfDocument.getData();
                        }
                    }
                }
            } else if (typeof pdfApp.pdfDocument.getData === 'function') {
                pdfData = await pdfApp.pdfDocument.getData();
            }

            if (pdfData && this.currentPdfUrl) {
                // 保存到内存缓存
                const key = `pdfAnnotations_${this.currentPdfUrl}`;
                this._pdfAnnotationsCache = this._pdfAnnotationsCache || {};
                this._pdfAnnotationsCache[key] = pdfData;
                this.debugLog('✅ PDF标注数据已保存到缓存');
            }
        } catch (error) {
            console.warn('保存PDF标注失败:', error);
        }
    }

    // 恢复PDF标注数据到内嵌iframe
    async restorePdfAnnotations(pdfUrl) {
        try {
            if (!pdfUrl) return;

            const key = `pdfAnnotations_${pdfUrl}`;
            this._pdfAnnotationsCache = this._pdfAnnotationsCache || {};
            const cachedData = this._pdfAnnotationsCache[key];

            if (!cachedData) {
                this.debugLog('ℹ️ 没有找到缓存的PDF标注数据');
                return;
            }

            this.debugLog('🔄 正在恢复PDF标注...');

            const pdfViewer = document.getElementById('pdfViewer');
            if (!pdfViewer || !pdfViewer.contentWindow) {
                console.warn('内嵌iframe未准备好');
                return;
            }

            // 等待PDFViewerApplication加载完成
            let attempts = 0;
            const maxAttempts = 50;
            const waitForPdfApp = () => {
                return new Promise((resolve) => {
                    const check = () => {
                        attempts++;
                        if (attempts > maxAttempts) {
                            resolve(null);
                            return;
                        }

                        const pdfApp = pdfViewer.contentWindow.PDFViewerApplication;
                        if (pdfApp && pdfApp.pdfDocument && pdfApp.pdfViewer) {
                            resolve(pdfApp);
                        } else {
                            setTimeout(check, 100);
                        }
                    };
                    check();
                });
            };

            const pdfApp = await waitForPdfApp();
            if (!pdfApp) {
                console.warn('等待PDF加载超时');
                return;
            }

            // 将缓存的PDF数据加载到viewer
            // 注意：这需要重新加载PDF，因为标注是嵌入在PDF数据中的
            const blob = new Blob([cachedData], { type: 'application/pdf' });
            const objectUrl = URL.createObjectURL(blob);

            // 使用PDF.js的open方法加载带标注的PDF
            if (typeof pdfApp.open === 'function') {
                await pdfApp.open({ url: objectUrl });
                this.debugLog('✅ PDF标注数据已恢复');

                // 清理URL对象
                setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
            }
        } catch (error) {
            console.warn('恢复PDF标注失败:', error);
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

    buildSearchVariants(text = '') {
        const clean = (text || '').trim();
        if (!clean) return [];
        const tokens = clean.split(/\s+/).filter(Boolean);
        const variants = [clean];
        let dropFront = 0;
        let dropBack = 0;
        const maxDrops = Math.max(0, tokens.length - 2);
        let step = 0;
        while (dropFront + dropBack < maxDrops) {
            if (step % 2 === 0) dropFront++;
            else dropBack++;
            step++;
            const slice = tokens.slice(dropFront, tokens.length - dropBack);
            if (slice.length >= 2) {
                variants.push(slice.join(' '));
            }
        }
        // 进一步字符级缩短（处理用户手动删几个字母的情况）
        const sanitized = clean.replace(/[，。！？、,.!?;:]/g, ' ').trim();
        if (sanitized && sanitized !== clean) variants.push(sanitized);
        const base = sanitized || clean;
        const maxTrim = Math.min(6, Math.max(0, Math.floor(base.length / 2) - 2));
        for (let i = 1; i <= maxTrim; i++) {
            const candidate = base.slice(i, base.length - i).trim();
            if (candidate.length >= 4) variants.push(candidate);
        }
        return Array.from(new Set(variants)).filter(Boolean);
    }

    runPdfSearch(pdfApp, query) {
        return new Promise((resolve) => {
            let found = false;
            let total = 0;
            const cleanup = () => {
                pdfApp.eventBus.off('updatefindcontrolstate', resultListener);
                pdfApp.eventBus.off('updatefindmatchescount', matchListener);
            };
            const resultListener = (evt) => {
                if (evt.state === 1) {
                    found = true;
                }
            };
            const matchListener = (evt) => {
                if (evt.matchesCount) {
                    total = evt.matchesCount.total || 0;
                    if (total > 0) {
                        found = true;
                        cleanup();
                        resolve({ found, total });
                    }
                }
            };

            pdfApp.eventBus.on('updatefindcontrolstate', resultListener);
            pdfApp.eventBus.on('updatefindmatchescount', matchListener);
            pdfApp.eventBus.dispatch('findbarclose');
            pdfApp.eventBus.dispatch('find', {
                source: window,
                type: 'find',
                query,
                phraseSearch: true,
                caseSensitive: false,
                highlightAll: true,
                findPrevious: false
            });

            setTimeout(() => {
                cleanup();
                resolve({ found, total });
            }, 1500);
        });
    }

    // 跳转到指定页面并搜索（简化版：直接搜索全文，滚动到第一个结果）
    jumpToPage(page, searchText = '', valuePath = null) {
        try {
            const cleanText = searchText ? searchText.trim() : '';
            this.lastGotoAttemptText = cleanText;

            // 检查是否在独立窗口模式
            if (this.isPdfPopupMode && this.pdfPopupWindow && !this.pdfPopupWindow.closed) {
                // 在独立窗口中执行搜索（不依赖内嵌iframe的状态）
                try {
                    // 高亮右侧面板（如果存在）
                    const rightPanel = document.querySelector('.right-panel');
                    if (rightPanel) {
                        rightPanel.classList.remove('panel-highlight');
                        void rightPanel.offsetWidth;
                        rightPanel.classList.add('panel-highlight');
                        setTimeout(() => rightPanel.classList.remove('panel-highlight'), 800);
                    }

                    // 等待独立窗口中的PDF.js加载完成
                    let checkAttempts = 0;
                    const maxAttempts = 50; // 最多等待5秒
                    const checkAndSearch = () => {
                        checkAttempts++;
                        if (checkAttempts > maxAttempts) {
                            this.showNotification('PDF viewer not ready', 'error');
                            return;
                        }

                        if (!this.pdfPopupWindow || this.pdfPopupWindow.closed) {
                            console.log('独立窗口已关闭');
                            return;
                        }

                        const popupDoc = this.pdfPopupWindow.document;
                        const popupIframe = popupDoc.getElementById('pdfFrame');
                        if (!popupIframe || !popupIframe.contentWindow) {
                            setTimeout(checkAndSearch, 100);
                            return;
                        }
                        const pdfJsWindow = popupIframe.contentWindow;
                        if (!pdfJsWindow.PDFViewerApplication) {
                            setTimeout(checkAndSearch, 100);
                            return;
                        }
                        const pdfApp = pdfJsWindow.PDFViewerApplication;

                        // 检查PDF是否已完全加载
                        if (!pdfApp.pdfDocument || !pdfApp.pdfViewer) {
                            setTimeout(checkAndSearch, 100);
                            return;
                        }

                        // 等待eventBus准备就绪
                        if (!pdfApp.eventBus) {
                            setTimeout(checkAndSearch, 100);
                            return;
                        }

                        // 确保PDF已渲染至少一页
                        const viewerContainer = pdfJsWindow.document.querySelector('#viewerContainer');
                        if (!viewerContainer || viewerContainer.children.length === 0) {
                            setTimeout(checkAndSearch, 100);
                            return;
                        }

                        // 执行搜索或跳转
                        if (cleanText) {
                            this.executeSearchAndScroll(pdfApp, cleanText, valuePath, pdfJsWindow);
                        } else if (page) {
                            this.smoothScrollToPage(pdfApp, parseInt(page));
                        }
                        // 聚焦独立窗口
                        this.pdfPopupWindow.focus();
                    };
                    checkAndSearch();
                    return;
                } catch (error) {
                    this.showNotification('Popup window search failed', 'error');
                    return;
                }
            }

            // 内嵌模式：需要检查PDF是否已加载
            if (!this.currentPdfUrl) {
                this.showNotification('No PDF loaded', 'info');
                return;
            }

            // 高亮右侧面板
            const rightPanel = document.querySelector('.right-panel');
            if (rightPanel) {
                rightPanel.classList.remove('panel-highlight');
                void rightPanel.offsetWidth;
                rightPanel.classList.add('panel-highlight');
                setTimeout(() => rightPanel.classList.remove('panel-highlight'), 800);
            }

            // 使用主窗口的iframe
            const pdfViewer = document.getElementById('pdfViewer');
            if (!pdfViewer) {
                this.showNotification('PDF viewer not found', 'warning');
                return;
            }

            const pdfWindow = pdfViewer.contentWindow;
            if (!pdfWindow || !pdfWindow.PDFViewerApplication) {
                console.error('❌ PDF.js未初始化');
                return;
            }

            const pdfApp = pdfWindow.PDFViewerApplication;

            // 如果有搜索文本，执行全文搜索并滚动
            if (cleanText) {
                this.executeSearchAndScroll(pdfApp, cleanText, valuePath, pdfWindow);
            } else if (page) {
                // 如果没有搜索文本，丝滑跳转到页码
                this.smoothScrollToPage(pdfApp, parseInt(page));
            }

        } catch (error) {
            this.showNotification('Operation failed', 'error');
        }
    }

    // 丝滑滚动到指定页码
    smoothScrollToPage(pdfApp, targetPage) {
        try {

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
                pdfApp.page = targetPage;
                this.showNotification(`Page ${targetPage}`, 'info');
                return;
            }

            this.debugLog('找到viewerContainer');

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

                this.showNotification(`Page ${targetPage}`, 'info');
            } else {
                const allPages = pdfDoc.querySelectorAll('[data-page-number]');

                // 使用PDF.js API跳转
                pdfApp.page = targetPage;
                this.showNotification(`Page ${targetPage}`, 'info');
            }
        } catch (error) {
            pdfApp.page = targetPage;
            this.showNotification(`Page ${targetPage}`, 'info');
        }
    }

    // 执行搜索并滚动到第一个结果（独立方法）
    executeSearchAndScroll(pdfApp, searchText, valuePath = null, pdfWindow = null) {
        if (!pdfApp || !pdfApp.eventBus) {
            console.error('❌ EventBus不可用');
            this._isSearching = false;
            return;
        }

        const firstVariant = searchText.trim();
        if (!firstVariant) {
            this._isSearching = false;
            return;
        }

        const isSameSearch = this.lastSearchText === firstVariant && this.lastSearchValuePath === valuePath;
        if (isSameSearch && this.searchMatchCount > 1) {
            this.currentMatchIndex = (this.currentMatchIndex + 1) % this.searchMatchCount;
            pdfApp.eventBus.dispatch('find', {
                source: window,
                type: 'again',
                query: this.lastSearchText,
                phraseSearch: true,
                caseSensitive: false,
                highlightAll: true,
                findPrevious: false
            });
            setTimeout(() => {
                this.scrollToCurrentMatch(pdfApp);
                this.schedulePdfHighlightAutoClear(pdfWindow);
                this._isSearching = false;
            }, 300);
            return;
        } else if (isSameSearch && this.searchMatchCount === 1) {
            setTimeout(() => {
                this.scrollToCurrentMatch(pdfApp);
                this.schedulePdfHighlightAutoClear(pdfWindow);
                this._isSearching = false;
            }, 100);
            return;
        }

        const trySearch = async () => {
            try {
                this.searchMatchCount = 0;
                this.currentMatchIndex = 0;
                let usedQuery = '';
                let total = 0;
                let matchedVariant = '';

                // 先尝试原始文本（快速匹配）
                this.showNotification('Searching in PDF...', 'info');
                const firstResult = await this.runPdfSearch(pdfApp, firstVariant, valuePath);

                if (firstResult.total > 0) {
                    // 首次匹配成功，无需深度检索
                    usedQuery = firstVariant;
                    total = firstResult.total;
                    matchedVariant = firstVariant;
                } else {
                    // 首次未找到，开始深度检索
                    this.showNotification('Deep searching in PDF...', 'info');
                    const variants = this.buildSearchVariants(searchText);
                    const tracker = (typeof this.createStatusProgressTracker === 'function')
                        ? this.createStatusProgressTracker('Deep searching in PDF')
                        : null;
                    if (tracker) {
                        tracker.update('Deep searching in PDF...', 0);
                    }

                    for (let i = 1; i < variants.length; i++) {
                        const query = variants[i];
                        const result = await this.runPdfSearch(pdfApp, query, valuePath);
                        if (tracker) {
                            const percent = Math.round((i / Math.max(1, variants.length - 1)) * 100);
                            tracker.update(`Deep searching in PDF (${i}/${variants.length - 1})`, percent);
                        }
                        if (result.total > 0) {
                            usedQuery = query;
                            total = result.total;
                            matchedVariant = query;
                            break;
                        }
                    }
                    if (tracker) {
                        tracker.finish(total > 0 ? 'Deep search match found' : 'Deep search finished');
                    }
                }

                if (total > 0) {
                    this.lastSearchText = usedQuery;
                    this.lastSearchValuePath = valuePath;
                    this.searchMatchCount = total;
                    this.currentMatchIndex = 0;
                    if (matchedVariant && matchedVariant !== (this.lastGotoAttemptText || variants[0])) {
                        // 替换 goto 文本：链接自身 & 对应数据源
                        const link = this.lastGotoLink;
                        const oldText = this.lastGotoAttemptText || variants[0];
                        if (link) {
                            link.dataset.quoteText = matchedVariant;
                            if (link.classList.contains('goto-link') && link.textContent) {
                                link.textContent = matchedVariant;
                            }
                            const linkValuePath = link.dataset.valuePath || '';
                            const linkJsonPath = link.dataset.jsonPath || '';
                            if (linkValuePath) {
                                if (linkJsonPath) {
                                    await this.updateGotoTextInFile(linkJsonPath, linkValuePath, matchedVariant, 0, oldText);
                                } else {
                                    this.updateGotoText(linkValuePath, matchedVariant, 0);
                                }
                            } else if (oldText) {
                                await this.updateMarkdownGotoText(oldText, matchedVariant, 0, { replaceAllMatches: false, valuePath });
                            }
                        } else if (oldText) {
                            await this.updateMarkdownGotoText(oldText, matchedVariant, 0, { replaceAllMatches: false, valuePath });
                        }
                        this.showNotification(`Adjusted goto text to: ${matchedVariant}`, 'success');
                    }
                    setTimeout(() => {
                        this.scrollToCurrentMatch(pdfApp);
                        this.schedulePdfHighlightAutoClear(pdfWindow);
                    }, 200);
                } else {
                    this.lastSearchText = variants[0];
                    this.lastSearchValuePath = valuePath;
                    this.searchMatchCount = 0;
                    this.currentMatchIndex = 0;
                    this.showNotification('No match found in PDF after deep search', 'info');
                }
            } finally {
                // 无论成功或失败，都要重置搜索标志
                this._isSearching = false;
                this._lastClickedLink = null;
                this._lastClickTime = 0;
            }
        };

        trySearch();
    }

    // 终止当前搜索
    abortCurrentSearch() {
        if (!this._isSearching) return;

        this.debugLog('🛑 Aborting current search...');

        // 重置搜索标志
        this._isSearching = false;
        this._lastClickedLink = null;
        this._lastClickTime = 0;

        // 如果使用了 AbortController，可以在这里取消请求
        // if (this._currentSearchAbortController) {
        //     this._currentSearchAbortController.abort();
        //     this._currentSearchAbortController = null;
        // }

        // 重置搜索状态
        this.searchMatchCount = 0;
        this.currentMatchIndex = 0;

        this.showNotification('Search aborted', 'info');
    }

    // 滚动到当前匹配结果的中央（丝滑动画）
    scrollToCurrentMatch(pdfApp) {
        try {
            const pdfViewer = pdfApp.pdfViewer;
            if (!pdfViewer) {
                console.warn('⚠️ pdfViewer不可用');
                return;
            }

            // 获取PDF文档（需要根据是否在独立窗口来判断）
            let pdfDoc = null;

            // 检查是否在独立窗口模式
            if (this.isPdfPopupMode && this.pdfPopupWindow && !this.pdfPopupWindow.closed) {
                // 独立窗口模式：从独立窗口获取文档
                try {
                    const popupIframe = this.pdfPopupWindow.document.getElementById('pdfFrame');
                    if (popupIframe && popupIframe.contentWindow) {
                        pdfDoc = popupIframe.contentWindow.document;
                    }
                } catch (e) {
                    console.warn('⚠️ 无法访问独立窗口文档:', e);
                }
            } else {
                // 内嵌模式：从主窗口iframe获取文档
                const pdfIframe = document.querySelector('#pdfViewer');
                if (pdfIframe && pdfIframe.contentWindow) {
                    pdfDoc = pdfIframe.contentWindow.document;
                }
            }

            if (!pdfDoc) {
                console.warn('⚠️ 找不到PDF文档');
                return;
            }

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
            this.showNotification('Parent object not found', 'error');
            return;
        }

        // 检查新key是否已存在
        if (parent.hasOwnProperty(newKey)) {
            this.showNotification('Field name already exists', 'error');
            return;
        }

        // 重命名key：复制值到新key，删除旧key
        parent[newKey] = parent[oldKey];
        delete parent[oldKey];

        // 标记为有未保存的修改
        this.hasUnsavedChanges = true;
        this.tempDataCache[this.currentFile] = this.currentData;
        this.updateSaveButtonState();

        // 重新渲染
        this.renderStructuredView();
        this.renderFlatView();
        this.setupEditableListeners();

        this.showNotification(`Field renamed: ${oldKey} → ${newKey}`, 'success');
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

        const modal = document.getElementById('editModal');
        const content = modal.querySelector('.modal-content');
        // 重新居中并显示
        content.style.left = '50%';
        content.style.top = '50%';
        content.style.transform = 'translate(-50%, -50%)';
        modal.classList.add('active');
    }
    closeEditModal() {
        document.getElementById('editModal').classList.remove('active');
        this.editingPath = null;
    }

    async handleGotoLinkEdit(link) {
        // 处理Cmd/Ctrl+点击goto链接进入编辑模式
        const current = link.dataset.quoteText || (link.textContent || '').trim() || '';
        const valuePath = link.dataset.valuePath || '';
        const jsonPath = link.dataset.jsonPath || '';
        const allGotoLinks = Array.from(document.querySelectorAll('.goto-link'));
        const samePathLinks = allGotoLinks.filter(l => (l.dataset.valuePath || '') === valuePath);
        const idxInPath = samePathLinks.indexOf(link);
        const idx = idxInPath >= 0 ? idxInPath : (link.dataset.quoteIndex !== undefined ? parseInt(link.dataset.quoteIndex, 10) : 0);

        // 打开编辑对话框
        const next = await this.openGotoEditModal(current);
        if (next === null) return;

        // 更新文本（不触发搜索）
        if (valuePath) {
            if (jsonPath) {
                await this.updateGotoTextInFile(jsonPath, valuePath, next, isNaN(idx) ? 0 : idx, current);
            } else {
                this.updateGotoText(valuePath, next, isNaN(idx) ? 0 : idx);
            }
        } else {
            await this.updateMarkdownGotoText(current, next, isNaN(idx) ? 0 : idx);
        }
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

    async testGotoSearch() {
        // Test if the text in the edit box can be found in the PDF
        const textarea = document.getElementById('gotoEditTextarea');
        if (!textarea) return;

        const searchText = textarea.value.trim();
        if (!searchText) {
            this.showNotification('Please enter text to test', 'info');
            return;
        }

        // Get PDFViewerApplication
        let pdfApp = null;
        if (this.isPdfPopupMode && this.pdfPopupWindow && !this.pdfPopupWindow.closed) {
            const popupIframe = this.pdfPopupWindow.document.getElementById('pdfFrame');
            if (popupIframe && popupIframe.contentWindow) {
                pdfApp = popupIframe.contentWindow.PDFViewerApplication;
            }
        } else {
            const iframe = document.getElementById('pdfViewer');
            if (iframe && iframe.contentWindow) {
                pdfApp = iframe.contentWindow.PDFViewerApplication;
            }
        }

        if (!pdfApp || !pdfApp.pdfDocument) {
            this.showNotification('PDF not loaded, cannot test search', 'error');
            return;
        }

        this.showNotification('Testing search...', 'info');

        // Execute search test
        try {
            const result = await this.runPdfSearch(pdfApp, searchText);

            if (result.total > 0) {
                this.showNotification(`Found ${result.total} match(es)`, 'success');

                // Optional: scroll to first match
                setTimeout(() => this.scrollToCurrentMatch(pdfApp), 200);
            } else {
                // Try variant search
                this.showNotification('No exact match found, trying variants...', 'info');
                const variants = this.buildSearchVariants(searchText);

                let foundVariant = null;
                let foundCount = 0;

                for (let i = 1; i < variants.length && i < 5; i++) {
                    const variantResult = await this.runPdfSearch(pdfApp, variants[i]);
                    if (variantResult.total > 0) {
                        foundVariant = variants[i];
                        foundCount = variantResult.total;
                        break;
                    }
                }

                if (foundVariant) {
                    this.showNotification(`Found variant match: "${foundVariant}" (${foundCount} match(es))`, 'success');
                    setTimeout(() => this.scrollToCurrentMatch(pdfApp), 200);
                } else {
                    this.showNotification('No match found, consider modifying the text', 'error');
                }
            }
        } catch (error) {
            console.error('Search test failed:', error);
            this.showNotification('Search test failed', 'error');
        }
    }

    async saveEditedValue() {
        if (this.isEditLocked) {
            this.showLockedNotification('保存字段');
            return;
        }
        if (!this.editingPath) return;

        const newValue = document.getElementById('editTextarea').value;
        const keyInput = document.getElementById('editKeyInput');
        const inputKey = keyInput ? keyInput.value.trim() : '';

        // Update data
        let current = this.currentData;
        for (let i = 0; i < this.editingPath.length - 1; i++) {
            current = current[this.editingPath[i]];
        }

        let lastKey = this.editingPath[this.editingPath.length - 1];

        // 如果用户修改了字段名，进行重命名
        if (inputKey && inputKey !== lastKey) {
            if (current.hasOwnProperty(inputKey)) {
                this.showNotification(`Field name already exists: ${inputKey}`, 'error');
                return;
            }
            current[inputKey] = current[lastKey];
            delete current[lastKey];
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
        const parentKey = this.editingPath.length >= 2 ? this.editingPath[this.editingPath.length - 2] : '';
        if (parentKey && parentKey.toLowerCase() === 'wos_data' && (keyLower === 'wos_id' || keyLower === 'wosid')) {
            this.syncWosLinks(current);
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
        this.updateUndoButtonState();

        this.closeEditModal();

        // 如果更新了 meta_info.pdf_path，则立即按新路径加载 PDF
        if (shouldReloadPdf && nextPdfFile) {
            const projectPath = this.getProjectKey();
            const { relPath, fileName } = this.normalizePdfRel(nextPdfFile);
            const pdfName = fileName || nextPdfFile;
            const primaryUrl = relPath
                ? `/${projectPath}/${relPath}`
                : this.getPdfUrl(pdfName);
            const fallbackUrl = relPath ? null : `/${projectPath}/papers/${pdfName}`;
            this.currentPdfUrl = primaryUrl;
            this.pendingPdfUrl = primaryUrl;
            this.pendingPdfFallback = fallbackUrl;
            this.currentPdfLoadToken++;
            this.resetPdfViewerFrame();
            this.lastPdfLoadedUrl = '';
            this.updatePdfPlaceholder('pending');
            try {
                await this.ensurePdfLoaded();
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
        if (confirm(`确定删除字段 "${lastKey}"？`)) {
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

    updateViewTabs() {
        const tabs = document.querySelectorAll('.tab-btn');
        if (!tabs.length) return;
        tabs.forEach(b => b.classList.remove('active'));
        let target = 'structured';
        if ((this.currentView || 'structured') === 'markdown') {
            target = this.isDraftViewActive ? 'draft' : 'markdown';
        } else if ((this.currentView || 'structured') === 'settings') {
            target = 'settings';
        }
        const active = document.querySelector(`.tab-btn[data-view="${target}"]`);
        if (active) active.classList.add('active');
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

        if (!category) {
            this.showNotification('Please select a category', 'error');
            return;
        }

        if (category === 'custom' && !customKey) {
            this.showNotification('Please enter a custom key', 'error');
            return;
        }

        if (!content.trim()) {
            this.showNotification('Please enter content', 'error');
            return;
        }

        // 确定要使用的键名
        const key = category === 'custom' ? customKey : category;

        const newItem = content.trim();
        // 处理不同数据形态：如果已有数组则push；如果不存在则按字符串+loc对象；如果已有非数组则直接覆盖
        if (Array.isArray(this.currentData[key])) {
            this.currentData[key].push(newItem);
        } else if (this.currentData[key] === undefined) {
            // 新建为标量字段，loc为对象
            this.currentData[key] = newItem;
        } else {
            // 已存在但不是数组：覆盖现有值及loc
            this.currentData[key] = newItem;
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
        this.showNotification(`Added to ${key}`, 'success');
    }

    // 创建一个空的类字段模板，便于用户快速编辑
    createEmptySectionTemplate() {
        if (!this.currentData) {
            this.showNotification('Please load a JSON file first', 'error');
            return;
        }

        let sectionName = prompt('Enter new section name (top-level key):', 'new_section');
        if (!sectionName) return;
        sectionName = sectionName.trim();
        if (!sectionName) return;

        if (this.currentData.hasOwnProperty(sectionName)) {
            this.showNotification(`Field "${sectionName}" already exists`, 'error');
            return;
        }

        // 提供一个可编辑的占位结构
        const template = {
            placeholder_field: ''
        };

        this.currentData[sectionName] = template;

        this.hasUnsavedChanges = true;
        this.tempDataCache[this.currentFile] = this.currentData;
        this.updateSaveButtonState();
        this.renderStructuredView();
        this.renderFlatView();
        this.setupEditableListeners();
        this.showNotification(`Created section "${sectionName}", double-click key or value to edit`, 'success');
    }

    // Add child field under specified section (with _loc placeholder)
    addChildField(sectionKey) {
        if (!this.currentData || !this.currentData[sectionKey] || typeof this.currentData[sectionKey] !== 'object') {
            this.showNotification('Current section unavailable, cannot add field', 'error');
            return;
        }

        const parent = this.currentData[sectionKey];
        let key = prompt(`Add child field under "${sectionKey}", enter field name:`, 'new_field');
        if (!key) return;
        key = key.trim();
        if (!key) return;

        // If name exists, auto-append sequence number
        let finalKey = key;
        let idx = 1;
        while (parent.hasOwnProperty(finalKey)) {
            finalKey = `${key}_${idx++}`;
        }

        parent[finalKey] = '';

        this.hasUnsavedChanges = true;
        this.tempDataCache[this.currentFile] = this.currentData;
        this.updateSaveButtonState();
        this.renderStructuredView();
        this.renderFlatView();
        this.setupEditableListeners();
        this.showNotification(`Added child field "${finalKey}", double-click to edit`, 'success');
    }

    // Quick insert robustness check template
    createRobustnessTemplate() {
        if (!this.currentData) {
            this.showNotification('Please load a JSON file first', 'error');
            return;
        }

        const tplKey = 'robustness_checks';
        if (this.currentData[tplKey]) {
            if (!confirm('robustness_checks already exists, overwrite existing content?')) return;
        }

        this.currentData[tplKey] = {
            endogeneity_method: '',
            parallel_trend_check: ''
        };

        this.hasUnsavedChanges = true;
        this.tempDataCache[this.currentFile] = this.currentData;
        this.updateSaveButtonState();
        this.renderStructuredView();
        this.renderFlatView();
        this.setupEditableListeners();
        this.showNotification('Robustness check template added, fields can be edited directly', 'success');
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
        if (this._doiCopyBtnHandler) {
            document.removeEventListener('click', this._doiCopyBtnHandler);
        }

        this._locationLinkHandler = (e) => {
            const target = e.target;
            if (!target || typeof target.closest !== 'function') return;
            const link = target.classList.contains('location-link') ? target : target.closest('.location-link');

            if (link) {
                e.preventDefault();

                // 检查是否按下Cmd/Ctrl键 - 如果是，则进入编辑模式（不受搜索限制）
                if (e.metaKey || e.ctrlKey) {
                    // 进入编辑模式，不触发搜索
                    this.handleGotoLinkEdit(link);
                    return;
                }

                // 如果正在搜索，先终止之前的搜索
                if (this._isSearching) {
                    this.abortCurrentSearch();
                }

                // 检查是否是同一个链接且在200ms内（防止连续双击）
                const now = Date.now();
                const isSameLink = this._lastClickedLink === link;
                const timeSinceLastClick = now - this._lastClickTime;

                if (isSameLink && timeSinceLastClick < 200) {
                    // 过快的重复点击，忽略
                    return;
                }

                // 记录当前点击
                this._lastClickedLink = link;
                this._lastClickTime = now;
                this._isSearching = true;
                if (this._lastClickTimer) {
                    clearTimeout(this._lastClickTimer);
                    this._lastClickTimer = null;
                }

                // 正常点击：执行跳转搜索
                this.lastGotoLink = link;
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

        // 不再需要双击处理器
        this._locationLinkDblHandler = null;

        this._apaBtnHandler = async (e) => {
            const btn = e.target.closest('.apa-fetch-btn');
            if (!btn) return;

            // If it's a PDF, WoS or DOI URL button, don't handle APA generation
            if (btn.dataset.pdf || btn.dataset.wosUrl || btn.dataset.doiUrl) {
                return;
            }

            e.preventDefault();
            if (btn.dataset.disabled === '1') {
                this.showNotification('No DOI found, cannot generate APA', 'error');
                return;
            }
            const doi = btn.dataset.doi || this.findFirstDoiInCurrentData();
            if (!doi) {
                this.showNotification('No DOI found, cannot generate APA', 'error');
                return;
            }
            btn.disabled = true;
            btn.classList.add('loading');
            try {
                const citeFn = window.citeDoiToApa;
                const text = citeFn ? await citeFn(doi) : null;
                if (!text) throw new Error('Failed to get APA text');
                await this.writeTextToClipboard(text);
                this.showNotification('APA citation copied to clipboard', 'success');
                // Write back to meta_info.apa for display and saving
                if (!this.currentData.meta_info || typeof this.currentData.meta_info !== 'object') {
                    this.currentData.meta_info = {};
                }
                this.currentData.meta_info.apa = text;
                this.hasUnsavedChanges = true;
                if (this.currentFile) {
                    this.tempDataCache[this.currentFile] = this.currentData;
                }
                // Immediately update the button's hover content
                btn.setAttribute('data-apa-text', text);
                // Re-render views to display APA text
                this.updateSaveButtonState();
                this.renderStructuredView();
                this.renderFlatView();
                this.setupEditableListeners();
                this.updateUndoButtonState();
            } catch (err) {
                console.error('APA generation failed:', err);
                this.showNotification(`APA generation failed: ${err.message}`, 'error');
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
        this._doiCopyBtnHandler = async (e) => {
            const doiLink = e.target.closest('.doi-link');
            if (doiLink) {
                const href = doiLink.getAttribute('href') || '';
                if (/doi\.org/i.test(href)) {
                    e.preventDefault();
                    e.stopPropagation();
                    const doi = this.normalizeDoiString(href);
                    if (doi) {
                        await this.openFileByCitationDoi(doi);
                        return;
                    }
                }
            }
            // Check if it's a WoS or DOI URL button (using apa-fetch-btn style)
            let btn = e.target.closest('.apa-fetch-btn');
            if (btn) {
                e.preventDefault();
                e.stopPropagation();

                const wosUrl = btn.dataset.wosUrl || '';
                if (wosUrl) {
                    window.open(wosUrl, '_blank');
                    return;
                }

                const doiUrl = btn.dataset.doiUrl || '';
                if (doiUrl) {
                    window.open(doiUrl, '_blank');
                    return;
                }

                // Check if it's a PDF copy button
                const pdf = btn.dataset.pdf || '';
                if (pdf) {
                    if (btn.dataset.busy === '1') return;
                    btn.dataset.busy = '1';
                    btn.classList.add('copy-guard-shake');
                    btn.disabled = true;
                    try {
                        await this.copyPdfFileByName(pdf);
                    } catch (err) {
                        console.error('Failed to copy PDF:', err);
                        this.showNotification(`Failed to copy PDF: ${err.message}`, 'error');
                    } finally {
                        setTimeout(() => {
                            btn.dataset.busy = '0';
                            btn.classList.remove('copy-guard-shake');
                            btn.disabled = false;
                        }, 600);
                    }
                    return;
                }
            }

            btn = e.target.closest('.doi-copy-btn');
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();

            const doi = btn.dataset.doi || '';
            if (!doi.trim()) {
                this.showNotification('DOI cannot be empty', 'error');
                return;
            }
            try {
                await this.writeTextToClipboard(doi);
                // Show copy success feedback
                const originalHtml = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(() => {
                    btn.innerHTML = originalHtml;
                }, 1500);
                this.showNotification(`DOI copied: ${doi}`, 'success');
            } catch (err) {
                console.error('Failed to copy DOI:', err);
                this.showNotification(`Copy failed: ${err.message}`, 'error');
            }
        };
        this._pdfCopyBtnHandler = async (e) => {
            const btn = e.target.closest('.pdf-path-copy-btn');
            if (!btn) return;
            if (btn.dataset.busy === '1') return;
            btn.dataset.busy = '1';
            btn.classList.add('copy-guard-shake');
            btn.disabled = true;
            e.preventDefault();
            e.stopPropagation();
            const pdf = btn.dataset.pdf || '';
            if (!pdf) return;
            try {
                await this.copyPdfFileByName(pdf);
            } catch (err) {
                console.error('Failed to copy PDF:', err);
                this.showNotification(`Failed to copy PDF: ${err.message}`, 'error');
            } finally {
                setTimeout(() => {
                    btn.dataset.busy = '0';
                    btn.classList.remove('copy-guard-shake');
                    btn.disabled = false;
                }, 600);
            }
        };
        this._pdfDeleteBtnHandler = async (e) => {
            const btn = e.target.closest('.pdf-path-delete-btn');
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            const pdf = btn.dataset.pdf || '';
            if (!pdf) return;
            const ok = window.confirm(`Are you sure you want to delete PDF "${pdf}"? This action cannot be undone.`);
            if (!ok) return;
            try {
                await this.deletePdfFileByName(pdf);
                this.showNotification(`PDF deleted: ${pdf}`, 'success');
            } catch (err) {
                console.error('Failed to delete PDF:', err);
                this.showNotification(`Failed to delete PDF: ${err.message}`, 'error');
            }
        };

        document.addEventListener('click', this._locationLinkHandler);
        // 不再需要双击监听器 - 改为Cmd/Ctrl+点击
        document.addEventListener('click', this._apaBtnHandler);
        document.addEventListener('mouseover', this._apaBtnHoverHandler);
        document.addEventListener('mouseout', this._apaBtnLeaveHandler);
        document.addEventListener('click', this._doiCopyBtnHandler);
        document.addEventListener('click', this._pdfCopyBtnHandler);
        document.addEventListener('click', this._pdfDeleteBtnHandler);
        document.addEventListener('click', (e) => {
            if (this.projectInfoVisible) {
                const panel = document.getElementById('projectInfoPanel');
                const btn = document.getElementById('projectInfoBtn');
                if (panel && panel.classList.contains('settings-panel')) {
                    return;
                }
                if (panel && !panel.contains(e.target) && !(btn && btn.contains(e.target))) {
                    this.toggleProjectInfoPanel(false, { skipClose: true });
                }
            }
            if (this.shortcutsVisible) {
                const panel = document.getElementById('shortcutsInfoPanel');
                const btn = document.getElementById('shortcutsInfoBtn');
                if (panel && panel.classList.contains('settings-panel')) {
                    return;
                }
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
            if (panel.classList.contains('settings-panel')) return;
            const insidePanel = panel.contains(e.target);
            const fromBtn = btn && btn.contains(e.target);
            if (!insidePanel && !fromBtn) {
                this.toggleProjectInfoPanel(false, { skipClose: true });
            }
        });
        document.addEventListener('click', (e) => {
            if (!this.shortcutsVisible) return;
            const panel = document.getElementById('shortcutsInfoPanel');
            const btn = document.getElementById('shortcutsInfoBtn');
            if (!panel) return;
            if (panel.classList.contains('settings-panel')) return;
            const insidePanel = panel.contains(e.target);
            const fromBtn = btn && btn.contains(e.target);
            if (!insidePanel && !fromBtn) {
                this.toggleShortcutsPanel(false, { skipClose: true });
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
                if (confirm(`删除字段 "${key}"？`)) {
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
        const iframe = document.getElementById('pdfViewer');
        const pdfWindow = iframe?.contentWindow;
        this.clearPdfHighlightsForWindow(pdfWindow);
    }

    clearPdfHighlightsForWindow(pdfWindow) {
        try {
            if (this._pdfHighlightTimer) {
                clearTimeout(this._pdfHighlightTimer);
                this._pdfHighlightTimer = null;
            }
            const pdfApp = pdfWindow?.PDFViewerApplication;
            if (pdfApp?.eventBus) {
                pdfApp.eventBus.dispatch('findbarclose');
            }
            // 不清除用户的文本选择，避免影响手动选中
        } catch (err) {
            console.warn('清除 PDF 高亮失败:', err);
        }
    }

    schedulePdfHighlightAutoClear(pdfWindow) {
        if (!pdfWindow) return;
        if (this._pdfHighlightTimer) {
            clearTimeout(this._pdfHighlightTimer);
        }
        this._pdfHighlightTimer = setTimeout(() => {
            this.clearPdfHighlightsForWindow(pdfWindow);
        }, 3000);

        const doc = pdfWindow.document;
        if (!doc) return;
        if (!this._pdfHighlightClickHandler) {
            this._pdfHighlightClickHandler = () => {
                if (this._pdfHighlightBoundWindow) {
                    const sel = this._pdfHighlightBoundWindow?.getSelection?.();
                    if (sel && !sel.isCollapsed) {
                        return;
                    }
                    this.clearPdfHighlightsForWindow(this._pdfHighlightBoundWindow);
                }
            };
        }
        if (this._pdfHighlightBoundWindow && this._pdfHighlightBoundWindow !== pdfWindow) {
            try {
                this._pdfHighlightBoundWindow.document.removeEventListener('click', this._pdfHighlightClickHandler, true);
            } catch (_err) {
                // ignore detach errors
            }
        }
        if (this._pdfHighlightBoundWindow !== pdfWindow) {
            this._pdfHighlightBoundWindow = pdfWindow;
            doc.addEventListener('click', this._pdfHighlightClickHandler, true);
        }
    }

    showNotification(message, type = 'info') {
        this.debugLog(`${type.toUpperCase()}: ${message}`);
        this.showStatusTag(message, type);
    }

    async saveToFile(options = {}) {
        const { silent = false, force = false } = options;
        if (!this.currentFile && this.currentFileBase) {
            const fallback = this.getPathsForBase(this.currentFileBase)?.json || '';
            if (fallback) this.currentFile = fallback;
        }
        if (!this.currentFile || !this.currentData) return;
        const hasPendingChanges = this.hasUnsavedChanges || !!this.tempDataCache[this.currentFile];
        // Only save when there are pending changes; avoid touching lastupdate otherwise
        if (!hasPendingChanges && !force) {
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
            const projectPath = this.getRequiredProjectPath();
            if (!projectPath) return;

            // 发送POST请求到服务器保存文件
            const response = await fetch('/save-json', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    projectPath,
                    filename: this.currentFile,
                    content: jsonString
                })
            });

            if (!response.ok) {
                throw new Error(`Save failed: ${response.statusText}`);
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
                this.showNotification(`${this.currentFile} saved`, 'success');
            }
            this.debugLog('File saved:', result);
        } catch (error) {
            console.error('Error saving file:', error);
            this.showNotification(`✗ Save failed: ${error.message}`, 'error');
        }
    }
}

window.PaperStatsApp = PaperStatsApp;

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new PaperStatsApp();

    // Make app globally accessible for debugging
    window.paperStats = app;

    // Initialize AutoSave Manager
    if (window.AutoSaveManager && window.AutoSaveConfigUI) {
        try {
            app.autoSaveManager = new AutoSaveManager(app);
            app.autoSaveConfigUI = new AutoSaveConfigUI(app.autoSaveManager);
            window.autoSave = app.autoSaveManager;
            console.log('[AutoSave] ✅ 已初始化 | 模式:', app.autoSaveManager.config.mode);

            // 如果之前自动保存面板是打开的，重新渲染内容
            if (app.autoSaveConfigVisible) {
                setTimeout(() => {
                    const container = document.getElementById('autoSaveConfigBody');
                    const panel = document.getElementById('autoSaveConfigPanel');
                    if (container && panel && panel.classList.contains('is-visible')) {
                        app.autoSaveConfigUI.renderInline(container);
                        console.log('[AutoSave] 🔄 恢复面板状态并渲染内容');
                    }
                }, 150);
            }
        } catch (error) {
            console.error('[AutoSave] ❌ 初始化失败:', error);
        }
    } else {
        console.warn('[AutoSave] ⚠️ AutoSaveManager 或 AutoSaveConfigUI 未加载');
    }

    window.testCite = async (dois, mode = 'citep') => {
        const list = Array.isArray(dois) ? dois : [dois];
        return app.formatCitation(list, mode === 'cite' ? 'cite' : 'citep');
    };
    window.clearCitationCache = () => app.clearCitationCache();

    // DOI 缓存管理全局方法
    window.refreshDoiCache = async () => {
        if (!app.doiCacheManager) {
            console.warn('DOI Cache Manager not initialized');
            return;
        }
        console.log('🔄 Refreshing DOI cache...');
        await app.doiCacheManager.clearCache();
        const data = await app.doiCacheManager.buildCache({ notify: true });
        console.log(`✅ DOI cache refreshed: ${data.length} entries`);
        return data;
    };
    window.clearDoiCache = async () => {
        if (!app.doiCacheManager) {
            console.warn('DOI Cache Manager not initialized');
            return;
        }
        await app.doiCacheManager.clearCache();
        console.log('✅ DOI cache cleared');
    };

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

    // 初始化 MD Chat 字体大小控制
    (() => {
        const slider = document.getElementById('mdChatFontSizeSlider');
        const valueDisplay = document.getElementById('mdChatFontSizeValue');
        const control = document.querySelector('.md-chat-font-size-control');
        const chatBody = document.querySelector('.md-chat-body');
        const storageKey = 'mdChatFontSize';

        if (!slider || !valueDisplay || !chatBody || !control) return;
        let hideTimer = null;
        const showSlider = () => {
            control.classList.add('is-slider-visible');
            if (hideTimer) {
                clearTimeout(hideTimer);
                hideTimer = null;
            }
        };
        const scheduleHide = () => {
            if (hideTimer) clearTimeout(hideTimer);
            hideTimer = setTimeout(() => {
                control.classList.remove('is-slider-visible');
            }, 1500);
        };

        // 从本地存储恢复字体大小
        const savedFontSize = localStorage.getItem(storageKey);
        if (savedFontSize) {
            const fontSize = parseInt(savedFontSize, 10);
            slider.value = fontSize;
            valueDisplay.textContent = `${fontSize}px`;
            chatBody.style.fontSize = `${fontSize}px`;
        }

        control.addEventListener('mouseenter', () => {
            showSlider();
        });
        control.addEventListener('mouseleave', () => {
            scheduleHide();
        });
        slider.addEventListener('focus', showSlider);
        slider.addEventListener('blur', scheduleHide);

        // 监听滑杆变化
        slider.addEventListener('input', (e) => {
            const fontSize = e.target.value;
            valueDisplay.textContent = `${fontSize}px`;
            chatBody.style.fontSize = `${fontSize}px`;

            // 保存到本地存储
            try {
                localStorage.setItem(storageKey, fontSize);
            } catch (err) {
                console.warn('无法保存字体大小设置:', err);
            }
        });
    })();

    // 页面关闭/刷新前提示保存
    window.addEventListener('beforeunload', (e) => {
        // 通过localStorage发送关闭信号给独立PDF窗口
        try {
            localStorage.setItem('closePdfPopupWindow', 'true');
        } catch (err) {
            console.warn('无法发送关闭信号:', err);
        }

        // 关闭独立PDF窗口
        if (app.pdfPopupWindow && !app.pdfPopupWindow.closed) {
            try {
                app.pdfPopupWindow.close();
            } catch (err) {
                console.warn('关闭独立PDF窗口失败:', err);
            }
        }

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
            const app = window.paperStats;
            if (app && typeof app.setupEditableListeners === 'function') {
                app.setupEditableListeners();
            }
        }, 100);
    }
});
