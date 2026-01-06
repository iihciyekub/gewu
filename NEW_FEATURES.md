# 新功能说明文档

## 版本更新内容

本次更新主要包含以下三个重要改进：

### 1. 统一的特殊语法管理器

**功能描述：**
将 `cite{}`、`citep{}`、`bib{}`、`goto{}` 等特殊文本组合统一用 `SpecialSyntaxManager` 类进行管理。

**优势：**
- 便于扩展新的特殊语法类型
- 统一的语法解析和渲染逻辑
- 更容易维护和调试
- 可以方便地添加、删除或修改语法规则

**使用示例：**
```javascript
// 语法管理器会自动处理以下语法：
// - cite{doi1, doi2}       - 行内引用 (narrative citation)
// - citep{doi1, doi2}      - 括号引用 (parenthetical citation)
// - bib{doi1, doi2}        - 参考文献条目 (bibliography entry)
// - goto{搜索文本}         - PDF 跳转链接
```

**扩展新语法：**
```javascript
// 在 app.specialSyntaxManager 中注册新语法
app.specialSyntaxManager.registerSyntax('mysyntax', {
    pattern: /mysyntax\{([^}]+)\}/g,
    description: '自定义语法说明',
    renderer: (content, fullMatch) => {
        // 返回渲染后的 HTML
        return `<span class="my-syntax">${content}</span>`;
    }
});
```

---

### 2. bib{} 语法支持

**功能描述：**
新增 `bib{}` 语法，用于生成完整的 BibTeX 参考文献条目。

**语法格式：**
```markdown
bib{10.1038/nature12345}
bib{10.1038/nature12345, 10.1126/science.12345}
```

**特点：**
- 支持单个或多个 DOI
- **按需加载**：渲染为按钮，点击后才查询
- **智能缓存**：先检查本地缓存，没有才从 Crossref API 获取
- 生成标准 BibTeX 格式的参考文献条目
- 以代码块形式显示，便于复制粘贴
- 内置复制和折叠按钮
- 缓存保存到项目目录 `.locstorage/citation-meta.json`

**使用流程：**
1. 在 Markdown 中使用 `bib{doi}` 语法
2. 渲染为蓝色按钮："获取 BibTeX (doi)"
3. 点击按钮，系统先检查本地缓存
4. 如果没有缓存，从 API 获取并保存到本地
5. 显示 BibTeX 代码块，可复制或折叠

**渲染结果：**
生成标准的 BibTeX 格式：
```bibtex
@article{10_1038_nature12345,
  author = {Smith, John and Doe, Jane},
  title = {Article Title},
  journal = {Nature},
  year = {2023},
  volume = {123},
  pages = {456--789},
  doi = {10.1038/nature12345},
  url = {https://doi.org/10.1038/nature12345}
}
```

**与 cite{} / citep{} 的区别：**
- `cite{}` / `citep{}`：用于正文中的引用标记（如 "(Smith, 2023)" 或 "Smith (2023)"），**自动加载并缓存**
- `bib{}`：用于生成完整的 BibTeX 参考文献条目，可直接用于 LaTeX 文档，**按需加载**

---

### 3. 项目本地存储机制

**功能描述：**
将数据从浏览器 localStorage 迁移到用户项目目录的 `.locstorage` 隐藏文件夹。

**存储位置：**
```
[项目目录]/
├── .locstorage/
│   ├── citation-meta.json      # 引文元数据缓存
│   ├── project-config.json     # 项目配置
│   ├── qa-states.json          # QA 折叠状态
│   ├── section-states.json     # 章节展开状态
│   ├── prompt-config.json      # Prompt 配置
│   └── ui-preferences.json     # UI 偏好设置
├── json/
├── md/
└── pdf/
```

**优势：**
- **跨浏览器同步**：不依赖浏览器 localStorage，数据随项目一起同步
- **持久化存储**：数据保存在文件系统中，不会因清理浏览器数据而丢失
- **便于备份**：项目配置和缓存可以与项目文件一起备份
- **团队协作**：可以共享配置（如需要）

**智能缓存策略：**
- `cite{}` / `citep{}`：页面加载时自动检查缓存，没有才查询 API
- `bib{}`：按需加载，点击按钮时才检查缓存/查询 API
- 查询结果自动保存到 `citation-meta.json`
- 下次加载同一 DOI 时直接使用缓存，无需网络请求

