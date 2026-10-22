import { useI18n } from "../i18n/LanguageProvider";
import { useState } from "react";
import { ArrowDownToLine, LockKeyhole } from "lucide-react";
import type { ExchangeApi, Slice, VaultResult } from "../api/contracts";
import { Badge, ErrorNotice, Panel, errorText } from "./ui";
export function DataVault({
  api,
  slices,
  result,
  onStake,
}: {
  api: ExchangeApi;
  slices: Slice[];
  result?: VaultResult;
  onStake: ExchangeApi["stake"];
}) {
  const { t } = useI18n();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    row_count: "",
    data_quality_score: "",
    staker_address: "",
  });
  const candidate = slices.find(
    (s) => s.data_classification === "dark_matter_failure" && s.is_attested,
  );
  async function stake() {
    if (!candidate) return;
    setBusy(true);
    setError("");
    try {
      const input =
        api.mode === "mock"
          ? {
              slice_id: candidate.slice_id,
              row_count: 100,
              data_quality_score: 0.94,
              staker_address: "demo_lab_b",
            }
          : {
              slice_id: candidate.slice_id,
              row_count: Number(form.row_count),
              data_quality_score: Number(form.data_quality_score),
              staker_address: form.staker_address,
            };
      if (
        !Number.isInteger(input.row_count) ||
        input.row_count < 1 ||
        (!form.row_count && api.mode === "live") ||
        input.data_quality_score < 0 ||
        input.data_quality_score > 1 ||
        !Number.isFinite(input.data_quality_score) ||
        (!form.data_quality_score && api.mode === "live") ||
        !input.staker_address.trim()
      )
        throw new Error(
          "Supply a positive row count, documented quality score (0–1) and staker address.",
        );
      await onStake(input);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel
      title={t("Data liquidity vault")}
      eyebrow={t("06 / Research liquidity")}
      action={
        <Badge>
          {t(api.mode === "mock" ? "Simulated vault" : "Live vault")}
        </Badge>
      }
    >
      <div className="vault-intro">
        <span className="icon-box">
          <ArrowDownToLine size={24} />
        </span>
        <h3>{t("Negative results. Positive research value.")}</h3>
        <p>
          {t(
            "Make verified failure data discoverable and earn research credit. Instrument artifacts and rejected slices remain excluded.",
          )}
        </p>
      </div>
      <div className="vault-candidate">
        <span className="field-label">{t("Eligible failure-data slice")}</span>
        <strong>{t(candidate?.title || "No eligible slice available")}</strong>
        <code>{candidate?.slice_id}</code>
      </div>
      {api.mode === "live" && (
        <div className="vault-form">
          {(["row_count", "data_quality_score", "staker_address"] as const).map(
            (field) => (
              <label key={field}>
                {t(field.replaceAll("_", " "))}
                <input
                  value={form[field]}
                  onChange={(e) =>
                    setForm({ ...form, [field]: e.target.value })
                  }
                />
              </label>
            ),
          )}
        </div>
      )}
      {result && (
        <div className="metric-strip">
          <div>
            <span>{t("Minted SciCredit")}</span>
            <strong>{result.minted_scicredit}</strong>
          </div>
          <div>
            <span>{t("Staker balance")}</span>
            <strong>{result.staker_balance}</strong>
          </div>
          <div>
            <span>{t("Pool slices")}</span>
            <strong>{result.vault_pool_total_slices}</strong>
          </div>
        </div>
      )}
      {t(error && <ErrorNotice error={error} />)}
      <footer className="panel-footer">
        <span className="small muted">
          <LockKeyhole size={12} /> {t("Verification required")}
        </span>
        <button
          className="button primary"
          disabled={!candidate || busy || !!result}
          onClick={() => void stake()}
        >
          {t(
            result
              ? "Deposit recorded"
              : busy
                ? "Depositing…"
                : "Stake failure data",
          )}
          <ArrowDownToLine size={14} />
        </button>
      </footer>
    </Panel>
  );
}
