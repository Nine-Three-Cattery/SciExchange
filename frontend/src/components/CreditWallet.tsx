import { Database } from "lucide-react";
import type { WalletSnapshot } from "../api/contracts";
import { useI18n } from "../i18n/LanguageProvider";
import { Badge, Panel } from "./ui";
export function CreditWallet({
  wallet,
  mock,
}: {
  wallet?: WalletSnapshot;
  mock: boolean;
}) {
  const { t } = useI18n();
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
