"""Run the zero-cost SQLite API on loopback for local development."""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

from .http_api import Api

ALLOWED_ORIGINS = {"http://localhost:8000", "http://127.0.0.1:8000"}


class Handler(BaseHTTPRequestHandler):
    api = Api()

    def _send(self, status: int, payload: dict, origin: str = "") -> None:
        data = b"" if status == 204 else json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        if status != 204:
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Player-Id, X-Player-Name")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        if data:
            self.wfile.write(data)

    def do_OPTIONS(self) -> None:
        self._send(204, {}, self.headers.get("Origin", ""))

    def do_GET(self) -> None:
        status, result = self.api.handle("GET", urlsplit(self.path).path, dict(self.headers.items()), b"")
        self._send(status, result, self.headers.get("Origin", ""))

    def do_POST(self) -> None:
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._send(400, {"error": "Tamaño de solicitud no válido."}, self.headers.get("Origin", ""))
            return
        if content_length < 0:
            self._send(400, {"error": "Tamaño de solicitud no válido."}, self.headers.get("Origin", ""))
            return
        if content_length > 16_384:
            self._send(413, {"error": "La solicitud es demasiado grande."}, self.headers.get("Origin", ""))
            return
        body = self.rfile.read(content_length)
        status, result = self.api.handle("POST", urlsplit(self.path).path, dict(self.headers.items()), body)
        self._send(status, result, self.headers.get("Origin", ""))

    def log_message(self, format: str, *args) -> None:
        return


def main() -> None:
    host = "127.0.0.1"
    port = 8001
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"CenGames API local: http://{host}:{port}/api  (SQLite)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nCenGames API detenida.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
