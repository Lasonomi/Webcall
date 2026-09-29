# ÉLAN CALL / WebCall

Aplikasi chat/calling dengan **Vue 3 + Vite** di frontend, **Go + MySQL** di backend, serta WebSocket untuk realtime dan voice signaling.

## Cara menjalankan dengan Docker

1. Salin `.env.example` menjadi `.env`.
2. Ganti `JWT_SECRET` dengan nilai acak minimal 32 karakter. Bila mengubah `MYSQL_USER`, `MYSQL_PASSWORD`, atau `MYSQL_DATABASE`, compose akan otomatis membentuk DSN backend dari nilai tersebut; `MYSQL_DSN` hanya perlu diisi bila ingin override manual.
3. Jalankan:

```powershell
docker compose up --build
```

Buka `http://localhost:5173`.

Docker akan menjalankan:

- `frontend`: Nginx + Vue build pada port `5173`
- `backend`: Go API pada network internal Docker
- `mysql`: MySQL 8.4
- `mysql_data`: volume database persisten
- `uploads_data`: volume file upload persisten

Untuk menghentikan container:

```powershell
docker compose down
```

Untuk menghapus database dan upload juga:

```powershell
docker compose down -v
```

## Menjalankan tanpa Docker

### Backend

```powershell
cd backend
Copy-Item .env.example .env
# edit .env sesuai MySQL lokal
go mod download
go run .
```

Backend berjalan di `http://localhost:8080`.

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Dev server sudah memiliki proxy ke backend untuk `/api`, `/uploads`, dan WebSocket.

## Konfigurasi frontend terpisah

Untuk deployment frontend dan backend pada domain berbeda, set `VITE_API_URL` ketika build frontend, misalnya:

```text
VITE_API_URL=https://api.example.com
```

Backend dapat menerima beberapa origin dengan memisahkan nilai `FRONTEND_ORIGIN` memakai koma:

```text
FRONTEND_ORIGIN=https://app.example.com,https://preview.example.com
```

## Pemeriksaan bug yang sudah diperbaiki

- Struktur `HomeView.vue` diperbaiki agar seluruh komponen berada di dalam satu blok `<template>`.
- Schema `channel_messages` diselaraskan dengan fitur attachment, reply, edit/delete, serta reaction.
- Tabel `channel_reactions` ditambahkan.
- Migrasi lama tetap dicoba kompatibel dengan kolom tambahan secara idempotent.
- Schema group DM memakai kolom `conversations.name` dari awal; tidak ada lagi DDL `ALTER TABLE` di dalam transaksi pembuatan group.
- Deadlock pada fungsi social/DM yang mengunci mutex lalu memanggil fungsi ber-lock ulang diperbaiki dengan helper `*Locked`.
- Typing event DM disesuaikan dengan payload backend (`targets`).
- Hapus/reaction pesan DM sekarang dapat dibroadcast ke seluruh anggota conversation.
- Presence memakai TTL sehingga peer yang sudah lama offline tidak dianggap online selamanya.
- CORS mendukung beberapa origin dan wildcard tanpa kombinasi credentials yang invalid.
- WebSocket realtime dan voice memakai pemeriksaan origin yang sama-sama mendukung multi-origin.
- Backend memiliki graceful shutdown untuk SIGTERM dari Docker.
- Frontend API memakai same-origin sebagai default sehingga tidak hardcode `localhost:8080` di production.
- Vite dev server memiliki proxy API/upload/WebSocket.
- Secret lokal `backend/.env` tidak ikut dibawa ke paket hasil perbaikan.

## Catatan WebRTC

Panggilan voice memakai PeerJS/WebRTC. Untuk jaringan tertentu yang ketat/NAT simetris, koneksi peer-to-peer dapat membutuhkan TURN server; Docker tidak menghilangkan kebutuhan relay tersebut.
