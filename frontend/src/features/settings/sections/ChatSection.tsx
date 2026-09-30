import { Card, Section, SettingSwitch } from '../components/SettingsUI'

export function ChatSection() {
  return (
    <Section title="Chat" description="Perilaku pesan dan media.">
      <Card title="Send behavior">
        <SettingSwitch field="enterToSend" label="Enter to send" hint="Tekan Enter untuk mengirim. Jika mati, kirim lewat tombol Send." />
        <SettingSwitch field="typingIndicator" label="Show typing indicator" />
      </Card>
      <Card title="Media previews">
        <SettingSwitch field="linkPreview" label="Link preview" />
        <SettingSwitch field="imagePreview" label="Image preview" />
        <SettingSwitch field="attachmentPreview" label="Attachment preview" />
      </Card>
      <Card title="Interaction">
        <SettingSwitch field="emojiAnimation" label="Emoji animation" />
        <SettingSwitch field="gifSupport" label="GIF support" />
        <SettingSwitch field="replyPreviews" label="Reply previews" />
        <SettingSwitch field="messageReactions" label="Message reactions" />
        <SettingSwitch field="showDeletedIndicator" label="Show deleted message indicator" />
      </Card>
      <p className="text-xs text-muted">Lampiran maksimal 15MB (gambar, dokumen, audio, video, zip).</p>
    </Section>
  )
}
