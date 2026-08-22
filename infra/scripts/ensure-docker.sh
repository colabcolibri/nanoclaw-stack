#!/usr/bin/env bash
# Garante Docker Engine ativo antes de deploy/restart do motor.
# Uso: source ou bash infra/scripts/ensure-docker.sh

set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "[deploy] ERRO: docker não instalado." >&2
  exit 1
fi

if ! systemctl is-enabled docker >/dev/null 2>&1; then
  systemctl enable docker
fi

if ! docker info >/dev/null 2>&1; then
  echo "[deploy] Iniciando docker.service..."
  systemctl start docker
  sleep 2
fi

if ! docker info >/dev/null 2>&1; then
  echo "[deploy] ERRO: Docker não responde após systemctl start." >&2
  exit 1
fi

echo "[deploy] Docker OK ($(docker version --format '{{.Server.Version}}' 2>/dev/null || echo '?'))"
