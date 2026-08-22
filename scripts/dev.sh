#!/usr/bin/env bash
# Dev completo: motor + API UI + Vite (hot reload). Não builda imagem Docker.
#
# Uso: ./scripts/dev.sh
# Abra: http://localhost:3080  (ou VITE_DEV_PORT no ui/.env)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NANOCLAW_DIR="${NANOCLAW_PATH:-$ROOT/nanoclaw}"
UI_DIR="$ROOT/ui"
UI_ENV="$UI_DIR/.env"

log() { echo "[dev] $*"; }
die() { echo "[dev] ERRO: $*" >&2; exit 1; }

if [[ -f "$UI_ENV" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$UI_ENV"
  set +a
fi

VITE_DEV_PORT="${VITE_DEV_PORT:-3080}"

free_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti :"$port" 2>/dev/null || true)"
  [[ -z "$pids" ]] && return 0
  log "Liberando porta $port..."
  kill $pids 2>/dev/null || true
  sleep 0.5
}

if ! command -v docker >/dev/null 2>&1; then
  die "Docker não instalado."
fi
if ! docker info >/dev/null 2>&1; then
  die "Docker Desktop não está rodando."
fi

export PROJECT_ROOT="$NANOCLAW_DIR"
# shellcheck source=/dev/null
source "$NANOCLAW_DIR/setup/lib/install-slug.sh"
AGENT_IMAGE="$(container_image_base):latest"

if ! docker image inspect "$AGENT_IMAGE" >/dev/null 2>&1; then
  die "Imagem $AGENT_IMAGE não existe. Rode uma vez: ./scripts/build-agent.sh"
fi

log "Instalando deps..."
(cd "$NANOCLAW_DIR" && pnpm install)
(cd "$UI_DIR" && bun install)
(cd "$UI_DIR/client" && bun install)

free_port 3000
free_port 3001
free_port "$VITE_DEV_PORT"

PIDS=()
cleanup() {
  log "Encerrando..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

export NANOCLAW_PATH="$NANOCLAW_DIR"

log "Subindo motor..."
(cd "$NANOCLAW_DIR" && pnpm dev) &
PIDS+=($!)

log "Subindo API (3001)..."
(cd "$UI_DIR" && bun run dev) &
PIDS+=($!)

sleep 1

log "Subindo Vite (porta $VITE_DEV_PORT)..."
(cd "$UI_DIR/client" && VITE_DEV_PORT="$VITE_DEV_PORT" bun run dev) &
PIDS+=($!)

log ""
log "=== dev rodando ==="
log "  Painel:  http://localhost:$VITE_DEV_PORT"
log "  API:     http://localhost:3001"
log "  Motor:   http://localhost:3000"
log "  Ctrl+C para parar"
log ""

wait
