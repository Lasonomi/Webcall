export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '')

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {})
  headers.set('Content-Type', 'application/json')

  const token = localStorage.getItem('webcall_token')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${API_URL}${path}`, { ...options, headers })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = data.error || data.message || response.statusText || 'unknown'
    throw new Error(`${detail} [${response.status} ${options.method || 'GET'} ${path}]`)
  }
  return data
}

export const api = {
  url: API_URL,
  register(payload) {
    return request('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) })
  },
  login(payload) {
    return request('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) })
  },
  me() {
    return request('/api/me')
  },
  updatePeer(peerId) {
    return request('/api/me/peer', { method: 'POST', body: JSON.stringify({ peer_id: peerId }) })
  },
  clearPeer() {
    return request('/api/me/peer', { method: 'DELETE' })
  },
  friends() {
    return request('/api/friends')
  },
  requests() {
    return request('/api/friends/requests')
  },
  searchUsers(q) {
    return request(`/api/users?q=${encodeURIComponent(q)}`)
  },
  requestFriend(userId) {
    return request('/api/friends/request', { method: 'POST', body: JSON.stringify({ user_id: userId }) })
  },
  acceptFriend(userId) {
    return request('/api/friends/accept', { method: 'POST', body: JSON.stringify({ user_id: userId }) })
  },
  rejectFriend(userId) {
    return request('/api/friends/reject', { method: 'POST', body: JSON.stringify({ user_id: userId }) })
  },
  removeFriend(userId) {
    return request(`/api/friends/${encodeURIComponent(userId)}`, { method: 'DELETE' })
  },

  // —— Servers / Community ——
  listServers() {
    return request('/api/servers')
  },
  createServer(payload) {
    return request('/api/servers', { method: 'POST', body: JSON.stringify(payload) })
  },
  getServer(id) {
    return request(`/api/servers/${encodeURIComponent(id)}`)
  },
  updateServer(id, payload) {
    return request(`/api/servers/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) })
  },
  deleteServer(id) {
    return request(`/api/servers/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },
  joinServer(id) {
    return request(`/api/servers/${encodeURIComponent(id)}/join`, { method: 'POST' })
  },
  joinServerByInvite(code) {
    return request('/api/servers/join', { method: 'POST', body: JSON.stringify({ code }) })
  },
  leaveServer(id) {
    return request(`/api/servers/${encodeURIComponent(id)}/leave`, { method: 'POST' })
  },
  createInvite(id, maxUses = 0) {
    return request(`/api/servers/${encodeURIComponent(id)}/invites`, {
      method: 'POST',
      body: JSON.stringify({ max_uses: maxUses })
    })
  },
  listInvites(id) {
    return request(`/api/servers/${encodeURIComponent(id)}/invites`)
  },
  listMembers(id) {
    return request(`/api/servers/${encodeURIComponent(id)}/members`)
  },
  listChannelMessages(serverId, channelId) {
    return request(`/api/servers/${encodeURIComponent(serverId)}/channels/${encodeURIComponent(channelId)}/messages`)
  },
  
  // —— Voice ——
  voiceJoin(channelId) {
    return request(`/api/voice/${encodeURIComponent(channelId)}/join`, { method: 'POST' })
  },
  voiceLeave(channelId) {
    return request(`/api/voice/${encodeURIComponent(channelId)}/leave`, { method: 'POST' })
  },
  voiceParticipants(channelId) {
    return request(`/api/voice/${encodeURIComponent(channelId)}/participants`)
  }

  ,
  // —— Direct Messages ——
  listConversations() {
    return request('/api/conversations')
  },
  createConversation(userId) {
    return request('/api/conversations', { method: 'POST', body: JSON.stringify({ user_id: userId }) })
  },
  getConversation(id) {
    return request(`/api/conversations/${encodeURIComponent(id)}`)
  },
  listDMMessages(id) {
    return request(`/api/conversations/${encodeURIComponent(id)}/messages`)
  },
  sendDMMessage(id, payload) {
    return request(`/api/conversations/${encodeURIComponent(id)}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  },
  markDMRead(id) {
    return request(`/api/conversations/${encodeURIComponent(id)}/read`, { method: 'POST' })
  },
  searchDMMessages(id, q) {
    return request(`/api/conversations/${encodeURIComponent(id)}/search?q=${encodeURIComponent(q)}`)
  },
  updateDMMessage(id, content) {
    return request(`/api/messages/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ content })
    })
  },
  deleteDMMessage(id) {
    return request(`/api/messages/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },
  reactDMMessage(id, emoji) {
    return request(`/api/messages/${encodeURIComponent(id)}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji })
    })
  },
  blockUser(id) {
    return request(`/api/users/${encodeURIComponent(id)}/block`, { method: 'POST' })
  },
  unblockUser(id) {
    return request(`/api/users/${encodeURIComponent(id)}/block`, { method: 'DELETE' })
  },
  listBlocked() {
    return request('/api/users/blocked')
  }

  ,
  getMyProfile() {
    return request('/api/me/profile')
  },
  updateMyProfile(payload) {
    return request('/api/me/profile', { method: 'PATCH', body: JSON.stringify(payload) })
  },
  getPublicProfile(userId) {
    return request(`/api/users/${encodeURIComponent(userId)}/profile`)
  },
  cancelFriendRequest(userId) {
    return request(`/api/friends/request/${encodeURIComponent(userId)}`, { method: 'DELETE' })
  }

  ,
  uploadFile(file) {
    const form = new FormData()
    form.append('file', file)
    const token = localStorage.getItem('webcall_token')
    const headers = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    return fetch(`${API_URL}/api/upload`, { method: 'POST', headers, body: form }).then(async (response) => {
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || data.message || 'upload failed')
      // absolute URL for display
      if (data.url && data.url.startsWith('/')) data.full_url = `${API_URL}${data.url}`
      else data.full_url = data.url
      return data
    })
  },
  createChannelMessage(serverId, channelId, payload) {
    const body = typeof payload === 'string' ? { content: payload } : payload
    return request(`/api/servers/${encodeURIComponent(serverId)}/channels/${encodeURIComponent(channelId)}/messages`, {
      method: 'POST',
      body: JSON.stringify(body)
    })
  },
  updateChannelMessage(messageId, content) {
    return request(`/api/channel-messages/${encodeURIComponent(messageId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ content })
    })
  },
  deleteChannelMessage(messageId) {
    return request(`/api/channel-messages/${encodeURIComponent(messageId)}`, { method: 'DELETE' })
  },
  reactChannelMessage(messageId, emoji) {
    return request(`/api/channel-messages/${encodeURIComponent(messageId)}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji })
    })
  }
,
  listNotifications() {
    return request('/api/notifications')
  },
  markNotificationRead(id) {
    return request(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' })
  },
  markAllNotificationsRead() {
    return request('/api/notifications/read-all', { method: 'POST' })
  },
  onlineUsers() {
    return request('/api/presence/online')
  },
  createGroupConversation(memberIds, name) {
    return request('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ type: 'group', member_ids: memberIds, name })
    })
  }
}