**自动迁移：**
首次加载项目时，系统会自动将以下数据从 localStorage 迁移到项目目录：
- Citation 元数据缓存
- 项目配置（文件分组、排序等）
- QA 状态（折叠/展开）
- Section 状态
- Prompt 配置
- UI 偏好设置

**文件格式：**
所有配置文件均为 JSON 格式，便于查看和编辑：
```json
{
  "10.1038/nature12345": {
    "DOI": "10.1038/nature12345",
    "title": "Article Title",
    "author": [
      {"family": "Smith", "given": "John"}
    ],
    "issued": {"date-parts": [[2023, 1, 1]]},
    "_bibCache": "Smith, J. (2023)...",
    "_bibTimestamp": 1704556800000
  }
}
```

---

## 使用示例

### Markdown 文档示例

```markdown
# 我的研究笔记

## 引用文献

研究表明cite{10.1038/nature12345}机器学习在医疗诊断中有重要应用。
多个研究citep{10.1038/nature12345, 10.1126/science.12345}支持这一观点。

## PDF 跳转

在第3页提到的关键结论goto{key finding on page 3}值得注意。

## 参考文献

bib{10.1038/nature12345}
bib{10.1126/science.12345}
```

### 渲染效果

- `cite{...}` 会渲染为：Smith (2023)
- `citep{...}` 会渲染为：(Smith, 2023)
- `bib{...}` 会渲染为标准 BibTeX 格式的代码块
- `goto{...}` 会渲染为可点击的 PDF 跳转图标

---

## 技术细节

### SpecialSyntaxManager API

```javascript
// 检测文本中的语法
app.specialSyntaxManager.hasAnySyntax(text)
app.specialSyntaxManager.detectSyntaxTypes(text)

// 提取匹配项
app.specialSyntaxManager.extractMatches(text, 'cite')

// 渲染语法
app.specialSyntaxManager.renderAllSyntax(text)
app.specialSyntaxManager.renderSyntaxType(text, 'bib')

// 更新语法内容
app.specialSyntaxManager.updateSyntaxContent(text, 'goto', oldContent, newContent)

// 清除缓存
app.specialSyntaxManager.clearCache('cite')
```

### ProjectStorageManager API

```javascript
// 加载数据
const data = await app.projectStorage.load('citation-meta')

// 保存数据
await app.projectStorage.save('citation-meta', data)

// 更新数据（延迟保存）
app.projectStorage.update('citation-meta', data)

// 立即保存所有待保存数据
await app.projectStorage.flushDirty()

// 删除数据
await app.projectStorage.delete('citation-meta')

// 清空缓存
app.projectStorage.clearCache()
```

---

## 注意事项

1. **DOI 格式**：支持多种格式的 DOI：
   - `10.1038/nature12345`
   - `doi:10.1038/nature12345`
   - `https://doi.org/10.1038/nature12345`

2. **网络依赖**：首次渲染引文和参考文献需要从 Crossref API 获取元数据，请确保网络连接正常。

3. **缓存机制**：已获取的元数据会缓存到项目目录，后续使用会直接从缓存加载，无需重复请求。

4. **清除缓存**：如需清除缓存，可在 Markdown 菜单中选择"清除当前文档引文缓存"或"清除所有引文缓存"。

5. **.locstorage 目录**：此目录为隐藏目录（以点开头），包含项目配置和缓存数据。如果使用版本控制系统（如 Git），建议将其添加到 .gitignore 文件中（除非需要共享配置）。

---

## 故障排除

### bib{} 不显示内容
- 检查 DOI 是否正确
- 检查网络连接
- 打开浏览器控制台查看错误信息
- 尝试清除缓存后重新加载

### 数据迁移失败
- 确保有项目目录的写入权限
- 检查服务器日志
- 手动创建 `.locstorage` 目录

### 语法不生效
- 确保语法格式正确（括号匹配）
- 检查是否在 Markdown 视图中
- 尝试重新渲染页面

---

## 更新日志

### v2.0.0 (2026-01-06)
- ✨ 新增统一的特殊语法管理器
- ✨ 新增 bib{} 语法支持
- 🔄 数据存储从 localStorage 迁移到项目目录
- 🐛 修复多个 DOI 解析问题
- ⚡ 优化缓存机制，提升性能
