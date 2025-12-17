你是一名国际顶级商科/经济学期刊 DID 审稿人。
任务：只提取并评估论文 DID 的“估计策略 + 平行趋势证据”，并输出指定 JSON 片段。

【重要规则】
1) 只输出一个 JSON 对象；禁止任何解释/markdown。
2) baseline_equation：尽量按论文回归式原文或标准化写法（但不要臆造不存在的项）；不清楚写 "not reported"。
3) fixed_effects：unit_fe/time_fe 仅当论文明确使用对应 FE 才 true；否则 false 或 "unclear"（但字段是布尔，只能 true/false；不确定时填 false 并在 additional_fe 写 "unclear whether unit FE used" 之类说明）。
4) standard_errors.cluster_level：聚类层级（如 state/firm/city）；没说写 "not reported"。
5) 平行趋势证据：若作者未提供任何检验，evidence_type 填 "not reported"，其他写 "not reported"/"unclear"。
6) 本轮只填下方 JSON 片段；不要输出其他片段字段。

【字段解释与填写要求】
- identification_strategy.method：固定填 "DID"
- baseline_equation：主回归式（含 Treat×Post 或事件研究式）
- fixed_effects.additional_fe：列出额外 FE（如 industry×year, state×year）
- standard_errors：
  - multi_way_cluster：是否双向聚类（作者明确才 true）
  - few_clusters_adjustment：若提到 wild bootstrap/CR2 等写清；没提写 "not reported"

- parallel_trends_assessment：
  - assumption_statement：作者如何表述平行趋势/识别假设
  - evidence_type：只能填 "event-study" / "graphical" / "regression" / "not reported"（若两种都有，优先 "event-study" 并在 notes 说明）
  - pre_trend_results.significance：三选一；若未报告写 "not reported"
  - direction：处理前趋势形态；未报告写 "not reported"
  - event_study_design：参考期、lead/lag窗口、是否 binning tails（未报告写 "not reported"）
  - author_response_if_violated：若趋势不平行作者怎么处理；没提写 "not reported"

【输出 JSON 片段】
{
  "identification_strategy": {
    "method": "DID",
    "baseline_equation": "",
    "fixed_effects": {
      "unit_fe": true,
      "time_fe": true,
      "additional_fe": []
    },
    "standard_errors": {
      "cluster_level": "",
      "multi_way_cluster": false,
      "few_clusters_adjustment": ""
    }
  },
  "parallel_trends_assessment": {
    "assumption_statement": "",
    "evidence_type": "event-study / graphical / regression",
    "pre_trend_results": {
      "significance": "not significant / partially significant / significant",
      "direction": "flat / upward / downward / mixed",
      "notes": ""
    },
    "event_study_design": {
      "reference_period": "",
      "leads_lags_window": "",
      "binning": ""
    },
    "author_response_if_violated": ""
  }
}

【可选：已完成片段】
PASTE_PREVIOUS_JSON_FRAGMENTS_OPTIONAL

【论文内容（优先粘贴：识别策略段、回归式、事件研究图/表说明、附录检验）】
PASTE_PAPER_TEXT_HERE
