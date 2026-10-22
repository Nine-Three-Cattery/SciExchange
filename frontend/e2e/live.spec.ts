import { sign } from "node:crypto";
import { execFileSync } from "node:child_process";
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
  let depositRequests = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (req) => {
    if (new URL(req.url()).pathname === "/api/v1/vault/deposit" && req.method() === "POST")
      depositRequests++;
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

  // A directory action must carry its target into the compiler on a cold session.
  await page.getByRole("button", {
    name: "Inspect Synthetic LFP/graphite fast-charge 100-cycle benchmark",
    exact: true,
  }).click();
  await expect(page.getByLabel("Experimental slice", { exact: true })).toHaveValue(BATTERY);

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
  await page.getByRole("button", { name: "Refresh owner authorization", exact: true }).click();
  const renewedOwnerMessage = await submitSignature(page, "lab_catalysis");
  expect(renewedOwnerMessage.action).toBe("owner_read");
  expect(renewedOwnerMessage.slice_id).toBe(OER);
  expect(renewedOwnerMessage.expires_at).not.toBe(ownerMessage.expires_at);
  await expect(page.getByRole("button", { name: "Download data", exact: true })).toBeEnabled();
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

  // Commit the real approval, then lose only its HTTP response. Polling must
  // recover the first PI's grant without asking an already-approved PI to sign again.
  let first: Record<string, unknown> | undefined;
  await page.route("**/api/v1/barter/dual-sign", async (route) => {
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    first = (await response.json()).data;
    await route.abort("connectionreset");
  }, { times: 1 });
  await page
    .getByRole("button", { name: "Approve as Lab A PI", exact: true })
    .click();
  const firstMessage = await submitSignature(page, "lab_catalysis");
  expect(firstMessage.proposal_id).toBe(proposal.proposal_id);
  await expect(page.getByText(/Cannot reach the backend/)).toBeVisible();
  expect(first?.status).toBe("PENDING_SECOND_PI_SIGNATURE");
  expect(first?.download_token).toBeUndefined();
  await expect(page.getByRole("button", { name: "Approval recorded", exact: true })).toBeDisabled();
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

  // Changing labs intentionally clears active credentials. The settled agreement
  // must provide a way to restore this PI's own counterparty grant.
  for (const lab of ["lab_catalysis", "lab_battery", "lab_catalysis"])
    await page.getByLabel("Active lab", { exact: true }).selectOption(lab);
  await navigate(page, "Data exchange");
  const restoredPromise = page.waitForResponse((response) =>
    new URL(response.url()).pathname === `/api/v1/barter/proposals/${proposal.proposal_id}` &&
    response.request().headers()["x-pi-address"] === "lab_catalysis");
  await page.getByRole("button", { name: "Restore exchange access", exact: true }).click();
  const restored = (await (await restoredPromise).json()).data;
  expect(restored.downloaded_slice_id).toBe(BATTERY);
  await navigate(page, "Scientific analytics");
  await page.getByRole("button", { name: "Battery cycling", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Differential capacity", exact: true })).toBeVisible();

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
  await page.route("**/api/v1/vault/deposit", async (route) => {
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    // Fail only the balance read following the real, successful deposit.
    await page.route((url) => url.pathname === "/api/v1/vault/balance",
      (balanceRoute) => balanceRoute.abort("failed"), { times: 1 });
    await route.fulfill({ response });
  }, { times: 1 });
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
  const vaultWallet = page.locator(".panel").filter({
    has: page.getByRole("heading", { name: "SciCredit wallet", exact: true }),
  });
  await expect(vaultWallet.getByText("Unavailable", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Retry balance", exact: true }).click();
  await expect(vaultWallet.getByText("50 SC", { exact: true })).toBeVisible();
  expect(depositRequests).toBe(1);
  await expect(page.getByRole("alert")).toHaveCount(0);

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
  // The debit is real; only the following file transfer fails once.
  await page.route((url) => url.pathname === `/api/v1/slices/${OER}/download`,
    (route) => route.abort("failed"), { times: 1 });
  await page
    .getByRole("button", { name: "Pay SciCredit & acquire", exact: true })
    .click();
  const redeemMessage = await submitSignature(page, "lab_synthesis");
  expect(redeemMessage.action).toBe("redeem");
  expect(redeemMessage.slice_id).toBe(OER);
  expect(redeemMessage.price_scicredit).toBe(50);
  const redeemed = (await (await redeemedPromise).json()).data;
  expect(redeemed.staker_balance).toBe(0);
  await expect(page.getByText(/Cannot confirm data delivery/)).toBeVisible();
  await expect(wallet.getByText("0 SC", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Refresh access challenge", exact: true }).click();
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
  expect(await page.getByLabel("Experimental slice").locator("option").count()).toBeGreaterThanOrEqual(5);
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

test("repeated live use: selectable exchanges, multiple deposits, legal IDs and paid renewal", async ({ page, request }, info) => {
  const suffix = info.project.name;
  const stateDir = process.env.SCIEXCHANGE_E2E_STATE_DIR!;
  const oer = JSON.parse(await readFile(join(stateDir, "slices", `${OER}.json`), "utf8"));
  const dark = JSON.parse(await readFile(join(stateDir, "slices", `${DARK}.json`), "utf8"));
  const battery = JSON.parse(await readFile(join(stateDir, "slices", `${BATTERY}.json`), "utf8"));
  const failures = [1, 2].map((run) => {
    const document = structuredClone(dark);
    document.slice_id = `r2_failure_${run}_${suffix}`;
    document.metadata.title = `Round two failed experiment ${run} ${suffix}`;
    document.metadata.created_at = `2026-10-2${run}T00:00:00Z`;
    document.rows[0][document.columns.indexOf("observation")] = `Run ${run}: no target phase; residual amorphous precipitate.`;
    return document;
  });
  const unknown = structuredClone(oer);
  unknown.slice_id = `a_r2_unregistered_${suffix}`;
  unknown.metadata.title = `Unregistered PI benchmark ${suffix}`;
  unknown.metadata.owner_lab_id = `lab_new_${suffix}`;
  const legalId = structuredClone(oer);
  legalId.slice_id = "constructor";
  legalId.metadata.title = "Constructor identifier benchmark";
  const purchase = structuredClone(oer);
  purchase.slice_id = `r2_purchase_${suffix}`;
  purchase.metadata.title = `Round two purchased benchmark ${suffix}`;
  for (const document of [oer, battery, ...failures, unknown, legalId, purchase]) {
    const response = await request.post(`${backend}/api/v1/compiler/verify`, { data: document });
    expect(response.status()).toBe(200);
    expect((await response.json()).data.valid).toBe(true);
  }
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("table")).toBeVisible();
  await compile(page, "constructor", true);

  await navigate(page, "Data exchange");
  await page.getByLabel("Offered slice", { exact: true }).selectOption(unknown.slice_id);
  await page.getByLabel("Requested slice", { exact: true }).selectOption(BATTERY);
  await page.getByRole("button", { name: "Propose exchange", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Both laboratories require registered PI public keys");
  await page.getByLabel("Offered slice", { exact: true }).selectOption(OER);
  await page.getByRole("button", { name: "Propose exchange", exact: true }).click();
  await expect(page.getByRole("button", { name: "Review authorization", exact: true })).toBeVisible();

  const balance = async () => (await (await request.get(`${backend}/api/v1/vault/balance?address=lab_synthesis`)).json()).data.staker_balance;
  const before = await balance();
  await navigate(page, "Data vault");
  for (const [index, document] of failures.entries()) {
    await page.getByLabel("Eligible failure-data slice", { exact: true }).selectOption(document.slice_id);
    await page.getByRole("button", { name: "Stake failure data", exact: true }).click();
    const message = await submitSignature(page, "lab_synthesis");
    expect(message.slice_id).toBe(document.slice_id);
    await expect(page.getByRole("button", { name: "Deposit recorded", exact: true })).toBeDisabled();
    expect(await balance()).toBe(before + (index + 1) * 50);
  }
  await page.getByLabel("Eligible failure-data slice", { exact: true }).selectOption(failures[0].slice_id);
  await expect(page.getByRole("button", { name: "Deposit recorded", exact: true })).toBeDisabled();
  await page.screenshot({ path: info.outputPath("round2-multiple-deposits.png"), fullPage: true });

  await navigate(page, "Buy data");
  await page.getByRole("button", { name: `Buy data: ${purchase.metadata.title}`, exact: true }).click();
  await page.getByRole("button", { name: "Request data access", exact: true }).click();
  const paidPromise = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/v1/vault/redeem");
  await page.getByRole("button", { name: "Pay SciCredit & acquire", exact: true }).click();
  await submitSignature(page, "lab_synthesis");
  const paid = (await (await paidPromise).json()).data;
  await expect(page.getByText("Backend delivery confirmed", { exact: true })).toBeVisible();
  expect(await balance()).toBe(before + 50);

  // Expire only this test's grant in its isolated SQLite fixture. The gateway
  // still performs real expiry checking and signs a fresh renewal challenge.
  execFileSync("../.venv/bin/python", ["-c",
    "import sqlite3, sys\nwith sqlite3.connect(sys.argv[1]) as db:\n db.execute(\"UPDATE download_grants SET expires_at='2000-01-01T00:00:00+00:00' WHERE token=?\", (sys.argv[2],))",
    join(stateDir, "sciexchange.sqlite"), paid.download_token]);
  expect((await request.get(`${backend}/api/v1/slices/${purchase.slice_id}/download`, {
    headers: { Authorization: `Bearer ${paid.download_token}` },
  })).status()).toBe(402);
  await page.getByRole("button", { name: "Refresh data authorization", exact: true }).click();
  await expect(page.getByText("HTTP 402 · Payment required", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download data", exact: true })).toBeEnabled();
  const renewedPromise = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/v1/vault/redeem");
  await page.getByRole("button", { name: "Renew data access", exact: true }).click();
  const renewedMessage = await submitSignature(page, "lab_synthesis");
  expect(renewedMessage.slice_id).toBe(purchase.slice_id);
  const renewed = (await (await renewedPromise).json()).data;
  expect(renewed.download_token).not.toBe(paid.download_token);
  expect(renewed.staker_balance).toBe(before + 50);
  await expect(page.getByText("HTTP 402 · Payment required", { exact: true })).not.toBeVisible();
  expect((await request.get(`${backend}/api/v1/slices/${purchase.slice_id}/download`, {
    headers: { Authorization: `Bearer ${renewed.download_token}` },
  })).status()).toBe(200);
  await page.screenshot({ path: info.outputPath("round2-paid-renewal.png"), fullPage: true });
  expect(errors).toEqual([]);
});
