import { useI18n } from "../i18n/LanguageProvider";
import { ChevronRight, Languages, RotateCcw } from "lucide-react";
import { Badge } from "./ui";

export function HeaderNavbar({
  page,
  mock,
  resetting,
  onReset,
}: {
  page: string;
  mock: boolean;
  resetting: boolean;
  onReset: () => void;
}) {
  const { t, language, setLanguage } = useI18n();

  return (
    <header className="topbar">
      <div className="breadcrumb">
        <span className="breadcrumb-root">{t("Workspace")}</span>
        <ChevronRight size={13} />
        <span className="breadcrumb-current">{t(page)}</span>
        <span className="version-pill">v4.0 Lean4-DeSci</span>
      </div>

      <div className="topbar-nodes" aria-label={t("Network node indicators")}>
        <div className="node-indicator online" title="BioLogic SP-300 Potentiostat connected">
          <span className="node-ping" />
          <span className="node-dot" />
          <span className="node-text">
            <strong>Lab A</strong>
            <small>BioLogic SP-300</small>
          </span>
        </div>
        <div className="node-divider" />
        <div className="node-indicator online" title="Arbin BT-2000 Battery Cycler connected">
          <span className="node-ping" />
          <span className="node-dot" />
          <span className="node-text">
            <strong>Lab B</strong>
            <small>Arbin BT-2000</small>
          </span>
        </div>
        <div className="node-divider" />
        <div className="node-indicator active" title="x402 Micropayment & Liquidity Vault ready">
          <span className="node-dot amber" />
          <span className="node-text">
            <strong>x402 Vault</strong>
            <small>{t("Active")}</small>
          </span>
        </div>
      </div>

      <div className="topbar-actions">
        <label className="language-picker">
          <Languages size={14} aria-hidden="true" />
          <span className="sr-only">{t("Language")}</span>
          <select
            aria-label={t("Language")}
            value={language}
            onChange={(event) =>
              setLanguage?.(event.target.value as "en" | "zh")
            }
          >
            <option value="en">English</option>
            <option value="zh">中文</option>
          </select>
        </label>
        <Badge tone={mock ? "warning" : "neutral"}>
          {t(mock ? "Demo mode · simulated" : "Live API mode")}
        </Badge>
        <button
          className="button reset-button"
          disabled={resetting}
          onClick={onReset}
          title={t("Reset demo scenario")}
        >
          <RotateCcw size={13} className={resetting ? "spin" : ""} />
          {t(resetting ? "Resetting…" : "Reset demo")}
        </button>
        <span className="profile" title={t("Member C workspace")}>
          {t("AC")}
        </span>
      </div>
    </header>
  );
}
