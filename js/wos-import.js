// WOS import logic extracted from app.js for easier maintenance
(function () {
    const App = window.PaperStatsApp;
    if (!App || !App.prototype) return;
    Object.assign(App.prototype, {
        async applyWosPlainTextToCurrentView(text = '', opts = {}) {
            const raw = String(text || '');
            if (!raw.trim()) {
                this.showNotification('WOS update: empty response', 'warning');
                return;
            }
            const tracker = this.createStatusProgressTracker('WOS update');
            const records = this.parseWosTxt(raw);
            if (!records.length) {
                tracker.finish('WOS update: no records', 800);
                this.showNotification('No WOS records returned', 'warning');
                return;
            }
            const recMap = new Map();
            records.forEach((rec) => {
                const d = this.normalizeDoiString(this.extractWosDoi(rec));
                if (!d) return;
                const list = recMap.get(d) || [];
                list.push(rec);
                recMap.set(d, list);
            });
            if (!recMap.size) {
                tracker.finish('WOS update: no DOI matches', 800);
                this.showNotification('No DOI matches in WOS response', 'warning');
                return;
            }

            const view = this.currentJsonView || 'view1';
            const bases = Array.isArray(this.currentFileList) ? this.currentFileList : [];
            let processed = 0;
            let updated = 0;
            let skipped = 0;
            const total = bases.length;
            const updateProgress = () => {
                const percent = total ? Math.round((processed / total) * 100) : 100;
                tracker.update(`WOS update: saving ${processed}/${total}`, percent);
            };
            updateProgress();

            for (const base of bases) {
                const cleanBase = String(base || '').replace(/\.json$/i, '');
                if (!cleanBase) {
                    processed += 1;
                    updateProgress();
                    continue;
                }
                const path = this.getViewPathForBase(cleanBase, view);
                if (!path) {
                    processed += 1;
                    updateProgress();
                    continue;
                }
                let data = this.tempDataCache[path];
                if (!data) {
                    try {
                        data = await this.readProjectFile(path);
                    } catch (_err) {
                        processed += 1;
                        updateProgress();
                        continue;
                    }
                }
                const rawDoi = data?.meta_info?.doi || this.findFirstDoiInData(data) || '';
                const doi = this.normalizeDoiString(rawDoi);
                if (!doi) {
                    skipped += 1;
                    processed += 1;
                    updateProgress();
                    continue;
                }
                const recs = recMap.get(doi);
                if (!recs || !recs.length) {
                    skipped += 1;
                    processed += 1;
                    updateProgress();
                    continue;
                }
                try {
                    let payload = data && typeof data === 'object' ? JSON.parse(JSON.stringify(data)) : null;
                    if (!payload || typeof payload !== 'object') {
                        payload = this.buildWosJsonPayload(recs[0], doi, this.extractWosId(recs[0]));
                        if (recs.length > 1) this.mergeWosData(payload, recs.slice(1));
                    } else {
                        if (!payload.meta_info || typeof payload.meta_info !== 'object') {
                            payload.meta_info = {};
                        }
                        if (!payload.meta_info.doi) {
                            payload.meta_info.doi = this.normalizeDoi(doi);
                        }
                        this.mergeWosData(payload, recs);
                    }
                    await this.saveJsonPayload(path, payload);
                    if (this.currentFile === path) {
                        this.currentData = payload;
                        this.hasUnsavedChanges = false;
                        delete this.tempDataCache[path];
                        this.updateSaveButtonState();
                        this.updateSchemaBadge();
                        this.renderStructuredView();
                        this.renderFlatView();
                        this.setupEditableListeners();
                        await this.applyCurrentView();
                    }
                    updated += 1;
                } catch (err) {
                    console.warn('Failed to update WOS data for', cleanBase, err);
                    skipped += 1;
                } finally {
                    processed += 1;
                    updateProgress();
                }
            }

            if (updated) {
                await this.loadFileList(true);
            }
            tracker.finish('WOS update: done', 800);
            const parts = [];
            if (updated) parts.push(`updated ${updated}`);
            if (skipped) parts.push(`skipped ${skipped}`);
            this.showNotification(`WOS update: ${parts.join(', ')}`, updated ? 'success' : 'info');
        },
        async updateGroupFromWos(group) {
            this.globalSettings = this.loadGlobalSettings();
            this.syncGlobalSettingsGlobals();
            const files = Array.isArray(group?.files) ? group.files : [];
            if (!files.length) {
                this.showNotification('No files in this group', 'warning');
                return;
            }
            const view = this.currentJsonView || 'view1';
            const tracker = this.createStatusProgressTracker('WOS update');
            const targets = [];
            let scanned = 0;
            let missingDoi = 0;
            const total = files.length;
            const updateScan = () => {
                const percent = total ? Math.round((scanned / total) * 30) : 10;
                tracker.update(`WOS update: scanning ${scanned}/${total}`, percent);
            };
            updateScan();

            for (const base of files) {
                const cleanBase = String(base || '').replace(/\.json$/i, '');
                if (!cleanBase) {
                    scanned += 1;
                    updateScan();
                    continue;
                }
                const path = this.getViewPathForBase(cleanBase, view);
                if (!path) {
                    scanned += 1;
                    updateScan();
                    continue;
                }
                let data = this.tempDataCache[path];
                if (!data) {
                    try {
                        data = await this.readProjectFile(path);
                    } catch (_err) {
                        scanned += 1;
                        updateScan();
                        continue;
                    }
                }
                if (data && data.wos_data) {
                    scanned += 1;
                    updateScan();
                    continue;
                }
                const rawDoi = data?.meta_info?.doi || this.findFirstDoiInData(data) || '';
                const doi = this.normalizeDoiString(rawDoi);
                if (!doi) {
                    missingDoi += 1;
                    scanned += 1;
                    updateScan();
                    continue;
                }
                targets.push({ base: cleanBase, path, doi });
                scanned += 1;
                updateScan();
            }

            if (!targets.length) {
                tracker.finish('WOS update: nothing to update', 800);
                const msg = missingDoi ? `No DOI found (${missingDoi} files)` : 'No files without wos_data';
                this.showNotification(msg, 'info');
                return;
            }

            const doiList = Array.from(new Set(targets.map(t => t.doi)));
            tracker.update(`WOS update: sending ${doiList.length} DOIs`, 70);

            const payload = {
                type: 'ENLIGHTENKEY_DOI_LIST',
                doiList: doiList
            };

            // 只通过 window.postMessage 发送，content script 需监听并转发到插件后台
            let sent = false;
            try {
                window.postMessage(payload, '*');
                sent = true;
            } catch (_err) {
                // ignore
            }
            tracker.finish('WOS update: submitted', 800);
            const parts = [`submitted ${doiList.length}`];
            if (missingDoi) parts.push(`missing doi ${missingDoi}`);
            this.showNotification(`WOS update: ${parts.join(', ')}`, sent ? 'success' : 'warning');
        },
        async handleWosTxtImport(e) {
            const input = e?.target;
            const files = Array.from(input?.files || []);
            if (!files.length) return;
            if (!this.currentProject) {
                this.showNotification('Please load a project first', 'warning');
                if (input) input.value = '';
                return;
            }
            const view = this.currentJsonView || 'view1';
            let tracker = null;
            try {
                tracker = this.createStatusProgressTracker('WOS import');
                const records = [];
                let invalid = 0;
                let empty = 0;
                let readFailed = 0;
                const totalFiles = files.length;
                let processedFiles = 0;
                const notifyFileStep = Math.max(1, Math.floor(totalFiles / 10));
                const updateFileProgress = () => {
                    const percent = totalFiles ? Math.round((processedFiles / totalFiles) * 30) : 8;
                    tracker.update(`WOS import: reading ${processedFiles}/${totalFiles}`, percent);
                };
                updateFileProgress();

                for (const file of files) {
                    try {
                        const text = await this.readFileAsText(file);
                        if (!this.isValidWosTxt(text)) {
                            invalid += 1;
                            continue;
                        }
                        const parsed = this.parseWosTxt(text);
                        if (!parsed.length) {
                            empty += 1;
                            continue;
                        }
                        records.push(...parsed);
                    } catch (err) {
                        console.warn('Failed to read WOS file:', file?.name, err);
                        readFailed += 1;
                    } finally {
                        processedFiles += 1;
                        if (processedFiles % notifyFileStep === 0 || processedFiles === totalFiles) {
                            updateFileProgress();
                        }
                    }
                }

                if (!records.length) {
                    const parts = [];
                    if (invalid) parts.push(`invalid ${invalid}`);
                    if (empty) parts.push(`empty ${empty}`);
                    if (readFailed) parts.push(`failed ${readFailed}`);
                    const suffix = parts.length ? ` (${parts.join(', ')})` : '';
                    this.showNotification(`No WOS records found${suffix}`, 'warning');
                    tracker.finish('WOS import: no records', 800);
                    return;
                }
                const batches = new Map();
                let skipped = 0;
                const totalRecords = records.length;
                let processedRecords = 0;
                const notifyRecordStep = Math.max(1, Math.floor(totalRecords / 10));
                const updateRecordProgress = () => {
                    const percent = totalRecords ? 30 + Math.round((processedRecords / totalRecords) * 30) : 30;
                    tracker.update(`WOS import: processing ${processedRecords}/${totalRecords}`, percent);
                };
                updateRecordProgress();

                for (const rec of records) {
                    const doi = this.extractWosDoi(rec);
                    const wosid = this.extractWosId(rec);
                    const base = doi ? this.doiToFilenameBase(doi) : this.wosidToFilenameBase(wosid);
                    if (!base) {
                        skipped += 1;
                        processedRecords += 1;
                        if (processedRecords % notifyRecordStep === 0 || processedRecords === totalRecords) {
                            updateRecordProgress();
                        }
                        continue;
                    }
                    const entry = batches.get(base) || {
                        records: [],
                        doi: '',
                        wosid: '',
                        isWosidOnly: true
                    };
                    entry.records.push(rec);
                    if (doi && !entry.doi) entry.doi = doi;
                    if (wosid && !entry.wosid) entry.wosid = wosid;
                    if (doi) entry.isWosidOnly = false;
                    batches.set(base, entry);
                    processedRecords += 1;
                    if (processedRecords % notifyRecordStep === 0 || processedRecords === totalRecords) {
                        updateRecordProgress();
                    }
                }

                const wosidBases = [];
                let created = 0;
                let updated = 0;
                let failed = 0;
                const totalBatches = batches.size;
                let processedBatches = 0;
                const notifyBatchStep = Math.max(1, Math.floor(totalBatches / 10));
                const updateBatchProgress = () => {
                    const percent = totalBatches ? 60 + Math.round((processedBatches / totalBatches) * 40) : 60;
                    tracker.update(`WOS import: saving ${processedBatches}/${totalBatches}`, percent);
                };
                if (totalBatches) updateBatchProgress();

                for (const [base, entry] of batches.entries()) {
                    try {
                        const existingPath = this.fileMetaByBase?.[base]?.views?.[view] || null;
                        const jsonFilename = existingPath || `json/${view}/${base}.json`;
                        let payload = null;
                        let existed = false;
                        try {
                            const exists = await this.projectFileExists(jsonFilename);
                            if (exists) {
                                payload = await this.readProjectFile(jsonFilename);
                                existed = !!payload;
                            }
                        } catch (_err) {
                            existed = false;
                        }

                        if (!payload || !existed) {
                            payload = this.buildWosJsonPayload(entry.records[0], entry.doi, entry.wosid);
                            this.mergeWosData(payload, entry.records.slice(1));
                            await this.saveJsonPayload(jsonFilename, payload);
                            if (entry.doi) {
                                await this.ensureMarkdownExistsForFile(jsonFilename);
                            }
                            created += 1;
                        } else {
                            if (!payload.meta_info || typeof payload.meta_info !== 'object') {
                                payload.meta_info = {};
                            }
                            if (entry.doi && !payload.meta_info.doi) {
                                payload.meta_info.doi = this.normalizeDoi(entry.doi);
                            }
                            this.mergeWosData(payload, entry.records);
                            await this.saveJsonPayload(jsonFilename, payload);
                            updated += 1;
                        }

                        if (entry.isWosidOnly) wosidBases.push(base);
                    } catch (err) {
                        console.warn('WOS import failed for base:', base, err);
                        failed += 1;
                    } finally {
                        processedBatches += 1;
                        if (processedBatches % notifyBatchStep === 0 || processedBatches === totalBatches) {
                            updateBatchProgress();
                        }
                    }
                }

                if (created || updated) {
                    await this.loadFileList(true);
                }

                if (wosidBases.length) {
                    const groupId = this.ensureGroupByName('wosid');
                    this.moveFilesToGroup(wosidBases, groupId);
                }

                const parts = [];
                if (created) parts.push(`created ${created}`);
                if (updated) parts.push(`updated ${updated}`);
                if (skipped) parts.push(`skipped ${skipped}`);
                if (failed) parts.push(`failed ${failed}`);
                if (invalid) parts.push(`invalid ${invalid}`);
                if (empty) parts.push(`empty ${empty}`);
                if (readFailed) parts.push(`read failed ${readFailed}`);
                const type = failed ? 'error' : 'success';
                tracker.finish('WOS import: finalizing...', 800);
                this.showNotification(`WOS import: ${parts.join(', ')}`, type);
            } catch (err) {
                console.error('WOS txt import failed:', err);
                if (tracker) {
                    tracker.fail(`WOS import failed: ${err.message}`);
                }
                this.showNotification(`WOS import failed: ${err.message}`, 'error');
            } finally {
                if (input) input.value = '';
            }
        },

        mergeWosData(payload, records) {
            if (!payload || !records || !records.length) return;
            const ensureObject = (val) => {
                if (!val) return {};
                if (Array.isArray(val)) return val[0] && typeof val[0] === 'object' ? { ...val[0] } : {};
                return typeof val === 'object' ? { ...val } : {};
            };
            let merged = ensureObject(payload.wos_data);
            records.forEach((rec) => {
                const next = this.normalizeWosRecord(rec);
                Object.entries(next).forEach(([tag, value]) => {
                    if (value === undefined || value === null || value === '') return;
                    merged[tag] = value;
                });
            });
            this.applyWosLinkFields(merged);
            payload.wos_data = merged;
        },

        applyWosLinkFields(wosData) {
            if (!wosData || typeof wosData !== 'object') return;
            const legacyRaw = Array.isArray(wosData.wosid) ? wosData.wosid[0] : wosData.wosid;
            const currentRaw = Array.isArray(wosData.wos_id) ? wosData.wos_id[0] : wosData.wos_id;
            const raw = currentRaw || legacyRaw;
            if (!raw) return;
            if (!currentRaw && legacyRaw) {
                wosData.wos_id = legacyRaw;
                delete wosData.wosid;
            }
            const normalized = this.normalizeWosIdPrefix(raw);
            if (!normalized) return;
            wosData.wos_id = normalized;
            const encoded = encodeURIComponent(normalized);
            wosData.citations = `https://www.webofscience.com/wos/woscc/citing-summary/${encoded}?from=woscc&type=colluid&eventMode=timeCitedOnSummary`;
            wosData.references = `https://www.webofscience.com/wos/woscc/cited-references-summary/${encoded}?type=colluid&from=woscc`;
            wosData.related = `https://www.webofscience.com/wos/woscc/related-records-summary/${encoded}?type=colluid&from=woscc`;
        },

        getStatusProgressEls() {
            if (this._statusProgressEls) return this._statusProgressEls;
            const wrap = document.getElementById('statusProgress');
            const bar = document.getElementById('statusProgressBar');
            const text = document.getElementById('statusProgressText');
            this._statusProgressEls = { wrap, bar, text };
            return this._statusProgressEls;
        },

        setStatusProgress(text = '', percent = 0) {
            const { wrap, bar, text: textEl } = this.getStatusProgressEls();
            if (!wrap || !bar || !textEl) return;
            if (this._statusProgressTagTimer) {
                clearTimeout(this._statusProgressTagTimer);
                this._statusProgressTagTimer = null;
            }
            wrap.classList.add('active');
            wrap.dataset.mode = 'progress';
            wrap.dataset.type = '';
            bar.style.setProperty('--status-progress', `${Math.max(0, Math.min(100, percent))}%`);
            textEl.textContent = text || '';
            this._statusProgressState = { text: textEl.textContent, percent: Math.max(0, Math.min(100, percent)) };
        },

        clearStatusProgress() {
            const { wrap, bar, text: textEl } = this.getStatusProgressEls();
            if (!wrap || !bar || !textEl) return;
            wrap.classList.remove('active');
            wrap.dataset.mode = '';
            wrap.dataset.type = '';
            bar.style.setProperty('--status-progress', '0%');
            textEl.textContent = '';
            this._statusProgressState = { text: '', percent: 0 };
            if (this._statusProgressTagTimer) {
                clearTimeout(this._statusProgressTagTimer);
                this._statusProgressTagTimer = null;
            }
        },

        createStatusProgressTracker(label = 'Working', opts = {}) {
            const minIntervalMs = Number.isFinite(opts.minIntervalMs) ? opts.minIntervalMs : 200;
            let active = true;
            let lastTs = 0;
            let lastPercent = 0;
            const update = (text = label, percent = 0) => {
                if (!active) return;
                const now = Date.now();
                if (now - lastTs < minIntervalMs && percent < 100) return;
                lastTs = now;
                const next = Math.max(lastPercent, percent);
                lastPercent = next;
                this.setStatusProgress(text, next);
            };
            const finish = (text = `${label} done`, delayMs = 1200) => {
                if (!active) return;
                active = false;
                this.setStatusProgress(text, 100);
                setTimeout(() => this.clearStatusProgress(), delayMs);
            };
            const fail = (text = `${label} failed`, delayMs = 1600) => {
                if (!active) return;
                active = false;
                this.setStatusProgress(text, 100);
                setTimeout(() => this.clearStatusProgress(), delayMs);
            };
            return { update, finish, fail };
        },

        showStatusTag(message = '', type = 'info', durationMs = 2500) {
            const { wrap, bar, text: textEl } = this.getStatusProgressEls();
            if (!wrap || !bar || !textEl) return;
            const prevMode = wrap.dataset.mode || '';
            const prevState = { ...this._statusProgressState };
            wrap.classList.add('active');
            wrap.dataset.mode = 'tag';
            wrap.dataset.type = type || 'info';
            textEl.textContent = message;
            if (prevMode === 'progress') {
                bar.style.setProperty('--status-progress', `${prevState.percent}%`);
            } else {
                bar.style.setProperty('--status-progress', '0%');
            }
            if (this._statusProgressTagTimer) {
                clearTimeout(this._statusProgressTagTimer);
            }
            this._statusProgressTagTimer = setTimeout(() => {
                if (prevMode === 'progress') {
                    wrap.dataset.mode = 'progress';
                    wrap.dataset.type = '';
                    bar.style.setProperty('--status-progress', `${prevState.percent}%`);
                    textEl.textContent = prevState.text || '';
                } else {
                    this.clearStatusProgress();
                }
            }, durationMs);
        },

        syncWosLinks(wosData) {
            if (!wosData || typeof wosData !== 'object') return;
            const legacyRaw = Array.isArray(wosData.wosid) ? wosData.wosid[0] : wosData.wosid;
            const currentRaw = Array.isArray(wosData.wos_id) ? wosData.wos_id[0] : wosData.wos_id;
            const raw = (currentRaw || legacyRaw || '').trim();
            if (!raw) {
                delete wosData.citations;
                delete wosData.references;
                delete wosData.related;
                return;
            }
            this.applyWosLinkFields(wosData);
        },

        normalizeWosIdPrefix(value) {
            const clean = String(value || '').trim();
            if (!clean) return '';
            return clean.includes(':') ? clean : `WOS:${clean}`;
        },

        parseWosTxt(text = '') {
            const lines = String(text || '').split(/\r?\n/);
            const records = [];
            let current = null;
            let currentTag = null;
            for (const raw of lines) {
                const line = raw || '';
                if (!line.trim()) continue;
                if (line.startsWith('EF')) break;
                if (line.startsWith('ER')) {
                    if (current) records.push(current);
                    current = null;
                    currentTag = null;
                    continue;
                }
                const match = line.match(/^([A-Z0-9]{2})\s+(.*)$/);
                if (match) {
                    const tag = match[1];
                    if (tag === 'FN' || tag === 'VR' || tag === 'EF') {
                        currentTag = null;
                        continue;
                    }
                    const value = match[2]?.trim() || '';
                    if (!current) current = {};
                    if (!current[tag]) current[tag] = [];
                    if (value) current[tag].push(value);
                    currentTag = tag;
                    continue;
                }
                if (current && currentTag && line.startsWith(' ')) {
                    const value = line.trim();
                    if (value) {
                        if (!current[currentTag]) current[currentTag] = [];
                        current[currentTag].push(value);
                    }
                }
            }
            if (current) records.push(current);
            return records;
        },

        isValidWosTxt(text = '') {
            const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            if (!lines.length) return false;
            const hasHeader = lines[0] === 'FN Clarivate Analytics Web of Science';
            const hasVersion = lines[1] === 'VR 1.0';
            const hasFooter = lines.some(l => l === 'EF');
            return hasHeader && hasVersion && hasFooter;
        },

        extractWosDoi(record = {}) {
            const di = record.DI || record.Do || record.DO || [];
            const candidates = Array.isArray(di) ? di : [di];
            const primary = candidates.find(Boolean) || '';
            if (primary) return this.normalizeDoi(primary);
            const allText = Object.values(record || {})
                .flat()
                .filter(Boolean)
                .join(' ');
            const fallback = this.extractDoisFromText(allText)[0];
            return fallback || '';
        },

        extractWosId(record = {}) {
            const ut = record.UT || [];
            const value = Array.isArray(ut) ? ut.find(Boolean) : ut;
            if (!value) return '';
            const match = String(value).match(/WOS:(.+)/i);
            return match ? match[1].trim() : String(value).trim();
        },

        wosidToFilenameBase(wosid = '') {
            const clean = String(wosid || '').trim();
            if (!clean) return '';
            return clean.replace(/[^a-zA-Z0-9._-]+/g, '_') || 'wos_item';
        },

        buildWosJsonPayload(record = {}, doi = '', wosid = '') {
            const cleanDoi = doi ? this.normalizeDoi(doi) : '';
            const meta = {
                doi: cleanDoi,
                No: null
            };
            const wosData = this.normalizeWosRecord(record);
            this.applyWosLinkFields(wosData);
            return {
                schema_version: '1.0',
                meta_info: meta,
                wos_data: wosData
            };
        },

        normalizeWosRecord(record = {}) {
            const out = {};
            Object.entries(record || {}).forEach(([tag, values]) => {
                const list = Array.isArray(values) ? values.filter(Boolean) : [values].filter(Boolean);
                if (!list.length) return;
                const meta = this.wosFieldTagsByTag?.[tag] || {};
                const key = meta.normalized_key || tag;
                const mergedText = list.join(' ').replace(/\s+/g, ' ').trim();
                let value = this.splitWosFieldValue(tag, mergedText);
                if (value === null) value = mergedText;
                if (tag === 'PT' && this.wosFieldPtValueMap) {
                    const mapped = Array.isArray(value)
                        ? value.map(v => this.wosFieldPtValueMap[v] || v)
                        : (this.wosFieldPtValueMap[value] || value);
                    value = mapped;
                }
                out[key] = value;
            });
            return out;
        },

        splitWosFieldValue(tag, text) {
            if (!text) return null;
            const t = String(tag || '').toUpperCase();
            if (t === 'C1') {
                const out = [];
                const re = /\[([^\]]+)\]\s*([^[]+)/g;
                let match;
                while ((match = re.exec(text)) !== null) {
                    const author = match[1]?.trim();
                    const address = match[2]?.trim();
                    if (author || address) {
                        out.push({ author: author || '', address: address || '' });
                    }
                }
                if (out.length) return out;
            }
            const splitBySemicolon = new Set(['AU', 'AF', 'EM', 'RI', 'OI', 'DE', 'ID', 'SC', 'WC', 'WE', 'CR']);
            if (splitBySemicolon.has(t)) {
                const parts = text.split(/\s*;\s*/).map(v => v.trim()).filter(Boolean);
                return parts.length ? parts : null;
            }
            return null;
        }
    });

    const bindWosPlainTextListener = () => {
        if (window.__wosPlainTextListenerBound) return;
        window.__wosPlainTextListenerBound = true;
        window.addEventListener("__ENLIGHTENKEY_WOS_PLAIN_TEXT__", (event) => {
            const { text: payloadText, updatedAt, source } = event.detail || {};
            console.log('text length:', payloadText?.length, updatedAt, source);
            const app = window.paperStats;
            if (!app || typeof app.applyWosPlainTextToCurrentView !== 'function') return;
            app.applyWosPlainTextToCurrentView(payloadText, { updatedAt, source });
        });
    };

    bindWosPlainTextListener();
})();
