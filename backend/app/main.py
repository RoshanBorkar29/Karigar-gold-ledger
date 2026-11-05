"""FastAPI application entrypoint.

Configures CORS middleware, domain exception handlers, and mounts API routers.
"""

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api import (
    ai,
    alerts,
    auth,
    balances,
    categories,
    exports,
    issues,
    karigars,
    old_gold,
    receipts,
    stock,
)
from app.core.config import settings
from app.core.limiter import limiter
from app.services.errors import (
    InvalidEntryError,
    JobClosedError,
    LedgerError,
    NotFoundError,
    OverReturnError,
)

app = FastAPI(
    title="Karigar Gold Ledger API",
    description="Operational ledger for bullion issues, returns, and wastage tracking.",
    version="0.1.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure CORS
origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Register domain exception handlers
@app.exception_handler(NotFoundError)
async def not_found_handler(_: Request, exc: NotFoundError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"detail": str(exc)},
    )


@app.exception_handler(JobClosedError)
async def job_closed_handler(_: Request, exc: JobClosedError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": str(exc)},
    )


@app.exception_handler(InvalidEntryError)
async def invalid_entry_handler(_: Request, exc: InvalidEntryError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": str(exc)},
    )


@app.exception_handler(OverReturnError)
async def over_return_handler(_: Request, exc: OverReturnError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": str(exc)},
    )


@app.exception_handler(LedgerError)
async def ledger_error_handler(_: Request, exc: LedgerError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": str(exc)},
    )


# Health check endpoint
@app.get("/api/health", tags=["system"])
def health_check() -> dict[str, str]:
    """Lightweight readiness and liveness probe."""
    return {"status": "ok"}


# Mount API routers
app.include_router(auth.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(karigars.router, prefix="/api")
app.include_router(issues.router, prefix="/api")
app.include_router(receipts.router, prefix="/api")
app.include_router(balances.router, prefix="/api")
app.include_router(alerts.router, prefix="/api")
app.include_router(stock.router, prefix="/api")
app.include_router(exports.router, prefix="/api")
app.include_router(old_gold.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
