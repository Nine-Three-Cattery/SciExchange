import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Analytics } from "../src/api/contracts";
import { catalog, createMockApi } from "../src/mocks/fixtures";
import { Dashboard } from "../src/pages/Dashboard";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null, XAxis: () => null, YAxis: () => null,
  Tooltip: () => null, Legend: () => null, Line: () => null, Brush: () => null,
}));

const priorAnalysis: Analytics = {
  source: "Authorized results for laboratory A",
  conditions: "Recorded conditions for A",
  metrics: [{ label: "Tafel slope", value: "42.48 mV/dec" }],
  plots: [],
  warning: "Numerical protocol checks",
};

function liveWorkspace() {
  const api = createMockApi({ delayMs: 0 });
  api.mode = "live";
  let lab = "lab_catalysis";
  api.getLab = () => lab;
  api.setLab = (address) => { lab = address; };
  api.catalog = async () => catalog.map((slice, index) => ({
    ...slice, owner_lab_id: index === 0 ? "lab_catalysis" : "lab_battery",
  }));
  api.analytics = vi.fn(async () => {
    if (lab !== "lab_catalysis") throw new Error("Analysis locked for laboratory B");
    return priorAnalysis;
  });
  return api;
}

describe("analysis follows the active laboratory", () => {
  it.each(["overview", "analytics"])(
    "removes prior authorized results when switching labs on %s",
    async (view) => {
      const user = userEvent.setup();
      const api = liveWorkspace();
      render(<Dashboard api={api} />);
      await screen.findByRole("table");
      if (view === "analytics")
        await user.click(screen.getByRole("button", { name: "Scientific analytics" }));
      await screen.findByText(priorAnalysis.source);
      expect(screen.getByText("42.48 mV/dec")).toBeInTheDocument();
      await user.selectOptions(screen.getByLabelText("Active lab"), "lab_battery");
      expect(await screen.findByRole("alert")).toHaveTextContent("Analysis locked for laboratory B");
      expect(screen.queryByText(priorAnalysis.source)).not.toBeInTheDocument();
      expect(screen.queryByText("42.48 mV/dec")).not.toBeInTheDocument();
    },
  );

  it("does not show a previous laboratory's late response after switching", async () => {
    const user = userEvent.setup();
    const api = liveWorkspace();
    let finishPrevious!: (analysis: Analytics) => void;
    api.analytics = vi.fn()
      .mockImplementationOnce(() => new Promise<Analytics>((resolve) => { finishPrevious = resolve; }))
      .mockRejectedValue(new Error("Analysis locked for laboratory B"));
    render(<Dashboard api={api} />);
    await screen.findByRole("table");
    await user.selectOptions(screen.getByLabelText("Active lab"), "lab_battery");
    expect(await screen.findByRole("alert")).toHaveTextContent("Analysis locked for laboratory B");
    await act(async () => { finishPrevious(priorAnalysis); });
    expect(screen.queryByText(priorAnalysis.source)).not.toBeInTheDocument();
    expect(screen.queryByText("42.48 mV/dec")).not.toBeInTheDocument();
  });
});
