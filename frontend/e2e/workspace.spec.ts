import { expect, test, type Page } from "@playwright/test";
async function navigate(page: Page, label: string) {
  const menu = page.getByRole("button", { name: "Open navigation" });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name: label, exact: true }).click();
}
test("purchase entry is visible without scrolling and marketplace needs no horizontal scroll", async ({
  page,
}) => {
  await page.goto("/");
  const entry = page.getByRole("button", {
    name: "Buy data with SciCredit",
    exact: true,
  });
  await expect(entry).toBeInViewport();
  await entry.click();
  await expect(
    page.getByRole("heading", { name: "Data marketplace", exact: true }),
  ).toBeVisible();
  const buy = page.getByRole("button", {
    name: "Buy data: NiFe-LDH OER kinetics",
    exact: true,
  });
  await expect(buy).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await buy.click();
  await page
    .getByRole("button", { name: "Request data access", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Pay SciCredit & acquire", exact: true })
    .click();
  await expect(
    page.getByText("Simulated purchase confirmed", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close review", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "View acquired data: NiFe-LDH OER kinetics",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Language", { exact: true }).selectOption("zh");
  await expect(
    page.getByRole("heading", { name: "数据市场", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "查看已获取数据: NiFe-LDH 析氧动力学",
      exact: true,
    }),
  ).toBeVisible();
});
test("six-scene workflow: reject, attest, propose, authorize, analyze, reset", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByText("Demo mode · simulated")).toBeVisible();
  await navigate(page, "Physics compiler");
  await page.getByRole("button", { name: "Compile & attest" }).click();
  await expect(page.getByText("Rejected", { exact: true })).toBeVisible();
  await expect(page.getByText(/observed 108.2/)).toBeVisible();
  await expect(
    page.getByText(/INDIRECT PROMPT INJECTION · QUARANTINED/),
  ).toBeVisible();
  await page
    .getByLabel("Experimental slice")
    .selectOption("slice_catalysis_oer_nife_001");
  await page.getByRole("button", { name: "Compile & attest" }).click();
  await page.getByRole("button", { name: /Inspect attestation/ }).click();
  await expect(
    page.getByRole("button", { name: /Formal verification/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Priority attestation/ }).click();
  await expect(page.getByText(/demo_merkle_oer_001/)).toBeVisible();
  await navigate(page, "Data exchange");
  await page.getByRole("button", { name: "Propose exchange" }).click();
  await page.getByRole("button", { name: "Review authorization" }).click();
  await page.getByRole("button", { name: "Approve as Lab A PI" }).click();
  await expect(
    page.getByRole("button", { name: "Approval recorded", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Data release remains locked")).toBeVisible();
  await page.getByRole("button", { name: "Approve as Lab B PI" }).click();
  await expect(page.getByText("Simulated exchange settled")).toBeVisible();
  await page.getByRole("button", { name: "Close review" }).click();
  await navigate(page, "Scientific analytics");
  await expect(page.getByText("42.5 mV/dec")).toBeVisible();
  await expect(page.getByText(/Causal guardrail/)).toBeVisible();
  await page
    .getByRole("button", { name: "Battery cycling", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Differential capacity" }),
  ).toBeVisible();
  await expect(page.getByText("dQ/dV (Ah/V)", { exact: true })).toBeVisible();
  await navigate(page, "Data vault");
  await page.getByRole("button", { name: "Stake failure data" }).click();
  await expect(page.getByText("Minted SciCredit")).toBeVisible();
  await expect(page.getByText("35", { exact: true }).first()).toBeVisible();
  await navigate(page, "Overview");
  await navigate(page, "Data vault");
  await expect(
    page.getByRole("button", { name: "Deposit recorded" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Reset demo" }).click();
  await expect(
    page.getByRole("heading", { name: "Research overview" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(errors).toEqual([]);
});
test("responsive layout, real chart SVG, walkthrough and keyboard dialog", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(page.locator(".recharts-surface").first()).toBeVisible();
  expect(
    await page.evaluate(
      (width) => document.documentElement.scrollWidth <= width,
      page.viewportSize()!.width,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("overview.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Start walkthrough" }).click();
  await expect(page.getByText("01 / 06")).toBeVisible();
  await page.getByRole("button", { name: "Next scene" }).click();
  await expect(
    page.getByRole("heading", { name: "Physics compiler", level: 1 }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close walkthrough" }).click();
  await navigate(page, "Data exchange");
  await page.getByRole("button", { name: "Propose exchange" }).click();
  await page.getByRole("button", { name: "Review authorization" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("Chinese and English switch, preserve workflow and survive reload", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByRole("combobox", { name: "Language" }).selectOption("zh");
  await expect(page.getByRole("heading", { name: "科研总览" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  expect(
    await page.evaluate(
      (width) => document.documentElement.scrollWidth <= width,
      page.viewportSize()!.width,
    ),
  ).toBe(true);
  await expect(page.getByText("模拟 LSV", { exact: true })).toBeVisible();
  await page.screenshot({
    path: info.outputPath("overview-zh.png"),
    fullPage: true,
  });
  async function chineseNavigate(label: string) {
    const menu = page.getByRole("button", { name: "打开导航" });
    if (await menu.isVisible()) await menu.click();
    await page.getByRole("button", { name: label, exact: true }).click();
  }
  await chineseNavigate("物理验证编译器");
  await page.getByRole("button", { name: "编译并认证" }).click();
  await expect(page.getByText("已拒绝", { exact: true })).toBeVisible();
  await expect(page.getByText("法拉第效率守恒", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "语言" }).selectOption("en");
  await expect(page.getByText("Rejected", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Language" }).selectOption("zh");
  await chineseNavigate("数据交换");
  await page.getByRole("button", { name: "发起交换" }).click();
  await page.getByRole("button", { name: "审查并授权" }).click();
  await page.getByRole("button", { name: "以实验室 A PI 身份批准" }).click();
  await expect(page.getByRole("button", { name: "批准已记录" })).toBeDisabled();
  await expect(page.getByText("数据释放仍被锁定")).toBeVisible();
  await page.getByRole("button", { name: "关闭审查" }).click();
  await chineseNavigate("科研分析");
  await expect(
    page.getByRole("heading", { name: "Tafel 动力学" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "电池循环", exact: true }).click();
  await expect(page.getByRole("heading", { name: "微分容量" })).toBeVisible();
  await expect(page.getByText("dQ/dV (Ah/V)", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "科研总览" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "语言" })).toHaveValue("zh");
  await page.getByRole("combobox", { name: "语言" }).selectOption("en");
  await expect(
    page.getByRole("heading", { name: "Research overview" }),
  ).toBeVisible();
});

test("SciCredit purchase, actual download, credit rewards and reset", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(page.getByRole("table")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Buy data: Flagged OER submission" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Buy data: NiFe-LDH OER kinetics" })
    .click();
  await expect(
    page.getByRole("button", { name: "Download data" }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Request data access" }).click();
  await expect(page.getByText("HTTP 402 · Payment required")).toBeVisible();
  await expect(page.getByText("No data has been delivered.")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("payment-challenge.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Pay SciCredit & acquire" }).click();
  await expect(page.getByText("Simulated purchase confirmed")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("50 SC", { exact: true }).first(),
  ).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download data" }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe(
    "sciexchange_slice_catalysis_oer_nife_001.csv",
  );
  const stream = await download.createReadStream();
  let text = "";
  for await (const chunk of stream!) text += String(chunk);
  expect(text).toContain("potential_v_rhe,current_density_ma_cm2");
  expect(text).toContain("1.47,10");
  await download.saveAs(info.outputPath("acquired.csv"));
  await page.getByRole("button", { name: "Close review" }).click();
  await page
    .getByRole("button", { name: "View acquired data: NiFe-LDH OER kinetics" })
    .click();
  await expect(
    page.getByRole("button", { name: "Pay SciCredit & acquire" }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Close review" }).click();
  await navigate(page, "Data vault");
  await page.getByRole("button", { name: "Stake failure data" }).click();
  await expect(
    page.getByRole("button", { name: "Deposit recorded" }),
  ).toBeDisabled();
  await expect(page.getByText("85 SC", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset demo" }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Buy data: NiFe-LDH OER kinetics" }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Buy data: NiFe-LDH OER kinetics" })
    .click();
  await expect(
    page.getByRole("dialog").getByText("100 SC", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download data" }),
  ).not.toBeVisible();
});

test("scientific range selection changes plotted data", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("table")).toBeVisible();
  await navigate(page, "Scientific analytics");
  await page
    .getByRole("button", { name: "Battery cycling", exact: true })
    .click();
  const plot = page.locator(".scientific-plot").first();
  const curve = plot.locator(".recharts-line-curve");
  await expect(curve).toBeVisible();
  const before = await curve.getAttribute("d");
  const handle = plot.locator(".recharts-brush-traveller").last();
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  await handle.scrollIntoViewIfNeeded();
  const moved = await handle.boundingBox();
  await page.mouse.move(
    moved!.x + moved!.width / 2,
    moved!.y + moved!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(moved!.x - 100, moved!.y + moved!.height / 2, {
    steps: 10,
  });
  await page.mouse.up();
  await expect.poll(() => curve.getAttribute("d")).not.toBe(before);
});
