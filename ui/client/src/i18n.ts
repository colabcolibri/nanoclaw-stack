import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import commonPt from './locales/pt/common.json'
import commonEn from './locales/en/common.json'
import chatPt from './locales/pt/chat.json'
import chatEn from './locales/en/chat.json'
import soulPt from './locales/pt/soul.json'
import soulEn from './locales/en/soul.json'
import analyticsPt from './locales/pt/analytics.json'
import analyticsEn from './locales/en/analytics.json'
import configPt from './locales/pt/config.json'
import configEn from './locales/en/config.json'

const resources = {
  pt: {
    common: commonPt,
    chat: chatPt,
    soul: soulPt,
    analytics: analyticsPt,
    config: configPt,
  },
  en: {
    common: commonEn,
    chat: chatEn,
    soul: soulEn,
    analytics: analyticsEn,
    config: configEn,
  },
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'pt',
    defaultNS: 'common',
    ns: ['common', 'chat', 'soul', 'analytics', 'config'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'nanoclaw_i18n_lng',
    },
  })

export default i18n
