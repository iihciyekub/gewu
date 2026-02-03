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
                const title = `${childId}\nC:${citations} R:${related} Ref:${ref}`;
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
        nodes.forEach((node) => {
            const citations = Number.isFinite(node.citationsValue) ? node.citationsValue : 0;
            minCitation = Math.min(minCitation, citations);
            maxCitation = Math.max(maxCitation, citations);
        });
        let minNodeSize = Infinity;
        let maxNodeSize = -Infinity;
        nodes.forEach((node) => {
            const citations = Number.isFinite(node.citationsValue) ? node.citationsValue : 0;
            let size = minSize;
            if (Number.isFinite(minCitation) && Number.isFinite(maxCitation) && maxCitation > minCitation) {
                const t = (citations - minCitation) / (maxCitation - minCitation);
                size = minSize + t * (maxSize - minSize);
            }
            node.size = size;
            minNodeSize = Math.min(minNodeSize, size);
            maxNodeSize = Math.max(maxNodeSize, size);
        });
        let minRelated = Infinity;
        let maxRelated = -Infinity;
        edges.forEach((edge) => {
            const related = Number.isFinite(edge.relatedValue) ? edge.relatedValue : 0;
            minRelated = Math.min(minRelated, related);
            maxRelated = Math.max(maxRelated, related);
            const base = 1;
            const width = Math.min(8, base + related * 0.08);
            edge.width = Number.isFinite(width) ? width : base;
        });
        const normalize = (val, min, max) => {
            if (!Number.isFinite(val)) return 0;
            if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return 0;
            return (val - min) / (max - min);
        };
        const nodeRelatedMax = new Map();
        edges.forEach((edge) => {
            const related = Number.isFinite(edge.relatedValue) ? edge.relatedValue : 0;
            const currentFrom = nodeRelatedMax.get(edge.from) || 0;
            const currentTo = nodeRelatedMax.get(edge.to) || 0;
            nodeRelatedMax.set(edge.from, Math.max(currentFrom, related));
            nodeRelatedMax.set(edge.to, Math.max(currentTo, related));
        });
        edges.forEach((edge) => {
            const related = Number.isFinite(edge.relatedValue) ? edge.relatedValue : 0;
            const t = normalize(related, minRelated, maxRelated);
            const alpha = 0.15 + t * 0.7;
            edge.color = {
                color: `rgba(0,0,0,${alpha.toFixed(3)})`,
                highlight: `rgba(0,0,0,${Math.min(1, alpha + 0.1).toFixed(3)})`,
                hover: `rgba(0,0,0,${Math.min(1, alpha + 0.15).toFixed(3)})`
            };
        });
        nodes.forEach((node) => {
            const related = nodeRelatedMax.get(node.id) || 0;
            const t = normalize(related, minRelated, maxRelated);
            const alpha = 0.35 + t * 0.55;
            node.color = {
                background: '#ffffff',
                border: `rgba(0,0,0,${Math.min(1, alpha + 0.15).toFixed(3)})`,
                highlight: {
                    background: '#ffffff',
                    border: `rgba(0,0,0,${Math.min(1, alpha + 0.25).toFixed(3)})`
                },
                hover: {
                    background: '#ffffff',
                    border: `rgba(0,0,0,${Math.min(1, alpha + 0.2).toFixed(3)})`
                }
            };
            const labelGray = Math.max(30, Math.round(30 + (1 - t) * 60));
            node.labelStyle = {
                fontSize: Math.max(10, Math.min(16, 8 + Math.sqrt(Math.max(1, node.size)))),
                textColor: `rgb(${labelGray}, ${labelGray}, ${labelGray})`,
                borderColor: `rgba(0,0,0,${Math.min(1, alpha + 0.15).toFixed(3)})`,
                backgroundColor: '#ffffff'
            };
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
                borderWidth: 1.5,
                borderWidthSelected: 2.5,
                shadow: {
                    enabled: true,
                    color: 'rgba(0, 0, 0, 0.18)',
                    size: 10,
                    x: 2,
                    y: 3
                },
                shapeProperties: {
                    borderDashes: false
                }
            },
            edges: {
                color: { color: '#111111', highlight: '#111111', hover: '#111111' },
                width: 1.4,
                smooth: { type: 'dynamic', roundness: 0.25 },
                shadow: {
                    enabled: true,
                    color: 'rgba(0, 0, 0, 0.2)',
                    size: 6,
                    x: 1,
                    y: 2
                }
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
            if (node.labelHidden) return;
            hoverLabel.textContent = node.hiddenLabel || '';
            applyLabelStyle(hoverLabel, node);
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
            applyLabelStyle(label, node);
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

    function applyLabelStyle(label, node) {
        if (!label || !node || !node.labelStyle) return;
        const style = node.labelStyle;
        if (style.fontSize) label.style.fontSize = `${style.fontSize}px`;
        if (style.textColor) label.style.color = style.textColor;
        if (style.borderColor) label.style.borderColor = style.borderColor;
        if (style.backgroundColor) label.style.backgroundColor = style.backgroundColor;
        let opacity = typeof style.opacity === 'number' ? style.opacity : 1;
        if (node.labelHidden) opacity = 0;
        label.style.opacity = String(opacity);
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
                labelPanelBtn: options.labelPanelBtnId || 'visToggleLabelsBtn',
                labelDrawer: options.labelDrawerId || 'visLabelDrawer',
                labelToggleBtn: options.labelToggleBtnId || 'visLabelToggleAllBtn',
                labelCloseBtn: options.labelCloseBtnId || 'visLabelCloseBtn',
                labelFieldInput: options.labelFieldInputId || 'visLabelFieldInput',
                labelSuggest: options.labelSuggestId || 'visLabelSuggest',
                labelFields: options.labelFieldsId || 'visLabelFields',
                labelFadeSlider: options.labelFadeSliderId || 'visLabelFadeSlider',
                labelSizeSlider: options.labelSizeSliderId || 'visLabelSizeSlider',
                labelMinSlider: options.labelMinSliderId || 'visLabelMinSlider',
                labelMinValue: options.labelMinValueId || 'visLabelMinValue',
                importBtn: options.importBtnId || 'visImportJsonBtn',
                importJsonFileInput: options.importJsonFileInputId || 'importJsonFileInput',
                zoomInBtn: options.zoomInBtnId || 'visZoomInBtn',
                zoomOutBtn: options.zoomOutBtnId || 'visZoomOutBtn',
                zoomFitBtn: options.zoomFitBtnId || 'visZoomFitBtn',
                zoomResetBtn: options.zoomResetBtnId || 'visZoomResetBtn',
                zoomSlider: options.zoomSliderId || 'visZoomSlider'
            };
            this.visNetwork = null;
            this.visNetworkData = null;
            this.visInputText = '';
            this.lastRenderedJson = '';
            this.visNetworkSavedKey = options.visNetworkSavedKey || 'vis-network-saved';
            this.zoomMin = 0.1;
            this.zoomMax = 2.0;
            this.zoomStep = 0.1;
            this.labelField = 'wosid';
            this.labelFade = 0;
            this.labelSizeScale = 1;
            this.labelMinCitations = 0;
            this.labelFieldOptions = [];
            this.labelSuggestIndex = -1;
            this.labelValueMap = new Map();
            this.wosDataIndex = null;
            this.wosDataIndexSource = null;
            this.labelFieldsSelected = [];
        }

        bind() {
            this.mountDrawer();
            this.mountLabelDrawer();
            const inputToggleBtn = this.getEl(this.ids.inputToggleBtn);
            const inputCancelBtn = this.getEl(this.ids.inputCancelBtn);
            const inputApplyBtn = this.getEl(this.ids.inputApplyBtn);
            const inputAppendBtn = this.getEl(this.ids.inputAppendBtn);
            const saveBtn = this.getEl(this.ids.saveBtn);
            const restoreBtn = this.getEl(this.ids.restoreBtn);
            const deleteBtn = this.getEl(this.ids.deleteBtn);
            const savedSelect = this.getEl(this.ids.savedSelect);
            const importBtn = this.getEl(this.ids.importBtn);
            const importInput = this.getEl(this.ids.importJsonFileInput);
            const labelPanelBtn = this.getEl(this.ids.labelPanelBtn);
            const labelCloseBtn = this.getEl(this.ids.labelCloseBtn);
            const labelFieldInput = this.getEl(this.ids.labelFieldInput);
            const labelSuggest = this.getEl(this.ids.labelSuggest);
            const labelFields = this.getEl(this.ids.labelFields);
            const labelFadeSlider = this.getEl(this.ids.labelFadeSlider);
            const labelSizeSlider = this.getEl(this.ids.labelSizeSlider);
            const labelMinSlider = this.getEl(this.ids.labelMinSlider);
            const labelMinValue = this.getEl(this.ids.labelMinValue);
            const zoomInBtn = this.getEl(this.ids.zoomInBtn);
            const zoomOutBtn = this.getEl(this.ids.zoomOutBtn);
            const zoomFitBtn = this.getEl(this.ids.zoomFitBtn);
            const zoomResetBtn = this.getEl(this.ids.zoomResetBtn);
            const zoomSlider = this.getEl(this.ids.zoomSlider);

            if (inputToggleBtn) {
                inputToggleBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const inputDrawer = this.getEl(this.ids.inputDrawer);
                    const isOpen = inputDrawer ? inputDrawer.classList.contains('is-open') : false;
                    this.toggleLabelDrawer(false);
                    this.toggleInputDrawer(!isOpen);
                });
            }
            if (inputCancelBtn) {
                inputCancelBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.toggleInputDrawer(false);
                });
            }
            if (labelPanelBtn) {
                labelPanelBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const labelDrawer = this.getEl(this.ids.labelDrawer);
                    const isOpen = labelDrawer ? labelDrawer.classList.contains('is-open') : false;
                    this.toggleInputDrawer(false);
                    this.toggleLabelDrawer(!isOpen);
                });
            }
            if (labelCloseBtn) {
                labelCloseBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.toggleLabelDrawer(false);
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
            if (savedSelect) {
                const runRestore = () => {
                    if (savedSelect.disabled) return;
                    this.restoreNetworkJson();
                };
                savedSelect.addEventListener('change', runRestore);
                savedSelect.addEventListener('click', runRestore);
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
            if (importInput && !importInput.dataset.visBound) {
                importInput.dataset.visBound = '1';
                importInput.addEventListener('change', async (e) => {
                    const file = e.target.files && e.target.files[0];
                    if (!file) return;
                    try {
                        const text = await file.text();
                        const textarea = this.getEl(this.ids.inputTextarea);
                        if (textarea) {
                            textarea.value = text;
                        }
                        this.visInputText = text;
                    } catch (err) {
                        this.notify(`Failed to read JSON: ${err.message}`, 'error');
                    } finally {
                        e.target.value = '';
                    }
                });
            }
            if (zoomInBtn) {
                zoomInBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.adjustZoom(this.zoomStep);
                });
            }
            if (zoomOutBtn) {
                zoomOutBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.adjustZoom(-this.zoomStep);
                });
            }
            if (zoomFitBtn) {
                zoomFitBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (this.visNetwork) {
                        this.visNetwork.fit({ animation: { duration: 250 } });
                        this.syncZoomSlider();
                    }
                });
            }
            if (zoomResetBtn) {
                zoomResetBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (this.visNetwork) {
                        this.visNetwork.moveTo({ scale: 1, animation: { duration: 250 } });
                        this.syncZoomSlider();
                    }
                });
            }
            if (zoomSlider) {
                zoomSlider.addEventListener('input', () => {
                    const value = Number(zoomSlider.value) / 100;
                    if (this.visNetwork) {
                        this.visNetwork.moveTo({ scale: this.clampZoom(value) });
                    }
                });
            }
            if (labelFieldInput && labelSuggest && !labelFieldInput.dataset.visBound) {
                labelFieldInput.dataset.visBound = '1';
                const renderSuggestions = (value = '', showAll = false) => {
                    const query = (value || '').trim().toLowerCase();
                    this.labelSuggestIndex = -1;
                    if (!query && !showAll) {
                        labelSuggest.style.display = 'none';
                        labelSuggest.innerHTML = '';
                        return;
                    }
                    const options = (this.labelFieldOptions || [])
                        .filter((field) => showAll ? true : field.toLowerCase().includes(query))
                        .slice(0, 10);
                    if (!options.length) {
                        labelSuggest.style.display = 'none';
                        labelSuggest.innerHTML = '';
                        return;
                    }
                    labelSuggest.innerHTML = options.map((opt, idx) => (
                        `<button type="button" class="vis-label-suggest-item" data-idx="${idx}" data-value="${this.escapeAttr(opt)}">${this.escapeHtml(opt)}</button>`
                    )).join('');
                    labelSuggest.style.display = 'flex';
                };
                const applyFieldSelection = (value) => {
                    const next = (value || '').trim();
                    if (!next) return;
                    if (this.labelFieldOptions.length && !this.labelFieldOptions.includes(next)) {
                        this.notify(`Field not found: ${next}`, 'info');
                        return;
                    }
                    this.addLabelField(next);
                };
                labelFieldInput.addEventListener('input', () => {
                    renderSuggestions(labelFieldInput.value);
                });
                labelFieldInput.addEventListener('focus', () => {
                    renderSuggestions(labelFieldInput.value, true);
                });
                labelFieldInput.addEventListener('blur', () => {
                    setTimeout(() => {
                        const active = document.activeElement;
                        if (!labelSuggest.contains(active)) {
                            labelSuggest.style.display = 'none';
                            labelSuggest.innerHTML = '';
                        }
                    }, 120);
                });
                labelFieldInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if (this.labelSuggestIndex >= 0 && labelSuggest.children.length) {
                            const btn = labelSuggest.children[this.labelSuggestIndex];
                            if (btn?.dataset?.value) {
                                applyFieldSelection(btn.dataset.value);
                                return;
                            }
                        }
                        applyFieldSelection(labelFieldInput.value);
                        return;
                    }
                    if (e.key === 'Tab') {
                        if (labelSuggest.style.display === 'none') return;
                        const items = Array.from(labelSuggest.querySelectorAll('.vis-label-suggest-item'));
                        if (!items.length) return;
                        e.preventDefault();
                        const idx = this.labelSuggestIndex >= 0 ? this.labelSuggestIndex : 0;
                        const btn = items[idx];
                        if (btn?.dataset?.value && labelFieldInput) {
                            labelFieldInput.value = btn.dataset.value;
                            renderSuggestions(labelFieldInput.value);
                            labelFieldInput.focus();
                        }
                        return;
                    }
                    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                        if (labelSuggest.style.display !== 'none') {
                            e.preventDefault();
                            const items = Array.from(labelSuggest.querySelectorAll('.vis-label-suggest-item'));
                            if (!items.length) return;
                            const delta = e.key === 'ArrowDown' ? 1 : -1;
                            let next = this.labelSuggestIndex + delta;
                            if (next < 0) next = items.length - 1;
                            if (next >= items.length) next = 0;
                            this.labelSuggestIndex = next;
                            items.forEach((el, idx) => el.classList.toggle('active', idx === this.labelSuggestIndex));
                        }
                    }
                });
                labelSuggest.addEventListener('click', (e) => {
                    const btn = e.target.closest('.vis-label-suggest-item');
                    if (!btn) return;
                    if (labelFieldInput) {
                        labelFieldInput.value = btn.dataset.value || '';
                        renderSuggestions(labelFieldInput.value);
                        labelFieldInput.focus();
                    }
                });
            }
            if (labelFadeSlider && !labelFadeSlider.dataset.visBound) {
                labelFadeSlider.dataset.visBound = '1';
                labelFadeSlider.addEventListener('input', () => {
                    const value = Number(labelFadeSlider.value);
                    this.labelFade = Number.isFinite(value) ? value : 0;
                    this.applyLabelFade();
                });
            }
            if (labelMinSlider && !labelMinSlider.dataset.visBound) {
                labelMinSlider.dataset.visBound = '1';
                labelMinSlider.addEventListener('input', () => {
                    const value = Number(labelMinSlider.value);
                    this.labelMinCitations = Number.isFinite(value) ? value : 0;
                    if (labelMinValue) labelMinValue.textContent = String(this.labelMinCitations);
                    this.applyLabelThreshold();
                });
            }
            if (labelSizeSlider && !labelSizeSlider.dataset.visBound) {
                labelSizeSlider.dataset.visBound = '1';
                labelSizeSlider.addEventListener('input', () => {
                    const value = Number(labelSizeSlider.value);
                    const scale = Number.isFinite(value) ? value / 100 : 1;
                    this.labelSizeScale = Math.max(0.6, Math.min(2.2, scale));
                    this.applyLabelSizeScale();
                });
            }
            if (labelFields && !labelFields.dataset.visBound) {
                labelFields.dataset.visBound = '1';
                labelFields.addEventListener('click', (e) => {
                    const btn = e.target.closest('[data-field-remove]');
                    if (!btn) return;
                    const field = btn.dataset.fieldRemove;
                    if (!field) return;
                    this.removeLabelField(field);
                });
            }
            if (!this._escBound) {
                this._escBound = true;
                document.addEventListener('keydown', (e) => {
                    if (e.key !== 'Escape') return;
                    const drawer = this.getEl(this.ids.inputDrawer);
                    if (drawer && drawer.classList.contains('is-open')) {
                        e.preventDefault();
                        this.toggleInputDrawer(false);
                    }
                    const labelDrawer = this.getEl(this.ids.labelDrawer);
                    if (labelDrawer && labelDrawer.classList.contains('is-open')) {
                        e.preventDefault();
                        this.toggleLabelDrawer(false);
                    }
                });
            }
            // outside click to close disabled
        }

        mountDrawer() {
            const drawer = this.getEl(this.ids.inputDrawer);
            if (!drawer || drawer.dataset.mounted) return;
            drawer.dataset.mounted = '1';
            drawer.classList.add('vis-input-drawer-float');
            if (drawer.parentElement !== document.body) {
                document.body.appendChild(drawer);
            }
        }

        mountLabelDrawer() {
            const drawer = this.getEl(this.ids.labelDrawer);
            if (!drawer || drawer.dataset.mounted) return;
            drawer.dataset.mounted = '1';
            drawer.classList.add('vis-input-drawer-float');
            if (drawer.parentElement !== document.body) {
                document.body.appendChild(drawer);
            }
        }

        getEl(id) {
            return id ? document.getElementById(id) : null;
        }

        escapeHtml(text) {
            return String(text ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        escapeAttr(text) {
            return this.escapeHtml(text || '').replace(/`/g, '&#96;');
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
                this.notify('WOS Vis module not loaded', 'error');
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
            this.wosDataIndex = null;
            this.wosDataIndexSource = null;
            this._wosDataIndex = null;
            this._wosDataIndexView = null;
            if (this.visNetwork) {
                this.bindNetworkEvents(this.visNetwork);
                this.bindZoomEvents(this.visNetwork);
            }
            this.wrapLabelToggleButton();
            const minSlider = this.getEl(this.ids.labelMinSlider);
            const minValue = this.getEl(this.ids.labelMinValue);
            const maxCitation = Number.isFinite(this.visNetworkData?.meta?.maxCitation)
                ? this.visNetworkData.meta.maxCitation
                : 0;
            if (minSlider) {
                const nextMax = Math.max(0, Math.ceil(maxCitation));
                minSlider.max = String(nextMax);
                if (Number(minSlider.value) > nextMax) {
                    minSlider.value = String(nextMax);
                }
            }
            if (minValue) {
                minValue.textContent = String(this.labelMinCitations || 0);
            }
            this.refreshLabelFieldOptions();
            void this.applyLabelField(this.labelField);
            this.applyLabelFade();
            this.applyLabelSizeScale();
            this.applyLabelThreshold();
        }

        wrapLabelToggleButton() {
            const btn = this.getEl(this.ids.labelToggleBtn);
            if (!btn || btn.dataset.visWrapped) return;
            const original = btn.onclick;
            btn.onclick = (e) => {
                const input = this.getEl(this.ids.labelFieldInput);
                const currentField = input && input.value ? input.value.trim() : this.labelField;
                void this.applyLabelField(currentField);
                this.applyLabelFade();
                this.applyLabelSizeScale();
                this.applyLabelThreshold();
                if (typeof original === 'function') {
                    original.call(btn, e);
                }
            };
            btn.dataset.visWrapped = '1';
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

        toggleLabelDrawer(forceOpen) {
            const drawer = this.getEl(this.ids.labelDrawer);
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
                this.refreshLabelFieldOptions();
                const input = this.getEl(this.ids.labelFieldInput);
                if (input) {
                    input.value = '';
                    input.focus();
                    input.setSelectionRange(input.value.length, input.value.length);
                }
                this.renderLabelFieldChips();
                const slider = this.getEl(this.ids.labelFadeSlider);
                if (slider) slider.value = String(this.labelFade || 0);
                const minSlider = this.getEl(this.ids.labelMinSlider);
                const minValue = this.getEl(this.ids.labelMinValue);
                if (minSlider) minSlider.value = String(this.labelMinCitations || 0);
                if (minValue) minValue.textContent = String(this.labelMinCitations || 0);
                const sizeSlider = this.getEl(this.ids.labelSizeSlider);
                if (sizeSlider) sizeSlider.value = String(Math.round((this.labelSizeScale || 1) * 100));
            }
        }

        getNetworkNodesDataSet() {
            return this.visNetwork?.body?.data?.nodes || null;
        }

        refreshLabelFieldOptions() {
            const data = this.getCurrentViewData();
            if (this.app && typeof this.app.updateMdChatFieldOptionsFromCurrentData === 'function') {
                this.app.updateMdChatFieldOptionsFromCurrentData();
            }
            const baseOptions = this.collectLabelFieldOptions(data);
            const appOptions = Array.isArray(this.app?.mdChatFieldOptions) ? this.app.mdChatFieldOptions : [];
            const merged = new Set([...baseOptions, ...appOptions]);
            this.labelFieldOptions = Array.from(merged).sort();
        }

        collectLabelFieldOptions(data) {
            const options = new Set(['wosid']);
            if (!data || typeof data !== 'object') return Array.from(options);
            const addFields = (obj, includeWosData = true) => {
                if (!obj || typeof obj !== 'object') return;
                Object.keys(obj).forEach((key) => {
                    if (key === 'page_wosids') return;
                    options.add(key);
                });
                if (includeWosData && obj.wos_data && typeof obj.wos_data === 'object') {
                    Object.keys(obj.wos_data).forEach((key) => {
                        options.add(`wos_data.${key}`);
                    });
                }
            };
            Object.entries(data).forEach(([rootId, payload]) => {
                if (!rootId || !payload) return;
                addFields(payload);
                const list = payload.page_wosids;
                if (!Array.isArray(list)) return;
                list.forEach((item) => addFields(item));
            });
            return Array.from(options).sort();
        }

        buildWosRecordMap(data) {
            const map = new Map();
            if (!data || typeof data !== 'object') return map;
            Object.entries(data).forEach(([rootId, payload]) => {
                if (!rootId || !payload) return;
                if (payload.wos_data && payload.wos_data.wosid) {
                    map.set(payload.wos_data.wosid, payload.wos_data);
                }
                const list = payload?.page_wosids;
                if (!Array.isArray(list)) return;
                list.forEach((item) => {
                    if (!item) return;
                    if (item.wos_data && item.wos_data.wosid) {
                        map.set(item.wos_data.wosid, item.wos_data);
                    }
                });
            });
            return map;
        }

        getCurrentViewData() {
            if (this.app && this.app.currentData && typeof this.app.currentData === 'object') {
                return this.app.currentData;
            }
            return this.getWorkingJson();
        }

        ensureWosDataIndex(data) {
            if (this.wosDataIndex && this.wosDataIndexSource === data) {
                return this.wosDataIndex;
            }
            const map = new Map();
            if (data && typeof data === 'object') {
                Object.entries(data).forEach(([, payload]) => {
                    if (!payload) return;
                    if (payload.wos_data && payload.wos_data.wos_id) {
                        const key = this.normalizeWosId(payload.wos_data.wos_id);
                        if (key) map.set(key, payload.wos_data);
                    }
                    const list = payload.page_wosids;
                    if (!Array.isArray(list)) return;
                    list.forEach((item) => {
                        if (!item) return;
                        if (item.wos_data && item.wos_data.wos_id) {
                            const key = this.normalizeWosId(item.wos_data.wos_id);
                            if (key) map.set(key, item.wos_data);
                        }
                    });
                });
            }
            this.wosDataIndex = map;
            this.wosDataIndexSource = data;
            return map;
        }

        async buildWosDataIndexForCurrentView() {
            const app = this.app;
            if (!app) return new Map();
            const view = app.currentJsonView || 'view1';
            if (this._wosDataIndexView === view && this._wosDataIndex && this._wosDataIndex.size) {
                return this._wosDataIndex;
            }
            const index = new Map();
            const metaByBase = app.fileMetaByBase || {};
            const entries = Object.values(metaByBase);
            for (const entry of entries) {
                const path = entry?.views?.[view];
                if (!path) continue;
                try {
                    const data = await app.readProjectFile(path);
                    const wos = data?.wos_data || {};
                    const rawId = wos.wos_id || wos.wosid || data?.wos_id || data?.wosid;
                    const key = this.normalizeWosId(rawId);
                    if (key && wos && typeof wos === 'object') {
                        index.set(key, wos);
                    }
                } catch (_e) {
                    continue;
                }
            }
            this._wosDataIndexView = view;
            this._wosDataIndex = index;
            return index;
        }

        getWosDataRecord(wosId) {
            const data = this.getCurrentViewData();
            const index = this.ensureWosDataIndex(data);
            return index.get(wosId) || null;
        }

        resolveLabelValue(nodeData, field, nodeId) {
            if (!field || field === 'wosid') return nodeId || '';
            if (!nodeData || typeof nodeData !== 'object') return null;
            if (field.startsWith('wos_data.')) {
                const key = field.slice('wos_data.'.length);
                if (nodeData[key] != null) {
                    return nodeData[key];
                }
            }
            if (nodeData[field] != null) return nodeData[field];
            return null;
        }

        parseLabelFields(raw) {
            const text = (raw || '').trim();
            if (!text) return ['wosid'];
            return text
                .split(/[,\n;]/g)
                .map((part) => part.trim())
                .filter((part) => part);
        }

        resolveLabelValues(nodeData, fields, nodeId) {
            const values = [];
            fields.forEach((field) => {
                if (field === 'wosid') {
                    if (nodeId) values.push(nodeId);
                    return;
                }
                const value = this.resolveLabelValue(nodeData, field, nodeId);
                if (value != null && String(value).trim() !== '') {
                    values.push(String(value));
                }
            });
            return values;
        }

        addLabelField(field) {
            const next = (field || '').trim();
            if (!next) return;
            if (this.labelFieldOptions.length && !this.labelFieldOptions.includes(next)) {
                this.notify(`Field not found: ${next}`, 'info');
                return;
            }
            if (!this.labelFieldsSelected.includes(next)) {
                this.labelFieldsSelected.push(next);
            }
            this.labelField = this.labelFieldsSelected.join(', ');
            const input = this.getEl(this.ids.labelFieldInput);
            if (input) {
                input.value = '';
                input.focus();
            }
            this.renderLabelFieldChips();
        }

        removeLabelField(field) {
            this.labelFieldsSelected = this.labelFieldsSelected.filter((item) => item !== field);
            this.labelField = this.labelFieldsSelected.join(', ');
            this.renderLabelFieldChips();
        }

        renderLabelFieldChips() {
            const container = this.getEl(this.ids.labelFields);
            if (!container) return;
            container.innerHTML = '';
            this.labelFieldsSelected.forEach((field) => {
                const chip = document.createElement('div');
                chip.className = 'vis-label-chip';
                chip.innerHTML = `
                    <span>${this.escapeHtml(field)}</span>
                    <button type="button" data-field-remove="${this.escapeAttr(field)}" aria-label="Remove field">&times;</button>
                `;
                container.appendChild(chip);
            });
        }

        async applyLabelField(field) {
            const fields = this.labelFieldsSelected.length
                ? Array.from(this.labelFieldsSelected)
                : this.parseLabelFields(field);
            const nextField = fields.join(', ');
            this.labelField = nextField;
            const data = this.getCurrentViewData();
            let nodeMap = this.ensureWosDataIndex(data);
            if (!nodeMap.size) {
                console.warn('[WosVisManager] label index is empty. wos_data.wos_id not found in current view data. Falling back to file scan.');
                nodeMap = await this.buildWosDataIndexForCurrentView();
            }
            this.labelValueMap = new Map();
            const dataset = this.getNetworkNodesDataSet();
            if (!dataset) return;
            const nodes = dataset.get();
            const updates = nodes.map((node, idx) => {
                const nodeKey = this.normalizeWosId(node.id);
                const nodeData = nodeKey ? nodeMap.get(nodeKey) : null;
                const values = this.resolveLabelValues(nodeData, fields, node.id);
                const labelText = values.join(' | ');
                const hasValue = labelText.trim() !== '';
                this.labelValueMap.set(node.id, hasValue ? labelText : '');
                if (idx < 5) {
                    console.log('[WosVisManager] label debug', {
                        nodeId: node.id,
                        nodeKey,
                        hasRecord: !!nodeData,
                        field: nextField,
                        value: hasValue ? labelText : null
                    });
                }
                return {
                    id: node.id,
                    labelValue: hasValue ? labelText : '',
                    hiddenLabel: hasValue ? labelText : '',
                    labelHidden: !hasValue,
                    labelMissingField: !hasValue
                };
            });
            dataset.update(updates);
            this.applyLabelThreshold();
            this.updateLabelLayer();
        }

        applyLabelSizeScale() {
            const dataset = this.getNetworkNodesDataSet();
            if (!dataset) return;
            const scale = Number.isFinite(this.labelSizeScale) ? this.labelSizeScale : 1;
            const range = Math.max(0, scale - 1);
            const meta = this.visNetworkData?.meta || {};
            const minCitation = Number.isFinite(meta.minCitation) ? meta.minCitation : 0;
            const maxCitation = Number.isFinite(meta.maxCitation) ? meta.maxCitation : minCitation;
            const updates = dataset.get().map((node) => {
                const base = node.labelBaseSize
                    || node.labelStyle?.fontSize
                    || node.labelFontSize
                    || 12;
                const citations = Number.isFinite(node.citationsValue) ? node.citationsValue : null;
                let factor = 1;
                if (citations != null && maxCitation > minCitation) {
                    const t = (citations - minCitation) / (maxCitation - minCitation);
                    const delta = (t - 0.5) * 2 * range;
                    factor = Math.max(0.6, 1 + delta);
                }
                const next = Math.max(9, Math.min(30, base * factor));
                return {
                    id: node.id,
                    labelBaseSize: base,
                    labelStyle: { ...(node.labelStyle || {}), fontSize: Number(next.toFixed(2)) }
                };
            });
            dataset.update(updates);
            this.updateLabelLayer();
        }

        applyLabelFade() {
            const dataset = this.getNetworkNodesDataSet();
            if (!dataset) return;
            const meta = this.visNetworkData?.meta || {};
            const minCitation = Number.isFinite(meta.minCitation) ? meta.minCitation : 0;
            const maxCitation = Number.isFinite(meta.maxCitation) ? meta.maxCitation : minCitation;
            const fade = Math.max(0, Math.min(100, Number(this.labelFade) || 0)) / 100;
            const minAlpha = Math.max(0.1, 1 - fade * 0.9);
            const updates = dataset.get().map((node) => {
                const citations = Number.isFinite(node.citationsValue) ? node.citationsValue : 0;
                const t = maxCitation > minCitation ? (citations - minCitation) / (maxCitation - minCitation) : 1;
                const alpha = minAlpha + (1 - minAlpha) * Math.max(0, Math.min(1, t));
                return {
                    id: node.id,
                    labelStyle: { ...(node.labelStyle || {}), opacity: Number(alpha.toFixed(3)) }
                };
            });
            dataset.update(updates);
            this.updateLabelLayer();
        }

        applyLabelThreshold() {
            const dataset = this.getNetworkNodesDataSet();
            if (!dataset) return;
            const min = Number.isFinite(this.labelMinCitations) ? this.labelMinCitations : 0;
            const updates = dataset.get().map((node) => {
                if (node.labelMissingField) {
                    return { id: node.id, labelHidden: true };
                }
                if (!Number.isFinite(node.citationsValue)) {
                    const value = this.labelValueMap.get(node.id);
                    return value != null
                        ? { id: node.id, hiddenLabel: String(value), labelHidden: false }
                        : { id: node.id, labelHidden: false };
                }
                if (node.citationsValue < min) {
                    return { id: node.id, labelHidden: true };
                }
                const value = this.labelValueMap.get(node.id) ?? node.labelValue ?? node.hiddenLabel ?? '';
                return { id: node.id, hiddenLabel: value, labelHidden: false };
            });
            dataset.update(updates);
            this.updateLabelLayer();
        }

        updateLabelLayer() {
            const view = this.getEl(this.ids.view);
            const layer = view ? view.querySelector('.vis-network-label-layer') : null;
            const dataset = this.getNetworkNodesDataSet();
            if (!layer || !dataset) return;
            const labels = Array.from(layer.querySelectorAll('.vis-node-label'));
            labels.forEach((label) => {
                const nodeId = label.dataset.nodeId;
                if (!nodeId) return;
                const node = dataset.get(nodeId);
                label.textContent = node?.hiddenLabel || '';
                if (node) applyLabelStyle(label, node);
            });
        }

        applyInput() {
            const textarea = this.getEl(this.ids.inputTextarea);
            if (!textarea) return;
            this.visInputText = textarea.value || '';
            try {
                const parsed = JSON.parse(this.visInputText);
                this.visInputText = JSON.stringify(parsed, null, 2);
                textarea.value = this.visInputText;
            } catch (_e) { }
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

        bindNetworkEvents(network) {
            if (!network) return;
            if (this._boundNetwork === network) return;
            if (this._boundNetwork) {
                this._boundNetwork.off('click', this._onNetworkClick);
            }
            this._onNetworkClick = (params) => {
                const evt = params?.event?.event || params?.event?.srcEvent;
                const mod = evt ? (evt.metaKey || evt.ctrlKey) : false;
                if (mod) {
                    const nodeId = params?.nodes?.[0];
                    if (nodeId) {
                        const wosId = this.normalizeWosId(nodeId);
                        if (wosId) {
                            const url = `https://www.webofscience.com/wos/woscc/full-record/${encodeURIComponent(wosId)}`;
                            window.open(url, '_blank', 'noopener');
                        }
                    }
                    return;
                }
                const nodeId = params?.nodes?.[0];
                if (!nodeId) return;
                this.openFileByWosId(nodeId);
            };
            network.on('click', this._onNetworkClick);
            this._boundNetwork = network;
        }

        bindZoomEvents(network) {
            if (!network) return;
            if (this._boundZoomNetwork === network) return;
            if (this._boundZoomNetwork) {
                this._boundZoomNetwork.off('zoom', this._onNetworkZoom);
                this._boundZoomNetwork.off('dragEnd', this._onNetworkZoom);
            }
            this._onNetworkZoom = () => {
                this.syncZoomSlider();
            };
            network.on('zoom', this._onNetworkZoom);
            network.on('dragEnd', this._onNetworkZoom);
            this._boundZoomNetwork = network;
            this.syncZoomSlider();
        }

        syncZoomSlider() {
            const slider = this.getEl(this.ids.zoomSlider);
            if (!slider || !this.visNetwork) return;
            const scale = this.visNetwork.getScale();
            const percent = Math.round(scale * 100);
            slider.value = String(Math.max(10, Math.min(200, percent)));
        }

        clampZoom(value) {
            return Math.max(this.zoomMin, Math.min(this.zoomMax, value));
        }

        adjustZoom(delta) {
            if (!this.visNetwork) return;
            const current = this.visNetwork.getScale();
            const next = this.clampZoom(current + delta);
            this.visNetwork.moveTo({ scale: next });
            this.syncZoomSlider();
        }

        normalizeWosId(value) {
            if (!value) return '';
            const raw = String(value).trim().toUpperCase().replace(/\s+/g, '');
            if (!raw) return '';
            return raw.startsWith('WOS:') ? raw : `WOS:${raw.replace(/^WOS[:_]?/i, '')}`;
        }

        async buildWosIndexForCurrentView() {
            const app = this.app;
            if (!app) return new Map();
            const view = app.currentJsonView || 'view1';
            if (this._wosIndexView === view && this._wosIndex && this._wosIndex.size) {
                return this._wosIndex;
            }
            const index = new Map();
            const metaByBase = app.fileMetaByBase || {};
            const entries = Object.values(metaByBase);
            for (const entry of entries) {
                const path = entry?.views?.[view];
                if (!path) continue;
                try {
                    const data = await app.readProjectFile(path);
                    const wos = data?.wos_data || {};
                    const rawId = wos.wosid || wos.wos_id || data?.wosid || data?.wos_id;
                    const normalized = this.normalizeWosId(rawId);
                    if (normalized) {
                        index.set(normalized, entry.base);
                    }
                } catch (_e) {
                    continue;
                }
            }
            this._wosIndexView = view;
            this._wosIndex = index;
            return index;
        }

        async openFileByWosId(wosId) {
            const app = this.app;
            if (!app || typeof app.loadFile !== 'function') return;
            const normalized = this.normalizeWosId(wosId);
            if (!normalized) {
                this.notify('Invalid WOS id', 'error');
                return;
            }
            if (typeof app.ensureMdChatSlot0WhenEmpty === 'function') {
                app.ensureMdChatSlot0WhenEmpty();
            }
            const index = await this.buildWosIndexForCurrentView();
            const base = index.get(normalized);
            if (!base) {
                this.notify(`No file found for ${normalized}`, 'info');
                return;
            }
            app.loadFile(base);
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
