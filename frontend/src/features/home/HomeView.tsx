import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { Search, Phone, Video, MoreHorizontal, Paperclip } from 'lucide-react'
import { api } from '@/services/api'
import { useAuth } from '@/hooks/useAuth'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import { UserProfileCard } from '@/features/profile/UserProfileCard'
import { rtcService } from '@/features/rtc/rtc.service'
import type { Conversation, Message } from '@/types'
import { useSettings } from '@/features/settings/settings.store'

const MAX_FILE = 15 * 1024 * 1024

export function HomeView() {
  const { user } = useAuth()
  const [section, setSection] = useState<'friends' | 'requests'>('friends')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [friends, setFriends] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const enterToSend = useSettings((s) => s.enterToSend)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [attach, setAttach] = useState<{ url: string; type?: string; filename?: string } | null>(null)
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [profileUserId, setProfileUserId] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const searchTimer = useRef<number | null>(null)

  const active = useMemo(() => conversations.find((c) => c.id === activeId) || null, [conversations, activeId])

  const loadSidebar = useCallback(async () => {
    try {
      const [c, f, r] = await Promise.all([api.listConversations(), api.friends(), api.requests()])
      setConversations(c.conversations || [])
      setFriends(f.friends || [])
      setRequests(r.requests || [])
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    loadSidebar()
  }, [loadSidebar])

  useEffect(() => {
    if (!activeId) {
      setMessages([])
      return
    }
    api.listDMMessages(activeId, { limit: 50 }).then((d) => setMessages(d.messages || [])).catch(console.error)
  }, [activeId])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, activeId])

  useEffect(() => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current)
    if (!searchQ.trim()) {
      setSearchResults([])
      return
    }
    searchTimer.current = window.setTimeout(async () => {
      setSearching(true)
      try {
        const d = await api.searchUsers(searchQ.trim())
        setSearchResults((d.users || []).filter((u: any) => u.id !== user?.id))
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current)
    }
  }, [searchQ, user?.id])

  const openDMWith = async (userId: string) => {
    const d = await api.createConversation(userId)
    const id = d.conversation?.id
    await loadSidebar()
    setActiveId(id)
    setSearchQ('')
    setSearchResults([])
    setProfileUserId(null)
  }

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_FILE) {
      alert('File terlalu besar (maks 15MB)')
      return
    }
    setUploading(true)
    try {
      const up = await api.uploadFile(file)
      setAttach({ url: up.url, type: up.type || up.mime || file.type, filename: up.filename || file.name })
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Upload gagal')
    } finally {
      setUploading(false)
    }
  }

  const absUrl = (u?: string) => {
    if (!u) return ''
    if (u.startsWith('http')) return u
    return `${api.url}${u}`
  }

  const isImage = (t?: string, url?: string) => {
    const s = (t || '').toLowerCase()
    return s.startsWith('image') || s === 'image' || /\.(png|jpe?g|gif|webp)$/i.test(url || '')
  }

  const send = async () => {
    const text = input.trim()
    if ((!text && !attach) || !activeId) return
    setSending(true)
    try {
      await api.sendDMMessage(activeId, {
        content: text || (attach ? '' : ''),
        attachment_url: attach?.url || '',
        attachment_type: attach?.type || '',
        client_message_id: crypto.randomUUID?.() || `c_${Date.now()}`,
      })
      setInput('')
      setAttach(null)
      const d = await api.listDMMessages(activeId, { limit: 50 })
      setMessages(d.messages || [])
      loadSidebar()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Send failed')
    } finally {
      setSending(false)
    }
  }

  const linkify = (text: string) => {
    const parts = text.split(/(https?:\/\/[^\s]+)/g)
    return parts.map((part, i) =>
      /^https?:\/\//.test(part) ? (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-gold underline break-all">
          {part}
        </a>
      ) : (
        <span key={i}>{part}</span>
      )
    )
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[280px_1fr] overflow-hidden">
      <aside className="flex min-h-0 flex-col border-r border-border bg-surface">
        <div className="space-y-2 border-b border-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search conversation"
              className="h-9 w-full rounded-full border border-border bg-background pl-9 pr-3 text-xs outline-none focus:border-maroon"
            />
          </div>
          {searchQ.trim() && (
            <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-background p-1">
              {searching && <p className="px-2 py-1 text-xs text-muted">Searching…</p>}
              {searchResults.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-surface-2"
                  onClick={() => openDMWith(u.id)}
                >
                  <Avatar size="sm" name={u.display_name || u.username} src={u.avatar_url} onClick={() => setProfileUserId(u.id)} />
                  <span className="truncate text-xs">{u.display_name || u.username}</span>
                </button>
              ))}
              {!searching && !searchResults.length && <p className="px-2 py-1 text-xs text-muted">No users found</p>}
            </div>
          )}
          <button
            type="button"
            onClick={() => setSection('requests')}
            className={cn(
              'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] font-medium transition',
              section === 'requests' ? 'bg-maroon/20 text-white' : 'hover:bg-white/5'
            )}
          >
            Message Request
            {requests.length > 0 && (
              <span className="rounded-full bg-maroon px-1.5 text-[10px] font-bold">{requests.length}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setSection('friends')}
            className={cn(
              'flex w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium transition',
              section === 'friends' ? 'bg-maroon/20 text-white' : 'hover:bg-white/5'
            )}
          >
            Friend list
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {section === 'requests' ? (
            <div className="space-y-1">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                Friend requests — {requests.length}
              </p>
              <p className="px-2 pb-2 text-[11px] text-muted">
                Permintaan dari orang yang belum berteman. Accept untuk jadi friend.
              </p>
              {requests.map((r) => {
                const uid = r.id || r.user_id
                return (
                  <div key={uid} className="rounded-lg border border-border bg-background p-2">
                    <button type="button" className="flex w-full items-center gap-2 text-left" onClick={() => setProfileUserId(uid)}>
                      <Avatar size="sm" name={r.display_name || r.username} src={r.avatar_url} />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">{r.display_name}</p>
                        <p className="text-[10px] text-muted">@{r.username}</p>
                      </div>
                    </button>
                    <div className="mt-2 flex gap-1">
                      <Button size="sm" className="flex-1" onClick={async () => { await api.acceptFriend(uid); loadSidebar() }}>
                        Accept
                      </Button>
                      <Button size="sm" variant="ghost" className="flex-1" onClick={async () => { await api.rejectFriend(uid); loadSidebar() }}>
                        Decline
                      </Button>
                    </div>
                  </div>
                )
              })}
              {!requests.length && <p className="px-2 py-4 text-xs text-muted">Tidak ada permintaan friend</p>}
            </div>
          ) : (
            <div className="space-y-0.5">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                Friends — {friends.length}
              </p>
              {friends.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition',
                    active?.peer?.id === f.id ? 'bg-maroon/15' : 'hover:bg-white/5'
                  )}
                  onClick={() => openDMWith(f.id)}
                >
                  <div className="relative">
                    <Avatar
                      size="sm"
                      name={f.display_name || f.username}
                      src={f.avatar_url}
                      onClick={() => setProfileUserId(f.id)}
                    />
                    <span
                      className={cn(
                        'absolute bottom-0 right-0 h-2 w-2 rounded-full ring-2 ring-surface',
                        f.online || f.peer_id ? 'bg-green-500' : 'bg-neutral-600'
                      )}
                    />
                  </div>
                  <span className="truncate text-[13px]">{f.display_name || f.username}</span>
                </button>
              ))}
              {!friends.length && (
                <p className="px-2 py-4 text-xs text-muted">Belum ada friend. Cari user lalu Add Friend.</p>
              )}
            </div>
          )}
        </div>

        {/* Own user panel */}
        <div className="border-t border-border p-3">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg p-1 text-left hover:bg-white/5"
            onClick={() => user?.id && setProfileUserId(user.id)}
          >
            <Avatar name={user?.display_name || user?.username} src={user?.avatar_url} />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{user?.display_name}</p>
              <p className="truncate text-[10px] text-muted">@{user?.username} · Edit profile</p>
            </div>
          </button>
        </div>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-col bg-background">
        {active ? (
          <>
            <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
              <button
                type="button"
                className="flex items-center gap-3 text-left"
                onClick={() => active.peer?.id && setProfileUserId(active.peer.id)}
              >
                <Avatar name={active.peer?.display_name || active.peer?.username} src={active.peer?.avatar_url} />
                <div>
                  <p className="text-sm font-semibold">{active.peer?.display_name || 'Conversation'}</p>
                  <p className="text-[11px] text-muted">
                    {active.peer?.online ? 'Online' : 'Offline'}
                    {active.peer?.username ? ` · @${active.peer.username}` : ''}
                  </p>
                </div>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-full border border-border px-3 py-1.5 text-xs hover:border-gold"
                  onClick={() => active.peer?.id && void rtcService.startDirectCall(active.peer.id, 'voice', active.peer.display_name || active.peer.username || 'Friend', active.peer.username, active.peer.avatar_url).catch((error) => alert(error instanceof Error ? error.message : 'Unable to start call'))}
                >
                  <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Call</span>
                </button>
                <button
                  type="button"
                  className="rounded-full border border-border px-3 py-1.5 text-xs hover:border-gold"
                  onClick={() => active.peer?.id && void rtcService.startDirectCall(active.peer.id, 'video', active.peer.display_name || active.peer.username || 'Friend', active.peer.username, active.peer.avatar_url).catch((error) => alert(error instanceof Error ? error.message : 'Unable to start video call'))}
                >
                  <span className="flex items-center gap-1.5"><Video className="h-3.5 w-3.5" /> Videocall</span>
                </button>
                <button type="button" className="rounded-full border border-border p-2 text-muted">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
              {messages.map((m: any) => {
                const mine = m.is_mine || m.sender_id === user?.id
                return (
                  <div key={m.id} className={cn('flex gap-2', mine && 'justify-end')}>
                    {!mine && (
                      <Avatar
                        size="sm"
                        name={m.display_name || active.peer?.display_name}
                        src={m.avatar_url || active.peer?.avatar_url}
                        onClick={() => setProfileUserId(m.sender_id || active.peer?.id || '')}
                      />
                    )}
                    <div
                      className={cn(
                        'max-w-[70%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
                        mine ? 'bg-maroon/30 text-white' : 'bg-surface text-foreground'
                      )}
                    >
                      {m.content ? <p className="whitespace-pre-wrap break-words">{linkify(m.content)}</p> : null}
                      {m.attachment_url && (
                        <div className="mt-2">
                          {isImage(m.attachment_type, m.attachment_url) ? (
                            <a href={absUrl(m.attachment_url)} target="_blank" rel="noopener noreferrer">
                              <img src={absUrl(m.attachment_url)} alt="" className="max-h-56 max-w-full rounded-lg object-contain" />
                            </a>
                          ) : (
                            <a
                              href={absUrl(m.attachment_url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-gold underline"
                            >
                              📎 {m.attachment_type || 'File'}
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              {!messages.length && (
                <div className="flex flex-1 items-center justify-center text-sm text-muted">No messages yet.</div>
              )}
            </div>

            {attach && (
              <div className="flex items-center gap-2 border-t border-border px-3 pt-2 text-xs text-muted">
                {isImage(attach.type, attach.url) ? (
                  <img src={absUrl(attach.url)} alt="" className="h-10 w-10 rounded object-cover" />
                ) : (
                  <span>📎</span>
                )}
                <span className="truncate">{attach.filename || attach.url}</span>
                <button type="button" className="ml-auto text-red-400" onClick={() => setAttach(null)}>×</button>
              </div>
            )}

            <div className="flex shrink-0 items-center gap-2 border-t border-border p-3">
              <input ref={fileRef} type="file" className="hidden" onChange={onPickFile} />
              <button
                type="button"
                className="rounded-lg p-2 text-muted hover:bg-surface hover:text-foreground disabled:opacity-40"
                disabled={uploading}
                title="Attach file (max 15MB)"
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && enterToSend) {
                    e.preventDefault()
                    send()
                  }
                }}
                placeholder="Message... (link, text, or attach file)"
                className="flex-1"
              />
              <Button disabled={sending || uploading || (!input.trim() && !attach)} onClick={send}>
                {uploading ? '…' : 'Send'}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-gold">WEBCALL</p>
            <h1 className="text-4xl font-semibold tracking-tight">Home</h1>
            <p className="max-w-sm text-sm text-muted">Pilih friend atau cari user untuk mulai chat.</p>
          </div>
        )}
      </main>

      <AnimatePresence>
        {profileUserId && (
          <UserProfileCard
            userId={profileUserId}
            onClose={() => setProfileUserId(null)}
            onMessage={(id) => openDMWith(id)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
