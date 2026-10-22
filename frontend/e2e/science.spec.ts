import { sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const catalyst = "catalysis_nifec_tafel";
const battery = "battery_b1c5_early";
const curve = "battery_b1c5_cycle_10";

async function navigate(page: Page, label: string) {
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: new RegExp(`^${label}(?: \\d+)?$`) })
    .click();
}
async function signChallenge(page: Page, lab: string) {
  const dialog = page.getByRole("dialog", {
    name: "Sign authorization",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Signer lab", { exact: true })).toHaveValue(
    lab,
  );
  const message = await dialog
    .getByLabel("Canonical message", { exact: true })
    .inputValue();
  const stateDir = process.env.SCIEXCHANGE_E2E_STATE_DIR;
  if (!stateDir) throw new Error("Missing isolated test state");
  const key = await readFile(join(stateDir, "client_keys", `${lab}.pem`));
  // Only the external test client reads its temporary key; the browser receives the signature.
  const signature = sign(null, Buffer.from(message, "utf8"), key).toString(
    "hex",
  );
  await dialog.getByLabel("Signature (hex)", { exact: true }).fill(signature);
  await dialog
    .getByRole("button", { name: "Submit signature", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  return JSON.parse(message) as Record<string, unknown>;
}
async function admit(page: Page, id: string, lab: string) {
  await page.getByLabel("Active lab", { exact: true }).selectOption(lab);
  await navigate(page, "Physics compiler");
  await page.getByLabel("Experimental slice", { exact: true }).selectOption(id);
  const verified = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v1/compiler/verify",
  );
  await page
    .getByRole("button", { name: "Compile & attest", exact: true })
    .click();
  const verification = (await (await verified).json()).data;
  expect(verification.compiler_status).toBe("REVIEW_REQUIRED");
  expect(verification.valid).toBe(false);
  expect(verification.is_attested).toBe(false);
  await expect(
    page.getByText("Scientific review required", { exact: true }),
  ).toBeVisible();
  const admitted = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v1/compiler/review",
  );
  await page
    .getByRole("button", { name: "Approve admission", exact: true })
    .click();
  const message = await signChallenge(page, lab);
  expect(message.slice_id).toBe(id);
  expect(message.version).toBe("1");
  const admissionResponse = await admitted;
  expect(admissionResponse.status()).toBe(200);
  const admission = (await admissionResponse.json()).data;
  expect(admission.compiler_status).toBe("REVIEW_REQUIRED");
  expect(admission.valid).toBe(false);
  expect(admission.is_attested).toBe(true);
  await expect(
    page.getByText("Human admission approved", { exact: true }),
  ).toBeVisible();
}

test("real scientific slices: signed admission, exchange, null-safe Tafel and battery charts", async ({
  page,
  request,
}, info) => {
  const errors: string[] = [];
  const analysisRequests: {
    slice_id: string;
    version: string;
    analysis_type: string;
  }[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (req) => {
    if (new URL(req.url()).pathname === "/api/v1/analysis")
      analysisRequests.push(req.postDataJSON());
  });
  await page.goto("/");
  await expect(page.getByRole("table")).toBeVisible();

  // Keep a valid owner credential in one session while another PI session
  // changes admission. Overview Retry must refresh the authoritative catalog.
  await page.getByLabel("Active lab", { exact: true }).selectOption("lab_catalysis");
  await navigate(page, "Buy data");
  await page.getByRole("button", { name: `Read own data: ${catalyst}`, exact: true }).click();
  await page.getByRole("button", { name: "Request data access", exact: true }).click();
  const ownerMessage = await signChallenge(page, "lab_catalysis");
  expect(ownerMessage.action).toBe("owner_read");
  await expect(page.getByText("Backend delivery confirmed", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close review", exact: true }).click();
  await navigate(page, "Overview");
  const signals = page.locator(".panel").filter({
    has: page.getByRole("heading", { name: "Scientific signals", exact: true }),
  });
  await expect(signals.getByRole("alert")).toContainText("Analysis is locked");
  const reviewer = await page.context().newPage();
  await reviewer.goto("/");
  await expect(reviewer.getByRole("table")).toBeVisible();
  await admit(reviewer, catalyst, "lab_catalysis");
  await admit(reviewer, battery, "lab_battery");
  await admit(reviewer, curve, "lab_battery");
  await reviewer.close();
  await signals.getByRole("button", { name: "Retry request", exact: true }).click();
  await expect(signals.getByText("76.11 mV/dec", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Sign authorization", exact: true })).toHaveCount(0);
  const catalystRow = page.getByRole("row").filter({
    has: page.getByRole("button", { name: `Inspect ${catalyst}`, exact: true }),
  });
  await expect(catalystRow).toContainText("Human admission approved");
  await page.screenshot({ path: info.outputPath("science-overview-admission-recovered.png"), fullPage: true });

  // The same refreshed catalog must enable marketplace and barter, without
  // recompiling these already-admitted records in this browser session.
  await page.getByLabel("Active lab", { exact: true }).selectOption("lab_battery");
  await navigate(page, "Buy data");
  await expect(page.getByRole("button", { name: `Buy data: ${catalyst}`, exact: true })).toBeEnabled();

  await navigate(page, "Data exchange");
  await page.getByLabel("Offered slice").selectOption(catalyst);
  await page.getByLabel("Requested slice").selectOption(battery);
  await page
    .getByRole("button", { name: "Propose exchange", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Review authorization", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Approve as Lab A PI", exact: true })
    .click();
  await signChallenge(page, "lab_catalysis");
  await expect(
    page.getByText("Data release remains locked", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Approve as Lab B PI", exact: true })
    .click();
  await signChallenge(page, "lab_battery");
  await expect(
    page.getByText("Backend-confirmed settlement", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close review", exact: true }).click();

  await navigate(page, "Scientific analytics");
  await page.getByLabel("Analysis slice").selectOption(catalyst);
  await expect(page.getByText("76.11 mV/dec", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Not calculated", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page
      .getByText("Potential (V vs Ag/AgCl (3 M KCl))", { exact: true })
      .first(),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("science-tafel.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Battery cycling", exact: true })
    .click();
  await page.getByLabel("Analysis slice").selectOption(battery);
  await expect(
    page.getByText("Not detected in observed cycles", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Observed discharge capacity",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Descriptive capacity fit", { exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath("science-early-capacity.png"),
    fullPage: true,
  });

  await navigate(page, "Buy data");
  await page
    .getByRole("button", { name: `Read own data: ${curve}`, exact: true })
    .click();
  await page
    .getByRole("button", { name: "Request data access", exact: true })
    .click();
  await signChallenge(page, "lab_battery");
  await expect(
    page.getByText("Backend delivery confirmed", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close review", exact: true }).click();
  await navigate(page, "Scientific analytics");
  await page
    .getByRole("button", { name: "Battery cycling", exact: true })
    .click();
  await page.getByLabel("Analysis slice").selectOption(curve);
  await expect(
    page.getByText("Signed dQ/dV (Ah/V)", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("science-signed-dqdv.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  const warning = page.locator(".scientific-warning");
  await expect(warning).toContainText("FEATURES_DO_NOT_UNIQUELY_IDENTIFY_DEGRADATION_MECHANISM");
  // Allow the existing desktop-to-mobile layout transition to finish.
  await expect.poll(() => page.locator(".sidebar").evaluate((element) => element.getBoundingClientRect().right))
    .toBeLessThanOrEqual(1);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(390);
  const geometry = await page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    warningRight: document.querySelector(".scientific-warning > span")!.getBoundingClientRect().right,
  }));
  expect(geometry.scrollWidth, JSON.stringify(geometry)).toBeLessThanOrEqual(geometry.width);
  expect(geometry.warningRight).toBeLessThanOrEqual(geometry.width);
  await warning.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("science-mobile-warning-wrapped.png") });
  expect([
    ...new Set(
      analysisRequests
        .filter((item) => item.slice_id === curve)
        .map((item) => item.analysis_type),
    ),
  ]).toEqual(["dq_dv"]);
  expect(analysisRequests.every((item) => item.version === "1")).toBe(true);
  expect(
    (
      await request.get(
        "http://127.0.0.1:8766/api/v1/slices/synthetic_fault_injection/download",
      )
    ).status(),
  ).toBe(403);
  expect(errors).toEqual([]);
});
