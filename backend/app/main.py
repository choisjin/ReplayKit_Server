"""ReplayKit Monitor Server — 통합 관제 서버."""

from __future__ import annotations

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .manager import ConnectionManager
from .models import ClientStatus, RemoteCommand

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

manager = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Monitor server starting...")
    yield
    logger.info("Monitor server shutting down...")


app = FastAPI(
    title="ReplayKit Monitor",
    description="ReplayKit 통합 관제 서버 — 다수 인스턴스 모니터링 및 원격 제어",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": "ReplayKit Monitor"}


@app.get("/api/clients")
async def list_clients():
    """현재 연결된 모든 ReplayKit 클라이언트 목록."""
    return {"clients": manager.get_all_clients_summary()}


@app.websocket("/ws/client")
async def ws_client(websocket: WebSocket):
    """ReplayKit 인스턴스가 연결하는 WebSocket 엔드포인트.

    프로토콜:
    1. 클라이언트가 register 메시지 전송
    2. 이후 주기적으로 status_update 전송
    3. 서버에서 command 수신 가능 (원격 제어)
    """
    await websocket.accept()
    client_id = ""
    try:
        # 1단계: 등록 메시지 수신
        init_msg = await asyncio.wait_for(websocket.receive_json(), timeout=10.0)
        if init_msg.get("type") != "register":
            await websocket.close(code=4001, reason="First message must be 'register'")
            return

        client_id = init_msg.get("client_id", "")
        name = init_msg.get("name", "")
        version = init_msg.get("version", "")

        if not client_id:
            await websocket.close(code=4002, reason="client_id required")
            return

        conn = await manager.register_client(websocket, client_id, name, version)
        await websocket.send_json({"type": "registered", "client_id": client_id})

        # 2단계: 메시지 수신 루프
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "status_update":
                status = ClientStatus(
                    client_id=client_id,
                    name=data.get("name", name),
                    version=data.get("version", version),
                    activity=data.get("activity", "idle"),
                    devices=data.get("devices", []),
                    playback=data.get("playback"),
                    scenarios=data.get("scenarios", []),
                    timestamp=data.get("timestamp", ""),
                )
                await manager.update_client_status(client_id, status)

            elif msg_type == "command_result":
                # 명령 실행 결과를 대시보드에 전달
                await manager._broadcast_to_dashboards({
                    "type": "command_result",
                    "client_id": client_id,
                    "result": data.get("result", {}),
                })

    except asyncio.TimeoutError:
        logger.warning("Client registration timeout")
    except WebSocketDisconnect:
        logger.info("Client disconnected: %s", client_id)
    except Exception as e:
        logger.error("Client WebSocket error: %s", e)
    finally:
        if client_id:
            await manager.unregister_client(client_id)


@app.websocket("/ws/dashboard")
async def ws_dashboard(websocket: WebSocket):
    """대시보드 브라우저가 연결하는 WebSocket 엔드포인트.

    - 연결 시 현재 모든 클라이언트 상태 수신
    - 이후 실시간 업데이트 수신
    - 원격 명령 전송 가능
    """
    await websocket.accept()
    await manager.add_dashboard(websocket)
    logger.info("Dashboard connected")

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "command":
                # 대시보드에서 ReplayKit으로 원격 명령
                cmd = RemoteCommand(
                    action=data.get("action", ""),
                    target_client_id=data.get("target_client_id", ""),
                    scenario=data.get("scenario", ""),
                    repeat=data.get("repeat", 1),
                    verify=data.get("verify", True),
                    device_map=data.get("device_map"),
                )
                success = await manager.send_command_to_client(cmd)
                await websocket.send_json({
                    "type": "command_sent",
                    "success": success,
                    "target_client_id": cmd.target_client_id,
                    "action": cmd.action,
                })

    except WebSocketDisconnect:
        logger.info("Dashboard disconnected")
    except Exception as e:
        logger.error("Dashboard WebSocket error: %s", e)
    finally:
        await manager.remove_dashboard(websocket)


@app.get("/")
async def root():
    """프론트엔드 dist가 없을 때 안내 메시지."""
    _dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
    if _dist.is_dir():
        from starlette.responses import FileResponse
        return FileResponse(str(_dist / "index.html"))
    return {
        "app": "ReplayKit Monitor",
        "status": "running",
        "clients": len(manager.clients),
        "note": "프론트엔드 빌드 필요: cd monitor/frontend && npm run build",
    }


# 프론트엔드 정적 파일 서빙
_frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if _frontend_dist.is_dir():
    from starlette.responses import FileResponse

    @app.get("/{path:path}")
    async def serve_frontend(path: str):
        file = _frontend_dist / path
        if file.is_file():
            return FileResponse(str(file))
        return FileResponse(str(_frontend_dist / "index.html"))
