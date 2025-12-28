(function () {
    if (document.getElementById('__paste_to_thread_btn__')) return;

    function isVisible(el) {
        if (!el) return false;
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            rect.width > 0 &&
            rect.height > 0
        );
    }

    // ✅ React/现代框架更容易识别的写入方式
    function setNativeValue(el, value) {
        const proto = Object.getPrototypeOf(el);
        const desc = Object.getOwnPropertyDescriptor(proto, 'value');
        const setter = desc && desc.set;
        if (setter) setter.call(el, value);
        else el.value = value;
    }

    function fillTextareaHumanLike(textarea, text) {
        textarea.focus();

        // beforeinput（更接近真实输入链）
        try {
            textarea.dispatchEvent(
                new InputEvent('beforeinput', {
                    bubbles: true,
                    cancelable: true,
                    inputType: 'insertText',
                    data: text,
                })
            );
        } catch (e) {
            // 某些环境 InputEvent 不完整，忽略即可
        }

        // 用原生 setter 设置值（React 常依赖这个）
        setNativeValue(textarea, text);

        // input（关键：触发框架状态更新）
        try {
            textarea.dispatchEvent(
                new InputEvent('input', {
                    bubbles: true,
                    inputType: 'insertText',
                    data: text,
                })
            );
        } catch (e) {
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // change（有些页面靠 change 才算“有效输入”）
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
    }

    async function waitForVisibleTextarea(thread, timeoutMs = 2000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const ta = thread.querySelector('article textarea');
            if (ta && isVisible(ta)) return ta;
            await new Promise(r => setTimeout(r, 50));
        }
        return null;
    }

    const btn = document.createElement('button');
    btn.id = '__paste_to_thread_btn__';
    btn.textContent = '📋 粘贴到输入框';
    btn.style.cssText = `
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 999999;
    padding: 8px 12px;
    background: #111;
    color: #fff;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-size: 14px;
  `;

    btn.onclick = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (!text) return alert('剪贴板为空');

            const thread = document.querySelector('#thread');
            if (!thread) throw new Error('#thread not found');

            // ① 先找 textarea
            let textarea = thread.querySelector('article textarea');

            // ② textarea 不可见才点按钮
            if (!isVisible(textarea)) {
                const actionBtn = thread
                    .querySelector('article')
                    .querySelector('div.z-0.flex.justify-end button:nth-child(2)');

                if (!actionBtn) throw new Error('action button not found');

                actionBtn.click();

                // ✅ 等待 textarea 真的出现且可见（比 setTimeout(100) 更稳）
                textarea = await waitForVisibleTextarea(thread, 2000);
            }

            if (!textarea) throw new Error('textarea still not found/visible');

            // ✅ 用“人类输入链”写入，确保网页识别为有效输入
            fillTextareaHumanLike(textarea, text);

            console.log('✅ 已写入 textarea（框架可识别）');
        } catch (err) {
            console.error(err);
            alert(err.message);
        }
    };

    document.body.appendChild(btn);
})();







