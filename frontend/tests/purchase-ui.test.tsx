import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Dashboard } from "../src/pages/Dashboard";
import {
  catalog,
  createMockApi,
  rejected,
  demoAttestation,
} from "../src/mocks/fixtures";
import { HeaderNavbar } from "../src/components/HeaderNavbar";
import type { Verification } from "../src/api/contracts";
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
describe("purchase workflow and adversarial UI state", () => {
  it("exposes a dedicated marketplace from the heading and navigation", async () => {
    const user = userEvent.setup();
    render(<Dashboard api={createMockApi({ delayMs: 0 })} />);
    await screen.findByRole("table");
    await user.click(
      screen.getByRole("button", { name: "Buy data with SciCredit" }),
    );
    expect(
      screen.getByRole("heading", { name: "Data marketplace" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Buy data: NiFe-LDH OER kinetics" }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close review" }));
    expect(
      screen.getByRole("button", { name: `Buy data: ${catalog[2].title}` }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Overview" }));
    await user.click(screen.getByRole("button", { name: "Buy data" }));
    expect(
      screen.getByRole("heading", { name: "Data marketplace" }),
    ).toBeInTheDocument();
  });
  it("purchases, preserves acquired data across navigation, and earns credit into the same wallet", async () => {
    const user = userEvent.setup();
    render(<Dashboard api={createMockApi({ delayMs: 0 })} />);
    await screen.findByRole("table");
    await user.click(
      screen.getByRole("button", { name: "Buy data: NiFe-LDH OER kinetics" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Request data access" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Pay SciCredit & acquire" }),
    );
    await screen.findByText("Simulated purchase confirmed");
    expect(
      screen.getByRole("button", { name: "Download data" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close review" }));
    await user.click(screen.getByRole("button", { name: "Data vault" }));
    await user.click(
      screen.getByRole("button", { name: "Stake failure data" }),
    );
    await screen.findByRole("button", { name: "Deposit recorded" });
    expect(screen.getByText("85 SC", { exact: true })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Overview" }));
    expect(
      screen.getByRole("button", {
        name: "View acquired data: NiFe-LDH OER kinetics",
      }),
    ).toBeInTheDocument();
  });
  it("keeps insufficient funds locked, then allows purchase after earning credit", async () => {
    const user = userEvent.setup();
    render(
      <Dashboard api={createMockApi({ initialBalance: 0, delayMs: 0 })} />,
    );
    await screen.findByRole("table");
    await user.click(
      screen.getByRole("button", {
        name: "Buy data: LFP fast-charge degradation",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Request data access" }),
    );
    expect(
      await screen.findByRole("button", { name: "Pay SciCredit & acquire" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Download data" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open data vault" }));
    await user.click(
      screen.getByRole("button", { name: "Stake failure data" }),
    );
    await screen.findByRole("button", { name: "Deposit recorded" });
    await user.click(screen.getByRole("button", { name: "Overview" }));
    await user.click(
      screen.getByRole("button", {
        name: "Buy data: LFP fast-charge degradation",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Request data access" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Pay SciCredit & acquire" }),
    );
    await screen.findByText("Simulated purchase confirmed");
    expect(
      within(screen.getByRole("dialog")).getByText("15 SC"),
    ).toBeInTheDocument();
  });
  it("removes the live low-balance warning after delivery but keeps it for an unacquired slice", async () => {
    const user = userEvent.setup();
    const api = createMockApi({ initialBalance: 50, delayMs: 0 });
    api.mode = "live";
    api.getLab = () => "lab_synthesis";
    render(<Dashboard api={api} />);
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "Buy data: NiFe-LDH OER kinetics" }));
    await user.click(screen.getByRole("button", { name: "Request data access" }));
    await user.click(await screen.findByRole("button", { name: "Pay SciCredit & acquire" }));
    await screen.findByText("Backend delivery confirmed");
    const completed = within(screen.getByRole("dialog"));
    expect(completed.getByText("0 SC")).toBeInTheDocument();
    expect(completed.getByRole("button", { name: "Download data" })).toBeEnabled();
    expect(completed.queryByText(/Your balance is below the price/)).not.toBeInTheDocument();
    expect(completed.queryByRole("button", { name: "Open data vault" })).not.toBeInTheDocument();

    await user.click(completed.getByRole("button", { name: "Close review" }));
    await user.click(screen.getByRole("button", { name: "Buy data: LFP fast-charge degradation" }));
    await user.click(screen.getByRole("button", { name: "Request data access" }));
    const pending = within(screen.getByRole("dialog"));
    expect(await pending.findByText(/Your balance is below the price/)).toBeInTheDocument();
    expect(pending.getByRole("button", { name: "Open data vault" })).toBeInTheDocument();
    expect(pending.queryByRole("button", { name: "Download data" })).not.toBeInTheDocument();
  });
  it.each([0, 1])(
    "quarantines a newly rejected catalog slice across purchasing, barter and provenance (%i)",
    async (index) => {
      const user = userEvent.setup();
      const api = createMockApi({ delayMs: 0 });
      api.verify = async (input) => ({ ...rejected, slice_id: input.slice_id });
      const attest = vi.spyOn(api, "attestation");
      render(<Dashboard api={api} />);
      await screen.findByRole("table");
      await user.click(
        screen.getByRole("button", { name: "Physics compiler" }),
      );
      await user.selectOptions(
        screen.getByLabelText("Experimental slice"),
        catalog[index].slice_id,
      );
      await user.click(
        screen.getByRole("button", { name: "Compile & attest" }),
      );
      await screen.findByText("Rejected");
      await user.click(screen.getByRole("button", { name: "Overview" }));
      expect(
        screen.getByRole("button", {
          name: `Buy data: ${catalog[index].title}`,
        }),
      ).toBeDisabled();
      await user.click(screen.getByRole("button", { name: "Data exchange" }));
      expect(
        screen.queryByRole("button", { name: "Propose exchange" }),
      ).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Provenance" }));
      await user.selectOptions(
        screen.getByLabelText("Inspect slice"),
        catalog[index].slice_id,
      );
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Slice rejected",
      );
      expect(
        attest.mock.calls.filter((call) => call[0] === catalog[index].slice_id),
      ).toHaveLength(0);
    },
  );
  it("checks the target attestation instead of trusting catalog metadata alone", async () => {
    const user = userEvent.setup();
    const api = createMockApi({ delayMs: 0 });
    api.attestation = async (id) => ({
      ...demoAttestation(id),
      attestation_uid:
        id === catalog[1].slice_id ? "wrong_uid" : catalog[0].attestation_uid!,
    });
    const propose = vi.spyOn(api, "propose");
    render(<Dashboard api={api} />);
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "Data exchange" }));
    await user.click(screen.getByRole("button", { name: "Propose exchange" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "matching, valid attestation",
    );
    expect(propose).not.toHaveBeenCalled();
  });
  it("prevents reset while verification is pending and does not mislabel it as resetting", async () => {
    const user = userEvent.setup();
    const api = createMockApi({ delayMs: 0 });
    let resolve!: (value: Verification) => void;
    api.verify = () =>
      new Promise((r) => {
        resolve = r;
      });
    const reset = vi.spyOn(api, "reset");
    render(<Dashboard api={api} />);
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "Physics compiler" }));
    await user.click(screen.getByRole("button", { name: "Compile & attest" }));
    expect(screen.getByRole("button", { name: "Reset demo" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Reset demo" }));
    expect(reset).not.toHaveBeenCalled();
    resolve(rejected);
    await screen.findByText("Rejected");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Reset demo" })).toBeEnabled(),
    );
  });
  it("does not advertise live instruments or vault health as connected without evidence", () => {
    render(
      <HeaderNavbar
        page="Overview"
        mock={false}
        resetting={false}
        onReset={() => {}}
      />,
    );
    expect(screen.getAllByText("Status unavailable")).toHaveLength(3);
    expect(screen.queryByText("Active")).not.toBeInTheDocument();
  });
});

it("does not overwrite a confirmed wallet snapshot with a stale failed initial read", async () => {
  const user = userEvent.setup();
  const api = createMockApi({ delayMs: 0 });
  let rejectInitial!: (error: Error) => void;
  api.wallet = () =>
    new Promise((_resolve, reject) => {
      rejectInitial = reject;
    });
  render(<Dashboard api={api} />);
  await screen.findByRole("table");
  await user.click(
    screen.getByRole("button", { name: "Buy data: NiFe-LDH OER kinetics" }),
  );
  await user.click(screen.getByRole("button", { name: "Request data access" }));
  await user.click(
    await screen.findByRole("button", { name: "Pay SciCredit & acquire" }),
  );
  await screen.findByText("Simulated purchase confirmed");
  rejectInitial(new Error("stale request failure"));
  await waitFor(() =>
    expect(
      within(screen.getByRole("dialog")).queryByText("Unavailable"),
    ).not.toBeInTheDocument(),
  );
  expect(within(screen.getByRole("dialog")).getAllByText("50 SC")).toHaveLength(
    2,
  );
});

it("allows an owner to read safe uncompiled data without opening other labs' data", async () => {
  const user = userEvent.setup();
  const api = createMockApi({ delayMs: 0 });
  api.mode = "live";
  api.getLab = () => "lab_catalysis";
  api.catalog = vi.fn().mockResolvedValue([
    {
      ...catalog[0],
      owner_lab_id: "lab_catalysis",
      is_attested: false,
      attestation_uid: null,
    },
    {
      ...catalog[1],
      owner_lab_id: "lab_battery",
      is_attested: false,
      attestation_uid: null,
    },
    { ...catalog[2], owner_lab_id: "lab_catalysis", quarantined: true },
  ]);
  api.attestation = vi.fn();
  api.access = vi.fn().mockResolvedValue({
    kind: "delivered",
    sliceId: catalog[0].slice_id,
    format: "json",
    text: '{"columns":["potential_v_rhe"],"rows":[[1.23]]}',
    rowCount: 1,
    columnCount: 1,
    filename: "slice.json",
    mediaType: "application/json",
  });
  render(<Dashboard api={api} />);
  await screen.findByRole("table");
  expect(
    screen.getByRole("button", {
      name: "Buy data: LFP fast-charge degradation",
    }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Buy data: Flagged OER submission" }),
  ).toBeDisabled();
  await user.click(
    screen.getByRole("button", {
      name: "Read own data: NiFe-LDH OER kinetics",
    }),
  );
  await user.click(screen.getByRole("button", { name: "Request data access" }));
  expect(
    await screen.findByRole("button", { name: "Download data" }),
  ).toBeEnabled();
  expect(api.access).toHaveBeenCalledWith(catalog[0].slice_id, false);
  expect(api.attestation).not.toHaveBeenCalled();
});
