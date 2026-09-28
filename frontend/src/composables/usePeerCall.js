import { ref, onBeforeUnmount } from 'vue'
import Peer from 'peerjs'

export function usePeerCall() {
  const myId = ref('')
  const isInCall = ref(false)
  const isMuted = ref(false)
  const isCameraOn = ref(true)
  const messages = ref([])
  const localStream = ref(null)

  let peer = null
  let currentCall = null
  let dataConnection = null
  let localVideoEl = null
  let remoteVideoEl = null
  let onRemoteStream = null

  const ensurePeer = () => {
    if (peer) return peer
    peer = new Peer()
    peer.on('open', (id) => {
      myId.value = id
    })
    peer.on('call', async (call) => {
      try {
        const stream = await ensureMedia()
        call.answer(stream)
        bindCall(call)
      } catch (err) {
        console.error(err)
        call.close()
      }
    })
    peer.on('connection', (conn) => setupDataConnection(conn))
    peer.on('error', (err) => console.error('PeerJS:', err))
    return peer
  }

  const ensureMedia = async () => {
    if (localStream.value) return localStream.value
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    localStream.value = stream
    if (localVideoEl) localVideoEl.srcObject = stream
    return stream
  }

  const bindCall = (call) => {
    currentCall = call
    isInCall.value = true
    call.on('stream', (remoteStream) => {
      if (remoteVideoEl) remoteVideoEl.srcObject = remoteStream
      if (onRemoteStream) onRemoteStream(remoteStream)
    })
    call.on('close', endCall)
    call.on('error', () => endCall())
  }

  const setupDataConnection = (conn) => {
    dataConnection = conn
    conn.on('data', (data) => {
      if (data?.type === 'chat') {
        messages.value.push({ text: data.text, time: nowTime(), isMine: false })
      }
    })
    conn.on('close', () => {
      if (dataConnection === conn) dataConnection = null
    })
  }

  /** Start PeerJS identity only (for online presence). Call as soon as user logs in. */
  const startPresence = () => {
    ensurePeer()
  }

  /** Attach video elements when call UI is shown. */
  const attachVideos = async (localVideo, remoteVideo, remoteStreamHandler = null) => {
    localVideoEl = localVideo
    remoteVideoEl = remoteVideo
    onRemoteStream = remoteStreamHandler
    ensurePeer()
    try {
      await ensureMedia()
    } catch (err) {
      console.error(err)
      throw new Error('Gagal mengakses kamera/mikrofon. Pastikan izin browser sudah diberikan.')
    }
  }

  // keep old name for compatibility
  const init = attachVideos

  const startCall = async (targetId) => {
    if (!targetId) return
    ensurePeer()
    const stream = await ensureMedia()
    const target = targetId.trim()
    const call = peer.call(target, stream)
    bindCall(call)
    const conn = peer.connect(target)
    setupDataConnection(conn)
  }

  const endCall = () => {
    if (currentCall) {
      currentCall.close()
      currentCall = null
    }
    if (dataConnection) {
      dataConnection.close()
      dataConnection = null
    }
    if (remoteVideoEl) remoteVideoEl.srcObject = null
    isInCall.value = false
    messages.value = []
  }

  const toggleMute = () => {
    const track = localStream.value?.getAudioTracks()?.[0]
    if (track) {
      track.enabled = !track.enabled
      isMuted.value = !track.enabled
    }
  }

  const toggleCamera = () => {
    const track = localStream.value?.getVideoTracks()?.[0]
    if (track) {
      track.enabled = !track.enabled
      isCameraOn.value = track.enabled
    }
  }

  const sendMessage = (text) => {
    if (!text || !dataConnection || !dataConnection.open) return false
    dataConnection.send({ type: 'chat', text })
    messages.value.push({ text, time: nowTime(), isMine: true })
    return true
  }

  const destroy = () => {
    endCall()
    localStream.value?.getTracks().forEach((track) => track.stop())
    localStream.value = null
    peer?.destroy()
    peer = null
    myId.value = ''
  }

  onBeforeUnmount(() => {
    destroy()
  })

  return {
    myId,
    isInCall,
    isMuted,
    isCameraOn,
    messages,
    localStream,
    startPresence,
    attachVideos,
    init,
    startCall,
    endCall,
    toggleMute,
    toggleCamera,
    sendMessage,
    destroy
  }
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
