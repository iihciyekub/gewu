# Front Matter 快速参考

## 基本格式

```markdown
---
key: value
---
```

## 数据类型示例

```yaml
---
# 字符串
title: 我的文档
author: 张三

# 数字
version: 1.5
count: 100

# 布尔值
published: true
draft: false

# Null
notes: null

# 数组
tags: [标签1, 标签2, 标签3]
authors: [张三, 李四, 王五]

# 多行文本
description: |
  这是第一行
  这是第二行
  这是第三行

# 带引号的字符串（特殊字符）
special: "包含: 冒号的值"
url: "https://example.com"
---

# 文档标题

正文内容从这里开始...
```

## 快速开始

1. **创建文档**：在 Markdown 文件最开头添加 front matter
2. **打开查看**：在应用中打开文档，metadata 自动显示
3. **自由字段**：可以添加任意自定义字段

## 注意事项

✅ **必须在文件最开头**（前面不能有空行）
✅ **使用三个连字符** `---`
✅ **冒号后必须有空格** `key: value`
✅ **数组用方括号** `[item1, item2]`

## 常用字段示例

### 论文/文章
```yaml
---
title: 论文标题
author: 作者名
date: 2026-01-09
doi: 10.1234/example.2026.001
journal: 期刊名
tags: [研究, AI, 深度学习]
---
```

### 项目文档
```yaml
---
title: API 文档
version: 2.0
status: 已发布
lastModified: 2026-01-09
category: 技术文档
---
```

### 任务/待办
```yaml
---
task: 实现功能 X
priority: 高
status: 进行中
assignee: 张三
dueDate: 2026-01-15
progress: 60
---
```

## 测试

打开 `test_frontmatter.html` 进行交互式测试。

## API 使用

```javascript
// 解析
const parser = new FrontMatterParser();
const result = parser.parse(markdownText);
// result.metadata - 元数据对象
// result.content - 文档内容（去除 front matter）

// 获取当前文档的 metadata
const metadata = app.currentMarkdownMetadata;
```

## 更多信息

- 详细指南：[METADATA_FEATURE.md](METADATA_FEATURE.md)
- 完整示例：[EXAMPLE_WITH_METADATA.md](EXAMPLE_WITH_METADATA.md)
- 实现总结：[METADATA_IMPLEMENTATION_SUMMARY.md](METADATA_IMPLEMENTATION_SUMMARY.md)
