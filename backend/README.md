# ÉLAN CALL Go Backend

Backend Go untuk ÉLAN CALL, menggunakan MySQL, JWT, REST API, WebSocket realtime, dan WebSocket voice signaling.

## Docker

Disarankan dari root project:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Backend diakses internal Docker pada port `8080`. Frontend/Nginx akan meneruskan `/api/*`, `/uploads/*`, `/api/ws`, dan `/api/ws/voice`.

## Local

Buat database MySQL:

```sql
CREATE DATABASE webcall CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Kemudian:

```powershell
Copy-Item .env.example .env
# sesuaikan MYSQL_DSN dan FRONTEND_ORIGIN
go mod download
go run .
```

`JWT_SECRET` wajib minimal 32 karakter.

## Environment

| Variable | Wajib | Contoh |
|---|---|---|
| `PORT` | Tidak | `8080` |
| `JWT_SECRET` | Ya | secret acak >= 32 karakter |
| `FRONTEND_ORIGIN` | Tidak | `http://localhost:5173` |
| `MYSQL_DSN` | Ya | `webcall:webcallpass@tcp(127.0.0.1:3306)/webcall?parseTime=true&charset=utf8mb4&loc=UTC` |
| `UPLOAD_DIR` | Tidak | `uploads` |
