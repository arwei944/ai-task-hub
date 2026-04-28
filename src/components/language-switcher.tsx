'use client';

import { useI18n, type Locale } from '@/lib/i18n';

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  const locales: { value: Locale; label: string; flag: string }[] = [
    { value: 'zh', label: '中文', flag: '🇨🇳' },
    { value: 'en', label: 'EN', flag: '🇺🇸' },
  ];

  return (
    <div className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 p-0.5">
      {locales.map(({ value, label, flag }) => (
        <button
          key={value}
          onClick={() => setLocale(value)}
          className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
            locale === value
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
          title={label}
        >
          {flag} {label}
        </button>
      ))}
    </div>
  );
}
