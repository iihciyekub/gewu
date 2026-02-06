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
            if (!node.color) {
                node.color = {
                    background: '#f8fafc',
                    border,
                    highlight: { background: '#ffffff', border: 'rgba(255,255,255,0.9)' },
                    hover: { background: '#ffffff', border: 'rgba(255,255,255,0.8)' }
                };
            }
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
                font: { size: 14, color: '#111', align: 'center', vadjust: 0 },
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
                    font: { size: 11, color: '#111', align: 'center', vadjust: 0 },
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
                font: {
                    align: 'center',
                    vadjust: 0
                },
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
            if (network?._wosNodeModeActive) return;
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
        labelEl.style.transform = `translate(${domPos.x}px, ${domPos.y}px) translate(-50%, -50%)`;
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
        label.style.textAlign = 'center';
        label.style.display = 'flex';
        label.style.alignItems = 'center';
        label.style.justifyContent = 'center';
        if (style.fontSize) label.style.fontSize = `${style.fontSize}px`;
        if (style.fontWeight) label.style.fontWeight = String(style.fontWeight);
        if (style.textColor) label.style.color = style.textColor;
        if (style.borderColor) label.style.borderColor = style.borderColor;
        const borderWidth = Number(style.borderWidth);
        if (Number.isFinite(borderWidth) && borderWidth >= 0) {
            label.style.borderWidth = `${borderWidth}px`;
            label.style.borderStyle = 'solid';
        } else {
            label.style.borderWidth = '';
            label.style.borderStyle = '';
        }
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

    function buildSelectedNodeColor(baseColor, accentColor) {
        const accent = normalizeVisColor(accentColor);
        if (!accent) return baseColor;
        if (!baseColor || typeof baseColor === 'string') {
            const border = typeof baseColor === 'string' ? baseColor : accent;
            return {
                background: accent,
                border,
                highlight: { background: accent, border },
                hover: { background: accent, border }
            };
        }
        const border = baseColor.border || baseColor.background || accent;
        const highlight = baseColor.highlight || {};
        const hover = baseColor.hover || {};
        return {
            ...baseColor,
            background: accent,
            border,
            highlight: {
                ...highlight,
                background: accent,
                border: highlight.border || border
            },
            hover: {
                ...hover,
                background: accent,
                border: hover.border || border
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

    class VisModeStateStore {
        constructor(manager, options = {}) {
            this.manager = manager;
            this.key = options.key || 'vis-mode-state';
            this.state = { modes: {}, settings: null, meta: null };
            this._loaded = false;
        }

        async load() {
            if (this._loaded) return this.state;
            this._loaded = true;
            const storage = this.manager?.app?.projectStorage;
            if (storage) {
                try {
                    const data = await storage.load(this.key);
                    if (data && typeof data === 'object') {
                        const existing = this.state || {};
                        this.state = {
                            ...data,
                            ...existing,
                            modes: { ...(data.modes || {}), ...(existing.modes || {}) },
                            settings: existing.settings ?? data.settings ?? null,
                            meta: existing.meta ?? data.meta ?? null
                        };
                        return this.state;
                    }
                } catch (_e) { }
            }
            try {
                const raw = localStorage.getItem(this.key);
                if (raw) {
                    const data = JSON.parse(raw);
                    const existing = this.state || {};
                    this.state = {
                        ...data,
                        ...existing,
                        modes: { ...(data.modes || {}), ...(existing.modes || {}) },
                        settings: existing.settings ?? data.settings ?? null,
                        meta: existing.meta ?? data.meta ?? null
                    };
                }
            } catch (_e) { }
            return this.state;
        }

        async save() {
            const storage = this.manager?.app?.projectStorage;
            if (storage) {
                try {
                    await storage.save(this.key, this.state);
                } catch (_e) { }
            }
            try {
                localStorage.setItem(this.key, JSON.stringify(this.state));
            } catch (_e) { }
        }

        async saveSettings(payload) {
            this.state.settings = payload || null;
            await this.save();
        }

        applySettings() {
            if (this.state.settings) {
                this.manager.applyLabelPanelSettingsPayload(this.state.settings);
            }
        }

        capture(mode) {
            const manager = this.manager;
            if (!manager?.visNetwork) return;
            const dataset = manager.visNetwork?.body?.data;
            if (!dataset?.nodes || !dataset?.edges) return;
            if (!['normal', 'node', 'edge'].includes(mode)) return;
            const nodes = dataset.nodes.get();
            const edges = dataset.edges.get();
            const positions = typeof manager.visNetwork.getPositions === 'function'
                ? manager.visNetwork.getPositions()
                : {};
            // 保持官方提供的完整对象数据，不要自己构建，避免丢失数据
            const nodeSnapshots = nodes.map((node) => {
                const pos = positions?.[node.id];
                return {
                    ...node,  // 保留所有官方属性
                    color: node.color != null ? cloneVisColor(node.color) : node.color,
                    icon: node.icon != null ? cloneVisColor(node.icon) : node.icon,
                    font: node.font != null ? cloneVisColor(node.font) : node.font,
                    labelStyle: node.labelStyle != null ? cloneVisColor(node.labelStyle) : node.labelStyle,
                    x: pos?.x ?? node.x,
                    y: pos?.y ?? node.y,
                    fixed: node.fixed ?? null
                };
            });
            // 保持官方提供的完整对象数据，不要自己构建，避免丢失数据
            const edgeSnapshots = edges.map((edge) => ({
                ...edge,  // 保留所有官方属性
                color: edge.color != null ? cloneVisColor(edge.color) : edge.color
            }));
            const state = manager.getEdgeFocusState();
            const focusMapEntries = state.customFocusMap
                ? Array.from(state.customFocusMap.entries()).map(([key, value]) => ([
                    key,
                    value instanceof Set ? Array.from(value) : Array.from(value || [])
                ]))
                : [];
            const depthMapEntries = state.customFocusDepthMap
                ? Array.from(state.customFocusDepthMap.entries())
                : [];
            const lockedEdges = state.lockedEdgeIds ? Array.from(state.lockedEdgeIds) : [];
            this.state.modes[mode] = {
                nodes: nodeSnapshots,
                edges: edgeSnapshots,
                edgeFocusFadeAlpha: manager.edgeFocusFadeAlpha,
                customFocusAlpha: state.customFocusAlpha ?? null,
                customFocusDepth: state.customFocusDepth ?? null,
                customFocusRootId: state.customFocusRootId ?? null,
                customFocusMapEntries: focusMapEntries,
                customFocusDepthMapEntries: depthMapEntries,
                selectedNodeIds: Array.from(manager.selectedNodeIds || []),
                lockedEdgeIds: lockedEdges
            };
            this.state.meta = { nodeCount: nodes.length, edgeCount: edges.length };
            this.save();
        }

        apply(mode) {
            const manager = this.manager;
            if (!manager?.visNetwork) return;
            if (!['normal', 'node', 'edge'].includes(mode)) return;
            const snapshot = this.state.modes?.[mode];
            if (!snapshot) return;
            const dataset = manager.visNetwork?.body?.data;
            if (!dataset?.nodes || !dataset?.edges) return;
            const nodes = dataset.nodes.get();
            const edges = dataset.edges.get();
            if (this.state.meta) {
                if (nodes.length !== this.state.meta.nodeCount || edges.length !== this.state.meta.edgeCount) {
                    return;
                }
            }
            // 使用完整的对象数据进行恢复，保持所有属性
            const nodeUpdates = snapshot.nodes.map((node) => {
                return {
                    ...node,  // 保留所有官方属性
                    color: node.color != null ? cloneVisColor(node.color) : node.color,
                    icon: node.icon != null ? cloneVisColor(node.icon) : node.icon,
                    font: node.font != null ? cloneVisColor(node.font) : node.font,
                    labelStyle: node.labelStyle != null ? cloneVisColor(node.labelStyle) : node.labelStyle
                };
            });
            // 使用完整的对象数据进行恢复，保持所有属性
            const edgeUpdates = snapshot.edges.map((edge) => ({
                ...edge,  // 保留所有官方属性
                color: edge.color != null ? cloneVisColor(edge.color) : edge.color
            }));
            if (nodeUpdates.length) dataset.nodes.update(nodeUpdates);
            if (edgeUpdates.length) dataset.edges.update(edgeUpdates);
            if (Number.isFinite(snapshot.edgeFocusFadeAlpha)) {
                manager.edgeFocusFadeAlpha = snapshot.edgeFocusFadeAlpha;
            }
            const state = manager.getEdgeFocusState();
            state.baseNodeColors.clear();
            state.baseEdgeColors.clear();
            state.dirty = true;
            // When applying normal mode, preserve customFocus settings from node mode
            // so that Cmd+hover uses the same depth/opacity configured in node mode toolbar.
            // For node/edge modes, restore from their snapshots.
            if (mode !== 'normal') {
                if (Number.isFinite(snapshot.customFocusAlpha)) {
                    state.customFocusAlpha = snapshot.customFocusAlpha;
                }
                if (Number.isFinite(snapshot.customFocusDepth)) {
                    state.customFocusDepth = snapshot.customFocusDepth;
                }
                state.customFocusDepthMap = new Map(snapshot.customFocusDepthMapEntries || []);
            }
            state.customFocusRootId = snapshot.customFocusRootId ?? null;
            state.customFocusMap = new Map(
                (snapshot.customFocusMapEntries || []).map(([key, value]) => [key, new Set(value || [])])
            );
            manager.selectedNodeIds = new Set(snapshot.selectedNodeIds || []);
            state.lockedEdgeIds = new Set(snapshot.lockedEdgeIds || []);
            if (mode === 'node') {
                if (state.customFocusMap.size) {
                    state.customFocusActive = true;
                    manager.rebuildCustomFocusFromMap();
                    if (manager.visNetwork && manager.selectedNodeIds.size) {
                        manager.visNetwork.selectNodes(Array.from(manager.selectedNodeIds));
                    }
                } else {
                    state.customFocusActive = false;
                    manager.applyEdgeFocusDisplay();
                }
            }
            if (mode === 'edge') {
                if (manager.visNetwork && state.lockedEdgeIds.size) {
                    manager.visNetwork.selectEdges(Array.from(state.lockedEdgeIds));
                }
                manager.applyEdgeFocusDisplay();
            }
            manager.markEdgeFocusDirty();
            manager.applyEdgeFocusDisplay();
            manager._labelThresholdBaseDirty = true;
            manager.applyLabelThresholdDimming();
            manager.updateModeToolbar();
        }
    }

    function buildNodeBorderColor(baseColor, borderColor) {
        const border = normalizeVisColor(borderColor);
        if (!border) return baseColor;
        if (!baseColor || typeof baseColor === 'string') {
            const background = typeof baseColor === 'string' ? baseColor : border;
            return {
                background,
                border,
                highlight: { background, border },
                hover: { background, border }
            };
        }
        const highlight = baseColor.highlight || {};
        const hover = baseColor.hover || {};
        return {
            ...baseColor,
            border,
            highlight: {
                ...highlight,
                border
            },
            hover: {
                ...hover,
                border
            }
        };
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
                labelMinSlider: options.labelMinSliderId || 'visLabelMinSlider',
                labelMinDimSlider: options.labelMinDimSliderId || 'visLabelMinDimSlider',
                relatedMinSlider: options.relatedMinSliderId || 'visRelatedMinSlider',
                relatedMinDimSlider: options.relatedMinDimSliderId || 'visRelatedMinDimSlider',
                // Node size/border settings UI removed
                nodeContextColorInput: options.nodeContextColorInputId || 'visNodeContextColorInput',
                nodeContextBorderColorInput: options.nodeContextBorderColorInputId || 'visNodeContextBorderColorInput',
                nodeContextStrokeColorInput: options.nodeContextStrokeColorInputId || 'visNodeContextStrokeColorInput',
                edgeColorInput: options.edgeColorInputId || 'visEdgeColorInput',
                edgeLabelFontSizeInput: options.edgeLabelFontSizeInputId || 'visEdgeLabelFontSizeInput',
                edgeLabelColorInput: options.edgeLabelColorInputId || 'visEdgeLabelColorInput',
                edgeLabelStrokeWidthInput: options.edgeLabelStrokeWidthInputId || 'visEdgeLabelStrokeWidthInput',
                edgeLabelStrokeColorInput: options.edgeLabelStrokeColorInputId || 'visEdgeLabelStrokeColorInput',
                edgeLabelBgColorInput: options.edgeLabelBgColorInputId || 'visEdgeLabelBgColorInput',
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
                exportPdfBtn: options.exportPdfBtnId || 'visExportPdfBtn',
                modeToolbar: options.modeToolbarId || 'visModeToolbar',
                modeLabel: options.modeLabelId || 'visModeLabel',
                modeNodeGroup: options.modeNodeGroupId || 'visModeNodeGroup',
                modeEdgeGroup: options.modeEdgeGroupId || 'visModeEdgeGroup',
                modeNodeInput: options.modeNodeInputId || 'visModeNodeInput',
                modeNodeColorInput: options.modeNodeColorInputId || 'visModeNodeColorInput'
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
            this.labelSizeScale = 0.5;
            this.labelMinCitations = 0;
            this.labelFieldOptions = [];
            this.labelSuggestIndex = -1;
            this.labelValueMap = new Map();
            this.wosDataIndex = null;
            this.wosDataIndexSource = null;
            this.labelFieldsSelected = [];
            this.labelWeight = 500;
            this.labelFontMin = 5;
            this.labelFontMax = 20;
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
            this.edgeWidthScale = 1.0;
            this.edgeSmooth = 100;
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
            this.edgeFocusFadeAlpha = 0.125;
            this.edgeHoverLabelEnabled = false;
            this.edgeLabelEnabled = false;
            this._edgeCustomFonts = new Map();
            this._edgeCustomColors = new Map();
            this._edgeCustomWidths = new Set();
            this.wosNodeIndex = null;
            this.wosNodeIndexSource = null;
            this.selectedNodeColor = '#f59e0b';
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
            this._edgeBaseArrows = null;  // 保存边的原始箭头信息
            this.settingsAutoSave = false;
            this._visViewReady = false;
            this._nodeContextColorTarget = null;
            this._nodeContextColorAnchor = null;
            this._nodeStylePopover = null;
            this._nodeStyleApplyAll = false;
            this._nodeSizePopover = null;
            this._nodeBasePopover = null;
            this._nodePopoverHover = false;
            this._nodePopoverCloseTimer = null;
            this._skipNodeColorApply = false;
            this._toolbarMode = null;
            this.selectedNodeIds = new Set();
            this._edgeModeEnabled = false;
            this._tempToolbarMode = null;
            this._restoreListOpen = false;
            this._modeStyleSnapshot = null;
            this._nodeModeOriginalColors = new Map();
            this._suspendedEdgeFocus = null;
            this._nodeModeStyleSnapshot = null;
            this._modeStoreLoaded = false;
            this.modeStateStore = new VisModeStateStore(this, { key: options.modeStateKey || 'vis-mode-state' });
            this._modeStoreReady = null;
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
            const labelMinSlider = this.getEl(this.ids.labelMinSlider);
            const labelMinDimSlider = this.getEl(this.ids.labelMinDimSlider);
            const relatedMinSlider = this.getEl(this.ids.relatedMinSlider);
            const relatedMinDimSlider = this.getEl(this.ids.relatedMinDimSlider);
            const nodeContextColorInput = this.getEl(this.ids.nodeContextColorInput);
            const nodeContextBorderColorInput = this.getEl(this.ids.nodeContextBorderColorInput);
            const nodeContextStrokeColorInput = this.getEl(this.ids.nodeContextStrokeColorInput);
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
            this.bindModeToolbar();

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
                    this.updateModeToolbar();
                });
            }
            if (zoomPanBtn) {
                zoomPanBtn.addEventListener('click', () => {
                    this.isPanOnly = !this.isPanOnly;
                    if (this.isPanOnly) this.isLocked = false;
                    this.applyInteractionMode();
                    zoomPanBtn.classList.toggle('is-active', this.isPanOnly);
                    if (zoomLockBtn) zoomLockBtn.classList.toggle('is-active', this.isLocked);
                    this.updateModeToolbar();
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
            this.updateModeToolbar();
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
            if (global.Coloris && !this._colorisInit) {
                this._colorisInit = true;
                try {
                    global.Coloris({
                        el: '#visModeNodeColorInput',
                        alpha: true,
                        format: 'hex',
                        formatToggle: false,
                        forceAlpha: true
                    });
                    global.Coloris({
                        el: '#visNodeContextColorInput',
                        alpha: true,
                        format: 'hex',
                        formatToggle: false,
                        wrap: false,
                        forceAlpha: true
                    });
                    global.Coloris({
                        el: '#visNodeContextBorderColorInput',
                        alpha: true,
                        format: 'hex',
                        formatToggle: false,
                        wrap: false,
                        forceAlpha: true
                    });
                    global.Coloris({
                        el: '#visNodeContextStrokeColorInput',
                        alpha: true,
                        format: 'hex',
                        formatToggle: false,
                        wrap: false,
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
                } catch (_e) {
                    // ignore color picker init issues
                }
            }
            if (nodeContextColorInput && !nodeContextColorInput.dataset.visBound) {
                nodeContextColorInput.dataset.visBound = '1';
                const applyContextColor = () => {
                    const targetId = this._nodeContextColorTarget;
                    if (!targetId) return;
                    const next = String(nodeContextColorInput.value || '').trim();
                    if (!next) return;
                    if (this._nodeStyleApplyAll) {
                        this.nodeColor = next;
                        this.applyNodeColor();
                        this.queuePersistSettings();
                        return;
                    }
                    this.applyNodeColorForId(targetId, next);
                };
                nodeContextColorInput.addEventListener('input', applyContextColor);
                nodeContextColorInput.addEventListener('change', applyContextColor);
            }
            if (nodeContextBorderColorInput && !nodeContextBorderColorInput.dataset.visBound) {
                nodeContextBorderColorInput.dataset.visBound = '1';
                const applyContextBorder = () => {
                    const targetId = this._nodeContextColorTarget;
                    if (!targetId) return;
                    const next = String(nodeContextBorderColorInput.value || '').trim();
                    if (!next) return;
                    if (this._nodeStyleApplyAll) {
                        this.nodeBorderColor = next;
                        this.applyNodeBorderColor();
                        this.queuePersistSettings();
                        return;
                    }
                    this.applyNodeBorderColorForId(targetId, next);
                };
                nodeContextBorderColorInput.addEventListener('input', applyContextBorder);
                nodeContextBorderColorInput.addEventListener('change', applyContextBorder);
            }
            if (nodeContextStrokeColorInput && !nodeContextStrokeColorInput.dataset.visBound) {
                nodeContextStrokeColorInput.dataset.visBound = '1';
                const applyContextStroke = () => {
                    const targetId = this._nodeContextColorTarget;
                    if (!targetId) return;
                    const next = String(nodeContextStrokeColorInput.value || '').trim();
                    if (!next) return;
                    if (this._nodeStyleApplyAll) {
                        this.nodeOuterBorderColor = next;
                        if (this.visNetwork) this.visNetwork.redraw();
                        this.queuePersistSettings();
                        return;
                    }
                    this.applyNodeOuterBorderColorForId(targetId, next);
                };
                nodeContextStrokeColorInput.addEventListener('input', applyContextStroke);
                nodeContextStrokeColorInput.addEventListener('change', applyContextStroke);
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
            this.updateModeToolbar();
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
                if (e.key === 'Escape') {
                    if (!isVisActive()) return;
                    if (this._toolbarMode === 'node' || this._toolbarMode === 'edge') {
                        e.preventDefault();
                        this.setToolbarMode(null);
                        return;
                    }
                }
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

        getSelectedNodeId() {
            if (!this.visNetwork || typeof this.visNetwork.getSelectedNodes !== 'function') return null;
            const selected = this.visNetwork.getSelectedNodes() || [];
            return selected.length ? selected[0] : null;
        }

        getSelectedEdgeId() {
            if (!this.visNetwork || typeof this.visNetwork.getSelectedEdges !== 'function') return null;
            const selected = this.visNetwork.getSelectedEdges() || [];
            return selected.length ? selected[0] : null;
        }

        setToolbarMode(mode, { nodeId = null, edgeId = null, select = false } = {}) {
            const prevMode = this._toolbarMode || 'normal';
            const nextMode = mode || 'normal';
            this._toolbarMode = mode || null;
            if (!this.visNetwork) {
                this.updateModeToolbar();
                return;
            }
            this._edgeModeEnabled = this._toolbarMode === 'edge';
            this.visNetwork._wosNodeModeActive = this._toolbarMode === 'node';
            if (this.modeStateStore) {
                const applyForMode = () => {
                    this.modeStateStore.capture(prevMode);
                    this.modeStateStore.apply(nextMode);
                };
                if (this._modeStoreReady) {
                    this._modeStoreReady.then(() => {
                        if ((this._toolbarMode || 'normal') !== nextMode) return;
                        applyForMode();
                    });
                } else {
                    applyForMode();
                }
            }
            if (!this._toolbarMode) {
                if (prevMode !== 'edge') {
                    this.visNetwork.unselectAll?.();
                }
                this.updateModeToolbar();
                return;
            }
            if (this._toolbarMode === 'edge') {
                this._edgeModeEnabled = true;
                this.restoreSuspendedEdgeFocus();
            }
            if (select) {
                if (mode === 'node' && nodeId) {
                    this.visNetwork.selectNodes([nodeId]);
                }
                if (mode === 'edge' && edgeId) {
                    this.visNetwork.selectEdges([edgeId]);
                }
            }
            this.updateModeToolbar();
        }

        bindModeToolbar() {
            const toolbar = this.getEl(this.ids.modeToolbar);
            if (!toolbar || toolbar.dataset.visBound) return;
            toolbar.dataset.visBound = '1';
            toolbar.addEventListener('click', (e) => {
                const stepperBtn = e.target.closest('.vis-mode-stepper-btn');
                if (stepperBtn && toolbar.contains(stepperBtn)) {
                    const wrap = stepperBtn.closest('.vis-mode-stepper');
                    const action = wrap ? wrap.dataset.action : '';
                    const delta = Number(stepperBtn.dataset.step) || 0;
                    if (action) {
                        this.handleModeToolbarStepper(action, delta);
                        return;
                    }
                }
                const btn = e.target.closest('button[data-action]');
                if (!btn || !toolbar.contains(btn)) return;
                const action = btn.dataset.action;
                if (!action) return;
                this.handleModeToolbarAction(action);
            });
            toolbar.addEventListener('input', (e) => {
                const input = e.target;
                if (!(input instanceof HTMLInputElement)) return;
                const wrap = input.closest('.vis-mode-slider');
                if (!wrap || !toolbar.contains(wrap)) return;
                const action = wrap.dataset.action;
                if (!action) return;
                const value = Number(input.value);
                this.handleModeToolbarSlider(action, Number.isFinite(value) ? value : 0);
            });
            toolbar.addEventListener('wheel', (e) => {
                const input = e.target.closest('.vis-mode-slider input[type="range"]');
                if (!input || !toolbar.contains(input)) return;
                if (input.disabled) return;
                e.preventDefault();
                const step = Number(input.step) || 1;
                const min = Number(input.min) || 0;
                const max = Number(input.max) || 1;
                const delta = e.deltaY < 0 ? step : -step;
                const current = Number(input.value) || 0;
                const next = Math.max(min, Math.min(max, current + delta));
                input.value = String(next);
                const wrap = input.closest('.vis-mode-slider');
                const action = wrap ? wrap.dataset.action : '';
                this.handleModeToolbarSlider(action, next);
            }, { passive: false });
            const nodeInput = this.getEl(this.ids.modeNodeInput);
            if (nodeInput && !nodeInput.dataset.visBound) {
                nodeInput.dataset.visBound = '1';
                nodeInput.addEventListener('keydown', (e) => {
                    if (e.key !== 'Enter') return;
                    if (e.shiftKey) return;
                    e.preventDefault();
                    const value = nodeInput.value || '';
                    this.handleModeToolbarNodeInput(value);
                });
            }
            const colorInput = this.getEl(this.ids.modeNodeColorInput);
            if (colorInput && !colorInput.dataset.visBound) {
                colorInput.dataset.visBound = '1';
                colorInput.value = this.selectedNodeColor || colorInput.value;
                const applyColor = () => {
                    const next = String(colorInput.value || '').trim();
                    if (!next) return;
                    this.applyNodeInputColor(next);
                };
                colorInput.addEventListener('input', applyColor);
                colorInput.addEventListener('change', applyColor);
            }
        }

        resolveNodeIdFromInput(raw) {
            if (!this.visNetwork) return '';
            const text = String(raw || '').trim();
            if (!text) return '';
            const dataset = this.visNetwork?.body?.data?.nodes;
            if (!dataset || typeof dataset.get !== 'function') return '';
            const normalized = this.normalizeWosId(text);
            if (dataset.get(normalized)) return normalized;
            if (dataset.get(text)) return text;
            const nodes = dataset.get();
            for (const node of nodes) {
                if (!node || !node.id) continue;
                if (this.normalizeWosId(node.id) === normalized) {
                    return node.id;
                }
            }
            return '';
        }

        parseNodeInputIds(raw) {
            const text = String(raw || '').trim();
            if (!text) return { validIds: [], missingIds: [] };
            const tokens = text.split(/[\s,;]+/).map(t => t.trim()).filter(Boolean);
            const validIds = [];
            const missingIds = [];
            const seen = new Set();
            tokens.forEach((token) => {
                const resolved = this.resolveNodeIdFromInput(token);
                if (resolved && !seen.has(resolved)) {
                    seen.add(resolved);
                    validIds.push(resolved);
                } else if (!resolved) {
                    missingIds.push(token);
                }
            });
            return { validIds, missingIds };
        }

        triggerToolbarShake() {
            const toolbar = this.getEl(this.ids.modeToolbar);
            if (!toolbar) return;
            toolbar.classList.remove('is-shake');
            void toolbar.offsetWidth;
            toolbar.classList.add('is-shake');
            const cleanup = () => {
                toolbar.classList.remove('is-shake');
                toolbar.removeEventListener('animationend', cleanup);
            };
            toolbar.addEventListener('animationend', cleanup);
        }

        captureModeStyleSnapshot() {
            if (this.modeStateStore) {
                this.modeStateStore.capture('normal');
            }
        }

        restoreModeStyleSnapshot() {
            if (this.modeStateStore) {
                this.modeStateStore.apply('normal');
            }
            this._nodeModeOriginalColors.clear();
        }

        captureNodeModeStyleSnapshot() {
            if (this.modeStateStore) {
                this.modeStateStore.capture('node');
            }
        }

        restoreNodeModeStyleSnapshot() {
            if (this.modeStateStore) {
                this.modeStateStore.apply('node');
            }
        }

        updateVisDataNodeColor(nodeId, color) {
            const nodes = this.visNetworkData?.nodes;
            if (!Array.isArray(nodes)) return;
            const target = nodes.find((node) => node && node.id === nodeId);
            if (target) target.color = cloneVisColor(color);
        }

        updateVisDataNodeStyle(nodeId, updates) {
            const nodes = this.visNetworkData?.nodes;
            if (!Array.isArray(nodes)) return;
            const target = nodes.find((node) => node && node.id === nodeId);
            if (!target) return;
            Object.assign(target, updates || {});
        }

        applyNodeShapeForId(nodeId, shape) {
            if (!this.visNetwork || !nodeId || !shape) return;
            const dataset = this.visNetwork?.body?.data?.nodes;
            if (!dataset || typeof dataset.get !== 'function') return;
            const node = dataset.get(nodeId);
            if (!node) return;
            dataset.update({ id: nodeId, shape });
            this.updateVisDataNodeStyle(nodeId, { shape });
            this.markEdgeFocusDirty();
            this.applyEdgeFocusDisplay();
            this._labelThresholdBaseDirty = true;
            this.applyLabelThresholdDimming();
        }

        applyNodeShapeForAll(shape) {
            if (!this.visNetwork || !shape) return;
            const dataset = this.visNetwork?.body?.data?.nodes;
            if (!dataset || typeof dataset.get !== 'function') return;
            const nodes = dataset.get() || [];
            if (!nodes.length) return;
            const updates = nodes.map((node) => ({ id: node.id, shape }));
            dataset.update(updates);
            const visNodes = Array.isArray(this.visNetworkData?.nodes) ? this.visNetworkData.nodes : [];
            visNodes.forEach((node) => {
                if (node && node.id != null) node.shape = shape;
            });
            this.markEdgeFocusDirty();
            this.applyEdgeFocusDisplay();
            this._labelThresholdBaseDirty = true;
            this.applyLabelThresholdDimming();
        }

        applyNodeIconForId(nodeId, iconPayload) {
            if (!this.visNetwork || !nodeId || !iconPayload) return;
            const dataset = this.visNetwork?.body?.data?.nodes;
            if (!dataset || typeof dataset.get !== 'function') return;
            const node = dataset.get(nodeId);
            if (!node) return;
            dataset.update({ id: nodeId, shape: 'icon', icon: iconPayload });
            this.updateVisDataNodeStyle(nodeId, { shape: 'icon', icon: iconPayload });
            this.markEdgeFocusDirty();
            this.applyEdgeFocusDisplay();
            this._labelThresholdBaseDirty = true;
            this.applyLabelThresholdDimming();
        }

        applyNodeIconForAll(iconPayload) {
            if (!this.visNetwork || !iconPayload) return;
            const dataset = this.visNetwork?.body?.data?.nodes;
            if (!dataset || typeof dataset.get !== 'function') return;
            const nodes = dataset.get() || [];
            if (!nodes.length) return;
            const updates = nodes.map((node) => ({ id: node.id, shape: 'icon', icon: iconPayload }));
            dataset.update(updates);
            const visNodes = Array.isArray(this.visNetworkData?.nodes) ? this.visNetworkData.nodes : [];
            visNodes.forEach((node) => {
                if (node && node.id != null) {
                    node.shape = 'icon';
                    node.icon = iconPayload;
                }
            });
            this.markEdgeFocusDirty();
            this.applyEdgeFocusDisplay();
            this._labelThresholdBaseDirty = true;
            this.applyLabelThresholdDimming();
        }

        buildNodeIconPayload(pop, node) {
            if (!pop) return null;
            const input = pop.querySelector('[data-role="iconInput"]');
            const preset = pop.querySelector('[data-role="iconPreset"]');
            const sizeInput = pop.querySelector('[data-role="iconSize"]');
            const raw = String((input && input.value) || (preset && preset.value) || '').trim();
            if (!raw) return null;
            const normalized = raw
                .replace(/^\\u/i, '')
                .replace(/^u/i, '')
                .replace(/^0x/i, '')
                .replace(/[^0-9a-f]/gi, '');
            if (!normalized) return null;
            const codePoint = Number.parseInt(normalized, 16);
            if (!Number.isFinite(codePoint)) return null;
            const size = Number(sizeInput?.value);
            const color = node?.color?.border || '#111111';
            return {
                face: 'FontAwesome',
                code: String.fromCharCode(codePoint),
                size: Number.isFinite(size) ? size : 26,
                color
            };
        }

        applyNodeColorForId(nodeId, color) {
            if (!this.visNetwork || !nodeId) return;
            const dataset = this.visNetwork?.body?.data?.nodes;
            if (!dataset || typeof dataset.get !== 'function') return;
            const node = dataset.get(nodeId);
            if (!node) return;
            const nextColor = buildSelectedNodeColor(node.color, color);
            dataset.update({ id: nodeId, color: nextColor });
            this.updateVisDataNodeColor(nodeId, nextColor);
            if (this._nodeModeOriginalColors.has(nodeId)) {
                this._nodeModeOriginalColors.set(nodeId, cloneVisColor(nextColor));
            }
            const state = this.getEdgeFocusState();
            if (state?.baseNodeColors && state.baseNodeColors.has(nodeId)) {
                state.baseNodeColors.set(nodeId, cloneVisColor(nextColor));
            }
            this.markEdgeFocusDirty();
            this.applyEdgeFocusDisplay();
            this._labelThresholdBaseDirty = true;
            this.applyLabelThresholdDimming();
        }

        applyNodeBorderColorForId(nodeId, color) {
            if (!this.visNetwork || !nodeId) return;
            const dataset = this.visNetwork?.body?.data?.nodes;
            if (!dataset || typeof dataset.get !== 'function') return;
            const node = dataset.get(nodeId);
            if (!node) return;
            const nextColor = buildNodeBorderColor(node.color, color);
            dataset.update({ id: nodeId, color: nextColor });
            this.updateVisDataNodeColor(nodeId, nextColor);
            if (this._nodeModeOriginalColors.has(nodeId)) {
                this._nodeModeOriginalColors.set(nodeId, cloneVisColor(nextColor));
            }
            const state = this.getEdgeFocusState();
            if (state?.baseNodeColors && state.baseNodeColors.has(nodeId)) {
                state.baseNodeColors.set(nodeId, cloneVisColor(nextColor));
            }
            this.markEdgeFocusDirty();
            this.applyEdgeFocusDisplay();
            this._labelThresholdBaseDirty = true;
            this.applyLabelThresholdDimming();
        }

        applyNodeOuterBorderColorForId(nodeId, color) {
            if (!this.visNetwork || !nodeId) return;
            const dataset = this.visNetwork?.body?.data?.nodes;
            if (!dataset || typeof dataset.get !== 'function') return;
            const node = dataset.get(nodeId);
            if (!node) return;
            const next = normalizeVisColor(color) || color;
            dataset.update({ id: nodeId, outerBorderColor: next });
            this.updateVisDataNodeStyle(nodeId, { outerBorderColor: next });
            if (this.visNetwork) this.visNetwork.redraw();
        }

        applyNodeBorderWidthForId(nodeId, width) {
            if (!this.visNetwork || !nodeId) return;
            const dataset = this.visNetwork?.body?.data?.nodes;
            if (!dataset || typeof dataset.get !== 'function') return;
            const next = Number(width);
            if (!Number.isFinite(next) || next < 0) return;
            dataset.update({ id: nodeId, borderWidth: next });
            this.updateVisDataNodeStyle(nodeId, { borderWidth: next });
            if (this.visNetwork) this.visNetwork.redraw();
        }

        applyNodeOuterBorderWidthForId(nodeId, width) {
            if (!this.visNetwork || !nodeId) return;
            const dataset = this.visNetwork?.body?.data?.nodes;
            if (!dataset || typeof dataset.get !== 'function') return;
            const next = Number(width);
            if (!Number.isFinite(next) || next < 0) return;
            dataset.update({ id: nodeId, outerBorderWidth: next });
            this.updateVisDataNodeStyle(nodeId, { outerBorderWidth: next });
            if (this.visNetwork) this.visNetwork.redraw();
        }

        openNodeContextColorPicker(nodeId, mode = 'fill') {
            if (!nodeId) return;
            const input = mode === 'stroke'
                ? this.getEl(this.ids.nodeContextStrokeColorInput)
                : mode === 'border'
                    ? this.getEl(this.ids.nodeContextBorderColorInput)
                    : this.getEl(this.ids.nodeContextColorInput);
            if (!input) return;
            if (this._nodeContextColorAnchor) {
                const { x, y } = this._nodeContextColorAnchor;
                input.style.left = `${Number(x) || 0}px`;
                input.style.top = `${Number(y) || 0}px`;
            }
            const dataset = this.visNetwork?.body?.data?.nodes;
            const node = dataset && typeof dataset.get === 'function' ? dataset.get(nodeId) : null;
            const seed = mode === 'stroke'
                ? (node?.outerBorderColor || this.nodeOuterBorderColor || '#ffffff')
                : mode === 'border'
                    ? (node?.color?.border || this.nodeBorderColor || '#111111')
                    : (typeof node?.color === 'string'
                        ? node.color
                        : (node?.color?.background || this.nodeColor || '#ffffff'));
            this._nodeContextColorTarget = nodeId;
            this.setColorInputValueSilent(input, seed);
            input.dispatchEvent(new Event('click', { bubbles: true }));
        }

        applyNodeInputColor(color) {
            if (!this.visNetwork) return;
            const input = this.getEl(this.ids.modeNodeInput);
            const raw = input ? input.value : '';
            const parsed = this.parseNodeInputIds(raw);
            if (!parsed.validIds.length) {
                this.triggerToolbarShake();
                this.notify('Node not found', 'info');
                return;
            }
            const dataset = this.visNetwork?.body?.data?.nodes;
            if (!dataset || typeof dataset.get !== 'function') return;
            parsed.validIds.forEach((nodeId) => {
                const node = dataset.get(nodeId);
                if (!node) return;
                if (!this._nodeModeOriginalColors.has(nodeId)) {
                    this._nodeModeOriginalColors.set(nodeId, cloneVisColor(node.color));
                }
                const nextColor = buildSelectedNodeColor(node.color, color);
                dataset.update({ id: nodeId, color: nextColor });
            });
            this.selectedNodeColor = color;
            this.markEdgeFocusDirty();
            this.applyEdgeFocusDisplay();
            this._labelThresholdBaseDirty = true;
            this.applyLabelThresholdDimming();
            if (this.modeStateStore && this._toolbarMode === 'node') {
                this.modeStateStore.capture('node');
            }
            if (parsed.missingIds.length) {
                this.triggerToolbarShake();
                this.notify(`Missing nodes: ${parsed.missingIds.join(', ')}`, 'info');
            }
        }

        restoreNodeOriginalColor(nodeId) {
            if (!nodeId || !this.visNetwork) return;
            const original = this._nodeModeOriginalColors.get(nodeId);
            if (!original) return;
            const dataset = this.visNetwork?.body?.data?.nodes;
            if (!dataset) return;
            dataset.update({ id: nodeId, color: cloneVisColor(original) });
            this._nodeModeOriginalColors.delete(nodeId);
            this.markEdgeFocusDirty();
            this.applyEdgeFocusDisplay();
            this._labelThresholdBaseDirty = true;
            this.applyLabelThresholdDimming();
        }

        suspendEdgeFocus() {
            const state = this.getEdgeFocusState();
            if (!state.lockedEdgeIds || !state.lockedEdgeIds.size) {
                this._suspendedEdgeFocus = null;
                return;
            }
            this._suspendedEdgeFocus = {
                lockedEdgeIds: Array.from(state.lockedEdgeIds),
                edgeFocusFadeAlpha: this.edgeFocusFadeAlpha
            };
        }

        restoreSuspendedEdgeFocus() {
            const snap = this._suspendedEdgeFocus;
            if (!snap || !snap.lockedEdgeIds) return;
            const state = this.getEdgeFocusState();
            state.lockedEdgeIds = new Set(snap.lockedEdgeIds);
            if (Number.isFinite(snap.edgeFocusFadeAlpha)) {
                this.edgeFocusFadeAlpha = snap.edgeFocusFadeAlpha;
            }
            this._suspendedEdgeFocus = null;
            this.applyEdgeFocusDisplay();
            this.updateModeToolbar();
        }

        handleModeToolbarNodeInput(raw) {
            const parsed = this.parseNodeInputIds(raw);
            if (!parsed.validIds.length) {
                this.triggerToolbarShake();
                this.notify('Node not found', 'info');
                return;
            }
            this.setToolbarMode('node');
            const state = this.getEdgeFocusState();
            parsed.validIds.forEach((nodeId) => {
                const depth = state.customFocusDepthMap && state.customFocusDepthMap.has(nodeId)
                    ? state.customFocusDepthMap.get(nodeId)
                    : (Number.isFinite(state.customFocusDepth) ? state.customFocusDepth : 1);
                this.applyDepthFocusForNode(nodeId, depth, this.edgeFocusFadeAlpha);
                this.addSelectedNodeId(nodeId);
            });
            if (this.visNetwork) {
                const selected = this.visNetwork.getSelectedNodes?.() || [];
                const next = Array.from(new Set([...selected, ...parsed.validIds]));
                this.visNetwork.selectNodes(next);
            }
            if (parsed.missingIds.length) {
                this.triggerToolbarShake();
                this.notify(`Missing nodes: ${parsed.missingIds.join(', ')}`, 'info');
            }
        }

        toggleNodeSelectionFromInput(raw) {
            const parsed = this.parseNodeInputIds(raw);
            if (!parsed.validIds.length) {
                this.triggerToolbarShake();
                this.notify('Node not found', 'info');
                return;
            }
            this.setToolbarMode('node');
            parsed.validIds.forEach((nodeId) => {
                this.toggleNodeSelectionMode(nodeId);
            });
            if (parsed.missingIds.length) {
                this.triggerToolbarShake();
                this.notify(`Missing nodes: ${parsed.missingIds.join(', ')}`, 'info');
            }
        }

        syncNodeInputFromData(data) {
            const view = this.getEl(this.ids.view);
            if (!view || !view.classList.contains('active')) return;
            if (this._toolbarMode !== 'node') return;
            const input = this.getEl(this.ids.modeNodeInput);
            if (!input) return;
            const raw = data?.wos_data?.wos_id || data?.wos_data?.wosid || data?.wos_id || data?.wosid;
            if (!raw) return;
            const normalized = this.normalizeWosId(raw);
            input.value = normalized || String(raw);
        }

        syncNodeInputFromSelection(ids = []) {
            const view = this.getEl(this.ids.view);
            if (!view || !view.classList.contains('active')) return;
            if (this._toolbarMode !== 'node') return;
            const input = this.getEl(this.ids.modeNodeInput);
            if (!input) return;
            const unique = Array.from(new Set((ids || []).map(id => String(id).trim()).filter(Boolean)));
            if (!unique.length) return;
            input.value = unique.join('\n');
        }

        handleModeToolbarAction(action) {
            const nodeId = this.getSelectedNodeId();
            const edgeId = this.getSelectedEdgeId();
            if (action === 'selectNodeFocus') {
                const input = this.getEl(this.ids.modeNodeInput);
                this.toggleNodeSelectionFromInput(input ? input.value : '');
                return;
            }
            if (action === 'pickNodeColor') {
                // Copy normal mode styles and reset all node selections
                if (!this.modeStateStore) {
                    this.notify('Mode state store not ready', 'info');
                    return;
                }
                const normalSnapshot = this.modeStateStore.state.modes?.['normal'];
                if (!normalSnapshot) {
                    this.notify('Normal mode snapshot not found', 'info');
                    return;
                }
                if (!this.visNetwork || !this.visNetwork.body?.data?.nodes || !this.visNetwork.body?.data?.edges) {
                    this.notify('Vis network not ready', 'info');
                    return;
                }
                const dataset = this.visNetwork.body.data;
                // Apply normal mode node styles to current view
                const nodeUpdates = (normalSnapshot.nodes || []).map((node) => {
                    const update = { id: node.id, color: cloneVisColor(node.color) };
                    if (Number.isFinite(node.x) && Number.isFinite(node.y)) {
                        update.x = node.x;
                        update.y = node.y;
                    }
                    if (node.fixed != null) update.fixed = node.fixed;
                    return update;
                });
                // Apply normal mode edge styles to current view
                const edgeUpdates = (normalSnapshot.edges || []).map((edge) => ({
                    id: edge.id,
                    color: cloneVisColor(edge.color)
                }));
                if (nodeUpdates.length) dataset.nodes.update(nodeUpdates);
                if (edgeUpdates.length) dataset.edges.update(edgeUpdates);
                // Clear all node selections and custom focus state
                this.visNetwork.unselectAll();
                this.clearSelectedNodeIds();
                const state = this.getEdgeFocusState();
                state.customFocusActive = false;
                state.customFocusMap?.clear();
                state.customFocusDepthMap?.clear();
                state.customFocusNodes?.clear();
                state.customFocusEdges?.clear();
                state.customFocusRootId = null;
                // Update base colors so the new colors are preserved
                state.baseNodeColors.clear();
                state.baseEdgeColors.clear();
                state.dirty = true;
                this.markEdgeFocusDirty();
                this.applyEdgeFocusDisplay();
                // Capture the updated state to node mode
                if (this._toolbarMode === 'node') {
                    this.modeStateStore.capture('node');
                }
                this.updateModeToolbar();
                this.notify('Normal mode styles applied, all selections cleared', 'success');
                return;
            }
            if (action === 'unselectNode') {
                const inputNodeIds = this.getToolbarNodeInputIds();
                if (inputNodeIds.length) {
                    this.unselectNodes(inputNodeIds);
                } else {
                    this.unselectCurrentNode(nodeId);
                }
                return;
            }
            if (action === 'copyActiveNodeIds') {
                this.copyActiveNodeIdsToClipboard();
                return;
            }
            if (action === 'selectEdgeFocus') {
                if (edgeId != null) {
                    this.toggleEdgeSelectionMode(edgeId);
                }
                return;
            }
            if (action === 'copyEdgeNodeIds') {
                this.copyEdgeNodeIdsToClipboard();
                return;
            }
            if (action === 'unlockDepthFocus') {
                this.releaseNodeFocus();
                return;
            }
            if (action === 'applyNormalStyleToEdge') {
                // Copy normal mode styles and reset all edge selections
                if (!this.modeStateStore) {
                    this.notify('Mode state store not ready', 'info');
                    return;
                }
                const normalSnapshot = this.modeStateStore.state.modes?.['normal'];
                if (!normalSnapshot) {
                    this.notify('Normal mode snapshot not found', 'info');
                    return;
                }
                if (!this.visNetwork || !this.visNetwork.body?.data?.nodes || !this.visNetwork.body?.data?.edges) {
                    this.notify('Vis network not ready', 'info');
                    return;
                }
                const dataset = this.visNetwork.body.data;
                // Apply normal mode node styles to current view
                const nodeUpdates = (normalSnapshot.nodes || []).map((node) => {
                    const update = { id: node.id, color: cloneVisColor(node.color) };
                    if (Number.isFinite(node.x) && Number.isFinite(node.y)) {
                        update.x = node.x;
                        update.y = node.y;
                    }
                    if (node.fixed != null) update.fixed = node.fixed;
                    return update;
                });
                // Apply normal mode edge styles to current view
                const edgeUpdates = (normalSnapshot.edges || []).map((edge) => ({
                    id: edge.id,
                    color: cloneVisColor(edge.color)
                }));
                if (nodeUpdates.length) dataset.nodes.update(nodeUpdates);
                if (edgeUpdates.length) dataset.edges.update(edgeUpdates);
                // Clear all edge selections and edge focus state
                this.visNetwork.unselectAll();
                const state = this.getEdgeFocusState();
                state.lockedEdgeIds?.clear();
                // Update base colors so the new colors are preserved
                state.baseNodeColors.clear();
                state.baseEdgeColors.clear();
                state.dirty = true;
                this.markEdgeFocusDirty();
                this.applyEdgeFocusDisplay();
                // Capture the updated state to edge mode
                if (this._toolbarMode === 'edge') {
                    this.modeStateStore.capture('edge');
                }
                this.updateModeToolbar();
                this.notify('Normal mode styles applied, all selections cleared', 'success');
                return;
            }
            if (action === 'exitEdgeMode') {
                this.suspendEdgeFocus();
                if (this.modeStateStore) {
                    this.modeStateStore.capture('edge');
                }
                this.resetEdgeFocusState({ keepLocks: false, keepBaseColors: false });
                this.queuePersistSettings();
                this.setToolbarMode(null);
                return;
            }
        }

        unselectCurrentNode(nodeId) {
            if (nodeId) {
                this.removeNodeFromCustomFocus(nodeId);
                this.removeSelectedNodeId(nodeId);
                if (this.visNetwork) {
                    const selected = this.visNetwork.getSelectedNodes?.() || [];
                    const next = selected.filter((id) => id !== nodeId);
                    if (next.length) {
                        this.visNetwork.selectNodes(next);
                    } else {
                        this.visNetwork.unselectAll();
                    }
                }
            }
            this.updateModeToolbar();
        }

        unselectNodes(nodeIds) {
            if (!Array.isArray(nodeIds) || !nodeIds.length) return;
            nodeIds.forEach((id) => {
                this.removeNodeFromCustomFocus(id);
                this.removeSelectedNodeId(id);
            });
            if (this.visNetwork) {
                const selected = this.visNetwork.getSelectedNodes?.() || [];
                const next = selected.filter((id) => !nodeIds.includes(id));
                if (next.length) {
                    this.visNetwork.selectNodes(next);
                } else {
                    this.visNetwork.unselectAll();
                }
            }
            this.updateModeToolbar();
        }

        getToolbarNodeInputId() {
            const input = this.getEl(this.ids.modeNodeInput);
            const value = input ? input.value : '';
            return this.resolveNodeIdFromInput(value);
        }

        getToolbarNodeInputIds() {
            const input = this.getEl(this.ids.modeNodeInput);
            const value = input ? input.value : '';
            const parsed = this.parseNodeInputIds(value);
            return parsed.validIds;
        }


        addSelectedNodeId(nodeId) {
            if (!nodeId) return;
            this.selectedNodeIds.add(nodeId);
        }

        removeSelectedNodeId(nodeId) {
            if (!nodeId) return;
            this.selectedNodeIds.delete(nodeId);
        }

        clearSelectedNodeIds() {
            this.selectedNodeIds.clear();
        }

        getActiveHighlightNodeIds() {
            const state = this.getEdgeFocusState();
            if (state.customFocusActive && state.customFocusNodes && state.customFocusNodes.size) {
                return Array.from(state.customFocusNodes);
            }
            if (this.visNetwork && typeof this.visNetwork.getSelectedNodes === 'function') {
                return this.visNetwork.getSelectedNodes() || [];
            }
            return [];
        }

        getActiveHighlightNodeIdsText() {
            const ids = this.getActiveHighlightNodeIds();
            return (ids || []).join('\n');
        }

        async copyActiveNodeIdsToClipboard() {
            const text = this.getActiveHighlightNodeIdsText();
            if (!text) {
                this.notify('No related nodes to copy', 'info');
                return;
            }
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(text);
                } else {
                    const textarea = document.createElement('textarea');
                    textarea.value = text;
                    textarea.style.position = 'fixed';
                    textarea.style.opacity = '0';
                    document.body.appendChild(textarea);
                    textarea.focus();
                    textarea.select();
                    document.execCommand('copy');
                    textarea.remove();
                }
                this.notify('Copied related node IDs', 'success');
            } catch (err) {
                console.warn('Failed to copy related node IDs:', err);
                this.notify('Failed to copy related node IDs', 'error');
            }
        }

        getActiveEdgeIdsForCopy() {
            if (this.visNetwork && typeof this.visNetwork.getSelectedEdges === 'function') {
                const selected = this.visNetwork.getSelectedEdges() || [];
                if (selected.length) return selected;
            }
            const state = this.getEdgeFocusState();
            if (state.lockedEdgeIds && state.lockedEdgeIds.size) {
                return Array.from(state.lockedEdgeIds);
            }
            return [];
        }

        getEdgeRelatedNodeIds(edgeIds) {
            if (!this.visNetwork || !this.visNetwork?.body?.data?.edges) return [];
            const dataset = this.visNetwork.body.data;
            const unique = new Set();
            edgeIds.forEach((edgeId) => {
                const edge = dataset.edges.get(edgeId);
                if (!edge) return;
                if (edge.from != null) unique.add(edge.from);
                if (edge.to != null) unique.add(edge.to);
            });
            return Array.from(unique);
        }

        async copyEdgeNodeIdsToClipboard() {
            const edgeIds = this.getActiveEdgeIdsForCopy();
            const nodeIds = this.getEdgeRelatedNodeIds(edgeIds);
            if (!nodeIds.length) {
                this.notify('No edge nodes to copy', 'info');
                return;
            }
            const text = nodeIds.join('\n');
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(text);
                } else {
                    const textarea = document.createElement('textarea');
                    textarea.value = text;
                    textarea.style.position = 'fixed';
                    textarea.style.opacity = '0';
                    document.body.appendChild(textarea);
                    textarea.focus();
                    textarea.select();
                    document.execCommand('copy');
                    textarea.remove();
                }
                this.notify('Copied edge node IDs', 'success');
            } catch (err) {
                console.warn('Failed to copy edge node IDs:', err);
                this.notify('Failed to copy edge node IDs', 'error');
            }
        }

        releaseNodeFocus() {
            this.captureNodeModeStyleSnapshot();
            this.clearCustomFocusLock();
            if (this.visNetwork) this.visNetwork.unselectAll();
            this.setToolbarMode(null);
        }

        removeNodeFromCustomFocus(nodeId) {
            const state = this.getEdgeFocusState();
            if (state.customFocusActive && state.customFocusMap && state.customFocusMap.has(nodeId)) {
                state.customFocusMap.delete(nodeId);
                if (state.customFocusDepthMap) state.customFocusDepthMap.delete(nodeId);
                this.removeSelectedNodeId(nodeId);
                this.restoreNodeOriginalColor(nodeId);
                this.rebuildCustomFocusFromMap();
                return true;
            }
            return false;
        }

        toggleNodeSelectionMode(nodeId) {
            if (!nodeId) return;
            if (this.removeNodeFromCustomFocus(nodeId)) {
                if (this.visNetwork) {
                    const selected = this.visNetwork.getSelectedNodes?.() || [];
                    const next = selected.filter((id) => id !== nodeId);
                    if (next.length) {
                        this.visNetwork.selectNodes(next);
                    } else {
                        this.visNetwork.unselectAll();
                    }
                }
                return;
            }
            const state = this.getEdgeFocusState();
            const depth = state.customFocusDepthMap && state.customFocusDepthMap.has(nodeId)
                ? state.customFocusDepthMap.get(nodeId)
                : (Number.isFinite(state.customFocusDepth) ? state.customFocusDepth : 1);
            this.applyDepthFocusForNode(nodeId, depth, this.edgeFocusFadeAlpha);
            if (this.visNetwork) {
                const selected = this.visNetwork.getSelectedNodes?.() || [];
                if (!selected.includes(nodeId)) {
                    this.visNetwork.selectNodes([...selected, nodeId]);
                }
            }
        }

        toggleEdgeSelectionMode(edgeId) {
            if (edgeId == null) return;
            const state = this.getEdgeFocusState();
            if (state.lockedEdgeIds.has(edgeId)) {
                state.lockedEdgeIds.delete(edgeId);
                if (this.visNetwork) {
                    const selected = this.visNetwork.getSelectedEdges?.() || [];
                    const next = selected.filter((id) => id !== edgeId);
                    if (next.length) {
                        this.visNetwork.selectEdges(next);
                    } else {
                        this.visNetwork.unselectAll();
                    }
                }
                this.applyEdgeFocusDisplay();
                if (!this.hasActiveEdgeSelection()) {
                    this.setToolbarMode(null);
                } else {
                    this.updateModeToolbar();
                }
                return;
            }
            state.lockedEdgeIds.add(edgeId);
            if (this.visNetwork) {
                const selected = this.visNetwork.getSelectedEdges?.() || [];
                if (!selected.includes(edgeId)) {
                    this.visNetwork.selectEdges([...selected, edgeId]);
                }
            }
            this.applyEdgeFocusDisplay();
            this.updateModeToolbar();
        }

        lockEdges(edgeIds) {
            if (!edgeIds || !edgeIds.length) return;
            const state = this.getEdgeFocusState();
            edgeIds.forEach((id) => {
                if (id == null) return;
                state.lockedEdgeIds.add(id);
            });
            this.applyEdgeFocusDisplay();
            this.updateModeToolbar();
        }

        unlockEdges(edgeIds) {
            if (!edgeIds || !edgeIds.length) return;
            const state = this.getEdgeFocusState();
            edgeIds.forEach((id) => {
                if (id == null) return;
                state.lockedEdgeIds.delete(id);
            });
            this.applyEdgeFocusDisplay();
            if (!this.hasActiveEdgeSelection()) {
                this.setToolbarMode(null);
            } else {
                this.updateModeToolbar();
            }
        }

        hasActiveEdgeSelection() {
            const selected = this.visNetwork?.getSelectedEdges?.() || [];
            const state = this.getEdgeFocusState();
            return selected.length > 0 || (state.lockedEdgeIds && state.lockedEdgeIds.size > 0);
        }

        handleModeToolbarSlider(action, value) {
            if (action === 'edgeFadeAlpha') {
                this.edgeFocusFadeAlpha = Math.max(0, Math.min(1, value));
                this.applyEdgeFocusDisplay();
                this.updateModeToolbar();
                if (this.modeStateStore && this._toolbarMode === 'edge') {
                    this.modeStateStore.capture('edge');
                }
                this.queuePersistSettings();
                return;
            }
            if (action === 'nodeFadeAlpha') {
                const nextAlpha = Math.max(0, Math.min(1, value));
                this.edgeFocusFadeAlpha = nextAlpha;
                const state = this.getEdgeFocusState();
                // Always sync customFocusAlpha so the value is shared between
                // hover and persistent node mode and persisted on reload.
                state.customFocusAlpha = nextAlpha;
                this.applyEdgeFocusDisplay();
                this.updateModeToolbar();
                if (this.modeStateStore && this._toolbarMode === 'node') {
                    this.modeStateStore.capture('node');
                }
                this.queuePersistSettings();
                return;
            }
            if (action === 'nodeDepth') {
                const input = this.getEl(this.ids.modeNodeInput);
                const parsed = this.parseNodeInputIds(input ? input.value : '');
                const targetIds = parsed.validIds.length ? parsed.validIds : [];
                if (!targetIds.length) {
                    const nodeId = this.getSelectedNodeId();
                    if (!nodeId) return;
                    this.applyDepthFocusForNode(nodeId, value);
                } else {
                    targetIds.forEach((id) => this.applyDepthFocusForNode(id, value));
                }
                this.updateModeToolbar();
                this.queuePersistSettings();
            }
        }

        handleModeToolbarStepper(action, delta) {
            if (action !== 'nodeDepth') return;
            const state = this.getEdgeFocusState();
            const current = Number.isFinite(state.customFocusDepth) ? state.customFocusDepth : 1;
            const next = Math.max(0, Math.min(10, current + delta));
            this.handleModeToolbarSlider('nodeDepth', next);
        }

        updateModeToolbar() {
            const toolbar = this.getEl(this.ids.modeToolbar);
            const label = this.getEl(this.ids.modeLabel);
            const nodeGroup = this.getEl(this.ids.modeNodeGroup);
            const edgeGroup = this.getEl(this.ids.modeEdgeGroup);
            if (!toolbar || !label || !nodeGroup || !edgeGroup) return;
            const mode = this._toolbarMode;
            if (!mode) {
                if (toolbar.contains(document.activeElement)) {
                    document.activeElement.blur();
                }
                toolbar.classList.remove('is-visible');
                toolbar.setAttribute('aria-hidden', 'true');
                toolbar.setAttribute('inert', '');
                nodeGroup.classList.remove('is-active');
                edgeGroup.classList.remove('is-active');
                return;
            }
            toolbar.classList.add('is-visible');
            toolbar.setAttribute('aria-hidden', 'false');
            toolbar.removeAttribute('inert');
            nodeGroup.classList.toggle('is-active', mode === 'node');
            edgeGroup.classList.toggle('is-active', mode === 'edge');
            label.textContent = mode === 'edge' ? 'Edge Selection Mode' : 'Node Selection Mode';
            if (mode === 'node') {
                const selectedNode = this.getSelectedNodeId();
                const state = this.getEdgeFocusState();
                const depth = state.customFocusDepthMap && selectedNode && state.customFocusDepthMap.has(selectedNode)
                    ? state.customFocusDepthMap.get(selectedNode)
                    : (Number.isFinite(state.customFocusDepth) ? state.customFocusDepth : 1);
                const fadeValue = Number.isFinite(state.customFocusAlpha)
                    ? state.customFocusAlpha
                    : (Number(this.edgeFocusFadeAlpha) || 0);
                const fadeInput = nodeGroup.querySelector('[data-action="nodeFadeAlpha"] input[type="range"]');
                const fadeValueEl = nodeGroup.querySelector('[data-action="nodeFadeAlpha"] [data-role="value"]');
                const depthInput = nodeGroup.querySelector('[data-action="nodeDepth"] input[type="range"]');
                const depthValueEl = nodeGroup.querySelector('[data-action="nodeDepth"] [data-role="value"]');
                const nodeInput = this.getEl(this.ids.modeNodeInput);
                if (fadeInput) fadeInput.value = String(fadeValue);
                if (fadeValueEl) fadeValueEl.textContent = fadeValue.toFixed(2);
                if (depthInput) depthInput.value = String(depth);
                if (depthValueEl) depthValueEl.textContent = String(depth);
                if (nodeInput && selectedNode) nodeInput.value = selectedNode;
                return;
            }
            if (mode === 'edge') {
                const selectedEdge = this.getSelectedEdgeId();
                const fadeValue = Number(this.edgeFocusFadeAlpha) || 0;
                const fadeInput = edgeGroup.querySelector('[data-action="edgeFadeAlpha"] input[type="range"]');
                const fadeValueEl = edgeGroup.querySelector('[data-action="edgeFadeAlpha"] [data-role="value"]');
                if (fadeInput) fadeInput.value = String(fadeValue);
                if (fadeValueEl) fadeValueEl.textContent = fadeValue.toFixed(2);
            }
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

        async initModeStateStore() {
            if (this._modeStoreLoaded || !this.modeStateStore) return;
            this._modeStoreLoaded = true;
            this._modeStoreReady = this.modeStateStore.load().then(() => {
                this.modeStateStore.applySettings();
                this.modeStateStore.apply('normal');
                return true;
            });
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
            // 重置边的原始箭头信息，以便保存新数据的原始状态
            this._edgeBaseArrows = null;
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
            this.updateModeToolbar();
            this._visViewReady = true;
            this.initModeStateStore();
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
            // 重置边的原始箭头信息，以便保存新数据的原始状态
            this._edgeBaseArrows = null;
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
            this.updateModeToolbar();
            this._visViewReady = true;
            this.initModeStateStore();
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
                const minSlider = this.getEl(this.ids.labelMinSlider);
                if (minSlider) minSlider.value = String(this.labelMinCitations || 0);
                const minDimSlider = this.getEl(this.ids.labelMinDimSlider);
                if (minDimSlider) minDimSlider.value = String(this.labelMinDimAlpha ?? 0.2);
                const relatedMinSlider = this.getEl(this.ids.relatedMinSlider);
                if (relatedMinSlider) relatedMinSlider.value = String(this.relatedMinValue || 0);
                const relatedMinDimSlider = this.getEl(this.ids.relatedMinDimSlider);
                if (relatedMinDimSlider) relatedMinDimSlider.value = String(this.relatedMinDimAlpha ?? 0.2);
                const edgeColorInput = this.getEl(this.ids.edgeColorInput);
                const edgeLabelFontSizeInput = this.getEl(this.ids.edgeLabelFontSizeInput);
                const edgeLabelColorInput = this.getEl(this.ids.edgeLabelColorInput);
                const edgeLabelStrokeWidthInput = this.getEl(this.ids.edgeLabelStrokeWidthInput);
                const edgeLabelStrokeColorInput = this.getEl(this.ids.edgeLabelStrokeColorInput);
                const edgeLabelBgColorInput = this.getEl(this.ids.edgeLabelBgColorInput);
                const edgeFadeSlider = this.getEl(this.ids.edgeFadeSlider);
                const edgeMinWidthSlider = this.getEl(this.ids.edgeMinWidthSlider);
                const edgeMaxWidthSlider = this.getEl(this.ids.edgeMaxWidthSlider);
                this.setColorInputValue(edgeColorInput, this.edgeColor || '#111111');
                if (edgeLabelFontSizeInput) edgeLabelFontSizeInput.value = String(this.edgeLabelFontSize ?? 12);
                this.setColorInputValue(edgeLabelColorInput, this.edgeLabelFontColor || '#111111');
                if (edgeLabelStrokeWidthInput) edgeLabelStrokeWidthInput.value = String(this.edgeLabelStrokeWidth ?? 0);
                this.setColorInputValue(edgeLabelStrokeColorInput, this.edgeLabelStrokeColor || '#ffffff');
                this.setColorInputValue(edgeLabelBgColorInput, this.edgeLabelBgColor || 'rgba(255,255,255,0.85)');
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
            const scale = Number.isFinite(this.labelSizeScale) ? this.labelSizeScale : 0.5;
            const minFontSize = Number.isFinite(this.labelFontMin) ? this.labelFontMin : 5;
            const maxFontSize = Number.isFinite(this.labelFontMax) ? this.labelFontMax : 20;
            
            const updates = dataset.get().map((node) => {
                const nodeSize = node.size || 30;
                // Calculate font size as a proportion of node size
                const baseFontSize = nodeSize * scale;
                // Clamp font size between absolute min and max pixel values
                let fontSize = Math.max(minFontSize, Math.min(maxFontSize, baseFontSize));
                
                return {
                    id: node.id,
                    labelStyle: { ...(node.labelStyle || {}), fontSize: Number(fontSize.toFixed(2)), scaleFont: scale, scaleMin: minFontSize, scaleMax: maxFontSize }
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

        applyLabelBorderWidth() {
            const dataset = this.getNetworkNodesDataSet();
            if (!dataset) return;
            const width = Math.max(0, Number(this.labelBorderWidth) || 0);
            const updates = dataset.get().map((node) => ({
                id: node.id,
                labelStyle: { ...(node.labelStyle || {}), borderWidth: width }
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
            if (this._skipNodeColorApply) return;
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
            if (this._skipNodeColorApply) return;
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
            const scale = Number.isFinite(Number(this.edgeWidthScale)) ? Number(this.edgeWidthScale) : 1.0;
            const customWidths = this._edgeCustomWidths || new Set();
            const updates = dataset.get()
                .filter((edge) => !customWidths.has(edge.id))
                .map((edge) => {
                    const related = getRelatedCount(edge);
                    const t = maxRelated > minRelated ? (related - minRelated) / (maxRelated - minRelated) : 0;
                    const baseWidth = minW + Math.max(0, Math.min(1, t)) * (maxW - minW);
                    const width = baseWidth * scale;
                    return { id: edge.id, width: Number(width.toFixed(2)) };
                });
            dataset.update(updates);
        }

        applyEdgeStyle() {
            if (!this.visNetwork) return;
            const dataset = this.visNetwork?.body?.data?.edges;
            if (!dataset) return;

            // 初始化时保存原始箭头信息
            if (!this._edgeBaseArrows) {
                this._edgeBaseArrows = new Map();
                const allEdges = dataset.get();
                allEdges.forEach((edge) => {
                    // 保存原始的 arrows 属性（可能是字符串、对象或 undefined）
                    if (edge.arrows !== undefined && edge.arrows !== null) {
                        this._edgeBaseArrows.set(edge.id, edge.arrows);
                    }
                });
            }

            const style = this.edgeStyle || 'curve-dynamic';
            const isArrow = style === 'arrow';
            const isDashed = style === 'dashed';
            const isStraight = style === 'straight';
            const isCurve = style.startsWith('curve-');
            const updates = dataset.get().map((edge) => {
                const next = { id: edge.id };

                // 箭头处理：根据样式决定使用原始值还是删除
                if (isArrow) {
                    // 明确选择箭头样式时，设置箭头
                    next.arrows = 'to';
                } else {
                    // 非箭头样式时，恢复原始箭头信息（如果有的话），否则删除箭头属性
                    const originalArrows = this._edgeBaseArrows.get(edge.id);
                    if (originalArrows !== undefined) {
                        // 有原始箭头，恢复它
                        next.arrows = originalArrows;
                    } else {
                        // 没有原始箭头，删除箭头属性（用 undefined，不要用 null）
                        next.arrows = undefined;
                    }
                }

                // 虚线样式
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
            const customFonts = this._edgeCustomFonts || new Map();
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
                const custom = customFonts.get(edge.id);
                const font = shouldShowLabel
                    ? {
                        ...(edge.font || {}),
                        size: custom?.size ?? fontSize,
                        face: 'Times New Roman, Times, serif',
                        align: 'middle',
                        color: custom?.color ?? fontColor,
                        background: custom?.background ?? bgColor,
                        strokeWidth: custom?.strokeWidth ?? strokeWidth,
                        strokeColor: custom?.strokeColor ?? strokeColor
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
            this.updateModeToolbar();
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
            if (this._toolbarMode === 'node' && this.visNetwork) {
                const labelState = getLabelState(this.visNetwork);
                if (!labelState.showAll) {
                    clearAllLabels(layer, false);
                    return;
                }
            }
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
            this.clearSelectedNodeIds();
            state.dirty = true;
            this.applyEdgeFocusDisplay();
            this.updateModeToolbar();
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
            if (!this.hasActiveEdgeSelection()) {
                this.setToolbarMode(null);
            } else {
                this.updateModeToolbar();
            }
        }

        closeEdgeContextMenu() {
            const menu = this._edgeContextMenu?.menuEl || document.querySelector('.context-menu');
            if (menu) {
                if (menu._edgeClickHandler) document.removeEventListener('mousedown', menu._edgeClickHandler);
                if (menu._edgeKeyHandler) document.removeEventListener('keydown', menu._edgeKeyHandler);
                menu.remove();
            }
            this._edgeContextMenu = null;
            if (this._tempToolbarMode === 'edge') {
                if (!this.hasActiveEdgeSelection()) {
                    this.setToolbarMode(null);
                }
                this._tempToolbarMode = null;
            }
        }

        closeNodeContextMenu() {
            const menu = this._nodeContextMenu?.menuEl || document.querySelector('.context-menu.node-menu');
            if (menu) {
                if (menu._nodeClickHandler) document.removeEventListener('mousedown', menu._nodeClickHandler);
                if (menu._nodeKeyHandler) document.removeEventListener('keydown', menu._nodeKeyHandler);
                menu.remove();
            }
            this._nodeContextMenu = null;
            this._nodeContextColorAnchor = null;
            this._nodeStyleApplyAll = false;
            if (this._tempToolbarMode === 'node') {
                if (this._toolbarMode !== 'node') {
                    const state = this.getEdgeFocusState();
                    if (!state.customFocusActive) {
                        this.setToolbarMode(null);
                    }
                }
                this._tempToolbarMode = null;
            }
        }

        closeNodeStylePopover() {
            const pop = this._nodeStylePopover?.el || document.querySelector('.context-style-popover');
            if (pop) {
                if (pop._nodeStyleKeyHandler) document.removeEventListener('keydown', pop._nodeStyleKeyHandler);
                pop.remove();
            }
            const moved = this._nodeStylePopover?.movedInput;
            if (moved && moved.input && moved.parent) {
                const { input, parent, next } = moved;
                input.classList.remove('context-color-input');
                input.classList.add('vis-node-context-color-input');
                if (next && next.parentNode === parent) {
                    parent.insertBefore(input, next);
                } else {
                    parent.appendChild(input);
                }
            }
            this._nodeStylePopover = null;
        }

        closeNodeSizePopover() {
            const pop = this._nodeSizePopover?.el || document.querySelector('.context-size-popover');
            if (pop) {
                if (pop._nodeSizeClickHandler) document.removeEventListener('mousedown', pop._nodeSizeClickHandler);
                if (pop._nodeSizeKeyHandler) document.removeEventListener('keydown', pop._nodeSizeKeyHandler);
                pop.remove();
            }
            this._nodeSizePopover = null;
        }

        closeNodeBasePopover() {
            const pop = this._nodeBasePopover?.el || document.querySelector('.context-node-popover');
            if (pop) {
                if (pop._nodeBaseKeyHandler) document.removeEventListener('keydown', pop._nodeBaseKeyHandler);
                pop.remove();
            }
            const moved = this._nodeBasePopover?.movedInput;
            if (moved && moved.input && moved.parent) {
                const { input, parent, next } = moved;
                input.classList.remove('context-color-input');
                input.classList.add('vis-node-context-color-input');
                if (next && next.parentNode === parent) {
                    parent.insertBefore(input, next);
                } else {
                    parent.appendChild(input);
                }
            }
            this._nodeBasePopover = null;
            this._nodePopoverHover = false;
            if (this._nodePopoverCloseTimer) {
                clearTimeout(this._nodePopoverCloseTimer);
                this._nodePopoverCloseTimer = null;
            }
        }

        closeNodeLabelStylePopover() {
            const pop = this._nodeLabelStylePopover?.el;
            if (pop) {
                if (pop._nodeLabelStyleKeyHandler) document.removeEventListener('keydown', pop._nodeLabelStyleKeyHandler);
                pop.remove();
            }
            this._nodeLabelStylePopover = null;
            this._nodePopoverHover = false;
            if (this._nodePopoverCloseTimer) {
                clearTimeout(this._nodePopoverCloseTimer);
                this._nodePopoverCloseTimer = null;
            }
        }

        _makePopoverDraggable(pop) {
            const handle = pop.querySelector('.context-popover-drag-handle');
            if (!handle) return;
            let startX, startY, origLeft, origTop;
            const onMouseMove = (e) => {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                pop.style.left = `${origLeft + dx}px`;
                pop.style.top = `${origTop + dy}px`;
            };
            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                startX = e.clientX;
                startY = e.clientY;
                origLeft = parseFloat(pop.style.left) || 0;
                origTop = parseFloat(pop.style.top) || 0;
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        }

        switchNodePopoverTarget(newNodeId) {
            if (!newNodeId) return false;
            let switched = false;
            if (this._nodeBasePopover?.el) {
                const el = this._nodeBasePopover.el;
                const x = parseFloat(el.style.left) || 0;
                const y = parseFloat(el.style.top) || 0;
                this.closeNodeBasePopover();
                this.openNodeBasePopover({ nodeId: newNodeId, x, y });
                switched = true;
            }
            if (this._nodeLabelStylePopover?.el) {
                const el = this._nodeLabelStylePopover.el;
                const x = parseFloat(el.style.left) || 0;
                const y = parseFloat(el.style.top) || 0;
                this.closeNodeLabelStylePopover();
                this.openNodeLabelStylePopover({ nodeId: newNodeId, x, y });
                switched = true;
            }
            if (this._nodeStylePopover?.el) {
                const el = this._nodeStylePopover.el;
                const x = parseFloat(el.style.left) || 0;
                const y = parseFloat(el.style.top) || 0;
                const type = this._nodeStylePopover.type;
                this.closeNodeStylePopover();
                this.openNodeStylePopover({ nodeId: newNodeId, type, x, y });
                switched = true;
            }
            return switched;
        }

        switchEdgePopoverTarget(newEdgeId) {
            if (!newEdgeId) return false;
            let switched = false;
            if (this._edgeStylePopover?.el) {
                const el = this._edgeStylePopover.el;
                const x = parseFloat(el.style.left) || 0;
                const y = parseFloat(el.style.top) || 0;
                this.closeEdgeStylePopover();
                this.openEdgeStylePopover({ edgeId: newEdgeId, x, y });
                switched = true;
            }
            if (this._edgeLabelStylePopover?.el) {
                const el = this._edgeLabelStylePopover.el;
                const x = parseFloat(el.style.left) || 0;
                const y = parseFloat(el.style.top) || 0;
                this.closeEdgeLabelStylePopover();
                this.openEdgeLabelStylePopover({ edgeId: newEdgeId, x, y });
                switched = true;
            }
            return switched;
        }

        scheduleCloseNodePopovers(delay = 180) {
            if (this._nodePopoverCloseTimer) {
                clearTimeout(this._nodePopoverCloseTimer);
            }
            this._nodePopoverCloseTimer = setTimeout(() => {
                if (this._nodePopoverHover) return;
                this.closeNodeStylePopover();
                this.closeNodeBasePopover();
                this.closeNodeLabelStylePopover();
            }, delay);
        }

        closeEdgeStylePopover() {
            const pop = this._edgeStylePopover?.el || document.querySelector('.context-edge-style-popover');
            if (pop) {
                if (pop._edgeStyleKeyHandler) document.removeEventListener('keydown', pop._edgeStyleKeyHandler);
                pop.remove();
            }
            this._edgeStylePopover = null;
            this._edgePopoverHover = false;
            if (this._edgePopoverCloseTimer) {
                clearTimeout(this._edgePopoverCloseTimer);
                this._edgePopoverCloseTimer = null;
            }
        }

        closeEdgeLabelStylePopover() {
            const pop = this._edgeLabelStylePopover?.el || document.querySelector('.context-edge-label-style-popover');
            if (pop) {
                if (pop._edgeLabelStyleKeyHandler) document.removeEventListener('keydown', pop._edgeLabelStyleKeyHandler);
                pop.remove();
            }
            this._edgeLabelStylePopover = null;
            this._edgePopoverHover = false;
            if (this._edgePopoverCloseTimer) {
                clearTimeout(this._edgePopoverCloseTimer);
                this._edgePopoverCloseTimer = null;
            }
        }

        closePhysicsPopover() {
            const pop = this._physicsPopover?.el;
            if (pop) {
                if (pop._physicsKeyHandler) document.removeEventListener('keydown', pop._physicsKeyHandler);
                pop.remove();
            }
            this._physicsPopover = null;
        }

        openPhysicsPopover({ x, y }) {
            this.closePhysicsPopover();
            const springLength = Number(this.physicsSpringLength || 120);
            const springConstant = Number(this.physicsSpringConstant || 0.05);
            const gravity = Number(this.physicsGravity || -9000);

            const pop = document.createElement('div');
            pop.className = 'context-style-popover';
            const anchorX = Number(x) || 0;
            const anchorY = Number(y) || 0;
            pop.style.left = `${anchorX}px`;
            pop.style.top = `${anchorY}px`;
            pop.innerHTML = `
                <div class="context-popover-drag-handle" title="Drag to move">Physics Layout</div>
                <button type="button" class="context-popover-close-btn" data-role="closePopover" title="Close (Esc)">&times;</button>
                <div class="context-input-row">
                    <span class="context-slider-label">Link Distance</span>
                    <input class="context-number-input" data-role="springLength" type="number" min="10" max="1000" step="5" value="${springLength}" aria-label="Link distance">
                </div>
                <div class="context-input-row">
                    <span class="context-slider-label">Link Strength</span>
                    <input class="context-number-input" data-role="springConstant" type="number" min="0.001" max="1" step="0.01" value="${springConstant}" aria-label="Link strength">
                </div>
                <div class="context-input-row">
                    <span class="context-slider-label">Gravity</span>
                    <input class="context-number-input" data-role="gravity" type="number" min="-50000" max="0" step="100" value="${gravity}" aria-label="Gravity">
                </div>
            `;
            document.body.appendChild(pop);
            this._makePopoverDraggable(pop);
            const closeBtn = pop.querySelector('[data-role="closePopover"]');
            if (closeBtn) {
                closeBtn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    this.closePhysicsPopover();
                });
            }

            const rect = pop.getBoundingClientRect();
            const margin = 8;
            let nextLeft = anchorX;
            let nextTop = anchorY;
            if (anchorX + rect.width > window.innerWidth - margin) {
                nextLeft = anchorX - rect.width - 12;
            }
            if (nextLeft < margin) nextLeft = margin;
            if (rect.bottom > window.innerHeight - margin) {
                nextTop = window.innerHeight - rect.height - margin;
            }
            pop.style.left = `${Math.max(margin, nextLeft)}px`;
            pop.style.top = `${Math.max(margin, nextTop)}px`;

            const bindNumberInput = (role, onChange) => {
                const input = pop.querySelector(`input[data-role="${role}"]`);
                if (!input) return;
                const applyValue = (raw) => {
                    const next = Number(raw);
                    if (!Number.isFinite(next)) return;
                    const min = Number(input.min);
                    const max = Number(input.max);
                    const clamped = Math.max(min, Math.min(max, next));
                    input.value = String(clamped);
                    onChange(clamped);
                };
                input.addEventListener('input', (ev) => {
                    ev.stopPropagation();
                    applyValue(input.value);
                });
                input.addEventListener('change', (ev) => {
                    ev.stopPropagation();
                    applyValue(input.value);
                });
                input.addEventListener('wheel', (ev) => {
                    ev.preventDefault();
                    const step = Number(input.step) || 1;
                    const delta = ev.deltaY < 0 ? step : -step;
                    const currentVal = Number(input.value) || 0;
                    const min = Number(input.min);
                    const max = Number(input.max);
                    const nextVal = Math.max(min, Math.min(max, currentVal + delta));
                    applyValue(nextVal);
                }, { passive: false });
                input.addEventListener('click', (ev) => ev.stopPropagation());
            };

            bindNumberInput('springLength', (val) => {
                this.physicsSpringLength = val;
                this.applyPhysicsSettings();
                this.queuePersistSettings();
            });
            bindNumberInput('springConstant', (val) => {
                this.physicsSpringConstant = val;
                this.applyPhysicsSettings();
                this.queuePersistSettings();
            });
            bindNumberInput('gravity', (val) => {
                this.physicsGravity = val;
                this.applyPhysicsSettings();
                this.queuePersistSettings();
            });

            const keyHandler = (ev) => {
                if (ev.key === 'Escape') this.closePhysicsPopover();
            };
            pop._physicsKeyHandler = keyHandler;
            document.addEventListener('keydown', keyHandler);
            this._physicsPopover = { el: pop };
        }

        scheduleCloseEdgePopovers(delay = 180) {
            if (this._edgePopoverCloseTimer) {
                clearTimeout(this._edgePopoverCloseTimer);
            }
            this._edgePopoverCloseTimer = setTimeout(() => {
                if (this._edgePopoverHover) return;
                this.closeEdgeStylePopover();
                this.closeEdgeLabelStylePopover();
            }, delay);
        }

        openEdgeStylePopover({ edgeId, x, y }) {
            if (!edgeId) return;
            this.closeEdgeStylePopover();
            const dataset = this.visNetwork?.body?.data?.edges;
            const edge = dataset && typeof dataset.get === 'function' ? dataset.get(edgeId) : null;
            const step = 0.1;
            
            const edgeMinWidth = Number(this.edgeMinWidth ?? 1);
            const edgeMaxWidth = Number(this.edgeMaxWidth ?? 6);
            const edgeWidthScale = Number(this.edgeWidthScale ?? 1.0);
            
            const formatValue = (value) => {
                const next = Number(value);
                return Number.isFinite(next) ? next.toFixed(2) : '0.00';
            };
            
            const pop = document.createElement('div');
            pop.className = 'context-edge-style-popover context-style-popover';
            const anchorX = Number(x) || 0;
            const anchorY = Number(y) || 0;
            pop.style.left = `${anchorX}px`;
            pop.style.top = `${anchorY}px`;
            pop.innerHTML = `
                <div class="context-popover-drag-handle" title="Drag to move">Edge Appearance</div>
                <button type="button" class="context-popover-close-btn" data-role="closePopover" title="Close (Esc)">&times;</button>
                <label class="context-popover-toggle">
                    <input type="checkbox" class="context-popover-checkbox" aria-label="Apply to all edges">
                    <span>Apply to all edges</span>
                </label>
                <div class="context-input-row context-input-group-row">
                    <div class="context-input-group">
                        <label class="context-input-label">Min</label>
                        <input class="context-number-input" data-role="minWidth" type="number" min="0.1" max="50" step="${step}" value="${formatValue(edgeMinWidth)}" aria-label="Min Width">
                    </div>
                    <div class="context-input-group">
                        <label class="context-input-label">Scale</label>
                        <input class="context-number-input" data-role="scale" type="number" min="0.1" max="3" step="0.01" value="${formatValue(edgeWidthScale)}" aria-label="Width Scale">
                    </div>
                    <div class="context-input-group">
                        <label class="context-input-label">Max</label>
                        <input class="context-number-input" data-role="maxWidth" type="number" min="0.1" max="50" step="${step}" value="${formatValue(edgeMaxWidth)}" aria-label="Max Width">
                    </div>
                </div>
                <div class="context-color-row">
                    <span class="context-slider-label">Color</span>
                    <div class="context-color-slot" data-role="edgeColor"></div>
                </div>
                <div class="context-input-row">
                    <span class="context-slider-label">Opacity</span>
                    <input class="context-number-input" data-role="opacity" type="number" min="0" max="1" step="0.05" value="1.00" aria-label="Edge Opacity">
                </div>
                <div class="context-input-row">
                    <span class="context-slider-label">Self Loop Size</span>
                    <input class="context-number-input" data-role="selfRefSize" type="number" min="10" max="100" step="5" value="20" aria-label="Self Reference Size">
                </div>
                <div class="context-input-row">
                    <label class="context-input-label" style="width: 100%;">Line Style
                        <select class="context-select-input" data-role="smoothType" aria-label="Smooth Type" style="width: 100%; margin-top: 3px;">
                            <option value="straight">Straight</option>
                            <option value="curve-dynamic" selected>Curve Dynamic</option>
                            <option value="curve-cw">Curve CW</option>
                            <option value="curve-ccw">Curve CCW</option>
                            <option value="curve-bezier">Curve Bezier</option>
                        </select>
                    </label>
                </div>
                <div class="context-input-row">
                    <label class="context-popover-toggle" style="margin: 0;">
                        <input type="checkbox" class="context-popover-checkbox" data-role="dashed" aria-label="Dashed">
                        <span>Dashed</span>
                    </label>
                </div>
                <div class="context-input-row">
                    <span class="context-slider-label">Edge Length</span>
                    <input class="context-number-input" data-role="edgeLength" type="number" min="50" max="500" step="10" value="100" aria-label="Edge Length">
                </div>
                <div class="context-input-row" style="display: flex; gap: 10px;">
                    <label class="context-popover-toggle" style="flex: 1; margin: 0;">
                        <input type="checkbox" class="context-popover-checkbox" data-role="arrowTo" aria-label="Arrow To">
                        <span>Arrow To →</span>
                    </label>
                    <label class="context-popover-toggle" style="flex: 1; margin: 0;">
                        <input type="checkbox" class="context-popover-checkbox" data-role="arrowFrom" aria-label="Arrow From">
                        <span>Arrow From ←</span>
                    </label>
                </div>
                <div data-role="arrowToConfig" style="display: none;">
                    <div class="context-input-row">
                        <label class="context-input-label" style="width: 100%;">To Arrow Shape
                            <select class="context-select-input" data-role="arrowToShape" style="width: 100%; margin-top: 3px;">
                                <option value="arrow">Arrow</option>
                                <option value="bar">Bar</option>
                                <option value="circle">Circle</option>
                                <option value="box">Box</option>
                                <option value="crow">Crow</option>
                                <option value="curve">Curve</option>
                                <option value="diamond">Diamond</option>
                                <option value="inv_curve">Inv Curve</option>
                                <option value="triangle">Triangle</option>
                                <option value="inv_triangle">Inv Triangle</option>
                                <option value="vee">Vee</option>
                            </select>
                        </label>
                    </div>
                    <div class="context-input-row">
                        <span class="context-slider-label">To Arrow Scale</span>
                        <input class="context-number-input" data-role="arrowToScale" type="number" min="0.1" max="3" step="0.1" value="1.0">
                    </div>
                </div>
                <div data-role="arrowFromConfig" style="display: none;">
                    <div class="context-input-row">
                        <label class="context-input-label" style="width: 100%;">From Arrow Shape
                            <select class="context-select-input" data-role="arrowFromShape" style="width: 100%; margin-top: 3px;">
                                <option value="arrow">Arrow</option>
                                <option value="bar">Bar</option>
                                <option value="circle">Circle</option>
                                <option value="box">Box</option>
                                <option value="crow">Crow</option>
                                <option value="curve">Curve</option>
                                <option value="diamond">Diamond</option>
                                <option value="inv_curve">Inv Curve</option>
                                <option value="triangle">Triangle</option>
                                <option value="inv_triangle">Inv Triangle</option>
                                <option value="vee">Vee</option>
                            </select>
                        </label>
                    </div>
                    <div class="context-input-row">
                        <span class="context-slider-label">From Arrow Scale</span>
                        <input class="context-number-input" data-role="arrowFromScale" type="number" min="0.1" max="3" step="0.1" value="1.0">
                    </div>
                </div>
            `;
            document.body.appendChild(pop);
            this._makePopoverDraggable(pop);
            const closeBtn = pop.querySelector('[data-role="closePopover"]');
            if (closeBtn) {
                closeBtn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    this.closeEdgeStylePopover();
                });
            }

            pop.addEventListener('mouseenter', () => {
                this._edgePopoverHover = true;
                if (this._edgePopoverCloseTimer) {
                    clearTimeout(this._edgePopoverCloseTimer);
                    this._edgePopoverCloseTimer = null;
                }
            });
            pop.addEventListener('mouseleave', () => {
                this._edgePopoverHover = false;
            });

            const rect = pop.getBoundingClientRect();
            const margin = 8;
            let nextLeft = anchorX;
            let nextTop = anchorY;
            if (anchorX + rect.width > window.innerWidth - margin) {
                nextLeft = anchorX - rect.width - 12;
            }
            if (nextLeft < margin) {
                nextLeft = margin;
            }
            if (rect.bottom > window.innerHeight - margin) {
                nextTop = window.innerHeight - rect.height - margin;
            }
            pop.style.left = `${Math.max(margin, nextLeft)}px`;
            pop.style.top = `${Math.max(margin, nextTop)}px`;

            const toggle = pop.querySelector('.context-popover-checkbox');
            const getApplyToAll = () => toggle ? toggle.checked : false;

            // Helper to apply to all edges or single edge
            const applyEdgeStyle = (updates) => {
                if (!this.visNetwork || !this.visNetwork.body?.data?.edges) return;
                const dataset = this.visNetwork.body.data;
                
                if (getApplyToAll()) {
                    const edges = dataset.edges.get();
                    const edgeUpdates = edges.map((e) => {
                        const currentEdge = dataset.edges.get(e.id);
                        return { id: e.id, ...updates };
                    });
                    dataset.edges.update(edgeUpdates);
                } else {
                    dataset.edges.update({ id: edgeId, ...updates });
                }
                if (this.visNetwork) this.visNetwork.redraw();
            };
            
            // Bind number inputs
            const bindNumberInput = (role, onChange) => {
                const input = pop.querySelector(`input[data-role="${role}"]`);
                if (!input) return;
                const applyValue = (raw) => {
                    const next = Number(raw);
                    if (!Number.isFinite(next)) return;
                    const min = Number(input.min) || 0;
                    const max = Number(input.max) || 200;
                    const clamped = Math.max(min, Math.min(max, next));
                    input.value = String(clamped);
                    onChange(clamped);
                };
                input.addEventListener('input', (ev) => {
                    ev.stopPropagation();
                    applyValue(input.value);
                });
                input.addEventListener('change', (ev) => {
                    ev.stopPropagation();
                    applyValue(input.value);
                });
                input.addEventListener('wheel', (ev) => {
                    ev.preventDefault();
                    const step = Number(input.step) || 1;
                    const delta = ev.deltaY < 0 ? step : -step;
                    const currentVal = Number(input.value) || 0;
                    const min = Number(input.min) || 0;
                    const max = Number(input.max) || 200;
                    const nextVal = Math.max(min, Math.min(max, currentVal + delta));
                    applyValue(nextVal);
                }, { passive: false });
                input.addEventListener('click', (ev) => ev.stopPropagation());
            };
            
            // Local variables to track slider values
            let localMinWidth = edgeMinWidth;
            let localMaxWidth = edgeMaxWidth;
            let localScale = edgeWidthScale;

            // Helper to calculate and apply width for single edge or all edges
            const applyWidth = () => {
                if (getApplyToAll()) {
                    // Apply globally: update globals, clear custom widths, recalculate all
                    this.edgeMinWidth = localMinWidth;
                    this.edgeMaxWidth = localMaxWidth;
                    this.edgeWidthScale = localScale;
                    this._edgeCustomWidths.clear();
                    this.applyEdgeWidthRange();
                    this.queuePersistSettings();
                } else {
                    // Apply to single edge: calculate its width and set directly
                    const meta = this.visNetworkData?.meta || {};
                    const minRelated = Number.isFinite(meta.minRelated) ? meta.minRelated : 0;
                    const maxRelated = Number.isFinite(meta.maxRelated) ? meta.maxRelated : minRelated;
                    const related = getRelatedCount(edge);
                    const t = maxRelated > minRelated ? (related - minRelated) / (maxRelated - minRelated) : 0;
                    const baseWidth = localMinWidth + Math.max(0, Math.min(1, t)) * (localMaxWidth - localMinWidth);
                    const width = Number((baseWidth * localScale).toFixed(2));
                    this._edgeCustomWidths.add(edgeId);
                    dataset.update({ id: edgeId, width });
                    if (this.visNetwork) this.visNetwork.redraw();
                }
            };

            bindNumberInput('minWidth', (val) => {
                localMinWidth = val;
                applyWidth();
            });

            bindNumberInput('maxWidth', (val) => {
                localMaxWidth = val;
                applyWidth();
            });

            bindNumberInput('scale', (val) => {
                localScale = val;
                applyWidth();
            });
            
            // Setup color picker
            const setupColorPicker = (slotRole, property, defaultColor, applyGlobal) => {
                const slot = pop.querySelector(`[data-role="${slotRole}"]`);
                if (!slot) return;

                const rawColor = edge?.color;
                const edgeColorStr = typeof rawColor === 'string' ? rawColor : (rawColor?.color || null);
                const initialColor = edgeColorStr || this.edgeColor || defaultColor;

                const colorDisplay = document.createElement('div');
                colorDisplay.className = 'context-color-display';
                colorDisplay.style.backgroundColor = initialColor;

                const colorInput = document.createElement('input');
                colorInput.type = 'text';
                colorInput.className = 'context-color-input';
                colorInput.setAttribute('data-coloris', '');
                colorInput.value = initialColor;

                slot.appendChild(colorDisplay);
                slot.appendChild(colorInput);

                const updateColor = (val) => {
                    colorDisplay.style.backgroundColor = val;
                    colorInput.value = val;
                    if (getApplyToAll() && applyGlobal) {
                        applyGlobal.call(this, val);
                    } else {
                        applyEdgeStyle({ color: val });
                    }
                };

                colorInput.addEventListener('input', () => updateColor(colorInput.value));
                colorInput.addEventListener('change', () => updateColor(colorInput.value));

                slot.addEventListener('click', () => {
                    colorInput.dispatchEvent(new Event('click', { bubbles: true }));
                });

                if (typeof global.Coloris !== 'undefined') {
                    try {
                        global.Coloris({
                            el: colorInput,
                            alpha: true,
                            format: 'hex',
                            formatToggle: false,
                            wrap: false,
                            forceAlpha: true
                        });
                    } catch (e) {
                        // Coloris initialization failed
                    }
                }
            };
            
            setupColorPicker('edgeColor', 'color', this.edgeColor || '#1a1a1aff', (val) => {
                this.edgeColor = val;
                this.queuePersistSettings();
            });

            // Setup style controls
            const smoothTypeSelect = pop.querySelector('[data-role="smoothType"]');
            const dashedCheckbox = pop.querySelector('[data-role="dashed"]');
            const edgeLengthInput = pop.querySelector('[data-role="edgeLength"]');

            // Arrow controls
            const arrowToCheckbox = pop.querySelector('[data-role="arrowTo"]');
            const arrowFromCheckbox = pop.querySelector('[data-role="arrowFrom"]');
            const arrowToConfig = pop.querySelector('[data-role="arrowToConfig"]');
            const arrowFromConfig = pop.querySelector('[data-role="arrowFromConfig"]');
            const arrowToShapeSelect = pop.querySelector('[data-role="arrowToShape"]');
            const arrowFromShapeSelect = pop.querySelector('[data-role="arrowFromShape"]');
            const arrowToScaleInput = pop.querySelector('[data-role="arrowToScale"]');
            const arrowFromScaleInput = pop.querySelector('[data-role="arrowFromScale"]');

            // Initialize with current edge style or defaults
            const currentSmooth = edge?.smooth;
            const currentDashed = edge?.dashes ? true : false;
            const currentArrows = edge?.arrows || false;

            // Set initial values
            if (currentSmooth === false) {
                smoothTypeSelect.value = 'straight';
            } else if (currentSmooth?.type === 'dynamic') {
                smoothTypeSelect.value = 'curve-dynamic';
            } else if (currentSmooth?.type === 'curvedCW') {
                smoothTypeSelect.value = 'curve-cw';
            } else if (currentSmooth?.type === 'curvedCCW') {
                smoothTypeSelect.value = 'curve-ccw';
            } else if (currentSmooth?.type === 'continuous') {
                smoothTypeSelect.value = 'curve-bezier';
            }

            if (dashedCheckbox) dashedCheckbox.checked = currentDashed;

            // Initialize edge length
            const currentLength = edge?.length ?? 100;
            if (edgeLengthInput) edgeLengthInput.value = String(currentLength);

            // Initialize arrow controls
            const hasArrowTo = edge?.arrows?.to?.enabled ?? false;
            const hasArrowFrom = edge?.arrows?.from?.enabled ?? false;
            if (arrowToCheckbox) arrowToCheckbox.checked = hasArrowTo;
            if (arrowFromCheckbox) arrowFromCheckbox.checked = hasArrowFrom;
            if (arrowToConfig) arrowToConfig.style.display = hasArrowTo ? 'block' : 'none';
            if (arrowFromConfig) arrowFromConfig.style.display = hasArrowFrom ? 'block' : 'none';

            // Initialize arrow shapes and scales
            if (arrowToShapeSelect && edge?.arrows?.to?.type) {
                arrowToShapeSelect.value = edge.arrows.to.type;
            }
            if (arrowFromShapeSelect && edge?.arrows?.from?.type) {
                arrowFromShapeSelect.value = edge.arrows.from.type;
            }
            if (arrowToScaleInput) {
                arrowToScaleInput.value = (edge?.arrows?.to?.scaleFactor ?? 1.0).toFixed(1);
            }
            if (arrowFromScaleInput) {
                arrowFromScaleInput.value = (edge?.arrows?.from?.scaleFactor ?? 1.0).toFixed(1);
            }

            // Helper to apply combined style
            const applyStyle = () => {
                const smoothType = smoothTypeSelect.value;
                const dashed = dashedCheckbox.checked;
                const length = edgeLengthInput ? Number(edgeLengthInput.value) : 100;

                // Arrow configuration
                const hasArrowTo = arrowToCheckbox ? arrowToCheckbox.checked : false;
                const hasArrowFrom = arrowFromCheckbox ? arrowFromCheckbox.checked : false;
                const arrowToShape = arrowToShapeSelect ? arrowToShapeSelect.value : 'arrow';
                const arrowFromShape = arrowFromShapeSelect ? arrowFromShapeSelect.value : 'arrow';
                const arrowToScale = arrowToScaleInput ? Number(arrowToScaleInput.value) : 1.0;
                const arrowFromScale = arrowFromScaleInput ? Number(arrowFromScaleInput.value) : 1.0;

                const updates = {};

                // Apply smooth type
                if (smoothType === 'straight') {
                    updates.smooth = false;
                } else if (smoothType === 'curve-dynamic') {
                    updates.smooth = { type: 'dynamic', roundness: 0.25 };
                } else if (smoothType === 'curve-cw') {
                    updates.smooth = { type: 'curvedCW', roundness: 0.25 };
                } else if (smoothType === 'curve-ccw') {
                    updates.smooth = { type: 'curvedCCW', roundness: 0.25 };
                } else if (smoothType === 'curve-bezier') {
                    updates.smooth = { type: 'continuous', roundness: 0.35 };
                }

                // Apply dashed
                updates.dashes = dashed ? [6, 6] : false;

                // Apply edge length
                updates.length = length;

                // Apply arrows with separate to/from configuration
                updates.arrows = {
                    to: {
                        enabled: hasArrowTo,
                        type: arrowToShape,
                        scaleFactor: arrowToScale
                    },
                    from: {
                        enabled: hasArrowFrom,
                        type: arrowFromShape,
                        scaleFactor: arrowFromScale
                    },
                    middle: { enabled: false }
                };

                applyEdgeStyle(updates);
            };

            // Event listeners
            if (smoothTypeSelect) {
                smoothTypeSelect.addEventListener('change', (ev) => {
                    ev.stopPropagation();
                    applyStyle();
                });
            }

            if (dashedCheckbox) {
                dashedCheckbox.addEventListener('change', (ev) => {
                    ev.stopPropagation();
                    applyStyle();
                });
            }

            // Arrow To checkbox
            if (arrowToCheckbox) {
                arrowToCheckbox.addEventListener('change', (ev) => {
                    ev.stopPropagation();
                    const enabled = arrowToCheckbox.checked;
                    if (arrowToConfig) arrowToConfig.style.display = enabled ? 'block' : 'none';
                    applyStyle();
                });
            }

            // Arrow From checkbox
            if (arrowFromCheckbox) {
                arrowFromCheckbox.addEventListener('change', (ev) => {
                    ev.stopPropagation();
                    const enabled = arrowFromCheckbox.checked;
                    if (arrowFromConfig) arrowFromConfig.style.display = enabled ? 'block' : 'none';
                    applyStyle();
                });
            }

            // Arrow To shape and scale
            if (arrowToShapeSelect) {
                arrowToShapeSelect.addEventListener('change', (ev) => {
                    ev.stopPropagation();
                    applyStyle();
                });
            }
            if (arrowToScaleInput) {
                arrowToScaleInput.addEventListener('input', (ev) => {
                    ev.stopPropagation();
                    applyStyle();
                });
            }

            // Arrow From shape and scale
            if (arrowFromShapeSelect) {
                arrowFromShapeSelect.addEventListener('change', (ev) => {
                    ev.stopPropagation();
                    applyStyle();
                });
            }
            if (arrowFromScaleInput) {
                arrowFromScaleInput.addEventListener('input', (ev) => {
                    ev.stopPropagation();
                    applyStyle();
                });
            }

            // Edge length
            bindNumberInput('edgeLength', (val) => {
                applyStyle();
            });

            // Setup opacity and selfReference controls
            const opacityInput = pop.querySelector('[data-role="opacity"]');
            const selfRefSizeInput = pop.querySelector('[data-role="selfRefSize"]');

            // Initialize opacity from edge
            const currentOpacity = edge?.opacity ?? 1.0;
            if (opacityInput) opacityInput.value = currentOpacity.toFixed(2);

            // Initialize selfReference size
            const currentSelfRefSize = edge?.selfReference?.size ?? 20;
            if (selfRefSizeInput) selfRefSizeInput.value = String(currentSelfRefSize);

            // Bind opacity control
            bindNumberInput('opacity', (val) => {
                const updates = { opacity: val };
                applyEdgeStyle(updates);
            });

            // Bind selfReference control using new API
            bindNumberInput('selfRefSize', (val) => {
                const updates = {
                    selfReference: {
                        size: val,
                        angle: Math.PI / 4
                    }
                };
                applyEdgeStyle(updates);
            });

            const keyHandler = (ev) => {
                if (ev.key === 'Escape') this.closeEdgeStylePopover();
            };
            pop._edgeStyleKeyHandler = keyHandler;
            document.addEventListener('keydown', keyHandler);
            this._edgeStylePopover = { el: pop, edgeId };
        }

        showEdgeContextMenu(e, edgeId) {
            if (!edgeId || !e) return;
            this.closeNodeContextMenu();
            this.closeEdgeContextMenu();
            if (this._toolbarMode === 'node') return;
            this._tempToolbarMode = 'edge';
            const menu = document.createElement('div');
            menu.className = 'context-menu edge-menu';
            menu.style.left = `${e.pageX}px`;
            menu.style.top = `${e.pageY}px`;
            menu.innerHTML = `
                <div class="context-menu-item" data-action="enterEdgeMode">
                    <i class="fas fa-bullseye"></i>
                    Enter Edge Mode
                </div>
                <div class="context-menu-item" data-action="pickEdgeStyle">
                    <i class="fas fa-palette"></i>
                    Edge Style
                </div>
                <div class="context-menu-item" data-action="pickEdgeLabelStyle">
                    <i class="fas fa-font"></i>
                    Edge Label Style
                </div>
                <div class="context-menu-item" data-action="pickPhysics">
                    <i class="fas fa-atom"></i>
                    Physics
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
                item.addEventListener('click', (ev) => {
                    const action = item.dataset.action;
                    if (action === 'enterEdgeMode') {
                        this.setToolbarMode('edge');
                        this.updateModeToolbar();
                        this.closeEdgeContextMenu();
                        return;
                    }
                    if (action === 'pickEdgeStyle') {
                        this.openEdgeStylePopover({ edgeId, x: ev.pageX, y: ev.pageY });
                        this.closeEdgeContextMenu();
                        return;
                    }
                    if (action === 'pickEdgeLabelStyle') {
                        this.openEdgeLabelStylePopover({ edgeId, x: ev.pageX, y: ev.pageY });
                        this.closeEdgeContextMenu();
                        return;
                    }
                    if (action === 'pickPhysics') {
                        this.openPhysicsPopover({ x: ev.pageX, y: ev.pageY });
                        this.closeEdgeContextMenu();
                        return;
                    }
                });
            });
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
            if (this._toolbarMode === 'edge') return;
            this._tempToolbarMode = 'node';
            const menu = document.createElement('div');
            menu.className = 'context-menu node-menu';
            menu.style.left = `${e.pageX}px`;
            menu.style.top = `${e.pageY}px`;
            menu.innerHTML = `
                <div class="context-menu-item" data-action="selectNodeFocus">
                    <i class="fas fa-bullseye"></i>
                    Enter Node Mode
                </div>
                <div class="context-menu-item" data-action="pickNodeBaseStyle">
                    <i class="fas fa-palette"></i>
                    Node Style
                </div>
                <div class="context-menu-item" data-action="pickNodeLabelStyle">
                    <i class="fas fa-font"></i>
                    Node Label Style
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
                item.addEventListener('click', (ev) => {
                    const action = item.dataset.action;
                    if (action === 'selectNodeFocus') {
                        this.setToolbarMode('node');
                        this.closeNodeContextMenu();
                        this.updateModeToolbar();
                        return;
                    }
                    if (action === 'pickNodeBaseStyle') {
                        this.openNodeBasePopover({
                            nodeId,
                            x: ev.pageX,
                            y: ev.pageY
                        });
                        this.closeNodeContextMenu();
                        return;
                    }
                    if (action === 'pickNodeLabelStyle') {
                        this.openNodeLabelStylePopover({
                            nodeId,
                            x: ev.pageX,
                            y: ev.pageY
                        });
                        this.closeNodeContextMenu();
                        return;
                    }
                });
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
            this._nodeContextMenu = { menuEl: menu, nodeId, x: e.pageX, y: e.pageY };
        }

        openNodeStylePopover({ nodeId, type, x, y }) {
            if (!nodeId || !type) return;
            this.closeNodeStylePopover();
            const dataset = this.visNetwork?.body?.data?.nodes;
            const node = dataset && typeof dataset.get === 'function' ? dataset.get(nodeId) : null;
            const isStroke = type === 'stroke';
            const label = isStroke ? 'Stroke Style' : 'Border Style';
            const widthLabel = isStroke ? 'Stroke Width' : 'Border Width';
            const currentWidth = isStroke
                ? Number(node?.outerBorderWidth ?? this.nodeOuterBorderWidth ?? 2)
                : Number(node?.borderWidth ?? this.nodeBorderWidth ?? 1.5);
            const formatWidth = (value) => {
                const next = Number(value);
                return Number.isFinite(next) ? next.toFixed(3) : '0.000';
            };
            const step = 0.05;
            const pop = document.createElement('div');
            pop.className = 'context-style-popover';
            const anchorX = Number(x) || 0;
            const anchorY = Number(y) || 0;
            pop.style.left = `${anchorX}px`;
            pop.style.top = `${anchorY}px`;
            pop.innerHTML = `
                <button type="button" class="context-popover-close-btn" data-role="closePopover" title="Close (Esc)">&times;</button>
                <label class="context-popover-toggle">
                    <input type="checkbox" class="context-popover-checkbox" aria-label="Apply to all nodes">
                    <span>Apply to all nodes</span>
                </label>
                <div class="context-slider-row">
                    <span class="context-slider-label">Width</span>
                    <input type="range" min="0" max="50" step="${step}" value="${Number.isFinite(currentWidth) ? currentWidth : 0}" aria-label="${widthLabel}">
                    <span class="context-slider-value" data-role="value">${formatWidth(currentWidth)}</span>
                </div>
                <div class="context-color-row">
                    <div class="context-color-slot"></div>
                </div>
            `;
            document.body.appendChild(pop);
            const closeBtn = pop.querySelector('[data-role="closePopover"]');
            if (closeBtn) {
                closeBtn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    this.closeNodeStylePopover();
                });
            }
            pop.addEventListener('mouseenter', () => {
                this._nodePopoverHover = true;
                if (this._nodePopoverCloseTimer) {
                    clearTimeout(this._nodePopoverCloseTimer);
                    this._nodePopoverCloseTimer = null;
                }
            });
            pop.addEventListener('mouseleave', () => {
                this._nodePopoverHover = false;
            });
            const rect = pop.getBoundingClientRect();
            const margin = 8;
            let nextLeft = anchorX;
            let nextTop = anchorY;
            if (rect.right > window.innerWidth - margin) {
                nextLeft = window.innerWidth - rect.width - margin;
            }
            if (rect.bottom > window.innerHeight - margin) {
                nextTop = window.innerHeight - rect.height - margin;
            }
            pop.style.left = `${Math.max(margin, nextLeft)}px`;
            pop.style.top = `${Math.max(margin, nextTop)}px`;

            const colorSlot = pop.querySelector('.context-color-slot');
            const colorInput = isStroke
                ? this.getEl(this.ids.nodeContextStrokeColorInput)
                : this.getEl(this.ids.nodeContextBorderColorInput);
            if (colorInput && colorSlot) {
                const seed = isStroke
                    ? (node?.outerBorderColor || this.nodeOuterBorderColor || '#ffffff')
                    : (node?.color?.border || this.nodeBorderColor || '#111111');
                const parent = colorInput.parentNode;
                const next = colorInput.nextSibling;
                colorInput.classList.remove('vis-node-context-color-input');
                colorInput.classList.add('context-color-input');
                colorSlot.appendChild(colorInput);
                this.setColorInputValueSilent(colorInput, seed);
                this._nodeContextColorTarget = nodeId;
                this._nodeStylePopover = {
                    el: pop,
                    nodeId,
                    type,
                    movedInput: { input: colorInput, parent, next }
                };
                colorInput.dispatchEvent(new Event('click', { bubbles: true }));
            }

            const toggle = pop.querySelector('.context-popover-checkbox');
            if (toggle) {
                toggle.checked = !!this._nodeStyleApplyAll;
                toggle.addEventListener('change', () => {
                    this._nodeStyleApplyAll = toggle.checked;
                });
            }
            const input = pop.querySelector('input[type="range"]');
            const valueEl = pop.querySelector('[data-role="value"]');
            const applyValue = (raw) => {
                const next = Number(raw);
                if (!Number.isFinite(next)) return;
                if (valueEl) valueEl.textContent = formatWidth(next);
                if (this._nodeStyleApplyAll) {
                    if (isStroke) {
                        this.nodeOuterBorderWidth = next;
                        if (this.visNetwork) this.visNetwork.redraw();
                    } else {
                        this.nodeBorderWidth = next;
                        this.applyNodeBorderWidth();
                    }
                    this.queuePersistSettings();
                    return;
                }
                if (isStroke) {
                    this.applyNodeOuterBorderWidthForId(nodeId, next);
                } else {
                    this.applyNodeBorderWidthForId(nodeId, next);
                }
            };
            if (input) {
                const min = Number(input.min) || 0;
                const max = Number(input.max) || 50;
                const base = Number.isFinite(currentWidth) ? currentWidth : 0;
                input.value = String(Math.max(min, Math.min(max, base)));
                if (valueEl) valueEl.textContent = formatWidth(input.value);
                input.addEventListener('input', (ev) => {
                    ev.stopPropagation();
                    applyValue(input.value);
                });
                input.addEventListener('wheel', (ev) => {
                    ev.preventDefault();
                    const delta = ev.deltaY < 0 ? step : -step;
                    const currentVal = Number(input.value) || 0;
                    const nextVal = Math.max(0, Math.min(50, currentVal + delta));
                    input.value = String(nextVal);
                    applyValue(nextVal);
                }, { passive: false });
                input.addEventListener('click', (ev) => ev.stopPropagation());
                input.focus({ preventScroll: true });
            }
            const keyHandler = (ev) => {
                if (ev.key === 'Escape') this.closeNodeStylePopover();
            };
            pop._nodeStyleKeyHandler = keyHandler;
            document.addEventListener('keydown', keyHandler);
            if (!this._nodeStylePopover) {
                this._nodeStylePopover = { el: pop, nodeId, type, movedInput: null };
            }
        }

        openNodeBasePopover({ nodeId, x, y }) {
            if (!nodeId) return;
            this.closeNodeBasePopover();
            const dataset = this.visNetwork?.body?.data?.nodes;
            const node = dataset && typeof dataset.get === 'function' ? dataset.get(nodeId) : null;
            const step = 0.1;
            const curveStep = 0.005;
            const formatValue = (value) => {
                const next = Number(value);
                return Number.isFinite(next) ? next.toFixed(3) : '0.000';
            };
            const minValue = Number(this.nodeSizeMin ?? 6);
            const maxValue = Number(this.nodeSizeMax ?? 60);
            const curveValue = Number(this.nodeSizeGamma ?? 1);
            const borderWidth = Number(node?.borderWidth ?? this.nodeBorderWidth ?? 1.5);
            const strokeWidth = Number(node?.outerBorderWidth ?? this.nodeOuterBorderWidth ?? 2);
            const pop = document.createElement('div');
            pop.className = 'context-node-popover';
            const anchorX = Number(x) || 0;
            const anchorY = Number(y) || 0;
            pop.style.left = `${anchorX}px`;
            pop.style.top = `${anchorY}px`;
            pop.innerHTML = `
                <div class="context-popover-drag-handle" title="Drag to move">Node Appearance</div>
                <button type="button" class="context-popover-close-btn" data-role="closePopover" title="Close (Esc)">&times;</button>
                <label class="context-popover-toggle">
                    <input type="checkbox" class="context-popover-checkbox" aria-label="Apply to all nodes">
                    <span>Apply to all nodes</span>
                </label>
                <div class="context-input-row context-input-group-row">
                    <div class="context-input-group">
                        <label class="context-input-label">Min</label>
                        <input class="context-number-input" data-role="min" type="number" min="0.5" max="50" step="${step}" value="${Number.isFinite(minValue) ? minValue : 0.5}" aria-label="Node size min">
                    </div>
                    <div class="context-input-group">
                        <label class="context-input-label">Curve</label>
                        <input class="context-number-input" data-role="curve" type="number" min="0" max="1" step="${curveStep}" value="${Number.isFinite(curveValue) ? curveValue : 1}" aria-label="Node size curve">
                    </div>
                    <div class="context-input-group">
                        <label class="context-input-label">Max</label>
                        <input class="context-number-input" data-role="max" type="number" min="30" max="120" step="${step}" value="${Number.isFinite(maxValue) ? maxValue : 30}" aria-label="Node size max">
                    </div>
                </div>
                <div class="context-input-row">
                    <span class="context-slider-label">Border</span>
                    <input class="context-number-input" data-role="borderWidth" type="number" min="0" max="50" step="0.01" value="${borderWidth.toFixed(2)}" aria-label="Border Width">
                    <div class="context-color-slot" data-role="borderColor"></div>
                </div>
                <div class="context-input-row">
                    <span class="context-slider-label">Stroke</span>
                    <input class="context-number-input" data-role="strokeWidth" type="number" min="0" max="50" step="0.01" value="${strokeWidth.toFixed(2)}" aria-label="Stroke Width">
                    <div class="context-color-slot" data-role="strokeColor"></div>
                </div>
                <div class="context-color-row">
                    <span class="context-slider-label">Color</span>
                    <div class="context-color-slot" data-role="nodeColor"></div>
                </div>
                <div class="context-divider"></div>
                <div class="context-select-row">
                    <span class="context-slider-label">Shape</span>
                    <select class="context-select" data-role="shape" aria-label="Node shape">
                        <option value="dot">dot</option>
                        <option value="circle">circle</option>
                        <option value="ellipse">ellipse</option>
                        <option value="box">box</option>
                        <option value="diamond">diamond</option>
                        <option value="triangle">triangle</option>
                        <option value="triangleDown">triangleDown</option>
                        <option value="star">star</option>
                        <option value="hexagon">hexagon</option>
                        <option value="square">square</option>
                        <option value="icon">icon (Font Awesome)</option>
                    </select>
                </div>
                <div class="context-icon-row" data-role="iconControls">
                    <span class="context-slider-label">Icon</span>
                    <select class="context-select" data-role="iconPreset" aria-label="Icon preset">
                        <option value="f007">user</option>
                        <option value="f0c0">users</option>
                        <option value="f013">gear</option>
                        <option value="f0f3">bell</option>
                        <option value="f06e">eye</option>
                        <option value="f02d">book</option>
                        <option value="f0f4">coffee</option>
                        <option value="f1c0">database</option>
                        <option value="f0c3">flask</option>
                        <option value="f121">code</option>
                    </select>
                    <input class="context-icon-input" data-role="iconInput" type="text" placeholder="f007" aria-label="Icon code (hex)">
                    <input class="context-icon-size" data-role="iconSize" type="number" min="6" max="120" step="1" value="26" aria-label="Icon size">
                </div>
            `;
            document.body.appendChild(pop);
            this._makePopoverDraggable(pop);
            const closeBtn = pop.querySelector('[data-role="closePopover"]');
            if (closeBtn) {
                closeBtn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    this.closeNodeBasePopover();
                });
            }
            pop.addEventListener('mouseenter', () => {
                this._nodePopoverHover = true;
                if (this._nodePopoverCloseTimer) {
                    clearTimeout(this._nodePopoverCloseTimer);
                    this._nodePopoverCloseTimer = null;
                }
            });
            pop.addEventListener('mouseleave', () => {
                this._nodePopoverHover = false;
            });
            const rect = pop.getBoundingClientRect();
            const margin = 8;
            let nextLeft = anchorX;
            let nextTop = anchorY;
            // Check if would overflow on the right, if so display on the left
            if (anchorX + rect.width > window.innerWidth - margin) {
                nextLeft = anchorX - rect.width - 12;
            }
            // Ensure not overflow on the left
            if (nextLeft < margin) {
                nextLeft = margin;
            }
            if (rect.bottom > window.innerHeight - margin) {
                nextTop = window.innerHeight - rect.height - margin;
            }
            pop.style.left = `${Math.max(margin, nextLeft)}px`;
            pop.style.top = `${Math.max(margin, nextTop)}px`;

            const toggle = pop.querySelector('.context-popover-checkbox');
            if (toggle) {
                toggle.checked = !!this._nodeStyleApplyAll;
                toggle.addEventListener('change', () => {
                    this._nodeStyleApplyAll = toggle.checked;
                });
            }
            const shapeSelect = pop.querySelector('select[data-role="shape"]');
            if (shapeSelect) {
                const currentShape = node?.shape || 'dot';
                shapeSelect.value = String(currentShape);
                const iconControls = pop.querySelector('[data-role="iconControls"]');
                if (iconControls) {
                    iconControls.style.display = currentShape === 'icon' ? 'flex' : 'none';
                }
                shapeSelect.addEventListener('change', () => {
                    const next = String(shapeSelect.value || 'dot');
                    if (iconControls) {
                        iconControls.style.display = next === 'icon' ? 'flex' : 'none';
                    }
                    if (this._nodeStyleApplyAll) {
                        if (next === 'icon') {
                            const iconPayload = this.buildNodeIconPayload(pop, node);
                            if (iconPayload) this.applyNodeIconForAll(iconPayload);
                            return;
                        }
                        this.applyNodeShapeForAll(next);
                        return;
                    }
                    if (next === 'icon') {
                        const iconPayload = this.buildNodeIconPayload(pop, node);
                        if (iconPayload) this.applyNodeIconForId(nodeId, iconPayload);
                        return;
                    }
                    this.applyNodeShapeForId(nodeId, next);
                });
            }
            const iconInput = pop.querySelector('[data-role="iconInput"]');
            const iconPreset = pop.querySelector('[data-role="iconPreset"]');
            const iconSize = pop.querySelector('[data-role="iconSize"]');
            const applyIconChange = () => {
                if (!shapeSelect || shapeSelect.value !== 'icon') return;
                const iconPayload = this.buildNodeIconPayload(pop, node);
                if (!iconPayload) return;
                if (this._nodeStyleApplyAll) {
                    this.applyNodeIconForAll(iconPayload);
                    return;
                }
                this.applyNodeIconForId(nodeId, iconPayload);
            };
            if (iconPreset) {
                iconPreset.addEventListener('change', () => {
                    if (iconInput) iconInput.value = String(iconPreset.value || '');
                    applyIconChange();
                });
            }
            if (iconInput) {
                iconInput.addEventListener('input', applyIconChange);
                if (iconPreset && iconPreset.value) {
                    iconInput.value = String(iconPreset.value || '');
                }
            }
            if (iconSize) {
                const currentSize = Number(node?.icon?.size);
                if (Number.isFinite(currentSize)) iconSize.value = String(currentSize);
                iconSize.addEventListener('input', applyIconChange);
            }
            // Setup color pickers with coloris (no auto-popup)
            const setupColorPicker = (slotRole, defaultColor, applyFn) => {
                const slot = pop.querySelector(`[data-role="${slotRole}"]`);
                if (!slot) return;

                // Create color display div
                const colorDisplay = document.createElement('div');
                colorDisplay.className = 'context-color-display';
                colorDisplay.style.backgroundColor = defaultColor;

                // Create hidden input for coloris
                const colorInput = document.createElement('input');
                colorInput.type = 'text';
                colorInput.className = 'context-color-input';
                colorInput.setAttribute('data-coloris', '');
                colorInput.value = defaultColor;

                slot.appendChild(colorDisplay);
                slot.appendChild(colorInput);

                // Update color display when color changes
                const updateColor = (color) => {
                    colorDisplay.style.backgroundColor = color;
                    colorInput.value = color;
                    applyFn(color);
                };

                colorInput.addEventListener('input', () => updateColor(colorInput.value));
                colorInput.addEventListener('change', () => updateColor(colorInput.value));

                // Click slot to open color picker
                slot.addEventListener('click', () => {
                    colorInput.dispatchEvent(new Event('click', { bubbles: true }));
                });

                // Initialize coloris (without auto-open)
                if (typeof global.Coloris !== 'undefined') {
                    try {
                        global.Coloris({
                            el: colorInput,
                            alpha: true,
                            format: 'hex',
                            formatToggle: false,
                            wrap: false,
                            forceAlpha: true
                        });
                    } catch (e) {
                        // Coloris initialization failed
                    }
                }
            };

            // Node color
            const nodeColorDefault = typeof node?.color === 'string'
                ? node.color
                : (node?.color?.background || this.nodeColor || '#ffffff');
            setupColorPicker('nodeColor', nodeColorDefault, (val) => {
                if (this._nodeStyleApplyAll) {
                    this.nodeColor = val;
                    this.applyNodeColor();
                    this.queuePersistSettings();
                } else {
                    this.applyNodeColorForId(nodeId, val);
                }
            });

            // Border color
            const borderColorDefault = node?.color?.border || this.nodeBorderColor || '#111111';
            setupColorPicker('borderColor', borderColorDefault, (val) => {
                if (this._nodeStyleApplyAll) {
                    this.nodeBorderColor = val;
                    this.applyNodeBorderColor();
                    this.queuePersistSettings();
                } else {
                    this.applyNodeBorderColorForId(nodeId, val);
                }
            });

            // Stroke color
            const strokeColorDefault = node?.outerBorderColor || this.nodeOuterBorderColor || '#ffffff';
            setupColorPicker('strokeColor', strokeColorDefault, (val) => {
                if (this._nodeStyleApplyAll) {
                    this.nodeOuterBorderColor = val;
                    if (this.visNetwork) this.visNetwork.redraw();
                    this.queuePersistSettings();
                } else {
                    this.applyNodeOuterBorderColorForId(nodeId, val);
                }
            });

            this._nodeBasePopover = { el: pop, nodeId, movedInput: null };

            const bindNumberInput = (role, onChange) => {
                const input = pop.querySelector(`input[data-role="${role}"]`);
                if (!input) return;
                const step = Number(input.step) || 1;
                const applyValue = (raw) => {
                    const next = Number(raw);
                    if (!Number.isFinite(next)) return;
                    const min = Number(input.min) || 0;
                    const max = Number(input.max) || 200;
                    const clamped = Math.max(min, Math.min(max, next));
                    input.value = String(clamped);
                    onChange(clamped);
                };
                input.addEventListener('input', (ev) => {
                    ev.stopPropagation();
                    applyValue(input.value);
                });
                input.addEventListener('change', (ev) => {
                    ev.stopPropagation();
                    applyValue(input.value);
                });
                input.addEventListener('wheel', (ev) => {
                    ev.preventDefault();
                    const delta = ev.deltaY < 0 ? step : -step;
                    const currentVal = Number(input.value) || 0;
                    const min = Number(input.min) || 0;
                    const max = Number(input.max) || 200;
                    const nextVal = Math.max(min, Math.min(max, currentVal + delta));
                    applyValue(nextVal);
                }, { passive: false });
                input.addEventListener('click', (ev) => ev.stopPropagation());
            };

            bindNumberInput('min', (next) => {
                if (this._nodeStyleApplyAll) {
                    this.nodeSizeMin = next;
                    this.applyNodeSizeScale();
                    this.queuePersistSettings();
                } else {
                    // Apply fixed size to single node
                    const dataset = this.visNetwork?.body?.data?.nodes;
                    if (dataset) {
                        dataset.update({ id: nodeId, size: next });
                    }
                }
            });
            bindNumberInput('max', (next) => {
                if (this._nodeStyleApplyAll) {
                    this.nodeSizeMax = next;
                    this.applyNodeSizeScale();
                    this.queuePersistSettings();
                } else {
                    // Apply fixed size to single node
                    const dataset = this.visNetwork?.body?.data?.nodes;
                    if (dataset) {
                        dataset.update({ id: nodeId, size: next });
                    }
                }
            });
            bindNumberInput('curve', (next) => {
                if (this._nodeStyleApplyAll) {
                    this.nodeSizeGamma = next;
                    this.applyNodeSizeScale();
                    this.queuePersistSettings();
                } else {
                    // Curve doesn't apply to single node, ignore
                }
            });

            bindNumberInput('borderWidth', (next) => {
                if (this._nodeStyleApplyAll) {
                    this.nodeBorderWidth = next;
                    this.applyNodeBorderWidth();
                    this.queuePersistSettings();
                } else {
                    this.applyNodeBorderWidthForId(nodeId, next);
                }
            });

            bindNumberInput('strokeWidth', (next) => {
                if (this._nodeStyleApplyAll) {
                    this.nodeOuterBorderWidth = next;
                    if (this.visNetwork) this.visNetwork.redraw();
                    this.queuePersistSettings();
                } else {
                    this.applyNodeOuterBorderWidthForId(nodeId, next);
                }
            });

            const keyHandler = (ev) => {
                if (ev.key === 'Escape') this.closeNodeBasePopover();
            };
            pop._nodeBaseKeyHandler = keyHandler;
            document.addEventListener('keydown', keyHandler);
            if (!this._nodeBasePopover) {
                this._nodeBasePopover = { el: pop, nodeId, movedInput: null };
            }
        }

        openNodeLabelStylePopover({ nodeId, x, y }) {
            if (!nodeId) return;
            this.closeNodeLabelStylePopover();
            const dataset = this.visNetwork?.body?.data?.nodes;
            const node = dataset && typeof dataset.get === 'function' ? dataset.get(nodeId) : null;

            // Get current values from node or global settings
            const currentLabelScale = Number(node?.labelStyle?.scaleFont || this.labelSizeScale || 0.5);
            const currentStrokeWidth = Number(node?.labelStyle?.strokeWidth || this.labelStrokeWidth || 0);
            const currentBorderWidth = Number(node?.labelStyle?.borderWidth || this.labelBorderWidth || 0);
            const currentWeight = Number(node?.font?.weight || this.labelWeight || 500);
            const currentMaxScale = Number(this.labelFontMax || 20);
            const currentMinScale = Number(this.labelFontMin || 5);
            const currentFade = Number(this.labelFade || 0);

            const formatValue = (value, decimals = 1) => {
                const next = Number(value);
                return Number.isFinite(next) ? next.toFixed(decimals) : '0.0';
            };

            const pop = document.createElement('div');
            pop.className = 'context-style-popover';
            const anchorX = Number(x) || 0;
            const anchorY = Number(y) || 0;
            pop.style.left = `${anchorX}px`;
            pop.style.top = `${anchorY}px`;
            pop.innerHTML = `
                <div class="context-popover-drag-handle" title="Drag to move">Label Typography</div>
                <button type="button" class="context-popover-close-btn" data-role="closePopover" title="Close (Esc)">&times;</button>
                <label class="context-popover-toggle">
                    <input type="checkbox" class="context-popover-checkbox" aria-label="Apply to all nodes" checked disabled>
                    <span>Apply to all nodes (only)</span>
                </label>
                <div class="context-button-row">
                    <button type="button" class="context-toggle-button" data-role="toggleLabels" title="Toggle all labels visibility">
                        <i class="fa-solid fa-eye"></i>
                        <span>Toggle Labels</span>
                    </button>
                </div>
                <div class="context-divider"></div>
                <div class="context-input-row context-input-group-row">
                    <div class="context-input-group">
                        <label class="context-input-label">Min</label>
                        <input class="context-number-input" data-role="minScale" type="number" min="1" max="10" step="1" value="${Math.round(currentMinScale)}" aria-label="Min Font Size">
                    </div>
                    <div class="context-input-group">
                        <label class="context-input-label">Scale</label>
                        <input class="context-number-input" data-role="scale" type="number" min="0.1" max="2" step="0.01" value="${currentLabelScale.toFixed(2)}" aria-label="Label Scale">
                    </div>
                    <div class="context-input-group">
                        <label class="context-input-label">Weight</label>
                        <input class="context-number-input" data-role="fontWeight" type="number" min="100" max="900" step="100" value="${currentWeight}" aria-label="Font Weight">
                    </div>
                    <div class="context-input-group">
                        <label class="context-input-label">Max</label>
                        <input class="context-number-input" data-role="maxScale" type="number" min="5" max="30" step="1" value="${Math.round(currentMaxScale)}" aria-label="Max Font Size">
                    </div>
                </div>
                <div class="context-color-row">
                    <span class="context-slider-label">Text</span>
                    <div class="context-color-slot" data-role="fontColor"></div>
                </div>
                <div class="context-input-row">
                    <span class="context-slider-label">Fade</span>
                    <input class="context-number-input" data-role="fade" type="number" min="0" max="100" step="1" value="${currentFade}" aria-label="Fade">
                </div>
                <div class="context-input-row">
                    <span class="context-slider-label">Border</span>
                    <input class="context-number-input" data-role="borderWidth" type="number" min="0" max="10" step="0.01" value="${currentBorderWidth.toFixed(2)}" aria-label="Border Width">
                    <div class="context-color-slot" data-role="fontBorder"></div>
                </div>
                <div class="context-input-row">
                    <span class="context-slider-label">Stroke</span>
                    <input class="context-number-input" data-role="strokeWidth" type="number" min="0" max="10" step="0.01" value="${currentStrokeWidth.toFixed(2)}" aria-label="Stroke Width">
                    <div class="context-color-slot" data-role="fontStroke"></div>
                </div>
            `;
            document.body.appendChild(pop);
            this._makePopoverDraggable(pop);
            const closeBtn = pop.querySelector('[data-role="closePopover"]');
            if (closeBtn) {
                closeBtn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    this.closeNodeLabelStylePopover();
                });
            }

            pop.addEventListener('mouseenter', () => {
                this._nodePopoverHover = true;
                if (this._nodePopoverCloseTimer) {
                    clearTimeout(this._nodePopoverCloseTimer);
                    this._nodePopoverCloseTimer = null;
                }
            });
            pop.addEventListener('mouseleave', () => {
                this._nodePopoverHover = false;
            });

            const rect = pop.getBoundingClientRect();
            const margin = 8;
            let nextLeft = anchorX;
            let nextTop = anchorY;
            // Check if would overflow on the right, if so display on the left
            if (anchorX + rect.width > window.innerWidth - margin) {
                nextLeft = anchorX - rect.width - 12;
            }
            // Ensure not overflow on the left
            if (nextLeft < margin) {
                nextLeft = margin;
            }
            if (rect.bottom > window.innerHeight - margin) {
                nextTop = window.innerHeight - rect.height - margin;
            }
            pop.style.left = `${Math.max(margin, nextLeft)}px`;
            pop.style.top = `${Math.max(margin, nextTop)}px`;

            const toggle = pop.querySelector('.context-popover-checkbox');
            const getApplyToAll = () => toggle ? toggle.checked : false;

            // Helper to apply to single node or all nodes
            const applyLabelStyle = (updates) => {
                if (!this.visNetwork || !this.visNetwork.body?.data?.nodes) return;
                const dataset = this.visNetwork.body.data;

                if (getApplyToAll()) {
                    // Apply to all nodes
                    const nodes = dataset.nodes.get();
                    const nodeUpdates = nodes.map((n) => {
                        const currentNode = dataset.nodes.get(n.id);
                        const existingLabelStyle = currentNode?.labelStyle || {};
                        return {
                            id: n.id,
                            labelStyle: { ...existingLabelStyle, ...updates }
                        };
                    });
                    dataset.nodes.update(nodeUpdates);
                } else {
                    // Apply to single node
                    const currentNode = dataset.nodes.get(nodeId);
                    const existingLabelStyle = currentNode?.labelStyle || {};
                    dataset.nodes.update({
                        id: nodeId,
                        labelStyle: { ...existingLabelStyle, ...updates }
                    });
                }
                this.updateLabelLayer();
            };

            // Bind number inputs
            const bindNumberInput = (role, onChange) => {
                const input = pop.querySelector(`input[data-role="${role}"]`);
                if (!input) return;
                const step = Number(input.step) || 1;
                const applyValue = (raw) => {
                    const next = Number(raw);
                    if (!Number.isFinite(next)) return;
                    const min = Number(input.min) || 0;
                    const max = Number(input.max) || 200;
                    const clamped = Math.max(min, Math.min(max, next));
                    input.value = String(clamped);
                    onChange(clamped);
                };
                input.addEventListener('input', (ev) => {
                    ev.stopPropagation();
                    applyValue(input.value);
                });
                input.addEventListener('change', (ev) => {
                    ev.stopPropagation();
                    applyValue(input.value);
                });
                input.addEventListener('wheel', (ev) => {
                    ev.preventDefault();
                    const delta = ev.deltaY < 0 ? step : -step;
                    const currentVal = Number(input.value) || 0;
                    const min = Number(input.min) || 0;
                    const max = Number(input.max) || 200;
                    const nextVal = Math.max(min, Math.min(max, currentVal + delta));
                    applyValue(nextVal);
                }, { passive: false });
                input.addEventListener('click', (ev) => ev.stopPropagation());
            };

            // Helper for scale-related updates with smooth recalculation
            const applySizeScaleUpdates = () => {
                if (!this.visNetwork || !this.visNetwork.body?.data?.nodes) return;
                const dataset = this.visNetwork.body.data;
                const scale = Number.isFinite(this.labelSizeScale) ? this.labelSizeScale : 0.5;
                const minFontSize = Number.isFinite(this.labelFontMin) ? this.labelFontMin : 5;
                const maxFontSize = Number.isFinite(this.labelFontMax) ? this.labelFontMax : 20;

                if (getApplyToAll()) {
                    // Apply to all nodes
                    const nodes = dataset.nodes.get();
                    const updates = nodes.map((node) => {
                        const nodeSize = node.size || 30;
                        const baseFontSize = nodeSize * scale;
                        // Clamp font size between absolute min and max values
                        let fontSize = Math.max(minFontSize, Math.min(maxFontSize, baseFontSize));
                        
                        return {
                            id: node.id,
                            labelStyle: { ...(node.labelStyle || {}), fontSize: Number(fontSize.toFixed(2)), scaleFont: scale, scaleMin: minFontSize, scaleMax: maxFontSize }
                        };
                    });
                    dataset.nodes.update(updates);
                } else {
                    // Apply to single node
                    const currentNode = dataset.nodes.get(nodeId);
                    if (!currentNode) return;
                    
                    const nodeSize = currentNode.size || 30;
                    const baseFontSize = nodeSize * scale;
                    // Clamp font size between absolute min and max values
                    let fontSize = Math.max(minFontSize, Math.min(maxFontSize, baseFontSize));
                    
                    dataset.nodes.update({
                        id: nodeId,
                        labelStyle: { ...(currentNode.labelStyle || {}), fontSize: Number(fontSize.toFixed(2)), scaleFont: scale, scaleMin: minFontSize, scaleMax: maxFontSize }
                    });
                }
                this.updateLabelLayer();
            };

            bindNumberInput('scale', (val) => {
                this.labelSizeScale = val;
                applySizeScaleUpdates();
                this.queuePersistSettings();
            });

            bindNumberInput('fontWeight', (val) => {
                this.labelWeight = val;
                this.applyLabelWeight();
                this.queuePersistSettings();
            });

            bindNumberInput('strokeWidth', (val) => {
                this.labelStrokeWidth = val;
                this.applyLabelStrokeWidth();
                this.queuePersistSettings();
            });

            bindNumberInput('minScale', (val) => {
                this.labelFontMin = val;
                applySizeScaleUpdates();
                this.queuePersistSettings();
            });

            bindNumberInput('maxScale', (val) => {
                this.labelFontMax = val;
                applySizeScaleUpdates();
                this.queuePersistSettings();
            });

            bindNumberInput('fade', (val) => {
                this.labelFade = val;
                this.applyLabelFade();
                this.queuePersistSettings();
            });

            bindNumberInput('borderWidth', (val) => {
                this.labelBorderWidth = val;
                if (this.applyLabelBorderWidth) {
                    this.applyLabelBorderWidth();
                }
                this.queuePersistSettings();
            });

            // Setup toggle labels button
            const toggleBtn = pop.querySelector('button[data-role="toggleLabels"]');
            if (toggleBtn) {
                const icon = toggleBtn.querySelector('i');
                const updateToggleButton = () => {
                    const labelState = this.visNetwork?._wosLabelState || { showAll: false };
                    if (icon) {
                        icon.className = labelState.showAll ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
                    }
                    const label = labelState.showAll ? 'Hide Labels' : 'Show Labels';
                    toggleBtn.setAttribute('title', label);
                };
                updateToggleButton();
                toggleBtn.addEventListener('click', () => {
                    const labelState = this.visNetwork?._wosLabelState || { showAll: false };
                    const newState = !labelState.showAll;
                    this.applyLabelShowAll(newState);
                    updateToggleButton();
                });
            }

            // Setup color pickers using coloris
            const setupColorPicker = (slotRole, property, defaultColor, applyGlobal) => {
                const slot = pop.querySelector(`[data-role="${slotRole}"]`);
                if (!slot) return;

                const currentColor = node?.font?.[property];
                let initialColor = defaultColor;
                if (currentColor && currentColor !== 'transparent' && currentColor !== 'none') {
                    initialColor = currentColor;
                }

                // Create color display div
                const colorDisplay = document.createElement('div');
                colorDisplay.className = 'context-color-display';
                colorDisplay.style.backgroundColor = initialColor;

                // Create hidden input for coloris
                const colorInput = document.createElement('input');
                colorInput.type = 'text';
                colorInput.className = 'context-color-input';
                colorInput.setAttribute('data-coloris', '');
                colorInput.value = initialColor;

                slot.appendChild(colorDisplay);
                slot.appendChild(colorInput);

                // Update color display when color changes
                const updateColor = (val) => {
                    colorDisplay.style.backgroundColor = val;
                    colorInput.value = val;
                    if (getApplyToAll() && applyGlobal) {
                        applyGlobal.call(this, val);
                    } else {
                        applyLabelStyle({ [property]: val });
                    }
                };

                colorInput.addEventListener('input', () => updateColor(colorInput.value));
                colorInput.addEventListener('change', () => updateColor(colorInput.value));

                // Click slot to open color picker
                slot.addEventListener('click', () => {
                    colorInput.dispatchEvent(new Event('click', { bubbles: true }));
                });

                // Initialize coloris for this input (without auto-open)
                if (typeof global.Coloris !== 'undefined') {
                    try {
                        global.Coloris({
                            el: colorInput,
                            alpha: true,
                            format: 'hex',
                            formatToggle: false,
                            wrap: false,
                            forceAlpha: true
                        });
                    } catch (e) {
                        // Coloris initialization failed, fallback to text input
                    }
                }
            };

            setupColorPicker('fontColor', 'color', this.labelColor || '#343434', (val) => {
                this.labelColor = val;
                this.applyLabelColor();
                this.queuePersistSettings();
            });

            setupColorPicker('fontBackground', 'background', this.labelBgColor || '#ffffff', (val) => {
                this.labelBgColor = val;
                this.applyLabelBgColor();
                this.queuePersistSettings();
            });

            setupColorPicker('fontBorder', 'borderColor', this.labelBorderColor || '#00000021', (val) => {
                this.labelBorderColor = val;
                this.applyLabelBorderColor();
                this.queuePersistSettings();
            });

            setupColorPicker('fontStroke', 'strokeColor', this.labelStrokeColor || '#ffffff', (val) => {
                this.labelStrokeColor = val;
                this.applyLabelStrokeColor();
                this.queuePersistSettings();
            });

            const keyHandler = (ev) => {
                if (ev.key === 'Escape') this.closeNodeLabelStylePopover();
            };
            pop._nodeLabelStyleKeyHandler = keyHandler;
            document.addEventListener('keydown', keyHandler);
            this._nodeLabelStylePopover = { el: pop, nodeId };
        }

        openEdgeLabelStylePopover({ edgeId, x, y }) {
            if (!edgeId) return;
            this.closeEdgeLabelStylePopover();
            const dataset = this.visNetwork?.body?.data?.edges;
            const edge = dataset && typeof dataset.get === 'function' ? dataset.get(edgeId) : null;

            // Get current values
            const currentFontSize = Number(edge?.font?.size || this.edgeLabelFontSize || 14);
            const currentStrokeWidth = Number(edge?.font?.strokeWidth || this.edgeLabelStrokeWidth || 0);
            
            const formatValue = (value, decimals = 1) => {
                const next = Number(value);
                return Number.isFinite(next) ? next.toFixed(decimals) : '0.0';
            };

            const pop = document.createElement('div');
            pop.className = 'context-edge-label-style-popover context-style-popover';
            const anchorX = Number(x) || 0;
            const anchorY = Number(y) || 0;
            pop.style.left = `${anchorX}px`;
            pop.style.top = `${anchorY}px`;
            pop.innerHTML = `
                <div class="context-popover-drag-handle" title="Drag to move">Edge Label Typography</div>
                <button type="button" class="context-popover-close-btn" data-role="closePopover" title="Close (Esc)">&times;</button>
                <label class="context-popover-toggle">
                    <input type="checkbox" class="context-popover-checkbox" aria-label="Apply to all edges">
                    <span>Apply to all edges</span>
                </label>
                <button type="button" class="context-toggle-button" data-role="edgeLabelToggle" title="${this.edgeLabelEnabled ? 'Hide edge labels' : 'Show edge labels'}" tabindex="-1">
                    <i class="fa-solid ${this.edgeLabelEnabled ? 'fa-eye' : 'fa-eye-slash'}"></i>
                    <span>${this.edgeLabelEnabled ? 'Hide Labels' : 'Show Labels'}</span>
                </button>
                <div class="context-input-row context-input-group-row">
                    <div class="context-input-group">
                        <label class="context-input-label">Size</label>
                        <input class="context-number-input" data-role="fontSize" type="number" min="8" max="72" step="1" value="${Math.round(currentFontSize)}" aria-label="Font Size">
                    </div>
                </div>
                <div class="context-color-row">
                    <span class="context-slider-label">Text Color</span>
                    <div class="context-color-slot" data-role="fontColor"></div>
                </div>
                <div class="context-input-row">
                    <span class="context-slider-label">Stroke</span>
                    <input class="context-number-input" data-role="strokeWidth" type="number" min="0" max="10" step="0.1" value="${currentStrokeWidth.toFixed(2)}" aria-label="Stroke Width">
                    <div class="context-color-slot" data-role="strokeColor"></div>
                </div>
                <div class="context-color-row">
                    <span class="context-slider-label">Background</span>
                    <div class="context-color-slot" data-role="bgColor"></div>
                </div>
            `;
            document.body.appendChild(pop);
            this._makePopoverDraggable(pop);
            const closeBtn = pop.querySelector('[data-role="closePopover"]');
            if (closeBtn) {
                closeBtn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    this.closeEdgeLabelStylePopover();
                });
            }

            pop.addEventListener('mouseenter', () => {
                this._edgePopoverHover = true;
                if (this._edgePopoverCloseTimer) {
                    clearTimeout(this._edgePopoverCloseTimer);
                    this._edgePopoverCloseTimer = null;
                }
            });
            pop.addEventListener('mouseleave', () => {
                this._edgePopoverHover = false;
            });

            const rect = pop.getBoundingClientRect();
            const margin = 8;
            let nextLeft = anchorX;
            let nextTop = anchorY;
            if (anchorX + rect.width > window.innerWidth - margin) {
                nextLeft = anchorX - rect.width - 12;
            }
            if (nextLeft < margin) {
                nextLeft = margin;
            }
            if (rect.bottom > window.innerHeight - margin) {
                nextTop = window.innerHeight - rect.height - margin;
            }
            pop.style.left = `${Math.max(margin, nextLeft)}px`;
            pop.style.top = `${Math.max(margin, nextTop)}px`;

            // Setup edge label visibility toggle button
            const edgeLabelToggleBtn = pop.querySelector('[data-role="edgeLabelToggle"]');
            if (edgeLabelToggleBtn) {
                edgeLabelToggleBtn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    this.toggleEdgeLabels();
                    // Update button appearance
                    const icon = edgeLabelToggleBtn.querySelector('i');
                    const span = edgeLabelToggleBtn.querySelector('span');
                    if (this.edgeLabelEnabled) {
                        icon.className = 'fa-solid fa-eye';
                        span.textContent = 'Hide Labels';
                        edgeLabelToggleBtn.title = 'Hide edge labels';
                    } else {
                        icon.className = 'fa-solid fa-eye-slash';
                        span.textContent = 'Show Labels';
                        edgeLabelToggleBtn.title = 'Show edge labels';
                    }
                });
            }

            const applyToAllToggle = pop.querySelector('.context-popover-checkbox');
            const getApplyToAll = () => applyToAllToggle ? applyToAllToggle.checked : false;

            // Helper to apply styles
            const applyEdgeLabelStyle = (updates) => {
                if (!this.visNetwork || !this.visNetwork.body?.data?.edges) return;
                const dataset = this.visNetwork.body.data;

                if (getApplyToAll()) {
                    // Clear per-edge overrides and apply globally
                    this._edgeCustomFonts.clear();
                    const edges = dataset.edges.get();
                    const edgeUpdates = edges.map((e) => {
                        const currentEdge = dataset.edges.get(e.id);
                        return { id: e.id, font: { ...currentEdge?.font, ...updates } };
                    });
                    dataset.edges.update(edgeUpdates);
                } else {
                    // Store per-edge override so applyEdgeLabelDisplay() respects it
                    const prev = this._edgeCustomFonts.get(edgeId) || {};
                    this._edgeCustomFonts.set(edgeId, { ...prev, ...updates });
                    const currentEdge = dataset.edges.get(edgeId);
                    dataset.edges.update({ id: edgeId, font: { ...currentEdge?.font, ...updates } });
                }
                if (this.visNetwork) this.visNetwork.redraw();
            };

            // Bind number inputs
            const bindNumberInput = (role, onChange) => {
                const input = pop.querySelector(`input[data-role="${role}"]`);
                if (!input) return;
                const applyValue = (raw) => {
                    const next = Number(raw);
                    if (!Number.isFinite(next)) return;
                    const min = Number(input.min) || 0;
                    const max = Number(input.max) || 200;
                    const clamped = Math.max(min, Math.min(max, next));
                    input.value = String(clamped);
                    onChange(clamped);
                };
                input.addEventListener('input', (ev) => {
                    ev.stopPropagation();
                    applyValue(input.value);
                });
                input.addEventListener('change', (ev) => {
                    ev.stopPropagation();
                    applyValue(input.value);
                });
                input.addEventListener('wheel', (ev) => {
                    ev.preventDefault();
                    const step = Number(input.step) || 1;
                    const delta = ev.deltaY < 0 ? step : -step;
                    const currentVal = Number(input.value) || 0;
                    const min = Number(input.min) || 0;
                    const max = Number(input.max) || 200;
                    const nextVal = Math.max(min, Math.min(max, currentVal + delta));
                    applyValue(nextVal);
                }, { passive: false });
                input.addEventListener('click', (ev) => ev.stopPropagation());
            };

            bindNumberInput('fontSize', (val) => {
                if (getApplyToAll()) {
                    this.edgeLabelFontSize = val;
                    this.queuePersistSettings();
                }
                applyEdgeLabelStyle({ size: val });
            });

            bindNumberInput('strokeWidth', (val) => {
                if (getApplyToAll()) {
                    this.edgeLabelStrokeWidth = val;
                    this.queuePersistSettings();
                }
                applyEdgeLabelStyle({ strokeWidth: val });
            });

            // Setup color pickers
            const setupColorPicker = (slotRole, property, defaultColor, globalProp) => {
                const slot = pop.querySelector(`[data-role="${slotRole}"]`);
                if (!slot) return;

                let currentColor = defaultColor;
                if (slotRole === 'fontColor') currentColor = edge?.font?.color || this[globalProp] || defaultColor;
                else if (slotRole === 'strokeColor') currentColor = edge?.font?.strokeColor || this[globalProp] || defaultColor;
                else if (slotRole === 'bgColor') currentColor = edge?.font?.background || this[globalProp] || defaultColor;

                const colorDisplay = document.createElement('div');
                colorDisplay.className = 'context-color-display';
                colorDisplay.style.backgroundColor = currentColor;

                const colorInput = document.createElement('input');
                colorInput.type = 'text';
                colorInput.className = 'context-color-input';
                colorInput.setAttribute('data-coloris', '');
                colorInput.value = currentColor;

                slot.appendChild(colorDisplay);
                slot.appendChild(colorInput);

                const updateColor = (val) => {
                    colorDisplay.style.backgroundColor = val;
                    colorInput.value = val;
                    const updates = {};
                    if (slotRole === 'fontColor') updates.color = val;
                    else if (slotRole === 'strokeColor') updates.strokeColor = val;
                    else if (slotRole === 'bgColor') updates.background = val;
                    
                    if (getApplyToAll() && globalProp) {
                        this[globalProp] = val;
                        this.queuePersistSettings();
                    }
                    applyEdgeLabelStyle(updates);
                };

                colorInput.addEventListener('input', () => updateColor(colorInput.value));
                colorInput.addEventListener('change', () => updateColor(colorInput.value));

                slot.addEventListener('click', () => {
                    colorInput.dispatchEvent(new Event('click', { bubbles: true }));
                });

                if (typeof global.Coloris !== 'undefined') {
                    try {
                        global.Coloris({
                            el: colorInput,
                            alpha: true,
                            format: 'hex',
                            formatToggle: false,
                            wrap: false,
                            forceAlpha: true
                        });
                    } catch (e) {
                        // Coloris initialization failed
                    }
                }
            };

            setupColorPicker('fontColor', 'color', '#000000', 'edgeLabelFontColor');
            setupColorPicker('strokeColor', 'strokeColor', '#ffffff', 'edgeLabelStrokeColor');
            setupColorPicker('bgColor', 'background', 'rgba(255,255,255,0.85)', 'edgeLabelBgColor');

            const keyHandler = (ev) => {
                if (ev.key === 'Escape') this.closeEdgeLabelStylePopover();
            };
            pop._edgeLabelStyleKeyHandler = keyHandler;
            document.addEventListener('keydown', keyHandler);
            this._edgeLabelStylePopover = { el: pop, edgeId };
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
            this.edgeWidthScale = 1.2;
            this.edgeFade = 39;
            this.edgeColor = '#1a1a1aff';
            this.edgeLabelFontSize = 12;
            this.edgeLabelFontColor = '#1a1a1aff';
            this.edgeLabelStrokeWidth = 0;
            this.edgeLabelStrokeColor = '#ffffff';
            this.edgeLabelBgColor = 'rgba(255,255,255,0.85)';
            this.labelFontMin = 8;
            this.labelFontMax = 25;
            this.labelSizeScale = 0.6;
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

            const labelMinSlider = this.getEl(this.ids.labelMinSlider);
            const labelMinDimSlider = this.getEl(this.ids.labelMinDimSlider);
            const relatedMinSlider = this.getEl(this.ids.relatedMinSlider);
            const relatedMinDimSlider = this.getEl(this.ids.relatedMinDimSlider);
            const edgeFadeSlider = this.getEl(this.ids.edgeFadeSlider);
            const edgeMinWidthSlider = this.getEl(this.ids.edgeMinWidthSlider);
            const edgeMaxWidthSlider = this.getEl(this.ids.edgeMaxWidthSlider);
            const edgeColorInput = this.getEl(this.ids.edgeColorInput);

            if (labelMinSlider) labelMinSlider.value = String(minCite);
            if (labelMinDimSlider) labelMinDimSlider.value = String(this.labelMinDimAlpha ?? 0.2);
            if (relatedMinSlider) relatedMinSlider.value = String(this.relatedMinValue || 0);
            if (relatedMinDimSlider) relatedMinDimSlider.value = String(this.relatedMinDimAlpha ?? 0.2);
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
                physicsSpringLength: this.physicsSpringLength,
                physicsSpringConstant: this.physicsSpringConstant,
                physicsGravity: this.physicsGravity,
                edgeFade: this.edgeFade,
                edgeMinWidth: this.edgeMinWidth,
                edgeMaxWidth: this.edgeMaxWidth,
                edgeWidthScale: this.edgeWidthScale,
                edgeSmooth: this.edgeSmooth,
                edgeColor: this.edgeColor,
                edgeLabelFontSize: this.edgeLabelFontSize,
                edgeLabelFontColor: this.edgeLabelFontColor,
                edgeLabelStrokeWidth: this.edgeLabelStrokeWidth,
                edgeLabelStrokeColor: this.edgeLabelStrokeColor,
                edgeLabelBgColor: this.edgeLabelBgColor,
                edgeStyle: this.edgeStyle,
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

        getCurrentVisDataSnapshot() {
            if (!this.visNetworkData || typeof this.visNetworkData !== 'object') return null;
            const dataset = this.visNetwork?.body?.data;
            const nodesData = dataset?.nodes;
            const edgesData = dataset?.edges;
            const positions = this.visNetwork && typeof this.visNetwork.getPositions === 'function'
                ? this.visNetwork.getPositions()
                : {};
            const nodes = Array.isArray(this.visNetworkData.nodes) ? this.visNetworkData.nodes : [];
            const edges = Array.isArray(this.visNetworkData.edges) ? this.visNetworkData.edges : [];
            const baseById = new Map(nodes.filter(Boolean).map((n) => [n.id, n]));
            const liveNodes = nodesData && typeof nodesData.get === 'function' ? nodesData.get() : [];
            const nextNodes = (liveNodes.length ? liveNodes : nodes).map((liveNode) => {
                if (!liveNode || liveNode.id == null) return liveNode;
                const base = baseById.get(liveNode.id) || {};
                const pos = positions?.[liveNode.id];
                return {
                    ...base,
                    ...liveNode,
                    color: liveNode.color != null ? cloneVisColor(liveNode.color) : base.color,
                    icon: liveNode.icon != null ? cloneVisColor(liveNode.icon) : base.icon,
                    font: liveNode.font != null ? cloneVisColor(liveNode.font) : base.font,
                    labelStyle: liveNode.labelStyle != null ? cloneVisColor(liveNode.labelStyle) : base.labelStyle,
                    x: pos?.x ?? liveNode.x ?? base.x,
                    y: pos?.y ?? liveNode.y ?? base.y,
                    fixed: liveNode.fixed ?? base.fixed
                };
            });
            const liveEdges = edgesData && typeof edgesData.get === 'function' ? edgesData.get() : [];
            const edgeById = new Map(edges.filter(Boolean).map((e) => [e.id, e]));
            const nextEdges = (liveEdges.length ? liveEdges : edges).map((liveEdge) => {
                if (!liveEdge || liveEdge.id == null) return liveEdge;
                const base = edgeById.get(liveEdge.id) || {};
                return {
                    ...base,
                    ...liveEdge,
                    color: liveEdge.color != null ? cloneVisColor(liveEdge.color) : base.color,
                    width: liveEdge.width ?? base.width
                };
            });
            return {
                ...this.visNetworkData,
                nodes: nextNodes,
                edges: nextEdges
            };
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
            if (Number.isFinite(payload.physicsSpringLength)) this.physicsSpringLength = payload.physicsSpringLength;
            if (Number.isFinite(payload.physicsSpringConstant)) this.physicsSpringConstant = payload.physicsSpringConstant;
            if (Number.isFinite(payload.physicsGravity)) this.physicsGravity = payload.physicsGravity;
            if (Number.isFinite(payload.edgeFade)) this.edgeFade = payload.edgeFade;
            if (Number.isFinite(payload.edgeMinWidth)) this.edgeMinWidth = payload.edgeMinWidth;
            if (Number.isFinite(payload.edgeMaxWidth)) this.edgeMaxWidth = payload.edgeMaxWidth;
            if (Number.isFinite(payload.edgeWidthScale)) this.edgeWidthScale = payload.edgeWidthScale;
            if (Number.isFinite(payload.edgeSmooth)) this.edgeSmooth = payload.edgeSmooth;
            if (typeof payload.edgeColor === 'string') this.edgeColor = payload.edgeColor;
            if (Number.isFinite(payload.edgeLabelFontSize)) this.edgeLabelFontSize = payload.edgeLabelFontSize;
            if (typeof payload.edgeLabelFontColor === 'string') this.edgeLabelFontColor = payload.edgeLabelFontColor;
            if (Number.isFinite(payload.edgeLabelStrokeWidth)) this.edgeLabelStrokeWidth = payload.edgeLabelStrokeWidth;
            if (typeof payload.edgeLabelStrokeColor === 'string') this.edgeLabelStrokeColor = payload.edgeLabelStrokeColor;
            if (typeof payload.edgeLabelBgColor === 'string') this.edgeLabelBgColor = payload.edgeLabelBgColor;
            if (typeof payload.edgeStyle === 'string') this.edgeStyle = payload.edgeStyle;
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

        restoreVisDataStyles(visData) {
            if (!this.visNetwork || !this.visNetwork?.body?.data || !visData) return;
            const dataset = this.visNetwork.body.data;
            const nodeUpdates = Array.isArray(visData.nodes)
                ? visData.nodes
                    .filter((node) => node && node.id != null && node.color != null)
                    .map((node) => ({ id: node.id, color: cloneVisColor(node.color) }))
                : [];
            const edgeUpdates = Array.isArray(visData.edges)
                ? visData.edges
                    .filter((edge) => edge && edge.id != null && edge.color != null)
                    .map((edge) => ({ id: edge.id, color: cloneVisColor(edge.color) }))
                : [];
            if (nodeUpdates.length) dataset.nodes.update(nodeUpdates);
            if (edgeUpdates.length) dataset.edges.update(edgeUpdates);
            if (nodeUpdates.length || edgeUpdates.length) {
                this.markEdgeFocusDirty();
                this.applyEdgeFocusDisplay();
                this._labelThresholdBaseDirty = true;
                this.applyLabelThresholdDimming();
            }
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
            if (this.modeStateStore) {
                this.modeStateStore.saveSettings(payload);
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
                if (Number.isFinite(payload.edgeWidthScale)) this.edgeWidthScale = payload.edgeWidthScale;
                if (Number.isFinite(payload.edgeSmooth)) this.edgeSmooth = payload.edgeSmooth;
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
            const labelMinSlider = this.getEl(this.ids.labelMinSlider);
            const labelMinDimSlider = this.getEl(this.ids.labelMinDimSlider);
            const relatedMinSlider = this.getEl(this.ids.relatedMinSlider);
            const relatedMinDimSlider = this.getEl(this.ids.relatedMinDimSlider);
            const edgeFadeSlider = this.getEl(this.ids.edgeFadeSlider);
            const edgeMinWidthSlider = this.getEl(this.ids.edgeMinWidthSlider);
            const edgeMaxWidthSlider = this.getEl(this.ids.edgeMaxWidthSlider);
            const edgeColorInput = this.getEl(this.ids.edgeColorInput);
            const edgeLabelFontSizeInput = this.getEl(this.ids.edgeLabelFontSizeInput);
            const edgeLabelColorInput = this.getEl(this.ids.edgeLabelColorInput);
            const edgeLabelStrokeWidthInput = this.getEl(this.ids.edgeLabelStrokeWidthInput);
            const edgeLabelStrokeColorInput = this.getEl(this.ids.edgeLabelStrokeColorInput);
            const edgeLabelBgColorInput = this.getEl(this.ids.edgeLabelBgColorInput);

            if (labelMinSlider) labelMinSlider.value = String(this.labelMinCitations || 0);
            if (labelMinDimSlider) labelMinDimSlider.value = String(this.labelMinDimAlpha ?? 0.2);
            if (relatedMinSlider) relatedMinSlider.value = String(this.relatedMinValue || 0);
            if (relatedMinDimSlider) relatedMinDimSlider.value = String(this.relatedMinDimAlpha ?? 0.2);
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

        setColorInputValueSilent(input, value) {
            if (!input) return;
            const next = value || '';
            input.value = next;
            const wrapper = input.closest('.clr-field');
            if (wrapper) {
                wrapper.style.setProperty('--clr-color', next);
            }
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
            this.selectedNodeIds = new Set(focusMap ? Array.from(focusMap.keys()) : []);
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
            this.addSelectedNodeId(nodeId);
            this.applyEdgeFocusDisplay();
            this.updateModeToolbar();
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
            this.selectedNodeIds = new Set(state.customFocusMap ? Array.from(state.customFocusMap.keys()) : []);
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
            const visData = this.getCurrentVisDataSnapshot() || this.visNetworkData;
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
            const list = await this.loadSavedList();
            const select = this.getEl(this.ids.savedSelect);
            const selectedIdx = select ? Number.parseInt(select.value, 10) : -1;
            const hasSelection = Number.isFinite(selectedIdx) && selectedIdx >= 0 && selectedIdx < list.length;
            const existingName = hasSelection ? (list[selectedIdx]?.name || '') : '';
            const name = hasSelection
                ? existingName || `network-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}`
                : prompt('Save name', `network-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}`);
            if (!name) return;
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
            const nextItem = {
                ...payload,
                settings,
                createdAt: hasSelection ? (list[selectedIdx]?.createdAt || Date.now()) : Date.now(),
                updatedAt: Date.now(),
                type: 'wos-graph'
            };
            if (hasSelection) {
                list[selectedIdx] = nextItem;
                await this.persistSavedList(list);
                this.renderSavedSelect(list);
                this.setSavedSelectValue(selectedIdx, { persist: true, list });
                this.notify('Network JSON updated', 'success');
                return;
            }
            list.unshift(nextItem);
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
                    // Prevent global applyNodeColor/applyNodeBorderColor from wiping
                    // per-node colors during renderFromVisData – they will be properly
                    // restored by restoreVisDataStyles below.
                    this._skipNodeColorApply = true;
                    this.renderFromVisData(model.visData || {}, { sourceJson });
                    // Restore saved viewport immediately without animation so the
                    // user never sees the default auto-fit scale.  Also register a
                    // one-shot handler for stabilizationIterationsDone: vis-network
                    // calls fit() internally after stabilization finishes (fit is
                    // true by default) which would override our moveTo.  Because
                    // vis-network's emitter fires listeners in registration order
                    // and the internal fit() listener was registered first, our
                    // handler runs right after fit() and corrects the viewport.
                    if (item.state && this.visNetwork) {
                        const zoom = Number.isFinite(item.state.zoom) ? item.state.zoom : null;
                        const pan = item.state.pan && Number.isFinite(item.state.pan.x) && Number.isFinite(item.state.pan.y)
                            ? item.state.pan
                            : null;
                        if (zoom != null || pan) {
                            const moveOpts = {
                                position: pan || undefined,
                                scale: zoom != null ? zoom : undefined,
                                animation: false
                            };
                            this.visNetwork.moveTo(moveOpts);
                            this.visNetwork.once('stabilizationIterationsDone', () => {
                                this.visNetwork.moveTo(moveOpts);
                            });
                        }
                        if (item.state.labelMode) {
                            this.applyLabelShowAll(item.state.labelMode === 'all');
                        }
                    }
                    // Wait for the async mode-state-store initialisation that was
                    // kicked off at the end of renderFromVisData.  If we don't wait,
                    // its applySettings() / apply('normal') callbacks fire *after*
                    // restoreVisDataStyles and overwrite the correct per-node/edge
                    // colours with stale snapshot values.
                    if (this._modeStoreReady) {
                        await this._modeStoreReady;
                    }
                    if (item.settings) {
                        this.applyLabelPanelSettingsPayload(item.settings);
                        this.restoreVisDataStyles(model.visData);
                    }
                    this._skipNodeColorApply = false;
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
                // Double-click event disabled
                // if (this._onNetworkDoubleClick) {
                //     this._boundNetwork.off('doubleClick', this._onNetworkDoubleClick);
                // }
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
                if (this._onSelectionChange) {
                    this._boundNetwork.off('select', this._onSelectionChange);
                    this._boundNetwork.off('deselectNode', this._onSelectionChange);
                    this._boundNetwork.off('deselectEdge', this._onSelectionChange);
                    this._boundNetwork.off('selectNode', this._onSelectionChange);
                    this._boundNetwork.off('selectEdge', this._onSelectionChange);
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
                this.closeEdgeContextMenu();
                this.closeNodeContextMenu();
                if (nodeId && this.switchNodePopoverTarget(nodeId)) {
                    return;
                }
                if (nodeId && evt && evt.shiftKey) {
                    if (this.removeNodeFromCustomFocus(nodeId)) return;
                }
                if (nodeId && this._toolbarMode === 'edge') {
                    if (this.visNetwork) this.visNetwork.unselectAll();
                    return;
                }
                if (nodeId && this._toolbarMode === 'node') {
                    this.toggleNodeSelectionMode(nodeId);
                    return;
                }
                const edgeId = params?.edges?.[0];
                if (edgeId) {
                    this.switchEdgePopoverTarget(edgeId);
                }
                if (edgeId && this._toolbarMode === 'edge') {
                    this.toggleEdgeSelectionMode(edgeId);
                    return;
                }
                if (this._toolbarMode === 'node') {
                    const keep = Array.from(this.selectedNodeIds || []);
                    if (keep.length && this.visNetwork) {
                        this.visNetwork.selectNodes(keep);
                    }
                    return;
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
                this.updateModeToolbar();
            };
            network.on('click', this._onNetworkClick);
            // Double-click on edge/node disabled to avoid unwanted mode switches
            // this._onNetworkDoubleClick = (params) => {
            //     const nodeId = params?.nodes?.[0];
            //     if (nodeId) return;
            //     const edgeId = params?.edges?.[0];
            //     if (edgeId && this._toolbarMode === 'node') return;
            //     if (edgeId) {
            //         this.toggleEdgeSelectionMode(edgeId);
            //         if (this.hasActiveEdgeSelection()) {
            //             this.setToolbarMode('edge', { edgeId, select: true });
            //         } else if (this._toolbarMode === 'edge') {
            //             this.setToolbarMode(null);
            //         }
            //     }
            // };
            // network.on('doubleClick', this._onNetworkDoubleClick);
            this._onNetworkAfterDraw = (ctx) => {
                const dataset = network?.body?.data?.nodes;
                if (!dataset) return;
                const nodes = dataset.get();
                if (!nodes.length) return;
                const fallbackOutlineWidth = Number.isFinite(Number(this.nodeOuterBorderWidth))
                    ? Number(this.nodeOuterBorderWidth)
                    : 2;
                const scale = Number(network.getScale()) || 1;
                const ratio = Number(network.canvas?.pixelRatio) || 1;
                ctx.save();
                ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
                nodes.forEach((node) => {
                    const shape = node?.shape || 'dot';
                    if (shape !== 'dot' && shape !== 'circle') {
                        return;
                    }
                    const outlineWidth = Number.isFinite(Number(node.outerBorderWidth))
                        ? Number(node.outerBorderWidth)
                        : fallbackOutlineWidth;
                    if (outlineWidth <= 0) return;
                    const nodeAlpha = Math.max(0, Math.min(1, getNodeAlpha(node)));
                    const outlineColor = setColorAlpha(node.outerBorderColor || this.nodeOuterBorderColor || '#ffffff', nodeAlpha);
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
                    this.switchNodePopoverTarget(nodeId);
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
                this.switchEdgePopoverTarget(edgeId);
                this.showEdgeContextMenu(evt, edgeId);
            };
            network.on('hoverEdge', this._onEdgeHover);
            network.on('blurEdge', this._onEdgeBlur);
            network.on('hoverNode', this._onNodeHover);
            network.on('blurNode', this._onNodeBlur);
            network.on('oncontext', this._onEdgeContext);
            this._onSelectionChange = () => {
                const hasEdge = this.hasActiveEdgeSelection();
                const state = this.getEdgeFocusState();
                const hasNode = !!state.customFocusActive;
                if (hasEdge && this._toolbarMode !== 'edge' && this._edgeModeEnabled) {
                    this.setToolbarMode('edge');
                    return;
                }
                if (this._toolbarMode === 'edge' && !hasEdge) {
                    this.setToolbarMode(null);
                    return;
                }
                if (hasNode && this._toolbarMode !== 'node' && !this._edgeModeEnabled) {
                    this.setToolbarMode('node');
                    return;
                }
                this.updateModeToolbar();
            };
            network.on('select', this._onSelectionChange);
            network.on('deselectNode', this._onSelectionChange);
            network.on('deselectEdge', this._onSelectionChange);
            network.on('selectNode', this._onSelectionChange);
            network.on('selectEdge', this._onSelectionChange);
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
            try {
                if (typeof app.getPathsForBase === 'function' && typeof app.projectFileExists === 'function') {
                    const paths = app.getPathsForBase(base);
                    const jsonPath = paths && paths.json ? paths.json : '';
                    if (jsonPath) {
                        const exists = await app.projectFileExists(jsonPath);
                        if (!exists) {
                            this.notify(`No file found for ${normalized}`, 'info');
                            return;
                        }
                    }
                }
            } catch (_e) {
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
