/**
 * Markdown 编辑器自动补全功能
 * 支持 LaTeX 风格命令补全，从 src/schema/code.json 加载命令
 */

class AutocompleteManager {
    constructor(textarea, options = {}) {
        this.textarea = textarea;
        this.commands = [];
        this.visible = false;
        this.selectedIndex = 0;
        this.filteredCommands = [];
        this.triggerChar = options.triggerChar || '\\';
        this.minChars = options.minChars || 1;
        this.maxSuggestions = options.maxSuggestions || 10;
        
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
    
    async loadCommands(url = '/src/schema/code.json') {
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
            { trigger: '\\bib', label: '\\bib{doi}', insertText: '\\bib{$1}', detail: 'BibTeX entry' }
        ];
    }
    
    createDropdown() {
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'autocomplete-dropdown';
        this.dropdown.style.display = 'none';
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
        
        // 查找触发字符
        const beforeCursor = text.substring(0, cursorPos);
        const lastTriggerIndex = beforeCursor.lastIndexOf(this.triggerChar);
        
        if (lastTriggerIndex === -1) {
            this.hide();
            return;
        }
        
        // 检查触发字符后是否有空白或其他特殊字符
        const afterTrigger = beforeCursor.substring(lastTriggerIndex + 1);
        if (/[\s\n\r]/.test(afterTrigger)) {
            this.hide();
            return;
        }
        
        // 更新补全状态
        this.completionStart = lastTriggerIndex;
        this.completionEnd = cursorPos;
        this.searchText = this.triggerChar + afterTrigger;
        
        // 过滤命令
        this.filterCommands();
        
        if (this.filteredCommands.length > 0) {
            this.show();
        } else {
            this.hide();
        }
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
            return `
                <div class="autocomplete-item ${isSelected ? 'selected' : ''}" 
                     data-index="${index}"
                     title="${this.escapeHtml(cmd.documentation || cmd.detail || '')}">
                    <span class="autocomplete-label">${label}</span>
                    <span class="autocomplete-detail">${detail}</span>
                </div>
            `;
        }).join('');
        
        this.dropdown.innerHTML = items;
        
        // 绑定点击事件
        this.dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index, 10);
                this.selectedIndex = index;
                this.insertSelected();
            });
        });
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
    }
    
    selectPrevious() {
        this.selectedIndex = (this.selectedIndex - 1 + this.filteredCommands.length) % this.filteredCommands.length;
        this.renderDropdown();
    }
    
    insertSelected() {
        if (!this.visible || this.filteredCommands.length === 0) return;
        
        const selected = this.filteredCommands[this.selectedIndex];
        if (!selected) return;
        
        const text = this.textarea.value;
        const before = text.substring(0, this.completionStart);
        const after = text.substring(this.completionEnd);
        
        // 处理插入文本中的占位符 $1, $2 等
        let insertText = selected.insertText;
        let cursorOffset = 0;
        
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
