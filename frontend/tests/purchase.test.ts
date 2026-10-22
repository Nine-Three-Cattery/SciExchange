import { describe, expect, it, vi } from "vitest";
import { createLiveApi } from "../src/api/client";
import { createDelivery, parseScientificCsv } from "../src/api/access";
import { catalog, createMockApi, submissions } from "../src/mocks/fixtures";
import {
  sliceSchema,
  vaultSchema,
  verificationSchema,
  type PaymentChallenge,
} from "../src/api/contracts";
import { getOwn } from "../src/utils/records";
const a = catalog[0].slice_id,
  b = catalog[1].slice_id,
  c = catalog[2].slice_id;
const stake = {
  slice_id: b,
  row_count: 100,
  data_quality_score: 0.94,
  staker_address: "demo_lab_b",
};
const proposal = {
  proposer_agent_id: "agent_catalysis_0x1a",
  target_agent_id: "agent_battery_0x2b",
  offered_slice_id: a,
  requested_slice_id: b,
  proof_of_priority_hash: "demo_merkle_oer_001",
};
async function challenge(api: ReturnType<typeof createMockApi>, id = a) {
  const response = await api.access(id);
  expect(response.kind).toBe("payment_required");
  return response as PaymentChallenge;
}
function paymentResponse({
  id = a,
  amount = "50",
  token = "SciCredit",
  nonce = "nonce_valid",
  methods = ["scicredit_microtransfer"],
  missingHeaders = false,
} = {}) {
  return Response.json(
    {
      code: 402,
      data: { slice_id: id, accepted_methods: methods, challenge_nonce: nonce },
    },
    {
      status: 402,
      headers: missingHeaders
        ? {}
        : {
            "X-Payment-Required": "true",
            "X-Payment-Address": "external_lab",
            "X-Payment-Amount": amount,
            "X-Payment-Token": token,
            "X-Settlement-Network": "Local-Devnet",
          },
    },
  );
}
describe("SciCredit ledger and entitlement invariants", () => {
  it("debits the authoritative price, delivers real fixture bytes, and redownloads without another debit", async () => {
    const api = createMockApi({ delayMs: 0 });
    expect((await api.wallet())?.balance).toBe(100);
    const quote = await challenge(api);
    expect(quote.amount).toBe(50);
    const result = await api.purchase({ sliceId: a, nonce: quote.nonce });
    expect(result.wallet?.balance).toBe(50);
    expect(parseScientificCsv(result.delivery.text).rows).toEqual(
      submissions[0].rows,
    );
    const again = await api.purchase({ sliceId: a, nonce: quote.nonce });
    expect(again.wallet?.balance).toBe(50);
    expect(
      again.wallet?.entries.filter((e) => e.kind === "purchase"),
    ).toHaveLength(1);
    expect((await api.access(a)).kind).toBe("delivered");
  });
  it("connects failure-data earnings to purchases with no local UI balance arithmetic", async () => {
    const api = createMockApi({ delayMs: 0, initialBalance: 0 });
    const quote = await challenge(api, b);
    await expect(
      api.purchase({ sliceId: b, nonce: quote.nonce }),
    ).rejects.toThrow("Insufficient");
    expect((await api.wallet())?.balance).toBe(0);
    await api.stake(stake);
    const result = await api.purchase({ sliceId: b, nonce: quote.nonce });
    expect(result.wallet?.balance).toBe(15);
    expect(result.delivery.rowCount).toBe(100);
    expect(result.wallet?.entries.reduce((sum, e) => sum + e.amount, 0)).toBe(
      15,
    );
  });
  it("rejects a forged nonce, cross-slice replay, stale challenge and unverified zero-price slice", async () => {
    const api = createMockApi({ delayMs: 0 });
    const first = await challenge(api);
    await expect(
      api.purchase({ sliceId: a, nonce: "forged" }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      api.purchase({ sliceId: b, nonce: first.nonce }),
    ).rejects.toMatchObject({ status: 409 });
    await challenge(api);
    await expect(
      api.purchase({ sliceId: a, nonce: first.nonce }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(api.access(c)).rejects.toMatchObject({ status: 403 });
    await expect(
      api.purchase({ sliceId: c, nonce: first.nonce }),
    ).rejects.toMatchObject({ status: 403 });
    expect((await api.wallet())?.balance).toBe(100);
  });
  it("serializes concurrent purchase replay so exactly one debit occurs", async () => {
    const api = createMockApi({ delayMs: 0 });
    const quote = await challenge(api);
    await Promise.all(
      Array.from({ length: 12 }, () =>
        api.purchase({ sliceId: a, nonce: quote.nonce }),
      ),
    );
    const wallet = await api.wallet();
    expect(wallet?.balance).toBe(50);
    expect(wallet?.entries.filter((e) => e.kind === "purchase")).toHaveLength(
      1,
    );
  });
  it("serializes concurrent duplicate staking so only one reward is minted", async () => {
    const api = createMockApi({ delayMs: 0 });
    const results = await Promise.allSettled([
      api.stake(stake),
      api.stake(stake),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await api.wallet())?.balance).toBe(135);
  });
  it.each([
    { ...stake, slice_id: c },
    { ...stake, slice_id: a },
    { ...stake, row_count: 0 },
    { ...stake, row_count: 99 },
    { ...stake, data_quality_score: NaN },
    { ...stake, data_quality_score: 2 },
    { ...stake, staker_address: "" },
  ])("rejects invalid or ineligible staking input %#", async (input) => {
    const api = createMockApi({ delayMs: 0 });
    await expect(api.stake(input)).rejects.toThrow();
    expect((await api.wallet())?.balance).toBe(100);
  });
  it("rejects mismatched proposals and signatures while keeping one approval insufficient", async () => {
    const api = createMockApi({ delayMs: 0 });
    await expect(
      api.propose({ ...proposal, proof_of_priority_hash: "forged" }),
    ).rejects.toThrow();
    await expect(
      api.propose({ ...proposal, requested_slice_id: c }),
    ).rejects.toThrow();
    const first = await api.propose(proposal);
    await expect(api.sign("unknown", "pi_proposer")).rejects.toMatchObject({
      status: 409,
    });
    expect((await api.sign(first.proposal_id, "pi_proposer")).status).toBe(
      "PENDING_SECOND_PI_SIGNATURE",
    );
    expect((await api.sign(first.proposal_id, "pi_proposer")).status).toBe(
      "PENDING_SECOND_PI_SIGNATURE",
    );
    const replacement = await api.propose(proposal);
    await expect(
      api.sign(first.proposal_id, "pi_target"),
    ).rejects.toMatchObject({ status: 409 });
    expect((await api.sign(replacement.proposal_id, "pi_target")).status).toBe(
      "PENDING_SECOND_PI_SIGNATURE",
    );
  });
  it("resets after in-flight transactions and cannot reuse an old challenge or entitlement", async () => {
    const api = createMockApi({ delayMs: 1 });
    const first = await challenge(api);
    await Promise.allSettled([
      api.purchase({ sliceId: a, nonce: first.nonce }),
      api.reset(),
    ]);
    expect((await api.wallet())?.balance).toBe(100);
    const next = await challenge(api);
    expect(next.nonce).not.toBe(first.nonce);
    await expect(
      api.purchase({ sliceId: a, nonce: first.nonce }),
    ).rejects.toThrow();
    expect((await api.wallet())?.entries).toHaveLength(1);
  });
});
describe("live x402 and delivery boundary", () => {
  it("parses a genuine 402 as a challenge, never as acquired data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(paymentResponse()));
    const response = await createLiveApi().access(a);
    expect(response).toMatchObject({
      kind: "payment_required",
      sliceId: a,
      amount: 50,
    });

  });
  it.each([
    { id: b },
    { amount: "-1" },
    { amount: "NaN" },
    { amount: "Infinity" },
    { amount: "" },
    { token: "USDC" },
    { nonce: "" },
    { missingHeaders: true },
  ])(
    "rejects malformed or mismatched payment challenges %#",
    async (options) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(paymentResponse(options)),
      );
      await expect(createLiveApi().access(a)).rejects.toThrow(
        "Malformed payment challenge",
      );
    },
  );
  it("sends a real external receipt only to the frozen download route and accepts validated CSV", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response("potential_v_rhe,current_density_ma_cm2\n1.47,10\n", {
        headers: { "Content-Type": "text/csv" },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const result = await createLiveApi().purchase({
      sliceId: "slice/id",
      nonce: "nonce",
      receipt: "external-signed-receipt",
    });
    expect(result.delivery.rowCount).toBe(1);
    expect(result.wallet).toBeUndefined();
    expect(fetch.mock.calls[0][0]).toMatch(/\/slices\/slice%2Fid\/download\?format=json$/);
    expect(fetch.mock.calls[0][1]).toMatchObject({
      headers: { "X-Payment-Receipt": "external-signed-receipt" },
      redirect: "error",
      cache: "no-store",
      credentials: "omit",
    });
  });
  it("rejects header injection before transmitting an external receipt", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      createLiveApi().purchase({
        sliceId: a,
        nonce: "n",
        receipt: "proof\r\nInjected: true",
      }),
    ).rejects.toThrow("valid external payment receipt");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("a rejected receipt remains locked and returns the current challenge", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(paymentResponse({ nonce: "next" })),
    );
    await expect(
      createLiveApi().purchase({
        sliceId: a,
        nonce: "old",
        receipt: "expired",
      }),
    ).rejects.toMatchObject({ status: 402, challenge: { nonce: "next" } });
  });
  it.each([401, 403, 404, 409, 422, 500])(
    "does not deliver data for HTTP %i",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response("{}", { status })),
      );
      await expect(createLiveApi().access(a)).rejects.toMatchObject({ status });
    },
  );
  it.each([
    { type: "text/html", text: "<html>Login required</html>" },
    { type: "application/json", text: '{"code":402,"data":[[1,2]]}' },
    { type: "application/json", text: "[[1],[2,3]]" },
    { type: "application/json", text: '{"error":"denied"}' },
    { type: "text/csv", text: 'a,b\n1,=WEBSERVICE("bad")' },
    { type: "text/csv", text: '=HYPERLINK("bad"),b\n1,2' },
  ])(
    "rejects HTTP 200 error bodies and unsafe or malformed payload %#",
    async (payload) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(payload.text, {
            headers: { "Content-Type": payload.type },
          }),
        ),
      );
      await expect(createLiveApi().access(a)).rejects.toThrow();
    },
  );
  it("rejects oversized delivery and reports ambiguous transport failure without claiming payment", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("x", {
          headers: {
            "Content-Type": "text/csv",
            "Content-Length": "10485761",
          },
        }),
      ),
    );
    await expect(createLiveApi().access(a)).rejects.toThrow("10 MB");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(
      createLiveApi().purchase({ sliceId: a, nonce: "n", receipt: "external" }),
    ).rejects.toThrow("do not make a second payment");
  });
  it("accepts numeric matrices and quoted CSV without executing text", () => {
    expect(
      createDelivery(a, "json", '{"code":200,"data":[[1,2],[3,4]]}').rowCount,
    ).toBe(2);
    expect(
      parseScientificCsv('"potential","current"\r\n1.47,10\r\n').rows,
    ).toEqual([[1.47, 10]]);
    expect(() => parseScientificCsv("a,b\n0x10,2")).toThrow();
  });
});
describe("hostile identifiers and contradictory server state", () => {
  it("never reads inherited object entries as entitlements or verification results", () => {
    expect(getOwn({}, "constructor")).toBeUndefined();
    expect(getOwn({}, "toString")).toBeUndefined();
    expect(getOwn({}, "__proto__")).toBeUndefined();
    expect(getOwn({ ["constructor"]: "owned" }, "constructor")).toBe("owned");
  });
  it("rejects non-finite prices, negative rewards and contradictory verified results", () => {
    expect(
      sliceSchema.safeParse({ ...catalog[0], price_scicredit: Infinity })
        .success,
    ).toBe(false);
    expect(
      vaultSchema.safeParse({
        minted_scicredit: -1,
        vault_pool_total_slices: 1,
        staker_balance: 100,
      }).success,
    ).toBe(false);
    expect(
      verificationSchema.safeParse({
        valid: true,
        slice_id: a,
        violated_axioms: [],
        safety_alerts: [
          { type: "INJECTION", action: "QUARANTINED", pattern_matched: "x" },
        ],
        diagnostic_log: "pass",
      }).success,
    ).toBe(false);
  });
});

describe("bounded delivery and ambiguous completion", () => {
  it("times out without representing an external receipt as confirmed payment", async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal(
        "fetch",
        vi.fn(
          (_url, options) =>
            new Promise((_resolve, reject) =>
              options.signal.addEventListener("abort", () =>
                reject(new Error("aborted")),
              ),
            ),
        ),
      );
      const outcome = createLiveApi()
        .purchase({ sliceId: a, nonce: "n", receipt: "external-proof" })
        .catch((error) => error);
      await vi.advanceTimersByTimeAsync(12001);
      expect((await outcome).message).toContain("Do not pay again");
    } finally {
      vi.useRealTimers();
    }
  });
  it("rejects duplicate catalog identities and preserves safe download filenames", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ code: 200, data: [catalog[0], catalog[0]] }),
        ),
    );
    await expect(createLiveApi().catalog()).rejects.toThrow("does not match");
    const file = createDelivery("../../unexpected/path", "json", "[[1,2]]");
    expect(file.filename).not.toContain("/");
    expect(file.text).toContain("1");
  });
});
