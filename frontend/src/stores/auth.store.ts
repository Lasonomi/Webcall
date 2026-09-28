import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '@/services/api/client.js'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<any>(null)
  const token = ref(localStorage.getItem('webcall_token') || '')
  const loading = ref(true)
  const error = ref('')

  const isAuthenticated = computed(() => Boolean(token.value && user.value))

  function setSession(payload: { token: string; user: any }) {
    token.value = payload.token
    user.value = payload.user
    localStorage.setItem('webcall_token', payload.token)
  }

  async function login(loginValue: string, password: string) {
    loading.value = true
    error.value = ''
    try {
      const payload = await api.login({ login: loginValue, password })
      setSession(payload)
      return true
    } catch (err: any) {
      error.value = err.message
      return false
    } finally {
      loading.value = false
    }
  }

  async function register(payload: any) {
    loading.value = true
    error.value = ''
    try {
      const result = await api.register(payload)
      setSession(result)
      return true
    } catch (err: any) {
      error.value = err.message
      return false
    } finally {
      loading.value = false
    }
  }

  async function restore() {
    if (!token.value) {
      loading.value = false
      return false
    }
    try {
      const payload = await api.me()
      user.value = payload.user
      return true
    } catch {
      logout()
      return false
    } finally {
      loading.value = false
    }
  }

  function logout() {
    user.value = null
    token.value = ''
    localStorage.removeItem('webcall_token')
  }

  function patchUser(partial: Record<string, any>) {
    if (user.value) user.value = { ...user.value, ...partial }
  }

  return {
    user,
    token,
    loading,
    error,
    isAuthenticated,
    login,
    register,
    restore,
    logout,
    setSession,
    patchUser,
  }
})
