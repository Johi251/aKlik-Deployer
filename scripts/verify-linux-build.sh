#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
project_root="$PWD"
engine="$project_root/src-tauri/binaries/aklik-engine-x86_64-unknown-linux-gnu"
test -f "$engine" || { printf '%s\n' 'Zuerst bun scripts/verify-platforms.ts ausführen.' >&2; exit 1; }
export CARGO_HOME="$project_root/.data/linux-cargo"
export CARGO_TARGET_DIR="$project_root/.data/linux-target"
export BUN_INSTALL_CACHE_DIR="$project_root/.data/linux-bun-cache"
tools="$project_root/.data/linux-tools"
mkdir -p "$tools" "$project_root/.data/verification"
printf '%s\n' '{"private":true,"dependencies":{"@tauri-apps/cli":"2.12.4"}}' > "$tools/package.json"
printf '%s\n' '{"build":{"beforeBuildCommand":null}}' > "$project_root/.data/verification/linux-build-config.json"
# The existing engine also contains the official Bun CLI; no second runtime is needed.
BUN_BE_BUN=1 "$engine" install --cwd "$tools"
BUN_BE_BUN=1 "$engine" -e 'require("./.data/linux-tools/node_modules/@tauri-apps/cli/main.js").run(["build","--bundles","deb","--config",".data/verification/linux-build-config.json"],"bun tauri").catch(error=>{console.error(error.message);process.exit(1);})'
