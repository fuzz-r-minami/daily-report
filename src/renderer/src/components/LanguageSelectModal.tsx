import { LANGUAGES, setLanguage } from '../i18n'
import type { AppLanguage } from '@shared/types/settings.types'

interface Props {
  onSelect: (lang: AppLanguage) => void
}

export function LanguageSelectModal({ onSelect }: Props): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="bg-card border border-border rounded-xl shadow-xl p-8 w-80 space-y-6">
        <div className="text-center space-y-1">
          <p className="text-2xl">🌐</p>
          <p className="text-base font-semibold text-foreground">
            言語を選択 / Select Language
          </p>
        </div>
        <div className="space-y-2">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                setLanguage(lang.code)
                onSelect(lang.code)
              }}
              className="w-full px-4 py-3 rounded-lg border border-border text-sm font-medium hover:bg-accent hover:border-primary transition-colors text-left flex items-center justify-between"
            >
              <span>{lang.nativeLabel}</span>
              <span className="text-xs text-muted-foreground">{lang.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
