import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CompilerInput, Verification } from "../src/api/contracts";
import { PhysicsCompilerConsole } from "../src/components/PhysicsCompilerConsole";
import { catalog, submissions } from "../src/mocks/fixtures";

const original = submissions[0];
const originalText = JSON.stringify(original);
const originalReport: Verification = {
  valid: true,
  slice_id: original.slice_id,
  attestation_uid: "test_original_attestation",
  violated_axioms: [],
  safety_alerts: [],
  diagnostic_log: "[TEST] Original submission passed",
};

function Harness({
  initial = {},
  submit,
}: {
  initial?: Record<string, Verification>;
  submit: (input: CompilerInput) => Promise<void>;
}) {
  const [results, setResults] = useState(initial);
  return (
    <PhysicsCompilerConsole
      slices={catalog}
      mode="live"
      results={results}
      onInspect={vi.fn()}
      onVerify={async (input) => {
        await submit(input);
        setResults((current) => ({
          ...current,
          [input.slice_id]: { ...originalReport, slice_id: input.slice_id },
        }));
      }}
    />
  );
}

function editor() {
  return screen.getByLabelText("Complete slice JSON · metadata, columns and rows");
}

function expectNoCurrentProof() {
  expect(screen.queryByText("Verified", { exact: true })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Inspect attestation/ })).not.toBeInTheDocument();
  expect(screen.queryByText("[TEST] Original submission passed")).not.toBeInTheDocument();
}

describe("compiler editor report identity", () => {
  it("does not carry a catalog proof into JSON mode, and preserves it for its original catalog slice", async () => {
    const user = userEvent.setup();
    const submit = vi.fn().mockResolvedValue(undefined);
    render(<Harness initial={{ [original.slice_id]: originalReport }} submit={submit} />);
    await user.selectOptions(screen.getByLabelText("Experimental slice"), original.slice_id);
    expect(screen.getByText("Verified", { exact: true })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Submit JSON" }));
    expectNoCurrentProof();
    fireEvent.change(editor(), { target: { value: "{bad" } });
    await user.click(screen.getByRole("button", { name: "Compile & attest" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid slice JSON.");
    expectNoCurrentProof();
    expect(submit).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Select slice" }));
    expect(screen.getByText("Verified", { exact: true })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Experimental slice"), catalog[1].slice_id);
    expectNoCurrentProof();
    await user.selectOptions(screen.getByLabelText("Experimental slice"), original.slice_id);
    expect(screen.getByRole("button", { name: /test_original_attestation/ })).toBeInTheDocument();
  });

  it.each(["invalid JSON", "changed valid JSON"])(
    "invalidates a successful submitted report after editing to %s",
    async (change) => {
      const user = userEvent.setup();
      const submit = vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("Slice IDs are immutable; use a new ID for revised data"));
      render(<Harness submit={submit} />);
      await user.click(screen.getByRole("button", { name: "Submit JSON" }));
      fireEvent.change(editor(), { target: { value: originalText } });
      await user.click(screen.getByRole("button", { name: "Compile & attest" }));
      expect(await screen.findByText("Verified", { exact: true })).toBeInTheDocument();

      const revised = change === "invalid JSON"
        ? "{bad"
        : JSON.stringify({ ...original, metadata: { ...original.metadata, notes: "Revised observations" } });
      fireEvent.change(editor(), { target: { value: revised } });
      expectNoCurrentProof();
      expect(screen.getByText("Ready", { exact: true })).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Compile & attest" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(
        change === "invalid JSON" ? "Invalid slice JSON." : "Slice IDs are immutable",
      );
      expectNoCurrentProof();
      expect(submit).toHaveBeenCalledTimes(change === "invalid JSON" ? 1 : 2);
    },
  );

  it("does not attach an in-flight response to text edited while that submission was pending", async () => {
    const user = userEvent.setup();
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    const submit = vi.fn().mockReturnValue(pending);
    render(<Harness submit={submit} />);
    await user.click(screen.getByRole("button", { name: "Submit JSON" }));
    fireEvent.change(editor(), { target: { value: originalText } });
    await user.click(screen.getByRole("button", { name: "Compile & attest" }));
    expect(screen.getByRole("button", { name: "Verifying…" })).toBeDisabled();
    fireEvent.change(editor(), { target: { value: "{edited during request" } });
    await act(async () => finish());
    expectNoCurrentProof();
    expect(screen.getByText("Ready", { exact: true })).toBeInTheDocument();
    expect(editor()).toHaveValue("{edited during request");
  });
});
