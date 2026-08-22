#!/usr/bin/env bash
# Gera .compose.env e builda a imagem do agent-runner via docker compose.
# Uso: cd nanoclaw && ./scripts/compose-build-agent.sh

set -euo pipefail

NANOCLAW_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$NANOCLAW_DIR"

export PROJECT_ROOT="$NANOCLAW_DIR"
# shellcheck source=/dev/null
source "$NANOCLAW_DIR/setup/lib/install-slug.sh"
IMAGE="$(container_image_base):latest"

LOCK_FILE="$NANOCLAW_DIR/container/agent-runner/bun.lock"
LOCK_SHA=""
if [[ -f "$LOCK_FILE" ]]; then
  if command -v shasum >/dev/null 2>&1; then
    LOCK_SHA="$(shasum -a 256 "$LOCK_FILE" | cut -d' ' -f1)"
  else
    LOCK_SHA="$(sha256sum "$LOCK_FILE" | cut -d' ' -f1)"
  fi
fi

cat > "$NANOCLAW_DIR/.compose.env" <<EOF
NANOCLAW_AGENT_IMAGE=$IMAGE
AGENT_RUNNER_LOCK_SHA256=$LOCK_SHA
EOF

echo "[compose] Imagem: $IMAGE"
echo "[compose] Rodando testes + build (igual container/build.sh)..."

# build.sh já valida typecheck e aplica labels corretos — compose só empacota o resultado.
bash "$NANOCLAW_DIR/container/build.sh" build

echo "[compose] Pronto. Imagem local: $IMAGE"
echo "[compose] Suba o dev com: ../../scripts/dev.sh"
