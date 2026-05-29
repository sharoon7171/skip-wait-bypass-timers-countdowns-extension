#!/usr/bin/env bash
set -e

BUILD_DIR="build"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

mkdir -p "$BUILD_DIR"
rm -f "$BUILD_DIR"/*.zip

npm run build

VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('package.json','utf8')).version)")
(cd dist && zip -r "../$BUILD_DIR/skip-wait-${VERSION}.zip" .)

echo "Created $BUILD_DIR/skip-wait-${VERSION}.zip"
