"""클라이언트 연결 관리자 — ReplayKit 인스턴스 및 대시보드 연결 추적."""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import WebSocket

from .models import ClientStatus, RemoteCommand

logger = logging.getLogger(__name__)


class ClientConnection:
    """하나의 ReplayKit 클라이언트 연결."""

    def __init__(self, ws: WebSocket, client_id: str, name: str = "", version: str = ""):
        self.ws = ws
        self.client_id = client_id
        self.name = name
        self.version = version
        self.connected_at = datetime.now(timezone.utc).isoformat()
        self.last_seen = self.connected_at
        self.status: ClientStatus | None = None

    def to_summary(self) -> dict:
        """대시보드에 전달할 클라이언트 요약."""
        base = {
            "client_id": self.client_id,
            "name": self.name,
            "version": self.version,
            "connected_at": self.connected_at,
            "last_seen": self.last_seen,
        }
        if self.status:
            base.update(self.status.model_dump())
        else:
            base.update({"activity": "idle", "devices": [], "playback": None, "scenarios": []})
        return base


class ConnectionManager:
    """ReplayKit 클라이언트와 대시보드 WebSocket 연결 관리."""

    def __init__(self):
        # client_id → ClientConnection
        self.clients: dict[str, ClientConnection] = {}
        # 대시보드 WebSocket 목록
        self.dashboards: list[WebSocket] = []
        self._lock = asyncio.Lock()

    async def register_client(self, ws: WebSocket, client_id: str, name: str = "", version: str = "") -> ClientConnection:
        async with self._lock:
            conn = ClientConnection(ws, client_id, name, version)
            self.clients[client_id] = conn
            logger.info("Client registered: %s (%s)", client_id, name)
        await self._broadcast_to_dashboards({
            "type": "client_connected",
            "client": conn.to_summary(),
        })
        return conn

    async def unregister_client(self, client_id: str):
        async with self._lock:
            self.clients.pop(client_id, None)
            logger.info("Client unregistered: %s", client_id)
        await self._broadcast_to_dashboards({
            "type": "client_disconnected",
            "client_id": client_id,
        })

    async def update_client_status(self, client_id: str, status: ClientStatus):
        async with self._lock:
            conn = self.clients.get(client_id)
            if conn:
                conn.status = status
                conn.last_seen = datetime.now(timezone.utc).isoformat()
        await self._broadcast_to_dashboards({
            "type": "status_update",
            "client_id": client_id,
            "status": status.model_dump(),
        })

    async def add_dashboard(self, ws: WebSocket):
        async with self._lock:
            self.dashboards.append(ws)
        # 현재 연결된 모든 클라이언트 정보 전송
        clients_summary = []
        async with self._lock:
            for conn in self.clients.values():
                clients_summary.append(conn.to_summary())
        await ws.send_json({
            "type": "initial_state",
            "clients": clients_summary,
        })

    async def remove_dashboard(self, ws: WebSocket):
        async with self._lock:
            if ws in self.dashboards:
                self.dashboards.remove(ws)

    async def send_command_to_client(self, cmd: RemoteCommand) -> bool:
        """대시보드에서 ReplayKit으로 원격 명령 전달."""
        async with self._lock:
            conn = self.clients.get(cmd.target_client_id)
        if not conn:
            return False
        try:
            await conn.ws.send_json(cmd.model_dump())
            return True
        except Exception as e:
            logger.error("Failed to send command to %s: %s", cmd.target_client_id, e)
            return False

    async def _broadcast_to_dashboards(self, data: dict):
        """모든 대시보드에 메시지 브로드캐스트."""
        dead: list[WebSocket] = []
        async with self._lock:
            targets = list(self.dashboards)
        for ws in targets:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                for ws in dead:
                    if ws in self.dashboards:
                        self.dashboards.remove(ws)

    def get_all_clients_summary(self) -> list[dict]:
        return [conn.to_summary() for conn in self.clients.values()]
