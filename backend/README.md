# ÉLAN Call Go Backend (MySQL)

## Persiapan MySQL

1. Install MySQL (XAMPP / MySQL Installer / Laragon).
2. Buat database + user:

```sql
CREATE DATABASE webcall CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'webcall'@'localhost' IDENTIFIED BY 'webcallpass';
GRANT ALL PRIVILEGES ON webcall.* TO 'webcall'@'localhost';
FLUSH PRIVILEGES;
```

Tabel dibuat otomatis saat backend pertama kali dijalankan.

## Jalankan (Windows PowerShell)

```powershell
cd backend

$env:JWT_SECRET="ganti-dengan-secret-random-minimal-32-karakter"
$env:FRONTEND_ORIGIN="http://localhost:5173"
$env:MYSQL_DSN="webcall:webcallpass@tcp(127.0.0.1:3306)/webcall?parseTime=true&charset=utf8mb4&loc=UTC"

go mod tidy
go run .
```

Backend: `http://localhost:8080`

## Env

| Variable | Contoh | Keterangan |
|----------|--------|------------|
| `PORT` | `8080` | Port HTTP |
| `JWT_SECRET` | (wajib, min 32 char) | Secret JWT |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | CORS frontend |
| `MYSQL_DSN` | `user:pass@tcp(127.0.0.1:3306)/webcall?parseTime=true&charset=utf8mb4&loc=UTC` | Koneksi MySQL |

## Format DSN

```
username:password@tcp(host:3306)/database?parseTime=true&charset=utf8mb4&loc=UTC
```

Kalau MySQL root tanpa password (XAMPP default):

```
root:@tcp(127.0.0.1:3306)/webcall?parseTime=true&charset=utf8mb4&loc=UTC
```
