现在的新任务：根据我上传的文献内容,以及上一次对话中 qa 的代码中所有内容,进行填写回答, 并严格输出指定 JSON 片段。


【重要规则】
1) 只输出一个 JSON 对象；禁止任何解释/markdown。
2) 只用论文明示信息；缺失用 "unclear"/"not reported"/null/[]。
3) treatment_share：如果论文给出处理组占比/数量比例则填数值；没有填 null。
4) 若对照组存在“尚未处理/从未处理/邻近地区”等，请在 why_valid_counterfactual 解释其逻辑，若作者未解释写 "not reported"。
5) 本轮只填下方 JSON 片段；不要输出其他片段字段。

【字段解释与填写要求】
- sample_and_data.unit_of_analysis：分析单位（firm / plant / store / individual / city 等）
- data_sources：列出数据来源（如 Compustat, administrative data, survey, web-scrape）；没有写 []
- time_range：start/end/frequency（年/季/月）
- sample_construction：
  - inclusion_criteria：进入样本的规则（地区/行业/时期/样本筛选）
  - exclusion_criteria：剔除规则
  - final_sample_size：最终样本量（论文给数字就填；没给 null）

- treated_and_control_groups：
  - treated_group.definition：处理组定义
  - treated_group.selection_mechanism：为何/如何成为处理组（制度规则、阈值、地理覆盖等；没说写 "not reported"）
  - control_group.definition：对照组定义
  - control_group.why_valid_counterfactual：作者用什么逻辑说明对照可比（没说写 "not reported"）
  - potential_contamination.spillover_risk：是否有溢出/污染风险（作者提到就写清；没提写 "not reported"）
  - potential_contamination.mitigation_strategy：如何处理溢出（剔除邻近、buffer、重新定义对照等；没提写 "not reported"）

【输出 JSON 片段】
{
  "sample_and_data": {
    "unit_of_analysis": "",
    "data_sources": [],
    "time_range": {
      "start": "",
      "end": "",
      "frequency": "year / quarter / month"
    },
    "sample_construction": {
      "inclusion_criteria": "",
      "exclusion_criteria": "",
      "final_sample_size": null
    }
  },
  "treated_and_control_groups": {
    "treated_group": {
      "definition": "",
      "selection_mechanism": "",
      "treatment_share": null
    },
    "control_group": {
      "definition": "",
      "why_valid_counterfactual": ""
    },
    "potential_contamination": {
      "spillover_risk": "",
      "mitigation_strategy": ""
    }
  }
}

