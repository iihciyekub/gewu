/**
 * 项目本地存储管理器
 * 替代 localStorage，将配置和缓存保存到用户项目目录的 .locstorage 文件夹
 */

class ProjectStorageManager {
    constructor(app) {
        this.app = app;
        this.storageDir = '.locstorage';
        this.cache = {}; // 内存缓存
        this.dirty = new Set(); // 需要保存的文件名
        this.saveTimer = null;
        
        // 定义各类存储文件
        this.storageFiles = {
            'citation-meta': 'citation-meta.json',
            'project-config': 'project-config.json',
            'qa-states': 'qa-states.json',
            'section-states': 'section-states.json',
            'prompt-config': 'prompt-config.json',
            'ui-preferences': 'ui-preferences.json',
            'file-filter-history': 'file-filter-history.json'
        };
    }
    
    /**
     * 获取存储目录路径
     */
    getStoragePath() {
        if (!this.app.currentProject || !this.app.currentProject.path) {
            return null;
        }
        return `${this.app.currentProject.path}/${this.storageDir}`;
    }
    
    /**
     * 确保存储目录存在
     */
    async ensureStorageDir() {
        const storagePath = this.getStoragePath();
        if (!storagePath) {
            throw new Error('No project loaded');
        }
        
        try {
            const response = await fetch('/ensure-dir', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: storagePath })
            });
            
            if (!response.ok) {
                throw new Error(`Failed to create storage directory: ${response.statusText}`);
            }
            
            return true;
        } catch (error) {
            console.error('Failed to ensure storage directory:', error);
            throw error;
        }
    }
    
    /**
     * 加载指定的存储文件
     */
    async load(key) {
        // 检查内存缓存
        if (this.cache[key] !== undefined) {
            return this.cache[key];
        }
        
        const storagePath = this.getStoragePath();
        if (!storagePath) {
            console.warn('No project loaded, returning empty data for', key);
            return null;
        }
        
        const filename = this.storageFiles[key];
        if (!filename) {
            console.warn('Unknown storage key:', key);
            return null;
        }
        
        const filePath = `${storagePath}/${filename}`;
        
        try {
            const response = await fetch(`/read-json?file=${encodeURIComponent(filePath)}`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    // 文件不存在，返回空数据
                    this.cache[key] = null;
                    return null;
                }
                throw new Error(`Failed to load ${key}: ${response.statusText}`);
            }
            
            const data = await response.json();
            this.cache[key] = data;
            return data;
        } catch (error) {
            console.warn(`Failed to load ${key}:`, error);
            this.cache[key] = null;
            return null;
        }
    }
    
    /**
     * 保存指定的存储文件
     */
    async save(key, data) {
        const storagePath = this.getStoragePath();
        if (!storagePath) {
            console.warn('No project loaded, cannot save', key);
            return false;
        }
        
        const filename = this.storageFiles[key];
        if (!filename) {
            console.warn('Unknown storage key:', key);
            return false;
        }
        
        // 更新内存缓存
        this.cache[key] = data;
        
        try {
            // 确保目录存在
            await this.ensureStorageDir();
            
            const filePath = `${storagePath}/${filename}`;
            const response = await fetch('/save-json-api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    file: filePath,
                    data: data
                })
            });
            
            if (!response.ok) {
                throw new Error(`Failed to save ${key}: ${response.statusText}`);
            }
            
            return true;
        } catch (error) {
            console.error(`Failed to save ${key}:`, error);
            return false;
        }
    }
    
    /**
     * 标记为需要保存（延迟保存）
     */
    markDirty(key) {
        this.dirty.add(key);
        
        // 取消之前的定时器
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }
        
        // 1秒后自动保存
        this.saveTimer = setTimeout(() => {
            this.flushDirty();
        }, 1000);
    }
    
    /**
     * 立即保存所有标记为 dirty 的数据
     */
    async flushDirty() {
        const keys = Array.from(this.dirty);
        this.dirty.clear();
        
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
        
        const promises = keys.map(key => {
            const data = this.cache[key];
            if (data !== undefined) {
                return this.save(key, data);
            }
        });
        
        await Promise.allSettled(promises);
    }
    
    /**
     * 更新数据（先更新缓存，然后标记为 dirty）
     */
    update(key, data) {
        this.cache[key] = data;
        this.markDirty(key);
    }
    
    /**
     * 删除指定的存储文件
     */
    async delete(key) {
        const storagePath = this.getStoragePath();
        if (!storagePath) {
            console.warn('No project loaded, cannot delete', key);
            return false;
        }
        
        const filename = this.storageFiles[key];
        if (!filename) {
            console.warn('Unknown storage key:', key);
            return false;
        }
        
        delete this.cache[key];
        this.dirty.delete(key);
        
        try {
            const filePath = `${storagePath}/${filename}`;
            const response = await fetch('/delete-file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file: filePath })
            });
            
            if (!response.ok && response.status !== 404) {
                throw new Error(`Failed to delete ${key}: ${response.statusText}`);
            }
            
            return true;
        } catch (error) {
            console.error(`Failed to delete ${key}:`, error);
            return false;
        }
    }
    
    /**
     * 清空内存缓存
     */
    clearCache() {
        this.cache = {};
        this.dirty.clear();
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
    }
    
    /**
     * 从 localStorage 迁移数据到项目目录
     */
    async migrateFromLocalStorage() {
        if (!this.getStoragePath()) {
            console.warn('No project loaded, cannot migrate');
            return;
        }
        
        console.log('Starting migration from localStorage to project storage...');
        const projectKey = this.app?.getProjectKey ? this.app.getProjectKey() : null;
        const pickProjectEntry = (raw) => {
            if (!raw || !projectKey) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return null;
            return parsed[projectKey] ?? null;
        };
        
        try {
            // 迁移 citation metadata
            const citationMeta = localStorage.getItem('paperReviewerCitationMeta');
            if (citationMeta) {
                try {
                    const data = JSON.parse(citationMeta);
                    await this.save('citation-meta', data);
                    console.log('Migrated citation metadata');
                } catch (e) {
                    console.error('Failed to migrate citation metadata:', e);
                }
            }
            
            // 迁移项目配置
            const projectConfig = localStorage.getItem('reviewerProjectConfig');
            if (projectConfig) {
                try {
                    const data = JSON.parse(projectConfig);
                    await this.save('project-config', data);
                    console.log('Migrated project config');
                } catch (e) {
                    console.error('Failed to migrate project config:', e);
                }
            }
            
            // 迁移 QA 状态
            const qaStates = localStorage.getItem('qaCollapsedStateByProject');
            if (qaStates) {
                try {
                    const data = pickProjectEntry(qaStates);
                    if (data) {
                        await this.save('qa-states', data);
                        console.log('Migrated QA states');
                    }
                } catch (e) {
                    console.error('Failed to migrate QA states:', e);
                }
            }
            
            // 迁移 section 状态
            const sectionStates = localStorage.getItem('sectionExpandedStateByProject');
            if (sectionStates) {
                try {
                    const data = pickProjectEntry(sectionStates);
                    if (data) {
                        await this.save('section-states', data);
                        console.log('Migrated section states');
                    }
                } catch (e) {
                    console.error('Failed to migrate section states:', e);
                }
            }
            
            // 迁移 UI 首选项
            const uiPreferences = {
                theme: localStorage.getItem('reviewerTheme'),
                lastViewMode: localStorage.getItem('lastViewMode'),
                editLocked: localStorage.getItem('reviewerEditLocked'),
                debug: localStorage.getItem('paperReviewerDebug'),
                lastJsonView: null,
                lastSelectedFile: null
            };
            
            const lastJsonView = localStorage.getItem('lastJsonViewByProject');
            if (lastJsonView) {
                try {
                    uiPreferences.lastJsonView = pickProjectEntry(lastJsonView);
                } catch (e) {
                    console.error('Failed to parse last JSON view:', e);
                }
            }
            
            const lastSelectedFile = localStorage.getItem('lastSelectedFileByProject');
            if (lastSelectedFile) {
                try {
                    uiPreferences.lastSelectedFile = pickProjectEntry(lastSelectedFile);
                } catch (e) {
                    console.error('Failed to parse last selected file:', e);
                }
            }
            
            await this.save('ui-preferences', uiPreferences);
            console.log('Migrated UI preferences');
            
            console.log('Migration completed successfully');
        } catch (error) {
            console.error('Migration failed:', error);
        }
    }
}

// 导出供全局使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProjectStorageManager;
}
if (typeof window !== 'undefined') {
    window.ProjectStorageManager = ProjectStorageManager;
}
