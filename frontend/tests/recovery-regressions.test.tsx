import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Dashboard } from "../src/pages/Dashboard";
import { createLiveApi } from "../src/api/client";
import { signCanonical } from "../src/api/signing";
import oer from "../../data/slices/slice_oer_valid.json";
import battery from "../../data/slices/slice_battery_valid.json";

vi.mock("../src/api/signing", async (original) => ({
  ...await original<object>(), signCanonical: vi.fn(async () => "ab".repeat(64)),
}));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null, XAxis: () => null, YAxis: () => null,
  Tooltip: () => null, Legend: () => null, Line: () => null, Brush: () => null,
}));
const ok = (data: unknown) => Response.json({ code: 200, data });
const summary = {
  slice_id: oer.slice_id, domain: oer.domain, title: oer.metadata.title,
  summary: "Synthetic fixture", data_classification: "golden", is_attested: true,
  attestation_uid: "attest_oer", price_scicredit: 50, owner_lab_id: "lab_catalysis",
  quarantined: false, accepts_barter: true,
};
const attestation = {
  attestation_uid: "attest_oer", slice_id: oer.slice_id, compiler_status: "FORMAL_PROOF_VALID",
  proof_of_priority: {}, instrument_fingerprint: {}, physics_results: {}, safety_clearance: {},
  diagnostic_logs: [], merkle_root: "document-root",
};
function challenge() {
  return Response.json({ code: 402, data: {
    slice_id: oer.slice_id, accepted_methods: ["scicredit_microtransfer"], challenge_nonce: "quote",
  } }, { status: 402, headers: {
    "X-Payment-Required": "true", "X-Payment-Amount": "50", "X-Payment-Token": "SciCredit",
    "X-Payment-Address": "lab_catalysis", "X-Settlement-Network": "Local-Devnet",
  } });
}

describe("confirmed writes survive interrupted delivery", () => {
  it.each([false, true])("reconciles the paid balance and ledger after download failure (wallet offline: %s)", async (walletOffline) => {
    let balance = 50;
    let paid = false;
    let interrupted = false;
    let recovered = false;
    let redemptions = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string, options: RequestInit) => {
      if (url.includes("/balance")) {
        if (walletOffline && paid && !recovered) throw new TypeError("wallet connection lost");
        return ok({ address: "lab_synthesis", staker_balance: balance });
      }
      if (url.includes("/slices?")) return ok([summary]);
      if (url.endsWith("/attestation")) return ok(attestation);
      if (url.endsWith("/challenge")) return ok({ nonce: "one-time", canonical_message: '{"action":"redeem"}', expires_at: "2099-01-01T00:00:00Z" });
      if (url.endsWith("/redeem")) {
        redemptions++;
        paid = true; balance = 0;
        return ok({ slice_id: oer.slice_id, download_token: "grant", expires_at: null, staker_balance: 0 });
      }
      if (url.includes("/download")) {
        if (!paid) return challenge();
        if (!interrupted) { interrupted = true; throw new TypeError("download connection lost"); }
        expect((options.headers as Record<string, string>)["X-Payment-Receipt"]).toBe("grant");
        recovered = true;
        return Response.json(oer);
      }
      throw new Error(url);
    }));
    const api = createLiveApi();
    const user = userEvent.setup();
    render(<Dashboard api={api} />);
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: `Buy data: ${oer.metadata.title}` }));
    await user.click(screen.getByRole("button", { name: "Request data access" }));
    await user.click(await screen.findByRole("button", { name: "Pay SciCredit & acquire" }));
    await screen.findByText(/Cannot confirm data delivery/);
    const displayedBalance = () => within(screen.getByRole("dialog")).getByText("Available SciCredit").parentElement!;
    expect(balance).toBe(0);
    expect(displayedBalance()).toHaveTextContent(walletOffline ? "Unavailable" : "0 SC");
    if (!walletOffline) expect((await api.wallet())?.entries).toEqual([
      expect.objectContaining({ kind: "purchase", amount: -50, sliceId: oer.slice_id }),
    ]);
    await user.click(screen.getByRole("button", { name: "Refresh access challenge" }));
    await screen.findByText("Backend delivery confirmed");
    expect(displayedBalance()).toHaveTextContent("0 SC");
    expect(redemptions).toBe(1);
    expect((await api.wallet())?.entries).toEqual([
      expect.objectContaining({ kind: "purchase", amount: -50, sliceId: oer.slice_id }),
    ]);
  });

  it.each(["lost response", "rejected signature"] as const)("recovers only usable PI proofs after a %s", async (failure) => {
    let proposerSigned = false;
    let targetSigned = false;
    const readers: string[] = [];
    const proposal = {
      proposal_id: "p-recovery", status: "PENDING_DUAL_SIGNATURE", party_a_lab: "lab_catalysis",
      party_a_slice_id: oer.slice_id, party_b_lab: "lab_battery", party_b_slice_id: battery.slice_id,
      canonical_agreement: '{"proposal_id":"p-recovery"}', expires_at: "2099-01-01T00:00:00Z",
    };
    vi.stubGlobal("fetch", vi.fn(async (url: string, options: RequestInit) => {
      if (url.includes("/slices?")) return ok([summary, { ...summary, slice_id: battery.slice_id, domain: battery.domain, owner_lab_id: "lab_battery" }]);
      if (url.endsWith("/negotiate")) return ok(proposal);
      if (url.endsWith("/dual-sign")) {
        const body = JSON.parse(String(options.body));
        if (body.signer_role === "pi_proposer") {
          if (failure === "rejected signature") return Response.json({ message: "Invalid signature" }, { status: 403 });
          proposerSigned = true;
          throw new TypeError("POST committed but response lost");
        }
        // In the rejection case, A later signs successfully from another client.
        proposerSigned = true; targetSigned = true;
        return ok({ ...proposal, status: "DUAL_SIGNED_AND_EXECUTED", download_token: "grant-oer", downloaded_slice_id: oer.slice_id });
      }
      if (url.includes("/proposals/")) {
        const address = (options.headers as Record<string, string> | undefined)?.["X-PI-Address"];
        if (address) readers.push(address);
        return ok({ ...proposal,
          status: targetSigned ? "DUAL_SIGNED_AND_EXECUTED" : proposerSigned ? "PENDING_SECOND_PI_SIGNATURE" : "PENDING_DUAL_SIGNATURE",
          proposer_signed: proposerSigned, target_signed: targetSigned, expired: false,
          ...(address ? { download_token: address === "lab_catalysis" ? "grant-battery" : "grant-oer",
            downloaded_slice_id: address === "lab_catalysis" ? battery.slice_id : oer.slice_id } : {}),
        });
      }
      if (url.includes("/download")) {
        const receipt = (options.headers as Record<string, string>)["X-Payment-Receipt"];
        expect(receipt).toBe(url.includes(battery.slice_id) ? "grant-battery" : "grant-oer");
        return Response.json(url.includes(battery.slice_id) ? battery : oer);
      }
      throw new Error(url);
    }));
    const api = createLiveApi();
    await api.propose({ proposer_agent_id: "a", offered_slice_id: oer.slice_id, target_agent_id: "b", requested_slice_id: battery.slice_id, proof_of_priority_hash: "root" });
    await expect(api.sign(proposal.proposal_id, "pi_proposer", {
      signer_role: "pi_proposer", signer_address: "lab_catalysis", signature: "ab".repeat(64),
    })).rejects.toThrow(failure === "lost response" ? "Cannot reach" : "Invalid signature");
    expect((await api.poll!(proposal.proposal_id)).proposer_signed).toBe(failure === "lost response");
    const settled = await api.sign(proposal.proposal_id, "pi_target", {
      signer_role: "pi_target", signer_address: "lab_battery", signature: "cd".repeat(64),
    });
    expect(settled.status).toBe("DUAL_SIGNED_AND_EXECUTED");
    expect(readers).toEqual(failure === "lost response" ? ["lab_catalysis", "lab_battery"] : ["lab_battery"]);
    expect((await api.access(oer.slice_id)).kind).toBe("delivered");
    if (failure === "lost response") expect((await api.access(battery.slice_id)).kind).toBe("delivered");
  });
});

