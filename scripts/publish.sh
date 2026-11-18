#!/usr/bin/env bash
# Builds the production images from origin/main and pushes them to ghcr.io, tagged
# with the commit sha and latest (see docs/DEPLOYMENT.md). Run by `make integrate`
# after a merge; `make publish` runs it again, e.g. after logging in.
#
# The images are built from this checkout, which must hold exactly origin/main's
# files: the merged commit gets a new sha on GitHub, but its files are the tested ones.
#
# Needs a login with write access to packages, once per machine:
#   gh auth refresh -h github.com -s write:packages
#   gh auth token | docker login ghcr.io -u <github user> --password-stdin
set -euo pipefail

root=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
cd "$root"
prefix=ghcr.io/popescustefanradu/skipper-exam
source_url=https://github.com/PopescuStefanRadu/skipper_exam

git fetch --quiet origin
sha=$(git rev-parse origin/main)
if [[ "$(git rev-parse 'HEAD^{tree}')" != "$(git rev-parse 'origin/main^{tree}')" || -n "$(git status --porcelain -- . ':!test-runs')" ]]; then
  echo "publish: this checkout doesn't hold origin/main's files; run it from main, up to date" >&2
  exit 1
fi

for image in app:. backup:docker/backup; do
  name=${image%%:*} context=${image#*:}
  echo "== building $prefix-$name:${sha:0:12}"
  docker build --quiet --label "org.opencontainers.image.source=$source_url" \
    --label "org.opencontainers.image.revision=$sha" \
    -t "$prefix-$name:$sha" -t "$prefix-$name:latest" "$context" >/dev/null
done
for name in app backup; do
  if ! docker push --quiet "$prefix-$name:$sha" || ! docker push --quiet "$prefix-$name:latest"; then
    echo "publish: pushing to ghcr.io failed. Log in once (see the top of scripts/publish.sh), then run make publish." >&2
    exit 1
  fi
done
echo "published $prefix-{app,backup}:$sha (and latest)"
