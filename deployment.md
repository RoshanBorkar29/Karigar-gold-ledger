# Karigar Gold Ledger — Deployment & Operations Guide

Production and local operations manual for the **Karigar Gold Ledger & Old-Gold Compliance Desk**.

---

## 1. Local Run Steps

### Prerequisites
- **Python**: Pinned to **Python 3.12** (defined in `runtime.txt` and `.python-version`).
- **Node.js**: Node 18+ and npm.
- **Docker & Docker Compose**: For local PostgreSQL 16 engine.

### Step-by-Step Local Setup

1. **Start PostgreSQL Container**
   ```bash
   docker compose up -d
   ```
   *Starts a local Postgres database on port `5432` with databases `karigar_ledger` and `karigar_test`.*

2. **Configure Local Environment**
   ```bash
   cp .env.example .env
   ```
   Ensure `.env` contains:
   - `JWT_SECRET` (at least 32 characters; the app strictly refuses to start if missing or `< 32` characters).
   - `DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/karigar_ledger`
   - `DATABASE_URL_TEST=postgresql+psycopg://postgres:postgres@localhost:5432/karigar_test`
   - `CORS_ORIGINS=http://localhost:5173,http://localhost:3000`

3. **Install Backend Dependencies**
   ```bash
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # Linux / macOS:
   source .venv/bin/activate

   pip install -r requirements.txt
   ```

4. **Run Database Migrations**
   Apply Alembic migrations to build the complete ledger schema, check constraints, and `txn_seq` sequence:
   ```bash
   alembic upgrade head
   ```

5. **Seed Demo Data & Multi-Karigar History**
   Populate users, item categories, agreed wastage matrices, historical closed jobs, vault bullion movements, and Murugesan's active job (`JOB-2026-001`):
   ```bash
   python seed.py
   ```

6. **Run the Backend API Server**
   Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --app-dir backend --reload --port 8000
   ```
   *Readiness probe will be live at `http://localhost:8000/api/health`.*

7. **Install & Run Frontend**
   In a separate terminal:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   *Access the web UI at `http://localhost:5173`.*

8. **Execute Automated Tests**
   Run the full 234-test automated verification suite against the isolated test database:
   ```bash
   # In PowerShell:
   $env:PYTHONPATH="backend"
   $env:DATABASE_URL_TEST="postgresql+psycopg://postgres:postgres@localhost:5432/karigar_test"
   pytest backend/tests -v
   ```
   *Expected result: 234 passed, 0 failed, 0 skipped.*

---

## 2. Cloud Hosting Steps

