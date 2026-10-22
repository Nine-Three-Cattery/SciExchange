import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { catalog, createMockApi } from "../src/mocks/fixtures";
import { Dashboard } from "../src/pages/Dashboard";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null, XAxis: () => null, YAxis: () => null,
  Tooltip: () => null, Legend: () => null, Line: () => null, Brush: () => null,
}));

describe("live catalog and wallet recovery", () => {
  it("refreshes the real balance when retrying the catalog after a disconnect", async () => {
    const user = userEvent.setup();
    const api = createMockApi({ delayMs: 0 });
    api.mode = "live";
    let online = true;
    api.catalog = vi.fn(async () => {
      if (!online) throw new Error("Gateway offline");
      return catalog;
    });
    api.wallet = vi.fn(async () => {
      if (!online) throw new Error("Gateway offline");
      return { balance: 50, entries: [] };
    });
    api.reset = vi.fn(async () => {});
    render(<Dashboard api={api} />);
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "Buy data" }));
    const initialWallet = within(screen.getByRole("heading", { name: "SciCredit wallet" }).closest("section")!);
    expect(await initialWallet.findByText("50 SC", { selector: "strong" })).toBeInTheDocument();

    online = false;
    await user.click(screen.getByRole("button", { name: "Clear session" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Gateway offline");
    expect(screen.queryByText("50 SC")).not.toBeInTheDocument();
    expect(screen.queryByText("0 SC")).not.toBeInTheDocument();
    expect(api.wallet).toHaveBeenCalledTimes(2);

    online = true;
    await user.click(screen.getByRole("button", { name: "Retry request" }));
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "Buy data" }));
    const recoveredWallet = within(screen.getByRole("heading", { name: "SciCredit wallet" }).closest("section")!);
    expect(await recoveredWallet.findByText("50 SC", { selector: "strong" })).toBeInTheDocument();
    expect(screen.queryByText("Live balance unavailable")).not.toBeInTheDocument();
    expect(api.wallet).toHaveBeenCalledTimes(3);
    expect(api.catalog).toHaveBeenCalledTimes(3);
  });

  it("does not refetch the wallet for a background compiler catalog refresh", async () => {
    const user = userEvent.setup();
    const api = createMockApi({ delayMs: 0 });
    const wallet = vi.spyOn(api, "wallet");
    const catalogRequest = vi.spyOn(api, "catalog");
    render(<Dashboard api={api} />);
    await screen.findByRole("table");
    expect(wallet).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Physics compiler" }));
    await user.click(screen.getByRole("button", { name: "Compile & attest" }));
    await screen.findByText("Rejected", { exact: true });
    await waitFor(() => expect(catalogRequest).toHaveBeenCalledTimes(2));
    expect(wallet).toHaveBeenCalledTimes(1);
  });
});