describe("owner authorization can be renewed without losing downloaded data", () => {
  it.each([60_000, 5 * 60_000])("explicitly obtains a fresh proof for cached data after %i ms", async (elapsed) => {
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    const analysisCalls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, options: RequestInit) => {
      if (url.includes("/balance")) return ok({ address: "lab_catalysis", staker_balance: 0 });
      if (url.includes("/slices?")) return ok([summary]);
      if (url.endsWith("/attestation")) return ok(attestation);
      if (url.includes("/download")) return Response.json(oer);
      if (url.endsWith("/analysis")) {
        const headers = options.headers as Record<string, string>;
        expect(Date.parse(headers["X-PI-Expires-At"])).toBeGreaterThan(Date.now());
        const { analysis_type: type } = JSON.parse(String(options.body));
        analysisCalls.push(type);
        return ok({ slice_id: oer.slice_id, analysis_type: type, result: type === "tafel_slope" ? {
          tafel_slope_mv_dec: 42.5, r_squared: 1, overpotential_10ma_mv: 240,
          potential_10ma_v: 1.469, intercept_mv: 197.5, fit_current_range_ma_cm2: [1, 10],
        } : { tafel_slope_mv_dec: 42.5, voltage_v: [1.4265, 1.469], current_density_ma_cm2: [1, 10], kinetic_consistent: true } });
      }
      throw new Error(url);
    }));
    const api = createLiveApi(undefined, "lab_catalysis");
    const user = userEvent.setup();
    render(<Dashboard api={api} />);
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: `Read own data: ${oer.metadata.title}` }));
    await user.click(screen.getByRole("button", { name: "Request data access" }));
    await screen.findByText("Backend delivery confirmed");
    await user.click(screen.getByRole("button", { name: "Close review" }));
    clock.mockReturnValue(now + elapsed);
    if (elapsed > 4 * 60_000) {
      await user.click(screen.getByRole("button", { name: "Scientific analytics" }));
      await screen.findByText(/Analysis is locked/);
      expect(analysisCalls).toEqual([]);
    }
    await user.click(screen.getByRole("button", { name: "Buy data" }));
    await user.click(screen.getByRole("button", { name: `View acquired data: ${oer.metadata.title}` }));
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Download data" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Refresh owner authorization" }));
    await waitFor(() => expect(signCanonical).toHaveBeenCalledTimes(2));
    const messages = vi.mocked(signCanonical).mock.calls.map((call) => JSON.parse(call[1]));
    expect(Date.parse(messages[1].expires_at)).toBe(now + elapsed + 4 * 60_000);
    expect(messages[1].expires_at).not.toBe(messages[0].expires_at);
    await waitFor(() => expect(screen.getByRole("button", { name: "Close review" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Close review" }));
    await user.click(screen.getByRole("button", { name: "Scientific analytics" }));
    await screen.findByText(`Synthetic benchmark served by backend · ${oer.slice_id}`);
    expect(analysisCalls).toEqual(["tafel_slope", "dta"]);
    expect(screen.queryByText(/Analysis is locked/)).not.toBeInTheDocument();
  });
});
