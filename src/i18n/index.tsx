import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { type Locale, messages } from "./messages";

const STORAGE_KEY = "cliply.locale";

function detect(): Locale {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "en" || saved === "es") return saved;
  return navigator.language?.toLowerCase().startsWith("es") ? "es" : "en";
}

type Vars = Record<string, string | number>;

interface I18n {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Vars) => string;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLoc] = useState<Locale>(detect);

  const setLocale = useCallback((l: Locale) => {
    localStorage.setItem(STORAGE_KEY, l);
    setLoc(l);
  }, []);

  const t = useCallback(
    (key: string, vars?: Vars) => {
      const s = messages[locale][key] ?? messages.en[key] ?? key;
      return vars
        ? s.replace(/\{(\w+)\}/g, (_, n) => String(vars[n] ?? ""))
        : s;
    },
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useT(): I18n {
  const c = useContext(Ctx);
  if (!c) throw new Error("useT must be used within I18nProvider");
  return c;
}
