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

# Copiar ícone e gerar .icns nativo para macOS
if [ -f "$SCRIPT_DIR/Resources/AppIcon.png" ]; then
    cp "$SCRIPT_DIR/Resources/AppIcon.png" "$RESOURCES_DIR/AppIcon.png"
    cp "$SCRIPT_DIR/Resources/"AppIcon*.png "$RESOURCES_DIR/" 2>/dev/null || true
    
    if command -v iconutil >/dev/null 2>&1 && command -v sips >/dev/null 2>&1; then
        echo "🎨 Gerando ícone Apple (.icns)..."
        ICONSET_DIR="$SCRIPT_DIR/dist/AppIcon.iconset"
        mkdir -p "$ICONSET_DIR"
        sips -z 16 16 "$SCRIPT_DIR/Resources/AppIcon.png" --out "$ICONSET_DIR/icon_16x16.png" 2>/dev/null || true
        sips -z 32 32 "$SCRIPT_DIR/Resources/AppIcon.png" --out "$ICONSET_DIR/icon_16x16@2x.png" 2>/dev/null || true
        sips -z 32 32 "$SCRIPT_DIR/Resources/AppIcon.png" --out "$ICONSET_DIR/icon_32x32.png" 2>/dev/null || true
        sips -z 64 64 "$SCRIPT_DIR/Resources/AppIcon.png" --out "$ICONSET_DIR/icon_32x32@2x.png" 2>/dev/null || true
        sips -z 128 128 "$SCRIPT_DIR/Resources/AppIcon.png" --out "$ICONSET_DIR/icon_128x128.png" 2>/dev/null || true
        sips -z 256 256 "$SCRIPT_DIR/Resources/AppIcon.png" --out "$ICONSET_DIR/icon_128x128@2x.png" 2>/dev/null || true
        sips -z 256 256 "$SCRIPT_DIR/Resources/AppIcon.png" --out "$ICONSET_DIR/icon_256x256.png" 2>/dev/null || true
        sips -z 512 512 "$SCRIPT_DIR/Resources/AppIcon.png" --out "$ICONSET_DIR/icon_256x256@2x.png" 2>/dev/null || true
        sips -z 512 512 "$SCRIPT_DIR/Resources/AppIcon.png" --out "$ICONSET_DIR/icon_512x512.png" 2>/dev/null || true
        sips -z 1024 1024 "$SCRIPT_DIR/Resources/AppIcon.png" --out "$ICONSET_DIR/icon_512x512@2x.png" 2>/dev/null || true
        iconutil -c icns "$ICONSET_DIR" -o "$RESOURCES_DIR/AppIcon.icns" 2>/dev/null || true
        rm -rf "$ICONSET_DIR"
    fi
fi

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
