import { ref, computed, onBeforeUnmount } from 'vue'
import Peer from 'peerjs'
import { api } from '../lib/api'

/**
 * Persistent multi-party voice session (Discord-style).
 * Stays connected while the user navigates servers, DMs, or home.
 * Only explicit leave() tears down media + peer connections.
 *
 * Media: WebRTC via PeerJS mesh (P2P). Signaling/presence via WebSocket.
 */
export function useVoiceChannel() {
  const connectionState = ref('Disconnected') // Connecting | Connected | Reconnecting | Disconnected
  const channelId = ref(null)
  const channelName = ref('')
  const serverId = ref(null)
  const serverName = ref('')
  const participants = ref([])
  const isMuted = ref(false)
  const isDeafened = ref(false)
  const isCameraOn = ref(false)
  const isScreenSharing = ref(false)
  const error = ref('')
  const myPeerId = ref('')
  const myUserId = ref('')
  const localPreviewStream = ref(null) // for local video/screen preview UI

  let ws = null
  let peer = null
  let localStream = null // outbound MediaStream (audio + optional video/screen)
  let screenStream = null
  let calls = new Map() // peerId -> MediaConnection
  let remoteAudios = new Map()
  let remoteVideos = new Map() // peerId -> MediaStream (video track if any)
  let intentionalLeave = false
  let reconnectTimer = null
  let joinPayload = null
  let onRemoteVideo = null // optional UI callback

  const isInVoice = computed(
    () =>
      connectionState.value === 'Connected' ||
      connectionState.value === 'Connecting' ||
      connectionState.value === 'Reconnecting'
  )

  const ensurePeer = () => {
    if (peer && !peer.destroyed) return peer
    peer = new Peer({
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    })
    peer.on('open', (id) => {
      myPeerId.value = id
    })
    peer.on('call', async (call) => {
      try {
        const stream = await ensureOutboundStream()
        call.answer(stream)
        bindIncomingCall(call)
      } catch (err) {
        console.error('answer voice call', err)
        call.close()
      }
    })
    peer.on('error', (err) => {
      console.error('PeerJS voice:', err)
      if (String(err?.type || err?.message || '').includes('unavailable')) {
        error.value = 'Peer connection unavailable. Try rejoining.'
      }
    })
    peer.on('disconnected', () => {
      if (!intentionalLeave && channelId.value) {
        connectionState.value = 'Reconnecting'
        try {
          peer.reconnect()
        } catch (_) {}
      }
    })
    return peer
  }

  const waitPeerOpen = () =>
    new Promise((resolve, reject) => {
      const p = ensurePeer()
      if (p.id) {
        myPeerId.value = p.id
        resolve(p.id)
        return
      }
      const t = setTimeout(() => reject(new Error('PeerJS timeout')), 15000)
      p.once('open', (id) => {
        clearTimeout(t)
        myPeerId.value = id
        resolve(id)
      })
      p.once('error', (err) => {
        clearTimeout(t)
        reject(err)
      })
    })

  const ensureAudioTrack = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      })
      const track = s.getAudioTracks()[0]
      track.enabled = !isMuted.value && !isDeafened.value
      return track
    } catch (err) {
      const name = err?.name || ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        throw new Error('Microphone permission denied. Allow mic access in the browser.')
      }
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        throw new Error('No microphone found. Plug in a mic and try again.')
      }
      if (name === 'NotReadableError') {
        throw new Error('Microphone is busy or unavailable.')
      }
      throw new Error(err?.message || 'Failed to access microphone')
    }
  }

  /** Build / refresh the outbound MediaStream used for all peer connections. */
  const ensureOutboundStream = async () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((t) => {
        t.enabled = !isMuted.value && !isDeafened.value
      })
      return localStream
    }
    const audioTrack = await ensureAudioTrack()
    localStream = new MediaStream([audioTrack])
    syncPreview()
    return localStream
  }

  const syncPreview = () => {
    if (!localStream) {
      localPreviewStream.value = null
      return
    }
    // Preview prefers screen, then camera video + audio
    localPreviewStream.value = localStream
  }

  const replaceTrackOnCalls = async (kind, newTrack) => {
    for (const call of calls.values()) {
      const pc = call.peerConnection
      if (!pc) continue
      const sender = pc.getSenders().find((s) => s.track && s.track.kind === kind)
      if (sender) {
        try {
          await sender.replaceTrack(newTrack)
        } catch (err) {
          console.error('replaceTrack', err)
        }
      } else if (newTrack) {
        try {
          pc.addTrack(newTrack, localStream)
        } catch (err) {
          console.error('addTrack', err)
        }
      }
    }
  }

  const playRemoteAudio = (peerId, stream) => {
    const audioTracks = stream.getAudioTracks()
    if (!audioTracks.length) return
    let audio = remoteAudios.get(peerId)
    if (!audio) {
      audio = new Audio()
      audio.autoplay = true
      audio.playsInline = true
      remoteAudios.set(peerId, audio)
    }
    const audioOnly = new MediaStream(audioTracks)
    audio.srcObject = audioOnly
    audio.muted = isDeafened.value
    audio.play().catch(() => {})
  }

  const handleRemoteStream = (peerId, stream) => {
    playRemoteAudio(peerId, stream)
    if (stream.getVideoTracks().length) {
      remoteVideos.set(peerId, stream)
      if (onRemoteVideo) onRemoteVideo(peerId, stream)
    }
  }

  const stopRemote = (peerId) => {
    const audio = remoteAudios.get(peerId)
    if (audio) {
      audio.pause()
      audio.srcObject = null
      remoteAudios.delete(peerId)
    }
    remoteVideos.delete(peerId)
  }

  const bindIncomingCall = (call) => {
    const remotePeer = call.peer
    calls.set(remotePeer, call)
    call.on('stream', (stream) => handleRemoteStream(remotePeer, stream))
    call.on('close', () => {
      calls.delete(remotePeer)
      stopRemote(remotePeer)
    })
    call.on('error', () => {
      calls.delete(remotePeer)
      stopRemote(remotePeer)
    })
  }

  const callPeer = async (remotePeerId) => {
    if (!remotePeerId || remotePeerId === myPeerId.value) return
    if (calls.has(remotePeerId)) return
    const stream = await ensureOutboundStream()
    const p = ensurePeer()
    // Smaller peer id initiates to avoid glare
    if (myPeerId.value > remotePeerId) return
    try {
      const call = p.call(remotePeerId, stream)
      if (!call) return
      bindIncomingCall(call)
    } catch (err) {
      console.error('call peer', err)
    }
  }

  const meshWithParticipants = async (list) => {
    for (const p of list || []) {
      if (p.user_id === myUserId.value) continue
      if (p.peer_id) await callPeer(p.peer_id)
    }
  }

  const closeAllCalls = () => {
    for (const [, call] of calls) {
      try {
        call.close()
      } catch (_) {}
    }
    calls.clear()
    for (const peerId of [...remoteAudios.keys()]) stopRemote(peerId)
    remoteVideos.clear()
  }

  const wsURL = () => {
    const base = api.url.replace(/^http/, 'ws')
    const token = localStorage.getItem('webcall_token') || ''
    return `${base}/api/ws/voice?token=${encodeURIComponent(token)}`
  }

  const connectWS = () =>
    new Promise((resolve, reject) => {
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        if (ws.readyState === WebSocket.OPEN) resolve()
        else {
          ws.addEventListener('open', () => resolve(), { once: true })
          ws.addEventListener('error', () => reject(new Error('WebSocket failed')), { once: true })
        }
        return
      }
      try {
        ws = new WebSocket(wsURL())
      } catch (err) {
        reject(err)
        return
      }
      const timeout = setTimeout(() => reject(new Error('WebSocket timeout')), 12000)
      ws.onopen = () => {
        clearTimeout(timeout)
        resolve()
      }
      ws.onerror = () => {
        clearTimeout(timeout)
        reject(new Error('WebSocket connection failed'))
      }
      ws.onclose = () => {
        if (!intentionalLeave && channelId.value) {
          connectionState.value = 'Reconnecting'
          scheduleReconnect()
        } else if (!channelId.value) {
          connectionState.value = 'Disconnected'
        }
      }
      ws.onmessage = (ev) => {
        let msg
        try {
          msg = JSON.parse(ev.data)
        } catch {
          return
        }
        handleSignal(msg)
      }
    })

  const scheduleReconnect = () => {
    if (reconnectTimer) return
    reconnectTimer = setTimeout(async () => {
      reconnectTimer = null
      if (intentionalLeave || !joinPayload) return
      try {
        await connectWS()
        sendWS(joinPayload)
        connectionState.value = 'Connected'
      } catch {
        connectionState.value = 'Reconnecting'
        scheduleReconnect()
      }
    }, 2000)
  }

  const sendWS = (obj) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj))
    }
  }

  const handleSignal = (msg) => {
    switch (msg.type) {
      case 'voice:joined':
        participants.value = msg.participants || []
        connectionState.value = 'Connected'
        meshWithParticipants(msg.participants)
        break
      case 'voice:join':
        participants.value = msg.participants || participants.value
        if (msg.user?.peer_id) callPeer(msg.user.peer_id)
        break
      case 'voice:leave':
        participants.value = msg.participants || participants.value
        if (msg.user?.peer_id) {
          const call = calls.get(msg.user.peer_id)
          if (call) {
            try {
              call.close()
            } catch (_) {}
            calls.delete(msg.user.peer_id)
          }
          stopRemote(msg.user.peer_id)
        }
        break
      case 'voice:state':
        participants.value = msg.participants || participants.value
        break
      case 'error':
        error.value = msg.message || 'Voice error'
        break
      default:
        break
    }
  }

  /**
   * Join a voice channel. If already in another channel, switches rooms
   * but keeps the peer identity when possible.
   */
  const join = async ({ channelId: cid, channelName: cname, serverId: sid, serverName: sname, userId }) => {
    error.value = ''
    intentionalLeave = false
    myUserId.value = userId || myUserId.value || ''
    connectionState.value = 'Connecting'

    // Switching channels: drop old peer mesh, keep mic/camera tracks
    if (channelId.value && channelId.value !== cid) {
      closeAllCalls()
      sendWS({ type: 'voice:leave' })
    }

    channelId.value = cid
    channelName.value = cname || 'Voice'
    serverId.value = sid
    serverName.value = sname || ''

    try {
      if (!cid) throw new Error('channel id is missing')
      await api.voiceJoin(cid)
      await waitPeerOpen()
      await ensureOutboundStream()
      await connectWS()

      joinPayload = {
        type: 'voice:join',
        channel_id: cid,
        server_id: sid,
        peer_id: myPeerId.value,
        muted: isMuted.value,
        deafened: isDeafened.value
      }
      sendWS(joinPayload)
      setTimeout(() => {
        if (connectionState.value === 'Connecting') connectionState.value = 'Connected'
      }, 2500)
    } catch (err) {
      error.value = err.message || 'Failed to join voice'
      connectionState.value = 'Disconnected'
      // Keep peer alive for retry; only clear room ids
      channelId.value = null
      throw err
    }
  }

  /** Explicit leave — closes ALL media connections (audio, camera, screen). */
  const leave = async () => {
    intentionalLeave = true
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    sendWS({ type: 'voice:leave' })
    if (channelId.value) {
      try {
        await api.voiceLeave(channelId.value)
      } catch (_) {}
    }
    await cleanupMedia(true)
    channelId.value = null
    channelName.value = ''
    serverId.value = null
    serverName.value = ''
    participants.value = []
    joinPayload = null
    isCameraOn.value = false
    isScreenSharing.value = false
    connectionState.value = 'Disconnected'
  }

  const cleanupMedia = async (closePeer) => {
    closeAllCalls()
    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop())
      screenStream = null
    }
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop())
      localStream = null
    }
    localPreviewStream.value = null
    if (ws) {
      try {
        ws.close()
      } catch (_) {}
      ws = null
    }
    if (closePeer && peer) {
      try {
        peer.destroy()
      } catch (_) {}
      peer = null
      myPeerId.value = ''
    }
  }

  const setMuted = (value) => {
    isMuted.value = !!value
    if (localStream) {
      localStream.getAudioTracks().forEach((t) => {
        t.enabled = !isMuted.value && !isDeafened.value
      })
    }
    sendWS({ type: 'voice:state', muted: isMuted.value, deafened: isDeafened.value })
  }

  const toggleMute = () => setMuted(!isMuted.value)

  const setDeafened = (value) => {
    isDeafened.value = !!value
    if (isDeafened.value) isMuted.value = true
    if (localStream) {
      localStream.getAudioTracks().forEach((t) => {
        t.enabled = !isMuted.value && !isDeafened.value
      })
    }
    for (const audio of remoteAudios.values()) {
      audio.muted = isDeafened.value
    }
    sendWS({ type: 'voice:state', muted: isMuted.value, deafened: isDeafened.value })
  }

  const toggleDeafen = () => setDeafened(!isDeafened.value)

  /** Toggle camera — adds/replaces video track on existing peer connections. */
  const toggleCamera = async () => {
    error.value = ''
    try {
      if (isCameraOn.value) {
        // Turn off camera
        const vids = localStream?.getVideoTracks() || []
        for (const t of vids) {
          t.stop()
          localStream.removeTrack(t)
          await replaceTrackOnCalls('video', null)
        }
        isCameraOn.value = false
        // If screen was not on, clear video senders
        if (!isScreenSharing.value) {
          await replaceTrackOnCalls('video', null)
        }
        syncPreview()
        return
      }
      // Stop screen if switching to camera
      if (isScreenSharing.value) {
        await stopScreenShare(false)
      }
      const cam = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      })
      const vTrack = cam.getVideoTracks()[0]
      if (!localStream) await ensureOutboundStream()
      // Remove old video tracks
      localStream.getVideoTracks().forEach((t) => {
        t.stop()
        localStream.removeTrack(t)
      })
      localStream.addTrack(vTrack)
      await replaceTrackOnCalls('video', vTrack)
      isCameraOn.value = true
      syncPreview()
    } catch (err) {
      error.value = err.message || 'Camera failed'
      throw err
    }
  }

  /** Start screen share (replaces camera video track). */
  const startScreenShare = async () => {
    error.value = ''
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 15 },
        audio: false
      })
      screenStream = display
      const sTrack = display.getVideoTracks()[0]
      sTrack.onended = () => {
        stopScreenShare()
      }
      if (!localStream) await ensureOutboundStream()
      // Remove existing video (camera)
      localStream.getVideoTracks().forEach((t) => {
        t.stop()
        localStream.removeTrack(t)
      })
      isCameraOn.value = false
      localStream.addTrack(sTrack)
      await replaceTrackOnCalls('video', sTrack)
      isScreenSharing.value = true
      syncPreview()
    } catch (err) {
      if (err?.name === 'NotAllowedError') {
        error.value = 'Screen share permission denied'
      } else {
        error.value = err.message || 'Screen share failed'
      }
      throw err
    }
  }

  const stopScreenShare = async (sync = true) => {
    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop())
      screenStream = null
    }
    if (localStream) {
      localStream.getVideoTracks().forEach((t) => {
        if (t.readyState !== 'live' || t.label.toLowerCase().includes('screen') || isScreenSharing.value) {
          t.stop()
          localStream.removeTrack(t)
        }
      })
    }
    isScreenSharing.value = false
    await replaceTrackOnCalls('video', null)
    if (sync) syncPreview()
  }

  const toggleScreenShare = async () => {
    if (isScreenSharing.value) await stopScreenShare()
    else await startScreenShare()
  }

  const switchMicrophone = async (deviceId) => {
    try {
      const constraints = {
        audio: deviceId
          ? { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true }
          : { echoCancellation: true, noiseSuppression: true },
        video: false
      }
      const next = await navigator.mediaDevices.getUserMedia(constraints)
      const newTrack = next.getAudioTracks()[0]
      newTrack.enabled = !isMuted.value && !isDeafened.value
      if (!localStream) {
        localStream = new MediaStream([newTrack])
      } else {
        localStream.getAudioTracks().forEach((t) => {
          t.stop()
          localStream.removeTrack(t)
        })
        localStream.addTrack(newTrack)
      }
      await replaceTrackOnCalls('audio', newTrack)
      syncPreview()
    } catch (err) {
      error.value = err.message || 'Failed to switch microphone'
    }
  }

  const listAudioDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      return {
        mics: devices.filter((d) => d.kind === 'audioinput'),
        speakers: devices.filter((d) => d.kind === 'audiooutput'),
        cameras: devices.filter((d) => d.kind === 'videoinput')
      }
    } catch {
      return { mics: [], speakers: [], cameras: [] }
    }
  }

  const setRemoteVideoHandler = (fn) => {
    onRemoteVideo = fn
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      intentionalLeave = true
      try {
        sendWS({ type: 'voice:leave' })
      } catch (_) {}
      try {
        ws?.close()
      } catch (_) {}
    })
  }

  // Do NOT leave on component unmount of a single view — voice is app-scoped.
  // App.vue owns the singleton; only logout / explicit leave should tear down.
  onBeforeUnmount(() => {
    // no-op for persistent session; parent calls leave() on logout
  })

  return {
    connectionState,
    channelId,
    channelName,
    serverId,
    serverName,
    participants,
    isMuted,
    isDeafened,
    isCameraOn,
    isScreenSharing,
    error,
    myPeerId,
    isInVoice,
    localPreviewStream,
    join,
    leave,
    toggleMute,
    toggleDeafen,
    setMuted,
    setDeafened,
    toggleCamera,
    toggleScreenShare,
    startScreenShare,
    stopScreenShare,
    switchMicrophone,
    listAudioDevices,
    setRemoteVideoHandler
  }
}
