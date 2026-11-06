"""Verification script for production API readiness and role enforcement."""

import os
import sys
import time
import subprocess
import requests

def main():
    port = 8888
    env = os.environ.copy()
    env["PYTHONPATH"] = "backend"
    env["PORT"] = str(port)
    env["JWT_SECRET"] = "production-ready-jwt-secret-with-minimum-32-characters"
    env["DATABASE_URL"] = "postgresql+psycopg://postgres:postgres@localhost:5432/karigar_ledger"
    env["CORS_ORIGINS"] = "http://localhost:5173,http://localhost:3000"

    print(f"[*] Starting uvicorn on port {port} in clean production mode...")
    proc = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--app-dir",
            "backend",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
        ],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    base_url = f"http://127.0.0.1:{port}"
    try:
        # 1. Wait for server to become responsive
        max_retries = 30
        healthy = False
        for i in range(max_retries):
            try:
                r = requests.get(f"{base_url}/api/health", timeout=2)
                if r.status_code == 200:
                    healthy = True
                    break
            except Exception:
                time.sleep(0.5)

        if not healthy:
            print("[!] Server failed to start within timeout. Stderr:")
            out, err = proc.communicate(timeout=5)
            print(err)
            sys.exit(1)

        print("[+] 1. Health check probe: GET /api/health")
        resp = requests.get(f"{base_url}/api/health")
        print(f"    Status: {resp.status_code}, Body: {resp.json()}")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}

        # 2. Login as clerk
        print("[+] 2. Authenticate as Issue Clerk (clerk@workshop.local)")
        clerk_resp = requests.post(
            f"{base_url}/api/auth/login",
            json={"email": "clerk@workshop.local", "password": "clerk123"},
        )
        print(f"    Status: {clerk_resp.status_code}, Body: {clerk_resp.text}")
        assert clerk_resp.status_code == 200
        clerk_token = clerk_resp.json()["access_token"]
        clerk_headers = {"Authorization": f"Bearer {clerk_token}"}

        # 3. Login as finance head
        print("[+] 3. Authenticate as Finance Head (finance@workshop.local)")
        finance_resp = requests.post(
            f"{base_url}/api/auth/login",
            json={"email": "finance@workshop.local", "password": "finance123"},
        )
        print(f"    Status: {finance_resp.status_code}, Role: {finance_resp.json().get('user', {}).get('role')}")
        assert finance_resp.status_code == 200
        finance_token = finance_resp.json()["access_token"]
        finance_headers = {"Authorization": f"Bearer {finance_token}"}

        # 4. Show clerk getting 403 on /api/alerts
        print("[+] 4. Clerk access to /api/alerts:")
        r_alerts = requests.get(f"{base_url}/api/alerts", headers=clerk_headers)
        print(f"    Status: {r_alerts.status_code}, Detail: {r_alerts.json()}")
        assert r_alerts.status_code == 403

        # 5. Show clerk getting 403 on /api/stock
        print("[+] 5. Clerk access to /api/stock:")
        r_stock = requests.get(f"{base_url}/api/stock", headers=clerk_headers)
        print(f"    Status: {r_stock.status_code}, Detail: {r_stock.json()}")
        assert r_stock.status_code == 403

        # 6. Verify finance head gets 200 on both
        print("[+] 6. Finance Head access to /api/alerts and /api/stock:")
        f_alerts = requests.get(f"{base_url}/api/alerts", headers=finance_headers)
        print(f"    /api/alerts Status: {f_alerts.status_code}, Alerts count: {len(f_alerts.json())}")
        assert f_alerts.status_code == 200

        f_stock = requests.get(f"{base_url}/api/stock", headers=finance_headers)
        print(f"    /api/stock Status: {f_stock.status_code}, Total workshop fine mg: {f_stock.json().get('total_workshop_fine_mg')}")
        assert f_stock.status_code == 200

        print("\n[SUCCESS] All production verification checks passed cleanly!")

    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()

if __name__ == "__main__":
    main()
