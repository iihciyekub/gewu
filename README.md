# GEWU

GEWU — a workspace for dissecting texts and composing knowledge.

一个强大的文本研读与知识构建工作台，支持 JSON 结构化数据、Markdown 笔记和 PDF 查看。

## 核心功能

- **项目管理**: 轻松创建和管理多个研究项目
- **文件组织**: 自动管理 JSON 数据、Markdown 笔记和 PDF 文献
- **结构化编辑**: 支持 JSON 的可视化编辑和验证
- **Markdown 编辑**: 内置 Markdown 编辑器，支持实时预览
- **PDF 查看**: 集成 PDF 查看器

## 快速开始

### 安装

```bash
# 确认系统已安装 Git（可选，但建议）
git --version

# Git 安装（如未安装）
# macOS (Homebrew): brew install git
# Windows: https://git-scm.com/download/win
# Ubuntu/Debian: sudo apt update && sudo apt install git

# Node.js 版本（建议 LTS 20）
# 如果使用 nvm：
nvm use

# 安装依赖（如果需要）
npm install  # 可选，大多数功能无需额外依赖
```

### 启动（Node.js）

```bash
npm start
# 或
node server.js
```

默认允许的项目根目录为：`$HOME`、项目根目录、`/data`。如需自定义，可在启动时设置：
```bash
ALLOWED_ROOTS="$HOME,$PWD,/data" npm start
```

访问: **http://localhost:8000**


### 创建第一个项目

1. 打开应用
2. 点击"选择项目文件夹"
3. 在"创建新项目"区域填写项目信息
4. 点击"创建项目"

详见 [QUICK_START.md](QUICK_START.md)

## 项目结构

当前项目目录结构示例（非 Docker，直接用 Node 启动）：

```
data/
├── my_research/              # 项目目录
│   ├── .git/                 # (可选) 项目级 Git 仓库
│   ├── .project              # 项目标记文件（自动创建）
│   ├── json/                 # JSON 数据目录
│   │   ├── view1/            # (可选) 组织视图
│   │   │   ├── paper1.json
│   │   │   ├── paper2.json
│   │   │   └── (其它json)
│   │   ├── view2/            # (可选) 组织视图
│   │   │   ├── paper1.json
│   │   │   ├── paper2.json
│   │   │   └── (其它json)
│   │   └── view3(其它更多)/
│   ├── md/                   # Markdown 笔记目录
│   │   ├── paper1.md
│   │   ├── paper2.md
│   │   └── (其它md)
│   ├── pdf/                  # PDF 文件目录
│   │   ├── paper1.pdf
│   │   ├── paper2.pdf
│   │   └── (其它更多)
│   ├── PROMPT.MD             # Prompt 视图文档（可选）
│   ├── DRAFT.md              # Draft 视图文档（可选）
│   └── (其它md)              # 额外 md 文档 / 辅助文件
```

## 文档

- [快速开始](QUICK_START.md)
- [项目创建指南](docs/dev/PROJECT_CREATION_GUIDE.md)
- [快捷键](shortcuts.md)
