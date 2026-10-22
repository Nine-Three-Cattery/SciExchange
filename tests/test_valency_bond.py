"""Tests for Valency Bond (valency.io) MCP platform integration."""

import pytest
from app.services.valency_bond import ValencyBondService


@pytest.fixture
def valency_service():
    return ValencyBondService()


def test_ground_slice_electrocatalysis_valid(valency_service):
    valid_oer_slice = {
        "slice_id": "oer_ir_valid_001",
        "domain": "electrocatalysis",
        "metadata": {
            "extracted_metrics": {
                "tafel_slope_mv_dec": 58.2,
                "overpotential_10ma_mv": 285.0,
                "faradaic_efficiency_percent": 98.4,
            }
        },
    }
    result = valency_service.ground_slice(valid_oer_slice)
    assert result["grounding_status"] == "VERIFIED_GROUNDED"
    assert result["consistency_score"] >= 0.90
    assert len(result["literature_matches"]) >= 1
    assert result["mcp_server"] == "valency-bond/v1.2.0"
    assert len(result["anomalies"]) == 0
    assert "grounding_proof_sha256" in result


def test_ground_slice_electrocatalysis_forged_faradaic_violation(valency_service):
    forged_slice = {
        "slice_id": "oer_forged_mass_violation",
        "domain": "electrocatalysis",
        "metadata": {
            "extracted_metrics": {
                "tafel_slope_mv_dec": 32.0,
                "overpotential_10ma_mv": 190.0,
                "faradaic_efficiency_percent": 118.5,  # Violates mass conservation / 100%
            }
        },
    }
    result = valency_service.ground_slice(forged_slice)
    assert result["grounding_status"] == "REJECTED_ANOMALY_DETECTED"
    assert result["consistency_score"] <= 0.20
    assert len(result["anomalies"]) >= 1
    anomaly = result["anomalies"][0]
    assert anomaly["type"] == "ANOMALY_PHYSICAL_INVARIANT_VIOLATION"
    assert anomaly["severity"] == "CRITICAL"
    assert "First Law of Thermodynamics" in anomaly["detail"] or "mass conservation" in anomaly["detail"]
    assert "McCrory et al., Nature Catalysis 2018" in anomaly["citation"]


def test_ground_slice_battery_cycling(valency_service):
    battery_slice = {
        "slice_id": "fast_charge_nmc_001",
        "domain": "battery_cycling",
        "metadata": {
            "extracted_metrics": {
                "nominal_capacity_ah": 1.1,
                "capacity_retention_percent": 92.5,
            }
        },
    }
    result = valency_service.ground_slice(battery_slice)
    assert result["grounding_status"] == "VERIFIED_GROUNDED"
    assert result["consistency_score"] >= 0.90
    assert any("Severson" in str(p.get("authors")) or "Closed-loop" in p.get("title", "") for p in result["literature_matches"])


def test_verify_citation_known_and_unresolved(valency_service):
    # Test known peer-reviewed publication
    known_doi = "10.1038/s41560-019-0356-8"
    verified = valency_service.verify_citation(known_doi)
    assert verified["verified"] is True
    assert verified["status"] == "CONFIRMED_IN_LITERATURE_GRAPH"
    assert "fast-charging" in verified["title"].lower()
    assert any("Severson" in author for author in verified["authors"])
    assert verified["journal"] == "Nature Energy"
    assert verified["citation_count"] > 500

    # Test arbitrary valid DOI resolution
    custom_doi = "10.1039/d1ee01234a"
    custom_res = valency_service.verify_citation(custom_doi, title="Energy & Environmental Science Benchmark")
    assert custom_res["verified"] is True
    assert custom_res["status"] == "RESOLVED_VIA_VALENCY_CROSSREF"

    # Test invalid DOI
    invalid_res = valency_service.verify_citation("not-a-valid-doi")
    assert invalid_res["verified"] is False
    assert invalid_res["status"] == "UNRESOLVED_INVALID_DOI"


def test_evaluate_barter_fair_value(valency_service):
    slice_a = {
        "slice_id": "slice_catalysis_01",
        "domain": "electrocatalysis",
        "is_attested": True,
        "valency_grounding": {"grounding_status": "VERIFIED_GROUNDED"},
    }
    slice_b = {
        "slice_id": "slice_battery_01",
        "domain": "battery_cycling",
        "is_attested": True,
        "valency_grounding": {"grounding_status": "VERIFIED_GROUNDED"},
    }
    fair_val = valency_service.evaluate_barter_fair_value(slice_a, slice_b)
    assert "exchange_ratio" in fair_val
    assert fair_val["is_game_theoretically_fair"] is True
    assert fair_val["party_a_weight"] > 0
    assert fair_val["party_b_weight"] > 0


def test_mcp_tool_definitions(valency_service):
    tools = valency_service.get_mcp_tool_definitions()
    assert len(tools) == 3
    tool_names = [t["name"] for t in tools]
    assert "valency_bond_ground_slice" in tool_names
    assert "valency_bond_verify_citation" in tool_names
    assert "valency_bond_fair_value" in tool_names
    for t in tools:
        assert "inputSchema" in t
        assert t["inputSchema"]["type"] == "object"


def test_valency_api_endpoints(client):
    # Test GET /api/v1/valency/mcp-schema
    res_schema = client.get("/api/v1/valency/mcp-schema")
    assert res_schema.status_code == 200
    schema_data = res_schema.json()["data"]
    assert schema_data["server_info"]["name"] == "valency-bond-sciexchange"
    assert len(schema_data["tools"]) == 3

    # Test POST /api/v1/valency/ground
    res_ground = client.post("/api/v1/valency/ground", json={
        "slice_id": "test_slice",
        "domain": "electrocatalysis",
        "metadata": {
            "extracted_metrics": {
                "tafel_slope_mv_dec": 60.0,
                "faradaic_efficiency_percent": 99.1,
            }
        }
    })
    assert res_ground.status_code == 200
    assert res_ground.json()["data"]["grounding_status"] == "VERIFIED_GROUNDED"

    # Test POST /api/v1/valency/verify-citation
    res_cite = client.post("/api/v1/valency/verify-citation", json={
        "doi": "10.1038/s41560-019-0356-8"
    })
    assert res_cite.status_code == 200
    assert res_cite.json()["data"]["verified"] is True

    # Test POST /api/v1/valency/fair-value
    res_fv = client.post("/api/v1/valency/fair-value", json={
        "party_a_slice_id": "oer_lab_a",
        "party_b_slice_id": "battery_lab_b",
        "party_a_domain": "electrocatalysis",
        "party_b_domain": "battery_cycling",
    })
    assert res_fv.status_code == 200
    assert res_fv.json()["data"]["is_game_theoretically_fair"] is True

    # Test POST /api/v1/valency/mcp-call
    res_mcp = client.post("/api/v1/valency/mcp-call", json={
        "method": "valency_bond_verify_citation",
        "params": {"doi": "10.1021/jacs.0c08522"}
    })
    assert res_mcp.status_code == 200
    assert res_mcp.json()["data"]["result"]["verified"] is True
