# `paper_1_data.json` 结构说明

> 用于提示 AI 的结构描述（不包含具体取值）。

## 顶层字段
- `schema_version`：字符串，模式版本。
- `meta_info`：核心元信息对象（必需）。
- `did_design_setup`：DID 研究设计相关字段（可选）。
- `data_metrics`：数据规模与时间窗等指标（可选）。
- `key_findings`：主要与次要发现（可选）。
- `robustness_checks`：稳健性检验与方法（可选）。
- `lastupdate`：字符串，最后更新时间戳。

## 通用子结构
- `*_loc`：对应字段的 PDF 位置信息对象，包含：
  - `page_label`：字符串，页码文本。
  - `pdf_page_index`：数字或 `null`，从 1 开始的页索引。
  - `pdf_open_params`：字符串，PDF 打开参数（如 `#page=7`）。
  - `quote`：字符串数组，相关引用文本片段（可为空数组）。

## `meta_info`（核心）
- `doi`：字符串，论文 DOI。
- `pdf_path`：字符串，PDF 文件相对路径。
- `paper_id`：字符串，内部标识。
- `title`：字符串，论文标题。
- `authors`：字符串，作者列表。
- `wosid`：字符串，Web of Science ID。
- 以上每个字段有对应的 `*_loc` 位置信息对象。
- 其他元字段可扩展（如期刊、年份等），同样可包含 `_loc`。

## `did_design_setup`（DID 设计）
- `model_type`：字符串，模型类型描述。
- `regression_equation`：字符串，可含 LaTeX。
- `variable_y`：字符串，因变量定义。
- `variable_treat`：字符串，处理变量定义。
- `variable_post`：字符串，事后期变量定义。
- 每个字段有对应的 `*_loc` 位置信息对象。

## `data_metrics`
- `sample_size`：字符串，样本规模或描述。
- `time_window`：字符串，时间窗口说明。
- 每个字段有对应的 `*_loc` 位置信息对象。

## `key_findings`
- `primary_result`：字符串，主要发现或核心结果。
- `secondary_result`：字符串，次要发现。
- 每个字段有对应的 `*_loc` 位置信息对象。

## `robustness_checks`
- `endogeneity_method`：字符串，内生性或处理方法。
- `parallel_trend_check`：字符串，平行趋势检验描述。
- 每个字段有对应的 `*_loc` 位置信息对象。

## 可扩展性与缺省
- 各分类 (`meta_info` 等) 可增减字段；未出现的字段可省略。
- `_loc` 对象的字段可为空字符串、`null`，或空数组，用以表示未标注位置。
- 文本字段支持多行字符串；引文数组用于存放若干相关片段。
