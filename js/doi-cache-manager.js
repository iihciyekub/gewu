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
        this.dbName = 'EnlightenKeyDoiCache';
        this.dbVersion = 1;
        this.storeName = 'doiData';
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
                    this.memoryCache = result.data;
                    this.lastUpdateTime = result.timestamp;
                    console.log(`✓ Loaded ${result.data.length} DOI entries from cache`);
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
     */
    async saveToCache(data) {
        if (!this.db) {
            await this.init();
        }

        const key = this.getProjectCacheKey();
        const cacheEntry = {
            projectKey: key,
            data: data,
            timestamp: Date.now()
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.put(cacheEntry);

            request.onsuccess = () => {
                this.memoryCache = data;
                this.lastUpdateTime = cacheEntry.timestamp;
                console.log(`✓ Saved ${data.length} DOI entries to cache`);
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
                const authors = this.extractField(data, ['wos_data.authors', 'meta_info.authors', 'authors', 'AF', 'AU']);

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
     * 例如：Smith, J.; Johnson, A. => Smith et al.
     */
    formatAuthors(authors) {
        if (!authors) return '';

        const authorsStr = String(authors);

        // 分割多个作者
        const authorList = authorsStr.split(/[;,]\s*/);

        if (authorList.length === 0) return '';
        if (authorList.length === 1) return authorList[0];

        // 提取第一作者的姓氏
        const firstAuthor = authorList[0].trim();
        const lastNameMatch = firstAuthor.match(/^([^,\s]+)/);
        const lastName = lastNameMatch ? lastNameMatch[1] : firstAuthor.split(/\s+/)[0];

        return `${lastName} et al.`;
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

        const search = searchText.toLowerCase().trim();

        // 模糊匹配：任一字段包含搜索文本即匹配
        const matches = cacheData.filter(item => {
            return item.doi.toLowerCase().includes(search) ||
                   item.title.toLowerCase().includes(search) ||
                   item.authors.toLowerCase().includes(search) ||
                   item.year.toLowerCase().includes(search);
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
