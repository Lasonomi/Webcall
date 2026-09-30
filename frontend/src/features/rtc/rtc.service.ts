import { api } from '@/services/api'
import { useRTCStore, type DirectCallMode, type RTCParticipant } from './rtc.store'
import type { User } from '@/types'

type Scope = 'direct' | 'voice'
type PeerMeta = {
  remoteUserId: string
  scope: Scope
  sessionId: string
  initiator: boolean
  mode: DirectCallMode
}

type RTCSignalPayload = {
  type: 'offer' | 'answer' | 'ice'
  sdp?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
}

type IncomingMessage = {
  type: string
  [key: string]: any
}

function makeId(prefix: string) {
  const uuid = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`
  return `${prefix}_${uuid}`
}

function parseIceServers(): RTCIceServer[] {
  const raw = import.meta.env.VITE_RTC_ICE_SERVERS as string | undefined
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed as RTCIceServer[]
    } catch (error) {
      console.warn('Invalid VITE_RTC_ICE_SERVERS:', error)
    }
  }
  return [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ]
}

class WebRTCService {
  private ws: WebSocket | null = null
  private intentionalClose = false
  private reconnectTimer: number | null = null
  private currentUser: User | null = null
  private directLocalStream: MediaStream | null = null
  private voiceLocalStream: MediaStream | null = null
  private peers = new Map<string, RTCPeerConnection>()
  private peerMeta = new Map<string, PeerMeta>()
  private pendingCandidates = new Map<string, RTCIceCandidateInit[]>()
  private callEndsSent = new Set<string>()

  async initialize(user: User) {
    if (this.currentUser?.id === user.id && this.ws && this.ws.readyState === WebSocket.OPEN) return
    this.currentUser = user
    this.intentionalClose = false
    this.ensureSocket()
    useRTCStore.getState().setInitializedUser(user)
  }

  shutdown() {
    this.intentionalClose = true
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    this.closeAllPeerConnections()
    this.stopStream(this.directLocalStream)
    this.stopStream(this.voiceLocalStream)
    this.directLocalStream = null
    this.voiceLocalStream = null
    try {
      this.ws?.close()
    } catch {}
    this.ws = null
    this.currentUser = null
    useRTCStore.getState().reset()
  }

  getDirectLocalStream() {
    return this.directLocalStream
  }

  getVoiceLocalStream() {
    return this.voiceLocalStream
  }

  private ensureSocket() {
    if (!this.currentUser || this.intentionalClose) return
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return

    const token = localStorage.getItem('webcall_token') || ''
    const base = api.url.replace(/^http/, 'ws')
    const url = `${base}/api/ws/voice?token=${encodeURIComponent(token)}`
    useRTCStore.getState().setSocketStatus('connecting')

    try {
      this.ws = new WebSocket(url)
    } catch (error) {
      console.error('RTC WebSocket:', error)
      useRTCStore.getState().setSocketStatus('failed')
      this.scheduleReconnect()
      return
    }

    this.ws.onopen = () => {
      useRTCStore.getState().setSocketStatus('connected')
      const voice = useRTCStore.getState().voice
      if (voice.active && voice.channelId) {
        this.sendVoiceJoin()
      }
    }

    this.ws.onmessage = (event) => {
      try {
        this.handleMessage(JSON.parse(event.data) as IncomingMessage)
      } catch {
        // Ignore malformed signaling messages.
      }
    }

    this.ws.onerror = () => {
      useRTCStore.getState().setSocketStatus('failed')
    }

    this.ws.onclose = () => {
      this.ws = null
      if (this.intentionalClose) {
        useRTCStore.getState().setSocketStatus('disconnected')
        return
      }
      const voice = useRTCStore.getState().voice
      if (voice.active) useRTCStore.getState().patchVoice({ status: 'reconnecting' })
      useRTCStore.getState().setSocketStatus('reconnecting')
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect() {
    if (this.intentionalClose || this.reconnectTimer || !this.currentUser) return
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null
      this.ensureSocket()
    }, 2000)
  }

  private send(payload: Record<string, unknown>) {
    this.ensureSocket()
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false
    this.ws.send(JSON.stringify(payload))
    return true
  }

  private async waitForSocket(timeoutMs = 8000) {
    this.ensureSocket()
    if (this.ws?.readyState === WebSocket.OPEN) return
    await new Promise<void>((resolve, reject) => {
      const ws = this.ws
      if (!ws) {
        reject(new Error('RTC signaling socket is unavailable'))
        return
      }
      const timer = window.setTimeout(() => {
        cleanup()
        reject(new Error('RTC signaling connection timed out'))
      }, timeoutMs)
      const onOpen = () => {
        cleanup()
        resolve()
      }
      const onClose = () => {
        cleanup()
        reject(new Error('RTC signaling connection closed'))
      }
      const cleanup = () => {
        window.clearTimeout(timer)
        ws.removeEventListener('open', onOpen)
        ws.removeEventListener('close', onClose)
      }
      ws.addEventListener('open', onOpen, { once: true })
      ws.addEventListener('close', onClose, { once: true })
    })
  }

  private async ensureStream(kind: 'direct' | 'voice', needsVideo: boolean) {
    const existing = kind === 'direct' ? this.directLocalStream : this.voiceLocalStream
    if (existing) {
      if (needsVideo && !existing.getVideoTracks().length) {
        const camera = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        const track = camera.getVideoTracks()[0]
        if (track) {
          existing.addTrack(track)
          for (const [key, pc] of this.peers) {
            const meta = this.peerMeta.get(key)
            if (meta?.scope !== kind) continue
            pc.addTrack(track, existing)
          }
        }
      }
      return existing
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: needsVideo,
    })

    if (kind === 'direct') {
      this.directLocalStream = stream
      useRTCStore.getState().setDirectLocalStream(stream)
    } else {
      this.voiceLocalStream = stream
      useRTCStore.getState().setVoiceLocalStream(stream)
    }
    return stream
  }

  private stopStream(stream: MediaStream | null) {
    stream?.getTracks().forEach((track) => track.stop())
  }

  private peerKey(scope: Scope, remoteUserId: string) {
    return `${scope}:${remoteUserId}`
  }

  private async createPeer(remoteUserId: string, meta: PeerMeta, stream: MediaStream) {
    const key = this.peerKey(meta.scope, remoteUserId)
    const existing = this.peers.get(key)
    if (existing) return existing

    const pc = new RTCPeerConnection({ iceServers: parseIceServers() })
    this.peers.set(key, pc)
    this.peerMeta.set(key, meta)

    for (const track of stream.getTracks()) {
      pc.addTrack(track, stream)
    }

    pc.onicecandidate = (event) => {
      if (!event.candidate) return
      this.send({
        type: 'rtc:signal',
        scope: meta.scope,
        to: remoteUserId,
        session_id: meta.sessionId,
        channel_id: meta.scope === 'voice' ? meta.sessionId : undefined,
        data: { type: 'ice', candidate: event.candidate.toJSON() },
      })
    }

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0]
      if (!remoteStream) return
      if (meta.scope === 'direct') {
        useRTCStore.getState().setDirectRemoteStream(remoteStream)
        useRTCStore.getState().setDirectCall({
          ...(useRTCStore.getState().directCall as any),
          status: 'connected',
          elapsedStartedAt: useRTCStore.getState().directCall?.elapsedStartedAt || Date.now(),
        })
      } else {
        useRTCStore.getState().setVoiceRemoteStream(remoteUserId, remoteStream)
      }
    }

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      if (state === 'connected' && meta.scope === 'direct') {
        const call = useRTCStore.getState().directCall
        if (call) useRTCStore.getState().setDirectCall({ ...call, status: 'connected', elapsedStartedAt: call.elapsedStartedAt || Date.now() })
      }
      if (state === 'failed' || state === 'closed') {
        this.closePeer(meta.scope, remoteUserId)
      }
    }

    return pc
  }

  private async flushCandidates(key: string, pc: RTCPeerConnection) {
    const list = this.pendingCandidates.get(key)
    if (!list?.length || !pc.remoteDescription) return
    this.pendingCandidates.delete(key)
    for (const candidate of list) {
      try {
        await pc.addIceCandidate(candidate)
      } catch (error) {
        console.warn('ICE candidate rejected:', error)
      }
    }
  }

  private async handleRtcSignal(msg: IncomingMessage) {
    const from = typeof msg.from === 'string' ? msg.from : ''
    if (!from || !this.currentUser) return
    const scope: Scope = msg.scope === 'voice' ? 'voice' : 'direct'
    const sessionId = String(msg.session_id || msg.channel_id || '')
    const data = msg.data as RTCSignalPayload | undefined
    if (!sessionId || !data) return

    if (scope === 'direct') {
      const call = useRTCStore.getState().directCall
      if (!call || call.sessionId !== sessionId || call.peerUserId !== from) return
    } else {
      const voice = useRTCStore.getState().voice
      if (!voice.active || voice.channelId !== msg.channel_id) return
    }

    const key = this.peerKey(scope, from)
    let pc = this.peers.get(key)

    if (data.type === 'offer') {
      const stream = scope === 'direct'
        ? await this.ensureStream('direct', useRTCStore.getState().directCall?.mode === 'video')
        : await this.ensureStream('voice', useRTCStore.getState().voice.cameraOn)

      pc = await this.createPeer(from, {
        remoteUserId: from,
        scope,
        sessionId,
        initiator: false,
        mode: scope === 'direct' ? useRTCStore.getState().directCall?.mode || 'voice' : 'voice',
      }, stream)

      await pc.setRemoteDescription(data.sdp!)
      await this.flushCandidates(key, pc)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      this.send({
        type: 'rtc:signal',
        scope,
        to: from,
        session_id: sessionId,
        channel_id: scope === 'voice' ? msg.channel_id : undefined,
        data: { type: 'answer', sdp: pc.localDescription },
      })
      return
    }

    if (!pc) return

    if (data.type === 'answer') {
      await pc.setRemoteDescription(data.sdp!)
      await this.flushCandidates(key, pc)
      return
    }

    if (data.type === 'ice' && data.candidate) {
      if (pc.remoteDescription) {
        try {
          await pc.addIceCandidate(data.candidate)
        } catch (error) {
          console.warn('ICE candidate add failed:', error)
        }
      } else {
        const pending = this.pendingCandidates.get(key) || []
        pending.push(data.candidate)
        this.pendingCandidates.set(key, pending)
      }
    }
  }

  private async startDirectPeer() {
    const call = useRTCStore.getState().directCall
    if (!call || !this.currentUser) return
    const stream = await this.ensureStream('direct', call.mode === 'video')
    const meta: PeerMeta = {
      remoteUserId: call.peerUserId,
      scope: 'direct',
      sessionId: call.sessionId,
      initiator: true,
      mode: call.mode,
    }
    const pc = await this.createPeer(call.peerUserId, meta, stream)
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    useRTCStore.getState().setDirectCall({ ...call, status: 'connecting' })
    this.send({
      type: 'rtc:signal',
      scope: 'direct',
      to: call.peerUserId,
      session_id: call.sessionId,
      data: { type: 'offer', sdp: pc.localDescription },
    })
  }

  async startDirectCall(targetUserId: string, mode: DirectCallMode, targetName = 'Friend', targetUsername?: string, targetAvatar?: string) {
    const state = useRTCStore.getState()
    if (!this.currentUser) throw new Error('Not authenticated')
    if (state.voice.active) throw new Error('Leave the voice room before starting a direct call.')
    if (state.directCall || state.incomingCall) throw new Error('Another call is already active.')

    await this.ensureStream('direct', mode === 'video')
    await this.waitForSocket()
    const sessionId = makeId('call')
    state.setDirectCall({
      sessionId,
      peerUserId: targetUserId,
      peerName: targetName,
      peerUsername: targetUsername,
      peerAvatar: targetAvatar,
      mode,
      status: 'outgoing',
      muted: false,
      deafened: false,
      cameraOn: mode === 'video',
    })
    this.send({
      type: 'call:invite',
      to: targetUserId,
      session_id: sessionId,
      mode,
    })
  }

  async acceptIncomingCall() {
    const incoming = useRTCStore.getState().incomingCall
    if (!incoming) return
    const store = useRTCStore.getState()
    store.setIncomingCall(null)
    store.setDirectCall({
      sessionId: incoming.sessionId,
      peerUserId: incoming.callerId,
      peerName: incoming.callerName,
      peerUsername: incoming.callerUsername,
      peerAvatar: incoming.callerAvatar,
      mode: incoming.mode,
      status: 'connecting',
      muted: false,
      deafened: false,
      cameraOn: incoming.mode === 'video',
    })
    try {
      await this.ensureStream('direct', incoming.mode === 'video')
      await this.waitForSocket()
      this.send({ type: 'call:accept', to: incoming.callerId, session_id: incoming.sessionId })
    } catch (error) {
      this.rejectIncomingCall(incoming.callerId, incoming.sessionId)
      throw error
    }
  }

  rejectIncomingCall(targetUserId?: string, sessionId?: string) {
    const incoming = useRTCStore.getState().incomingCall
    const to = targetUserId || incoming?.callerId
    const sid = sessionId || incoming?.sessionId
    if (to && sid) this.send({ type: 'call:reject', to, session_id: sid })
    useRTCStore.getState().setIncomingCall(null)
  }

  endDirectCall(notify = true) {
    const call = useRTCStore.getState().directCall
    if (!call) return
    if (notify && !this.callEndsSent.has(call.sessionId)) {
      this.callEndsSent.add(call.sessionId)
      this.send({ type: 'call:end', to: call.peerUserId, session_id: call.sessionId })
    }
    this.closePeer('direct', call.peerUserId)
    this.stopStream(this.directLocalStream)
    this.directLocalStream = null
    useRTCStore.getState().setDirectLocalStream(null)
    useRTCStore.getState().setDirectRemoteStream(null)
    useRTCStore.getState().setDirectCall(null)
    window.setTimeout(() => this.callEndsSent.delete(call.sessionId), 1000)
  }

  private handleCallSignal(msg: IncomingMessage) {
    const from = String(msg.from || '')
    const sessionId = String(msg.session_id || '')
    if (!from || !sessionId) return

    switch (msg.type) {
      case 'call:invite': {
        const state = useRTCStore.getState()
        if (state.directCall || state.incomingCall || state.voice.active) {
          this.send({ type: 'call:busy', to: from, session_id: sessionId })
          return
        }
        state.setIncomingCall({
          sessionId,
          callerId: from,
          callerName: msg.from_user?.display_name || msg.from_user?.username || 'Incoming caller',
          callerUsername: msg.from_user?.username,
          callerAvatar: msg.from_user?.avatar_url,
          mode: msg.mode === 'video' ? 'video' : 'voice',
        })
        return
      }
      case 'call:accept': {
        const call = useRTCStore.getState().directCall
        if (!call || call.sessionId !== sessionId || call.peerUserId !== from || call.status !== 'outgoing') return
        void this.startDirectPeer().catch((error) => {
          console.error('Start direct peer failed:', error)
          this.endDirectCall(false)
        })
        return
      }
      case 'call:reject':
      case 'call:cancel':
      case 'call:busy':
      case 'call:end': {
        const call = useRTCStore.getState().directCall
        if (call?.sessionId === sessionId && call.peerUserId === from) {
          this.endDirectCall(false)
        }
        const incoming = useRTCStore.getState().incomingCall
        if (incoming?.sessionId === sessionId && incoming.callerId === from) {
          useRTCStore.getState().setIncomingCall(null)
        }
        return
      }
      default:
        return
    }
  }

  private async connectVoicePeer(participant: RTCParticipant) {
    const voice = useRTCStore.getState().voice
    if (!this.currentUser || !voice.active || !voice.channelId || participant.user_id === this.currentUser.id) return
    const remoteUserId = participant.user_id
    const key = this.peerKey('voice', remoteUserId)
    if (this.peers.has(key)) return

    const stream = await this.ensureStream('voice', voice.cameraOn)
    const meta: PeerMeta = {
      remoteUserId,
      scope: 'voice',
      sessionId: voice.channelId,
      initiator: this.currentUser.id < remoteUserId,
      mode: 'voice',
    }
    if (!meta.initiator) return

    const pc = await this.createPeer(remoteUserId, meta, stream)
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    this.send({
      type: 'rtc:signal',
      scope: 'voice',
      to: remoteUserId,
      session_id: voice.channelId,
      channel_id: voice.channelId,
      data: { type: 'offer', sdp: pc.localDescription },
    })
  }

  private sendVoiceJoin() {
    const voice = useRTCStore.getState().voice
    if (!voice.active || !voice.channelId || !voice.serverId || !this.currentUser) return
    this.send({
      type: 'voice:join',
      channel_id: voice.channelId,
      server_id: voice.serverId,
      peer_id: this.currentUser.id,
      muted: voice.muted,
      deafened: voice.deafened,
    })
  }

  async joinVoice(params: { channelId: string; channelName: string; serverId: string; serverName: string; allowVideo?: boolean }) {
    const state = useRTCStore.getState()
    if (!this.currentUser) throw new Error('Not authenticated')
    if (state.directCall) throw new Error('End the direct call before joining a voice room.')
    if (state.voice.active && state.voice.channelId === params.channelId) return

    if (state.voice.active) await this.leaveVoice()
    await api.voiceJoin(params.channelId)
    await this.ensureStream('voice', false)
    await this.waitForSocket()
    useRTCStore.getState().patchVoice({
      active: true,
      status: 'connecting',
      channelId: params.channelId,
      channelName: params.channelName,
      serverId: params.serverId,
      serverName: params.serverName,
      allowVideo: Boolean(params.allowVideo),
      error: '',
      muted: false,
      deafened: false,
      cameraOn: false,
    })
    this.sendVoiceJoin()
  }

  async leaveVoice() {
    const voice = useRTCStore.getState().voice
    if (!voice.active) return
    this.send({ type: 'voice:leave' })
    for (const [key, meta] of [...this.peerMeta.entries()]) {
      if (meta.scope === 'voice') this.closePeer('voice', meta.remoteUserId)
      if (key.startsWith('voice:')) this.pendingCandidates.delete(key)
    }
    this.stopStream(this.voiceLocalStream)
    this.voiceLocalStream = null
    useRTCStore.getState().setVoiceLocalStream(null)
    useRTCStore.getState().clearVoiceRemoteStreams()
    useRTCStore.getState().patchVoice({ ...useRTCStore.getState().voice, ...{
      active: false,
      status: 'disconnected',
      channelId: null,
      channelName: '',
      serverId: null,
      serverName: '',
      allowVideo: false,
      participants: [],
      muted: false,
      deafened: false,
      cameraOn: false,
      screenSharing: false,
      error: '',
    } })
  }

  async toggleMute() {
    const state = useRTCStore.getState()
    const stream = state.directCall ? this.directLocalStream : this.voiceLocalStream
    const track = stream?.getAudioTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    const muted = !track.enabled
    if (state.directCall) {
      state.setDirectCall({ ...state.directCall, muted })
    } else if (state.voice.active) {
      state.patchVoice({ muted })
      this.send({ type: muted ? 'voice:mute' : 'voice:unmute' })
    }
  }

  async toggleDeafen() {
    const state = useRTCStore.getState()
    if (state.directCall) {
      state.setDirectCall({ ...state.directCall, deafened: !state.directCall.deafened })
      return
    }
    if (!state.voice.active) return
    state.patchVoice({ deafened: !state.voice.deafened })
    this.send({ type: state.voice.deafened ? 'voice:deafen' : 'voice:undeafen' })
  }


  async toggleCamera() {
    const state = useRTCStore.getState()
    const scope: 'direct' | 'voice' | null = state.directCall ? 'direct' : state.voice.active ? 'voice' : null
    if (!scope) return
    if (scope === 'voice' && !state.voice.allowVideo) throw new Error('Video is disabled in this voice channel.')

    const stream = await this.ensureStream(scope, true)
    const track = stream.getVideoTracks()[0]
    if (!track) return

    const hadVideoTrack = stream.getVideoTracks().length > 0
    const cameraOn = hadVideoTrack ? !track.enabled : true
    track.enabled = cameraOn

    for (const [key, pc] of this.peers) {
      const meta = this.peerMeta.get(key)
      if (meta?.scope !== scope) continue
      const sender = pc.getSenders().find((item) => item.track?.kind === 'video')
      if (!sender) {
        pc.addTrack(track, stream)
      } else {
        await sender.replaceTrack(track)
      }
      if (pc.connectionState === 'connected') {
        await this.renegotiate(meta, pc)
      }
    }

    if (scope === 'direct') {
      const call = state.directCall
      if (call) useRTCStore.getState().setDirectCall({ ...call, cameraOn })
    } else {
      useRTCStore.getState().patchVoice({ cameraOn })
    }
  }

  private async renegotiate(meta: PeerMeta, pc: RTCPeerConnection) {
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    this.send({
      type: 'rtc:signal',
      scope: meta.scope,
      to: meta.remoteUserId,
      session_id: meta.sessionId,
      channel_id: meta.scope === 'voice' ? meta.sessionId : undefined,
      data: { type: 'offer', sdp: pc.localDescription },
    })
  }

  private async handleMessage(msg: IncomingMessage) {
    switch (msg.type) {
      case 'call:invite':
      case 'call:accept':
      case 'call:reject':
      case 'call:cancel':
      case 'call:busy':
      case 'call:end':
        this.handleCallSignal(msg)
        return
      case 'rtc:signal':
        void this.handleRtcSignal(msg).catch((error) => console.error('RTC signal handling failed:', error))
        return
      case 'voice:joined': {
        const participants = (msg.participants || []) as RTCParticipant[]
        useRTCStore.getState().patchVoice({ participants, status: 'connected', error: '' })
        for (const participant of participants) {
          if (participant.user_id !== this.currentUser?.id && this.currentUser && this.currentUser.id < participant.user_id) {
            void this.connectVoicePeer(participant).catch((error) => console.error('Voice peer failed:', error))
          }
        }
        return
      }
      case 'voice:join': {
        const participants = (msg.participants || []) as RTCParticipant[]
        useRTCStore.getState().patchVoice({ participants })
        if (msg.user && this.currentUser && this.currentUser.id < String(msg.user.user_id)) {
          void this.connectVoicePeer(msg.user as RTCParticipant).catch((error) => console.error('Voice peer failed:', error))
        }
        return
      }
      case 'voice:leave': {
        useRTCStore.getState().patchVoice({ participants: (msg.participants || []) as RTCParticipant[] })
        if (msg.user?.user_id) this.closePeer('voice', String(msg.user.user_id))
        return
      }
      case 'voice:state': {
        useRTCStore.getState().patchVoice({ participants: (msg.participants || []) as RTCParticipant[] })
        return
      }
      case 'voice:left':
        return
      case 'error':
        useRTCStore.getState().patchVoice({ error: msg.message || 'RTC error', status: 'failed' })
        return
      default:
        return
    }
  }

  private closePeer(scope: Scope, remoteUserId: string) {
    const key = this.peerKey(scope, remoteUserId)
    const pc = this.peers.get(key)
    if (pc) {
      try { pc.ontrack = null } catch {}
      try { pc.close() } catch {}
    }
    this.peers.delete(key)
    this.peerMeta.delete(key)
    this.pendingCandidates.delete(key)
    if (scope === 'voice') useRTCStore.getState().removeVoiceRemoteStream(remoteUserId)
    if (scope === 'direct') useRTCStore.getState().setDirectRemoteStream(null)
  }

  private closeAllPeerConnections() {
    for (const [key, pc] of this.peers) {
      try { pc.close() } catch {}
      this.peers.delete(key)
    }
    this.peerMeta.clear()
    this.pendingCandidates.clear()
  }
}

export const rtcService = new WebRTCService()
