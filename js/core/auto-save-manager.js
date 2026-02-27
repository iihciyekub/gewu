/**
 * AutoSaveManager - 优雅的自动保存管理器
 * 参照 VSCode 的文件编辑保存机制设计
 *
 * Features:
 * - 多种自动保存模式（off, afterDelay, onFocusChange, onWindowChange）
 * - 智能防抖机制
 * - 多文件类型支持（JSON, Markdown, Draft）
 * - 保存状态指示和错误处理
 * - 配置持久化
 */

class AutoSaveManager {
    /**
     * 自动保存模式
     * @enum {string}
     */
    static MODES = {
        OFF: 'off',                      // 关闭自动保存
        AFTER_DELAY: 'afterDelay',       // 延迟后自动保存
        ON_FOCUS_CHANGE: 'onFocusChange', // 失去焦点时保存
        ON_WINDOW_CHANGE: 'onWindowChange' // 切换窗口时保存
    };

    /**
     * 文件类型
     * @enum {string}
     */
    static FILE_TYPES = {
        JSON: 'json',
        MARKDOWN: 'markdown',
        DRAFT: 'draft'
    };

    /**
     * 保存状态
     * @enum {string}
     */
    static SAVE_STATUS = {
        IDLE: 'idle',           // 空闲
        PENDING: 'pending',     // 等待保存
        SAVING: 'saving',       // 保存中
        SAVED: 'saved',         // 已保存
        ERROR: 'error'          // 保存失败
    };

    constructor(app) {
        this.app = app;

        // 配置选项
        this.config = {
            mode: AutoSaveManager.MODES.AFTER_DELAY,  // 默认模式
            delay: 1000,                                // 延迟时间（毫秒）
            retryAttempts: 3,                          // 重试次数
            retryDelay: 1000,                          // 重试延迟
            showStatusIndicator: true,                 // 显示状态指示
            silentSave: true                           // 静默保存（不显示通知）
        };

        // 运行时状态
        this.state = {
            json: {
                status: AutoSaveManager.SAVE_STATUS.IDLE,
                timer: null,
                lastSaveTime: null,
                retryCount: 0
            },
            markdown: {
                status: AutoSaveManager.SAVE_STATUS.IDLE,
                timer: null,
                lastSaveTime: null,
                retryCount: 0
            },
            draft: {
                status: AutoSaveManager.SAVE_STATUS.IDLE,
                timer: null,
                lastSaveTime: null,
                retryCount: 0
            }
        };

        // 事件监听器状态
        this.listeners = {
            json: null,
            markdown: null,
            focusListeners: [],
            visibilityListener: null
        };

        this.hooks = {
            dirtyFlags: {},
            methods: {}
        };

        // 加载配置
        this.loadConfig();

        // 初始化
        this.initialize();
    }

    /**
     * 初始化自动保存管理器
     */
    initialize() {
        console.log('[AutoSaveManager] Initializing with mode:', this.config.mode);

        // 根据模式设置监听器
        this.setupListeners();

        // 创建状态指示器元素
        this.createStatusIndicator();
    }

    /**
     * 设置事件监听器
     */
    setupListeners() {
        // 清理现有监听器
        this.removeListeners();

        if (this.config.mode === AutoSaveManager.MODES.OFF) {
            return;
        }

        // JSON 编辑器监听
        if (this.config.mode === AutoSaveManager.MODES.AFTER_DELAY) {
            this.setupDelayListeners();
        }

        // 焦点和窗口切换监听
        if (this.config.mode === AutoSaveManager.MODES.ON_FOCUS_CHANGE ||
            this.config.mode === AutoSaveManager.MODES.ON_WINDOW_CHANGE) {
            this.setupFocusListeners();
        }

        // 窗口可见性监听
        if (this.config.mode === AutoSaveManager.MODES.ON_WINDOW_CHANGE) {
            this.setupVisibilityListener();
        }
    }

    /**
     * 设置延迟模式监听器
     */
    setupDelayListeners() {
        // 监听 hasUnsavedChanges 和 hasUnsavedMarkdownChanges 的变化
        // 通过拦截修改操作来触发自动保存

        // 使用 MutationObserver 监听 DOM 变化（如果有编辑器元素）
        const markdownTextarea = document.getElementById('markdownTextarea');
        if (markdownTextarea) {
            const handler = () => this.scheduleAutoSave(AutoSaveManager.FILE_TYPES.MARKDOWN);
            markdownTextarea.addEventListener('input', handler);
            this.listeners.markdown = { element: markdownTextarea, handler };
        }

        // 监听 JSON 编辑（通过代理 app 的数据修改方法）
        this.setupJsonChangeDetection();
    }

