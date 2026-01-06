# 功能更新汇总 (2026-01-06)

## 概述

本次更新完成了三个主要功能的实现和重构，提升了系统的可扩展性和数据持久化能力。

## 主要更新

### 1. 特殊语法统一管理

**新增文件：**
- `js/core/special-syntax-manager.js` - 特殊语法管理器

**功能：**
- 将 `cite{}`、`citep{}`、`bib{}`、`goto{}` 等特殊语法统一管理
- 提供统一的注册、解析、渲染接口
- 支持动态添加和删除语法类型
- 便于后续扩展新的语法功能

**主要 API：**
```javascript
specialSyntaxManager.registerSyntax(name, config)
specialSyntaxManager.hasAnySyntax(text)
specialSyntaxManager.renderAllSyntax(text)
specialSyntaxManager.updateSyntaxContent(text, type, oldContent, newContent)
```

### 2. bib{} 参考文献语法

**功能：**
- 新增 `bib{}` 语法用于生成标准 BibTeX 格式的参考文献条目
- 支持单个或多个 DOI，自动从 Crossref API 获取元数据
- 生成标准 BibTeX 格式，便于在 LaTeX 中使用
- 缓存机制避免重复请求

**使用示例：**
```markdown
bib{10.1038/nature12345}
bib{10.1038/nature12345, 10.1126/science.12345}
```

**输出格式：**
```bibtex
@article{10_1038_nature12345,
  author = {Smith, John},
  title = {Article Title},
  journal = {Nature},
  year = {2023},
  doi = {10.1038/nature12345}
}
```

**修改文件：**
- `js/app.js` - 添加 `formatBibliography()`、`applyBibliographyRendering()`、`formatSingleBibFallback()` 等方法
- `css/styles.css` - 添加 `.bibliography-inline` 代码块样式

### 3. 项目本地存储机制

**新增文件：**
- `js/core/project-storage-manager.js` - 项目存储管理器

**功能：**
- 将数据从浏览器 localStorage 迁移到项目目录 `.locstorage/` 文件夹
- 支持跨浏览器同步，数据持久化存储
- 自动迁移现有数据
- 延迟写入机制提升性能

**存储文件结构：**
```
[项目目录]/.locstorage/
├── citation-meta.json      # 引文元数据缓存
├── project-config.json     # 项目配置
├── qa-states.json          # QA 折叠状态
├── section-states.json     # 章节展开状态
├── prompt-config.json      # Prompt 配置
└── ui-preferences.json     # UI 偏好设置
```

**服务器端点：**
添加了以下 API 端点（`server.js`）：
- `POST /ensure-dir` - 确保目录存在
- `GET /read-json` - 读取 JSON 文件
- `POST /save-json-api` - 保存 JSON 到指定路径
- `POST /delete-file` - 删除文件

## 文件变更列表

### 新增文件
1. `js/core/special-syntax-manager.js` - 特殊语法管理器
2. `js/core/project-storage-manager.js` - 项目存储管理器
3. `NEW_FEATURES.md` - 新功能使用说明
4. `IMPLEMENTATION_UPDATE.md` - 本文档

### 修改文件
1. `index.html`
   - 引入新的脚本文件

2. `server.js`
   - 添加 4 个新的 API 端点
   - 支持项目存储管理

3. `js/app.js`
   - 集成 `SpecialSyntaxManager` 和 `ProjectStorageManager`
   - 添加 `formatBibliography()` 方法
   - 添加 `applyBibliographyRendering()` 方法
   - 添加 `loadCitationMetaAsync()` 方法
   - 修改 `loadCitationMetaFromStorage()` 支持项目存储
   - 修改 `saveCitationMetaToStorage()` 支持项目存储
   - 修改 `clearCitationCache()` 改为异步，支持项目存储
   - 修改 `initializeProject()` 添加数据迁移逻辑
   - 更新 markdown 渲染逻辑支持 `bib{}` 语法

4. `css/styles.css`
   - 添加 `.bibliography-inline` 样式
   - 支持暗色主题

## 技术细节

### SpecialSyntaxManager 类设计

```javascript
class SpecialSyntaxManager {
    constructor(app)
    
    // 核心方法
    registerSyntax(name, config)
    unregisterSyntax(name)
    hasAnySyntax(text)
    detectSyntaxTypes(text)
    extractMatches(text, syntaxType)
    renderAllSyntax(text, options)
    renderSyntaxType(text, syntaxType, options)
    updateSyntaxContent(text, syntaxType, oldContent, newContent, targetIndex)
    clearCache(syntaxType)
    
    // 内置渲染器
    renderCitation(content, type, fullMatch)
    renderBibliography(content, fullMatch)
    renderGotoLink(content, fullMatch)
}
```

### ProjectStorageManager 类设计

```javascript
class ProjectStorageManager {
    constructor(app)
    
    // 核心方法
    getStoragePath()
    ensureStorageDir()
    load(key)
    save(key, data)
    update(key, data)
    markDirty(key)
    flushDirty()
    delete(key)
    clearCache()
    migrateFromLocalStorage()
}
```

### 数据迁移流程

1. 首次加载项目时检测 `.locstorage/citation-meta.json` 是否存在
2. 如果不存在，触发 `migrateFromLocalStorage()` 自动迁移
3. 从 localStorage 读取所有相关数据
4. 保存到项目目录对应的 JSON 文件
5. 迁移完成后显示提示消息

### Markdown 渲染更新

在 markdown-it 的文本渲染规则中：
1. 检测 `bib{...}` 语法
2. 解析 DOI 列表
3. 生成占位符 `<span class="bibliography-inline">`
4. 在 `applyBibliographyRendering()` 中异步获取元数据并渲染

## 测试建议

### 1. 特殊语法管理器测试
- [ ] 测试 `cite{}` 语法是否正常工作
- [ ] 测试 `citep{}` 语法是否正常工作
- [ ] 测试 `bib{}` 语法是否正常工作
- [ ] 测试 `goto{}` 语法是否正常工作
- [ ] 测试多个 DOI 的解析
- [ ] 测试语法嵌套场景

### 2. bib{} 功能测试
- [ ] 测试单个 DOI 的 bibitem 生成
- [ ] 测试多个 DOI 的 bibitem 生成
- [ ] 测试无效 DOI 的错误处理
- [ ] 测试网络错误的降级显示
- [ ] 测试缓存机制是否生效

### 3. 项目存储测试
- [ ] 测试首次加载项目时的数据迁移
- [ ] 测试 `.locstorage` 目录是否正确创建
- [ ] 测试各类配置文件是否正确保存
- [ ] 测试跨浏览器数据同步
- [ ] 测试数据清除功能

### 4. 集成测试
- [ ] 在 Markdown 中混合使用多种语法
- [ ] 切换项目后数据是否正确加载
- [ ] 清除缓存后是否能重新加载
- [ ] 暗色主题下样式是否正常

## 兼容性

- 保持向后兼容，旧的 localStorage 数据会自动迁移
- 如果项目存储不可用，自动回退到 localStorage
- 所有现有功能保持不变

## 已知问题

无

## 后续优化建议

1. 添加 bib{} 的样式自定义选项
2. 支持更多引用格式（MLA, Chicago 等）
3. 优化大量 DOI 的批量处理性能
4. 添加离线模式支持
5. 提供 UI 界面管理项目存储数据

## 版本信息

- **版本号**: v2.0.0
- **更新日期**: 2026-01-06
- **作者**: GitHub Copilot

---

*本文档记录了此次功能更新的详细技术实现。*
