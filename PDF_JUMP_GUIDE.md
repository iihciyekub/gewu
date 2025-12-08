# PDF位置跳转功能说明

## 📍 支持的JSON格式

### 1. 直接页码格式
```json
{
  "field_name": "某个值",
  "evidence": "Page 2038"
}
```
点击 "Page 2038" 链接会跳转到第2038页

### 2. _loc字段格式（推荐）
```json
{
  "variable_y": "LOS Deviation (Actual LOS - GMLOS)",
  "variable_y_loc": {
    "page_label": "2042",
    "pdf_page_index": 5,
    "pdf_open_params": "#page=5",
    "quote": "measure the deviation in length of stay from GMLOS"
  }
}
```
- 系统会自动为 `variable_y` 添加跳转链接
- 点击链接跳转到第5页（pdf_page_index）
- 鼠标悬停显示引用内容（quote）

### 3. 对象格式的evidence
```json
{
  "field_name": "某个值",
  "evidence": {
    "page_label": "2044",
    "pdf_page_index": 7,
    "quote": "引用文本..."
  }
}
```

## 🎯 页码跳转逻辑

优先级顺序：
1. **pdf_page_index** - PDF文档的实际页面索引（从1开始）
2. **page_label** - 页面标签（如论文标注的页码"2038"）
3. **文本中的页码** - 从文本中提取的页码（"Page 123"等）

## 📝 支持的页码格式

在文本中支持以下格式：
- `Page 2038` 或 `Page 2041-2042`
- `p.123` 或 `p 123`
- `pp.123-125`
- `页123`
- `第123页`

## 🔧 使用方法

### 自动跳转
1. 在JSON中添加 `_loc` 字段
2. 系统自动生成可点击的链接
3. 点击链接即可跳转

### 手动调用
```javascript
// 跳转到第5页
jumpToPdfPage(5);

// 通过页码标签跳转
jumpToPdfPage("2038");
```

## ✨ 新功能

### 1. 高分辨率渲染
- 默认缩放比例提升到 **150%**
- 使用 **devicePixelRatio** 提升清晰度
- 适配高DPI显示器（Retina等）

### 2. 自适应宽度
- 点击 **↔** 按钮切换自适应模式
- 绿色背景 = 开启自适应
- 灰色背景 = 关闭自适应
- 调整面板大小时PDF自动重新渲染

### 3. 智能字段配对
- 自动识别 `field` 和 `field_loc` 的配对关系
- 跳过重复显示 `_loc` 字段
- 在主字段下方显示位置信息

## 🎨 视觉效果

点击链接后：
- 链接高亮显示（黄色背景，持续1秒）
- PDF自动跳转到目标页
- 页面滚动到顶部
- 页码信息更新

## 💡 最佳实践

### JSON数据结构建议
```json
{
  "meta_info": {
    "pdf_path": "./src/papers/example.pdf"
  },
  "content": {
    "key_finding": "主要发现内容",
    "key_finding_loc": {
      "page_label": "123",
      "pdf_page_index": 5,
      "quote": "原文引用"
    }
  }
}
```

### 命名规范
- 主字段名：`field_name`
- 位置字段名：`field_name_loc`
- 系统自动配对并生成跳转链接
