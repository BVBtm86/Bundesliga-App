from __future__ import annotations

import signal
import subprocess
import sys
import time
from contextlib import closing
from pathlib import Path
from socket import socket


ROOT = Path(__file__).resolve().parent
FRONTEND = ROOT / "frontend"
BACKEND_PORT = 8001
FRONTEND_PORT = 3000


def port_is_free(port: int) -> bool:
    with closing(socket()) as sock:
        return sock.connect_ex(("127.0.0.1", port)) != 0


def start_process(command: list[str], cwd: Path) -> subprocess.Popen[bytes]:
    return subprocess.Popen(command, cwd=str(cwd))


def main() -> int:
    if not port_is_free(BACKEND_PORT):
        print(f"Backend port {BACKEND_PORT} is already in use.")
        print("Stop the old backend server first, then run this again.")
        return 1

    if not port_is_free(FRONTEND_PORT):
        print(f"Frontend port {FRONTEND_PORT} is already in use.")
        print("Stop the old frontend server first, then run this again.")
        return 1

    backend = start_process(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(BACKEND_PORT),
            "--reload",
            "--app-dir",
            "backend",
        ],
        ROOT,
    )

    time.sleep(1)

    frontend = start_process(
        ["npm", "run", "dev", "--", "--hostname", "127.0.0.1", "--port", str(FRONTEND_PORT)],
        FRONTEND,
    )

    print("")
    print("Bundesliga App is starting:")
    print(f"Backend:  http://127.0.0.1:{BACKEND_PORT}")
    print(f"Frontend: http://127.0.0.1:{FRONTEND_PORT}/standings")
    print("")
    print("Press Ctrl+C to stop both servers.")

    processes = [backend, frontend]

    def stop_processes() -> None:
        for process in processes:
            if process.poll() is None:
                process.send_signal(signal.SIGTERM)
        for process in processes:
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()

    try:
        while all(process.poll() is None for process in processes):
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\nStopping Bundesliga App...")
        stop_processes()
        return 0

    stop_processes()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