// 复制最后一次对话的内容
(() => {
    const ID = '__copy_last_btn__';
    if (document.getElementById(ID)) return;

    // 尝试展开“Show more / 展开 / 更多”之类（不保证每个站都一样，但有帮助）
    function expandIn(el) {
        if (!el) return;
        const btns = [...el.querySelectorAll('button')];
        for (const b of btns) {
            const t = (b.innerText || '').trim().toLowerCase();
            if (!t) continue;
            if (t.includes('show more') || t.includes('more') || t.includes('展开') || t.includes('更多')) {
                try { b.click(); } catch { }
            }
        }
    }

    function getLastAssistantEl() {
        const thread = document.querySelector('#thread');
        if (!thread) return null;

        // 最稳：按 role 找最后一条 assistant
        const assistants = [...thread.querySelectorAll('[data-message-author-role="assistant"]')];
        if (assistants.length) return assistants[assistants.length - 1];

        // 兜底：找最后一个不含 textarea 的 article（避免抓到输入区）
        const articles = [...thread.querySelectorAll('article')];
        for (let i = articles.length - 1; i >= 0; i--) {
            const a = articles[i];
            if (a.querySelector('textarea')) continue;
            return a;
        }
        return null;
    }

    // 只取“完整代码块”（核心：用 textContent）
    function extractAllCodeBlocksMarkdown(msgEl) {
        if (!msgEl) return null;

        // 常见结构：pre > code
        const codeEls = [...msgEl.querySelectorAll('pre code')];
        if (!codeEls.length) return null;

        const blocks = codeEls.map(code => {
            const pre = code.closest('pre');
            // 有些页面会把语言标在 class 或 data- 上；拿不到也无所谓
            const lang =
                (code.className.match(/language-([a-z0-9_-]+)/i)?.[1]) ||
                (pre?.getAttribute('data-language')) ||
                '';

            const codeText = (code.textContent || '').replace(/\s+$/, ''); // 去末尾空白
            return `\`\`\`${lang}\n${codeText}\n\`\`\``;
        });

        return blocks.join('\n\n');
    }

    // 取“正文 + 代码块”（尽量接近 markdown）
    function extractMessageAsMarkdown(msgEl) {
        if (!msgEl) return null;

        // 1) 先把所有代码块提取出来（完整）
        const codesMd = extractAllCodeBlocksMarkdown(msgEl);

        // 2) 再取正文：这里用 innerText 可以（正文通常不截断），并且把代码区域先移除避免重复
        const clone = msgEl.cloneNode(true);
        [...clone.querySelectorAll('pre')].forEach(p => p.remove());
        const text = (clone.innerText || '').trim();

        if (text && codesMd) return `${text}\n\n${codesMd}`;
        if (codesMd) return codesMd;
        if (text) return text;
        return null;
    }

    const btn = document.createElement('button');
    btn.id = ID;
    btn.textContent = '📋 复制最后一条(含完整代码)';
    btn.style.cssText = `
    position: fixed; top: 16px; right: 160px; z-index: 999999;
    padding: 8px 12px; background:#111; color:#fff; border-radius:6px;
    border:none; cursor:pointer; font-size:14px;
  `;

    btn.onclick = async () => {
        try {
            const msgEl = getLastAssistantEl();
            if (!msgEl) {
                await navigator.clipboard.writeText("");
                return null
            };

            // 尝试展开
            expandIn(msgEl);

            // 给展开一点时间
            await new Promise(r => setTimeout(r, 50));

            // ✅ 这里你选一个：
            // 1) 只复制代码块（最“完整代码”导向）
            // const out = extractAllCodeBlocksMarkdown(msgEl);

            // 2) 复制正文 + 完整代码块（更像笔记）
            const out = extractMessageAsMarkdown(msgEl);

            if (!out) {
                await navigator.clipboard.writeText("");
                return null
            };

            await navigator.clipboard.writeText(out);
        } catch (e) {
            await navigator.clipboard.writeText("");
            return null;
        }
    };

    document.body.appendChild(btn);
})();







// 开始新的临时对话
function newchat() {
    document
        .querySelector('#stage-slideover-sidebar nav aside a:nth-child(1)')
        ?.click();
    setTimeout(() => {
        document
            .querySelector("#conversation-header-actions > div > span button")
            ?.click();
    }, 200);
}

(() => {
    const BTN_ID = "__newchat_btn__";
    if (document.getElementById(BTN_ID)) return;

    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.textContent = "🆕 新建临时对话";
    btn.style.cssText = `
      position: fixed;
      bottom: 70px;
      right: 20px;
      z-index: 999999;
      padding: 8px 12px;
      background: #111;
      color: #fff;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      font-size: 14px;
    `;

    btn.onclick = () => {
        try {
            newchat();
        } catch (e) {
            console.error(e);
            alert("新建对话失败：" + e.message);
        }
    };

    document.body.appendChild(btn);
})();






