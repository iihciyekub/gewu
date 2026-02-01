/**
 * 自动保存功能集成代码片段
 * 直接复制粘贴到对应位置即可使用
 */

// ============================================
// 1. 在 PaperStatsApp 构造函数中添加
// ============================================

// 在 constructor() 的末尾添加：
this.autoSaveManager = null;
this.autoSaveConfigUI = null;

// ============================================
// 2. 在 DOMContentLoaded 事件中初始化
// ============================================

// 在 document.addEventListener('DOMContentLoaded') 回调中添加：
document.addEventListener('DOMContentLoaded', () => {
    const app = new PaperStatsApp();
    window.paperStats = app;

    // 初始化自动保存功能
    if (window.AutoSaveManager) {
        try {
            app.autoSaveManager = new AutoSaveManager(app);
            app.autoSaveConfigUI = new AutoSaveConfigUI(app.autoSaveManager);

            // 添加全局访问（用于调试）
            window.autoSave = app.autoSaveManager;

            console.log('[App] AutoSave initialized with mode:', app.autoSaveManager.config.mode);
        } catch (error) {
            console.error('[App] Failed to initialize AutoSave:', error);
        }
    } else {
        console.warn('[App] AutoSaveManager not loaded');
    }

    // ... 其他初始化代码 ...
});

// ============================================
// 3. 添加键盘快捷键（可选）
// ============================================

// 在全局键盘事件处理函数中添加：
handleGlobalKeydown(e) {
    // Ctrl/Cmd + Shift + S: 打开自动保存配置
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (this.autoSaveConfigUI) {
            this.autoSaveConfigUI.show();
        }
        return;
    }

    // Ctrl/Cmd + S: 手动保存（保留原有行为，但也触发自动保存的立即保存）
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (this.autoSaveManager) {
            // 取消待处理的自动保存，立即保存
            this.autoSaveManager.cancelAllPendingSaves();
            this.autoSaveManager.saveAll().catch(err => {
                console.error('Manual save failed:', err);
            });
        } else {
            // 回退到原有的保存逻辑
            this.saveCurrentFile();
        }
        return;
    }

    // ... 其他快捷键 ...
}

// ============================================
// 4. 在设置菜单中添加选项（可选）
// ============================================

// 在构建设置菜单的函数中添加：
buildSettingsMenu() {
    // ... 现有菜单项 ...

    // 自动保存设置
    const autoSaveMenuItem = document.createElement('div');
    autoSaveMenuItem.className = 'settings-menu-item';
    autoSaveMenuItem.innerHTML = `
        <i class="fas fa-save"></i>
        <span>自动保存设置</span>
    `;
    autoSaveMenuItem.addEventListener('click', () => {
        if (this.autoSaveConfigUI) {
            this.autoSaveConfigUI.show();
        } else {
            this.showNotification('自动保存功能未初始化', 'error');
        }
        this.hideSettingsMenu(); // 关闭设置菜单
    });
    settingsMenu.appendChild(autoSaveMenuItem);

    // ... 其他菜单项 ...
}

// ============================================
// 5. 增强现有保存方法（可选但推荐）
// ============================================

// 在 saveToFile 方法中添加状态通知：
async saveToFile(options = {}) {
    const { silent = false, force = false } = options;

    // ... 现有验证代码 ...

    // 通知自动保存管理器开始保存
    if (this.autoSaveManager) {
        this.autoSaveManager.updateStatus(
            AutoSaveManager.FILE_TYPES.JSON,
            AutoSaveManager.SAVE_STATUS.SAVING
        );
    }

    try {
        // ... 现有保存逻辑 ...

        // 保存成功，通知自动保存管理器
        if (this.autoSaveManager) {
            this.autoSaveManager.updateStatus(
                AutoSaveManager.FILE_TYPES.JSON,
                AutoSaveManager.SAVE_STATUS.SAVED
            );
            // 2秒后恢复空闲状态
            setTimeout(() => {
                if (this.autoSaveManager) {
                    this.autoSaveManager.updateStatus(
                        AutoSaveManager.FILE_TYPES.JSON,
                        AutoSaveManager.SAVE_STATUS.IDLE
                    );
                }
            }, 2000);
        }

        // ... 现有成功处理代码 ...

    } catch (error) {
        console.error('Error saving file:', error);

        // 保存失败，通知自动保存管理器
        if (this.autoSaveManager) {
            this.autoSaveManager.updateStatus(
                AutoSaveManager.FILE_TYPES.JSON,
                AutoSaveManager.SAVE_STATUS.ERROR
            );
        }

        // ... 现有错误处理代码 ...
    }
}

