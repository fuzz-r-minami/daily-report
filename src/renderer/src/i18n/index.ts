import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ja from './locales/ja.json'
import en from './locales/en.json'
import zhCN from './locales/zh-CN.json'
import zhTW from './locales/zh-TW.json'
import ko from './locales/ko.json'
import type { AppLanguage } from '@shared/types/settings.types'

export const LANGUAGES: { code: AppLanguage; label: string; nativeLabel: string }[] = [
  { code: 'ja',    label: 'Japanese',            nativeLabel: '日本語'   },
  { code: 'en',    label: 'English',             nativeLabel: 'English'  },
  { code: 'zh-CN', label: 'Chinese (Simplified)', nativeLabel: '简体中文' },
  { code: 'zh-TW', label: 'Chinese (Traditional)', nativeLabel: '繁體中文' },
  { code: 'ko',    label: 'Korean',              nativeLabel: '한국어'   },
]

i18n
  .use(initReactI18next)
  .init({
    resources: {
      ja:    { translation: ja    },
      en:    { translation: en    },
      'zh-CN': { translation: zhCN  },
      'zh-TW': { translation: zhTW  },
      ko:    { translation: ko    },
    },
    lng: 'ja',
    fallbackLng: 'ja',
    interpolation: { escapeValue: false },
  })

export function setLanguage(lang: AppLanguage): void {
  i18n.changeLanguage(lang)
}

export default i18n
