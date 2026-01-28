const https = require('https');
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

function formatSingleBibFallback(doi) {
    const normalized = normalizeDoiString(doi);
    const key = normalized.replace(/[^a-zA-Z0-9]/g, '_');
    const href = `https://doi.org/${encodeURIComponent(normalized)}`;
    return `@article{${key},\n  doi = {${normalized}},\n  url = {${href}}\n}`;
}

function fetchBibtexUrl(targetUrl, redirects = 0) {
    return new Promise((resolve, reject) => {
        if (redirects > 3) {
            reject(new Error('Too many redirects'));
            return;
        }
        const req = https.get(targetUrl, {
            headers: {
                'Accept': 'application/x-bibtex'
            }
        }, (resp) => {
            const status = resp.statusCode || 0;
            if (status >= 300 && status < 400 && resp.headers.location) {
                const nextUrl = resp.headers.location.startsWith('http')
                    ? resp.headers.location
                    : new URL(resp.headers.location, targetUrl).toString();
                resp.resume();
                fetchBibtexUrl(nextUrl, redirects + 1).then(resolve).catch(reject);
                return;
            }
            if (status < 200 || status >= 300) {
                resp.resume();
                resolve('');
                return;
            }
            let data = '';
            resp.setEncoding('utf8');
            resp.on('data', chunk => { data += chunk; });
            resp.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.setTimeout(15000, () => {
            req.destroy(new Error('Request timeout'));
        });
    });
}

async function fetchBibtexForDoi(doi) {
    const normalized = normalizeDoiString(doi);
    if (!normalized) return '';
    try {
        const url = `https://doi.org/${encodeURIComponent(normalized)}`;
        const text = await fetchBibtexUrl(url);
        if (text && text.trim()) return text.trim();
    } catch (err) {
        console.warn('BibTeX fetch failed:', normalized, err.message || err);
    }
    return '';
}

async function fetchBibtexBatch(dois = [], concurrency = 3) {
    const clean = (dois || []).map(normalizeDoiString).filter(Boolean);
    const results = new Array(clean.length).fill('');
    let cursor = 0;
    const limit = Math.max(1, Math.min(Number(concurrency) || 3, 8));
    const worker = async () => {
        while (cursor < clean.length) {
            const idx = cursor;
            cursor += 1;
            const doi = clean[idx];
            if (!doi) continue;
            const text = await fetchBibtexForDoi(doi);
            results[idx] = text;
        }
    };
    const workers = Array.from({ length: Math.min(limit, clean.length) }, () => worker());
    await Promise.all(workers);
    return clean.map((doi, idx) => ({
        doi,
        bibtex: results[idx] || ''
    }));
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

async function handleBibDownload(req, res, { formatDate }) {
    try {
        const data = await parseJsonBody(req);
        const input = Array.isArray(data.dois)
            ? data.dois
            : (data.doi ? [data.doi] : []);
        const dois = input.map(normalizeDoiString).filter(Boolean);
        if (!dois.length) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Missing DOI(s)' }));
            return;
        }

        const concurrency = Number.isFinite(Number(data.concurrency))
            ? Number(data.concurrency)
            : 3;
        const fetched = await fetchBibtexBatch(dois, concurrency);
        const entries = fetched.map(item => item.bibtex || formatSingleBibFallback(item.doi));
        const text = entries.filter(Boolean).join('\n\n').trim() + '\n';

        const rawName = String(data.filename || '').trim();
        const baseName = rawName ? path.basename(rawName) : `references_${formatDate()}.bib`;
        const safeName = baseName.replace(/[^a-zA-Z0-9._-]/g, '_');

        res.writeHead(200, {
            'Content-Type': 'text/plain; charset=utf-8',
            'Content-Disposition': `attachment; filename="${safeName}"`
        });
        res.end(text);
    } catch (error) {
        console.error('✗ bib-download failed:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
    }
}

module.exports = {
    handleBibDownload
};
