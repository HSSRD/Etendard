#!/bin/sh
# Lancé dans l'image Docker officielle de Playwright par scripts/maj-captures.js.
set -eu
npm install --global --silent "pnpm@$PNPM_VERSION"
pnpm runtime set node "$NODE_VERSION" --global --yes
pnpm install --frozen-lockfile
pnpm exec playwright test "$@"
