import { afterEach, describe, expect, it, vi } from "vitest";
import { createLiveApi } from "../src/api/client";
import { createDelivery, parseScientificCsv } from "../src/api/access";
import { registerSignaturePrompt } from "../src/api/signing";
import { submissionSchema, verificationSchema, type SignatureRequest } from "../src/api/contracts";
import oerFixture from "../../data/slices/slice_oer_valid.json";
import batteryFixture from "../../data/slices/slice_battery_valid.json";

const oer = submissionSchema.parse(oerFixture);
const battery = submissionSchema.parse(batteryFixture);
const owner = "lab_synthesis";
const signature = "ab".repeat(64);
let unregister: (() => void) | undefined;
afterEach(() => { unregister?.(); unregister = undefined; });
const ok = (data: unknown) => Response.json({ code: 200, data });
const summary = (document = oer) => ({
  slice_id: document.slice_id, domain: document.domain, title: "Synthetic benchmark", summary: "Project parameters",
  data_classification: "golden", is_attested: true, attestation_uid: "attest_test", price_scicredit: 50,
  owner_lab_id: "lab_catalysis", quarantined: false, provenance: document.metadata.provenance,
});

function reviewSignatures() {
  const reviewed = vi.fn((request) => request.resolve(signature));
  unregister = registerSignaturePrompt(reviewed);
  return reviewed;
}

