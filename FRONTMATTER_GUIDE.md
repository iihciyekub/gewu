# Front Matter 解析功能测试

这个文档用于测试 Markdown 的 front matter (YAML metadata) 解析功能。

## 功能说明

现在系统已经支持在 Markdown 文件开头使用 YAML front matter 格式来添加元数据。

## 使用方法

在 Markdown 文件开头添加：

```markdown
---
title: 文档标题
author: 作者名称
date: 2026-01-09
tags: [markdown, metadata, yaml]
version: 1.0
published: true
---
```

## 支持的格式

- **字符串**: `key: value`
- **数字**: `count: 42` 或 `price: 19.99`
- **布尔值**: `published: true` 或 `enabled: false`
- **数组**: `tags: [tag1, tag2, tag3]`
- **多行文本**: 
  ```
  description: |
    这是一段
    多行文本
  ```

## 实现细节

1. **解析器**: `js/core/frontmatter-parser.js`
2. **集成**: 在 `renderMarkdownView()` 中自动解析
3. **显示**: Metadata 会在文档内容前以表格形式显示
4. **存储**: 解析后的 metadata 存储在 `this.currentMarkdownMetadata`

## API 使用

```javascript
// 创建解析器实例
const parser = new FrontMatterParser();

// 解析 Markdown
const result = parser.parse(markdownText);
// result = { metadata: {...}, content: "...", hasFrontMatter: true }

// 序列化为 YAML
const yamlText = parser.stringify(metadata);

// 更新 metadata
const updated = parser.updateMetadata(markdownText, { newKey: 'value' }, true);
```

## 字段自定义

你可以添加任意字段，例如：

- `doi`: DOI 标识符
- `keywords`: 关键词列表
- `category`: 文档分类
- `status`: 文档状态
- `priority`: 优先级
- 任何其他自定义字段...

所有字段都会被解析并显示出来！
