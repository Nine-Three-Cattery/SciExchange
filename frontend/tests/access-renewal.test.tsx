import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Dashboard } from "../src/pages/Dashboard";
import { createLiveApi } from "../src/api/client";
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
function challenge(sliceId = oer.slice_id) {
  return Response.json({ code: 402, data: {
    slice_id: sliceId, accepted_methods: ["scicredit_microtransfer"], challenge_nonce: "quote",
  } }, { status: 402, headers: {
    "X-Payment-Required": "true", "X-Payment-Amount": "50", "X-Payment-Token": "SciCredit",
    "X-Payment-Address": "lab_catalysis", "X-Settlement-Network": "Local-Devnet",
  } });
}

describe("cached files and server authorization have separate lifetimes", () => {
  it.each([false, true])("renews a paid entitlement without losing the file or another debit (first renewal rejected: %s)", async (rejectFirstRenewal) => {
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    let paid = false;
    let expires = now + 3_600_000;
    let debits = 0;
    let redemptions = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string, options: RequestInit) => {
      if (url.includes("/balance")) return ok({ address: "lab_synthesis", staker_balance: paid ? 0 : 50 });
      if (url.includes("/slices?")) return ok([summary]);
      if (url.endsWith("/attestation")) return ok(attestation);
      if (url.endsWith("/challenge")) return ok({ nonce: `nonce-${redemptions}`, canonical_message: '{"action":"redeem"}', expires_at: new Date(Date.now() + 300_000).toISOString() });
      if (url.endsWith("/redeem")) {
        redemptions++;
        if (rejectFirstRenewal && redemptions === 2)
          return Response.json({ message: "Invalid signature" }, { status: 403 });
        if (!paid) debits++;
        paid = true;
        expires = Date.now() + 3_600_000;
        return ok({ slice_id: oer.slice_id, download_token: "paid-grant", expires_at: new Date(expires).toISOString(), staker_balance: 0 });
      }
      if (url.includes("/download")) return paid && Date.now() < expires &&
        new Headers(options.headers).get("X-Payment-Receipt") === "paid-grant" ? Response.json(oer) : challenge();
      if (url.endsWith("/analysis")) {
        expect(Date.now()).toBeLessThan(expires);
        const { analysis_type: type } = JSON.parse(String(options.body));
        return ok({ slice_id: oer.slice_id, analysis_type: type, result: type === "tafel_slope" ? {
          tafel_slope_mv_dec: 42.5, r_squared: 1, overpotential_10ma_mv: 240,
          potential_10ma_v: 1.469, intercept_mv: 197.5, fit_current_range_ma_cm2: [1, 10],
        } : { tafel_slope_mv_dec: 42.5, voltage_v: [1.4265, 1.469], current_density_ma_cm2: [1, 10], kinetic_consistent: true } });
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
    await screen.findByText("Backend delivery confirmed");
    await user.click(screen.getByRole("button", { name: "Close review" }));
    clock.mockReturnValue(now + 61 * 60_000);
    await user.click(screen.getByRole("button", { name: "Scientific analytics" }));
    await screen.findByText(/Analysis is locked/);
    await user.click(screen.getByRole("button", { name: "Buy data" }));
    await user.click(screen.getByRole("button", { name: `View acquired data: ${oer.metadata.title}` }));
    await user.click(screen.getByRole("button", { name: "Refresh data authorization" }));
    const dialog = within(screen.getByRole("dialog"));
    expect(await dialog.findByText("HTTP 402 · Payment required")).toBeVisible();
    expect(dialog.getByRole("button", { name: "Download data" })).toBeEnabled();
    expect(dialog.getByText(/Existing paid access renews without another debit/)).toBeVisible();
    await user.click(dialog.getByRole("button", { name: "Renew data access" }));
    if (rejectFirstRenewal) {
      await dialog.findByText("Invalid signature");
      expect(dialog.getByRole("button", { name: "Download data" })).toBeEnabled();
      await user.click(dialog.getByRole("button", { name: "Renew data access" }));
    }
    await waitFor(() => expect(dialog.queryByText("HTTP 402 · Payment required")).not.toBeInTheDocument());
    expect(dialog.getByRole("button", { name: "Download data" })).toBeEnabled();
    expect(debits).toBe(1);
    expect((await api.wallet())?.balance).toBe(0);
    expect((await api.wallet())?.entries).toHaveLength(1);
    await user.click(dialog.getByRole("button", { name: "Close review" }));
    await user.click(screen.getByRole("button", { name: "Scientific analytics" }));
    await screen.findByText(`Synthetic benchmark served by backend · ${oer.slice_id}`);
  });
});

it("restores only the active participant's settled grant after switching laboratories", async () => {
  let proposer = false;
  let target = false;
  const readers: string[] = [];
  const proposal = {
    proposal_id: "barter-roundtrip", status: "PENDING_DUAL_SIGNATURE", party_a_lab: "lab_catalysis",
    party_a_slice_id: oer.slice_id, party_b_lab: "lab_battery", party_b_slice_id: battery.slice_id,
    canonical_agreement: '{"proposal_id":"barter-roundtrip"}', expires_at: "2099-01-01T00:00:00Z",
  };
  vi.stubGlobal("fetch", vi.fn(async (url: string, options: RequestInit) => {
    if (url.includes("/balance")) return ok({ address: new URL(url).searchParams.get("address"), staker_balance: 0 });
    if (url.includes("/slices?")) return ok([summary,
      { ...summary, slice_id: battery.slice_id, domain: battery.domain, title: battery.metadata.title, owner_lab_id: "lab_battery", attestation_uid: "attest_battery" },
      { ...summary, slice_id: "slice_dark_reaction", domain: "hydrothermal_synthesis", title: "Failed synthesis", owner_lab_id: "lab_synthesis" },
    ]);
    if (url.endsWith("/attestation")) return ok(url.includes(battery.slice_id) ? { ...attestation, slice_id: battery.slice_id, attestation_uid: "attest_battery" } : attestation);
    if (url.endsWith("/negotiate")) return ok(proposal);
    if (url.endsWith("/dual-sign")) {
      const body = JSON.parse(String(options.body));
      if (body.signer_role === "pi_proposer") proposer = true; else target = true;
      return ok({ ...proposal, status: proposer && target ? "DUAL_SIGNED_AND_EXECUTED" : "PENDING_SECOND_PI_SIGNATURE" });
    }
    if (url.includes("/proposals/")) {
      const address = new Headers(options.headers).get("X-PI-Address");
      if (address) readers.push(address);
      return ok({ ...proposal, status: proposer && target ? "DUAL_SIGNED_AND_EXECUTED" : "PENDING_SECOND_PI_SIGNATURE",
        proposer_signed: proposer, target_signed: target, expired: false,
        ...(address ? { download_token: address === "lab_catalysis" ? "grant-battery" : "grant-oer", downloaded_slice_id: address === "lab_catalysis" ? battery.slice_id : oer.slice_id } : {}),
      });
    }
    if (url.includes("/download")) {
      const receipt = new Headers(options.headers).get("X-Payment-Receipt");
      if (url.includes(battery.slice_id) && receipt === "grant-battery") return Response.json(battery);
      if (url.includes(oer.slice_id) && receipt === "grant-oer") return Response.json(oer);
      return challenge(battery.slice_id);
    }
    throw new Error(url);
  }));
  const api = createLiveApi(undefined, "lab_catalysis");
  const user = userEvent.setup();
  render(<Dashboard api={api} />);
  await screen.findByRole("table");
  await user.click(screen.getByRole("button", { name: "Data exchange" }));
  await user.click(screen.getByRole("button", { name: "Propose exchange" }));
  await user.click(await screen.findByRole("button", { name: "Review authorization" }));
  await user.click(screen.getByRole("button", { name: "Approve as Lab A PI" }));
  await screen.findByRole("button", { name: "Approval recorded" });
  await user.click(screen.getByRole("button", { name: "Approve as Lab B PI" }));
  await screen.findByText("Backend-confirmed settlement");
  expect((await api.access(battery.slice_id)).kind).toBe("delivered");
  await user.click(screen.getByRole("button", { name: "Close review" }));
  await user.selectOptions(screen.getByLabelText("Active lab"), "lab_battery");
  await user.selectOptions(screen.getByLabelText("Active lab"), "lab_catalysis");
  expect((await api.access(battery.slice_id)).kind).toBe("payment_required");
  readers.length = 0;
  await user.click(screen.getByRole("button", { name: "Restore exchange access" }));
  await waitFor(() => expect(readers).toEqual(["lab_catalysis"]));
  await waitFor(async () => expect((await api.access(battery.slice_id)).kind).toBe("delivered"));
  await user.selectOptions(screen.getByLabelText("Active lab"), "lab_synthesis");
  expect(screen.queryByRole("button", { name: "Restore exchange access" })).not.toBeInTheDocument();
  await expect(api.poll!(proposal.proposal_id, "lab_catalysis")).rejects.toThrow("active laboratory only");
  expect((await api.access(battery.slice_id)).kind).toBe("payment_required");
});
