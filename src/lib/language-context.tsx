import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "th" | "en";
export type Localized = { th: string; en: string };

type LanguageContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: (entry: Localized) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = "swing-academy-lang";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("th");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
      if (stored === "th" || stored === "en") setLangState(stored);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  };

  const value: LanguageContextValue = {
    lang,
    setLang,
    toggle: () => setLang(lang === "th" ? "en" : "th"),
    t: (entry) => entry[lang],
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