### A. Neon (Serverless PostgreSQL Database)
1. Log in to [Neon.tech](https://neon.tech) and create a new project (e.g. `karigar-gold-ledger`).
2. Copy the connection string from the Neon dashboard.
3. **Format Transformation**:
   - SQLAlchemy with `psycopg 3` requires the `postgresql+psycopg://` URL scheme.
   - SSL is required by Neon: append `?sslmode=require`.
   - **Target Connection URI**:
     ```text
     postgresql+psycopg://[user]:[password]@[ep-xyz].region.aws.neon.tech/[dbname]?sslmode=require
     ```
4. Note: Neon does not drop connections during idle periods and provides point-in-time recovery.

---

### B. Render or Railway (Backend API Service)
1. **Repository**: Connect your GitHub repository.
2. **Environment & Runtime**:
   - Python version **3.12** is automatically detected via `runtime.txt` (`python-3.12.9`) and `.python-version`.
3. **Build Command**:
   ```bash
   pip install -r requirements.txt
   ```
4. **Pre-Deploy / Release Command** (Runs migrations before container switch):
   ```bash
   alembic upgrade head
   ```
5. **Start Command**:
   ```bash
   uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port $PORT
   ```
   *(Also specified in repository `render.yaml` and `Procfile`).*
6. **Populating Hosted Database**:
   Once the service is deployed, open the Render/Railway web shell and run the seed script:
   ```bash
   python seed.py
   ```
   *The seed script reads `DATABASE_URL` directly from the environment and is completely idempotent.*
7. **Free Tier Cold Starts**:
   > [!NOTE]
   > Free/hobby instance tiers spin down after 15 minutes of inactivity. The first request after a period of dormancy may take **30 to 60 seconds** to complete container wakeup.

---

### C. Vercel or Netlify (Frontend Single Page Application)
1. Connect your repository to [Vercel](https://vercel.com) or [Netlify](https://netlify.com).
2. **Build Settings**:
   - **Root Directory**: `frontend` (or repository root; root configurations `vercel.json` and `netlify.toml` are provided).
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. **SPA Routing**:
   - Configured in `frontend/vercel.json` and `frontend/netlify.toml` using wildcard rewrites to `/index.html` to guarantee that client-side routes (e.g. `/alerts`, `/stock`, `/issues`) resolve properly on hard refresh.
4. **Build Time Environment Variable**:
   - Set `VITE_API_URL` to the public HTTPS URL of your Render/Railway backend (e.g. `https://karigar-api.onrender.com`).

---

## 3. Environment Variable Reference (Grouped by Service)

### Backend Service (Render / Railway)
- `DATABASE_URL` (Required: Neon PostgreSQL URI with `postgresql+psycopg://` and `?sslmode=require`)
- `DATABASE_URL_TEST` (Optional: only needed in CI/CD test runners)
- `JWT_SECRET` (Required: minimum 32 characters, no default; server halts if missing or $< 32$ chars)
- `JWT_EXPIRE_MINUTES` (Optional: defaults to `1440` minutes / 24 hours)
- `CORS_ORIGINS` (Required: comma-separated list of production frontend URLs, e.g. `https://karigar.vercel.app`)
- `GROQ_API_KEY` (Required for AI Vision OCR & reasoning; falls back cleanly to manual entry if omitted)
- `GROQ_VISION_MODEL` (e.g., `llama-3.2-11b-vision-preview` or `llama-3.2-90b-vision-preview`)
- `GROQ_TEXT_MODEL` (e.g., `llama-3.3-70b-versatile` or `llama-3.1-8b-instant`)
- `OLD_GOLD_HIGH_VALUE_THRESHOLD_PAISE` (Client policy threshold: `20000000` paise = Rs 2,00,000)
- `OLD_GOLD_PAN_REQUIRED_THRESHOLD_PAISE` (Client policy threshold: `5000000` paise = Rs 50,000)
- `SEED_CLERK_PASSWORD` (Initial password for `clerk@karigar.local`)
- `SEED_FINANCE_PASSWORD` (Initial password for `finance@karigar.local`)
- `PORT` (Provided dynamically by host)

### Frontend Service (Vercel / Netlify)
- `VITE_API_URL` (Required at build time: URL of backend API, without trailing slash)

---

## 4. Demo Accounts & Credentials

Passwords are intentionally excluded from application source code. Retrieve passwords according to the table below:

| Account Email | Assigned Role | Password Location | System Permissions |
| :--- | :--- | :--- | :--- |
| `clerk@karigar.local` | Issue Clerk | Set via `SEED_CLERK_PASSWORD` in `.env` (default: `Clerk@123`) | Job Orders, Issues, Receipts, Old-Gold Intake, Optical OCR |
| `finance@karigar.local` | Finance Head | Set via `SEED_FINANCE_PASSWORD` in `.env` (default: `Finance@123`) | Complete oversight, Loss Drift Alerts, Stock Statements, Vault Movements, Tally Exports |
| `clerk@workshop.local` | Issue Clerk | Pre-seeded development alias (`clerk123`) | Issue Clerk permissions |
| `finance@workshop.local` | Finance Head | Pre-seeded development alias (`finance123`) | Finance Head permissions |

---

## 5. Reviewer Demonstration Test Script (8 Steps)

Follow this 8-step walkthrough to thoroughly verify the application, the Murugesan core flow, and role-based access controls:

### Step 1: Health & Readiness Probe
- Send a request to `GET /api/health`.
- **Expected Outcome**: HTTP `200 OK` with payload `{"status": "ok"}`. No internal database connection details or stack info is leaked.

### Step 2: Dual Role Login & Token Issuance
- Navigate to the login page (`/`).
- Click "Prefill Demo Account" for **Issue Clerk** (`clerk@workshop.local` or `clerk@karigar.local`).
- Enter the password (`clerk123` or `Clerk@123`).
- **Expected Outcome**: Returns HTTP `200 OK` with a signed JWT; redirects clerk to `/issues`.

### Step 3: Role-Based Authorization Enforcement
- While signed in as Issue Clerk, attempt to access privileged endpoints:
  - Open `/alerts` in the browser or send `GET /api/alerts`.
  - Open `/stock` in the browser or send `GET /api/stock`.
  - Send `POST /api/stock/movements`.
- **Expected Outcome**: The API strictly rejects the clerk with HTTP `403 Forbidden`. The UI surfaces an "Access Denied — Finance Head role required" banner.

### Step 4: Inspect Murugesan S Sample Job (`JOB-2026-001`)
- Navigate to Karigar Balances or query `GET /api/balances/karigars/1`.
- Verify the active order `JOB-2026-001` for artisan Murugesan S:
  - **Issued Fine Gold**: `109,920 mg` (from `TX-30411`: 120,000 mg @ 91.60% purity).
  - **Finished Receipt**: `103,004 mg` (from `TX-30437`: 112,450 mg @ 91.60% purity, HUID: `HUID-916-8842`).
  - **Scrap Receipt**: `3,023 mg` (from `TX-30438`: 3,300 mg @ 91.60% purity).
  - **Returned Fine Gold**: `106,027 mg`.
  - **Current Outstanding**: `3,893 mg`.
  - **Allowed Wastage**: `3,298 mg` (agreed 3.00% snapshot applied to issued fine weight).
  - **Status**: `outstanding_beyond_allowance` (excess: `595 mg`).

### Step 5: Optical Scale Assist & Mismatch Protection
- Open the **Issue Gold** screen (`/issues`).
- Select an open job. Upload or capture a scale display photo via the Photo Reader.
- If Groq is unconfigured or unavailable, verify that the system cleanly displays the manual entry fallback notice.
- If an OCR reading is confirmed (`ai_reading_id`), edit the typed weight in the form to a differing value and submit.
- **Expected Outcome**: The API server strictly rejects the request with HTTP `422 Unprocessable Entity` ("Entered value does not match confirmed AI reading"), preventing clerical tampering.

### Step 6: Receipt Entry with BIS Hallmarking (HUID) Enforcement
- Open the **Receipt Entry** screen (`/receipts`).
- Select kind **Finished**: Submit with an invalid or missing HUID.
  - **Expected Outcome**: Rejection requiring an exact 6-character uppercase alphanumeric HUID (e.g., `AB1234`).
- Select kind **Scrap** or **Filings**: Submit with a HUID provided.
  - **Expected Outcome**: Database and API check constraints reject non-null HUIDs on scrap/filings.

### Step 7: Ledger Immutability & Audit Entry Voiding
- Note that `PUT` and `DELETE` HTTP methods do not exist on `/api/issues` or `/api/receipts`.
- As Issue Clerk or Finance Head, submit an entry void via `POST /api/ledger/entries/void`:
  - Supply `issue_id` or `receipt_id` with an audit reason shorter than 5 characters.
  - **Expected Outcome**: Rejected with HTTP `422` (reason must be $\ge 5$ characters).
  - Supply a valid reason (e.g. `"Clerical typo on gross weight entry"`).
  - **Expected Outcome**: HTTP `200 OK`. The entry is voided via immutable `entry_voids` audit record; balances update dynamically. Re-attempting to void the same transaction is rejected.

### Step 8: Finance Oversight, Vault Movements & Loss Drift Alerts
- Sign out and log in as **Finance Head** (`finance@workshop.local` / `finance123`).
- **Daily Stock Statement (`/stock`)**:
  - Review the dual-tier stock statement: Total Workshop Fine Gold = Vault Bullion Balance + Karigar WIP Balance.
  - Test recording a vault bullion intake (`bullion_in`) and verify immediate stock update.
  - Attempt a refiner transfer (`to_refiner`) exceeding available vault stock and verify HTTP `400 Bad Request` balance protection.
- **Statistical Loss Drift (`/alerts`)**:
  - Open `/alerts`. Observe the anomaly alert flagged for artisan **Selvam P (K-003)**.
  - Verify that the alert adheres to the baseline criteria ($\ge 3$ completed jobs baseline, $2\sigma + 50\text{ bp}$ upward drift threshold).
  - Generate an AI explanatory narrative and click "Mark Reviewed" to resolve the audit trail.
