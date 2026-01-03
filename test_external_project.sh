#!/bin/bash

# 快速测试脚本 - 验证外部项目加载

echo "========================================="
echo "测试加载外部项目: /Users/yjli/Desktop/user_test"
echo "========================================="
echo ""

# 1. 验证项目
echo "📝 步骤 1: 验证项目结构..."
curl -s -X POST http://localhost:8000/validate-project \
  -H "Content-Type: application/json" \
  -d '{"projectPath": "/Users/yjli/Desktop/user_test"}' | \
  node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('Valid:', d.valid); console.log('JSON Dir:', d.jsonDir); console.log('MD Dir:', d.mdDir); console.log('PDF Dir:', d.pdfDir);"

echo ""

# 2. 列出文件
echo "📂 步骤 2: 获取文件列表..."
FILE_COUNT=$(curl -s -X POST http://localhost:8000/list-json-files \
  -H "Content-Type: application/json" \
  -d '{"projectPath": "/Users/yjli/Desktop/user_test"}' | \
  node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.files.length);")

echo "找到 $FILE_COUNT 个文件"
echo ""

# 3. 测试获取第一个JSON文件
echo "📄 步骤 3: 测试读取第一个文件..."
FIRST_FILE=$(curl -s -X POST http://localhost:8000/list-json-files \
  -H "Content-Type: application/json" \
  -d '{"projectPath": "/Users/yjli/Desktop/user_test"}' | \
  node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.files[0].path);")

echo "第一个文件路径: $FIRST_FILE"

# 获取文件URL
FILE_URL="/Users/yjli/Desktop/user_test/$FIRST_FILE"
echo "完整路径: $FILE_URL"

if [ -f "$FILE_URL" ]; then
    echo "✓ 文件存在，大小: $(wc -c < "$FILE_URL") 字节"
else
    echo "✗ 文件不存在！"
fi

echo ""
echo "========================================="
echo "✅ 后端测试完成"
echo "========================================="
echo ""
echo "📌 如果前端还是不能加载，请检查："
echo "  1. 浏览器控制台 (F12) 的错误信息"
echo "  2. 网络面板 (Network) 查看API请求"
echo "  3. 确保在 UI 中输入绝对路径: /Users/yjli/Desktop/user_test"
echo "  4. 或使用'浏览'按钮选择目录"
