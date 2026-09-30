import { create } from 'zustand'
import type { User } from '@/types'

export type RTCStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed'
export type DirectCallMode = 'voice' | 'video'
export type DirectCallStatus = 'outgoing' | 'ringing' | 'connecting' | 'connected'

export type RTCParticipant = {
  user_id: string
  username: string
  display_name: string
  peer_id?: string
  muted: boolean
  deafened: boolean
  channel_id: string
  server_id: string
  avatar_url?: string
}

type DirectCall = {
  sessionId: string
  peerUserId: string
  peerName: string
  peerUsername?: string
  peerAvatar?: string
  mode: DirectCallMode
  status: DirectCallStatus
  muted: boolean
  deafened: boolean
  cameraOn: boolean
  elapsedStartedAt?: number
}

type IncomingCall = {
  sessionId: string
  callerId: string
  callerName: string
  callerUsername?: string
  callerAvatar?: string
  mode: DirectCallMode
}

type VoiceState = {
  active: boolean
  status: RTCStatus
  channelId: string | null
  channelName: string
  serverId: string | null
  serverName: string
  allowVideo: boolean
  participants: RTCParticipant[]
  muted: boolean
  deafened: boolean
  cameraOn: boolean
  screenSharing: boolean
  error: string
}

type RTCStore = {
  initializedUser: User | null
  socketStatus: RTCStatus
  directCall: DirectCall | null
  incomingCall: IncomingCall | null
  directLocalStream: MediaStream | null
  directRemoteStream: MediaStream | null
  voiceLocalStream: MediaStream | null
  voiceRemoteStreams: Record<string, MediaStream>
  voice: VoiceState
  setInitializedUser: (user: User | null) => void
  setSocketStatus: (status: RTCStatus) => void
  setDirectCall: (call: DirectCall | null) => void
  setIncomingCall: (call: IncomingCall | null) => void
  setDirectLocalStream: (stream: MediaStream | null) => void
  setDirectRemoteStream: (stream: MediaStream | null) => void
  setVoiceLocalStream: (stream: MediaStream | null) => void
  setVoiceRemoteStream: (userId: string, stream: MediaStream) => void
  removeVoiceRemoteStream: (userId: string) => void
  clearVoiceRemoteStreams: () => void
  patchVoice: (patch: Partial<VoiceState>) => void
  reset: () => void
}

const initialVoice: VoiceState = {
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
}

export const useRTCStore = create<RTCStore>((set) => ({
  initializedUser: null,
  socketStatus: 'disconnected',
  directCall: null,
  incomingCall: null,
  directLocalStream: null,
  directRemoteStream: null,
  voiceLocalStream: null,
  voiceRemoteStreams: {},
  voice: initialVoice,
  setInitializedUser: (initializedUser) => set({ initializedUser }),
  setSocketStatus: (socketStatus) => set({ socketStatus }),
  setDirectCall: (directCall) => set({ directCall }),
  setIncomingCall: (incomingCall) => set({ incomingCall }),
  setDirectLocalStream: (directLocalStream) => set({ directLocalStream }),
  setDirectRemoteStream: (directRemoteStream) => set({ directRemoteStream }),
  setVoiceLocalStream: (voiceLocalStream) => set({ voiceLocalStream }),
  setVoiceRemoteStream: (userId, stream) =>
    set((state) => ({ voiceRemoteStreams: { ...state.voiceRemoteStreams, [userId]: stream } })),
  removeVoiceRemoteStream: (userId) =>
    set((state) => {
      const next = { ...state.voiceRemoteStreams }
      delete next[userId]
      return { voiceRemoteStreams: next }
    }),
  clearVoiceRemoteStreams: () => set({ voiceRemoteStreams: {} }),
  patchVoice: (patch) => set((state) => ({ voice: { ...state.voice, ...patch } })),
  reset: () =>
    set({
      initializedUser: null,
      socketStatus: 'disconnected',
      directCall: null,
      incomingCall: null,
      directLocalStream: null,
      directRemoteStream: null,
      voiceLocalStream: null,
      voiceRemoteStreams: {},
      voice: initialVoice,
    }),
}))
