import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth.store'

/** Bridge — prefer useAuthStore in new code */
export function useAuth() {
  const store = useAuthStore()
  const { user, token, loading, error, isAuthenticated } = storeToRefs(store)
  return {
    user,
    token,
    loading,
    error,
    isAuthenticated,
    login: store.login,
    register: store.register,
    restore: store.restore,
    logout: store.logout,
  }
}
