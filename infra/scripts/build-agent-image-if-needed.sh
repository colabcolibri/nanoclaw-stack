#!/usr/bin/env bash
# Rebuild da imagem do agent-runner quando bun.lock/Dockerfile mudam ou imagem ausente.
# Código em container/agent-runner/src é bind-mount no spawn — rebuild só para deps/base.
#
# Uso (no servidor, a partir da raiz do stack):
#   bash infra/scripts/build-agent-image-if-needed.sh
#
# Forçar rebuild:
#   DEPLOY_FORCE_AGENT_BUILD=1 bash infra/scripts/build-agent-image-if-needed.sh

set -euo pipefail

ROOT="${NANOCLAW_STACK_ROOT:-/opt/nanoclaw-stack}"
NANOCLAW_DIR="$ROOT/nanoclaw"
LOCK_FILE="$NANOCLAW_DIR/container/agent-runner/bun.lock"
DOCKERFILE="$NANOCLAW_DIR/container/Dockerfile"

export PROJECT_ROOT="$NANOCLAW_DIR"
# shellcheck source=/dev/null
source "$NANOCLAW_DIR/setup/lib/install-slug.sh"
IMAGE_NAME="$(container_image_base):latest"

sha256_file() {
  local f="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$f" | cut -d' ' -f1
  else
    shasum -a 256 "$f" | cut -d' ' -f1
  fi
}

lock_sha=""
if [[ -f "$LOCK_FILE" ]]; then
  lock_sha="$(sha256_file "$LOCK_FILE")"
fi

image_lock=""
if docker image inspect "$IMAGE_NAME" >/dev/null 2>&1; then
  image_lock="$(docker image inspect --format '{{index .Config.Labels "dev.nanoclaw.agent-runner-lock-sha256"}}' "$IMAGE_NAME" 2>/dev/null || true)"
fi

need_build="false"
reason=""

if [[ "${DEPLOY_FORCE_AGENT_BUILD:-}" == "1" ]]; then
  need_build="true"
  reason="DEPLOY_FORCE_AGENT_BUILD=1"
elif ! docker image inspect "$IMAGE_NAME" >/dev/null 2>&1; then
  need_build="true"
  reason="imagem ausente ($IMAGE_NAME)"
elif [[ -n "$lock_sha" && "$lock_sha" != "$image_lock" ]]; then
  need_build="true"
  reason="bun.lock mudou (imagem=$image_lock checkout=$lock_sha)"
fi

if [[ "$need_build" != "true" ]]; then
  echo "[deploy] Imagem do agente OK: $IMAGE_NAME (lock=$lock_sha)"
  exit 0
fi

echo "[deploy] Rebuild da imagem do agente ($reason)..."
cd "$NANOCLAW_DIR"
bash ./container/build.sh build
echo "[deploy] Imagem pronta: $IMAGE_NAME"
