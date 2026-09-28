import { ref, onMounted, onBeforeUnmount } from 'vue'
import { api } from '@/services/api/client.js'

const items = ref([])
const unread = ref(0)
const open = ref(false)
let bound = false

export function useNotifications() {
  const load = async () => {
    try {
      const data = await api.listNotifications()
      items.value = data.notifications || []
      unread.value = data.unread || 0
    } catch {
      /* ignore */
    }
  }

  const markRead = async (id) => {
    await api.markNotificationRead(id)
    const n = items.value.find((x) => x.id === id)
    if (n) n.read = true
    unread.value = Math.max(0, unread.value - 1)
  }

  const markAll = async () => {
    await api.markAllNotificationsRead()
    items.value = items.value.map((n) => ({ ...n, read: true }))
    unread.value = 0
  }

  const onNew = (e) => {
    const n = e.detail
    if (!n) return
    items.value = [n, ...items.value]
    unread.value += 1
  }

  if (!bound && typeof window !== 'undefined') {
    bound = true
    window.addEventListener('webcall:notification', onNew)
  }

  return { items, unread, open, load, markRead, markAll }
}
