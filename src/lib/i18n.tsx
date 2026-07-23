import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { nl } from "./translations/nl";
import { en } from "./translations/en";
import { loadLang, getCachedLang, type TranslationKey, type LangCode } from "./translations";

type Lang = LangCode;

interface I18nContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);
const LANG_STORAGE_KEY = "uprising-lang";

const isSupportedLang = (value: string): value is Lang =>
  ["nl", "en", "de", "fr", "es", "tr", "ar", "hy"].includes(value);

const getInitialLang = (): Lang => {
  const stored = typeof window !== "undefined" ? window.localStorage.getItem(LANG_STORAGE_KEY) : null;
  if (stored && isSupportedLang(stored)) return stored;
  return "nl";
};

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(getInitialLang);
  const [, force] = useState(0);

  // Ensure non-NL language is loaded on mount / change
  useEffect(() => {
    if (lang === "nl") return;
    let cancelled = false;
    loadLang(lang).then(() => { if (!cancelled) force(n => n + 1); });
    return () => { cancelled = true; };
  }, [lang]);

  const setLang = useCallback((nextLang: Lang) => {
    setLangState(nextLang);
    window.localStorage.setItem(LANG_STORAGE_KEY, nextLang);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const t = useCallback((key: TranslationKey) => {
    const dict = getCachedLang(lang) || nl;
    // Fallback chain: current language → English (a complete translation and
    // the best universal fallback) → Dutch (source) → the key itself. This
    // keeps every language fully usable and never surfaces a raw key.
    return (dict as Record<string, string>)[key]
      || (en as Record<string, string>)[key]
      || (nl as Record<string, string>)[key]
      || key;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
};

const fallbackI18n: I18nContextType = {
  lang: "nl",
  setLang: () => {},
  t: (key: TranslationKey) => (nl as Record<string, string>)[key] || key,
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  return ctx || fallbackI18n;
};

export type { TranslationKey, Lang };
