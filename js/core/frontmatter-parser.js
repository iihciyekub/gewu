/**
 * Front Matter Parser
 * 解析 Markdown 文件中的 YAML front matter (metadata)
 */

class FrontMatterParser {
    constructor() {
        this.frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
    }

    /**
     * 解析 Markdown 文本，提取 front matter 和内容
     * @param {string} markdownText - 原始 Markdown 文本
     * @returns {Object} { metadata: {}, content: string, hasFrontMatter: boolean }
     */
    parse(markdownText) {
        if (!markdownText || typeof markdownText !== 'string') {
            return {
                metadata: {},
                content: markdownText || '',
                hasFrontMatter: false
            };
        }

        const match = markdownText.match(this.frontMatterRegex);
        
        if (!match) {
            return {
                metadata: {},
                content: markdownText,
                hasFrontMatter: false
            };
        }

        const frontMatterText = match[1];
        const content = markdownText.slice(match[0].length);
        const metadata = this.parseYamlLike(frontMatterText);

        return {
            metadata,
            content,
            hasFrontMatter: true,
            rawFrontMatter: frontMatterText
        };
    }

    /**
     * 解析类 YAML 格式的文本
     * 支持简单的 key:value 格式
     * @param {string} yamlText - YAML 文本
     * @returns {Object} 解析后的对象
     */
    parseYamlLike(yamlText) {
        const result = {};
        if (!yamlText) return result;

        const lines = yamlText.split('\n');
        let currentKey = null;
        let currentValue = '';
        let isMultiline = false;

        for (let line of lines) {
            line = line.trim();
            
            // 跳过空行和注释
            if (!line || line.startsWith('#')) {
                if (isMultiline && currentKey) {
                    currentValue += '\n';
                }
                continue;
            }

            // 检查是否是键值对
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0 && !isMultiline) {
                // 保存上一个键值对
                if (currentKey !== null) {
                    result[currentKey] = this.parseValue(currentValue);
                }

                currentKey = line.slice(0, colonIndex).trim();
                const valueText = line.slice(colonIndex + 1).trim();
                
                // 检查是否是多行值的开始
                if (valueText === '|' || valueText === '>') {
                    isMultiline = true;
                    currentValue = '';
                } else {
                    currentValue = valueText;
                    isMultiline = false;
                }
            } else if (isMultiline && currentKey) {
                // 多行值的续行
                currentValue += (currentValue ? '\n' : '') + line;
            } else if (currentKey) {
                // 单行值的续行（如果有的话）
                currentValue += ' ' + line;
            }
        }

        // 保存最后一个键值对
        if (currentKey !== null) {
            result[currentKey] = this.parseValue(currentValue);
        }

        return result;
    }

    /**
     * 解析值，尝试转换为合适的类型
     * @param {string} valueStr - 值字符串
     * @returns {*} 解析后的值
     */
    parseValue(valueStr) {
        if (!valueStr) return '';
        
        valueStr = valueStr.trim();

        // 布尔值
        if (valueStr === 'true' || valueStr === 'yes' || valueStr === 'on') {
            return true;
        }
        if (valueStr === 'false' || valueStr === 'no' || valueStr === 'off') {
            return false;
        }

        // null/undefined
        if (valueStr === 'null' || valueStr === 'nil' || valueStr === '~') {
            return null;
        }

        // 数字
        if (/^-?\d+$/.test(valueStr)) {
            return parseInt(valueStr, 10);
        }
        if (/^-?\d*\.\d+$/.test(valueStr)) {
            return parseFloat(valueStr);
        }

        // 数组（简单格式）
        if (valueStr.startsWith('[') && valueStr.endsWith(']')) {
            try {
                const items = valueStr.slice(1, -1).split(',').map(s => s.trim());
                return items.map(item => this.parseValue(item));
            } catch (e) {
                return valueStr;
            }
        }

        // 去除引号
        if ((valueStr.startsWith('"') && valueStr.endsWith('"')) ||
            (valueStr.startsWith("'") && valueStr.endsWith("'"))) {
            return valueStr.slice(1, -1);
        }

        return valueStr;
    }

    /**
     * 序列化 metadata 为 YAML front matter 格式
     * @param {Object} metadata - 元数据对象
     * @returns {string} YAML front matter 文本
     */
    stringify(metadata) {
        if (!metadata || typeof metadata !== 'object' || Object.keys(metadata).length === 0) {
            return '';
        }

        const lines = ['---'];
        
        for (const [key, value] of Object.entries(metadata)) {
            lines.push(this.stringifyKeyValue(key, value));
        }
        
        lines.push('---');
        return lines.join('\n') + '\n';
    }

    /**
     * 序列化单个键值对
     * @param {string} key - 键
     * @param {*} value - 值
     * @returns {string} 键值对字符串
     */
    stringifyKeyValue(key, value) {
        if (value === null || value === undefined) {
            return `${key}: null`;
        }

        if (typeof value === 'boolean') {
            return `${key}: ${value}`;
        }

        if (typeof value === 'number') {
            return `${key}: ${value}`;
        }

        if (Array.isArray(value)) {
            const items = value.map(v => {
                if (typeof v === 'string' && /[,\[\]]/.test(v)) {
                    return `"${v.replace(/"/g, '\\"')}"`;
                }
                return v;
            });
            return `${key}: [${items.join(', ')}]`;
        }

        if (typeof value === 'string') {
            // 多行文本
            if (value.includes('\n')) {
                const lines = value.split('\n').map(line => '  ' + line);
                return `${key}: |\n${lines.join('\n')}`;
            }
            
            // 需要引号的情况
            if (/[:#\[\]{}@&*!|>'",%]/.test(value) || value.startsWith(' ') || value.endsWith(' ')) {
                return `${key}: "${value.replace(/"/g, '\\"')}"`;
            }
            
            return `${key}: ${value}`;
        }

        // 对象（简单处理）
        if (typeof value === 'object') {
            try {
                return `${key}: ${JSON.stringify(value)}`;
            } catch (e) {
                return `${key}: ${String(value)}`;
            }
        }

        return `${key}: ${String(value)}`;
    }

    /**
     * 组合 front matter 和内容
     * @param {Object} metadata - 元数据对象
     * @param {string} content - Markdown 内容
     * @returns {string} 完整的 Markdown 文本
     */
    compose(metadata, content) {
        const frontMatter = this.stringify(metadata);
        return frontMatter ? frontMatter + content : content;
    }

    /**
     * 更新 Markdown 文本中的 metadata
     * @param {string} markdownText - 原始 Markdown 文本
     * @param {Object} newMetadata - 新的或更新的 metadata
     * @param {boolean} merge - 是否合并（true）或替换（false）
     * @returns {string} 更新后的 Markdown 文本
     */
    updateMetadata(markdownText, newMetadata, merge = true) {
        const parsed = this.parse(markdownText);
        const metadata = merge ? { ...parsed.metadata, ...newMetadata } : newMetadata;
        return this.compose(metadata, parsed.content);
    }
}

// 导出为全局变量
if (typeof window !== 'undefined') {
    window.FrontMatterParser = FrontMatterParser;
}
