# LaTeX 风格命令自动补全测试

## 功能说明

本系统已升级支持 LaTeX 风格的引用命令：

### 支持的命令格式

1. **引用命令**
   - `\cite{doi}` - 叙述式引用 (Narrative citation)
   - `\citep{doi}` - 括号式引用 (Parenthetical citation)
   - `\bib{doi}` - BibTeX 条目 (按需加载)
   - `\goto{text}` - PDF 跳转链接

2. **兼容性**
   - 同时支持带反斜杠 `\cite{}` 和不带反斜杠 `cite{}` 的格式
   - 推荐使用 LaTeX 标准格式 `\cite{}`

### 自动补全功能

在 Markdown 编辑器中输入 `\` 字符时，会自动触发代码补全：

- **触发**: 输入 `\`
- **过滤**: 继续输入以过滤命令列表
- **选择**: 使用 ↑↓ 箭头键选择
- **插入**: 按 Enter 或 Tab 插入选中的命令
- **取消**: 按 Esc 关闭补全菜单

### 使用示例

```markdown
根据最近的研究 \cite{10.1038/nature12345}，我们发现...

多项研究表明 \citep{10.1038/s41586-020-2649-2, 10.1126/science.abc1234}

参考文献：
\bib{10.1038/nature12345}

详见文中 \goto{Figure 1}
```

### 命令列表

系统从 `src/tabCode/code.json` 加载命令定义，支持：

- `\cite{doi}` - 叙述式引用
- `\citep{doi}` - 括号式引用
- `\bib{doi}` - BibTeX 条目
- `\goto{text}` - PDF 跳转
- `\section{title}` - 章节标题
- `\subsection{title}` - 子章节标题
- `\textbf{text}` - 粗体文本
- `\textit{text}` - 斜体文本
- `\emph{text}` - 强调文本
- `\ref{label}` - 交叉引用
- `\label{name}` - 标签
- `\url{link}` - URL 链接
- `\href{url}{text}` - 超链接
- `\begin{environment}` - 环境块
- `\item` - 列表项

### 技术实现

1. **语法识别**: 使用正则表达式 `/\\?cite\{([^}]+)\}/g` 同时匹配两种格式
2. **自动补全**: AutocompleteManager 类管理补全逻辑
3. **命令配置**: JSON 文件定义命令，支持动态加载
4. **占位符**: 支持 `$1`, `$2` 等占位符，自动定位光标

### 自定义命令

编辑 `src/tabCode/code.json` 可添加自定义命令：

```json
{
  "commands": [
    {
      "trigger": "\\mycommand",
      "label": "\\mycommand{arg}",
      "insertText": "\\mycommand{$1}",
      "detail": "My custom command",
      "documentation": "Description of the command"
    }
  ]
}
```

### 注意事项

- 自动补全在 Markdown 源码编辑模式下工作
- 渲染视图中会正确显示引用和 BibTeX 条目
- 缓存清除后会自动重新查询 DOI 信息
- 支持多级补全和嵌套命令
