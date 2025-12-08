# PDF文献分析管理工具

## 🚀 启动方法

```bash
cd /Users/yjli/PolyUWorkspace/ref_251207_reviewer
node server.js
```

然后在浏览器中打开: http://localhost:8000

## 📝 功能说明

### 1. JSON数据格式支持

系统自动识别以下JSON结构中的PDF路径：
- `data.pdf_path`
- `data.meta_info.pdf_path`
- `data.metadata.pdf_path`

### 2. PDF加载方式

**自动加载**: 选择左侧JSON文件时自动加载对应PDF

**手动加载**: 
- 点击右上角 📁 按钮
- 选择本地PDF文件
- 支持任意PDF文件

### 3. 页面导航

**点击页码链接**: 表格中的页码（如"Page 2038"）可以点击，自动跳转到PDF对应页面

**支持的页码格式**:
- `Page 2038`
- `p.123` / `pp.123-125`
- `页123` / `第123页`

### 4. 面板调整

**拖拽分隔条**: 所有三个面板都可以通过拖拽中间的分隔条调整大小

**快捷键**:
- `←` / `→` - PDF翻页
- `+` / `-` - PDF缩放

## 📂 目录结构

```
/src/                    - JSON数据文件目录
/src/papers/            - PDF文件目录
/css/styles.css         - 样式表
/js/app.js              - 主应用逻辑
/js/pdfjs/              - PDF.js库
index.html              - 主页面
server.js               - Node.js服务器
```

## 🎨 设计特点

- **紧凑学术风格**: 最大化信息密度
- **Overleaf配色**: 绿色主题配色方案
- **响应式布局**: 可拖拽调整面板大小
- **智能数据识别**: 自动适配不同JSON结构

## 🔧 故障排除

### PDF无法加载
1. 检查JSON中的 `pdf_path` 字段是否正确
2. 确认PDF文件存在于指定路径
3. 点击 📁 按钮手动加载PDF

### 拖拽不工作
- 刷新页面
- 确保鼠标在分隔条上（4px宽的灰色区域）
- 鼠标悬停时分隔条应变为绿色

### 表格显示异常
- 检查JSON格式是否正确
- 尝试切换"分层视图"和"扁平视图"
