import { useEffect, useRef, useState } from "react";
import { Check, Download, LockKeyhole, X } from "lucide-react";
import type {
  DataDelivery,
  ExchangeApi,
  PaymentChallenge,
  PurchaseResult,
  Slice,
  WalletSnapshot,
} from "../api/contracts";
import { PaymentRequiredError } from "../api/access";
import { Badge, ErrorNotice, errorText, Loading } from "./ui";
import { useI18n } from "../i18n/LanguageProvider";
export function DataPurchaseModal({
  slice,
  api,
  wallet,
  owned,
  onAccess,
  onPurchase,
  onClose,
  onVault,
}: {
  slice: Slice;
  api: ExchangeApi;
  wallet?: WalletSnapshot;
  owned?: DataDelivery;
  onAccess: (id: string) => ReturnType<ExchangeApi["access"]>;
  onPurchase: ExchangeApi["purchase"];
  onClose: () => void;
  onVault: () => void;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const [challenge, setChallenge] = useState<PaymentChallenge>();
  const [delivery, setDelivery] = useState(owned);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PurchaseResult>();
  const ownerRead =
    api.mode === "live" &&
    slice.owner_lab_id === api.getLab?.() &&
    !slice.quarantined;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      before?.focus();
    };
  }, []);
  async function request() {
    setBusy(true);
    setError("");
    setChallenge(undefined);
    try {
      const response = await onAccess(slice.slice_id);
      if (response.kind === "delivered") setDelivery(response);
      else setChallenge(response);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function buy() {
    if (!challenge) return;
    setBusy(true);
    setError("");
    try {
      const response = await onPurchase({
        sliceId: slice.slice_id,
        nonce: challenge.nonce,
      });
      setResult(response);
      setDelivery(response.delivery);
    } catch (e) {
      if (e instanceof PaymentRequiredError) {
        setChallenge(e.challenge);
      }
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function download() {
    if (!delivery) return;
    const url = URL.createObjectURL(
      new Blob([delivery.text], { type: delivery.mediaType }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = delivery.filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const insufficient =
    challenge && wallet !== undefined && wallet.balance < challenge.amount;
  return (
    <dialog
      ref={ref}
      className="approval-dialog"
      aria-labelledby="purchase-title"
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
          disabled={busy}
          aria-label={t("Close purchase dialog")}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <p className="eyebrow">{t("SciCredit / Controlled data access")}</p>
      <h2 id="purchase-title">{t("Acquire scientific data")}</h2>
      <p className="section-description">
        {t(
          "Review the slice, server challenge and delivery before using the data.",
        )}
      </p>
      <div className="agreement-id">
        <strong>{t(slice.title)}</strong>
        <code>{slice.slice_id}</code>
        <Badge tone={api.mode === "mock" ? "warning" : "neutral"}>
          {t(api.mode === "mock" ? "Simulated purchase" : "Live data access")}
        </Badge>
      </div>
      <div className="metric-strip">
        <div>
          <span>{t("Catalog price")}</span>
          <strong>{slice.price_scicredit} SC</strong>
        </div>
        <div>
          <span>{t("Available SciCredit")}</span>
          <strong>{wallet ? `${wallet.balance} SC` : t("Unavailable")}</strong>
        </div>
        <div>
          <span>{t("Data access")}</span>
          <strong>{t(delivery ? "Confirmed" : "Locked")}</strong>
        </div>
      </div>
      {api.mode === "mock" ? (
        <div className="notice warning">
          {t(
            "Demo wallet starts with 100 SC. Credits, payments and downloaded data are simulated; no real money is transferred.",
          )}
        </div>
      ) : (
        <div className="notice warning">
          {t(
            ownerRead
              ? "Owner access requires a short-lived PI signature and does not spend SciCredit. Scientific analysis still requires compilation."
              : "A fresh PI signature authorizes the backend to spend the active lab’s SciCredit. The browser does not mint credits or create payment receipts.",
          )}
        </div>
      )}
      {busy && <Loading text={t("Confirming access…")} />}
      {challenge && !delivery && (
        <div className="node-detail">
          <div className="row-between">
            <strong>{t("HTTP 402 · Payment required")}</strong>
            <Badge tone="warning">
              {challenge.amount} {challenge.token}
            </Badge>
          </div>
          <p className="small muted">{t("No data has been delivered.")}</p>
          <p className="small">
            {t("Payee")}: <code>{challenge.payee}</code>
          </p>
          <p className="small">
            {t("Network")}: {t(challenge.network)}
          </p>
          <p className="small">
            {t("Challenge nonce")}: <code>{challenge.nonce}</code>
          </p>
          {challenge.amount !== slice.price_scicredit && (
            <div className="notice warning">
              {t(
                "The server price differs from the catalog. Review the current challenge amount before proceeding.",
              )}
            </div>
          )}
          {!challenge.acceptedMethods.includes("scicredit_microtransfer") && (
            <div className="notice warning">
              {t(
                "This challenge does not accept SciCredit transfers. Use an authorized barter instead.",
              )}
            </div>
          )}
        </div>
      )}
      {insufficient && (
        <div className="notice warning">
          {t(
            api.mode === "mock"
              ? "Insufficient SciCredit. Stake eligible failure data to earn credit."
              : "Your balance is below the price. You can still retrieve an existing paid entitlement; the backend rejects unfunded new purchases.",
          )}
          <button className="text-button" disabled={busy} onClick={onVault}>
            {t("Open data vault")}
          </button>
        </div>
      )}
      {error && <ErrorNotice error={error} />}
      {delivery && (
        <div className="settlement confirmed" role="status">
          <Check size={20} />
          <div>
            <strong>
              {t(
                api.mode === "mock"
                  ? result
                    ? "Simulated purchase confirmed"
                    : "Simulated data access confirmed"
                  : "Backend delivery confirmed",
              )}
            </strong>
            <p>
              {delivery.rowCount} {t("rows")} · {delivery.columnCount}{" "}
              {t("columns")} · {delivery.format.toUpperCase()}
            </p>
            <p className="small">
              {t(
                "Access is confirmed only after a validated data payload is received.",
              )}
            </p>
          </div>
        </div>
      )}
      {delivery && (
        <details className="node-detail">
          <summary>{t("Preview delivered data")}</summary>
          <pre>
            {delivery.text.slice(0, 1500)}
            {delivery.text.length > 1500 ? "…" : ""}
          </pre>
        </details>
      )}
      <footer className="modal-footer">
        <button className="button" disabled={busy} onClick={onClose}>
          {t("Close review")}
        </button>
        {delivery ? (
          <button className="button primary" onClick={download}>
            <Download size={14} />
            {t("Download data")}
          </button>
        ) : challenge ? (
          <button
            className="button primary"
            disabled={
              busy ||
              (api.mode === "mock" && !!insufficient) ||
              !challenge.acceptedMethods.includes("scicredit_microtransfer")
            }
            onClick={() => void buy()}
          >
            {t("Pay SciCredit & acquire")}
          </button>
        ) : (
          <button
            className="button primary"
            disabled={busy}
            onClick={() => void request()}
          >
            {t("Request data access")}
          </button>
        )}
      </footer>
      {challenge && !delivery && (
        <button
          className="text-button"
          disabled={busy}
          onClick={() => void request()}
        >
          {t("Refresh access challenge")}
        </button>
      )}
    </dialog>
  );
}
