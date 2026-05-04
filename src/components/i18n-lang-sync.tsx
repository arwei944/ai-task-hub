'use client';

import { useEffect } from 'react';
import { useI18n } from '@/lib/i18n';

export function I18nLangSync() {
  const { locale } = useI18n();

  useEffect(() => {
    document.documentElement.lang = locale === 'en' ? 'en' : 'zh-CN';
  }, [locale]);

  return null;
}
