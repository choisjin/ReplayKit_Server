"""Monitor 서버 데이터 모델."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from pydantic import BaseModel


class DeviceInfo(BaseModel):
    """ReplayKit에 연결된 디바이스 정보."""
    device_id: str
    name: str = ""
    type: str = ""  # adb, serial, hkmc6th, vision_camera
    status: str = "connected"


class PlaybackProgress(BaseModel):
    """시나리오 재생 진행 상태."""
    scenario_name: str = ""
    current_cycle: int = 0
    total_cycles: int = 0
    current_step: int = 0
    total_steps: int = 0
    status: str = "idle"  # idle, running, paused, stopped
    passed: int = 0
    failed: int = 0
    warning: int = 0
    error: int = 0


class ClientStatus(BaseModel):
    """ReplayKit 클라이언트 상태 (전체)."""
    client_id: str
    name: str = ""
    version: str = ""
    activity: str = "idle"  # idle, recording, playing
    devices: list[DeviceInfo] = []
    playback: Optional[PlaybackProgress] = None
    scenarios: list[str] = []
    timestamp: str = ""


class ClientRegistration(BaseModel):
    """클라이언트 최초 등록 메시지."""
    type: str = "register"
    client_id: str
    name: str = ""
    version: str = ""


class RemoteCommand(BaseModel):
    """관제 서버 → ReplayKit 원격 명령."""
    type: str = "command"
    action: str  # play, stop, pause, resume, list_scenarios
    target_client_id: str
    scenario: str = ""
    repeat: int = 1
    verify: bool = True
    device_map: Optional[dict[str, str]] = None
