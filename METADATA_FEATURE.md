# Markdown Front Matter 解析功能

## 概述

本项目已集成 YAML Front Matter 解析功能，允许在 Markdown 文件开头添加结构化的元数据。

## 快速开始

### 1. 在 Markdown 中添加 Front Matter

在 Markdown 文件的**最开头**添加以下格式：

```markdown
---
title: 文档标题
author: 作者名称
date: 2026-01-09
tags: [标签1, 标签2, 标签3]
version: 1.0
published: true
---

# 正文内容开始

这里是正常的 Markdown 内容...
```

### 2. 支持的数据类型

- **字符串**: `key: value`
- **数字**: `count: 42`, `price: 19.99`
- **布尔值**: `published: true`, `enabled: false`
- **Null 值**: `value: null`
- **数组**: `tags: [tag1, tag2, tag3]`
- **多行文本**:
  ```yaml
  description: |
    这是第一行
    这是第二行
    这是第三行
  ```

### 3. 示例文档

参见 [EXAMPLE_WITH_METADATA.md](EXAMPLE_WITH_METADATA.md) 查看完整示例。

## 功能特性

### ✅ 自动解析

当在系统中打开带有 front matter 的 Markdown 文件时，元数据会自动解析并显示在文档顶部的蓝色卡片中。

### ✅ 字段自由

可以添加任意自定义字段，不受限制：

```yaml
---
doi: 10.1234/example.2026.001
keywords: [AI, ML, DL]
category: 研究论文
priority: 高
status: 草稿
reviewer_count: 3
custom_field_1: 自定义值
custom_field_2: 另一个值
---
```

### ✅ 向后兼容

没有 front matter 的 Markdown 文件仍然正常工作，不受影响。

### ✅ 独立测试

打开 [test_frontmatter.html](test_frontmatter.html) 可以独立测试解析器功能。

## 技术实现

### 文件结构

```
js/core/frontmatter-parser.js   # 核心解析器
index.html                        # 引入解析器脚本
js/app.js                         # 集成到应用
css/styles.css                    # Metadata 显示样式
```

### API 文档

```javascript
// 创建解析器实例
const parser = new FrontMatterParser();

// 1. 解析 Markdown
const result = parser.parse(markdownText);
// 返回: { 
//   metadata: {...},      // 解析的元数据对象
//   content: "...",       // 去除 front matter 后的内容
//   hasFrontMatter: true, // 是否包含 front matter
//   rawFrontMatter: "..." // 原始 YAML 文本
// }

// 2. 序列化为 YAML
const yaml = parser.stringify(metadata);
// 返回: "---\nkey: value\n---\n"

// 3. 组合内容
const fullMarkdown = parser.compose(metadata, content);
// 返回: YAML front matter + content

// 4. 更新元数据
const updated = parser.updateMetadata(
    markdownText,
    { newKey: 'newValue' },
    true  // merge: true=合并, false=替换
);
```

### 在应用中访问元数据

解析后的 metadata 存储在应用实例中：

```javascript
// 在 js/app.js 中
this.currentMarkdownMetadata  // 当前文档的 metadata 对象
```

## 使用场景

### 1. 文档管理

```yaml
---
title: 项目文档
category: 技术文档
status: 审核中
version: 2.1
lastModified: 2026-01-09
---
```

### 2. 论文元信息

```yaml
---
title: 深度学习研究
author: 张三
doi: 10.1234/example.2026.001
journal: Nature
year: 2026
citations: 150
---
```

### 3. 任务追踪

```yaml
---
task: 实现新功能
priority: 高
status: 进行中
assignee: 李四
dueDate: 2026-01-15
progress: 75
---
```

### 4. 内容分类

```yaml
---
tags: [教程, Python, 机器学习]
difficulty: 中级
estimatedTime: 45分钟
prerequisites: [Python基础, 线性代数]
---
```

## 样式定制

Metadata 显示样式定义在 `css/styles.css` 中：

```css
.markdown-metadata { ... }      /* 容器样式 */
.metadata-header { ... }        /* 标题样式 */
.metadata-table { ... }         /* 表格样式 */
.meta-key { ... }               /* 键样式 */
.meta-value { ... }             /* 值样式 */
```

暗色主题样式以 `body.theme-vscode` 前缀定义。

## 注意事项

1. **Front Matter 必须在文件最开头**：前面不能有任何空行或其他内容
2. **使用三个连字符**：`---` 不是 `***` 或 `___`
3. **键值对格式**：`key: value`，冒号后必须有空格
4. **YAML 语法**：遵循基本 YAML 语法规则

## 测试

### 独立测试

在浏览器中打开 `test_frontmatter.html` 进行独立测试。

### 集成测试

1. 启动应用：`npm start` 或 `./start.sh`
2. 打开 `EXAMPLE_WITH_METADATA.md`
3. 查看顶部显示的元数据卡片

## 相关文档

- [FRONTMATTER_GUIDE.md](FRONTMATTER_GUIDE.md) - 详细使用指南
- [EXAMPLE_WITH_METADATA.md](EXAMPLE_WITH_METADATA.md) - 完整示例
- [test_frontmatter.html](test_frontmatter.html) - 独立测试工具

## 未来扩展

可能的功能扩展：

- [ ] 支持更复杂的 YAML 结构（嵌套对象）
- [ ] Metadata 编辑器（GUI）
- [ ] 根据 metadata 筛选/搜索文档
- [ ] 导出 metadata 到 JSON/CSV
- [ ] 模板系统（预定义 metadata 字段）
- [ ] Metadata 验证和模式定义

## 问题反馈

如有问题或建议，请提交 Issue。
