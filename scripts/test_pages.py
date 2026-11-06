"""Script to test that all routes render cleanly without blank pages or thrown errors

for both Issue Clerk and Finance Head roles.
"""

import asyncio
import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
import websockets

CHROME_PATHS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]

def find_chrome():
    for p in CHROME_PATHS:
        if os.path.exists(p):
            return p
    raise RuntimeError("Chrome not found")

class CDPClient:
    def __init__(self, ws_url):
        self.ws_url = ws_url
        self.ws = None
        self._msg_id = 0
        self.exceptions = []
        self.console_errors = []

    async def connect(self):
        self.ws = await websockets.connect(self.ws_url, max_size=100 * 1024 * 1024)

    async def send(self, method, params=None):
        self._msg_id += 1
        msg = {"id": self._msg_id, "method": method, "params": params or {}}
        await self.ws.send(json.dumps(msg))
        while True:
            resp_raw = await self.ws.recv()
            resp = json.loads(resp_raw)
            method_name = resp.get("method")
            if method_name == "Runtime.exceptionThrown":
                self.exceptions.append(resp["params"])
            elif method_name == "Runtime.consoleAPICalled":
                if resp["params"].get("type") == "error":
                    self.console_errors.append(resp["params"])
            elif method_name == "Log.entryAdded":
                if resp["params"].get("entry", {}).get("level") == "error":
                    self.console_errors.append(resp["params"])

            if resp.get("id") == self._msg_id:
                if "error" in resp:
                    raise RuntimeError(f"CDP error: {resp['error']}")
                return resp.get("result", {})

    async def pump_events(self, duration=2.0):
        end = time.time() + duration
        while time.time() < end:
            try:
                resp_raw = await asyncio.wait_for(self.ws.recv(), timeout=0.1)
                resp = json.loads(resp_raw)
                method_name = resp.get("method")
                if method_name == "Runtime.exceptionThrown":
                    self.exceptions.append(resp["params"])
                elif method_name == "Runtime.consoleAPICalled":
                    if resp["params"].get("type") == "error":
                        self.console_errors.append(resp["params"])
                elif method_name == "Log.entryAdded":
                    if resp["params"].get("entry", {}).get("level") == "error":
                        self.console_errors.append(resp["params"])
            except asyncio.TimeoutError:
                pass

async def main():
    chrome_bin = find_chrome()
    env = os.environ.copy()
    env["PYTHONPATH"] = "backend"
    env["PORT"] = "8000"
    env["JWT_SECRET"] = "super-secret-karigar-key-coimbatore-workshop"
    env["DATABASE_URL"] = "postgresql+psycopg://postgres:postgres@localhost:5432/karigar_ledger"

    python_exe = str(Path("backend/.venv/Scripts/python.exe").resolve())
    backend_proc = subprocess.Popen(
        [python_exe, "-m", "uvicorn", "app.main:app", "--app-dir", "backend", "--port", "8000"],
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    frontend_proc = subprocess.Popen(
        "npm --prefix frontend run preview -- --port 5173 --host 127.0.0.1",
        shell=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    # Wait for backend
    for _ in range(20):
        try:
            with urllib.request.urlopen("http://127.0.0.1:8000/api/health") as r:
                if r.status == 200:
                    break
        except Exception:
            time.sleep(0.3)

    # Wait for frontend
    for _ in range(20):
        try:
            with urllib.request.urlopen("http://127.0.0.1:5173") as r:
                if r.status == 200:
                    break
        except Exception:
            time.sleep(0.3)

    # Auth tokens
    def get_token(email, password):
        req = urllib.request.Request(
            "http://127.0.0.1:8000/api/auth/login",
            data=json.dumps({"email": email, "password": password}).encode(),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())

    clerk_data = get_token("clerk@karigar.local", "Clerk@123")
    finance_data = get_token("finance@karigar.local", "Finance@123")

    chrome_cmd = [
        chrome_bin,
        "--headless=new",
        "--remote-debugging-port=9224",
        "--disable-gpu",
        "about:blank",
    ]
    chrome_proc = subprocess.Popen(chrome_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await asyncio.sleep(2)

    all_passed = True
    checked_routes = []

    try:
        with urllib.request.urlopen("http://127.0.0.1:9224/json/list") as r:
            targets = json.loads(r.read().decode())
            ws_url = next(t for t in targets if t["type"] == "page")["webSocketDebuggerUrl"]

        client = CDPClient(ws_url)
        await client.connect()
        await client.send("Runtime.enable")
        await client.send("Log.enable")
        await client.send("Page.enable")

        roles = [
            ("Issue Clerk", clerk_data, ["/issues", "/receipts", "/balances", "/karigars", "/old-gold"]),
            ("Finance Head", finance_data, ["/issues", "/receipts", "/balances", "/karigars", "/old-gold", "/alerts", "/stock"]),
        ]

        # 1. Unauthenticated Login route
        print("\n--- Testing Route: /login (Unauthenticated) ---")
        client.exceptions.clear()
        client.console_errors.clear()
        await client.send("Page.navigate", {"url": "http://localhost:5173/login"})
        await client.pump_events(1.5)
        res = await client.send("Runtime.evaluate", {
            "expression": "document.getElementById('root')?.innerText || ''",
            "returnByValue": True
        })
        text = res.get("result", {}).get("value", "")
        if len(text.strip()) == 0 or client.exceptions:
            print("  FAIL: /login rendered blank or threw exceptions")
            all_passed = False
        else:
            print(f"  PASS: /login rendered ({len(text)} chars)")
            checked_routes.append("Unauthenticated: /login")

        # 2. Test each role
        for role_name, auth_info, routes in roles:
            print(f"\n--- Testing Role: {role_name} ---")
            auth_js = f"""
            localStorage.setItem('karigar_token', '{auth_info['access_token']}');
            localStorage.setItem('karigar_user', JSON.stringify({json.dumps(auth_info['user'])}));
            """
            await client.send("Runtime.evaluate", {"expression": auth_js})

            for route in routes:
                client.exceptions.clear()
                client.console_errors.clear()
                await client.send("Page.navigate", {"url": f"http://localhost:5173{route}"})
                await client.pump_events(2.0)

                res = await client.send("Runtime.evaluate", {
                    "expression": "document.getElementById('root')?.innerText || ''",
                    "returnByValue": True
                })
                text = res.get("result", {}).get("value", "")
                has_exceptions = len(client.exceptions) > 0

                if len(text.strip()) == 0 or has_exceptions:
                    print(f"  FAIL: {route} rendered blank (chars={len(text)}, exceptions={len(client.exceptions)})")
                    for ex in client.exceptions:
                        print("    Exception:", ex.get("exceptionDetails", {}).get("text"), ex.get("exceptionDetails", {}).get("exception", {}).get("description"))
                    all_passed = False
                else:
                    print(f"  PASS: {route} rendered ({len(text)} chars, 0 uncaught errors)")
                    checked_routes.append(f"{role_name}: {route}")

        print("\n=== ROUTE CHECK SUMMARY ===")
        for r in checked_routes:
            print(f"  [OK] {r}")

        if all_passed:
            print("\n[SUCCESS] All routes rendered with non-empty content and zero thrown errors!")
        else:
            print("\n[FAILURE] One or more routes failed rendering!")
            sys.exit(1)

    finally:
        chrome_proc.terminate()
        backend_proc.terminate()
        frontend_proc.terminate()

if __name__ == "__main__":
    asyncio.run(main())
