# Paper Reviewer - Research Paper Review Tool

一个强大的研究论文审阅工具，支持 JSON 结构化数据、Markdown 笔记和 PDF 查看。

## 🎯 核心功能

- 📄 **项目管理**: 轻松创建和管理多个研究项目
- 🗂️ **文件组织**: 自动管理 JSON 数据、Markdown 笔记和 PDF 文献
- 📊 **结构化编辑**: 支持 JSON 的可视化编辑和验证
- 📝 **Markdown 编辑**: 内置 Markdown 编辑器，支持实时预览
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

访问: **http://localhost:8000**

### 创建第一个项目

1. 打开应用
2. 点击"选择项目文件夹"
3. 在"创建新项目"区域填写项目信息
4. 点击"创建项目"

详见 [QUICK_START.md](QUICK_START.md)

## 📁 项目结构

```
ref_251207_reviewer/
├── index.html           # 主界面
├── server.js            # 后端服务器
├── js/
│   ├── app.js          # 主应用逻辑
│   └── core/           # 核心库和插件
├── css/                # 样式表
├── src/                # 源代码（提示词、工具等）
├── user/               # 用户项目目录
│   ├── json/           # JSON 数据
│   ├── md/             # Markdown 笔记
│   └── pdf/            # PDF 文献
└── docs/               # 文档
```

## 📖 文档

- [快速开始](QUICK_START.md) - 30 秒快速上手
- [项目创建指南](PROJECT_CREATION_GUIDE.md) - 详细的项目创建和管理文档
- [快捷键](shortcuts.md) - 快捷键速查表

## 🎨 新项目目录结构

每个新项目必须包含三个子目录：

```
项目名/
├── json/     # JSON 结构化数据
├── md/       # Markdown 笔记和评论
└── pdf/      # PDF 文献和资料
```

### json/ 目录

存放 JSON 格式的结构化数据，支持多个视图：

```
json/
├── paper1.json              # 默认视图中的文件
├── paper2.json
└── checklist/               # 或创建子目录作为特定视图
    ├── review.json
    └── questions.json
```

### md/ 目录

存放 Markdown 格式的笔记和评论：

```
md/
├── paper1.md               # 对应 paper1.json 的笔记
├── paper2.md
└── notes.md               # 总体笔记
```

### pdf/ 目录

存放 PDF 文献文件：

```
pdf/
├── paper1.pdf             # 对应 paper1.json 的论文
├── paper2.pdf
└── background.pdf         # 相关背景文献
```

## 🔧 服务器 API

### 项目管理

#### 创建项目
```http
POST /create-project
Content-Type: application/json

{
  "projectPath": "user/my_research"
}
```

#### 验证项目
```http
POST /validate-project
Content-Type: application/json

{
  "projectPath": "user/my_research"
}
```

### 文件操作

#### 列出文件
```http
POST /list-json-files
Content-Type: application/json

{
  "projectPath": "user/my_research"
}
```

#### 保存 JSON
```http
POST /save-json
Content-Type: application/json

{
  "projectPath": "user/my_research",
  "filename": "json/paper1.json",
  "content": "{...json data...}"
}
```

#### 保存 Markdown
```http
POST /save-md
Content-Type: application/json

{
  "projectPath": "user/my_research",
  "filename": "md/paper1.md",
  "content": "# Paper 1\n..."
}
```

完整 API 文档见 [PROJECT_CREATION_GUIDE.md](PROJECT_CREATION_GUIDE.md)

## 🔄 向后兼容性

本工具完全兼容旧的项目结构（使用 `data/` 和 `papers/` 目录）。旧项目可以继续使用，系统会自动：

1. 创建新的 `json/`, `md/`, `pdf/` 目录
2. 继续支持旧目录中的文件
3. 优先使用新目录保存文件

## ⚙️ 环境配置

### 端口

默认端口: `8000`

修改端口:
```bash
PORT=3000 npm start
```

### 文件路径

所有项目默认存储在 `user/` 目录下，支持相对路径和绝对路径。

## 🛠️ 开发

### 依赖

- Node.js (用于后端服务器)
- 现代浏览器 (前端)

### 代码结构

- **server.js**: Express-like HTTP 服务器，无框架依赖
- **js/app.js**: 主应用类，处理 UI 逻辑
- **js/core/**: 核心库（Markdown 解析、JSON 编辑等）
- **css/**: 响应式设计样式表

### 扩展

可以通过修改以下文件进行扩展：

- `manifest.json`: 定义提示词和工具
- `src/tools/`: 添加新的 JavaScript 工具
- `src/prompts/`: 添加新的提示词

## 📝 更新日志

### v2.0 (2025-01)
- ✨ 新增项目创建功能
- ✨ 重新设计目录结构 (json/, md/, pdf/)
- ✨ 改进项目管理和加载
- ✅ 完全向后兼容旧项目

### v1.0 (初始版本)
- 基础的 JSON 编辑和 Markdown 笔记功能
- PDF 查看器集成
- 项目管理

## 🤝 贡献

欢迎贡献代码、报告问题和提出建议。

## 📄 许可证

MIT License

## 📧 联系

有问题或建议？请提交反馈。

---

**祝你研究顺利！** 🎓
