import { Database } from "lucide-react";
import { useState } from "react";
import type { WalletSnapshot } from "../api/contracts";
import { useI18n } from "../i18n/LanguageProvider";
import { Badge, ErrorNotice, Panel, errorText } from "./ui";
export function CreditWallet({
  wallet,
  mock,
  onRefresh,
}: {
  wallet?: WalletSnapshot;
  mock: boolean;
  onRefresh?: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  async function retryBalance() {
    if (!onRefresh) return;
    setRefreshing(true);
    setError("");
    try {
      await onRefresh();
    } catch (error) {
      setError(errorText(error));
    } finally {
      setRefreshing(false);
    }
  }
  return (
    <Panel
      title={t("SciCredit wallet")}
      eyebrow={t("Research liquidity")}
      action={
        <Badge tone={mock ? "warning" : "neutral"}>
          {t(
            mock
              ? "Simulated ledger"
              : wallet
                ? "Backend balance"
                : "Live balance unavailable",
          )}
        </Badge>
      }
    >
      <div className="metric-strip">
        <div>
          <span>{t("Available SciCredit")}</span>
          <strong>{wallet ? `${wallet.balance} SC` : t("Unavailable")}</strong>
        </div>
        <div>
          <span>{t("Credit entries")}</span>
          <strong>{wallet?.entries.length ?? "—"}</strong>
        </div>
      </div>
      <p className="section-description">
        {t(
          mock
            ? "Demo wallet starts with 100 SC. Credits, payments and downloaded data are simulated; no real money is transferred."
            : "Current SciCredit balance is reported by the backend for the active lab. No opening credits are assumed.",
        )}
      </p>
      {!mock && !wallet && onRefresh && (
        <>
          {error && <ErrorNotice error={error} />}
          <button className="button full-width" disabled={refreshing}
            onClick={() => void retryBalance()}>
            {t(refreshing ? "Refreshing balance…" : "Retry balance")}
          </button>
        </>
      )}
      {wallet?.entries
        .slice()
        .reverse()
        .map((entry) => (
          <div className="event" key={entry.id}>
            <Database size={14} />
            <div>
              <strong>
                {t(
                  entry.kind === "opening"
                    ? "Demo opening allocation"
                    : entry.kind === "stake"
                      ? "Failure-data credit"
                      : "Data purchase debit",
                )}{" "}
                · {entry.amount > 0 ? "+" : ""}
                {entry.amount} SC
              </strong>
              {entry.sliceId && <small>{entry.sliceId}</small>}
            </div>
          </div>
        ))}
    </Panel>
  );
}
