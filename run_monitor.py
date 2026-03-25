"""ReplayKit Monitor Server 실행 스크립트."""

import sys
import os

# 프로젝트 루트의 venv 사용
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
venv_site = os.path.join(project_root, "venv", "Lib", "site-packages")
if os.path.isdir(venv_site):
    sys.path.insert(0, venv_site)

import uvicorn

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 9000
    print(f"ReplayKit Monitor Server starting on port {port}...")
    print(f"Dashboard: http://localhost:{port}")
    uvicorn.run(
        "backend.app.main:app",
        host="0.0.0.0",
        port=port,
        reload=False,
    )
