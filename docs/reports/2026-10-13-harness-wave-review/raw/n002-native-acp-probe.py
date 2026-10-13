#!/usr/bin/env python3
"""Reproduce N-002 ACP mode negotiation without a model prompt or MCP server.

Sanitized from the inline probe executed 2026-10-13; this saved file was not
rerun after sanitization. Requires the installed `kimi` executable and an
existing sign-in. It never initiates sign-in. session/new may persist an empty
native session; the temporary project is removed. Output excludes session IDs,
credentials, stderr, private paths and model/account configuration.
"""
import json
import os
import selectors
import shutil
import signal
import subprocess
import tempfile
import time


def probe(flags, select_modes=False):
    cwd = tempfile.mkdtemp(prefix="fabric-kimi-mode-probe-")
    process = None
    selector = selectors.DefaultSelector()
    pending = b""
    notifications = []

    def rpc(request_id, method, params):
        nonlocal pending
        request = {"jsonrpc": "2.0", "id": request_id, "method": method, "params": params}
        process.stdin.write((json.dumps(request) + "\n").encode())
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            if b"\n" not in pending:
                if not selector.select(max(0.01, deadline - time.monotonic())):
                    break
                data = os.read(process.stdout.fileno(), 65536)
                if not data:
                    break
                pending += data
            while b"\n" in pending:
                line, pending = pending.split(b"\n", 1)
                try:
                    response = json.loads(line)
                except ValueError:
                    continue
                if response.get("id") == request_id:
                    return response
                update = response.get("params", {}).get("update", {})
                if update.get("sessionUpdate") == "current_mode_update":
                    notifications.append(update.get("currentModeId"))
        return {"timeout": True}

    try:
        process = subprocess.Popen(
            ["kimi", *flags, "acp"], cwd=cwd, stdin=subprocess.PIPE,
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            bufsize=0, start_new_session=True,
        )
        selector.register(process.stdout, selectors.EVENT_READ)
        initialized = rpc(1, "initialize", {
            "protocolVersion": 1, "clientCapabilities": {},
            "clientInfo": {"name": "fabric-mode-probe", "version": "0"},
        })
        if "result" not in initialized:
            return {"flags": flags, "initialize_ok": False, "prompt_sent": False}
        created = rpc(2, "session/new", {"cwd": cwd, "mcpServers": []})
        result = created.get("result", {})
        session_id = result.get("sessionId")
        receipt = {
            "flags": flags, "initialize_ok": True,
            "session_new_ok": "result" in created,
            "initial_mode": result.get("modes", {}).get("currentModeId"),
            "prompt_sent": False, "mcp_servers": 0, "mode_requests": [],
        }
        if session_id and select_modes:
            for request_id, mode in enumerate(["plan", "default", "yolo", "invalid-fixture-mode"], 3):
                before = len(notifications)
                answer = rpc(request_id, "session/set_mode", {"sessionId": session_id, "modeId": mode})
                receipt["mode_requests"].append({
                    "requested_mode": mode, "acknowledged": "result" in answer,
                    "error_code": answer.get("error", {}).get("code"),
                    "timeout": answer.get("timeout", False),
                    "mode_updates": notifications[before:],
                })
        return receipt
    finally:
        selector.close()
        if process is not None:
            process.stdin.close()
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait()
        shutil.rmtree(cwd)


if __name__ == "__main__":
    version = subprocess.check_output(["kimi", "--version"], text=True).strip()
    for flags in [[], ["--plan"], ["--auto"]]:
        print(json.dumps({"version": version, **probe(flags)}), flush=True)
    print(json.dumps({"version": version, **probe([], select_modes=True)}), flush=True)
