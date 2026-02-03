/**
 * AutoSaveConfigUI - Auto Save Configuration Interface
 * Provides a user-friendly configuration interface
 */

class AutoSaveConfigUI {
    constructor(autoSaveManager) {
        this.manager = autoSaveManager;
        this.panel = null;
        this.overlay = null;
        this.isInlineMode = false; // Inline mode flag
        this.containerElement = null; // Container element for inline mode
    }

    /**
     * Show configuration panel (modal mode)
     */
    show() {
        if (this.isInlineMode) {
            // Inline mode, no need for show/hide operations
            return;
        }

        if (this.panel) {
            this.panel.style.display = 'block';
            this.overlay.style.display = 'block';
            return;
        }

        this.createPanel();
        this.loadCurrentSettings();
    }

    /**
     * Hide configuration panel (modal mode)
     */
    hide() {
        if (this.isInlineMode) {
            // Inline mode, no need for hide operations
            return;
        }

        if (this.panel) {
            this.panel.style.display = 'none';
            this.overlay.style.display = 'none';
        }
    }

    /**
     * Create inline configuration content (without modal)
     */
    createInlineContent() {
        const content = document.createElement('div');
        content.className = 'auto-save-config-content';
        content.innerHTML = `
            <!-- Mode Selection -->
            <div class="auto-save-config-section">
                <label for="autoSaveMode">Save Mode</label>
                <select id="autoSaveMode">
                    <option value="off">Disable Auto Save</option>
                    <option value="afterDelay">Save After Delay</option>
                    <option value="onFocusChange">Save on Focus Change</option>
                    <option value="onWindowChange">Save on Window Change</option>
                </select>

                <div class="auto-save-mode-options">
                    <dl>
                        <dt data-mode="off">Disable Auto Save</dt>
                        <dd data-mode="off">Manually save all changes</dd>

                        <dt data-mode="afterDelay">Save After Delay</dt>
                        <dd data-mode="afterDelay">Auto save after a period of inactivity (Recommended)</dd>

                        <dt data-mode="onFocusChange">Save on Focus Change</dt>
                        <dd data-mode="onFocusChange">Auto save when leaving the editor</dd>

                        <dt data-mode="onWindowChange">Save on Window Change</dt>
                        <dd data-mode="onWindowChange">Auto save when switching to other applications</dd>
                    </dl>
                </div>
            </div>

            <!-- Delay Time -->
            <div class="auto-save-config-section" id="delaySection">
                <label for="autoSaveDelay">Delay Time (ms)</label>
                <input type="number" id="autoSaveDelay" min="100" max="10000" step="100" value="1000">
                <div class="help-text">
                    How long to wait after stopping input before auto saving. Recommended: 500-2000ms
                </div>
            </div>

            <!-- Retry Attempts -->
            <div class="auto-save-config-section">
                <label for="retryAttempts">Retry Attempts on Failure</label>
                <input type="number" id="retryAttempts" min="0" max="10" step="1" value="3">
                <div class="help-text">
                    Number of retry attempts when save fails
                </div>
            </div>

            <!-- Silent Save -->
            <div class="auto-save-config-section">
                <div class="checkbox-wrapper">
                    <input type="checkbox" id="silentSave" checked>
                    <label for="silentSave">Silent Save (No Notifications)</label>
                </div>
            </div>

            <!-- Show Status Indicator -->
            <div class="auto-save-config-section">
                <div class="checkbox-wrapper">
                    <input type="checkbox" id="showStatusIndicator" checked>
                    <label for="showStatusIndicator">Show Status Indicator</label>
                </div>
            </div>

            <!-- Button Group -->
            <div class="auto-save-config-buttons">
                <button type="button" id="autoSaveResetBtn">Reset</button>
                <button type="button" id="autoSaveSaveBtn" class="primary">Save</button>
            </div>
        `;
        return content;
    }

    /**
     * Render inline mode in specified container
     */
    renderInline(containerElement) {
        this.isInlineMode = true;
        this.containerElement = containerElement;

        if (!containerElement) {
            console.error('[AutoSaveConfigUI] Container element not provided');
            return;
        }

        // Clear container
        containerElement.innerHTML = '';

        // Create and insert content
        const content = this.createInlineContent();
        containerElement.appendChild(content);

        // Bind events
        this.bindInlineEvents();

        // Load current settings
        this.loadCurrentSettings();
    }

