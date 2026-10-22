import { useI18n } from "../i18n/LanguageProvider";
import { AlertCircle, ArrowUpRight, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const { t } = useI18n();

  return (
    <span className={`badge ${tone}`}>
      <span className="badge-dot" />
      {t(children)}
    </span>
  );
}
export function Panel({
  title,
  eyebrow,
  children,
  action,
  className = "",
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const { t } = useI18n();

  return (
    <section className={`panel ${className}`}>
      <header className="panel-heading">
        <div>
          {eyebrow && <p className="eyebrow">{t(eyebrow)}</p>}
          <h2>{t(title)}</h2>
        </div>
        {t(action)}
      </header>
      {t(children)}
    </section>
  );
}
export function ErrorNotice({
  error,
  retry,
}: {
  error: string;
  retry?: () => void;
}) {
  const { t } = useI18n();

  return (
    <div role="alert" className="notice danger">
      <AlertCircle size={16} />
      <div>
        {t(error)}
        {retry && (
          <button className="text-button" onClick={retry}>
            {t("Retry request")}
            <ArrowUpRight size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
export function Loading({ text = "Loading records…" }: { text?: string }) {
  const { t } = useI18n();

  return (
    <div className="loading" role="status">
      <Loader2 className="spin" size={16} />
      {t(text)}
    </div>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  const { t } = useI18n();

  return <div className="empty">{t(children)}</div>;
}
export function errorText(error: unknown) {
  return error instanceof Error
    ? error.message
    : "An unexpected error occurred. Please retry.";
}
