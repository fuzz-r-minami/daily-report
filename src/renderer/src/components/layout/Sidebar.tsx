import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/utils'
import { useAppStore } from '../../store/app.store'
import { APP_VERSION } from '@shared/constants'

export function Sidebar(): JSX.Element {
  const { t } = useTranslation()
  const { isGenerating, isAllocating } = useAppStore()
  const isBusy = isGenerating || isAllocating

  const navItems = [
    { to: '/dashboard', label: t('sidebar.dashboard'), icon: '📊' },
    { to: '/projects', label: t('sidebar.projects'), icon: '📁' },
    { to: '/templates', label: t('sidebar.templates'), icon: '📝' },
    { to: '/settings', label: t('sidebar.settings'), icon: '⚙️' }
  ]

  return (
    <aside className="w-52 shrink-0 border-r border-border bg-secondary/30 flex flex-col">
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )
            }
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
            {item.to === '/dashboard' && isBusy && (
              <span className="ml-auto w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            )}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-border space-y-2">
        <a
          href="https://feedbackme.ai/drepo"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <span>💬</span>
          <span>{t('sidebar.feedback')}</span>
        </a>
        <p className="text-xs text-muted-foreground px-3">v{APP_VERSION}</p>
      </div>
    </aside>
  )
}
