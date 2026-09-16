#!/usr/bin/env bash
# Instala o toolchain Solana (Rust + Solana CLI + Anchor) no Linux/WSL.
# Uso:  bash scripts/setup-solana-toolchain.sh
set -euo pipefail

log() { echo -e "\n=== $* ==="; }

log "Dependências de build"
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -qq
sudo apt-get install -y -qq build-essential pkg-config libssl-dev libudev-dev \
  llvm clang cmake make protobuf-compiler

log "Rust"
if ! command -v rustc >/dev/null 2>&1; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal
fi
# shellcheck disable=SC1091
. "$HOME/.cargo/env"
rustc --version

log "Solana CLI (Anza)"
if ! command -v solana >/dev/null 2>&1; then
  sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
fi
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
solana --version

log "Anchor via AVM"
# Repositório indicado pela documentação oficial (anchor-lang.com/docs/installation);
# github.com/solana-foundation/anchor redireciona para cá.
if ! command -v avm >/dev/null 2>&1; then
  cargo install --git https://github.com/otter-sec/anchor avm --force
fi
avm install latest
avm use latest
anchor --version

log "PATH permanente"
PROFILE="$HOME/.bashrc"
grep -q 'solana/install/active_release/bin' "$PROFILE" 2>/dev/null || \
  echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"' >> "$PROFILE"
grep -q '.cargo/env' "$PROFILE" 2>/dev/null || \
  echo '. "$HOME/.cargo/env"' >> "$PROFILE"

log "Pronto"
echo "rustc:  $(rustc --version)"
echo "solana: $(solana --version)"
echo "anchor: $(anchor --version)"
