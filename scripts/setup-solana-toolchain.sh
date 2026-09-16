#!/usr/bin/env bash
# Instala o toolchain Solana (Rust + Solana CLI + Anchor) no Linux/WSL.
#
# Sem `curl | sh`: o Rust vem do rustup empacotado pelo Ubuntu, o Solana CLI vem
# do tarball oficial da release, e o Anchor vem do crates.io. Assim cada passo
# instala artefato assinado ou versionado, e não um script remoto.
#
# Uso:  bash scripts/setup-solana-toolchain.sh
set -euo pipefail

SOLANA_VERSION="${SOLANA_VERSION:-v4.2.2}"      # release do Agave (anza-xyz/agave)
ANCHOR_VERSION="${ANCHOR_VERSION:-1.2.0}"       # crate anchor-cli (otter-sec/anchor)
SOLANA_HOME="$HOME/.local/share/solana/install"

log() { echo -e "\n=== $* ==="; }

log "Dependências de build e rustup"
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
# O crate `avm` do crates.io é de outro projeto (gerenciador de node.js).
# O gerenciador do Anchor mora em github.com/otter-sec/anchor; aqui instalamos
# direto o anchor-cli publicado no crates.io por esse mesmo repositório.
command -v anchor >/dev/null 2>&1 || cargo install anchor-cli --version "$ANCHOR_VERSION" --locked
anchor --version

log "PATH permanente"
PROFILE="$HOME/.bashrc"
grep -q 'solana/install/active_release/bin' "$PROFILE" 2>/dev/null || \
  echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"' >> "$PROFILE"

log "Pronto"
echo "rustc:  $(rustc --version)"
echo "solana: $(solana --version)"
echo "anchor: $(anchor --version)"
echo
echo "Próximo passo (cria chave local, guarde a seed):"
echo "  solana config set --url devnet"
echo "  solana-keygen new -o ~/.config/solana/id.json"
echo "  solana airdrop 2"
