import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, Upload } from 'lucide-react'
import { api } from '@/services/api'
import { useAuth } from '@/hooks/useAuth'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, Notice, Row, Section, SoonBadge } from '../components/SettingsUI'
import { useSettings } from '../settings.store'
import { assetUrl, useProfile } from '../hooks/useProfile'

export function AccountSection() {
  const { profile, loading, error: loadError, setProfile } = useProfile()
  const restore = useAuth((s) => s.restore)
  const logout = useAuth((s) => s.logout)
  const developerMode = useSettings((s) => s.developerMode)
  const nav = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({ display_name: '', bio: '', custom_status: '', avatar_url: '' })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!profile) return
    setForm({
      display_name: profile.display_name || '',
      bio: profile.bio || '',
      custom_status: profile.custom_status || '',
      avatar_url: profile.avatar_url || '',
    })
  }, [profile])

  const dirty =
    !!profile &&
    (form.display_name !== (profile.display_name || '') ||
      form.bio !== (profile.bio || '') ||
      form.custom_status !== (profile.custom_status || '') ||
      form.avatar_url !== (profile.avatar_url || ''))

  const patch = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    if (!form.display_name.trim()) return setNotice({ tone: 'error', text: 'Display name tidak boleh kosong.' })
    setSaving(true)
    setNotice(null)
    try {
      const d = await api.updateMyProfile(form)
      setProfile(d.profile)
      await restore()
      setNotice({ tone: 'ok', text: 'Perubahan disimpan.' })
    } catch (e) {
      setNotice({ tone: 'error', text: e instanceof Error ? e.message : 'Gagal menyimpan.' })
    } finally {
      setSaving(false)
    }
  }

  const onPickAvatar = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return setNotice({ tone: 'error', text: 'File harus berupa gambar.' })
    setUploading(true)
    setNotice(null)
    try {
      const up = await api.uploadFile(file)
      setForm((f) => ({ ...f, avatar_url: up.url }))
    } catch (e) {
      setNotice({ tone: 'error', text: e instanceof Error ? e.message : 'Upload gagal.' })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  if (loading) return <p className="text-sm text-muted">Memuat profil…</p>

  return (
    <Section title="My Account" description="Kelola profil dan keamanan akunmu.">
      {loadError && <Notice tone="error">{loadError}</Notice>}
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

      <Card title="Profile">
        <div className="flex items-center gap-4 py-4">
          <Avatar size="lg" name={form.display_name || profile?.username} src={assetUrl(api.url, form.avatar_url)} className="h-16 w-16 text-base" />
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                <Upload className="h-3.5 w-3.5" /> {uploading ? 'Mengunggah…' : 'Ganti avatar'}
              </Button>
              {form.avatar_url && (
                <Button variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, avatar_url: '' }))}>Hapus</Button>
              )}
            </div>
            <p className="text-xs text-muted">PNG/JPG/GIF, maks 15MB.</p>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onPickAvatar(e.target.files?.[0])} />
          </div>
        </div>

        <Row label="Display name" htmlFor="s-display">
          <Input id="s-display" className="w-72" maxLength={120} value={form.display_name} onChange={patch('display_name')} />
        </Row>
        <Row label="Username" hint="Tidak bisa diubah.">
          <Input className="w-72 opacity-60" value={`@${profile?.username ?? ''}`} readOnly />
        </Row>
        <Row label="Email" hint="Tidak bisa diubah.">
          <Input className="w-72 opacity-60" value={profile?.email ?? ''} readOnly />
        </Row>
        <Row label="Custom status" htmlFor="s-status">
          <Input id="s-status" className="w-72" maxLength={120} placeholder="Apa yang sedang kamu lakukan?" value={form.custom_status} onChange={patch('custom_status')} />
        </Row>
        <div className="py-3">
          <div className="flex items-center justify-between">
            <label htmlFor="s-bio" className="text-sm font-medium">Bio</label>
            <span className="text-xs text-muted">{form.bio.length}/500</span>
          </div>
          <textarea
            id="s-bio" rows={3} maxLength={500} value={form.bio} onChange={patch('bio')}
            className="mt-2 w-full resize-none rounded-lg border border-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-maroon"
          />
        </div>
        <div className="flex items-center gap-2 py-3">
          <Button disabled={!dirty || saving || uploading} onClick={save}>{saving ? 'Menyimpan…' : 'Save changes'}</Button>
          {dirty && (
            <Button variant="ghost" onClick={() => profile && setForm({
              display_name: profile.display_name || '', bio: profile.bio || '',
              custom_status: profile.custom_status || '', avatar_url: profile.avatar_url || '',
            })}>Batal</Button>
          )}
        </div>
        {developerMode && profile && (
          <Row label="User ID" hint="Developer Mode aktif">
            <Button variant="secondary" size="sm" onClick={() => navigator.clipboard.writeText(profile.id)}>
              <Copy className="h-3.5 w-3.5" /> Copy ID
            </Button>
          </Row>
        )}
      </Card>

      <Card title="Account security">
        <Row label="Change password"><SoonBadge /></Row>
        <Row label="Active sessions" hint="Perangkat yang sedang login."><SoonBadge /></Row>
        <Row label="Log out" hint="Keluar dari perangkat ini.">
          <Button variant="secondary" size="sm" onClick={() => { logout(); nav('/login') }}>Log out</Button>
        </Row>
        <Row label="Log out all devices"><SoonBadge /></Row>
      </Card>

      <Card title="Danger zone" tone="danger">
        <Row label="Delete account" hint="Menghapus akun dan semua datanya secara permanen."><SoonBadge /></Row>
      </Card>
    </Section>
  )
}
