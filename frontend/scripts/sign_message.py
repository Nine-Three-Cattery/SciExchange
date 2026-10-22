"""Sign a reviewed gateway message locally; only the hex signature is returned.

From the repository root:
  .venv/bin/python frontend/scripts/sign_message.py --lab lab_catalysis --message-file agreement.txt
Use --message-file - to read the copied message from stdin. Private keys never
enter the browser or an HTTP request. An optional --key selects a client PEM.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import load_pem_private_key


def sign_message(message: str, lab: str, key_path: Path) -> str:
    payload = json.loads(message)
    participants = {payload.get(field) for field in (
        "party_a_lab", "party_b_lab", "staker_address", "owner_lab_id")}
    if lab not in participants:
        raise ValueError("This lab is not a signer of the selected message")
    key = load_pem_private_key(key_path.read_bytes(), password=None)
    if not isinstance(key, Ed25519PrivateKey):
        raise ValueError("The client key must be Ed25519")
    return key.sign(message.encode("utf-8")).hex()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--lab", required=True)
    parser.add_argument("--message-file", required=True)
    parser.add_argument("--key", type=Path)
    args = parser.parse_args()
    message = (sys.stdin.read() if args.message_file == "-" else Path(args.message_file).read_text()).rstrip("\r\n")
    key_path = args.key or Path(__file__).resolve().parents[2] / ".sciexchange" / "client_keys" / f"{args.lab}.pem"
    try:
        print(sign_message(message, args.lab, key_path))
    except (OSError, ValueError, TypeError) as error:
        parser.error(str(error))


if __name__ == "__main__":
    main()
