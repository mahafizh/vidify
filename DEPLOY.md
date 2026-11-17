# Deploy Vidify di Ubuntu (Docker Engine)

Runbook ini dirancang untuk dieksekusi **agent** maupun manusia. Semua langkah non-interaktif
dan idempoten — aman diulang.

Arsitektur saat berjalan:

```
Internet → Cloudflare (Access) → cloudflared → app:3000 ──► /media (read-only)
                                                  └───────► db:3306 (MySQL)
```

Hanya `cloudflared` yang butuh akses keluar. `app` di-bind ke `127.0.0.1:3000`, MySQL tidak
dipublikasikan ke host.

---

## Aturan untuk agent

1. **Jangan menebak secret.** Skrip deploy membuat password DB acak sendiri ke `.env`. Jangan
   menulis password ke log atau ke jawaban.
2. **Jangan menyentuh `MEDIA_ROOT`.** Folder film di-mount `:ro`. Jangan `chown`, `rm`, atau
   menulis apa pun ke sana.
3. **Berhenti dan laporkan** (jangan mengarang jalan pintas) bila:
   - `docker` / `docker compose` tidak tersedia atau daemon tidak bisa diakses
   - `MEDIA_ROOT` tidak ada atau kosong
   - port 3000 sudah dipakai proses lain (`ss -lntp | grep :3000`)
   - ada langkah gagal setelah 1× retry
4. **Jangan** menjalankan `docker system prune`, `docker volume prune`, atau menghapus
   container/image yang bukan milik project ini (`vidify-*`).
