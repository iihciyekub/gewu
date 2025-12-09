#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Simple HTTP Server with JSON save support
支持直接保存JSON文件到 user/data/ 目录
"""

import os
import json
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

class JSONSaveHandler(SimpleHTTPRequestHandler):
    """扩展的HTTP处理器，支持保存JSON文件"""
    
    def do_POST(self):
        """处理POST请求，用于保存JSON文件"""
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/save-json':
            try:
                # 读取请求体
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                data = json.loads(post_data.decode('utf-8'))
                
                filename = data.get('filename')
                content = data.get('content')
                
                if not filename or not content:
                    self.send_error(400, "Missing filename or content")
                    return
                
                # 保存到 user/data/ 目录
                file_path = os.path.join('user', 'data', filename)
                
                # 确保目录存在
                os.makedirs(os.path.dirname(file_path), exist_ok=True)
                
                # 写入文件
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                
                # 返回成功响应
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                response = json.dumps({
                    'success': True,
                    'message': f'File {filename} saved successfully',
                    'path': file_path
                })
                self.wfile.write(response.encode('utf-8'))
                
                print(f"✓ Saved: {file_path}")
                
            except Exception as e:
                print(f"✗ Error saving file: {e}")
                self.send_error(500, f"Error saving file: {str(e)}")
        else:
            self.send_error(404, "Not found")
    
    def do_OPTIONS(self):
        """处理CORS预检请求"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def end_headers(self):
        """添加CORS头"""
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

def run(server_class=HTTPServer, handler_class=JSONSaveHandler, port=8000):
    """启动服务器"""
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    print(f'🚀 Server running at http://localhost:{port}/')
    print(f'📁 Serving files from: {os.getcwd()}')
    print(f'💾 JSON files will be saved to: user/data/')
    print('Press Ctrl+C to stop\n')
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\n\n👋 Server stopped')
        httpd.server_close()

if __name__ == '__main__':
    run()
