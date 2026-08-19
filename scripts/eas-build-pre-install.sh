#!/usr/bin/env bash
# EAS Build pre-install hook
# This script runs BEFORE npm/pnpm install on the EAS build server.
# It sets up required environment for the build.

set -e

echo "[eas-pre-install] Setting up build environment..."

# Print Java and Node versions for debugging
java -version 2>&1 || true
node --version || true

echo "[eas-pre-install] Done."
