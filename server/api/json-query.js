const fs = require('fs');
const path = require('path');

function normalizeDoiString(raw = '') {
    return (raw || '')
        .trim()
        .replace(/^[({\[]+/, '')
        .replace(/[)}\].,;]+$/, '')
        .replace(/^doi:/i, '')
        .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
        .replace(/_/g, '/');
}

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

function getFieldValues(data, fieldPath) {
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

async function handleJsonQuery(req, res, {
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
        const fields = Array.isArray(data.fields)
            ? data.fields.filter(Boolean).map(f => String(f))
            : String(data.fields || '')
                .split(/[,，]+/)
                .map(v => v.trim())
                .filter(Boolean);
        if (!fields.length) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, data: { items: [], total: 0 } }));
            return;
        }

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

        const viewDir = resolveJsonViewDir(fullPath, view);
        const allBases = listJsonBasesInDir(viewDir);
        const allowedBaseSet = activeGroups.length
            ? new Set(activeGroups.flatMap(g => (g.files || []).map(normalizeGroupBase).filter(Boolean)))
            : (requestedGroups.length ? new Set() : null);
        const bases = allowedBaseSet
            ? allBases.filter(base => allowedBaseSet.has(base))
            : allBases;

        const items = [];
        const concurrency = Number.isFinite(Number(data.concurrency))
            ? Math.max(1, Number(data.concurrency))
            : 4;
        let cursor = 0;
        const worker = async () => {
            while (cursor < bases.length) {
                const base = bases[cursor];
                cursor += 1;
                const filePath = path.join(viewDir, `${base}.json`);
                try {
                    const raw = await fs.promises.readFile(filePath, 'utf8');
                    const json = JSON.parse(raw);
                    const doiRaw = json?.meta_info?.doi;
                    const doi = doiRaw ? normalizeDoiString(doiRaw) : '';
                    if (!doi) continue;
                    const item = { doi };
                    fields.forEach((field) => {
                        const vals = getFieldValues(json, field);
                        if (vals && vals.length) {
                            item[field] = vals.length === 1 ? vals[0] : vals.join('; ');
                        }
                    });
                    items.push(item);
                } catch (err) {
                    console.warn('JSON query read failed for', base, err.message || err);
                }
            }
        };
        const workers = Array.from({ length: Math.min(concurrency, bases.length || 1) }, () => worker());
        await Promise.all(workers);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            data: {
                items,
                total: bases.length,
                view,
                fields,
                groupNames: requestedGroups,
                matchedGroupNames: matchedGroups.map(g => String(g.name || g.id || 'group'))
            }
        }));
    } catch (error) {
        console.error('✗ json-query failed:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
    }
}

module.exports = {
    handleJsonQuery
};
