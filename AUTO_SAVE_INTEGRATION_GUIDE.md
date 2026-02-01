# 自动保存配置面板集成指南

## 快速开始

### 工作原理
自动保存配置面板现在集成在 Settings 视图中，用户可以通过以下方式访问：

1. **左侧菜单按钮** - 点击左侧面板的 "💾" (保存) 图标
2. **Settings 标签页** - 在 Settings 视图中找到 "Auto Save Config" 面板

### 核心组件

#### 1. HTML 结构 (index.html)
```html
<!-- 菜单按钮 (第 ~361 行) -->
<button class="btn-switch-project" id="autoSaveConfigToggleBtn" title="Auto save config">
    <i class="fas fa-floppy-disk"></i>
</button>

<!-- Settings 面板 (第 ~549-557 行) -->
<div class="settings-section settings-panel auto-save-settings-panel" id="autoSaveConfigPanel">
    <div class="settings-panel-header">
        <span>Auto Save Config</span>
        <button class="btn btn-secondary" type="button" onclick="window.paperStats.toggleAutoSaveConfigPanel(false)">
            <i class="fas fa-eye-slash"></i> Hide
        </button>
    </div>
    <div class="auto-save-config-body" id="autoSaveConfigBody">
        <!-- Dynamic content will be inserted here -->
    </div>
</div>
```

#### 2. 关键 JavaScript 函数 (app.js)

**toggleAutoSaveConfigPanel(forceVisible)**
- 切换自动保存配置面板的可见性
- 参数：`forceVisible` - boolean，可选的强制状态
- 自动切换到 Settings 视图
- 调用 `renderInline()` 渲染内容

**initializeAutoSave()**
- DOMContentLoaded 事件中自动调用
- 初始化 AutoSaveManager 和 AutoSaveConfigUI
- 设置全局变量 `window.autoSave` 用于调试

#### 3. 配置界面类 (auto-save-config-ui.js)

新方法：
- `renderInline(containerElement)` - 在容器中渲染 inline 模式
- `createInlineContent()` - 创建 inline 模式的 HTML 内容
- `bindInlineEvents()` - 绑定 inline 模式的事件处理器

向后兼容方法（仍可用）：
- `show()` - 显示模态对话框
- `hide()` - 隐藏模态对话框

#### 4. 样式 (css/auto-save.css)

新增样式类：
- `.auto-save-config-body` - 配置面板容器
- `.auto-save-config-content` - 内容包装
- `.auto-save-config-section` - 配置项区域
- 所有标准表单元素的响应式样式

## 配置选项

### 1. 保存模式
- **关闭自动保存** - 需要手动保存
- **延迟后自动保存** - 停止编辑N毫秒后自动保存（推荐）
- **失去焦点时保存** - 离开编辑器时自动保存
- **切换窗口时保存** - 切换到其他应用时自动保存

### 2. 延迟时间
- 范围：100 - 10000 毫秒
- 默认：1000 毫秒
- 仅在"延迟后自动保存"模式下可用

### 3. 失败重试次数
- 范围：0 - 10 次
- 默认：3 次

### 4. 静默保存
- 勾选时不显示保存通知
- 默认：勾选

### 5. 显示状态指示器
- 勾选时在右下角显示保存状态
- 默认：勾选

## 数据存储

### localStorage 键
```javascript
// 配置状态：由 PaperStatsApp.getSettingsPanelsStateKey() 生成
// 格式：<projectPath>__settingsPanelsState

// 自动保存配置：由 AutoSaveManager 管理
// 键：autoSaveConfig
// 内容：
{
    mode: "afterDelay|off|onFocusChange|onWindowChange",
    delay: 1000,          // 毫秒
    retryAttempts: 3,
    silentSave: true,
    showStatusIndicator: true
}
```

## API 参考

### 全局访问
```javascript
// 获取自动保存管理器
window.paperStats.autoSaveManager

// 获取配置UI（用于调试）
window.paperStats.autoSaveConfigUI

// 快捷方式
window.autoSave  // = window.paperStats.autoSaveManager
```

### 编程使用
```javascript
// 打开配置面板
window.paperStats.toggleAutoSaveConfigPanel(true);

// 关闭配置面板
window.paperStats.toggleAutoSaveConfigPanel(false);

// 获取当前配置
const config = window.paperStats.autoSaveManager.config;
console.log(config.mode);  // 当前保存模式

// 修改配置（直接）
window.paperStats.autoSaveManager.config.mode = 'afterDelay';
window.paperStats.autoSaveManager.config.delay = 2000;
window.paperStats.autoSaveManager.saveConfig();
```

## 事件流程图

```
用户点击按钮
    ↓
toggleAutoSaveConfigPanel(true)
    ↓
1. 设置 autoSaveConfigVisible = true
2. 切换 classList: 'is-visible'
3. 移动面板到末尾
4. 切换到 'settings' 视图
5. 调用 renderInline(containerElement)
    ↓
renderInline()
    ↓
1. 创建内联内容 HTML
2. 插入到容器
3. 绑定事件处理器
4. 加载当前配置值
    ↓
用户修改配置
    ↓
点击 "Save"
    ↓
saveSettings()
    ↓
1. 验证输入
2. 更新 manager.config
3. 保存到 localStorage
4. 重启监听器
5. 显示通知
```

## 常见任务

### 切换到自动保存配置面板
```javascript
window.paperStats.toggleAutoSaveConfigPanel(true);
```

### 检查自动保存是否启用
```javascript
const isEnabled = window.paperStats.autoSaveManager.config.mode !== 'off';
console.log('Auto Save Enabled:', isEnabled);
```

### 获取自动保存统计信息
```javascript
const manager = window.paperStats.autoSaveManager;
console.log('Mode:', manager.config.mode);
console.log('Delay:', manager.config.delay + 'ms');
console.log('Silent:', manager.config.silentSave);
```

### 禁用自动保存
```javascript
const manager = window.paperStats.autoSaveManager;
manager.config.mode = 'off';
manager.saveConfig();
manager.setupListeners();
```

## 调试

### 在控制台查看日志
```javascript
// 查看所有自动保存日志
// 搜索 "[AutoSave]" 或 "[auto-save-config-ui]"

// 手动测试
window.autoSave.triggerAutoSave('json');  // 手动触发保存
```

### 重置配置到默认值
```javascript
localStorage.removeItem('autoSaveConfig');
location.reload();
```

## 故障排除

### 配置面板不显示
1. 检查浏览器控制台错误
2. 确认 AutoSaveManager 和 AutoSaveConfigUI 已加载
3. 检查 `window.paperStats.autoSaveManager` 是否存在

### 配置不保存
1. 检查浏览器是否允许 localStorage
2. 确认储存空间足够
3. 在控制台执行：
```javascript
window.paperStats.autoSaveManager.saveConfig();
console.log(window.paperStats.autoSaveManager.config);
```

### 自动保存不工作
1. 检查 `config.mode` 是否为 'off'
2. 查看控制台 AutoSave 日志
3. 确认文件正在被编辑

## 版本信息

- 集成日期：2025-02-02
- 兼容性：JavaScript ES6+
- 浏览器：Chrome, Firefox, Safari, Edge
- localStorage 要求：至少 5MB
