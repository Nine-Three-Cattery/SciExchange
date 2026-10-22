import { useI18n } from "../i18n/LanguageProvider";
import { ChevronRight, Languages, RotateCcw } from "lucide-react";
import { Badge } from "./ui";

export function HeaderNavbar({
  page,
  mock,
  resetting,
  busy = false,
  onReset,
  activeLab,
  labs = [],
  onLabChange,
}: {
  page: string;
  mock: boolean;
  resetting: boolean;
  busy?: boolean;
  onReset: () => void;
  activeLab?: string;
  labs?: string[];
  onLabChange?: (address: string) => void;
}) {
  const { t, language, setLanguage } = useI18n();

  return (
    <header className="topbar">
      <div className="breadcrumb">
        <span className="breadcrumb-root">{t("Workspace")}</span>
        <ChevronRight size={13} />
        <span className="breadcrumb-current">{t(page)}</span>
        <span className="version-pill">v4.0 SciExchange</span>
      </div>

      <div className="topbar-nodes" aria-label={t("Network node indicators")}>
        <div
          className={mock ? "node-indicator online" : "node-indicator"}
          title={t(
            mock
              ? "Simulated instrument status"
              : "Instrument connection is not confirmed",
          )}
        >
          {mock && <span className="node-ping" />}
          <span className={mock ? "node-dot" : "node-dot amber"} />
          <span className="node-text">
            <strong>Lab A</strong>
            <small>{t(mock ? "Simulated" : "Status unavailable")}</small>
          </span>
        </div>
        <div className="node-divider" />
        <div
          className={mock ? "node-indicator online" : "node-indicator"}
          title={t(
            mock
              ? "Simulated instrument status"
              : "Instrument connection is not confirmed",
          )}
        >
          {mock && <span className="node-ping" />}
          <span className={mock ? "node-dot" : "node-dot amber"} />
          <span className="node-text">
            <strong>Lab B</strong>
            <small>{t(mock ? "Simulated" : "Status unavailable")}</small>
          </span>
        </div>
        <div className="node-divider" />
        <div
          className="node-indicator active"
          title={t(mock ? "Simulated vault" : "Vault health is not confirmed")}
        >
          <span className="node-dot amber" />
          <span className="node-text">
            <strong>x402 Vault</strong>
            <small>{t(mock ? "Simulated" : "Status unavailable")}</small>
          </span>
        </div>
      </div>

      <div className="topbar-actions">
        {activeLab && (
          <label className="language-picker">
            <span className="sr-only">{t("Active lab")}</span>
            <select
              aria-label={t("Active lab")}
              value={activeLab}
              disabled={busy || resetting}
              onChange={(event) => onLabChange?.(event.target.value)}
            >
              {Array.from(new Set([activeLab, ...labs])).map((lab) => (
                <option key={lab} value={lab}>
                  {lab}
                </option>
              ))}
            </select>
          </label>
        )}
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
          disabled={resetting || busy}
          onClick={onReset}
          title={t(
            mock
              ? "Reset demo scenario"
              : "Clear local session; backend records remain unchanged",
          )}
        >
          <RotateCcw size={13} className={resetting ? "spin" : ""} />
          {t(resetting ? "Resetting…" : mock ? "Reset demo" : "Clear session")}
        </button>
        <span className="profile" title={t("Member C workspace")}>
          {t("AC")}
        </span>
      </div>
    </header>
  );
}
