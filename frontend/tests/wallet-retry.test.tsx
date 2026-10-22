import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Dashboard } from "../src/pages/Dashboard";
import { createLiveApi } from "../src/api/client";
import { signCanonical } from "../src/api/signing";
import dark from "../../data/slices/slice_dark_reaction.json";

vi.mock("../src/api/signing", async (original) => ({
  ...await original<object>(),
  signCanonical: vi.fn(async () => "ab".repeat(64)),
}));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null, XAxis: () => null, YAxis: () => null,
  Tooltip: () => null, Legend: () => null, Line: () => null, Brush: () => null,
}));

const ok = (data: unknown) => Response.json({ code: 200, data });
const summary = {
  slice_id: dark.slice_id,
  domain: dark.domain,
  title: dark.metadata.title,
  summary: dark.metadata.summary,
  data_classification: dark.metadata.data_classification,
  owner_lab_id: dark.metadata.owner_lab_id,
  is_attested: true,
  attestation_uid: "attest_dark",
  price_scicredit: 50,
  quarantined: false,
  accepts_barter: true,
};

describe("wallet reads can retry independently of a confirmed deposit", () => {
  it.each([
    { destination: "Data vault", failedReads: 1 },
    { destination: "Buy data", failedReads: 1 },
    { destination: "Data vault", failedReads: 2 },
  ])("recovers from $failedReads failed balance reads in $destination without another deposit", async ({ destination, failedReads }) => {
    let deposited = false;
    let remainingFailures = failedReads;
    let deposits = 0;
    let challenges = 0;
    const requests: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, options: RequestInit) => {
      const path = new URL(url).pathname;
      requests.push(`${options.method ?? "GET"} ${path}`);
      if (path.endsWith("/vault/balance")) {
        if (deposited && remainingFailures > 0) {
          remainingFailures--;
          throw new TypeError("Balance response interrupted");
        }
        return ok({ address: "lab_synthesis", staker_balance: deposited ? 50 : 0 });
      }
      if (path.endsWith("/slices")) return ok([summary]);
      if (path.endsWith("/vault/challenge")) {
        challenges++;
        return ok({ nonce: "deposit-challenge", canonical_message: '{"action":"deposit"}', expires_at: "2099-01-01T00:00:00Z" });
      }
      if (path.endsWith("/vault/deposit")) {
        deposits++;
        deposited = true;
        return ok({ minted_scicredit: 50, vault_pool_total_slices: 1, staker_balance: 50 });
      }
      throw new Error(`Unexpected request: ${path}`);
    }));
    const user = userEvent.setup();
    render(<Dashboard api={createLiveApi()} />);
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "Data vault" }));
    await user.click(screen.getByRole("button", { name: "Stake failure data" }));
    await screen.findByRole("button", { name: "Retry balance" });

    const depositPanel = within(screen.getByRole("heading", { name: "Data liquidity vault", level: 2 }).closest("section")!);
    expect(depositPanel.getByRole("button", { name: "Deposit recorded" })).toBeDisabled();
    expect(depositPanel.getByText("Balance after this deposit").parentElement).toHaveTextContent("50");
    expect(depositPanel.queryByRole("alert")).not.toBeInTheDocument();

    if (destination === "Buy data")
      await user.click(screen.getByRole("button", { name: "Buy data" }));
    const wallet = within(screen.getByRole("heading", { name: "SciCredit wallet" }).closest("section")!);
    expect(wallet.getByText("Available SciCredit").parentElement).toHaveTextContent("Unavailable");
    const retryRequestsStart = requests.length;
    if (failedReads === 2) {
      await user.click(wallet.getByRole("button", { name: "Retry balance" }));
      await wallet.findByText(/Cannot reach the backend/);
      expect(wallet.getByRole("button", { name: "Retry balance" })).toBeEnabled();
      expect(wallet.getByText("Available SciCredit").parentElement).toHaveTextContent("Unavailable");
    }
    await user.click(wallet.getByRole("button", { name: "Retry balance" }));
    await waitFor(() => expect(wallet.getByText("Available SciCredit").parentElement).toHaveTextContent("50 SC"));
    expect(wallet.getByText("Credit entries").parentElement).toHaveTextContent("1");
    expect(wallet.getByText(/Failure-data credit/)).toHaveTextContent("+50 SC");
    expect(wallet.queryByRole("alert")).not.toBeInTheDocument();
    expect(deposits).toBe(1);
    expect(challenges).toBe(1);
    expect(signCanonical).toHaveBeenCalledTimes(1);
    expect(requests.slice(retryRequestsStart)).toEqual(
      Array.from({ length: failedReads }, () => "GET /api/v1/vault/balance"),
    );
  });
});
