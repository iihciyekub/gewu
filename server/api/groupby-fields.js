const fs = require('fs');
const path = require('path');

function normalizeFieldValues(raw) {
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
}

function getValueByPath(data, fieldPath) {
    if (!data || !fieldPath) return undefined;
    const normalized = String(fieldPath).replace(/\[(\d+)\]/g, '.$1');
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
}

function extractFieldValuesFromData(data, fieldPath) {
    const raw = getValueByPath(data, fieldPath);
    return normalizeFieldValues(raw);
}

function resolveJsonViewDir(fullPath, viewName) {
    const jsonRoot = path.join(fullPath, 'json');
    const target = path.join(jsonRoot, viewName);
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
        return target;
    }
    return jsonRoot;
}

function listJsonBasesInDir(dirPath) {
    if (!fs.existsSync(dirPath)) return [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries
        .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
        .map(entry => entry.name.replace(/\.json$/i, ''));
}

function normalizeGroupBase(name) {
    const raw = String(name || '').trim();
    if (!raw) return '';
    const base = raw.split(/[\\/]/).pop() || raw;
    return base.replace(/\.json$/i, '');
}

function parseJsonBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (err) {
                reject(err);
            }
        });
    });
}

async function handleGroupByFields(req, res, {
    normalizeProjectPath,
    ensureProjectStructure,
    normalizeGroupList,
    fileOrderName
}) {
    try {
        const data = await parseJsonBody(req);
        const { projectPath } = data;
        if (!projectPath) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Missing projectPath' }));
            return;
        }

        const { fullPath } = normalizeProjectPath(projectPath);
        ensureProjectStructure(fullPath);

        const view = String(data.view || 'view1');
        const fieldList = Array.isArray(data.fields)
            ? data.fields.filter(Boolean).map(f => String(f))
            : [data.fields || 'wos_data.publication_year'].filter(Boolean).map(f => String(f));
        const requestedGroups = Array.isArray(data.groupNames)
            ? data.groupNames.filter(Boolean).map(g => String(g))
            : (data.groupNames ? [String(data.groupNames)] : []);
        let groupsAll = [];
        if (fileOrderName) {
            try {
                const orderFile = path.join(fullPath, fileOrderName);
                if (fs.existsSync(orderFile)) {
                    const content = fs.readFileSync(orderFile, 'utf8');
                    const parsed = JSON.parse(content);
                    if (parsed?.groups && typeof normalizeGroupList === 'function') {
                        const normalized = normalizeGroupList(parsed.groups);
                        groupsAll = normalized.map((g, idx) => ({
                            id: String(g?.id || g?.name || `group-${idx + 1}`),
                            name: String(g?.name || g?.id || `group-${idx + 1}`),
                            files: Array.isArray(g?.files) ? g.files.map(normalizeGroupBase).filter(Boolean) : []
                        }));
                    }
                }
            } catch (err) {
                console.warn('Failed to read group data from file-order:', err.message || err);
            }
        }
        const groupNameMatchSet = new Set(requestedGroups.map(g => g.toLowerCase()));
        const matchedGroups = requestedGroups.length
            ? groupsAll.filter(g => groupNameMatchSet.has(String(g.name || '').toLowerCase())
                || groupNameMatchSet.has(String(g.id || '').toLowerCase()))
            : [];
        const fallbackAll = data.fallbackAllGroups === true;
        const activeGroups = matchedGroups.length
            ? matchedGroups
            : (requestedGroups.length ? (fallbackAll ? groupsAll : []) : groupsAll);
        const includeGroup = !!data.groupByGroupName;
        const useMode = includeGroup
            ? 'grouped'
            : ((data.mode === 'merged' || data.mode === 'grouped')
                ? data.mode
                : (fieldList.length > 1 ? 'grouped' : 'merged'));

        const viewDir = resolveJsonViewDir(fullPath, view);
        const allBases = listJsonBasesInDir(viewDir);
        const baseGroupMap = {};
        if (groupsAll.length) {
            groupsAll.forEach((g) => {
                (g.files || []).forEach((base) => {
                    const key = normalizeGroupBase(base);
                    if (!key) return;
                    if (!baseGroupMap[key]) {
                        baseGroupMap[key] = String(g.name || g.id || 'group');
                    }
                });
            });
        }
        const allowedBaseSet = activeGroups.length
            ? new Set(activeGroups.flatMap(g => (g.files || []).map(normalizeGroupBase).filter(Boolean)))
            : (requestedGroups.length ? new Set() : null);
        const bases = allowedBaseSet
            ? allBases.filter(base => allowedBaseSet.has(base))
            : allBases;
        const aggregated = {};
        const groupedValueMap = {};
        const byField = {};
        const missingByField = {};
        let missingAll = 0;
        let readErrors = 0;

        fieldList.forEach((field) => {
            byField[field] = {};
            missingByField[field] = 0;
        });

        const concurrency = Number.isFinite(Number(data.concurrency))
            ? Math.max(1, Number(data.concurrency))
            : 8;
        let cursor = 0;
        const worker = async () => {
            while (cursor < bases.length) {
                const base = bases[cursor];
                cursor += 1;
                const filePath = path.join(viewDir, `${base}.json`);
                try {
                    const raw = await fs.promises.readFile(filePath, 'utf8');
                    const json = JSON.parse(raw);
                    let hasAny = false;
                    const groupValueSets = [];
                    if (includeGroup) {
                        groupValueSets.push([baseGroupMap[base] || 'ungrouped']);
                    }
                    fieldList.forEach((field) => {
                        const values = extractFieldValuesFromData(json, field);
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
                    console.warn('GroupBy read failed for', base, err.message || err);
                    readErrors += 1;
                }
            }
        };
        const workers = Array.from({ length: Math.min(concurrency, bases.length || 1) }, () => worker());
        await Promise.all(workers);

        const groupedFields = includeGroup ? ['group', ...fieldList] : fieldList;
        const groupLabel = requestedGroups.length
            ? (matchedGroups.length
                ? matchedGroups.map(g => String(g.name || g.id || 'group')).join(' + ')
                : (fallbackAll ? 'all' : 'none'))
            : 'all';
        const result = {
            view,
            fields: fieldList,
            groupedFields,
            groupByGroupName: includeGroup,
            groupNames: requestedGroups,
            matchedGroupNames: matchedGroups.map(g => String(g.name || g.id || 'group')),
            groupLabel,
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
                : null,
            mode: useMode
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: result }));
    } catch (error) {
        console.error('✗ groupby-fields failed:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
    }
}

module.exports = {
    handleGroupByFields
};
