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
                shape: 'circle',
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
                    shape: 'circle',
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
        const minSize = 1;
        const maxSize = 80;
        nodes.forEach((node) => {
            const citations = Number.isFinite(node.citationsValue) ? node.citationsValue : 0;
            const size = Math.min(maxSize, minSize + citations * 0.8);
            node.size = size;
        });
        edges.forEach((edge) => {
            const base = 1;
            const width = Math.min(8, base + (edge.relatedValue || 0) * 0.08);
            edge.width = Number.isFinite(width) ? width : base;
        });
        return { nodes, edges };
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
        return { network, data: visData };
    }

    function debugNodeSize(raw, nodeId) {
        if (!nodeId) return null;
        const visData = buildVisNetworkDataFromWos(raw);
        const node = visData.nodes.find((n) => n.id === nodeId);
        if (!node) return null;
        return {
            id: node.id,
            citationsValue: node.citationsValue || 0,
            size: node.size
        };
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

    global.WosVisNetwork = {
        buildVisNetworkDataFromWos,
        renderVisNetworkFromJson,
        debugNodeSize
    };
})(window);
