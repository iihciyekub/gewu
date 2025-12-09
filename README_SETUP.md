# Paper Reviewer System - 运行指南

## 系统概述

这是一个类似Overleaf风格的论文审阅系统，具有三栏布局：
- **左侧栏**: JSON文件列表
- **中间栏**: JSON数据编辑器（结构化表格视图 + 扁平JSON视图）
- **右侧栏**: PDF预览器

## 功能特性

### 1. JSON文件管理
- 自动加载 `user/data/` 文件夹中的所有JSON文件
- 点击文件名异步加载数据
- 支持多个JSON文件切换

### 2. 数据编辑
- **结构化视图**: 以表格形式展示JSON数据
- **JSON视图**: 扁平化的JSON树形结构
- 点击任何值可以编辑
- 实时保存修改到JSON文件

### 3. PDF预览
- 自动加载JSON中指定的PDF文件
- 支持翻页、缩放功能
- 位置链接可直接跳转到PDF对应页面

## 启动方法

### 方法1: Python简单HTTP服务器（推荐）

```bash
# 在项目根目录运行
python3 -m http.server 8000
```

然后访问: http://localhost:8000

### 方法2: Node.js http-server

```bash
# 安装http-server (如果还没安装)
npm install -g http-server

# 运行服务器
http-server -p 8000
```

### 方法3: VS Code Live Server

1. 安装 "Live Server" 扩展
2. 右键点击 `index.html`
3. 选择 "Open with Live Server"

## 文件结构要求

```
ref_251207_reviewer/
├── index.html                 # 主页面
├── js/
│   ├── app.js                # 主应用逻辑
│   ├── core/
│   │   ├── jquery-3.7.0.js
│   │   ├── jquery.json-viewer.js
│   │   ├── jquery.json-viewer.css
│   │   └── fontawesome-free-6.7.2-web/
│   └── pdfjs/
│       ├── build/
│       │   ├── pdf.mjs
│       │   └── pdf.worker.mjs
│       └── web/
├── user/
│   ├── data/                 # JSON数据文件夹
│   │   ├── paper_1_data.json
│   │   ├── paper_2_data.json
│   │   └── ...
│   └── papers/               # PDF文件夹
│       ├── joom.1169.pdf
│       └── ...
```

## JSON文件格式

每个JSON文件应包含以下结构：

```json
{
  "meta_info": {
    "doi": "10.1002/joom.1169",
    "pdf_path": "src/papers/joom.1169.pdf",  // 会自动转换为 user/papers/joom.1169.pdf
    "paper_id": "Paper_ID",
    "title": "Paper Title",
    "title_loc": {
      "page_label": "1",
      "pdf_page_index": 1,
      "pdf_open_params": "#page=1",
      "quote": "引用文本"
    }
  },
  "其他字段": {
    "field_name": "value",
    "field_name_loc": {
      "pdf_page_index": 5,
      "quote": "..."
    }
  }
}
```

## 使用说明

### 加载文件
1. 启动服务器后，左侧会自动显示所有JSON文件
2. 点击任意文件名加载数据

### 编辑数据
1. 在结构化视图中，点击任何值会弹出编辑框
2. 修改后点击保存
3. 点击顶部的"Save Changes"按钮下载修改后的JSON文件
4. 手动替换原文件

### PDF导航
1. PDF会根据JSON中的 `pdf_path` 自动加载
2. 使用 Previous/Next 按钮翻页
3. 使用 +/- 按钮缩放
4. 点击数据旁边的位置链接可跳转到对应页面

## 注意事项

1. **必须使用HTTP服务器**: 不能直接双击HTML文件打开，因为需要处理CORS和模块导入
2. **文件路径**: PDF文件应放在 `user/papers/` 文件夹中
3. **JSON格式**: 确保JSON文件格式正确，使用 `_loc` 后缀标记位置信息
4. **保存方式**: 当前版本通过下载方式保存，需要手动替换原文件

## 浏览器兼容性

- Chrome/Edge: ✅ 完全支持
- Firefox: ✅ 完全支持  
- Safari: ✅ 完全支持

建议使用最新版本的现代浏览器。

## 常见问题

### Q: 页面显示空白
A: 检查浏览器控制台是否有错误，确保使用HTTP服务器访问

### Q: PDF无法加载
A: 检查PDF文件路径是否正确，文件是否存在于 `user/papers/` 文件夹

### Q: JSON文件列表为空
A: 确保 `user/data/` 文件夹中有 `.json` 文件

### Q: 编辑后如何保存
A: 点击"Save Changes"按钮会下载文件，需要手动替换原文件

## 技术栈

- **前端框架**: Vanilla JavaScript (ES6 Modules)
- **PDF渲染**: PDF.js
- **JSON显示**: jQuery JSON Viewer
- **样式**: 自定义CSS (Overleaf风格)
- **图标**: Font Awesome 6.7.2
