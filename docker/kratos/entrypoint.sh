#!/bin/sh
# Writes Kratos's configuration from the template and the environment, then runs
# Kratos with the given arguments (serve, migrate, ...). See docs/DEPLOYMENT.md.
set -eu

# Values go into YAML and through sed, so they're limited to characters that are
# safe in both. Secrets and SMTP passwords with other characters belong in the
# environment variables Kratos reads itself (DSN, COURIER_SMTP_CONNECTION_URI).
check() {
  eval "value=\${$1:-}"
  if [ -z "$value" ]; then
    echo "kratos: $1 is required" >&2
    exit 1
  fi
  case "$value" in
    *[!A-Za-z0-9._:/@+=-]*)
      echo "kratos: $1 may only contain letters, digits and . _ : / @ + = -" >&2
      exit 1
      ;;
  esac
}
for name in APP_URL COOKIE_SECRET CIPHER_SECRET MAIL_FROM OIDC_ISSUER_URL OIDC_CLIENT_ID OIDC_CLIENT_SECRET; do
  check "$name"
done
if [ "${#CIPHER_SECRET}" -ne 32 ]; then
  echo "kratos: CIPHER_SECRET must be exactly 32 characters" >&2
  exit 1
fi
if [ "${#COOKIE_SECRET}" -lt 16 ]; then
  echo "kratos: COOKIE_SECRET must be at least 16 characters" >&2
  exit 1
fi

config=/tmp/kratos.yml
sed -e "s|__APP_URL__|${APP_URL%/}|g" \
  -e "s|__COOKIE_SECRET__|$COOKIE_SECRET|" -e "s|__CIPHER_SECRET__|$CIPHER_SECRET|" \
  -e "s|__MAIL_FROM__|$MAIL_FROM|" \
  -e "s|__OIDC_ISSUER_URL__|$OIDC_ISSUER_URL|" \
  -e "s|__OIDC_CLIENT_ID__|$OIDC_CLIENT_ID|" -e "s|__OIDC_CLIENT_SECRET__|$OIDC_CLIENT_SECRET|" \
  /etc/config/kratos/kratos.yml.tmpl >"$config"

# KRATOS_DEV=true allows plain http, for the test stack on 127.0.0.1 only.
dev=""
if [ "${KRATOS_DEV:-}" = "true" ]; then
  dev="--dev"
fi
case "${1:-}" in
  serve) shift && exec kratos serve $dev --watch-courier --config "$config" "$@" ;;
  migrate) shift && exec kratos migrate sql -e --yes --config "$config" "$@" ;;
  *) exec kratos "$@" ;;
esac
