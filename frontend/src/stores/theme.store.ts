import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'webcall-theme'

function resolveTheme(mode: string) {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }
  return mode === 'light' ? 'light' : 'dark'
}

function applyTheme(mode: string) {
  const r = resolveTheme(mode)
  const root = document.documentElement
  root.setAttribute('data-theme', r)
  root.classList.toggle('light', r === 'light')
  root.classList.toggle('dark', r === 'dark')
  return r
}

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<'dark' | 'light' | 'system'>(
    (localStorage.getItem(STORAGE_KEY) as 'dark' | 'light' | 'system') || 'dark'
  )
  const resolved = ref<'dark' | 'light'>(resolveTheme(theme.value) as 'dark' | 'light')

  function setTheme(mode: 'dark' | 'light' | 'system') {
    theme.value = mode
    localStorage.setItem(STORAGE_KEY, mode)
    resolved.value = applyTheme(mode) as 'dark' | 'light'
  }

  function init() {
    resolved.value = applyTheme(theme.value) as 'dark' | 'light'
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    mq.addEventListener?.('change', () => {
      if (theme.value === 'system') resolved.value = applyTheme('system') as 'dark' | 'light'
    })
  }

  watch(theme, (v) => {
    resolved.value = applyTheme(v) as 'dark' | 'light'
  })

  return { theme, resolved, setTheme, init }
})
