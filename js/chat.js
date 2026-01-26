/**
 * OpenAI Chat Panel
 * Dec 4, 2025
 */

// Global variables
window.openai_api_key = "";

// Mode options
const MODE_OPTIONS = {
    "query": "wos query builder",
    "chat": "any chat"
};



/**
 * 封装的 OpenAI API 调用函数 - 用于生成 WoS 查询语句
 */

function _wos_query_parse(text) {
    return {
        'model': 'gpt-4.1-nano',
        'input': [
            {
                'role': 'system',
                'content': [
                    {
                        'type': 'input_text',
                        "text": "You are a Web of Science (WoS) query engineer and a bilingual (Chinese↔English) metadata normalizer.\n\nGiven a user input text (possibly containing Chinese and/or English), follow this clear reasoning workflow to produce your output:\n\n1. **Entity Extraction and Normalization**  \n   - Extract author, organization/institution, and journal/publication names from the text.\n   - Normalize all extracted data:\n       - Translate Chinese proper names to standard, official English forms.\n       - Apply all normalization/canonicalization rules (see below), including:\n           - For author names in Chinese, always list the full Chinese pinyin (surname first) in `\"en_variants\"`.\n           - For organization/institution names, always use \"&\" instead of \"and\" if \"and\" is acting as a conjunction.\n           - For journal names, use official English translations where possible.\n       - Provide variants where contextually necessary (do not invent information not present or implied).\n       - Always keep the original Chinese text (if applicable).\n\n2. **Tag Determination Reasoning**  \n   - **Before composing any query, analyze the user input to determine exactly which and how many WoS fields/tags will be needed.**\n     - Consider which specific entities and concepts (authors, organizations, journals, topics, etc.) are present or required for the user's search.\n   - **List each WoS field/tag to be used, with a concise explanation for why it is necessary, according to the extracted information.**\n   \n3. **WoS Query String Construction**  \n   - Using the extracted and normalized entities, and the previously justified WoS field/tags, construct a single, valid query string using the correct fields.\n       - Use official field tags as per the WoS Field Tags Reference (see below).\n       - Within each field, list all variants/values as: FIELD=(...), with multiple values combined with OR, always in English (unless Chinese is retained within the value for variants).\n       - Logical combinations (AND, OR) between fields follow standard WoS protocol.\n       - Do **not** use any overall outer parentheses wrapping the query string; only parentheses around individual field groups as needed.\n   - Format query string as a single line, with no redundant spaces or unnecessary parentheses.\n\n4. **Output All Data in a Strictly Structured JSON Format**  \n   - Output must include:\n       - A `\"kw\"` field: comma-separated essential/summary keywords (in English).\n       - An `\"extracted\"` field: a full breakdown of authors, organizations, journals, and notes, with all `\"zh\"`/English/variant information clearly separated.\n       - A `\"cleaned\"` field with cleaned \"org_en_clean\" and \"journal_en_clean\" values.\n       - A `\"wos_tags_reasoning\"` field: An array or object explicitly detailing which WoS field tags are being used in the query, and why (one reason per tag used).\n       - A `\"query_field\"` field: A \"|\" separated short code summarizing which tags are used in the query string.\n       - A `\"wos_query\"` field: An array of an object `{ \"rowText\": \"<query string>\" }`, containing exactly the final query string.  \n   - The entire output must be a single JSON object, **within a code block labeled `wosquery`**.\n   - All output must strictly be in English (except for original Chinese in \"zh\" arrays).\n   - If a field is absent in the input, output its value as an empty array.\n   - Do not include any keys or commentary beyond those described above.\n\n\n# WoS Field Tags Reference\n\nUse the following standard tags for query construction, as appropriate (refer to this every time):\n\n- TS = Topic\n- TI = Title\n- AB = Abstract\n- AU = Author\n- AI = Author Identifiers\n- AK = Author Keywords\n- GP = Group Author\n- ED = Editor\n- KP = Keyword Plus ®\n- SO = Publication Titles\n- DO = DOI\n- PY = Year Published\n- CF = Conference\n- AD = Address\n- OG = Affiliation\n- OO = Organization\n- SG = Suborganization\n- SA = Street Address\n- CI = City\n- PS = Province/State\n- CU = Country/Region\n- ZP = Zip/Postal Code\n- FO = Funding Agency\n- FG = Grant Number\n- FD = Funding Details\n- FT = Funding Text\n- SU = Research Area\n- WC = Web of Science Categories\n- IS = ISSN/ISBN\n- UT = Accession Number\n- PMID = PubMed ID\n- DOP = Publication Date\n- LD = Index Date\n- PUBL = Publisher\n- ALL = All Fields\n- FPY = Final publication year\n- EAY = Early Access Year\n- SDG = Sustainable Development Goals\n- TMAC = Macro Level Citation Topic\n- TMSO = Meso Level Citation Topic\n- TMIC = Micro Level Citation Topic\n\n(If needed, use only the most specific and relevant tags based on your prior reasoning for this particular input text.)\n\n---\n\n# Extraction and Normalization Steps\n\n- Extract all relevant entities from the input. Only extract entities expressly present or clearly implied.\n- Adhere to the following normalization rules:\n    - **Authors:** Output all supplied forms and always add the full pinyin version for Chinese names, surname first.\n    - **Organizations:** For any English name containing \"and\" as a conjunction, always replace with \"&\" in `\"en_official\"` and `\"en_variants\"`.\n    - **Journals:** Always use official English names, and supply variants if they are in the input or contextually necessary.\n    - Provide original Chinese text if available.\n    - Never add entities not present or clearly implied by the input.\n\nStructure for extraction:\n```\n{\n  \"kw\": \"<summary keywords, English>\",\n  \"extracted\": {\n    \"author\": { \"zh\": [...], \"en_variants\": [...] },\n    \"org\": { \"zh\": [...], \"en_official\": [...], \"en_variants\": [...] },\n    \"journal\": { \"zh\": [...], \"en_official\": [...], \"en_variants\": [...] },\n    \"notes\": [\"...\"]\n  },\n  \"cleaned\": {\n    \"org_en_clean\": [...],\n    \"journal_en_clean\": [...]\n  }\n}\n```\n\n---\n\n# Steps\n\n1. **Extract and normalize all entities from the input.**\n2. **Enumerate and analyze which WoS field tags are required for the user's information need.**\n    - *For every selected tag, provide a short, explicit reason linked to the input text and entity analysis.*\n    - *If no entity or field is relevant, do not add it to the reasoning or query.*\n    - *If unsure, err on the side of minimum necessary fields based strictly on input.*\n3. **Compose the exact WoS query string** using only those tags, following string, parenthesis, and combination logic. (Reminder: No unnecessary outermost parentheses on the full string, only per-field as needed.)\n4. **Output the full result as a single JSON within a `wosquery` code block, matching the schema and order above.**\n\n---\n\n# Output Format\n\n- Output must be a single JSON object, enclosed in a code block labeled `wosquery`.\n- This object **must** have:\n    - `\"kw\"` (string)\n    - `\"extracted\"` (object)\n    - `\"cleaned\"` (object)\n    - `\"wos_tags_reasoning\"` (object or array: each field used, and a brief reason for inclusion)\n    - `\"query_field\"` (string, tags separated by | in the order used)\n    - `\"wos_query\"` (array: single object with `\"rowText\"` string containing the full query as above)\n- All content (except for anything in arrays labeled \"zh\") should be in English.\n- Omit any commentary or keys not in the above schema.\n\n---\n\n# Examples\n\n### Example 1\n\n**Input text:**  \n\"李勇健（Li Yongjian），北京大学（Peking University），发表在《科学通报》（Chinese Science Bulletin）。\"\n\n**Output:**\n```wosquery\n{\n  \"kw\": \"Li Yongjian, Peking University, Chinese Science Bulletin\",\n  \"extracted\": {\n    \"author\": {\n      \"zh\": [\"李勇健\"],\n      \"en_variants\": [\"Li Yongjian\", \"Yongjian Li\"]\n    },\n    \"org\": {\n      \"zh\": [\"北京大学\"],\n      \"en_official\": [\"Peking University\"],\n      \"en_variants\": []\n    },\n    \"journal\": {\n      \"zh\": [\"科学通报\"],\n      \"en_official\": [\"Chinese Science Bulletin\"],\n      \"en_variants\": []\n    },\n    \"notes\": [\"Published in Chinese Science Bulletin.\"]\n  },\n  \"cleaned\": {\n    \"org_en_clean\": [\"Peking University\"],\n    \"journal_en_clean\": [\"Chinese Science Bulletin\"]\n  },\n  \"wos_tags_reasoning\": {\n    \"AU\": \"The input mentions an author (Li Yongjian), so AU (Author) is required.\",\n    \"OG\": \"An organization (Peking University) is specified, so OG (Affiliation) is needed.\",\n    \"SO\": \"A journal (Chinese Science Bulletin) is clearly specified, so SO (Publication Title) is necessary.\"\n  },\n  \"query_field\": \"AU|OG|SO\",\n  \"wos_query\": [\n    { \"rowText\": \"AU=(\\\"Li Yongjian\\\" OR \\\"Yongjian Li\\\") AND OG=(\\\"Peking University\\\") AND SO=(\\\"Chinese Science Bulletin\\\")\" }\n  ]\n}\n```\n\n---\n\n### Example 2\n\n**Input text:**  \n\"王伟，北京生命科学与化学研究院，发表在《生物与化学快报》\"\n\n**Output:**\n```wosquery\n{\n  \"kw\": \"Wang Wei, Beijing Institute of Life & Chemical Sciences, Bio & Chemical Bulletin\",\n  \"extracted\": {\n    \"author\": {\n      \"zh\": [\"王伟\"],\n      \"en_variants\": [\"Wang Wei\"]\n    },\n    \"org\": {\n      \"zh\": [\"北京生命科学与化学研究院\"],\n      \"en_official\": [\"Beijing Institute of Life & Chemical Sciences\"],\n      \"en_variants\": [\"Beijing Institute of Life and Chemical Sciences\"]\n    },\n    \"journal\": {\n      \"zh\": [\"生物与化学快报\"],\n      \"en_official\": [\"Bio & Chemical Bulletin\"],\n      \"en_variants\": []\n    },\n.... the other exact info  from user input  ...\n    \"notes\": [\"Published in Bio & Chemical Bulletin.\"]\n  },\n  \"cleaned\": {\n    \"org_en_clean\": [\"Beijing Institute of Life & Chemical Sciences\"],\n    \"journal_en_clean\": [\"Bio & Chemical Bulletin\"]\n  },\n  \"wos_tags_reasoning\": {\n    \"AU\": \"Wang Wei is recognized as the author, so include AU.\",\n    \"OG\": \"Beijing Institute of Life & Chemical Sciences is the organization, so OG is relevant.\",\n    \"SO\": \"Bio & Chemical Bulletin is named as the journal, so SO should be used.\"\n  },\n  \"query_field\": \"AU|OG|SO\",\n  \"wos_query\": [\n    { \"rowText\": \"AU=(\\\"Wang Wei\\\") AND OG=(\\\"Beijing Institute of Life & Chemical Sciences\\\" OR \\\"Beijing Institute of Life and Chemical Sciences\\\") AND SO=(\\\"Bio & Chemical Bulletin\\\")\" }\n  ]\n}\n```\n(Real examples may contain more fields or explanations per the user's text. For long/complex queries, supply one reason per tag in \"wos_tags_reasoning\" and ensure query logic matches.)\n\n---\n\n# Notes\n\n- You **must** always first list and explain, explicitly, which and how many WoS tags/fields are required based on your extraction and analysis, **before** composing and outputting the query string.\n- Never produce a query containing extra, unnecessary, or unjustified fields—not even for coverage.\n- Use consistent, step-by-step reasoning in all outputs, always ensuring extraction and WoS tag selection precede query construction.\n- *Persistence clause*: Continue through all steps (extraction, normalization, tag reasoning, query construction) until all objectives are met for the input.\n- *Chain of thought clause*: Think step-by-step internally through extraction, tag determination, and only then output the formatted results.\n\n**Key reminders (repeat for long inputs):**\n- **First reason and enumerate field/tags, then compose the query.**\n- **No unnecessary outer parentheses in the final query string.**\n- **Replace \"and\" with \"&\" in official/variant English organization names if used as a conjunction.**\n- **Always output Chinese author names as standard pinyin in en_variants (surname first).**"

                    }
                ]
            },
            {
                'role': 'user',
                'content': [
                    {
                        'type': 'input_text',
                        'text': `${text}`
                    }
                ]
            },
        ],
        'text': {
            'format': {
                'type': 'text'
            }
        },
        "tools": [],
        "temperature": 0.2,
        "max_output_tokens": 1024,
        "top_p": 0.85,
        "store": false,
    }
}


