"""Browser access to the supported PI-authentication and payment headers."""

import pytest
from fastapi.testclient import TestClient


@pytest.mark.parametrize("requested_headers", [
    "authorization,content-type,x-payment-receipt,x-pi-address,x-pi-signature,x-pi-expires-at",
    "Authorization,Content-Type,X-Payment-Receipt,X-Pi-Address,x-PI-SIGNATURE,X-PI-Expires-At",
])
def test_preflight_accepts_supported_headers_independent_of_case(
    client: TestClient, requested_headers: str,
) -> None:
    response = client.options(
        "/api/v1/slices/slice_oer_valid/download",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": requested_headers,
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    allowed = {
        header.strip().lower()
        for header in response.headers["access-control-allow-headers"].split(",")
    }
    assert {header.lower() for header in requested_headers.split(",")} <= allowed


def test_payment_challenge_exposes_payee_address_to_browser(client: TestClient) -> None:
    response = client.get(
        "/api/v1/slices/slice_oer_valid/download",
        headers={"Origin": "http://localhost:5173"},
    )
    assert response.status_code == 402
    assert response.headers["x-payment-address"] == "lab_catalysis"
    exposed = {
        header.strip().lower()
        for header in response.headers["access-control-expose-headers"].split(",")
    }
    assert "x-payment-address" in exposed
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
