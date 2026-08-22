#!/usr/bin/env bash
# Sobe o motor (IA + Telegram + spawn do agent-runner).
# Não builda imagem Docker — use ./scripts/build-agent.sh uma vez se faltar.
#
# Uso: ./scripts/ai.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NANOCLAW_DIR="${NANOCLAW_PATH:-$ROOT/nanoclaw}"

log() { echo "[ai] $*"; }
die() { echo "[ai] ERRO: $*" >&2; exit 1; }

# shellcheck source=/dev/null
source "$ROOT/scripts/use-node22.sh"
log "Node: $(node -v)"

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

log "Instalando deps do motor..."
(cd "$NANOCLAW_DIR" && pnpm install)

free_port 3000

log "Imagem agente: $AGENT_IMAGE"
log "Subindo motor em http://localhost:3000"
log "Ctrl+C para parar"
log ""

cd "$NANOCLAW_DIR"
exec pnpm dev
