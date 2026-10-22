import { useI18n } from "../i18n/LanguageProvider";
import {
  ArrowLeftRight,
  ArrowRight,
  Bot,
  Check,
  LockKeyhole,
} from "lucide-react";
import { useState } from "react";
import type { Agreement, Slice } from "../api/contracts";
import { Badge, Empty, ErrorNotice, Panel, errorText } from "./ui";
export function BarterNegotiationCard({
  slices,
  agreement,
  onPropose,
  onReview,
  mock,
}: {
  slices: Slice[];
  agreement?: Agreement;
  onPropose: (offered: Slice, requested: Slice) => Promise<void>;
  onReview: () => void;
  mock: boolean;
}) {
  const { t } = useI18n();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const a = slices.find(
    (s) => s.domain === "electrocatalysis" && s.is_attested,
  );
  const b = slices.find((s) => s.domain === "battery_cycling" && s.is_attested);
  async function propose() {
    if (!a || !b) return;
    setBusy(true);
    setError("");
    try {
      await onPropose(a, b);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel
      title={t("Agent-to-agent exchange")}
      eyebrow={t("03 / Negotiation")}
      action={
        <Badge tone={agreement ? "success" : "neutral"}>
          {t(agreement ? "Proposal received" : "Discovery")}
        </Badge>
      }
    >
      <p className="section-description">
        {t(
          "Complementary data. Reciprocal terms. Human control over every release.",
        )}
      </p>
      {!a || !b ? (
        <Empty>
          {t("Two attested slices from complementary domains are required.")}
        </Empty>
      ) : (
        <>
          <div className="barter-grid">
            {[a, b].map((slice, i) => (
              <div className="lab-card" key={slice.slice_id}>
                <div className="row-between">
                  <span className={`lab-avatar lab-${i}`}>
                    <Bot size={21} />
                  </span>
                  <span className="mono small">
                    {t("LAB")}
                    {t(i === 0 ? "A" : "B")}
                  </span>
                </div>
                <h3>
                  {t(i === 0 ? "Electrocatalysis" : "Battery engineering")}
                </h3>
                <p className="muted small">
                  {t(i === 0 ? "agent_catalysis_0x1a" : "agent_battery_0x2b")}
                </p>
                <div className="offered-data">
                  <small>{t("OFFERS")}</small>
                  <strong>{t(slice.title)}</strong>
                  <span className="small">
                    <Check size={12} /> {t("Attestation available")}
                  </span>
                </div>
                <div className="small muted">
                  {t("Seeks")}
                  {t(" ")}
                  {t(
                    i === 0
                      ? "battery degradation profiles"
                      : "electrocatalysis benchmarks",
                  )}
                </div>
              </div>
            ))}
            <div className={`exchange-link ${busy ? "negotiating" : ""}`}>
              <ArrowLeftRight size={20} />
            </div>
          </div>
          <div className="negotiation-track">
            <span className="active">{t("01 Discover")}</span>
            <span className={agreement ? "active" : ""}>{t("02 Propose")}</span>
            <span className={agreement?.approvals.length ? "active" : ""}>
              {t("03 Authorize")}
            </span>
            <span className={agreement?.settlementConfirmed ? "active" : ""}>
              {t("04 Settle")}
            </span>
          </div>
          {agreement && (
            <div className="agreement-summary">
              <div className="row-between">
                <strong>{t("Reciprocal exchange proposed")}</strong>
                <code>{agreement.proposal.proposal_id}</code>
              </div>
              <p>
                {t(
                  "One attested slice per laboratory. Both Human PIs must authorize the same agreement.",
                )}
              </p>
              <div className="small muted">
                <LockKeyhole size={13} />{" "}
                {t("Agent signatures: not provided by the proposal response.")}
              </div>
              <div className="notice">
                <LockKeyhole size={15} />
                <span>
                  {t(
                    agreement.settlementConfirmed
                      ? mock
                        ? "Simulated settlement confirmed."
                        : "Backend settlement confirmed."
                      : "Data release locked · awaiting confirmed settlement.",
                  )}
                </span>
              </div>
            </div>
          )}
          {t(
            error && <ErrorNotice error={error} retry={() => void propose()} />,
          )}
          <footer className="panel-footer">
            <span className="small muted">
              {t(
                mock
                  ? "Simulated A2A proposal"
                  : "Proposal returned by backend",
              )}
            </span>
            {agreement ? (
              <button className="button primary" onClick={onReview}>
                {t("Review authorization")}
                <ArrowRight size={14} />
              </button>
            ) : (
              <button
                className="button primary"
                disabled={busy}
                onClick={() => void propose()}
              >
                {t(busy ? "Proposing exchange…" : "Propose exchange")}
                <ArrowRight size={14} />
              </button>
            )}
          </footer>
        </>
      )}
    </Panel>
  );
}
