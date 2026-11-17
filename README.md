# Vidify

Personal streaming dari home server: baca folder film, tampilkan sebagai grid poster, putar
langsung di browser HP lewat Cloudflare Tunnel.

- **Direct play** — file dikirim apa adanya lewat HTTP Range request, tanpa transcode.
- **ffmpeg hanya saat scan** — `ffprobe` untuk metadata, satu frame untuk thumbnail.
- **MySQL** menyimpan index library (`media`, `progress`, `scan_state`).
- **Cloudflare Access** jadi gerbang autentikasi; aplikasi tidak punya login sendiri.

## Stack

| Bagian | Teknologi |
|---|---|
| App | Next.js 16 (App Router, TypeScript), Tailwind v4 + komponen shadcn/ui |
| Streaming | Route Handler Node + `fs.createReadStream` + `Content-Range` |
| Index | MySQL 8.4 (`mysql2`), schema dibuat otomatis saat start |
| Media | ffmpeg/ffprobe dari image (Alpine) |
| Deploy | Docker Compose: `db` + `app` + `cloudflared` |

## Struktur

```
src/app/            halaman (/, /watch/[id]) dan API (stream, thumbnail, media, scan)
src/components/     ui/ (shadcn), media-card, media-rail, media-grid, hero, site-header, video-player
src/lib/            db, scan, probe, thumbs, stream, paths, format, title, media, utils
scripts/deploy.sh   deploy idempoten untuk server
.github/workflows/  release.yml — build + push image ke GHCR
DEPLOY.md           runbook deploy lengkap (bisa dijalankan agent)
```

## Dev lokal (Windows)

Butuh Node 22+, MySQL 8, ffmpeg di `PATH` (atau set `FFMPEG_PATH`/`FFPROBE_PATH`).

```bash
npm install
npm run dev
```

Cara paling konsisten: jalankan MySQL dari compose (`docker compose up -d db`), lalu
`npm run dev` di host dengan `DATABASE_URL=mysql://vidify:vidify@127.0.0.1:3306/vidify`,
`LIBRARY_ROOT=D:/Film`, `DATA_DIR=./data` di `.env.local`.

Catatan Windows: `LIBRARY_ROOT` tidak bisa menunjuk drive jaringan (`Z:`) saat app berjalan
di Docker — Docker Desktop hanya me-share drive lokal. Untuk itu pakai `docker-compose.nas.yml`
(lihat [DEPLOY.md](DEPLOY.md)).

## Deploy

Panduan lengkap + langkah verifikasi: **[DEPLOY.md](DEPLOY.md)**.

```bash
cd ~/vidify
MEDIA_ROOT=/mnt/media ./scripts/deploy.sh
```

Skrip membuat `.env` dengan password acak, mem-build image, menyalakan stack, lalu menunggu app
sehat. Aman dijalankan berulang untuk update.

Kalau image dibangun di GitHub Actions dan dipush ke GHCR, server tidak perlu build sama sekali:

```bash
./scripts/deploy.sh --pull     # butuh VIDIFY_IMAGE=ghcr.io/USER/vidify:latest di .env
```

## Verifikasi cepat

```bash
ID=$(curl -s http://127.0.0.1:3000/api/media | sed -n 's/.*"id":"\([a-f0-9]\{40\}\)".*/\1/p' | head -n 1)
curl -s -o /dev/null -w '%{http_code}\n' -H 'Range: bytes=0-1023' "http://127.0.0.1:3000/api/stream/$ID"
```

Harus `206`. `200` berarti Range tidak diproses; `416` untuk range di luar ukuran file.

## Catatan

- Format yang bisa diputar: MP4/MOV dengan video H.264 + audio AAC/MP3 (WEBM: VP8/VP9/AV1 +
  Opus/Vorbis). File lain tetap tampil dengan badge "Tidak didukung" dan perlu dikonversi.
- `Content-Length` tidak dikirim pada respons video karena Next.js menyaring header itu
  (`FORBIDDEN_HEADERS`); browser memakai `Content-Range` untuk seek.
- Cloudflare ToS §2.8 tidak mendukung penyajian video non-HTML lewat CDN gratis. Untuk 1–2
  stream pribadi biasanya aman; alternatifnya Tailscale atau reverse proxy di VPS sendiri.
