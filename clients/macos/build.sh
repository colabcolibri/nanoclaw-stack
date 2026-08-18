#!/usr/bin/env bash
set -e

echo "🚀 Iniciando compilação do Barão para macOS..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

APP_NAME="Barão"
BUNDLE_NAME="Barao.app"
BUILD_DIR="$SCRIPT_DIR/.build/release"
APP_DIR="$SCRIPT_DIR/dist/$BUNDLE_NAME"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"

# 1. Compilar em Release com Swift Package Manager
echo "📦 Compilando binário nativo (Swift SPM)..."
swift build -c release --arch arm64 --arch x86_64 2>/dev/null || swift build -c release

# 2. Criar estrutura do .app
echo "📂 Estruturando o pacote $BUNDLE_NAME..."
rm -rf "$SCRIPT_DIR/dist"
mkdir -p "$MACOS_DIR"
mkdir -p "$RESOURCES_DIR"

# Copiar executável
cp "$BUILD_DIR/Barao" "$MACOS_DIR/Barao"
chmod +x "$MACOS_DIR/Barao"

# Copiar Info.plist
cp "$SCRIPT_DIR/Info.plist" "$CONTENTS_DIR/Info.plist"

# PkgInfo
echo "APPL????" > "$CONTENTS_DIR/PkgInfo"

# 3. Gerar arquivo ZIP para fácil distribuição
echo "🗜️ Gerando arquivo compactado para distribuição..."
cd "$SCRIPT_DIR/dist"
zip -r -q "Barao-macOS.zip" "$BUNDLE_NAME"

echo "✅ App compilado com sucesso!"
echo "📍 Localização do App: $APP_DIR"
echo "📦 Arquivo ZIP: $SCRIPT_DIR/dist/Barao-macOS.zip"
echo ""
echo "👉 Para instalar no seu Mac, basta arrastar o Barao.app para a sua pasta /Applications!"
