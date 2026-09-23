import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ReactNativeLanguageDetect from 'i18next-react-native-language-detector';

import en from './locales/en.json';
import ne from './locales/ne.json';

i18n
  .use(ReactNativeLanguageDetect)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
    resources: {
      en: { common: en },
      ne: { common: ne },
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
