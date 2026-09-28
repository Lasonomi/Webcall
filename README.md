# ÉLAN CALL / WebCall

Frontend Vue 3 + Backend Go + **MySQL**.

## 1. MySQL

Buat database:

```sql
CREATE DATABASE webcall CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

(Opsional user khusus — lihat `backend/README.md`)

## 2. Backend

```powershell
cd backend
$env:JWT_SECRET="ganti-dengan-secret-random-minimal-32-karakter"
$env:FRONTEND_ORIGIN="http://localhost:5173"
$env:MYSQL_DSN="root:@tcp(127.0.0.1:3306)/webcall?parseTime=true&charset=utf8mb4&loc=UTC"
go mod tidy
go run .
```

Sesuaikan user/password MySQL kamu di `MYSQL_DSN`.

## 3. Frontend

```powershell
cd frontend
npm install
npm run dev
```

## Fitur presence

- Online sejak login (PeerJS identity)
- Heartbeat 20 detik
- Poll friend list 8 detik
- Online TTL 90 detik

## Catatan

- Akun di SQLite/JSON lama tidak ikut pindah → register ulang
- Untuk call dengan teman di luar laptop, backend perlu URL publik (ngrok / hosting)
