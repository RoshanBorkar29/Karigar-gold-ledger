# Deployment

## Run locally

### 1. Prerequisites
- Python 3.12+
- Docker and Docker Compose (or a local PostgreSQL 16+ instance)

### 2. Environment Configuration
Copy the template and configure your local environment:
```bash
cp .env.example .env
```
Ensure `DATABASE_URL` is configured to point to your PostgreSQL instance:
```env
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/karigar_ledger
DATABASE_URL_TEST=postgresql+psycopg://postgres:postgres@localhost:5432/karigar_ledger_test
SEED_CLERK_PASSWORD=Clerk@123
SEED_FINANCE_PASSWORD=Finance@123
```

### 3. Start PostgreSQL Service
Start the local PostgreSQL container via Docker Compose:
```bash
docker compose up -d
```

### 4. Install Dependencies
```bash
python -m venv .venv
# On Windows: .venv\Scripts\activate
# On Linux/macOS: source .venv/bin/activate
pip install -r backend/requirements.txt
```

### 5. Run Database Migrations
Apply the initial schema migration via Alembic:
```bash
alembic -c backend/alembic.ini upgrade head
```

### 6. Seed Sample Data
Execute the idempotent seed script to populate demo users, categories, karigars, and initial sample transactions:
```bash
python backend/seed.py
```

### 7. Run Automated Tests
Run unit and integration test suites:
```bash
pytest backend/tests/test_gold.py backend/tests/test_db_constraints.py -v
```

## Deployment

## Env variables

- `DATABASE_URL`: PostgreSQL connection string using the psycopg 3 driver (`postgresql+psycopg://...`).
- `DATABASE_URL_TEST`: Dedicated test database for constraint and transaction rollback suites.
- `JWT_SECRET`: Secret key for signing authentication tokens.
- `JWT_EXPIRE_MINUTES`: Token lifetime in minutes.
- `GROQ_API_KEY`: API key for Groq vision and language inference.
- `GROQ_VISION_MODEL`: Model identifier for scale and karat OCR readings.
- `GROQ_TEXT_MODEL`: Model identifier for non-accusatory loss drift explanations.
- `CORS_ORIGINS`: Allowed origins for API requests.
- `VITE_API_URL`: Backend API base URL for frontend clients.
- `SEED_CLERK_PASSWORD`: Initial password for the seeded issue clerk account.
- `SEED_FINANCE_PASSWORD`: Initial password for the seeded finance head account.

## Demo logins

- **Issue Clerk**:
  - Email: `clerk@karigar.local`
  - Password: `${SEED_CLERK_PASSWORD}` (Default: `Clerk@123`)
  - Permissions: Issues, receipts, scale reader, artisan balance views.

- **Finance Head**:
  - Email: `finance@karigar.local`
  - Password: `${SEED_FINANCE_PASSWORD}` (Default: `Finance@123`)
  - Permissions: Complete clerk permissions + loss-drift alerts, daily stock statements, Tally CSV exports.
