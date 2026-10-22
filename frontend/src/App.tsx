import { Component, type ReactNode } from "react";
import { Dashboard } from "./pages/Dashboard";
import { LanguageProvider, useI18n } from "./i18n/LanguageProvider";
function RenderError() {
  const { t } = useI18n();
  return (
    <main className="fatal-error">
      <h1>{t("The workspace could not render.")}</h1>
      <p>
        {t(
          "Reload to restart. If the issue persists, check the frontend configuration.",
        )}
      </p>
      <button className="button" onClick={() => location.reload()}>
        {t("Reload workspace")}
      </button>
    </main>
  );
}
class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <RenderError /> : this.props.children;
  }
}
export default function App() {
  return (
    <LanguageProvider>
      <ErrorBoundary>
        <Dashboard />
      </ErrorBoundary>
    </LanguageProvider>
  );
}
