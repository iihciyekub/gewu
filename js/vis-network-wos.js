(function (global) {
    'use strict';

    function buildVisNetworkDataFromWos(raw) {
        const nodes = [];
        const edges = [];
        const nodeIds = new Set();
        if (!raw || typeof raw !== 'object') return { nodes, edges };
        const addNode = (id, label, extra = {}) => {
            if (!id || nodeIds.has(id)) return;
            nodeIds.add(id);
            const hiddenLabel = label != null ? String(label) : '';
            const labelFontSize = extra?.font?.size || 12;
            nodes.push({
                id,
                label: '',
                hiddenLabel,
                labelFontSize,
                ...extra
            });
        };
        const parseNumber = (value) => {
            if (value == null) return 0;
            const rawText = String(value);
            const digits = rawText.replace(/\D+/g, '');
            if (!digits) return 0;
            return Number.parseInt(digits, 10);
        };
        Object.entries(raw).forEach(([rootId, payload]) => {
            if (!rootId) return;
            const rootCitations = payload && payload.citations_count != null ? parseNumber(payload.citations_count) : 0;
            addNode(rootId, rootId, {
                shape: 'dot',
                size: 16,
                font: { size: 14, color: '#111', align: 'bottom', vadjust: 12 },
                citationsValue: rootCitations
            });
            const children = payload && payload.page_wosids;
            if (!Array.isArray(children)) return;
            children.forEach((item) => {
                const childId = item && item.wosid;
                if (!childId) return;
                const citations = item && item.citations_count != null ? item.citations_count : '';
                const related = item && item.related_count != null ? item.related_count : '';
                const ref = item && item.ref_count != null ? item.ref_count : '';
                const label = childId;
                const title = `WOSID: ${childId}\nC:${citations} R:${related} Ref:${ref}`;
                const citationsValue = parseNumber(citations);
                addNode(childId, label, {
                    title,
                    shape: 'dot',
                    size: 12,
                    font: { size: 11, color: '#111', align: 'bottom', vadjust: 12 },
                    citationsValue
                });
                const relatedValue = parseNumber(related);
                edges.push({
                    from: rootId,
                    to: childId,
                    relatedValue
                });
            });
        });
        const minSize = 6;
        const maxSize = 60;
        let minCitation = Infinity;
        let maxCitation = -Infinity;
        let minNodeSize = Infinity;
        let maxNodeSize = -Infinity;
        nodes.forEach((node) => {
            const citations = Number.isFinite(node.citationsValue) ? node.citationsValue : 0;
            minCitation = Math.min(minCitation, citations);
            maxCitation = Math.max(maxCitation, citations);
            const rawSize = citations > 0 ? citations : minSize;
            const size = Math.min(maxSize, minSize + Math.sqrt(rawSize));
            node.size = size;
            minNodeSize = Math.min(minNodeSize, size);
            maxNodeSize = Math.max(maxNodeSize, size);
        });
        edges.forEach((edge) => {
            const base = 1;
            const width = Math.min(8, base + (edge.relatedValue || 0) * 0.08);
            edge.width = Number.isFinite(width) ? width : base;
        });
        const meta = {
            minCitation: Number.isFinite(minCitation) ? minCitation : 0,
            maxCitation: Number.isFinite(maxCitation) ? maxCitation : 0,
            minNodeSize: Number.isFinite(minNodeSize) ? minNodeSize : minSize,
            maxNodeSize: Number.isFinite(maxNodeSize) ? maxNodeSize : minSize
        };
        return { nodes, edges, meta };
    }

    function renderVisNetworkFromJson(raw, options = {}) {
        const container = options.container || document.getElementById('visNetworkCanvas');
        const view = options.view || document.getElementById('visNetworkView');
        if (!container || !view) return { network: null, data: null };
        if (!global.vis || !global.vis.Network) {
            if (options.onError) options.onError('vis-network 未加载');
            return { network: null, data: null };
        }
        let data = raw;
        if (typeof raw === 'string') {
            try {
                data = JSON.parse(raw);
            } catch (err) {
                if (options.onError) options.onError(`JSON 解析失败: ${err.message}`);
                return { network: null, data: null };
            }
        }
        const visData = buildVisNetworkDataFromWos(data);
        if (!visData.nodes.length) {
            view.classList.remove('has-network');
            if (options.onInfo) options.onInfo('没有可渲染的节点');
            return { network: null, data: visData };
        }
        view.classList.add('has-network');
        const dataset = {
            nodes: new vis.DataSet(visData.nodes),
            edges: new vis.DataSet(visData.edges)
        };
        const visOptions = options.visOptions || {
            layout: { hierarchical: false },
            interaction: { hover: true, dragNodes: true, dragView: true },
            physics: {
                enabled: true,
                stabilization: { iterations: 200 }
            },
            nodes: {
                scaling: { enabled: false },
                color: {
                    background: '#ffffff',
                    border: '#111111',
                    highlight: { background: '#ffffff', border: '#111111' },
                    hover: { background: '#ffffff', border: '#111111' }
                },
                borderWidth: 1
            },
            edges: {
                color: { color: '#111111', highlight: '#111111', hover: '#111111' },
                width: 1
            }
        };
        const network = options.network && options.network.setData
            ? options.network
            : new vis.Network(container, dataset, visOptions);
        if (options.network && options.network.setData) {
            options.network.setData(dataset);
            options.network.setOptions(visOptions);
        }
        setupHoverLabels(network, dataset, visData, options, view);
        if (options.labelToggleButton) {
            bindLabelToggleButton(network, dataset, visData, options.labelToggleButton, view);
        }
        if (options.onDebug && visData.meta) {
            options.onDebug(visData.meta);
        }
        return { network, data: visData };
    }

    function debugNodeSize(raw, nodeId) {
        if (!nodeId) return null;
        let data = raw;
        if (typeof raw === 'string') {
            try {
                data = JSON.parse(raw);
            } catch (_e) {
                return null;
            }
        }
        const visData = buildVisNetworkDataFromWos(data);
        const node = visData.nodes.find((n) => n.id === nodeId);
        if (!node) return null;
        return {
            id: node.id,
            citationsValue: node.citationsValue || 0,
            size: node.size
        };
    }

    function getSizeStats(raw) {
        let data = raw;
        if (typeof raw === 'string') {
            try {
                data = JSON.parse(raw);
            } catch (_e) {
                return null;
            }
        }
        const visData = buildVisNetworkDataFromWos(data);
        return visData.meta || null;
    }

    function setupHoverLabels(network, dataset, visData, options, view) {
        if (!network || !dataset) return;
        const labelState = getLabelState(network);
        const layer = ensureLabelLayer(view);
        const hoverLabel = ensureHoverLabel(layer);
        const showLabel = (nodeId) => {
            if (labelState.showAll) return;
            const node = dataset.nodes.get(nodeId);
            if (!node) return;
            hoverLabel.textContent = node.hiddenLabel || '';
            positionLabel(network, hoverLabel, nodeId);
            hoverLabel.classList.add('is-visible');
        };
        const hideLabel = () => {
            if (labelState.showAll) return;
            hoverLabel.classList.remove('is-visible');
        };
        network.off('hoverNode');
        network.off('blurNode');
        network.on('hoverNode', (params) => {
            showLabel(params.node);
        });
        network.on('blurNode', () => {
            hideLabel();
        });
        applyLabelVisibility(dataset, labelState.showAll, network, layer);
    }

    function bindLabelToggleButton(network, dataset, visData, buttonEl, view) {
        if (!buttonEl) return;
        const labelSpan = buttonEl.querySelector('span');
        const updateButtonText = (showAll) => {
            const text = showAll ? 'Hide Labels' : 'Show Labels';
            if (labelSpan) {
                labelSpan.textContent = text;
            } else {
                buttonEl.textContent = text;
            }
        };
        updateButtonText(getLabelState(network).showAll);
        buttonEl.onclick = () => {
            const labelState = getLabelState(network);
            labelState.showAll = !labelState.showAll;
            applyLabelVisibility(dataset, labelState.showAll, network, ensureLabelLayer(view));
            updateButtonText(labelState.showAll);
        };
    }

    function applyLabelVisibility(dataset, showAll, network, layer) {
        if (!dataset || !dataset.nodes) return;
        const updates = dataset.nodes.get().map((node) => ({
            id: node.id,
            label: '',
            font: { ...(node.font || {}), size: 0 }
        }));
        dataset.nodes.update(updates);
        if (!layer || !network) return;
        if (showAll) {
            renderAllLabels(network, dataset, layer);
        } else {
            clearAllLabels(layer);
        }
    }

    function getLabelState(network) {
        if (!network._wosLabelState) {
            network._wosLabelState = { showAll: false };
        }
        return network._wosLabelState;
    }

    function ensureLabelLayer(view) {
        if (!view) return null;
        let layer = view.querySelector('.vis-network-label-layer');
        if (!layer) {
            layer = document.createElement('div');
            layer.className = 'vis-network-label-layer';
            view.appendChild(layer);
        }
        return layer;
    }

    function ensureHoverLabel(layer) {
        if (!layer) return null;
        let label = layer.querySelector('.vis-node-label.is-hover');
        if (!label) {
            label = document.createElement('div');
            label.className = 'vis-node-label is-hover';
            layer.appendChild(label);
        }
        return label;
    }

    function positionLabel(network, labelEl, nodeId) {
        if (!network || !labelEl || !nodeId) return;
        const position = network.getPositions([nodeId])[nodeId];
        if (!position) return;
        const domPos = network.canvasToDOM(position);
        const offsetY = 18;
        labelEl.style.transform = `translate(${domPos.x}px, ${domPos.y + offsetY}px)`;
    }

    function renderAllLabels(network, dataset, layer) {
        if (!layer) return;
        clearAllLabels(layer, true);
        const nodes = dataset.nodes.get();
        nodes.forEach((node) => {
            const label = document.createElement('div');
            label.className = 'vis-node-label';
            label.dataset.nodeId = node.id;
            label.textContent = node.hiddenLabel || '';
            layer.appendChild(label);
        });
        const updatePositions = () => {
            const labels = Array.from(layer.querySelectorAll('.vis-node-label'));
            labels.forEach((label) => {
                const nodeId = label.dataset.nodeId;
                positionLabel(network, label, nodeId);
            });
        };
        updatePositions();
        if (!network._wosLabelUpdate) {
            network._wosLabelUpdate = updatePositions;
            network.on('afterDrawing', updatePositions);
        }
    }

    function clearAllLabels(layer, keepHover = false) {
        if (!layer) return;
        const labels = Array.from(layer.querySelectorAll('.vis-node-label'));
        labels.forEach((label) => {
            if (keepHover && label.classList.contains('is-hover')) return;
            label.remove();
        });
    }

    class WosVisManager {
        constructor(options = {}) {
            this.app = options.app || null;
            this.ids = {
                view: options.viewId || 'visNetworkView',
                canvas: options.canvasId || 'visNetworkCanvas',
                inputDrawer: options.inputDrawerId || 'visInputDrawer',
                inputTextarea: options.inputTextareaId || 'visInputTextarea',
                inputToggleBtn: options.inputToggleBtnId || 'visInputToggleBtn',
                inputCancelBtn: options.inputCancelBtnId || 'visInputCancelBtn',
                inputApplyBtn: options.inputApplyBtnId || 'visInputApplyBtn',
                inputAppendBtn: options.inputAppendBtnId || 'visInputAppendBtn',
                saveBtn: options.saveBtnId || 'visSaveNetworkBtn',
                restoreBtn: options.restoreBtnId || 'visRestoreNetworkBtn',
                deleteBtn: options.deleteBtnId || 'visDeleteNetworkBtn',
                savedSelect: options.savedSelectId || 'visSavedSelect',
                labelToggleBtn: options.labelToggleBtnId || 'visToggleLabelsBtn',
                importBtn: options.importBtnId || 'visImportJsonBtn',
                importJsonFileInput: options.importJsonFileInputId || 'importJsonFileInput'
            };
            this.visNetwork = null;
            this.visNetworkData = null;
            this.visInputText = '';
            this.lastRenderedJson = '';
            this.visNetworkSavedKey = options.visNetworkSavedKey || 'vis-network-saved';
        }

        bind() {
            const inputToggleBtn = this.getEl(this.ids.inputToggleBtn);
            const inputCancelBtn = this.getEl(this.ids.inputCancelBtn);
            const inputApplyBtn = this.getEl(this.ids.inputApplyBtn);
            const inputAppendBtn = this.getEl(this.ids.inputAppendBtn);
            const saveBtn = this.getEl(this.ids.saveBtn);
            const restoreBtn = this.getEl(this.ids.restoreBtn);
            const deleteBtn = this.getEl(this.ids.deleteBtn);
            const importBtn = this.getEl(this.ids.importBtn);
            const importInput = this.getEl(this.ids.importJsonFileInput);

            if (inputToggleBtn) {
                inputToggleBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.toggleInputDrawer(true);
                });
            }
            if (inputCancelBtn) {
                inputCancelBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.toggleInputDrawer(false);
                });
            }
            if (inputApplyBtn) {
                inputApplyBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.applyInput();
                });
            }
            if (inputAppendBtn) {
                inputAppendBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.appendInput();
                });
            }
            if (saveBtn) {
                saveBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.saveNetworkJson();
                });
            }
            if (restoreBtn) {
                restoreBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.restoreNetworkJson();
                });
            }
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.deleteNetworkJson();
                });
            }
            if (importBtn && importInput) {
                importBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    importInput.click();
                });
            }
        }

        getEl(id) {
            return id ? document.getElementById(id) : null;
        }

        notify(message, type = 'info') {
            if (this.app && typeof this.app.showNotification === 'function') {
                this.app.showNotification(message, type);
                return;
            }
            console[type === 'error' ? 'error' : 'log'](message);
        }

        renderFromJson(raw) {
            if (!global.WosVisNetwork) {
                this.notify('WOS Vis 模块未加载', 'error');
                return;
            }
            const { network, data } = global.WosVisNetwork.renderVisNetworkFromJson(raw, {
                container: this.getEl(this.ids.canvas),
                view: this.getEl(this.ids.view),
                network: this.visNetwork,
                labelToggleButton: this.getEl(this.ids.labelToggleBtn),
                onError: (msg) => this.notify(msg, 'error'),
                onInfo: (msg) => this.notify(msg, 'info'),
                onDebug: (meta) => {
                    this.debugMeta = meta;
                }
            });
            if (network) this.visNetwork = network;
            if (data) this.visNetworkData = data;
            this.lastRenderedJson = typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2);
        }

        renderFromCurrentData() {
            const currentData = this.app ? this.app.currentData : null;
            if (currentData && typeof currentData === 'object') {
                const hasWos = Object.values(currentData).some((item) => Array.isArray(item?.page_wosids));
                if (hasWos) {
                    this.renderFromJson(currentData);
                    return;
                }
            }
            if (this.visInputText) {
                this.renderFromJson(this.visInputText);
            } else {
                const view = this.getEl(this.ids.view);
                if (view) view.classList.remove('has-network');
            }
        }

        toggleInputDrawer(forceOpen) {
            const drawer = this.getEl(this.ids.inputDrawer);
            if (!drawer) return;
            const next = typeof forceOpen === 'boolean' ? forceOpen : !drawer.classList.contains('is-open');
            if (!next) {
                const active = document.activeElement;
                if (active && drawer.contains(active)) {
                    active.blur();
                }
            }
            drawer.classList.toggle('is-open', next);
            drawer.setAttribute('aria-hidden', next ? 'false' : 'true');
            drawer.toggleAttribute('inert', !next);
            if (next) {
                const textarea = this.getEl(this.ids.inputTextarea);
                if (textarea) {
                    if (this.visInputText && !textarea.value) {
                        textarea.value = this.visInputText;
                    }
                    textarea.focus();
                    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
                }
                this.loadSavedList().then((list) => {
                    this.renderSavedSelect(list);
                });
            }
        }

        applyInput() {
            const textarea = this.getEl(this.ids.inputTextarea);
            if (!textarea) return;
            this.visInputText = textarea.value || '';
            this.notify('Rendered', 'success');
            if (this.visInputText) {
                this.renderFromJson(this.visInputText);
            }
        }

        appendInput() {
            const textarea = this.getEl(this.ids.inputTextarea);
            if (!textarea) return;
            let incoming = null;
            try {
                incoming = JSON.parse(textarea.value || '');
            } catch (err) {
                this.notify(`JSON 解析失败: ${err.message}`, 'error');
                return;
            }
            let base = null;
            if (this.visInputText) {
                try {
                    base = JSON.parse(this.visInputText);
                } catch (_e) {
                    base = null;
                }
            } else if (this.lastRenderedJson) {
                try {
                    base = JSON.parse(this.lastRenderedJson);
                } catch (_e) {
                    base = null;
                }
            } else if (this.app && this.app.currentData && typeof this.app.currentData === 'object') {
                base = this.app.currentData;
            }
            const merged = this.mergeWosJson(base || {}, incoming);
            this.visInputText = JSON.stringify(merged, null, 2);
            textarea.value = this.visInputText;
            this.renderFromJson(this.visInputText);
            this.notify('Merged and rendered', 'success');
        }

        mergeWosJson(base, incoming) {
            if (!incoming || typeof incoming !== 'object') return base || {};
            if (!base || typeof base !== 'object') return incoming;
            const result = { ...base };
            Object.entries(incoming).forEach(([rootId, payload]) => {
                if (!rootId) return;
                const existing = result[rootId];
                if (!existing || typeof existing !== 'object') {
                    result[rootId] = payload;
                    return;
                }
                const merged = { ...existing, ...payload };
                const baseList = Array.isArray(existing.page_wosids) ? existing.page_wosids : [];
                const addList = Array.isArray(payload.page_wosids) ? payload.page_wosids : [];
                const byId = new Map();
                baseList.forEach((item) => {
                    const id = item?.wosid;
                    if (id) byId.set(id, item);
                });
                addList.forEach((item) => {
                    const id = item?.wosid;
                    if (id) byId.set(id, item);
                });
                merged.page_wosids = Array.from(byId.values());
                result[rootId] = merged;
            });
            return result;
        }

        async loadSavedList() {
            const storage = this.app && this.app.projectStorage;
            if (!storage) return [];
            try {
                const data = await storage.load(this.visNetworkSavedKey);
                if (Array.isArray(data)) return data;
                if (data && Array.isArray(data.items)) return data.items;
                return [];
            } catch (_e) {
                return [];
            }
        }

        async persistSavedList(list) {
            const storage = this.app && this.app.projectStorage;
            if (!storage) return;
            try {
                await storage.save(this.visNetworkSavedKey, list);
            } catch (_e) { }
        }

        renderSavedSelect(list) {
            const select = this.getEl(this.ids.savedSelect);
            if (!select) return;
            select.innerHTML = '';
            if (!list.length) {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = 'No saved items';
                select.appendChild(opt);
                select.disabled = true;
                return;
            }
            select.disabled = false;
            list.forEach((item, idx) => {
                const opt = document.createElement('option');
                opt.value = String(idx);
                opt.textContent = item?.name || `Record ${idx + 1}`;
                select.appendChild(opt);
            });
        }

        async saveNetworkJson() {
            let payload = this.lastRenderedJson || this.visInputText;
            if (!payload && this.app && this.app.currentData && typeof this.app.currentData === 'object') {
                try {
                    payload = JSON.stringify(this.app.currentData, null, 2);
                } catch (_e) { }
            }
            if (!payload) {
                this.notify('No JSON to save', 'info');
                return;
            }
            let parsed = null;
            try {
                parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
            } catch (err) {
                this.notify(`JSON 解析失败: ${err.message}`, 'error');
                return;
            }
            const name = prompt('Save name', `network-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}`);
            if (!name) return;
            const list = await this.loadSavedList();
            list.unshift({
                name,
                createdAt: Date.now(),
                json: JSON.stringify(parsed)
            });
            const trimmed = list.slice(0, 50);
            await this.persistSavedList(trimmed);
            this.renderSavedSelect(trimmed);
            this.notify('Network JSON saved', 'success');
        }

        async restoreNetworkJson() {
            const list = await this.loadSavedList();
            if (!list.length) {
                this.notify('No saved items', 'info');
                return;
            }
            const select = this.getEl(this.ids.savedSelect);
            const idx = select ? Number.parseInt(select.value, 10) : 0;
            const item = list[idx] || list[0];
            if (!item || !item.json) {
                this.notify('Invalid selection', 'error');
                return;
            }
            this.visInputText = item.json;
            this.lastRenderedJson = item.json;
            const textarea = this.getEl(this.ids.inputTextarea);
            if (textarea) textarea.value = item.json;
            this.renderFromJson(item.json);
            this.notify('Network JSON restored', 'success');
        }

        async deleteNetworkJson() {
            const list = await this.loadSavedList();
            if (!list.length) {
                this.notify('No saved items', 'info');
                return;
            }
            const select = this.getEl(this.ids.savedSelect);
            const idx = select ? Number.parseInt(select.value, 10) : 0;
            const item = list[idx] || list[0];
            if (!item) {
                this.notify('Invalid selection', 'error');
                return;
            }
            const ok = confirm(`Delete: ${item.name || 'Untitled'}?`);
            if (!ok) return;
            list.splice(idx, 1);
            await this.persistSavedList(list);
            this.renderSavedSelect(list);
            this.notify('Deleted', 'success');
        }

        debugNode(nodeId) {
            const raw = this.lastRenderedJson || this.visInputText || (this.app ? this.app.currentData : null);
            if (!raw) {
                this.notify('No data to debug', 'info');
                return null;
            }
            const info = global.WosVisNetwork.debugNodeSize(raw, nodeId);
            console.log('[WosVisManager] node size', info);
            return info;
        }

        debugStats() {
            const raw = this.lastRenderedJson || this.visInputText || (this.app ? this.app.currentData : null);
            if (!raw) {
                this.notify('No data to debug', 'info');
                return null;
            }
            const stats = global.WosVisNetwork.getSizeStats(raw);
            console.log('[WosVisManager] size stats', stats);
            return stats;
        }
    }

    global.WosVisNetwork = {
        buildVisNetworkDataFromWos,
        renderVisNetworkFromJson,
        debugNodeSize,
        getSizeStats
    };
    global.WosVisManager = WosVisManager;
})(window);
