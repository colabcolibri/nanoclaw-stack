#!/usr/bin/env bash
# Roda NO SERVIDOR (Hostinger) após push no GitHub.
# Chamado por: GitHub Actions (SSH) ou ./scripts/deploy.sh no Mac.
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
  pnpm install --frozen-lockfile 2>/dev/null || pnpm install
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
systemctl is-active docker.service nanoclaw.service nanoclaw-uai.service
log "Commit ativo: $(git -C "$ROOT" rev-parse --short HEAD)"
log "Imagem agente: $(source "$ROOT/nanoclaw/setup/lib/install-slug.sh" && PROJECT_ROOT="$ROOT/nanoclaw" container_image_base):latest"
log "Bundle UI: $(grep -o 'index-[^\"]*\\.js' "$ROOT/ui/src/public/index.html" | head -1 || echo '?')"
log "=== deploy concluído ==="
