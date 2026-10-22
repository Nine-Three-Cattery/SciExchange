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
        {t("Workspace")}
        <ChevronRight size={13} />
        <span>{t(page)}</span>
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
        <button className="text-button" disabled={resetting} onClick={onReset}>
          <RotateCcw size={14} className={resetting ? "spin" : ""} />
          {t(resetting ? "Resetting…" : "Reset demo")}
        </button>
        <span className="profile" title={t("Member C workspace")}>
          {t("AC")}
        </span>
      </div>
    </header>
  );
}
