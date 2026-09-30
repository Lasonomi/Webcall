import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import { Button } from '@/components/ui/Button'
import { Card, Notice, Row, Section, SelectField, SoonBadge, SettingSwitch } from '../components/SettingsUI'
import { useProfile } from '../hooks/useProfile'

type Opt = { value: string; label: string }
const DM_OPTIONS: Opt[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'friends_only', label: 'Friends only' },
  { value: 'nobody', label: 'Nobody' },
]
const FR_OPTIONS: Opt[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'friends_of_friends', label: 'Friends of friends' },
  { value: 'nobody', label: 'Nobody' },
]
const PROFILE_OPTIONS: Opt[] = [
  { value: 'public', label: 'Public' },
  { value: 'friends_only', label: 'Friends only' },
]
const LABELS: Record<string, string> = { server_members: 'Server members', friends_only: 'Friends only', friends_of_friends: 'Friends of friends' }

/** Pastikan nilai dari backend yang tidak ada di daftar tetap tampil (mis. server_members). */
const withCurrent = (opts: Opt[], cur: string): Opt[] =>
  opts.some((o) => o.value === cur) ? opts : [...opts, { value: cur, label: LABELS[cur] ?? cur }]

export function PrivacySection() {
  const { profile, loading, setProfile } = useProfile()
  const [form, setForm] = useState({ privacy_dm: 'everyone', privacy_friend_request: 'everyone', privacy_profile: 'public' })
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [blocked, setBlocked] = useState<{ id: string; username: string; display_name?: string }[]>([])
  const [blockedLoading, setBlockedLoading] = useState(true)

  useEffect(() => {
    if (profile) setForm({ privacy_dm: profile.privacy_dm, privacy_friend_request: profile.privacy_friend_request, privacy_profile: profile.privacy_profile })
  }, [profile])

  useEffect(() => {
    api.listBlocked().then((d) => setBlocked(d.blocked || [])).catch(() => {}).finally(() => setBlockedLoading(false))
  }, [])

  const dirty = !!profile && (Object.keys(form) as (keyof typeof form)[]).some((k) => form[k] !== profile[k])

  const save = async () => {
    setSaving(true)
    setNotice(null)
    try {
      const d = await api.updateMyProfile(form)
      setProfile(d.profile)
      setNotice({ tone: 'ok', text: 'Pengaturan privasi disimpan.' })
    } catch (e) {
      setNotice({ tone: 'error', text: e instanceof Error ? e.message : 'Gagal menyimpan.' })
    } finally {
      setSaving(false)
    }
  }

  const unblock = async (id: string) => {
    try {
      await api.unblockUser(id)
      setBlocked((b) => b.filter((u) => u.id !== id))
    } catch (e) {
      setNotice({ tone: 'error', text: e instanceof Error ? e.message : 'Gagal membuka blokir.' })
    }
  }

  if (loading) return <p className="text-sm text-muted">Memuat…</p>

  return (
    <Section title="Privacy & Safety" description="Atur siapa yang bisa berinteraksi denganmu.">
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

      <Card title="Interaksi">
        <Row label="Direct messages" hint="Siapa yang boleh mengirim DM." htmlFor="p-dm">
          <SelectField id="p-dm" value={form.privacy_dm} options={withCurrent(DM_OPTIONS, form.privacy_dm)} onChange={(v) => setForm((f) => ({ ...f, privacy_dm: v }))} />
        </Row>
        <Row label="Friend requests" hint="Siapa yang boleh mengirim permintaan pertemanan." htmlFor="p-fr">
          <SelectField id="p-fr" value={form.privacy_friend_request} options={withCurrent(FR_OPTIONS, form.privacy_friend_request)} onChange={(v) => setForm((f) => ({ ...f, privacy_friend_request: v }))} />
        </Row>
        <Row label="Profile visibility" hint="Siapa yang boleh melihat profilmu." htmlFor="p-prof">
          <SelectField id="p-prof" value={form.privacy_profile} options={withCurrent(PROFILE_OPTIONS, form.privacy_profile)} onChange={(v) => setForm((f) => ({ ...f, privacy_profile: v }))} />
        </Row>
        <div className="py-3">
          <Button disabled={!dirty || saving} onClick={save}>{saving ? 'Menyimpan…' : 'Save privacy'}</Button>
        </div>
      </Card>

      <Card title="Presence">
        <SettingSwitch field="showOnlineStatus" label="Show online status" hint="Tersimpan di perangkat ini; belum disinkronkan ke server." />
      </Card>

      <Card title="Moderation">
        <div className="py-3">
          <p className="text-sm font-medium">Blocked users</p>
          {blockedLoading ? (
            <p className="mt-2 text-xs text-muted">Memuat…</p>
          ) : blocked.length === 0 ? (
            <p className="mt-2 text-xs text-muted">Belum ada user yang diblokir.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
              {blocked.map((u) => (
                <li key={u.id} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm">{u.display_name || u.username} <span className="text-xs text-muted">@{u.username}</span></span>
                  <Button variant="secondary" size="sm" onClick={() => unblock(u.id)}>Unblock</Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Row label="Muted users"><SoonBadge /></Row>
      </Card>
    </Section>
  )
}
