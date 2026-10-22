import { useI18n } from "../i18n/LanguageProvider";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  FileJson,
  Play,
  ShieldAlert,
  Terminal,
} from "lucide-react";
import type { Slice, CompilerInput, Verification } from "../api/contracts";
import { submissionSchema, isRejected } from "../api/contracts";
import { submissions } from "../mocks/fixtures";
import { getOwn } from "../utils/records";
import { Badge, ErrorNotice, Panel, errorText } from "./ui";
interface Props {
  slices: Slice[];
  mode: "mock" | "live";
  initialSliceId?: string;
  results: Record<string, Verification>;
  onVerify: (input: CompilerInput) => Promise<void>;
  onInspect: (id: string) => void;
  activeLab?: string;
  onReview?: (id: string) => Promise<void>;
}
export function PhysicsCompilerConsole({
  slices,
  mode,
  initialSliceId,
  results,
  onVerify,
  onInspect,
  activeLab,
  onReview,
}: Props) {
  const { t } = useI18n();

  const [selected, setSelected] = useState(
    initialSliceId || "slice_fraud_fake_oer_002",
  );
  const [inputType, setInputType] = useState<"catalog" | "json">("catalog");
  const [json, setJson] = useState("");
  const [jsonSubmission, setJsonSubmission] = useState<{
    id: string;
    text: string;
  }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [failedAction, setFailedAction] = useState<"verify" | "review">("verify");
  useEffect(() => {
    if (!slices.some((slice) => slice.slice_id === selected))
      setSelected(
        slices.find(
          (slice) => slice.domain === "electrocatalysis" && slice.quarantined,
        )?.slice_id ||
          slices[0]?.slice_id ||
          "",
      );
  }, [slices, selected]);
  const presetSlices =
    mode === "mock"
      ? [
          "slice_fraud_fake_oer_002",
          "slice_catalysis_oer_nife_001",
          "slice_battery_severson_lfp_001",
        ]
          .map((id) => slices.find((slice) => slice.slice_id === id))
          .filter((slice): slice is Slice => !!slice)
      : slices.filter(
          (slice) =>
            slice.domain !== "hydrothermal_synthesis" &&
            !slice.title.includes("QUARANTINED_CWC"),
        );
  const result =
    inputType === "catalog"
      ? getOwn(results, selected)
      : jsonSubmission?.text === json
        ? getOwn(results, jsonSubmission.id)
        : undefined;
  const selectedSlice = slices.find((slice) => slice.slice_id === selected);
  const canReview =
    inputType === "catalog" &&
    !!onReview &&
    !!selectedSlice?.version &&
    selectedSlice.owner_lab_id === activeLab &&
    !selectedSlice.quarantined &&
    selectedSlice.compiler_status !== "REJECTED" &&
    selectedSlice.review_status !== "approved" &&
    !isRejected(result);
  async function review() {
    if (!canReview || !onReview) return;
    setFailedAction("review");
    setBusy(true);
    setError("");
    try {
      await onReview(selected);
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  async function run() {
    setFailedAction("verify");
    setBusy(true);
    setError("");
    if (inputType === "json") setJsonSubmission(undefined);
    try {
      let input: CompilerInput;
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
        if (mode === "live")
          input = {
            slice_id: selected,
            ...(selectedSlice?.version
              ? { version: selectedSlice.version }
              : {}),
          };
        else {
          const fixture = submissions.find(
            (item) => item.slice_id === selected,
          );
          if (!fixture)
            throw new Error("Select an available slice before compiling.");
          input = fixture;
        }
      }
      await onVerify(input);
      if (inputType === "json")
        setJsonSubmission({ id: input.slice_id, text: json });
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
          tone={
            result
              ? isRejected(result)
                ? "danger"
                : result.valid
                  ? "success"
                  : "warning"
              : "neutral"
          }
        >
          {t(
            busy
              ? "Compiling"
              : result
                ? isRejected(result)
                  ? "Rejected"
                  : result.compiler_status === "REVIEW_REQUIRED"
                    ? "Scientific review required"
                    : "Verified"
                : "Ready",
          )}
        </Badge>
      }
    >
      <p className="section-description">
        {t(
          "Scientific checks and human admission are separate. Admission does not establish scientific authenticity.",
        )}
      </p>
      <div className="segmented compact" aria-label={t("Submission method")}>
        <button
          aria-pressed={inputType === "catalog"}
          onClick={() => {
            setInputType("catalog");
            setJsonSubmission(undefined);
            setError("");
          }}
        >
          {t("Select slice")}
        </button>
        <button
          aria-pressed={inputType === "json"}
          onClick={() => {
            setInputType("json");
            setJsonSubmission(undefined);
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
            {slices.map((slice) => (
              <option value={slice.slice_id} key={slice.slice_id}>
                {t(
                  mode === "mock" &&
                    slice.slice_id === "slice_fraud_fake_oer_002"
                    ? "C / Flagged OER submission"
                    : slice.title,
                )}
              </option>
            ))}
          </select>
          <div className="quick-presets">
            <span className="quick-presets-label">
              {t("Quick slice selection:")}
            </span>
            <div className="preset-chips">
              {presetSlices.map((slice) => (
                <button
                  key={slice.slice_id}
                  type="button"
                  className={`preset-chip ${slice.quarantined || slice.data_classification === "negative_control" ? "danger" : slice.domain === "battery_cycling" ? "blue" : "success"} ${selected === slice.slice_id ? "active" : ""}`}
                  onClick={() => {
                    setSelected(slice.slice_id);
                    setError("");
                  }}
                >
                  <span className="chip-indicator" />
                  {t(slice.title)}
                </button>
              ))}
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
            onChange={(e) => {
              setJson(e.target.value);
              setJsonSubmission(undefined);
              setError("");
            }}
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
            <Terminal size={13} /> {t("phys.compiler")}{" "}
            <span className="version-pill inline">Numerical checks</span>
          </span>
          <span className="terminal-mode">
            {t(mode === "mock" ? "SIMULATION" : "LIVE API")}
          </span>
        </div>
        <div className="terminal-lines">
          {busy ? (
            <p className="muted">{t("Submitting slice for verification…")}</p>
          ) : result ? (
            result.diagnostic_log.split("\n").map((line, i) => (
              <div
                className={`log-line ${/error|rejected/i.test(line) ? "log-error" : /warn|alert/i.test(line) ? "log-warning" : /pass|attested/i.test(line) ? "log-success" : ""}`}
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
              {t(axiom.formula)} {t("· observed")}{" "}
              {typeof axiom.observed_value === "number"
                ? axiom.observed_value
                : JSON.stringify(axiom.observed_value)}
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
              <code>{alert.rule || alert.pattern_matched || alert.type}</code>
            </p>
          </div>
        </div>
      ))}
      {result?.checks && (
        <details>
          <summary>{t("Scientific check coverage")}</summary>
          {result.checks.map((check) => (
            <p className="small" key={check.rule_id}>
              <strong>
                {check.rule_id} · {check.status}
              </strong>{" "}
              — {check.reason}
            </p>
          ))}
          <p className="small muted">
            {t("Numerical checks are not a formal proof.")}
          </p>
        </details>
      )}
      {selectedSlice?.version && inputType === "catalog" && (
        <p className="small muted">
          {t(
            selectedSlice.review_status === "approved"
              ? "Human admission approved"
              : "Human admission pending",
          )}
        </p>
      )}
      {result?.attestation_uid && (
        <button
          className="attestation-link"
          onClick={() => onInspect(result.slice_id)}
        >
          {t("Inspect attestation")} <code>{result.attestation_uid}</code>
          <ArrowRight size={15} />
        </button>
      )}
      {t(error && <ErrorNotice error={error} retry={() => void (failedAction === "review" ? review() : run())} />)}
      <footer className="panel-footer">
        <span className="muted small">
          {t(
            mode === "mock"
              ? "Deterministic demonstration fixtures"
              : "Backend verification is authoritative",
          )}
        </span>
        {canReview && (
          <button
            className="button"
            disabled={busy}
            onClick={() => void review()}
          >
            {t("Approve admission")}
          </button>
        )}
        <button
          className="button primary"
          disabled={busy || (inputType === "catalog" && !selected)}
          onClick={() => void run()}
        >
          <Play size={14} />
          {t(busy ? "Verifying…" : "Compile & attest")}
        </button>
      </footer>
    </Panel>
  );
}
