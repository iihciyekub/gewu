/**
 * Markdown 编辑器自动补全功能
 * 支持 LaTeX 风格命令补全，从 src/schema/autocomplete-commands.json 加载命令
 */

class AutocompleteManager {
    constructor(textarea, options = {}) {
        this.textarea = textarea;
        this.commands = [];
        this.visible = false;
        this.selectedIndex = 0;
        this.filteredCommands = [];
        this.triggerChar = options.triggerChar || '\\';
        this.minChars = Number.isFinite(options.minChars) ? options.minChars : 1;
        this.maxSuggestions = Number.isFinite(options.maxSuggestions) ? options.maxSuggestions : 10;
        this.pathProvider = options.pathProvider || null;
        this.doiProvider = options.doiProvider || null;
        this.onSelect = typeof options.onSelect === 'function' ? options.onSelect : null;
        this.onConfirm = typeof options.onConfirm === 'function' ? options.onConfirm : null;
        this.activeProvider = null;
        
        // UI 元素
        this.dropdown = null;
        
        // 当前补全状态
        this.completionStart = -1;
        this.completionEnd = -1;
        this.searchText = '';
        
        this.init();
    }
    
    async init() {
        // 加载命令数据
        await this.loadCommands();
        
        // 创建 UI
        this.createDropdown();
        
        // 绑定事件
        this.bindEvents();
    }
    
