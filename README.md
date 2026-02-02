# Paper Reviewer - Research Paper Review Tool

一个强大的研究论文审阅工具，支持 JSON 结构化数据、Markdown 笔记和 PDF 查看。

## 🎯 核心功能

- 📄 **项目管理**: 轻松创建和管理多个研究项目
- 🗂️ **文件组织**: 自动管理 JSON 数据、Markdown 笔记和 PDF 文献
- 📊 **结构化编辑**: 支持 JSON 的可视化编辑和验证
- 📝 **Markdown 编辑**: 内置 Markdown 编辑器，支持实时预览
- 🏷️ **Front Matter 支持**: 在 Markdown 中添加结构化元数据（NEW!）
- 📖 **PDF 查看**: 集成 PDF 查看器
- 💾 **自动保存**: 实时保存，不丢失工作进度

## 🚀 快速开始

### 安装

```bash
# 克隆或进入项目目录
cd /Users/yjli/PolyUWorkspace/ref_251207_reviewer

# 安装依赖（如果需要）
npm install  # 可选，大多数功能无需额外依赖
```

### 启动

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

### Docker 启动

```bash
docker build -t enlightenkey .

# 将本地项目目录映射到容器 /data
docker run -p 8000:8000 \
  -e HOST=0.0.0.0 \
  -e ALLOWED_ROOTS=/data \
  -v /path/to/projects:/data \
  enlightenkey
```

在应用内创建/选择项目时，使用绝对路径，例如：`/data/my_research`。

使用 docker-compose：

```bash
docker compose up --build
```

### 创建第一个项目

1. 打开应用
2. 点击"选择项目文件夹"
3. 在"创建新项目"区域填写项目信息
4. 点击"创建项目"

详见 [QUICK_START.md](QUICK_START.md)

## 📁 项目结构

每个项目必须包含：

```
项目名/
├── json/      # JSON 结构化数据（默认视图为 json/view1）
├── md/        # Markdown 笔记
├── pdf/       # PDF 文献
└── DRAFT.md   # 草稿（项目根目录）
```

## 📖 文档

- [快速开始](QUICK_START.md)
- [项目创建指南](docs/dev/PROJECT_CREATION_GUIDE.md)
- [快捷键](shortcuts.md)
- [Front Matter 使用指南](FRONTMATTER_GUIDE.md)

## 🐳 Docker 提示

容器内默认只允许 `/data` 作为项目根目录。如需放开范围，运行时覆盖：

```bash
docker run -e ALLOWED_ROOTS=/data,/other/path ...
```
