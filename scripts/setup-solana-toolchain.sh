#!/usr/bin/env bash
# Installs the Solana toolchain (Rust + Solana CLI + Anchor) on Linux or WSL.
#
# No `curl | sh`: Rust comes from the rustup Ubuntu packages, the Solana CLI
# from the official release tarball, and Anchor from crates.io. Every step
# installs a signed or versioned artifact rather than a remote script.
#
# Usage:  bash scripts/setup-solana-toolchain.sh
set -euo pipefail

SOLANA_VERSION="${SOLANA_VERSION:-v4.2.2}"      # Agave release (anza-xyz/agave)
ANCHOR_VERSION="${ANCHOR_VERSION:-1.2.0}"       # the anchor-cli crate (otter-sec/anchor)
SOLANA_HOME="$HOME/.local/share/solana/install"

log() { echo -e "\n=== $* ==="; }

log "Build dependencies and rustup"
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -qq
sudo apt-get install -y -qq build-essential pkg-config libssl-dev libudev-dev \
  protobuf-compiler rustup curl bzip2

log "Rust"
rustup default stable
export PATH="$HOME/.cargo/bin:$PATH"
rustc --version

log "Solana CLI $SOLANA_VERSION"
if [ ! -x "$SOLANA_HOME/active_release/bin/solana" ]; then
  mkdir -p "$SOLANA_HOME/releases/$SOLANA_VERSION"
  curl -fsSL -o "/tmp/solana-$SOLANA_VERSION.tar.bz2" \
    "https://github.com/anza-xyz/agave/releases/download/$SOLANA_VERSION/solana-release-x86_64-unknown-linux-gnu.tar.bz2"
  tar -xjf "/tmp/solana-$SOLANA_VERSION.tar.bz2" -C "$SOLANA_HOME/releases/$SOLANA_VERSION"
  ln -sfn "$SOLANA_HOME/releases/$SOLANA_VERSION/solana-release" "$SOLANA_HOME/active_release"
fi
export PATH="$SOLANA_HOME/active_release/bin:$PATH"
solana --version

log "Anchor $ANCHOR_VERSION"
# The `avm` crate on crates.io belongs to a different project (a node.js
# version manager). Anchor's own manager lives in github.com/otter-sec/anchor;
# here we install the anchor-cli that same repository publishes to crates.io.
command -v anchor >/dev/null 2>&1 || cargo install anchor-cli --version "$ANCHOR_VERSION" --locked
anchor --version

log "Making the PATH permanent"
PROFILE="$HOME/.bashrc"
grep -q 'solana/install/active_release/bin' "$PROFILE" 2>/dev/null || \
  echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"' >> "$PROFILE"

log "Done"
echo "rustc:  $(rustc --version)"
echo "solana: $(solana --version)"
echo "anchor: $(anchor --version)"
echo
echo "Next step (creates a local key — keep the seed):"
echo "  solana config set --url devnet"
echo "  solana-keygen new -o ~/.config/solana/id.json"
echo "  solana airdrop 2"