function _any_chat(text) {
    return {
        "model": "gpt-4.1-nano",
        "input": [
            {
                "role": "system",
                "content": [
                    {
                        "type": "input_text",
                        "text": "你是有很有帮助的科研助手，请根据用户的输入提供有用的信息和建议并回答相关问题,使用普通的纯文本格式,不要用MD格式"
                    }
                ]
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        'text': `${text}`
                    }
                ]
            }
        ],
        "text": {
            "format": {
                "type": "text"
            }
        },
        "reasoning": {},
        "tools": [],
        "temperature": 0.2,
        "max_output_tokens": 1024,
        "top_p": 0.85,
        "store": false,
    }
}



/**
 * 封装的 OpenAI API 调用函数
 * @param {Object} jsonData - 要发送的 JSON 数据
 * @returns {Object} - API 响应数据
 * jsonData 示例:
 * await _wos_query_parse()
 */
async function callOpenAI(jsonData) {
    try {
        const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.openai_api_key}`
            },
            body: JSON.stringify(jsonData)
        });
        // 检查响应是否成功
        if (!response.ok) {
            console.error(`API request failed with status: ${response.status}`);
            return null;
        }

        // 尝试解析 JSON
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error calling OpenAI API:', error);
        return null;
    }
}






// 使用示例
async function openai_api_chat_query(text = '') {
    const jsonData = _wos_query_parse(text);
    const result = await callOpenAI(jsonData);
    if (result) {
        const res = result.output[0].content[0].text
        try {
            const parsedResult = JSON.parse(result.output[0].content[0].text)
            const rowText = parsedResult[0]?.rowText;
            await wos.query(rowText);
        } catch (e) {
            console.error('Failed to parse JSON:', e);
        }
    } else {
        console.log('Failed to get valid response');
    }
    return null;
};






async function chat(text = '') {
    const jsonData = _any_chat(text);
    const result = await callOpenAI(jsonData);
    if (result) {
        try {
            const res = result.output[0].content[0].text
            alert(res);
            return res;
        } catch (e) {
            console.error('Failed to parse JSON:', e);
        }
    } else {
        console.log('Failed to get valid response');
    }
    return result.output[0].content[0].text;
};


































/**
 * OpenAI Chat Panel
 */
(function () {
    const mustUrl = "webofscience";
    if (!location.href.includes(mustUrl)) {
        return;
    }

    // Check and remove existing instance
    const existing = document.getElementById("wos_openai_panel");
    if (existing) {
        existing.remove();
    }

    // Load from localStorage
    const POSITION_TOP_KEY = "wos-openai-panel-top";
    const POSITION_LEFT_KEY = "wos-openai-panel-left";
    const WIDTH_KEY = "wos-openai-panel-width";
    const VISIBILITY_KEY = "wos-openai-panel-visible";
    const SETTINGS_VISIBLE_KEY = "wos-openai-panel-settings-visible";
    const MODE_KEY = "wos-openai-panel-mode";
    const API_KEY_STORAGE = "wos-openai-api-key";
    const HISTORY_KEY = "wos-openai-panel-history";

    const savedTop = localStorage.getItem(POSITION_TOP_KEY) || "100px";
    const savedLeft = localStorage.getItem(POSITION_LEFT_KEY) || null;
    const savedWidth = localStorage.getItem(WIDTH_KEY) || "350px";
    const savedVisible = localStorage.getItem(VISIBILITY_KEY);
    const savedSettingsVisible = localStorage.getItem(SETTINGS_VISIBLE_KEY);
    const savedMode = localStorage.getItem(MODE_KEY) || "chat";
    const savedApiKey = localStorage.getItem(API_KEY_STORAGE) || "";
    const savedHistory = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");

    // Initialize global variables
    window.openai_api_key = savedApiKey;

    // History management
    let inputHistory = savedHistory;
    let historyIndex = -1;
    let currentInput = "";

    // Main container
    const box = document.createElement("div");
    box.id = "wos_openai_panel";
    box.style.position = "fixed";
    box.style.top = savedTop;
    if (savedLeft) {
        box.style.left = savedLeft;
    } else {
        box.style.right = "10px";
    }
    box.style.zIndex = "999999";
    box.style.background = "rgba(0,0,0,0.85)";
    box.style.padding = "0";
    box.style.borderRadius = "8px";
    box.style.display = savedVisible === "false" ? "none" : "flex";
    box.style.flexDirection = "column";
    box.style.backdropFilter = "blur(5px)";
    box.style.boxShadow = "0 4px 12px rgba(0,0,0,0.4)";
    box.style.width = savedWidth;
    box.style.minWidth = "300px";
    box.style.maxWidth = "800px";

    // Control row
    const controlRow = document.createElement("div");
    controlRow.style.display = "flex";
    controlRow.style.alignItems = "center";
    controlRow.style.gap = "6px";
    controlRow.style.justifyContent = "space-between";
    controlRow.style.cursor = "move";
    controlRow.style.padding = "8px";
    controlRow.style.background = "rgba(255,255,255,0.1)";
    controlRow.style.borderRadius = "8px 8px 0 0";

    const title = document.createElement("span");
    title.textContent = "OpenAI Chat (Ctrl+1, control+1)";
    title.style.color = "#fff";
    title.style.fontSize = "14px";
    title.style.fontWeight = "bold";

    const modeLabel = document.createElement("span");
    modeLabel.textContent = MODE_OPTIONS[savedMode];
    modeLabel.style.color = "#4CAF50";
    modeLabel.style.fontSize = "12px";
    modeLabel.style.fontWeight = "bold";
    modeLabel.style.padding = "2px 8px";
    modeLabel.style.background = "rgba(76, 175, 80, 0.2)";
    modeLabel.style.borderRadius = "4px";
    modeLabel.style.whiteSpace = "nowrap";
    modeLabel.style.marginLeft = "auto";
    modeLabel.style.cursor = "pointer";
    modeLabel.title = "Click to toggle mode";

    // Click mode label to toggle between query and chat
    modeLabel.addEventListener("click", (e) => {
        e.stopPropagation();
        const currentMode = localStorage.getItem(MODE_KEY) || "chat";
        const newMode = currentMode === "query" ? "chat" : "query";
        localStorage.setItem(MODE_KEY, newMode);
        modeLabel.textContent = MODE_OPTIONS[newMode];

        // Update mode select if settings are visible
        if (row2.style.display !== "none") {
            modeSelect.value = newMode;
        }

    });

    const btnGroup = document.createElement("div");
    btnGroup.style.display = "flex";
    btnGroup.style.gap = "4px";

    const settingsBtn = document.createElement("button");
    settingsBtn.textContent = "⚙";
    settingsBtn.style.background = "rgba(255,255,255,0.15)";
    settingsBtn.style.border = "none";
    settingsBtn.style.color = "#fff";
    settingsBtn.style.padding = "4px 8px";
    settingsBtn.style.borderRadius = "4px";
    settingsBtn.style.cursor = "pointer";
    settingsBtn.style.fontSize = "14px";
    settingsBtn.title = "Toggle Settings";

    btnGroup.appendChild(settingsBtn);

    controlRow.appendChild(title);
    controlRow.appendChild(modeLabel);
    controlRow.appendChild(btnGroup);

    // 使用全局拖动方法
    window.createFreeDragger(box, controlRow, {
        topKey: POSITION_TOP_KEY,
        leftKey: POSITION_LEFT_KEY
    });

    // Content container
    const contentBox = document.createElement("div");
    contentBox.style.display = "flex";
    contentBox.style.flexDirection = "column";
    contentBox.style.gap = "8px";
    contentBox.style.padding = "8px";

    // Row 1: API Key
    const row1 = document.createElement("div");
    row1.style.display = "flex";
    row1.style.alignItems = "center";
    row1.style.gap = "6px";

    const apiLabel = document.createElement("span");
    apiLabel.textContent = "API Key:";
    apiLabel.style.color = "#fff";
    apiLabel.style.fontSize = "13px";
    apiLabel.style.fontWeight = "bold";
    apiLabel.style.width = "65px";
    apiLabel.style.textAlign = "right";
    apiLabel.style.whiteSpace = "nowrap";

    const apiInput = document.createElement("input");
    apiInput.type = "text";
    apiInput.placeholder = "Enter OpenAI API Key";
    apiInput.style.flex = "1";
    apiInput.style.height = "26px";
    apiInput.style.border = "none";
    apiInput.style.padding = "0 8px";
    apiInput.style.borderRadius = "5px";
    apiInput.style.outline = "none";
    apiInput.style.fontSize = "13px";

    // Mask API key
    function maskApiKey(key) {
        if (!key) return "";
        if (key.length <= 10) return key;
        return key.substring(0, 6) + "****" + key.substring(key.length - 4);
    }

    apiInput.value = maskApiKey(savedApiKey);
    let actualApiKey = savedApiKey;
    let isApiFocused = false;

    apiInput.addEventListener("focus", () => {
        isApiFocused = true;
        apiInput.value = actualApiKey;
    });

    apiInput.addEventListener("blur", () => {
        isApiFocused = false;
        apiInput.value = maskApiKey(actualApiKey);
    });

    apiInput.addEventListener("input", (e) => {
        if (isApiFocused) {
            actualApiKey = e.target.value;
            window.openai_api_key = actualApiKey;
            localStorage.setItem(API_KEY_STORAGE, actualApiKey);
        }
    });

    row1.appendChild(apiLabel);
    row1.appendChild(apiInput);
    row1.style.display = savedSettingsVisible === "false" ? "none" : "flex";

    // Row 2: Mode selector
    const row2 = document.createElement("div");
    row2.style.display = "flex";
    row2.style.alignItems = "center";
    row2.style.gap = "6px";

    const modeSelectLabel = document.createElement("span");
    modeSelectLabel.textContent = "mode:";
    modeSelectLabel.style.color = "#fff";
    modeSelectLabel.style.fontSize = "13px";
    modeSelectLabel.style.fontWeight = "bold";
    modeSelectLabel.style.width = "65px";
    modeSelectLabel.style.textAlign = "right";
    modeSelectLabel.style.whiteSpace = "nowrap";

    const modeSelect = document.createElement("select");
    modeSelect.style.flex = "1";
    modeSelect.style.height = "26px";
    modeSelect.style.border = "none";
    modeSelect.style.borderRadius = "5px";
    modeSelect.style.outline = "none";
    modeSelect.style.fontSize = "13px";
    modeSelect.style.padding = "0 8px";

    for (const key in MODE_OPTIONS) {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = MODE_OPTIONS[key];
        if (key === savedMode) option.selected = true;
        modeSelect.appendChild(option);
    }

    modeSelect.addEventListener("change", (e) => {
        const selected = e.target.value;
        localStorage.setItem(MODE_KEY, selected);
        modeLabel.textContent = MODE_OPTIONS[selected];
    });

    row2.appendChild(modeSelectLabel);
    row2.appendChild(modeSelect);
    row2.style.display = savedSettingsVisible === "false" ? "none" : "flex";

    // Settings button toggle
    settingsBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isVisible = row1.style.display !== "none";
        row1.style.display = isVisible ? "none" : "flex";
        row2.style.display = isVisible ? "none" : "flex";
        localStorage.setItem(SETTINGS_VISIBLE_KEY, String(!isVisible));
    });

    // Row 3: Chat input
    const row3 = document.createElement("div");
    row3.style.display = "flex";
    row3.style.flexDirection = "column";
    row3.style.gap = "6px";

    const chatLabel = document.createElement("span");
    chatLabel.textContent = "Chat:";
    chatLabel.style.color = "#fff";
    chatLabel.style.fontSize = "13px";
    chatLabel.style.fontWeight = "bold";

    const chatInput = document.createElement("textarea");
    chatInput.placeholder = "Type your message here... \n(Enter to send, Shift+Enter for new line, ↑↓ for history)";
    chatInput.style.width = "100%";
    chatInput.style.minHeight = "50px";
    chatInput.style.border = "none";
    chatInput.style.padding = "8px";
    chatInput.style.borderRadius = "5px";
    chatInput.style.outline = "none";
    chatInput.style.fontSize = "13px";
    chatInput.style.resize = "vertical";
    chatInput.style.fontFamily = "inherit";
    chatInput.style.boxSizing = "border-box";
    chatInput.rows = 2;

    // Handle keyboard events
    chatInput.addEventListener("keydown", async (e) => {
        // Arrow Up - Navigate to previous history
        if (e.key === "ArrowUp") {
            e.preventDefault();
            if (inputHistory.length === 0) return;

            if (historyIndex === -1) {
                currentInput = chatInput.value;
                historyIndex = inputHistory.length - 1;
            } else if (historyIndex > 0) {
                historyIndex--;
            }
            chatInput.value = inputHistory[historyIndex];
            return;
        }

        // Arrow Down - Navigate to next history
        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (historyIndex === -1) return;

            if (historyIndex < inputHistory.length - 1) {
                historyIndex++;
                chatInput.value = inputHistory[historyIndex];
            } else {
                historyIndex = -1;
                chatInput.value = currentInput;
            }
            return;
        }

        // Enter - Send message
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            const message = chatInput.value.trim();
            if (message) {
                const currentMode = localStorage.getItem(MODE_KEY) || "chat";

                // Save to history
                inputHistory.push(message);
                if (inputHistory.length > 20) {
                    inputHistory.shift();
                }
                localStorage.setItem(HISTORY_KEY, JSON.stringify(inputHistory));
                historyIndex = -1;
                currentInput = "";

                // Update status bar
                statusBar.textContent = `Sending ${currentMode} request...`;
                statusBar.style.background = "#FFA500";

                try {
                    // Execute corresponding method based on mode
                    if (currentMode === "query") {
                        await openai_api_chat_query(message);
                        statusBar.textContent = "Query executed successfully";
                        statusBar.style.background = "#16825D";
                    } else {
                        await chat(message);
                        statusBar.textContent = "Chat response received";
                        statusBar.style.background = "#16825D";
                    }
                } catch (error) {
                    statusBar.textContent = `Error: ${error.message || 'Request failed'}`;
                    statusBar.style.background = "#D32F2F";
                }

                // Reset status after 3 seconds
                setTimeout(() => {
                    statusBar.textContent = "Ready";
                    statusBar.style.background = "#007ACC";
                }, 3000);

                chatInput.value = "";
            }
        }
    });

    row3.appendChild(chatInput);

    contentBox.appendChild(row1);
    contentBox.appendChild(row2);
    contentBox.appendChild(row3);

    // Status bar (VSCode style)
    const statusBar = document.createElement("div");
    statusBar.style.display = "flex";
    statusBar.style.alignItems = "center";
    statusBar.style.padding = "1px 12px";
    statusBar.style.background = "#007ACC";
    statusBar.style.color = "#fff";
    statusBar.style.fontSize = "11px";
    statusBar.style.borderRadius = "0 0 8px 8px";
    statusBar.style.fontFamily = "Consolas, 'Courier New', monospace";
    statusBar.style.minHeight = "16px";
    statusBar.textContent = "Ready";

    box.appendChild(controlRow);
    box.appendChild(contentBox);
    box.appendChild(statusBar);

    document.body.appendChild(box);

    // Ctrl+1 to toggle visibility
    const togglePanelHandler = (e) => {
        if (e.ctrlKey && e.key === "1") {
            e.preventDefault();
            const isVisible = box.style.display !== "none";
            box.style.display = isVisible ? "none" : "flex";
            localStorage.setItem(VISIBILITY_KEY, String(!isVisible));
        }
    };

    document.addEventListener("keydown", togglePanelHandler);
})();
