5. Setelah deploy, **selalu** jalankan bagian [Verifikasi](#5-verifikasi) dan laporkan outputnya.
6. Cloudflare Tunnel & Access **manual di dashboard** — agent tidak bisa dan tidak boleh
   mencoba login ke akun Cloudflare pengguna.

---

## 1. Prasyarat

```bash
# Docker Engine + plugin compose
sudo apt update
sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable --now docker

# agar tidak perlu sudo
sudo usermod -aG docker "$USER"   # logout/login (atau `newgrp docker`) setelah ini
```

Cek:

```bash
docker --version            # Docker version 2x.x
docker compose version      # Docker Compose version v2.x
docker info >/dev/null && echo "daemon OK"
```

Butuh juga: `curl`, `openssl`, dan port 80/443 keluar terbuka (image `node:22-alpine`,
`mysql:8.4`, `cloudflare/cloudflared` diambil dari Docker Hub).

---

## 2. Ambil kode ke server

Pilih salah satu.

**a. Dari laptop (Windows/WSL), tanpa membawa `node_modules`/`.next`/`.env`:**

```bash
# di laptop (Git Bash / WSL)
tar --exclude=node_modules --exclude=.next --exclude=data --exclude=mysql-data \
    --exclude=.env --exclude=.test-media -czf vidify.tar.gz -C "$(dirname "$PWD")" "$(basename "$PWD")"
scp vidify.tar.gz user@home-server:~/
```

```bash
# di server
mkdir -p ~/vidify && tar -xzf ~/vidify.tar.gz -C ~/ --strip-components=0
```

**b. Via git**, kalau repo sudah ada:

```bash
git clone <URL_REPO> ~/vidify
```

---

## 3. Deploy

Satu perintah. Skrip akan: membuat `.env` (password acak), menyiapkan `data/`, build image,
menyalakan `db` + `app` (+ `cloudflared` bila token ada), lalu menunggu app sehat.

```bash
cd ~/vidify
chmod +x scripts/deploy.sh
MEDIA_ROOT=/mnt/media ./scripts/deploy.sh
```

Contoh keluaran akhir yang diharapkan:

```
[deploy] status scan:
{"running":false,"startedAt":...,"finishedAt":...,"total":N,"probed":N,...,"error":null}
NAME              IMAGE     STATUS
vidify-app-1      vidify-app   Up (healthy)
vidify-db-1       mysql:8.4    Up (healthy)
[deploy] selesai. ...
```

Kalau `TUNNEL_TOKEN` belum diisi, container `cloudflared` sengaja tidak dijalankan dulu.

### Mode image dari GHCR (tanpa build di server)

Kalau repo ada di GitHub, setiap push ke `main` menghasilkan image (`.github/workflows/release.yml`),
dan server cukup menariknya.

**Sekali saja, dari laptop:**

```bash
git init && git add -A && git commit -m "vidify: initial"
git remote add origin git@github.com:USER/vidify.git
git push -u origin main
```

Setelah workflow selesai (tab **Actions**), image tersedia di `ghcr.io/USER/vidify:latest`
plus tag `sha-xxxxxxx` per commit dan tag `v*` kalau kamu push tag rilis.

**Di server:**

```bash
cd ~/vidify

# hanya kalau package GHCR-nya private: login sekali pakai PAT (scope read:packages)
echo "$GHCR_TOKEN" | docker login ghcr.io -u USER --password-stdin

sed -i 's|^VIDIFY_IMAGE=.*|VIDIFY_IMAGE=ghcr.io/user/vidify:latest|' .env
./scripts/deploy.sh --pull
```

Update berikutnya cukup `./scripts/deploy.sh --pull`. Rollback: ganti tag ke `:sha-xxxxxxx`
atau `:v1.0.0` di `.env`, lalu jalankan ulang.

Image hanya dibangun untuk `linux/amd64`. Kalau servernya ARM, tambahkan `linux/arm64`
pada `platforms:` di workflow (build jadi lebih lambat karena emulasi).

### Kalau film ada di NAS (SMB)

Cara yang disarankan di Ubuntu: mount share ke folder lokal, lalu pakai `MEDIA_ROOT` biasa.

```bash
sudo apt install -y cifs-utils
sudo mkdir -p /mnt/media
sudo mount -t cifs //192.168.100.10/data /mnt/media -o username=hafizh,vers=3.0,ro
```

Buat permanen di `/etc/fstab`:

```
//192.168.100.10/data  /mnt/media  cifs  username=hafizh,vers=3.0,ro,_netdev,nofail  0  0
```

Catatan: kredensial lebih rapi disimpan di `/etc/cifs-credentials` (`username=`, `password=`,
`chmod 600`) lalu opsi mount jadi `credentials=/etc/cifs-credentials`.

Alternatif (tanpa fstab): isi `SMB_SHARE`, `SMB_USER`, `SMB_PASSWORD`, `SMB_SUBPATH` di `.env`.
Skrip akan otomatis memakai `docker-compose.nas.yml` yang memount CIFS sebagai volume.

---

## 4. Cloudflare Tunnel + Access (manual, sekali saja)

1. **Zero Trust → Networks → Tunnels → Create a tunnel**, pilih `cloudflared`, beri nama `vidify`.
2. Salin token dari halaman instalasi, lalu di server:

   ```bash
   cd ~/vidify
   sed -i 's|^TUNNEL_TOKEN=.*|TUNNEL_TOKEN=<token>|' .env
   ./scripts/deploy.sh          # tanpa MEDIA_ROOT, .env sudah ada
   ```

3. Di tunnel tersebut → **Public Hostname → Add**:
   - Subdomain: `film` (atau apa saja), Domain: domainmu
   - Service: **HTTP** → `app:3000`
4. **Zero Trust → Access → Applications → Add an application → Self-hosted**
   - Application domain: `film.domainmu.com`
   - Policy: `Allow`, Include → `Emails` → email kamu
   Tanpa langkah ini, siapa pun yang tahu URL bisa menonton.
5. Verifikasi dari HP: buka `https://film.domainmu.com`, harus muncul halaman login Access dulu.

---

## 5. Verifikasi

```bash
cd ~/vidify

# 1. container sehat
docker compose ps

# 2. app menjawab, scan selesai tanpa error
curl -s http://127.0.0.1:3000/api/scan; echo

# 3. library terisi
curl -s http://127.0.0.1:3000/api/media | head -c 200; echo

# 4. streaming Range harus 206 (bukan 200)
ID=$(curl -s http://127.0.0.1:3000/api/media | sed -n 's/.*"id":"\([a-f0-9]\{40\}\)".*/\1/p' | head -n 1)
curl -s -o /dev/null -w 'Range -> %{http_code}\n' -H 'Range: bytes=0-1023' \
  "http://127.0.0.1:3000/api/stream/$ID"

# 5. thumbnail jadi
curl -s -o /dev/null -w 'Thumbnail -> %{http_code} %{content_type}\n' \
  "http://127.0.0.1:3000/api/thumbnail/$ID"

# 6. isi database
docker compose exec -T db sh -c 'exec mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" -e "SELECT COUNT(*) AS total, SUM(playable) AS playable FROM media;"'
```

Yang diharapkan: `206`, `image/jpeg`, dan `total` > 0. Kalau `total` = 0, lihat
[Troubleshooting](#7-troubleshooting).

---

## 6. Operasional

```bash
# log
docker compose logs -f --tail 100 app
docker compose logs --tail 100 cloudflared

# restart
docker compose restart app

# update kode (setelah rsync/git pull) — build di server
./scripts/deploy.sh

# update dengan image dari GHCR — tanpa build
./scripts/deploy.sh --pull

# stop (data tetap di ./data dan ./mysql-data)
docker compose down
```

**Backup** (hanya index + progress; file film tidak perlu):

```bash
cd ~/vidify
set -a; . ./.env; set +a
mkdir -p ~/backup
docker compose exec -T db sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' \
  > ~/backup/vidify-$(date +%F).sql
```

Cron harian (03:00):

```cron
0 3 * * * cd /home/USER/vidify && set -a && . ./.env && set +a && docker compose exec -T db sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' > /home/USER/backup/vidify-$(date +\%F).sql
```

Restore:

```bash
docker compose exec -T db sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' < ~/backup/vidify-2026-01-01.sql
```

---

## 7. Troubleshooting

| Gejala | Penyebab & tindakan |
|---|---|
| `app` restart terus | MySQL belum sehat atau `DATABASE_URL` salah. `docker compose logs --tail 50 db` |
| Library kosong (`total: 0`) | `MEDIA_ROOT` salah/duplikat mount. `docker compose exec app ls /media \| head` |
| `curl /api/scan` connection refused | app belum siap; `docker compose logs --tail 50 app` |
| Thumbnail 404 | ffmpeg tidak ada di image (harusnya sudah): `docker compose exec app which ffmpeg` |
| Video tidak mau play | Kodek tidak didukung browser (HEVC/x265, audio AC3/DTS). Perlu konversi ke MP4 H.264 + AAC |
| Error 502 di domain | `cloudflared` tidak jalan atau service hostname bukan `http://app:3000`: `docker compose logs cloudflared` |
| Halaman kebuka tanpa login | Access policy belum dipasang untuk hostname itu |
| `permission denied` menulis thumbnail | `sudo chown -R 1001:1001 data` lalu restart app |
| `pull access denied` / `unauthorized` saat `--pull` | package GHCR private: `docker login ghcr.io` pakai PAT scope `read:packages` |
| `manifest unknown` saat `--pull` | tag salah atau workflow belum selesai; cek tab Actions dan `docker manifest inspect ghcr.io/USER/vidify:latest` |
| Port 3000 bentrok | ubah `APP_PORT` (host) atau hentikan proses lain; atau biarkan `APP_BIND=127.0.0.1` |
| Disk penuh | log sudah dibatasi 10 MB × 3 per service; cek `du -sh data mysql-data` |

---

## 8. Keamanan

- Biarkan `APP_BIND=127.0.0.1`. Aplikasi ini **tidak punya autentikasi sendiri** — Cloudflare
  Access adalah gerbangnya. Jangan ubah ke `0.0.0.0` kecuali hanya untuk Tailscale/LAN.
- MySQL tidak dipublikasikan ke host; jangan tambahkan `ports` untuk service `db`.
- File `.env` berisi password DB — `chmod 600 .env`, jangan masuk repo (sudah di `.gitignore`).
- Catatan risiko: Cloudflare ToS §2.8 tidak mendukung penyajian video non-HTML lewat CDN gratis.
  Untuk 1–2 stream pribadi biasanya aman; alternatif bila kena throttle: Tailscale atau
  reverse proxy di VPS sendiri.
