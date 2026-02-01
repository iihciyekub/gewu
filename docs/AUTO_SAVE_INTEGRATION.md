# 自动保存功能集成指南

## 概述

本文档说明如何将优雅的自动保存功能集成到 PaperStatsApp 中。自动保存功能参照 VSCode 的文件编辑保存机制设计，提供多种保存模式和智能防抖机制。

## 文件说明

### 核心文件

1. **[js/core/auto-save-manager.js](../js/core/auto-save-manager.js)** - 自动保存管理器核心类
2. **[js/core/auto-save-config-ui.js](../js/core/auto-save-config-ui.js)** - 配置界面组件
3. **[css/auto-save.css](../css/auto-save.css)** - 样式文件

## 集成步骤

### 1. 在 HTML 中引入文件

在 [index.html](../index.html) 的 `<head>` 部分添加样式：

```html
<!-- 自动保存样式 -->
<link rel="stylesheet" href="css/auto-save.css">
```

在 `<body>` 结束标签前，在 `app.js` 之前引入脚本：

```html
<!-- 自动保存功能 -->
<script src="js/core/auto-save-manager.js"></script>
<script src="js/core/auto-save-config-ui.js"></script>
<script src="js/app.js"></script>
```

### 2. 在 app.js 构造函数中初始化

在 `PaperStatsApp` 类的构造函数末尾添加：

```javascript
constructor() {
    // ... 现有代码 ...

    // 自动保存管理器（在所有其他初始化之后）
    this.autoSaveManager = null;
    this.autoSaveConfigUI = null;
}
```

### 3. 在应用初始化后启动自动保存

在 `document.addEventListener('DOMContentLoaded')` 回调中，app 初始化完成后添加：

```javascript
document.addEventListener('DOMContentLoaded', () => {
    const app = new PaperStatsApp();
    window.paperStats = app;

    // 初始化自动保存功能
    if (window.AutoSaveManager) {
        app.autoSaveManager = new AutoSaveManager(app);
        app.autoSaveConfigUI = new AutoSaveConfigUI(app.autoSaveManager);

        // 添加全局访问（用于调试）
        window.autoSave = app.autoSaveManager;

        console.log('[App] AutoSave initialized');
    }

    // ... 其他初始化代码 ...
});
```

### 4. 添加配置菜单入口

在设置菜单或工具栏中添加自动保存配置按钮。

#### 选项 A：添加到设置菜单

如果你的应用有设置菜单，可以添加一个"自动保存设置"选项：

```javascript
// 在构建设置菜单的地方添加
const autoSaveMenuItem = document.createElement('div');
autoSaveMenuItem.className = 'menu-item';
autoSaveMenuItem.innerHTML = '<i class="fas fa-save"></i> 自动保存设置';
autoSaveMenuItem.addEventListener('click', () => {
    if (this.autoSaveConfigUI) {
        this.autoSaveConfigUI.show();
    }
});
settingsMenu.appendChild(autoSaveMenuItem);
```

#### 选项 B：添加快捷键

在键盘事件处理中添加：

```javascript
// 在全局键盘事件监听器中添加
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Shift + S: 打开自动保存配置
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 's') {
        e.preventDefault();
        if (this.autoSaveConfigUI) {
            this.autoSaveConfigUI.show();
        }
        return;
    }

    // ... 其他快捷键 ...
});
```

### 5. 优化现有保存逻辑（可选）

为了更好地与自动保存配合，可以在现有的 `saveToFile` 和 `saveMarkdownFromEditor` 方法中添加通知：

```javascript
async saveToFile(options = {}) {
    // ... 现有代码 ...

    try {
        // ... 保存逻辑 ...

        // 通知自动保存管理器
        if (this.autoSaveManager) {
            this.autoSaveManager.updateStatus(
                AutoSaveManager.FILE_TYPES.JSON,
                AutoSaveManager.SAVE_STATUS.SAVED
            );
        }

    } catch (error) {
        // ... 错误处理 ...

        // 通知自动保存管理器
        if (this.autoSaveManager) {
            this.autoSaveManager.updateStatus(
                AutoSaveManager.FILE_TYPES.JSON,
                AutoSaveManager.SAVE_STATUS.ERROR
            );
        }
    }
}

async saveMarkdownFromEditor() {
    // ... 现有代码 ...

    try {
        // ... 保存逻辑 ...

        // 通知自动保存管理器
        if (this.autoSaveManager) {
            this.autoSaveManager.updateStatus(
                AutoSaveManager.FILE_TYPES.MARKDOWN,
                AutoSaveManager.SAVE_STATUS.SAVED
            );
        }

    } catch (error) {
        // ... 错误处理 ...

        // 通知自动保存管理器
        if (this.autoSaveManager) {
            this.autoSaveManager.updateStatus(
                AutoSaveManager.FILE_TYPES.MARKDOWN,
                AutoSaveManager.SAVE_STATUS.ERROR
            );
        }
    }
}
```

