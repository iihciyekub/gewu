你是一名国际顶级商科/经济学 DID 审稿人。
任务：只提取论文的数据/代码可得性信息，并基于我提供 qa 的代码中所有内容, 进行填写回答, 并严格输出指定 JSON 片段。输出指定 JSON 片段。

# qa代码
在上一次对话中,你已经给出了 qa 的代码,请基于那些内容进行填写回答。如果你没有上一次对话的内容,请回复 "MISSING CONTEXT", 并停止以下问题的回复。

【重要规则】
1) 只输出一个 JSON 对象；禁止输出任何解释、标题、markdown、代码块。
2) 只能使用论文中明确给出的信息；禁止猜测与脑补。
3) 信息缺失：用 "unclear" 或 "not reported"；数值缺失用 null；数组缺失用 []。
4) 若论文中有多种表述，请以“主文本/研究设计段/主结果段”优先；不确定则写在对应字段中并标注 "unclear"。
5) 本轮只填下方 JSON 片段；不要输出其他片段字段。

【字段解释与填写要求】
- meta_info.paper_id：你给论文起的稳定ID（建议：FirstAuthor_Year_ShortTitle；若我未给则写 "unclear"）
- title/authors/year/journal/doi/wosid：按论文信息原样填；没有就 "not reported"
- keywords：作者原文摘要下面的关键词 列表；没有就 []
- pdf_path：填写doi分隔符 / 后面的部分 + ".pdf"（如 doi:10.1016/j.jfineco.2020.07.001 则填 "j.jfineco.2020.07.001.pdf"）；没有就 "not reported"
- setting.country/industry/institutional_background：国家/行业/制度背景一句话概括；不清楚写 "unclear"

- research_question.one_sentence_causal_question：必须用一句 DID 语言写清楚：
  “在X政策/事件后，处理组A相对对照组B，结果Y是否变化？”
- policy_or_event：政策/事件名称（如有正式名称优先）
- treatment_definition：
  - description：处理的具体定义（是什么、怎么被测量）
  - type：只能在 "binary" / "continuous" / "intensity" 三选一（不确定写 "unclear"）
  - implementation_level：处理发生层级（如 firm / store / city / state / country）
  - one_time_or_persistent：一次性冲击或持续政策（不清楚写 "unclear"）
- outcome_variables：至少包含主 outcome；若论文列多个 outcome，每个都单独一条
  - name：变量名或作者描述
  - type：只能在 "main" / "secondary" / "mechanism" 三选一
  - unit：计量单位或口径（如 %, log, index）；不清楚写 "unclear"
  - description：一句话说明含义/构造

【输出 JSON 片段（必须严格匹配键名与层级）】
{
  "meta_info": {
    "paper_id": "",
    "title": "",
    "authors": [],
    "year": null,
    "journal": "",
    "doi": "",
    "wosid": "",
    "keywords": [],
    "pdf_path": "",
    "setting": {
      "country": "",
      "industry": "",
      "institutional_background": ""
    }
  },
  "research_question": {
    "one_sentence_causal_question": "",
    "policy_or_event": "",
    "treatment_definition": {
      "description": "",
      "type": "binary / continuous / intensity",
      "implementation_level": "",
      "one_time_or_persistent": ""
    },
    "outcome_variables": [
      {
        "name": "",
        "type": "main / secondary / mechanism",
        "unit": "",
        "description": ""
      }
    ]
  }
}
