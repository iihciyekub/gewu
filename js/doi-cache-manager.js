/**
 * DOI 自动补全缓存管理器
 *
 * 功能：
 * 1. 导出项目中的 DOI 数据（doi, title, authors, publication_year）
 * 2. 使用 IndexedDB 进行本地缓存
 * 3. 支持缓存版本管理和自动更新
 * 4. 提供高效的搜索和匹配功能
 */

class DoiCacheManager {
    constructor(app) {
        this.app = app;
        this.dbName = 'GEWUDoiCache';
        this.dbVersion = 1;
        this.storeName = 'doiData';
        this.cacheDataVersion = 3; // 缓存数据版本（修改格式时增加此版本号）- v3: 优先使用 wos_data.author_full_names
        this.db = null;
        this.cacheKey = null; // 当前项目的缓存键
        this.memoryCache = null; // 内存缓存，加速查询
        this.lastUpdateTime = null;
        this.autoUpdateInterval = 5 * 60 * 1000; // 5分钟自动更新
        this.updateTimer = null;
    }

    /**
     * 初始化 IndexedDB
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('Failed to open IndexedDB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('✓ DOI Cache IndexedDB initialized');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // 创建对象存储
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const objectStore = db.createObjectStore(this.storeName, { keyPath: 'projectKey' });
                    objectStore.createIndex('timestamp', 'timestamp', { unique: false });
                    console.log('✓ DOI Cache object store created');
                }
            };
        });
    }

    /**
     * 获取当前项目的缓存键
     */
    getProjectCacheKey() {
        if (this.cacheKey) return this.cacheKey;

        // 使用项目路径和文件数量生成唯一键
        const projectPath = this.app.currentProjectPath || '';
        const fileCount = Object.keys(this.app.fileMetaByBase || {}).length;
        this.cacheKey = `${projectPath}_${fileCount}`;
        return this.cacheKey;
    }

