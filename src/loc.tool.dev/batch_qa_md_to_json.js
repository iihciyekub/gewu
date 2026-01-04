#!/usr/bin/env node
/**
 * batch_qa_md_to_json.js
 *
 * Usage:
 *   node batch_qa_md_to_json.js /path/to/md_dir
 *   node batch_qa_md_to_json.js /path/to/md_dir --dry-run
 *
 * Behavior:
 * - For each .md in dir (non-recursive):
 *   - Parse qa blocks -> JSON
 *   - If parse fails (no blocks or no Qn/An pairs or any __parse_warning), delete the .md (unless --dry-run)
 *   - If parse ok, write same-name .json, keep .md
 */

const fs = require("fs/promises");
const path = require("path");

// =========================
// 1) Section splitter
// =========================
function splitAnswerSections(aTextRaw) {
    const t = (aTextRaw || "").trim();

    const tagRe = /\[(逐步分析与推理链|合成结论|备注)\]/g;
    const hits = [];
    let m;
    while ((m = tagRe.exec(t)) !== null) {
        hits.push({ tag: m[1], idx: m.index, len: m[0].length });
    }

    if (hits.length === 0) {
        return { analysis_chain: null, synthesis: t || null, remarks: null };
    }

    const segs = {};
    for (let i = 0; i < hits.length; i++) {
        const cur = hits[i];
        const next = hits[i + 1];
        const start = cur.idx + cur.len;
        const end = next ? next.idx : t.length;
        const content = t.slice(start, end).trim();

        if (cur.tag === "逐步分析与推理链") segs.analysis_chain = content || null;
        if (cur.tag === "合成结论") segs.synthesis = content || null;
        if (cur.tag === "备注") segs.remarks = content || null;
    }

    return {
        analysis_chain: Object.prototype.hasOwnProperty.call(segs, "analysis_chain")
            ? segs.analysis_chain
            : null,
        synthesis: Object.prototype.hasOwnProperty.call(segs, "synthesis") ? segs.synthesis : null,
        remarks: Object.prototype.hasOwnProperty.call(segs, "remarks") ? segs.remarks : null,
    };
}

