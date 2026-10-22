import { useI18n } from "../i18n/LanguageProvider";
import { useEffect, useRef, useState } from "react";
import { Check, LockKeyhole, ShieldCheck, X } from "lucide-react";
import type { Agreement, Role } from "../api/contracts";
import { Badge, ErrorNotice, errorText } from "./ui";
export function HumanDualSignModal({
  agreement,
  mock,
  onClose,
  onApprove,
}: {
  agreement: Agreement;
  mock: boolean;
  onClose: () => void;
  onApprove: (role: Role) => Promise<void>;
}) {
  const { t } = useI18n();

  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState<Role>();
  const [error, setError] = useState("");
  const [declined, setDeclined] = useState(false);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      before?.focus();
    };
  }, []);
  async function approve(role: Role) {
    setBusy(role);
    setError("");
    try {
      await onApprove(role);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(undefined);
    }
  }
  return (
    <dialog
      ref={ref}
      className="approval-dialog"
      aria-labelledby="approval-title"
      onCancel={(event) => {
        if (busy) event.preventDefault();
        else onClose();
      }}
    >
      <div className="modal-top">
        <span className="icon-box">
          <LockKeyhole size={20} />
        </span>
        <button
          className="icon-button"
          aria-label={t("Close approval dialog")}
          disabled={!!busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <p className="eyebrow">{t("04 / Human authorization")}</p>
      <h2 id="approval-title">{t("Science moves with consent.")}</h2>
      <p className="section-description">
        {t(
          "Review the exact agreement before approving. Both laboratories retain control of their data.",
        )}
      </p>
      <div className="agreement-id">
        <span className="field-label">{t("Agreement")}</span>
        <code>{agreement.proposal.proposal_id}</code>
        <Badge tone={mock ? "warning" : "neutral"}>
          {t(mock ? "Simulated approval" : "Live authorization")}
        </Badge>
      </div>
      <div className="approval-labs">
        {(["pi_proposer", "pi_target"] as const).map((role, i) => {
          const slice = i === 0 ? agreement.offered : agreement.requested;
          const approved = agreement.approvals.includes(role);
          return (
            <div className="approval-lab" key={role}>
              <div className="row-between">
                <strong>
                  {t(i === 0 ? "Lab A Human PI" : "Lab B Human PI")}
                </strong>
                <Badge tone={approved ? "success" : "neutral"}>
                  {t(approved ? "Approved" : "Pending")}
                </Badge>
              </div>
              <h3>{t(slice.title)}</h3>
              <code>{slice.slice_id}</code>
              <p className="small muted">
                {t("Attestation:")}
                {t(" ")}
                {t(
                  slice.is_attested
                    ? slice.attestation_uid || "Available"
                    : "Unavailable",
                )}
              </p>
              <p className="small muted">
                {t("Agent signature: unavailable in current response")}
              </p>
              <button
                className={`button ${approved ? "" : "primary"}`}
                disabled={
                  !!busy ||
                  approved ||
                  declined ||
                  agreement.settlementConfirmed
                }
                onClick={() => void approve(role)}
              >
                {approved ? (
                  <>
                    <Check size={15} /> {t("Approval recorded")}
                  </>
                ) : busy === role ? (
                  t("Recording approval…")
                ) : (
                  t(`Approve as Lab ${i === 0 ? "A" : "B"} PI`)
                )}
              </button>
            </div>
          );
        })}
      </div>
      {!mock && (
        <div className="notice warning">
          <ShieldCheck size={17} />
          <span>
            {t(
              "Review the exact canonical agreement and submit an external Ed25519 signature. Private keys remain on your own machine.",
            )}
          </span>
        </div>
      )}
      {declined && (
        <div className="notice warning" role="status">
          {t(
            "Review declined in this session. No rejection endpoint is defined; no server state was changed.",
          )}
        </div>
      )}
      {t(error && <ErrorNotice error={error} />)}
      <div
        className={`settlement ${agreement.settlementConfirmed ? "confirmed" : ""}`}
        role="status"
      >
        {agreement.settlementConfirmed ? (
          <ShieldCheck size={20} />
        ) : (
          <LockKeyhole size={20} />
        )}
        <div>
          <strong>
            {t(
              agreement.settlementConfirmed
                ? mock
                  ? "Simulated exchange settled"
                  : "Backend-confirmed settlement"
                : "Data release remains locked",
            )}
          </strong>
          <p>
            {t(
              agreement.settlementConfirmed
                ? "Settlement was confirmed by the selected adapter."
                : "Human approvals do not independently confirm settlement.",
            )}
          </p>
        </div>
      </div>
      <footer className="modal-footer">
        <button
          className="text-button"
          disabled={!!busy || agreement.settlementConfirmed || declined}
          onClick={() => setDeclined(true)}
        >
          {t("Decline review")}
        </button>
        <button className="button" disabled={!!busy} onClick={onClose}>
          {t("Close review")}
        </button>
      </footer>
    </dialog>
  );
}