    /**
     * 设置 JSON 变化检测
     */
    setupJsonChangeDetection() {
        // 1) Hook dirty flags so any set triggers autosave
        this.hookDirtyFlag('hasUnsavedChanges', AutoSaveManager.FILE_TYPES.JSON);
        this.hookDirtyFlag('hasUnsavedMarkdownChanges', AutoSaveManager.FILE_TYPES.MARKDOWN);

        // 2) Wrap core mutation helpers if present
        this.wrapMethodOnce('setValueByPath', AutoSaveManager.FILE_TYPES.JSON);
        this.wrapMethodOnce('setValueByPathOnData', AutoSaveManager.FILE_TYPES.JSON);
    }

    hookDirtyFlag(prop, fileType) {
        if (!this.app || this.hooks.dirtyFlags[prop]) return;
        const desc = Object.getOwnPropertyDescriptor(this.app, prop);
        if (desc && !desc.configurable) return;
        let internal = !!this.app[prop];
        Object.defineProperty(this.app, prop, {
            configurable: true,
            enumerable: true,
            get() {
                return internal;
            },
            set: (next) => {
                internal = !!next;
                if (internal) {
                    this.scheduleAutoSave(fileType);
                }
            }
        });
        this.hooks.dirtyFlags[prop] = true;
    }

    wrapMethodOnce(methodName, fileType) {
        if (!this.app || this.hooks.methods[methodName]) return;
        if (typeof this.app[methodName] !== 'function') return;
        const original = this.app[methodName].bind(this.app);
        this.app[methodName] = (...args) => {
            const result = original(...args);
            this.scheduleAutoSave(fileType);
            return result;
        };
        this.hooks.methods[methodName] = true;
    }

    /**
     * 设置焦点监听器
     */
    setupFocusListeners() {
        // Markdown textarea 失去焦点
        const markdownTextarea = document.getElementById('markdownTextarea');
        if (markdownTextarea) {
            const handler = () => {
                if (this.app.hasUnsavedMarkdownChanges) {
                    this.triggerAutoSave(AutoSaveManager.FILE_TYPES.MARKDOWN);
                }
            };
            markdownTextarea.addEventListener('blur', handler);
            this.listeners.focusListeners.push({ element: markdownTextarea, event: 'blur', handler });
        }

        // 窗口失去焦点
        const windowBlurHandler = () => {
            this.saveAllIfNeeded();
        };
        window.addEventListener('blur', windowBlurHandler);
        this.listeners.focusListeners.push({ element: window, event: 'blur', handler: windowBlurHandler });
    }

    /**
     * 设置窗口可见性监听器
     */
    setupVisibilityListener() {
        const handler = () => {
            if (document.hidden) {
                this.saveAllIfNeeded();
            }
        };
        document.addEventListener('visibilitychange', handler);
        this.listeners.visibilityListener = handler;
    }

    /**
     * 移除所有监听器
     */
    removeListeners() {
        // 移除 Markdown 监听器
        if (this.listeners.markdown) {
            const { element, handler } = this.listeners.markdown;
            element.removeEventListener('input', handler);
            this.listeners.markdown = null;
        }

        // 移除焦点监听器
        this.listeners.focusListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.listeners.focusListeners = [];

        // 移除可见性监听器
        if (this.listeners.visibilityListener) {
            document.removeEventListener('visibilitychange', this.listeners.visibilityListener);
            this.listeners.visibilityListener = null;
        }
    }

    /**
     * 调度自动保存（带防抖）
     * @param {string} fileType - 文件类型
     */
    scheduleAutoSave(fileType) {
        if (this.config.mode !== AutoSaveManager.MODES.AFTER_DELAY) {
            return;
        }

        const state = this.state[fileType];
        if (!state) {
            console.warn('[AutoSaveManager] Unknown file type:', fileType);
            return;
        }

        // 清除现有计时器
        if (state.timer) {
            clearTimeout(state.timer);
        }

        // 更新状态为等待中
        this.updateStatus(fileType, AutoSaveManager.SAVE_STATUS.PENDING);

        // 设置新计时器
        state.timer = setTimeout(() => {
            this.triggerAutoSave(fileType);
        }, this.config.delay);
    }

