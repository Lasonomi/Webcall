import { type ComponentType } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Accessibility, ArrowLeft, Bell, LogOut, MessageSquare, Mic, Palette, Shield, User, Wrench, type LucideIcon } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { AccountSection } from './sections/AccountSection'
import { PrivacySection } from './sections/PrivacySection'
import { AppearanceSection } from './sections/AppearanceSection'
import { NotificationsSection } from './sections/NotificationsSection'
import { VoiceVideoSection } from './sections/VoiceVideoSection'
import { ChatSection } from './sections/ChatSection'
import { AccessibilitySection } from './sections/AccessibilitySection'
import { AdvancedSection } from './sections/AdvancedSection'

const TABS: { id: string; label: string; icon: LucideIcon; Component: ComponentType }[] = [
  { id: 'account', label: 'My Account', icon: User, Component: AccountSection },
  { id: 'privacy', label: 'Privacy & Safety', icon: Shield, Component: PrivacySection },
  { id: 'appearance', label: 'Appearance', icon: Palette, Component: AppearanceSection },
  { id: 'notifications', label: 'Notifications', icon: Bell, Component: NotificationsSection },
  { id: 'voice', label: 'Voice & Video', icon: Mic, Component: VoiceVideoSection },
  { id: 'chat', label: 'Chat', icon: MessageSquare, Component: ChatSection },
  { id: 'accessibility', label: 'Accessibility', icon: Accessibility, Component: AccessibilitySection },
  { id: 'advanced', label: 'Advanced', icon: Wrench, Component: AdvancedSection },
]

export function SettingsPage() {
  const nav = useNavigate()
  const logout = useAuth((s) => s.logout)
  const [params, setParams] = useSearchParams()
  const active = TABS.find((t) => t.id === params.get('tab')) ?? TABS[0]
  const Active = active.Component

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center border-b border-border px-4 py-2">
        <button
          type="button"
          onClick={() => nav('/home')}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted transition hover:bg-surface-2 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to WebCall
        </button>
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col md:grid md:grid-cols-[230px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="flex shrink-0 gap-1 overflow-x-auto border-b border-border p-2 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r md:p-3">
          <p className="hidden px-2 py-2 text-[10px] font-semibold tracking-[0.16em] text-gold md:block">SETTINGS</p>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={active.id === id ? 'page' : undefined}
              onClick={() => setParams({ tab: id }, { replace: true })}
              className={cn(
                'flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-left text-[13px] transition',
                active.id === id ? 'bg-maroon/25 text-foreground' : 'text-muted hover:bg-surface-2 hover:text-foreground'
              )}
            >
              <Icon className={cn('h-4 w-4', active.id === id && 'text-gold')} /> {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { logout(); nav('/login') }}
            className="flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-red-400 transition hover:bg-red-500/10 md:mt-auto"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </nav>

        <main className="min-h-0 overflow-y-auto p-5 md:p-8">
          <div className="mx-auto max-w-2xl pb-10">
            <Active key={active.id} />
          </div>
        </main>
      </div>
    </div>
  )
}
