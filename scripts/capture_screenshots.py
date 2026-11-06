"""Script to capture UI screenshots at 1440px (desktop) and 390px (mobile)
and measure page / form heights for Issue, Receipt, and Old gold.

Uses Chrome DevTools Protocol (CDP) directly via websockets.
"""

import asyncio
import base64
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

OUTPUT_DIR = Path("docs/screenshots")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def find_chrome():
    for p in CHROME_PATHS:
        if os.path.exists(p):
            return p
    raise RuntimeError("Chrome or Edge binary not found")

class CDPClient:
    def __init__(self, ws_url):
        self.ws_url = ws_url
        self.ws = None
        self._msg_id = 0

    async def connect(self):
        self.ws = await websockets.connect(self.ws_url, max_size=100 * 1024 * 1024)

    async def send(self, method, params=None):
        self._msg_id += 1
        msg = {"id": self._msg_id, "method": method, "params": params or {}}
        await self.ws.send(json.dumps(msg))
        while True:
            resp_raw = await self.ws.recv()
            resp = json.loads(resp_raw)
            if resp.get("id") == self._msg_id:
                if "error" in resp:
                    raise RuntimeError(f"CDP error: {resp['error']}")
                return resp.get("result", {})

    async def set_viewport(self, width, height, is_mobile=False):
        await self.send("Emulation.setDeviceMetricsOverride", {
            "width": width,
            "height": height,
            "deviceScaleFactor": 1,
            "mobile": is_mobile,
        })
        await self.send("Emulation.setVisibleSize", {"width": width, "height": height})

    async def navigate(self, url, wait_seconds=2.5):
        await self.send("Page.navigate", {"url": url})
        await asyncio.sleep(wait_seconds)

    async def evaluate(self, expression):
        return await self.send("Runtime.evaluate", {
            "expression": expression,
            "returnByValue": True,
            "awaitPromise": True,
        })

    async def screenshot(self, output_path):
        res = await self.send("Page.captureScreenshot", {"format": "png"})
        data = base64.b64decode(res["data"])
        with open(output_path, "wb") as f:
            f.write(data)
        print(f"[+] Saved {output_path} ({len(data)} bytes)")

    async def close(self):
        if self.ws:
            await self.ws.close()

