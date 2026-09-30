import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { X, MessageCircle, UserPlus } from 'lucide-react'
import { api } from '@/services/api'
import { useAuth } from '@/hooks/useAuth'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type Profile = {
  id: string
  username?: string
  display_name?: string
  avatar_url?: string
  banner_url?: string
  bio?: string
  custom_status?: string
  presence_status?: string
  created_at?: string
  relationship?: string
}

export function UserProfileCard({
  userId,
  onClose,
  onMessage,
}: {
  userId: string
  onClose: () => void
  onMessage?: (userId: string) => void
}) {
  const { user, restore } = useAuth()
  const isSelf = user?.id === userId
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [bio, setBio] = useState('')
  const [status, setStatus] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    const load = isSelf ? api.getMyProfile() : api.getPublicProfile(userId)
    load
      .then((d) => {
        if (!alive) return
        setProfile(d.profile)
        setBio(d.profile?.bio || '')
        setStatus(d.profile?.custom_status || '')
        setDisplayName(d.profile?.display_name || '')
      })
      .catch((e: Error) => {
        if (alive) setError(e.message)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [userId, isSelf])

  const saveSelf = async () => {
    setSaving(true)
    setError('')
    try {
      const d = await api.updateMyProfile({
        bio,
        custom_status: status,
        display_name: displayName,
      })
      setProfile(d.profile)
      await restore()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const addFriend = async () => {
    setBusy(true)
    try {
      await api.requestFriend(userId)
      const d = await api.getPublicProfile(userId)
      setProfile(d.profile)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
      >
        <div
          className="relative h-28 bg-surface-2"
          style={
            profile?.banner_url
              ? {
                  backgroundImage: `url(${profile.banner_url.startsWith('http') ? profile.banner_url : api.url + profile.banner_url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : undefined
          }
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-2 top-2 rounded-lg bg-black/40 p-1.5 text-white hover:bg-black/60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="relative px-5 pb-5">
          <div className="-mt-10 mb-3">
            <Avatar
              size="lg"
              name={profile?.display_name || profile?.username}
              src={profile?.avatar_url}
              className="h-16 w-16 ring-4 ring-surface"
            />
          </div>
          {loading && <p className="text-sm text-muted">Loading profile…</p>}
          {error && <p className="mb-2 text-sm text-red-400">{error}</p>}

          {profile && !loading && isSelf && (
            <div className="space-y-3">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-gold">YOUR PROFILE</p>
              <div>
                <label className="text-[11px] text-muted">Display name</label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-[11px] text-muted">Custom status</label>
                <Input value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1" placeholder="What are you up to?" />
              </div>
              <div>
                <label className="text-[11px] text-muted">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-maroon"
                  placeholder="Tell others about yourself"
                />
              </div>
              <p className="text-xs text-muted">@{profile.username}</p>
              <Button className="w-full" disabled={saving} onClick={saveSelf}>
                {saving ? 'Saving…' : 'Save profile'}
              </Button>
            </div>
          )}

          {profile && !loading && !isSelf && (
            <>
              <h2 className="text-xl font-semibold tracking-tight">{profile.display_name || profile.username}</h2>
              <p className="text-sm text-muted">@{profile.username}</p>
              {profile.custom_status && <p className="mt-1 text-sm text-gold/90">{profile.custom_status}</p>}
              <p className="mt-1 text-xs text-muted">
                {String(profile.presence_status || '').toLowerCase() === 'online' ? (
                  <span className="text-green-400">● Online</span>
                ) : (
                  <span>○ Offline</span>
                )}
                {profile.created_at && (
                  <span> · Member since {new Date(profile.created_at).toLocaleDateString()}</span>
                )}
              </p>
              {profile.bio && <p className="mt-3 text-sm leading-relaxed text-foreground/90">{profile.bio}</p>}
              <div className="mt-4 flex gap-2">
                <Button className="flex-1" onClick={() => onMessage?.(profile.id)} disabled={!onMessage}>
                  <MessageCircle className="h-4 w-4" /> Message
                </Button>
                {!['FRIENDS', 'friends', 'PENDING_SENT'].includes(String(profile.relationship || '')) && (
                  <Button variant="secondary" className="flex-1" disabled={busy} onClick={addFriend}>
                    <UserPlus className="h-4 w-4" /> Add Friend
                  </Button>
                )}
                {String(profile.relationship) === 'PENDING_SENT' && (
                  <Button variant="secondary" className="flex-1" disabled>
                    Pending
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
