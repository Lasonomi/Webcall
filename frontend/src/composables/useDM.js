import { ref, computed, onBeforeUnmount } from 'vue'
import { api } from '../lib/api'

/**
 * Direct messages: list, open, send, realtime via /api/ws
 */
export function useDM() {
  const conversations = ref([])
  const activeConversationId = ref(null)
  const activeConversation = ref(null)
  const messages = ref([])
  const loading = ref(false)
  const sending = ref(false)
  const error = ref('')
  const typingUser = ref(null)
  const replyTo = ref(null)
  const searchQuery = ref('')
  const searchResults = ref([])

  let ws = null
  let typingTimer = null
  let intentionalClose = false
  let reconnectTimer = null
  let myUserId = ''

  const unreadTotal = computed(() =>
    conversations.value.reduce((n, c) => n + (c.unread_count || 0), 0)
  )

  const activePeer = computed(() => activeConversation.value?.peer || null)

  const loadConversations = async () => {
    try {
      const data = await api.listConversations()
      conversations.value = data.conversations || []
    } catch (err) {
      console.error(err)
    }
  }

  const openConversation = async (convId) => {
    error.value = ''
    loading.value = true
    activeConversationId.value = convId
    replyTo.value = null
    searchResults.value = []
    searchQuery.value = ''
    try {
      const [cData, mData] = await Promise.all([
        api.getConversation(convId),
        api.listDMMessages(convId)
      ])
      activeConversation.value = cData.conversation
      messages.value = (mData.messages || []).map((m) => ({
        ...m,
        is_mine: m.is_mine || m.sender_id === myUserId
      }))
      // clear unread locally
      const idx = conversations.value.findIndex((c) => c.id === convId)
      if (idx >= 0) conversations.value[idx].unread_count = 0
      await api.markDMRead(convId).catch(() => {})
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  const startDM = async (userId) => {
    const data = await api.createConversation(userId)
    await loadConversations()
    if (data.conversation?.id) {
      await openConversation(data.conversation.id)
    }
    return data.conversation
  }

  const createGroup = async (memberIds, name) => {
    const ids = Array.isArray(memberIds) ? memberIds.filter(Boolean) : []
    if (ids.length < 1) throw new Error('Select at least one friend')
    const data = await api.createGroupConversation(ids, name || 'Group')
    await loadConversations()
    if (data.conversation?.id) {
      await openConversation(data.conversation.id)
    }
    return data.conversation
  }

  const closeConversation = () => {
    activeConversationId.value = null
    activeConversation.value = null
    messages.value = []
    replyTo.value = null
  }

  const sendMessage = async (content, attachment = null) => {
    if (!activeConversationId.value) return
    const text = (content || '').trim()
    if (!text && !attachment) return
    sending.value = true
    error.value = ''
    try {
      const payload = {
        content: text,
        reply_to_id: replyTo.value?.id || '',
        attachment_url: attachment?.url || '',
        attachment_type: attachment?.type || ''
      }
      const data = await api.sendDMMessage(activeConversationId.value, payload)
      if (data.message) {
        const m = { ...data.message, is_mine: true }
        // avoid dup if ws already delivered
        if (!messages.value.find((x) => x.id === m.id)) {
          messages.value.push(m)
        }
      }
      replyTo.value = null
      await loadConversations()
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      sending.value = false
    }
  }

  const editMessage = async (messageId, content) => {
    const data = await api.updateDMMessage(messageId, content)
    const idx = messages.value.findIndex((m) => m.id === messageId)
    if (idx >= 0 && data.message) {
      messages.value[idx] = { ...messages.value[idx], ...data.message, is_mine: true }
    }
  }

  const deleteMessage = async (messageId) => {
    await api.deleteDMMessage(messageId)
    const idx = messages.value.findIndex((m) => m.id === messageId)
    if (idx >= 0) {
      messages.value[idx] = {
        ...messages.value[idx],
        content: '',
        deleted_at: new Date().toISOString()
      }
    }
  }

  const react = async (messageId, emoji) => {
    const data = await api.reactDMMessage(messageId, emoji)
    const idx = messages.value.findIndex((m) => m.id === messageId)
    if (idx >= 0) {
      messages.value[idx] = { ...messages.value[idx], reactions: data.reactions || [] }
    }
  }

  const searchInConversation = async (q) => {
    searchQuery.value = q
    if (!activeConversationId.value || !q.trim()) {
      searchResults.value = []
      return
    }
    const data = await api.searchDMMessages(activeConversationId.value, q.trim())
    searchResults.value = data.messages || []
  }

  const blockPeer = async () => {
    const peerId = activePeer.value?.id
    if (!peerId) return
    await api.blockUser(peerId)
  }

  // —— Realtime ——
  const wsURL = () => {
    const base = api.url.replace(/^http/, 'ws')
    const token = localStorage.getItem('webcall_token') || ''
    return `${base}/api/ws?token=${encodeURIComponent(token)}`
  }

  const connectRealtime = (userId) => {
    myUserId = userId || myUserId
    intentionalClose = false
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return
    try {
      ws = new WebSocket(wsURL())
    } catch (err) {
      console.error('DM ws', err)
      return
    }
    ws.onmessage = (ev) => {
      let msg
      try {
        msg = JSON.parse(ev.data)
      } catch {
        return
      }
      handleEvent(msg)
    }
    ws.onclose = () => {
      if (!intentionalClose) {
        reconnectTimer = setTimeout(() => connectRealtime(myUserId), 2500)
      }
    }
  }

  const handleEvent = (msg) => {
    switch (msg.type) {
      case 'dm:message': {
        const m = msg.message
        if (!m) break
        m.is_mine = m.sender_id === myUserId
        if (activeConversationId.value === msg.conversation_id) {
          if (!messages.value.find((x) => x.id === m.id)) {
            messages.value.push(m)
          }
          api.markDMRead(msg.conversation_id).catch(() => {})
        }
        // refresh list / unread
        loadConversations()
        break
      }
      case 'dm:update': {
        const m = msg.message
        if (!m) break
        const idx = messages.value.findIndex((x) => x.id === m.id)
        if (idx >= 0) messages.value[idx] = { ...messages.value[idx], ...m }
        break
      }
      case 'dm:delete': {
        const idx = messages.value.findIndex((x) => x.id === msg.message_id)
        if (idx >= 0) {
          messages.value[idx] = {
            ...messages.value[idx],
            content: '',
            deleted_at: new Date().toISOString()
          }
        }
        break
      }
      case 'presence:update':
        // bubble via custom event for app-level friend list
        window.dispatchEvent(new CustomEvent('webcall:presence', { detail: msg }))
        break
      case 'notification:new':
        window.dispatchEvent(new CustomEvent('webcall:notification', { detail: msg.notification || msg }))
        break
      case 'channel:typing':
        window.dispatchEvent(new CustomEvent('webcall:channel-typing', { detail: msg }))
        break
      case 'dm:typing': {
        if (msg.conversation_id === activeConversationId.value && msg.user_id !== myUserId) {
          typingUser.value = msg.user_id
          if (typingTimer) clearTimeout(typingTimer)
          typingTimer = setTimeout(() => {
            typingUser.value = null
          }, 3000)
        }
        break
      }
      case 'dm:read': {
        // could update read ticks later
        break
      }
      case 'dm:reaction': {
        const idx = messages.value.findIndex((x) => x.id === msg.message_id)
        if (idx >= 0) messages.value[idx].reactions = msg.reactions || []
        break
      }
      default:
        break
    }
  }

  const sendRaw = (payload) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    try { ws.send(JSON.stringify(payload)) } catch { /* */ }
  }

  const sendTyping = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    const peerId = activePeer.value?.id
    if (!peerId || !activeConversationId.value) return
    ws.send(
      JSON.stringify({
        type: 'dm:typing',
        conversation_id: activeConversationId.value,
        targets: [peerId]
      })
    )
  }

  const disconnectRealtime = () => {
    intentionalClose = true
    if (reconnectTimer) clearTimeout(reconnectTimer)
    try {
      ws?.close()
    } catch (_) {}
    ws = null
  }

  onBeforeUnmount(() => {
    disconnectRealtime()
  })

  return {
    conversations,
    activeConversationId,
    activeConversation,
    activePeer,
    messages,
    loading,
    sending,
    error,
    typingUser,
    replyTo,
    searchQuery,
    searchResults,
    unreadTotal,
    loadConversations,
    openConversation,
    startDM,
    createGroup,
    closeConversation,
    sendMessage,
    editMessage,
    deleteMessage,
    react,
    searchInConversation,
    blockPeer,
    connectRealtime,
    disconnectRealtime,
    sendTyping,
    sendRaw
  }
}
