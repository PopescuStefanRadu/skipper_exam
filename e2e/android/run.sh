#!/usr/bin/env bash
# Runs inside the skipper-exam-android image (see scripts/android.sh): starts the
# emulator, installs the APK and runs the Maestro flows against the stack. Between
# flows it cuts and restores the app's connection to the server, by removing and
# re-adding the adb reverse tunnel the emulator reaches the stack through.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p "$OUT/android"
trap 'collect_screenshots >/dev/null 2>&1 || true; chown -R "$HOST_UID:$HOST_GID" "$OUT" 2>/dev/null || true; adb emu kill >/dev/null 2>&1 || true' EXIT

port() { sed -E 's#.*:([0-9]+).*#\1#' <<<"$1"; }
app_port=$(port "$APP_URL")
oidc_port=$(port "$MOCK_OIDC_URL")
online() {
  adb reverse "tcp:$app_port" "tcp:$app_port" >/dev/null
  adb reverse "tcp:$oidc_port" "tcp:$oidc_port" >/dev/null
}
offline() { adb reverse --remove-all; }

echo "starting the emulator"
emulator -avd test -no-window -no-audio -no-boot-anim -no-snapshot -wipe-data -gpu swiftshader_indirect \
  >"$OUT/android/emulator.log" 2>&1 &
adb wait-for-device
for _ in $(seq 150); do
  [[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == 1 ]] && break
  sleep 2
done
[[ "$(adb shell getprop sys.boot_completed | tr -d '\r')" == 1 ]] || { echo "emulator did not boot"; exit 1; }
for s in window_animation_scale transition_animation_scale animator_duration_scale; do
  adb shell settings put global "$s" 0
done
# Chrome (where Google sign-in happens) without its first-run screens.
adb shell 'echo "_ --disable-fre --no-default-browser-check --no-first-run" > /data/local/tmp/chrome-command-line'
adb shell am set-debug-app --persistent com.android.chrome
adb install -r "$APK" >/dev/null
online

# This run's user at the fake sign-in service; the first sign-in creates the account.
email="android-$(date +%s%N)@example.test"

flow() {
  echo "== flow $1"
  maestro test --format junit --output "$OUT/android/$1.xml" --test-output-dir "$OUT/android/$1" \
    -e EMAIL="$email" -e CLAIMS="{\"email\":\"$email\"}" "flows/$1.yaml"
}

# Screenshots for inspection, gathered from every flow's output folder.
collect_screenshots() {
  mkdir -p "$OUT/android/screenshots"
  find "$OUT/android" -path "$OUT/android/screenshots" -prune -o -name '[0-9][0-9]-*.png' -print \
    -exec cp {} "$OUT/android/screenshots/" \;
}

flow sign-in
offline
flow offline-exam
online
flow back-online

# The server has the exam taken offline.
echo "== checking the server received the offline exam"
token=$(../sign-in.sh "$APP_URL" "$email")
submitted=$(curl -fsS "$APP_URL/api/events" -H "X-Session-Token: $token" | jq '[.[] | select(.type == "exam.submitted")] | length')
[[ "$submitted" -ge 1 ]] || { echo "no submitted exam on the server"; exit 1; }
echo "server has $submitted submitted exam(s)"

flow sign-out
flow sign-in-again
