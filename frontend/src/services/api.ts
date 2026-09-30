const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '')

async function request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {})
  if (!(options.body instanceof FormData) && options.body != null) {
    headers.set('Content-Type', 'application/json')
  }
  const token = localStorage.getItem('webcall_token')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(`${API_URL}${path}`, { ...options, headers })
  const text = await res.text()
  let data: any = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { error: text || res.statusText }
  }
  if (!res.ok) throw new Error(data.error || data.message || res.statusText)
  return data as T
}

export const api = {
  url: API_URL,

  // Auth — backend expects { login, password } not username
  login: (login: string, password: string) =>
    request<{ token: string; user: any }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    }),
  register: (p: { username: string; email: string; password: string; display_name: string }) =>
    request<{ token: string; user: any }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(p),
    }),
  me: () => request<{ user: any }>('/api/me'),

  // Profile
  getMyProfile: () => request<{ profile: any }>('/api/me/profile'),
  updateMyProfile: (p: Record<string, string>) =>
    request<{ profile: any }>('/api/me/profile', { method: 'PATCH', body: JSON.stringify(p) }),
  listBlocked: () => request<{ blocked: any[] }>('/api/users/blocked'),
  unblockUser: (id: string) => request(`/api/users/${id}/block`, { method: 'DELETE' }),
  getPublicProfile: (id: string) => request<{ profile: any }>(`/api/users/${id}/profile`),

  // Users / friends
  searchUsers: (q: string) => request<{ users: any[] }>(`/api/users?q=${encodeURIComponent(q)}`),
  friends: () => request<{ friends: any[] }>('/api/friends'),
  requests: () => request<{ requests: any[] }>('/api/friends/requests'),
  requestFriend: (userId: string) =>
    request('/api/friends/request', { method: 'POST', body: JSON.stringify({ user_id: userId }) }),
  acceptFriend: (userId: string) =>
    request('/api/friends/accept', { method: 'POST', body: JSON.stringify({ user_id: userId }) }),
  rejectFriend: (userId: string) =>
    request('/api/friends/reject', { method: 'POST', body: JSON.stringify({ user_id: userId }) }),

  // DM
  listConversations: () => request<{ conversations: any[] }>('/api/conversations'),
  createConversation: (userId: string) =>
    request<{ conversation: any }>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),
  getConversation: (id: string) => request<{ conversation: any }>(`/api/conversations/${id}`),
  listDMMessages: (id: string, params?: { limit?: number; before?: string }) => {
    const q = new URLSearchParams()
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.before) q.set('before', params.before)
    const qs = q.toString()
    return request<{ messages: any[] }>(`/api/conversations/${id}/messages${qs ? `?${qs}` : ''}`)
  },
  sendDMMessage: (id: string, body: object) =>
    request<{ message: any }>(`/api/conversations/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // Servers
  listServers: () => request<{ servers: any[] }>('/api/servers'),

  // Voice / WebRTC
  voiceJoin: (channelId: string) =>
    request<{ ok: boolean; channel_id: string; channel_name: string; server_id: string; participants: any[] }>(`/api/voice/${channelId}/join`, { method: 'POST' }),
  voiceLeave: (channelId: string) =>
    request<{ ok: boolean; channel_id: string }>(`/api/voice/${channelId}/leave`, { method: 'POST' }),
  voiceParticipants: (channelId: string) =>
    request<{ participants: any[] }>(`/api/voice/${channelId}/participants`),
  createServer: (p: object) =>
    request('/api/servers', { method: 'POST', body: JSON.stringify(p) }),
  getServer: (id: string) => request<any>(`/api/servers/${id}`),
  joinByInvite: (code: string) =>
    request('/api/servers/join', { method: 'POST', body: JSON.stringify({ code }) }),
  listMembers: (id: string) => request<{ members: any[] }>(`/api/servers/${id}/members`),
  listChannelMessages: (sid: string, cid: string) =>
    request<{ messages: any[] }>(`/api/servers/${sid}/channels/${cid}/messages`),
  createChannel: (sid: string, body: object) =>
    request(`/api/servers/${sid}/channels`, { method: 'POST', body: JSON.stringify(body) }),
  updateChannel: (sid: string, cid: string, body: object) =>
    request(`/api/servers/${sid}/channels/${cid}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteChannel: (sid: string, cid: string) =>
    request(`/api/servers/${sid}/channels/${cid}`, { method: 'DELETE' }),
  updateServer: (sid: string, body: object) =>
    request(`/api/servers/${sid}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteServer: (sid: string) =>
    request(`/api/servers/${sid}`, { method: 'DELETE' }),
  createInvite: (sid: string) =>
    request(`/api/servers/${sid}/invites`, { method: 'POST', body: JSON.stringify({}) }),
  setMemberRole: (sid: string, userId: string, role: string) =>
    request(`/api/servers/${sid}/members/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),
  createChannelMessage: (sid: string, cid: string, body: object) =>
    request(`/api/servers/${sid}/channels/${cid}/messages`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  uploadFile: async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const token = localStorage.getItem('webcall_token')
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`
    const res = await fetch(`${API_URL}/api/upload`, { method: 'POST', headers, body: form })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error((data as any).error || 'Upload failed (max 15MB)')
    return data as { url: string; type?: string; filename?: string; mime?: string }
  },
}
