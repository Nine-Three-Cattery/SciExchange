import { sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const backend = "http://127.0.0.1:8766";
const OER = "slice_oer_valid";
const BATTERY = "slice_battery_valid";
const DARK = "slice_dark_reaction";

async function navigate(page: Page, label: string) {
  const menu = page.getByRole("button", {
    name: "Open navigation",
    exact: true,
  });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: new RegExp(`^${label}(?: \\d+)?$`) })
    .click();
}

async function compile(page: Page, sliceId: string, valid: boolean) {
  await navigate(page, "Physics compiler");
  await page
    .getByLabel("Experimental slice", { exact: true })
    .selectOption(sliceId);
  const resultPromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v1/compiler/verify" &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Compile & attest", exact: true })
    .click();
  const response = await resultPromise;
  expect(response.status()).toBe(200);
  const report = (await response.json()).data;
  expect(report.slice_id).toBe(sliceId);
  expect(report.valid).toBe(valid);
  await expect(
    page.getByText(valid ? "Verified" : "Rejected", { exact: true }).first(),
  ).toBeVisible();
  return report;
}

async function submitSignature(page: Page, expectedLab: string) {
  const dialog = page.getByRole("dialog", {
    name: "Sign authorization",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Signer lab", { exact: true })).toHaveValue(
    expectedLab,
  );
  const message = await dialog
    .getByLabel("Canonical message", { exact: true })
    .inputValue();
  const stateDir = process.env.SCIEXCHANGE_E2E_STATE_DIR;
  if (!stateDir) throw new Error("Live E2E state directory was not configured");
  // Client-side test process signs the exact displayed bytes. The browser gets only the signature.
  const key = await readFile(
    join(stateDir, "client_keys", `${expectedLab}.pem`),
  );
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

test("real gateway: compiler, independent PI signing, authorized analytics and SciCredit delivery", async ({
  page,
  request,
}, info) => {
  test.skip(
    info.project.name !== "live-desktop",
    "Full protocol flow runs once against its isolated live gateway",
  );
  const errors: string[] = [];
  const secretUploads: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (req) => {
    if (req.postData()?.includes("BEGIN PRIVATE KEY"))
      secretUploads.push(req.url());
  });
  await page.goto("/");
  await expect(page.getByText("Live API mode", { exact: true })).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByLabel("Active lab", { exact: true })).toHaveValue(
    "lab_synthesis",
  );
  expect(
    (await request.get(`${backend}/api/v1/slices/${OER}/download`)).status(),
  ).toBe(402);

  // Ownership grants raw read access before attestation, without charging a wallet.
  await page
    .getByLabel("Active lab", { exact: true })
    .selectOption("lab_catalysis");
  await navigate(page, "Buy data");
  await page
    .getByRole("button", {
      name: "Read own data: Synthetic NiFe-LDH OER polarization benchmark",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Request data access", exact: true })
    .click();
  const ownerMessage = await submitSignature(page, "lab_catalysis");
  expect(ownerMessage.action).toBe("owner_read");
  expect(ownerMessage.slice_id).toBe(OER);
  await expect(
    page.getByText("Backend delivery confirmed", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close review", exact: true }).click();
  await page
    .getByLabel("Active lab", { exact: true })
    .selectOption("lab_synthesis");

  const rejected = await compile(page, "slice_oer_violation", false);
  expect(
    rejected.physics_results.AXIOM_FARADAIC_EFFICIENCY_MAX.observed_value,
  ).toBeCloseTo(108.5);
  expect(
    rejected.safety_alerts.some(
      (alert: { type: string }) => alert.type === "INDIRECT_PROMPT_INJECTION",
    ),
  ).toBe(true);
  await expect(page.getByLabel("Compiler diagnostics")).toContainText(
    "FE=108.5%",
  );
  await expect(
    page.getByText(/INDIRECT PROMPT INJECTION/).first(),
  ).toBeVisible();
  expect(
    (
      await request.get(`${backend}/api/v1/slices/slice_oer_violation/download`)
    ).status(),
  ).toBe(403);
  await page.screenshot({
    path: info.outputPath("live-compiler-rejection.png"),
    fullPage: true,
  });

  await compile(page, OER, true);
  await page.getByRole("button", { name: /Inspect attestation/ }).click();
  await expect(
    page.getByRole("button", { name: /Priority attestation/ }),
  ).toBeVisible();
  await compile(page, BATTERY, true);
  await compile(page, DARK, true);

  await navigate(page, "Data exchange");
  const proposedPromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v1/barter/negotiate",
  );
  await page
    .getByRole("button", { name: "Propose exchange", exact: true })
    .click();
  const proposedResponse = await proposedPromise;
  expect(proposedResponse.status()).toBe(200);
  const proposal = (await proposedResponse.json()).data;
  expect(proposal.party_a_lab).toBe("lab_catalysis");
  expect(proposal.party_b_lab).toBe("lab_battery");
  await page
    .getByRole("button", { name: "Review authorization", exact: true })
    .click();

  const firstPromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v1/barter/dual-sign",
  );
  await page
    .getByRole("button", { name: "Approve as Lab A PI", exact: true })
    .click();
  const firstMessage = await submitSignature(page, "lab_catalysis");
  expect(firstMessage.proposal_id).toBe(proposal.proposal_id);
  const first = (await (await firstPromise).json()).data;
  expect(first.status).toBe("PENDING_SECOND_PI_SIGNATURE");
  expect(first.download_token).toBeUndefined();
  await expect(
    page.getByText("Data release remains locked", { exact: true }),
  ).toBeVisible();
  expect(
    (
      await request.get(`${backend}/api/v1/slices/${BATTERY}/download`)
    ).status(),
  ).toBe(402);

  const secondPromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v1/barter/dual-sign",
  );
  await page
    .getByRole("button", { name: "Approve as Lab B PI", exact: true })
    .click();
  const secondMessage = await submitSignature(page, "lab_battery");
  expect(secondMessage.proposal_id).toBe(proposal.proposal_id);
  const second = (await (await secondPromise).json()).data;
  expect(second.status).toBe("DUAL_SIGNED_AND_EXECUTED");
  await expect(
    page.getByText("Backend-confirmed settlement", { exact: true }),
  ).toBeVisible();
  const publicStatus = (
    await (
      await request.get(
        `${backend}/api/v1/barter/proposals/${proposal.proposal_id}`,
      )
    ).json()
  ).data;
  expect(publicStatus.proposer_signed).toBe(true);
  expect(publicStatus.target_signed).toBe(true);
  expect(publicStatus.download_token).toBeUndefined();
  expect(
    (
      await request.get(`${backend}/api/v1/slices/${OER}/download`, {
        headers: { Authorization: `Bearer ${second.download_token}` },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.get(`${backend}/api/v1/slices/${BATTERY}/download`, {
        headers: { Authorization: `Bearer ${second.download_token}` },
      })
    ).status(),
  ).toBe(402);
  await page.getByRole("button", { name: "Close review", exact: true }).click();

  await navigate(page, "Scientific analytics");
  await expect(page.getByText(/42\.\d+ mV\/dec/).first()).toBeVisible();
  await expect(page.locator(".recharts-surface").first()).toBeVisible();
  await page
    .getByRole("button", { name: "Battery cycling", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Differential capacity", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("dQ/dV (Ah/V)", { exact: true })).toBeVisible();
  await page.screenshot({
    path: info.outputPath("live-battery-analytics.png"),
    fullPage: true,
  });

  // Reload clears in-memory barter credentials. Buying must now exercise the real vault debit.
  await page.reload();
  await expect(page.getByRole("table")).toBeVisible();
  expect(
    (
      await (
        await request.get(
          `${backend}/api/v1/vault/balance?address=lab_synthesis`,
        )
      ).json()
    ).data.staker_balance,
  ).toBe(0);
  await navigate(page, "Data vault");
  const depositedPromise = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/v1/vault/deposit",
  );
  await page
    .getByRole("button", { name: "Stake failure data", exact: true })
    .click();
  const depositMessage = await submitSignature(page, "lab_synthesis");
  expect(depositMessage.action).toBe("deposit");
  expect(depositMessage.slice_id).toBe(DARK);
  expect(depositMessage.nonce).toBeTruthy();
  const deposit = (await (await depositedPromise).json()).data;
  expect(deposit.minted_scicredit).toBe(50);
  expect(deposit.staker_balance).toBe(50);
  await expect(
    page.getByRole("button", { name: "Deposit recorded", exact: true }),
  ).toBeDisabled();

  await navigate(page, "Buy data");
  const wallet = page.locator(".panel").filter({
    has: page.getByRole("heading", { name: "SciCredit wallet", exact: true }),
  });
  await expect(wallet.getByText("50 SC", { exact: true })).toBeVisible();
  await page
    .getByRole("button", {
      name: "Buy data: Synthetic NiFe-LDH OER polarization benchmark",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Request data access", exact: true })
    .click();
  await expect(
    page.getByText("HTTP 402 · Payment required", { exact: true }),
  ).toBeVisible();
  const redeemedPromise = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/v1/vault/redeem",
  );
  await page
    .getByRole("button", { name: "Pay SciCredit & acquire", exact: true })
    .click();
  const redeemMessage = await submitSignature(page, "lab_synthesis");
  expect(redeemMessage.action).toBe("redeem");
  expect(redeemMessage.slice_id).toBe(OER);
  expect(redeemMessage.price_scicredit).toBe(50);
  const redeemed = (await (await redeemedPromise).json()).data;
  expect(redeemed.staker_balance).toBe(0);
  await expect(
    page.getByText("Backend delivery confirmed", { exact: true }),
  ).toBeVisible();
  const downloadedPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download data", exact: true })
    .click();
  const downloaded = await downloadedPromise;
  const outputPath = info.outputPath("live-oer.json");
  await downloaded.saveAs(outputPath);
  const document = JSON.parse(await readFile(outputPath, "utf8"));
  expect(document.slice_id).toBe(OER);
  expect(document.rows).toHaveLength(501);
  expect(document.columns).toContain("notes");
  expect(typeof document.rows[0][document.columns.indexOf("notes")]).toBe(
    "string",
  );
  expect(
    (
      await (
        await request.get(
          `${backend}/api/v1/vault/balance?address=lab_synthesis`,
        )
      ).json()
    ).data.staker_balance,
  ).toBe(0);
  await page.screenshot({
    path: info.outputPath("live-purchased-data.png"),
    fullPage: true,
  });
  // The paid entitlement survives a lost browser session even with zero remaining credit.
  await page.reload();
  await expect(page.getByRole("table")).toBeVisible();
  await navigate(page, "Buy data");
  await page
    .getByRole("button", {
      name: "Buy data: Synthetic NiFe-LDH OER polarization benchmark",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Request data access", exact: true })
    .click();
  const recover = page.getByRole("button", {
    name: "Pay SciCredit & acquire",
    exact: true,
  });
  await expect(recover).toBeEnabled();
  const recoveredPromise = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/v1/vault/redeem",
  );
  await recover.click();
  const recoveredMessage = await submitSignature(page, "lab_synthesis");
  expect(recoveredMessage.nonce).not.toBe(redeemMessage.nonce);
  const recovered = (await (await recoveredPromise).json()).data;
  expect(recovered.download_token).toBe(redeemed.download_token);
  expect(recovered.staker_balance).toBe(0);
  await expect(
    page.getByText("Backend delivery confirmed", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  expect(secretUploads).toEqual([]);
});

test("live catalog remains usable on desktop and mobile without mock fallback", async ({
  page,
}, info) => {
  test.skip(
    !info.project.name.startsWith("live-"),
    "Requires the dedicated live gateway configuration",
  );
  await page.goto("/");
  await expect(page.getByText("Live API mode", { exact: true })).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByLabel("Active lab", { exact: true })).toHaveValue(
    "lab_synthesis",
  );
  await navigate(page, "Physics compiler");
  await expect(page.getByLabel("Experimental slice")).toBeVisible();
  await expect(
    page.getByLabel("Experimental slice").locator("option"),
  ).toHaveCount(5);
  await page
    .getByLabel("Experimental slice")
    .selectOption("slice_oer_violation");
  const geometry = await page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    overflowing: Array.from(document.querySelectorAll("main *"))
      .map((element) => ({
        tag: element.tagName,
        className: element.className,
        right: element.getBoundingClientRect().right,
      }))
      .filter((element) => element.right > window.innerWidth + 1)
      .slice(0, 12),
  }));
  expect(geometry.scrollWidth, JSON.stringify(geometry)).toBeLessThanOrEqual(
    geometry.width,
  );
  await page.screenshot({
    path: info.outputPath("live-responsive-compiler.png"),
    fullPage: true,
  });
});
