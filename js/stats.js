(() => {
    if (typeof window === 'undefined') return;

    const attachStats = () => {
        const proto = window.PaperReviewerApp?.prototype
            || (window.paperReviewerApp ? Object.getPrototypeOf(window.paperReviewerApp) : null);
        if (!proto || proto.__statsAttached) return false;
        proto.__statsAttached = true;

        proto.normalizeFieldValues = function (raw) {
            const values = Array.isArray(raw) ? raw : (raw === undefined || raw === null ? [] : [raw]);
            const out = [];
            values.forEach((val) => {
                if (val === undefined || val === null) return;
            if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
                const text = String(val).trim();
                if (text) out.push(text);
            }
        });
        return out;
    };

        proto.getValueByPath = function (data, path) {
            if (!data || !path) return undefined;
            const normalized = String(path).replace(/\[(\d+)\]/g, '.$1');
            const parts = normalized.split('.').filter(Boolean);
            let cur = data;
        for (const part of parts) {
            if (cur && Object.prototype.hasOwnProperty.call(cur, part)) {
                cur = cur[part];
            } else {
                return undefined;
            }
        }
        return cur;
    };

        proto.extractFieldValuesFromData = function (data, fieldPath) {
            const raw = this.getValueByPath(data, fieldPath);
            return this.normalizeFieldValues(raw);
        };

        proto.getFieldStatsForCurrentView = async function ({ fields, view = '', log = true, table = true, mode = '' } = {}) {
            if (!this.currentProject) {
                this.showNotification('Project not selected', 'error');
                return null;
        }
        const targetView = view || this.currentJsonView || 'view1';
        if (!this.fileMetaByBase || !Object.keys(this.fileMetaByBase).length) {
            await this.loadFileList(true);
        }

        const fieldList = Array.isArray(fields)
            ? fields.filter(Boolean).map(f => String(f))
            : [fields || 'wos_data.publication_year'].filter(Boolean).map(f => String(f));

        const bases = Object.keys(this.fileMetaByBase || {}).filter((base) => {
            const entry = this.fileMetaByBase?.[base];
            return !!(entry?.views && entry.views[targetView]);
        });

        const aggregated = {};
        const byField = {};
        const missingByField = {};
        let missingAll = 0;
        let readErrors = 0;

        const useMode = mode || (fieldList.length > 1 ? 'grouped' : 'merged');
        fieldList.forEach((field) => {
            byField[field] = {};
            missingByField[field] = 0;
        });

        await Promise.all(bases.map(async (base) => {
            const path = this.getViewPathForBase(base, targetView);
            if (!path) {
                missingAll += 1;
                fieldList.forEach((field) => { missingByField[field] += 1; });
                return;
            }
            try {
                const data = await this.readProjectFile(path);
                let hasAny = false;
                const groupValues = [];
                fieldList.forEach((field) => {
                    const values = this.extractFieldValuesFromData(data, field);
                    if (!values.length) {
                        missingByField[field] += 1;
                        groupValues.push('');
                        return;
                    }
                    hasAny = true;
                    groupValues.push(values[0]);
                    values.forEach((value) => {
                        const key = String(value);
                        byField[field][key] = (byField[field][key] || 0) + 1;
                        if (useMode === 'merged') {
                            aggregated[key] = (aggregated[key] || 0) + 1;
                        }
                    });
                });
                if (useMode === 'grouped' && hasAny) {
                    const key = groupValues.map(v => String(v)).join(' | ');
                    aggregated[key] = (aggregated[key] || 0) + 1;
                }
                if (!hasAny) missingAll += 1;
            } catch (err) {
                console.warn('Field stats read failed for', base, err);
                readErrors += 1;
            }
        }));

        const result = {
            view: targetView,
            fields: fieldList,
            totalFiles: bases.length,
            missingAll,
            missingByField,
            readErrors,
            aggregated,
            byField
        };

        if (log) {
            console.log(`Field stats for view "${targetView}"`, { fields: fieldList, mode: useMode });
            const sorted = Object.keys(aggregated)
                .map(k => ({ value: k, count: aggregated[k] }))
                .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
            if (sorted.length) {
                if (table) {
                    console.table(sorted);
                } else {
                    console.log(sorted);
                }
            } else {
                console.log('No values found for fields.');
            }
            console.log('Summary:', {
                totalFiles: bases.length,
                missingAll,
                missingByField,
                readErrors
            });
        }

            return result;
        };

        return true;
    };

    if (!attachStats()) {
        document.addEventListener('DOMContentLoaded', () => {
            attachStats();
        }, { once: true });
    }
})();
