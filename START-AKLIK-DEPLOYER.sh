#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
bun install --frozen-lockfile
bun run build
bun run start
