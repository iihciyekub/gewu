/*!
 * GitHub Alerts for markdown-it (blockquote syntax)
 * Supports:
 * > [!note] optional text
 * > content...
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else {
        root.markdownItGithubAlerts = factory();
    }
}(this, function () {
    return function (md) {
        const labels = {
            note: 'Note',
            tip: 'Tip',
            important: 'Important',
            warning: 'Warning',
            caution: 'Caution'
        };

        md.core.ruler.after('block', 'github_alerts', function (state) {
            const tokens = state.tokens;
            for (let i = 0; i < tokens.length; i++) {
                const open = tokens[i];
                if (open.type !== 'blockquote_open') continue;

                // Find matching close to limit scope
                let closeIdx = -1;
                for (let j = i + 1; j < tokens.length; j++) {
                    if (tokens[j].type === 'blockquote_close' && tokens[j].level === open.level) {
                        closeIdx = j;
                        break;
                    }
                }
                if (closeIdx === -1) continue;

                // Find first inline inside this blockquote
                let inlineIdx = -1;
                for (let j = i + 1; j < closeIdx; j++) {
                    if (tokens[j].type === 'inline') {
                        inlineIdx = j;
                        break;
                    }
                }
                if (inlineIdx === -1) continue;

                const inline = tokens[inlineIdx];
                const firstText = (inline.children || []).find(c => c.type === 'text');
                if (!firstText) continue;

                const m = firstText.content.trim().match(/^\[!([a-z]+)\]\s*(.*)$/i);
                if (!m) continue;

                const type = m[1].toLowerCase();
                const label = labels[type] || 'Note';
                const rest = m[2] || '';

                // Transform tags
                open.tag = 'div';
                open.type = 'note_open';
                open.attrs = [['class', `note-block note-${type}`]];
                const close = tokens[closeIdx];
                close.tag = 'div';
                close.type = 'note_close';

                // Remove marker from first text node
                firstText.content = rest.trim();

                // Prepend label token
                const Token = state.Token || state.tokens.constructor;
                const labelToken = new state.Token('html_inline', '', 0);
                labelToken.content = `<strong>${label}</strong> `;
                inline.children = inline.children || [];
                inline.children.unshift(labelToken);
            }
        });
    };
}));
