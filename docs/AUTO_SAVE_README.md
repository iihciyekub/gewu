# 自动保存功能

## 概述

优雅的自动保存系统，参照 **VSCode** 的文件编辑保存机制设计，为 PaperStatsApp 提供智能、可靠的自动保存功能。

### 核心特性

✨ **四种自动保存模式**
- `off`: 关闭自动保存
- `afterDelay`: 延迟后自动保存（默认，推荐）
- `onFocusChange`: 失去焦点时保存
- `onWindowChange`: 切换窗口时保存

🛡️ **智能防抖机制**
- 用户输入时自动重置计时器
- 避免频繁保存，优化性能
- 可配置延迟时间（默认 1000ms）

📁 **多文件类型支持**
- JSON 数据文件 (`.json`)
- Markdown 文件 (`.md`)
- Draft 文件 (`DRAFT.md`)

💾 **可靠的错误处理**
- 自动重试机制（默认 3 次）
- 失败通知和状态指示
- 保存状态实时反馈

🎨 **优雅的用户体验**
- 右下角实时状态指示器
- 配色方案参照 VSCode
- 支持深色主题
- 响应式设计，移动端适配

## 快速开始

### 1. 引入文件

在 [index.html](../index.html) 中添加：

```html
<head>
    <!-- 自动保存样式 -->
    <link rel="stylesheet" href="css/auto-save.css">
</head>
<body>
    <!-- 其他内容 -->

    <!-- 自动保存脚本（在 app.js 之前） -->
    <script src="js/core/auto-save-manager.js"></script>
    <script src="js/core/auto-save-config-ui.js"></script>
    <script src="js/app.js"></script>
</body>
```

### 2. 初始化

在 [js/app.js](../js/app.js) 中：

```javascript
// 在构造函数中声明
constructor() {
    // ... 其他代码 ...
    this.autoSaveManager = null;
    this.autoSaveConfigUI = null;
}

// 在 DOMContentLoaded 中初始化
document.addEventListener('DOMContentLoaded', () => {
    const app = new PaperStatsApp();

    // 初始化自动保存
    app.autoSaveManager = new AutoSaveManager(app);
    app.autoSaveConfigUI = new AutoSaveConfigUI(app.autoSaveManager);

    // ... 其他初始化代码 ...
});
```

### 3. 开始使用

就这么简单！自动保存已经开始工作了。

## 文件结构

```
├── js/core/
│   ├── auto-save-manager.js      # 核心管理器类
│   └── auto-save-config-ui.js    # 配置界面组件
├── css/
│   └── auto-save.css              # 样式文件
└── docs/
    ├── AUTO_SAVE_README.md        # 本文档
    ├── AUTO_SAVE_INTEGRATION.md   # 详细集成指南
    └── auto-save-snippets.js      # 代码片段
```

## 使用说明

### 配置界面

使用快捷键 `Ctrl/Cmd + Shift + S` 打开配置界面（需要先集成快捷键，见[集成指南](AUTO_SAVE_INTEGRATION.md)）。

或者通过代码打开：

```javascript
window.paperStats.autoSaveConfigUI.show();
```

### 配置选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| 保存模式 | off / afterDelay / onFocusChange / onWindowChange | afterDelay |
| 延迟时间 | 停止输入后等待的时间（毫秒） | 1000ms |
| 重试次数 | 保存失败时的重试次数 | 3 次 |
| 静默保存 | 不显示保存成功通知 | 开启 |
| 状态指示器 | 显示右下角状态指示器 | 开启 |

### 状态指示器

编辑文件时，右下角会显示保存状态：

| 状态 | 显示 | 颜色 | 说明 |
|------|------|------|------|
| 空闲 | (隐藏) | - | 无待保存内容 |
| 等待中 | Pending... | 黄色 | 等待延迟时间结束 |
| 保存中 | Saving... ⟳ | 蓝色 | 正在保存文件 |
| 已保存 | ✓ Saved | 绿色 | 保存成功 |
| 保存失败 | ✗ Save Failed | 红色 | 保存失败，点击查看详情 |

## API 参考

### AutoSaveManager

#### 构造函数

```javascript
const autoSave = new AutoSaveManager(app);
```

#### 方法

##### setMode(mode)

设置自动保存模式。

```javascript
autoSave.setMode('afterDelay');
// 或
autoSave.setMode('onFocusChange');
```

参数：
- `mode` (string): 模式名称（off / afterDelay / onFocusChange / onWindowChange）

##### setDelay(delay)

设置延迟时间。

```javascript
autoSave.setDelay(2000); // 2秒
```

参数：
- `delay` (number): 延迟时间（毫秒），范围 100-10000

##### saveAll()

手动触发保存所有文件。

```javascript
await autoSave.saveAll();
```

返回：`Promise<void>`

##### getDebugInfo()

获取调试信息。

```javascript
const info = autoSave.getDebugInfo();
console.log(info);
```

返回对象包含：
- `config`: 当前配置
- `state`: 各文件类型的保存状态

##### destroy()

销毁管理器，清理资源。

```javascript
autoSave.destroy();
```

### AutoSaveConfigUI

#### 构造函数

```javascript
const configUI = new AutoSaveConfigUI(autoSaveManager);
```

#### 方法

##### show()

显示配置面板。

```javascript
configUI.show();
```

##### hide()

隐藏配置面板。

```javascript
configUI.hide();
```

##### destroy()

销毁配置界面。

```javascript
configUI.destroy();
```

## 控制台调试

在浏览器控制台中可以使用以下命令：

