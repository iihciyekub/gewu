(function (global) {
    'use strict';

    function isDarkTheme() {
        return document?.body?.classList?.contains('theme-dark');
    }

    function applyThemeToVisData(visData, darkMode) {
        if (!visData || !darkMode) return;
        const minRelated = Number.isFinite(visData.meta?.minRelated) ? visData.meta.minRelated : 0;
        const maxRelated = Number.isFinite(visData.meta?.maxRelated) ? visData.meta.maxRelated : minRelated;
        const normalize = (val, min, max) => {
            if (!Number.isFinite(val)) return 0;
            if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return 0;
            return (val - min) / (max - min);
        };
        visData.nodes.forEach((node) => {
            const border = 'rgba(255,255,255,0.65)';
            node.color = {
                background: '#f8fafc',
                border,
                highlight: { background: '#ffffff', border: 'rgba(255,255,255,0.9)' },
                hover: { background: '#ffffff', border: 'rgba(255,255,255,0.8)' }
            };
            if (node.font) {
                node.font.color = '#e2e8f0';
            }
            if (node.labelStyle) {
                node.labelStyle = {
                    ...node.labelStyle,
                    textColor: 'rgb(226, 232, 240)',
                    borderColor: 'rgba(255,255,255,0.18)'
                };
            }
        });
        visData.edges.forEach((edge) => {
            const related = getRelatedCount(edge);
            const t = normalize(related, minRelated, maxRelated);
            const alpha = 0.2 + t * 0.7;
            edge.color = {
                color: `rgba(255,255,255,${alpha.toFixed(3)})`,
                highlight: `rgba(255,255,255,${Math.min(1, alpha + 0.1).toFixed(3)})`,
                hover: `rgba(255,255,255,${Math.min(1, alpha + 0.15).toFixed(3)})`
            };
        });
    }

    function parseNumber(value) {
        if (value == null) return 0;
        const rawText = String(value);
        const digits = rawText.replace(/\D+/g, '');
        if (!digits) return 0;
        return Number.parseInt(digits, 10);
    }

    function getRelatedCount(entry) {
        if (!entry || typeof entry !== 'object') return 0;
        if (Number.isFinite(entry.related_count)) return entry.related_count;
        if (Number.isFinite(entry.relatedValue)) return entry.relatedValue;
        return parseNumber(entry.related_count ?? entry.relatedValue);
    }

    function buildVisNetworkDataFromWos(raw) {
        const nodes = [];
        const edges = [];
        const nodeMap = new Map();
        if (!raw || typeof raw !== 'object') return { nodes, edges };
        const normalizeId = (value) => {
            if (value == null) return '';
            return String(value).trim();
        };
        const addNode = (id, label, extra = {}) => {
            const normalizedId = normalizeId(id);
            if (!normalizedId) return '';
            const hiddenLabel = label != null ? String(label) : normalizedId;
            const labelFontSize = extra?.font?.size || 12;
            const node = {
                id: normalizedId,
                label: '',
                hiddenLabel,
                labelFontSize,
                ...extra
            };
            if (nodeMap.has(normalizedId)) {
                nodeMap.delete(normalizedId);
            }
            nodeMap.set(normalizedId, node);
            return normalizedId;
        };
        const ensureField = (value) => {
            if (value == null) return 'undef';
            const text = String(value).trim();
            return text ? text : 'undef';
        };
        const buildNodeCounts = (citationsRaw, refRaw) => ({
            citations_count: parseNumber(citationsRaw),
            ref_count: parseNumber(refRaw)
        });
        Object.entries(raw).forEach(([rootId, payload]) => {
            const rootKey = normalizeId(rootId);
            if (!rootKey) return;
            const rootCitationsRaw = payload?.citations_count;
            const rootRefRaw = payload?.ref_count;
            const rootNodeId = addNode(rootKey, rootKey, {
                shape: 'dot',
                size: 16,
                font: { size: 14, color: '#111', align: 'bottom', vadjust: 12 },
                ...buildNodeCounts(rootCitationsRaw, rootRefRaw)
            });
            const children = payload && payload.page_wosids;
            if (!Array.isArray(children)) return;
            children.forEach((item) => {
                const childId = item && item.wosid;
                const childKey = normalizeId(childId);
                if (!childKey) return;
                if (childKey === rootKey) return;
                const citationsRaw = item?.citations_count;
                const relatedRaw = item?.related_count;
                const refRaw = item?.ref_count;
                const label = childKey;
                const childNodeId = addNode(childKey, label, {
                    shape: 'dot',
                    size: 12,
                    font: { size: 11, color: '#111', align: 'bottom', vadjust: 12 },
                    ...buildNodeCounts(citationsRaw, refRaw)
                });
                edges.push({
                    from: rootNodeId || rootKey,
                    to: childNodeId || childKey,
                    related_count: parseNumber(relatedRaw)
                });
            });
        });
        nodes.length = 0;
        nodes.push(...nodeMap.values());
        const minSize = 6;
        const maxSize = 60;
        let minCitation = Infinity;
        let maxCitation = -Infinity;
        nodes.forEach((node) => {
            const citations = parseNumber(node.citations_count);
            minCitation = Math.min(minCitation, citations);
            maxCitation = Math.max(maxCitation, citations);
        });
        let minNodeSize = Infinity;
        let maxNodeSize = -Infinity;
        nodes.forEach((node) => {
            const citations = parseNumber(node.citations_count);
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
            const related = getRelatedCount(edge);
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
            const related = getRelatedCount(edge);
            const currentFrom = nodeRelatedMax.get(edge.from) || 0;
            const currentTo = nodeRelatedMax.get(edge.to) || 0;
            nodeRelatedMax.set(edge.from, Math.max(currentFrom, related));
            nodeRelatedMax.set(edge.to, Math.max(currentTo, related));
        });
        edges.forEach((edge) => {
            const related = getRelatedCount(edge);
            const t = normalize(related, minRelated, maxRelated);
            const alpha = 0.15 + t * 0.7;
            edge.color = {
                color: `rgba(0,0,0,${alpha.toFixed(3)})`,
                highlight: `rgba(0,0,0,${Math.min(1, alpha + 0.1).toFixed(3)})`,
                hover: `rgba(0,0,0,${Math.min(1, alpha + 0.15).toFixed(3)})`
            };
        });
        nodes.forEach((node) => {
            const related = getRelatedCount(node);
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
                borderColor: `rgba(0,0,0,${Math.min(1, alpha + 0.15).toFixed(3)})`
            };
        });
        const meta = {
            minCitation: Number.isFinite(minCitation) ? minCitation : 0,
            maxCitation: Number.isFinite(maxCitation) ? maxCitation : 0,
            minNodeSize: Number.isFinite(minNodeSize) ? minNodeSize : minSize,
            maxNodeSize: Number.isFinite(maxNodeSize) ? maxNodeSize : minSize,
            minRelated: Number.isFinite(minRelated) ? minRelated : 0,
            maxRelated: Number.isFinite(maxRelated) ? maxRelated : 0
        };
        return { nodes, edges, meta };
    }

    function renderVisNetworkFromVisData(raw, options = {}) {
        const container = options.container || document.getElementById('visNetworkCanvas');
        const view = options.view || document.getElementById('visNetworkView');
        if (!container || !view) return { network: null, data: null };
        if (!global.vis || !global.vis.Network) {
            if (options.onError) options.onError('vis-network 未加载');
            return { network: null, data: null };
        }
        let visData = raw;
        if (typeof raw === 'string') {
            try {
                visData = JSON.parse(raw);
            } catch (err) {
                if (options.onError) options.onError(`JSON 解析失败: ${err.message}`);
                return { network: null, data: null };
            }
        }
        if (!visData || !Array.isArray(visData.nodes) || !Array.isArray(visData.edges)) {
            if (options.onError) options.onError('Invalid vis data');
            return { network: null, data: null };
        }
        applyThemeToVisData(visData, isDarkTheme());
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
        const darkMode = isDarkTheme();
        const visOptions = options.visOptions || {
            layout: { hierarchical: false },
            interaction: { hover: true, dragNodes: true, dragView: true, zoomSpeed: 0.4 },
            physics: {
                enabled: true,
                stabilization: { iterations: 200 }
            },
            nodes: {
                scaling: { min: 1, max: 1 },
                color: {
                    background: darkMode ? '#f8fafc' : '#ffffff',
                    border: darkMode ? 'rgba(255,255,255,0.7)' : '#111111',
                    highlight: { background: '#ffffff', border: darkMode ? 'rgba(255,255,255,0.9)' : '#111111' },
                    hover: { background: '#ffffff', border: darkMode ? 'rgba(255,255,255,0.8)' : '#111111' }
                },
                borderWidth: 1.5,
                borderWidthSelected: 2.5,
                shadow: {
                    enabled: true,
                    color: darkMode ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.18)',
                    size: 10,
                    x: 2,
                    y: 3
                },
                shapeProperties: {
                    borderDashes: false
                }
            },
            edges: {
                color: { color: darkMode ? '#e2e8f0' : '#111111', highlight: darkMode ? '#f8fafc' : '#111111', hover: darkMode ? '#f1f5f9' : '#111111' },
                width: 1.4,
                smooth: { type: 'dynamic', roundness: 0.25 },
                shadow: {
                    enabled: true,
                    color: darkMode ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.2)',
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

    function renderVisNetworkFromJson(raw, options = {}) {
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
        return renderVisNetworkFromVisData(visData, options);
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
                citations_count: parseNumber(node.citations_count),
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
        const icon = buttonEl.querySelector('i');
        const updateButtonText = (showAll) => {
            const label = showAll ? 'Hide labels' : 'Show labels';
            if (icon) {
                icon.className = showAll ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
            }
            buttonEl.setAttribute('aria-label', label);
            buttonEl.setAttribute('title', label);
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
        labelEl.style.transform = `translate(${domPos.x}px, ${domPos.y}px)`;
    }

    function renderAllLabels(network, dataset, layer) {
        if (!layer) return;
        clearAllLabels(layer, true);
        const nodes = dataset.nodes.get();
        const customActive = !!network?._wosCustomFocusActive;
        const customNodes = network?._wosCustomFocusNodes instanceof Set
            ? network._wosCustomFocusNodes
            : null;
        nodes.forEach((node) => {
            if (customActive && customNodes && !customNodes.has(node.id)) {
                return;
            }
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

    function buildLabelStrokeShadow(width, color) {
        const w = Number(width);
        if (!Number.isFinite(w) || w <= 0) return '';
        const c = color || '#ffffff';
        const steps = Math.max(8, Math.round(w * 8));
        const shadows = [];
        for (let i = 0; i < steps; i += 1) {
            const angle = (i / steps) * Math.PI * 2;
            const x = Math.cos(angle) * w;
            const y = Math.sin(angle) * w;
            shadows.push(`${x.toFixed(2)}px ${y.toFixed(2)}px 0 ${c}`);
        }
        return shadows.join(', ');
    }

    function applyLabelStyle(label, node) {
        if (!label || !node) return;
        const style = node.labelStyle || {};
        if (style.fontSize) label.style.fontSize = `${style.fontSize}px`;
        if (style.fontWeight) label.style.fontWeight = String(style.fontWeight);
        if (style.textColor) label.style.color = style.textColor;
        if (style.borderColor) label.style.borderColor = style.borderColor;
        const strokeWidth = Number(style.strokeWidth);
        if (Number.isFinite(strokeWidth) && strokeWidth > 0 && style.strokeColor) {
            label.style.textShadow = buildLabelStrokeShadow(strokeWidth, style.strokeColor);
        } else {
            label.style.textShadow = '';
        }
        label.style.webkitTextStroke = '';
        if (style.backgroundColor) {
            label.style.backgroundColor = style.backgroundColor;
        } else {
            // Keep background color controlled by CSS theme variables.
            label.style.backgroundColor = '';
        }
        let opacity = typeof style.opacity === 'number' ? style.opacity : 1;
        if (getNodeAlpha(node) <= 0) opacity = 0;
        if (node.labelHidden) opacity = 0;
        label.style.opacity = String(opacity);
    }

    function parseColorToRgba(input) {
        const text = String(input || '').trim();
        if (!text) return null;
        if (text.startsWith('#')) {
            const raw = text.slice(1);
            const expand = (c) => parseInt(c + c, 16);
            if (raw.length === 3) {
                const r = expand(raw[0]);
                const g = expand(raw[1]);
                const b = expand(raw[2]);
                return { r, g, b, a: 1 };
            }
            if (raw.length === 4) {
                const r = expand(raw[0]);
                const g = expand(raw[1]);
                const b = expand(raw[2]);
                const a = expand(raw[3]) / 255;
                return { r, g, b, a };
            }
            if (raw.length === 6 || raw.length === 8) {
                const r = parseInt(raw.slice(0, 2), 16);
                const g = parseInt(raw.slice(2, 4), 16);
                const b = parseInt(raw.slice(4, 6), 16);
                const a = raw.length === 8 ? parseInt(raw.slice(6, 8), 16) / 255 : 1;
                if ([r, g, b].some((v) => Number.isNaN(v))) return null;
                return { r, g, b, a };
            }
        }
        const rgba = text.match(/^rgba?\(([^)]+)\)$/i);
        if (rgba) {
            const parts = rgba[1].split(/[, ]+/).filter((p) => p.length);
            if (parts.length >= 3) {
                const r = parseFloat(parts[0]);
                const g = parseFloat(parts[1]);
                const b = parseFloat(parts[2]);
                const a = parts[3] != null ? parseFloat(parts[3]) : 1;
                if ([r, g, b].some((v) => Number.isNaN(v))) return null;
                const alpha = Number.isFinite(a) ? Math.max(0, Math.min(1, a)) : 1;
                return { r, g, b, a: alpha };
            }
        }
        return null;
    }

    function rgbaToString(color) {
        if (!color) return null;
        const r = Math.round(color.r);
        const g = Math.round(color.g);
        const b = Math.round(color.b);
        const a = Number.isFinite(color.a) ? Math.max(0, Math.min(1, color.a)) : 1;
        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }

    function normalizeVisColor(input) {
        const rgba = parseColorToRgba(input);
        return rgba ? rgbaToString(rgba) : input;
    }

    function adjustColorAlpha(input, delta) {
        const rgba = parseColorToRgba(input);
        if (!rgba) return input;
        const next = Math.max(0, Math.min(1, rgba.a + delta));
        return rgbaToString({ ...rgba, a: next });
    }

    function applyAlphaToColor(input, alpha) {
        const rgba = parseColorToRgba(input);
        if (!rgba) return input;
        const base = Math.max(0, Math.min(1, rgba.a));
        const next = Math.max(0, Math.min(1, base * alpha));
        return rgbaToString({ ...rgba, a: next });
    }

    function getNodeAlpha(node) {
        if (!node || !node.color) return 1;
        const pickAlpha = (value) => {
            const rgba = parseColorToRgba(value);
            return rgba ? rgba.a : null;
        };
        if (typeof node.color === 'string') {
            const alpha = pickAlpha(node.color);
            return alpha == null ? 1 : alpha;
        }
        if (node.color.background != null) {
            const alpha = pickAlpha(node.color.background);
            if (alpha != null) return alpha;
        }
        if (node.color.border != null) {
            const alpha = pickAlpha(node.color.border);
            if (alpha != null) return alpha;
        }
        return 1;
    }

    function setColorAlpha(input, alpha) {
        const rgba = parseColorToRgba(input);
        if (!rgba) return input;
        const next = Math.max(0, Math.min(1, alpha));
        return rgbaToString({ ...rgba, a: next });
    }

    function cloneVisColor(input) {
        if (!input || typeof input !== 'object') return input;
        return JSON.parse(JSON.stringify(input));
    }

    function coerceNumericFields(value) {
        if (Array.isArray(value)) {
            return value.map((item) => coerceNumericFields(item));
        }
        if (value && typeof value === 'object') {
            Object.keys(value).forEach((key) => {
                value[key] = coerceNumericFields(value[key]);
            });
            return value;
        }
        if (typeof value !== 'string') return value;
        const trimmed = value.trim();
        if (!trimmed) return value;
        const numericPattern = /^[+-]?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i;
        if (!numericPattern.test(trimmed)) return value;
        const next = Number(trimmed);
        return Number.isFinite(next) ? next : value;
    }

    function fadeEdgeColor(baseColor, alpha) {
        if (!baseColor) return baseColor;
        if (typeof baseColor === 'string') return setColorAlpha(baseColor, alpha);
        return {
            ...baseColor,
            color: setColorAlpha(baseColor.color, alpha),
            highlight: setColorAlpha(baseColor.highlight, alpha),
            hover: setColorAlpha(baseColor.hover, alpha)
        };
    }

    function fadeNodeColor(baseColor, alpha) {
        if (!baseColor) return baseColor;
        if (typeof baseColor === 'string') return setColorAlpha(baseColor, alpha);
        const highlight = baseColor.highlight || {};
        const hover = baseColor.hover || {};
        return {
            ...baseColor,
            background: setColorAlpha(baseColor.background, alpha),
            border: setColorAlpha(baseColor.border, alpha),
            highlight: {
                ...highlight,
                background: setColorAlpha(highlight.background || baseColor.background, alpha),
                border: setColorAlpha(highlight.border || baseColor.border, alpha)
            },
            hover: {
                ...hover,
                background: setColorAlpha(hover.background || baseColor.background, alpha),
                border: setColorAlpha(hover.border || baseColor.border, alpha)
            }
        };
    }

    function applyEdgeHoverLabelStyle(label, node) {
        if (!label || !node) return;
        const style = node.labelStyle || {};
        if (style.fontSize) label.style.fontSize = `${style.fontSize}px`;
        if (style.fontWeight) label.style.fontWeight = String(style.fontWeight);
        if (style.textColor) label.style.color = style.textColor;
        if (style.borderColor) label.style.borderColor = style.borderColor;
        if (style.backgroundColor) {
            label.style.backgroundColor = style.backgroundColor;
        } else {
            label.style.backgroundColor = '';
        }
        let opacity = typeof style.opacity === 'number' ? style.opacity : 1;
        if (getNodeAlpha(node) <= 0) opacity = 0;
        label.style.opacity = String(opacity);
    }

    function getEdgeColorAlpha(edge) {
        if (!edge) return 1;
        const color = edge.color;
        const value = typeof color === 'string'
            ? color
            : (color && typeof color === 'object' ? color.color : null);
        if (!value || typeof value !== 'string') return 1;
        const rgbaMatch = value.match(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([0-9.]+)\s*\)/i);
        if (rgbaMatch) return Math.max(0, Math.min(1, Number(rgbaMatch[1]) || 0));
        const hslaMatch = value.match(/hsla\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*[\d.]+%\s*,\s*([0-9.]+)\s*\)/i);
        if (hslaMatch) return Math.max(0, Math.min(1, Number(hslaMatch[1]) || 0));
        return 1;
    }

    class WosVisManager {
        constructor(options = {}) {
            this.app = options.app || null;
            this.ids = {
                view: options.viewId || 'visNetworkView',
                canvas: options.canvasId || 'visNetworkCanvas',
                settingsPanel: options.settingsPanelId || 'visSettingsPanel',
                settingsCloseBtn: options.settingsCloseBtnId || 'visSettingsCloseBtn',
                inputPanel: options.inputPanelId || 'visSettingsInputPanel',
                inputTextarea: options.inputTextareaId || 'visInputTextarea',
                inputToggleBtn: options.inputToggleBtnId || 'visInputToggleBtn',
                inputCancelBtn: options.inputCancelBtnId || 'visInputCancelBtn',
                inputApplyBtn: options.inputApplyBtnId || 'visInputApplyBtn',
                inputAppendBtn: options.inputAppendBtnId || 'visInputAppendBtn',
                updateNodeBtn: options.updateNodeBtnId || 'visUpdateNodeBtn',
                inputDepthFocusBtn: options.inputDepthFocusBtnId || 'visInputDepthFocusBtn',
                saveBtn: options.saveBtnId || 'visSaveNetworkBtn',
                restoreBtn: options.restoreBtnId || 'visRestoreNetworkBtn',
                deleteBtn: options.deleteBtnId || 'visDeleteNetworkBtn',
                viewBtn: options.viewBtnId || 'visViewNetworkBtn',
                savedSelect: options.savedSelectId || 'visSavedSelect',
                labelPanelBtn: options.labelPanelBtnId || 'visToggleLabelsBtn',
                labelPanel: options.labelPanelId || 'visSettingsLabelPanel',
                labelToggleBtn: options.labelToggleBtnId || 'visLabelToggleAllBtn',
                edgeLabelToggleBtn: options.edgeLabelToggleBtnId || 'visEdgeLabelToggleBtn',
                labelAutoBtn: options.labelAutoBtnId || 'visLabelAutoBtn',
                labelCloseBtn: options.labelCloseBtnId || 'visLabelCloseBtn',
                labelFieldInput: options.labelFieldInputId || 'visLabelFieldInput',
                labelSuggest: options.labelSuggestId || 'visLabelSuggest',
                labelFields: options.labelFieldsId || 'visLabelFields',
                labelSlots: options.labelSlotsId || 'visLabelSlots',
                labelFadeSlider: options.labelFadeSliderId || 'visLabelFadeSlider',
                labelColorInput: options.labelColorInputId || 'visLabelColorInput',
                labelBgColorInput: options.labelBgColorInputId || 'visLabelBgColorInput',
                labelBorderColorInput: options.labelBorderColorInputId || 'visLabelBorderColorInput',
                labelStrokeWidthInput: options.labelStrokeWidthInputId || 'visLabelStrokeWidthInput',
                labelStrokeColorInput: options.labelStrokeColorInputId || 'visLabelStrokeColorInput',
                labelSizeSlider: options.labelSizeSliderId || 'visLabelSizeSlider',
                labelMinSlider: options.labelMinSliderId || 'visLabelMinSlider',
                labelMinDimSlider: options.labelMinDimSliderId || 'visLabelMinDimSlider',
                relatedMinSlider: options.relatedMinSliderId || 'visRelatedMinSlider',
                relatedMinDimSlider: options.relatedMinDimSliderId || 'visRelatedMinDimSlider',
                nodeSizeMinSlider: options.nodeSizeMinSliderId || 'visNodeSizeMinSlider',
                nodeSizeMaxSlider: options.nodeSizeMaxSliderId || 'visNodeSizeMaxSlider',
                nodeSizeGammaSlider: options.nodeSizeGammaSliderId || 'visNodeSizeGammaSlider',
                nodeColorInput: options.nodeColorInputId || 'visNodeColorInput',
                nodeBorderSlider: options.nodeBorderSliderId || 'visNodeBorderSlider',
                nodeBorderColorInput: options.nodeBorderColorInputId || 'visNodeBorderColorInput',
                nodeOuterBorderWidthInput: options.nodeOuterBorderWidthInputId || 'visNodeOuterBorderWidth',
                nodeOuterBorderColorInput: options.nodeOuterBorderColorInputId || 'visNodeOuterBorderColor',
                edgeColorInput: options.edgeColorInputId || 'visEdgeColorInput',
                edgeLabelFontSizeInput: options.edgeLabelFontSizeInputId || 'visEdgeLabelFontSizeInput',
                edgeLabelColorInput: options.edgeLabelColorInputId || 'visEdgeLabelColorInput',
                edgeLabelStrokeWidthInput: options.edgeLabelStrokeWidthInputId || 'visEdgeLabelStrokeWidthInput',
                edgeLabelStrokeColorInput: options.edgeLabelStrokeColorInputId || 'visEdgeLabelStrokeColorInput',
                edgeLabelBgColorInput: options.edgeLabelBgColorInputId || 'visEdgeLabelBgColorInput',
                labelWeightSlider: options.labelWeightSliderId || 'visLabelWeightSlider',
                labelFontMinInput: options.labelFontMinInputId || 'visLabelFontMinInput',
                labelFontMaxInput: options.labelFontMaxInputId || 'visLabelFontMaxInput',
                physicsSpringSlider: options.physicsSpringSliderId || 'visPhysicsSpringSlider',
                physicsStrengthSlider: options.physicsStrengthSliderId || 'visPhysicsStrengthSlider',
                physicsGravitySlider: options.physicsGravitySliderId || 'visPhysicsGravitySlider',
                edgeFadeSlider: options.edgeFadeSliderId || 'visEdgeFadeSlider',
                edgeMinWidthSlider: options.edgeMinWidthSliderId || 'visEdgeMinWidthSlider',
                edgeMaxWidthSlider: options.edgeMaxWidthSliderId || 'visEdgeMaxWidthSlider',
                exportSvgScaleInput: options.exportSvgScaleInputId || 'visSvgScaleInput',
                exportSvgMarginInput: options.exportSvgMarginInputId || 'visSvgMarginInput',
                exportSvgIncludeLabelsInput: options.exportSvgIncludeLabelsInputId || 'visSvgIncludeLabels',
                importBtn: options.importBtnId || 'visImportJsonBtn',
                importJsonFileInput: options.importJsonFileInputId || 'importJsonFileInput',
                zoomInBtn: options.zoomInBtnId || 'visZoomInBtn',
                zoomOutBtn: options.zoomOutBtnId || 'visZoomOutBtn',
                zoomFitBtn: options.zoomFitBtnId || 'visZoomFitBtn',
                zoomSlider: options.zoomSliderId || 'visZoomSlider',
                zoomCollapseBtn: options.zoomCollapseBtnId || 'visZoomCollapseBtn',
                zoomLockBtn: options.zoomLockBtnId || 'visZoomLockBtn',
                zoomPanBtn: options.zoomPanBtnId || 'visZoomPanBtn',
                gridToggleBtn: options.gridToggleBtnId || 'visGridToggleBtn',
                exportSvgBtn: options.exportSvgBtnId || 'visExportSvgBtn',
                exportPdfBtn: options.exportPdfBtnId || 'visExportPdfBtn'
            };
            this.visNetwork = null;
            this.visNetworkData = null;
            this.visInputText = '';
            this.lastRenderedJson = '';
            this.graphModel = global.WosGraphModel ? new global.WosGraphModel({ source: null }) : null;
            this.visNetworkSavedKey = options.visNetworkSavedKey || 'vis-network-saved';
            this.zoomMin = 0.1;
            this.zoomMax = 2.0;
            this.zoomStep = 0.06;
            this.zoomAnimDuration = 520;
            this.zoomAnimEasing = 'easeInOutCubic';
            this.exportScale = 2;
            this.zoomCollapsed = false;
            this.zoomWrap = null;
            this.labelField = 'wosid';
            this.labelFade = 0;
            this.labelColor = '#000000';
            this.labelBgColor = '#f2f2f2f1';
            this.labelBorderColor = '#00000021';
            this.labelStrokeWidth = 0;
            this.labelStrokeColor = '#ffffff';
            this.labelSizeScale = 1;
            this.labelMinCitations = 0;
            this.labelFieldOptions = [];
            this.labelSuggestIndex = -1;
            this.labelValueMap = new Map();
            this.wosDataIndex = null;
            this.wosDataIndexSource = null;
            this.labelFieldsSelected = [];
            this.labelWeight = 500;
            this.labelFontMin = 9;
            this.labelFontMax = 30;
            this.labelMinDimAlpha = 0.2;
            this.relatedMinValue = 0;
            this.relatedMinDimAlpha = 0.2;
            this._labelThresholdBaseDirty = true;
            this._labelThresholdDimState = null;
            this.nodeSizeMin = 6;
            this.nodeSizeMax = 60;
            this.nodeSizeGamma = 1;
            this.nodeColor = '#ffffff';
            this.nodeBorderWidth = 1.5;
            this.nodeBorderColor = '#111111';
            this.nodeOuterBorderWidth = 2;
            this.nodeOuterBorderColor = '#ffffff';
            this.physicsSpringLength = 120;
            this.physicsSpringConstant = 0.05;
            this.physicsGravity = -9000;
            this.edgeFade = 100;
            this.edgeMinWidth = 1;
            this.edgeMaxWidth = 6;
            this.edgeColor = '#111111';
            this.edgeLabelFontSize = 12;
            this.edgeLabelFontColor = '#111111';
            this.edgeLabelStrokeWidth = 0;
            this.edgeLabelStrokeColor = '#ffffff';
            this.edgeLabelBgColor = 'rgba(255,255,255,0.85)';
            this.edgeStyle = 'curve-dynamic';
            this.exportSvgScale = 1;
            this.exportSvgMargin = 6;
            this.exportSvgIncludeLabels = true;
            this.useNativeNodeBorder = false;
            this.edgeFocusFadeAlpha = 0;
            this.edgeHoverLabelEnabled = false;
            this.edgeLabelEnabled = false;
            this.wosNodeIndex = null;
            this.wosNodeIndexSource = null;
            this.labelFieldHistory = [];
            this.labelFieldHistoryIndex = -1;
            this.settingsKey = 'vis-network-settings';
            this.settingsSlotsKey = 'vis-network-settings-slots';
            this.settingsSlots = Array.from({ length: 10 }, () => null);
            this._settingsSaveTimer = null;
            this._settingsLoaded = false;
            this.networkStateKey = 'vis-network-last';
            this.savedSelectKey = options.savedSelectKey || 'vis-network-saved-select';
            this._savedSelectLoaded = false;
            this._savedSelectValue = null;
            this._networkSaveTimer = null;
            this.isLocked = false;
            this.isPanOnly = false;
            this._labelRetryTimer = null;
            this._labelRetryCount = 0;
            this.depthMode = true;
            this._modReleaseAt = 0;
            this._hotkeysBound = false;
            this.pendingSavedIndex = null;
            this.inputDraftKey = 'vis-network-input-draft';
            this.inputHistoryKey = 'vis-network-input-history';
            this.inputHistory = [];
            this.inputHistoryIndex = -1;
            this.inputHistoryMax = 20;
            this._inputDraftLoaded = false;
            this._inputHistoryLoaded = false;
            this._inputDraftSaveTimer = null;
            this._inputDraftText = '';
            this._edgeFocusState = null;
            this._edgeHoverLabelState = null;
            this._edgeContextMenu = null;
            this._edgeBaseLabels = null;
            this._edgeBaseFonts = null;
            this.settingsAutoSave = false;
            this._visViewReady = false;
        }

        bind() {
            this.mountDrawer();
            this.mountLabelDrawer();
            this.disableVisSettingsTabFocus();
            this.loadSettingsSlots();
            this.loadPersistedSettings();
            this.loadInputDraft();
            this.loadInputHistory();
            this.loadNetworkState();
            const inputToggleBtn = this.getEl(this.ids.inputToggleBtn);
            const inputCancelBtn = this.getEl(this.ids.inputCancelBtn);
            const inputApplyBtn = this.getEl(this.ids.inputApplyBtn);
            const inputAppendBtn = this.getEl(this.ids.inputAppendBtn);
            const inputTextarea = this.getEl(this.ids.inputTextarea);
            const updateNodeBtn = this.getEl(this.ids.updateNodeBtn);
            const inputDepthFocusBtn = this.getEl(this.ids.inputDepthFocusBtn);
            const saveBtn = this.getEl(this.ids.saveBtn);
            const restoreBtn = this.getEl(this.ids.restoreBtn);
            const deleteBtn = this.getEl(this.ids.deleteBtn);
            const viewBtn = this.getEl(this.ids.viewBtn);
            const savedSelect = this.getEl(this.ids.savedSelect);
            const importBtn = this.getEl(this.ids.importBtn);
            const importInput = this.getEl(this.ids.importJsonFileInput);
            const labelPanelBtn = this.getEl(this.ids.labelPanelBtn);
            const labelCloseBtn = this.getEl(this.ids.labelCloseBtn);
            const labelAutoBtn = this.getEl(this.ids.labelAutoBtn);
            const edgeLabelToggleBtn = this.getEl(this.ids.edgeLabelToggleBtn);
            const settingsCloseBtn = this.getEl(this.ids.settingsCloseBtn);
            const labelFieldInput = this.getEl(this.ids.labelFieldInput);
            const labelSuggest = this.getEl(this.ids.labelSuggest);
            const labelFields = this.getEl(this.ids.labelFields);
            const labelSlots = this.getEl(this.ids.labelSlots);
            const labelFadeSlider = this.getEl(this.ids.labelFadeSlider);
            const labelColorInput = this.getEl(this.ids.labelColorInput);
            const labelBgColorInput = this.getEl(this.ids.labelBgColorInput);
            const labelBorderColorInput = this.getEl(this.ids.labelBorderColorInput);
            const labelStrokeWidthInput = this.getEl(this.ids.labelStrokeWidthInput);
            const labelStrokeColorInput = this.getEl(this.ids.labelStrokeColorInput);
            const labelSizeSlider = this.getEl(this.ids.labelSizeSlider);
            const labelMinSlider = this.getEl(this.ids.labelMinSlider);
            const labelMinDimSlider = this.getEl(this.ids.labelMinDimSlider);
            const relatedMinSlider = this.getEl(this.ids.relatedMinSlider);
            const relatedMinDimSlider = this.getEl(this.ids.relatedMinDimSlider);
            const nodeSizeMinSlider = this.getEl(this.ids.nodeSizeMinSlider);
            const nodeSizeMaxSlider = this.getEl(this.ids.nodeSizeMaxSlider);
            const nodeSizeGammaSlider = this.getEl(this.ids.nodeSizeGammaSlider);
            const nodeColorInput = this.getEl(this.ids.nodeColorInput);
            const nodeBorderSlider = this.getEl(this.ids.nodeBorderSlider);
            const nodeBorderColorInput = this.getEl(this.ids.nodeBorderColorInput);
            const nodeOuterBorderWidthInput = this.getEl(this.ids.nodeOuterBorderWidthInput);
            const nodeOuterBorderColorInput = this.getEl(this.ids.nodeOuterBorderColorInput);
            const labelWeightSlider = this.getEl(this.ids.labelWeightSlider);
            const labelFontMinInput = this.getEl(this.ids.labelFontMinInput);
            const labelFontMaxInput = this.getEl(this.ids.labelFontMaxInput);
            const physicsSpringSlider = this.getEl(this.ids.physicsSpringSlider);
            const physicsStrengthSlider = this.getEl(this.ids.physicsStrengthSlider);
            const physicsGravitySlider = this.getEl(this.ids.physicsGravitySlider);
            const edgeFadeSlider = this.getEl(this.ids.edgeFadeSlider);
            const edgeMinWidthSlider = this.getEl(this.ids.edgeMinWidthSlider);
            const edgeMaxWidthSlider = this.getEl(this.ids.edgeMaxWidthSlider);
            const edgeColorInput = this.getEl(this.ids.edgeColorInput);
            const edgeLabelFontSizeInput = this.getEl(this.ids.edgeLabelFontSizeInput);
            const edgeLabelColorInput = this.getEl(this.ids.edgeLabelColorInput);
            const edgeLabelStrokeWidthInput = this.getEl(this.ids.edgeLabelStrokeWidthInput);
            const edgeLabelStrokeColorInput = this.getEl(this.ids.edgeLabelStrokeColorInput);
            const edgeLabelBgColorInput = this.getEl(this.ids.edgeLabelBgColorInput);
            const exportSvgScaleInput = this.getEl(this.ids.exportSvgScaleInput);
            const exportSvgMarginInput = this.getEl(this.ids.exportSvgMarginInput);
            const exportSvgIncludeLabelsInput = this.getEl(this.ids.exportSvgIncludeLabelsInput);
            const zoomInBtn = this.getEl(this.ids.zoomInBtn);
            const zoomOutBtn = this.getEl(this.ids.zoomOutBtn);
            const zoomFitBtn = this.getEl(this.ids.zoomFitBtn);
            const zoomSlider = this.getEl(this.ids.zoomSlider);
            const zoomCollapseBtn = this.getEl(this.ids.zoomCollapseBtn);
            const zoomWrap = document.querySelector('.vis-network-zoom');
            this.zoomWrap = zoomWrap || null;
            const zoomLockBtn = this.getEl(this.ids.zoomLockBtn);
            const zoomPanBtn = this.getEl(this.ids.zoomPanBtn);
            const gridToggleBtn = this.getEl(this.ids.gridToggleBtn);
            const exportSvgBtn = this.getEl(this.ids.exportSvgBtn);
            const exportPdfBtn = this.getEl(this.ids.exportPdfBtn);

            if (inputToggleBtn) {
                inputToggleBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const settingsPanel = this.getEl(this.ids.settingsPanel);
                    const inputPanel = this.getEl(this.ids.inputPanel);
                    const isOpen = settingsPanel ? settingsPanel.classList.contains('is-open') : false;
                    const isActive = inputPanel ? inputPanel.classList.contains('is-active') : false;
                    this.toggleLabelDrawer(false);
                    this.toggleInputDrawer(!(isOpen && isActive));
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
                    const settingsPanel = this.getEl(this.ids.settingsPanel);
                    const labelPanel = this.getEl(this.ids.labelPanel);
                    const isOpen = settingsPanel ? settingsPanel.classList.contains('is-open') : false;
                    const isActive = labelPanel ? labelPanel.classList.contains('is-active') : false;
                    this.toggleInputDrawer(false);
                    this.toggleLabelDrawer(!(isOpen && isActive));
                });
            }
            if (labelCloseBtn) {
                labelCloseBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.toggleLabelDrawer(false);
                });
            }
            if (settingsCloseBtn) {
                settingsCloseBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.toggleInputDrawer(false);
                    this.toggleLabelDrawer(false);
                });
            }
            if (labelAutoBtn) {
                labelAutoBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.restoreLabelDefaults();
                });
            }
            if (edgeLabelToggleBtn) {
                edgeLabelToggleBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.toggleEdgeLabels();
                });
                this.updateEdgeLabelToggleButton();
            }
            if (inputApplyBtn) {
                inputApplyBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.applyInput();
                });
            }
            if (inputTextarea && !inputTextarea.dataset.visBound) {
                inputTextarea.dataset.visBound = '1';
                inputTextarea.addEventListener('keydown', (e) => {
                    if (e.key !== 'Enter' || e.shiftKey) return;
                    const updated = this.tryApplySingleNodeFromTextarea(inputTextarea);
                    if (updated) {
                        e.preventDefault();
                    }
                });
                inputTextarea.addEventListener('keydown', (e) => {
                    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
                    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
                    const start = inputTextarea.selectionStart ?? 0;
                    const end = inputTextarea.selectionEnd ?? 0;
                    const atStart = start === 0 && end === 0;
                    const atEnd = start === inputTextarea.value.length && end === inputTextarea.value.length;
                    if (e.key === 'ArrowUp' && !atStart) return;
                    if (e.key === 'ArrowDown' && !atEnd) return;
                    const next = this.stepInputHistory(e.key === 'ArrowUp' ? -1 : 1);
                    if (next == null) return;
                    e.preventDefault();
                    inputTextarea.value = next;
                    this.persistInputDraft(next);
                    setTimeout(() => {
                        const pos = e.key === 'ArrowUp' ? 0 : inputTextarea.value.length;
                        inputTextarea.setSelectionRange(pos, pos);
                    }, 0);
                });
                inputTextarea.addEventListener('input', () => {
                    this.persistInputDraft(inputTextarea.value || '');
                });
                inputTextarea.addEventListener('blur', () => {
                    const raw = inputTextarea.value || '';
                    if (!raw.trim()) return;
                    const tryParse = (text) => {
                        try {
                            return JSON.parse(text);
                        } catch (_e) {
                            return null;
                        }
                    };
                    let parsed = tryParse(raw);
                    if (!parsed && global.JSONRepair && typeof global.JSONRepair.jsonrepair === 'function') {
                        try {
                            const repaired = global.JSONRepair.jsonrepair(raw);
                            parsed = tryParse(repaired);
                        } catch (_e) {
                            parsed = null;
                        }
                    }
                    if (!parsed) return;
                    parsed = coerceNumericFields(parsed);
                    const formatted = JSON.stringify(parsed, null, 2);
                    inputTextarea.value = formatted;
                    this.visInputText = formatted;
                    this.recordInputHistory(formatted);
                    this.persistInputDraft(formatted);
                });
                this.applyInputDraftToTextarea();
            }
            if (updateNodeBtn) {
                updateNodeBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (inputTextarea) {
                        this.tryApplySingleNodeFromTextarea(inputTextarea);
                    }
                });
            }
            if (inputAppendBtn) {
                inputAppendBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.appendInput();
                });
            }
            if (inputDepthFocusBtn) {
                inputDepthFocusBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.applyDepthFocusFromInput();
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
                savedSelect.addEventListener('change', () => {
                    if (savedSelect.disabled) return;
                    const next = Number.parseInt(savedSelect.value, 10);
                    const idx = Number.isFinite(next) ? next : null;
                    this.pendingSavedIndex = idx;
                    if (idx != null) {
                        this.persistSavedSelect(idx);
                    }
                });
            }
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.deleteNetworkJson();
                });
            }
            if (viewBtn) {
                viewBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.viewVisDataJson();
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
                    this.adjustZoom(this.zoomStep, 'button');
                });
            }
            if (zoomOutBtn) {
                zoomOutBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.adjustZoom(-this.zoomStep, 'button');
                });
            }
            if (zoomFitBtn) {
                zoomFitBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (this.visNetwork) {
                        this.visNetwork.fit({
                            animation: {
                                duration: 420,
                                easingFunction: this.zoomAnimEasing
                            }
                        });
                        this.syncZoomSlider();
                    }
                });
            }
            if (zoomSlider) {
                zoomSlider.addEventListener('input', () => {
                    const value = Number(zoomSlider.value) / 100;
                    this.moveZoomTo(this.clampZoom(value), 'slider');
                });
            }
            if (gridToggleBtn) {
                gridToggleBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.applyDepthMode(!this.depthMode);
                    this.queuePersistSettings();
                });
            }
            if (zoomCollapseBtn && zoomWrap) {
                zoomCollapseBtn.addEventListener('click', () => {
                    this.setZoomCollapsed(!this.zoomCollapsed);
                });
            }
            if (zoomLockBtn) {
                zoomLockBtn.addEventListener('click', () => {
                    this.isLocked = !this.isLocked;
                    if (this.isLocked) this.isPanOnly = false;
                    this.applyInteractionMode();
                    zoomLockBtn.classList.toggle('is-active', this.isLocked);
                    if (zoomPanBtn) zoomPanBtn.classList.toggle('is-active', this.isPanOnly);
                });
            }
            if (zoomPanBtn) {
                zoomPanBtn.addEventListener('click', () => {
                    this.isPanOnly = !this.isPanOnly;
                    if (this.isPanOnly) this.isLocked = false;
                    this.applyInteractionMode();
                    zoomPanBtn.classList.toggle('is-active', this.isPanOnly);
                    if (zoomLockBtn) zoomLockBtn.classList.toggle('is-active', this.isLocked);
                });
            }
            if (exportSvgBtn) {
                exportSvgBtn.addEventListener('click', () => {
                    this.exportNetworkVector('svg');
                });
            }
            if (exportPdfBtn) {
                exportPdfBtn.addEventListener('click', () => {
                    this.exportNetworkVector('pdf');
                });
            }
            this.applyZoomCollapseState();
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
                    renderSuggestions(labelFieldInput.value, false);
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
                                this.applyLabelField(btn.dataset.value);
                                return;
                            }
                        }
                        const value = labelFieldInput.value;
                        applyFieldSelection(value);
                        this.applyLabelField(value);
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
                        } else {
                            if (!this.labelFieldHistory.length) return;
                            e.preventDefault();
                            if (this.labelFieldHistoryIndex === -1) {
                                this.labelFieldHistoryIndex = this.labelFieldHistory.length;
                            }
                            const delta = e.key === 'ArrowDown' ? 1 : -1;
                            let next = this.labelFieldHistoryIndex + delta;
                            if (next < 0) next = 0;
                            if (next >= this.labelFieldHistory.length) next = this.labelFieldHistory.length - 1;
                            this.labelFieldHistoryIndex = next;
                            const value = this.labelFieldHistory[next] || '';
                            labelFieldInput.value = value;
                            renderSuggestions(labelFieldInput.value);
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
            const bindNumberInput = (el, onValue) => {
                if (!el || el.dataset.visBound) return;
                el.dataset.visBound = '1';
                const getStep = () => {
                    const raw = Number(el.step);
                    return Number.isFinite(raw) && raw > 0 ? raw : 1;
                };
                const getDecimals = () => {
                    const stepRaw = String(el.step || '');
                    if (!stepRaw.includes('.')) return 0;
                    return stepRaw.split('.')[1].length;
                };
                const applyValue = (rawValue) => {
                    const value = Number(rawValue);
                    const next = Number.isFinite(value) ? value : 0;
                    const decimals = getDecimals();
                    el.value = decimals ? next.toFixed(decimals) : String(Math.round(next));
                    onValue(next);
                };
                el.addEventListener('input', () => {
                    applyValue(el.value);
                });
                el.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    const step = getStep();
                    const direction = e.deltaY < 0 ? -1 : 1;
                    const current = Number(el.value);
                    const next = (Number.isFinite(current) ? current : 0) + direction * step;
                    applyValue(next);
                }, { passive: false });
            };

            bindNumberInput(labelFadeSlider, (next) => {
                this.labelFade = next;
                this.applyLabelFade();
                this.queuePersistSettings();
            });
            if (labelColorInput && !labelColorInput.dataset.visBound) {
                labelColorInput.dataset.visBound = '1';
                labelColorInput.addEventListener('input', () => {
                    this.labelColor = labelColorInput.value || '#000000';
                    this.applyLabelColor();
                    this.queuePersistSettings();
                });
            }
            if (labelBgColorInput && !labelBgColorInput.dataset.visBound) {
                labelBgColorInput.dataset.visBound = '1';
                labelBgColorInput.addEventListener('input', () => {
                    this.labelBgColor = labelBgColorInput.value || '#f2f2f2f1';
                    this.applyLabelBgColor();
                    this.queuePersistSettings();
                });
            }
            if (labelBorderColorInput && !labelBorderColorInput.dataset.visBound) {
                labelBorderColorInput.dataset.visBound = '1';
                labelBorderColorInput.addEventListener('input', () => {
                    this.labelBorderColor = labelBorderColorInput.value || '#00000021';
                    this.applyLabelBorderColor();
                    this.queuePersistSettings();
                });
            }
            bindNumberInput(labelStrokeWidthInput, (next) => {
                this.labelStrokeWidth = Math.max(0, Number.isFinite(next) ? next : 0);
                this.applyLabelStrokeWidth();
                this.queuePersistSettings();
            });
            if (labelStrokeColorInput && !labelStrokeColorInput.dataset.visBound) {
                labelStrokeColorInput.dataset.visBound = '1';
                labelStrokeColorInput.addEventListener('input', () => {
                    this.labelStrokeColor = labelStrokeColorInput.value || '#ffffff';
                    this.applyLabelStrokeColor();
                    this.queuePersistSettings();
                });
            }
            bindNumberInput(labelMinSlider, (next) => {
                this.labelMinCitations = next;
                this.applyLabelThreshold();
                this.queuePersistSettings();
            });
            bindNumberInput(labelMinDimSlider, (next) => {
                const clamped = Math.max(0, Math.min(1, Number.isFinite(next) ? next : 0.2));
                this.labelMinDimAlpha = clamped;
                this.applyLabelThresholdDimming();
                this.queuePersistSettings();
            });
            bindNumberInput(relatedMinSlider, (next) => {
                this.relatedMinValue = Number.isFinite(next) ? next : 0;
                this.applyLabelThresholdDimming();
                this.queuePersistSettings();
            });
            bindNumberInput(relatedMinDimSlider, (next) => {
                const clamped = Math.max(0, Math.min(1, Number.isFinite(next) ? next : 0.2));
                this.relatedMinDimAlpha = clamped;
                this.applyLabelThresholdDimming();
                this.queuePersistSettings();
            });
            bindNumberInput(labelWeightSlider, (next) => {
                this.labelWeight = next;
                this.applyLabelWeight();
                this.queuePersistSettings();
            });
            bindNumberInput(labelFontMinInput, (next) => {
                this.labelFontMin = next;
                this.applyLabelSizeScale();
                this.queuePersistSettings();
            });
            bindNumberInput(labelFontMaxInput, (next) => {
                this.labelFontMax = next;
                this.applyLabelSizeScale();
                this.queuePersistSettings();
            });
            bindNumberInput(physicsSpringSlider, (next) => {
                this.physicsSpringLength = next;
                this.applyPhysicsSettings();
                this.queuePersistSettings();
            });
            bindNumberInput(physicsStrengthSlider, (next) => {
                this.physicsSpringConstant = next;
                this.applyPhysicsSettings();
                this.queuePersistSettings();
            });
            bindNumberInput(physicsGravitySlider, (next) => {
                this.physicsGravity = next;
                this.applyPhysicsSettings();
                this.queuePersistSettings();
            });
            bindNumberInput(edgeFadeSlider, (next) => {
                this.edgeFade = next;
                this.applyEdgeFade();
                this.queuePersistSettings();
            });
            bindNumberInput(edgeMinWidthSlider, (next) => {
                this.edgeMinWidth = next;
                this.applyEdgeWidthRange();
                this.queuePersistSettings();
            });
            bindNumberInput(edgeMaxWidthSlider, (next) => {
                this.edgeMaxWidth = next;
                this.applyEdgeWidthRange();
                this.queuePersistSettings();
            });
            bindNumberInput(edgeLabelFontSizeInput, (next) => {
                this.edgeLabelFontSize = next;
                this.applyEdgeLabelDisplay();
                this.queuePersistSettings();
            });
            bindNumberInput(edgeLabelStrokeWidthInput, (next) => {
                this.edgeLabelStrokeWidth = Math.max(0, Number.isFinite(next) ? next : 0);
                this.applyEdgeLabelDisplay();
                this.queuePersistSettings();
            });
            bindNumberInput(nodeSizeMinSlider, (next) => {
                this.nodeSizeMin = next;
                this.applyNodeSizeScale();
                this.queuePersistSettings();
            });
            bindNumberInput(nodeSizeMaxSlider, (next) => {
                this.nodeSizeMax = next;
                this.applyNodeSizeScale();
                this.queuePersistSettings();
            });
            bindNumberInput(nodeSizeGammaSlider, (next) => {
                this.nodeSizeGamma = next;
                this.applyNodeSizeScale();
                this.queuePersistSettings();
            });
            bindNumberInput(nodeBorderSlider, (next) => {
                this.nodeBorderWidth = next;
                this.applyNodeBorderWidth();
                this.queuePersistSettings();
            });
            if (global.Coloris && !this._colorisInit) {
                this._colorisInit = true;
                try {
                    global.Coloris({
                        el: '#visNodeOuterBorderColor',
                        alpha: true,
                        format: 'hex',
                        formatToggle: false,
                        forceAlpha: true
                    });
                    global.Coloris({
                        el: '#visNodeColorInput',
                        alpha: true,
                        format: 'hex',
                        formatToggle: false,
                        forceAlpha: true
                    });
                    global.Coloris({
                        el: '#visNodeBorderColorInput',
                        alpha: true,
                        format: 'hex',
                        formatToggle: false,
                        forceAlpha: true
                    });
                    global.Coloris({
                        el: '#visEdgeColorInput',
                        alpha: true,
                        format: 'hex',
                        formatToggle: false,
                        forceAlpha: true
                    });
                    global.Coloris({
                        el: '#visEdgeLabelColorInput',
                        alpha: true,
                        format: 'hex',
                        formatToggle: false,
                        forceAlpha: true
                    });
                    global.Coloris({
                        el: '#visEdgeLabelStrokeColorInput',
                        alpha: true,
                        format: 'hex',
                        formatToggle: false,
                        forceAlpha: true
                    });
                    global.Coloris({
                        el: '#visEdgeLabelBgColorInput',
                        alpha: true,
                        format: 'hex',
                        formatToggle: false,
                        forceAlpha: true
                    });
                    global.Coloris({
                        el: '#visLabelColorInput',
                        alpha: true,
                        format: 'hex',
                        formatToggle: false,
                        forceAlpha: true
                    });
                    global.Coloris({
                        el: '#visLabelBgColorInput',
                        alpha: true,
                        format: 'hex',
                        formatToggle: false,
                        forceAlpha: true
                    });
                    global.Coloris({
                        el: '#visLabelBorderColorInput',
                        alpha: true,
                        format: 'hex',
                        formatToggle: false,
                        forceAlpha: true
                    });
                    global.Coloris({
                        el: '#visLabelStrokeColorInput',
                        alpha: true,
                        format: 'hex',
                        formatToggle: false,
                        forceAlpha: true
                    });
                } catch (_e) {
                    // ignore color picker init issues
                }
            }
            bindNumberInput(nodeOuterBorderWidthInput, (next) => {
                this.nodeOuterBorderWidth = next;
                if (this.visNetwork) this.visNetwork.redraw();
                this.queuePersistSettings();
            });
            if (nodeOuterBorderColorInput && !nodeOuterBorderColorInput.dataset.visBound) {
                nodeOuterBorderColorInput.dataset.visBound = '1';
                nodeOuterBorderColorInput.addEventListener('input', () => {
                    this.nodeOuterBorderColor = nodeOuterBorderColorInput.value || '#ffffff';
                    if (this.visNetwork) this.visNetwork.redraw();
                    this.queuePersistSettings();
                });
            }
            if (nodeColorInput && !nodeColorInput.dataset.visBound) {
                nodeColorInput.dataset.visBound = '1';
                nodeColorInput.addEventListener('input', () => {
                    this.nodeColor = nodeColorInput.value || '#ffffff';
                    this.applyNodeColor();
                    this.queuePersistSettings();
                });
            }
            if (nodeBorderColorInput && !nodeBorderColorInput.dataset.visBound) {
                nodeBorderColorInput.dataset.visBound = '1';
                nodeBorderColorInput.addEventListener('input', () => {
                    this.nodeBorderColor = nodeBorderColorInput.value || '#111111';
                    this.applyNodeBorderColor();
                    this.queuePersistSettings();
                });
            }
            if (edgeColorInput && !edgeColorInput.dataset.visBound) {
                edgeColorInput.dataset.visBound = '1';
                edgeColorInput.addEventListener('input', () => {
                    this.edgeColor = edgeColorInput.value || '#111111';
                    this.applyEdgeFade();
                    this.queuePersistSettings();
                });
            }
            if (edgeLabelColorInput && !edgeLabelColorInput.dataset.visBound) {
                edgeLabelColorInput.dataset.visBound = '1';
                edgeLabelColorInput.addEventListener('input', () => {
                    this.edgeLabelFontColor = edgeLabelColorInput.value || '#111111';
                    this.applyEdgeLabelDisplay();
                    this.queuePersistSettings();
                });
            }
            if (edgeLabelStrokeColorInput && !edgeLabelStrokeColorInput.dataset.visBound) {
                edgeLabelStrokeColorInput.dataset.visBound = '1';
                edgeLabelStrokeColorInput.addEventListener('input', () => {
                    this.edgeLabelStrokeColor = edgeLabelStrokeColorInput.value || '#ffffff';
                    this.applyEdgeLabelDisplay();
                    this.queuePersistSettings();
                });
            }
            if (edgeLabelBgColorInput && !edgeLabelBgColorInput.dataset.visBound) {
                edgeLabelBgColorInput.dataset.visBound = '1';
                edgeLabelBgColorInput.addEventListener('input', () => {
                    this.edgeLabelBgColor = edgeLabelBgColorInput.value || 'rgba(255,255,255,0.85)';
                    this.applyEdgeLabelDisplay();
                    this.queuePersistSettings();
                });
            }
            bindNumberInput(labelSizeSlider, (next) => {
                const scale = Number.isFinite(next) ? next / 100 : 1;
                this.labelSizeScale = Math.max(0.6, Math.min(2.2, scale));
                this.applyLabelSizeScale();
                this.queuePersistSettings();
            });
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
            if (labelSlots && !labelSlots.dataset.visBound) {
                labelSlots.dataset.visBound = '1';
                labelSlots.addEventListener('click', (e) => {
                    const btn = e.target.closest('[data-slot]');
                    if (!btn) return;
                    e.preventDefault();
                    const idx = Number(btn.dataset.slot) - 1;
                    if (!Number.isFinite(idx) || idx < 0) return;
                    this.showSettingsSlotMenu(e, idx, btn);
                });
            }
            if (exportSvgScaleInput && !exportSvgScaleInput.dataset.visBound) {
                exportSvgScaleInput.dataset.visBound = '1';
                exportSvgScaleInput.addEventListener('input', () => {
                    const next = Number(exportSvgScaleInput.value);
                    this.exportSvgScale = Number.isFinite(next) && next > 0 ? next : 1;
                    this.queuePersistSettings();
                });
            }
            if (exportSvgMarginInput && !exportSvgMarginInput.dataset.visBound) {
                exportSvgMarginInput.dataset.visBound = '1';
                exportSvgMarginInput.addEventListener('input', () => {
                    const next = Number(exportSvgMarginInput.value);
                    this.exportSvgMargin = Number.isFinite(next) && next >= 0 ? next : 0;
                    this.queuePersistSettings();
                });
            }
            if (exportSvgIncludeLabelsInput && !exportSvgIncludeLabelsInput.dataset.visBound) {
                exportSvgIncludeLabelsInput.dataset.visBound = '1';
                exportSvgIncludeLabelsInput.addEventListener('change', () => {
                    this.exportSvgIncludeLabels = !!exportSvgIncludeLabelsInput.checked;
                    this.queuePersistSettings();
                });
            }
            if (!this._escBound) {
                this._escBound = true;
                document.addEventListener('keydown', (e) => {
                    if (e.key !== 'Escape') return;
                    const panel = this.getEl(this.ids.settingsPanel);
                    if (panel && panel.classList.contains('is-open')) {
                        e.preventDefault();
                        this.toggleInputDrawer(false);
                        this.toggleLabelDrawer(false);
                    }
                });
            }
            this.bindHoldHotkeys();
            // outside click to close disabled
            this.loadSavedList().then((list) => {
                const safeList = Array.isArray(list) ? list : [];
                this.renderSavedSelect(safeList);
                this.loadSavedSelect().then((savedIdx) => {
                    const idx = this.getValidSavedIndex(safeList, savedIdx);
                    if (idx == null) return;
                    this.setSavedSelectValue(idx, { persist: false, list: safeList });
                });
            });
        }

        applyInteractionMode() {
            if (!this.visNetwork) return;
            const lock = this.isLocked;
            const panOnly = this.isPanOnly;
            const view = this.getEl(this.ids.view);
            if (view) view.classList.toggle('pan-mode', panOnly);
            this.visNetwork.setOptions({
                interaction: {
                    dragNodes: !lock && !panOnly,
                    dragView: !lock,
                    zoomView: !lock
                }
            });
            this.updateZoomControlsDisabled(lock, panOnly);
        }

        bindHoldHotkeys() {
            if (this._hotkeysBound) return;
            this._hotkeysBound = true;
            const isTypingTarget = () => {
                const el = document.activeElement;
                if (!el) return false;
                const tag = el.tagName ? el.tagName.toLowerCase() : '';
                return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
            };
            const isVisActive = () => {
                const view = this.getEl(this.ids.view);
                return !!(view && view.classList.contains('active'));
            };
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Tab') {
                    if (!isVisActive()) return;
                    if (isTypingTarget()) return;
                    if (e.metaKey || e.ctrlKey || e.altKey) return;
                    e.preventDefault();
                    const panel = this.getEl(this.ids.settingsPanel);
                    const inputPanel = this.getEl(this.ids.inputPanel);
                    const labelPanel = this.getEl(this.ids.labelPanel);
                    const isOpen = panel ? panel.classList.contains('is-open') : false;
                    const inputActive = inputPanel ? inputPanel.classList.contains('is-active') : false;
                    if (!isOpen) {
                        this.toggleInputDrawer(true, { focus: false });
                    } else if (inputActive) {
                        this.toggleLabelDrawer(true, { focus: false });
                    } else {
                        this.toggleInputDrawer(true, { focus: false });
                    }
                    const active = document.activeElement;
                    if (active && active !== document.body) active.blur();
                    return;
                }
                if (e.code === 'Space') {
                    if (!isVisActive()) return;
                    if (isTypingTarget()) return;
                    if (e.metaKey || e.ctrlKey) return;
                    if (e.repeat) return;
                    const btn = this.getEl(this.ids.zoomPanBtn);
                    if (!btn) return;
                    e.preventDefault();
                    this.isPanOnly = true;
                    this.isLocked = false;
                    this.applyInteractionMode();
                    btn.classList.toggle('is-active', this.isPanOnly);
                    const lockBtn = this.getEl(this.ids.zoomLockBtn);
                    if (lockBtn) lockBtn.classList.toggle('is-active', this.isLocked);
                    return;
                }
                if (e.key === 'Meta' || e.key === 'Control') return;
                if (isTypingTarget()) return;
                if (!isVisActive()) return;
                if (!this._modReleaseAt) return;
                if (Date.now() - this._modReleaseAt > 1500) return;
                const key = String(e.key || '').toLowerCase();
                if (key === 'f') {
                    e.preventDefault();
                    this.fitToView();
                    return;
                }
                if (key === 'l') {
                    e.preventDefault();
                    const btn = this.getEl(this.ids.labelToggleBtn);
                    if (btn) btn.click();
                    return;
                }
                if (key === 'g') {
                    e.preventDefault();
                    const btn = this.getEl(this.ids.gridToggleBtn);
                    if (btn) btn.click();
                }
            });
            document.addEventListener('keyup', (e) => {
                if (e.code === 'Space') {
                    if (!isVisActive()) return;
                    if (e.metaKey || e.ctrlKey) return;
                    const btn = this.getEl(this.ids.zoomPanBtn);
                    if (!btn) return;
                    e.preventDefault();
                    this.isPanOnly = false;
                    this.applyInteractionMode();
                    btn.classList.toggle('is-active', this.isPanOnly);
                    return;
                }
                if (e.key === 'Meta' || e.key === 'Control') {
                    this._modReleaseAt = Date.now();
                }
            });
            window.addEventListener('blur', () => {
                this._modReleaseAt = 0;
            });
        }

        fitToView() {
            if (!this.visNetwork) return;
            this.visNetwork.fit({ animation: { duration: 250 } });
            this.syncZoomSlider();
        }

        applyDepthMode(enable) {
            this.depthMode = !!enable;
            const view = this.getEl(this.ids.view);
            if (view) {
                view.classList.toggle('no-grid', !this.depthMode);
            }
            const btn = this.getEl(this.ids.gridToggleBtn);
            if (btn) btn.classList.toggle('is-active', this.depthMode);
            if (!this.visNetwork) return;
            this.visNetwork.setOptions({
                nodes: {
                    shadow: this.depthMode ? {
                        enabled: true,
                        color: isDarkTheme() ? 'rgba(0, 0, 0, 0.55)' : 'rgba(17, 24, 39, 0.22)',
                        size: 14,
                        x: 0,
                        y: 6
                    } : { enabled: false }
                },
                edges: {
                    shadow: this.depthMode ? {
                        enabled: true,
                        color: isDarkTheme() ? 'rgba(0, 0, 0, 0.45)' : 'rgba(15, 23, 42, 0.18)',
                        size: 8,
                        x: 0,
                        y: 4
                    } : { enabled: false }
                }
            });
        }

        updateZoomControlsDisabled(isLocked, isPanOnly) {
            const zoomInBtn = this.getEl(this.ids.zoomInBtn);
            const zoomOutBtn = this.getEl(this.ids.zoomOutBtn);
            const zoomFitBtn = this.getEl(this.ids.zoomFitBtn);
            const zoomSlider = this.getEl(this.ids.zoomSlider);
            const disableZoom = isLocked;
            [zoomInBtn, zoomOutBtn, zoomFitBtn].forEach((btn) => {
                if (btn) btn.disabled = disableZoom;
            });
            if (zoomSlider) zoomSlider.disabled = disableZoom;
        }

        exportNetworkVector(type) {
            if (!this.visNetwork) return;
            const scale = type === 'svg' ? this.exportSvgScale : 1;
            const margin = Number.isFinite(Number(this.exportSvgMargin))
                ? Number(this.exportSvgMargin)
                : this.mmToPx(6);
            const includeLabels = this.exportSvgIncludeLabels !== false;
            const result = type === 'svg'
                ? this.buildNetworkSvg(margin, scale, includeLabels)
                : this.buildNetworkSvg(this.mmToPx(6), scale);
            if (!result) return;
            if (type === 'svg') {
                this.downloadSvg(result.svg);
            } else {
                this.openPdfPrintWindowWithSvg(result.svg, result.width, result.height);
            }
        }

        buildNetworkSvgSnapshot(scale = 1) {
            if (!this.visNetwork) return null;
            const view = this.getEl(this.ids.view);
            const canvas = this.visNetwork?.canvas?.frame?.canvas;
            if (!view || !canvas) return null;
            const viewRect = view.getBoundingClientRect();
            if (!viewRect || viewRect.width <= 0 || viewRect.height <= 0) return null;
            const pixelRatio = Number.isFinite(canvas.width) && viewRect.width > 0
                ? canvas.width / viewRect.width
                : 1;
            const baseScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
            const exportScale = baseScale * pixelRatio;
            const width = Math.max(1, Math.round(viewRect.width * exportScale));
            const height = Math.max(1, Math.round(viewRect.height * exportScale));
            const bg = this.getCanvasBackground();
            const imageHref = canvas.toDataURL('image/png');
            const escape = (text) => String(text)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
            const escapeAttr = (text) => String(text)
                .replace(/[\u0000-\u001F\u007F]/g, '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
            const labelItems = [];
            const layer = view.querySelector('.vis-network-label-layer');
            if (layer) {
                const showAll = getLabelState(this.visNetwork).showAll;
                const labels = Array.from(layer.querySelectorAll('.vis-node-label'));
                labels.forEach((labelEl) => {
                    if (labelEl.classList.contains('is-hover')) {
                        if (showAll) return;
                        if (!labelEl.classList.contains('is-visible')) return;
                    }
                    const rect = labelEl.getBoundingClientRect();
                    if (!rect || rect.width <= 0 || rect.height <= 0) return;
                    const style = window.getComputedStyle(labelEl);
                    if (style.visibility === 'hidden' || Number(style.opacity) === 0) return;
                    const parsePx = (val) => {
                        const num = Number.parseFloat(val || '0');
                        return Number.isFinite(num) ? num : 0;
                    };
                    const paddingLeft = parsePx(style.paddingLeft);
                    const paddingTop = parsePx(style.paddingTop);
                    const fontSize = parsePx(style.fontSize) || 11;
                    const borderWidth = parsePx(style.borderWidth);
                    const radius = parsePx(style.borderRadius);
                    const x = (rect.left - viewRect.left) * exportScale;
                    const y = (rect.top - viewRect.top) * exportScale;
                    const w = rect.width * exportScale;
                    const h = rect.height * exportScale;
                    labelItems.push({
                        x,
                        y,
                        width: w,
                        height: h,
                        textX: x + paddingLeft * exportScale,
                        textY: y + paddingTop * exportScale,
                        text: labelEl.textContent || '',
                        fontSize: fontSize * exportScale,
                        fontWeight: style.fontWeight || 500,
                        fontFamily: style.fontFamily || 'Georgia, Times, serif',
                        color: style.color || '#111111',
                        background: style.backgroundColor || 'transparent',
                        borderColor: style.borderColor || 'transparent',
                        borderWidth: borderWidth * exportScale,
                        radius: radius * exportScale
                    });
                });
            }
            const labelSvg = labelItems.map((label) => {
                const rx = Number.isFinite(label.radius) ? Math.min(label.radius, label.height / 2) : 0;
                const border = label.borderWidth > 0 && label.borderColor !== 'transparent'
                    ? `stroke="${escapeAttr(label.borderColor)}" stroke-width="${label.borderWidth}"`
                    : '';
                const fill = label.background && label.background !== 'rgba(0, 0, 0, 0)'
                    ? `fill="${escapeAttr(label.background)}"`
                    : 'fill="transparent"';
                const rect = `<rect x="${label.x}" y="${label.y}" width="${label.width}" height="${label.height}" rx="${rx}" ry="${rx}" ${fill} ${border} />`;
                const text = `<text x="${label.textX}" y="${label.textY}" font-size="${label.fontSize}" font-weight="${escapeAttr(label.fontWeight)}" fill="${escapeAttr(label.color)}" font-family="${escapeAttr(label.fontFamily)}" dominant-baseline="hanging">${escape(label.text)}</text>`;
                return `${rect}${text}`;
            }).join('');
            const svg = `
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect x="0" y="0" width="${width}" height="${height}" fill="${bg}" />
  <image x="0" y="0" width="${width}" height="${height}" href="${imageHref}" xlink:href="${imageHref}" preserveAspectRatio="none" />
  <g>
    ${labelSvg}
  </g>
</svg>`;
            return { svg, width, height, widthPx: width, heightPx: height };
        }

        buildNetworkSvg(marginPx, scale = 1, includeLabels = true) {
            if (!this.visNetwork) return null;
            const dataset = this.visNetwork?.body?.data;
            if (!dataset) return null;
            const nodes = dataset.nodes?.get() || [];
            const edges = dataset.edges?.get() || [];
            if (!nodes.length) return null;
            const view = this.getEl(this.ids.view);
            let left = Infinity;
            let right = -Infinity;
            let top = Infinity;
            let bottom = -Infinity;
            nodes.forEach((node) => {
                const box = this.visNetwork.getBoundingBox(node.id);
                if (!box) return;
                left = Math.min(left, box.left);
                right = Math.max(right, box.right);
                top = Math.min(top, box.top);
                bottom = Math.max(bottom, box.bottom);
            });
            if (!isFinite(left) || !isFinite(right) || !isFinite(top) || !isFinite(bottom)) {
                return null;
            }
            const labelItems = [];
            if (includeLabels && view) {
                const layer = view.querySelector('.vis-network-label-layer');
                const viewRect = view.getBoundingClientRect();
                if (layer && viewRect) {
                    const showAll = getLabelState(this.visNetwork).showAll;
                    const labels = Array.from(layer.querySelectorAll('.vis-node-label'));
                    labels.forEach((labelEl) => {
                        if (labelEl.classList.contains('is-hover')) {
                            if (showAll) return;
                            if (!labelEl.classList.contains('is-visible')) return;
                        }
                        const rect = labelEl.getBoundingClientRect();
                        if (!rect || rect.width <= 0 || rect.height <= 0) return;
                        const style = window.getComputedStyle(labelEl);
                        if (style.visibility === 'hidden' || Number(style.opacity) === 0) return;
                        const domTopLeft = { x: rect.left - viewRect.left, y: rect.top - viewRect.top };
                        const domBottomRight = { x: rect.right - viewRect.left, y: rect.bottom - viewRect.top };
                        const canvasTopLeft = this.visNetwork.DOMtoCanvas(domTopLeft);
                        const canvasBottomRight = this.visNetwork.DOMtoCanvas(domBottomRight);
                        if (!canvasTopLeft || !canvasBottomRight) return;
                        const w = canvasBottomRight.x - canvasTopLeft.x;
                        const h = canvasBottomRight.y - canvasTopLeft.y;
                        if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
                        const parsePx = (val) => {
                            const num = Number.parseFloat(val || '0');
                            return Number.isFinite(num) ? num : 0;
                        };
                        const paddingLeft = parsePx(style.paddingLeft);
                        const fontSize = parsePx(style.fontSize) || 11;
                        const borderWidth = parsePx(style.borderWidth);
                        const borderStyle = style.borderStyle || 'solid';
                        const radius = parsePx(style.borderRadius);
                        const centerY = canvasTopLeft.y + h / 2;
                        const textX = canvasTopLeft.x + paddingLeft;
                        labelItems.push({
                            x: canvasTopLeft.x,
                            y: canvasTopLeft.y,
                            width: w,
                            height: h,
                            centerY,
                            textX,
                            text: labelEl.textContent || '',
                            fontSize,
                            fontWeight: style.fontWeight || 500,
                            fontFamily: style.fontFamily || 'Georgia, Times, serif',
                            color: style.color || '#111111',
                            background: style.backgroundColor || 'transparent',
                            borderColor: style.borderColor || 'transparent',
                            borderWidth,
                            borderStyle,
                            radius
                        });
                        left = Math.min(left, canvasTopLeft.x);
                        right = Math.max(right, canvasBottomRight.x);
                        top = Math.min(top, canvasTopLeft.y);
                        bottom = Math.max(bottom, canvasBottomRight.y);
                    });
                }
            }
            const margin = Number.isFinite(marginPx) ? marginPx : 0;
            const width = Math.max(1, right - left + margin * 2);
            const height = Math.max(1, bottom - top + margin * 2);
            const viewLeft = left - margin;
            const viewTop = top - margin;
            const bg = this.getCanvasBackground();
            const nodeMap = new Map(nodes.map((n) => [n.id, n]));
            const escape = (text) => String(text)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
            const escapeAttr = (text) => String(text)
                .replace(/[\u0000-\u001F\u007F]/g, '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
            const exportScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
            const widthPx = Math.max(1, Math.round(width * exportScale));
            const heightPx = Math.max(1, Math.round(height * exportScale));
            const edgeSvg = edges.map((edge) => {
                const fromPos = this.visNetwork.getPositions([edge.from])[edge.from];
                const toPos = this.visNetwork.getPositions([edge.to])[edge.to];
                if (!fromPos || !toPos) return '';
                const stroke = escapeAttr(edge.color?.color || '#111111');
                const widthVal = Number(edge.width) || 1;
                return `<line x1="${fromPos.x}" y1="${fromPos.y}" x2="${toPos.x}" y2="${toPos.y}" stroke="${stroke}" stroke-width="${widthVal}" stroke-linecap="round" />`;
            }).join('');
            const nodeSvg = nodes.map((node) => {
                const pos = this.visNetwork.getPositions([node.id])[node.id];
                if (!pos) return '';
                const radius = Number(node.size) || 6;
                const fill = escapeAttr(node.color?.background || '#ffffff');
                const stroke = escapeAttr(node.color?.border || '#111111');
                const strokeWidth = Number(node.borderWidth) || 1;
                return `<circle cx="${pos.x}" cy="${pos.y}" r="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
            }).join('');
            const labelSvg = labelItems.map((label) => {
                const rx = Number.isFinite(label.radius) ? Math.min(label.radius, label.height / 2) : 0;
                const dash = label.borderStyle === 'dashed' ? 'stroke-dasharray="3 2"' : '';
                const border = label.borderWidth > 0 && label.borderColor !== 'transparent'
                    ? `stroke="${escapeAttr(label.borderColor)}" stroke-width="${label.borderWidth}" ${dash}`
                    : '';
                const fill = label.background && label.background !== 'rgba(0, 0, 0, 0)'
                    ? `fill="${escapeAttr(label.background)}"`
                    : 'fill="transparent"';
                const rect = `<rect x="${label.x}" y="${label.y}" width="${label.width}" height="${label.height}" rx="${rx}" ry="${rx}" ${fill} ${border} />`;
                const text = `<text x="${label.textX}" y="${label.centerY}" font-size="${label.fontSize}" font-weight="${escapeAttr(label.fontWeight)}" fill="${escapeAttr(label.color)}" font-family="${escapeAttr(label.fontFamily)}" text-anchor="start" dominant-baseline="middle">${escape(label.text)}</text>`;
                return `${rect}${text}`;
            }).join('');
            const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}" viewBox="${viewLeft} ${viewTop} ${width} ${height}">
  <rect x="${viewLeft}" y="${viewTop}" width="${width}" height="${height}" fill="${bg}" />
  <g>
    ${edgeSvg}
  </g>
  <g>
    ${nodeSvg}
  </g>
  <g>
    ${labelSvg}
  </g>
</svg>`;
            return { svg, width, height, widthPx, heightPx };
        }

        getNetworkBounds() {
            if (!this.visNetwork) return null;
            const nodes = this.visNetwork.body?.data?.nodes;
            const ids = nodes ? nodes.getIds() : [];
            if (!ids.length) {
                const canvas = this.visNetwork.canvas?.frame?.canvas;
                if (!canvas) return null;
                return { left: 0, top: 0, right: canvas.clientWidth, bottom: canvas.clientHeight };
            }
            let left = Infinity;
            let right = -Infinity;
            let top = Infinity;
            let bottom = -Infinity;
            ids.forEach((id) => {
                const box = this.visNetwork.getBoundingBox(id);
                if (!box) return;
                left = Math.min(left, box.left);
                right = Math.max(right, box.right);
                top = Math.min(top, box.top);
                bottom = Math.max(bottom, box.bottom);
            });
            if (!isFinite(left) || !isFinite(right) || !isFinite(top) || !isFinite(bottom)) {
                return null;
            }
            return { left, right, top, bottom };
        }

        getCanvasBackground() {
            const view = this.getEl(this.ids.view);
            if (!view) return '#ffffff';
            const style = window.getComputedStyle(view);
            return style.backgroundColor || '#ffffff';
        }

        mmToPx(mm) {
            return (mm / 25.4) * 96;
        }

        downloadSvg(svg) {
            const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `vis-network-${Date.now()}.svg`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        }

        openPdfPrintWindowWithSvg(svg, width, height) {
            const pxToMm = (px) => (px / 96) * 25.4;
            const wMm = pxToMm(width + 0.01);
            const hMm = pxToMm(height + 0.01);
            const html = `
                <html>
                    <head>
                        <title>vis-network-export</title>
                        <style>
                            @page { size: ${wMm}mm ${hMm}mm; margin: 0; }
                            html, body { margin: 0; padding: 0; }
                            svg { display: block; width: 100%; height: auto; }
                        </style>
                    </head>
                    <body>
                        ${svg}
                        <script>
                            window.onload = () => {
                                setTimeout(() => {
                                    window.focus();
                                    window.print();
                                }, 120);
                            };
                        </script>
                    </body>
                </html>`;
            const win = window.open('', '_blank');
            if (!win) return;
            win.document.open();
            win.document.write(html);
            win.document.close();
        }

        mountDrawer() {
            const panel = this.getEl(this.ids.settingsPanel);
            if (!panel || panel.dataset.mounted) return;
            panel.dataset.mounted = '1';
        }

        mountLabelDrawer() {
            const panel = this.getEl(this.ids.settingsPanel);
            if (!panel || panel.dataset.labelMounted) return;
            panel.dataset.labelMounted = '1';
            const labelPanel = panel.querySelector('.vis-label-panel');
            if (labelPanel && !labelPanel.dataset.sectionBound) {
                labelPanel.dataset.sectionBound = '1';
                labelPanel.addEventListener('click', (e) => {
                    const btn = e.target.closest('.vis-section-toggle');
                    if (!btn) return;
                    const section = btn.closest('.vis-label-section');
                    if (!section) return;
                    const collapsed = section.classList.toggle('is-collapsed');
                    btn.setAttribute('aria-expanded', String(!collapsed));
                    const icon = btn.querySelector('i');
                    if (icon) {
                        icon.className = collapsed ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-up';
                    }
                });
            }
        }

        disableVisSettingsTabFocus() {
            const panel = this.getEl(this.ids.settingsPanel);
            const body = panel ? panel.querySelector('.vis-settings-body') : null;
            if (!body) return;
            const focusables = body.querySelectorAll('a, button, input, select, textarea, [tabindex]');
            focusables.forEach((el) => {
                if (!(el instanceof HTMLElement)) return;
                el.setAttribute('tabindex', '-1');
            });
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
            const canvas = this.getEl(this.ids.canvas);
            const view = this.getEl(this.ids.view);
            if (canvas && !canvas.dataset.visFocusGuard) {
                canvas.dataset.visFocusGuard = '1';
                canvas.tabIndex = -1;
                canvas.addEventListener('focus', (e) => {
                    e.preventDefault();
                    canvas.blur();
                });
            }
            if (view && !view.dataset.visFocusGuard) {
                view.dataset.visFocusGuard = '1';
                view.tabIndex = -1;
                view.addEventListener('focus', (e) => {
                    e.preventDefault();
                    view.blur();
                });
            }
            const { network, data } = global.WosVisNetwork.renderVisNetworkFromJson(raw, {
                container: canvas,
                view: view,
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
            if (!this.graphModel && global.WosGraphModel) {
                this.graphModel = new global.WosGraphModel({ source: null });
            }
            if (this.graphModel) {
                let parsed = null;
                if (typeof raw === 'string') {
                    try {
                        parsed = JSON.parse(raw);
                    } catch (_e) {
                        parsed = null;
                    }
                } else if (raw && typeof raw === 'object') {
                    parsed = raw;
                }
                if (parsed && this.isWosGraphData(parsed)) {
                    this.graphModel.setSource(parsed);
                    this.graphModel.visData = data || this.graphModel.visData;
                }
            }
            this.wosDataIndex = null;
            this.wosDataIndexSource = null;
            this._wosDataIndex = null;
            this._wosDataIndexView = null;
            this.wosNodeIndex = null;
            this.wosNodeIndexSource = null;
            if (this.visNetwork) {
                this.bindNetworkEvents(this.visNetwork);
                this.bindZoomEvents(this.visNetwork);
                this.applyInteractionMode();
            }
            if (data && typeof data === 'object') {
                this.wosNodeIndex = this.buildWosNodeIndex(data);
                this.wosNodeIndexSource = data;
            }
            this.wrapLabelToggleButton();
            const minSlider = this.getEl(this.ids.labelMinSlider);
            const minDimSlider = this.getEl(this.ids.labelMinDimSlider);
            const relatedMinSlider = this.getEl(this.ids.relatedMinSlider);
            const relatedMinDimSlider = this.getEl(this.ids.relatedMinDimSlider);
            if (minSlider) {
                minSlider.value = String(this.labelMinCitations || 0);
            }
            if (minDimSlider) {
                minDimSlider.value = String(this.labelMinDimAlpha ?? 0.2);
            }
            if (relatedMinSlider) {
                relatedMinSlider.value = String(this.relatedMinValue || 0);
            }
            if (relatedMinDimSlider) {
                relatedMinDimSlider.value = String(this.relatedMinDimAlpha ?? 0.2);
            }
            this.refreshLabelFieldOptions();
            void this.applyLabelField(this.labelField);
            this.applyLabelFade();
            this.applyLabelSizeScale();
            this.applyLabelWeight();
            this.applyLabelColor();
            this.applyLabelBgColor();
            this.applyLabelBorderColor();
            this.applyLabelStrokeWidth();
            this.applyLabelStrokeColor();
            this.applyLabelThreshold();
            this.applyNodeSizeScale();
            this.applyNodeBorderWidth();
            this.applyNodeColor();
            this.applyNodeBorderColor();
            this.applyPhysicsSettings();
            this.applyEdgeFade();
            this.applyEdgeWidthRange();
            this.applyEdgeStyle();
            this.applyEdgeLabelDisplay();
            this.updateEdgeLabelToggleButton();
            this.applyDepthMode(this.depthMode);
            // Skip auto-restoring label rendering on reload.
            this.queuePersistNetworkState();
            this._visViewReady = true;
        }

        renderFromVisData(raw, options = {}) {
            if (!global.WosVisNetwork) {
                this.notify('WOS Vis module not loaded', 'error');
                return;
            }
            const canvas = this.getEl(this.ids.canvas);
            const view = this.getEl(this.ids.view);
            if (canvas && !canvas.dataset.visFocusGuard) {
                canvas.dataset.visFocusGuard = '1';
                canvas.tabIndex = -1;
                canvas.addEventListener('focus', (e) => {
                    e.preventDefault();
                    canvas.blur();
                });
            }
            if (view && !view.dataset.visFocusGuard) {
                view.dataset.visFocusGuard = '1';
                view.tabIndex = -1;
                view.addEventListener('focus', (e) => {
                    e.preventDefault();
                    view.blur();
                });
            }
            const { network, data } = global.WosVisNetwork.renderVisNetworkFromVisData(raw, {
                container: canvas,
                view: view,
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
            this.resetEdgeFocusState();
            const sourceJson = typeof options.sourceJson === 'string' ? options.sourceJson : '';
            this.lastRenderedJson = sourceJson;
            this.visInputText = sourceJson;
            const textarea = this.getEl(this.ids.inputTextarea);
            if (textarea && sourceJson) {
                textarea.value = sourceJson;
            }
            if (!this.graphModel && global.WosGraphModel) {
                this.graphModel = new global.WosGraphModel({ source: null });
            }
            if (this.graphModel && sourceJson) {
                try {
                    const parsed = JSON.parse(sourceJson);
                    if (this.isWosGraphData(parsed)) {
                        this.graphModel.setSource(parsed);
                        this.graphModel.visData = data || this.graphModel.visData;
                    }
                } catch (_e) {
                    // ignore
                }
            }
            this.wosDataIndex = null;
            this.wosDataIndexSource = null;
            this._wosDataIndex = null;
            this._wosDataIndexView = null;
            this.wosNodeIndex = null;
            this.wosNodeIndexSource = null;
            if (this.visNetwork) {
                this.bindNetworkEvents(this.visNetwork);
                this.bindZoomEvents(this.visNetwork);
                this.applyInteractionMode();
            }
            this.wrapLabelToggleButton();
            const minSlider = this.getEl(this.ids.labelMinSlider);
            if (minSlider) {
                minSlider.value = String(this.labelMinCitations || 0);
            }
            const minDimSlider = this.getEl(this.ids.labelMinDimSlider);
            if (minDimSlider) {
                minDimSlider.value = String(this.labelMinDimAlpha ?? 0.2);
            }
            this.refreshLabelFieldOptions();
            void this.applyLabelField(this.labelField);
            this.applyLabelFade();
            this.applyLabelSizeScale();
            this.applyLabelWeight();
            this.applyLabelColor();
            this.applyLabelBgColor();
            this.applyLabelBorderColor();
            this.applyLabelThreshold();
            this.applyNodeSizeScale();
            this.applyNodeBorderWidth();
            this.applyNodeColor();
            this.applyNodeBorderColor();
            this.applyPhysicsSettings();
            this.applyEdgeFade();
            this.applyEdgeWidthRange();
            this.applyEdgeStyle();
            this.applyEdgeLabelDisplay();
            this.updateEdgeLabelToggleButton();
            this.applyDepthMode(this.depthMode);
            this.queuePersistNetworkState();
            this._visViewReady = true;
        }

        wrapLabelToggleButton() {
            const btn = this.getEl(this.ids.labelToggleBtn);
            if (!btn || btn.dataset.visWrapped) return;
            const original = btn.onclick;
            btn.onclick = async (e) => {
                await this.ensureLabelDataReady();
                const input = this.getEl(this.ids.labelFieldInput);
                const currentField = input && input.value ? input.value.trim() : this.labelField;
                await this.applyLabelField(currentField);
                this.applyLabelFade();
                this.applyLabelSizeScale();
                this.applyLabelWeight();
                this.applyLabelColor();
                this.applyLabelBgColor();
                this.applyLabelBorderColor();
                this.applyLabelThreshold();
                this.applyPhysicsSettings();
                this.applyEdgeFade();
                this.applyEdgeWidthRange();
                this.queuePersistNetworkState();
                if (typeof original === 'function') {
                    original.call(btn, e);
                }
            };
            btn.dataset.visWrapped = '1';
        }

        async ensureLabelDataReady() {
            await this.ensureCurrentViewDataLoaded();
            const app = this.app;
            if (app && (!app.fileMetaByBase || !Object.keys(app.fileMetaByBase).length)) {
                if (typeof app.loadFileList === 'function') {
                    await app.loadFileList(true);
                }
            }
            const freshIndex = await this.buildWosDataIndexForCurrentView();
            if (freshIndex && freshIndex.size) {
                this.wosDataIndex = freshIndex;
                this.wosDataIndexSource = this.getCurrentViewData();
            }
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
                this._visViewReady = false;
            }
        }

        refreshTheme() {
            if (this.visInputText || this.lastRenderedJson) {
                this.renderFromJson(this.lastRenderedJson || this.visInputText);
                return;
            }
            const currentData = this.app ? this.app.currentData : null;
            if (currentData && typeof currentData === 'object') {
                this.renderFromJson(currentData);
            }
        }

        toggleInputDrawer(forceOpen, options = {}) {
            const panel = this.getEl(this.ids.settingsPanel);
            const inputPanel = this.getEl(this.ids.inputPanel);
            const labelPanel = this.getEl(this.ids.labelPanel);
            if (!panel || !inputPanel) return;
            const isOpen = panel.classList.contains('is-open');
            const isActive = inputPanel.classList.contains('is-active');
            const next = typeof forceOpen === 'boolean' ? forceOpen : !(isOpen && isActive);
            const shouldFocus = options.focus !== false;
            if (!next) {
                const active = document.activeElement;
                if (active && panel.contains(active)) {
                    active.blur();
                }
            }
            panel.classList.toggle('is-open', next);
            panel.setAttribute('aria-hidden', next ? 'false' : 'true');
            panel.toggleAttribute('inert', !next);
            if (next) {
                inputPanel.classList.add('is-active');
                if (labelPanel) labelPanel.classList.remove('is-active');
            }
            this.updateDrawerLayout();
            if (next && shouldFocus) {
                const textarea = this.getEl(this.ids.inputTextarea);
                if (textarea) {
                    this.applyInputDraftToTextarea();
                    textarea.focus();
                    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
                }
                this.loadSavedList().then((list) => {
                    this.renderSavedSelect(list);
                });
            }
        }

        toggleLabelDrawer(forceOpen, options = {}) {
            const panel = this.getEl(this.ids.settingsPanel);
            const labelPanel = this.getEl(this.ids.labelPanel);
            const inputPanel = this.getEl(this.ids.inputPanel);
            if (!panel || !labelPanel) return;
            const isOpen = panel.classList.contains('is-open');
            const isActive = labelPanel.classList.contains('is-active');
            const next = typeof forceOpen === 'boolean' ? forceOpen : !(isOpen && isActive);
            const shouldFocus = options.focus !== false;
            if (!next) {
                const active = document.activeElement;
                if (active && panel.contains(active)) {
                    active.blur();
                }
            }
            panel.classList.toggle('is-open', next);
            panel.setAttribute('aria-hidden', next ? 'false' : 'true');
            panel.toggleAttribute('inert', !next);
            if (next) {
                labelPanel.classList.add('is-active');
                if (inputPanel) inputPanel.classList.remove('is-active');
            }
            this.updateDrawerLayout();
            if (next) {
                this.refreshLabelFieldOptions();
                if (shouldFocus) {
                    const input = this.getEl(this.ids.labelFieldInput);
                    if (input) {
                        input.value = '';
                        input.focus();
                        input.setSelectionRange(input.value.length, input.value.length);
                    }
                }
                this.renderLabelFieldChips();
                const slider = this.getEl(this.ids.labelFadeSlider);
                if (slider) slider.value = String(this.labelFade || 0);
                const minSlider = this.getEl(this.ids.labelMinSlider);
                if (minSlider) minSlider.value = String(this.labelMinCitations || 0);
                const minDimSlider = this.getEl(this.ids.labelMinDimSlider);
                if (minDimSlider) minDimSlider.value = String(this.labelMinDimAlpha ?? 0.2);
                const relatedMinSlider = this.getEl(this.ids.relatedMinSlider);
                if (relatedMinSlider) relatedMinSlider.value = String(this.relatedMinValue || 0);
                const relatedMinDimSlider = this.getEl(this.ids.relatedMinDimSlider);
                if (relatedMinDimSlider) relatedMinDimSlider.value = String(this.relatedMinDimAlpha ?? 0.2);
                const sizeSlider = this.getEl(this.ids.labelSizeSlider);
                if (sizeSlider) sizeSlider.value = String(Math.round((this.labelSizeScale || 1) * 100));
                const labelFontMinInput = this.getEl(this.ids.labelFontMinInput);
                const labelFontMaxInput = this.getEl(this.ids.labelFontMaxInput);
                const nodeSizeMinSlider = this.getEl(this.ids.nodeSizeMinSlider);
                const nodeSizeMaxSlider = this.getEl(this.ids.nodeSizeMaxSlider);
                const nodeSizeGammaSlider = this.getEl(this.ids.nodeSizeGammaSlider);
                const nodeColorInput = this.getEl(this.ids.nodeColorInput);
                const nodeBorderSlider = this.getEl(this.ids.nodeBorderSlider);
                const nodeBorderColorInput = this.getEl(this.ids.nodeBorderColorInput);
                const nodeOuterBorderWidthInput = this.getEl(this.ids.nodeOuterBorderWidthInput);
                const nodeOuterBorderColorInput = this.getEl(this.ids.nodeOuterBorderColorInput);
                const labelColorInput = this.getEl(this.ids.labelColorInput);
                const labelBgColorInput = this.getEl(this.ids.labelBgColorInput);
                const labelBorderColorInput = this.getEl(this.ids.labelBorderColorInput);
                const labelStrokeWidthInput = this.getEl(this.ids.labelStrokeWidthInput);
                const labelStrokeColorInput = this.getEl(this.ids.labelStrokeColorInput);
                const edgeColorInput = this.getEl(this.ids.edgeColorInput);
                const edgeLabelFontSizeInput = this.getEl(this.ids.edgeLabelFontSizeInput);
                const edgeLabelColorInput = this.getEl(this.ids.edgeLabelColorInput);
                const edgeLabelStrokeWidthInput = this.getEl(this.ids.edgeLabelStrokeWidthInput);
                const edgeLabelStrokeColorInput = this.getEl(this.ids.edgeLabelStrokeColorInput);
                const edgeLabelBgColorInput = this.getEl(this.ids.edgeLabelBgColorInput);
                const labelWeightSlider = this.getEl(this.ids.labelWeightSlider);
                const physicsSpringSlider = this.getEl(this.ids.physicsSpringSlider);
                const physicsStrengthSlider = this.getEl(this.ids.physicsStrengthSlider);
                const physicsGravitySlider = this.getEl(this.ids.physicsGravitySlider);
                const edgeFadeSlider = this.getEl(this.ids.edgeFadeSlider);
                const edgeMinWidthSlider = this.getEl(this.ids.edgeMinWidthSlider);
                const edgeMaxWidthSlider = this.getEl(this.ids.edgeMaxWidthSlider);
                if (labelFontMinInput) labelFontMinInput.value = String(this.labelFontMin ?? 9);
                if (labelFontMaxInput) labelFontMaxInput.value = String(this.labelFontMax ?? 30);
                if (nodeSizeMinSlider) nodeSizeMinSlider.value = String(this.nodeSizeMin || 1);
                if (nodeSizeMaxSlider) nodeSizeMaxSlider.value = String(this.nodeSizeMax || 60);
                if (nodeSizeGammaSlider) nodeSizeGammaSlider.value = String(this.nodeSizeGamma || 1);
                this.setColorInputValue(nodeColorInput, this.nodeColor || '#ffffff');
                if (nodeBorderSlider) nodeBorderSlider.value = String(this.nodeBorderWidth || 1.5);
                this.setColorInputValue(nodeBorderColorInput, this.nodeBorderColor || '#111111');
                if (nodeOuterBorderWidthInput) nodeOuterBorderWidthInput.value = String(this.nodeOuterBorderWidth ?? 2);
                this.setColorInputValue(nodeOuterBorderColorInput, this.nodeOuterBorderColor || '#ffffff');
                this.setColorInputValue(labelColorInput, this.labelColor || '#000000');
                this.setColorInputValue(labelBgColorInput, this.labelBgColor || '#f2f2f2f1');
                this.setColorInputValue(labelBorderColorInput, this.labelBorderColor || '#00000021');
                if (labelStrokeWidthInput) labelStrokeWidthInput.value = String(this.labelStrokeWidth ?? 0);
                this.setColorInputValue(labelStrokeColorInput, this.labelStrokeColor || '#ffffff');
                this.setColorInputValue(edgeColorInput, this.edgeColor || '#111111');
                if (edgeLabelFontSizeInput) edgeLabelFontSizeInput.value = String(this.edgeLabelFontSize ?? 12);
                this.setColorInputValue(edgeLabelColorInput, this.edgeLabelFontColor || '#111111');
                if (edgeLabelStrokeWidthInput) edgeLabelStrokeWidthInput.value = String(this.edgeLabelStrokeWidth ?? 0);
                this.setColorInputValue(edgeLabelStrokeColorInput, this.edgeLabelStrokeColor || '#ffffff');
                this.setColorInputValue(edgeLabelBgColorInput, this.edgeLabelBgColor || 'rgba(255,255,255,0.85)');
                if (labelWeightSlider) labelWeightSlider.value = String(this.labelWeight || 500);
                if (physicsSpringSlider) physicsSpringSlider.value = String(this.physicsSpringLength || 120);
                if (physicsStrengthSlider) physicsStrengthSlider.value = String(this.physicsSpringConstant || 0.05);
                if (physicsGravitySlider) physicsGravitySlider.value = String(this.physicsGravity || -9000);
                if (edgeFadeSlider) edgeFadeSlider.value = String(this.edgeFade || 100);
                if (edgeMinWidthSlider) edgeMinWidthSlider.value = String(this.edgeMinWidth || 1);
                if (edgeMaxWidthSlider) edgeMaxWidthSlider.value = String(this.edgeMaxWidth || 6);
            }
        }

        updateDrawerLayout() {
            const view = this.getEl(this.ids.view);
            if (!view) return;
            const settingsPanel = this.getEl(this.ids.settingsPanel);
            const hasOpen = !!(settingsPanel && settingsPanel.classList.contains('is-open'));
            view.classList.toggle('drawer-open', hasOpen);
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

        getWorkingJson() {
            const raw = this.visInputText || this.lastRenderedJson || null;
            if (!raw) return null;
            if (typeof raw === 'object') return raw;
            try {
                return JSON.parse(raw);
            } catch (_e) {
                return null;
            }
        }

        getCurrentViewData() {
            if (this.app && this.app.currentData && typeof this.app.currentData === 'object') {
                return this.app.currentData;
            }
            return this.getWorkingJson();
        }

        buildWosNodeIndex(data) {
            const index = new Map();
            if (!data || typeof data !== 'object') return index;
            Object.entries(data).forEach(([rootId, payload]) => {
                const rootKey = this.normalizeWosId(rootId);
                if (rootKey && payload && typeof payload === 'object') {
                    const list = index.get(rootKey) || [];
                    list.push({ type: 'root', obj: payload });
                    index.set(rootKey, list);
                }
                if (!payload || !Array.isArray(payload.page_wosids)) return;
                payload.page_wosids.forEach((node) => {
                    const nodeKey = this.normalizeWosId(node?.wosid);
                    if (!nodeKey || !node || typeof node !== 'object') return;
                    const list = index.get(nodeKey) || [];
                    list.push({ type: 'child', obj: node });
                    index.set(nodeKey, list);
                });
            });
            return index;
        }

        isWosGraphData(data) {
            if (!data || typeof data !== 'object') return false;
            return Object.values(data).some((item) => Array.isArray(item?.page_wosids));
        }

        getVisInputData() {
            const raw = this.visInputText || this.lastRenderedJson || null;
            if (!raw) return null;
            if (typeof raw === 'object') return raw;
            try {
                return JSON.parse(raw);
            } catch (_e) {
                return null;
            }
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
            if (this.labelFieldHistory.length === 0 || this.labelFieldHistory[this.labelFieldHistory.length - 1] !== next) {
                this.labelFieldHistory.push(next);
                if (this.labelFieldHistory.length > 100) {
                    this.labelFieldHistory = this.labelFieldHistory.slice(-100);
                }
            }
            this.labelFieldHistoryIndex = -1;
            if (!this.labelFieldsSelected.includes(next)) {
                this.labelFieldsSelected.push(next);
            }
            this.labelField = this.labelFieldsSelected.join(', ');
            this.queuePersistNetworkState();
            const input = this.getEl(this.ids.labelFieldInput);
            if (input) {
                input.value = '';
                input.focus();
            }
            const suggest = this.getEl(this.ids.labelSuggest);
            if (suggest) {
                suggest.style.display = 'none';
                suggest.innerHTML = '';
            }
            this.renderLabelFieldChips();
        }

        removeLabelField(field) {
            this.labelFieldsSelected = this.labelFieldsSelected.filter((item) => item !== field);
            this.labelField = this.labelFieldsSelected.join(', ');
            this.queuePersistNetworkState();
            this.renderLabelFieldChips();
            this.applyLabelField(this.labelField);
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

        applySingleNodeUpdate(item) {
            const wosId = this.normalizeWosId(item?.wosid);
            if (!wosId) return false;
            let data = this.getVisInputData();
            if (!this.isWosGraphData(data)) {
                data = this.getCurrentViewData();
            }
            if (!data || typeof data !== 'object') return false;
            if (!this.wosNodeIndex || this.wosNodeIndexSource !== data) {
                this.wosNodeIndex = this.buildWosNodeIndex(data);
                this.wosNodeIndexSource = data;
            }
            let updated = false;
            const refs = this.wosNodeIndex.get(wosId) || [];
            if (!refs.length) {
                console.warn('[WosVisManager] Update node index miss', {
                    wosId,
                    indexSize: this.wosNodeIndex.size
                });
            }
            refs.forEach((ref) => {
                const target = ref?.obj;
                if (!target || typeof target !== 'object') return;
                Object.keys(item).forEach((key) => {
                    if (key === 'wosid') return;
                    target[key] = item[key];
                });
                updated = true;
            });
            console.log('[WosVisManager] Update node result', { wosId, updated });
            if (!updated) return false;
            const textarea = this.getEl(this.ids.inputTextarea);
            const jsonText = JSON.stringify(data, null, 2);
            this.visInputText = jsonText;
            this.lastRenderedJson = jsonText;
            if (textarea && textarea.value) {
                textarea.value = jsonText;
            }
            this.renderFromJson(data);
            return true;
        }

        tryApplySingleNodeFromTextarea(textarea) {
            if (!textarea) return false;
            const raw = (textarea.value || '').trim();
            if (!raw || (!raw.startsWith('{') && !raw.startsWith('['))) {
                console.warn('[WosVisManager] Update node skipped: textarea not JSON.');
                return false;
            }
            let parsed = null;
            try {
                parsed = JSON.parse(raw);
            } catch (_e) {
                this.notify('Invalid JSON for update', 'error');
                return false;
            }
            let items = null;
            if (Array.isArray(parsed)) {
                items = parsed;
            } else if (parsed && typeof parsed === 'object') {
                if (!parsed.wosid) {
                    this.notify('Missing wosid for update', 'info');
                    return false;
                }
                if (Object.prototype.hasOwnProperty.call(parsed, 'page_wosids')) return false;
                items = [parsed];
            } else {
                return false;
            }
            if (!this.graphModel && global.WosGraphModel) {
                this.graphModel = new global.WosGraphModel({ source: null });
            }
            let base = this.graphModel?.source || null;
            if (!base) {
                let parsedLast = null;
                if (this.lastRenderedJson) {
                    try {
                        parsedLast = JSON.parse(this.lastRenderedJson);
                    } catch (_e) {
                        parsedLast = null;
                    }
                }
                base = parsedLast || this.getVisInputData() || this.getCurrentViewData();
                if (base && this.graphModel) {
                    this.graphModel.setSource(base);
                }
            }
            if (!base || !this.isWosGraphData(base) || !this.graphModel) {
                this.notify('No WOS data loaded', 'info');
                return false;
            }
            console.log('[WosVisManager] Update node input', parsed);
            const ok = this.graphModel.applyNodeUpdates(items);
            if (ok) {
                const visData = this.graphModel.buildVisData();
                const sourceJson = JSON.stringify(this.graphModel.source, null, 2);
                this.visInputText = sourceJson;
                this.lastRenderedJson = sourceJson;
                const inputTextarea = this.getEl(this.ids.inputTextarea);
                if (inputTextarea) {
                    inputTextarea.value = sourceJson;
                }
                this.renderFromVisData(visData, { sourceJson });
                this.notify('Node updated from input', 'success');
                return true;
            }
            this.notify('Node not found for update', 'info');
            return false;
        }

        async applyLabelField(field) {
            const ensuredData = await this.ensureCurrentViewDataLoaded();
            const fields = this.labelFieldsSelected.length
                ? Array.from(this.labelFieldsSelected)
                : this.parseLabelFields(field);
            const nextField = fields.join(', ');
            this.labelField = nextField;
            const data = ensuredData || this.getCurrentViewData();
            let nodeMap = this.ensureWosDataIndex(data);
            if (!nodeMap.size) {
                const hasWosInView = !!(data && typeof data === 'object' && Object.values(data).some((payload) => {
                    if (!payload) return false;
                    if (payload.wos_data && (payload.wos_data.wos_id || payload.wos_data.wosid)) return true;
                    if (!Array.isArray(payload.page_wosids)) return false;
                    return payload.page_wosids.some((item) => item?.wos_data && (item.wos_data.wos_id || item.wos_data.wosid));
                }));
                if (hasWosInView) {
                    console.warn('[WosVisManager] label index is empty. wos_data.wos_id not found in current view data. Falling back to file scan.');
                }
                nodeMap = await this.buildWosDataIndexForCurrentView();
            }
            if (!nodeMap.size) {
                console.warn('[WosVisManager] label index still empty after scan.', {
                    field: nextField,
                    currentFile: this.app?.currentFile,
                    currentView: this.app?.currentJsonView,
                    currentBase: this.app?.currentFileBase
                });
                this.scheduleLabelFieldRetry(nextField);
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

        async ensureCurrentViewDataLoaded() {
            const app = this.app;
            if (!app) return null;
            if (app.currentData && typeof app.currentData === 'object') return app.currentData;
            if (typeof app.readProjectFile !== 'function') return null;
            const view = app.currentJsonView || 'view1';
            let base = app.currentFileBase;
            let currentFile = app.currentFile;
            if (!base && typeof app.getLastSelectedFile === 'function') {
                const last = app.getLastSelectedFile();
                if (last) {
                    if (last.endsWith('.json')) {
                        const filename = last.split('/').pop() || last;
                        base = filename.replace(/\.json$/i, '');
                        currentFile = last;
                    } else {
                        base = last.replace(/\.json$/i, '');
                    }
                }
            }
            const candidates = [];
            if (currentFile) candidates.push(currentFile);
            if (base) candidates.push(`json/${view}/${base}.json`);
            try {
                for (const path of candidates) {
                    const data = await app.readProjectFile(path);
                    if (data && typeof data === 'object') {
                        app.currentData = data;
                        if (!app.currentFile) app.currentFile = path;
                        if (!app.currentFileBase) {
                            const filename = path.split('/').pop() || path;
                            app.currentFileBase = filename.replace(/\.json$/i, '');
                        }
                        return data;
                    }
                }
            } catch (_err) { }
            return null;
        }

        scheduleLabelFieldRetry(field) {
            if (this._labelRetryTimer || this._labelRetryCount >= 5) return;
            const app = this.app;
            if (!app) return;
            this._labelRetryCount += 1;
            this._labelRetryTimer = setTimeout(async () => {
                this._labelRetryTimer = null;
                await this.applyLabelField(field || this.labelField);
            }, 400 * this._labelRetryCount);
        }

        hasResolvedLabelValues() {
            const dataset = this.getNetworkNodesDataSet();
            if (!dataset) return false;
            const nodes = dataset.get();
            return nodes.some((node) => {
                const text = typeof node.hiddenLabel === 'string' ? node.hiddenLabel.trim() : '';
                return !!text && !node.labelMissingField;
            });
        }

        applyLabelSizeScale() {
            const dataset = this.getNetworkNodesDataSet();
            if (!dataset) return;
            const scale = Number.isFinite(this.labelSizeScale) ? this.labelSizeScale : 1;
            const range = scale - 1;
            const meta = this.visNetworkData?.meta || {};
            const minCitation = Number.isFinite(meta.minCitation) ? meta.minCitation : 0;
            const maxCitation = Number.isFinite(meta.maxCitation) ? meta.maxCitation : minCitation;
            let minFont = Number.isFinite(this.labelFontMin) ? this.labelFontMin : null;
            let maxFont = Number.isFinite(this.labelFontMax) ? this.labelFontMax : null;
            if (minFont != null && maxFont != null && maxFont < minFont) {
                const swap = minFont;
                minFont = maxFont;
                maxFont = swap;
            }
            const updates = dataset.get().map((node) => {
                const base = node.labelBaseSize
                    || node.labelStyle?.fontSize
                    || node.labelFontSize
                    || 12;
            const citations = Number.isFinite(parseNumber(node.citations_count))
                ? parseNumber(node.citations_count)
                : null;
                let factor = 1;
                if (citations != null && maxCitation > minCitation) {
                    const t = (citations - minCitation) / (maxCitation - minCitation);
                    const delta = (t - 0.5) * 2 * range;
                    factor = 1 + delta;
                }
                let next = Math.max(1, base * factor);
                if (minFont != null) next = Math.max(minFont, next);
                if (maxFont != null) next = Math.min(maxFont, next);
                return {
                    id: node.id,
                    labelBaseSize: base,
                    labelStyle: { ...(node.labelStyle || {}), fontSize: Number(next.toFixed(2)) }
                };
            });
            dataset.update(updates);
            this.updateLabelLayer();
        }

        applyLabelColor() {
            const dataset = this.getNetworkNodesDataSet();
            if (!dataset) return;
            const color = normalizeVisColor(this.labelColor || '#000000');
            const updates = dataset.get().map((node) => ({
                id: node.id,
                labelStyle: { ...(node.labelStyle || {}), textColor: color }
            }));
            dataset.update(updates);
            this.updateLabelLayer();
        }

        applyLabelBgColor() {
            const dataset = this.getNetworkNodesDataSet();
            if (!dataset) return;
            const color = normalizeVisColor(this.labelBgColor || '#f2f2f2f1');
            const updates = dataset.get().map((node) => ({
                id: node.id,
                labelStyle: { ...(node.labelStyle || {}), backgroundColor: color }
            }));
            dataset.update(updates);
            this.updateLabelLayer();
        }

        applyLabelBorderColor() {
            const dataset = this.getNetworkNodesDataSet();
            if (!dataset) return;
            const color = normalizeVisColor(this.labelBorderColor || '#00000021');
            const updates = dataset.get().map((node) => ({
                id: node.id,
                labelStyle: { ...(node.labelStyle || {}), borderColor: color }
            }));
            dataset.update(updates);
            this.updateLabelLayer();
        }

        applyLabelStrokeWidth() {
            const dataset = this.getNetworkNodesDataSet();
            if (!dataset) return;
            const width = Math.max(0, Number(this.labelStrokeWidth) || 0);
            const updates = dataset.get().map((node) => ({
                id: node.id,
                labelStyle: { ...(node.labelStyle || {}), strokeWidth: width }
            }));
            dataset.update(updates);
            this.updateLabelLayer();
        }

        applyLabelStrokeColor() {
            const dataset = this.getNetworkNodesDataSet();
            if (!dataset) return;
            const color = normalizeVisColor(this.labelStrokeColor || '#ffffff');
            const updates = dataset.get().map((node) => ({
                id: node.id,
                labelStyle: { ...(node.labelStyle || {}), strokeColor: color }
            }));
            dataset.update(updates);
            this.updateLabelLayer();
        }

        applyLabelWeight() {
            const dataset = this.getNetworkNodesDataSet();
            if (!dataset) return;
            const weight = Number(this.labelWeight);
            const next = Number.isFinite(weight) ? weight : 500;
            const updates = dataset.get().map((node) => ({
                id: node.id,
                labelStyle: { ...(node.labelStyle || {}), fontWeight: next }
            }));
            dataset.update(updates);
            this.updateLabelLayer();
        }

        applyLabelFade() {
            const dataset = this.getNetworkNodesDataSet();
            if (!dataset) return;
            const meta = this.visNetworkData?.meta || {};
            const minCitation = Number.isFinite(meta.minCitation) ? meta.minCitation : 0;
            const maxCitation = Number.isFinite(meta.maxCitation) ? meta.maxCitation : minCitation;
            const fade = (Number(this.labelFade) || 0) / 100;
            const lightRange = Math.round(60 + fade * 120);
            const darkMode = isDarkTheme();
            const updates = dataset.get().map((node) => {
            const citations = parseNumber(node.citations_count);
                const t = maxCitation > minCitation ? (citations - minCitation) / (maxCitation - minCitation) : 1;
                const k = Math.max(0, Math.min(1, t));
                const grayRaw = darkMode
                    ? Math.round(210 + (1 - k) * Math.min(50, lightRange * 0.4))
                    : Math.round(30 + (1 - k) * lightRange);
                const gray = Math.max(0, Math.min(255, grayRaw));
                const color = `rgb(${gray}, ${gray}, ${gray})`;
                return {
                    id: node.id,
                    labelStyle: { ...(node.labelStyle || {}), textColor: color }
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
            if (!Number.isFinite(parseNumber(node.citations_count))) {
                const value = this.labelValueMap.get(node.id);
                return value != null
                    ? { id: node.id, hiddenLabel: String(value), labelHidden: false }
                    : { id: node.id, labelHidden: false };
            }
            if (parseNumber(node.citations_count) < min) {
                return { id: node.id, labelHidden: true };
            }
                const value = this.labelValueMap.get(node.id) ?? node.labelValue ?? node.hiddenLabel ?? '';
                return { id: node.id, hiddenLabel: value, labelHidden: false };
            });
            dataset.update(updates);
            this.updateLabelLayer();
            this.applyLabelThresholdDimming();
        }

        applyLabelThresholdDimming() {
            if (!this.visNetwork) return;
            const dataset = this.visNetwork?.body?.data;
            if (!dataset?.nodes || !dataset?.edges) return;
            const min = Number.isFinite(this.labelMinCitations) ? this.labelMinCitations : 0;
            const dimAlpha = Number.isFinite(this.labelMinDimAlpha) ? this.labelMinDimAlpha : 0.2;
            const relatedMin = Number.isFinite(this.relatedMinValue) ? this.relatedMinValue : 0;
            const relatedDimAlpha = Number.isFinite(this.relatedMinDimAlpha) ? this.relatedMinDimAlpha : 0.2;
            const state = this._labelThresholdDimState || {
                baseNodeColors: new Map(),
                baseEdgeColors: new Map()
            };
            this._labelThresholdDimState = state;
            const nodes = dataset.nodes.get();
            const edges = dataset.edges.get();
            const hasLabelRule = min > 0 && dimAlpha < 1;
            const hasRelatedRule = relatedMin > 0 && relatedDimAlpha < 1;
            if (!hasLabelRule && !hasRelatedRule) {
                if (state.baseNodeColors.size || state.baseEdgeColors.size) {
                    const nodeUpdates = nodes.map((node) => ({
                        id: node.id,
                        color: state.baseNodeColors.get(node.id) || node.color
                    }));
                    const edgeUpdates = edges.map((edge) => ({
                        id: edge.id,
                        color: state.baseEdgeColors.get(edge.id) || edge.color
                    }));
                    dataset.nodes.update(nodeUpdates);
                    dataset.edges.update(edgeUpdates);
                    state.baseNodeColors.clear();
                    state.baseEdgeColors.clear();
                    this.markEdgeFocusDirty();
                    this.applyEdgeFocusDisplay();
                }
                return;
            }
            if (this._labelThresholdBaseDirty) {
                state.baseNodeColors.clear();
                state.baseEdgeColors.clear();
                this._labelThresholdBaseDirty = false;
            }
            nodes.forEach((node) => {
                if (!state.baseNodeColors.has(node.id)) {
                    state.baseNodeColors.set(node.id, cloneVisColor(node.color));
                }
            });
            edges.forEach((edge) => {
                if (!state.baseEdgeColors.has(edge.id)) {
                    state.baseEdgeColors.set(edge.id, cloneVisColor(edge.color));
                }
            });
            const lowNodes = new Set();
            const lowRelatedNodes = new Set();
            nodes.forEach((node) => {
                const citations = parseNumber(node.citations_count);
                if (!Number.isFinite(citations)) return;
                if (citations < min) lowNodes.add(node.id);
            });
            const lowEdges = new Set();
            const nodeHasStrongEdge = new Map();
            edges.forEach((edge) => {
                const related = getRelatedCount(edge);
                if (related < relatedMin) {
                    lowEdges.add(edge.id);
                } else {
                    nodeHasStrongEdge.set(edge.from, true);
                    nodeHasStrongEdge.set(edge.to, true);
                }
            });
            nodes.forEach((node) => {
                if (!nodeHasStrongEdge.get(node.id)) lowRelatedNodes.add(node.id);
            });
            const nodeUpdates = nodes.map((node) => {
                const baseColor = state.baseNodeColors.get(node.id) || node.color;
                let alpha = 1;
                if (hasLabelRule && lowNodes.has(node.id)) {
                    alpha = Math.min(alpha, dimAlpha);
                }
                if (hasRelatedRule && lowRelatedNodes.has(node.id)) {
                    alpha = Math.min(alpha, relatedDimAlpha);
                }
                const color = alpha < 1 ? fadeNodeColor(baseColor, alpha) : baseColor;
                return { id: node.id, color };
            });
            const edgeUpdates = edges.map((edge) => {
                const baseColor = state.baseEdgeColors.get(edge.id) || edge.color;
                let alpha = 1;
                if (hasLabelRule && (lowNodes.has(edge.from) || lowNodes.has(edge.to))) {
                    alpha = Math.min(alpha, dimAlpha);
                }
                if (hasRelatedRule && lowEdges.has(edge.id)) {
                    alpha = Math.min(alpha, relatedDimAlpha);
                }
                const color = alpha < 1 ? fadeEdgeColor(baseColor, alpha) : baseColor;
                return { id: edge.id, color };
            });
            dataset.nodes.update(nodeUpdates);
            dataset.edges.update(edgeUpdates);
            this.markEdgeFocusDirty();
            this.applyEdgeFocusDisplay();
        }

        applyNodeSizeScale() {
            const dataset = this.getNetworkNodesDataSet();
            if (!dataset) return;
            const meta = this.visNetworkData?.meta || {};
            const minCitation = Number.isFinite(meta.minCitation) ? meta.minCitation : 0;
            const maxCitation = Number.isFinite(meta.maxCitation) ? meta.maxCitation : minCitation;
            const minSize = Number.isFinite(Number(this.nodeSizeMin)) ? Number(this.nodeSizeMin) : 1;
            const maxSize = Number.isFinite(Number(this.nodeSizeMax)) ? Number(this.nodeSizeMax) : minSize + 1;
            const gamma = Number.isFinite(Number(this.nodeSizeGamma)) ? Number(this.nodeSizeGamma) : 1;
            const updates = dataset.get().map((node) => {
            const citations = parseNumber(node.citations_count);
                const t = maxCitation > minCitation ? (citations - minCitation) / (maxCitation - minCitation) : 0;
                const bounded = Math.max(0, Math.min(1, t));
                const eased = bounded === 0 ? 0 : Math.pow(bounded, gamma);
                const size = minSize + eased * (maxSize - minSize);
                return { id: node.id, size };
            });
            dataset.update(updates);
        }

        applyNodeBorderWidth() {
            const dataset = this.getNetworkNodesDataSet();
            if (!dataset) return;
            const meta = this.visNetworkData?.meta || {};
            const minCitation = Number.isFinite(meta.minCitation) ? meta.minCitation : 0;
            const maxCitation = Number.isFinite(meta.maxCitation) ? meta.maxCitation : minCitation;
            const base = Number.isFinite(Number(this.nodeBorderWidth)) ? Number(this.nodeBorderWidth) : 1.5;
            const range = Math.abs(base) * 2.2;
            const updates = dataset.get().map((node) => {
            const citations = parseNumber(node.citations_count);
                let t = maxCitation > minCitation ? (citations - minCitation) / (maxCitation - minCitation) : 0;
                t = Math.max(0, Math.min(1, t));
                const eased = Math.pow(t, 1.6);
                const width = base + eased * range;
                const selected = width + 0.8;
                return {
                    id: node.id,
                    borderWidth: Number(width.toFixed(2)),
                    borderWidthSelected: Number(selected.toFixed(2))
                };
            });
            dataset.update(updates);
        }

        applyNodeColor() {
            const dataset = this.getNetworkNodesDataSet();
            if (!dataset) return;
            this.restoreEdgeFocusBaseColors();
            const base = normalizeVisColor(this.nodeColor || '#ffffff');
            const border = normalizeVisColor(this.nodeBorderColor || base);
            const highlight = adjustColorAlpha(base, 0.12);
            const hover = adjustColorAlpha(base, 0.2);
            const updates = dataset.get().map((node) => ({
                id: node.id,
                color: {
                    background: base,
                    border,
                    highlight: { background: highlight, border },
                    hover: { background: hover, border }
                }
            }));
            dataset.update(updates);
            this.markEdgeFocusDirty();
            this.applyEdgeFocusDisplay();
            this._labelThresholdBaseDirty = true;
            this.applyLabelThresholdDimming();
        }

        applyNodeBorderColor() {
            const dataset = this.getNetworkNodesDataSet();
            if (!dataset) return;
            this.restoreEdgeFocusBaseColors();
            const border = normalizeVisColor(this.nodeBorderColor || '#111111');
            const updates = dataset.get().map((node) => ({
                id: node.id,
                color: { ...(node.color || {}), border }
            }));
            dataset.update(updates);
            this.markEdgeFocusDirty();
            this.applyEdgeFocusDisplay();
            this._labelThresholdBaseDirty = true;
            this.applyLabelThresholdDimming();
        }

        applyEdgeFade() {
            if (!this.visNetwork) return;
            const dataset = this.visNetwork?.body?.data?.edges;
            if (!dataset) return;
            this.restoreEdgeFocusBaseColors();
            const meta = this.visNetworkData?.meta || {};
            const minRelated = Number.isFinite(meta.minRelated) ? meta.minRelated : 0;
            const maxRelated = Number.isFinite(meta.maxRelated) ? meta.maxRelated : minRelated;
            const contrast = (Number(this.edgeFade) || 0) / 100;
            const minAlpha = 0.15 + (1 - contrast) * 0.2;
            const maxAlpha = 0.85 - (1 - contrast) * 0.2;
            const baseColor = normalizeVisColor(this.edgeColor);
            const darkMode = isDarkTheme();
            const updates = dataset.get().map((edge) => {
                const related = getRelatedCount(edge);
                const t = maxRelated > minRelated ? (related - minRelated) / (maxRelated - minRelated) : 0;
                const alphaRaw = minAlpha + Math.max(0, Math.min(1, t)) * (maxAlpha - minAlpha);
                const alpha = Math.max(0, Math.min(1, alphaRaw));
                if (baseColor) {
                    return {
                        id: edge.id,
                        color: {
                            color: applyAlphaToColor(baseColor, alpha),
                            highlight: applyAlphaToColor(baseColor, Math.min(1, alpha + 0.1)),
                            hover: applyAlphaToColor(baseColor, Math.min(1, alpha + 0.15))
                        }
                    };
                }
                return {
                    id: edge.id,
                    color: {
                        color: darkMode
                            ? `rgba(255,255,255,${alpha.toFixed(3)})`
                            : `rgba(0,0,0,${alpha.toFixed(3)})`,
                        highlight: darkMode
                            ? `rgba(255,255,255,${Math.min(1, alpha + 0.1).toFixed(3)})`
                            : `rgba(0,0,0,${Math.min(1, alpha + 0.1).toFixed(3)})`,
                        hover: darkMode
                            ? `rgba(255,255,255,${Math.min(1, alpha + 0.15).toFixed(3)})`
                            : `rgba(0,0,0,${Math.min(1, alpha + 0.15).toFixed(3)})`
                    }
                };
            });
            dataset.update(updates);
            this.markEdgeFocusDirty();
            this.applyEdgeFocusDisplay();
            this._labelThresholdBaseDirty = true;
            this.applyLabelThresholdDimming();
        }

        applyEdgeWidthRange() {
            if (!this.visNetwork) return;
            const dataset = this.visNetwork?.body?.data?.edges;
            if (!dataset) return;
            const meta = this.visNetworkData?.meta || {};
            const minRelated = Number.isFinite(meta.minRelated) ? meta.minRelated : 0;
            const maxRelated = Number.isFinite(meta.maxRelated) ? meta.maxRelated : minRelated;
            const minW = Number.isFinite(Number(this.edgeMinWidth)) ? Number(this.edgeMinWidth) : 1;
            const maxW = Number.isFinite(Number(this.edgeMaxWidth)) ? Number(this.edgeMaxWidth) : 6;
            const updates = dataset.get().map((edge) => {
                const related = getRelatedCount(edge);
                const t = maxRelated > minRelated ? (related - minRelated) / (maxRelated - minRelated) : 0;
                const width = minW + Math.max(0, Math.min(1, t)) * (maxW - minW);
                return { id: edge.id, width: Number(width.toFixed(2)) };
            });
            dataset.update(updates);
        }

        applyEdgeStyle() {
            if (!this.visNetwork) return;
            const dataset = this.visNetwork?.body?.data?.edges;
            if (!dataset) return;
            const style = this.edgeStyle || 'curve-dynamic';
            const isArrow = style === 'arrow';
            const isDashed = style === 'dashed';
            const isStraight = style === 'straight';
            const isCurve = style.startsWith('curve-');
            const updates = dataset.get().map((edge) => {
                const next = { id: edge.id };
                next.arrows = isArrow ? 'to' : null;
                next.dashes = isDashed ? [6, 6] : false;
                if (isStraight) {
                    next.smooth = false;
                } else if (isCurve) {
                    const curve = style.replace('curve-', '');
                    if (curve === 'dynamic') {
                        next.smooth = { type: 'dynamic', roundness: 0.25 };
                    } else if (curve === 'cw') {
                        next.smooth = { type: 'curvedCW', roundness: 0.25 };
                    } else if (curve === 'ccw') {
                        next.smooth = { type: 'curvedCCW', roundness: 0.25 };
                    } else if (curve === 'bezier') {
                        next.smooth = { type: 'continuous', roundness: 0.35 };
                    } else {
                        next.smooth = { type: 'dynamic', roundness: 0.25 };
                    }
                } else {
                    next.smooth = { type: 'dynamic', roundness: 0.25 };
                }
                return next;
            });
            dataset.update(updates);
            const edgesOptions = {
                smooth: isStraight
                    ? false
                    : isCurve
                        ? updates[0]?.smooth || { type: 'dynamic', roundness: 0.25 }
                        : { type: 'dynamic', roundness: 0.25 }
            };
            if (isArrow) {
                edgesOptions.arrows = 'to';
            }
            this.visNetwork.setOptions({ edges: edgesOptions });
        }

        getEdgeLabelText(edge) {
            if (!edge) return '';
            if (this._edgeBaseLabels && this._edgeBaseLabels.has(edge.id)) {
                const base = this._edgeBaseLabels.get(edge.id);
                if (base) return String(base);
            }
            const related = getRelatedCount(edge);
            if (!Number.isFinite(related) || related <= 0) return '';
            return String(related);
        }

        applyEdgeLabelDisplay() {
            if (!this.visNetwork) return;
            const dataset = this.visNetwork?.body?.data?.edges;
            if (!dataset) return;
            if (!this._edgeBaseLabels) this._edgeBaseLabels = new Map();
            if (!this._edgeBaseFonts) this._edgeBaseFonts = new Map();
            const state = this.getEdgeFocusState();
            const hoverEdgeId = state.hoverEdgeId;
            const lockedEdges = state.lockedEdgeIds || new Set();
            const hasLocked = lockedEdges.size > 0;
            const customActive = !!state.customFocusActive;
            const customEdges = state.customFocusEdges || new Set();
            const show = !!this.edgeLabelEnabled;
            const fontSize = Number.isFinite(this.edgeLabelFontSize) ? this.edgeLabelFontSize : 12;
            const fontColor = this.edgeLabelFontColor || '#111111';
            const strokeWidth = Number.isFinite(this.edgeLabelStrokeWidth) ? this.edgeLabelStrokeWidth : 0;
            const strokeColor = this.edgeLabelStrokeColor || '#ffffff';
            const bgColor = this.edgeLabelBgColor || 'rgba(255,255,255,0.85)';
            const updates = dataset.get().map((edge) => {
                if (!this._edgeBaseLabels.has(edge.id)) {
                    this._edgeBaseLabels.set(edge.id, edge.label || '');
                }
                if (!this._edgeBaseFonts.has(edge.id)) {
                    this._edgeBaseFonts.set(edge.id, edge.font || null);
                }
                const alpha = getEdgeColorAlpha(edge);
                const shouldShowLabel = show
                    && alpha > 0
                    && (!customActive || customEdges.has(edge.id))
                    && (customActive || !hasLocked || lockedEdges.has(edge.id))
                    && (customActive || !hoverEdgeId || edge.id === hoverEdgeId);
                const label = shouldShowLabel ? this.getEdgeLabelText(edge) : '';
                const font = shouldShowLabel
                    ? {
                        ...(edge.font || {}),
                        size: fontSize,
                        face: 'Times New Roman, Times, serif',
                        align: 'middle',
                        color: fontColor,
                        background: bgColor,
                        strokeWidth,
                        strokeColor
                    }
                    : {
                        ...(this._edgeBaseFonts.get(edge.id) || edge.font || {}),
                        size: 0
                    };
                return { id: edge.id, label, font };
            });
            dataset.update(updates);
            this.visNetwork.redraw();
        }

        updateEdgeLabelToggleButton() {
            const btn = this.getEl(this.ids.edgeLabelToggleBtn);
            if (!btn) return;
            const icon = btn.querySelector('i');
            const enabled = !!this.edgeLabelEnabled;
            const label = enabled ? 'Hide edge labels' : 'Show edge labels';
            if (icon) icon.className = 'fa-solid fa-link';
            btn.setAttribute('aria-label', label);
            btn.setAttribute('title', label);
            btn.classList.toggle('is-active', enabled);
        }

        toggleEdgeLabels() {
            this.edgeLabelEnabled = !this.edgeLabelEnabled;
            this.applyEdgeLabelDisplay();
            this.updateEdgeLabelToggleButton();
            this.queuePersistSettings();
        }

        getEdgeFocusState() {
            if (!this._edgeFocusState) {
                this._edgeFocusState = {
                    hoverEdgeId: null,
                    lastHoverEdgeId: null,
                    hoverNodeId: null,
                    lastHoverNodeId: null,
                    customFocusActive: false,
                    customFocusNodes: new Set(),
                    customFocusEdges: new Set(),
                    customFocusAlpha: null,
                    customFocusRootId: null,
                    customFocusDepth: null,
                    customFocusMap: new Map(),
                    customFocusDepthMap: new Map(),
                    lockedEdgeIds: new Set(),
                    baseNodeColors: new Map(),
                    baseEdgeColors: new Map(),
                    dirty: true
                };
            }
            return this._edgeFocusState;
        }

        markEdgeFocusDirty() {
            const state = this.getEdgeFocusState();
            state.dirty = true;
        }

        resetEdgeFocusState({ keepLocks = false, keepBaseColors = false } = {}) {
            const state = this.getEdgeFocusState();
            state.hoverEdgeId = null;
            state.lastHoverEdgeId = null;
            state.hoverNodeId = null;
            state.lastHoverNodeId = null;
            state.customFocusActive = false;
            state.customFocusNodes.clear();
            state.customFocusEdges.clear();
            state.customFocusAlpha = null;
            state.customFocusRootId = null;
            state.customFocusDepth = null;
            state.customFocusMap.clear();
            state.customFocusDepthMap.clear();
            if (this.visNetwork) {
                this.visNetwork._wosCustomFocusActive = false;
                this.visNetwork._wosCustomFocusNodes = null;
            }
            if (!keepLocks) state.lockedEdgeIds.clear();
            if (!keepBaseColors) {
                state.baseNodeColors.clear();
                state.baseEdgeColors.clear();
            }
            state.dirty = true;
            this.hideEdgeHoverLabels();
            this.closeEdgeContextMenu();
        }

        ensureEdgeHoverLabels(layer) {
            if (!layer) return null;
            let fromLabel = layer.querySelector('.vis-node-label.is-edge-hover[data-role="from"]');
            if (!fromLabel) {
                fromLabel = document.createElement('div');
                fromLabel.className = 'vis-node-label is-edge-hover';
                fromLabel.dataset.role = 'from';
                layer.appendChild(fromLabel);
            }
            let toLabel = layer.querySelector('.vis-node-label.is-edge-hover[data-role="to"]');
            if (!toLabel) {
                toLabel = document.createElement('div');
                toLabel.className = 'vis-node-label is-edge-hover';
                toLabel.dataset.role = 'to';
                layer.appendChild(toLabel);
            }
            return { fromLabel, toLabel };
        }

        showEdgeHoverLabels(edgeId) {
            if (!this.visNetwork) return;
            const dataset = this.visNetwork?.body?.data;
            if (!dataset?.edges || !dataset?.nodes) return;
            const edge = dataset.edges.get(edgeId);
            if (!edge) return;
            const fromNode = dataset.nodes.get(edge.from);
            const toNode = dataset.nodes.get(edge.to);
            if (!fromNode || !toNode) return;
            const view = this.getEl(this.ids.view);
            const layer = ensureLabelLayer(view);
            if (!layer) return;
            const labels = this.ensureEdgeHoverLabels(layer);
            if (!labels) return;
            const fromLabel = labels.fromLabel;
            const toLabel = labels.toLabel;
            fromLabel.textContent = fromNode.hiddenLabel || fromNode.label || fromNode.id || '';
            toLabel.textContent = toNode.hiddenLabel || toNode.label || toNode.id || '';
            applyEdgeHoverLabelStyle(fromLabel, fromNode);
            applyEdgeHoverLabelStyle(toLabel, toNode);
            fromLabel.dataset.nodeId = fromNode.id;
            toLabel.dataset.nodeId = toNode.id;
            positionLabel(this.visNetwork, fromLabel, fromNode.id);
            positionLabel(this.visNetwork, toLabel, toNode.id);
            fromLabel.classList.add('is-visible');
            toLabel.classList.add('is-visible');
            this._edgeHoverLabelState = { from: fromNode.id, to: toNode.id };
            this.bindEdgeHoverLabelUpdates();
        }

        hideEdgeHoverLabels() {
            const view = this.getEl(this.ids.view);
            const layer = ensureLabelLayer(view);
            if (!layer) return;
            const labels = layer.querySelectorAll('.vis-node-label.is-edge-hover');
            labels.forEach((label) => {
                label.classList.remove('is-visible');
            });
            this._edgeHoverLabelState = null;
        }

        updateEdgeHoverLabelPositions() {
            if (!this.visNetwork || !this._edgeHoverLabelState) return;
            const view = this.getEl(this.ids.view);
            const layer = ensureLabelLayer(view);
            if (!layer) return;
            const { from, to } = this._edgeHoverLabelState;
            const fromLabel = layer.querySelector('.vis-node-label.is-edge-hover[data-role="from"]');
            const toLabel = layer.querySelector('.vis-node-label.is-edge-hover[data-role="to"]');
            if (fromLabel && from) positionLabel(this.visNetwork, fromLabel, from);
            if (toLabel && to) positionLabel(this.visNetwork, toLabel, to);
        }

        bindEdgeHoverLabelUpdates() {
            if (!this.visNetwork) return;
            if (this._edgeHoverAfterDraw) return;
            this._edgeHoverAfterDraw = () => {
                this.updateEdgeHoverLabelPositions();
            };
            this.visNetwork.on('afterDrawing', this._edgeHoverAfterDraw);
        }

        restoreEdgeFocusBaseColors() {
            if (!this.visNetwork) return;
            const dataset = this.visNetwork?.body?.data;
            if (!dataset?.nodes || !dataset?.edges) return;
            const state = this.getEdgeFocusState();
            if (!state.baseNodeColors.size && !state.baseEdgeColors.size) return;
            const nodes = dataset.nodes.get();
            const edges = dataset.edges.get();
            const nodeUpdates = nodes.map((node) => ({
                id: node.id,
                color: state.baseNodeColors.get(node.id) || node.color
            }));
            const edgeUpdates = edges.map((edge) => ({
                id: edge.id,
                color: state.baseEdgeColors.get(edge.id) || edge.color
            }));
            dataset.nodes.update(nodeUpdates);
            dataset.edges.update(edgeUpdates);
        }

        applyEdgeFocusDisplay() {
            if (!this.visNetwork) return;
            const dataset = this.visNetwork?.body?.data;
            if (!dataset?.nodes || !dataset?.edges) return;
            const nodes = dataset.nodes.get();
            const edges = dataset.edges.get();
            const state = this.getEdgeFocusState();
            const hoverNodeId = state.hoverNodeId;
            const nodeFocusActive = !!hoverNodeId;
            const activeEdges = new Set(state.lockedEdgeIds);
            if (!nodeFocusActive && state.hoverEdgeId) activeEdges.add(state.hoverEdgeId);
            if (state.dirty) {
                if (activeEdges.size && (state.baseNodeColors.size || state.baseEdgeColors.size)) {
                    const nodeUpdates = nodes.map((node) => ({
                        id: node.id,
                        color: state.baseNodeColors.get(node.id) || node.color
                    }));
                    const edgeUpdates = edges.map((edge) => ({
                        id: edge.id,
                        color: state.baseEdgeColors.get(edge.id) || edge.color
                    }));
                    dataset.nodes.update(nodeUpdates);
                    dataset.edges.update(edgeUpdates);
                }
                state.baseNodeColors.clear();
                state.baseEdgeColors.clear();
                nodes.forEach((node) => {
                    state.baseNodeColors.set(node.id, cloneVisColor(node.color));
                });
                edges.forEach((edge) => {
                    state.baseEdgeColors.set(edge.id, cloneVisColor(edge.color));
                });
                state.dirty = false;
            }
            if (state.customFocusActive) {
                this.applyCustomFocusDisplay(state, nodes, edges, dataset);
                return;
            }
            if (nodeFocusActive) {
                const targetDepth = state.customFocusDepthMap && state.customFocusDepthMap.has(hoverNodeId)
                    ? state.customFocusDepthMap.get(hoverNodeId)
                    : (Number.isFinite(state.customFocusDepth) ? state.customFocusDepth : 1);
                const dimAlpha = Number.isFinite(state.customFocusAlpha)
                    ? Math.max(0, Math.min(1, state.customFocusAlpha))
                    : this.edgeFocusFadeAlpha;
                const activeNodes = new Set();
                const adj = new Map();
                edges.forEach((edge) => {
                    if (edge.from == null || edge.to == null) return;
                    const from = edge.from;
                    const to = edge.to;
                    if (!adj.has(from)) adj.set(from, new Set());
                    if (!adj.has(to)) adj.set(to, new Set());
                    adj.get(from).add(to);
                    adj.get(to).add(from);
                });
                const visited = new Set([hoverNodeId]);
                const queue = [{ id: hoverNodeId, depth: 0 }];
                while (queue.length) {
                    const { id, depth: d } = queue.shift();
                    activeNodes.add(id);
                    if (d >= targetDepth) continue;
                    const neighbors = adj.get(id);
                    if (!neighbors) continue;
                    neighbors.forEach((next) => {
                        if (visited.has(next)) return;
                        visited.add(next);
                        queue.push({ id: next, depth: d + 1 });
                    });
                }
                const focusEdges = new Set();
                edges.forEach((edge) => {
                    if (activeNodes.has(edge.from) && activeNodes.has(edge.to)) {
                        focusEdges.add(edge.id);
                    }
                });
                const nodeUpdates = nodes.map((node) => {
                    const baseColor = state.baseNodeColors.get(node.id) || node.color;
                    const color = activeNodes.has(node.id)
                        ? fadeNodeColor(baseColor, 1)
                        : fadeNodeColor(baseColor, dimAlpha);
                    return { id: node.id, color };
                });
                const edgeUpdates = edges.map((edge) => {
                    const baseColor = state.baseEdgeColors.get(edge.id) || edge.color;
                    const color = focusEdges.has(edge.id)
                        ? fadeEdgeColor(baseColor, 1)
                        : fadeEdgeColor(baseColor, dimAlpha);
                    return { id: edge.id, color };
                });
                dataset.nodes.update(nodeUpdates);
                dataset.edges.update(edgeUpdates);
                this.applyEdgeFocusLabelDisplay(activeNodes);
                this.applyEdgeLabelDisplay();
                return;
            }
            if (!activeEdges.size) {
                const nodeUpdates = nodes.map((node) => ({
                    id: node.id,
                    color: state.baseNodeColors.get(node.id) || node.color
                }));
                const edgeUpdates = edges.map((edge) => ({
                    id: edge.id,
                    color: state.baseEdgeColors.get(edge.id) || edge.color
                }));
                dataset.nodes.update(nodeUpdates);
                dataset.edges.update(edgeUpdates);
                this.applyEdgeFocusLabelDisplay(null);
                this.applyEdgeLabelDisplay();
                return;
            }
            const activeNodes = new Set();
            edges.forEach((edge) => {
                if (!activeEdges.has(edge.id)) return;
                if (edge.from != null) activeNodes.add(edge.from);
                if (edge.to != null) activeNodes.add(edge.to);
            });
            const nodeDimAlpha = this.edgeFocusFadeAlpha;
            const edgeDimAlpha = this.edgeFocusFadeAlpha;
            const nodeUpdates = nodes.map((node) => {
                const baseColor = state.baseNodeColors.get(node.id) || node.color;
                const color = activeNodes.has(node.id)
                    ? fadeNodeColor(baseColor, 1)
                    : fadeNodeColor(baseColor, nodeDimAlpha);
                return { id: node.id, color };
            });
            const edgeUpdates = edges.map((edge) => {
                const baseColor = state.baseEdgeColors.get(edge.id) || edge.color;
                const color = activeEdges.has(edge.id)
                    ? fadeEdgeColor(baseColor, 1)
                    : fadeEdgeColor(baseColor, edgeDimAlpha);
                return { id: edge.id, color };
            });
            dataset.nodes.update(nodeUpdates);
            dataset.edges.update(edgeUpdates);
            this.applyEdgeFocusLabelDisplay(activeNodes);
            this.applyEdgeLabelDisplay();
        }

        applyCustomFocusDisplay(state, nodes, edges, dataset) {
            const activeNodes = state.customFocusNodes || new Set();
            const activeEdges = state.customFocusEdges || new Set();
            const dimAlpha = Number.isFinite(state.customFocusAlpha)
                ? Math.max(0, Math.min(1, state.customFocusAlpha))
                : this.edgeFocusFadeAlpha;
            const nodeUpdates = nodes.map((node) => {
                const baseColor = state.baseNodeColors.get(node.id) || node.color;
                const color = activeNodes.has(node.id)
                    ? fadeNodeColor(baseColor, 1)
                    : fadeNodeColor(baseColor, dimAlpha);
                return { id: node.id, color };
            });
            const edgeUpdates = edges.map((edge) => {
                const baseColor = state.baseEdgeColors.get(edge.id) || edge.color;
                const color = activeEdges.has(edge.id)
                    ? fadeEdgeColor(baseColor, 1)
                    : fadeEdgeColor(baseColor, dimAlpha);
                return { id: edge.id, color };
            });
            dataset.nodes.update(nodeUpdates);
            dataset.edges.update(edgeUpdates);
            this.applyEdgeFocusLabelDisplay(activeNodes);
            this.applyEdgeLabelDisplay();
        }

        applyEdgeFocusLabelDisplay(activeNodes) {
            const view = this.getEl(this.ids.view);
            const layer = ensureLabelLayer(view);
            if (!layer) return;
            const nodeDataset = this.visNetwork?.body?.data?.nodes;
            const labels = Array.from(layer.querySelectorAll('.vis-node-label'));
            const dimAlpha = this.edgeFocusFadeAlpha;
            const state = this.getEdgeFocusState();
            labels.forEach((label) => {
                if (!label) return;
                if (label.classList.contains('is-edge-hover')) {
                    label.style.opacity = '1';
                    return;
                }
                if (label.classList.contains('is-hover')) {
                    if (!activeNodes) {
                        if (label.dataset.baseOpacity != null) {
                            label.style.opacity = label.dataset.baseOpacity;
                            delete label.dataset.baseOpacity;
                        }
                    } else {
                        label.style.opacity = '1';
                    }
                    return;
                }
                const nodeId = label.dataset.nodeId;
                if (!nodeId) return;
                if (nodeDataset && typeof nodeDataset.get === 'function') {
                    const node = nodeDataset.get(nodeId);
                    if (node && getNodeAlpha(node) <= 0) {
                        if (label.dataset.baseOpacity == null) {
                            label.dataset.baseOpacity = label.style.opacity || '1';
                        }
                        label.style.opacity = '0';
                        return;
                    }
                }
                if (!activeNodes) {
                    if (label.dataset.baseOpacity != null) {
                        label.style.opacity = label.dataset.baseOpacity;
                        delete label.dataset.baseOpacity;
                    }
                    return;
                }
                if (label.dataset.baseOpacity == null) {
                    label.dataset.baseOpacity = label.style.opacity || '1';
                }
                if (activeNodes.has(nodeId)) {
                    label.style.opacity = label.dataset.baseOpacity || '1';
                } else {
                    if (state.customFocusActive) {
                        label.style.opacity = '0';
                    } else {
                        label.style.opacity = String(dimAlpha);
                    }
                }
            });
        }

        setEdgeHover(edgeId) {
            const state = this.getEdgeFocusState();
            state.hoverEdgeId = edgeId || null;
            if (edgeId && this.edgeHoverLabelEnabled) {
                this.showEdgeHoverLabels(edgeId);
            } else {
                this.hideEdgeHoverLabels();
            }
            this.applyEdgeFocusDisplay();
        }

        clearEdgeHover() {
            this.setEdgeHover(null);
        }

        setNodeHover(nodeId) {
            const state = this.getEdgeFocusState();
            state.hoverNodeId = nodeId || null;
            this.applyEdgeFocusDisplay();
        }

        clearNodeHover() {
            this.setNodeHover(null);
        }

        clearCustomFocusLock() {
            const state = this.getEdgeFocusState();
            if (!state.customFocusActive) return;
            this.restoreEdgeFocusBaseColors();
            state.customFocusActive = false;
            state.customFocusNodes.clear();
            state.customFocusEdges.clear();
            state.customFocusRootId = null;
            if (this.visNetwork) {
                this.visNetwork._wosCustomFocusActive = false;
                this.visNetwork._wosCustomFocusNodes = null;
            }
            state.dirty = true;
            this.applyEdgeFocusDisplay();
        }

        isEdgeLocked(edgeId) {
            const state = this.getEdgeFocusState();
            return state.lockedEdgeIds.has(edgeId);
        }

        toggleEdgeLock(edgeId) {
            if (!edgeId) return;
            const state = this.getEdgeFocusState();
            if (state.lockedEdgeIds.has(edgeId)) {
                state.lockedEdgeIds.delete(edgeId);
            } else {
                state.lockedEdgeIds.add(edgeId);
            }
            this.applyEdgeFocusDisplay();
        }

        closeEdgeContextMenu() {
            const menu = this._edgeContextMenu?.menuEl || document.querySelector('.context-menu');
            if (menu) {
                if (menu._edgeClickHandler) document.removeEventListener('mousedown', menu._edgeClickHandler);
                if (menu._edgeKeyHandler) document.removeEventListener('keydown', menu._edgeKeyHandler);
                menu.remove();
            }
            this._edgeContextMenu = null;
        }

        closeNodeContextMenu() {
            const menu = this._nodeContextMenu?.menuEl || document.querySelector('.context-menu.node-menu');
            if (menu) {
                if (menu._nodeClickHandler) document.removeEventListener('mousedown', menu._nodeClickHandler);
                if (menu._nodeKeyHandler) document.removeEventListener('keydown', menu._nodeKeyHandler);
                menu.remove();
            }
            this._nodeContextMenu = null;
        }

        showEdgeContextMenu(e, edgeId) {
            if (!edgeId || !e) return;
            this.closeNodeContextMenu();
            this.closeEdgeContextMenu();
            const menu = document.createElement('div');
            menu.className = 'context-menu';
            menu.style.left = `${e.pageX}px`;
            menu.style.top = `${e.pageY}px`;
            const isLocked = this.isEdgeLocked(edgeId);
            const isLabelEnabled = !!this.edgeHoverLabelEnabled;
            const fadePercent = Math.round((Number(this.edgeFocusFadeAlpha) || 0) * 100);
            menu.innerHTML = `
                <div class="context-menu-item" data-action="toggleEdgeLock">
                    <i class="fas ${isLocked ? 'fa-unlock' : 'fa-lock'}"></i>
                    ${isLocked ? 'Unlock Edge' : 'Lock Edge'}
                </div>
                <div class="context-menu-item" data-action="toggleEdgeHoverLabels">
                    <i class="fas ${isLabelEnabled ? 'fa-eye' : 'fa-eye-slash'}"></i>
                    ${isLabelEnabled ? 'Hide Edge Labels' : 'Show Edge Labels'}
                </div>
                <div class="context-menu-item" data-action="restoreEdgeFocus">
                    <i class="fas fa-rotate-left"></i>
                    Restore Edge Style
                </div>
                <div class="context-menu-divider"></div>
                <div class="context-menu-item context-menu-slider" data-action="edgeFadeAlpha">
                    <span>Opacity</span>
                    <input type="range" min="0" max="100" step="1" value="${fadePercent}" />
                    <span class="context-menu-value">${fadePercent}%</span>
                </div>
            `;
            document.body.appendChild(menu);
            const rect = menu.getBoundingClientRect();
            const margin = 8;
            let nextLeft = rect.left;
            let nextTop = rect.top;
            if (rect.right > window.innerWidth - margin) {
                nextLeft = window.innerWidth - rect.width - margin;
            }
            if (rect.bottom > window.innerHeight - margin) {
                nextTop = window.innerHeight - rect.height - margin;
            }
            menu.style.left = `${Math.max(margin, nextLeft)}px`;
            menu.style.top = `${Math.max(margin, nextTop)}px`;
            menu.querySelectorAll('.context-menu-item').forEach((item) => {
                item.addEventListener('click', () => {
                    const action = item.dataset.action;
                    if (action === 'toggleEdgeLock') {
                        this.toggleEdgeLock(edgeId);
                    }
                    if (action === 'toggleEdgeHoverLabels') {
                        this.edgeHoverLabelEnabled = !this.edgeHoverLabelEnabled;
                        if (this.edgeHoverLabelEnabled) {
                            this.showEdgeHoverLabels(edgeId);
                        } else {
                            this.hideEdgeHoverLabels();
                        }
                        this.queuePersistSettings();
                    }
                    if (action === 'restoreEdgeFocus') {
                        this.restoreEdgeFocusBaseColors();
                        this.resetEdgeFocusState({ keepLocks: false, keepBaseColors: true });
                        this.applyEdgeFocusDisplay();
                        this.queuePersistSettings();
                    }
                    if (action !== 'edgeFadeAlpha') {
                        this.closeEdgeContextMenu();
                    }
                });
            });
            const sliderWrap = menu.querySelector('.context-menu-item.context-menu-slider');
            const slider = sliderWrap ? sliderWrap.querySelector('input[type="range"]') : null;
            const sliderValue = sliderWrap ? sliderWrap.querySelector('.context-menu-value') : null;
            if (slider) {
                slider.addEventListener('input', (ev) => {
                    const raw = Number(ev.target.value);
                    const value = Number.isFinite(raw) ? raw : 0;
                    if (sliderValue) sliderValue.textContent = `${value}%`;
                    this.edgeFocusFadeAlpha = Math.max(0, Math.min(1, value / 100));
                    this.applyEdgeFocusDisplay();
                });
                slider.addEventListener('mousedown', (ev) => ev.stopPropagation());
                slider.addEventListener('click', (ev) => ev.stopPropagation());
            }
            const clickOutside = (ev) => {
                if (!menu.contains(ev.target)) this.closeEdgeContextMenu();
            };
            const keyHandler = (ev) => {
                if (ev.key === 'Escape') this.closeEdgeContextMenu();
            };
            menu._edgeClickHandler = clickOutside;
            menu._edgeKeyHandler = keyHandler;
            document.addEventListener('mousedown', clickOutside);
            document.addEventListener('keydown', keyHandler);
            this._edgeContextMenu = { menuEl: menu, edgeId };
        }

        showNodeContextMenu(e, nodeId) {
            if (!nodeId || !e) return;
            this.closeEdgeContextMenu();
            this.closeNodeContextMenu();
            const menu = document.createElement('div');
            menu.className = 'context-menu node-menu';
            menu.style.left = `${e.pageX}px`;
            menu.style.top = `${e.pageY}px`;
            const state = this.getEdgeFocusState();
            const depthValue = state.customFocusDepthMap && state.customFocusDepthMap.has(nodeId)
                ? state.customFocusDepthMap.get(nodeId)
                : (Number.isFinite(state.customFocusDepth) ? state.customFocusDepth : 1);
            const fadePercent = Math.round((Number(this.edgeFocusFadeAlpha) || 0) * 100);
            menu.innerHTML = `
                <div class="context-menu-item" data-action="selectNodeFocus">
                    <i class="fas fa-bullseye"></i>
                    Select Node
                </div>
                <div class="context-menu-item" data-action="unselectNode">
                    <i class="fas fa-circle-xmark"></i>
                    Unselect Node
                </div>
                <div class="context-menu-item" data-action="unlockDepthFocus">
                    <i class="fas fa-rotate-left"></i>
                    Release
                </div>
                <div class="context-menu-divider"></div>
                <div class="context-menu-item context-menu-slider" data-action="nodeFadeAlpha">
                    <span>Opacity</span>
                    <input type="range" min="0" max="100" step="1" value="${fadePercent}" />
                    <span class="context-menu-value">${fadePercent}%</span>
                </div>
                <div class="context-menu-item context-menu-slider" data-action="nodeDepth">
                    <span>Depth</span>
                    <input type="range" min="0" max="10" step="1" value="${depthValue}" />
                    <span class="context-menu-value">${depthValue}</span>
                </div>
            `;
            document.body.appendChild(menu);
            const rect = menu.getBoundingClientRect();
            const margin = 8;
            let nextLeft = rect.left;
            let nextTop = rect.top;
            if (rect.right > window.innerWidth - margin) {
                nextLeft = window.innerWidth - rect.width - margin;
            }
            if (rect.bottom > window.innerHeight - margin) {
                nextTop = window.innerHeight - rect.height - margin;
            }
            menu.style.left = `${Math.max(margin, nextLeft)}px`;
            menu.style.top = `${Math.max(margin, nextTop)}px`;
            menu.querySelectorAll('.context-menu-item').forEach((item) => {
                item.addEventListener('click', () => {
                    const action = item.dataset.action;
                    if (action === 'selectNodeFocus') {
                        if (this.visNetwork) {
                            const selected = this.visNetwork.getSelectedNodes?.() || [];
                            if (!selected.includes(nodeId)) {
                                this.visNetwork.selectNodes([...selected, nodeId]);
                            }
                        }
                        const state = this.getEdgeFocusState();
                        const depth = state.customFocusDepthMap && state.customFocusDepthMap.has(nodeId)
                            ? state.customFocusDepthMap.get(nodeId)
                            : (Number.isFinite(state.customFocusDepth) ? state.customFocusDepth : 1);
                        this.applyDepthFocusForNode(nodeId, depth, this.edgeFocusFadeAlpha);
                        this.closeNodeContextMenu();
                        return;
                    }
                    if (action === 'unselectNode') {
                        if (this.visNetwork) {
                            const selected = this.visNetwork.getSelectedNodes?.() || [];
                            const next = selected.filter((id) => id !== nodeId);
                            if (next.length) {
                                this.visNetwork.selectNodes(next);
                            } else {
                                this.visNetwork.unselectAll();
                            }
                        }
                        this.closeNodeContextMenu();
                        return;
                    }
                    if (action === 'unlockDepthFocus') {
                        this.clearCustomFocusLock();
                        this.closeNodeContextMenu();
                    }
                });
            });
            const sliders = menu.querySelectorAll('.context-menu-item.context-menu-slider');
            sliders.forEach((wrap) => {
                const slider = wrap.querySelector('input[type="range"]');
                const valueEl = wrap.querySelector('.context-menu-value');
                if (!slider) return;
                slider.addEventListener('input', (ev) => {
                    const raw = Number(ev.target.value);
                    const value = Number.isFinite(raw) ? raw : 0;
                    if (valueEl) valueEl.textContent = String(value) + (wrap.dataset.action === 'nodeFadeAlpha' ? '%' : '');
                    if (wrap.dataset.action === 'nodeFadeAlpha') {
                        const nextAlpha = Math.max(0, Math.min(1, value / 100));
                        this.edgeFocusFadeAlpha = nextAlpha;
                        const state = this.getEdgeFocusState();
                        if (state.customFocusActive) {
                            state.customFocusAlpha = nextAlpha;
                        }
                        this.applyEdgeFocusDisplay();
                        return;
                    }
                    if (wrap.dataset.action === 'nodeDepth') {
                        this.applyDepthFocusForNode(nodeId, value);
                    }
                });
                slider.addEventListener('mousedown', (ev) => ev.stopPropagation());
                slider.addEventListener('click', (ev) => ev.stopPropagation());
            });
            const clickOutside = (ev) => {
                if (!menu.contains(ev.target)) this.closeNodeContextMenu();
            };
            const keyHandler = (ev) => {
                if (ev.key === 'Escape') this.closeNodeContextMenu();
            };
            menu._nodeClickHandler = clickOutside;
            menu._nodeKeyHandler = keyHandler;
            document.addEventListener('mousedown', clickOutside);
            document.addEventListener('keydown', keyHandler);
            this._nodeContextMenu = { menuEl: menu, nodeId };
        }

        applyLabelShowAll(showAll) {
            if (!this.visNetwork) {
                return;
            }
            const state = this.visNetwork._wosLabelState || { showAll: false };
            if (state.showAll === showAll) {
                if (showAll) {
                    const dataset = this.visNetwork?.body?.data;
                    const view = this.getEl(this.ids.view);
                    if (dataset && view) {
                        applyLabelVisibility(dataset, true, this.visNetwork, ensureLabelLayer(view));
                    }
                }
                return;
            }
            const btn = this.getEl(this.ids.labelToggleBtn);
            if (btn) {
                btn.click();
                return;
            }
            // fallback: mark state and refresh labels on next toggle
            state.showAll = showAll;
            this.visNetwork._wosLabelState = state;
        }

        applyPhysicsSettings() {
            if (!this.visNetwork) return;
            this.visNetwork.setOptions({
                physics: {
                    enabled: true,
                    solver: 'barnesHut',
                    barnesHut: {
                        springLength: this.physicsSpringLength,
                        springConstant: this.physicsSpringConstant,
                        gravitationalConstant: this.physicsGravity
                    }
                }
            });
        }

        restoreLabelDefaults() {
            this.physicsSpringLength = 198;
            this.physicsSpringConstant = 0.15;
            this.physicsGravity = -1100;
            this.nodeSizeMin = 4.5;
            this.nodeSizeMax = 40;
            this.nodeSizeGamma = 0.35;
            this.nodeColor = '#f7f7f7ff';
            this.nodeBorderWidth = 1.8;
            this.nodeBorderColor = '#303030ff';
            this.nodeOuterBorderWidth = 4.9;
            this.nodeOuterBorderColor = '#ffffffb2';
            this.edgeMinWidth = 3.0;
            this.edgeMaxWidth = 14.5;
            this.edgeFade = 39;
            this.edgeColor = '#1a1a1aff';
            this.edgeLabelFontSize = 12;
            this.edgeLabelFontColor = '#1a1a1aff';
            this.edgeLabelStrokeWidth = 0;
            this.edgeLabelStrokeColor = '#ffffff';
            this.edgeLabelBgColor = 'rgba(255,255,255,0.85)';
            this.labelFontMin = 5;
            this.labelFontMax = 23;
            this.labelSizeScale = 1.37;
            this.labelWeight = 1300;
            this.labelFade = 0;
            this.labelColor = '#000000ff';
            this.labelBgColor = '#fafafaff';
            this.labelBorderColor = '#dbdbdbff';
            this.labelStrokeWidth = 0;
            this.labelStrokeColor = '#ffffff';
            this.labelMinCitations = 0;
            this.labelMinDimAlpha = 0.2;
            this.relatedMinValue = 0;
            this.relatedMinDimAlpha = 0.2;

            this.applyLabelFade();
            this.applyLabelSizeScale();
            this.applyLabelWeight();
            this.applyLabelBgColor();
            this.applyLabelBorderColor();
            this.applyLabelThreshold();
            this.applyNodeSizeScale();
            this.applyNodeBorderWidth();
            this.applyPhysicsSettings();
            this.applyEdgeFade();
            this.applyEdgeWidthRange();
            this.applyEdgeLabelDisplay();
            if (this.visNetwork) this.visNetwork.redraw();
            this.syncSettingsSliders();
            this.queuePersistSettings();
        }

        applyAutoLabelTuning() {
            const view = this.getEl(this.ids.view);
            const dataset = this.getNetworkNodesDataSet();
            if (!view || !dataset) return;
            const rect = view.getBoundingClientRect();
            const area = Math.max(1, rect.width * rect.height);
            const nodes = dataset.get();
            const count = nodes.length || 1;
            const edges = this.visNetwork?.body?.data?.edges?.get()?.length || 0;
            const density = count / area;
            const avgDegree = count ? (edges * 2) / count : 0;
            const scale = this.visNetwork ? this.visNetwork.getScale() : 1;

            const meta = this.visNetworkData?.meta || {};
            const maxCitation = Number.isFinite(meta.maxCitation) ? meta.maxCitation : 0;

            const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
            const norm = clamp(Math.log10(count + 10) / 3, 0, 1);
            const dense = clamp(density * 15000, 0, 1);
            const degree = clamp(avgDegree / 8, 0, 1);
            const zoom = clamp(scale / 1.2, 0.6, 1.4);

            // Heuristics tuned by size, density, and connectivity
            const sizeMin = Math.round(clamp(7 - 3.5 * norm - 2.5 * dense, 3, 8));
            const sizeMax = Math.round(clamp(58 - 18 * norm - 14 * dense - 6 * degree, 18, 64));
            const gamma = clamp(1.0 + 0.7 * dense + 0.4 * degree, 0.9, 2.0);
            const border = clamp(1.2 + 0.9 * (1 - dense) + 0.3 * (1 - degree), 1.0, 2.6);
            const labelScale = clamp(1.1 - 0.25 * dense - 0.2 * degree, 0.75, 1.15) * zoom;
            const fade = Math.round(clamp(35 + 45 * dense + 15 * degree, 20, 85));
            const minCite = maxCitation > 0
                ? Math.round(maxCitation * clamp(0.08 + 0.25 * dense + 0.12 * degree, 0.05, 0.45))
                : 0;

            this.nodeSizeMin = sizeMin;
            this.nodeSizeMax = sizeMax;
            this.nodeSizeGamma = gamma;
            this.nodeBorderWidth = border;
            this.labelSizeScale = labelScale;
            this.labelFade = fade;
            this.labelMinCitations = minCite;
            this.labelWeight = density > 0.00006 ? 500 : density > 0.00002 ? 550 : 600;
            this.physicsSpringLength = Math.round(clamp(160 - 60 * dense - 30 * degree, 70, 180));
            this.physicsSpringConstant = Number(clamp(0.04 + 0.06 * dense + 0.03 * degree, 0.03, 0.12).toFixed(2));
            this.physicsGravity = Math.round(clamp(-7000 - 6000 * dense - 2000 * degree, -16000, -5000));
            this.edgeFade = Math.round(clamp(100 - 20 * dense, 70, 100));
            this.edgeMinWidth = Number(clamp(1 - 0.25 * dense, 0.6, 1.2).toFixed(2));
            this.edgeMaxWidth = Number(clamp(6 - 1.8 * dense - 0.8 * degree, 3.5, 7).toFixed(2));

            const nodeSizeMinSlider = this.getEl(this.ids.nodeSizeMinSlider);
            const nodeSizeMaxSlider = this.getEl(this.ids.nodeSizeMaxSlider);
            const nodeSizeGammaSlider = this.getEl(this.ids.nodeSizeGammaSlider);
            const nodeColorInput = this.getEl(this.ids.nodeColorInput);
            const nodeBorderSlider = this.getEl(this.ids.nodeBorderSlider);
            const nodeBorderColorInput = this.getEl(this.ids.nodeBorderColorInput);
            const nodeOuterBorderWidthInput = this.getEl(this.ids.nodeOuterBorderWidthInput);
            const nodeOuterBorderColorInput = this.getEl(this.ids.nodeOuterBorderColorInput);
            const labelSizeSlider = this.getEl(this.ids.labelSizeSlider);
            const labelFadeSlider = this.getEl(this.ids.labelFadeSlider);
            const labelMinSlider = this.getEl(this.ids.labelMinSlider);
            const labelMinDimSlider = this.getEl(this.ids.labelMinDimSlider);
            const relatedMinSlider = this.getEl(this.ids.relatedMinSlider);
            const relatedMinDimSlider = this.getEl(this.ids.relatedMinDimSlider);
            const labelWeightSlider = this.getEl(this.ids.labelWeightSlider);
            const labelBgColorInput = this.getEl(this.ids.labelBgColorInput);
            const labelBorderColorInput = this.getEl(this.ids.labelBorderColorInput);
            const physicsSpringSlider = this.getEl(this.ids.physicsSpringSlider);
            const physicsStrengthSlider = this.getEl(this.ids.physicsStrengthSlider);
            const physicsGravitySlider = this.getEl(this.ids.physicsGravitySlider);
            const edgeFadeSlider = this.getEl(this.ids.edgeFadeSlider);
            const edgeMinWidthSlider = this.getEl(this.ids.edgeMinWidthSlider);
            const edgeMaxWidthSlider = this.getEl(this.ids.edgeMaxWidthSlider);
            const edgeColorInput = this.getEl(this.ids.edgeColorInput);

            if (nodeSizeMinSlider) nodeSizeMinSlider.value = String(sizeMin);
            if (nodeSizeMaxSlider) nodeSizeMaxSlider.value = String(sizeMax);
            if (nodeSizeGammaSlider) nodeSizeGammaSlider.value = String(gamma);
            if (nodeColorInput) nodeColorInput.value = this.nodeColor || '#ffffff';
            if (nodeBorderSlider) nodeBorderSlider.value = String(border);
            if (nodeBorderColorInput) nodeBorderColorInput.value = this.nodeBorderColor || '#111111';
            if (nodeOuterBorderWidthInput) nodeOuterBorderWidthInput.value = String(this.nodeOuterBorderWidth ?? 2);
            if (nodeOuterBorderColorInput) nodeOuterBorderColorInput.value = this.nodeOuterBorderColor || '#ffffff';
            if (labelSizeSlider) labelSizeSlider.value = String(Math.round(labelScale * 100));
            if (labelFadeSlider) labelFadeSlider.value = String(fade);
            if (labelColorInput) labelColorInput.value = this.labelColor || '#000000';
            if (labelBgColorInput) labelBgColorInput.value = this.labelBgColor || '#f2f2f2f1';
            if (labelBorderColorInput) labelBorderColorInput.value = this.labelBorderColor || '#00000021';
            if (labelMinSlider) labelMinSlider.value = String(minCite);
            if (labelMinDimSlider) labelMinDimSlider.value = String(this.labelMinDimAlpha ?? 0.2);
            if (relatedMinSlider) relatedMinSlider.value = String(this.relatedMinValue || 0);
            if (relatedMinDimSlider) relatedMinDimSlider.value = String(this.relatedMinDimAlpha ?? 0.2);
            if (labelWeightSlider) labelWeightSlider.value = String(this.labelWeight || 500);
            if (physicsSpringSlider) physicsSpringSlider.value = String(this.physicsSpringLength);
            if (physicsStrengthSlider) physicsStrengthSlider.value = String(this.physicsSpringConstant);
            if (physicsGravitySlider) physicsGravitySlider.value = String(this.physicsGravity);
            if (edgeFadeSlider) edgeFadeSlider.value = String(this.edgeFade);
            if (edgeMinWidthSlider) edgeMinWidthSlider.value = String(this.edgeMinWidth);
            if (edgeMaxWidthSlider) edgeMaxWidthSlider.value = String(this.edgeMaxWidth);
            if (edgeColorInput) edgeColorInput.value = this.edgeColor || '#111111';

            this.applyNodeSizeScale();
            this.applyNodeBorderWidth();
            this.applyNodeColor();
            this.applyNodeBorderColor();
            this.applyLabelSizeScale();
            this.applyLabelFade();
            this.applyLabelColor();
            this.applyLabelBgColor();
            this.applyLabelThreshold();
            this.applyLabelThresholdDimming();
            this.applyLabelStrokeWidth();
            this.applyLabelStrokeColor();
            this.applyLabelWeight();
            this.applyPhysicsSettings();
            this.applyEdgeFade();
            this.applyEdgeWidthRange();
            if (this.visNetwork) this.visNetwork.redraw();
            this.queuePersistSettings();
        }

        getPersistedSettingsPayload() {
            const state = this.getEdgeFocusState();
            const depthEntries = state.customFocusDepthMap
                ? Array.from(state.customFocusDepthMap.entries())
                : [];
            return {
                labelFade: this.labelFade,
                labelColor: this.labelColor,
                labelBgColor: this.labelBgColor,
                labelBorderColor: this.labelBorderColor,
                labelStrokeWidth: this.labelStrokeWidth,
                labelStrokeColor: this.labelStrokeColor,
                labelSizeScale: this.labelSizeScale,
                labelMinCitations: this.labelMinCitations,
                labelMinDimAlpha: this.labelMinDimAlpha,
                relatedMinValue: this.relatedMinValue,
                relatedMinDimAlpha: this.relatedMinDimAlpha,
                labelWeight: this.labelWeight,
                labelFontMin: this.labelFontMin,
                labelFontMax: this.labelFontMax,
                depthMode: this.depthMode,
                nodeSizeMin: this.nodeSizeMin,
                nodeSizeMax: this.nodeSizeMax,
                nodeSizeGamma: this.nodeSizeGamma,
                nodeColor: this.nodeColor,
                nodeBorderWidth: this.nodeBorderWidth,
                nodeBorderColor: this.nodeBorderColor,
                nodeOuterBorderWidth: this.nodeOuterBorderWidth,
                nodeOuterBorderColor: this.nodeOuterBorderColor,
                physicsSpringLength: this.physicsSpringLength,
                physicsSpringConstant: this.physicsSpringConstant,
                physicsGravity: this.physicsGravity,
                edgeFade: this.edgeFade,
                edgeMinWidth: this.edgeMinWidth,
                edgeMaxWidth: this.edgeMaxWidth,
                edgeColor: this.edgeColor,
                edgeLabelFontSize: this.edgeLabelFontSize,
                edgeLabelFontColor: this.edgeLabelFontColor,
                edgeLabelStrokeWidth: this.edgeLabelStrokeWidth,
                edgeLabelStrokeColor: this.edgeLabelStrokeColor,
                edgeLabelBgColor: this.edgeLabelBgColor,
                edgeStyle: this.edgeStyle,
                edgeHoverLabelEnabled: this.edgeHoverLabelEnabled,
                edgeLabelEnabled: this.edgeLabelEnabled,
                edgeFocusFadeAlpha: this.edgeFocusFadeAlpha,
                customFocusAlpha: state.customFocusAlpha,
                customFocusDepth: state.customFocusDepth,
                customFocusDepthMap: depthEntries,
                zoomCollapsed: this.zoomCollapsed,
                exportSvgScale: this.exportSvgScale,
                exportSvgMargin: this.exportSvgMargin,
                exportSvgIncludeLabels: this.exportSvgIncludeLabels
            };
        }

        getLabelPanelSettingsPayload() {
            return this.getPersistedSettingsPayload();
        }

        applyLabelPanelSettingsPayload(payload) {
            if (!payload || typeof payload !== 'object') return;
            if (Number.isFinite(payload.labelFade)) this.labelFade = payload.labelFade;
            if (typeof payload.labelColor === 'string') this.labelColor = payload.labelColor;
            if (typeof payload.labelBgColor === 'string') this.labelBgColor = payload.labelBgColor;
            if (typeof payload.labelBorderColor === 'string') this.labelBorderColor = payload.labelBorderColor;
            if (Number.isFinite(payload.labelStrokeWidth)) this.labelStrokeWidth = payload.labelStrokeWidth;
            if (typeof payload.labelStrokeColor === 'string') this.labelStrokeColor = payload.labelStrokeColor;
            if (Number.isFinite(payload.labelSizeScale)) this.labelSizeScale = payload.labelSizeScale;
            if (Number.isFinite(payload.labelMinCitations)) this.labelMinCitations = payload.labelMinCitations;
            if (Number.isFinite(payload.labelMinDimAlpha)) this.labelMinDimAlpha = payload.labelMinDimAlpha;
            if (Number.isFinite(payload.relatedMinValue)) this.relatedMinValue = payload.relatedMinValue;
            if (Number.isFinite(payload.relatedMinDimAlpha)) this.relatedMinDimAlpha = payload.relatedMinDimAlpha;
            if (Number.isFinite(payload.labelWeight)) this.labelWeight = payload.labelWeight;
            if (Number.isFinite(payload.labelFontMin)) this.labelFontMin = payload.labelFontMin;
            if (Number.isFinite(payload.labelFontMax)) this.labelFontMax = payload.labelFontMax;
            if (Number.isFinite(payload.nodeSizeMin)) this.nodeSizeMin = payload.nodeSizeMin;
            if (Number.isFinite(payload.nodeSizeMax)) this.nodeSizeMax = payload.nodeSizeMax;
            if (Number.isFinite(payload.nodeSizeGamma)) this.nodeSizeGamma = payload.nodeSizeGamma;
            if (typeof payload.nodeColor === 'string') this.nodeColor = payload.nodeColor;
            if (Number.isFinite(payload.nodeBorderWidth)) this.nodeBorderWidth = payload.nodeBorderWidth;
            if (typeof payload.nodeBorderColor === 'string') this.nodeBorderColor = payload.nodeBorderColor;
            if (Number.isFinite(payload.nodeOuterBorderWidth)) this.nodeOuterBorderWidth = payload.nodeOuterBorderWidth;
            if (typeof payload.nodeOuterBorderColor === 'string') this.nodeOuterBorderColor = payload.nodeOuterBorderColor;
            if (Number.isFinite(payload.physicsSpringLength)) this.physicsSpringLength = payload.physicsSpringLength;
            if (Number.isFinite(payload.physicsSpringConstant)) this.physicsSpringConstant = payload.physicsSpringConstant;
            if (Number.isFinite(payload.physicsGravity)) this.physicsGravity = payload.physicsGravity;
            if (Number.isFinite(payload.edgeFade)) this.edgeFade = payload.edgeFade;
            if (Number.isFinite(payload.edgeMinWidth)) this.edgeMinWidth = payload.edgeMinWidth;
            if (Number.isFinite(payload.edgeMaxWidth)) this.edgeMaxWidth = payload.edgeMaxWidth;
            if (typeof payload.edgeColor === 'string') this.edgeColor = payload.edgeColor;
            if (Number.isFinite(payload.edgeLabelFontSize)) this.edgeLabelFontSize = payload.edgeLabelFontSize;
            if (typeof payload.edgeLabelFontColor === 'string') this.edgeLabelFontColor = payload.edgeLabelFontColor;
            if (Number.isFinite(payload.edgeLabelStrokeWidth)) this.edgeLabelStrokeWidth = payload.edgeLabelStrokeWidth;
            if (typeof payload.edgeLabelStrokeColor === 'string') this.edgeLabelStrokeColor = payload.edgeLabelStrokeColor;
            if (typeof payload.edgeLabelBgColor === 'string') this.edgeLabelBgColor = payload.edgeLabelBgColor;
            if (typeof payload.edgeStyle === 'string') this.edgeStyle = payload.edgeStyle;
            if (typeof payload.edgeHoverLabelEnabled === 'boolean') {
                this.edgeHoverLabelEnabled = payload.edgeHoverLabelEnabled;
            }
            if (typeof payload.edgeLabelEnabled === 'boolean') {
                this.edgeLabelEnabled = payload.edgeLabelEnabled;
            }
            if (typeof payload.depthMode === 'boolean') this.depthMode = payload.depthMode;
            if (Number.isFinite(payload.edgeFocusFadeAlpha)) this.edgeFocusFadeAlpha = payload.edgeFocusFadeAlpha;
            if (Number.isFinite(payload.customFocusAlpha)) {
                const state = this.getEdgeFocusState();
                state.customFocusAlpha = payload.customFocusAlpha;
            }
            if (Number.isFinite(payload.customFocusDepth)) {
                const state = this.getEdgeFocusState();
                state.customFocusDepth = payload.customFocusDepth;
            }
            if (Array.isArray(payload.customFocusDepthMap)) {
                const state = this.getEdgeFocusState();
                state.customFocusDepthMap = new Map(payload.customFocusDepthMap);
            }
            if (Number.isFinite(payload.exportSvgScale)) this.exportSvgScale = payload.exportSvgScale;
            if (Number.isFinite(payload.exportSvgMargin)) this.exportSvgMargin = payload.exportSvgMargin;
            if (typeof payload.exportSvgIncludeLabels === 'boolean') {
                this.exportSvgIncludeLabels = payload.exportSvgIncludeLabels;
            }

            this.applyLabelFade();
            this.applyLabelSizeScale();
            this.applyLabelWeight();
            this.applyLabelColor();
            this.applyLabelBgColor();
            this.applyLabelBorderColor();
            this.applyLabelThreshold();
            this.applyLabelThresholdDimming();
            this.applyNodeSizeScale();
            this.applyNodeBorderWidth();
            this.applyNodeColor();
            this.applyNodeBorderColor();
            this.applyPhysicsSettings();
            this.applyEdgeFade();
            this.applyEdgeWidthRange();
            this.applyEdgeStyle();
            this.applyEdgeLabelDisplay();
            this.updateEdgeLabelToggleButton();
            this.applyDepthMode(this.depthMode);
            if (this.visNetwork) this.visNetwork.redraw();
            this.syncSettingsSliders();
            this.queuePersistSettings();
        }


        loadSettingsSlots() {
            if (this._settingsSlotsLoaded) return;
            this._settingsSlotsLoaded = true;
            try {
                const raw = localStorage.getItem(this.settingsSlotsKey);
                if (raw) {
                    const payload = JSON.parse(raw);
                    if (Array.isArray(payload)) {
                        this.settingsSlots = payload.slice(0, 10);
                        while (this.settingsSlots.length < 10) this.settingsSlots.push(null);
                    }
                }
            } catch (_e) {
                // ignore
            }
            this.updateSettingsSlotButtons();
        }

        persistSettingsSlots() {
            try {
                localStorage.setItem(this.settingsSlotsKey, JSON.stringify(this.settingsSlots));
            } catch (_e) {
                // ignore
            }
            this.updateSettingsSlotButtons();
        }

        updateSettingsSlotButtons() {
            const wrap = this.getEl(this.ids.labelSlots);
            if (!wrap) return;
            const buttons = Array.from(wrap.querySelectorAll('[data-slot]'));
            buttons.forEach((btn) => {
                const idx = Number(btn.dataset.slot) - 1;
                const filled = !!this.settingsSlots[idx];
                btn.classList.toggle('is-active', filled);
                const icon = btn.querySelector('i');
                if (icon) {
                    icon.className = filled ? 'fa-solid fa-circle' : 'fa-regular fa-circle';
                    icon.style.color = filled ? '#111111' : '';
                }
            });
        }

        getVisSettingsSnapshot() {
            const panel = this.getEl(this.ids.settingsPanel);
            const body = panel ? panel.querySelector('.vis-settings-body') : null;
            if (!body) return [];
            const controls = Array.from(body.querySelectorAll('input, select, textarea'));
            return controls
                .filter((el) => el.id)
                .map((el) => {
                    const type = el.type || el.tagName.toLowerCase();
                    if (type === 'checkbox') {
                        return { id: el.id, type, checked: el.checked };
                    }
                    return { id: el.id, type, value: el.value };
                });
        }

        applyVisSettingsSnapshot(snapshot = []) {
            if (!Array.isArray(snapshot)) return;
            snapshot.forEach((item) => {
                if (!item || !item.id) return;
                const el = document.getElementById(item.id);
                if (!el) return;
                const type = el.type || el.tagName.toLowerCase();
                if (type === 'checkbox') {
                    el.checked = !!item.checked;
                } else {
                    let next = item.value ?? '';
                    if (type === 'number') {
                        const num = Number(next);
                        if (Number.isFinite(num)) {
                            next = num.toFixed(4);
                        }
                    }
                    el.value = String(next);
                }
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            });
        }

        showSettingsSlotMenu(e, idx, anchorEl) {
            this.loadSettingsSlots();
            this.closeSettingsSlotMenu();
            const menu = document.createElement('div');
            menu.className = 'context-menu';
            const label = `Slot ${idx + 1}`;
            menu.innerHTML = `
                <div class="context-menu-item" data-action="save">
                    <i class="fa-solid fa-floppy-disk"></i>
                    Save ${label}
                </div>
                <div class="context-menu-item" data-action="load">
                    <i class="fas fa-folder-open"></i>
                    Load ${label}
                </div>
                <div class="context-menu-item" data-action="clear">
                    <i class="fa-regular fa-trash-can"></i>
                    Clear ${label}
                </div>
            `;
            document.body.appendChild(menu);
            const rect = anchorEl.getBoundingClientRect();
            menu.style.left = `${rect.right + 8}px`;
            menu.style.top = `${rect.top}px`;
            const onAction = (action) => {
                if (action === 'save') {
                    this.settingsSlots[idx] = {
                        savedAt: Date.now(),
                        data: this.getVisSettingsSnapshot()
                    };
                    this.persistSettingsSlots();
                    this.notify(`Saved ${label}`, 'success');
                }
                if (action === 'load') {
                    const payload = this.settingsSlots[idx];
                    if (payload?.data) {
                        this.applyVisSettingsSnapshot(payload.data);
                        this.notify(`Loaded ${label}`, 'success');
                    } else {
                        this.notify(`Slot ${idx + 1} is empty`, 'info');
                    }
                }
                if (action === 'clear') {
                    this.settingsSlots[idx] = null;
                    this.persistSettingsSlots();
                    this.notify(`Cleared ${label}`, 'info');
                }
                this.closeSettingsSlotMenu();
            };
            menu.querySelectorAll('.context-menu-item').forEach((item) => {
                item.addEventListener('click', () => {
                    const action = item.dataset.action;
                    onAction(action);
                });
            });
            const clickOutside = (ev) => {
                if (!menu.contains(ev.target)) this.closeSettingsSlotMenu();
            };
            const keyHandler = (ev) => {
                if (ev.key === 'Escape') this.closeSettingsSlotMenu();
            };
            menu._slotClickHandler = clickOutside;
            menu._slotKeyHandler = keyHandler;
            document.addEventListener('mousedown', clickOutside);
            document.addEventListener('keydown', keyHandler);
            this._settingsSlotMenu = menu;
        }

        closeSettingsSlotMenu() {
            const menu = this._settingsSlotMenu;
            if (!menu) return;
            if (menu._slotClickHandler) document.removeEventListener('mousedown', menu._slotClickHandler);
            if (menu._slotKeyHandler) document.removeEventListener('keydown', menu._slotKeyHandler);
            menu.remove();
            this._settingsSlotMenu = null;
        }

        queuePersistSettings() {
            if (!this.settingsAutoSave) return;
            if (this._settingsSaveTimer) clearTimeout(this._settingsSaveTimer);
            this._settingsSaveTimer = setTimeout(() => {
                this.persistSettings();
            }, 200);
        }

        queuePersistNetworkState() {
            if (this._networkSaveTimer) clearTimeout(this._networkSaveTimer);
            this._networkSaveTimer = setTimeout(() => {
                this.persistNetworkState();
            }, 200);
        }

        persistNetworkState() {
            const payload = {
                labelFieldsSelected: Array.from(this.labelFieldsSelected || []),
                labelField: this.labelField || 'wosid'
            };
            if (this.app && this.app.projectStorage && this.app.currentProject) {
                this.app.projectStorage.update(this.networkStateKey, payload);
            }
            try {
                localStorage.setItem(this.networkStateKey, JSON.stringify(payload));
            } catch (_e) {
                // ignore
            }
        }

        loadNetworkState() {
            const apply = (payload) => {
                if (!payload || typeof payload !== 'object') return;
                if (Array.isArray(payload.labelFieldsSelected)) {
                    this.labelFieldsSelected = payload.labelFieldsSelected;
                }
                if (payload.labelField) {
                    this.labelField = payload.labelField;
                }
                if (!this.labelFieldsSelected.length && this.labelField) {
                    this.labelFieldsSelected = this.parseLabelFields(this.labelField);
                }
                this.renderLabelFieldChips();
            };

            try {
                const raw = localStorage.getItem(this.networkStateKey);
                if (raw) apply(JSON.parse(raw));
            } catch (_e) {
                // ignore
            }

            if (this.app && this.app.projectStorage && this.app.currentProject) {
                this.app.projectStorage.load(this.networkStateKey).then((data) => {
                    apply(data);
                }).catch(() => {
                    // ignore
                });
            } else {
                setTimeout(() => {
                    if (this.app && this.app.projectStorage && this.app.currentProject) {
                        this.app.projectStorage.load(this.networkStateKey).then((data) => {
                            apply(data);
                        }).catch(() => {
                            // ignore
                        });
                    }
                }, 600);
            }
        }

        async loadSavedSelect() {
            if (this._savedSelectLoaded) return this._savedSelectValue;
            this._savedSelectLoaded = true;
            const apply = (value) => {
                const idx = Number.parseInt(value, 10);
                this._savedSelectValue = Number.isFinite(idx) ? idx : null;
                return this._savedSelectValue;
            };
            try {
                const raw = localStorage.getItem(this.savedSelectKey);
                if (raw != null) apply(raw);
            } catch (_e) {
                // ignore
            }
            if (this.app && this.app.projectStorage && this.app.currentProject) {
                try {
                    const data = await this.app.projectStorage.load(this.savedSelectKey);
                    if (data != null) apply(data);
                } catch (_e) {
                    // ignore
                }
            } else {
                setTimeout(() => {
                    if (this.app && this.app.projectStorage && this.app.currentProject) {
                        this.app.projectStorage.load(this.savedSelectKey).then((data) => {
                            if (data != null) apply(data);
                        }).catch(() => {
                            // ignore
                        });
                    }
                }, 600);
            }
            return this._savedSelectValue;
        }

        persistSavedSelect(value) {
            const idx = Number.parseInt(value, 10);
            this._savedSelectValue = Number.isFinite(idx) ? idx : null;
            if (this.app && this.app.projectStorage && this.app.currentProject) {
                this.app.projectStorage.update(this.savedSelectKey, this._savedSelectValue);
            }
            try {
                if (this._savedSelectValue == null) {
                    localStorage.removeItem(this.savedSelectKey);
                } else {
                    localStorage.setItem(this.savedSelectKey, String(this._savedSelectValue));
                }
            } catch (_e) {
                // ignore
            }
        }

        getValidSavedIndex(list, value) {
            if (!Array.isArray(list) || list.length === 0) return null;
            const idx = Number.parseInt(value, 10);
            if (!Number.isFinite(idx)) return null;
            if (idx < 0 || idx >= list.length) return null;
            return idx;
        }

        setSavedSelectValue(idx, options = {}) {
            const list = options.list || null;
            const select = this.getEl(this.ids.savedSelect);
            if (select) {
                select.value = String(idx);
            }
            this.pendingSavedIndex = idx;
            if (list && Array.isArray(list) && idx >= 0 && idx < list.length) {
                this.renderSavedSelect(list, idx);
            }
            if (!options.persist) return;
            this.persistSavedSelect(idx);
        }

        loadInputDraft() {
            if (this._inputDraftLoaded) return;
            this._inputDraftLoaded = true;
            const apply = (value) => {
                if (typeof value !== 'string') return;
                this._inputDraftText = value;
                this.applyInputDraftToTextarea();
            };
            try {
                const raw = localStorage.getItem(this.inputDraftKey);
                if (raw != null) apply(raw);
            } catch (_e) {
                // ignore
            }
            if (this.app && this.app.projectStorage && this.app.currentProject) {
                this.app.projectStorage.load(this.inputDraftKey).then((data) => {
                    apply(typeof data === 'string' ? data : '');
                }).catch(() => {
                    // ignore
                });
            }
        }

        applyInputDraftToTextarea() {
            const textarea = this.getEl(this.ids.inputTextarea);
            if (!textarea) return;
            if (textarea.value) return;
            if (this._inputDraftText) {
                textarea.value = this._inputDraftText;
            } else if (this.visInputText) {
                textarea.value = this.visInputText;
            }
        }

        persistInputDraft(value) {
            if (this._inputDraftSaveTimer) clearTimeout(this._inputDraftSaveTimer);
            const text = typeof value === 'string' ? value : '';
            this._inputDraftText = text;
            this._inputDraftSaveTimer = setTimeout(() => {
                if (this.app && this.app.projectStorage && this.app.currentProject) {
                    this.app.projectStorage.update(this.inputDraftKey, text);
                }
                try {
                    localStorage.setItem(this.inputDraftKey, text);
                } catch (_e) {
                    // ignore
                }
            }, 160);
        }

        loadInputHistory() {
            if (this._inputHistoryLoaded) return;
            this._inputHistoryLoaded = true;
            const apply = (payload) => {
                if (!Array.isArray(payload)) return;
                this.inputHistory = payload.filter((item) => typeof item === 'string' && item.trim().length);
                if (this.inputHistory.length > this.inputHistoryMax) {
                    this.inputHistory = this.inputHistory.slice(-this.inputHistoryMax);
                }
                this.inputHistoryIndex = this.inputHistory.length;
            };
            try {
                const raw = localStorage.getItem(this.inputHistoryKey);
                if (raw) apply(JSON.parse(raw));
            } catch (_e) {
                // ignore
            }
            if (this.app && this.app.projectStorage && this.app.currentProject) {
                this.app.projectStorage.load(this.inputHistoryKey).then((data) => {
                    apply(data);
                }).catch(() => {
                    // ignore
                });
            }
        }

        persistInputHistory() {
            const payload = this.inputHistory.slice(-this.inputHistoryMax);
            if (this.app && this.app.projectStorage && this.app.currentProject) {
                this.app.projectStorage.update(this.inputHistoryKey, payload);
            }
            try {
                localStorage.setItem(this.inputHistoryKey, JSON.stringify(payload));
            } catch (_e) {
                // ignore
            }
        }

        recordInputHistory(value) {
            const text = typeof value === 'string' ? value : '';
            if (!text.trim()) return;
            const existingIdx = this.inputHistory.findIndex((item) => item === text);
            if (existingIdx >= 0) {
                this.inputHistory.splice(existingIdx, 1);
            }
            this.inputHistory.push(text);
            if (this.inputHistory.length > this.inputHistoryMax) {
                this.inputHistory = this.inputHistory.slice(-this.inputHistoryMax);
            }
            this.inputHistoryIndex = this.inputHistory.length;
            this.persistInputHistory();
        }

        stepInputHistory(delta) {
            if (!this.inputHistory.length) return null;
            const max = this.inputHistory.length;
            if (!Number.isFinite(this.inputHistoryIndex) || this.inputHistoryIndex < 0 || this.inputHistoryIndex > max) {
                this.inputHistoryIndex = max;
            }
            let next = this.inputHistoryIndex + delta;
            if (next < 0) next = 0;
            if (next > max) next = max;
            if (next === max) {
                this.inputHistoryIndex = next;
                return this._inputDraftText || '';
            }
            this.inputHistoryIndex = next;
            return this.inputHistory[next];
        }

        persistSettings() {
            const payload = this.getPersistedSettingsPayload();
            if (this.app && this.app.projectStorage && this.app.currentProject) {
                this.app.projectStorage.update(this.settingsKey, payload);
            }
            try {
                localStorage.setItem(this.settingsKey, JSON.stringify(payload));
            } catch (_e) {
                // ignore
            }
        }

        loadPersistedSettings() {
            if (this._settingsLoaded) return;
            this._settingsLoaded = true;
            const apply = (payload) => {
                if (!payload || typeof payload !== 'object') return;
                if (Number.isFinite(payload.labelFade)) this.labelFade = payload.labelFade;
                if (typeof payload.labelColor === 'string') this.labelColor = payload.labelColor;
                if (typeof payload.labelBgColor === 'string') this.labelBgColor = payload.labelBgColor;
                if (typeof payload.labelBorderColor === 'string') this.labelBorderColor = payload.labelBorderColor;
                if (Number.isFinite(payload.labelSizeScale)) this.labelSizeScale = payload.labelSizeScale;
                if (Number.isFinite(payload.labelMinCitations)) this.labelMinCitations = payload.labelMinCitations;
                if (Number.isFinite(payload.labelMinDimAlpha)) this.labelMinDimAlpha = payload.labelMinDimAlpha;
                if (Number.isFinite(payload.relatedMinValue)) this.relatedMinValue = payload.relatedMinValue;
                if (Number.isFinite(payload.relatedMinDimAlpha)) this.relatedMinDimAlpha = payload.relatedMinDimAlpha;
                if (Number.isFinite(payload.labelWeight)) this.labelWeight = payload.labelWeight;
                if (Number.isFinite(payload.labelFontMin)) this.labelFontMin = payload.labelFontMin;
                if (Number.isFinite(payload.labelFontMax)) this.labelFontMax = payload.labelFontMax;
                if (Number.isFinite(payload.nodeSizeMin)) this.nodeSizeMin = payload.nodeSizeMin;
                if (Number.isFinite(payload.nodeSizeMax)) this.nodeSizeMax = payload.nodeSizeMax;
                if (Number.isFinite(payload.nodeSizeGamma)) this.nodeSizeGamma = payload.nodeSizeGamma;
                if (typeof payload.nodeColor === 'string') this.nodeColor = payload.nodeColor;
                if (Number.isFinite(payload.nodeBorderWidth)) this.nodeBorderWidth = payload.nodeBorderWidth;
                if (typeof payload.nodeBorderColor === 'string') this.nodeBorderColor = payload.nodeBorderColor;
                if (Number.isFinite(payload.nodeOuterBorderWidth)) this.nodeOuterBorderWidth = payload.nodeOuterBorderWidth;
                if (typeof payload.nodeOuterBorderColor === 'string') this.nodeOuterBorderColor = payload.nodeOuterBorderColor;
                if (Number.isFinite(payload.physicsSpringLength)) this.physicsSpringLength = payload.physicsSpringLength;
                if (Number.isFinite(payload.physicsSpringConstant)) this.physicsSpringConstant = payload.physicsSpringConstant;
                if (Number.isFinite(payload.physicsGravity)) this.physicsGravity = payload.physicsGravity;
                if (Number.isFinite(payload.edgeFade)) this.edgeFade = payload.edgeFade;
                if (Number.isFinite(payload.edgeMinWidth)) this.edgeMinWidth = payload.edgeMinWidth;
                if (Number.isFinite(payload.edgeMaxWidth)) this.edgeMaxWidth = payload.edgeMaxWidth;
                if (typeof payload.edgeColor === 'string') this.edgeColor = payload.edgeColor;
                if (typeof payload.depthMode === 'boolean') this.depthMode = payload.depthMode;
                if (Number.isFinite(payload.edgeFocusFadeAlpha)) this.edgeFocusFadeAlpha = payload.edgeFocusFadeAlpha;
                if (Number.isFinite(payload.customFocusAlpha)) {
                    const state = this.getEdgeFocusState();
                    state.customFocusAlpha = payload.customFocusAlpha;
                }
                if (Number.isFinite(payload.customFocusDepth)) {
                    const state = this.getEdgeFocusState();
                    state.customFocusDepth = payload.customFocusDepth;
                }
                if (Array.isArray(payload.customFocusDepthMap)) {
                    const state = this.getEdgeFocusState();
                    state.customFocusDepthMap = new Map(payload.customFocusDepthMap);
                }
                if (typeof payload.zoomCollapsed === 'boolean') this.zoomCollapsed = payload.zoomCollapsed;
            };

            try {
                const raw = localStorage.getItem(this.settingsKey);
                if (raw) apply(JSON.parse(raw));
            } catch (_e) {
                // ignore
            }
            this.syncSettingsSliders();
            this.applyDepthMode(this.depthMode);
            this.applyZoomCollapseState();

            if (this.app && this.app.projectStorage && this.app.currentProject) {
                this.app.projectStorage.load(this.settingsKey).then((data) => {
                    apply(data);
                    this.syncSettingsSliders();
                    this.applyDepthMode(this.depthMode);
                    this.applyZoomCollapseState();
                }).catch(() => {
                    // ignore
                });
            } else {
                setTimeout(() => {
                    if (this.app && this.app.projectStorage && this.app.currentProject) {
                        this.app.projectStorage.load(this.settingsKey).then((data) => {
                            apply(data);
                            this.syncSettingsSliders();
                            this.applyDepthMode(this.depthMode);
                            this.applyZoomCollapseState();
                        }).catch(() => {
                            // ignore
                        });
                    }
                }, 600);
            }
        }

        applyZoomCollapseState() {
            const zoomWrap = this.zoomWrap || document.querySelector('.vis-network-zoom');
            if (!zoomWrap) return;
            zoomWrap.classList.toggle('is-collapsed', !!this.zoomCollapsed);
        }

        setZoomCollapsed(collapsed) {
            this.zoomCollapsed = !!collapsed;
            this.applyZoomCollapseState();
            this.queuePersistSettings();
        }

        syncSettingsSliders() {
            const labelFadeSlider = this.getEl(this.ids.labelFadeSlider);
            const labelColorInput = this.getEl(this.ids.labelColorInput);
            const labelBgColorInput = this.getEl(this.ids.labelBgColorInput);
            const labelBorderColorInput = this.getEl(this.ids.labelBorderColorInput);
            const labelStrokeWidthInput = this.getEl(this.ids.labelStrokeWidthInput);
            const labelStrokeColorInput = this.getEl(this.ids.labelStrokeColorInput);
            const labelSizeSlider = this.getEl(this.ids.labelSizeSlider);
            const labelMinSlider = this.getEl(this.ids.labelMinSlider);
            const labelMinDimSlider = this.getEl(this.ids.labelMinDimSlider);
            const relatedMinSlider = this.getEl(this.ids.relatedMinSlider);
            const relatedMinDimSlider = this.getEl(this.ids.relatedMinDimSlider);
            const labelWeightSlider = this.getEl(this.ids.labelWeightSlider);
            const labelFontMinInput = this.getEl(this.ids.labelFontMinInput);
            const labelFontMaxInput = this.getEl(this.ids.labelFontMaxInput);
            const nodeSizeMinSlider = this.getEl(this.ids.nodeSizeMinSlider);
            const nodeSizeMaxSlider = this.getEl(this.ids.nodeSizeMaxSlider);
            const nodeSizeGammaSlider = this.getEl(this.ids.nodeSizeGammaSlider);
            const nodeColorInput = this.getEl(this.ids.nodeColorInput);
            const nodeBorderSlider = this.getEl(this.ids.nodeBorderSlider);
            const nodeBorderColorInput = this.getEl(this.ids.nodeBorderColorInput);
            const nodeOuterBorderWidthInput = this.getEl(this.ids.nodeOuterBorderWidthInput);
            const nodeOuterBorderColorInput = this.getEl(this.ids.nodeOuterBorderColorInput);
            const physicsSpringSlider = this.getEl(this.ids.physicsSpringSlider);
            const physicsStrengthSlider = this.getEl(this.ids.physicsStrengthSlider);
            const physicsGravitySlider = this.getEl(this.ids.physicsGravitySlider);
            const edgeFadeSlider = this.getEl(this.ids.edgeFadeSlider);
            const edgeMinWidthSlider = this.getEl(this.ids.edgeMinWidthSlider);
            const edgeMaxWidthSlider = this.getEl(this.ids.edgeMaxWidthSlider);
            const edgeColorInput = this.getEl(this.ids.edgeColorInput);
            const edgeLabelFontSizeInput = this.getEl(this.ids.edgeLabelFontSizeInput);
            const edgeLabelColorInput = this.getEl(this.ids.edgeLabelColorInput);
            const edgeLabelStrokeWidthInput = this.getEl(this.ids.edgeLabelStrokeWidthInput);
            const edgeLabelStrokeColorInput = this.getEl(this.ids.edgeLabelStrokeColorInput);
            const edgeLabelBgColorInput = this.getEl(this.ids.edgeLabelBgColorInput);

            if (labelFadeSlider) labelFadeSlider.value = String(this.labelFade || 0);
            this.setColorInputValue(labelColorInput, this.labelColor || '#000000');
            this.setColorInputValue(labelBgColorInput, this.labelBgColor || '#f2f2f2f1');
            this.setColorInputValue(labelBorderColorInput, this.labelBorderColor || '#00000021');
            if (labelStrokeWidthInput) labelStrokeWidthInput.value = String(this.labelStrokeWidth ?? 0);
            this.setColorInputValue(labelStrokeColorInput, this.labelStrokeColor || '#ffffff');
            if (labelSizeSlider) labelSizeSlider.value = String(Math.round((this.labelSizeScale || 1) * 100));
            if (labelMinSlider) labelMinSlider.value = String(this.labelMinCitations || 0);
            if (labelMinDimSlider) labelMinDimSlider.value = String(this.labelMinDimAlpha ?? 0.2);
            if (relatedMinSlider) relatedMinSlider.value = String(this.relatedMinValue || 0);
            if (relatedMinDimSlider) relatedMinDimSlider.value = String(this.relatedMinDimAlpha ?? 0.2);
            if (labelWeightSlider) labelWeightSlider.value = String(this.labelWeight || 500);
            if (labelFontMinInput) labelFontMinInput.value = String(this.labelFontMin ?? 9);
            if (labelFontMaxInput) labelFontMaxInput.value = String(this.labelFontMax ?? 30);
            if (nodeSizeMinSlider) nodeSizeMinSlider.value = String(this.nodeSizeMin || 1);
            if (nodeSizeMaxSlider) nodeSizeMaxSlider.value = String(this.nodeSizeMax || 60);
            if (nodeSizeGammaSlider) nodeSizeGammaSlider.value = String(this.nodeSizeGamma || 1);
            this.setColorInputValue(nodeColorInput, this.nodeColor || '#ffffff');
            if (nodeBorderSlider) nodeBorderSlider.value = String(this.nodeBorderWidth || 1.5);
            this.setColorInputValue(nodeBorderColorInput, this.nodeBorderColor || '#111111');
            if (nodeOuterBorderWidthInput) nodeOuterBorderWidthInput.value = String(this.nodeOuterBorderWidth ?? 2);
            this.setColorInputValue(nodeOuterBorderColorInput, this.nodeOuterBorderColor || '#ffffff');
            if (physicsSpringSlider) physicsSpringSlider.value = String(this.physicsSpringLength || 120);
            if (physicsStrengthSlider) physicsStrengthSlider.value = String(this.physicsSpringConstant || 0.05);
            if (physicsGravitySlider) physicsGravitySlider.value = String(this.physicsGravity || -9000);
            if (edgeFadeSlider) edgeFadeSlider.value = String(this.edgeFade || 100);
            if (edgeMinWidthSlider) edgeMinWidthSlider.value = String(this.edgeMinWidth || 1);
            if (edgeMaxWidthSlider) edgeMaxWidthSlider.value = String(this.edgeMaxWidth || 6);
            this.setColorInputValue(edgeColorInput, this.edgeColor || '#111111');
            if (edgeLabelFontSizeInput) edgeLabelFontSizeInput.value = String(this.edgeLabelFontSize ?? 12);
            this.setColorInputValue(edgeLabelColorInput, this.edgeLabelFontColor || '#111111');
            if (edgeLabelStrokeWidthInput) edgeLabelStrokeWidthInput.value = String(this.edgeLabelStrokeWidth ?? 0);
            this.setColorInputValue(edgeLabelStrokeColorInput, this.edgeLabelStrokeColor || '#ffffff');
            this.setColorInputValue(edgeLabelBgColorInput, this.edgeLabelBgColor || 'rgba(255,255,255,0.85)');
            this.syncExportSettingsInputs();
        }

        syncExportSettingsInputs() {
            const exportSvgScaleInput = this.getEl(this.ids.exportSvgScaleInput);
            const exportSvgMarginInput = this.getEl(this.ids.exportSvgMarginInput);
            const exportSvgIncludeLabelsInput = this.getEl(this.ids.exportSvgIncludeLabelsInput);
            if (exportSvgScaleInput) exportSvgScaleInput.value = String(this.exportSvgScale || 1);
            if (exportSvgMarginInput) exportSvgMarginInput.value = String(this.exportSvgMargin ?? 6);
            if (exportSvgIncludeLabelsInput) {
                exportSvgIncludeLabelsInput.checked = this.exportSvgIncludeLabels !== false;
            }
        }

        setColorInputValue(input, value) {
            if (!input) return;
            const next = value || '';
            input.value = next;
            const wrapper = input.closest('.clr-field');
            if (wrapper) {
                wrapper.style.setProperty('--clr-color', next);
            }
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }

        updateLabelLayer() {
            const view = this.getEl(this.ids.view);
            const layer = view ? view.querySelector('.vis-network-label-layer') : null;
            const dataset = this.getNetworkNodesDataSet();
            if (!layer || !dataset) return;
            if (!layer.dataset.interactionBound) {
                layer.dataset.interactionBound = '1';
                layer.addEventListener('click', (e) => {
                    const label = e.target.closest('.vis-node-label');
                    if (!label) return;
                    const nodeId = label.dataset.nodeId;
                    if (!nodeId) return;
                    this.focusNode(nodeId);
                });
                layer.addEventListener('mouseover', (e) => {
                    const label = e.target.closest('.vis-node-label');
                    if (!label || !this.visNetwork) return;
                    const nodeId = label.dataset.nodeId;
                    if (!nodeId) return;
                    this.visNetwork.selectNodes([nodeId]);
                });
                layer.addEventListener('mouseout', (e) => {
                    const label = e.target.closest('.vis-node-label');
                    if (!label || !this.visNetwork) return;
                    this.visNetwork.unselectAll();
                });
            }
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
            const raw = textarea.value || '';
            if (!raw.trim()) return;
            let parsed = null;
            try {
                parsed = JSON.parse(raw);
            } catch (err) {
                this.notify(`JSON 解析失败: ${err.message}`, 'error');
                return;
            }
            parsed = coerceNumericFields(parsed);
            const formatted = JSON.stringify(parsed, null, 2);
            this.visInputText = formatted;
            textarea.value = formatted;
            this.recordInputHistory(formatted);
            this.persistInputDraft(formatted);
            if (!this.graphModel && global.WosGraphModel) {
                this.graphModel = new global.WosGraphModel({ source: null });
            }
            if (this.graphModel) {
                this.graphModel.setSource(parsed);
                const visData = this.graphModel.buildVisData();
                this.renderFromVisData(visData, { sourceJson: formatted });
            } else {
                this.renderFromJson(formatted);
            }
            this.notify('Rendered', 'success');
        }

        applyDepthFocusFromInput() {
            const textarea = this.getEl(this.ids.inputTextarea);
            if (!textarea) return;
            if (!this.visNetwork || !this.visNetwork?.body?.data?.nodes || !this.visNetwork?.body?.data?.edges) {
                this.notify('Vis network not ready', 'info');
                return;
            }
            const raw = (textarea.value || '').trim();
            if (!raw) {
                this.notify('Input is empty', 'info');
                return;
            }
            const tryParse = (text) => {
                try {
                    return JSON.parse(text);
                } catch (_e) {
                    return null;
                }
            };
            let parsed = tryParse(raw);
            if (!parsed && global.JSONRepair && typeof global.JSONRepair.jsonrepair === 'function') {
                try {
                    const repaired = global.JSONRepair.jsonrepair(raw);
                    parsed = tryParse(repaired);
                } catch (_e) {
                    parsed = null;
                }
            }
            if (!parsed) {
                this.notify('Invalid JSON', 'error');
                return;
            }
            const items = Array.isArray(parsed) ? parsed : [parsed];
            if (!items.length) {
                this.notify('No focus items found', 'info');
                return;
            }
            const dataset = this.visNetwork.body.data;
            const nodes = dataset.nodes.get();
            const edges = dataset.edges.get();
            const nodeIdByNormalized = new Map();
            nodes.forEach((node) => {
                const normalized = this.normalizeWosId(node.id);
                if (normalized) nodeIdByNormalized.set(normalized, node.id);
            });
            const adj = new Map();
            edges.forEach((edge) => {
                if (edge.from == null || edge.to == null) return;
                const from = edge.from;
                const to = edge.to;
                if (!adj.has(from)) adj.set(from, new Set());
                if (!adj.has(to)) adj.set(to, new Set());
                adj.get(from).add(to);
                adj.get(to).add(from);
            });
            const activeNodes = new Set();
            const activeEdges = new Set();
            const missing = [];
            const opacities = [];
            const focusMap = new Map();
            const depthMap = new Map();
            items.forEach((item) => {
                if (!item || typeof item !== 'object') return;
                const rawId = item.id || item.wosid || item.wosId;
                const depth = Number.isFinite(Number(item.depth)) ? Math.max(0, Number(item.depth)) : 0;
                if (Number.isFinite(Number(item.opacity))) {
                    opacities.push(Math.max(0, Math.min(1, Number(item.opacity))));
                }
                const normalized = this.normalizeWosId(rawId);
                if (!normalized) return;
                const nodeId = nodeIdByNormalized.get(normalized);
                if (!nodeId) {
                    missing.push(normalized);
                    return;
                }
                const visited = new Set([nodeId]);
                const queue = [{ id: nodeId, depth: 0 }];
                const nextNodes = new Set();
                while (queue.length) {
                    const { id, depth: d } = queue.shift();
                    nextNodes.add(id);
                    if (d >= depth) continue;
                    const neighbors = adj.get(id);
                    if (!neighbors) continue;
                    neighbors.forEach((next) => {
                        if (visited.has(next)) return;
                        visited.add(next);
                        queue.push({ id: next, depth: d + 1 });
                    });
                }
                focusMap.set(nodeId, nextNodes);
                depthMap.set(nodeId, depth);
                nextNodes.forEach((id) => activeNodes.add(id));
            });
            if (!activeNodes.size) {
                this.notify('No matching nodes found', 'info');
                return;
            }
            edges.forEach((edge) => {
                if (activeNodes.has(edge.from) && activeNodes.has(edge.to)) {
                    activeEdges.add(edge.id);
                }
            });
            const state = this.getEdgeFocusState();
            if (state.baseNodeColors.size || state.baseEdgeColors.size) {
                this.restoreEdgeFocusBaseColors();
            }
            state.hoverEdgeId = null;
            state.hoverNodeId = null;
            state.lockedEdgeIds.clear();
            state.dirty = true;
            state.customFocusActive = true;
            state.customFocusNodes = activeNodes;
            state.customFocusEdges = activeEdges;
            state.customFocusAlpha = opacities.length ? Math.min(...opacities) : null;
            state.customFocusRootId = null;
            state.customFocusDepth = null;
            state.customFocusMap = focusMap;
            state.customFocusDepthMap = depthMap;
            if (this.visNetwork) {
                this.visNetwork._wosCustomFocusActive = true;
                this.visNetwork._wosCustomFocusNodes = activeNodes;
            }
            this.applyEdgeFocusDisplay();
            if (missing.length) {
                this.notify(`Missing nodes: ${missing.join(', ')}`, 'info');
            } else {
                this.notify('Depth focus applied', 'success');
            }
        }

        applyDepthFocusForNode(nodeId, depth = 1, opacity = null) {
            if (!this.visNetwork || !this.visNetwork?.body?.data?.nodes || !this.visNetwork?.body?.data?.edges) {
                this.notify('Vis network not ready', 'info');
                return;
            }
            if (!nodeId) return;
            const dataset = this.visNetwork.body.data;
            const nodes = dataset.nodes.get();
            const edges = dataset.edges.get();
            const adj = new Map();
            edges.forEach((edge) => {
                if (edge.from == null || edge.to == null) return;
                const from = edge.from;
                const to = edge.to;
                if (!adj.has(from)) adj.set(from, new Set());
                if (!adj.has(to)) adj.set(to, new Set());
                adj.get(from).add(to);
                adj.get(to).add(from);
            });
            const targetDepth = Number.isFinite(Number(depth)) ? Math.max(0, Number(depth)) : 0;
            const nextNodes = new Set();
            const activeEdges = new Set();
            const visited = new Set([nodeId]);
            const queue = [{ id: nodeId, depth: 0 }];
            while (queue.length) {
                const { id, depth: d } = queue.shift();
                nextNodes.add(id);
                if (d >= targetDepth) continue;
                const neighbors = adj.get(id);
                if (!neighbors) continue;
                neighbors.forEach((next) => {
                    if (visited.has(next)) return;
                    visited.add(next);
                    queue.push({ id: next, depth: d + 1 });
                });
            }
            const state = this.getEdgeFocusState();
            if (!state.customFocusMap) state.customFocusMap = new Map();
            if (!state.customFocusDepthMap) state.customFocusDepthMap = new Map();
            state.customFocusMap.set(nodeId, nextNodes);
            state.customFocusDepthMap.set(nodeId, targetDepth);
            const activeNodes = new Set();
            state.customFocusMap.forEach((set) => {
                if (!set) return;
                set.forEach((id) => activeNodes.add(id));
            });
            edges.forEach((edge) => {
                if (activeNodes.has(edge.from) && activeNodes.has(edge.to)) {
                    activeEdges.add(edge.id);
                }
            });
            if (state.baseNodeColors.size || state.baseEdgeColors.size) {
                this.restoreEdgeFocusBaseColors();
            }
            state.hoverEdgeId = null;
            state.hoverNodeId = null;
            state.lockedEdgeIds.clear();
            state.dirty = true;
            state.customFocusActive = true;
            state.customFocusNodes = activeNodes;
            state.customFocusEdges = activeEdges;
            if (opacity != null && Number.isFinite(Number(opacity))) {
                state.customFocusAlpha = Math.max(0, Math.min(1, Number(opacity)));
            }
            state.customFocusRootId = nodeId;
            state.customFocusDepth = targetDepth;
            if (this.visNetwork) {
                this.visNetwork._wosCustomFocusActive = true;
                this.visNetwork._wosCustomFocusNodes = activeNodes;
            }
            this.applyEdgeFocusDisplay();
        }

        rebuildCustomFocusFromMap() {
            if (!this.visNetwork || !this.visNetwork?.body?.data?.nodes || !this.visNetwork?.body?.data?.edges) {
                return;
            }
            const state = this.getEdgeFocusState();
            if (!state.customFocusMap || !state.customFocusMap.size) {
                this.clearCustomFocusLock();
                return;
            }
            const dataset = this.visNetwork.body.data;
            const edges = dataset.edges.get();
            const activeNodes = new Set();
            state.customFocusMap.forEach((set) => {
                if (!set) return;
                set.forEach((id) => activeNodes.add(id));
            });
            const activeEdges = new Set();
            edges.forEach((edge) => {
                if (activeNodes.has(edge.from) && activeNodes.has(edge.to)) {
                    activeEdges.add(edge.id);
                }
            });
            if (state.baseNodeColors.size || state.baseEdgeColors.size) {
                this.restoreEdgeFocusBaseColors();
            }
            state.dirty = true;
            state.customFocusActive = true;
            state.customFocusNodes = activeNodes;
            state.customFocusEdges = activeEdges;
            if (this.visNetwork) {
                this.visNetwork._wosCustomFocusActive = true;
                this.visNetwork._wosCustomFocusNodes = activeNodes;
            }
            this.applyEdgeFocusDisplay();
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
            incoming = coerceNumericFields(incoming);
            let base = this.graphModel?.source || null;
            if (!base && this.visInputText) {
                try {
                    base = JSON.parse(this.visInputText);
                } catch (_e) {
                    base = null;
                }
            } else if (!base && this.lastRenderedJson) {
                try {
                    base = JSON.parse(this.lastRenderedJson);
                } catch (_e) {
                    base = null;
                }
            } else if (!base && this.app && this.app.currentData && typeof this.app.currentData === 'object') {
                base = this.app.currentData;
            }
            if (!this.graphModel && global.WosGraphModel) {
                this.graphModel = new global.WosGraphModel({ source: base || {} });
            }
            if (this.graphModel) {
                if (base && this.graphModel.source !== base) {
                    this.graphModel.setSource(base);
                }
                this.graphModel.appendSource(incoming);
                const visData = this.graphModel.buildVisData();
                const sourceJson = JSON.stringify(this.graphModel.source, null, 2);
                this.visInputText = sourceJson;
                textarea.value = sourceJson;
                this.recordInputHistory(sourceJson);
                this.persistInputDraft(sourceJson);
                this.renderFromVisData(visData, { sourceJson });
                this.notify('Merged and rendered', 'success');
                return;
            }
            const merged = this.mergeWosJson(base || {}, incoming);
            this.visInputText = JSON.stringify(merged, null, 2);
            textarea.value = this.visInputText;
            this.recordInputHistory(textarea.value || '');
            this.persistInputDraft(textarea.value || '');
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
            const currentValue = select.value;
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
            const currentIdx = Number.parseInt(currentValue, 10);
            if (Number.isFinite(currentIdx) && currentIdx >= 0 && currentIdx < list.length) {
                select.value = String(currentIdx);
            }
        }

        async saveNetworkJson() {
            this.persistSettings();
            const visData = this.visNetworkData;
            if (!visData || !Array.isArray(visData.nodes) || !Array.isArray(visData.edges)) {
                this.notify('No vis data to save', 'info');
                return;
            }
            if (!this.graphModel && global.WosGraphModel) {
                this.graphModel = new global.WosGraphModel({ source: null });
            }
            if (this.graphModel) {
                const base = this.graphModel.source || this.getVisInputData() || this.getCurrentViewData();
                if (base && this.isWosGraphData(base)) {
                    this.graphModel.setSource(base);
                }
                this.graphModel.visData = visData;
            }
            const name = prompt('Save name', `network-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}`);
            if (!name) return;
            const list = await this.loadSavedList();
            const showAll = !!this.visNetwork?._wosLabelState?.showAll;
            const state = this.visNetwork
                ? {
                    zoom: this.visNetwork.getScale(),
                    pan: this.visNetwork.getViewPosition(),
                    labelMode: showAll ? 'all' : 'hover'
                }
                : null;
            const settings = this.getPersistedSettingsPayload();
            const payload = this.graphModel
                ? this.graphModel.getSavedPayload({ name, state })
                : {
                    version: 1,
                    name,
                    source: {},
                    visData,
                    state
                };
            list.unshift({
                ...payload,
                settings,
                createdAt: Date.now(),
                type: 'wos-graph'
            });
            const trimmed = list.slice(0, 50);
            await this.persistSavedList(trimmed);
            this.renderSavedSelect(trimmed);
            this.setSavedSelectValue(0, { persist: true, list: trimmed });
            this.notify('Network JSON saved', 'success');
        }

        async restoreNetworkJson(options = {}) {
            const list = options.list || await this.loadSavedList();
            const select = this.getEl(this.ids.savedSelect);
            if (!list.length || (select && select.disabled)) {
                if (!options.silent) {
                    this.notify('No saved items', 'info');
                }
                return;
            }
            const fallbackIdx = select ? Number.parseInt(select.value, 10) : 0;
            const idx = Number.isFinite(options.idx)
                ? options.idx
                : (Number.isFinite(this.pendingSavedIndex) ? this.pendingSavedIndex : fallbackIdx);
            const item = list[idx] || list[0];
            if (!item) {
                if (!options.silent) {
                    this.notify('Invalid selection', 'error');
                }
                return;
            }
            if (select) {
                select.value = String(idx);
            }
            this.pendingSavedIndex = idx;
            if (!options.skipPersist) {
                this.persistSavedSelect(idx);
            }
            if (item.version === 1 && (item.source || item.visData)) {
                const model = global.WosGraphModel ? global.WosGraphModel.fromSaved(item) : null;
                if (model) {
                    this.graphModel = model;
                    if (!model.visData || !Array.isArray(model.visData.nodes)) {
                        model.buildVisData();
                    }
                    const sourceJson = JSON.stringify(model.source || {}, null, 2);
                    this.renderFromVisData(model.visData || {}, { sourceJson });
                    if (item.state && this.visNetwork) {
                        const zoom = Number.isFinite(item.state.zoom) ? item.state.zoom : null;
                        const pan = item.state.pan && Number.isFinite(item.state.pan.x) && Number.isFinite(item.state.pan.y)
                            ? item.state.pan
                            : null;
                        if (zoom != null || pan) {
                            this.visNetwork.moveTo({
                                position: pan || undefined,
                                scale: zoom != null ? zoom : undefined,
                                animation: { duration: 420, easingFunction: this.zoomAnimEasing }
                            });
                        }
                        if (item.state.labelMode) {
                            this.applyLabelShowAll(item.state.labelMode === 'all');
                        }
                    }
                    if (item.settings) {
                        this.applyLabelPanelSettingsPayload(item.settings);
                    }
                } else {
                    this.notify('Saved payload missing model support', 'error');
                    return;
                }
            } else {
                if (!options.silent) {
                    this.notify('Invalid selection', 'error');
                }
                return;
            }
            if (!options.silent) {
                this.notify('Network JSON restored', 'success');
            }
        }

        async deleteNetworkJson() {
            const list = await this.loadSavedList();
            if (!list.length) {
                this.clearNetworkView();
                this.notify('Cleared current network', 'success');
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
            if (!list.length) {
                this.persistSavedSelect(null);
                this.pendingSavedIndex = null;
            } else {
                const nextIdx = Math.min(idx, list.length - 1);
                this.setSavedSelectValue(nextIdx, { persist: true, list });
            }
            this.notify('Deleted', 'success');
        }

        viewVisDataJson() {
            const data = this.visNetworkData;
            if (!data) {
                this.notify('No vis data available', 'info');
                return;
            }
            const textarea = this.getEl(this.ids.inputTextarea);
            if (textarea) {
                textarea.value = JSON.stringify(data, null, 2);
                this.visInputText = textarea.value;
                this.recordInputHistory(textarea.value || '');
                this.persistInputDraft(textarea.value || '');
                this.notify('Vis data loaded', 'success');
                return;
            }
            this.notify('Vis input not ready', 'info');
        }

        async handleViewActivated() {
            const list = await this.loadSavedList();
            const safeList = Array.isArray(list) ? list : [];
            this.renderSavedSelect(safeList);
            if (this._visViewReady && this.visNetwork && this.visNetworkData) {
                return;
            }
            const savedIdx = await this.loadSavedSelect();
            const idx = this.getValidSavedIndex(safeList, savedIdx);
            if (idx == null) {
                this.renderFromCurrentData();
                return;
            }
            this.setSavedSelectValue(idx, { persist: false, list: safeList });
            await this.restoreNetworkJson({ list: safeList, idx, silent: true, skipPersist: true });
        }

        clearNetworkView() {
            this.visInputText = '';
            this.lastRenderedJson = '';
            this.visNetworkData = null;
            this.resetEdgeFocusState();
            const textarea = this.getEl(this.ids.inputTextarea);
            if (textarea) textarea.value = '';
            if (this.visNetwork && global.vis && global.vis.DataSet) {
                const dataset = {
                    nodes: new global.vis.DataSet([]),
                    edges: new global.vis.DataSet([])
                };
                this.visNetwork.setData(dataset);
            }
            const view = this.getEl(this.ids.view);
            if (view) view.classList.remove('has-network');
            this.queuePersistNetworkState();
        }

        bindNetworkEvents(network) {
            if (!network) return;
            if (this._boundNetwork === network) return;
            if (this._boundNetwork) {
                this._boundNetwork.off('click', this._onNetworkClick);
                if (this._onNetworkDoubleClick) {
                    this._boundNetwork.off('doubleClick', this._onNetworkDoubleClick);
                }
                if (this._onNetworkAfterDraw) {
                    this._boundNetwork.off('afterDrawing', this._onNetworkAfterDraw);
                }
                if (this._edgeHoverAfterDraw) {
                    this._boundNetwork.off('afterDrawing', this._edgeHoverAfterDraw);
                }
                if (this._onEdgeHover) {
                    this._boundNetwork.off('hoverEdge', this._onEdgeHover);
                }
                if (this._onEdgeBlur) {
                    this._boundNetwork.off('blurEdge', this._onEdgeBlur);
                }
                if (this._onEdgeContext) {
                    this._boundNetwork.off('oncontext', this._onEdgeContext);
                }
                if (this._onNodeHover) {
                    this._boundNetwork.off('hoverNode', this._onNodeHover);
                }
                if (this._onNodeBlur) {
                    this._boundNetwork.off('blurNode', this._onNodeBlur);
                }
                if (this._edgeHoverKeyDown) {
                    document.removeEventListener('keydown', this._edgeHoverKeyDown);
                }
                if (this._edgeHoverKeyUp) {
                    document.removeEventListener('keyup', this._edgeHoverKeyUp);
                }
            }
            this._onNetworkClick = (params) => {
                const evt = params?.event?.event || params?.event?.srcEvent;
                const nodeId = params?.nodes?.[0];
                if (nodeId && evt && evt.shiftKey) {
                    const state = this.getEdgeFocusState();
                    if (state.customFocusActive && state.customFocusMap && state.customFocusMap.has(nodeId)) {
                        state.customFocusMap.delete(nodeId);
                        if (state.customFocusDepthMap) state.customFocusDepthMap.delete(nodeId);
                        this.rebuildCustomFocusFromMap();
                        return;
                    }
                }
                const mod = evt ? (evt.metaKey || evt.ctrlKey) : false;
                if (mod) {
                    if (nodeId) {
                        const wosId = this.normalizeWosId(nodeId);
                        if (wosId) {
                            const url = `https://www.webofscience.com/wos/woscc/full-record/${encodeURIComponent(wosId)}`;
                            window.open(url, '_blank', 'noopener');
                        }
                }
                return;
            }
            const inputPanel = this.getEl(this.ids.inputPanel);
            const inputVisible = inputPanel ? inputPanel.classList.contains('is-active') : false;
            const textarea = this.getEl(this.ids.inputTextarea);
            const writeToTextarea = (payload) => {
                if (!inputVisible) return;
                if (!textarea || payload == null) return;
                textarea.value = JSON.stringify(payload, null, 2);
            };
            if (nodeId) {
                    const dataset = network?.body?.data?.nodes;
                    if (dataset && typeof dataset.get === 'function') {
                        const node = dataset.get(nodeId);
                        if (node) {
                            writeToTextarea(node);
                        }
                    }
                } else {
                    const edgeId = params?.edges?.[0];
                    if (edgeId) {
                        const edgeDataset = network?.body?.data?.edges;
                        if (edgeDataset && typeof edgeDataset.get === 'function') {
                            const edge = edgeDataset.get(edgeId);
                            if (edge) {
                                writeToTextarea(edge);
                            }
                        }
                    }
                }
                if (!nodeId) return;
                this.openFileByWosId(nodeId);
            };
            network.on('click', this._onNetworkClick);
            this._onNetworkDoubleClick = (params) => {
                const nodeId = params?.nodes?.[0];
                if (nodeId) return;
                const edgeId = params?.edges?.[0];
                if (edgeId) {
                    this.toggleEdgeLock(edgeId);
                }
            };
            network.on('doubleClick', this._onNetworkDoubleClick);
            this._onNetworkAfterDraw = (ctx) => {
                const dataset = network?.body?.data?.nodes;
                if (!dataset) return;
                const nodes = dataset.get();
                if (!nodes.length) return;
                const outlineWidth = Number.isFinite(Number(this.nodeOuterBorderWidth))
                    ? Number(this.nodeOuterBorderWidth)
                    : 2;
                if (outlineWidth <= 0) return;
                const scale = Number(network.getScale()) || 1;
                const ratio = Number(network.canvas?.pixelRatio) || 1;
                ctx.save();
                ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
                nodes.forEach((node) => {
                    const nodeAlpha = Math.max(0, Math.min(1, getNodeAlpha(node)));
                    const outlineColor = setColorAlpha(this.nodeOuterBorderColor || '#ffffff', nodeAlpha);
                    const pos = network.getPositions([node.id])[node.id];
                    if (!pos) return;
                    const dom = typeof network.canvasToDOM === 'function'
                        ? network.canvasToDOM(pos)
                        : pos;
                    const radius = (Number(node.size) || 6) * scale;
                    const borderWidth = (Number(node.borderWidth) || 1) * scale;
                    const outerRadius = radius + borderWidth / 2 + outlineWidth;
                    ctx.fillStyle = outlineColor;
                    ctx.beginPath();
                    ctx.arc(dom.x, dom.y, outerRadius, 0, Math.PI * 2);
                    ctx.fill();

                    const fill = node.color?.background || '#ffffff';
                    const stroke = node.color?.border || '#111111';
                    ctx.fillStyle = fill;
                    ctx.beginPath();
                    ctx.arc(dom.x, dom.y, radius, 0, Math.PI * 2);
                    ctx.fill();
                    if (borderWidth > 0) {
                        ctx.lineWidth = borderWidth;
                        ctx.strokeStyle = stroke;
                        ctx.stroke();
                    }
                });
                ctx.restore();
            };
            network.on('afterDrawing', this._onNetworkAfterDraw);
            this._onEdgeHover = (params) => {
                const state = this.getEdgeFocusState();
                const edgeId = params?.edge;
                const evt = params?.event?.event || params?.event?.srcEvent || params?.event;
                const hasMod = !!(evt && (evt.metaKey || evt.ctrlKey));
                state.lastHoverEdgeId = edgeId || null;
                if (!hasMod) {
                    if (this.getEdgeFocusState().hoverEdgeId) {
                        this.clearEdgeHover();
                    }
                    return;
                }
                if (edgeId) {
                    this.setEdgeHover(edgeId);
                }
            };
            this._onEdgeBlur = () => {
                const state = this.getEdgeFocusState();
                state.lastHoverEdgeId = null;
                this.clearEdgeHover();
            };
            this._onNodeHover = (params) => {
                const state = this.getEdgeFocusState();
                const nodeId = params?.node;
                const evt = params?.event?.event || params?.event?.srcEvent || params?.event;
                const hasMod = !!(evt && (evt.metaKey || evt.ctrlKey));
                state.lastHoverNodeId = nodeId || null;
                if (!hasMod) {
                    if (state.hoverNodeId) {
                        this.clearNodeHover();
                    }
                    return;
                }
                if (nodeId) {
                    this.setNodeHover(nodeId);
                }
            };
            this._onNodeBlur = () => {
                const state = this.getEdgeFocusState();
                state.lastHoverNodeId = null;
                this.clearNodeHover();
            };
            this._onEdgeContext = (params) => {
                const evt = params?.event?.event || params?.event?.srcEvent || params?.event;
                const pointer = params?.pointer?.DOM;
                if (!pointer) return;
                const nodeId = network.getNodeAt(pointer);
                if (nodeId) {
                    if (evt && typeof evt.preventDefault === 'function') {
                        evt.preventDefault();
                    }
                    if (this.visNetwork) {
                        this.visNetwork.unselectAll();
                    }
                    this.showNodeContextMenu(evt, nodeId);
                    return;
                }
                const edgeId = network.getEdgeAt(pointer);
                if (!edgeId) return;
                if (evt && typeof evt.preventDefault === 'function') {
                    evt.preventDefault();
                }
                this.showEdgeContextMenu(evt, edgeId);
            };
            network.on('hoverEdge', this._onEdgeHover);
            network.on('blurEdge', this._onEdgeBlur);
            network.on('hoverNode', this._onNodeHover);
            network.on('blurNode', this._onNodeBlur);
            network.on('oncontext', this._onEdgeContext);
            this._edgeHoverKeyDown = (e) => {
                if (!(e.metaKey || e.ctrlKey)) return;
                const view = this.getEl(this.ids.view);
                if (!view || !view.classList.contains('active')) return;
                const state = this.getEdgeFocusState();
                const nodeId = state.lastHoverNodeId;
                if (nodeId) {
                    if (state.hoverNodeId !== nodeId) {
                        this.setNodeHover(nodeId);
                    }
                    return;
                }
                const edgeId = state.lastHoverEdgeId;
                if (!edgeId) return;
                if (state.hoverEdgeId === edgeId) return;
                this.setEdgeHover(edgeId);
            };
            this._edgeHoverKeyUp = (e) => {
                if (e.key !== 'Meta' && e.key !== 'Control') return;
                const view = this.getEl(this.ids.view);
                if (!view || !view.classList.contains('active')) return;
                if (this.getEdgeFocusState().hoverEdgeId) {
                    this.clearEdgeHover();
                }
                if (this.getEdgeFocusState().hoverNodeId) {
                    this.clearNodeHover();
                }
            };
            document.addEventListener('keydown', this._edgeHoverKeyDown);
            document.addEventListener('keyup', this._edgeHoverKeyUp);
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

        adjustZoom(delta, source = 'button') {
            if (!this.visNetwork) return;
            const current = this.visNetwork.getScale();
            const next = this.clampZoom(current + delta);
            this.moveZoomTo(next, source);
            this.syncZoomSlider();
        }

        getZoomAnimDuration(delta, source) {
            const normalized = Math.min(1, Math.max(0, delta / 0.6));
            const eased = 0.5 - 0.5 * Math.cos(Math.PI * normalized);
            const base = source === 'slider' ? 520 : 680;
            const span = source === 'slider' ? 980 : 1320;
            return Math.round(base + span * eased);
        }

        moveZoomTo(scale, source = 'button') {
            if (!this.visNetwork) return;
            const current = this.visNetwork.getScale();
            const delta = Math.abs(scale - current);
            const duration = this.getZoomAnimDuration(delta, source);
            this.visNetwork.moveTo({
                scale,
                animation: {
                    duration,
                    easingFunction: this.zoomAnimEasing
                }
            });
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
        renderVisNetworkFromVisData,
        renderVisNetworkFromJson,
        debugNodeSize,
        getSizeStats
    };
    global.WosVisManager = WosVisManager;
})(window);
