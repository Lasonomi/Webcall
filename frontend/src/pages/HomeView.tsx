import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Phone, Video, MoreHorizontal } from 'lucide-react'
import { api } from '@/services/api'
import { useAuth } from '@/hooks/useAuth'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn, initials } from '@/lib/utils'

type Conv = {
  id: string
  name?: string
  type?: string
  unread_count?: number
  peer?: { id: string; display_name?: string; username?: string; avatar_url?: string; online?: boolean }
}

type Msg = {
  id: string
  content: string
  sender_id: string
  is_mine?: boolean
  created_at?: string
  display_name?: string
}

export function HomeView({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { user } = useAuth()
  const [tab, setTab] = useState<'friends' | 'requests'>('friends')
  const [conversations, setConversations] = useState<Conv[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [friends, setFriends] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])

  const active = conversations.find((c) => c.id === activeId)

  const load = async () => {
    try {
      const [c, f, r] = await Promise.all([api.listConversations(), api.friends(), api.requests()])
      setConversations(c.conversations || c || [])
      setFriends(f.friends || f || [])
      setRequests(r.requests || r || [])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (!activeId) {
      setMessages([])
      return
    }
    api.listDMMessages(activeId).then((d) => setMessages(d.messages || [])).catch(console.error)
  }, [activeId])

  const send = async () => {
    const text = input.trim()
    if (!text || !activeId) return
    setSending(true)
    try {
      await api.sendDMMessage(activeId, { content: text })
      setInput('')
      const d = await api.listDMMessages(activeId)
      setMessages(d.messages || [])
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSending(false)
    }
  }

  const search = async () => {
    if (!query.trim()) return
    const d = await api.searchUsers(query.trim())
    setResults(d.users || [])
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[260px_1fr] overflow-hidden">
      {/* Left sidebar */}
      <aside className="flex min-h-0 flex-col border-r border-border bg-surface">
        <div className="space-y-1.5 border-b border-border p-3">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex h-9 w-full items-center gap-2 rounded-full border border-border bg-background px-3.5 text-xs text-muted transition hover:border-maroon hover:text-foreground"
          >
            <Search className="h-3.5 w-3.5" />
            Search conversation
          </button>
          <button
            type="button"
            onClick={() => setTab('requests')}
            className={cn(
              'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition',
              tab === 'requests' ? 'bg-maroon/20 text-white' : 'text-foreground hover:bg-white/5'
            )}
          >
            Message Request
            {requests.length > 0 && (
              <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-maroon px-1.5 text-[10px] font-bold">
                {requests.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab('friends')}
            className={cn(
              'flex w-full rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition',
              tab === 'friends' ? 'bg-maroon/20 text-white' : 'text-foreground hover:bg-white/5'
            )}
          >
            Friend list
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col py-3 pl-7 pr-2">
          <span className="pointer-events-none absolute left-1.5 top-1/2 origin-center -translate-y-1/2 -rotate-90 text-[10px] uppercase tracking-[0.18em] text-muted">
            History chat
          </span>
          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
            {conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveId(c.id)}
                className={cn(
                  'flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition',
                  activeId === c.id
                    ? 'bg-maroon/15 shadow-[inset_2px_0_0_var(--wc-gold)]'
                    : 'hover:bg-white/5'
                )}
              >
                <Avatar
                  size="sm"
                  name={c.peer?.display_name || c.peer?.username || c.name}
                  src={c.peer?.avatar_url}
                />
                <span className="min-w-0 flex-1 truncate text-[13px]">
                  {c.type === 'group' ? c.name || 'Group' : c.peer?.display_name || c.peer?.username || 'Unknown'}
                </span>
                {!!c.unread_count && (
                  <span className="rounded-full bg-maroon px-1.5 text-[10px] font-bold">{c.unread_count}</span>
                )}
              </button>
            ))}
            {!conversations.length && <p className="px-2 py-4 text-xs text-muted">No conversations yet</p>}
          </div>
        </div>
      </aside>

      {/* Dialog area */}
      <main className="flex min-h-0 min-w-0 flex-col bg-background">
        {active ? (
          <>
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
              <div className="flex items-center gap-3">
                <Avatar name={active.peer?.display_name || active.peer?.username} src={active.peer?.avatar_url} />
                <div>
                  <p className="text-sm font-semibold">{active.peer?.display_name || active.name || 'Conversation'}</p>
                  <p className="text-[11px] text-muted">
                    {active.peer?.online ? 'Online' : 'Offline'}
                    {active.peer?.username ? ` · @${active.peer.username}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" className="rounded-full border border-border px-3.5 py-1.5 text-xs transition hover:border-gold hover:bg-gold/10">
                  <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> call</span>
                </button>
                <button type="button" className="rounded-full border border-border px-3.5 py-1.5 text-xs transition hover:border-gold hover:bg-gold/10">
                  <span className="flex items-center gap-1.5"><Video className="h-3.5 w-3.5" /> videocall</span>
                </button>
                <button type="button" className="rounded-full border border-border p-2 text-muted hover:text-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
              {messages.map((m) => {
                const mine = m.is_mine || m.sender_id === user?.id
                return (
                  <div key={m.id} className={cn('flex gap-2', mine && 'justify-end')}>
                    {!mine && <Avatar size="sm" name={m.display_name || active.peer?.display_name} />}
                    <div
                      className={cn(
                        'max-w-[70%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
                        mine ? 'bg-maroon/30 text-white' : 'bg-surface text-foreground'
                      )}
                    >
                      {m.content}
                    </div>
                  </div>
                )
              })}
              {!messages.length && (
                <div className="flex flex-1 items-center justify-center text-sm text-muted">No messages yet. Say hello.</div>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2 border-t border-border p-3">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="Message…"
                className="flex-1"
              />
              <Button disabled={sending || !input.trim()} onClick={send}>
                Send
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-gold">WEBCALL</p>
            <h1 className="text-4xl font-semibold tracking-tight">Home</h1>
            <p className="max-w-sm text-sm text-muted">
              Select a conversation, open message requests, or start something new.
            </p>
            <div className="mt-2 flex gap-2">
              <Button onClick={() => setSearchOpen(true)}>Start conversation</Button>
              <Button variant="secondary" onClick={() => setTab('friends')}>
                Friend list ({friends.length})
              </Button>
              <Button variant="ghost" onClick={onOpenSettings}>
                Settings
              </Button>
            </div>
            {tab === 'requests' && (
              <div className="mt-6 w-full max-w-md space-y-2 text-left">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Pending — {requests.length}</p>
                {requests.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 rounded-xl border border-border bg-surface p-3">
                    <Avatar name={r.display_name || r.username} src={r.avatar_url} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{r.display_name}</p>
                      <p className="text-xs text-muted">@{r.username}</p>
                    </div>
                  </div>
                ))}
                {!requests.length && <p className="text-sm text-muted">No pending requests.</p>}
              </div>
            )}
          </div>
        )}
      </main>

      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setSearchOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-border bg-surface p-5"
            >
              <h2 className="text-lg font-semibold">Find people</h2>
              <div className="mt-3 flex gap-2">
                <Input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="Username…" />
                <Button onClick={search}>Search</Button>
              </div>
              <div className="mt-3 max-h-60 space-y-1 overflow-y-auto">
                {results.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg p-2 hover:bg-surface-2"
                    onClick={async () => {
                      const d = await api.createConversation(u.id)
                      setSearchOpen(false)
                      await load()
                      setActiveId(d.conversation?.id)
                    }}
                  >
                    <Avatar name={u.display_name || u.username} src={u.avatar_url} />
                    <span className="text-sm">{u.display_name || u.username}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
