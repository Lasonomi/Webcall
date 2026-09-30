import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { TopNav } from '@/components/layout/TopNav'
import { BottomTicker } from '@/components/layout/BottomTicker'
import { HomeView } from '@/pages/HomeView'
import { ServerViewPage } from '@/pages/ServerView'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { api } from '@/services/api'

type Tab = 'home' | 'server' | 'settings'

export default function AppShell() {
  const { user, loading, restore, logout } = useAuth()
  const [tab, setTab] = useState<Tab>('home')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [picker, setPicker] = useState(false)
  const [createName, setCreateName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [theme, setTheme] = useState(localStorage.getItem('wc_theme') || 'dark')

  useEffect(() => {
    restore()
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
    document.documentElement.classList.toggle('dark', theme !== 'light')
    localStorage.setItem('wc_theme', theme)
  }, [theme])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-muted">
        Loading…
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />

  const onNav = (t: Tab) => {
    if (t === 'settings') {
      setSettingsOpen(true)
      return
    }
    setTab(t)
    if (t === 'server') {
      // server page handles empty state
    }
  }

  return (
    <div className="grid h-full grid-rows-[52px_1fr_32px] overflow-hidden bg-background">
      <TopNav active={settingsOpen ? 'settings' : tab} onChange={onNav} />

      <div className="min-h-0 overflow-hidden">
        <AnimatePresence mode="wait">
          {tab === 'home' ? (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full"
            >
              <HomeView onOpenSettings={() => setSettingsOpen(true)} />
            </motion.div>
          ) : (
            <motion.div
              key="server"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full"
            >
              <ServerViewPage onNeedPicker={() => setPicker(true)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BottomTicker items={[]} />

      {/* Settings */}
      <AnimatePresence>
        {settingsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setSettingsOpen(false)}
          >
            <motion.div
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="grid max-h-[86vh] w-full max-w-[860px] grid-cols-[200px_1fr] overflow-hidden rounded-2xl border border-border bg-surface"
            >
              <aside className="flex flex-col gap-1 border-r border-border bg-background p-3">
                <p className="px-2 py-2 text-[10px] font-semibold tracking-[0.16em] text-gold">SETTINGS</p>
                <p className="rounded-lg bg-maroon/20 px-3 py-2 text-[13px]">My Account</p>
                <p className="px-3 py-2 text-[13px] text-muted">Appearance</p>
                <button
                  type="button"
                  className="mt-auto rounded-lg px-3 py-2 text-left text-[13px] text-red-400 hover:bg-red-500/10"
                  onClick={() => {
                    logout()
                    setSettingsOpen(false)
                  }}
                >
                  Log out
                </button>
              </aside>
              <div className="overflow-y-auto p-6">
                <h2 className="text-xl font-semibold">My Account</h2>
                <p className="mt-1 text-sm text-muted">Signed in as @{user.username}</p>
                <div className="mt-4 rounded-xl border border-border bg-surface-2 p-4">
                  <p className="font-medium">{user.display_name}</p>
                  <p className="text-sm text-muted">{user.email || 'No email'}</p>
                </div>
                <h3 className="mt-6 text-sm font-semibold">Appearance</h3>
                <div className="mt-2 flex gap-2">
                  {(['dark', 'light'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTheme(t)}
                      className={`rounded-full border px-4 py-1.5 text-xs font-semibold capitalize ${
                        theme === t ? 'border-gold bg-maroon/20 text-white' : 'border-border text-muted'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Server picker */}
      <AnimatePresence>
        {picker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setPicker(false)}
          >
            <motion.div
              initial={{ scale: 0.96 }}
              animate={{ scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-surface p-6"
            >
              <h2 className="text-lg font-semibold">Servers</h2>
              <div className="space-y-2">
                <Input placeholder="Server name" value={createName} onChange={(e) => setCreateName(e.target.value)} />
                <Button
                  className="w-full"
                  onClick={async () => {
                    await api.createServer({ name: createName })
                    setCreateName('')
                    setPicker(false)
                    setTab('server')
                  }}
                >
                  Create Server
                </Button>
              </div>
              <div className="space-y-2">
                <Input placeholder="Invite code" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} />
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={async () => {
                    await api.joinByInvite(joinCode)
                    setJoinCode('')
                    setPicker(false)
                    setTab('server')
                  }}
                >
                  Join Server
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
