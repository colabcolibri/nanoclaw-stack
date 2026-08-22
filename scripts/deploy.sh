#!/usr/bin/env bash
# Deploy local → GitHub → Hostinger
# Uso (na raiz do repo): ./scripts/deploy.sh
# Opções:
#   SKIP_PUSH=1 ./scripts/deploy.sh   — só atualiza o servidor (já fez push)
#   DEPLOY_HOST=hostinger ./scripts/deploy.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${DEPLOY_HOST:-hostinger}"
REMOTE_ROOT="${NANOCLAW_STACK_ROOT:-/opt/nanoclaw-stack}"

cd "$ROOT"

if [[ "${SKIP_PUSH:-}" != "1" ]]; then
  echo "[deploy] Enviando commits para origin/main..."
  git push origin main
fi

echo "[deploy] Executando deploy no servidor (${HOST})..."
ssh "$HOST" "bash ${REMOTE_ROOT}/infra/scripts/deploy-stack.sh"

echo "[deploy] Concluído."
