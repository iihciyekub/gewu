(() => {
    if (typeof window === 'undefined') return;

    const attachStats = () => {
        const proto = window.PaperStatsApp?.prototype
            || (window.paperStats ? Object.getPrototypeOf(window.paperStats) : null);
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

        proto.groupByFields = async function ({
            fields,
            view = '',
            log = true,
            table = true,
            mode = '',
            concurrency = 12,
            progress = true,
            groupByGroupName = false,
            groupNames = null
        } = {}) {
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
            const requestedGroups = Array.isArray(groupNames)
                ? groupNames.filter(Boolean).map(g => String(g))
                : (groupNames ? [String(groupNames)] : []);
            const groupsAll = (typeof this.getCurrentGroups === 'function') ? (this.getCurrentGroups() || []) : [];
            const groupNameMatchSet = new Set(requestedGroups.map(g => g.toLowerCase()));
            const matchedGroups = requestedGroups.length
                ? groupsAll.filter(g => groupNameMatchSet.has(String(g.name || '').toLowerCase())
                    || groupNameMatchSet.has(String(g.id || '').toLowerCase()))
                : [];
            const activeGroups = matchedGroups.length ? matchedGroups : groupsAll;
            const groupLabel = requestedGroups.length
                ? (matchedGroups.length ? matchedGroups.map(g => String(g.name || g.id || 'group')).join(' + ') : 'all')
                : 'all';
            const baseGroupMap = {};
            if (groupsAll.length) {
                groupsAll.forEach((g) => {
                    (g.files || []).forEach((base) => {
                        if (!baseGroupMap[base]) {
                            baseGroupMap[base] = String(g.name || g.id || 'group');
                        }
                    });
                });
            }

            const allowedBaseSet = activeGroups.length
                ? new Set(activeGroups.flatMap(g => (g.files || []).map(String)))
                : null;
            const bases = Object.keys(this.fileMetaByBase || {}).filter((base) => {
                const entry = this.fileMetaByBase?.[base];
                const inView = !!(entry?.views && entry.views[targetView]);
                const inGroup = allowedBaseSet ? allowedBaseSet.has(base) : true;
                return inView && inGroup;
            });

            const includeGroup = !!groupByGroupName;
            const groupedFields = includeGroup ? ['group', ...fieldList] : fieldList;
            const aggregated = {};
            const groupedValueMap = {};
            const byField = {};
            const missingByField = {};
            let missingAll = 0;
            let readErrors = 0;

            const useMode = includeGroup ? 'grouped' : (mode || (fieldList.length > 1 ? 'grouped' : 'merged'));
            fieldList.forEach((field) => {
                byField[field] = {};
                missingByField[field] = 0;
            });

            const safeConcurrency = Number.isFinite(Number(concurrency)) ? Math.max(1, Number(concurrency)) : 12;
            const preloadTracker = (progress && typeof this.createStatusProgressTracker === 'function')
                ? this.createStatusProgressTracker('Preload JSON')
                : null;
            let preloadProcessed = 0;
            if (preloadTracker) {
                preloadTracker.update('Preloading JSON (0%)', 0);
            }
            const dataMap = new Map();
            const preloadErrors = [];
            let preloadCursor = 0;
            const preloadWorker = async () => {
                while (preloadCursor < bases.length) {
                    const base = bases[preloadCursor];
                    preloadCursor += 1;
                    const path = this.getViewPathForBase(base, targetView);
                    if (!path) {
                        preloadErrors.push(base);
                    } else if (this.tempDataCache && this.tempDataCache[path]) {
                        dataMap.set(base, this.tempDataCache[path]);
                    } else {
                        let success = false;
                        for (let attempt = 0; attempt < 2 && !success; attempt += 1) {
                            try {
                                const data = await this.readProjectFile(path);
                                dataMap.set(base, data);
                                success = true;
                            } catch (_err) {
                                // retry once
                            }
                        }
                        if (!success) {
                            preloadErrors.push(base);
                        }
                    }
                    preloadProcessed += 1;
                    if (preloadTracker) {
                        const percent = bases.length ? Math.round((preloadProcessed / bases.length) * 100) : 100;
                        preloadTracker.update(`Preloading JSON (${preloadProcessed}/${bases.length})`, percent);
                    }
                }
            };
            const preloadWorkers = Array.from({ length: Math.min(safeConcurrency, bases.length) }, () => preloadWorker());
            try {
                await Promise.all(preloadWorkers);
                if (preloadTracker) preloadTracker.finish('Preload JSON done');
            } catch (err) {
                if (preloadTracker) preloadTracker.fail('Preload JSON failed');
                throw err;
            }
            if (preloadErrors.length) {
                throw new Error(`Preload failed for ${preloadErrors.length} file(s). Please retry.`);
            }

            const tracker = (progress && typeof this.createStatusProgressTracker === 'function')
                ? this.createStatusProgressTracker('Grouping fields')
                : null;
            let processed = 0;
            if (tracker) {
                tracker.update('Grouping fields (0%)', 0);
            }
            let cursor = 0;
            const worker = async () => {
                while (cursor < bases.length) {
                    const base = bases[cursor];
                    cursor += 1;
                    const path = this.getViewPathForBase(base, targetView);
                    if (!path) {
                        missingAll += 1;
                        fieldList.forEach((field) => { missingByField[field] += 1; });
                        continue;
                    }
                    try {
                        const data = dataMap.get(base);
                        let hasAny = false;
                        const groupValueSets = [];
                        if (includeGroup) {
                            groupValueSets.push([baseGroupMap[base] || 'ungrouped']);
                        }
                        fieldList.forEach((field) => {
                            const values = this.extractFieldValuesFromData(data, field);
                            if (!values.length) {
                                missingByField[field] += 1;
                                groupValueSets.push(['']);
                                return;
                            }
                            hasAny = true;
                            groupValueSets.push(values);
                            values.forEach((value) => {
                                const key = String(value);
                                byField[field][key] = (byField[field][key] || 0) + 1;
                                if (useMode === 'merged') {
                                    aggregated[key] = (aggregated[key] || 0) + 1;
                                }
                            });
                        });
                        if (useMode === 'grouped' && hasAny) {
                            const combinations = groupValueSets.reduce((acc, list) => {
                                const next = [];
                                acc.forEach((prev) => {
                                    list.forEach((val) => {
                                        next.push([...prev, String(val)]);
                                    });
                                });
                                return next;
                            }, [[]]);
                            combinations.forEach((combo) => {
                                const key = combo.join(' | ');
                                aggregated[key] = (aggregated[key] || 0) + 1;
                                if (!groupedValueMap[key]) groupedValueMap[key] = combo;
                            });
                        }
                        if (!hasAny) missingAll += 1;
                    } catch (err) {
                        console.warn('Field stats read failed for', base, err);
                        readErrors += 1;
                    } finally {
                        processed += 1;
                        if (tracker) {
                            const percent = bases.length ? Math.round((processed / bases.length) * 100) : 100;
                            tracker.update(`Grouping fields (${processed}/${bases.length})`, percent);
                        }
                    }
                }
            };
            const workers = Array.from({ length: Math.min(safeConcurrency, bases.length) }, () => worker());
            try {
                await Promise.all(workers);
                if (tracker) tracker.finish('Grouping fields done');
            } catch (err) {
                if (tracker) tracker.fail('Grouping fields failed');
                throw err;
            }

            const result = {
                view: targetView,
                fields: fieldList,
                groupedFields,
                groupByGroupName: includeGroup,
                groupLabel,
                groupNames: requestedGroups,
                matchedGroupNames: matchedGroups.map(g => String(g.name || g.id || 'group')),
                totalFiles: bases.length,
                missingAll,
                missingByField,
                readErrors,
                aggregated,
                byField,
                groupedRows: useMode === 'grouped'
                    ? Object.keys(aggregated)
                        .map((key) => {
                            const values = groupedValueMap[key] || [];
                            const row = {};
                            groupedFields.forEach((field, idx) => {
                                row[field] = values[idx] || '';
                            });
                            row.count = aggregated[key];
                            if (!includeGroup) row.group = groupLabel;
                            return row;
                        })
                        .sort((a, b) => b.count - a.count)
                    : null
            };

            if (log) {
                console.log(`Field stats for view "${targetView}"`, { fields: fieldList, mode: useMode, groupLabel });
                const sorted = Object.keys(aggregated)
                    .map(k => ({ value: k, count: aggregated[k], group: groupLabel }))
                    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
                if (sorted.length) {
                    if (table) {
                        if (useMode === 'grouped') {
                            const rows = Array.isArray(result.groupedRows) ? [...result.groupedRows] : [];
                            const total = rows.reduce((sum, row) => sum + (Number(row.count) || 0), 0);
                            rows.push({ ...Object.fromEntries(groupedFields.map(f => [f, 'TOTAL'])), count: total });
                            console.table(rows);
                        } else {
                            const total = sorted.reduce((sum, row) => sum + (Number(row.count) || 0), 0);
                            console.table([...sorted, { value: 'TOTAL', count: total, group: groupLabel }]);
                        }
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
