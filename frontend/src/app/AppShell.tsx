import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useAuth } from '@/hooks/useAuth'
import { TopNav, type NavTab } from '@/components/layout/TopNav'
import { BottomTicker } from '@/components/layout/BottomTicker'
import { HomeView } from '@/features/home/HomeView'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { ServerViewPage } from '@/features/server/ServerView'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { api } from '@/services/api'
import { useSettings } from '@/features/settings/settings.store'

export default function AppShell({ page }: { page: 'home' | 'server' | 'settings' }) {
  const { user, loading, restore } = useAuth()
  const nav = useNavigate()
  const showTicker = useSettings((s) => s.bottomTicker)
  const [picker, setPicker] = useState(false)
  const [createName, setCreateName] = useState('')
  const [joinCode, setJoinCode] = useState('')

  useEffect(() => {
    restore()
  }, [restore])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-muted">
        Loading…
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />

  const activeTab: NavTab =
    page === 'server' ? 'server' : page === 'settings' ? 'settings' : 'home'

  const onNav = (t: NavTab) => {
    if (t === 'home') nav('/home')
    else if (t === 'server') nav('/server')
    else nav('/settings')
  }

  return (
    <div className={showTicker ? 'grid h-full grid-rows-[52px_1fr_32px] overflow-hidden bg-background' : 'grid h-full grid-rows-[52px_1fr] overflow-hidden bg-background'}>
      <TopNav active={activeTab} onChange={onNav} />

      <div className="min-h-0 overflow-hidden">
        <AnimatePresence mode="wait">
          {page === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full"
            >
              <HomeView />
            </motion.div>
          )}
          {page === 'server' && (
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
          {page === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full"
            >
              <SettingsPage />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {showTicker && <BottomTicker />}

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
              <Input
                placeholder="Server name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
              />
              <Button
                className="w-full"
                onClick={async () => {
                  await api.createServer({ name: createName })
                  setCreateName('')
                  setPicker(false)
                  nav('/server')
                }}
              >
                Create Server
              </Button>
              <Input
                placeholder="Invite code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
              />
              <Button
                variant="secondary"
                className="w-full"
                onClick={async () => {
                  await api.joinByInvite(joinCode)
                  setJoinCode('')
                  setPicker(false)
                  nav('/server')
                }}
              >
                Join Server
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
