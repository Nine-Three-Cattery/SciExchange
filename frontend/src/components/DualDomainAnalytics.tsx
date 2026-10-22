import { useI18n } from "../i18n/LanguageProvider";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import {
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Analytics, ExchangeApi, Plot, Slice } from "../api/contracts";
import { Badge, Empty, ErrorNotice, Loading, Panel, errorText } from "./ui";
export function ScientificPlot({
  plot,
  compact = false,
  dataLabel = "Simulated data.",
}: {
  plot: Plot;
  compact?: boolean;
  dataLabel?: string;
}) {
  const { t } = useI18n();

  const [hidden, setHidden] = useState<string[]>([]);
  const pointsByX = new Map<number, Record<string, number>>();
  plot.series.forEach((series, index) =>
    series.points.forEach((point) => {
      const row = pointsByX.get(point.x) || { x: point.x };
      row[`series${index}`] = point.y;
      pointsByX.set(point.x, row);
    }),
  );
  const chartRows = Array.from(pointsByX.values()).sort((a, b) => a.x - b.x);

  return (
    <div className={`scientific-plot ${compact ? "plot-compact" : ""}`}>
      <h3>{t(plot.title)}</h3>
      <p className="axis-caption">{t(plot.yLabel)}</p>
      <div
        className="chart"
        role="img"
        aria-label={`${t(plot.title)}. ${t("X axis")}: ${t(plot.xLabel)}. ${t("Y axis")}: ${t(plot.yLabel)}. ${t(dataLabel)}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartRows}
            margin={{ top: 12, right: 20, bottom: compact ? 4 : 18, left: 4 }}
          >
            <CartesianGrid
              stroke="#29302b"
              strokeDasharray="3 5"
              vertical={false}
            />
            <XAxis
              type="number"
              dataKey="x"
              domain={["dataMin", "dataMax"]}
              tick={{ fill: "#929a94", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              allowDuplicatedCategory={false}
              tickFormatter={(v) => Number(v).toFixed(Number(v) < 5 ? 2 : 0)}
            />
            <YAxis
              type="number"
              domain={["auto", "auto"]}
              tick={{ fill: "#929a94", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={43}
            />
            <Tooltip
              contentStyle={{
                background: "#202620",
                border: "1px solid #414b42",
                borderRadius: 8,
                fontSize: 12,
                color: "#eef2eb",
              }}
              labelFormatter={(v) =>
                `${t(plot.xLabel)}: ${Number(v).toFixed(3)}`
              }
              formatter={(v: number, name: string) => [v.toFixed(3), t(name)]}
            />
            <Legend
              formatter={(value) => t(String(value))}
              onClick={(e) => {
                const name = String(e.value);
                setHidden((prev) =>
                  prev.includes(name)
                    ? prev.filter((n) => n !== name)
                    : [...prev, name],
                );
              }}
              wrapperStyle={{ fontSize: 11, cursor: "pointer", paddingTop: 12 }}
            />
            {plot.series.map((series, index) => (
              <Line
                key={series.name}
                dataKey={`series${index}`}
                connectNulls
                name={series.name}
                stroke={series.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                type="linear"
                hide={hidden.includes(series.name)}
                isAnimationActive={false}
              />
            ))}
            {!compact && (
              <Brush
                data={chartRows}
                dataKey="x"
                height={18}
                stroke="#68765f"
                fill="#171d18"
                tickFormatter={(v) => Number(v).toFixed(1)}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="x-axis-caption">{t(plot.xLabel)}</p>
    </div>
  );
}
export function DualDomainAnalytics({
  api,
  compact = false,
  onExpand,
}: {
  api: ExchangeApi;
  compact?: boolean;
  onExpand?: () => void;
}) {
  const { t } = useI18n();

  const [domain, setDomain] = useState<Slice["domain"]>("electrocatalysis");
  const [data, setData] = useState<Analytics>();
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [catalog, setCatalog] = useState<Slice[]>([]);
  const [sliceId, setSliceId] = useState("");
  useEffect(() => {
    let active = true;
    if (api.mode === "live" && !compact) {
      api.catalog().then(value => { if (active) setCatalog(value); }).catch(() => { /* Analysis displays its own access/network error. */ });
    }
    return () => { active = false; };
  }, [api, compact, attempt]);
  useEffect(() => {
    let active = true;
    setBusy(true);
    setData(undefined);
    setError("");
    api
      .analytics(domain, sliceId || undefined)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [api, domain, sliceId, attempt]);
  return (
    <Panel
      title={t(compact ? "Scientific signals" : "Scientific analytics")}
      eyebrow={t("05 / Analysis")}
      action={
        compact ? (
          <button className="text-button" onClick={onExpand}>
            {t("Explore analysis")}
            <ArrowUpRight size={14} />
          </button>
        ) : (
          <Badge>
            {t(api.mode === "mock" ? "Simulated series" : "Live mode")}
          </Badge>
        )
      }
    >
      <div
        className="analytics-tabs"
        role="group"
        aria-label={t("Scientific domain")}
      >
        <button
          aria-pressed={domain === "electrocatalysis"}
          onClick={() => { setDomain("electrocatalysis"); setSliceId(""); }}
        >
          {t("Electrocatalysis")}
        </button>
        <button
          aria-pressed={domain === "battery_cycling"}
          onClick={() => { setDomain("battery_cycling"); setSliceId(""); }}
        >
          {t("Battery cycling")}
        </button>
        <span className="small muted">
          {t(api.mode === "mock" ? "SIMULATED DATA" : "SERVER DATA")}
        </span>
      </div>
      {!compact && api.mode === "live" && catalog.length > 0 && (
        <div className="compiler-input">
          <label className="field-label" htmlFor="analysis-slice">{t("Analysis slice")}</label>
          <select id="analysis-slice" value={sliceId} onChange={event => setSliceId(event.target.value)}>
            <option value="">{t("First authorized slice")}</option>
            {catalog.filter(slice => slice.domain === domain && !slice.quarantined && slice.analysis_methods?.length !== 0)
              .map(slice => <option value={slice.slice_id} key={slice.slice_id}>{slice.title}</option>)}
          </select>
          <p className="small muted">{t("Acquire data or authorize owner access before analysis.")}</p>
        </div>
      )}
      {busy ? (
        <Loading text={t("Loading scientific analysis…")} />
      ) : error ? (
        <ErrorNotice error={error} retry={() => setAttempt((x) => x + 1)} />
      ) : data ? (
        <>
          <div className="analytics-metadata">
            <span>{t(data.source)}</span>
            <span>{t(data.conditions)}</span>
          </div>
          <div className={`plots ${compact ? "compact-plots" : ""}`}>
            {(compact ? data.plots.slice(0, 1) : data.plots).map((plot) => (
              <ScientificPlot
                key={plot.title}
                plot={plot}
                compact={compact}
                dataLabel={
                  api.mode === "mock" ? "Simulated data." : data.source
                }
              />
            ))}
          </div>
          <div className="metric-strip">
            {data.metrics.map((metric) => (
              <div key={metric.label}>
                <span>{t(metric.label)}</span>
                <strong>{t(metric.value)}</strong>
              </div>
            ))}
          </div>
          {!compact && (
            <div className="notice warning">
              <AlertTriangle size={17} />
              <span>
                <strong>{t("Causal guardrail.")}</strong> {t(data.warning)}
              </span>
            </div>
          )}
        </>
      ) : (
        <Empty>
          {t("No analysis series is available for this selection.")}
        </Empty>
      )}
    </Panel>
  );
}
