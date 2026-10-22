import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Dashboard } from "../src/pages/Dashboard";
import { createLiveApi } from "../src/api/client";
import type { ScientificDocument, Slice, Verification } from "../src/api/contracts";

vi.mock("../src/api/signing", async (original) => ({
  ...await original<object>(), signCanonical: vi.fn(async () => "ab".repeat(64)),
}));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null, XAxis: () => null, YAxis: () => null,
  Tooltip: () => null, Legend: () => null, Line: () => null, Brush: () => null,
}));

const catalyst: Slice = {
  slice_id: "reviewed_catalyst", version: "1", domain: "electrocatalysis",
  title: "Catalyst fixture", summary: "Scientific response fixture",
  data_classification: "experimental_reference", owner_lab_id: "lab_catalysis",
  is_attested: true, attestation_uid: "attest_catalyst", price_scicredit: 50,
  compiler_status: "REVIEW_REQUIRED", review_status: "approved", quarantined: false,
  analysis_methods: ["tafel_slope"], accepts_barter: true,
};
const battery: Slice = {
  ...catalyst, slice_id: "reviewed_battery", domain: "battery_cycling",
  title: "Battery fixture", owner_lab_id: "lab_battery", attestation_uid: "attest_battery",
  analysis_methods: ["capacity_fade"],
};
const document: ScientificDocument = {
  slice_id: catalyst.slice_id, version: "1", domain: catalyst.domain,
  metadata: { data_origin: "synthetic", temperature_c: null, reference_electrode: "Ag/AgCl" },
  columns: ["potential_v_vs_reference", "current_density_ma_cm2"],
  rows: [[0.4, 1], [0.45, 3], [0.5, 10]],
};
const analysisSource = `Scientific data · ${catalyst.slice_id} · 1`;
function report(slice: Slice): Verification {
  return {
    slice_id: slice.slice_id, version: slice.version, valid: false,
    compiler_status: "REVIEW_REQUIRED", review_status: slice.review_status,
    is_attested: slice.is_attested, attestation_uid: slice.attestation_uid,
    quarantined: false, formal_proof: false, violated_axioms: [], safety_alerts: [],
    diagnostic_log: "Recorded limitations remain subject to PI review", checks: [],
    merkle_root: "fixture-content-root", proof_of_priority: {}, instrument_fingerprint: {},
    physics_results: {}, safety_clearance: {}, diagnostic_logs: [],
  };
}
const ok = (data: unknown) => Response.json({ code: 200, data });

function liveWorkspace(initiallyAdmitted: boolean) {
  let admitted = initiallyAdmitted;
  let verifications = 0;
  let proposals = 0;
  const current = () => admitted ? catalyst : {
    ...catalyst, is_attested: false, attestation_uid: null, review_status: "pending" as const,
  };
  const proposal = {
    proposal_id: "catalog-sync-proposal", status: "PENDING_DUAL_SIGNATURE",
    party_a_lab: "lab_catalysis", party_a_slice_id: catalyst.slice_id,
    party_b_lab: "lab_battery", party_b_slice_id: battery.slice_id,
    canonical_agreement: '{"proposal_id":"catalog-sync-proposal"}',
  };
  vi.stubGlobal("fetch", vi.fn(async (url: string, options: RequestInit) => {
    if (url.includes("/slices?")) return ok([current(), battery]);
    if (url.includes("/balance")) return ok({ address: new URL(url).searchParams.get("address"), staker_balance: 0 });
    if (url.includes("/download")) return Response.json(document);
    if (url.endsWith("/analysis")) {
      expect(admitted).toBe(true);
      return ok({ slice_id: catalyst.slice_id, version: "1", analysis_type: "tafel_slope", result: {
        tafel_slope_mv_dec: 76.1, r_squared: 0.982, potential_at_target_v: 0.5,
        overpotential_at_target_mv: null, parameters: { potential_column: "potential_v_vs_reference" },
        curve: { current_density_ma_cm2: [1, 3, 10], potential_v: [0.4, 0.45, 0.5] },
        fit: { log10_current_density: [0, 0.477, 1], potential_v: [0.4, 0.45, 0.5] },
      } });
    }
    if (url.endsWith("/verify")) { verifications++; return ok(report(current())); }
    if (url.endsWith("/attestation")) return ok(report(url.includes(catalyst.slice_id) ? current() : battery));
    if (url.endsWith("/negotiate")) {
      proposals++;
      expect(admitted).toBe(true);
      expect(JSON.parse(String(options.body))).toEqual({
        party_a_lab: "lab_catalysis", party_a_slice_id: catalyst.slice_id,
        party_b_lab: "lab_battery", party_b_slice_id: battery.slice_id,
      });
      return ok(proposal);
    }
    if (url.includes("/barter/proposals/")) return ok(proposal);
    throw new Error(`Unexpected request: ${url}`);
  }));
  return {
    api: createLiveApi(undefined, "lab_catalysis"),
    setAdmission: (value: boolean) => { admitted = value; },
    verificationCount: () => verifications,
    proposalCount: () => proposals,
  };
}

