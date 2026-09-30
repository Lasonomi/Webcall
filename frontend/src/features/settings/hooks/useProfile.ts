import { useCallback, useEffect, useState } from 'react'
import { api } from '@/services/api'

export type MyProfile = {
  id: string
  username: string
  email: string
  display_name: string
  avatar_url?: string
  bio?: string
  custom_status?: string
  privacy_friend_request: string
  privacy_dm: string
  privacy_profile: string
}

export function useProfile() {
  const [profile, setProfile] = useState<MyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const d = await api.getMyProfile()
      setProfile(d.profile)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat profil')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])
  return { profile, loading, error, reload, setProfile }
}

export const assetUrl = (base: string, url?: string) => (!url ? '' : url.startsWith('http') || url.startsWith('data:') ? url : `${base}${url}`)
