import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLiveApi } from "../src/api/client";
import {
  applySignature,
  isEligible,
  type Slice,
  type Verification,
} from "../src/api/contracts";
import { registerSignaturePrompt } from "../src/api/signing";
import { PhysicsCompilerConsole } from "../src/components/PhysicsCompilerConsole";
import { Dashboard } from "../src/pages/Dashboard";
import { createMockApi } from "../src/mocks/fixtures";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
  Line: () => null,
  Brush: () => null,
}));
const slice: Slice = {
  slice_id: "reviewed_battery",
  version: "1",
  domain: "battery_cycling",
  title: "Reviewed battery",
  summary: "Scientific source",
  owner_lab_id: "lab_battery",
  is_attested: true,
  attestation_uid: "admission_1",
  data_classification: "experimental_reference",
  price_scicredit: 20,
  compiler_status: "REVIEW_REQUIRED",
  review_status: "approved",
  quarantined: false,
  analysis_methods: ["capacity_fade"],
};
const report: Verification = {
  slice_id: slice.slice_id,
  version: "1",
  valid: false,
  compiler_status: "REVIEW_REQUIRED",
  is_attested: true,
  attestation_uid: "admission_1",
  review_status: "approved",
  quarantined: false,
  violated_axioms: [],
  safety_alerts: [],
  diagnostic_log: "Missing temperature; human admission recorded",
  checks: [],
};
const pending = {
  ...slice,
  is_attested: false,
  attestation_uid: null,
  review_status: "pending" as const,
};
const pendingReport = {
  ...report,
  is_attested: false,
  attestation_uid: null,
  review_status: "pending" as const,
};
const document = {
  slice_id: slice.slice_id,
  version: "1",
  domain: slice.domain,
  metadata: { data_origin: "experimental" },
  columns: ["cycle_index", "discharge_capacity_ah"],
  rows: [
    [1, 1],
    [2, 0.9],
  ],
};
const result = {
  cycle_index: [1, 2],
  discharge_capacity_ah: [1, 0.9],
  capacity_retention_pct: [100, 90],
};
const ok = (data: unknown) => Response.json({ code: 200, data });
let unregister: (() => void) | undefined;
afterEach(() => {
  unregister?.();
  unregister = undefined;
});
function signer() {
  const handler = vi.fn((request) => request.resolve("external_signature"));
  unregister = registerSignaturePrompt(handler);
  return handler;
}
const message = {
  protocol: "SciExchange/scientific-admission/1",
  action: "scientific_admission",
  slice_id: slice.slice_id,
  version: "1",
  owner_lab_id: "lab_battery",
  expires_at: "2099-01-01T00:00:00Z",
  input_sha256: "a".repeat(64),
  report_sha256: "b".repeat(64),
  rule_version: "test_rules",
};

describe("wiring adversarial boundaries", () => {
  it.each([undefined, "wrong_version"])(
    "rejects analysis for an unbound response version (%s)",
    async (version) => {
      signer();
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          if (url.includes("/slices?")) return ok([slice]);
          if (url.includes("/download")) return Response.json(document);
          return ok({
            slice_id: slice.slice_id,
            version,
            analysis_type: "capacity_fade",
            result,
          });
        }),
      );
      const api = createLiveApi(undefined, "lab_battery");
      await api.catalog();
      await api.access(slice.slice_id);
      await expect(api.analytics(slice.domain, slice.slice_id)).rejects.toThrow(
        /version/i,
      );
    },
  );

  it.each([
    "slice_id",
    "version",
    "owner_lab_id",
    "action",
    "protocol",
    "expires_at",
  ])(
    "refuses to request a signature for a mismatched admission %s",
    async (field) => {
      const prompt = signer();
      const fetch = vi.fn(async (url: string) => {
        if (url.includes("/slices?")) return ok([pending]);
        if (url.endsWith("/review-challenge"))
          return ok({
            slice_id: slice.slice_id,
            version: "1",
            canonical_message: JSON.stringify({ ...message, [field]: "wrong" }),
            expires_at: message.expires_at,
          });
        return ok(report);
      });
      vi.stubGlobal("fetch", fetch);
      await expect(
        createLiveApi(undefined, "lab_battery").review!(slice.slice_id),
      ).rejects.toThrow(/challenge/i);
      expect(prompt).not.toHaveBeenCalled();
      expect(fetch).toHaveBeenCalledTimes(2);
    },
  );

  it.each([
    { quarantined: true },
    { safety_alerts: [{ type: "INJECTION", action: "QUARANTINED" }] },
    {
      checks: [
        {
          rule_id: "BLOCKING",
          status: "fail" as const,
          reason: "Conservation failed",
        },
      ],
    },
    {
      violated_axioms: [
        {
          axiom_id: "FE",
          name: "Charge conservation",
          formula: "FE<=100",
          observed_value: 108,
          allowed_range: [0, 100],
          severity: "error",
        },
      ],
    },
  ])(
    "does not treat review-required as overriding a blocking report: %j",
    (blocked) => {
      expect(isEligible(slice, { ...report, ...blocked })).toBe(false);
    },
  );

  it("invalidates a cached admission after the server catalog revokes it", async () => {
    let revoked = false;
    const fetch = vi.fn(async (url: string) => {
      if (url.includes("/slices?")) return ok([revoked ? pending : slice]);
      if (url.endsWith("/verify"))
        return ok({
          ...report,
          merkle_root: "hash",
          proof_of_priority: {},
          instrument_fingerprint: {},
          physics_results: {},
          safety_clearance: {},
          diagnostic_logs: [],
        });
      return Response.json({ message: "Admission revoked" }, { status: 403 });
    });
    vi.stubGlobal("fetch", fetch);
    const api = createLiveApi();
    await api.catalog();
    await api.verify({ slice_id: slice.slice_id, version: "1" });
    revoked = true;
    await api.catalog();
    await expect(api.attestation(slice.slice_id)).rejects.toThrow(/revoked/i);
  });

  it("does not reapply an earlier approved report over a newer revocation", async () => {
    const user = userEvent.setup();
    const api = createMockApi({ delayMs: 0 });
    api.mode = "live";
    api.catalog = vi.fn(async () => [pending]);
    api.verify = async () => report;
    api.analytics = async () => {
      throw new Error("Analysis locked");
    };
    render(<Dashboard api={api} />);
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "Physics compiler" }));
    await user.selectOptions(
      screen.getByLabelText("Experimental slice"),
      slice.slice_id,
    );
    await user.click(screen.getByRole("button", { name: "Compile & attest" }));
    await waitFor(() => expect(api.catalog).toHaveBeenCalledTimes(2));
    await user.click(screen.getByRole("button", { name: "Buy data" }));
    expect(
      screen.getByRole("button", { name: `Buy data: ${slice.title}` }),
    ).toBeDisabled();
  });

  it("retries failed admission as admission, without silently recompiling", async () => {
    const user = userEvent.setup();
    const review = vi
      .fn()
      .mockRejectedValueOnce(new Error("Admission temporarily unavailable"))
      .mockResolvedValue(undefined);
    const verify = vi.fn();
    render(
      <PhysicsCompilerConsole
        slices={[pending]}
        mode="live"
        initialSliceId={slice.slice_id}
        results={{ [slice.slice_id]: pendingReport }}
        activeLab="lab_battery"
        onReview={review}
        onVerify={verify}
        onInspect={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Approve admission" }));
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "Retry request" }));
    await waitFor(() => expect(review).toHaveBeenCalledTimes(2));
    expect(verify).not.toHaveBeenCalled();
  });
});

