import { storeToRefs } from 'pinia'
import { useThemeStore } from '@/stores/theme.store'

/** Bridge — prefer useThemeStore in new code */
export function useTheme() {
  const store = useThemeStore()
  const { theme, resolved } = storeToRefs(store)
  return {
    theme,
    resolved,
    setTheme: store.setTheme,
  }
}
