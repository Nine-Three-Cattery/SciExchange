import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SignatureDialog } from "../src/components/SignatureDialog";
import { signCanonical } from "../src/api/signing";

describe("external PI signature review", () => {
  it("preserves canonical bytes and returns only the reviewed hexadecimal signature", async () => {
    const user = userEvent.setup();
    render(<SignatureDialog />);
    const message = '{"action":"redeem","lab":"实验室","price_scicredit":50}';
    let pending!: Promise<string>;
    act(() => {
      pending = signCanonical("lab_synthesis", message, "Redeem this slice");
    });
    expect(
      screen.getByRole("dialog", { name: "Sign authorization" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Canonical message")).toHaveValue(message);
    expect(screen.getByLabelText("Canonical message")).toHaveAttribute(
      "readonly",
    );
    expect(screen.getByLabelText("Signer lab")).toHaveValue("lab_synthesis");
    const signature = "ab".repeat(64);
    await user.type(screen.getByLabelText("Signature (hex)"), signature);
    await user.click(screen.getByRole("button", { name: "Submit signature" }));
    await expect(pending).resolves.toBe(signature);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("rejects a malformed pasted signature and lets the PI cancel without authorization", async () => {
    const user = userEvent.setup();
    render(<SignatureDialog />);
    let pending!: Promise<string | Error>;
    act(() => {
      pending = signCanonical(
        "lab_catalysis",
        '{"action":"exchange"}',
        "Approve exchange",
      ).catch((error: Error) => error);
    });
    await user.type(
      screen.getByLabelText("Signature (hex)"),
      "not-a-signature",
    );
    await user.click(screen.getByRole("button", { name: "Submit signature" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "128 hexadecimal characters",
    );
    await user.click(screen.getByRole("button", { name: "Cancel signing" }));
    expect(await pending).toEqual(
      new Error("Signature review cancelled. No authorization was submitted."),
    );
  });
});
