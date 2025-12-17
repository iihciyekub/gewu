你是一名国际顶级商科/经济学 DID 审稿人。
任务：只提取论文的稳健性检验、异质性分析、机制检验，并输出指定 JSON 片段。

【重要规则】
1) 只输出一个 JSON 对象；禁止任何解释/markdown。
2) robustness_checks：用“要点列表式文本”写清做了什么（placebo/换样本/换对照/换设定等）；没有就 "not reported"。
3) heterogeneity_analysis：
   - grouping_dimensions：列出分组维度名称（如 firm size, baseline exposure, region）
   - ex_ante_or_post：若分组变量为处理前确定→"ex-ante"；若可能受处理影响→"post-treatment"
   - implication_for_identification：根据异质性是否符合理论而定（不确定写 "neutral"）
4) mechanism_analysis：
   - hypothesized_channels：作者提出的机制通道列表
   - mechanism_variables_tested：实际检验过的机制变量列表
   - timing_consistency：机制变量变化是否符合时间顺序（不清楚写 "unclear"）
5) 本轮只填下方 JSON 片段；不要输出其他片段字段。

【输出 JSON 片段】
{
  "robustness_checks": {
    "placebo_tests": "",
    "alternative_samples": "",
    "alternative_control_groups": "",
    "alternative_specifications": "",
    "summary_assessment": ""
  },
  "heterogeneity_analysis": {
    "grouping_dimensions": [],
    "ex_ante_or_post": "ex-ante / post-treatment",
    "key_findings": "",
    "interpretation": "",
    "implication_for_identification": "strengthens / weakens / neutral"
  },
  "mechanism_analysis": {
    "hypothesized_channels": [],
    "mechanism_variables_tested": [],
    "timing_consistency": "yes / unclear / no",
    "alternative_mechanisms_addressed": "",
    "assessment": ""
  }
}

【可选：已完成片段】
PASTE_PREVIOUS_JSON_FRAGMENTS_OPTIONAL

【论文内容（优先粘贴：稳健性表/附录、异质性段、机制段、图表说明）】
PASTE_PAPER_TEXT_HERE
