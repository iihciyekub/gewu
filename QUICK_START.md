# 快速开始 - 项目创建功能

## 🚀 30 秒快速开始

### 1. 启动服务器
```bash
cd /Users/yjli/PolyUWorkspace/ref_251207_reviewer
npm start
# 或
node server.js
```

访问: http://localhost:8000

### 2. 创建新项目

**方式 1: 通过 UI（推荐）**

1. 打开应用
2. 点击左上角 "选择项目文件夹" 按钮
3. 在弹出窗口中填写：
   - **项目名称**: `my_research`
   - **项目路径**: `user/my_research`
4. 点击 **"创建项目"** 按钮
5. ✅ 完成！项目自动加载

**方式 2: 通过命令行**

```bash
curl -X POST http://localhost:8000/create-project \
  -H "Content-Type: application/json" \
  -d '{"projectPath": "user/my_research"}'
```

### 3. 验证项目结构

创建的项目会包含：
```
user/my_research/
├── json/      # 放 JSON 数据文件
├── md/        # 放 Markdown 笔记
├── pdf/       # 放 PDF 文献
└── .project   # 项目标记文件
```

### 4. 添加文件

- 复制 PDF 到 `user/my_research/pdf/`
- 创建 JSON 数据到 `user/my_research/json/`
- 写 Markdown 笔记到 `user/my_research/md/`

文件会自动出现在应用的文件列表中。

## 📁 项目路径格式

### 相对路径（推荐用于项目内部）
```
user/my_project          # 自动创建在 /ref_251207_reviewer/user/my_project
user/research/study1     # 子目录也支持
```

### 绝对路径（支持任意位置）✨
```
/Users/yjli/my_projects/my_research     # macOS/Linux
/home/username/documents/paper_review   # Linux
C:\Users\username\projects\research     # Windows (使用 / 或 \\)
```

**注意**: 
- 绝对路径可以访问系统任意位置的项目
- 相对路径限制在项目根目录内（安全考虑）
- 推荐使用绝对路径访问外部项目

## ⚙️ 配置项目

### 修改项目名称
编辑 `.project` 文件中的 `name` 字段

### 添加更多视图
在 `json/` 下创建子目录：
```
json/
├── paper1.json      # 默认视图
└── checklist/       # 创建 checklist 视图
    ├── review.json
    └── notes.json
```

## 🔄 加载现有项目

1. 点击 "选择项目文件夹"
2. 点击 "浏览" 按钮
3. 选择包含 `json/`, `md/`, `pdf/` 的项目目录
4. 点击 "加载项目"

## ❓ 常见问题

**Q: 项目找不到？**
A: 确保项目路径包含 `json/`, `md/`, `pdf/` 三个文件夹

**Q: 如何使用旧的项目结构？**
A: 仍然支持！只需使用包含 `data/` 和 `papers/` 的旧项目，系统会自动兼容

**Q: 如何导出项目？**
A: 直接复制整个项目文件夹即可，所有数据都在 `json/`, `md/`, `pdf/` 中

## 📝 API 文档

完整的 API 文档请查看 [PROJECT_CREATION_GUIDE.md](PROJECT_CREATION_GUIDE.md)

## ✨ 特性总结

- ✅ 一键创建项目，自动生成目录结构
- ✅ 无需手动创建文件夹
- ✅ 自动加载新创建的项目
- ✅ 完全兼容旧项目结构
- ✅ 支持相对和绝对路径
- ✅ 自动管理文件列表

## 需要帮助？

检查浏览器控制台 (F12) 查看详细错误信息
