Purpose: 辅助审阅 PDF 论文，提供 JSON/Markdown 编辑、PDF 预览、引用复制等功能。
Version: 0.9.0 (preview)  Updated: 2025-01-16  

第三方 JS 组件：
- MathJax 3.2.2 — LaTeX 公式渲染
- markdown-it + footnote/deflist/sub/sup/github-alerts — Markdown 解析与扩展语法
- highlight.js — 代码高亮
- Font Awesome 6.7.2 — 图标集
- JSONRepair — 粘贴/修复不规范的 JSON
- citation.js（citation-js + doi 插件）— 通过 DOI 生成 APA 引用
- PDF.js Web Viewer — PDF 预览与注释
- jQuery + json-viewer — 辅助 JSON 展示
- mermaid — 简易流程图/示意图（如需）

使用提示：
- Cmd+Shift+G 打开工具面板，便捷复制脚本/模板。
- 表格视图中的 `apa` 字段可一键基于 DOI 生成 APA 引用并复制。
- Cmd/Ctrl+S 根据当前视图保存 JSON 或 Markdown，并刷新渲染。
