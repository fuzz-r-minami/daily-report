import { NavLink } from 'react-router-dom'
import { cn } from '../../lib/utils'

const navItems = [
  { to: '/dashboard', label: 'ダッシュボード', icon: '📊' },
  { to: '/projects', label: 'プロジェクト', icon: '📁' },
  { to: '/templates', label: 'テンプレート', icon: '📝' },
  { to: '/settings', label: '設定', icon: '⚙️' }
]

export function Sidebar(): JSX.Element {
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
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-border">
        <p className="text-xs text-muted-foreground">v1.0.0</p>
      </div>
    </aside>
  )
}