    /**
     * 触发自动保存
     * @param {string} fileType - 文件类型
     */
    async triggerAutoSave(fileType) {
        const state = this.state[fileType];
        if (!state) {
            return;
        }

        // 检查是否需要保存
        if (!this.needsSave(fileType)) {
            this.updateStatus(fileType, AutoSaveManager.SAVE_STATUS.IDLE);
            return;
        }

        // 更新状态为保存中
        this.updateStatus(fileType, AutoSaveManager.SAVE_STATUS.SAVING);

        try {
            // 执行保存
            await this.performSave(fileType);

            // 更新状态为已保存
            this.updateStatus(fileType, AutoSaveManager.SAVE_STATUS.SAVED);
            state.lastSaveTime = Date.now();
            state.retryCount = 0;

            // 短暂显示已保存状态后恢复空闲
            setTimeout(() => {
                if (state.status === AutoSaveManager.SAVE_STATUS.SAVED) {
                    this.updateStatus(fileType, AutoSaveManager.SAVE_STATUS.IDLE);
                }
            }, 2000);

        } catch (error) {
            console.error(`[AutoSaveManager] Save failed for ${fileType}:`, error);

            // 重试逻辑
            if (state.retryCount < this.config.retryAttempts) {
                state.retryCount++;
                console.log(`[AutoSaveManager] Retrying (${state.retryCount}/${this.config.retryAttempts})...`);

                setTimeout(() => {
                    this.triggerAutoSave(fileType);
                }, this.config.retryDelay);
            } else {
                // 超过重试次数，标记为错误
                this.updateStatus(fileType, AutoSaveManager.SAVE_STATUS.ERROR);
                state.retryCount = 0;

                // 显示错误通知
                if (this.app && this.app.showNotification) {
                    this.app.showNotification(
                        `Auto-save failed for ${fileType}: ${error.message}`,
                        'error'
                    );
                }
            }
        }
    }

    /**
     * 检查是否需要保存
     * @param {string} fileType - 文件类型
     * @returns {boolean}
     */
    needsSave(fileType) {
        switch (fileType) {
            case AutoSaveManager.FILE_TYPES.JSON:
                return this.app.hasUnsavedChanges ||
                       (this.app.currentFile && this.app.tempDataCache[this.app.currentFile]);

            case AutoSaveManager.FILE_TYPES.MARKDOWN:
            case AutoSaveManager.FILE_TYPES.DRAFT:
                return this.app.hasUnsavedMarkdownChanges;

            default:
                return false;
        }
    }

    /**
     * 执行保存操作
     * @param {string} fileType - 文件类型
     */
    async performSave(fileType) {
        switch (fileType) {
            case AutoSaveManager.FILE_TYPES.JSON:
                await this.app.saveToFile({
                    silent: this.config.silentSave,
                    force: false
                });
                break;

            case AutoSaveManager.FILE_TYPES.MARKDOWN:
            case AutoSaveManager.FILE_TYPES.DRAFT:
                await this.app.saveMarkdownFromEditor();
                break;

            default:
                throw new Error(`Unknown file type: ${fileType}`);
        }
    }

    /**
     * 保存所有需要保存的文件
     */
    async saveAllIfNeeded() {
        const promises = [];

        if (this.needsSave(AutoSaveManager.FILE_TYPES.JSON)) {
            promises.push(this.triggerAutoSave(AutoSaveManager.FILE_TYPES.JSON));
        }

        if (this.needsSave(AutoSaveManager.FILE_TYPES.MARKDOWN)) {
            promises.push(this.triggerAutoSave(AutoSaveManager.FILE_TYPES.MARKDOWN));
        }

        await Promise.allSettled(promises);
    }

    /**
     * 更新保存状态
     * @param {string} fileType - 文件类型
     * @param {string} status - 状态
     */
    updateStatus(fileType, status) {
        const state = this.state[fileType];
        if (!state) {
            return;
        }

        state.status = status;

        // 更新 UI 状态指示器
        this.updateStatusIndicator();
    }

    /**
     * 创建状态指示器
     */
    createStatusIndicator() {
        if (!this.config.showStatusIndicator) {
            return;
        }

        // 检查是否已存在
        let indicator = document.getElementById('auto-save-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'auto-save-indicator';
            indicator.className = 'auto-save-indicator';

            // 添加到合适的位置（例如状态栏）
            const statusBar = document.querySelector('.status-bar') || document.body;
            statusBar.appendChild(indicator);
        }

        this.statusIndicator = indicator;
    }

