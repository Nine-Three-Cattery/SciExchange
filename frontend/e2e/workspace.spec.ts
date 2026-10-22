import { expect, test, type Page } from "@playwright/test";
async function navigate(page: Page, label: string) {
  const menu = page.getByRole("button", { name: "Open navigation" });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name: label, exact: true }).click();
}
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
