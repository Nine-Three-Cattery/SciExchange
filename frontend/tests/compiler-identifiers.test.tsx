import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Verification } from "../src/api/contracts";
import { PhysicsCompilerConsole } from "../src/components/PhysicsCompilerConsole";
import { catalog, submissions } from "../src/mocks/fixtures";

const id = "constructor";
const slice = { ...catalog[0], slice_id: id };
const document = { ...submissions[0], slice_id: id };
const report: Verification = {
  valid: true, slice_id: id, attestation_uid: "constructor-proof",
  violated_axioms: [], safety_alerts: [], diagnostic_log: "Verified constructor record",
};

describe("compiler treats prototype-name API identifiers as ordinary records", () => {
  it("renders an uncompiled catalog record and then its own verification report", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [results, setResults] = useState<Record<string, Verification>>({});
      return <PhysicsCompilerConsole slices={[slice]} mode="live" initialSliceId={id}
        results={results} onInspect={vi.fn()}
        onVerify={async () => { setResults({ [id]: report }); }} />;
    }
    render(<Harness />);
    expect(screen.getByLabelText("Experimental slice")).toHaveValue(id);
    expect(screen.getByText("Ready", { exact: true })).toBeInTheDocument();
    expect(screen.queryByText("Verified", { exact: true })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Compile & attest" }));
    expect(await screen.findByText(report.diagnostic_log)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /constructor-proof/ })).toBeInTheDocument();
  });

  it("does not mistake an inherited property for an absent submitted JSON report", async () => {
    const user = userEvent.setup();
    const props = { slices: [slice], mode: "live" as const, initialSliceId: id,
      onVerify: vi.fn().mockResolvedValue(undefined), onInspect: vi.fn() };
    const { rerender } = render(<PhysicsCompilerConsole {...props} results={{}} />);
    await user.click(screen.getByRole("button", { name: "Submit JSON" }));
    fireEvent.change(screen.getByLabelText("Complete slice JSON · metadata, columns and rows"),
      { target: { value: JSON.stringify(document) } });
    await user.click(screen.getByRole("button", { name: "Compile & attest" }));
    expect(props.onVerify).toHaveBeenCalledWith(document);
    expect(screen.getByText("Ready", { exact: true })).toBeInTheDocument();
    rerender(<PhysicsCompilerConsole {...props} results={{ [id]: report }} />);
    expect(screen.getByText(report.diagnostic_log)).toBeInTheDocument();
    expect(screen.getByText("Verified", { exact: true })).toBeInTheDocument();
  });
});
