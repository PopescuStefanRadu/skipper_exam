#!/usr/bin/env bash
# Signs in to the app at APP_URL as the Android app does, through the stack's fake
# sign-in service (mock-oidc), and prints the session token. For scripts that check
# the server through its API (e2e/android/run.sh, scripts/deploy-test.sh).
#
#   e2e/sign-in.sh APP_URL EMAIL
set -euo pipefail
app=$1 email=$2

# /auth/login sends the browser to the sign-in service's authorize page.
authorize=$(curl -fsS -o /dev/null -w '%{redirect_url}' "$app/auth/login?platform=app")
# The fake service's form: posting it signs in as `email` and redirects to the
# app's callback with a code.
callback=$(curl -fsS -o /dev/null -w '%{redirect_url}' "$authorize" \
  --data-urlencode "username=$email" --data-urlencode "claims={\"email\":\"$email\"}")
# The callback sends the app back to itself with a one-time code (read from the
# header as sent: curl would rewrite the app's link).
back=$(curl -fsS -o /dev/null -D - "$callback" | sed -n 's/^[Ll]ocation: //p' | tr -d '\r')
code=${back#*code=}
[[ "$back" == ro.skipperexam.app://auth\?code=* ]] || { echo "sign-in failed: $back" >&2; exit 1; }
curl -fsS -X POST "$app/auth/app-token" -H 'Content-Type: application/json' -d "{\"code\":\"$code\"}" | jq -r .sessionToken
