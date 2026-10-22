import { z } from "zod";
import { ApiError } from "./errors";
import type { Analytics, ScientificDocument, Series } from "./contracts";

const finite = z.number().finite();
export const analysisResponseSchema = z.object({
  slice_id: z.string(),
  analysis_type: z.string(),
  result: z.record(z.unknown()),
});
const tafelSchema = z.object({
  tafel_slope_mv_dec: finite, r_squared: finite,
  overpotential_10ma_mv: finite, potential_10ma_v: finite,
  intercept_mv: finite, fit_current_range_ma_cm2: z.tuple([finite, finite]),
});
const dtaSchema = z.object({
  tafel_slope_mv_dec: finite, voltage_v: z.array(finite),
  current_density_ma_cm2: z.array(finite), kinetic_consistent: z.boolean(),
});
const capacitySchema = z.object({ voltage_v: z.array(finite), dq_dv_ah_v: z.array(finite) });
const kneeSchema = z.object({
  identified: z.boolean(), knee_cycle: finite.nullable(),
  fitted_capacity_ah: z.array(finite),
});
const scientificTafelSchema = z.object({
  tafel_slope_mv_dec: finite, r_squared: finite,
  potential_at_target_v: finite.nullable(), overpotential_at_target_mv: finite.nullable(),
  parameters: z.object({ potential_column: z.string() }),
  curve: z.object({ current_density_ma_cm2: z.array(finite), potential_v: z.array(finite) }),
  fit: z.object({ log10_current_density: z.array(finite), potential_v: z.array(finite) }),
});
const retentionSchema = z.object({
  cycle_index: z.array(finite), discharge_capacity_ah: z.array(finite), capacity_retention_pct: z.array(finite),
});
const scientificKneeSchema = z.object({
  status: z.enum(["candidate_detected", "not_detected"]),
  knee_point_cycle_estimated: finite.nullable(), cycle_index: z.array(finite), fitted_capacity_ah: z.array(finite),
});
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function pair(x: number[], y: number[]) {
  if (!x.length || x.length !== y.length) throw new ApiError("Backend chart series have mismatched samples.");
  return x.map((value, index) => ({ x: value, y: y[index] }));
}
function numericColumn(document: ScientificDocument, name: string): number[] {
  const index = document.columns.indexOf(name);
  if (index < 0) throw new ApiError(`The delivered document lacks ${name}.`);
  return document.rows.map(row => finite.parse(row[index]));
}
const warning = "Different experimental conditions and synthetic benchmarks do not establish a cross-domain causal relationship. Numerical protocol checks are not Lean-kernel proofs.";

