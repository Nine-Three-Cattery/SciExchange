import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLiveApi } from "../src/api/client";
import { presentAnalytics } from "../src/api/analytics";
import { createDelivery } from "../src/api/access";
import { applyVerification, isEligible, isRejected, submissionSchema, type ScientificDocument, type Slice, type Verification } from "../src/api/contracts";
import { registerSignaturePrompt } from "../src/api/signing";
import { PhysicsCompilerConsole } from "../src/components/PhysicsCompilerConsole";

const document: ScientificDocument = {
  slice_id: "battery_real", version: "v1", domain: "battery_cycling",
  metadata: { data_origin: "experimental", temperature_c: null },
  columns: ["cycle_index", "discharge_capacity_ah"], rows: [[1, 1.1], [2, 1.09]],
};
const slice: Slice = {
  slice_id: document.slice_id, version: "v1", domain: document.domain,
  title: "Experimental battery", summary: "Published source slice", data_classification: "experimental",
  owner_lab_id: "lab_battery", is_attested: true, attestation_uid: "attest_real", price_scicredit: 20,
  compiler_status: "REVIEW_REQUIRED", review_status: "approved", quarantined: false,
  analysis_methods: ["capacity_fade", "knee_point"],
};
const report: Verification = {
  slice_id: slice.slice_id, version: "v1", valid: false,
  compiler_status: "REVIEW_REQUIRED", review_status: "approved", is_attested: true,
  attestation_uid: "attest_real", quarantined: false, formal_proof: false,
  violated_axioms: [], safety_alerts: [], diagnostic_log: "[WARN] Missing temperature",
  checks: [{ rule_id: "TEMPERATURE", status: "not_checked", reason: "Not reported" }],
};
const retention = { cycle_index: [1, 2], discharge_capacity_ah: [1.1, 1.09], capacity_retention_pct: [100, 99.1] };
const noKnee = { status: "not_detected", knee_point_cycle_estimated: null, cycle_index: [1, 2], fitted_capacity_ah: [] };
const ok = (data: unknown) => Response.json({ code: 200, data });
let unregister: (() => void) | undefined;
afterEach(() => { unregister?.(); unregister = undefined; });

function sign() {
  const prompt = vi.fn(request => request.resolve("reviewed_external_signature"));
  unregister = registerSignaturePrompt(prompt);
  return prompt;
}

describe("scientific admission", () => {
  it("keeps scientific review distinct from signed admission", () => {
    expect(isRejected(report)).toBe(false);
    expect(isEligible(slice, report)).toBe(true);
    expect(applyVerification(slice, report).is_attested).toBe(true);
    expect(isEligible(slice, { ...report, is_attested: false, review_status: "pending" })).toBe(false);
    expect(isEligible({ ...slice, review_status: "pending" })).toBe(false);
    expect(isEligible({ ...slice, quarantined: true })).toBe(false);
    expect(isEligible(slice, { ...report, compiler_status: "REJECTED" })).toBe(false);
    expect(isEligible(slice, { ...report, version: "old", compiler_status: "REJECTED" })).toBe(true);
  });
  it("preserves scientific versions through delivery validation", () => {
    expect(submissionSchema.parse(document).version).toBe("v1");
    expect(createDelivery(document.slice_id, "json", JSON.stringify(document)).document?.version).toBe("v1");
  });
  it("signs the exact server admission challenge as the owner", async () => {
    const prompt = sign();
    const canonical = JSON.stringify({ protocol: "SciExchange/scientific-admission/1", action: "scientific_admission", slice_id: slice.slice_id, version: "v1", owner_lab_id: "lab_battery", expires_at: "2099-01-01T00:00:00Z", input_sha256: "a".repeat(64), report_sha256: "b".repeat(64), rule_version: "fixture_rules" });
    const fetch = vi.fn().mockImplementation((url: string, options: RequestInit) => {
      if (url.includes("/slices?")) return ok([{ ...slice, is_attested: false, review_status: "pending" }]);
      if (url.endsWith("/review-challenge")) {
        expect(JSON.parse(String(options.body))).toEqual({ slice_id: slice.slice_id, version: "v1" });
        return ok({ slice_id: slice.slice_id, version: "v1", canonical_message: canonical, expires_at: "2099-01-01T00:00:00Z" });
      }
      if (url.endsWith("/review")) {
        expect(JSON.parse(String(options.body))).toEqual({ slice_id: slice.slice_id, version: "v1",
          signer_address: "lab_battery", signature: "reviewed_external_signature", expires_at: "2099-01-01T00:00:00Z" });
        return ok(report);
      }
      throw new Error(url);
    });
    vi.stubGlobal("fetch", fetch);
    const api = createLiveApi(undefined, "lab_battery");
    expect((await api.review!(slice.slice_id)).valid).toBe(false);
    expect(prompt.mock.calls[0][0]).toMatchObject({ address: "lab_battery", message: canonical });
  });
  it.each(["nonowner", "quarantined"])("does not request admission for %s", async kind => {
    const prompt = sign();
    const fetch = vi.fn().mockResolvedValue(ok([{ ...slice, quarantined: kind === "quarantined" }]));
    vi.stubGlobal("fetch", fetch);
    const api = createLiveApi(undefined, kind === "nonowner" ? "other_lab" : "lab_battery");
    await expect(api.review!(slice.slice_id)).rejects.toThrow("owning laboratory");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(prompt).not.toHaveBeenCalled();
  });
  it("renders pending scientific review and an owner admission control without claiming rejection", () => {
    const pending = { ...slice, is_attested: false, review_status: "pending" as const };
    const review = vi.fn().mockResolvedValue(undefined);
    render(<PhysicsCompilerConsole slices={[pending]} mode="live" results={{ [slice.slice_id]: { ...report, is_attested: false, review_status: "pending" } }}
      activeLab="lab_battery" onReview={review} onVerify={vi.fn()} onInspect={vi.fn()} />);
    expect(screen.getByText("Scientific review required")).toBeInTheDocument();
    expect(screen.queryByText("Rejected")).not.toBeInTheDocument();
    expect(screen.getByText("Numerical checks are not a formal proof.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Approve admission" }));
    expect(review).toHaveBeenCalledWith(slice.slice_id);
  });
});

