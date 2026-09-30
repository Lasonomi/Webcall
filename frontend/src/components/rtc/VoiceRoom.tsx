import { useEffect, useRef } from 'react'
import { Camera, CameraOff, LogIn, LogOut, Mic, MicOff, Volume2, VolumeX } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { useRTCStore } from '@/features/rtc/rtc.store'
import { rtcService } from '@/features/rtc/rtc.service'
import type { Channel } from '@/types'

function VideoTile({ stream, name, muted }: { stream: MediaStream; name: string; muted?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (!ref.current) return
    ref.current.srcObject = stream
    void ref.current.play().catch(() => {})
  }, [stream])
  const hasVideo = stream.getVideoTracks().length > 0
  return (
    <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-2xl border border-border bg-black">
      {hasVideo ? (
        <video ref={ref} autoPlay playsInline muted={muted} className="h-full w-full object-cover" />
      ) : (
        <Avatar size="lg" name={name} />
      )}
      <span className="absolute bottom-2 left-2 rounded-full border border-white/10 bg-black/60 px-2 py-1 text-[10px] backdrop-blur">{name}</span>
    </div>
  )
}

export function VoiceRoom({ channel, serverId, serverName }: { channel: Channel; serverId: string; serverName: string }) {
  const voice = useRTCStore((s) => s.voice)
  const localStream = useRTCStore((s) => s.voiceLocalStream)
  const remoteStreams = useRTCStore((s) => s.voiceRemoteStreams)
  const active = voice.active && voice.channelId === channel.id
  const participantsWithVideo = Object.entries(remoteStreams)

  if (!active) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-7 text-center shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-border bg-background">
            <Volume2 className="h-7 w-7 text-gold" />
          </div>
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">Voice room</p>
          <h3 className="mt-1 text-2xl font-semibold">{channel.name}</h3>
          <p className="mt-2 text-sm text-muted">Join untuk membuka microphone. Video tersedia pada room yang mengizinkannya.</p>
          <Button
            className="mt-5 w-full"
            onClick={() => void rtcService.joinVoice({
              channelId: channel.id,
              channelName: channel.name,
              serverId,
              serverName,
              allowVideo: Boolean(channel.allow_video),
            }).catch((error) => alert(error instanceof Error ? error.message : 'Failed to join voice'))}
          >
            <LogIn className="h-4 w-4" /> Join Voice
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {voice.allowVideo && voice.cameraOn ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="relative overflow-hidden rounded-2xl border border-border bg-black aspect-video">
              {localStream ? (
                <LocalVideo stream={localStream} />
              ) : <div className="flex h-full items-center justify-center"><Avatar size="lg" name="You" /></div>}
              <span className="absolute bottom-2 left-2 rounded-full border border-white/10 bg-black/60 px-2 py-1 text-[10px] backdrop-blur">You</span>
            </div>
            {participantsWithVideo.map(([userId, stream]) => {
              const participant = voice.participants.find((p) => p.user_id === userId)
              return <VideoTile key={userId} stream={stream} name={participant?.display_name || participant?.username || 'Participant'} />
            })}
          </div>
        ) : (
          <div className="mx-auto grid w-full max-w-3xl gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {voice.participants.map((p) => (
              <div key={p.user_id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
                <Avatar size="md" name={p.display_name || p.username} src={p.avatar_url} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.display_name || p.username}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted">{p.muted ? 'Muted' : 'Speaking ready'}</p>
                </div>
                {p.muted ? <MicOff className="h-4 w-4 text-muted" /> : <Mic className="h-4 w-4 text-gold" />}
              </div>
            ))}
            {!voice.participants.length && <p className="col-span-full py-12 text-center text-sm text-muted">Connecting to room…</p>}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center justify-center gap-2 border-t border-border bg-surface/60 p-3">
        <Button size="icon" variant="secondary" onClick={() => void rtcService.toggleMute()}>{voice.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</Button>
        <Button size="icon" variant="secondary" onClick={() => void rtcService.toggleDeafen()}>{voice.deafened ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</Button>
        {voice.allowVideo && <Button size="icon" variant="secondary" onClick={() => void rtcService.toggleCamera().catch((error) => alert(error instanceof Error ? error.message : 'Camera unavailable'))}>{voice.cameraOn ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}</Button>}
        <Button size="icon" variant="danger" onClick={() => void rtcService.leaveVoice()}><LogOut className="h-4 w-4" /></Button>
      </div>
    </div>
  )
}

function LocalVideo({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (!ref.current) return
    ref.current.srcObject = stream
    void ref.current.play().catch(() => {})
  }, [stream])
  return <video ref={ref} autoPlay playsInline muted className="h-full w-full object-cover" />
}
