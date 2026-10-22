import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BarterNegotiationCard } from "../src/components/BarterNegotiationCard";
import { Dashboard } from "../src/pages/Dashboard";
import { catalog, createMockApi } from "../src/mocks/fixtures";
import type { Slice } from "../src/api/contracts";

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

describe("multiple eligible slices remain actionable", () => {
  it("deposits two distinct failed experiments and keeps each result after navigating away", async () => {
    const user = userEvent.setup();
    const first: Slice = {
      ...catalog[1],
      slice_id: "failure_a",
      title: "First failed crystallization",
      domain: "hydrothermal_synthesis",
      owner_lab_id: "lab_synthesis",
    };
    const second = {
      ...first,
      slice_id: "failure_b",
      title: "Second failed crystallization",
    };
    const deposited = new Set<string>();
    const api = createMockApi({ delayMs: 0 });
    api.mode = "live";
    api.getLab = () => "lab_synthesis";
    api.catalog = async () => [first, second];
    api.wallet = async () => ({ balance: deposited.size * 50, entries: [] });
    api.stake = vi.fn(async (input) => {
      expect(input.staker_address).toBe("lab_synthesis");
      deposited.add(input.slice_id);
      return {
        minted_scicredit: 50,
        staker_balance: deposited.size * 50,
        vault_pool_total_slices: deposited.size,
      };
    });
    render(<Dashboard api={api} />);
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "Data vault" }));
    expect(screen.getByLabelText("Eligible failure-data slice")).toHaveValue(
      first.slice_id,
    );
    await user.click(
      screen.getByRole("button", { name: "Stake failure data" }),
    );
    expect(
      await screen.findByRole("button", { name: "Deposit recorded" }),
    ).toBeDisabled();

    await user.selectOptions(
      screen.getByLabelText("Eligible failure-data slice"),
      second.slice_id,
    );
    expect(
      screen.queryByText("Balance after this deposit"),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Stake failure data" }),
    );
    expect(
      await screen.findByRole("button", { name: "Deposit recorded" }),
    ).toBeDisabled();
    expect(
      screen.getByText("Balance after this deposit").parentElement,
    ).toHaveTextContent("100");
    expect(api.stake).toHaveBeenCalledTimes(2);
    expect(
      vi.mocked(api.stake).mock.calls.map(([input]) => input.slice_id),
    ).toEqual([first.slice_id, second.slice_id]);

    await user.click(screen.getByRole("button", { name: "Overview" }));
    await user.click(screen.getByRole("button", { name: "Data vault" }));
    expect(
      screen.getByRole("button", { name: "Deposit recorded" }),
    ).toBeDisabled();
    expect(
      screen.getByText("Balance after this deposit").parentElement,
    ).toHaveTextContent("50");
    await user.selectOptions(
      screen.getByLabelText("Eligible failure-data slice"),
      second.slice_id,
    );
    expect(
      screen.getByRole("button", { name: "Deposit recorded" }),
    ).toBeDisabled();
    expect(
      screen.getByText("Balance after this deposit").parentElement,
    ).toHaveTextContent("100");
  });

  it("allows choosing a registered laboratory after the initially selected PI is unavailable", async () => {
    const user = userEvent.setup();
    const unregistered = {
      ...catalog[0],
      slice_id: "a_unknown_lab",
      title: "New laboratory OER",
      owner_lab_id: "lab_new",
    };
    const propose = vi.fn(async (offered: Slice) => {
      if (offered.owner_lab_id === "lab_new")
        throw new Error("Both laboratories require registered PI public keys");
    });
    render(
      <BarterNegotiationCard
        slices={[unregistered, catalog[0], catalog[1]]}
        onPropose={propose}
        onReview={vi.fn()}
        mock={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Propose exchange" }));
    await screen.findByText(
      "Both laboratories require registered PI public keys",
    );
    await user.selectOptions(
      screen.getByLabelText("Offered slice"),
      catalog[0].slice_id,
    );
    expect(
      screen.queryByText("Both laboratories require registered PI public keys"),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Propose exchange" }));
    await waitFor(() =>
      expect(propose).toHaveBeenLastCalledWith(catalog[0], catalog[1]),
    );
    expect(propose).toHaveBeenCalledTimes(2);
  });

  it("keeps the requested selection valid when the offered laboratory changes", async () => {
    const user = userEvent.setup();
    const otherOffer = {
      ...catalog[0],
      slice_id: "oer_b",
      owner_lab_id: "lab_battery",
    };
    const otherRequest = {
      ...catalog[1],
      slice_id: "battery_c",
      owner_lab_id: "lab_third",
    };
    const propose = vi.fn().mockResolvedValue(undefined);
    render(
      <BarterNegotiationCard
        slices={[catalog[0], catalog[1], otherOffer, otherRequest]}
        onPropose={propose}
        onReview={vi.fn()}
        mock={false}
      />,
    );
    await user.selectOptions(
      screen.getByLabelText("Requested slice"),
      otherRequest.slice_id,
    );
    await user.click(screen.getByRole("button", { name: "Propose exchange" }));
    await waitFor(() =>
      expect(propose).toHaveBeenLastCalledWith(catalog[0], otherRequest),
    );
    await user.selectOptions(
      screen.getByLabelText("Offered slice"),
      otherOffer.slice_id,
    );
    expect(screen.getByLabelText("Requested slice")).toHaveValue(
      otherRequest.slice_id,
    );
    expect(
      screen
        .getByLabelText("Requested slice")
        .querySelector(`option[value="${catalog[1].slice_id}"]`),
    ).toBeNull();
    await user.click(screen.getByRole("button", { name: "Propose exchange" }));
    await waitFor(() =>
      expect(propose).toHaveBeenLastCalledWith(otherOffer, otherRequest),
    );
  });
});

it("retains scientific admission and cross-laboratory filtering without duplicate selectors", async () => {
  const user = userEvent.setup();
  const catalyst: Slice = {
    ...catalog[0],
    version: "1",
    compiler_status: "REVIEW_REQUIRED",
    review_status: "approved",
  };
  const battery: Slice = {
    ...catalog[1],
    version: "1",
    compiler_status: "REVIEW_REQUIRED",
    review_status: "approved",
  };
  const propose = vi.fn().mockResolvedValue(undefined);
  render(
    <BarterNegotiationCard
      slices={[
        catalyst,
        battery,
        {
          ...battery,
          slice_id: "same_lab_battery",
          owner_lab_id: catalyst.owner_lab_id,
        },
        { ...catalyst, slice_id: "pending_catalyst", review_status: "pending" },
      ]}
      onPropose={propose}
      onReview={vi.fn()}
      mock={false}
    />,
  );
  expect(screen.getAllByRole("combobox")).toHaveLength(2);
  expect(
    screen
      .getByLabelText("Offered slice")
      .querySelector('option[value="pending_catalyst"]'),
  ).toBeNull();
  expect(
    screen
      .getByLabelText("Requested slice")
      .querySelector('option[value="same_lab_battery"]'),
  ).toBeNull();
  await user.click(screen.getByRole("button", { name: "Propose exchange" }));
  await waitFor(() => expect(propose).toHaveBeenCalledWith(catalyst, battery));
});
