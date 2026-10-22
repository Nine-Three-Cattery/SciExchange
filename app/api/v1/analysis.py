"""Analysis uses the same authorization as raw-data delivery."""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.compiler.domain_analytics import differential_capacity, differential_tafel_analysis, predict_knee_point, tafel_analysis
from app.compiler.formal_engine import STANDARD_OER_POTENTIAL_V, nernst_potential
from app.core.x402_middleware import authorized, envelope, payment_response
from app.database import get_session
from app.models.schemas import AnalysisRequest
from app.models.models import ScienceRecord
from app.services.slice_service import get_slice, read_document, verified_attestation

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.post("")
def analyze(payload: AnalysisRequest, request: Request, session: Session = Depends(get_session)):
    row = get_slice(session, payload.slice_id)
    verified_attestation(session, row)
    if not authorized(request, session, row.slice_id):
        return payment_response(row)
    if session.get(ScienceRecord, row.slice_id) is not None:
        from app.services.domain_analytics import ScienceError, analyze as analyze_science
        from app.services.science_gateway import get_record
        if payload.version is None:
            raise HTTPException(422, "Scientific analysis requires the explicit slice version")
        get_record(session, row, payload.version)
        document = read_document(row, request.app.state.cipher)
        try:
            result = analyze_science(document, payload.analysis_type, payload.parameters)
        except ScienceError as error:
            raise HTTPException(422, {"error": error.code, "message": str(error)}) from error
        return envelope({"slice_id": row.slice_id, "version": payload.version,
                         "analysis_type": payload.analysis_type, "result": result})
    if payload.version is not None or payload.analysis_type == "capacity_fade":
        raise HTTPException(422, "This method/version requires a versioned scientific slice")
    if payload.parameters:
        raise HTTPException(422, "This protocol uses fixed analysis parameters; overrides are not supported")
    document = read_document(row, request.app.state.cipher)
    try:
        columns = document["columns"]
        samples = document["rows"]
        if payload.analysis_type in {"tafel_slope", "dta"}:
            metadata = document["metadata"]
            conditions = metadata.get("testing_conditions", {})
            reference = conditions.get("potential_reference", metadata.get("potential_reference"))
            if reference not in {"RHE", "SHE"}:
                raise ValueError("Potential reference must be RHE or SHE")
            potential_column = "potential_v_rhe" if reference == "RHE" else "potential_v_she"
            vi, ji = columns.index(potential_column), columns.index("current_density_ma_cm2")
            voltage = [sample[vi] for sample in samples]
            if reference == "SHE":
                ph = conditions.get("ph", metadata.get("ph"))
                correction = STANDARD_OER_POTENTIAL_V - nernst_potential(ph, metadata["temperature_c"])
                voltage = [value + correction for value in voltage]
            function = tafel_analysis if payload.analysis_type == "tafel_slope" else differential_tafel_analysis
            result = function(voltage, [sample[ji] for sample in samples])
        elif payload.analysis_type == "dq_dv":
            curve = document["charge_curve"]
            vi, qi = curve["columns"].index("voltage_v"), curve["columns"].index("capacity_ah")
            result = differential_capacity([sample[vi] for sample in curve["rows"]],
                                           [sample[qi] for sample in curve["rows"]])
        else:
            ni, qi = columns.index("cycle"), columns.index("discharge_capacity_ah")
            result = predict_knee_point([sample[ni] for sample in samples], [sample[qi] for sample in samples])
    except (ValueError, KeyError) as error:
        raise HTTPException(422, f"Analysis does not apply to this slice: {error}") from error
    return envelope({"slice_id": row.slice_id, "analysis_type": payload.analysis_type, "result": result})