function presentScientificAnalytics(document: ScientificDocument, results: Record<string, unknown>): Analytics {
  const metadata = document.metadata;
  const source = `${metadata.data_origin === "experimental" ? "Experimental source data" : "Scientific data"} · ${document.slice_id} · ${document.version}`;
  const conditions = [metadata.material_name,
    typeof metadata.temperature_c === "number" ? `${metadata.temperature_c} °C` : "Temperature not reported",
    metadata.electrolyte, metadata.reference_electrode].filter(Boolean).join(" · ");
  const warnings = Object.values(results).flatMap(value => {
    const messages = record(value).warnings;
    return Array.isArray(messages) ? messages.filter((message): message is string => typeof message === "string") : [];
  });
  const output: Analytics = { source, conditions, metrics: [], plots: [], warning: [warning, ...new Set(warnings)].join(" ") };
  if (document.domain === "electrocatalysis") {
    const tafel = scientificTafelSchema.parse(results.tafel_slope);
    const potentialColumn = tafel.parameters.potential_column;
    const axis = potentialColumn === "overpotential_v" ? "Overpotential (V)"
      : potentialColumn === "potential_v_vs_rhe" ? "Potential (V vs RHE)"
      : `Potential (V vs ${String(metadata.reference_electrode || "declared reference")})`;
    const samples = pair(tafel.curve.potential_v, tafel.curve.current_density_ma_cm2);
    const fit = pair(tafel.fit.log10_current_density, tafel.fit.potential_v);
    const low = Math.min(...tafel.fit.log10_current_density);
    const high = Math.max(...tafel.fit.log10_current_density);
    const tafelSamples = samples.filter(point => point.y > 0 && Math.log10(point.y) >= low && Math.log10(point.y) <= high)
      .map(point => ({ x: Math.log10(point.y), y: point.x }));
    output.metrics = [
      { label: "Apparent Tafel slope", value: `${tafel.tafel_slope_mv_dec.toFixed(2)} mV/dec` },
      { label: "Overpotential at target current", value: tafel.overpotential_at_target_mv === null ? "Not calculated" : `${tafel.overpotential_at_target_mv.toFixed(1)} mV` },
      { label: "Potential at target current", value: tafel.potential_at_target_v === null ? "Not calculated" : `${tafel.potential_at_target_v.toFixed(4)} V` },
      { label: "Tafel R²", value: tafel.r_squared.toFixed(4) },
    ];
    output.plots = [
      { title: "Measured polarization", xLabel: axis, yLabel: "Current density (mA/cm²)",
        series: [{ name: "Authorized samples", color: "#c4e79c", points: samples }] },
      { title: "Apparent Tafel relation", xLabel: "log₁₀ j (mA/cm²)", yLabel: axis,
        series: [{ name: "Authorized samples", color: "#c4e79c", points: tafelSamples },
          { name: "Backend fitted line", color: "#a6bfea", points: fit }] },
    ];
    return output;
  }
  if (document.domain !== "battery_cycling") throw new ApiError("Unsupported scientific analysis domain.");
  if (results.capacity_fade !== undefined) {
    const retention = retentionSchema.parse(results.capacity_fade);
    const series: Series[] = [{ name: "Authorized capacity samples", color: "#a6bfea",
      points: pair(retention.cycle_index, retention.discharge_capacity_ah) }];
    output.metrics.push(
      { label: "Final observed capacity", value: `${retention.discharge_capacity_ah.at(-1)!.toFixed(4)} Ah` },
      { label: "Observed cycles", value: String(retention.cycle_index.length) },
    );
    if (results.knee_point !== undefined) {
      const knee = scientificKneeSchema.parse(results.knee_point);
      const detected = knee.status === "candidate_detected" && knee.knee_point_cycle_estimated !== null;
      output.metrics.push({ label: "Knee point candidate", value: detected
        ? `Cycle ${knee.knee_point_cycle_estimated!.toFixed(0)}` : "Not detected in observed cycles" });
      if (detected) series.push({ name: "Descriptive capacity fit", color: "#c4e79c",
        points: pair(knee.cycle_index, knee.fitted_capacity_ah) });
    }
    output.plots.push({ title: "Observed discharge capacity", xLabel: "Cycle number", yLabel: "Discharge capacity (Ah)", series });
  }
  if (results.dq_dv !== undefined) {
    const capacity = capacitySchema.parse(results.dq_dv);
    output.metrics.push({ label: "Capacity convention", value: "Positive cumulative capacity; signed dQ/dV" });
    output.plots.push({ title: "Differential capacity", xLabel: "Cell voltage (V)", yLabel: "Signed dQ/dV (Ah/V)",
      series: [{ name: "Backend signed derivative", color: "#c4e79c", points: pair(capacity.voltage_v, capacity.dq_dv_ah_v) }] });
  }
  if (!output.plots.length) throw new ApiError("No supported analysis result is available for this slice.");
  return output;
}

