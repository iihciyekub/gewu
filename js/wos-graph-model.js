(function (global) {
    'use strict';

    class WosGraphModel {
        constructor(options = {}) {
            this.version = 1;
            this.name = options.name || '';
            this.state = options.state || null;
            this.source = null;
            this.visData = null;
            if (options.source) {
                this.setSource(options.source);
            }
        }

        normalizeId(value) {
            if (value == null) return '';
            const raw = String(value).trim().toUpperCase().replace(/\s+/g, '');
            if (!raw) return '';
            return raw.startsWith('WOS:') ? raw : `WOS:${raw.replace(/^WOS[:_]?/i, '')}`;
        }

        parseNumber(value) {
            if (value == null) return 0;
            if (typeof value === 'number' && Number.isFinite(value)) return value;
            const rawText = String(value);
            const digits = rawText.replace(/[^0-9-]+/g, '');
            if (!digits) return 0;
            const parsed = Number.parseInt(digits, 10);
            return Number.isFinite(parsed) ? parsed : 0;
        }

        normalizeItem(item) {
            if (!item || typeof item !== 'object') return null;
            const wosid = this.normalizeId(item.wosid || item.wos_id || item.wosId);
            if (!wosid) return null;
            const citationsRaw = item.citations_count;
            const relatedRaw = item.related_count;
            const refRaw = item.ref_count;
            return {
                ...item,
                wosid,
                citations_count: this.parseNumber(citationsRaw),
                related_count: this.parseNumber(relatedRaw),
                ref_count: this.parseNumber(refRaw)
            };
        }

        normalizeSource(source) {
            if (!source || typeof source !== 'object') return {};
            const normalized = {};
            Object.entries(source).forEach(([rootId, payload]) => {
                const rootKey = this.normalizeId(rootId);
                if (!rootKey) return;
                const rootPayload = payload && typeof payload === 'object' ? { ...payload } : {};
                const rootNormalized = {
                    ...rootPayload,
                    citations_count: this.parseNumber(rootPayload.citations_count),
                    related_count: this.parseNumber(rootPayload.related_count),
                    ref_count: this.parseNumber(rootPayload.ref_count)
                };
                const list = Array.isArray(rootPayload.page_wosids) ? rootPayload.page_wosids : [];
                rootNormalized.page_wosids = list
                    .map((item) => this.normalizeItem(item))
                    .filter(Boolean);
                normalized[rootKey] = rootNormalized;
            });
            return normalized;
        }

        setSource(source) {
            this.source = this.normalizeSource(source);
            return this.source;
        }

        appendSource(incoming) {
            if (!incoming || typeof incoming !== 'object') return this.source || {};
            if (!this.source || typeof this.source !== 'object') {
                this.source = {};
            }
            const normalizedIncoming = this.normalizeSource(incoming);
            Object.entries(normalizedIncoming).forEach(([rootId, payload]) => {
                const existing = this.source[rootId];
                if (!existing || typeof existing !== 'object') {
                    this.source[rootId] = payload;
                    return;
                }
                const merged = { ...existing, ...payload };
                const baseList = Array.isArray(existing.page_wosids) ? existing.page_wosids : [];
                const addList = Array.isArray(payload.page_wosids) ? payload.page_wosids : [];
                const byId = new Map();
                baseList.forEach((item) => {
                    const id = this.normalizeId(item?.wosid);
                    if (id) byId.set(id, item);
                });
                addList.forEach((item) => {
                    const id = this.normalizeId(item?.wosid);
                    if (id) byId.set(id, item);
                });
                merged.page_wosids = Array.from(byId.values());
                this.source[rootId] = merged;
            });
            return this.source;
        }

        buildNodeIndex() {
            const index = new Map();
            if (!this.source || typeof this.source !== 'object') return index;
            Object.entries(this.source).forEach(([rootId, payload]) => {
                const rootKey = this.normalizeId(rootId);
                if (rootKey && payload && typeof payload === 'object') {
                    const list = index.get(rootKey) || [];
                    list.push({ type: 'root', obj: payload });
                    index.set(rootKey, list);
                }
                if (!payload || !Array.isArray(payload.page_wosids)) return;
                payload.page_wosids.forEach((node) => {
                    const nodeKey = this.normalizeId(node?.wosid);
                    if (!nodeKey || !node || typeof node !== 'object') return;
                    const list = index.get(nodeKey) || [];
                    list.push({ type: 'child', obj: node });
                    index.set(nodeKey, list);
                });
            });
            return index;
        }

        applyNodeUpdates(items) {
            if (!items) return false;
            const list = Array.isArray(items) ? items : [items];
            const updates = list
                .map((item) => this.normalizeItem(item))
                .filter((item) => item && !Object.prototype.hasOwnProperty.call(item, 'page_wosids'));
            if (!updates.length) return false;
            const index = this.buildNodeIndex();
            let updated = false;
            updates.forEach((item) => {
                const wosid = this.normalizeId(item.wosid);
                if (!wosid) return;
                const refs = index.get(wosid) || [];
                refs.forEach((ref) => {
                    const target = ref?.obj;
                    if (!target || typeof target !== 'object') return;
                    Object.keys(item).forEach((key) => {
                        if (key === 'wosid') return;
                        target[key] = item[key];
                    });
                    updated = true;
                });
            });
            return updated;
        }

        buildVisData() {
            if (!global.WosVisNetwork || typeof global.WosVisNetwork.buildVisNetworkDataFromWos !== 'function') {
                return { nodes: [], edges: [], meta: {} };
            }
            this.visData = global.WosVisNetwork.buildVisNetworkDataFromWos(this.source || {});
            return this.visData;
        }

        getSavedPayload(options = {}) {
            const name = options.name || this.name || '';
            const state = options.state || this.state || null;
            return {
                version: this.version,
                name,
                source: this.source || {},
                visData: this.visData || { nodes: [], edges: [], meta: {} },
                state: state || null
            };
        }

        static fromSaved(payload) {
            if (!payload || typeof payload !== 'object') return null;
            const model = new WosGraphModel({
                source: payload.source || {},
                name: payload.name || '',
                state: payload.state || null
            });
            model.visData = payload.visData || null;
            return model;
        }
    }

    global.WosGraphModel = WosGraphModel;
})(window);
