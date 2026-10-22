import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Dashboard } from "../src/pages/Dashboard";
import { HumanDualSignModal } from "../src/components/HumanDualSignModal";
import { PhysicsCompilerConsole } from "../src/components/PhysicsCompilerConsole";
import { catalog, createMockApi, rejected } from "../src/mocks/fixtures";
import type { Agreement } from "../src/api/contracts";
// Geometry is tested in a real browser. Keep unit tests focused on scientific state and text.
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
describe("scientific workspace", () => {
  it("renders the English dashboard, catalog and explicit simulated mode", async () => {
    render(<Dashboard api={createMockApi()} />);
    expect(
      await screen.findByRole("heading", { name: "Scientific slice catalog" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Demo mode · simulated")).toBeInTheDocument();
    expect(
      await screen.findByText("Simulated NiFe-LDH · OER-001"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /LSV polarization.*mA\/cm²/ }),
    ).toBeInTheDocument();
  });
  it("shows network errors without loading mock success", async () => {
    const api = createMockApi();
    api.mode = "live";
    api.catalog = vi.fn().mockRejectedValue(new Error("Backend unavailable"));
    render(<Dashboard api={api} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Backend unavailable",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
  it("renders rejection diagnostics and escaped injection alerts", () => {
    const unsafe = {
      ...rejected,
      safety_alerts: [
        {
          ...rejected.safety_alerts[0],
          pattern_matched: "<img src=x onerror=alert(1) />",
        },
      ],
    };
    const { container } = render(
      <PhysicsCompilerConsole
        slices={catalog}
        mode="mock"
        results={{ [unsafe.slice_id]: unsafe }}
        onVerify={vi.fn()}
        onInspect={vi.fn()}
      />,
    );
    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.getByText(/observed 108.2/)).toBeInTheDocument();
    expect(
      screen.getByText("<img src=x onerror=alert(1) />"),
    ).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });
  it("filters the catalog and preserves compiler results across navigation", async () => {
    const user = userEvent.setup();
    render(<Dashboard api={createMockApi()} />);
    await screen.findByRole("table");
    await user.type(screen.getByRole("searchbox"), "LFP");
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(
      2,
    );
    await user.click(screen.getByRole("button", { name: "Physics compiler" }));
    await user.click(screen.getByRole("button", { name: "Compile & attest" }));
    await screen.findByText("Rejected");
    await user.click(screen.getByRole("button", { name: "Overview" }));
    await user.click(screen.getByRole("button", { name: /Physics compiler/ }));
    expect(screen.getByText("Rejected")).toBeInTheDocument();
  });
  it("prevents premature settlement and supports reset", async () => {
    const user = userEvent.setup();
    render(<Dashboard api={createMockApi()} />);
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "Data exchange" }));
    await user.click(screen.getByRole("button", { name: "Propose exchange" }));
    await user.click(
      await screen.findByRole("button", { name: "Review authorization" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Approve as Lab A PI" }),
    );
    expect(
      await screen.findByRole("button", { name: "Approval recorded" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Data release remains locked")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Approve as Lab B PI" }),
    );
    expect(
      await screen.findByText("Simulated exchange settled"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close review" }));
    await user.click(screen.getByRole("button", { name: "Reset demo" }));
    expect(
      await screen.findByRole("heading", { name: "Research overview" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Data exchange" }));
    expect(
      await screen.findByRole("button", { name: "Propose exchange" }),
    ).toBeInTheDocument();
  });
  it("supports successful verification and attestation inspection", async () => {
    const user = userEvent.setup();
    render(<Dashboard api={createMockApi()} />);
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "Physics compiler" }));
    await user.selectOptions(
      screen.getByLabelText("Experimental slice"),
      catalog[0].slice_id,
    );
    await user.click(screen.getByRole("button", { name: "Compile & attest" }));
    await user.click(
      await screen.findByRole("button", { name: /Inspect attestation/ }),
    );
    expect(
      await screen.findByRole("button", { name: /Formal verification/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/FORMAL_PROOF_VALID/)).toBeInTheDocument();
  });
});
describe("live approval boundary", () => {
  const agreement: Agreement = {
    proposal: {
      proposal_id: "live-001",
      status: "PENDING_SECOND_PI_SIGNATURE",
    },
    offered: catalog[0],
    requested: catalog[1],
    approvals: ["pi_proposer", "pi_target"],
    settlementConfirmed: false,
  };
  it("shows both approvals while keeping release locked without server confirmation", () => {
    render(
      <HumanDualSignModal
        agreement={agreement}
        mock={false}
        onClose={vi.fn()}
        onApprove={vi.fn()}
      />,
    );
    expect(screen.getByText("Data release remains locked")).toBeInTheDocument();
    expect(
      screen.queryByText("Backend-confirmed settlement"),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/secure signing provider/)).toBeInTheDocument();
  });
  it("does not invoke signing on disabled live approvals", () => {
    const sign = vi.fn();
    render(
      <HumanDualSignModal
        agreement={{ ...agreement, approvals: [] }}
        mock={false}
        onClose={vi.fn()}
        onApprove={sign}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Approve as Lab A PI" }),
    );
    expect(sign).not.toHaveBeenCalled();
  });
});