/** Map authorized backend results to plots; numerical fitting stays on the server. */
export function presentAnalytics(document: ScientificDocument, results: Record<string, unknown>): Analytics {
  if (document.version) return presentScientificAnalytics(document, results);
  const conditions = record(document.metadata.testing_conditions);
  const provenance = record(document.metadata.provenance);
  const source = `${provenance.source_type === "synthetic_benchmark" ? "Synthetic benchmark served by backend" : "Backend data"} · ${document.slice_id}`;
  const conditionText = [document.metadata.material_name, document.metadata.temperature_c === undefined ? undefined : `${document.metadata.temperature_c} °C`, conditions.electrolyte, conditions.potential_reference].filter(Boolean).join(" · ");
  if (document.domain === "electrocatalysis") {
    const tafel = tafelSchema.parse(results.tafel_slope);
    const dta = dtaSchema.parse(results.dta);
    const samples = pair(dta.voltage_v, dta.current_density_ma_cm2);
    const equilibrium = tafel.potential_10ma_v - tafel.overpotential_10ma_mv / 1000;
    const tafelSamples = samples.filter(point => point.y >= 1 && point.y <= 10)
      .map(point => ({ x: Math.log10(point.y), y: (point.x - equilibrium) * 1000 }));
    const fit = tafel.fit_current_range_ma_cm2.map(current => {
      const x = Math.log10(current);
      return { x, y: tafel.intercept_mv + tafel.tafel_slope_mv_dec * x };
    });
    return {
      source, conditions: conditionText, warning,
      metrics: [
        { label: "Tafel slope", value: `${tafel.tafel_slope_mv_dec.toFixed(2)} mV/dec` },
        { label: "Overpotential at 10 mA/cm²", value: `${tafel.overpotential_10ma_mv.toFixed(1)} mV` },
        { label: "Tafel R²", value: tafel.r_squared.toFixed(4) },
        { label: "DTA slope", value: `${dta.tafel_slope_mv_dec.toFixed(2)} mV/dec` },
      ],
      plots: [
        { title: "LSV polarization", xLabel: "Potential (V vs RHE)", yLabel: "Current density (mA/cm²)",
          series: [{ name: "Backend normalized LSV", color: "#c4e79c", points: samples }] },
        { title: "Tafel kinetics", xLabel: "log₁₀ j (mA/cm²)", yLabel: "Overpotential (mV)",
          series: [{ name: "Authorized samples", color: "#c4e79c", points: tafelSamples },
            { name: "Backend fitted line", color: "#a6bfea", points: fit }] },
      ],
    };
  }
  if (document.domain === "battery_cycling") {
    const capacity = capacitySchema.parse(results.dq_dv);
    const knee = kneeSchema.parse(results.knee_point);
    const cycles = numericColumn(document, "cycle");
    const discharge = numericColumn(document, "discharge_capacity_ah");
    const series: Series[] = [
      { name: "Authorized capacity samples", color: "#a6bfea", points: pair(cycles, discharge) },
      { name: "Backend capacity fit", color: "#c4e79c", points: pair(cycles, knee.fitted_capacity_ah) },
    ];
    return {
      source, conditions: conditionText, warning,
      metrics: [
        { label: "Final observed capacity", value: `${discharge[discharge.length - 1].toFixed(4)} Ah` },
        { label: "Observed cycles", value: String(cycles.length) },
        { label: "Knee point", value: knee.identified && knee.knee_cycle !== null ? `Cycle ${knee.knee_cycle.toFixed(1)}` : "Not identifiable from observed cycles" },
      ],
      plots: [
        { title: "Capacity retention", xLabel: "Cycle number", yLabel: "Discharge capacity (Ah)", series },
        { title: "Differential capacity", xLabel: "Cell voltage (V)", yLabel: "dQ/dV (Ah/V)",
          series: [{ name: "Backend charge-curve derivative", color: "#c4e79c", points: pair(capacity.voltage_v, capacity.dq_dv_ah_v) }] },
      ],
    };
  }
  throw new ApiError("Scientific charts are available for electrocatalysis and battery slices.");
}
