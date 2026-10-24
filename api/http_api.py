"""Transport-neutral request handler shared by the local development server."""

from __future__ import annotations

import json
from typing import Any

from .economy import ApiError, Economy


class Api:
    def __init__(self, store: Economy | None = None):
        self.store = store or Economy()

    def handle(self, method: str, path: str, headers: dict[str, str], body: bytes) -> tuple[int, dict[str, Any]]:
        route = path.split("?", 1)[0].rstrip("/") or "/"
        try:
            payload = json.loads(body.decode("utf-8")) if body else {}
            if not isinstance(payload, dict):
                raise ApiError(400, "El cuerpo de la solicitud debe ser un objeto JSON.")
            if route == "/api/health" and method == "GET":
                return 200, {"ok": True, "storage": "sqlite"}
            if route == "/api/leaderboard" and method == "GET":
                return 200, {"entries": self.store.leaderboard("flappy")}

            player_id = _header(headers, "x-player-id")
            name = payload.get("name") or _header(headers, "x-player-name")
            if route == "/api/profile" and method in {"GET", "POST"}:
                profile = self.store.connect(player_id, name, payload.get("legacyBest", 0))
                return 200, {"profile": profile}
            if route == "/api/profile/avatar" and method == "POST":
                return 200, {"profile": self.store.choose_avatar(player_id, name, payload.get("avatarId"))}
            if route == "/api/profile/character" and method == "POST":
                return 200, {"profile": self.store.choose_bird(player_id, name, payload.get("characterId"))}
            if route == "/api/profile/background" and method == "POST":
                return 200, {"profile": self.store.choose_background(player_id, name, payload.get("backgroundId"))}
            if route == "/api/runs" and method == "POST":
                result = self.store.record_run(
                    player_id, name, payload.get("runId"), payload.get("gameId"), payload.get("score")
                )
                return 200, {"profile": result}
            if route == "/api/store/purchase" and method == "POST":
                return 200, {"profile": self.store.purchase_avatar(player_id, name, payload.get("avatarId"))}
            if route == "/api/store/background/purchase" and method == "POST":
                return 200, {"profile": self.store.purchase_background(player_id, name, payload.get("backgroundId"))}
            return 404, {"error": "No se encontró esa ruta."}
        except ApiError as error:
            return error.status, {"error": error.message}
        except (UnicodeDecodeError, json.JSONDecodeError):
            return 400, {"error": "El contenido debe ser JSON válido."}


def _header(headers: dict[str, str], name: str) -> str:
    return next((value for key, value in headers.items() if key.lower() == name), "")
