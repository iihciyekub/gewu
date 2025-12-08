# PDF自动加载功能说明

## 功能概述

系统现在会**自动根据DOI查找并加载PDF文件**，无需在JSON中手动指定`pdf_path`。

## 工作原理

### 1. PDF路径优先级

系统按以下顺序查找PDF：

1. **显式路径优先** - 如果JSON中有`pdf_path`字段，直接使用
   ```json
   {
     "meta_info": {
       "pdf_path": "./src/papers/custom.pdf"
     }
   }
   ```

2. **DOI自动查找** - 如果没有显式路径，从DOI自动构建路径
   ```json
   {
     "meta_info": {
       "doi": "10.1287/poms.2017.1713"
     }
   }
   ```

### 2. DOI到文件名映射

系统会尝试以下文件名格式（按顺序）：

| DOI示例 | 尝试的文件名 |
|---------|-------------|
| `10.1287/poms.2017.1713` | `10.1287/poms.2017.1713.pdf` |
| `10.1287/poms.2017.1713` | `10.1287_poms.2017.1713.pdf` |
| `10.1287/poms.2017.1713` | `10.1287-poms.2017.1713.pdf` |
| `10.1287/poms.2017.1713` | `poms.2017.1713.pdf` |

### 3. 查找目录

默认PDF目录：`./src/papers/`

系统会依次检查上述文件名是否存在，找到第一个存在的文件即停止。

## 使用示例

### 示例1：最简配置（推荐）

JSON文件只需包含DOI，PDF会自动加载：

```json
{
  "meta_info": {
    "doi": "10.1111/poms.12748",
    "title": "论文标题",
    "authors": "作者"
  },
  "did_design_setup": {
    "model_type": "Staggered DID"
  }
}
```

对应PDF文件名（任一即可）：
- `./src/papers/10.1111/poms.12748.pdf` ✅
- `./src/papers/10.1111_poms.12748.pdf` ✅
- `./src/papers/poms.12748.pdf` ✅

### 示例2：自定义PDF路径

如果需要使用特定PDF文件：

```json
{
  "meta_info": {
    "doi": "10.1111/poms.12748",
    "pdf_path": "./src/papers/my_custom_paper.pdf"
  }
}
```

系统会直接使用`pdf_path`，忽略DOI自动查找。

### 示例3：兼容旧格式

系统支持多种JSON结构：

```json
{
  "pdf_path": "./src/papers/paper.pdf",  // 顶层
  "meta_info": {
    "doi": "10.xxxx/yyyy"
  }
}
```

```json
{
  "metadata": {
    "pdf_path": "./src/papers/paper.pdf",  // metadata中
    "doi": "10.xxxx/yyyy"
  }
}
```

## 文件命名建议

### 推荐命名方式

使用DOI的最后部分作为文件名（最简洁）：

- DOI: `10.1287/poms.2017.1713`
- 文件名: `poms.2017.1713.pdf`

### 备选命名方式

使用完整DOI，斜杠替换为下划线：

- DOI: `10.1287/poms.2017.1713`
- 文件名: `10.1287_poms.2017.1713.pdf`

## 自动加载触发时机

PDF自动加载在以下情况触发：

1. **选择JSON文件时** - 自动检测并加载对应PDF
2. **点击PDF链接时** - 如果PDF未加载，自动查找并加载
3. **双击编辑保存后** - 重新渲染时自动检查PDF

## 控制台日志

系统会在控制台输出PDF查找过程：

```
从DOI构建PDF路径: 10.1287/poms.2017.1713
找到PDF文件: ./src/papers/10.1287_poms.2017.1713.pdf
```

如果未找到：

```
从DOI构建PDF路径: 10.1287/poms.2017.1713
未找到PDF文件
```

## 错误处理

如果PDF未找到，界面会显示：

```
📄 未找到PDF文件
在 ./src/papers/ 目录中未找到对应的PDF
[手动加载PDF按钮]
```

用户可以点击按钮手动选择PDF文件。

## 迁移指南

### 从旧格式迁移

如果你的JSON文件中有`pdf_path`字段：

1. **保持现状** - 系统会继续使用显式路径
2. **简化配置** - 移除`pdf_path`，按DOI命名PDF文件
   
   **之前：**
   ```json
   {
     "meta_info": {
       "doi": "10.1111/poms.12748",
       "pdf_path": "./src/papers/10.1111_poms.12748.pdf"
     }
   }
   ```
   
   **之后：**
   ```json
   {
     "meta_info": {
       "doi": "10.1111/poms.12748"
     }
   }
   ```
   
   PDF文件保持在：`./src/papers/10.1111_poms.12748.pdf`

## 优势

✅ **简化JSON** - 不再需要在每个JSON中指定PDF路径  
✅ **自动关联** - DOI自动关联到PDF文件  
✅ **向后兼容** - 支持旧的`pdf_path`配置  
✅ **智能查找** - 支持多种文件命名格式  
✅ **容错性强** - 多种格式尝试，提高成功率

## 技术实现

核心函数：`autoLoadPdfFromDoi(data)`

```javascript
// 1. 检查显式路径
let pdfPath = data.pdf_path || data.meta_info?.pdf_path;

// 2. 没有路径时从DOI构建
if (!pdfPath && doi) {
  const possibleFilenames = [
    `${doi}.pdf`,
    `${doi.replace(/\//g, '_')}.pdf`,
    `${doi.replace(/\//g, '-')}.pdf`,
    `${doi.split('/').pop()}.pdf`
  ];
  
  // 3. 依次检查文件是否存在
  for (const filename of possibleFilenames) {
    const testPath = `./src/papers/${filename}`;
    if (await checkPdfExists(testPath)) {
      pdfPath = testPath;
      break;
    }
  }
}

// 4. 加载PDF
if (pdfPath) await loadPdf(pdfPath);
```