```javascript
// 查看自动保存状态
window.autoSave.getDebugInfo()

// 手动触发保存
await window.autoSave.saveAll()

// 切换模式
window.autoSave.setMode('off')
window.autoSave.setMode('afterDelay')

// 修改延迟时间
window.autoSave.setDelay(2000)

// 打开配置界面
window.paperStats.autoSaveConfigUI.show()

// 查看应用和自动保存的完整状态
window.paperStats.getAutoSaveDebugInfo()
```

## 工作原理

### 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                       PaperStatsApp                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              AutoSaveManager                        │   │
│  │                                                      │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐         │   │
│  │  │  JSON    │  │ Markdown │  │  Draft   │         │   │
│  │  │  State   │  │  State   │  │  State   │         │   │
│  │  └──────────┘  └──────────┘  └──────────┘         │   │
│  │                                                      │   │
│  │  ┌────────────────────────────────────────┐        │   │
│  │  │     Event Listeners                     │        │   │
│  │  │  - Input events (afterDelay)           │        │   │
│  │  │  - Focus events (onFocusChange)        │        │   │
│  │  │  - Visibility events (onWindowChange)  │        │   │
│  │  └────────────────────────────────────────┘        │   │
│  │                                                      │   │
│  │  ┌────────────────────────────────────────┐        │   │
│  │  │     Save Engine                         │        │   │
│  │  │  - Debounce timer                      │        │   │
│  │  │  - Retry logic                         │        │   │
│  │  │  - Status management                   │        │   │
│  │  └────────────────────────────────────────┘        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         AutoSaveConfigUI                            │   │
│  │  - Configuration panel                              │   │
│  │  - User settings management                         │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Status         │
                    │  Indicator      │
                    │  (Right Bottom) │
                    └─────────────────┘
```

### 保存流程

1. **用户编辑** → 触发 input 事件
2. **防抖计时** → 启动/重置延迟计时器
3. **延迟结束** → 检查是否需要保存
4. **执行保存** → 调用 `saveToFile` 或 `saveMarkdownFromEditor`
5. **更新状态** → 更新状态指示器
6. **处理结果** → 成功/失败处理和重试

### 防抖机制

```
用户输入: ▓▓▓▓▓░░░░░░░░░░░░░░░░▓▓▓░░░░░░░░░░░░░░░░░░
计时器:   ╳╳╳╳╳→→→→→→→→→→→→→→→╳╳╳→→→→→→→→→→ [保存]
                                            ↑
                                       1000ms 后
```

## 最佳实践

### 推荐配置

对于大多数用户：

```javascript
{
  mode: 'afterDelay',
  delay: 1000,
  retryAttempts: 3,
  silentSave: true,
  showStatusIndicator: true
}
```

### 性能优化建议

1. **大型文件**：增加延迟时间到 2000-3000ms
2. **频繁编辑**：使用 `onFocusChange` 模式
3. **网络较慢**：减少重试次数，增加重试延迟

### 数据安全建议

- 保持默认的重试机制
- 不要完全依赖自动保存，重要更改仍应手动保存
- 配合版本控制系统（如 Git）使用

## 疑难解答

### 常见问题

**Q: 自动保存不工作？**

A: 检查以下几点：
1. 模式是否设置为 `off`
2. 浏览器控制台是否有错误
3. 使用 `autoSave.getDebugInfo()` 查看状态
4. 确认 `hasUnsavedChanges` 标志是否正确

**Q: 保存太频繁了？**

A: 增加延迟时间：
```javascript
window.autoSave.setDelay(3000); // 3秒
```

**Q: 状态指示器不显示？**

A: 检查：
1. CSS 是否正确加载
2. `showStatusIndicator` 配置是否为 `true`
3. 浏览器 DevTools 中元素是否存在但被隐藏

**Q: 如何禁用自动保存？**

A: 设置模式为 `off`：
```javascript
window.autoSave.setMode('off');
```

### 获取帮助

如遇到问题，可以：

1. 查看[详细集成指南](AUTO_SAVE_INTEGRATION.md)
2. 检查浏览器控制台错误信息
3. 使用 `getDebugInfo()` 获取诊断信息
4. 查看[代码片段](auto-save-snippets.js)参考

## 技术细节

### 依赖

- 无外部依赖
- 纯原生 JavaScript (ES6+)
- 兼容所有现代浏览器

### 浏览器兼容性

| 浏览器 | 版本 | 支持 |
|--------|------|------|
| Chrome | 60+ | ✓ |
| Firefox | 55+ | ✓ |
| Safari | 11+ | ✓ |
| Edge | 79+ | ✓ |

### 存储

配置保存在 `localStorage`，键名：`autoSaveConfig`

```javascript
{
  "mode": "afterDelay",
  "delay": 1000,
  "retryAttempts": 3,
  "silentSave": true,
  "showStatusIndicator": true
}
```

## 扩展功能

### 未来可能的增强

- [ ] 冲突检测（文件在外部被修改）
- [ ] 版本历史（保存历史版本）
- [ ] 云同步（自动同步到云端）
- [ ] 差异保存（只保存变更部分）
- [ ] 批量保存优化（合并多个保存请求）
- [ ] 自定义保存策略（基于文件大小、类型等）
- [ ] 保存统计（保存次数、成功率等）

### 自定义扩展

可以通过继承或修改 `AutoSaveManager` 类来实现自定义功能：

```javascript
class CustomAutoSaveManager extends AutoSaveManager {
    constructor(app) {
        super(app);
        // 自定义初始化
    }

    async performSave(fileType) {
        // 自定义保存逻辑
        console.log('Custom save for:', fileType);
        return super.performSave(fileType);
    }
}
```

## 贡献

欢迎贡献代码和建议！

## 许可证

与主项目相同。

---

**Version**: 1.0.0
**Last Updated**: 2026-02-02
**Author**: PaperStatsApp Team
