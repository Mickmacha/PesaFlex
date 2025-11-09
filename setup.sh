#!/usr/bin/env bash
set -euo pipefail

echo "🔧 Ensuring pipx is installed…"
if ! command -v pipx >/dev/null 2>&1; then
  # sudo apt-get update -y
  sudo apt-get install -y pipx python3-venv
fi

echo "🔧 Ensuring ~/.local/bin is on PATH for this session…"
export PATH="$HOME/.local/bin:$PATH"

echo "📦 Installing / upgrading Algokit CLI via pipx…"
if command -v algokit >/dev/null 2>&1; then
  # upgrade if already present
  pipx upgrade algokit || true
else
  pipx install algokit
fi
# make sure PATH updates are persisted for future shells
pipx ensurepath || true

echo "🐍 Installing Python libraries…"
python3 -m pip install -U pip
python3 -m pip install -U py-algorand-sdk python-dotenv algokit-utils

# Workspace root (monorepo) — safe if package.json exists; otherwise skip
if [ -f package.json ]; then
  echo "🧰 Installing root npm deps…"
  ( npm ci || npm install )
fi

FRONTEND_DIR="QuickStartTemplate/projects/QuickStartTemplate-frontend"
CONTRACTS_DIR="QuickStartTemplate/projects/QuickStartTemplate-contracts"

echo "🧰 Installing frontend npm deps…"
if [ -f "$FRONTEND_DIR/package.json" ]; then
  ( npm --prefix "$FRONTEND_DIR" ci || npm --prefix "$FRONTEND_DIR" install )
  # Ensure the client generator dev dep is present (your requested line)
  npm --prefix "$FRONTEND_DIR" install --save-dev @algorandfoundation/algokit-client-generator@latest
fi

echo "🧰 Installing contracts npm deps…"
if [ -f "$CONTRACTS_DIR/package.json" ]; then
  ( npm --prefix "$CONTRACTS_DIR" ci || npm --prefix "$CONTRACTS_DIR" install )
fi

echo "🧬 Generating app clients (non-interactive)…"
if [ -d "$FRONTEND_DIR" ]; then
  (
    cd "$FRONTEND_DIR"
    ALGOKIT_NO_INTERACTIVE=1 ALGOKIT_NO_SPINNER=1 \
    algokit project link --all || true
  )
fi

echo "🚀 Bootstrapping project (non-interactive)…"
ALGOKIT_NO_INTERACTIVE=1 ALGOKIT_NO_SPINNER=1 \
algokit project bootstrap all || true

echo "✅ Devcontainer post-create setup complete."
