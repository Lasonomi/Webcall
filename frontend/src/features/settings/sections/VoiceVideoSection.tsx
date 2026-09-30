import { useState } from 'react'
import { Mic, Video, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, Notice, Row, Section, SelectField, SettingSwitch, Slider, Segmented } from '../components/SettingsUI'
import { useSettings, type VideoQuality } from '../settings.store'
import { playTestTone, useCameraPreview, useDevices, useMicLevel } from '../hooks/useMedia'

const opts = (list: MediaDeviceInfo[], fallback: string) => [
  { value: 'default', label: 'Default' },
  ...list.filter((d) => d.deviceId !== 'default').map((d, i) => ({ value: d.deviceId, label: d.label || `${fallback} ${i + 1}` })),
]

export function VoiceVideoSection() {
  const s = useSettings()
  const { devices, granted, error, request } = useDevices()
  const [micTest, setMicTest] = useState(false)
  const [camOn, setCamOn] = useState(false)
  const mic = useMicLevel(micTest)
  const cam = useCameraPreview(camOn)

  return (
    <Section title="Voice & Video" description="Perangkat, kualitas suara, dan perilaku saat masuk call.">
      {!granted && (
        <Notice>
          Beri izin mikrofon/kamera agar nama perangkat tampil.{' '}
          <button type="button" className="font-semibold text-gold underline" onClick={request}>Beri izin</button>
        </Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}

      <Card title="Audio">
        <Row label="Input device (mic)" htmlFor="v-in">
          <SelectField id="v-in" value={s.inputDeviceId} options={opts(devices.mics, 'Microphone')} onChange={(v) => s.set('inputDeviceId', v)} />
        </Row>
        <Row label="Output device (speaker)" hint="Pemilihan speaker hanya didukung browser Chromium." htmlFor="v-out">
          <SelectField id="v-out" value={s.outputDeviceId} options={opts(devices.speakers, 'Speaker')} onChange={(v) => s.set('outputDeviceId', v)} />
        </Row>
        <Row label="Input volume"><Slider label="Input volume" value={s.inputVolume} onChange={(v) => s.set('inputVolume', v)} /></Row>
        <Row label="Output volume"><Slider label="Output volume" value={s.outputVolume} onChange={(v) => s.set('outputVolume', v)} /></Row>
        <div className="space-y-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setMicTest((v) => !v)}>
              <Mic className="h-3.5 w-3.5" /> {micTest ? 'Stop tes mic' : 'Tes mikrofon'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => playTestTone(s.outputDeviceId, s.outputVolume).catch(() => {})}>
              <Volume2 className="h-3.5 w-3.5" /> Tes speaker
            </Button>
          </div>
          <div
            role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={mic.level}
            className="h-2 w-full max-w-md overflow-hidden rounded-full bg-surface-2"
          >
            <div className="h-full rounded-full bg-gold transition-[width] duration-75" style={{ width: `${mic.level}%` }} />
          </div>
          {mic.error && <Notice tone="error">{mic.error}</Notice>}
        </div>
      </Card>

      <Card title="Voice processing">
        <SettingSwitch field="noiseSuppression" label="Noise suppression" />
        <SettingSwitch field="echoCancellation" label="Echo cancellation" />
        <SettingSwitch field="autoGainControl" label="Automatic gain control" />
      </Card>

      <Card title="Video">
        <Row label="Camera" htmlFor="v-cam">
          <SelectField id="v-cam" value={s.cameraId} options={opts(devices.cams, 'Camera')} onChange={(v) => s.set('cameraId', v)} />
        </Row>
        <Row label="Video quality">
          <Segmented<VideoQuality> label="Video quality" value={s.videoQuality} onChange={(v) => s.set('videoQuality', v)}
            options={(['360p', '480p', '720p', '1080p'] as const).map((v) => ({ value: v, label: v }))} />
        </Row>
        <div className="space-y-3 py-3">
          <Button variant="secondary" size="sm" onClick={() => setCamOn((v) => !v)}>
            <Video className="h-3.5 w-3.5" /> {camOn ? 'Matikan preview' : 'Tampilkan preview'}
          </Button>
          {camOn && (
            <video ref={cam.videoRef} autoPlay muted playsInline className="aspect-video w-full max-w-md rounded-xl border border-border bg-black object-cover" />
          )}
          {cam.error && <Notice tone="error">{cam.error}</Notice>}
        </div>
      </Card>

      <Card title="Call behavior">
        <SettingSwitch field="autoJoinVoice" label="Auto-join voice" />
        <SettingSwitch field="muteOnJoin" label="Mute microphone on join" />
        <SettingSwitch field="deafenOnJoin" label="Deafen on join" />
      </Card>
    </Section>
  )
}
