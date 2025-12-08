# 统一数据结构说明

## 新的标准化格式

```json
{
  "meta_info": {
    "doi": "10.1287/poms.2017.1713",
    "pdf_path": "./src/papers/example.pdf",
    "paper_id": "Author_Year",
    "title": "论文标题",
    "title_loc": {
      "page_label": "2038",
      "pdf_page_index": 1,
      "pdf_open_params": "#page=1",
      "quote": "标题引用文本..."
    },
    "authors": "作者名",
    "journal_year": "期刊, 年份"
  },
  
  "categories": [
    {
      "id": "did_design_setup",
      "title": "DID设计",
      "icon": "fas fa-flask",
      "items": [
        {
          "key": "model_type",
          "label": "模型类型",
          "value": "Staggered DID (多时点/交错DID)",
          "pdf_location": {
            "page_label": "2044",
            "pdf_page_index": 7,
            "pdf_open_params": "#page=7",
            "quote": "observe the implementation year for each HIT application... DID mimics a quasi-experiment"
          }
        },
        {
          "key": "regression_equation",
          "label": "回归方程",
          "value": "y_{ijkt} = α1 HealthITApp + α2 AfterHealthITApp + β (Interaction) + e",
          "pdf_location": {
            "page_label": "2044",
            "pdf_page_index": 7,
            "pdf_open_params": "#page=7",
            "quote": "Equation (1)"
          }
        }
      ]
    },
    {
      "id": "data_metrics",
      "title": "数据指标",
      "icon": "fas fa-database",
      "items": [
        {
          "key": "sample_size",
          "label": "样本量",
          "value": "65,210 patient admissions",
          "pdf_location": {
            "page_label": "2041",
            "pdf_page_index": 4,
            "pdf_open_params": "#page=4",
            "quote": "Our data consist of 65,210 patient admissions"
          }
        }
      ]
    }
  ]
}
```

## 兼容性

系统会自动将旧格式转换为新格式：

**旧格式:**
```json
{
  "meta_info": { ... },
  "did_design_setup": {
    "model_type": "Staggered DID",
    "model_type_loc": { ... }
  }
}
```

**自动转换为新格式:**
```json
{
  "meta_info": { ... },
  "categories": [
    {
      "id": "did_design_setup",
      "title": "DID设计",
      "icon": "fas fa-flask",
      "items": [
        {
          "key": "model_type",
          "label": "模型类型",
          "value": "Staggered DID",
          "pdf_location": { ... }
        }
      ]
    }
  ]
}
```

## 保存时

编辑后保存会转换回原始格式，以保持与现有文件的兼容性。

## 每个Item的必需字段

- `key`: 字段的唯一标识符（英文，用于程序访问）
- `label`: 显示给用户的中文标签
- `value`: 字段的值（可以是字符串、数字等）
- `pdf_location`: PDF位置信息（可选）
  - `page_label`: 页码标签（如"2044"）
  - `pdf_page_index`: 实际页面索引（从1开始）
  - `pdf_open_params`: PDF打开参数（如"#page=7"）
  - `quote`: 引用的原文文本

## 类别的必需字段

- `id`: 类别的唯一标识符
- `title`: 类别显示标题
- `icon`: Font Awesome图标类名
- `items`: 该类别下的所有项目数组
