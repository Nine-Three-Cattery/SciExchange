import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLiveApi } from "../src/api/client";
import type { Analytics, ScientificDocument, Slice } from "../src/api/contracts";
import { registerSignaturePrompt } from "../src/api/signing";
import { createMockApi } from "../src/mocks/fixtures";
import { Dashboard } from "../src/pages/Dashboard";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null, XAxis: () => null, YAxis: () => null,
  Tooltip: () => null, Legend: () => null, Line: () => null, Brush: () => null,
}));

let unregister: (() => void) | undefined;
afterEach(() => { unregister?.(); unregister = undefined; });
const document: ScientificDocument = {
  slice_id: "battery_real", version: "v1", domain: "battery_cycling",
  metadata: { data_origin: "experimental" },
  columns: ["cycle_index", "discharge_capacity_ah"], rows: [[1, 1.1], [2, 1]],
};
const slice: Slice = {
  slice_id: document.slice_id, version: "v1", domain: document.domain,
  title: "Battery", summary: "Experimental data", data_classification: "experimental_reference",
  owner_lab_id: "lab_battery", is_attested: true, attestation_uid: "attest_real", price_scicredit: 50,
  review_status: "approved", compiler_status: "REVIEW_REQUIRED", analysis_methods: ["capacity_fade"],
};
const retention = { cycle_index: [1, 2], discharge_capacity_ah: [1.1, 1], capacity_retention_pct: [100, 90.9] };
const ok = (data: unknown) => Response.json({ code: 200, data });
function analysisResponse(version: string | undefined = "v1") {
  return ok({ slice_id: document.slice_id, version, analysis_type: "capacity_fade", result: retention });
}
function approveSignature() {
  unregister = registerSignaturePrompt(request => request.resolve("temporary_test_signature"));
}

describe("versioned analysis response boundary", () => {
  it.each(["v2", "missing"])("rejects %s response version", async version => {
    approveSignature();
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      if (url.includes("/slices?")) return ok([slice]);
      if (url.includes("/download")) return Response.json(document);
      if (url.endsWith("/analysis")) return ok({ slice_id: document.slice_id,
        ...(version === "missing" ? {} : { version }), analysis_type: "capacity_fade", result: retention });
      throw new Error(url);
    }));
    const api = createLiveApi(undefined, "lab_battery");
    await api.catalog();
    await api.access(document.slice_id);
    await expect(api.analytics(document.domain, document.slice_id)).rejects.toThrow("different or missing scientific version");
  });

  it("continues to accept legacy analysis without a version", async () => {
    approveSignature();
    const legacy = { ...document, version: undefined, columns: ["cycle", "discharge_capacity_ah"] };
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string, options: RequestInit) => {
      if (url.includes("/slices?")) return ok([{ ...slice, version: undefined, analysis_methods: undefined }]);
      if (url.includes("/download")) return Response.json(legacy);
      if (url.endsWith("/analysis")) {
        const body = JSON.parse(String(options.body));
        expect(body.version).toBeUndefined();
        return ok({ slice_id: document.slice_id, analysis_type: body.analysis_type,
          result: body.analysis_type === "dq_dv"
            ? { voltage_v: [3, 4], dq_dv_ah_v: [1, 1] }
            : { identified: false, knee_cycle: null, fitted_capacity_ah: [1.1, 1] } });
      }
      throw new Error(url);
    }));
    const api = createLiveApi(undefined, "lab_battery");
    await api.catalog();
    await api.access(document.slice_id);
    expect((await api.analytics(document.domain, document.slice_id)).plots).toHaveLength(2);
  });
});

describe("analysis identity boundary", () => {
  it.each(["download", "analysis"])("discards an old session after %s completes", async phase => {
    approveSignature();
    let armed = false;
    let release: ((response: Response) => void) | undefined;
    let analysisCalls = 0;
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      if (url.includes("/slices?")) return ok([slice]);
      if (url.includes("/download")) {
        if (armed && phase === "download") return new Promise<Response>(resolve => { release = resolve; });
        return Response.json(document);
      }
      if (url.endsWith("/analysis")) {
        analysisCalls++;
        return new Promise<Response>(resolve => { release = resolve; });
      }
      throw new Error(url);
    }));
    const api = createLiveApi(undefined, "lab_battery");
    await api.catalog();
    await api.access(document.slice_id);
    armed = true;
    const pending = api.analytics(document.domain, document.slice_id);
    await waitFor(() => expect(release).toBeDefined());
    // Returning to the same label must not revive the old authorization session.
    api.setLab!("lab_catalysis");
    api.setLab!("lab_battery");
    const rejected = expect(pending).rejects.toThrow("active laboratory changed");
    release!(phase === "download" ? Response.json(document) : analysisResponse());
    await rejected;
    expect(analysisCalls).toBe(phase === "download" ? 0 : 1);
  });

  it.each([
    ["overview", "pending"], ["overview", "completed"],
    ["analytics", "pending"], ["analytics", "completed"],
  ])("clears %s analysis when the old request is %s", async (view, state) => {
    const api = createMockApi();
    api.mode = "live";
    let lab = "lab_catalysis";
    api.getLab = () => lab;
    api.setLab = value => { lab = value; };
    const catalog = await api.catalog();
    api.catalog = vi.fn().mockResolvedValue(catalog.map((item, i) => ({
      ...item, owner_lab_id: i === 0 ? "lab_catalysis" : "lab_battery",
    })));
    const privateResult: Analytics = { source: "Private analysis for the previous lab", conditions: "",
      metrics: [], plots: [], warning: "Experimental conditions apply" };
    let finish!: (value: Analytics) => void;
    const pending = new Promise<Analytics>(resolve => { finish = resolve; });
    api.analytics = vi.fn().mockImplementation(() => lab === "lab_catalysis"
      ? state === "completed" ? Promise.resolve(privateResult) : pending
      : Promise.reject(new Error("The new laboratory must authorize analysis.")));
    render(<Dashboard api={api} />);
    await screen.findByRole("table");
    if (view === "analytics") fireEvent.click(screen.getByRole("button", { name: "Scientific analytics" }));
    if (state === "completed") await screen.findByText(privateResult.source);
    const identity = screen.getByRole("combobox", { name: "Active lab" });
    expect(identity).not.toBeDisabled();
    fireEvent.change(identity, { target: { value: "lab_battery" } });
    await screen.findByText("The new laboratory must authorize analysis.");
    if (state === "pending") await act(async () => finish(privateResult));
    expect(screen.queryByText(privateResult.source)).not.toBeInTheDocument();
  });
});
