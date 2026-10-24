import json
import tempfile
import unittest
from pathlib import Path
from api.economy import (
    AVATAR_PRICES,
    BACKGROUND_PRICES,
    FREE_AVATARS,
    MAX_RUN_SCORE,
    ApiError,
    Economy,
)
from api.http_api import Api


PLAYER_ID = "6a4dfd82-a9df-4f76-8e38-9a170df76818"


class EconomyTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.store = Economy(Path(self.temp_dir.name) / "economy.sqlite3")

    def tearDown(self):
        self.store.close()
        self.temp_dir.cleanup()

    def test_new_profile_has_free_items_and_empty_wallet(self):
        profile = self.store.connect(PLAYER_ID, "Alex")

        self.assertEqual(profile["cents"], 0)
        self.assertEqual(profile["ownedAvatars"], list(FREE_AVATARS))
        self.assertEqual(profile["ownedBirds"], ["friend", "classic", "laguna", "mango", "nube"])
        self.assertEqual(profile["ownedBackgrounds"], ["costa", "aurora"])
        self.assertEqual(profile["fighter"], {"plays": 0, "wins": 0, "draws": 0, "earned": 0})

    def test_avatar_prices_are_split_into_the_three_intended_tiers(self):
        prices = list(AVATAR_PRICES.values())

        self.assertEqual(len(FREE_AVATARS), 5)
        self.assertEqual(prices, [40] * 5 + [60] * 5)

    def test_run_credit_is_idempotent_and_accepts_scores_over_500(self):
        run_id = "1c6bbf35-618e-43c6-86d0-4a8069924f61"

        first = self.store.record_run(PLAYER_ID, "Alex", run_id, "flappy", 501)
        duplicate = self.store.record_run(PLAYER_ID, "Alex", run_id, "flappy", 501)

        self.assertEqual(first["cents"], 501)
        self.assertEqual(first["flappy"]["plays"], 1)
        self.assertFalse(first["duplicateRun"])
        self.assertTrue(duplicate["duplicateRun"])
        self.assertEqual(duplicate["earnedCents"], 0)
        self.assertEqual(duplicate["cents"], 501)

    def test_fighter_match_pays_five_cent_plus_win_bonus_once(self):
        match_id = "74d7fcaf-d43f-4bb7-ad94-2b4de1193fb2"

        first = self.store.record_fighter_match(PLAYER_ID, "Alex", match_id, "player")
        duplicate = self.store.record_fighter_match(PLAYER_ID, "Alex", match_id, "player")

        self.assertEqual(first["cents"], 7)
        self.assertEqual(first["fighter"], {"plays": 1, "wins": 1, "draws": 0, "earned": 7})
        self.assertFalse(first["duplicateFighterMatch"])
        self.assertTrue(duplicate["duplicateFighterMatch"])
        self.assertEqual(duplicate["earnedCents"], 0)
        self.assertEqual(duplicate["cents"], 7)

    def test_fighter_draw_pays_five_cent_and_rejects_incomplete_results(self):
        profile = self.store.record_fighter_match(
            PLAYER_ID, "Alex", "6d76cf96-1585-4193-8e16-1b4bed5f60d1", "draw"
        )

        self.assertEqual(profile["cents"], 5)
        self.assertEqual(profile["fighter"]["draws"], 1)
        with self.assertRaises(ApiError) as invalid:
            self.store.record_fighter_match(
                PLAYER_ID, "Alex", "d4c9e82a-628a-4a4a-a446-53b096068e29", "abandoned"
            )
        self.assertEqual(invalid.exception.status, 400)

    def test_run_rejects_fractional_scores(self):
        with self.assertRaises(ApiError) as error:
            self.store.record_run(PLAYER_ID, "Alex", "1c6bbf35-618e-43c6-86d0-4a8069924f61", "flappy", 1.5)

        self.assertEqual(error.exception.status, 400)

    def test_run_limit_matches_the_game_score_range(self):
        run_id = "1c6bbf35-618e-43c6-86d0-4a8069924f61"
        profile = self.store.record_run(PLAYER_ID, "Alex", run_id, "flappy", MAX_RUN_SCORE)

        self.assertEqual(profile["cents"], MAX_RUN_SCORE)
        with self.assertRaises(ApiError) as error:
            self.store.record_run(PLAYER_ID, "Alex", "2c6bbf35-618e-43c6-86d0-4a8069924f61", "flappy", MAX_RUN_SCORE + 1)
        self.assertEqual(error.exception.status, 400)

    def test_avatar_purchase_charges_once_and_can_be_equipped(self):
        self.store.record_run(PLAYER_ID, "Alex", "1c6bbf35-618e-43c6-86d0-4a8069924f61", "flappy", 45)

        purchased = self.store.purchase_avatar(PLAYER_ID, "Alex", "cometa")
        repeated = self.store.purchase_avatar(PLAYER_ID, "Alex", "cometa")
        equipped = self.store.choose_avatar(PLAYER_ID, "Alex", "cometa")

        self.assertEqual(purchased["cents"], 5)
        self.assertEqual(repeated["purchaseStatus"], "already-owned")
        self.assertEqual(repeated["cents"], 5)
        self.assertEqual(equipped["avatarId"], "cometa")

    def test_avatar_purchase_rejects_insufficient_funds_and_unknown_owned_ids(self):
        with self.assertRaises(ApiError) as insufficient:
            self.store.purchase_avatar(PLAYER_ID, "Alex", "cometa")
        self.assertEqual(insufficient.exception.status, 409)

        with self.assertRaises(ApiError) as unknown:
            self.store.choose_avatar(PLAYER_ID, "Alex", "invented-avatar")
        self.assertEqual(unknown.exception.status, 404)

    def test_background_purchase_and_selection(self):
        self.store.record_run(PLAYER_ID, "Alex", "1c6bbf35-618e-43c6-86d0-4a8069924f61", "flappy", 100)

        purchased = self.store.purchase_background(PLAYER_ID, "Alex", "cosmos")
        equipped = self.store.choose_background(PLAYER_ID, "Alex", "cosmos")

        self.assertEqual(purchased["cents"], 40)
        self.assertEqual(purchased["spentCents"], BACKGROUND_PRICES["cosmos"])
        self.assertEqual(equipped["backgroundId"], "cosmos")

    def test_unknown_game_and_invalid_run_ids_are_rejected(self):
        with self.assertRaises(ApiError):
            self.store.record_run(PLAYER_ID, "Alex", "1c6bbf35-618e-43c6-86d0-4a8069924f61", "future", 1)
        with self.assertRaises(ApiError):
            self.store.record_run(PLAYER_ID, "Alex", "bad-id", "flappy", 1)

    def test_memory_database_survives_connection_per_operation(self):
        memory_store = Economy(":memory:")
        try:
            memory_store.connect(PLAYER_ID, "Alex")
            profile = memory_store.get_profile(PLAYER_ID, "Alex")
            self.assertEqual(profile["name"], "Alex")
        finally:
            memory_store.close()


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.store = Economy(Path(self.temp_dir.name) / "api.sqlite3")
        self.api = Api(self.store)

    def tearDown(self):
        self.store.close()
        self.temp_dir.cleanup()

    def test_health_and_invalid_json_responses(self):
        status, health = self.api.handle("GET", "/api/health", {}, b"")
        self.assertEqual((status, health["ok"]), (200, True))

        status, payload = self.api.handle("POST", "/api/profile", {}, b"{")
        self.assertEqual(status, 400)
        self.assertIn("JSON", payload["error"])

    def test_profile_route_rejects_non_object_json(self):
        status, payload = self.api.handle("POST", "/api/profile", {}, json.dumps([1]).encode())

        self.assertEqual(status, 400)
        self.assertIn("objeto JSON", payload["error"])

    def test_run_and_store_routes_update_the_wallet(self):
        headers = {
            "X-Player-Id": PLAYER_ID,
            "X-Player-Name": "Alex",
        }
        run = {
            "name": "Alex",
            "gameId": "flappy",
            "runId": "1c6bbf35-618e-43c6-86d0-4a8069924f61",
            "score": 45,
        }
        status, _ = self.api.handle("POST", "/api/runs", headers, json.dumps(run).encode())
        self.assertEqual(status, 200)

        status, result = self.api.handle(
            "POST", "/api/store/purchase", headers, json.dumps({"avatarId": "cometa"}).encode()
        )

        self.assertEqual(status, 200)
        self.assertEqual(result["profile"]["cents"], 5)
        self.assertIn("cometa", result["profile"]["ownedAvatars"])

    def test_fighter_match_route_returns_idempotent_receipt(self):
        headers = {"X-Player-Id": PLAYER_ID, "X-Player-Name": "Alex"}
        body = {"matchId": "74d7fcaf-d43f-4bb7-ad94-2b4de1193fb2", "result": "player"}

        status, first = self.api.handle("POST", "/api/fighter/matches", headers, json.dumps(body).encode())
        duplicate_status, duplicate = self.api.handle("POST", "/api/fighter/matches", headers, json.dumps(body).encode())

        self.assertEqual((status, duplicate_status), (200, 200))
        self.assertEqual(first["profile"]["earnedCents"], 7)
        self.assertEqual(duplicate["profile"]["earnedCents"], 0)


if __name__ == "__main__":
    unittest.main()
