'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

export type Locale = 'zh' | 'en';

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'zh',
  setLocale: () => {},
  t: (key) => key,
});

export function useI18n() {
  return useContext(I18nContext);
}

// Lazy-loaded locale data
let zhData: Record<string, string> | null = null;
let enData: Record<string, string> | null = null;

async function loadLocale(locale: Locale): Promise<Record<string, string>> {
  if (locale === 'zh' && zhData) return zhData;
  if (locale === 'en' && enData) return enData;

  const data = await import(`./locales/${locale}.ts`);
  const messages = data.default;

  if (locale === 'zh') zhData = messages;
  else enData = messages;

  return messages;
}

export function I18nProvider({ children, defaultLocale = 'zh' }: { children: ReactNode; defaultLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [messages, setMessages] = useState<Record<string, string>>({});

  // Load locale on mount and on change
  useEffect(() => {
    loadLocale(locale).then(setMessages);
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('locale', locale);
    }
  }, [locale]);

  // Read saved locale on mount
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('locale') as Locale : null;
    if (saved && (saved === 'zh' || saved === 'en')) {
      setLocaleState(saved);
    }
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
  }, []);

  const t = useCallback((key: string, vars?: Record<string, string | number>): string => {
    let text = messages[key] ?? key;

    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }

    return text;
  }, [messages]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}