    /**
     * 从 IndexedDB 加载缓存
     * 检查缓存版本，如果版本不匹配则自动重建
     */
    async loadFromCache() {
        if (!this.db) {
            await this.init();
        }

        const key = this.getProjectCacheKey();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.get(key);

            request.onsuccess = () => {
                const result = request.result;
                if (result && result.data) {
                    // 检查缓存版本
                    const cacheVersion = result.version || 1;
                    if (cacheVersion !== this.cacheDataVersion) {
                        console.log(`Cache version mismatch (${cacheVersion} vs ${this.cacheDataVersion}), will rebuild cache`);
                        resolve(null); // 返回 null 触发重建
                        return;
                    }

                    this.memoryCache = result.data;
                    this.lastUpdateTime = result.timestamp;
                    console.log(`✓ Loaded ${result.data.length} DOI entries from cache (v${cacheVersion})`);
                    resolve(result.data);
                } else {
                    console.log('No cache found, will build new cache');
                    resolve(null);
                }
            };

            request.onerror = () => {
                console.error('Failed to load cache:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * 保存缓存到 IndexedDB
     * 包含版本号，用于检测缓存格式变化
     */
    async saveToCache(data) {
        if (!this.db) {
            await this.init();
        }

        const key = this.getProjectCacheKey();
        const cacheEntry = {
            projectKey: key,
            data: data,
            timestamp: Date.now(),
            version: this.cacheDataVersion  // 添加版本号
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.put(cacheEntry);

            request.onsuccess = () => {
                this.memoryCache = data;
                this.lastUpdateTime = cacheEntry.timestamp;
                console.log(`✓ Saved ${data.length} DOI entries to cache (v${this.cacheDataVersion})`);
                resolve();
            };

            request.onerror = () => {
                console.error('Failed to save cache:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * 构建 DOI 数据缓存
     * 导出固定的4个字段：doi, title, authors, publication_year
     */
    async buildCache(options = {}) {
        const showNotification = options.notify !== false;

        if (showNotification) {
            this.app.showNotification('Building DOI cache...', 'info');
        }

        const files = this.app.visibleFileOrder && this.app.visibleFileOrder.length
            ? this.app.visibleFileOrder
            : (this.app.currentFileList || []);

        if (!files.length) {
            console.warn('No files available for cache building');
            return [];
        }

        const doiDataList = [];

        for (const filename of files) {
            try {
                const base = filename;
                const paths = this.app.getPathsForBase(base);
                const jsonPath = paths?.json || base;

                // 读取 JSON 数据
                let data = null;
                try {
                    data = await this.app.readProjectFile(jsonPath);
                } catch (err) {
                    console.warn('Failed to read file:', jsonPath, err);
                    continue;
                }

                if (!data) continue;

                // 提取 DOI
                const doi = this.app.findFirstDoiInData(data) ||
                           (data.meta_info && data.meta_info.doi) || '';

                if (!doi) continue; // 跳过没有 DOI 的文件

                // 提取标题
                const title = this.extractField(data, ['wos_data.title', 'meta_info.title', 'title', 'TI']);

                // 提取作者
                const authors = this.extractField(data, ['wos_data.author_full_names', 'wos_data.authors', 'meta_info.authors', 'authors', 'AF', 'AU']);

                // 提取年份
                const year = this.extractField(data, ['wos_data.publication_year', 'meta_info.publication_year', 'year', 'PY']);

                // 格式化作者显示
                const authorDisplay = this.formatAuthors(authors);

                doiDataList.push({
                    doi: doi,
                    title: String(title || ''),
                    authors: String(authors || ''),
                    authorDisplay: authorDisplay,
                    year: String(year || ''),
                    base: base
                });

            } catch (err) {
                console.warn('Error processing file:', filename, err);
            }
        }

        // 保存到缓存
        await this.saveToCache(doiDataList);

        if (showNotification) {
            this.app.showNotification(`Cached ${doiDataList.length} DOI entries`, 'success');
        }

        return doiDataList;
    }

    /**
     * 从数据对象中提取字段值
     * 支持多种字段路径
     */
    extractField(data, fieldPaths) {
        if (!data || !fieldPaths) return '';

        for (const path of fieldPaths) {
            const parts = path.split('.');
            let value = data;

            for (const part of parts) {
                if (value && typeof value === 'object' && part in value) {
                    value = value[part];
                } else {
                    value = null;
                    break;
                }
            }

            if (value !== null && value !== undefined && value !== '') {
                // 如果是数组，转换为字符串
                if (Array.isArray(value)) {
                    return value.join('; ');
                }
                return String(value);
            }
        }

        return '';
    }

    /**
     * 格式化作者显示
     * 最多显示 5 位作者，超过的用省略号表示
     * 例如：
     *   1 位: Smith, J.
     *   2-5 位: Smith, J.; Johnson, A.; ...
     *   超过 5 位: Smith, J.; Johnson, A.; Williams, C.; Brown, D.; Davis, E.; ...
     */
    formatAuthors(authors) {
        if (!authors) return '';

        const authorsStr = String(authors);

        // 分割多个作者（支持分号或逗号分隔）
        // 优先使用分号分割，如果没有分号则使用逗号
        let authorList;
        if (authorsStr.includes(';')) {
            authorList = authorsStr.split(/;\s*/);
        } else {
            // 如果使用逗号分割，需要更智能的处理（避免把名字中的逗号也分割）
            // 简单处理：假设作者之间用逗号+空格分隔
            authorList = authorsStr.split(/,\s+(?=[A-Z])/);
        }

        authorList = authorList.map(a => a.trim()).filter(a => a.length > 0);

        if (authorList.length === 0) return '';
        if (authorList.length === 1) return authorList[0];

        // 最多显示 5 位作者
        const maxAuthors = 5;
        const hasMore = authorList.length > maxAuthors;
        const displayAuthors = authorList.slice(0, maxAuthors);

        // 提取每位作者的姓氏
        const formattedAuthors = displayAuthors.map(author => {
            // 尝试提取姓氏（假设格式为 "LastName, FirstName" 或 "FirstName LastName"）
            const commaMatch = author.match(/^([^,]+),/);
            if (commaMatch) {
                return commaMatch[1].trim();
            }
            // 如果没有逗号，取第一个单词作为姓氏
            const spaceMatch = author.match(/^(\S+)/);
            return spaceMatch ? spaceMatch[1] : author;
        });

        // 如果只有 2 位作者，使用 "A and B" 格式
        if (!hasMore && authorList.length === 2) {
            return `${formattedAuthors[0]} and ${formattedAuthors[1]}`;
        }

        // 多位作者：用逗号连接，最后加省略号（如果有更多）
        let result = formattedAuthors.join(', ');
        if (hasMore) {
            result += ', ...';
        }

        return result;
    }

    /**
     * 获取缓存数据（优先使用内存缓存）
     */
    async getCacheData(forceRefresh = false) {
        if (forceRefresh || !this.memoryCache) {
            // 尝试从 IndexedDB 加载
            const cached = await this.loadFromCache();

            if (!cached || forceRefresh) {
                // 构建新缓存
                return await this.buildCache();
            }

            return cached;
        }

        return this.memoryCache;
    }

    /**
     * 搜索 DOI
     * 在 doi, title, authors, year 四个字段中进行模糊匹配
     * 支持多条件组合查询：空格分隔的多个关键词（AND 逻辑）
     * 例如：'2023 li the' 表示必须同时包含 2023、li 和 the
     */
    async searchDoi(searchText, options = {}) {
        const maxResults = options.maxResults || 20;
        const cacheData = await this.getCacheData();

        if (!cacheData || cacheData.length === 0) {
            return [];
        }

        if (!searchText || searchText.trim() === '') {
            // 返回前 N 条结果
            return cacheData.slice(0, maxResults);
        }

        // 多条件组合查询：用空格分隔多个关键词
        const keywords = searchText
            .toLowerCase()
            .trim()
            .split(/\s+/)  // 按空格分割
            .map(k => k.trim())
            .filter(k => k.length > 0);  // 过滤空关键词

        // 多条件匹配：所有关键词都必须在某个字段中出现（AND 逻辑）
        const matches = cacheData.filter(item => {
            if (keywords.length === 0) return true;

            // 合并所有可搜索字段为一个字符串
            const searchableText = [
                item.doi.toLowerCase(),
                item.title.toLowerCase(),
                item.authors.toLowerCase(),
                item.year.toLowerCase()
            ].join(' ');

            // 所有关键词都必须出现在搜索文本中
            return keywords.every(keyword => searchableText.includes(keyword));
        });

        return matches.slice(0, maxResults);
    }

    /**
     * 清除缓存
     */
    async clearCache() {
        if (!this.db) {
            await this.init();
        }

        const key = this.getProjectCacheKey();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.delete(key);

            request.onsuccess = () => {
                this.memoryCache = null;
                this.lastUpdateTime = null;
                console.log('✓ Cache cleared');
                resolve();
            };

            request.onerror = () => {
                console.error('Failed to clear cache:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * 启动自动更新
     */
    startAutoUpdate() {
        this.stopAutoUpdate();

        this.updateTimer = setInterval(async () => {
            console.log('Auto-updating DOI cache...');
            await this.buildCache({ notify: false });
        }, this.autoUpdateInterval);
    }

    /**
     * 停止自动更新
     */
    stopAutoUpdate() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
    }

    /**
     * 销毁管理器
     */
    destroy() {
        this.stopAutoUpdate();

        if (this.db) {
            this.db.close();
            this.db = null;
        }

        this.memoryCache = null;
        this.cacheKey = null;
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DoiCacheManager;
}
if (typeof window !== 'undefined') {
    window.DoiCacheManager = DoiCacheManager;
}
