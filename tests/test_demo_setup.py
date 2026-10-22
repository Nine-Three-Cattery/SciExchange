"""Key setup must not rotate a PI identity across local restarts."""

import json
import pytest

from scripts.setup_demo import setup_identities


def test_setup_reuses_client_identity_without_printing_or_storing_private_material_in_registry(tmp_path):
    first = setup_identities(tmp_path)
    second = setup_identities(tmp_path)
    assert first == second
    assert len(set(first.values())) == 3
    assert all(len(value) == 64 for value in first.values())
    assert "PRIVATE" not in (tmp_path / "pi_public_keys.json").read_text()
    assert (tmp_path / "client_keys" / "lab_catalysis.pem").stat().st_mode & 0o777 == 0o600


def test_setup_cannot_silently_replace_a_registered_pi(tmp_path):
    public = setup_identities(tmp_path)
    public["lab_catalysis"] = "00" * 32
    (tmp_path / "pi_public_keys.json").write_text(json.dumps(public))
    with pytest.raises(ValueError, match="does not match"):
        setup_identities(tmp_path)
