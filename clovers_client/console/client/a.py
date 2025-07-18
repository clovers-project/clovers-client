from http.server import SimpleHTTPRequestHandler
from socketserver import TCPServer

PORT = 8000


class HTTPRequestHandler(SimpleHTTPRequestHandler):

    def do_GET(self):
        if self.path == "/":
            # 设置响应头
            self.send_response(200)
            self.send_header("Content-type", "text/html; charset=utf-8")
            self.end_headers()
            html_content = f"""
            <!DOCTYPE html>
            <html lang="zh-CN">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>欢迎页面</title>
                <style>
                    body {{ font-family: sans-serif; text-align: center; margin-top: 50px; background-color: #f0f0f0; }}
                    h1 {{ color: #333; }}
                    p {{ color: #666; }}
                </style>
            </head>
            <body>
                <h1>你好！欢迎来到自定义页面！</h1>
                <p>这个页面不是来自文件系统，而是由Python服务器动态生成的。</p>
                <p>当前时间是：<script>document.write(new Date().toLocaleString());</script></p>
            </body>
            </html>
            """
            self.wfile.write(html_content.encode("utf-8"))
        else:
            self.send_error(404, "文件未找到")


# 启动服务器
with TCPServer(("", PORT), HTTPRequestHandler) as httpd:
    print(f"服务器在端口 {PORT} 启动，请访问 http://localhost:{PORT}/")
    httpd.serve_forever()
