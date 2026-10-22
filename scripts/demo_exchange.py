"""Exercise a running local gateway using signatures created on the client.

Usage: python3 scripts/demo_exchange.py --base-url http://127.0.0.1:8000
Requires seed_slices.py and setup_demo.py to have run before gateway startup.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import load_pem_private_key
import httpx

ROOT = Path(__file__).resolve().parents[1]


def sign(state_dir: Path, lab: str, message: str) -> str:
    key = load_pem_private_key((state_dir / "client_keys" / f"{lab}.pem").read_bytes(), password=None)
    if not isinstance(key, Ed25519PrivateKey):
        raise ValueError("The client identity must be an Ed25519 private key")
    return key.sign(message.encode()).hex()


def run_demo(base_url: str, state_dir: Path) -> dict:
    with httpx.Client(base_url=base_url, timeout=30) as client:
        def post(path: str, payload: dict) -> dict:
            response = client.post(path, json=payload)
            response.raise_for_status()
            return response.json()["data"]

        client.get("/health").raise_for_status()
        reports = {}
        for slice_id in ("slice_oer_valid", "slice_battery_valid", "slice_oer_violation", "slice_cwc_poison"):
            reports[slice_id] = post("/api/v1/compiler/verify", {"slice_id": slice_id})
        if not reports["slice_oer_valid"]["valid"] or not reports["slice_battery_valid"]["valid"]:
            raise RuntimeError("A positive scientific benchmark failed compilation")
        if reports["slice_oer_violation"]["valid"] or reports["slice_cwc_poison"]["valid"]:
            raise RuntimeError("A negative benchmark was incorrectly accepted")
        download_path = "/api/v1/slices/slice_oer_valid/download"
        if client.get(download_path).status_code != 402:
            raise RuntimeError("A protected slice failed to issue an x402 challenge")
        proposal = post("/api/v1/barter/negotiate", {
            "party_a_lab": "lab_catalysis", "party_a_slice_id": "slice_oer_valid",
            "party_b_lab": "lab_battery", "party_b_slice_id": "slice_battery_valid",
        })
        signatures = []
        for role, lab in (("pi_proposer", "lab_catalysis"), ("pi_target", "lab_battery")):
            signatures.append({"proposal_id": proposal["proposal_id"], "signer_role": role,
                               "signer_address": lab,
                               "signature": sign(state_dir, lab, proposal["canonical_agreement"])})
        first = post("/api/v1/barter/dual-sign", signatures[0])
        if first["status"] != "PENDING_SECOND_PI_SIGNATURE" or client.get(download_path).status_code != 402:
            raise RuntimeError("A single PI signature released the data")
        second = post("/api/v1/barter/dual-sign", signatures[1])
        poll = client.get(f"/api/v1/barter/proposals/{proposal['proposal_id']}", headers={
            "X-PI-Address": signatures[0]["signer_address"], "X-PI-Signature": signatures[0]["signature"]})
        poll.raise_for_status()
        first = poll.json()["data"]
        counts = {}
        for approval in (first, second):
            identifier = approval["downloaded_slice_id"]
            response = client.get(f"/api/v1/slices/{identifier}/download", params={"format": "json"},
                                  headers={"Authorization": f"Bearer {approval['download_token']}"})
            response.raise_for_status()
            counts[identifier] = len(response.json()["rows"])
        return {"gateway": base_url, "status": second["status"], "downloaded_rows": counts,
                "compiler_statuses": {identifier: report["compiler_status"] for identifier, report in reports.items()},
                "private_keys_transmitted": False}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--state-dir", type=Path, default=ROOT / ".sciexchange")
    args = parser.parse_args()
    print(json.dumps(run_demo(args.base_url, args.state_dir), indent=2))


if __name__ == "__main__":
    main()