    async loadCommands(url = '/src/schema/autocomplete-commands.json') {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.warn('Failed to load autocomplete commands');
                return;
            }
            const data = await response.json();
            this.commands = data.commands || [];
            console.log('✓ Loaded', this.commands.length, 'autocomplete commands');
        } catch (error) {
            console.warn('Error loading autocomplete commands:', error);
            // 使用默认命令
            this.commands = this.getDefaultCommands();
        }
    }
    
    getDefaultCommands() {
        return [
            { trigger: '\\cite', label: '\\cite{doi}', insertText: '\\cite{$1}', detail: 'Narrative citation' },
            { trigger: '\\citep', label: '\\citep{doi}', insertText: '\\citep{$1}', detail: 'Parenthetical citation' },
            { trigger: '\\bib', label: '\\bib{doi}', insertText: '\\bib{$1}', detail: 'BibTeX entry' },
            { trigger: '\\doi', label: '\\doi{doi}', insertText: '\\doi{$1}', detail: 'DOI reference' }
        ];
    }
    
    createDropdown() {
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'autocomplete-dropdown';
        this.dropdown.style.display = 'none';
        const header = document.createElement('div');
        header.className = 'autocomplete-header';
        header.innerHTML = `
            <button type="button" class="autocomplete-doi-refresh" title="Refresh DOI cache" aria-label="Refresh DOI cache">
                <i class="fas fa-rotate"></i>
            </button>
        `;
        const list = document.createElement('div');
        list.className = 'autocomplete-list';
        this.dropdown.appendChild(header);
        this.dropdown.appendChild(list);
        this._headerEl = header;
        this._listEl = list;
        document.body.appendChild(this.dropdown);
    }
    
    bindEvents() {
        // 输入事件
        this.textarea.addEventListener('input', (e) => this.onInput(e));
        
        // 键盘事件
        this.textarea.addEventListener('keydown', (e) => this.onKeyDown(e));
        
        // 失焦事件
        this.textarea.addEventListener('blur', () => {
            // 延迟隐藏，允许点击选项
            setTimeout(() => this.hide(), 200);
        });
        
        // 点击外部隐藏
        document.addEventListener('click', (e) => {
            if (this.visible && !this.dropdown.contains(e.target) && e.target !== this.textarea) {
                this.hide();
            }
        });
    }
    
    onInput(e) {
        const cursorPos = this.textarea.selectionStart;
        const text = this.textarea.value;

        // 优先检测 DOI 上下文（在 \cite{}, \citep{}, \bib{} 内）
        const doiContext = this.getDoiContext(text, cursorPos);
        if (doiContext) {
            this.activeProvider = 'doi';
            this.applyCompletionContext(doiContext);
            const suggestions = this.getDoiSuggestions(doiContext);
            this.showSuggestions(suggestions);
            return;
        }

        const commandContext = this.getCommandContext(text, cursorPos);
        if (commandContext) {
            this.activeProvider = 'command';
            this.applyCompletionContext(commandContext);
            const suggestions = this.getCommandSuggestions(commandContext.searchText);
            this.showSuggestions(suggestions);
            return;
        }

        const pathContext = this.getPathContext(text, cursorPos);
        if (pathContext) {
            this.activeProvider = 'path';
            this.applyCompletionContext(pathContext);
            const suggestions = this.getPathSuggestions(pathContext);
            this.showSuggestions(suggestions);
            return;
        }
        this.hide();
    }
    
    onKeyDown(e) {
        if (!this.visible) return;
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.selectNext();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.selectPrevious();
                break;
            case 'Enter':
                if (this.onConfirm && this.onConfirm(this.filteredCommands[this.selectedIndex]) === true) {
                    e.preventDefault();
                    this.hide();
                    this.textarea.focus();
                    break;
                }
                e.preventDefault();
                this.insertSelected();
                break;
            case 'Tab':
                e.preventDefault();
                this.insertSelected();
                break;
            case 'Escape':
                e.preventDefault();
                this.hide();
                break;
        }
    }
    
    filterCommands() {
        const search = this.searchText.toLowerCase();
        
        this.filteredCommands = this.commands
            .filter(cmd => cmd.trigger.toLowerCase().startsWith(search))
            .slice(0, this.maxSuggestions);
        
        this.selectedIndex = 0;
    }

    getCommandContext(text, cursorPos) {
        const beforeCursor = text.substring(0, cursorPos);
        const lastTriggerIndex = beforeCursor.lastIndexOf(this.triggerChar);

        if (lastTriggerIndex === -1) {
            return null;
        }

        const afterTrigger = beforeCursor.substring(lastTriggerIndex + 1);
        if (/[\s\n\r]/.test(afterTrigger)) {
            return null;
        }

        if (afterTrigger.length < this.minChars) {
            return null;
        }

        return {
            completionStart: lastTriggerIndex,
            completionEnd: cursorPos,
            searchText: this.triggerChar + afterTrigger
        };
    }

    getCommandSuggestions(searchText) {
        const search = (searchText || '').toLowerCase();
        return this.limitSuggestions(
            this.commands.filter(cmd => cmd.trigger.toLowerCase().startsWith(search))
        );
    }

    getPathContext(text, cursorPos) {
        if (!this.pathProvider || typeof this.pathProvider.getSuggestions !== 'function') {
            return null;
        }

        const beforeCursor = text.substring(0, cursorPos);
        const match = beforeCursor.match(/(^|[^A-Za-z0-9_.])([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]*)*\.?)$/);
        if (!match) return null;

        const token = match[2] || '';
        if (!token) return null;

        const lastDot = token.lastIndexOf('.');
        const basePath = lastDot >= 0 ? token.slice(0, lastDot) : '';
        const prefix = lastDot >= 0 ? token.slice(lastDot + 1) : token;

        return {
            completionStart: cursorPos - prefix.length,
            completionEnd: cursorPos,
            searchText: prefix,
            basePath,
            prefix
        };
    }

    getPathSuggestions(context) {
        const rawSuggestions = this.pathProvider.getSuggestions(context) || [];
        const suggestions = rawSuggestions.map((item) => {
            if (typeof item === 'string') {
                return { label: item, insertText: item, detail: '' };
            }
            return item;
        });
        return this.limitSuggestions(suggestions);
    }

    /**
     * 检测 DOI 补全上下文
     * 支持 \cite{}, \citep{}, \bib{}, \doi{} 等命令内的 DOI 补全
     */
    getDoiContext(text, cursorPos) {
        if (!this.doiProvider || typeof this.doiProvider.getSuggestions !== 'function') {
            return null;
        }

        const beforeCursor = text.substring(0, cursorPos);

        // 匹配 \cite{...}, \citep{...}, \bib{...}, \doi{...} 等命令
        // 支持多个 DOI 用逗号分隔的情况
        const match = beforeCursor.match(/\\(cite|citep|bib|doi)\{([^}]*)$/);
        if (!match) return null;

        const command = match[1];
        const insideBraces = match[2];

        // 找到最后一个逗号后的内容作为当前输入
        const lastCommaIndex = insideBraces.lastIndexOf(',');
        const afterComma = lastCommaIndex >= 0
            ? insideBraces.substring(lastCommaIndex + 1)
            : insideBraces;

        const currentInput = afterComma.trim();

        // 计算补全起始位置（跳过逗号和前导空格）
        const braceStartIndex = beforeCursor.lastIndexOf('{');
        const leadingSpaces = afterComma.length - afterComma.trimStart().length;

        const completionStart = lastCommaIndex >= 0
            ? braceStartIndex + 1 + lastCommaIndex + 1 + leadingSpaces
            : braceStartIndex + 1 + leadingSpaces;

        return {
            completionStart,
            completionEnd: cursorPos,
            searchText: currentInput,
            command,
            insideBraces
        };
    }

    /**
     * 获取 DOI 建议列表
     */
    getDoiSuggestions(context) {
        const rawSuggestions = this.doiProvider.getSuggestions(context) || [];
        const suggestions = rawSuggestions.map((item) => {
            if (typeof item === 'string') {
                return { label: item, insertText: item, detail: 'DOI' };
            }
            return item;
        });
        return this.limitSuggestions(suggestions);
    }

    limitSuggestions(list) {
        if (!Number.isFinite(this.maxSuggestions) || this.maxSuggestions <= 0) {
            return list;
        }
        return list.slice(0, this.maxSuggestions);
    }

    applyCompletionContext(context) {
        this.completionStart = context.completionStart;
        this.completionEnd = context.completionEnd;
        this.searchText = context.searchText || '';
    }

    showSuggestions(suggestions) {
        this.filteredCommands = suggestions;
        this.selectedIndex = 0;
        if (this.filteredCommands.length > 0) {
            this.show();
        } else {
            this.hide();
        }
    }
    
    show() {
        if (this.filteredCommands.length === 0) return;
        
        this.visible = true;
        this.renderDropdown();
        this.positionDropdown();
        this.dropdown.style.display = 'block';
    }
    
    hide() {
        this.visible = false;
        this.dropdown.style.display = 'none';
    }
    
    renderDropdown() {
        const items = this.filteredCommands.map((cmd, index) => {
            const isSelected = index === this.selectedIndex;
            const label = this.escapeHtml(cmd.label);
            const detail = this.escapeHtml(cmd.detail || '');

            // 检查是否为 DOI 类型的补全项（包含 title 字段）
            const isDoi = cmd.isDoi === true || (cmd.title && cmd.title.length > 0);

            if (isDoi) {
                // DOI 类型：多行显示格式
                // 第一行：DOI
                // 第二行：作者 + 年份
                // 第三行：标题
                const title = this.escapeHtml(cmd.title || '');
                return `
                    <div class="autocomplete-item autocomplete-item-doi ${isSelected ? 'selected' : ''}"
                         data-index="${index}"
                         title="${this.escapeHtml(cmd.documentation || cmd.title || '')}">
                        <div class="autocomplete-doi-container">
                            <div class="autocomplete-doi-main">${label}</div>
                            <div class="autocomplete-doi-meta">${detail}</div>
                            ${title ? `<div class="autocomplete-doi-title">${title}</div>` : ''}
                        </div>
                    </div>
                `;
            } else {
                // 标准类型：单行显示
                return `
                    <div class="autocomplete-item ${isSelected ? 'selected' : ''}"
                         data-index="${index}"
                         title="${this.escapeHtml(cmd.documentation || cmd.detail || '')}">
                        <span class="autocomplete-label">${label}</span>
                        <span class="autocomplete-detail">${detail}</span>
                    </div>
                `;
            }
        }).join('');

        if (this._listEl) {
            this._listEl.innerHTML = items;
        } else {
            this.dropdown.innerHTML = items;
        }

        const showHeader = this.activeProvider === 'doi';
        if (this._headerEl) {
            this._headerEl.style.display = showHeader ? 'flex' : 'none';
        }

        // 绑定点击事件
        this.dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index, 10);
                this.selectedIndex = index;
                this.insertSelected();
            });
        });
        if (this._headerEl) {
            const refreshBtn = this._headerEl.querySelector('.autocomplete-doi-refresh');
            if (refreshBtn && !refreshBtn.dataset.bound) {
                refreshBtn.dataset.bound = 'true';
                refreshBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    refreshBtn.disabled = true;
                    try {
                        if (window.paperStats && typeof window.paperStats.refreshDoiCacheFromUi === 'function') {
                            await window.paperStats.refreshDoiCacheFromUi();
                        } else if (typeof window.refreshDoiCache === 'function') {
                            await window.refreshDoiCache();
                        }
                    } finally {
                        refreshBtn.disabled = false;
                    }
                });
            }
        }
        this.scrollSelectionIntoView();
    }
    
    positionDropdown() {
        // 获取光标位置
        const coords = this.getCaretCoordinates();
        
        const dropdown = this.dropdown;
        const dropdownRect = dropdown.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let left = coords.left;
        let top = coords.top;
        
        // 确保不超出右边界
        if (left + dropdownRect.width > viewportWidth) {
            left = viewportWidth - dropdownRect.width - 10;
        }
        
        // 确保不超出左边界
        if (left < 10) {
            left = 10;
        }
        
        // 确保不超出底部边界
        if (top + dropdownRect.height > viewportHeight) {
            // 显示在光标上方
            top = coords.top - dropdownRect.height - 5;
        }
        
        // 确保不超出顶部边界
        if (top < 10) {
            top = 10;
        }
        
        dropdown.style.left = left + 'px';
        dropdown.style.top = top + 'px';
    }
    
    getCaretCoordinates() {
        const textarea = this.textarea;
        const position = this.completionStart;
        
        // 使用更精确的方法计算光标位置
        const div = document.createElement('div');
        const style = getComputedStyle(textarea);
        
        // 复制所有相关样式
        [
            'boxSizing', 'width', 'height', 'overflowX', 'overflowY',
            'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
            'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
            'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing',
            'lineHeight', 'textAlign', 'textTransform', 'wordSpacing', 'wordBreak',
            'tabSize', 'whiteSpace', 'wordWrap'
        ].forEach(prop => {
            div.style[prop] = style[prop];
        });
        
        div.style.position = 'absolute';
        div.style.visibility = 'hidden';
        div.style.overflow = 'auto';
        div.style.whiteSpace = 'pre-wrap';
        
        document.body.appendChild(div);
        
        // 添加文本到 position 位置
        const textBefore = textarea.value.substring(0, position);
        div.textContent = textBefore;
        
        // 创建一个 span 来标记光标位置
        const span = document.createElement('span');
        span.textContent = '|'; // 光标标记
        div.appendChild(span);
        
        const rect = textarea.getBoundingClientRect();
        const spanRect = span.getBoundingClientRect();
        
        // 考虑 textarea 的滚动
        const left = rect.left + spanRect.left - div.getBoundingClientRect().left + textarea.scrollLeft;
        const top = rect.top + spanRect.top - div.getBoundingClientRect().top - textarea.scrollTop + 20; // 20px offset
        
        document.body.removeChild(div);
        
        return { left, top };
    }
    
    selectNext() {
        this.selectedIndex = (this.selectedIndex + 1) % this.filteredCommands.length;
        this.renderDropdown();
        this.scrollSelectionIntoView();
    }
    
    selectPrevious() {
        this.selectedIndex = (this.selectedIndex - 1 + this.filteredCommands.length) % this.filteredCommands.length;
        this.renderDropdown();
        this.scrollSelectionIntoView();
    }

    scrollSelectionIntoView() {
        if (!this.dropdown) return;
        const selected = this.dropdown.querySelector('.autocomplete-item.selected');
        if (!selected) return;
        const list = this.dropdown;
        const itemTop = selected.offsetTop;
        const itemBottom = itemTop + selected.offsetHeight;
        const viewTop = list.scrollTop;
        const viewBottom = viewTop + list.clientHeight;
        if (itemTop < viewTop) {
            list.scrollTop = itemTop;
        } else if (itemBottom > viewBottom) {
            list.scrollTop = itemBottom - list.clientHeight;
        }
    }
    
    insertSelected() {
        if (!this.visible || this.filteredCommands.length === 0) return;
        
        const selected = this.filteredCommands[this.selectedIndex];
        if (!selected) return;

        if (this.onSelect && this.onSelect(selected) === true) {
            this.hide();
            this.textarea.focus();
            return;
        }
        
        const text = this.textarea.value;
        const before = text.substring(0, this.completionStart);
        const after = text.substring(this.completionEnd);
        
        // 处理插入文本中的占位符 $1, $2 等
        let insertText = selected.insertText;
        let cursorOffset = insertText.length;
        
        // 找到第一个占位符位置
        const placeholderMatch = insertText.match(/\$(\d+)/);
        if (placeholderMatch) {
            cursorOffset = insertText.indexOf(placeholderMatch[0]);
            // 移除所有占位符
            insertText = insertText.replace(/\$\d+/g, '');
        }
        
        // 插入文本
        this.textarea.value = before + insertText + after;
        
        // 设置光标位置
        const newCursorPos = this.completionStart + cursorOffset;
        this.textarea.selectionStart = newCursorPos;
        this.textarea.selectionEnd = newCursorPos;
        
        // 触发 input 事件以更新应用状态
        this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
        
        this.hide();
        this.textarea.focus();
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    destroy() {
        if (this.dropdown && this.dropdown.parentNode) {
            this.dropdown.parentNode.removeChild(this.dropdown);
        }
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AutocompleteManager;
}
if (typeof window !== 'undefined') {
    window.AutocompleteManager = AutocompleteManager;
}
