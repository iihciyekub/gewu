/**
 * MD Chat Query Module
 * Handles field queries in the markdown chat panel
 * Provides methods for querying, formatting, and displaying field values from JSON data
 */

(() => {
    if (typeof window === 'undefined') return;

    const attachMdChatQuery = () => {
        const proto = window.PaperStatsApp?.prototype
            || (window.paperStats ? Object.getPrototypeOf(window.paperStats) : null);
        if (!proto || proto.__mdChatQueryAttached) return false;
        proto.__mdChatQueryAttached = true;

        /**
         * Add a field to the chat query
         * @param {string} field - Field name/path to add
         */
        proto.addMdChatQueryField = function (field) {
            const name = (field || '').trim();
            if (!name) return;
            if (!this.mdChatQueryFields) this.mdChatQueryFields = new Set();
            this.mdChatQueryFields.add(name);
            this.renderMdChatQueryChips();
            this.runMdChatFieldQuery();
        };

        /**
         * Remove a field from the chat query
         * @param {string} field - Field name/path to remove
         */
        proto.removeMdChatQueryField = function (field) {
            if (!this.mdChatQueryFields) return;
            this.mdChatQueryFields.delete(field);
            this.renderMdChatQueryChips();
            this.runMdChatFieldQuery();
        };

        /**
         * Render the query field chips/tags in the chat panel
         */
        proto.renderMdChatQueryChips = function () {
            const panel = document.getElementById('mdChatPanel');
            const chipRow = panel?.querySelector('.md-chat-field-chips');
            if (!chipRow) return;
            chipRow.innerHTML = '';
            const fields = Array.from(this.mdChatQueryFields || []);
            if (!fields.length) {
                chipRow.innerHTML = '<span class="md-chat-chip-hint">Enter field and press Enter to add</span>';
                return;
            }
            fields.forEach((field) => {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'md-chat-chip';
                chip.innerHTML = `<span>${this.escapeHtml(field)}</span><i class="fas fa-times"></i>`;
                chip.addEventListener('click', () => this.removeMdChatQueryField(field));
                chipRow.appendChild(chip);
            });
        };

        /**
         * Resolve field values from data using dot notation
         * Supports array traversal with fieldPath[] syntax
         * @param {object} data - The data object to query
         * @param {string} fieldPath - The field path (e.g., "authors[]" or "publication.title")
         * @returns {array} Array of resolved values
         */
        proto.resolveMdChatFieldValues = function (data, fieldPath) {
            if (!data || !fieldPath) return [];
            const segments = String(fieldPath).split('.').filter(Boolean);
            const walk = (node, idx) => {
                if (idx >= segments.length) return [node];
                if (!node || typeof node !== 'object') return [];
                const raw = segments[idx];
                const isArraySeg = raw.endsWith('[]');
                const key = isArraySeg ? raw.slice(0, -2) : raw;
                if (!Object.prototype.hasOwnProperty.call(node, key)) return [];
                const nextVal = node[key];
                if (isArraySeg) {
                    const arr = Array.isArray(nextVal) ? nextVal : [nextVal];
                    const out = [];
                    arr.forEach(item => out.push(...walk(item, idx + 1)));
                    return out;
                }
                return walk(nextVal, idx + 1);
            };
            return walk(data, 0).filter(v => v !== undefined && v !== null);
        };

        /**
         * Format a value for display, with special handling for object lists
         * Generates structured, paragraph-formatted text for dicts and arrays
         * @param {*} value - The value to format
         * @returns {string} Formatted value with structure
         */
        proto.formatMdChatValue = function (value) {
            if (value === null || value === undefined) return '';
            
            if (Array.isArray(value)) {
                // Empty array
                if (value.length === 0) return '';
                
                // Check if array contains objects (object list type)
                if (typeof value[0] === 'object' && value[0] !== null) {
                    // For object arrays, check if should use structured format
                    // If objects have multiple fields, use structured format
                    const firstObj = value[0];
                    const objFieldCount = Object.keys(firstObj).length;
                    
                    if (objFieldCount > 3) {
                        // Complex objects - use structured list format
                        return value.map((item, idx) => this.formatStructuredObject(item)).join('\n\n');
                    } else {
                        // Simple objects - use inline format
                        return value.map(item => this.formatObjectListItem(item)).filter(Boolean).join('; ');
                    }
                }
                
                // For simple value arrays, format each value recursively
                return value.map(v => this.formatMdChatValue(v)).filter(Boolean).join('; ');
            }
            
            if (typeof value === 'object') {
                // Complex object (dictionary) - use structured format
                return this.formatStructuredObject(value);
            }
            
            return String(value);
        };

        /**
         * Format a complex object/dictionary with structure
         * Displays as key-value pairs with hierarchy
         * @param {object} obj - The object to format
         * @returns {string} Structured text representation
         */
        proto.formatStructuredObject = function (obj) {
            if (!obj || typeof obj !== 'object') return '';
            
            const lines = [];
            
            Object.entries(obj).forEach(([key, value]) => {
                if (value === null || value === undefined) return;
                
                const keyStr = String(key);
                let valueStr = '';
                
                if (Array.isArray(value)) {
                    if (value.length === 0) {
                        valueStr = '[]';
                    } else if (typeof value[0] === 'object' && value[0] !== null) {
                        // Array of objects - compact format
                        valueStr = `[${value.map(v => this.formatObjectListItem(v)).filter(Boolean).join(', ')}]`;
                    } else {
                        // Simple array
                        valueStr = `[${value.map(v => String(v)).join(', ')}]`;
                    }
                } else if (typeof value === 'object') {
                    // Nested object - recursive compact format
                    try {
                        valueStr = JSON.stringify(value);
                    } catch (_) {
                        valueStr = String(value);
                    }
                } else {
                    valueStr = String(value);
                }
                
                // Format as: key: value
                if (valueStr) {
                    lines.push(`${keyStr}: ${valueStr}`);
                }
            });
            
            return lines.join('\n');
        };

        /**
         * Format an object from an object list by extracting meaningful fields
         * @param {object} obj - The object to format
         * @returns {string} Formatted object representation
         */
        proto.formatObjectListItem = function (obj) {
            if (!obj || typeof obj !== 'object') return '';

            // Priority order: try to extract meaningful identifiers/names from the object
            const priorityFields = ['id', 'name', 'title', 'label', 'value', 'text', 'display'];

            // Try to find first non-empty field in priority order
            for (const field of priorityFields) {
                if (Object.prototype.hasOwnProperty.call(obj, field)) {
                    const val = obj[field];
                    if (val !== null && val !== undefined) {
                        const str = String(val).trim();
                        if (str) return str;
                    }
                }
            }

            // If no priority field found, try to extract all values
            const values = Object.values(obj)
                .filter(v => v !== null && v !== undefined && typeof v !== 'object')
                .map(v => String(v).trim())
                .filter(v => v);

            if (values.length > 0) {
                // Join first few values with comma (max 3)
                return values.slice(0, 3).join(', ');
            }

            // Fallback: return string representation
            return String(obj);
        };

        /**
         * Execute field query and display results in chat panel
         * Queries all fields in mdChatQueryFields and renders results
         */
        proto.runMdChatFieldQuery = function () {
            const body = this._mdChatBody || document.querySelector('#mdChatPanel .md-chat-body');
            if (!body) return;
            const fields = Array.from(this.mdChatQueryFields || []);
            if (!fields.length) {
                body.innerHTML = '<div class="md-chat-query-empty">No query fields yet.</div>';
                return;
            }
            if (!this.currentData) {
                body.innerHTML = '<div class="md-chat-query-empty">No JSON loaded.</div>';
                return;
            }
            const base = this.currentFileBase || this.currentFile || '';
            const viewSelect = document.getElementById('jsonViewSelect');
            const view = (viewSelect && viewSelect.value) ? viewSelect.value : (this.currentJsonView || this.currentView || 'structured');
            const blocks = fields.map((field) => {
                const values = this.resolveMdChatFieldValues(this.currentData, field);
                const text = values.length ? values.map(v => this.formatMdChatValue(v)).filter(Boolean).join('\n') : '(not found)';
                const rendered = text === '(not found)' ? this.escapeHtml(text) : this.renderGotoLinks(text, field);
                return `
                <div class="md-chat-query-block">
                    <div class="md-chat-query-title">${this.escapeHtml(field)}</div>
                    <div class="md-chat-query-value">${rendered}</div>
                </div>
            `;
            }).join('');
            body.innerHTML = blocks;
            const meta = this.ensureMdChatMetaEl();
            if (meta) {
                meta.textContent = `File: ${base} · View: ${view}`;
                meta.title = meta.textContent;
            }
        };

        /**
         * Ensure the metadata element exists in the chat panel
         * @returns {HTMLElement|null} The metadata element
         */
        proto.ensureMdChatMetaEl = function () {
            const panel = document.getElementById('mdChatPanel');
            const top = panel?.querySelector('.md-chat-top');
            if (!panel || !top) return null;
            let meta = top.querySelector('.md-chat-query-meta');
            if (!meta) {
                meta = document.createElement('div');
                meta.className = 'md-chat-query-meta';
                top.insertBefore(meta, top.firstChild);
            }
            return meta;
        };
    };

    // Auto-attach when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachMdChatQuery);
    } else {
        attachMdChatQuery();
    }
})();
