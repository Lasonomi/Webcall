import { useCallback, useEffect, useRef, useState } from 'react'
import { useSettings } from '../settings.store'

export type Devices = { mics: MediaDeviceInfo[]; speakers: MediaDeviceInfo[]; cams: MediaDeviceInfo[] }

/** Daftar perangkat. Label baru muncul setelah izin diberikan → request() dipanggil dari tombol. */
export function useDevices() {
  const [devices, setDevices] = useState<Devices>({ mics: [], speakers: [], cams: [] })
  const [granted, setGranted] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    const all = await navigator.mediaDevices.enumerateDevices()
    setDevices({
      mics: all.filter((d) => d.kind === 'audioinput'),
      speakers: all.filter((d) => d.kind === 'audiooutput'),
      cams: all.filter((d) => d.kind === 'videoinput'),
    })
    setGranted(all.some((d) => d.label))
  }, [])

  const request = useCallback(async () => {
    setError('')
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).catch(() =>
        navigator.mediaDevices.getUserMedia({ audio: true })
      )
      s.getTracks().forEach((t) => t.stop())
      await refresh()
    } catch {
      setError('Izin mikrofon/kamera ditolak atau tidak ada perangkat.')
    }
  }, [refresh])

  useEffect(() => {
    void refresh()
    navigator.mediaDevices?.addEventListener?.('devicechange', refresh)
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', refresh)
  }, [refresh])

  return { devices, granted, error, request }
}

/** Level mic 0–100 saat `active`. Otomatis berhenti & melepas mic saat unmount. */
export function useMicLevel(active: boolean) {
  const { inputDeviceId, noiseSuppression, echoCancellation, autoGainControl, inputVolume } = useSettings()
  const [level, setLevel] = useState(0)
  const [error, setError] = useState('')
  const gainRef = useRef(inputVolume)
  gainRef.current = inputVolume

  useEffect(() => {
    if (!active) { setLevel(0); return }
    let stopped = false
    let raf = 0
    let stream: MediaStream | null = null
    let ctx: AudioContext | null = null

    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: inputDeviceId !== 'default' ? { exact: inputDeviceId } : undefined,
            noiseSuppression, echoCancellation, autoGainControl,
          },
        })
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return }
        ctx = new AudioContext()
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 512
        ctx.createMediaStreamSource(stream).connect(analyser)
        const buf = new Uint8Array(analyser.fftSize)
        const tick = () => {
          analyser.getByteTimeDomainData(buf)
          let peak = 0
          for (const v of buf) peak = Math.max(peak, Math.abs(v - 128))
          setLevel(Math.min(100, Math.round((peak / 128) * 100 * (gainRef.current / 100) * 1.6)))
          raf = requestAnimationFrame(tick)
        }
        tick()
      } catch {
        setError('Tidak bisa mengakses mikrofon.')
      }
    })()

    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
      void ctx?.close()
    }
  }, [active, inputDeviceId, noiseSuppression, echoCancellation, autoGainControl])

  return { level, error }
}

const QUALITY: Record<string, { width: number; height: number }> = {
  '360p': { width: 640, height: 360 },
  '480p': { width: 854, height: 480 },
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
}

/** Stream kamera untuk preview saat `active`. */
export function useCameraPreview(active: boolean) {
  const { cameraId, videoQuality } = useSettings()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!active) return
    let stream: MediaStream | null = null
    let stopped = false
    setError('')
    navigator.mediaDevices
      .getUserMedia({ video: { deviceId: cameraId !== 'default' ? { exact: cameraId } : undefined, ...QUALITY[videoQuality] } })
      .then((s) => {
        if (stopped) { s.getTracks().forEach((t) => t.stop()); return }
        stream = s
        if (videoRef.current) videoRef.current.srcObject = s
      })
      .catch(() => setError('Tidak bisa mengakses kamera.'))
    return () => {
      stopped = true
      stream?.getTracks().forEach((t) => t.stop())
      if (videoRef.current) videoRef.current.srcObject = null
    }
  }, [active, cameraId, videoQuality])

  return { videoRef, error }
}

/** Bunyi tes lewat speaker terpilih (setSinkId didukung Chromium; browser lain pakai default). */
export async function playTestTone(deviceId: string, volume: number) {
  const ctx = new AudioContext()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  gain.gain.value = 0.15 * (volume / 100)
  const dest = ctx.createMediaStreamDestination()
  osc.frequency.value = 660
  osc.connect(gain).connect(dest)
  const audio = new Audio()
  audio.srcObject = dest.stream
  const sink = audio as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }
  if (deviceId !== 'default' && sink.setSinkId) await sink.setSinkId(deviceId).catch(() => {})
  await audio.play()
  osc.start()
  osc.stop(ctx.currentTime + 0.5)
  setTimeout(() => { audio.pause(); void ctx.close() }, 700)
}
