import { useEffect, useRef } from 'react'
import { Mic, MicOff, PhoneOff, Video, VideoOff, Volume2, VolumeX } from 'lucide-react'
import { useRTCStore } from '@/features/rtc/rtc.store'
import { rtcService } from '@/features/rtc/rtc.service'
import { Button } from '@/components/ui/Button'

function RemoteAudio({ stream, muted }: { stream: MediaStream; muted: boolean }) {
  const ref = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    if (!ref.current) return
    ref.current.srcObject = stream
    ref.current.volume = muted ? 0 : 1
    void ref.current.play().catch(() => {})
  }, [stream, muted])
  return <audio ref={ref} autoPlay playsInline />
}

export function VoiceRemoteAudio() {
  const streams = useRTCStore((s) => s.voiceRemoteStreams)
  const deafened = useRTCStore((s) => s.voice.deafened)
  return (
    <div className="hidden">
      {Object.entries(streams).map(([id, stream]) => <RemoteAudio key={id} stream={stream} muted={deafened} />)}
    </div>
  )
}

export function VoiceDock() {
  const voice = useRTCStore((s) => s.voice)
  const remoteStreams = useRTCStore((s) => s.voiceRemoteStreams)
  if (!voice.active) return <VoiceRemoteAudio />

  return (
    <>
      <VoiceRemoteAudio />
      <div className="fixed bottom-[44px] left-1/2 z-[70] w-[min(760px,calc(100vw-1rem))] -translate-x-1/2 rounded-2xl border border-border bg-surface/95 px-3 py-2 shadow-2xl backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">🔊 {voice.channelName}</p>
            <p className="text-[10px] text-muted">{voice.status} · {voice.participants.length} in room{voice.error ? ` · ${voice.error}` : ''}</p>
          </div>
          <div className="hidden items-center gap-1.5 md:flex">
            {voice.participants.slice(0, 4).map((p) => (
              <span key={p.user_id} className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-[9px]" title={p.display_name || p.username}>
                {(p.display_name || p.username || '?').slice(0, 1).toUpperCase()}
              </span>
            ))}
            {voice.participants.length > 4 && <span className="text-[10px] text-muted">+{voice.participants.length - 4}</span>}
            <span className="text-[10px] text-muted">{Object.keys(remoteStreams).length} peer{Object.keys(remoteStreams).length === 1 ? '' : 's'}</span>
          </div>
          <Button size="icon" variant="secondary" onClick={() => void rtcService.toggleMute()} title={voice.muted ? 'Unmute' : 'Mute'}>
            {voice.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button size="icon" variant="secondary" onClick={() => void rtcService.toggleDeafen()} title={voice.deafened ? 'Undeafen' : 'Deafen'}>
            {voice.deafened ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          {voice.allowVideo && (
            <Button size="icon" variant="secondary" onClick={() => void rtcService.toggleCamera()} title={voice.cameraOn ? 'Turn camera off' : 'Turn camera on'}>
              {voice.cameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
            </Button>
          )}
          <Button size="icon" variant="danger" onClick={() => void rtcService.leaveVoice()} title="Leave voice">
            <PhoneOff className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  )
}
