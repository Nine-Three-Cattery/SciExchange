import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DualDomainAnalytics } from "../src/components/DualDomainAnalytics";
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
const analysis = {
  source: "Authorized scientific source",
  conditions: "Measured conditions",
  metrics: [],
  plots: [],
  warning: "Recorded limitations",
};
describe.each([false, true])("live analysis uses the refreshed catalog (compact: %s)", (compact) => {
  it("recovers on the first retry after another session admits the data", async () => {
    const user = userEvent.setup();
    const api = createMockApi({ delayMs: 0 });
    api.mode = "live";
    let serverApproved = false;
    let cachedApproval = false;
    api.catalog = vi.fn(async () => {
      await Promise.resolve();
      cachedApproval = serverApproved;
      return [];
    });
    api.analytics = vi.fn(async () => {
      if (!cachedApproval) throw new Error("Analysis is locked");
      return analysis;
    });
    render(<DualDomainAnalytics api={api} compact={compact} />);
    await screen.findByRole("alert");
    expect(api.catalog).toHaveBeenCalledTimes(1);
    expect(api.analytics).toHaveBeenCalledTimes(1);
    serverApproved = true;
    await user.click(screen.getByRole("button", { name: "Retry request" }));
    expect(await screen.findByText(analysis.source)).toBeInTheDocument();
    expect(api.catalog).toHaveBeenCalledTimes(2);
    expect(api.analytics).toHaveBeenCalledTimes(2);
  });
  it("surfaces a catalog failure without requesting analysis against stale metadata", async () => {
    const api = createMockApi({ delayMs: 0 });
    api.mode = "live";
    api.catalog = vi.fn(async () => {
      throw new Error("Catalog unavailable");
    });
    api.analytics = vi.fn(async () => analysis);
    render(<DualDomainAnalytics api={api} compact={compact} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Catalog unavailable",
    );
    expect(api.analytics).not.toHaveBeenCalled();
    expect(api.catalog).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(analysis.source)).not.toBeInTheDocument();
  });
  it("does not launch analysis while the initial catalog refresh is pending", async () => {
    const api = createMockApi({ delayMs: 0 });
    api.mode = "live";
    let resolve!: (value: []) => void;
    api.catalog = vi.fn(
      () =>
        new Promise<[]>((done) => {
          resolve = done;
        }),
    );
    api.analytics = vi.fn(async () => analysis);
    render(<DualDomainAnalytics api={api} compact={compact} />);
    await waitFor(() => expect(api.catalog).toHaveBeenCalledTimes(1));
    expect(api.analytics).not.toHaveBeenCalled();
    resolve([]);
    await screen.findByText(analysis.source);
    expect(api.catalog).toHaveBeenCalledTimes(1);
    expect(api.analytics).toHaveBeenCalledTimes(1);
  });
});
