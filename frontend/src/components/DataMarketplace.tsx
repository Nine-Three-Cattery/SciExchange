import { ShoppingCart, ArrowRight } from "lucide-react";
import {
  isEligible,
  type Slice,
  type DataDelivery,
  type WalletSnapshot,
} from "../api/contracts";
import { useI18n } from "../i18n/LanguageProvider";
import { getOwn } from "../utils/records";
import { Badge, Empty, Panel } from "./ui";
import { CreditWallet } from "./CreditWallet";

export function DataMarketplace({
  slices,
  wallet,
  deliveries,
  busy,
  mock,
  onBuy,
  onVault,
}: {
  slices: Slice[];
  wallet?: WalletSnapshot;
  deliveries: Record<string, DataDelivery>;
  busy: boolean;
  mock: boolean;
  onBuy: (slice: Slice) => void;
  onVault: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="detail-grid marketplace-layout">
      <Panel
        title={t("Buy scientific data")}
        eyebrow={t("SciCredit purchases")}
        action={<ShoppingCart size={18} />}
      >
        <p className="section-description">
          {t(
            "1. Choose a dataset. 2. Request access and review the price. 3. Pay SciCredit and download.",
          )}
        </p>
        <div className="marketplace-list">
          {slices.map((slice) => {
            const owned = !!getOwn(deliveries, slice.slice_id);
            const eligible = isEligible(slice);
            return (
              <article key={slice.slice_id} className="marketplace-item">
                <div className="marketplace-item-heading">
                  <h3>{t(slice.title)}</h3>
                  <Badge tone={owned || eligible ? "success" : "warning"}>
                    {t(
                      owned
                        ? "Acquired"
                        : eligible
                          ? "Attested"
                          : "Unavailable for purchase",
                    )}
                  </Badge>
                </div>
                <p className="small muted">
                  {t(
                    slice.domain === "electrocatalysis"
                      ? "Electrocatalysis"
                      : "Battery cycling",
                  )}
                </p>
                <p className="small muted">{t(slice.summary)}</p>
                <p className="mono small marketplace-id">{slice.slice_id}</p>
                <div className="marketplace-item-footer">
                  <strong className="mono">{slice.price_scicredit} SC</strong>
                  <button
                    className="button primary"
                    disabled={!eligible || busy}
                    aria-label={`${t(owned ? "View acquired data" : "Buy data")}: ${t(slice.title)}`}
                    onClick={() => onBuy(slice)}
                  >
                    <ShoppingCart size={14} />
                    {t(owned ? "View acquired data" : "Buy data")}
                  </button>
                </div>
                {!eligible && (
                  <p className="small muted">
                    {t("Only eligible, attested datasets can be purchased.")}
                  </p>
                )}
              </article>
            );
          })}
          {slices.length === 0 && <Empty>{t("No datasets available.")}</Empty>}
        </div>
      </Panel>
      <div className="marketplace-wallet">
        <CreditWallet wallet={wallet} mock={mock} />
        <button className="button full-width" onClick={onVault}>
          {t("Earn credits in Data vault")}
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
