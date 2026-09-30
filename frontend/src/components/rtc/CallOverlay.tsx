import { useEffect, useRef, useState } from 'react'
import {
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Monitor,
  PhoneOff,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useRTCStore } from '@/features/rtc/rtc.store'
import { rtcService } from '@/features/rtc/rtc.service'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

function VideoElement({
  stream,
  muted,
  volume = 1,
  className,
}: {
  stream: MediaStream | null
  muted?: boolean
  volume?: number
  className?: string
}) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (!ref.current) return
    ref.current.srcObject = stream
    ref.current.volume = volume
    if (stream) void ref.current.play().catch(() => {})
  }, [stream, volume])
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={cn('h-full w-full object-cover', className)}
    />
  )
}

function AudioElement({
  stream,
  deafened,
}: {
  stream: MediaStream | null
  deafened: boolean
}) {
  const ref = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    if (!ref.current) return
    ref.current.srcObject = stream
    ref.current.volume = deafened ? 0 : 1
    void ref.current.play().catch(() => {})
  }, [stream, deafened])
  return <audio ref={ref} autoPlay playsInline />
}

function formatTime(start?: number) {
  if (!start) return 'Connecting…'
  const total = Math.max(0, Math.floor((Date.now() - start) / 1000))
  const mm = Math.floor(total / 60).toString().padStart(2, '0')
  const ss = (total % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
}

export function IncomingCallToast() {
  const incoming = useRTCStore((s) => s.incomingCall)
  if (!incoming) return null

  return (
    <div className="fixed right-5 top-[68px] z-[90] w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-border bg-surface/95 p-4 shadow-2xl backdrop-blur">
      <div className="flex items-center gap-3">
        <Avatar size="md" name={incoming.callerName} src={incoming.callerAvatar} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gold">
            Incoming {incoming.mode} call
          </p>
          <p className="truncate text-sm font-semibold">{incoming.callerName}</p>
          <p className="text-[11px] text-muted">
            {incoming.mode === 'video' ? 'Video call' : 'Voice call'}
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          variant="danger"
          onClick={() =>
            rtcService.rejectIncomingCall(incoming.callerId, incoming.sessionId)
          }
        >
          Decline
        </Button>
        <Button
          onClick={() =>
            void rtcService
              .acceptIncomingCall()
              .catch((error) =>
                alert(
                  error instanceof Error
                    ? error.message
                    : 'Camera/microphone unavailable'
                )
              )
          }
        >
          Accept
        </Button>
      </div>
    </div>
  )
}

export function CallOverlay() {
  const call = useRTCStore((s) => s.directCall)
  const localStream = useRTCStore((s) => s.directLocalStream)
  const remoteStream = useRTCStore((s) => s.directRemoteStream)
  const [tick, setTick] = useState(0)
  const [minimized, setMinimized] = useState(false)

  useEffect(() => {
    if (!call?.elapsedStartedAt) return
    const id = window.setInterval(() => setTick((v) => v + 1), 1000)
    return () => window.clearInterval(id)
  }, [call?.elapsedStartedAt])

  useEffect(() => {
    if (call?.sessionId) setMinimized(false)
  }, [call?.sessionId])

  if (!call) return null

  void tick

  const videoMode = call.mode === 'video'
  const muted = call.muted
  const statusLabel =
    call.status === 'outgoing'
      ? 'Calling…'
      : call.status === 'connecting'
        ? 'Connecting…'
        : call.status === 'connected'
          ? formatTime(call.elapsedStartedAt)
          : 'Call'

  if (minimized) {
    return (
      <>
        {!videoMode && <AudioElement stream={remoteStream} deafened={call.deafened} />}
        {videoMode && remoteStream && (
          <AudioElement stream={remoteStream} deafened={call.deafened} />
        )}
        <div className="fixed bottom-5 right-5 z-[80] flex w-[min(360px,calc(100vw-1.5rem))] items-center gap-3 rounded-2xl border border-border bg-surface/95 p-3 shadow-2xl backdrop-blur">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-border bg-background">
            {videoMode && remoteStream ? (
              <VideoElement stream={remoteStream} muted className="h-12 w-12" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Avatar size="sm" name={call.peerName} src={call.peerAvatar} />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{call.peerName}</p>
            <p className="text-[11px] text-muted">
              {statusLabel} · {videoMode ? 'Video' : 'Voice'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8"
              onClick={() => void rtcService.toggleMute()}
              title={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8"
              onClick={() => setMinimized(false)}
              title="Expand"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="danger"
              className="h-8 w-8"
              onClick={() => rtcService.endDirectCall()}
              title="End call"
            >
              <PhoneOff className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {!videoMode && <AudioElement stream={remoteStream} deafened={call.deafened} />}
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
        <div className="flex h-[min(760px,calc(100vh-2rem))] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-border bg-[#0b0b0b] shadow-2xl">
          <header className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar size="md" name={call.peerName} src={call.peerAvatar} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{call.peerName}</p>
                <p className="text-[11px] text-muted">{statusLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-full border border-border px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-gold">
                {videoMode ? 'Video' : 'Voice'}
              </div>
              <Button
                size="icon"
                variant="secondary"
                className="h-8 w-8"
                onClick={() => setMinimized(true)}
                title="Minimize — continue using the app"
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
            </div>
          </header>

          <main className="relative min-h-0 flex-1 overflow-hidden p-4">
            {videoMode ? (
              <div className="grid h-full min-h-0 gap-3 md:grid-cols-2">
                <div className="relative min-h-0 overflow-hidden rounded-2xl border border-border bg-surface">
                  {remoteStream ? (
                    <VideoElement stream={remoteStream} volume={call.deafened ? 0 : 1} />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Avatar size="lg" name={call.peerName} src={call.peerAvatar} />
                    </div>
                  )}
                  <span className="absolute left-3 top-3 rounded-full border border-border bg-black/50 px-2.5 py-1 text-[10px] uppercase tracking-wider backdrop-blur">
                    {call.peerName}
                  </span>
                </div>
                <div className="relative min-h-0 overflow-hidden rounded-2xl border border-border bg-surface">
                  {localStream ? (
                    <VideoElement stream={localStream} muted />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Avatar size="lg" name="You" />
                    </div>
                  )}
                  <span className="absolute left-3 top-3 rounded-full border border-border bg-black/50 px-2.5 py-1 text-[10px] uppercase tracking-wider backdrop-blur">
                    You
                  </span>
                  {!call.cameraOn && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <VideoOff className="h-8 w-8 text-muted" />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
                <div className="rounded-full border border-border bg-surface p-2 shadow-2xl">
                  <Avatar size="lg" name={call.peerName} src={call.peerAvatar} />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{call.peerName}</p>
                  <p className="mt-1 text-sm text-muted">
                    {call.status === 'connected'
                      ? formatTime(call.elapsedStartedAt)
                      : 'Voice call'}
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-xs text-muted">
                  <Volume2 className="h-4 w-4" /> Voice connection active
                </div>
              </div>
            )}
          </main>

          <footer className="flex items-center justify-center gap-2 border-t border-border px-4 py-4">
            <Button
              size="icon"
              variant="secondary"
              onClick={() => void rtcService.toggleMute()}
              title={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            {videoMode && (
              <Button
                size="icon"
                variant="secondary"
                onClick={() =>
                  void rtcService
                    .toggleCamera()
                    .catch((error) =>
                      alert(
                        error instanceof Error
                          ? error.message
                          : 'Camera unavailable'
                      )
                    )
                }
                title={call.cameraOn ? 'Turn camera off' : 'Turn camera on'}
              >
                {call.cameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </Button>
            )}
            <Button
              size="icon"
              variant="secondary"
              onClick={() =>
                void rtcService
                  .toggleScreenShare()
                  .catch((error) =>
                    alert(
                      error instanceof Error
                        ? error.message
                        : 'Screen share failed'
                    )
                  )
              }
              title="Share screen"
            >
              <Monitor className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              onClick={() => void rtcService.toggleDeafen()}
              title={call.deafened ? 'Unmute remote audio' : 'Mute remote audio'}
            >
              {call.deafened ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <Button
              size="icon"
              variant="secondary"
              onClick={() => setMinimized(true)}
              title="Minimize"
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="danger"
              onClick={() => rtcService.endDirectCall()}
              title="End call"
            >
              <PhoneOff className="h-4 w-4" />
            </Button>
          </footer>
        </div>
      </div>
    </>
  )
} 