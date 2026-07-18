"""Locust scenario for ~100 WebSocket players.

Usage (against a running stack):
  pip install locust websocket-client
  locust -f loadtest/locustfile.py --host http://localhost:8080
"""

from __future__ import annotations

import json
import os
import random
import time
from uuid import uuid4

from locust import HttpUser, between, events, task
from websocket import create_connection


GAME_CODE = os.getenv("KAHUCIK_GAME_CODE", "")
WS_BASE = os.getenv("KAHUCIK_WS_BASE", "ws://localhost:8080")


class PlayerUser(HttpUser):
    wait_time = between(0.2, 1.0)

    def on_start(self) -> None:
        if not GAME_CODE:
            self.environment.runner.quit()
            return
        nick = f"p{uuid4().hex[:8]}"
        with self.client.post(
            f"/api/games/code/{GAME_CODE}/join/guest",
            json={"nickname": nick, "locale": "en"},
            name="join_guest",
            catch_response=True,
        ) as res:
            if res.status_code != 200:
                res.failure(res.text)
                return
            data = res.json()
        self.game_id = data["game_id"]
        self.token = data["reconnect_token"]
        self.ws = None
        try:
            self.ws = create_connection(
                f"{WS_BASE}/ws/games/{self.game_id}",
                timeout=10,
            )
            self.ws.send(json.dumps({"type": "player_hello", "payload": {"reconnect_token": self.token}}))
            _ = self.ws.recv()
        except Exception as exc:  # noqa: BLE001
            events.request.fire(
                request_type="WSS",
                name="connect",
                response_time=0,
                response_length=0,
                exception=exc,
            )

    @task
    def idle_listen(self) -> None:
        if not self.ws:
            return
        start = time.time()
        try:
            self.ws.settimeout(0.5)
            try:
                msg = self.ws.recv()
                event = json.loads(msg)
                if event.get("type") == "question":
                    q = event["payload"]["question"]
                    payload = self._answer_payload(q)
                    self.ws.send(json.dumps({"type": "answer", "payload": payload}))
                events.request.fire(
                    request_type="WSS",
                    name=event.get("type", "message"),
                    response_time=int((time.time() - start) * 1000),
                    response_length=len(msg),
                    exception=None,
                )
            except Exception:
                pass
        except Exception as exc:  # noqa: BLE001
            events.request.fire(
                request_type="WSS",
                name="listen",
                response_time=int((time.time() - start) * 1000),
                response_length=0,
                exception=exc,
            )

    def _answer_payload(self, q: dict) -> dict:
        opts = q.get("options", [])
        if not opts:
            return {}
        if q["type"] in {"quiz", "true_false"}:
            return {"option_id": random.choice(opts)["id"]}
        if q["type"] == "multi_select":
            pick = random.sample(opts, k=max(1, len(opts) // 2))
            return {"option_ids": [o["id"] for o in pick]}
        if q["type"] == "puzzle":
            ids = [o["id"] for o in opts]
            random.shuffle(ids)
            return {"ordered_option_ids": ids}
        return {}

    def on_stop(self) -> None:
        if self.ws:
            try:
                self.ws.close()
            except Exception:  # noqa: BLE001
                pass
