// Lazy translation loader.
// Only Dutch (default) is bundled eagerly; other languages are dynamically
// imported on first use to keep the initial JS payload small.
import { nl } from "./translations/nl";

export type TranslationKey = keyof typeof nl;
export type LangCode = "nl" | "en" | "de" | "fr" | "es" | "tr" | "ar" | "hy";

type Dict = Record<string, string>;

const loaders: Record<LangCode, () => Promise<Dict>> = {
  nl: async () => nl as unknown as Dict,
  en: () => import("./translations/en").then(m => m.en as unknown as Dict),
  de: () => import("./translations/de").then(m => m.de as unknown as Dict),
  fr: () => import("./translations/fr").then(m => m.fr as unknown as Dict),
  es: () => import("./translations/es").then(m => m.es as unknown as Dict),
  tr: () => import("./translations/tr").then(m => m.tr as unknown as Dict),
  ar: () => import("./translations/ar").then(m => m.ar as unknown as Dict),
  hy: () => import("./translations/hy").then(m => m.hy as unknown as Dict),
};

const cache: Partial<Record<LangCode, Dict>> = { nl: nl as unknown as Dict };

export const loadLang = async (lang: LangCode): Promise<Dict> => {
  if (cache[lang]) return cache[lang]!;
  const dict = await loaders[lang]();
  cache[lang] = dict;
  return dict;
};

export const getCachedLang = (lang: LangCode): Dict | undefined => cache[lang];

// Back-compat: a `translations` object that always exposes NL (so any
// legacy synchronous lookups keep working) and lazy-loaded other langs.
export const translations: Record<LangCode, Dict> = new Proxy({} as Record<LangCode, Dict>, {
  get(_t, key: string) {
    const lang = key as LangCode;
    if (cache[lang]) return cache[lang];
    // Trigger background load; return NL as fallback in the meantime.
    if (loaders[lang]) void loadLang(lang);
    return cache.nl;
  },
});