def login_attempt(email, password):
    req = urllib.request.Request(
        "http://127.0.0.1:8000/api/auth/login",
        data=json.dumps({"email": email, "password": password}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

async def main():
    chrome_bin = find_chrome()
    print(f"[*] Found browser: {chrome_bin}")

    env = os.environ.copy()
    env["PYTHONPATH"] = "backend"
    env["PORT"] = "8000"
    env["JWT_SECRET"] = "super-secret-karigar-key-coimbatore-workshop"
    env["DATABASE_URL"] = "postgresql+psycopg://postgres:postgres@localhost:5432/karigar_ledger"

    python_bin = sys.executable
    venv_py = Path("backend/.venv/Scripts/python.exe").resolve()
    if venv_py.exists():
        python_bin = str(venv_py)

    # 1. Start backend uvicorn process
    backend_proc = subprocess.Popen(
        [python_bin, "-m", "uvicorn", "app.main:app", "--app-dir", "backend", "--port", "8000"],
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    print("[*] Started backend on port 8000")

    # 2. Start frontend preview on port 5173
    frontend_proc = subprocess.Popen(
        "npm --prefix frontend run preview -- --port 5173 --host 127.0.0.1",
        shell=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    print("[*] Started frontend preview on port 5173")

    time.sleep(3)

    # 3. Get Clerk and Finance tokens from backend
    clerk_data = None
    for cred in [("clerk@karigar.local", "Clerk@123"), ("clerk@workshop.local", "clerk123")]:
        try:
            clerk_data = login_attempt(cred[0], cred[1])
            print(f"[+] Logged in as Clerk using {cred[0]}")
            break
        except Exception:
            pass

    finance_data = None
    for cred in [("finance@karigar.local", "Finance@123"), ("finance@workshop.local", "finance123")]:
        try:
            finance_data = login_attempt(cred[0], cred[1])
            print(f"[+] Logged in as Finance Head using {cred[0]}")
            break
        except Exception:
            pass

    if not clerk_data or not finance_data:
        raise RuntimeError("Could not authenticate clerk or finance head against running backend")

    clerk_token = clerk_data["access_token"]
    clerk_user = clerk_data["user"]
    finance_token = finance_data["access_token"]
    finance_user = finance_data["user"]

    # 4. Launch headless Chrome with CDP
    user_data_dir = Path("scratch/chrome_profile").resolve()
    user_data_dir.mkdir(parents=True, exist_ok=True)

    chrome_cmd = [
        chrome_bin,
        "--headless=new",
        "--remote-debugging-port=9222",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        f"--user-data-dir={user_data_dir}",
        "about:blank",
    ]
    chrome_proc = subprocess.Popen(chrome_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print("[*] Started headless Chrome on port 9222")

    await asyncio.sleep(2)

    try:
        with urllib.request.urlopen("http://127.0.0.1:9222/json/list") as r:
            targets = json.loads(r.read().decode())
            page_target = next(t for t in targets if t["type"] == "page")
            ws_url = page_target["webSocketDebuggerUrl"]

        client = CDPClient(ws_url)
        await client.connect()
        await client.send("Page.enable")
        await client.send("Runtime.enable")

        async def capture_both(route, filename_base, wait=3.0):
            # Desktop 1440px wide x 900px high
            await client.set_viewport(1440, 900, is_mobile=False)
            await client.navigate(f"http://localhost:5173{route}", wait_seconds=wait)
            await client.screenshot(OUTPUT_DIR / f"{filename_base}-1440.png")

            # Measure height at 1440x900
            height_res = await client.evaluate("""
                (() => {
                    const form = document.querySelector('form');
                    const formRect = form ? form.getBoundingClientRect() : null;
                    return {
                        scrollHeight: document.documentElement.scrollHeight,
                        clientHeight: document.documentElement.clientHeight,
                        formHeight: formRect ? Math.round(formRect.height) : null
                    };
                })()
            """)
            print(f"[MEASURE {filename_base} @ 1440x900]: {height_res.get('result', {}).get('value')}")

            # Mobile 390px wide x 844px high
            await client.set_viewport(390, 844, is_mobile=True)
            await asyncio.sleep(1.0)
            await client.screenshot(OUTPUT_DIR / f"{filename_base}-390.png")

        # Session scripts
        clerk_js = f"""
        localStorage.setItem('karigar_token', '{clerk_token}');
        localStorage.setItem('karigar_user', JSON.stringify({json.dumps(clerk_user)}));
        """

        finance_js = f"""
        localStorage.setItem('karigar_token', '{finance_token}');
        localStorage.setItem('karigar_user', JSON.stringify({json.dumps(finance_user)}));
        """

        clear_auth_js = """
        localStorage.removeItem('karigar_token');
        localStorage.removeItem('karigar_user');
        """

        # 1. Login
        print("[*] 1. Capturing Login screen...")
        await client.navigate("http://localhost:5173/login", wait_seconds=1.5)
        await client.evaluate(clear_auth_js)
        await capture_both("/login", "login", wait=2.0)

        # 2. Issue Entry (Clerk)
        print("[*] 2. Capturing Issue Entry screen (Clerk)...")
        await client.evaluate(clerk_js)
        await capture_both("/issues", "issues", wait=3.0)

        # 3. Receipt Entry (Clerk)
        print("[*] 3. Capturing Receipt Entry screen (Clerk)...")
        await client.evaluate(clerk_js)
        await capture_both("/receipts", "receipts", wait=3.0)

        # 4. Old Gold (Clerk)
        print("[*] 4. Capturing Old Gold Desk screen (Clerk)...")
        await client.evaluate(clerk_js)
        await capture_both("/old-gold", "old-gold", wait=3.0)

        # 5. Balances (Clerk)
        print("[*] 5. Capturing Karigar Balances screen (Clerk)...")
        await client.evaluate(clerk_js)
        await capture_both("/balances", "balances", wait=3.0)

        # 6. Loss Alerts (Finance Head)
        print("[*] 6. Capturing Loss Alerts screen (Finance Head)...")
        await client.evaluate(finance_js)
        await capture_both("/alerts", "alerts", wait=3.0)

        # 7. Daily Stock (Finance Head)
        print("[*] 7. Capturing Daily Stock screen (Finance Head)...")
        await client.evaluate(finance_js)
        await capture_both("/stock", "stock", wait=3.0)

        await client.close()
        print("[SUCCESS] All 14 screenshots captured successfully!")

    finally:
        chrome_proc.terminate()
        backend_proc.terminate()
        frontend_proc.terminate()
        print("[*] Cleaned up browser and servers.")

if __name__ == "__main__":
    asyncio.run(main())
