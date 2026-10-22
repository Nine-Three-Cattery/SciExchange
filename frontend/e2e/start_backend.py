"""Start the real gateway using disposable, frontend-owned E2E state."""

from __future__ import annotations

import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import uvicorn

from app.core.config import Settings
from app.main import create_app
from scripts.seed_slices import generate_slices
from scripts.setup_demo import setup_identities


def main() -> None:
    state_dir = Path(os.environ["SCIEXCHANGE_E2E_STATE_DIR"]).resolve()
    frontend_cache = (ROOT / "frontend" / ".cache").resolve()
    if not state_dir.is_relative_to(frontend_cache):
        raise ValueError("Browser-test state must remain inside frontend/.cache")
    state_dir.mkdir(parents=True, exist_ok=True)
    generate_slices(state_dir / "slices")
    public_keys = setup_identities(state_dir)
    settings = Settings(
        state_dir=state_dir,
        data_dir=state_dir / "slices",
        pi_public_keys=public_keys,
        cors_origins=["http://127.0.0.1:5174"],
    )
    uvicorn.run(create_app(settings), host="127.0.0.1", port=8766, log_level="warning")


if __name__ == "__main__":
    main()
