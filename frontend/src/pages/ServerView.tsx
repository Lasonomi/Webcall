import { useEffect, useState } from 'react'
import { Hash, Volume2, Settings, Paperclip } from 'lucide-react'
import { api } from '@/services/api'
import { useAuth } from '@/hooks/useAuth'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { cn, initials } from '@/lib/utils'

type Server = { id: string; name: string; icon_url?: string }
type Channel = { id: string; name: string; type: string; category?: string }
type Member = { user_id: string; username?: string; display_name?: string; avatar_url?: string; role?: string; online?: boolean }
type Msg = {
  id: string
  content: string
  user_id: string
  username?: string
  display_name?: string
  avatar_url?: string
  created_at?: string
  attachment_url?: string
}

export function ServerViewPage({
  onNeedPicker,
}: {
  onNeedPicker: () => void
}) {
  const { user } = useAuth()
  const [servers, setServers] = useState<Server[]>([])
  const [serverId, setServerId] = useState<string | null>(null)
  const [server, setServer] = useState<any>(null)
  const [channels, setChannels] = useState<Channel[]>([])
  const [channelId, setChannelId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [role, setRole] = useState('')

  const channel = channels.find((c) => c.id === channelId)

  useEffect(() => {
    api.listServers().then((d) => {
      const list = d.servers || []
      setServers(list)
      if (list.length && !serverId) setServerId(list[0].id)
      if (!list.length) onNeedPicker()
    })
  }, [])

  useEffect(() => {
    if (!serverId) return
    ;(async () => {
      const d = await api.getServer(serverId)
      setServer(d.server)
      setRole(d.role || d.server?.user_role || 'MEMBER')
      const chs: Channel[] = d.channels || []
      setChannels(chs)
      const text = chs.find((c) => c.name === 'general' && c.type === 'text') || chs.find((c) => c.type === 'text') || chs[0]
      setChannelId(text?.id || null)
      const m = await api.listMembers(serverId)
      setMembers(m.members || [])
    })().catch(console.error)
  }, [serverId])

  useEffect(() => {
    if (!serverId || !channelId || channel?.type === 'voice') {
      setMessages([])
      return
    }
    api.listChannelMessages(serverId, channelId).then((d) => setMessages(d.messages || [])).catch(console.error)
  }, [serverId, channelId])

  const send = async () => {
    const text = input.trim()
    if (!text || !serverId || !channelId) return
    setSending(true)
    try {
      await api.createChannelMessage(serverId, channelId, {
        content: text,
        client_message_id: crypto.randomUUID?.() || `c_${Date.now()}`,
      })
      setInput('')
      const d = await api.listChannelMessages(serverId, channelId)
      setMessages(d.messages || [])
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSending(false)
    }
  }

  const categories = channels.reduce<Record<string, Channel[]>>((acc, c) => {
    const key = c.category || (c.type === 'voice' ? 'VOICE CHANNELS' : 'TEXT CHANNELS')
    ;(acc[key] ||= []).push(c)
    return acc
  }, {})

  return (
    <div className="grid h-full min-h-0 grid-cols-[72px_240px_minmax(0,1fr)_220px] overflow-hidden">
      {/* Servers rail */}
      <nav className="flex flex-col items-center gap-2 overflow-y-auto border-r border-border bg-background py-3">
        <span className="mb-1 rotate-180 text-[9px] uppercase tracking-[0.2em] text-muted [writing-mode:vertical-rl]">
          Servers
        </span>
        {servers.map((s) => (
          <button
            key={s.id}
            type="button"
            title={s.name}
            onClick={() => setServerId(s.id)}
            className={cn(
              'flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl text-xs font-bold transition',
              serverId === s.id ? 'rounded-xl bg-maroon text-white' : 'bg-surface text-muted hover:bg-surface-2 hover:text-white'
            )}
          >
            {s.icon_url ? <img src={s.icon_url} alt="" className="h-full w-full object-cover" /> : initials(s.name)}
          </button>
        ))}
        <button
          type="button"
          onClick={onNeedPicker}
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface text-lg text-gold hover:bg-surface-2"
          title="Add server"
        >
          ＋
        </button>
      </nav>

      {/* Channel list */}
      <aside className="flex min-h-0 flex-col border-r border-border bg-surface">
        <div className="flex items-start justify-between border-b border-border p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{server?.name || 'Server'}</p>
            <p className="text-[11px] text-muted">
              {server?.member_count || members.length} members · {role}
            </p>
          </div>
          <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-foreground">
            <Settings className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {Object.entries(categories).map(([cat, list]) => (
            <div key={cat} className="mb-3">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">{cat}</p>
              {list.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setChannelId(ch.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition',
                    channelId === ch.id ? 'bg-maroon/25 text-white' : 'text-muted hover:bg-white/5 hover:text-foreground'
                  )}
                >
                  {ch.type === 'voice' ? <Volume2 className="h-3.5 w-3.5" /> : <Hash className="h-3.5 w-3.5" />}
                  {ch.name}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2">
            <Avatar name={user?.display_name || user?.username} src={user?.avatar_url} />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{user?.display_name}</p>
              <p className="truncate text-[10px] text-muted">@{user?.username}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Interaction / chat */}
      <section className="flex min-h-0 min-w-0 flex-col bg-background">
        <header className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gold">
              {channel?.type === 'voice' ? 'Voice channel' : 'Text channel'}
            </p>
            <h2 className="text-xl font-semibold tracking-tight">
              <span className="mr-1 opacity-70">{channel?.type === 'voice' ? '🎙' : '#'}</span>
              {channel?.name || 'general'}
            </h2>
          </div>
        </header>

        {channel?.type === 'voice' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted">
            <Volume2 className="h-10 w-10 text-gold" />
            <p className="text-sm">Voice channel — join from controls (WebRTC)</p>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
              {messages.map((m) => (
                <div key={m.id} className="flex gap-3">
                  <Avatar size="sm" name={m.display_name || m.username} src={m.avatar_url} />
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-baseline gap-2">
                      <span className="text-[13px] font-semibold text-gold">{m.display_name || m.username}</span>
                      <time className="text-[10px] text-muted">
                        {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </time>
                    </div>
                    <p className="text-sm leading-relaxed text-foreground">{m.content}</p>
                    {m.attachment_url && (
                      <img
                        src={m.attachment_url.startsWith('http') ? m.attachment_url : `${api.url}${m.attachment_url}`}
                        alt=""
                        className="mt-2 max-h-64 max-w-md rounded-lg object-contain"
                      />
                    )}
                  </div>
                </div>
              ))}
              {!messages.length && <p className="py-8 text-center text-sm text-muted">No messages yet. Say hello!</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2 border-t border-border p-3">
              <button type="button" className="rounded-lg p-2 text-muted hover:bg-surface hover:text-foreground">
                <Paperclip className="h-4 w-4" />
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder={`Message #${channel?.name || 'channel'}`}
                className="h-[42px] min-w-0 flex-1 rounded-[10px] border border-border bg-surface px-3.5 text-sm outline-none focus:border-maroon"
              />
              <Button disabled={sending || !input.trim()} onClick={send}>
                Send
              </Button>
            </div>
          </>
        )}
      </section>

      {/* Members */}
      <aside className="flex min-h-0 flex-col border-l border-border bg-surface">
        <div className="flex items-center justify-between px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gold">Members</p>
          <span className="text-[11px] text-muted">{members.length}</span>
        </div>
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-2 rounded-lg px-1.5 py-2 hover:bg-white/5">
              <Avatar size="sm" name={m.display_name || m.username} src={m.avatar_url} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">{m.display_name || m.username}</p>
                <p className="text-[10px] text-muted">{m.role}</p>
              </div>
              <span className={cn('h-2 w-2 shrink-0 rounded-full', m.online ? 'bg-green-500' : 'bg-neutral-600')} />
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}
