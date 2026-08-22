#!/usr/bin/env bash
# Build da imagem Docker do agent-runner (rode uma vez, ou quando bun.lock mudar).
#
# Uso: ./scripts/build-agent.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NANOCLAW_DIR="${NANOCLAW_PATH:-$ROOT/nanoclaw}"

echo "[build] Instalando deps do agent-runner..."
(cd "$NANOCLAW_DIR/container/agent-runner" && bun install)

echo "[build] Buildando imagem (pode demorar)..."
(cd "$NANOCLAW_DIR" && ./container/build.sh build)

export PROJECT_ROOT="$NANOCLAW_DIR"
# shellcheck source=/dev/null
source "$NANOCLAW_DIR/setup/lib/install-slug.sh"
echo "[build] Pronto: $(container_image_base):latest"
