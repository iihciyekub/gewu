# 独立PDF窗口自动关闭功能

## 功能说明

在以下情况下，系统会自动关闭已打开的独立PDF窗口：

### 1. 页面刷新/重载
- 用户刷新页面时（F5 或 Cmd+R）
- 浏览器页面重新加载时
- 自动关闭独立PDF窗口并清理引用

### 2. 切换项目
- 用户在项目选择器中切换到其他项目
- 自动保存当前PDF的标注
- 关闭独立PDF窗口
- 显示提示："🔄 已关闭独立PDF窗口"

### 3. 项目初始化
- 应用启动时加载项目
- 立即强制使用内嵌PDF模式
- 清理任何遗留的独立窗口状态

### 4. 页面卸载
- 用户关闭浏览器标签页
- 导航到其他页面
- 自动关闭独立PDF窗口

## 实现细节

### 关键函数

#### 1. `cleanupOrphanedPdfWindows()`
在构造函数中调用，立即清理遗留窗口：
```javascript
cleanupOrphanedPdfWindows() {
    if (this.pdfPopupWindow && !this.pdfPopupWindow.closed) {
        this.pdfPopupWindow.close();
        this.pdfPopupWindow = null;
    }
    this.isPdfPopupMode = false;
}
```

#### 2. `forceEmbeddedPdfMode()`
增强版，多重保护：
```javascript
forceEmbeddedPdfMode() {
    // 多次尝试关闭窗口
    // 清除定时器
    // 重置状态
    // 清理localStorage
    // 详细日志记录
}
```

#### 3. `initializeProject()`
优先关闭独立窗口：
```javascript
async initializeProject() {
    // 🔑 优先关闭独立PDF窗口
    this.forceEmbeddedPdfMode();
    
    // 然后继续其他初始化
    this.updateProjectDisplay();
    // ...
}
```

#### 4. `switchProject()`
切换前保存并关闭：
```javascript
async switchProject(project) {
    // 检测是否有打开的窗口
    const hadPopupWindow = this.isPdfPopupMode && ...;
    
    // 保存标注
    if (this.isPdfPopupMode) {
        await this.savePdfAnnotationsFromPopup();
    }
    
    // 关闭窗口
    this.forceEmbeddedPdfMode();
    
    // 用户提示
    if (hadPopupWindow) {
        this.showNotification('🔄 已关闭独立PDF窗口', 'info');
    }
}
```

#### 5. `beforeunload` 事件监听
页面卸载时关闭：
```javascript
window.addEventListener('beforeunload', (e) => {
    // 关闭独立PDF窗口
    if (app.pdfPopupWindow && !app.pdfPopupWindow.closed) {
        app.pdfPopupWindow.close();
    }
    
    // 检查未保存的更改
    // ...
});
```

## 修改的文件

- **[js/app.js](js/app.js)**
  - 构造函数: 添加 `cleanupOrphanedPdfWindows()` 调用
  - `cleanupOrphanedPdfWindows()`: 新增方法
  - `forceEmbeddedPdfMode()`: 增强错误处理和日志
  - `initializeProject()`: 优先调用 `forceEmbeddedPdfMode()`
  - `switchProject()`: 添加保存标注和用户提示
  - `beforeunload` 事件: 添加窗口关闭逻辑

## 用户体验

### 切换项目时
1. 系统检测到独立PDF窗口打开
2. 自动保存当前PDF标注
3. 关闭独立PDF窗口
4. 显示提示："🔄 已关闭独立PDF窗口"
5. 加载新项目

### 页面刷新时
1. 触发 `beforeunload` 事件
2. 自动关闭独立PDF窗口
3. 页面重新加载
4. 自动使用内嵌PDF模式

### 应用启动时
1. 构造函数执行 `cleanupOrphanedPdfWindows()`
2. 初始化项目时执行 `forceEmbeddedPdfMode()`
3. 确保没有遗留的独立窗口

## 技术特点

### 多层防护
1. **构造函数级别**: 应用启动时立即清理
2. **初始化级别**: 项目加载时强制关闭
3. **切换级别**: 项目切换时关闭
4. **卸载级别**: 页面卸载时关闭

### 错误容错
- try-catch 包裹所有关闭操作
- 即使某次关闭失败，不影响应用运行
- 详细的控制台警告日志

### 状态同步
- 关闭窗口的同时清理所有相关状态
- 清除定时器和事件监听器
- 更新 localStorage 保存的模式状态

## 测试场景

### 基本测试
1. ✅ 打开独立PDF窗口 → 切换项目 → 验证窗口已关闭
2. ✅ 打开独立PDF窗口 → 刷新页面 → 验证窗口已关闭
3. ✅ 打开独立PDF窗口 → 关闭标签页 → 验证窗口已关闭

### 边界测试
1. ✅ 未打开独立窗口 → 切换项目 → 正常运行
2. ✅ 窗口已被手动关闭 → 切换项目 → 正常运行
3. ✅ 快速连续切换项目 → 验证无错误

### 标注保存测试
1. ✅ 在独立窗口添加标注 → 切换项目 → 验证标注已保存
2. ✅ 在独立窗口添加标注 → 刷新页面 → 验证标注已保存

## 已知限制

1. **浏览器限制**: 某些浏览器可能阻止自动关闭窗口
2. **跨域限制**: 如果独立窗口被用户拖到其他域，可能无法访问
3. **用户权限**: 如果用户禁用了JavaScript，功能将失效

## 维护建议

1. 定期检查浏览器控制台是否有窗口关闭相关警告
2. 关注用户反馈，特别是独立窗口相关问题
3. 保持多层防护机制，不依赖单一清理点

---

**更新日期**: 2026-01-12  
**版本**: v1.1
