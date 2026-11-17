#!/usr/bin/env bash
# Builds the Android app and tests it on an emulator. Everything Android-specific
# (SDK, Gradle, emulator, Maestro) runs in the skipper-exam-android image
# (docker/android), so nothing needs installing on the machine.
#
#   android.sh image     build the toolchain image (once; it's large)
#   android.sh build     build a debug APK for SERVER_URL (default: this worktree's stack)
#   android.sh e2e       build the APK for this worktree's stack and run the Maestro
#                        flows in e2e/android/ on an emulator (TEST_RUN_DIR: where to
#                        record results and screenshots)
#
# The emulator reaches the stack on its own loopback address through adb reverse,
# so the APK uses the same addresses as the browser tests. One emulator runs at a
# time on the machine (the "android" lock), since it uses fixed adb ports.
set -euo pipefail

root=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
cd "$root"
image=skipper-exam-android
apk=web/android/app/build/outputs/apk/debug/app-debug.apk

ensure_image() {
  if ! docker image inspect "$image" >/dev/null 2>&1; then
    docker build -t "$image" docker/android
  fi
}

# Runs a command in the toolchain image as the current user, with the repository
# mounted at the same path. Its home folder is kept between runs: it holds Gradle's
# cache and the debug signing key, which must stay the same so a new build installs
# over the previous one.
in_image() {
  local home="${XDG_CACHE_HOME:-$HOME/.cache}/skipper-exam-android"
  mkdir -p "$home"
  docker run --rm --user "$(id -u):$(id -g)" \
    -e HOME=/build-home -v "$home:/build-home" \
    -v "$root:$root" -w "$root" "$image" "$@"
}

build() {
  local server=${SERVER_URL:-}
  if [[ -z "$server" ]]; then
    [[ -f .stack.env ]] || scripts/stack.sh up
    server=$(sed -n 's/^APP_URL=//p' .stack.env)
  fi
  ensure_image
  echo "building the app for $server"
  (cd web && VITE_SERVER_URL="$server" pnpm --silent build && pnpm --silent exec cap sync android >/dev/null)
  in_image bash -c "cd web/android && ./gradlew --no-daemon --quiet assembleDebug"
  echo "built $apk"
}

e2e() {
  scripts/stack.sh up
  build
  local out=${TEST_RUN_DIR:?run through scripts/test-run.sh android (make android-e2e)}
  mkdir -p "$out"
  # shellcheck disable=SC1091
  set -a; . ./.stack.env; set +a
  scripts/lock.sh android docker run --rm --device /dev/kvm --network host \
    -v "$root:$root" -w "$root" \
    -e APP_URL -e MOCK_OIDC_URL -e KRATOS_ADMIN_URL -e MAILPIT_URL -e OUT="$out" -e APK="$root/$apk" \
    -e HOST_UID="$(id -u)" -e HOST_GID="$(id -g)" \
    "$image" bash e2e/android/run.sh
}

case "${1:-}" in
  image) docker build -t "$image" docker/android ;;
  build) build ;;
  e2e) e2e ;;
  *) echo "usage: $0 image|build|e2e" >&2; exit 2 ;;
esac
