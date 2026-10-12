#!/usr/bin/env bash
# Builds the signed production APK for the Solana dApp Store and checks it
# before anything is uploaded: package name, signing certificate, API endpoint.
#
#   RELEASE_STORE_FILE=/path/to/echoes-upload-key.jks \
#   RELEASE_KEY_ALIAS=echoes-upload \
#   ./build-release.sh
#
# The two passwords are asked for interactively when they are not already in the
# environment, so they never land in shell history.
set -euo pipefail
cd "$(dirname "$0")"

PACKAGE="fans.echoes.app"
# SHA-256 of the release certificate. It is also published in
# https://app.echoes.fans/.well-known/assetlinks.json; a build signed with any
# other key would lose App Links and could never update the published app.
EXPECTED_CERT="9ed08ac4a9f068f9a9d9672c135ae9825364546da950e23d9180f45d02dd572e"
API_URL="https://app.echoes.fans/app-api"

: "${RELEASE_STORE_FILE:?Set RELEASE_STORE_FILE to the keystore path}"
: "${RELEASE_KEY_ALIAS:=echoes-upload}"
[[ -f "$RELEASE_STORE_FILE" ]] || { echo "Keystore not found: $RELEASE_STORE_FILE" >&2; exit 1; }

if [[ -z "${RELEASE_STORE_PASSWORD:-}" ]]; then
  read -rsp "Keystore password: " RELEASE_STORE_PASSWORD; echo
fi
if [[ -z "${RELEASE_KEY_PASSWORD:-}" ]]; then
  read -rsp "Key password (Enter if same as keystore): " RELEASE_KEY_PASSWORD; echo
  RELEASE_KEY_PASSWORD="${RELEASE_KEY_PASSWORD:-$RELEASE_STORE_PASSWORD}"
fi
export RELEASE_STORE_FILE RELEASE_STORE_PASSWORD RELEASE_KEY_ALIAS RELEASE_KEY_PASSWORD

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
BUILD_TOOLS="$(ls -d "$SDK"/build-tools/* | sort -V | tail -1)"

./gradlew clean :app:assembleRelease :app:bundleRelease

APK=app/build/outputs/apk/release/app-release.apk
AAB=app/build/outputs/bundle/release/app-release.aab
[[ -f "$APK" ]] || { echo "Release APK was not produced (is signing configured?)" >&2; exit 1; }

echo "Checking the build..."
"$BUILD_TOOLS/apksigner" verify "$APK"
CERT="$("$BUILD_TOOLS/apksigner" verify --print-certs "$APK" \
  | awk -F': ' '/certificate SHA-256 digest/ {print $NF; exit}')"
if [[ "$CERT" != "$EXPECTED_CERT" ]]; then
  echo "Wrong signing key: got $CERT, expected $EXPECTED_CERT" >&2
  exit 1
fi

BADGING="$("$BUILD_TOOLS/aapt2" dump badging "$APK")"
grep -q "package: name='$PACKAGE'" <<<"$BADGING" || { echo "Package is not $PACKAGE" >&2; exit 1; }
if grep -q "application-debuggable" <<<"$BADGING"; then
  echo "APK is debuggable" >&2; exit 1
fi
VERSION="$(sed -n "s/.*versionName='\([^']*\)'.*/\1/p" <<<"$BADGING" | head -1)"
VERSION_CODE="$(sed -n "s/.*versionCode='\([^']*\)'.*/\1/p" <<<"$BADGING" | head -1)"

# The API endpoint is a BuildConfig constant, so it is in the dex as a string.
unzip -p "$APK" 'classes*.dex' | LC_ALL=C grep -aq "$API_URL" \
  || { echo "APK does not point at $API_URL" >&2; exit 1; }

mkdir -p dist
cp "$APK" "dist/echoes-$VERSION-signed.apk"
cp "$AAB" "dist/echoes-$VERSION.aab"
shasum -a 256 "dist/echoes-$VERSION-signed.apk" "dist/echoes-$VERSION.aab" > "dist/echoes-$VERSION.sha256"

echo
echo "OK  $PACKAGE $VERSION (versionCode $VERSION_CODE), signed with the release key"
echo "    dist/echoes-$VERSION-signed.apk  <- upload this to the dApp Store"
echo "    dist/echoes-$VERSION.aab"