async function acquireOwnerData(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Buy data" }));
  await user.click(screen.getByRole("button", { name: `Read own data: ${catalyst.title}` }));
  await user.click(screen.getByRole("button", { name: "Request data access" }));
  await screen.findByText("Backend delivery confirmed");
  await user.click(screen.getByRole("button", { name: "Close review" }));
}

describe.each(["Overview", "Scientific analytics"])("catalog synchronization from %s", (view) => {
  it("enables purchase and barter after another session admits the data, without recompiling", async () => {
    const user = userEvent.setup();
    const workspace = liveWorkspace(false);
    render(<Dashboard api={workspace.api} />);
    await screen.findByRole("table");
    await acquireOwnerData(user);
    await user.click(screen.getByRole("button", { name: view }));
    await screen.findByText(/Analysis is locked/);
    workspace.setAdmission(true);
    await user.click(screen.getByRole("button", { name: "Retry request" }));
    await screen.findByText(analysisSource);
    await user.click(screen.getByRole("button", { name: "Data exchange" }));
    expect(screen.getByRole("button", { name: "Propose exchange" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Propose exchange" }));
    await screen.findByRole("button", { name: "Review authorization" });
    expect(workspace.proposalCount()).toBe(1);
    await user.selectOptions(screen.getByLabelText("Active lab"), "lab_battery");
    await user.click(screen.getByRole("button", { name: "Buy data" }));
    expect(screen.getByRole("button", { name: `Buy data: ${catalyst.title}` })).toBeEnabled();
    expect(workspace.verificationCount()).toBe(0);
  });

  it("discards an earlier approved report when refreshed admission is revoked", async () => {
    const user = userEvent.setup();
    const workspace = liveWorkspace(true);
    render(<Dashboard api={workspace.api} />);
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "Physics compiler" }));
    await user.selectOptions(screen.getByLabelText("Experimental slice"), catalyst.slice_id);
    await user.click(screen.getByRole("button", { name: "Compile & attest" }));
    await screen.findByText("Human admission approved");
    await acquireOwnerData(user);
    await user.click(screen.getByRole("button", { name: view }));
    await screen.findByText(analysisSource);
    await user.click(screen.getByRole("button", { name: "Buy data" }));
    workspace.setAdmission(false);
    await user.click(screen.getByRole("button", { name: view }));
    await screen.findByText(/Analysis is locked/);
    await user.click(screen.getByRole("button", { name: "Data exchange" }));
    expect(screen.queryByRole("button", { name: "Propose exchange" })).not.toBeInTheDocument();
    expect(screen.getByText("Two attested slices from different laboratories and complementary domains are required.")).toBeVisible();
    await user.selectOptions(screen.getByLabelText("Active lab"), "lab_battery");
    await user.click(screen.getByRole("button", { name: "Buy data" }));
    const market = within(screen.getByRole("heading", { name: "Buy scientific data" }).closest("section")!);
    expect(market.getByRole("button", { name: `Buy data: ${catalyst.title}` })).toBeDisabled();
    expect(workspace.verificationCount()).toBe(1);
    expect(workspace.proposalCount()).toBe(0);
  });
});