describe("live backend contracts", () => {
  it("accepts the backend diagnostic shapes and a nullable rejected attestation", () => {
    const report = verificationSchema.parse({
      valid: false, slice_id: "bad", attestation_uid: null,
      violated_axioms: [{ axiom_id: "LSV", name: "Monotonicity", formula: "j2>=j1",
        observed_value: { drop: 1.2 }, allowed_range: [null, 0], severity: "PHYSICS_VIOLATION" }],
      safety_alerts: [{ type: "INDIRECT_PROMPT_INJECTION", rule: "OVERRIDE", path: "$.metadata.notes", action: "QUARANTINED" }],
      diagnostic_log: "rejected",
    });
    expect(report.safety_alerts[0].rule).toBe("OVERRIDE");
    expect(report.violated_axioms[0].observed_value).toEqual({ drop: 1.2 });
  });
  it("preserves actual scientific document notes and within-cycle battery measurements", () => {
    const delivery = createDelivery(oer.slice_id, "json", JSON.stringify(oer));
    expect(delivery.document?.rows).toEqual(oer.rows);
    expect(delivery.rowCount).toBe(501);
    expect(createDelivery(battery.slice_id, "json", JSON.stringify(battery)).document?.charge_curve?.rows).toHaveLength(401);
    expect(parseScientificCsv('potential_v_rhe,current_density_ma_cm2,notes\n1.47,10,"stable, iR-corrected"\n').rows)
      .toEqual([[1.47, 10, "stable, iR-corrected"]]);
    expect(() => createDelivery("other", "json", JSON.stringify(oer))).toThrow("different slice");
  });
  it("uses inspection catalog and includes the hydrothermal failure-data domain", async () => {
    const fetch = vi.fn().mockResolvedValue(ok([{ ...summary(), slice_id: "dark", domain: "hydrothermal_synthesis" }]));
    vi.stubGlobal("fetch", fetch);
    expect((await createLiveApi().catalog())[0].domain).toBe("hydrothermal_synthesis");
    expect(fetch.mock.calls[0][0]).toContain("/slices?include_quarantined=true");
  });
  it("reads the wallet for the selected lab and clears the local session without resetting backend data", async () => {
    const fetch = vi.fn().mockImplementation((url: string) => ok({ address: new URL(url).searchParams.get("address"), staker_balance: 30 }));
    vi.stubGlobal("fetch", fetch);
    const api = createLiveApi();
    expect(api.getLab?.()).toBe("lab_synthesis");
    expect((await api.wallet())?.balance).toBe(30);
    api.setLab?.("lab_battery");
    expect((await api.wallet())?.entries).toEqual([]);
    await api.reset();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1][0]).toContain("address=lab_battery");
  });
  it("redeems with a fresh signed challenge even when the current balance is zero", async () => {
    const reviewed = reviewSignatures();
    const canonical = '{"action":"redeem","nonce":"server_nonce","price_scicredit":50}';
    const fetch = vi.fn().mockImplementation((url: string, options: RequestInit) => {
      if (url.includes("/balance")) return ok({ address: owner, staker_balance: 0 });
      if (url.endsWith("/challenge")) return ok({ nonce: "server_nonce", canonical_message: canonical, expires_at: "2099-01-01T00:00:00Z" });
      if (url.endsWith("/redeem")) {
        expect(JSON.parse(String(options.body))).toEqual({ slice_id: oer.slice_id, staker_address: owner, nonce: "server_nonce", signature });
        return ok({ slice_id: oer.slice_id, download_token: "paid_grant", expires_at: null, staker_balance: 0 });
      }
      if (url.includes("/download")) {
        expect(options.headers).toEqual({ "X-Payment-Receipt": "paid_grant" });
        return Response.json(oer);
      }
      throw new Error(`Unexpected request ${url}`);
    });
    vi.stubGlobal("fetch", fetch);
    const result = await createLiveApi().purchase({ sliceId: oer.slice_id, nonce: "access_quote" });
    expect(result.delivery.rowCount).toBe(501);
    expect(result.wallet?.balance).toBe(0);
    expect(reviewed.mock.calls[0][0].message).toBe(canonical);
    expect(reviewed.mock.calls[0][0].address).toBe(owner);
  });
  it("negotiates using real owner IDs and retrieves both scoped grants only after server completion", async () => {
    const reviewed = reviewSignatures();
    let count = 0;
    const proposal = { proposal_id: "p1", status: "PENDING_DUAL_SIGNATURE", canonical_agreement: '{"id":"p1"}',
      party_a_lab: "lab_catalysis", party_a_slice_id: oer.slice_id,
      party_b_lab: "lab_battery", party_b_slice_id: battery.slice_id, expires_at: "2099-01-01T00:00:00Z" };
    const fetch = vi.fn().mockImplementation((url: string, options: RequestInit) => {
      if (url.includes("/slices?")) return ok([summary(), { ...summary(battery), owner_lab_id: "lab_battery" }]);
      if (url.endsWith("/negotiate")) {
        expect(JSON.parse(String(options.body))).toEqual({ party_a_lab: "lab_catalysis", party_a_slice_id: oer.slice_id,
          party_b_lab: "lab_battery", party_b_slice_id: battery.slice_id });
        return ok(proposal);
      }
      if (url.endsWith("/dual-sign")) {
        const body = JSON.parse(String(options.body)) as SignatureRequest & { proposal_id: string };
        expect(body.proposal_id).toBe("p1");
        expect(body.signature).toBe(signature);
        count++;
        return ok({ ...proposal, status: count === 1 ? "PENDING_SECOND_PI_SIGNATURE" : "DUAL_SIGNED_AND_EXECUTED" });
      }
      if (url.includes("/proposals/")) {
        const address = (options.headers as Record<string, string> | undefined)?.["X-PI-Address"];
        return ok({ ...proposal, status: count === 1 ? "PENDING_SECOND_PI_SIGNATURE" : "DUAL_SIGNED_AND_EXECUTED",
          proposer_signed: count >= 1, target_signed: count >= 2, expired: false,
          ...(address ? { download_token: address === "lab_catalysis" ? "grant_battery" : "grant_oer",
            downloaded_slice_id: address === "lab_catalysis" ? battery.slice_id : oer.slice_id } : {}) });
      }
      if (url.includes("/download")) {
        expect(options.headers).toEqual({ "X-Payment-Receipt": "grant_oer" });
        return Response.json(oer);
      }
      throw new Error(`Unexpected request ${url}`);
    });
    vi.stubGlobal("fetch", fetch);
    const api = createLiveApi();
    await api.propose({ offered_slice_id: oer.slice_id, requested_slice_id: battery.slice_id,
      proposer_agent_id: "unused", target_agent_id: "unused", proof_of_priority_hash: "actual-root" });
    expect((await api.sign("p1", "pi_proposer")).status).toBe("PENDING_SECOND_PI_SIGNATURE");
    expect(fetch.mock.calls.filter(([url, options]) => String(url).includes("/proposals/") && options.headers?.["X-PI-Address"])).toHaveLength(0);
    expect((await api.sign("p1", "pi_target")).status).toBe("DUAL_SIGNED_AND_EXECUTED");
    expect((await api.access(oer.slice_id)).kind).toBe("delivered");
    expect(reviewed.mock.calls.map(([request]) => request.address)).toEqual(["lab_catalysis", "lab_battery"]);
  });
  it("never prompts for a signature from automatic analytics reads", async () => {
    const reviewed = reviewSignatures();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok([summary()])));
    await expect(createLiveApi().analytics("electrocatalysis")).rejects.toMatchObject({ status: 402 });
    expect(reviewed).not.toHaveBeenCalled();
  });
});