describe("scientific plots", () => {
  it("keeps the original reference and shows an unavailable overpotential as uncalculated", () => {
    const catalyst: ScientificDocument = { ...document, domain: "electrocatalysis",
      metadata: { data_origin: "experimental", temperature_c: null, reference_electrode: "Ag/AgCl (3 M KCl)" },
      columns: ["potential_v_vs_reference", "current_density_ma_cm2"], rows: [[0.4, 1], [0.45, 3], [0.5, 10]] };
    const output = presentAnalytics(catalyst, { tafel_slope: {
      tafel_slope_mv_dec: 76.1, r_squared: 0.982, potential_at_target_v: 0.5, overpotential_at_target_mv: null,
      parameters: { potential_column: "potential_v_vs_reference" },
      curve: { current_density_ma_cm2: [1, 3, 10], potential_v: [0.4, 0.45, 0.5] },
      fit: { log10_current_density: [0, 0.477, 1], potential_v: [0.4, 0.45, 0.5] },
    } });
    expect(output.plots[0].xLabel).toContain("Ag/AgCl");
    expect(output.plots[0].xLabel).not.toContain("RHE");
    expect(output.metrics.find(metric => metric.label === "Overpotential at target current")?.value).toBe("Not calculated");
    expect(output.conditions).not.toContain("null");
    expect(output.conditions).toContain("Temperature not reported");
  });
  it("does not invent a capacity fit when no knee was detected", () => {
    const output = presentAnalytics(document, { capacity_fade: retention, knee_point: noKnee });
    expect(output.plots).toHaveLength(1);
    expect(output.plots[0].series).toHaveLength(1);
    expect(output.metrics.at(-1)?.value).toBe("Not detected in observed cycles");
  });
  it("shows the signed discharge derivative without requiring cycle-summary data", () => {
    const output = presentAnalytics({ ...document, columns: ["voltage_v", "capacity_ah"], rows: [[4, 0], [3, 1]] },
      { dq_dv: { voltage_v: [3.2, 3.3], dq_dv_ah_v: [-2, -3] } });
    expect(output.plots[0].series[0].points.map(point => point.y)).toEqual([-2, -3]);
    expect(output.plots[0].yLabel).toContain("Signed");
    expect(output.metrics.some(metric => metric.label.includes("Knee"))).toBe(false);
  });
  it("uses only declared analysis methods and sends the pinned version", async () => {
    sign();
    const methods: string[] = [];
    const fetch = vi.fn().mockImplementation((url: string, options: RequestInit) => {
      if (url.includes("/slices?")) return ok([slice]);
      if (url.includes("/download")) return Response.json(document);
      if (url.endsWith("/analysis")) {
        const body = JSON.parse(String(options.body));
        expect(body.version).toBe("v1");
        methods.push(body.analysis_type);
        return ok({ slice_id: slice.slice_id, version: "v1", analysis_type: body.analysis_type,
          result: body.analysis_type === "capacity_fade" ? retention : noKnee });
      }
      throw new Error(url);
    });
    vi.stubGlobal("fetch", fetch);
    const api = createLiveApi(undefined, "lab_battery");
    await api.catalog();
    await api.access(slice.slice_id);
    const output = await api.analytics("battery_cycling", slice.slice_id);
    expect(methods).toEqual(["capacity_fade", "knee_point"]);
    expect(output.plots[0].series).toHaveLength(1);
  });
});
