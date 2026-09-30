import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, Notice, Row, Section, SettingSwitch, Switch } from '../components/SettingsUI'
import { useSettings } from '../settings.store'

export function NotificationsSection() {
  const desktop = useSettings((s) => s.desktopNotifications)
  const set = useSettings((s) => s.set)
  const [notice, setNotice] = useState('')
  const supported = typeof Notification !== 'undefined'

  const toggleDesktop = async (on: boolean) => {
    setNotice('')
    if (!on) return set('desktopNotifications', false)
    if (!supported) return setNotice('Browser ini tidak mendukung notifikasi desktop.')
    const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
    if (perm === 'granted') set('desktopNotifications', true)
    else setNotice('Izin notifikasi ditolak. Aktifkan lewat pengaturan situs di browser.')
  }

  return (
    <Section title="Notifications" description="Atur notifikasi dan suara.">
      {notice && <Notice tone="error">{notice}</Notice>}
      <Card title="General">
        <Row label="Desktop notifications" hint="Tampilkan notifikasi sistem saat ada aktivitas baru.">
          <Switch checked={desktop} onChange={toggleDesktop} label="Desktop notifications" disabled={!supported} />
        </Row>
        <SettingSwitch field="notificationSound" label="Notification sound" />
        <SettingSwitch field="messagePreview" label="Message preview" hint="Tampilkan isi pesan di notifikasi." />
        <SettingSwitch field="bottomTicker" label="Bottom ticker" hint="Bar info di bagian bawah aplikasi." />
        {desktop && (
          <div className="py-3">
            <Button variant="secondary" size="sm" onClick={() => new Notification('WebCall', { body: 'Notifikasi berfungsi 🎉' })}>
              Kirim notifikasi tes
            </Button>
          </div>
        )}
      </Card>
      <Card title="Events">
        <SettingSwitch field="notifyNewMessage" label="New message" />
        <SettingSwitch field="notifyFriendRequests" label="Friend requests" />
        <SettingSwitch field="notifyMentions" label="Mentions" />
        <SettingSwitch field="notifyIncomingCalls" label="Incoming calls" />
        <SettingSwitch field="notifyServer" label="Server notifications" />
      </Card>
    </Section>
  )
}
