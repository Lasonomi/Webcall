import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'dark' | 'light' | 'system'
export type UiScale = 90 | 100 | 110 | 125
export type ChatDensity = 'compact' | 'cozy' | 'spacious'
export type VideoQuality = '360p' | '480p' | '720p' | '1080p'

/** Setting lokal (client-only). Setting profil & privasi ada di backend. */
export type LocalSettings = {
  // Privacy (lokal — backend belum punya field presence)
  showOnlineStatus: boolean

  // Appearance
  theme: Theme
  uiScale: UiScale
  chatDensity: ChatDensity
  compactMode: boolean
  showMemberList: boolean
  showTimestamps: boolean
  reduceMotion: boolean

  // Notifications
  desktopNotifications: boolean
  notificationSound: boolean
  messagePreview: boolean
  notifyNewMessage: boolean
  notifyFriendRequests: boolean
  notifyMentions: boolean
  notifyIncomingCalls: boolean
  notifyServer: boolean
  bottomTicker: boolean

  // Voice & Video
  inputDeviceId: string
  outputDeviceId: string
  cameraId: string
  inputVolume: number
  outputVolume: number
  noiseSuppression: boolean
  echoCancellation: boolean
  autoGainControl: boolean
  videoQuality: VideoQuality
  autoJoinVoice: boolean
  muteOnJoin: boolean
  deafenOnJoin: boolean

  // Chat
  enterToSend: boolean
  linkPreview: boolean
  imagePreview: boolean
  attachmentPreview: boolean
  emojiAnimation: boolean
  gifSupport: boolean
  replyPreviews: boolean
  messageReactions: boolean
  showDeletedIndicator: boolean
  typingIndicator: boolean

  // Accessibility
  highContrast: boolean
  largerText: boolean
  alwaysShowUsernames: boolean
  alwaysShowTimestamps: boolean

  // Advanced
  developerMode: boolean
  hardwareAcceleration: boolean
}

export const DEFAULT_SETTINGS: LocalSettings = {
  showOnlineStatus: true,

  theme: 'dark',
  uiScale: 100,
  chatDensity: 'cozy',
  compactMode: false,
  showMemberList: true,
  showTimestamps: true,
  reduceMotion: false,

  desktopNotifications: false,
  notificationSound: true,
  messagePreview: true,
  notifyNewMessage: true,
  notifyFriendRequests: true,
  notifyMentions: true,
  notifyIncomingCalls: true,
  notifyServer: true,
  bottomTicker: true,

  inputDeviceId: 'default',
  outputDeviceId: 'default',
  cameraId: 'default',
  inputVolume: 100,
  outputVolume: 100,
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
  videoQuality: '720p',
  autoJoinVoice: false,
  muteOnJoin: false,
  deafenOnJoin: false,

  enterToSend: true,
  linkPreview: true,
  imagePreview: true,
  attachmentPreview: true,
  emojiAnimation: true,
  gifSupport: true,
  replyPreviews: true,
  messageReactions: true,
  showDeletedIndicator: true,
  typingIndicator: true,

  highContrast: false,
  largerText: false,
  alwaysShowUsernames: false,
  alwaysShowTimestamps: false,

  developerMode: false,
  hardwareAcceleration: true,
}

type SettingsState = LocalSettings & {
  set: <K extends keyof LocalSettings>(key: K, value: LocalSettings[K]) => void
  reset: () => void
}

const STORAGE_KEY = 'webcall-settings'
const THEME_KEY = 'webcall-theme'

function readInitialTheme(): Theme {
  const t = localStorage.getItem(THEME_KEY) ?? localStorage.getItem('wc_theme') // wc_theme = key lama
  return t === 'light' || t === 'system' || t === 'dark' ? t : 'dark'
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      theme: readInitialTheme(),
      set: (key, value) => set({ [key]: value } as Partial<LocalSettings>),
      reset: () => set({ ...DEFAULT_SETTINGS }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      // hanya simpan data, bukan fungsi
      partialize: (s) => {
        const { set: _s, reset: _r, ...data } = s
        return data
      },
    }
  )
)

/** Terapkan setting ke <html>. Dipanggil sekali saat load + tiap store berubah,
 *  jadi tema/scale tetap benar di halaman login maupun setelah refresh. */
function applyToDocument(s: LocalSettings) {
  const root = document.documentElement
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const dark = s.theme === 'dark' || (s.theme === 'system' && systemDark)

  root.classList.toggle('dark', dark)
  root.classList.toggle('light', !dark)
  root.classList.toggle('reduce-motion', s.reduceMotion)
  root.classList.toggle('high-contrast', s.highContrast)
  root.classList.toggle('compact-mode', s.compactMode)
  root.classList.toggle('density-compact', s.chatDensity === 'compact')
  root.classList.toggle('density-spacious', s.chatDensity === 'spacious')

  root.style.fontSize = `${(16 * s.uiScale * (s.largerText ? 1.125 : 1)) / 100}px`

  try {
    localStorage.setItem(THEME_KEY, s.theme)
  } catch {
    /* storage penuh / diblokir — abaikan */
  }
}

applyToDocument(useSettings.getState())
useSettings.subscribe((s) => applyToDocument(s))

// Ikuti perubahan tema OS saat mode "system"
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  applyToDocument(useSettings.getState())
})
