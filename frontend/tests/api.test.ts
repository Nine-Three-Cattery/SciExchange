import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, createLiveApi, resolveMode } from "../src/api/client";
import { applySignature, type Agreement } from "../src/api/contracts";
import { catalog, createMockApi, submissions } from "../src/mocks/fixtures";
afterEach(() => vi.useRealTimers());
const agreement: Agreement = {
  proposal: { proposal_id: "test", status: "PENDING_DUAL_SIGNATURE" },
  offered: catalog[0],
  requested: catalog[1],
  approvals: [],
  settlementConfirmed: false,
};
describe("operation modes", () => {
  it("defaults explicitly to mock and supports the legacy variable", () => {
    expect(resolveMode({})).toBe("mock");
    expect(resolveMode({ VITE_USE_MOCK: "false" })).toBe("live");
    expect(resolveMode({ VITE_DATA_MODE: "live", VITE_USE_MOCK: "true" })).toBe(
      "live",
    );
  });
  it("rejects ambiguous configuration", () => {
    expect(() => resolveMode({ VITE_DATA_MODE: "automatic" })).toThrow();
    expect(() => resolveMode({ VITE_USE_MOCK: "yes" })).toThrow();
  });
  it("never calls the network in mock mode", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await createMockApi().catalog();
    expect(fetch).not.toHaveBeenCalled();
  });
});
describe("live HTTP boundary", () => {
  it.each([400, 401, 402, 403, 404, 409, 422, 500, 502, 503])(
    "surfaces HTTP %i without converting it to success",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response("{}", { status })),
      );
      await expect(createLiveApi().catalog()).rejects.toMatchObject({ status });
    },
  );
  it("does not treat an envelope-level 402 as delivery", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ code: 402, data: {} })),
    );
    await expect(createLiveApi().catalog()).rejects.toThrow(
      "No data was delivered",
    );
  });
  it("validates catalog and rejects malformed responses", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ code: 200, data: catalog }))
      .mockResolvedValueOnce(
        Response.json({ code: 200, data: [{ title: "incomplete" }] }),
      )
      .mockResolvedValueOnce(new Response("not JSON"));
    vi.stubGlobal("fetch", fetch);
    expect(await createLiveApi().catalog()).toHaveLength(3);
    await expect(createLiveApi().catalog()).rejects.toThrow("does not match");
    await expect(createLiveApi().catalog()).rejects.toThrow("expected JSON");
  });
  it("reports network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed")));
    await expect(createLiveApi().catalog()).rejects.toThrow("Cannot reach");
  });
  it("times out a stalled request", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, options) =>
          new Promise((_resolve, reject) =>
            options.signal.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            ),
          ),
      ),
    );
    const outcome = createLiveApi()
      .catalog()
      .catch((error) => error);
    await vi.advanceTimersByTimeAsync(12001);
    expect(await outcome).toBeInstanceOf(ApiError);
    expect((await outcome).message).toContain("timed out");
  });
  it("requires human review before submitting an agreement signature", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ code: 200, data: {
      proposal_id: "id", status: "PENDING_DUAL_SIGNATURE", party_a_lab: "lab_catalysis",
      canonical_agreement: '{"proposal_id":"id"}',
    }}));
    vi.stubGlobal("fetch", fetch);
    await expect(createLiveApi().sign("id", "pi_proposer")).rejects.toThrow("review and submit a PI signature");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1].method).toBe("GET");
  });
  it("uses the gateway dual-sign route with the proposal ID and signature fields", async () => {
    const fetch = vi.fn().mockImplementation(async () =>
      Response.json({
        code: 200,
        data: { proposal_id: "id/1", status: "PENDING_SECOND_PI_SIGNATURE" },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const signature = {
      signer_role: "pi_target" as const,
      signer_address: "external-address",
      signature: "externally-created-signature",
    };
    await createLiveApi().sign("id/1", "pi_target", signature);
    expect(fetch.mock.calls[0][0]).toMatch(/\/barter\/dual-sign$/);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ proposal_id: "id/1", ...signature });
  });
  it("does not invent analysis data in live mode", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ code: 200, data: catalog })));
    await expect(createLiveApi().analytics("battery_cycling")).rejects.toThrow(
      "No simulated results",
    );
  });
});
describe("scientific and authorization semantics", () => {
  it("one PI approval does not settle an agreement", () => {
    const next = applySignature(
      agreement,
      "pi_proposer",
      "PENDING_SECOND_PI_SIGNATURE",
    );
    expect(next.approvals).toEqual(["pi_proposer"]);
    expect(next.settlementConfirmed).toBe(false);
  });
  it("two approvals without backend settlement do not settle an agreement", () => {
    const one = applySignature(
      agreement,
      "pi_proposer",
      "PENDING_SECOND_PI_SIGNATURE",
    );
    const two = applySignature(one, "pi_target", "PENDING_SECOND_PI_SIGNATURE");
    expect(two.approvals).toHaveLength(2);
    expect(two.settlementConfirmed).toBe(false);
    expect(
      applySignature(two, "pi_target", "SWAP_COMPLETED").settlementConfirmed,
    ).toBe(true);
  });
  it("unknown or failed signing status never unlocks release", () => {
    expect(
      applySignature(agreement, "pi_proposer", "REJECTED").settlementConfirmed,
    ).toBe(false);
    expect(
      applySignature(agreement, "pi_proposer", "FAILED").approvals,
    ).toEqual([]);
  });
  it("mock responses reject the fraud and attest the valid fixture", async () => {
    const api = createMockApi();
    const fraud = await api.verify(submissions[2]);
    expect(fraud.valid).toBe(false);
    expect(fraud.violated_axioms[0].observed_value).toBe(108.2);
    expect(fraud.safety_alerts[0].action).toBe("QUARANTINED");
    const valid = await api.verify(submissions[0]);
    expect(valid.valid).toBe(true);
    expect(valid.attestation_uid).toContain("demo_");
  });
  it("mock mode refuses to verify edited fixtures as successful science", async () => {
    await expect(
      createMockApi().verify({ ...submissions[0], rows: [[0, 0]] }),
    ).rejects.toThrow("deterministic fixtures");
  });
  it("reset restores the entire mock protocol", async () => {
    const api = createMockApi();
    await api.propose({
      proposer_agent_id: "agent_catalysis_0x1a",
      target_agent_id: "agent_battery_0x2b",
      offered_slice_id: catalog[0].slice_id,
      requested_slice_id: catalog[1].slice_id,
      proof_of_priority_hash: "demo_merkle_oer_001",
    });
    expect((await api.sign("demo_proposal_001", "pi_proposer")).status).toBe(
      "PENDING_SECOND_PI_SIGNATURE",
    );
    expect((await api.sign("demo_proposal_001", "pi_target")).status).toBe(
      "SWAP_COMPLETED",
    );
    await api.reset();
    await expect(api.sign("demo_proposal_001", "pi_target")).rejects.toThrow(
      "Create a proposal",
    );
  });
});
