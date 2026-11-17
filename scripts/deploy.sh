#!/usr/bin/env bash
# Deploy Vidify di Ubuntu (Docker Engine). Idempoten: aman dijalankan berulang.
#
# Pemakaian:
#   MEDIA_ROOT=/mnt/media ./scripts/deploy.sh      # build image di server
#   ./scripts/deploy.sh --pull                     # pakai image registry (VIDIFY_IMAGE)
#   MEDIA_ROOT=/mnt/media TUNNEL_TOKEN=xxxx ./scripts/deploy.sh
#
# Variabel opsional: APP_BIND, APP_PORT, TUNNEL_TOKEN, VIDIFY_IMAGE,
#                    SMB_SHARE/SMB_USER/SMB_PASSWORD (mode NAS).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

log() { printf '[deploy] %s\n' "$*"; }
die() { printf '[deploy] ERROR: %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
Pemakaian: ./scripts/deploy.sh [--pull]

  (tanpa argumen)  build image dari source di server, lalu jalankan stack
  --pull, -p       tarik image dari registry (VIDIFY_IMAGE di .env), tanpa build
  --help, -h       tampilkan bantuan ini
EOF
}

MODE="build"
for arg in "$@"; do
  case "$arg" in
    --pull | -p) MODE="pull" ;;
    --help | -h)
      usage
      exit 0
      ;;
    *) die "argumen tidak dikenal: $arg (lihat --help)" ;;
  esac
done

command -v docker >/dev/null 2>&1 || die "docker tidak ditemukan. Install Docker Engine dulu."
command -v curl >/dev/null 2>&1 || die "curl tidak ditemukan."
docker compose version >/dev/null 2>&1 || die "docker compose v2 tidak ditemukan (paket docker-compose-v2)."
docker info >/dev/null 2>&1 || die "daemon docker tidak bisa diakses. Tambahkan user ke grup docker atau jalankan dengan sudo."

if [[ ! -f .env ]]; then
  [[ -n "${MEDIA_ROOT:-}" ]] || die "MEDIA_ROOT belum diset. Contoh: MEDIA_ROOT=/mnt/media ./scripts/deploy.sh"
  [[ -d "${MEDIA_ROOT}" ]] || die "MEDIA_ROOT tidak ditemukan: ${MEDIA_ROOT}"
  command -v openssl >/dev/null 2>&1 || die "openssl tidak ditemukan (dipakai untuk generate password)."

  log "membuat .env baru dengan password acak"
  umask 077
  {
    printf 'DB_NAME=vidify\n'
    printf 'DB_USER=vidify\n'
    printf 'DB_PASSWORD=%s\n' "$(openssl rand -hex 16)"
    printf 'DB_ROOT_PASSWORD=%s\n' "$(openssl rand -hex 16)"
    printf 'MEDIA_ROOT=%s\n' "${MEDIA_ROOT}"
    printf 'APP_BIND=%s\n' "${APP_BIND:-127.0.0.1}"
    printf 'TUNNEL_TOKEN=%s\n' "${TUNNEL_TOKEN:-}"
    printf 'VIDIFY_IMAGE=%s\n' "${VIDIFY_IMAGE:-}"
  } > .env
else
  log ".env sudah ada, dipakai apa adanya"
fi

set -a
# shellcheck disable=SC1091
. ./.env
set +a

: "${MEDIA_ROOT:?.env tidak memuat MEDIA_ROOT}"
[[ -d "${MEDIA_ROOT}" ]] || die "MEDIA_ROOT tidak ditemukan: ${MEDIA_ROOT}"

mkdir -p data mysql-data
if ! chown -R 1001:1001 data 2>/dev/null; then
  log "PERINGATAN: gagal chown data/. Jalankan manual: sudo chown -R 1001:1001 data"
fi

COMPOSE=(docker compose -f docker-compose.yml)
if [[ -n "${SMB_SHARE:-}" && -n "${SMB_USER:-}" && -n "${SMB_PASSWORD:-}" ]]; then
  log "mode NAS terdeteksi, memakai docker-compose.nas.yml"
  COMPOSE+=(-f docker-compose.nas.yml)
fi

UP_ARGS=(up -d --remove-orphans)

if [[ "${MODE}" == "pull" ]]; then
  [[ -n "${VIDIFY_IMAGE:-}" ]] || die "VIDIFY_IMAGE belum diset di .env (contoh: ghcr.io/user/vidify:latest)"
  COMPOSE+=(-f docker-compose.release.yml)
  UP_ARGS+=(--no-build)
  log "menarik image ${VIDIFY_IMAGE}"
  "${COMPOSE[@]}" pull app
else
  log "membangun image app (bisa beberapa menit pada run pertama)"
  "${COMPOSE[@]}" build app
fi

if [[ -n "${TUNNEL_TOKEN:-}" ]]; then
  log "menjalankan db, app, dan cloudflared"
  "${COMPOSE[@]}" "${UP_ARGS[@]}" db app cloudflared
else
  log "TUNNEL_TOKEN kosong, hanya menjalankan db dan app"
  "${COMPOSE[@]}" "${UP_ARGS[@]}" db app
fi

PORT="${APP_PORT:-3000}"
log "menunggu app merespons di 127.0.0.1:${PORT}"
ready=0
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/scan" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done
[[ "${ready}" == "1" ]] || die "app tidak merespons setelah 60 detik. Cek: docker compose logs --tail 50 app"

log "status scan:"
curl -s "http://127.0.0.1:${PORT}/api/scan" || true
printf '\n'

"${COMPOSE[@]}" ps

log "selesai. Buka http://127.0.0.1:${PORT} dari server, atau lewat Cloudflare Tunnel dari HP."
if [[ -z "${TUNNEL_TOKEN:-}" ]]; then
  log "Langkah berikutnya: isi TUNNEL_TOKEN di .env, lalu jalankan skrip ini lagi."
fi
