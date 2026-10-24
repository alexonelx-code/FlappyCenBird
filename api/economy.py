"""Small, zero-dependency SQLite API domain for the CenGames economy."""

from __future__ import annotations

import json
import os
import re
import sqlite3
import time
from pathlib import Path
from typing import Any
from uuid import UUID

FREE_AVATARS = ("sol", "luna", "pixel", "rayo", "ola")
AVATAR_PRICES = {
    "cometa": 40,
    "prisma": 55,
    "orbita": 70,
    "flora": 85,
    "neon": 100,
}
FREE_BIRDS = ("friend", "classic", "laguna", "mango", "nube")
MAX_RUN_SCORE = 500
MAX_RUN_IDS = 2000
PLAYER_ID_PATTERN = re.compile(r"^[a-f0-9-]{36}$")


class ApiError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


class Economy:
    """Persistent game profiles stored in a local SQLite database."""

    def __init__(self, database_path: str | os.PathLike[str] | None = None):
        path = Path(database_path or os.environ.get("CENGAMES_DB_PATH", "data/cengames.sqlite3"))
        if str(path) != ":memory:":
            path.parent.mkdir(parents=True, exist_ok=True)
        self.database_path = str(path)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path, timeout=10, isolation_level=None)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA busy_timeout = 10000")
        return connection

    def _initialize(self) -> None:
        with self._connect() as db:
            db.execute("PRAGMA journal_mode = WAL")
            db.execute(
                """CREATE TABLE IF NOT EXISTS players (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    avatar_id TEXT NOT NULL DEFAULT 'sol',
                    character_id TEXT NOT NULL DEFAULT 'friend',
                    cents INTEGER NOT NULL DEFAULT 0 CHECK(cents >= 0),
                    owned_avatars TEXT NOT NULL,
                    owned_birds TEXT NOT NULL,
                    flappy_plays INTEGER NOT NULL DEFAULT 0,
                    flappy_points INTEGER NOT NULL DEFAULT 0,
                    flappy_best INTEGER NOT NULL DEFAULT 0,
                    processed_runs TEXT NOT NULL DEFAULT '[]',
                    updated_at INTEGER NOT NULL
                )"""
            )

    @staticmethod
    def _identity(player_id: Any, name: Any) -> tuple[str, str]:
        identity = str(player_id or "").strip().lower()
        if not PLAYER_ID_PATTERN.fullmatch(identity):
            raise ApiError(400, "El perfil no tiene un identificador válido.")
        try:
            identity = str(UUID(identity))
        except ValueError as error:
            raise ApiError(400, "El perfil no tiene un identificador válido.") from error

        player_name = " ".join(str(name or "").split())[:18]
        if not player_name:
            raise ApiError(400, "Escribe un nombre para guardar tu progreso.")
        return identity, player_name

    @staticmethod
    def _new_player(player_id: str, name: str, legacy_best: Any = 0) -> dict[str, Any]:
        best = max(0, min(MAX_RUN_SCORE, _integer(legacy_best, "récord", 0)))
        return {
            "id": player_id,
            "name": name,
            "avatarId": FREE_AVATARS[0],
            "characterId": FREE_BIRDS[0],
            "cents": 0,
            "ownedAvatars": list(FREE_AVATARS),
            "ownedBirds": list(FREE_BIRDS),
            "flappyPlays": 0,
            "flappyPoints": 0,
            "flappyBest": best,
            "processedRuns": [],
            "updatedAt": int(time.time() * 1000),
        }

    @staticmethod
    def _to_profile(row: sqlite3.Row) -> dict[str, Any]:
        return {
            "id": row["id"],
            "name": row["name"],
            "avatarId": row["avatar_id"],
            "characterId": row["character_id"],
            "cents": row["cents"],
            "ownedAvatars": json.loads(row["owned_avatars"]),
            "ownedBirds": json.loads(row["owned_birds"]),
            "flappy": {
                "plays": row["flappy_plays"],
                "points": row["flappy_points"],
                "best": row["flappy_best"],
            },
            "updatedAt": row["updated_at"],
        }

    def _ensure(self, db: sqlite3.Connection, player_id: str, name: str, legacy_best: Any = 0) -> sqlite3.Row:
        row = db.execute("SELECT * FROM players WHERE id = ?", (player_id,)).fetchone()
        if row is None:
            player = self._new_player(player_id, name, legacy_best)
            db.execute(
                """INSERT INTO players (
                    id, name, avatar_id, character_id, cents, owned_avatars, owned_birds,
                    flappy_best, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    player["id"], player["name"], player["avatarId"], player["characterId"],
                    player["cents"], json.dumps(player["ownedAvatars"]),
                    json.dumps(player["ownedBirds"]), player["flappyBest"], player["updatedAt"],
                ),
            )
            row = db.execute("SELECT * FROM players WHERE id = ?", (player_id,)).fetchone()
        elif row["name"] != name:
            db.execute("UPDATE players SET name = ?, updated_at = ? WHERE id = ?", (name, int(time.time() * 1000), player_id))
            row = db.execute("SELECT * FROM players WHERE id = ?", (player_id,)).fetchone()
        return row

    def connect(self, player_id: Any, name: Any, legacy_best: Any = 0) -> dict[str, Any]:
        identity, player_name = self._identity(player_id, name)
        with self._connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = self._ensure(db, identity, player_name, legacy_best)
            db.commit()
            return self._to_profile(row)

    def get_profile(self, player_id: Any, name: Any) -> dict[str, Any]:
        return self.connect(player_id, name)

    def record_run(self, player_id: Any, name: Any, run_id: Any, game_id: Any, score: Any) -> dict[str, Any]:
        identity, player_name = self._identity(player_id, name)
        if str(game_id or "") != "flappy":
            raise ApiError(400, "Ese minijuego todavía no registra partidas.")
        try:
            run_key = str(UUID(str(run_id)))
        except (ValueError, TypeError, AttributeError) as error:
            raise ApiError(400, "La partida no tiene un identificador válido.") from error
        points = _integer(score, "puntuación", 0)
        if points > MAX_RUN_SCORE:
            raise ApiError(400, f"La puntuación supera el máximo de {MAX_RUN_SCORE} por partida.")

        with self._connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = self._ensure(db, identity, player_name)
            processed = json.loads(row["processed_runs"])
            if run_key in processed:
                db.commit()
                profile = self._to_profile(row)
                profile["duplicateRun"] = True
                profile["earnedCents"] = 0
                return profile

            processed.append(run_key)
            processed = processed[-MAX_RUN_IDS:]
            now = int(time.time() * 1000)
            db.execute(
                """UPDATE players SET
                    name = ?, cents = cents + ?, flappy_plays = flappy_plays + 1,
                    flappy_points = flappy_points + ?, flappy_best = MAX(flappy_best, ?),
                    processed_runs = ?, updated_at = ? WHERE id = ?""",
                (player_name, points, points, points, json.dumps(processed), now, identity),
            )
            updated = db.execute("SELECT * FROM players WHERE id = ?", (identity,)).fetchone()
            db.commit()
            profile = self._to_profile(updated)
            profile["duplicateRun"] = False
            profile["earnedCents"] = points
            return profile

    def purchase_avatar(self, player_id: Any, name: Any, avatar_id: Any) -> dict[str, Any]:
        identity, player_name = self._identity(player_id, name)
        item_id = str(avatar_id or "")
        if item_id not in AVATAR_PRICES:
            raise ApiError(404, "Ese artículo no está disponible en la tienda.")
        price = AVATAR_PRICES[item_id]
        with self._connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = self._ensure(db, identity, player_name)
            owned = json.loads(row["owned_avatars"])
            if item_id in owned:
                db.commit()
                profile = self._to_profile(row)
                profile["purchaseStatus"] = "already-owned"
                return profile
            if row["cents"] < price:
                raise ApiError(409, "Aún no tienes suficientes Cent para este avatar.")
            owned.append(item_id)
            db.execute(
                "UPDATE players SET cents = cents - ?, owned_avatars = ?, updated_at = ? WHERE id = ?",
                (price, json.dumps(owned), int(time.time() * 1000), identity),
            )
            updated = db.execute("SELECT * FROM players WHERE id = ?", (identity,)).fetchone()
            db.commit()
            profile = self._to_profile(updated)
            profile["purchaseStatus"] = "purchased"
            profile["spentCents"] = price
            return profile

    def choose_avatar(self, player_id: Any, name: Any, avatar_id: Any) -> dict[str, Any]:
        identity, player_name = self._identity(player_id, name)
        item_id = str(avatar_id or "")
        with self._connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = self._ensure(db, identity, player_name)
            owned = json.loads(row["owned_avatars"])
            if item_id not in owned:
                raise ApiError(403, "Primero consigue ese avatar en la tienda.")
            db.execute("UPDATE players SET avatar_id = ?, updated_at = ? WHERE id = ?", (item_id, int(time.time() * 1000), identity))
            updated = db.execute("SELECT * FROM players WHERE id = ?", (identity,)).fetchone()
            db.commit()
            return self._to_profile(updated)

    def choose_bird(self, player_id: Any, name: Any, character_id: Any) -> dict[str, Any]:
        identity, player_name = self._identity(player_id, name)
        bird_id = str(character_id or "")
        with self._connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = self._ensure(db, identity, player_name)
            owned = json.loads(row["owned_birds"])
            if bird_id not in owned or bird_id not in FREE_BIRDS:
                raise ApiError(403, "Este pájaro todavía no se puede usar.")
            db.execute("UPDATE players SET character_id = ?, updated_at = ? WHERE id = ?", (bird_id, int(time.time() * 1000), identity))
            updated = db.execute("SELECT * FROM players WHERE id = ?", (identity,)).fetchone()
            db.commit()
            return self._to_profile(updated)

    def leaderboard(self, game_id: Any = "flappy") -> list[dict[str, Any]]:
        if str(game_id or "flappy") != "flappy":
            raise ApiError(400, "Ese minijuego todavía no tiene tabla.")
        with self._connect() as db:
            rows = db.execute(
                """SELECT id, name, avatar_id, character_id, flappy_best, updated_at
                   FROM players WHERE flappy_best > 0
                   ORDER BY flappy_best DESC, updated_at ASC LIMIT 20"""
            ).fetchall()
        return [
            {
                "id": row["id"], "name": row["name"], "avatarId": row["avatar_id"],
                "characterId": row["character_id"], "score": row["flappy_best"], "updatedAt": row["updated_at"],
            }
            for row in rows
        ]


def _integer(value: Any, label: str, default: int | None = None) -> int:
    if value is None and default is not None:
        return default
    try:
        number = int(value)
    except (TypeError, ValueError, OverflowError) as error:
        raise ApiError(400, f"El valor de {label} no es válido.") from error
    if number < 0:
        raise ApiError(400, f"El valor de {label} no puede ser negativo.")
    return number
