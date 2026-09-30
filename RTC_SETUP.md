# WebCall RTC Setup

Fitur RTC yang sudah diintegrasikan:

- Direct 1:1 voice call
- Direct 1:1 video call
- Incoming call popup
- Persistent voice dock saat berpindah halaman
- Voice room server
- Camera toggle di voice room
- Mute / deafen
- WebRTC signaling melalui WebSocket Go
- Reconnect WebSocket dan renegotiation dasar

## Frontend

`.env.example` menyediakan konfigurasi berikut:

```env
VITE_API_URL=http://localhost:8080
VITE_RTC_ICE_SERVERS=[{"urls":"stun:stun.l.google.com:19302"}]
```

Untuk deployment publik, tambahkan TURN server agar koneksi tetap bisa berjalan pada jaringan NAT/firewall yang tidak memungkinkan koneksi peer-to-peer langsung. Contoh format:

```env
VITE_RTC_ICE_SERVERS=[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:rtc.example.com:3478","username":"TURN_USER","credential":"TURN_PASSWORD"}]
```

Jangan commit credential TURN production ke repository publik.

## Backend

Voice WebSocket memakai endpoint:

```text
GET /api/ws/voice?token=<JWT>
```

Backend memvalidasi JWT, membership server, kecocokan server/channel, dan identitas peer sebelum voice room atau direct call signaling diteruskan.

## Arsitektur RTC saat ini

- Direct 1:1 call: native WebRTC P2P.
- Server voice/video room: native WebRTC mesh untuk implementasi saat ini.
- Untuk deployment dengan room besar / ribuan concurrent users, ganti media room ke SFU (mis. LiveKit) dan pertahankan Go backend sebagai auth/permission/signaling orchestration layer.

## Menjalankan

Backend:

```powershell
cd backend
go run .
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

Camera dan microphone browser akan meminta izin saat call/video dimulai. Production harus memakai HTTPS/WSS.