// =========================
// 2) QA parser (Q as keys)
// =========================
function parseQaTextToJson(rawText) {
    const MODE = "Q_AS_KEYS"; // "Q_AS_KEYS" | "Q1_ONLY"

    // ```qa@title ...``` or ```qa ...```
    const blockRe = /```[ \t]*qa(?:@title)?[ \t]*([^\n`]*)\n([\s\S]*?)```/g;

    const blocks = [];
    let bm;
    let untitledCount = 0;
    while ((bm = blockRe.exec(rawText)) !== null) {
        const title = (bm[1] || "").trim();
        const body = (bm[2] || "").trim();
        blocks.push({
            title: title || `QA_Block_${++untitledCount}`,
            body,
        });
    }

    const items = blocks.map(({ body, title }, blockIdx) => {
        const qaRe =
            /(^|\n)\s*Q(\d+)\s*[：:﹕]\s*([^\n]+?)\s*\n\s*A\2\s*[：:﹕]\s*([\s\S]*?)(?=\n\s*Q\d+[：:﹕]|\s*$)/g;

        const qas = [];
        let mm;
        while ((mm = qaRe.exec(body)) !== null) {
            qas.push({
                n: Number(mm[2]),
                qText: mm[3].trim(),
                aText: mm[4].trim(),
            });
        }

        if (qas.length === 0) {
            return {
                block_index: blockIdx,
                title,
                parse_warning:
                    "No Qn/An pairs matched. Check formatting of Qn: ... A n: numbering.",
                raw_block: body,
            };
        }

        if (MODE === "Q1_ONLY") {
            const q1 = qas.find((x) => x.n === 1) || qas[0];
            return {
                block_index: blockIdx,
                title,
                [q1.qText]: qas
                    .sort((a, b) => a.n - b.n)
                    .map((x) => {
                        const sections = splitAnswerSections(x.aText);
                        return { qn: x.n, question: x.qText, ...sections };
                    }),
            };
        }

        // MODE === Q_AS_KEYS
        const obj = { block_index: blockIdx, title };
        qas
            .sort((a, b) => a.n - b.n)
            .forEach(({ qText, aText, n }) => {
                let key = qText;
                if (Object.prototype.hasOwnProperty.call(obj, key)) key = `${qText}__Q${n}`;
                obj[key] = splitAnswerSections(aText);
            });
        return obj;
    });

    return items;
}

function toJsonString(obj) {
    return JSON.stringify(obj, null, 2);
}

function isParseOk(parsed) {
    // 必须至少有一个 qa block
    if (!Array.isArray(parsed) || parsed.length === 0) return false;
    for (const it of parsed) {
        if (it && typeof it === "object" && "parse_warning" in it) return false;
    }
    return true;
}

// 将列表形式的解析结果转换为“类字段”对象，避免顶层为数组
function normalizeParsedToObject(parsedList) {
    const out = {};
    if (!Array.isArray(parsedList)) return out;
    parsedList.forEach((item = {}, idx) => {
        if (!item || typeof item !== "object") return;
        const { block_index, title, ...rest } = item;
        // 以标题为键，缺省时用 block 索引占位
        const key = (title && title.trim()) || `block_${typeof block_index === "number" ? block_index : idx}`;
        if (!out[key]) out[key] = {};
        Object.entries(rest).forEach(([k, v]) => {
            out[key][k] = v;
        });
    });
    return out;
}

async function main() {
    const argv = process.argv.slice(2);
    const targetDir = argv[0];
    const dryRun = argv.includes("--dry-run") || argv.includes("-n");

    if (!targetDir) {
        console.error("Usage: node batch_qa_md_to_json.js /path/to/md_dir [--dry-run]");
        process.exit(1);
    }

    const absDir = path.resolve(targetDir);
    const entries = await fs.readdir(absDir, { withFileTypes: true });

    const mdFiles = entries
        .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".md"))
        .map((e) => path.join(absDir, e.name));

    console.log(`Dir: ${absDir}`);
    console.log(`Found .md files: ${mdFiles.length}`);
    console.log(`Mode: ${dryRun ? "DRY-RUN (no write/delete)" : "LIVE"}`);
    console.log("----");

    let okCount = 0;
    let delCount = 0;
    let skipCount = 0;

    for (const mdPath of mdFiles) {
        const base = path.basename(mdPath, path.extname(mdPath));
        const jsonPath = path.join(path.dirname(mdPath), `${base}.json`);

        let raw = "";
        try {
            raw = await fs.readFile(mdPath, "utf8");
        } catch (e) {
            console.warn(`READ FAIL: ${mdPath}\n  ${String(e)}`);
            skipCount++;
            continue;
        }

        const parsed = parseQaTextToJson(raw);
        const ok = isParseOk(parsed);

        if (!ok) {
            console.log(`PARSE FAIL -> DELETE MD: ${path.basename(mdPath)}`);
            if (!dryRun) {
                try {
                    await fs.unlink(mdPath);
                    delCount++;
                } catch (e) {
                    console.warn(`  DELETE FAIL: ${mdPath}\n  ${String(e)}`);
                    skipCount++;
                }
            } else {
                delCount++;
            }
            continue;
        }

        const jsonStr = toJsonString(normalizeParsedToObject(parsed));

        console.log(`OK -> WRITE JSON: ${path.basename(mdPath)} -> ${path.basename(jsonPath)}`);
        if (!dryRun) {
            try {
                await fs.writeFile(jsonPath, jsonStr, "utf8");
                okCount++;
                // 转换成功后删除原 md
                try {
                    await fs.unlink(mdPath);
                } catch (e) {
                    console.warn(`  DELETE MD FAIL (post-convert): ${mdPath}\n  ${String(e)}`);
                }
            } catch (e) {
                console.warn(`  WRITE FAIL: ${jsonPath}\n  ${String(e)}`);
                // 写失败也不删 md（避免误删）；按你的规则只在“解析失败”删 md
                skipCount++;
            }
        } else {
            okCount++;
        }
    }

    console.log("----");
    console.log(`Done. OK(write json): ${okCount}, Deleted(md): ${delCount}, Skipped: ${skipCount}`);
    if (dryRun) console.log("Dry-run finished. Re-run without --dry-run to apply changes.");
}

main().catch((e) => {
    console.error("FATAL:", e);
    process.exit(1);
});
