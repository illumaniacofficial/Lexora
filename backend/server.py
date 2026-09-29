"""
Lexora backend shim.

The real application server is a Node.js/Express app (the Lexora repo) that
runs on 127.0.0.1:8500. This FastAPI process is what supervisor launches on
port 8001; it (1) ensures PostgreSQL is up and the schema exists, (2) spawns
the Node API server as a child process, and (3) reverse-proxies every request
through to it (with SSE streaming + cookie/header passthrough).
"""
import os
import signal
import socket
import subprocess
import time
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, JSONResponse

UPSTREAM = "http://127.0.0.1:8500"
NODE_HOST, NODE_PORT = "127.0.0.1", 8500
APP_DIR = "/app"

_node_proc: subprocess.Popen | None = None

# Headers that must not be forwarded verbatim.
HOP_BY_HOP = {
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailers", "transfer-encoding", "upgrade", "host", "content-length",
}


def _port_open(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((host, port)) == 0


def _start_node():
    global _node_proc
    # Kill any stale Node instance holding the port.
    subprocess.run(["pkill", "-f", "tsx server/index.ts"], stderr=subprocess.DEVNULL)
    time.sleep(1)

    # Ensure the database is ready (idempotent).
    try:
        subprocess.run(["bash", "/app/scripts/ensure_db.sh"], timeout=120)
    except Exception as e:  # noqa: BLE001
        print(f"[shim] ensure_db.sh error (continuing): {e}", flush=True)

    print("[shim] Starting Lexora Node server on :8500 ...", flush=True)
    _node_proc = subprocess.Popen(
        ["/app/node_modules/.bin/tsx", "server/index.ts"],
        cwd=APP_DIR,
        env={**os.environ},
    )

    # Wait for Node to accept connections (AI + seed boot can take a bit).
    for _ in range(90):
        if _port_open(NODE_HOST, NODE_PORT):
            print("[shim] Node server is up.", flush=True)
            return
        if _node_proc.poll() is not None:
            print("[shim] Node server exited during startup!", flush=True)
            return
        time.sleep(1)
    print("[shim] WARNING: Node server did not open port 8500 in time.", flush=True)


def _stop_node():
    global _node_proc
    if _node_proc and _node_proc.poll() is None:
        try:
            _node_proc.send_signal(signal.SIGTERM)
            _node_proc.wait(timeout=10)
        except Exception:  # noqa: BLE001
            _node_proc.kill()


@asynccontextmanager
async def lifespan(app: FastAPI):
    _start_node()
    app.state.client = httpx.AsyncClient(
        base_url=UPSTREAM,
        timeout=httpx.Timeout(connect=15.0, read=None, write=None, pool=None),
    )
    try:
        yield
    finally:
        await app.state.client.aclose()
        _stop_node()


app = FastAPI(lifespan=lifespan)


@app.get("/healthz")
async def healthz():
    return {"ok": True, "node": _port_open(NODE_HOST, NODE_PORT)}


@app.api_route(
    "/{full_path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
)
async def proxy(full_path: str, request: Request):
    client: httpx.AsyncClient = request.app.state.client

    url = "/" + full_path
    if request.url.query:
        url += "?" + request.url.query

    fwd_headers = {
        k: v for k, v in request.headers.items() if k.lower() not in HOP_BY_HOP
    }
    # Tell Express (trust proxy) this is a secure, external request so
    # secure/sameSite=None session cookies are honoured.
    fwd_headers["X-Forwarded-Proto"] = "https"
    fwd_headers["X-Forwarded-Host"] = request.headers.get("host", "")
    if request.client:
        fwd_headers["X-Forwarded-For"] = request.client.host

    body = await request.body()

    req = client.build_request(request.method, url, headers=fwd_headers, content=body)
    try:
        upstream = await client.send(req, stream=True)
    except httpx.ConnectError:
        return JSONResponse(
            {"error": "Backend (Node) server is not reachable."}, status_code=502
        )

    resp_headers = [
        (k, v)
        for k, v in upstream.headers.items()
        if k.lower() not in HOP_BY_HOP and k.lower() != "content-encoding"
    ]

    async def body_iter():
        try:
            async for chunk in upstream.aiter_raw():
                yield chunk
        finally:
            await upstream.aclose()

    response = StreamingResponse(
        body_iter(),
        status_code=upstream.status_code,
        media_type=upstream.headers.get("content-type"),
    )
    # Replace headers with the upstream set (preserves multiple Set-Cookie).
    response.raw_headers = [
        (k.encode("latin-1"), v.encode("latin-1")) for k, v in resp_headers
    ]
    return response