## 配置选项

### 自动保存模式

- **off**: 关闭自动保存
- **afterDelay**: 延迟后自动保存（默认，推荐）
- **onFocusChange**: 失去焦点时保存
- **onWindowChange**: 切换窗口时保存

### 其他配置

- **delay**: 延迟时间（毫秒），默认 1000ms
- **retryAttempts**: 失败重试次数，默认 3 次
- **silentSave**: 静默保存（不显示通知），默认 true
- **showStatusIndicator**: 显示状态指示器，默认 true

## 用户使用说明

### 打开配置界面

1. 通过设置菜单点击"自动保存设置"
2. 或使用快捷键 `Ctrl/Cmd + Shift + S`

### 配置自动保存

1. 选择保存模式（推荐使用"延迟后自动保存"）
2. 调整延迟时间（推荐 500-2000ms）
3. 配置其他选项
4. 点击"保存"按钮

### 状态指示器

编辑文件时，右下角会显示保存状态：

- **Pending...**: 等待保存（黄色）
- **Saving...**: 保存中（蓝色，带旋转图标）
- **Saved**: 已保存（绿色，带勾号）
- **Save Failed**: 保存失败（红色，带叉号）

## API 使用

### 编程式控制

```javascript
// 获取自动保存管理器
const autoSave = window.paperStats.autoSaveManager;

// 更改模式
autoSave.setMode('afterDelay');

// 更改延迟时间
autoSave.setDelay(2000);

// 手动触发保存所有文件
await autoSave.saveAll();

// 获取调试信息
console.log(autoSave.getDebugInfo());
```

### 控制台调试命令

```javascript
// 查看自动保存状态
window.autoSave.getDebugInfo()

// 手动触发保存
await window.autoSave.saveAll()

// 切换模式
window.autoSave.setMode('off')
window.autoSave.setMode('afterDelay')
window.autoSave.setMode('onFocusChange')
window.autoSave.setMode('onWindowChange')

// 打开配置界面
window.paperStats.autoSaveConfigUI.show()
```

## 最佳实践

### 1. 推荐配置

对于大多数用户，推荐以下配置：

- **模式**: afterDelay（延迟后自动保存）
- **延迟时间**: 1000ms
- **静默保存**: 开启
- **状态指示器**: 开启

### 2. 性能优化

- 对于大型文件，可以适当增加延迟时间（2000-3000ms）
- 如果频繁网络保存导致性能问题，考虑使用 `onFocusChange` 模式

### 3. 数据安全

- 自动保存不会替代手动保存，用户仍可使用 `Ctrl/Cmd + S` 手动保存
- 保存失败会自动重试，超过重试次数会显示错误通知
- 建议保持默认的 3 次重试设置

## 疑难解答

### 自动保存不工作

1. 检查控制台是否有错误信息
2. 确认模式不是 `off`
3. 检查 `hasUnsavedChanges` 或 `hasUnsavedMarkdownChanges` 标志是否正确更新
4. 使用 `autoSave.getDebugInfo()` 查看内部状态

### 保存过于频繁

1. 增加延迟时间（例如从 1000ms 改为 2000ms）
2. 或切换到 `onFocusChange` 模式

### 状态指示器不显示

1. 检查 CSS 是否正确加载
2. 确认 `showStatusIndicator` 配置为 `true`
3. 检查是否被其他元素遮挡（z-index 问题）

## 架构设计说明

### 防抖机制

使用 `setTimeout` 实现防抖，每次用户输入会重置计时器，确保只在停止输入后才触发保存。

### 状态管理

每种文件类型（JSON、Markdown、Draft）独立维护状态，包括：

- 保存状态（idle/pending/saving/saved/error）
- 计时器引用
- 最后保存时间
- 重试计数

### 错误处理

采用指数退避策略，失败后延迟重试，超过重试次数后显示错误并放弃。

### 内存管理

- 正确清理计时器，避免内存泄漏
- 移除事件监听器
- 提供 `destroy()` 方法用于完整清理

## 扩展功能

### 未来可能的增强

1. **冲突检测**: 检测文件在外部被修改
2. **版本历史**: 保存自动保存的历史版本
3. **云同步**: 支持自动同步到云端
4. **差异保存**: 只保存变更的部分
5. **批量保存优化**: 智能合并多个保存请求

## 许可证

与主项目相同。

## 作者

PaperStatsApp 开发团队
