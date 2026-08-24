#!/usr/bin/env bash
# Roda NO SERVIDOR após git pull.
# Chamado por: ./scripts/deploy.sh (Mac → SSH) ou direto no VPS.
#
# Uso: bash /opt/nanoclaw-stack/infra/scripts/deploy-stack.sh

set -euo pipefail

ROOT="${NANOCLAW_STACK_ROOT:-/opt/nanoclaw-stack}"
BRANCH="${DEPLOY_BRANCH:-main}"
BUN="${BUN_BIN:-/root/.bun/bin/bun}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log() { echo "[deploy] $*"; }

log "=== deploy-stack ($(hostname)) ==="

bash "$SCRIPT_DIR/ensure-docker.sh"

cd "$ROOT"

log "Sincronizando código com origin/${BRANCH}..."
git fetch origin
git reset --hard "origin/${BRANCH}"

log "Dependências — nanoclaw..."
cd "$ROOT/nanoclaw"
if command -v pnpm >/dev/null 2>&1; then
  # Estrito: se o lockfile divergiu do package.json, falha alto (sem fallback silencioso).
  pnpm install --frozen-lockfile
else
  log "pnpm não encontrado; pulando install do nanoclaw"
fi

NANOCLAW_STACK_ROOT="$ROOT" bash "$SCRIPT_DIR/build-agent-image-if-needed.sh"

log "Dependências + build — ui..."
cd "$ROOT/ui"
"$BUN" install
cd "$ROOT/ui/client"
"$BUN" install
"$BUN" run build

log "Reiniciando serviços..."
systemctl restart nanoclaw.service
systemctl restart nanoclaw-uai.service

log "Status:"
if ! systemctl is-active --quiet docker.service nanoclaw.service nanoclaw-uai.service; then
  log "ERRO: algum serviço não está ativo após o restart."
  systemctl status nanoclaw.service nanoclaw-uai.service --no-pager || true
  exit 1
fi

log "Smoke check UI (127.0.0.1:3001)..."
ui_ok=0
for _ in $(seq 1 15); do
  if curl -fsS -o /dev/null "http://127.0.0.1:3001/"; then ui_ok=1; break; fi
  sleep 2
done
if [ "$ui_ok" -ne 1 ]; then
  log "AVISO: UI não respondeu em 30s — verificar 'journalctl -u nanoclaw-uai.service'."
fi

log "Commit ativo: $(git -C "$ROOT" rev-parse --short HEAD)"
log "Imagem agente: $(source "$ROOT/nanoclaw/lib/install-slug.sh" && PROJECT_ROOT="$ROOT/nanoclaw" container_image_base):latest"
log "Bundle UI: $(grep -o 'index-[^\"]*\\.js' "$ROOT/ui/src/public/index.html" | head -1 || echo '?')"
log "=== deploy concluído ==="