    /**
     * Create configuration panel (modal mode)
     */
    createPanel() {
        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'auto-save-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 9998;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.hide();
            }
        });

        // Create panel
        this.panel = document.createElement('div');
        this.panel.className = 'auto-save-config-panel';
        this.panel.innerHTML = `
            <h3>Auto Save Settings</h3>

            <!-- Mode Selection -->
            <div class="auto-save-config-section">
                <label for="autoSaveMode">Save Mode</label>
                <select id="autoSaveMode">
                    <option value="off">Disable Auto Save</option>
                    <option value="afterDelay">Save After Delay</option>
                    <option value="onFocusChange">Save on Focus Change</option>
                    <option value="onWindowChange">Save on Window Change</option>
                </select>

                <div class="auto-save-mode-options">
                    <dl>
                        <dt data-mode="off">Disable Auto Save</dt>
                        <dd data-mode="off">Manually save all changes</dd>

                        <dt data-mode="afterDelay">Save After Delay</dt>
                        <dd data-mode="afterDelay">Auto save after a period of inactivity (Recommended)</dd>

                        <dt data-mode="onFocusChange">Save on Focus Change</dt>
                        <dd data-mode="onFocusChange">Auto save when leaving the editor</dd>

                        <dt data-mode="onWindowChange">Save on Window Change</dt>
                        <dd data-mode="onWindowChange">Auto save when switching to other applications</dd>
                    </dl>
                </div>
            </div>

            <!-- Delay Time -->
            <div class="auto-save-config-section" id="delaySection">
                <label for="autoSaveDelay">Delay Time (ms)</label>
                <input type="number" id="autoSaveDelay" min="100" max="10000" step="100" value="1000">
                <div class="help-text">
                    How long to wait after stopping input before auto saving. Recommended: 500-2000ms
                </div>
            </div>

            <!-- Retry Attempts -->
            <div class="auto-save-config-section">
                <label for="retryAttempts">Retry Attempts on Failure</label>
                <input type="number" id="retryAttempts" min="0" max="10" step="1" value="3">
                <div class="help-text">
                    Number of retry attempts when save fails
                </div>
            </div>

            <!-- Silent Save -->
            <div class="auto-save-config-section">
                <div class="checkbox-wrapper">
                    <input type="checkbox" id="silentSave" checked>
                    <label for="silentSave">Silent Save (No Notifications)</label>
                </div>
            </div>

            <!-- Show Status Indicator -->
            <div class="auto-save-config-section">
                <div class="checkbox-wrapper">
                    <input type="checkbox" id="showStatusIndicator" checked>
                    <label for="showStatusIndicator">Show Status Indicator</label>
                </div>
            </div>

            <!-- Button Group -->
            <div class="auto-save-config-buttons">
                <button type="button" id="cancelBtn">Cancel</button>
                <button type="button" id="saveBtn" class="primary">Save</button>
            </div>
        `;

        this.overlay.appendChild(this.panel);
        document.body.appendChild(this.overlay);

        // Bind events
        this.bindEvents();
    }

    /**
     * Bind events (modal mode)
     */
    bindEvents() {
        // Mode selection change
        const modeSelect = document.getElementById('autoSaveMode');
        modeSelect.addEventListener('change', () => {
            this.updateDelayVisibility(modeSelect.value);
        });

        // Cancel button
        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.hide();
        });

        // Save button
        document.getElementById('saveBtn').addEventListener('click', () => {
            this.saveSettings();
            this.hide();
        });

        // Keyboard shortcuts
        this.panel.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hide();
            } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                this.saveSettings();
                this.hide();
            }
        });
    }

    /**
     * Bind events (inline mode)
     */
    bindInlineEvents() {
        // Mode selection change
        const modeSelect = document.getElementById('autoSaveMode');
        if (modeSelect) {
            modeSelect.addEventListener('change', () => {
                this.updateDelayVisibility(modeSelect.value);
            });
        }

        // Reset button
        const resetBtn = document.getElementById('autoSaveResetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.loadCurrentSettings();
            });
        }

        // Save button
        const saveBtn = document.getElementById('autoSaveSaveBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveSettings();
            });
        }
    }

    /**
     * Update delay time input visibility
     */
    updateDelayVisibility(mode) {
        const scope = this.getScopeElement();
        const delaySection = scope ? scope.querySelector('#delaySection') : document.getElementById('delaySection');
        if (delaySection) {
            if (mode === 'afterDelay') {
                delaySection.style.display = 'block';
            } else {
                delaySection.style.display = 'none';
            }
        }

        this.updateModeOptionsVisibility(mode);
    }

    /**
     * Update mode description visibility
     */
    updateModeOptionsVisibility(mode) {
        const scope = this.getScopeElement();
        const options = (scope ? scope.querySelectorAll('.auto-save-mode-options [data-mode]') : document.querySelectorAll('.auto-save-mode-options [data-mode]'));
        if (!options.length) return;
        options.forEach((node) => {
            const nodeMode = node.getAttribute('data-mode');
            if (!nodeMode) return;
            node.style.display = nodeMode === mode ? '' : 'none';
        });
    }

    /**
     * Get current UI scope element
     */
    getScopeElement() {
        if (this.isInlineMode && this.containerElement) return this.containerElement;
        if (!this.isInlineMode && this.panel) return this.panel;
        return null;
    }

    /**
     * Load current settings
     */
    loadCurrentSettings() {
        const config = this.manager.config;

        const scope = this.getScopeElement();
        const modeEl = scope ? scope.querySelector('#autoSaveMode') : document.getElementById('autoSaveMode');
        const delayEl = scope ? scope.querySelector('#autoSaveDelay') : document.getElementById('autoSaveDelay');
        const retriesEl = scope ? scope.querySelector('#retryAttempts') : document.getElementById('retryAttempts');
        const silentEl = scope ? scope.querySelector('#silentSave') : document.getElementById('silentSave');
        const indicatorEl = scope ? scope.querySelector('#showStatusIndicator') : document.getElementById('showStatusIndicator');

        if (modeEl) modeEl.value = config.mode;
        if (delayEl) delayEl.value = config.delay;
        if (retriesEl) retriesEl.value = config.retryAttempts;
        if (silentEl) silentEl.checked = config.silentSave;
        if (indicatorEl) indicatorEl.checked = config.showStatusIndicator;

        this.updateDelayVisibility(config.mode);
    }

    /**
     * Save settings
     */
    saveSettings() {
        const scope = this.getScopeElement();
        const modeEl = scope ? scope.querySelector('#autoSaveMode') : document.getElementById('autoSaveMode');
        const delayEl = scope ? scope.querySelector('#autoSaveDelay') : document.getElementById('autoSaveDelay');
        const retriesEl = scope ? scope.querySelector('#retryAttempts') : document.getElementById('retryAttempts');
        const silentEl = scope ? scope.querySelector('#silentSave') : document.getElementById('silentSave');
        const indicatorEl = scope ? scope.querySelector('#showStatusIndicator') : document.getElementById('showStatusIndicator');

        const mode = modeEl ? modeEl.value : this.manager.config.mode;
        const delay = delayEl ? parseInt(delayEl.value, 10) : this.manager.config.delay;
        const retryAttempts = retriesEl ? parseInt(retriesEl.value, 10) : this.manager.config.retryAttempts;
        const silentSave = silentEl ? silentEl.checked : this.manager.config.silentSave;
        const showStatusIndicator = indicatorEl ? indicatorEl.checked : this.manager.config.showStatusIndicator;

        // Validate input
        if (isNaN(delay) || delay < 100 || delay > 10000) {
            alert('Delay time must be between 100-10000ms');
            return;
        }

        if (isNaN(retryAttempts) || retryAttempts < 0 || retryAttempts > 10) {
            alert('Retry attempts must be between 0-10');
            return;
        }

        // Update configuration
        this.manager.config.mode = mode;
        this.manager.config.delay = delay;
        this.manager.config.retryAttempts = retryAttempts;
        this.manager.config.silentSave = silentSave;
        this.manager.config.showStatusIndicator = showStatusIndicator;

        // Save to localStorage
        this.manager.saveConfig();

        // Reset listeners
        this.manager.setupListeners();

        // Update status indicator visibility
        if (showStatusIndicator && !this.manager.statusIndicator) {
            this.manager.createStatusIndicator();
        } else if (!showStatusIndicator && this.manager.statusIndicator) {
            this.manager.statusIndicator.style.display = 'none';
        } else if (showStatusIndicator && this.manager.statusIndicator) {
            this.manager.statusIndicator.style.display = '';
        }

        // Show success message
        if (this.manager.app && this.manager.app.showNotification) {
            this.manager.app.showNotification('Auto save settings updated', 'success');
        }

        console.log('[AutoSaveConfigUI] Settings saved:', this.manager.config);
    }

    /**
     * Destroy panel
     */
    destroy() {
        if (this.overlay) {
            this.overlay.remove();
        }
        this.panel = null;
        this.overlay = null;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AutoSaveConfigUI;
} else if (typeof window !== 'undefined') {
    window.AutoSaveConfigUI = AutoSaveConfigUI;
}
