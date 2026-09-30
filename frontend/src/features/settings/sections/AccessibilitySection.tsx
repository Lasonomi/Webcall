import { Card, Row, Section, Segmented, SettingSwitch } from '../components/SettingsUI'
import { useSettings, type UiScale } from '../settings.store'

export function AccessibilitySection() {
  const { uiScale, set } = useSettings()
  return (
    <Section title="Accessibility" description="Sesuaikan tampilan dan navigasi agar nyaman dipakai.">
      <Card title="Visual">
        <SettingSwitch field="reduceMotion" label="Reduce motion" hint="Mematikan animasi dan transisi." />
        <SettingSwitch field="highContrast" label="High contrast" hint="Memperjelas border dan teks sekunder." />
        <SettingSwitch field="largerText" label="Larger text" />
        <Row label="UI scale">
          <Segmented<UiScale> label="UI scale" value={uiScale} onChange={(v) => set('uiScale', v)}
            options={[90, 100, 110, 125].map((v) => ({ value: v as UiScale, label: `${v}%` }))} />
        </Row>
      </Card>
      <Card title="Chat">
        <SettingSwitch field="alwaysShowUsernames" label="Always show usernames" />
        <SettingSwitch field="alwaysShowTimestamps" label="Always show timestamps" />
      </Card>
      <Card title="Keyboard & screen reader">
        <div className="space-y-2 py-3 text-sm text-muted">
          <p>Semua kontrol bisa dijangkau dengan <kbd className="rounded border border-border px-1.5 text-xs">Tab</kbd> dan diaktifkan dengan <kbd className="rounded border border-border px-1.5 text-xs">Enter</kbd> / <kbd className="rounded border border-border px-1.5 text-xs">Space</kbd>.</p>
          <p>Toggle, pilihan segmen, dan meter mikrofon memakai role &amp; label ARIA sehingga terbaca oleh screen reader. Fokus keyboard ditandai dengan outline emas.</p>
        </div>
      </Card>
    </Section>
  )
}
