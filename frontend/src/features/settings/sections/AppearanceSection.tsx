import { Card, Row, Section, Segmented, SettingSwitch } from '../components/SettingsUI'
import { useSettings, type ChatDensity, type Theme, type UiScale } from '../settings.store'

export function AppearanceSection() {
  const { theme, uiScale, chatDensity, set } = useSettings()
  return (
    <Section title="Appearance" description="Tema hanya mengubah permukaan; maroon & gold tetap jadi warna brand.">
      <Card title="Theme">
        <Row label="Theme" hint="System mengikuti pengaturan perangkatmu.">
          <Segmented<Theme> label="Theme" value={theme} onChange={(v) => set('theme', v)}
            options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'System' }]} />
        </Row>
      </Card>
      <Card title="Customization">
        <Row label="UI scale">
          <Segmented<UiScale> label="UI scale" value={uiScale} onChange={(v) => set('uiScale', v)}
            options={[90, 100, 110, 125].map((v) => ({ value: v as UiScale, label: `${v}%` }))} />
        </Row>
        <Row label="Chat density">
          <Segmented<ChatDensity> label="Chat density" value={chatDensity} onChange={(v) => set('chatDensity', v)}
            options={[{ value: 'compact', label: 'Compact' }, { value: 'cozy', label: 'Cozy' }, { value: 'spacious', label: 'Spacious' }]} />
        </Row>
        <SettingSwitch field="compactMode" label="Compact mode" hint="Merapatkan jarak antar pesan." />
        <SettingSwitch field="showMemberList" label="Show member list" hint="Tampilkan daftar member di halaman server." />
        <SettingSwitch field="showTimestamps" label="Show timestamps" />
        <SettingSwitch field="reduceMotion" label="Reduce animations" />
      </Card>
    </Section>
  )
}
