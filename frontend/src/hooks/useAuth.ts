import { create } from 'zustand'
import { api } from '@/services/api'
import type { User } from '@/types'

type AuthState = {
  user: User | null
  loading: boolean
  restore: () => Promise<void>
  login: (login: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string, displayName: string) => Promise<void>
  logout: () => void
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  restore: async () => {
    const token = localStorage.getItem('webcall_token')
    if (!token) {
      set({ user: null, loading: false })
      return
    }
    try {
      const data = await api.me()
      set({ user: data.user, loading: false })
    } catch {
      localStorage.removeItem('webcall_token')
      set({ user: null, loading: false })
    }
  },
  login: async (login, password) => {
    const data = await api.login(login, password)
    localStorage.setItem('webcall_token', data.token)
    set({ user: data.user })
  },
  register: async (username, email, password, displayName) => {
    const data = await api.register({
      username,
      email,
      password,
      display_name: displayName,
    })
    localStorage.setItem('webcall_token', data.token)
    set({ user: data.user })
  },
  logout: () => {
    localStorage.removeItem('webcall_token')
    set({ user: null })
  },
}))
