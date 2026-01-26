/**
 * 特殊语法管理器
 * 统一管理 cite{}, citep{}, bib{}, goto{}, groupby{}{} 等特殊文本组合
 * 方便扩展、维护、增加和删除
 */

class SpecialSyntaxManager {
    constructor(app) {
        this.app = app;
        
        // 注册所有支持的语法类型
        // 仅支持 LaTeX 标准格式：\cite{} \citep{} \bib{} \goto{} \groupby{}{}
        this.syntaxTypes = {
            'cite': {
                pattern: /\\cite\{([^}]+)\}/g,
                description: 'Narrative citation (LaTeX style)',
                renderer: (matches, fullMatch) => this.renderCitation(matches, 'cite', fullMatch)
            },
            'citep': {
                pattern: /\\citep\{([^}]+)\}/g,
                description: 'Parenthetical citation (LaTeX style)',
                renderer: (matches, fullMatch) => this.renderCitation(matches, 'citep', fullMatch)
            },
            'bib': {
                pattern: /\\bib\{([^}]+)\}/g,
                description: 'Bibliography entry (BibTeX format, on-demand)',
                renderer: (matches, fullMatch) => this.renderBibliography(matches, fullMatch)
            },
            'goto': {
                pattern: /\\goto\{([\s\S]*?)\}/g,
                description: 'PDF jump link',
                renderer: (matches, fullMatch) => this.renderGotoLink(matches, fullMatch)
            },
            'groupby': {
                pattern: /\\groupby\{[\s\S]*?\}\{[\s\S]*?\}/g,
                description: 'Group by fields table',
                renderer: (matches, fullMatch) => this.renderGroupBy(matches, fullMatch)
            },
            'doi': {
                pattern: /\\doi\{([^}]+)\}/g,
                description: 'DOI link to publisher',
                renderer: (matches, fullMatch) => this.renderDoiLink(matches, fullMatch)
            }
        };
        
        // 缓存管理
        this.renderCache = {}; // {syntaxType: {key: result}}
    }
    
    /**
     * 获取所有注册的语法类型
     */
    getSyntaxTypes() {
        return Object.keys(this.syntaxTypes);
    }
    
    /**
     * 添加新的语法类型
     */
    registerSyntax(name, config) {
        if (this.syntaxTypes[name]) {
            console.warn(`Syntax type "${name}" already exists, overwriting...`);
        }
        this.syntaxTypes[name] = config;
    }
    
    /**
     * 移除语法类型
     */
    unregisterSyntax(name) {
        delete this.syntaxTypes[name];
        delete this.renderCache[name];
    }
    
    /**
     * 检测文本中是否包含任何特殊语法
     */
    hasAnySyntax(text) {
        if (!text) return false;
        return this.getSyntaxTypes().some(type => {
            const syntax = this.syntaxTypes[type];
            return syntax.pattern.test(text);
        });
    }
    
    /**
     * 检测文本中包含哪些特殊语法
     */
    detectSyntaxTypes(text) {
        if (!text) return [];
        const types = [];
        this.getSyntaxTypes().forEach(type => {
            const syntax = this.syntaxTypes[type];
            const pattern = new RegExp(syntax.pattern.source, syntax.pattern.flags);
            if (pattern.test(text)) {
                types.push(type);
            }
        });
        return types;
    }
    
    /**
     * 提取特定语法类型的所有匹配项
     */
    extractMatches(text, syntaxType) {
        if (!text || !this.syntaxTypes[syntaxType]) return [];
        
        const syntax = this.syntaxTypes[syntaxType];
        const pattern = new RegExp(syntax.pattern.source, syntax.pattern.flags);
        const matches = [];
        let match;
        
        while ((match = pattern.exec(text)) !== null) {
            matches.push({
                fullMatch: match[0],
                content: match[1],
                index: match.index
            });
        }
        
        return matches;
    }
    
    /**
     * 渲染文本中的所有特殊语法（用于 markdown 或普通文本）
     */
    renderAllSyntax(text, options = {}) {
        if (!text) return text;
        
        let result = text;
        const types = options.types || this.getSyntaxTypes();
        
        // 按顺序处理每种语法类型
        types.forEach(type => {
            if (!this.syntaxTypes[type]) return;
            result = this.renderSyntaxType(result, type, options);
        });
        
        return result;
    }
    
    /**
     * 渲染特定类型的语法
     */
    renderSyntaxType(text, syntaxType, options = {}) {
        if (!text || !this.syntaxTypes[syntaxType]) return text;
        
        const syntax = this.syntaxTypes[syntaxType];
        const pattern = new RegExp(syntax.pattern.source, syntax.pattern.flags);
        let result = '';
        let lastIndex = 0;
        let match;
        
        while ((match = pattern.exec(text)) !== null) {
            // 添加匹配前的文本
            result += text.slice(lastIndex, match.index);
            
            // 渲染匹配的语法
            const content = match[1];
            const rendered = syntax.renderer(content, match[0], options);
            result += rendered;
            
            lastIndex = pattern.lastIndex;
        }
        
        // 添加剩余文本
        result += text.slice(lastIndex);
        
        return result;
    }
    
    /**
     * 渲染引用 (cite/citep)
     */
    renderCitation(content, type, fullMatch) {
        const dois = content.split(/[,，;]+/).map(d => d.trim()).filter(Boolean);
        const normalized = dois.map(d => this.app.normalizeDoiString(d)).filter(Boolean);
        
        if (!normalized.length) {
            return this.app.escapeHtml(fullMatch);
        }
        
        // 返回占位符，后续由 applyCitationRendering 异步渲染
        return this.app.renderCitationPlaceholder(normalized, type);
    }
    
    /**
     * 渲染参考文献条目 (bib)
     */
    renderBibliography(content, fullMatch) {
        const dois = content.split(/[,，;]+/).map(d => d.trim()).filter(Boolean);
        const normalized = dois.map(d => this.app.normalizeDoiString(d)).filter(Boolean);
        
        if (!normalized.length) {
            return this.app.escapeHtml(fullMatch);
        }
        
        // 返回占位符，后续由 applyBibliographyRendering 异步渲染
        const escDois = this.app.escapeHtml(normalized.join(','));
        const escLabel = this.app.escapeHtml(normalized.join('; '));
        return `<span class="bibliography-inline" data-bib-dois="${escDois}">[${escLabel}]</span>`;
    }
    
    /**
     * 渲染跳转链接 (goto)
     */
    renderGotoLink(content, fullMatch) {
        const query = content.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
        if (!query) {
            return this.app.escapeHtml(fullMatch);
        }
        
        const escQuery = this.app.escapeAttr(query);
        return `<a href="#" class="location-link goto-link" data-page="" data-quote-text="${escQuery}" data-open-params="" data-quote-index="0" data-value-path="" title="跳转PDF搜索"><i class="fa-solid fa-quote-right"></i></a>`;
    }

    /**
     * 渲染 groupby 表格占位 (groupby)
     */
    renderGroupBy(_content, fullMatch) {
        const match = fullMatch.match(/\\groupby\{([\s\S]*?)\}\{([\s\S]*?)\}/);
        if (!match) {
            return this.app.escapeHtml(fullMatch);
        }
        const groups = match[1];
        const fields = match[2];
        if (!String(fields || '').trim()) {
            return this.app.escapeHtml(fullMatch);
        }
        if (typeof this.app.renderGroupByPlaceholder === 'function') {
            return this.app.renderGroupByPlaceholder(groups, fields);
        }
        return this.app.escapeHtml(fullMatch);
    }
    
    /**
     * 渲染 DOI 链接 (doi)
     */
    renderDoiLink(content, fullMatch) {
        const doi = content.trim();
        if (!doi) {
            return this.app.escapeHtml(fullMatch);
        }
        
        const escDoi = this.app.escapeHtml(doi);
        const doiUrl = `https://doi.org/${encodeURIComponent(doi)}`;
        return `<a href="${doiUrl}" target="_blank" class="doi-link" title="Open DOI: ${escDoi}"><i class="fa-solid fa-external-link-alt"></i> ${escDoi}</a>`;
    }
    
    /**
     * 清除特定类型的缓存
     */
    clearCache(syntaxType = null) {
        if (syntaxType) {
            delete this.renderCache[syntaxType];
        } else {
            this.renderCache = {};
        }
    }
    
    /**
     * 更新文本中的特定语法内容
     */
    updateSyntaxContent(text, syntaxType, oldContent, newContent, targetIndex = 0) {
        if (!text || !this.syntaxTypes[syntaxType]) return text;
        
        const syntax = this.syntaxTypes[syntaxType];
        const pattern = new RegExp(syntax.pattern.source, syntax.pattern.flags);
        let count = 0;
        
        return text.replace(pattern, (match, content) => {
            if (count === targetIndex && (!oldContent || content === oldContent)) {
                count++;
                return `${syntaxType}{${newContent}}`;
            }
            count++;
            return match;
        });
    }
}

// 导出供全局使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpecialSyntaxManager;
}
if (typeof window !== 'undefined') {
    window.SpecialSyntaxManager = SpecialSyntaxManager;
}
