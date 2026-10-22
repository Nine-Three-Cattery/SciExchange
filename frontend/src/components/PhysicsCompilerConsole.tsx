import { useI18n } from "../i18n/LanguageProvider";
import { useState } from "react";
import {
  ArrowRight,
  FileJson,
  Play,
  ShieldAlert,
  Terminal,
} from "lucide-react";
import type { Slice, Submission, Verification } from "../api/contracts";
import { submissionSchema } from "../api/contracts";
import { submissions } from "../mocks/fixtures";
import { Badge, ErrorNotice, Panel, errorText } from "./ui";
interface Props {
  slices: Slice[];
  mode: "mock" | "live";
  results: Record<string, Verification>;
  onVerify: (input: Submission) => Promise<void>;
  onInspect: (id: string) => void;
}
export function PhysicsCompilerConsole({
  slices,
  mode,
  results,
  onVerify,
  onInspect,
}: Props) {
  const { t } = useI18n();

  const [selected, setSelected] = useState("slice_fraud_fake_oer_002");
  const [inputType, setInputType] = useState<"catalog" | "json">("catalog");
  const [json, setJson] = useState("");
  const [lastId, setLastId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const result = results[inputType === "json" ? lastId || "" : selected];
  async function run() {
    setBusy(true);
    setError("");
    try {
      let input: Submission;
      if (inputType === "json") {
        let parsed: unknown;
        try {
          parsed = JSON.parse(json);
        } catch {
          throw new Error("Invalid slice JSON.");
        }
        const validated = submissionSchema.safeParse(parsed);
        if (!validated.success)
          throw new Error("Slice JSON does not match the required structure.");
        input = validated.data;
      } else {
        const fixture = submissions.find((s) => s.slice_id === selected);
        if (!fixture)
          throw new Error(
            "Full tensor input is required. Use Submit JSON for live verification.",
          );
        if (mode === "live")
          throw new Error(
            "Live verification requires your full slice JSON. Demo fixtures are not submitted in live mode.",
          );
        input = fixture;
      }
      setLastId(input.slice_id);
      await onVerify(input);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel
      title={t("Physics compiler")}
      eyebrow={t("01 / Verification")}
      action={
        <Badge
          tone={result ? (result.valid ? "success" : "danger") : "neutral"}
        >
          {t(
            busy
              ? "Compiling"
              : result
                ? result.valid
                  ? "Verified"
                  : "Rejected"
                : "Ready",
          )}
        </Badge>
      }
    >
      <p className="section-description">
        {t(
          "Physical constraints first. Only valid scientific slices enter the exchange.",
        )}
      </p>
      <div className="segmented compact" aria-label={t("Submission method")}>
        <button
          aria-pressed={inputType === "catalog"}
          onClick={() => {
            setInputType("catalog");
            setError("");
          }}
        >
          {t("Select slice")}
        </button>
        <button
          aria-pressed={inputType === "json"}
          onClick={() => {
            setInputType("json");
            setError("");
          }}
        >
          {t("Submit JSON")}
        </button>
      </div>
      {inputType === "catalog" ? (
        <div className="compiler-input">
          <label className="field-label" htmlFor="compiler-slice">
            {t("Experimental slice")}
          </label>
          <select
            id="compiler-slice"
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setError("");
            }}
          >
            <option value="slice_fraud_fake_oer_002">
              {t("C / Flagged OER submission")}
            </option>
            {slices
              .filter((s) => s.slice_id !== "slice_fraud_fake_oer_002")
              .map((s) => (
                <option value={s.slice_id} key={s.slice_id}>
                  {t(s.title)}
                </option>
              ))}
          </select>
          <div className="quick-presets">
            <span className="quick-presets-label">{t("Quick slice selection:")}</span>
            <div className="preset-chips">
              <button
                type="button"
                className={`preset-chip danger ${selected === "slice_fraud_fake_oer_002" ? "active" : ""}`}
                onClick={() => {
                  setSelected("slice_fraud_fake_oer_002");
                  setError("");
                }}
              >
                <span className="chip-indicator" />
                {t("Adversarial: Malicious OER (FE=108.2%)")}
              </button>
              <button
                type="button"
                className={`preset-chip success ${selected === "slice_catalysis_oer_nife_001" ? "active" : ""}`}
                onClick={() => {
                  setSelected("slice_catalysis_oer_nife_001");
                  setError("");
                }}
              >
                <span className="chip-indicator" />
                {t("Authentic: Meta OC22 NiFe-LDH")}
              </button>
              <button
                type="button"
                className={`preset-chip blue ${selected === "slice_battery_severson_lfp_001" ? "active" : ""}`}
                onClick={() => {
                  setSelected("slice_battery_severson_lfp_001");
                  setError("");
                }}
              >
                <span className="chip-indicator" />
                {t("Authentic: Stanford Severson LFP")}
              </button>
            </div>
          </div>
          <div className="slice-facts">
            <FileJson size={14} />
            <span>{t(selected)}</span>
          </div>
        </div>
      ) : (
        <div className="compiler-input">
          <label className="field-label" htmlFor="slice-json">
            {t("Complete slice JSON · metadata, columns and rows")}
          </label>
          <textarea
            id="slice-json"
            rows={7}
            value={json}
            onChange={(e) => setJson(e.target.value)}
            placeholder={t(
              '{"slice_id":"...","domain":"electrocatalysis","metadata":{},"columns":["potential_v_rhe","current_density_ma_cm2"],"rows":[[1.23,0.01]]}',
            )}
          />
        </div>
      )}
      <div
        className="terminal"
        aria-label={t("Compiler diagnostics")}
        aria-live="polite"
      >
        <div className="terminal-bar">
          <div className="terminal-dots" aria-hidden="true">
            <span className="dot red" />
            <span className="dot yellow" />
            <span className="dot green" />
          </div>
          <span className="terminal-brand">
            <Terminal size={13} /> {t("phys.compiler")} <span className="version-pill inline">Lean4 Core</span>
          </span>
          <span className="terminal-mode">{t(mode === "mock" ? "SIMULATION" : "LIVE API")}</span>
        </div>
        <div className="terminal-lines">
          {busy ? (
            <p className="muted">{t("Submitting slice for verification…")}</p>
          ) : result ? (
            result.diagnostic_log.split("\n").map((line, i) => (
              <div
                className={`log-line ${/ERROR|REJECTED/.test(line) ? "log-error" : /WARN|ALERT/.test(line) ? "log-warning" : /PASS|ATTESTED/.test(line) ? "log-success" : ""}`}
                key={i}
              >
                <span>{t(String(i + 1).padStart(2, "0"))}</span>
                <code>{line}</code>
              </div>
            ))
          ) : (
            <>
              <p className="muted">{t("// Awaiting experimental slice")}</p>
              <p>{t("Charge conservation · kinetics · safety")}</p>
              <p className="muted">
                {t("Select a slice and run verification.")}
              </p>
            </>
          )}
        </div>
      </div>
      {result?.violated_axioms.map((axiom) => (
        <div className="invariant" key={axiom.axiom_id}>
          <ShieldAlert size={16} />
          <div>
            <strong>{t(axiom.name)}</strong>
            <p>
              {t(axiom.formula)} {t("· observed")} {axiom.observed_value}
            </p>
            <small>{t(axiom.severity)}</small>
          </div>
        </div>
      ))}
      {result?.safety_alerts.map((alert, i) => (
        <div className="notice warning" key={i}>
          <ShieldAlert size={16} />
          <div>
            <strong>
              {t(alert.type.replaceAll("_", " "))} {t("·")} {t(alert.action)}
            </strong>
            <p>
              {t("Untrusted metadata pattern:")}
              <code>{alert.pattern_matched}</code>
            </p>
          </div>
        </div>
      ))}
      {result?.attestation_uid && (
        <button
          className="attestation-link"
          onClick={() => onInspect(result.slice_id)}
        >
          {t("Inspect attestation")} <code>{result.attestation_uid}</code>
          <ArrowRight size={15} />
        </button>
      )}
      {t(error && <ErrorNotice error={error} retry={() => void run()} />)}
      <footer className="panel-footer">
        <span className="muted small">
          {t(
            mode === "mock"
              ? "Deterministic demonstration fixtures"
              : "Backend verification is authoritative",
          )}
        </span>
        <button
          className="button primary"
          disabled={busy}
          onClick={() => void run()}
        >
          <Play size={14} />
          {t(busy ? "Verifying…" : "Compile & attest")}
        </button>
      </footer>
    </Panel>
  );
}
