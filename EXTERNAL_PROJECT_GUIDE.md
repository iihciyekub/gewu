# 加载外部目录项目指南

## 🎯 功能说明

系统现在**完全支持**加载任意目录下的项目，不限于项目根目录下的 `user/` 文件夹。

## ✨ 支持的路径类型

### 1. 相对路径（项目内部）
限制在项目根目录内，适合项目内的子目录：

```
user/my_project           ✅ 可以访问
subdir/another_project    ✅ 可以访问
../outside_project        ❌ 不允许（安全限制）
```

### 2. 绝对路径（任意位置）✨
可以访问系统任意位置的项目：

```bash
# macOS/Linux
/Users/yjli/Documents/research_projects/study1     ✅ 完全支持
/home/username/my_papers                            ✅ 完全支持

# Windows
C:\Users\username\projects\my_research              ✅ 完全支持
D:\research\papers                                  ✅ 完全支持
```

## 📖 使用方法

### 方式 1: 通过 UI 浏览选择

1. 点击"选择项目文件夹"
2. 点击"浏览"按钮
3. 在文件选择器中选择**任意位置**的项目文件夹
4. 点击"加载项目"

**注意**: 浏览器的文件选择器会自动返回绝对路径，所以可以选择任意位置。

### 方式 2: 手动输入绝对路径

#### 创建外部项目
```bash
# 通过 API
curl -X POST http://localhost:8000/create-project \
  -H "Content-Type: application/json" \
  -d '{"projectPath": "/Users/yjli/Documents/my_research"}'
```

在 UI 中：
1. 项目名称: `my_research`
2. 项目路径: `/Users/yjli/Documents/my_research`
3. 点击"创建项目"

#### 加载外部项目
```bash
# 通过 API
curl -X POST http://localhost:8000/validate-project \
  -H "Content-Type: application/json" \
  -d '{"projectPath": "/Users/yjli/Documents/my_research"}'
```

在 UI 中：
1. 在"加载现有项目"的路径输入框中输入: `/Users/yjli/Documents/my_research`
2. 点击"加载项目"

### 方式 3: 命令行直接访问

```bash
# 列出外部项目的文件
curl -X POST http://localhost:8000/list-json-files \
  -H "Content-Type: application/json" \
  -d '{"projectPath": "/Users/yjli/Documents/my_research"}'
```

## 🔐 安全说明

### 相对路径的限制
相对路径被限制在项目根目录内，防止通过 `../` 访问敏感目录：

```bash
user/my_project           ✅ 允许
subdir/test               ✅ 允许
../outside                ❌ 拒绝 - "相对路径不能访问项目根目录之外的位置"
../../etc/passwd          ❌ 拒绝 - 安全保护
```

### 绝对路径的自由度
绝对路径没有限制，用户可以访问有权限的任何目录：

```bash
/Users/yjli/Documents/research    ✅ 允许（如果有权限）
/tmp/test_project                  ✅ 允许（如果有权限）
/root/restricted                   ❌ 会失败（权限不足）
```

**重要**: 服务器以运行用户的权限执行，只能访问该用户有权限的目录。

## 💡 实际使用场景

### 场景 1: 多个研究项目分散在不同目录
```
/Users/yjli/
├── Documents/
│   ├── PhD_Research/project1/      # 博士研究
│   └── Teaching/course_materials/  # 教学材料
└── Dropbox/
    └── Collaboration/joint_paper/  # 合作项目
```

所有这些项目都可以在应用中加载和管理！

### 场景 2: 使用云同步服务
```
/Users/yjli/
├── iCloud Drive/research/
├── Dropbox/papers/
└── OneDrive/projects/
```

可以直接加载云同步文件夹中的项目。

### 场景 3: 外部硬盘或网络驱动器
```
/Volumes/External_Drive/research_backup/
/Volumes/NAS/shared_projects/
```

可以加载外部存储设备上的项目。

## 🧪 测试示例

### 创建并加载外部项目

