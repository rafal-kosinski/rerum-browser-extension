import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import pl from './locales/pl.json';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    pl: { translation: pl },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

// Read stored language preference and apply it.
if (typeof browser !== 'undefined' && browser.storage?.local) {
  browser.storage.local.get('language').then((result) => {
    if (result.language && result.language !== i18n.language) {
      i18n.changeLanguage(result.language as string);
    }
  }).catch(() => {});

  // Keep language in sync when changed from another context (e.g. Header menu)
  browser.storage.onChanged?.addListener((changes, area) => {
    if (area === 'local' && changes.language?.newValue) {
      i18n.changeLanguage(changes.language.newValue as string);
    }
  });
}

export default i18n;
