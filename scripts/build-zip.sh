#!/usr/bin/env bash
set -e

BUILD_DIR="build"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

mkdir -p "$BUILD_DIR"
rm -f "$BUILD_DIR"/*.zip

if [[ ! -d dist ]] || [[ ! -f dist/manifest.json ]] || [[ ! -f dist/content.js ]]; then
  echo "dist is missing manifest.json or content.js; run npm run build first." >&2
  exit 1
fi

VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('package.json','utf8')).version)")
(cd dist && zip -r "../$BUILD_DIR/skip-wait-${VERSION}.zip" .)

echo "Created $BUILD_DIR/skip-wait-${VERSION}.zip"