```bash
# 1. 创建外部目录
mkdir -p /Users/yjli/Documents/test_project

# 2. 通过 API 创建项目
curl -X POST http://localhost:8000/create-project \
  -H "Content-Type: application/json" \
  -d '{"projectPath": "/Users/yjli/Documents/test_project"}'

# 3. 验证项目结构
ls -la /Users/yjli/Documents/test_project/
# 应该看到: json/  md/  pdf/  .project

# 4. 加载项目
curl -X POST http://localhost:8000/validate-project \
  -H "Content-Type: application/json" \
  -d '{"projectPath": "/Users/yjli/Documents/test_project"}'
```

### 在 UI 中测试

1. **测试外部项目创建**:
   - 项目名称: `external_test`
   - 项目路径: `/Users/yjli/Desktop/external_test`
   - 点击"创建项目"
   - 验证桌面上出现了新文件夹

2. **测试外部项目加载**:
   - 手动创建目录: `mkdir -p /tmp/my_project/{json,md,pdf}`
   - 在 UI 中输入路径: `/tmp/my_project`
   - 点击"加载项目"
   - 验证项目加载成功

## ❓ 常见问题

### Q: 为什么我的相对路径 `../other_project` 不能用？
**A**: 出于安全考虑，相对路径被限制在项目根目录内。请使用绝对路径访问外部项目。

### Q: Windows 路径怎么输入？
**A**: 可以使用以下任一格式：
- `C:\Users\username\projects\research`
- `C:/Users/username/projects/research`

系统会自动处理路径分隔符。

### Q: 可以加载网络驱动器上的项目吗？
**A**: 可以！只要路径可访问，格式正确即可：
- macOS: `/Volumes/NetworkDrive/project`
- Windows: `Z:\project` 或 `\\server\share\project`

### Q: 权限不足怎么办？
**A**: 确保运行服务器的用户对目标目录有读写权限。可以使用 `chmod` (Unix) 或文件属性 (Windows) 调整权限。

### Q: 路径太长记不住怎么办？
**A**: 
1. 使用"浏览"按钮选择目录（自动填充路径）
2. 加载一次后会出现在"最近的项目"列表中

## 📝 技术实现

### 路径处理逻辑 (server.js)

```javascript
function normalizeProjectPath(projectPath = 'user') {
    // 绝对路径：直接使用，不受限制
    if (path.isAbsolute(raw)) {
        const fullPath = path.normalize(raw);
        return { projectKey: fullPath, fullPath };
    }
    
    // 相对路径：限制在项目根目录内
    const candidate = path.resolve(ROOT_DIR, normalizedInput);
    const relative = path.relative(ROOT_DIR, candidate);
    if (relative.startsWith('..')) {
        throw new Error('相对路径不能访问项目根目录之外的位置');
    }
    
    return { projectKey, fullPath };
}
```

### 关键改进

**之前**:
```javascript
// 阻止所有外部路径
if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Invalid project path');
}
```

**现在**:
```javascript
// 绝对路径：完全支持 ✅
if (path.isAbsolute(raw)) {
    return { projectKey: fullPath, fullPath };
}

// 相对路径：仅限制 .. 访问 ✅
if (relative.startsWith('..')) {
    throw new Error('相对路径不能访问项目根目录之外的位置');
}
```

## ✅ 验证清单

- [x] 绝对路径完全支持
- [x] 相对路径安全限制
- [x] UI 浏览器选择支持
- [x] API 端点支持
- [x] 跨平台路径支持 (macOS/Linux/Windows)
- [x] 错误处理和提示
- [x] 文档更新

## 🎉 总结

现在你可以：
- ✅ 加载**任意位置**的项目（使用绝对路径）
- ✅ 管理分散在不同目录的多个项目
- ✅ 使用云同步服务和外部存储
- ✅ 保持项目根目录内的相对路径安全性

**建议**: 对于外部项目，始终使用绝对路径，这样更清晰、更可靠！
