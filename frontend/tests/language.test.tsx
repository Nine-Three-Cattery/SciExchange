import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LanguageProvider,
  LANGUAGE_STORAGE_KEY,
  translate,
} from "../src/i18n/LanguageProvider";
import { Dashboard } from "../src/pages/Dashboard";
import { HeaderNavbar } from "../src/components/HeaderNavbar";
import { SignatureDialog } from "../src/components/SignatureDialog";
import { signCanonical } from "../src/api/signing";
import { createMockApi } from "../src/mocks/fixtures";
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
beforeEach(() => {
  localStorage.clear();
});
function workspace() {
  return (
    <LanguageProvider>
      <Dashboard api={createMockApi()} />
    </LanguageProvider>
  );
}
describe("bilingual workspace", () => {
  it("translates live node states, accessible names and tooltips while preserving lab identifiers", async () => {
    const user = userEvent.setup();
    const header = (mock: boolean) => (
      <LanguageProvider>
        <HeaderNavbar page="Overview" mock={mock} resetting={false} onReset={vi.fn()} />
      </LanguageProvider>
    );
    const view = render(header(false));
    expect(screen.getAllByText("Status unavailable")).toHaveLength(3);
    await user.selectOptions(screen.getByRole("combobox", { name: "Language" }), "zh");
    const nodes = screen.getByLabelText("网络节点状态");
    expect(within(nodes).getAllByText("状态暂不可用")).toHaveLength(3);
    expect(screen.queryByText("Status unavailable")).not.toBeInTheDocument();
    expect(screen.getAllByTitle("仪器连接尚未确认")).toHaveLength(2);
    expect(screen.getByTitle("金库运行状态尚未确认")).toBeInTheDocument();
    expect(within(nodes).getByText("Lab A")).toBeInTheDocument();
    expect(within(nodes).getByText("Lab B")).toBeInTheDocument();
    expect(within(nodes).getByText("x402 Vault")).toBeInTheDocument();
    view.rerender(header(true));
    expect(screen.getAllByTitle("模拟仪器状态")).toHaveLength(2);
  });
  it.each([
    ["Approve failed-data deposit", "批准存入失败实验数据"],
    ["Approve SciCredit purchase", "批准使用 SciCredit 购买数据"],
    ["Approve reciprocal scientific data exchange", "批准双方科研数据交换"],
    ["Authorize access to your scientific slice", "授权读取自己的科研切片"],
  ])("translates the app-owned signing purpose %s without changing canonical bytes", async (purpose, translated) => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "zh");
    const user = userEvent.setup();
    render(<LanguageProvider><SignatureDialog /></LanguageProvider>);
    const message = JSON.stringify({ signer_address: "lab_synthesis", purpose });
    let pending!: Promise<string | Error>;
    act(() => {
      pending = signCanonical("lab_synthesis", message, purpose).catch((error: Error) => error);
    });
    expect(screen.getByText(translated)).toBeInTheDocument();
    expect(screen.getByLabelText("签署实验室")).toHaveValue("lab_synthesis");
    expect(screen.getByLabelText("规范签名消息")).toHaveValue(message);
    await user.click(screen.getByRole("button", { name: "取消签名" }));
    expect(await pending).toBeInstanceOf(Error);
  });
  it("defaults to English and updates accessible labels, document metadata and saved preference", async () => {
    const user = userEvent.setup();
    render(workspace());
    await screen.findByRole("table");
    expect(screen.getByRole("combobox", { name: "Language" })).toHaveValue(
      "en",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Language" }),
      "zh",
    );
    expect(
      screen.getByRole("heading", { name: "科研总览" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "物理验证编译器" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: "搜索科研切片" }),
    ).toBeInTheDocument();
    await user.type(
      screen.getByRole("searchbox", { name: "搜索科研切片" }),
      "快充",
    );
    expect(screen.getByRole("table").querySelectorAll("tbody tr")).toHaveLength(
      1,
    );
    await user.clear(screen.getByRole("searchbox", { name: "搜索科研切片" }));
    expect(document.documentElement.lang).toBe("zh-CN");
    expect(document.title).toBe("SciExchange — 科研工作区");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("zh");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "语言" }),
      "en",
    );
    expect(
      screen.getByRole("heading", { name: "Research overview" }),
    ).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
  });
  it("restores Chinese after remount and keeps it through demo reset", async () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "zh");
    const user = userEvent.setup();
    const view = render(workspace());
    await screen.findByRole("table");
    expect(
      screen.getByRole("heading", { name: "科研总览" }),
    ).toBeInTheDocument();
    view.unmount();
    render(workspace());
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "重置演示" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "重置演示" })).toBeEnabled(),
    );
    expect(screen.getByRole("combobox", { name: "语言" })).toHaveValue("zh");
  });
  it("keeps verification state and backend diagnostics unchanged when switching languages", async () => {
    const user = userEvent.setup();
    render(workspace());
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "Physics compiler" }));
    await user.click(screen.getByRole("button", { name: "Compile & attest" }));
    await screen.findByText("Rejected");
    const diagnostics = screen.getByLabelText(
      "Compiler diagnostics",
    ).textContent;
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Language" }),
      "zh",
    );
    expect(screen.getByText("已拒绝")).toBeInTheDocument();
    expect(screen.getByText("法拉第效率守恒")).toBeInTheDocument();
    expect(screen.getByLabelText("编译器诊断").textContent).toBe(
      diagnostics?.replace("SIMULATION", "模拟运行"),
    );
    expect(
      screen.getByText(/\[ERROR\] Charge conservation: FE = 108.2%/),
    ).toBeInTheDocument();
  });
  it("does not lose proposal or PI approval during a language change", async () => {
    const user = userEvent.setup();
    render(workspace());
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "Data exchange" }));
    await user.click(screen.getByRole("button", { name: "Propose exchange" }));
    await user.click(
      await screen.findByRole("button", { name: "Review authorization" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Approve as Lab A PI" }),
    );
    await screen.findByRole("button", { name: "Approval recorded" });
    await user.click(screen.getByRole("button", { name: "Close review" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Language" }),
      "zh",
    );
    await user.click(screen.getByRole("button", { name: "审查并授权" }));
    expect(screen.getAllByText("demo_proposal_001").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "批准已记录" })).toBeDisabled();
    expect(screen.getByText("数据释放仍被锁定")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "以实验室 B PI 身份批准" }),
    ).toBeEnabled();
  });
  it("handles disabled browser storage", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("disabled");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("disabled");
    });
    const user = userEvent.setup();
    render(workspace());
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Language" }),
      "zh",
    );
    expect(
      screen.getByRole("heading", { name: "科研总览" }),
    ).toBeInTheDocument();
  });
  it("preserves raw identifiers, unknown external text, units and non-text values", () => {
    expect(translate("slice_catalysis_oer_nife_001", "zh")).toBe(
      "slice_catalysis_oer_nife_001",
    );
    expect(translate("42.5 mV/dec", "zh")).toBe("42.5 mV/dec");
    expect(translate("Unknown external record", "zh")).toBe(
      "Unknown external record",
    );
    expect(translate(108.2, "zh")).toBe(108.2);
    expect(translate("Simulated cycle 50", "zh")).toBe("模拟第 50 次循环");
  });
});
