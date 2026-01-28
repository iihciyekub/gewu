(() => {
    if (typeof window === 'undefined') return;

    const attachBibDownload = () => {
        const proto = window.PaperStatsApp?.prototype
            || (window.paperStats ? Object.getPrototypeOf(window.paperStats) : null);
        if (!proto || proto.__bibDownloadAttached) return false;
        proto.__bibDownloadAttached = true;

        proto.applyBibliographyRendering = async function (renderRoot) {
            if (!renderRoot) return;
            const spans = Array.from(renderRoot.querySelectorAll('.bibliography-inline'));
            if (!spans.length) return;

            spans.forEach((span) => {
                const dois = (span.dataset.bibDois || '').split(',').map(d => d.trim()).filter(Boolean);
                if (!dois.length) return;

                if (span.classList.contains('bib-rendered')) return;

                const doiLabel = dois.length === 1 ? dois[0] : `${dois.length} items`;
                const btn = document.createElement('button');
                btn.className = 'bib-fetch-btn';
                btn.dataset.bibDois = dois.join(',');
                btn.innerHTML = `<i class="fas fa-book"></i><span>Fetch BibTeX (${this.escapeHtml(doiLabel)})</span>`;
                btn.title = 'Click to query and display BibTeX citation';

                span.innerHTML = '';
                span.appendChild(btn);
                span.classList.add('bib-rendered');
            });

            this.bindBibFetchButtons(renderRoot);
        };

        proto.bindBibFetchButtons = function (renderRoot) {
            if (!renderRoot) return;
            const buttons = renderRoot.querySelectorAll('.bib-fetch-btn');
            buttons.forEach(btn => {
                if (btn.dataset.bound === '1') return;
                btn.dataset.bound = '1';

                btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const target = e.currentTarget;
                    const dois = (target.dataset.bibDois || '').split(',').map(d => d.trim()).filter(Boolean);
                    if (!dois.length) return;

                    target.disabled = true;
                    const originalLabel = target.innerHTML;
                    target.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Fetching...</span>';

                    try {
                        const bibtex = await this.formatBibliography(dois);
                        const filename = dois.length === 1
                            ? `${this.normalizeDoiString(dois[0]).replace(/[^a-zA-Z0-9._-]+/g, '_') || 'reference'}.bib`
                            : `references_${Date.now()}.bib`;
                        this.triggerBlobDownload(new Blob([bibtex], { type: 'text/plain' }), filename);
                        target.innerHTML = '<i class="fas fa-check"></i><span>Downloaded</span>';
                        setTimeout(() => {
                            target.disabled = false;
                            target.innerHTML = originalLabel;
                        }, 1800);
                    } catch (err) {
                        console.error('Failed to fetch BibTeX:', err);
                        target.disabled = false;
                        target.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>Failed, click to retry</span>';
                        target.title = `Error: ${err.message}`;
                    }
                });
            });
        };

        proto.bindBibResultActions = function (resultDiv, bibtex) {
            const copyBtn = resultDiv.querySelector('.bib-copy-btn');
            const collapseBtn = resultDiv.querySelector('.bib-collapse-btn');
            const pre = resultDiv.querySelector('pre');

            if (copyBtn) {
                copyBtn.addEventListener('click', async () => {
                    try {
                        await navigator.clipboard.writeText(bibtex);
                        const icon = copyBtn.querySelector('i');
                        icon.className = 'fas fa-check';
                        setTimeout(() => {
                            icon.className = 'fas fa-copy';
                        }, 2000);
                    } catch (err) {
                        console.error('Failed to copy:', err);
                    }
                });
            }

            if (collapseBtn && pre) {
                collapseBtn.addEventListener('click', () => {
                    pre.classList.toggle('collapsed');
                    const icon = collapseBtn.querySelector('i');
                    if (pre.classList.contains('collapsed')) {
                        icon.className = 'fas fa-chevron-down';
                        collapseBtn.title = 'Expand';
                    } else {
                        icon.className = 'fas fa-chevron-up';
                        collapseBtn.title = 'Collapse';
                    }
                });
            }
        };

        proto.formatBibliography = async function (dois = [], opts = {}) {
            const clean = (dois || []).map(d => this.normalizeDoiString(d)).filter(Boolean);
            if (!clean.length) return '';

            try {
                const Cite = await this.ensureCiteLib();
                if (!Cite) throw new Error('citation-js 未加载');

                const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
                const results = [];
                const queue = clean.map(doi => ({ doi, attempts: 0 }));
                let done = 0;
                const total = clean.length;
                const batchSize = 3;

                while (queue.length) {
                    const batch = queue.splice(0, batchSize);
                    const batchResults = await Promise.all(batch.map(async (item) => {
                        item.attempts += 1;
                        try {
                            const cite = await Cite.async(item.doi);
                            const bibtex = cite.format('bibtex', {
                                format: 'text',
                                lang: 'en-US'
                            });
                            const ok = typeof bibtex === 'string' && bibtex.trim().length > 0;
                            if (!ok) throw new Error('Empty BibTeX');
                            return { ok: true, bibtex, item };
                        } catch (error) {
                            console.warn(`Failed to fetch BibTeX for ${item.doi} (attempt ${item.attempts}):`, error);
                            return { ok: false, bibtex: '', item };
                        }
                    }));

                    batchResults.forEach(({ ok, bibtex, item }) => {
                        if (ok) {
                            results.push(bibtex);
                            done += 1;
                        } else if (item.attempts < 3) {
                            queue.push(item);
                        } else {
                            done += 1;
                        }
                        if (typeof opts.onProgress === 'function') {
                            opts.onProgress(done, total);
                        }
                    });

                    if (queue.length) {
                        const pauseMs = 1000 + Math.floor(Math.random() * 2001);
                        await sleep(pauseMs);
                    }
                }

                const text = results.filter(Boolean).join('\n\n');

                if (this.projectStorage && text) {
                    await this.saveBibliographyCache(clean, text);
                }

                return text || this.formatBibliographyFallback(clean);
            } catch (err) {
                console.warn('Bibliography render fallback:', err);
                return this.formatBibliographyFallback(clean);
            }
        };

        proto.formatBibliographyFallback = function (dois = []) {
            const list = (dois || []).map(d => this.normalizeDoiString(d)).filter(Boolean);
            if (!list.length) return '';
            return list.map(doi => this.formatSingleBibFallback(doi)).join('\n\n');
        };

        proto.formatSingleBibFallback = function (doi) {
            const normalized = this.normalizeDoiString(doi);
            const key = normalized.replace(/[^a-zA-Z0-9]/g, '_');
            const href = `https://doi.org/${encodeURIComponent(normalized)}`;
            return `@article{${key},\n  doi = {${normalized}},\n  url = {${href}}\n}`;
        };

        proto.saveBibliographyCache = async function (dois, text) {
            if (!this.projectStorage) return;

            try {
                const cacheData = await this.projectStorage.load('citation-meta') || {};
                dois.forEach(doi => {
                    if (!cacheData[doi]) {
                        cacheData[doi] = {};
                    }
                    cacheData[doi]._bibCache = text;
                    cacheData[doi]._bibTimestamp = Date.now();
                });
                await this.projectStorage.save('citation-meta', cacheData);
            } catch (error) {
                console.warn('Failed to save bibliography cache:', error);
            }
        };

        return true;
    };

    if (!attachBibDownload()) {
        document.addEventListener('DOMContentLoaded', () => {
            attachBibDownload();
        }, { once: true });
    }
})();