    /**
     * 更新状态指示器
     */
    updateStatusIndicator() {
        if (!this.statusIndicator) {
            return;
        }

        // 收集所有文件类型的状态
        const statuses = Object.entries(this.state).map(([type, state]) => ({
            type,
            status: state.status
        }));

        // 找出最重要的状态（优先级：error > saving > pending > saved > idle）
        const priorityOrder = [
            AutoSaveManager.SAVE_STATUS.ERROR,
            AutoSaveManager.SAVE_STATUS.SAVING,
            AutoSaveManager.SAVE_STATUS.PENDING,
            AutoSaveManager.SAVE_STATUS.SAVED,
            AutoSaveManager.SAVE_STATUS.IDLE
        ];

        let displayStatus = AutoSaveManager.SAVE_STATUS.IDLE;
        for (const priority of priorityOrder) {
            if (statuses.some(s => s.status === priority)) {
                displayStatus = priority;
                break;
            }
        }

        // 更新 UI
        const statusText = this.getStatusText(displayStatus);
        const statusClass = `status-${displayStatus}`;

        this.statusIndicator.textContent = statusText;
        this.statusIndicator.className = `auto-save-indicator ${statusClass}`;
    }

    /**
     * 获取状态文本
     * @param {string} status - 状态
     * @returns {string}
     */
    getStatusText(status) {
        switch (status) {
            case AutoSaveManager.SAVE_STATUS.PENDING:
                return 'Pending...';
            case AutoSaveManager.SAVE_STATUS.SAVING:
                return 'Saving...';
            case AutoSaveManager.SAVE_STATUS.SAVED:
                return 'Saved';
            case AutoSaveManager.SAVE_STATUS.ERROR:
                return 'Save Failed';
            case AutoSaveManager.SAVE_STATUS.IDLE:
            default:
                return '';
        }
    }

    /**
     * 更改自动保存模式
     * @param {string} mode - 新模式
     */
    setMode(mode) {
        if (!Object.values(AutoSaveManager.MODES).includes(mode)) {
            console.warn('[AutoSaveManager] Invalid mode:', mode);
            return;
        }

        console.log('[AutoSaveManager] Changing mode to:', mode);
        this.config.mode = mode;
        this.saveConfig();
        this.setupListeners();
    }

    /**
     * 更改延迟时间
     * @param {number} delay - 延迟时间（毫秒）
     */
    setDelay(delay) {
        if (typeof delay !== 'number' || delay < 0) {
            console.warn('[AutoSaveManager] Invalid delay:', delay);
            return;
        }

        this.config.delay = delay;
        this.saveConfig();
    }

    /**
     * 手动触发保存所有文件
     */
    async saveAll() {
        console.log('[AutoSaveManager] Manual save all triggered');

        // 取消所有待处理的自动保存
        this.cancelAllPendingSaves();

        // 执行保存
        await this.saveAllIfNeeded();
    }

    /**
     * 取消所有待处理的保存
     */
    cancelAllPendingSaves() {
        Object.values(this.state).forEach(state => {
            if (state.timer) {
                clearTimeout(state.timer);
                state.timer = null;
            }
            if (state.status === AutoSaveManager.SAVE_STATUS.PENDING) {
                state.status = AutoSaveManager.SAVE_STATUS.IDLE;
            }
        });
        this.updateStatusIndicator();
    }

    /**
     * 加载配置
     */
    loadConfig() {
        try {
            const stored = localStorage.getItem('autoSaveConfig');
            if (stored) {
                const config = JSON.parse(stored);
                this.config = { ...this.config, ...config };
            }
        } catch (error) {
            console.warn('[AutoSaveManager] Failed to load config:', error);
        }
    }

    /**
     * 保存配置
     */
    saveConfig() {
        try {
            localStorage.setItem('autoSaveConfig', JSON.stringify(this.config));
        } catch (error) {
            console.warn('[AutoSaveManager] Failed to save config:', error);
        }
    }

    /**
     * 销毁管理器
     */
    destroy() {
        console.log('[AutoSaveManager] Destroying...');
        this.removeListeners();
        this.cancelAllPendingSaves();

        if (this.statusIndicator) {
            this.statusIndicator.remove();
        }
    }

    /**
     * 获取当前状态信息（用于调试）
     */
    getDebugInfo() {
        return {
            config: this.config,
            state: Object.fromEntries(
                Object.entries(this.state).map(([type, state]) => [
                    type,
                    {
                        status: state.status,
                        lastSaveTime: state.lastSaveTime,
                        retryCount: state.retryCount,
                        hasPendingTimer: !!state.timer
                    }
                ])
            )
        };
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AutoSaveManager;
} else if (typeof window !== 'undefined') {
    window.AutoSaveManager = AutoSaveManager;
}