// 发送当前对话
function start() {
    document
        .querySelector("#composer-submit-button")
        ?.click();
}







// -- 粘贴剪贴板的内容到临时对话中
(() => {
    const BTN_ID = "__persistent_clipboard_paste_btn__";

    // ===== 工具函数 =====
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    const ensurePasteFn = () => {
        if (typeof window.pasteToPrompt === "function") return;

        // 内置一个最稳的 pasteToPrompt（contenteditable + textarea 兼容）
        window.pasteToPrompt = function (text, { mode = "replace" } = {}) {
            const el = document.querySelector("#prompt-textarea");
            if (!el) throw new Error("找不到 #prompt-textarea");

            el.scrollIntoView({ block: "center" });
            el.focus();

            const isCE = el.isContentEditable || el.getAttribute("contenteditable") === "true";

            if (isCE) {
                if (mode === "replace") el.innerText = "";
                const sel = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(el);
                range.collapse(false);
                range.insertNode(document.createTextNode(text));
                sel.removeAllRanges();
                sel.addRange(range);
            } else {
                el.value = mode === "append" ? el.value + text : text;
            }

            el.dispatchEvent(
                new InputEvent("input", {
                    bubbles: true,
                    inputType: "insertFromPaste",
                    data: text
                })
            );
        };
    };

    const createButton = () => {
        if (document.getElementById(BTN_ID)) return;

        const btn = document.createElement("button");
        btn.id = BTN_ID;
        btn.textContent = "📋 粘贴到输入框";
        btn.style.cssText = `
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 2147483647;
      padding: 10px 14px;
      border-radius: 12px;
      border: 1px solid #888;
      background: #111;
      color: #fff;
      font-size: 14px;
      cursor: pointer;
      box-shadow: 0 10px 28px rgba(0,0,0,.35);
    `;

        btn.onclick = async () => {
            try {
                ensurePasteFn();
                window.focus(); // 尽量抢焦点

                const text = await navigator.clipboard.readText();
                window.pasteToPrompt(text, { mode: "replace" });

                btn.textContent = "✅ 已粘贴";
                setTimeout(() => (btn.textContent = "📋 粘贴到输入框"), 900);
            } catch (e) {
                console.error("读取剪贴板失败：", e);
                btn.textContent = "❌ 剪贴板被阻止";
                setTimeout(() => (btn.textContent = "📋 粘贴到输入框"), 1500);
            }
        };

        document.body.appendChild(btn);
    };

    // ===== 自愈逻辑 =====
    createButton();

    // ChatGPT 是 SPA：监听 DOM 变化，按钮没了就重建
    const observer = new MutationObserver(() => {
        if (!document.getElementById(BTN_ID)) {
            createButton();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log("✅ 持久剪贴板粘贴按钮已启用（自愈模式）");
})();










// 对剪贴析的文本进行 json 提取转换
(() => {
    const BTN_ID = "__parse_clipboard_json_btn__";

    // ---- 1) 提取 + 解析核心 ----
    function extractJsonFromMixedText(input) {
        if (typeof input !== "string") throw new TypeError("input must be a string");

        // A) 优先 fenced ```json ... ```
        const fenceRe = /```(?:json)?\s*([\s\S]*?)\s*```/i;
        const m = input.match(fenceRe);
        if (m && m[1]) {
            const jsonText = m[1].trim();
            return { jsonText, data: JSON.parse(jsonText) };
        }

        // B) 兜底：括号配对（支持字符串转义，避免误判）
        const start = input.indexOf("{");
        if (start >= 0) {
            let depth = 0, inStr = false, esc = false;

            for (let i = start; i < input.length; i++) {
                const ch = input[i];

                if (inStr) {
                    if (esc) esc = false;
                    else if (ch === "\\") esc = true;
                    else if (ch === '"') inStr = false;
                    continue;
                } else {
                    if (ch === '"') { inStr = true; continue; }
                    if (ch === "{") depth++;
                    if (ch === "}") depth--;
                    if (depth === 0) {
                        const jsonText = input.slice(start, i + 1).trim();
                        return { jsonText, data: JSON.parse(jsonText) };
                    }
                }
            }
        }

        // C) 再兜底：数组 JSON
        const startArr = input.indexOf("[");
        if (startArr >= 0) {
            let depth = 0, inStr = false, esc = false;

            for (let i = startArr; i < input.length; i++) {
                const ch = input[i];

                if (inStr) {
                    if (esc) esc = false;
                    else if (ch === "\\") esc = true;
                    else if (ch === '"') inStr = false;
                    continue;
                } else {
                    if (ch === '"') { inStr = true; continue; }
                    if (ch === "[") depth++;
                    if (ch === "]") depth--;
                    if (depth === 0) {
                        const jsonText = input.slice(startArr, i + 1).trim();
                        return { jsonText, data: JSON.parse(jsonText) };
                    }
                }
            }
        }

        throw new Error("No JSON found in clipboard text");
    }

    // ---- 2) UI 按钮（避免重复插入）----
    if (!document.getElementById(BTN_ID)) {
        const btn = document.createElement("button");
        btn.id = BTN_ID;
        btn.textContent = "📋 解析剪贴板为 JSON";
        btn.style.cssText = `
      position: fixed; right: 16px; bottom: 120px; z-index: 2147483647;
      padding: 10px 14px; border-radius: 12px; border: 1px solid #888;
      background: #111; color: #fff; font-size: 14px; cursor: pointer;
      box-shadow: 0 10px 28px rgba(0,0,0,.35);
    `;

        btn.onclick = async () => {
            try {
                const text = await navigator.clipboard.readText(); // 需要点击触发
                const { jsonText, data } = extractJsonFromMixedText(text);

                console.log("✅ Parsed JSON object:", data);
                console.log("✅ Extracted JSON text:", jsonText);

                // 把纯 JSON 写回剪贴板（可选）
                try {
                    await navigator.clipboard.writeText(jsonText);
                    btn.textContent = "✅ 解析成功（JSON已复制）";
                } catch {
                    btn.textContent = "✅ 解析成功（未写回剪贴板）";
                }

                setTimeout(() => (btn.textContent = "📋 解析剪贴板为 JSON"), 1200);
            } catch (e) {
                console.error("❌ Parse clipboard failed:", e);
                btn.textContent = "❌ 失败（看Console）";
                setTimeout(() => (btn.textContent = "📋 解析剪贴板为 JSON"), 1500);
            }
        };

        document.body.appendChild(btn);
    } else {
        console.log("按钮已存在：", BTN_ID);
    }
})();











// 对剪贴板的文本进行json解析后静默保存
(() => {
    const BTN_ID = "__clip_parse_save_doi_json_btn__";
    const DB_NAME = "doi_json_store_v1";
    const STORE = "files";

    // ---------- utils ----------
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    function doiToFilename(doi) {
        if (!doi) return `no_doi_${Date.now()}.json`;
        return (
            String(doi)
                .trim()
                .replaceAll("/", "_")
                .replaceAll("\\", "_")
                .replaceAll(":", "_")
                .replace(/[<>:"|?*\u0000-\u001F]/g, "_")
                .replace(/\s+/g, "_")
                .slice(0, 180) + ".json"
        );
    }

    // Prefer ```json ... ```; fallback to balanced-scan (object/array)
    function extractJsonFromMixedText(input) {
        if (typeof input !== "string") throw new TypeError("input must be a string");

        // A) fenced block
        const fenceRe = /```(?:json)?\s*([\s\S]*?)\s*```/i;
        const m = input.match(fenceRe);
        if (m && m[1]) {
            const jsonText = m[1].trim();
            return { jsonText, data: JSON.parse(jsonText) };
        }

        // B) balanced scan for object/array
        const tryScan = (openCh, closeCh) => {
            const start = input.indexOf(openCh);
            if (start < 0) return null;

            let depth = 0,
                inStr = false,
                esc = false;

            for (let i = start; i < input.length; i++) {
                const ch = input[i];

                if (inStr) {
                    if (esc) esc = false;
                    else if (ch === "\\") esc = true;
                    else if (ch === '"') inStr = false;
                    continue;
                } else {
                    if (ch === '"') {
                        inStr = true;
                        continue;
                    }
                    if (ch === openCh) depth++;
                    if (ch === closeCh) depth--;
                    if (depth === 0) {
                        const jsonText = input.slice(start, i + 1).trim();
                        return { jsonText, data: JSON.parse(jsonText) };
                    }
                }
            }
            return null;
        };

        return tryScan("{", "}") || tryScan("[", "]") || (() => { throw new Error("No JSON found in text"); })();
    }

    async function saveJsonByDoiSilently(jsonObj, jsonText) {
        const doi = jsonObj?.doi ?? "";
        const filename = doiToFilename(doi);
        const content = jsonText ?? JSON.stringify(jsonObj, null, 2);
        const blob = new Blob([content], { type: "application/json" });
        // 直接触发静默下载到浏览器默认下载目录（不弹出保存窗口）
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            URL.revokeObjectURL(url);
            a.remove();
        }, 0);
        return filename;
    }

    // ---------- UI ----------
    function ensureButton() {
        if (document.getElementById(BTN_ID)) return;

        const btn = document.createElement("button");
        btn.id = BTN_ID;
        btn.textContent = "📋 解析剪贴板JSON并静默保存(按DOI命名)";
        btn.style.cssText = `
      position: fixed; right: 16px; bottom: 160px; z-index: 2147483647;
      padding: 10px 14px; border-radius: 12px; border: 1px solid #888;
      background: #111; color: #fff; font-size: 13px; cursor: pointer;
      box-shadow: 0 10px 28px rgba(0,0,0,.35);
      max-width: 360px;
    `;

        const setStatus = (t) => (btn.textContent = t);

        btn.onclick = async () => {
            try {
                window.focus();

                // user gesture required
                const text = await navigator.clipboard.readText();

                const { jsonText, data } = extractJsonFromMixedText(text);
                const filename = await saveJsonByDoiSilently(data, jsonText);

                setStatus(`✅ 已保存：${filename}`);
                console.log("✅ Saved:", filename, data);

                await sleep(900);
                setStatus("📋 解析剪贴板JSON并静默保存(按DOI命名)");
            } catch (e) {
                console.error("❌ parse/save failed:", e);
                setStatus("❌ 失败（看Console）");
                await sleep(1400);
                setStatus("📋 解析剪贴板JSON并静默保存(按DOI命名)");
            }
        };

        document.body.appendChild(btn);
    }

    // Self-heal in SPA pages
    ensureButton();
    const obs = new MutationObserver(() => ensureButton());
    obs.observe(document.body, { childList: true, subtree: true });

    console.log("✅ 已启用：点击右下角按钮 → 读取剪贴板 → 提取JSON → 按DOI命名 → 静默下载到本地默认下载目录");
})();



(() => {
    const BTN_ID = "__scroll_to_bottom_btn__";
    if (document.getElementById(BTN_ID)) return;

    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.textContent = "⬇️ 滚动到最底部";
    btn.style.cssText = `
      position: fixed;
      right: 16px;
      bottom: 300px;
      z-index: 2147483647;
      padding: 10px 14px;
      border-radius: 12px;
      border: 1px solid #888;
      background: #111;
      color: #fff;
      font-size: 14px;
      cursor: pointer;
      box-shadow: 0 10px 28px rgba(0,0,0,.35);
    `;

    btn.onclick = () => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    };

    document.body.appendChild(btn);
})();