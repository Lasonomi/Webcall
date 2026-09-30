import { useEffect, useState, useCallback, useRef } from 'react'
import { Hash, Volume2, Settings, Paperclip, Plus, Trash2 } from 'lucide-react'
import { VoiceRoom } from '@/components/rtc/VoiceRoom'
import { api } from '@/services/api'
import { useAuth } from '@/hooks/useAuth'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn, initials } from '@/lib/utils'

type Server = { id: string; name: string; icon_url?: string }
type Channel = {
  id: string
  name: string
  type: string
  category?: string
  allow_message?: boolean
  allow_upload?: boolean
  allow_voice?: boolean
  allow_video?: boolean
}
type Member = {
  user_id: string
  username?: string
  display_name?: string
  avatar_url?: string
  role?: string
  online?: boolean
}
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

export function ServerViewPage({ onNeedPicker }: { onNeedPicker: () => void }) {
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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [createChOpen, setCreateChOpen] = useState(false)
  const [newChName, setNewChName] = useState('')
  const [newChType, setNewChType] = useState<'text' | 'voice'>('text')
  const [serverNameEdit, setServerNameEdit] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; member: Member } | null>(null)
  const [busy, setBusy] = useState(false)
  const [attach, setAttach] = useState<{ url: string; type?: string; filename?: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const canManage = role === 'OWNER' || role === 'ADMIN'
  const isOwner = role === 'OWNER'
  const channel = channels.find((c) => c.id === channelId)

  const reloadServer = useCallback(async (sid: string) => {
    const d = await api.getServer(sid)
    setServer(d.server)
    setRole(d.role || d.server?.user_role || 'MEMBER')
    setServerNameEdit(d.server?.name || '')
    const chs: Channel[] = d.channels || []
    setChannels(chs)
    setChannelId((prev) => {
      if (prev && chs.some((c) => c.id === prev)) return prev
      const text = chs.find((c) => c.name === 'general') || chs.find((c) => c.type === 'text') || chs[0]
      return text?.id || null
    })
    const m = await api.listMembers(sid)
    setMembers(m.members || [])
  }, [])

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
    reloadServer(serverId).catch(console.error)
  }, [serverId, reloadServer])

  useEffect(() => {
    if (!serverId || !channelId || channel?.type === 'voice') {
      setMessages([])
      return
    }
    api.listChannelMessages(serverId, channelId).then((d) => setMessages(d.messages || [])).catch(console.error)
  }, [serverId, channelId])

  useEffect(() => {
    const close = () => setCtxMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  const absUrl = (u?: string) => {
    if (!u) return ''
    if (u.startsWith('http')) return u
    return `${api.url}${u}`
  }

  const isImage = (typ?: string, url?: string) => {
    const s = (typ || '').toLowerCase()
    return s.startsWith('image') || s === 'image' || /\.(png|jpe?g|gif|webp)$/i.test(url || '')
  }

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (channel?.allow_upload === false) {
      alert('Uploads disabled in this channel')
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      alert('File terlalu besar (maks 15MB)')
      return
    }
    setUploading(true)
    try {
      const up = await api.uploadFile(file)
      setAttach({ url: up.url, type: up.type || up.mime || file.type, filename: up.filename || file.name })
    } catch (err: any) {
      alert(err.message || 'Upload gagal')
    } finally {
      setUploading(false)
    }
  }

  const send = async () => {
    const text = input.trim()
    if ((!text && !attach) || !serverId || !channelId) return
    if (channel && channel.allow_message === false && !attach) {
      alert('Messaging is disabled in this channel')
      return
    }
    setSending(true)
    try {
      await api.createChannelMessage(serverId, channelId, {
        content: text,
        attachment_url: attach?.url || '',
        attachment_type: attach?.type || '',
        client_message_id: crypto.randomUUID?.() || `c_${Date.now()}`,
      })
      setInput('')
      setAttach(null)
      const d = await api.listChannelMessages(serverId, channelId)
      setMessages(d.messages || [])
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSending(false)
    }
  }

  const createChannel = async () => {
    if (!serverId || !newChName.trim()) return
    setBusy(true)
    try {
      await api.createChannel(serverId, { name: newChName.trim(), type: newChType })
      setNewChName('')
      setCreateChOpen(false)
      await reloadServer(serverId)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  const deleteChannel = async (cid: string) => {
    if (!serverId || !confirm('Delete this channel?')) return
    try {
      await api.deleteChannel(serverId, cid)
      await reloadServer(serverId)
    } catch (e: any) {
      alert(e.message)
    }
  }

  const saveServer = async () => {
    if (!serverId) return
    setBusy(true)
    try {
      await api.updateServer(serverId, { name: serverNameEdit })
      await reloadServer(serverId)
      const list = (await api.listServers()).servers || []
      setServers(list)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  const makeInvite = async () => {
    if (!serverId) return
    try {
      const d: any = await api.createInvite(serverId)
      setInviteCode(d.invite?.code || d.code || '')
    } catch (e: any) {
      alert(e.message)
    }
  }

  const deleteServer = async () => {
    if (!serverId || !confirm('Delete this server permanently?')) return
    try {
      await api.deleteServer(serverId)
      setSettingsOpen(false)
      const list = (await api.listServers()).servers || []
      setServers(list)
      setServerId(list[0]?.id || null)
      if (!list.length) onNeedPicker()
    } catch (e: any) {
      alert(e.message)
    }
  }

  const setRoleFor = async (userId: string, newRole: string) => {
    if (!serverId) return
    try {
      await api.setMemberRole(serverId, userId, newRole)
      await reloadServer(serverId)
      setCtxMenu(null)
    } catch (e: any) {
      alert(e.message)
    }
  }

  const categories = channels.reduce<Record<string, Channel[]>>((acc, c) => {
    const key = c.category || (c.type === 'voice' ? 'VOICE CHANNELS' : 'TEXT CHANNELS')
    ;(acc[key] ||= []).push(c)
    return acc
  }, {})

  return (
    <div className="grid h-full min-h-0 grid-cols-[72px_240px_minmax(0,1fr)_220px] overflow-hidden" onClick={() => setCtxMenu(null)}>
      {/* Servers rail */}
      <nav className="flex flex-col items-center gap-2 overflow-y-auto border-r border-border bg-background py-3">
        <span className="mb-1 rotate-180 text-[9px] uppercase tracking-[0.2em] text-muted [writing-mode:vertical-rl]">Servers</span>
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
        <button type="button" onClick={onNeedPicker} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface text-lg text-gold hover:bg-surface-2" title="Add server">
          ＋
        </button>
      </nav>

      {/* Channel list */}
      <aside className="flex min-h-0 flex-col border-r border-border bg-surface">
        <div className="flex items-start justify-between border-b border-border p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{server?.name || 'Server'}</p>
            <p className="text-[11px] text-muted">
              {server?.member_count || members.length} members · {role || 'MEMBER'}
            </p>
          </div>
          {canManage && (
            <button
              type="button"
              className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-foreground"
              title="Server settings"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {Object.entries(categories).map(([cat, list]) => (
            <div key={cat} className="mb-3">
              <div className="flex items-center justify-between px-2 py-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{cat}</p>
                {canManage && (
                  <button
                    type="button"
                    className="text-muted hover:text-gold"
                    title="Create channel"
                    onClick={() => {
                      setNewChType(cat.toLowerCase().includes('voice') ? 'voice' : 'text')
                      setCreateChOpen(true)
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {list.map((ch) => (
                <div key={ch.id} className="group flex items-center">
                  <button
                    type="button"
                    onClick={() => setChannelId(ch.id)}
                    className={cn(
                      'flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition',
                      channelId === ch.id ? 'bg-maroon/25 text-white' : 'text-muted hover:bg-white/5 hover:text-foreground'
                    )}
                  >
                    {ch.type === 'voice' ? <Volume2 className="h-3.5 w-3.5 shrink-0" /> : <Hash className="h-3.5 w-3.5 shrink-0" />}
                    <span className="truncate">{ch.name}</span>
                  </button>
                  {canManage && (
                    <button
                      type="button"
                      className="hidden p-1 text-muted hover:text-red-400 group-hover:block"
                      title="Delete channel"
                      onClick={() => deleteChannel(ch.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}
          {canManage && (
            <Button size="sm" variant="secondary" className="mt-1 w-full" onClick={() => setCreateChOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Create channel
            </Button>
          )}
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

      {/* Chat */}
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

        {channel?.type === 'voice' && serverId ? (
          <VoiceRoom
            channel={{
              id: channel.id,
              name: channel.name,
              type: channel.type,
              allow_video: channel.allow_video !== false,
              allow_voice: true,
            }}
            serverId={serverId}
            serverName={server?.name || 'Server'}
          />
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
                    {m.content ? <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{m.content}</p> : null}
                    {m.attachment_url && (
                      <div className="mt-2">
                        {isImage(m.attachment_type, m.attachment_url) ? (
                          <a href={absUrl(m.attachment_url)} target="_blank" rel="noopener noreferrer">
                            <img src={absUrl(m.attachment_url)} alt="" className="max-h-56 max-w-full rounded-lg object-contain" />
                          </a>
                        ) : (
                          <a href={absUrl(m.attachment_url)} target="_blank" rel="noopener noreferrer" className="text-gold underline">
                            📎 {m.attachment_type || 'File'}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {!messages.length && <p className="py-8 text-center text-sm text-muted">No messages yet.</p>}
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
                className="rounded-lg p-2 text-muted hover:bg-surface disabled:opacity-40"
                disabled={uploading || channel?.allow_upload === false}
                title="Attach file (max 15MB)"
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder={`Message #${channel?.name || 'channel'}`}
                disabled={channel?.allow_message === false && !attach}
                className="h-[42px] min-w-0 flex-1 rounded-[10px] border border-border bg-surface px-3.5 text-sm outline-none focus:border-maroon disabled:opacity-50"
              />
              <Button disabled={sending || uploading || (!input.trim() && !attach)} onClick={send}>
                {uploading ? '…' : 'Send'}
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
            <div
              key={m.user_id}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-2 hover:bg-white/5"
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setCtxMenu({ x: e.clientX, y: e.clientY, member: m })
              }}
            >
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

      {/* Context menu roles */}
      {ctxMenu && isOwner && ctxMenu.member.role !== 'OWNER' && (
        <div
          className="fixed z-50 min-w-[160px] rounded-lg border border-border bg-surface py-1 shadow-xl"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="px-3 py-1 text-[10px] text-muted">{ctxMenu.member.display_name}</p>
          {ctxMenu.member.role !== 'ADMIN' && (
            <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-maroon/20" onClick={() => setRoleFor(ctxMenu.member.user_id, 'ADMIN')}>
              Promote to Admin
            </button>
          )}
          {ctxMenu.member.role === 'ADMIN' && (
            <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-maroon/20" onClick={() => setRoleFor(ctxMenu.member.user_id, 'MEMBER')}>
              Demote to Member
            </button>
          )}
        </div>
      )}

      {/* Create channel modal */}
      {createChOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setCreateChOpen(false)}>
          <div className="w-full max-w-sm space-y-3 rounded-2xl border border-border bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">Create channel</h3>
            <Input placeholder="Channel name" value={newChName} onChange={(e) => setNewChName(e.target.value)} />
            <div className="flex gap-2">
              <button type="button" className={cn('flex-1 rounded-lg border py-2 text-xs font-semibold', newChType === 'text' ? 'border-gold bg-maroon/20' : 'border-border')} onClick={() => setNewChType('text')}>
                Text
              </button>
              <button type="button" className={cn('flex-1 rounded-lg border py-2 text-xs font-semibold', newChType === 'voice' ? 'border-gold bg-maroon/20' : 'border-border')} onClick={() => setNewChType('voice')}>
                Voice
              </button>
            </div>
            <Button className="w-full" disabled={busy || !newChName.trim()} onClick={createChannel}>
              Create
            </Button>
          </div>
        </div>
      )}

      {/* Server settings */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSettingsOpen(false)}>
          <div className="max-h-[86vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">Server settings</h3>
            <p className="text-xs text-muted">Your role: {role}</p>
            <div className="mt-4 space-y-2">
              <label className="text-xs text-muted">Server name</label>
              <Input value={serverNameEdit} onChange={(e) => setServerNameEdit(e.target.value)} disabled={!canManage} />
              <Button className="w-full" disabled={busy || !canManage} onClick={saveServer}>
                Save name
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              <Button variant="secondary" className="w-full" onClick={makeInvite}>
                Create invite
              </Button>
              {inviteCode && (
                <p className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  Code: <strong className="text-gold">{inviteCode}</strong>
                </p>
              )}
            </div>
            {isOwner && (
              <Button variant="danger" className="mt-6 w-full" onClick={deleteServer}>
                Delete server
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
