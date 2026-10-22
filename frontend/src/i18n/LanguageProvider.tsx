import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { zh } from "./zh";
export type Language = "en" | "zh";
export const LANGUAGE_STORAGE_KEY = "sciexchange.language";
function readLanguage(): Language {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY) === "zh" ? "zh" : "en";
  } catch {
    return "en";
  }
}
export function translate<T>(value: T, language: Language): T {
  if (language === "en" || typeof value !== "string") return value;
  if (Object.hasOwn(zh, value)) return zh[value] as T;
  // Full-sentence dynamic labels; do not replace substrings inside IDs or records.
  const inspect = value.match(/^Inspect (.+)$/);
  if (inspect) return `查看${translate(inspect[1], language)}` as T;
  const cycle = value.match(/^Simulated cycle (\d+)$/);
  if (cycle) return `模拟第 ${cycle[1]} 次循环` as T;
  const count = value.match(/^(\d+) slices$/);
  if (count) return `${count[1]} 个切片` as T;
  if (value.startsWith("Authorization was not confirmed. Backend status: "))
    return value.replace(
      "Authorization was not confirmed. Backend status: ",
      "授权未获确认。后端状态：",
    ) as T;
  return value;
}
interface LanguageContextValue {
  language: Language;
  setLanguage: (value: Language) => void;
}
const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined,
);
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(readLanguage);
  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    document.title =
      language === "zh"
        ? "SciExchange — 科研工作区"
        : "SciExchange — Scientific Workspace";
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      /* A blocked storage area does not prevent switching languages. */
    }
  }, [language]);
  const value = useMemo(() => ({ language, setLanguage }), [language]);
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
export function useI18n() {
  const context = useContext(LanguageContext);
  const language = context?.language ?? "en";
  const t = useCallback(
    <T,>(value: T): T => translate(value, language),
    [language],
  );
  return { language, setLanguage: context?.setLanguage, t };
}
