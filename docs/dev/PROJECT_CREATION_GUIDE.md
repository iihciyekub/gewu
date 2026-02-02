# 项目创建和管理指南

## 功能概述

本更新为 GEWU 添加了新的项目创建和管理功能，支持以下特性：

### 1. **新项目结构** ✨
新创建的项目必须包含以下三个子目录：
- `项目名/json/` - 存放 JSON 格式的结构化数据
- `项目名/md/` - 存放 Markdown 格式的笔记和评论
- `项目名/pdf/` - 存放 PDF 文件

### 2. **创建新项目**

#### 方式 A: 通过 UI 界面
1. 打开应用，进入"选择项目"对话框
2. 在"创建新项目"区域填写：
   - **项目名称**: 例如 `my_research` 或 `DID_315`
   - **项目路径**: 相对路径（`user/my_project`）或绝对路径（`/Users/username/my_project`）
3. 点击 "创建项目" 按钮
4. 项目将自动创建，并自动加载到应用中

#### 方式 B: 通过 API 直接调用
```bash
curl -X POST http://localhost:8000/create-project \
  -H "Content-Type: application/json" \
  -d '{"projectPath": "user/my_research"}'
```

响应示例：
```json
{
  "success": true,
  "projectKey": "user/my_research",
  "projectPath": "/Users/yjli/PolyUWorkspace/ref_251207_GEWU/user/my_research",
  "message": "项目 \"my_research\" 创建成功",
  "dirs": {
    "json": "user/my_research/json",
    "md": "user/my_research/md",
    "pdf": "user/my_research/pdf"
  }
}
```

### 3. **项目验证**

当加载项目时，系统会自动：
1. 检查项目路径是否存在
2. 验证（或创建）必需的三个目录
3. 返回项目信息和目录位置

API 端点：
```bash
curl -X POST http://localhost:8000/validate-project \
  -H "Content-Type: application/json" \
  -d '{"projectPath": "user/my_research"}'
```

### 4. **文件列表加载**

应用会自动扫描以下位置的文件：

新结构（优先）：
- `json/` - 所有 `.json` 文件被归类为 `json.view1`
- `json/<viewName>/` - 特定视图下的 JSON 文件
- `md/` - 所有 `.md` 文件

旧结构（向后兼容）：
- `data/json.checklist/` - Checklist 类型的 JSON
- `data/json.qa/` - QA 类型的 JSON
- `data/` - 根目录的 JSON 文件
- `data/md/` - Markdown 文件

## 目录结构示例

```
user/
├── my_research/              # 项目目录
│   ├── json/                 # JSON 数据目录
│   │   ├── paper1.json
│   │   ├── paper2.json
│   │   └── view1/            # (可选) 组织视图
│   │       └── checklist.json
│   ├── md/                   # Markdown 笔记目录
│   │   ├── paper1.md
│   │   ├── paper2.md
│   │   └── notes.md
│   ├── pdf/                  # PDF 文件目录
│   │   ├── paper1.pdf
│   │   ├── paper2.pdf
│   │   └── background.pdf
│   └── .project              # 项目标记文件（自动创建）
```

## 操作步骤

### 创建第一个项目
1. 启动服务器: `npm start` 或 `node server.js`
2. 打开浏览器: `http://localhost:8000`
3. 点击"选择项目文件夹"
4. 在"创建新项目"区域：
   - 名称: `first_project`
   - 路径: `user/first_project`
   - 点击"创建项目"
5. 项目自动加载，可以开始添加文件

### 加载现有项目
1. 点击"选择项目文件夹"
2. 浏览选择项目目录（必须包含 `json/`, `md/`, `pdf/` 三个文件夹）
3. 点击"加载项目"

### 添加文件到项目
创建项目后，可以：
- 将 PDF 文件放到 `pdf/` 目录
- 将 JSON 数据文件放到 `json/` 目录
- 将 Markdown 笔记放到 `md/` 目录

系统会自动识别这些文件并显示在文件列表中。


## 服务器 API 参考

### POST /create-project
创建新项目
- **请求**: `{ projectPath: "string" }`
- **响应**: `{ success: bool, projectKey: string, projectPath: string, dirs: {...} }`

### POST /validate-project
验证项目结构
- **请求**: `{ projectPath: "string" }`
- **响应**: `{ valid: bool, jsonDir: string, mdDir: string, pdfDir: string, ... }`

### POST /list-json-files
列出项目中的所有文件
- **请求**: `{ projectPath: "string" }`
- **响应**: `{ success: bool, files: [{name, path, kind, category}, ...] }`

### POST /save-json
保存 JSON 文件
- **请求**: `{ projectPath: string, filename: string, content: string }`
- **响应**: `{ success: bool, path: string }`

### POST /save-md
保存 Markdown 文件
- **请求**: `{ projectPath: string, filename: string, content: string }`
- **响应**: `{ success: bool, path: string }`

## 故障排除

### 问题: "项目路径不存在"
**解决方案**: 确保路径正确，或创建一个新项目

### 问题: "缺少必要的目录"
**解决方案**: 系统会自动创建缺少的 `json/`, `md/`, `pdf/` 目录

### 问题: "找不到我的文件"
**解决方案**: 
1. 检查文件是否在正确的目录中
2. 确保文件扩展名正确（`.json` 或 `.md`）
3. 刷新文件列表（按 F5 或重新加载项目）

## 开发者信息

### 核心改动
- **server.js**: 添加 `/create-project` 端点，更新 `/list-json-files` 支持新结构
- **index.html**: 添加创建项目表单到项目选择器
- **app.js**: 实现 `handleCreateProject()` 方法

### 代码集成点
1. 项目选择器模态窗口 - 支持创建和加载
2. 文件列表扫描 - 同时支持新旧结构
3. 文件保存 - 自动检测并使用正确的目录

## 许可证和支持
有问题或建议？请提交反馈。
