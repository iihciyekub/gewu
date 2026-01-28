(() => {
    if (typeof window === 'undefined') return;

    const attachJsonQuery = () => {
        const proto = window.PaperStatsApp?.prototype
            || (window.paperStats ? Object.getPrototypeOf(window.paperStats) : null);
        if (!proto || proto.__jsonQueryAttached) return false;
        proto.__jsonQueryAttached = true;

        proto.renderJsonQueryPlaceholder = function (groups = '', fields = '') {
            const cleanGroups = String(groups || '').replace(/[\r\n]+/g, ' ').trim();
            const cleanFields = String(fields || '').replace(/[\r\n]+/g, ' ').trim();
            const escGroups = this.escapeAttr(cleanGroups);
            const escFields = this.escapeAttr(cleanFields);
            const groupLabel = cleanGroups || 'all';
            const title = `Groups: ${groupLabel}\nFields: ${cleanFields || '(none)'}`;
            const hint = `await json (${groupLabel} → ${cleanFields})...`;
            return `<div class="json-inline" data-json-groups="${escGroups}" data-json-fields="${escFields}"><button class="bib-fetch-btn json-render-btn inline-syntax" type="button" title="${this.escapeAttr(title)}"><i class="fas fa-play"></i><span>${this.escapeHtml(hint)}</span></button></div>`;
        };

        proto.applyJsonQueryRendering = async function (renderRoot) {
            if (!renderRoot) return;
            const blocks = Array.from(renderRoot.querySelectorAll('.json-inline'));
            if (!blocks.length) return;
            blocks.forEach((block) => {
                if (block.dataset.jsonBound === '1') return;
                block.dataset.jsonBound = '1';
                const btn = block.querySelector('.json-render-btn');
                if (btn) {
                    btn.addEventListener('click', () => this.renderJsonQueryBlock(block));
                }
            });
        };

        proto.queryJsonItems = async function ({ groupsRaw = '', fieldsRaw = '' } = {}) {
            const { tokens, useAll } = this.parseGroupTokens(groupsRaw);
            const groups = this.getGroupsByTokens(tokens, useAll);
            const allowedBases = groups.length ? new Set(groups.flatMap(g => (g.files || []).map(String))) : null;
            const fields = String(fieldsRaw || '')
                .split(/[,，]+/)
                .map(v => v.trim())
                .filter(Boolean);
            if (!fields.length) {
                return { items: [], total: 0 };
            }
            const view = this.currentJsonView || 'view1';
            if (!this.fileMetaByBase || !Object.keys(this.fileMetaByBase).length) {
                await this.loadFileList(true);
            }
            const bases = Object.keys(this.fileMetaByBase || {}).filter((base) => {
                const entry = this.fileMetaByBase?.[base];
                const inView = !!(entry?.views && entry.views[view]);
                const inGroup = allowedBases ? allowedBases.has(base) : true;
                return inView && inGroup;
            });
            const items = [];
            const token = ++this.fileFilterComputeToken;
            const tracker = (typeof this.createStatusProgressTracker === 'function')
                ? this.createStatusProgressTracker('Query JSON')
                : null;
            if (tracker) tracker.update('Querying JSON (0%)', 0);

            let cursor = 0;
            const limit = Math.min(4, bases.length || 0) || 1;
            let processed = 0;
            const readWithRetry = async (path) => {
                try {
                    return await this.readProjectFile(path);
                } catch (_err) {
                    await new Promise(resolve => setTimeout(resolve, 60));
                    return await this.readProjectFile(path);
                }
            };
            const worker = async () => {
                while (cursor < bases.length) {
                    const base = bases[cursor];
                    cursor += 1;
                    if (token !== this.fileFilterComputeToken) return;
                    const path = this.getViewPathForBase(base, view);
                    if (!path) continue;
                    let data = this.tempDataCache[path];
                    if (!data) {
                        try {
                            data = await readWithRetry(path);
                        } catch (_err) {
                            continue;
                        }
                    }
                    const doiRaw = data?.meta_info?.doi;
                    const doi = doiRaw ? this.normalizeDoiString(doiRaw) : '';
                    if (!doi) {
                        processed += 1;
                        continue;
                    }
                    const item = { doi };
                    fields.forEach((field) => {
                        const vals = this.getFieldValuesForFilter(data, field);
                        if (vals && vals.length) {
                            item[field] = vals.length === 1 ? vals[0] : vals.join('; ');
                        }
                    });
                    items.push(item);
                    processed += 1;
                    if (processed % 20 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 0));
                    }
                    if (tracker) {
                        const percent = bases.length ? Math.round((processed / bases.length) * 100) : 100;
                        tracker.update(`Querying JSON (${processed}/${bases.length})`, percent);
                    }
                }
            };
            const workers = Array.from({ length: limit }, () => worker());
            await Promise.all(workers);
            if (tracker) tracker.finish('Query JSON done');
            return { items, total: bases.length };
        };

        proto.renderJsonQueryBlock = async function (block) {
            if (!block || block.dataset.jsonRendered === '1') return;
            block.dataset.jsonRendered = '1';
            const groupsRaw = (block.dataset.jsonGroups || '').trim();
            const fieldsRaw = (block.dataset.jsonFields || '').trim();
            const fields = fieldsRaw.split(/[,，]+/).map(v => v.trim()).filter(Boolean);
            if (!fields.length) {
                block.innerHTML = '<div class="groupby-error">No fields specified for \\json{}{}.</div>';
                return;
            }
            block.innerHTML = '<div class="groupby-loading">Querying...</div>';
            const result = await this.queryJsonItems({ groupsRaw, fieldsRaw });
            const items = result?.items || [];
            const jsonText = JSON.stringify(items, null, 2);
            const wrapper = document.createElement('div');
            wrapper.className = 'groupby-box';
            const header = document.createElement('div');
            header.className = 'groupby-header';
            const title = document.createElement('div');
            title.className = 'groupby-title';
            title.textContent = `JSON (${items.length} / ${result?.total || 0})`;
            const actions = document.createElement('div');
            actions.className = 'groupby-actions';
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'groupby-toggle-btn';
            toggleBtn.type = 'button';
            toggleBtn.setAttribute('aria-label', 'Collapse results');
            toggleBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
            const copyBtn = document.createElement('button');
            copyBtn.className = 'groupby-copy-btn';
            copyBtn.innerHTML = '<i class="fas fa-copy"></i><span>Copy JSON</span>';
            copyBtn.addEventListener('click', async () => {
                await this.writeTextToClipboard(jsonText);
                this.flashCopyButton(copyBtn);
                this.showNotification('JSON copied', 'success');
            });
            header.appendChild(toggleBtn);
            actions.appendChild(copyBtn);
            header.appendChild(title);
            header.appendChild(actions);
            wrapper.appendChild(header);
            const body = document.createElement('div');
            body.className = 'groupby-table groupby-json';
            body.innerHTML = `<pre class="groupby-json-pre">${this.escapeHtml(jsonText || '')}</pre>`;
            wrapper.appendChild(body);
            toggleBtn.addEventListener('click', () => {
                wrapper.classList.toggle('groupby-collapsed');
                const collapsed = wrapper.classList.contains('groupby-collapsed');
                toggleBtn.innerHTML = collapsed
                    ? '<i class="fas fa-chevron-down"></i>'
                    : '<i class="fas fa-chevron-up"></i>';
                toggleBtn.setAttribute('aria-label', collapsed ? 'Expand results' : 'Collapse results');
            });
            block.innerHTML = '';
            block.appendChild(wrapper);
        };

        return true;
    };

    if (!attachJsonQuery()) {
        document.addEventListener('DOMContentLoaded', () => {
            attachJsonQuery();
        }, { once: true });
    }
})();