describe("settlement response identity", () => {
  const agreement = {
    proposal: {
      proposal_id: "p_current",
      status: "PENDING_SECOND_PI_SIGNATURE",
    },
    offered: slice,
    requested: { ...slice, slice_id: "counterparty" },
    approvals: ["pi_proposer" as const],
    settlementConfirmed: false,
  };
  it.each([
    { proposer_signed: false, target_signed: true },
    { proposer_signed: true, target_signed: false },
  ])("does not mark a contradictory completion as settled: %j", (flags) => {
    expect(
      applySignature(agreement, "pi_target", "DUAL_SIGNED_AND_EXECUTED", {
        proposal_id: "p_current",
        status: "DUAL_SIGNED_AND_EXECUTED",
        ...flags,
      }).settlementConfirmed,
    ).toBe(false);
  });
  it("does not apply another proposal's completion", () => {
    expect(
      applySignature(agreement, "pi_target", "DUAL_SIGNED_AND_EXECUTED", {
        proposal_id: "p_other",
        status: "DUAL_SIGNED_AND_EXECUTED",
        proposer_signed: true,
        target_signed: true,
      }),
    ).toEqual(agreement);
  });
  it("rejects a polling response for a different proposal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        ok({ proposal_id: "p_other", status: "DUAL_SIGNED_AND_EXECUTED" }),
      ),
    );
    await expect(createLiveApi().poll!("p_current")).rejects.toThrow(
      /proposal/i,
    );
  });
});

it("never caches an attestation from a blocked verification even when the response claims admission", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("/slices?")) return ok([slice]);
      if (url.endsWith("/verify"))
        return ok({
          ...report,
          checks: [
            { rule_id: "BLOCK", status: "fail", reason: "Invalid data" },
          ],
          merkle_root: "hash",
          proof_of_priority: {},
          instrument_fingerprint: {},
          physics_results: {},
          safety_clearance: {},
          diagnostic_logs: [],
        });
      return Response.json({ message: "Blocking report" }, { status: 403 });
    }),
  );
  const api = createLiveApi();
  await api.catalog();
  await api.verify({ slice_id: slice.slice_id, version: "1" });
  await expect(api.attestation(slice.slice_id)).rejects.toThrow(/blocking/i);
});
it("rejects a delivered document from the wrong scientific domain", async () => {
  signer();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("/slices?")) return ok([slice]);
      if (url.includes("/download"))
        return Response.json({ ...document, domain: "electrocatalysis" });
      return ok({
        slice_id: slice.slice_id,
        version: "1",
        analysis_type: "capacity_fade",
        result,
      });
    }),
  );
  const api = createLiveApi(undefined, "lab_battery");
  await api.catalog();
  await api.access(slice.slice_id);
  await expect(api.analytics(slice.domain, slice.slice_id)).rejects.toThrow(
    /domain/i,
  );
});
it("does not accept a blocking report as successful human admission", async () => {
  signer();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("/slices?")) return ok([pending]);
      if (url.endsWith("/review-challenge"))
        return ok({
          slice_id: slice.slice_id,
          version: "1",
          canonical_message: JSON.stringify(message),
          expires_at: message.expires_at,
        });
      return ok({ ...report, quarantined: true });
    }),
  );
  await expect(
    createLiveApi(undefined, "lab_battery").review!(slice.slice_id),
  ).rejects.toThrow(/did not confirm/i);
});
