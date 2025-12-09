# Paper Reviewer System - 快速参考

## 🚀 一键启动

```bash
cd /Users/yjli/PolyUWorkspace/ref_251207_reviewer
python3 -m http.server 8000
# 访问: http://localhost:8000
```

## 📐 布局说明

```
┌─────────────────────────────────────────────────────────────┐
│  📖 Paper Reviewer System                    💾 Save Changes│  38px
├──────────┬─────────────────────────┬─────────────────────────┤
│📁 JSON   │ 📊 Structured | 🔢 JSON │ 📄 PDF Preview         │  36px
│Files     │ paper_1_data.json       │ ◀ Page 1/10 ▶ - +     │
├──────────┼─────────────────────────┼─────────────────────────┤
│          │                         │                         │
│📄 paper_│ Meta Info               │                         │
│ 1_data   │ ┌─────────────────────┐ │    [PDF Canvas]        │
│  .json   │ │DOI  | 10.1002/...   │ │                         │
│          │ │Title| Sooner... 📍 7│ │                         │
│📄 paper_│ └─────────────────────┘ │                         │
│ 2_...    │                         │                         │
│          │ DID Design Setup       │                         │
│          │ ┌─────────────────────┐ │                         │
│  220px   │ │Model| Staggered... │ │        50%              │
│          │ └─────────────────────┘ │                         │
└──────────┴─────────────────────────┴─────────────────────────┘
```

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + S` | 保存当前JSON |
| `点击值` | 编辑数据 |
| `点击 📍` | 跳转PDF |
| `ESC` | 关闭编辑框 |

## 🎯 核心功能

### 1️⃣ 文件管理
- **左侧栏**: 显示所有JSON文件
- **点击加载**: 异步加载，不影响性能
- **高亮选中**: 当前文件绿色高亮

### 2️⃣ 数据展示
- **结构化视图**: 分节表格，清晰明了
- **JSON视图**: 树形结构，可折叠
- **Tab切换**: 快速切换两种视图

### 3️⃣ 编辑功能
- **点击编辑**: 点击任意值弹出编辑框
- **实时保存**: 修改后立即更新显示
- **下载保存**: 点击"Save Changes"下载

### 4️⃣ PDF查看
- **自动加载**: 根据JSON路径自动加载
- **翻页控制**: Previous / Next 按钮
- **缩放控制**: +/- 按钮
- **高亮跳转**: 点击位置链接跳转并高亮 ✨

## 🎨 紧凑布局特点

### 字体大小 (px)
```
Header:  16
Body:    12
File:    11
Table:   11
Button:  12
Link:    10
```

### 间距 (px)
```
Header Padding:    8 x 15
File Item Padding: 8 x 10
Table Cell:        6 x 10
Section Margin:    12
```

### 宽度 (px)
```
Left Panel:  220
Header:      38
Panel Head:  32
```

## ✨ 高亮跳转功能

### 使用步骤：
1. 在结构化视图中找到带 📍 的链接
2. 点击链接（如 "📍 Page 7"）
3. 观察效果：
   - ✅ 顶部显示绿色通知条
   - ✅ PDF跳转到指定页
   - ✅ 黄色高亮框闪烁
   - ✅ 自动滚动到中心

### 视觉反馈：
```
点击 → 通知条滑入 → PDF跳转 → 高亮脉冲 → 平滑滚动
        (绿色)         (黄色边框)    (2秒动画)
```

## 📊 信息密度对比

| 指标 | v1.0 | v2.0 | 提升 |
|------|------|------|------|
| 单屏文件数 | ~10 | ~15 | +50% |
| 单屏表格行 | ~8 | ~12 | +50% |
| 垂直空间 | 100% | 140% | +40% |
| Header高度 | 48px | 38px | -21% |

## 🔧 自定义调整

### 调整紧凑度
编辑 `css/styles.css`:

```css
/* 更紧凑 */
body { font-size: 11px; }
.json-table td { padding: 4px 8px; }

/* 更宽松 */
body { font-size: 13px; }
.json-table td { padding: 8px 12px; }
```

### 调整高亮时长
编辑 `js/app.js`:

```javascript
// 通知显示时长（默认3秒）
setTimeout(() => {
    notification.remove();
}, 3000);  // 改为 5000 = 5秒

// 高亮动画时长（默认2秒）
setTimeout(() => {
    highlight.remove();
}, 2000);  // 改为 3000 = 3秒
```

### 调整动画速度
编辑 `css/styles.css`:

```css
/* 高亮动画（默认2秒） */
.pdf-highlight-pulse {
    animation: highlightPulse 2s ease-in-out;
}

/* 改为3秒 */
.pdf-highlight-pulse {
    animation: highlightPulse 3s ease-in-out;
}
```

## 📁 文件路径

```
css/styles.css           # 样式文件
js/app.js               # 主逻辑
index.html              # HTML结构
user/data/*.json        # 数据文件
user/papers/*.pdf       # PDF文件
```

## 🐛 故障排除

### 问题: PDF不显示
**解决**: 检查JSON中的`pdf_path`字段，确保PDF文件存在于`user/papers/`

### 问题: 高亮不显示
**解决**: 
1. 刷新页面（Ctrl+R）
2. 清除缓存（Ctrl+Shift+R）
3. 检查浏览器控制台错误

### 问题: 位置链接无效
**解决**: 确保JSON中有对应的`_loc`字段，且包含`pdf_page_index`

### 问题: 样式错乱
**解决**: 
1. 检查`css/styles.css`是否正确加载
2. 查看浏览器控制台网络标签
3. 确保没有404错误

## 💡 最佳实践

1. **文件命名**: 使用描述性名称，如`paper_author_year.json`
2. **PDF路径**: 保持一致的路径格式
3. **位置标记**: 为重要数据添加`_loc`字段
4. **定期保存**: 编辑后及时下载保存
5. **浏览器**: 推荐使用Chrome/Edge以获得最佳性能

## 📞 技术支持

### 日志查看
浏览器控制台（F12）:
- Console: 查看JavaScript错误
- Network: 查看文件加载状态
- Elements: 检查DOM结构

### 服务器日志
查看终端输出，确认文件请求状态码:
- `200`: 成功
- `304`: 缓存有效
- `404`: 文件未找到

## 🎓 示例JSON结构

```json
{
  "meta_info": {
    "title": "Paper Title",
    "title_loc": {
      "pdf_page_index": 1,
      "quote": "引用文本"
    },
    "pdf_path": "user/papers/paper.pdf"
  }
}
```

**注意**: 
- `_loc` 字段提供PDF位置信息
- `pdf_page_index` 从1开始（第1页）
- `quote` 用于通知提示

---

**版本**: 2.0  
**最后更新**: 2025-12-09  
**状态**: ✅ 可用
