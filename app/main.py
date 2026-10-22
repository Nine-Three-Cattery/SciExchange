"""Run with: uvicorn app.main:app --host 127.0.0.1 --port 8000."""

from contextlib import asynccontextmanager

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException

from app.api.v1 import analysis, barter, compiler, science_review, slices, vault
from app.core.config import Settings
from app.core.security import load_cipher
from app.core.x402_middleware import X402Middleware, envelope
from app.database import Base, make_engine
from app.services.slice_service import import_slices
from app.services.vault_service import import_legacy_grants


def create_app(settings: Settings | None = None) -> FastAPI:
    config = settings or Settings()

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        config.state_dir.mkdir(parents=True, exist_ok=True)
        application.state.cipher = load_cipher(config.state_dir)
        application.state.pi_public_keys = {
            address: key.removeprefix("0x").lower() for address, key in config.public_keys().items()}
        for key in application.state.pi_public_keys.values():
            Ed25519PublicKey.from_public_bytes(bytes.fromhex(key))
        engine = make_engine(config.database_url or f"sqlite:///{config.state_dir / 'sciexchange.sqlite'}")
        application.state.engine = engine
        try:
            Base.metadata.create_all(engine)
            with Session(engine) as session:
                import_slices(session, config.data_dir, application.state.cipher)
                import_legacy_grants(session)
            yield
        finally:
            engine.dispose()

    application = FastAPI(title="SciExchange", version="4.0.0", lifespan=lifespan,
                          description="Numerical scientific protocol checks and PI-authorized local data exchange.")
    application.add_middleware(X402Middleware)
    application.add_middleware(CORSMiddleware, allow_origins=config.cors_origins,
                               allow_credentials=False, allow_methods=["GET", "POST", "OPTIONS"],
                               allow_headers=["Authorization", "Content-Type", "X-Payment-Receipt",
                                              "X-PI-Address", "X-PI-Signature", "X-PI-Expires-At"],
                               expose_headers=["x402-Version", "x402-Price", "x402-Currency", "x402-Payee",
                                               "x402-Challenge", "X-Payment-Required", "X-Payment-Amount",
                                               "X-Payment-Token", "X-Payment-Address", "X-Settlement-Network"])

    @application.exception_handler(HTTPException)
    async def http_error(_request: Request, error: HTTPException) -> JSONResponse:
        return JSONResponse(envelope(None, error.status_code, str(error.detail)),
                            status_code=error.status_code, headers=error.headers)

    @application.exception_handler(RequestValidationError)
    async def validation_error(_request: Request, error: RequestValidationError) -> JSONResponse:
        # Return field locations without reflecting credentials or untrusted input values.
        details = [{"location": list(item["loc"]), "type": item["type"]} for item in error.errors()]
        return JSONResponse(envelope(details, 422, "Request validation failed"), status_code=422)

    @application.get("/health")
    def health(request: Request) -> dict:
        with request.app.state.engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return envelope({"status": "ok", "database": "sqlite", "version": "4.0.0"})

    for router in (compiler.router, science_review.router, slices.router, barter.router, vault.router, analysis.router):
        application.include_router(router, prefix="/api/v1")
    return application


app = create_app()