// 在 saveMarkdownFromEditor 方法中添加状态通知：
async saveMarkdownFromEditor() {
    // ... 现有验证代码 ...

    // 通知自动保存管理器开始保存
    if (this.autoSaveManager) {
        this.autoSaveManager.updateStatus(
            AutoSaveManager.FILE_TYPES.MARKDOWN,
            AutoSaveManager.SAVE_STATUS.SAVING
        );
    }

    try {
        // ... 现有保存逻辑 ...

        // 保存成功，通知自动保存管理器
        if (this.autoSaveManager) {
            this.autoSaveManager.updateStatus(
                AutoSaveManager.FILE_TYPES.MARKDOWN,
                AutoSaveManager.SAVE_STATUS.SAVED
            );
            setTimeout(() => {
                if (this.autoSaveManager) {
                    this.autoSaveManager.updateStatus(
                        AutoSaveManager.FILE_TYPES.MARKDOWN,
                        AutoSaveManager.SAVE_STATUS.IDLE
                    );
                }
            }, 2000);
        }

        // ... 现有成功处理代码 ...

    } catch (err) {
        console.error('Failed to save Markdown:', err);

        // 保存失败，通知自动保存管理器
        if (this.autoSaveManager) {
            this.autoSaveManager.updateStatus(
                AutoSaveManager.FILE_TYPES.MARKDOWN,
                AutoSaveManager.SAVE_STATUS.ERROR
            );
        }

        // ... 现有错误处理代码 ...
    }
}

// ============================================
// 6. 优化数据修改检测（推荐）
// ============================================

// 创建一个辅助方法来标记数据已修改
markDataDirty(fileType = 'json') {
    if (fileType === 'json') {
        this.hasUnsavedChanges = true;
    } else if (fileType === 'markdown' || fileType === 'draft') {
        this.hasUnsavedMarkdownChanges = true;
    }

    // 通知自动保存管理器
    if (this.autoSaveManager && this.autoSaveManager.config.mode === 'afterDelay') {
        this.autoSaveManager.scheduleAutoSave(
            fileType === 'json' ? AutoSaveManager.FILE_TYPES.JSON : AutoSaveManager.FILE_TYPES.MARKDOWN
        );
    }
}

// 在所有修改数据的方法中调用 markDataDirty：
updateFieldValue(path, key, value) {
    // ... 现有更新逻辑 ...

    // 标记为脏数据，触发自动保存
    this.markDataDirty('json');
}

// ============================================
// 7. 添加 Markdown 编辑器输入监听（推荐）
// ============================================

// 在 Markdown 编辑器初始化时添加：
setupMarkdownEditor() {
    const textarea = document.getElementById('markdownTextarea');
    if (!textarea) return;

    // ... 现有设置代码 ...

    // 添加输入监听，用于自动保存
    let markdownInputTimer = null;
    textarea.addEventListener('input', () => {
        this.hasUnsavedMarkdownChanges = true;
        this.updateMarkdownDirtyUI();

        // 防抖：延迟触发自动保存
        if (markdownInputTimer) {
            clearTimeout(markdownInputTimer);
        }

        markdownInputTimer = setTimeout(() => {
            if (this.autoSaveManager && this.autoSaveManager.config.mode === 'afterDelay') {
                this.autoSaveManager.scheduleAutoSave(AutoSaveManager.FILE_TYPES.MARKDOWN);
            }
        }, 100); // 快速触发检查，实际延迟由 AutoSaveManager 控制
    });
}

// ============================================
// 8. 清理资源（在应用销毁时调用）
// ============================================

destroy() {
    // 清理自动保存管理器
    if (this.autoSaveManager) {
        this.autoSaveManager.destroy();
        this.autoSaveManager = null;
    }

    if (this.autoSaveConfigUI) {
        this.autoSaveConfigUI.destroy();
        this.autoSaveConfigUI = null;
    }

    // ... 其他清理代码 ...
}

// ============================================
// 9. 调试和监控（开发环境使用）
// ============================================

// 添加调试方法
getAutoSaveDebugInfo() {
    if (!this.autoSaveManager) {
        return { error: 'AutoSaveManager not initialized' };
    }

    return {
        ...this.autoSaveManager.getDebugInfo(),
        app: {
            hasUnsavedChanges: this.hasUnsavedChanges,
            hasUnsavedMarkdownChanges: this.hasUnsavedMarkdownChanges,
            currentFile: this.currentFile,
            currentMarkdownFile: this.currentMarkdownFile
        }
    };
}

// 在控制台中使用：
// window.paperStats.getAutoSaveDebugInfo()

// ============================================
// 10. 页面卸载前保存（推荐）
// ============================================

// 在应用初始化时添加：
window.addEventListener('beforeunload', async (e) => {
    if (this.autoSaveManager &&
        (this.hasUnsavedChanges || this.hasUnsavedMarkdownChanges)) {

        // 尝试快速保存
        try {
            await this.autoSaveManager.saveAll();
        } catch (error) {
            console.error('Failed to save before unload:', error);

            // 提示用户有未保存的更改
            e.preventDefault();
            e.returnValue = '您有未保存的更改，确定要离开吗？';
            return e.returnValue;
        }
    }
});

// ============================================
// 完整的最小集成示例
// ============================================

/**
 * 最小集成步骤（只需要这些就能工作）：
 *
 * 1. 在 HTML 中添加：
 *    <link rel="stylesheet" href="css/auto-save.css">
 *    <script src="js/core/auto-save-manager.js"></script>
 *    <script src="js/core/auto-save-config-ui.js"></script>
 *
 * 2. 在 app.js 构造函数中添加：
 *    this.autoSaveManager = null;
 *    this.autoSaveConfigUI = null;
 *
 * 3. 在 DOMContentLoaded 中添加：
 *    app.autoSaveManager = new AutoSaveManager(app);
 *    app.autoSaveConfigUI = new AutoSaveConfigUI(app.autoSaveManager);
 *
 * 就这么简单！自动保存就开始工作了。
 * 其他代码片段是可选的优化和增强。
 */
