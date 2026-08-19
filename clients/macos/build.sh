#!/usr/bin/env bash
set -e

echo "🚀 Iniciando compilação do Barão macOS v1.3.0..."

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
echo "📦 Compilando binário nativo com Swift SPM..."
swift build -c release --arch arm64 --arch x86_64 2>/dev/null || swift build -c release

# 2. Criar estrutura do .app
echo "📂 Estruturando o pacote $BUNDLE_NAME..."
rm -rf "$SCRIPT_DIR/dist"
mkdir -p "$MACOS_DIR"
mkdir -p "$RESOURCES_DIR"

# Copiar executável
if [ -f "$BUILD_DIR/Barao" ]; then
    cp "$BUILD_DIR/Barao" "$MACOS_DIR/Barao"
elif [ -f "$SCRIPT_DIR/.build/apple/Products/Release/Barao" ]; then
    cp "$SCRIPT_DIR/.build/apple/Products/Release/Barao" "$MACOS_DIR/Barao"
else
    echo "❌ Executável Barao não encontrado no build!"
    exit 1
fi
chmod +x "$MACOS_DIR/Barao"

# Copiar Info.plist
cp "$SCRIPT_DIR/Info.plist" "$CONTENTS_DIR/Info.plist"

# Copiar ícone e gerar .icns nativo
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

# 2.5 Assinatura de Codigo Ad-hoc com Entitlements
if command -v codesign >/dev/null 2>&1; then
    echo "🔏 Assinando aplicativo com Entitlements (permissão única permanente)..."
    codesign --force --deep --sign - --entitlements "$SCRIPT_DIR/Entitlements.plist" "$APP_DIR" 2>/dev/null || codesign --force --deep --sign - "$APP_DIR" 2>/dev/null || true
fi

# 3. Gerar arquivo ZIP
echo "🗜️ Gerando arquivo compactado Barao-macOS-v1.3.0.zip..."
cd "$SCRIPT_DIR/dist"
zip -r -q "Barao-macOS-v1.3.0.zip" "$BUNDLE_NAME"
cp "Barao-macOS-v1.3.0.zip" "Barao-macOS.zip"

# 4. Gerar instalador oficial Apple .DMG
if command -v hdiutil >/dev/null 2>&1; then
    echo "💿 Criando instalador Apple DMG (Barao.dmg)..."
    DMG_TMP="$SCRIPT_DIR/dist/dmg_staging"
    rm -rf "$DMG_TMP" "$SCRIPT_DIR/dist/Barao.dmg" "$SCRIPT_DIR/dist/Barao-v1.3.0.dmg"
    mkdir -p "$DMG_TMP"
    cp -R "$APP_DIR" "$DMG_TMP/"
    ln -s /Applications "$DMG_TMP/Applications"
    
    hdiutil create -volname "Barao AI Installer" -srcfolder "$DMG_TMP" -ov -format UDZO "$SCRIPT_DIR/dist/Barao.dmg"
    cp "$SCRIPT_DIR/dist/Barao.dmg" "$SCRIPT_DIR/dist/Barao-v1.3.0.dmg"
    rm -rf "$DMG_TMP"
    echo "✅ Instalador DMG gerado com sucesso!"
fi

echo "=========================================="
echo "🎉 Versão v1.3.0 compilada com sucesso!"
echo "📍 Aplicativo: $APP_DIR"
echo "💿 Instalador DMG: $SCRIPT_DIR/dist/Barao.dmg"
echo "📦 Arquivo ZIP: $SCRIPT_DIR/dist/Barao-macOS.zip"
echo "=========================================="
