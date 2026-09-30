import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'
import { cn } from '@/lib/utils'
import { Card, Notice, Row, Section, SettingSwitch } from '../components/SettingsUI'
import { useSettings } from '../settings.store'

const APP_VERSION = 'v1.0.0'
type Status = 'checking' | 'online' | 'offline'

function StatusDot({ status }: { status: Status }) {
  const label = status === 'checking' ? 'Checking…' : status === 'online' ? 'Connected' : 'Disconnected'
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className={cn('h-2 w-2 rounded-full', status === 'online' ? 'bg-green-500' : status === 'offline' ? 'bg-red-500' : 'bg-neutral-500')} />
      {label}
    </span>
  )
}

export function AdvancedSection() {
  const reset = useSettings((s) => s.reset)
  const [apiStatus, setApiStatus] = useState<Status>('checking')
  const [wsStatus, setWsStatus] = useState<Status>('checking')
  const [notice, setNotice] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)

  useEffect(() => {
    let alive = true
    fetch(`${api.url}/api/health`).then((r) => alive && setApiStatus(r.ok ? 'online' : 'offline')).catch(() => alive && setApiStatus('offline'))

    let ws: WebSocket | null = null
    try {
      const token = localStorage.getItem('webcall_token') || ''
      ws = new WebSocket(`${api.url.replace(/^http/, 'ws')}/api/ws?token=${encodeURIComponent(token)}`)
      ws.onopen = () => { if (alive) setWsStatus('online'); ws?.close() }
      ws.onerror = () => alive && setWsStatus('offline')
    } catch {
      setWsStatus('offline')
    }
    return () => { alive = false; ws?.close() }
  }, [])

  const clearCache = async () => {
    try {
      sessionStorage.clear()
      if ('caches' in window) await Promise.all((await caches.keys()).map((k) => caches.delete(k)))
      setNotice('Cache dibersihkan. Login dan pengaturanmu tidak terpengaruh.')
    } catch {
      setNotice('Gagal membersihkan cache.')
    }
  }

  return (
    <Section title="Advanced" description="Opsi teknis dan developer.">
      {notice && <Notice tone="ok">{notice}</Notice>}
      <Card title="Developer">
        <SettingSwitch field="developerMode" label="Developer Mode" hint="Menampilkan tombol Copy ID untuk User, Server, Channel, dan Message." />
        <SettingSwitch field="hardwareAcceleration" label="Hardware acceleration" hint="Preferensi disimpan; efek bergantung pada browser." />
      </Card>
      <Card title="System">
        <Row label="Clear cache" hint="Menghapus cache browser & data sesi sementara."><Button variant="secondary" size="sm" onClick={clearCache}>Clear cache</Button></Row>
        <Row label="Reset app settings" hint="Mengembalikan semua pengaturan lokal ke default. Data akun tidak berubah.">
          {confirmReset ? (
            <span className="flex gap-2">
              <Button variant="danger" size="sm" onClick={() => { reset(); setConfirmReset(false); setNotice('Pengaturan dikembalikan ke default.') }}>Ya, reset</Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>Batal</Button>
            </span>
          ) : (
            <Button variant="danger" size="sm" onClick={() => setConfirmReset(true)}>Reset settings</Button>
          )}
        </Row>
      </Card>
      <Card title="Status">
        <Row label="WebSocket connection"><StatusDot status={wsStatus} /></Row>
        <Row label="API connection" hint={api.url}><StatusDot status={apiStatus} /></Row>
        <Row label="App version"><span className="text-sm text-muted">{APP_VERSION}</span></Row>
      </Card>
    </Section>
  )
}
