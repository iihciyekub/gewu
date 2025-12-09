#!/bin/bash

# Paper Reviewer System - 快速启动脚本
# Quick Start Script for Paper Reviewer System

echo "========================================="
echo "  Paper Reviewer System - Starting..."
echo "========================================="
echo ""

# 检查是否在正确的目录
if [ ! -f "index.html" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# 检查Python3是否可用
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: Python 3 is not installed"
    exit 1
fi

echo "✅ Starting HTTP server with JSON save support on port 8000..."
echo ""
echo "📂 Project directory: $(pwd)"
echo "🌐 Access the application at: http://localhost:8000"
echo "💾 JSON files will be saved to: user/data/"
echo ""
echo "Press Ctrl+C to stop the server"
echo "========================================="
echo ""

# 启动Node.js服务器
node server.js
