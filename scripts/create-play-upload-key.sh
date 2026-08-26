#!/usr/bin/env bash
set -euo pipefail

KEYSTORE=${1:-play-upload-key.jks}
ALIAS=${ANDROID_KEY_ALIAS:-family-treasury-upload}
B64_FILE=${KEYSTORE%.jks}.b64

if ! command -v keytool >/dev/null 2>&1; then
  echo 'keytool not found. Install a JDK (Java 21 recommended) and try again.' >&2
  exit 1
fi

if [ -e "$KEYSTORE" ]; then
  echo "Refusing to overwrite existing $KEYSTORE" >&2
  exit 1
fi

read -rsp 'Keystore password: ' STORE_PASSWORD; echo
read -rsp 'Repeat keystore password: ' STORE_PASSWORD_2; echo
if [ "$STORE_PASSWORD" != "$STORE_PASSWORD_2" ]; then
  echo 'Passwords do not match.' >&2
  exit 1
fi
if [ ${#STORE_PASSWORD} -lt 12 ]; then
  echo 'Use a password of at least 12 characters.' >&2
  exit 1
fi

read -rsp 'Key password (Enter = same as keystore): ' KEY_PASSWORD; echo
KEY_PASSWORD=${KEY_PASSWORD:-$STORE_PASSWORD}

keytool -genkeypair \
  -keystore "$KEYSTORE" \
  -storetype PKCS12 \
  -alias "$ALIAS" \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000 \
  -storepass "$STORE_PASSWORD" \
  -keypass "$KEY_PASSWORD" \
  -dname 'CN=Family Treasury Upload, OU=Android, O=Family Treasury, C=KZ'

base64 < "$KEYSTORE" | tr -d '\n' > "$B64_FILE"
chmod 600 "$KEYSTORE" "$B64_FILE" 2>/dev/null || true

cat <<EOF

Upload key created.

Keep BOTH files private and backed up securely:
  $KEYSTORE
  $B64_FILE

Add these GitHub Actions secrets:
  ANDROID_KEYSTORE_BASE64  = contents of $B64_FILE
  ANDROID_KEYSTORE_PASSWORD = the keystore password
  ANDROID_KEY_ALIAS         = $ALIAS
  ANDROID_KEY_PASSWORD      = the key password

Do not commit either file to Git.
EOF
