import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Dashboard } from "../src/pages/Dashboard";
import { BarterNegotiationCard } from "../src/components/BarterNegotiationCard";
import { createMockApi } from "../src/mocks/fixtures";
import { sliceSchema, type Agreement } from "../src/api/contracts";
import oer from "../../data/slices/slice_oer_valid.json";
import battery from "../../data/slices/slice_battery_valid.json";
import bad from "../../data/slices/slice_oer_violation.json";

const slices = [battery, oer, bad].map((document) => sliceSchema.parse({
  ...document.metadata,
  slice_id: document.slice_id,
  domain: document.domain,
  is_attested: false,
  price_scicredit: 50,
  attestation_uid: null,
  quarantined: document.slice_id === bad.slice_id,
}));
const offered = { ...slices[1], is_attested: true, attestation_uid: "oer-proof" };
const requested = { ...slices[0], is_attested: true, attestation_uid: "battery-proof" };

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null, XAxis: () => null, YAxis: () => null,
  Tooltip: () => null, Legend: () => null, Line: () => null, Brush: () => null,
}));

describe("catalog selection and proposal identity", () => {
  it("compiles the inspected slice on cold start and after a previous compiler visit", async () => {
    const user = userEvent.setup();
    const api = createMockApi();
    api.mode = "live";
    api.catalog = async () => slices;
    api.analytics = async () => { throw new Error("Analysis locked"); };
    api.verify = vi.fn(async (input) => ({
      valid: false,
      slice_id: input.slice_id,
      violated_axioms: [], safety_alerts: [], diagnostic_log: "Test verification response",
    }));
    render(<Dashboard api={api} />);
    await screen.findByRole("table");
    for (const document of [battery, oer]) {
      await user.click(screen.getByRole("button", { name: `Inspect ${document.metadata.title}` }));
      expect(screen.getByLabelText("Experimental slice")).toHaveValue(document.slice_id);
      await user.click(screen.getByRole("button", { name: "Compile & attest" }));
      await waitFor(() => expect(api.verify).toHaveBeenLastCalledWith({ slice_id: document.slice_id }));
      await user.click(screen.getByRole("button", { name: "Overview" }));
    }
    expect(api.verify).toHaveBeenCalledTimes(2);
  });

  it("finds the available different-owner pair when the first OER belongs to the battery lab", async () => {
    const user = userEvent.setup();
    const sameOwner = {
      ...offered, slice_id: "a_battery_lab_oer", title: "Battery laboratory OER",
      owner_lab_id: requested.owner_lab_id,
    };
    const propose = vi.fn().mockResolvedValue(undefined);
    render(<BarterNegotiationCard slices={[sameOwner, requested, offered]}
      onPropose={propose} onReview={vi.fn()} mock={false} />);
    await user.click(screen.getByRole("button", { name: "Propose exchange" }));
    expect(propose).toHaveBeenCalledWith(offered, requested);
    expect(screen.queryByText(sameOwner.title)).not.toBeInTheDocument();
  });

  it("does not offer an exchange when all complementary slices belong to one laboratory", () => {
    render(<BarterNegotiationCard
      slices={[{ ...offered, owner_lab_id: requested.owner_lab_id }, requested]}
      onPropose={vi.fn()} onReview={vi.fn()} mock={false} />);
    expect(screen.queryByRole("button", { name: "Propose exchange" })).not.toBeInTheDocument();
    expect(screen.getByText("Two attested slices from different laboratories and complementary domains are required.")).toBeInTheDocument();
  });

  it("keeps both cards bound to the existing proposal after the catalog changes", () => {
    const agreement: Agreement = {
      proposal: { proposal_id: "existing-proposal", status: "PENDING_DUAL_SIGNATURE" },
      offered, requested, approvals: [], settlementConfirmed: false,
    };
    const props = { agreement, onPropose: vi.fn(), onReview: vi.fn(), mock: false };
    const { rerender } = render(<BarterNegotiationCard {...props} slices={[offered, requested]} />);
    const newer = { ...offered, slice_id: "a_new_oer", title: "Later uploaded OER" };
    rerender(<BarterNegotiationCard {...props} slices={[newer, requested, offered]} />);
    expect(screen.getByText(offered.title)).toBeInTheDocument();
    expect(screen.getByText(requested.title)).toBeInTheDocument();
    expect(screen.queryByText(newer.title)).not.toBeInTheDocument();
    expect(screen.getByText("existing-proposal")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review authorization" })).toBeInTheDocument();
  });
});
