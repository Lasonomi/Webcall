import { cn } from '@/lib/utils'
import { Bell } from 'lucide-react'
import { motion } from 'motion/react'

export type NavTab = 'home' | 'server' | 'settings'

export function TopNav({
  active,
  onChange,
  unread = 0,
}: {
  active: NavTab
  onChange: (t: NavTab) => void
  unread?: number
}) {
  const items: { id: NavTab; label: string }[] = [
    { id: 'home', label: 'HOME' },
    { id: 'server', label: 'SERVER' },
    { id: 'settings', label: 'Settings' },
  ]
  return (
    <header className="relative flex h-[52px] items-center justify-center border-b border-border bg-surface px-4">
      <nav className="flex items-center gap-1.5 rounded-full border border-border/80 bg-background/40 p-1">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              'relative min-w-[96px] rounded-full px-5 py-1.5 text-xs font-semibold tracking-widest transition-colors',
              active === item.id ? 'text-white' : 'text-muted hover:text-foreground'
            )}
          >
            {active === item.id && (
              <motion.span
                layoutId="topnav-pill"
                className="absolute inset-0 rounded-full border border-border bg-maroon/25 shadow-[0_0_0_1px_rgba(212,175,55,0.2)]"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">{item.label}</span>
          </button>
        ))}
      </nav>
      <button
        type="button"
        className="absolute right-4 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-foreground"
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-maroon px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>
    </header>
  )
}
